// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { GatewayStore } from '../store.js';

let tmpDir;
let storePath;
let store;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gateway-store-test-'));
  storePath = path.join(tmpDir, 'gateways.json');
  store = new GatewayStore(storePath);
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('GatewayStore CRUD', () => {
  it('starts empty with no active Gateway', async () => {
    expect(await store.list()).toEqual([]);
    expect(await store.getActiveId()).toBeNull();
  });

  it('creates a Gateway with an internal ID and sensible defaults', async () => {
    const created = await store.create({ name: 'Lab Gateway', host: '10.20.30.40', username: 'admin' });
    expect(created.id).toBeTruthy();
    expect(created.port).toBe(443);
    expect(created.protocol).toBe('https');
    expect(created.locked).toBe(false);
    expect(created.password).toBeUndefined();
  });

  it('auto-selects the first created Gateway as active', async () => {
    const created = await store.create({ name: 'Lab Gateway', host: '10.20.30.40' });
    expect(await store.getActiveId()).toBe(created.id);
  });

  it('does not overwrite the active Gateway when a second one is created', async () => {
    const first = await store.create({ name: 'First', host: '10.0.0.1' });
    await store.create({ name: 'Second', host: '10.0.0.2' });
    expect(await store.getActiveId()).toBe(first.id);
  });

  it('updates a Gateway profile', async () => {
    const created = await store.create({ name: 'Lab Gateway', host: '10.20.30.40' });
    const updated = await store.update(created.id, { name: 'Renamed', port: 8443 });
    expect(updated.name).toBe('Renamed');
    expect(updated.port).toBe(8443);
    expect(updated.id).toBe(created.id);
  });

  it('removes a Gateway and reassigns the active Gateway if needed', async () => {
    const first = await store.create({ name: 'First', host: '10.0.0.1' });
    const second = await store.create({ name: 'Second', host: '10.0.0.2' });
    await store.setActive(first.id);
    await store.remove(first.id);
    expect(await store.getActiveId()).toBe(second.id);
    expect((await store.list()).map((g) => g.id)).toEqual([second.id]);
  });

  it('switching the active Gateway does not mutate other Gateway profiles', async () => {
    const first = await store.create({ name: 'First', host: '10.0.0.1' });
    const second = await store.create({ name: 'Second', host: '10.0.0.2' });
    await store.setActive(second.id);
    const list = await store.list();
    expect(list.find((g) => g.id === first.id).host).toBe('10.0.0.1');
    expect(await store.getActiveId()).toBe(second.id);
  });

  it('setActive throws for an unknown Gateway ID', async () => {
    await expect(store.setActive('does-not-exist')).rejects.toThrow('Gateway not found');
  });

  it('never persists the password field to disk', async () => {
    await store.create({ name: 'Lab', host: '10.0.0.1', username: 'admin', password: 'hunter2' });
    const raw = await fs.readFile(storePath, 'utf-8');
    expect(raw).not.toContain('hunter2');
    expect(raw).not.toContain('password');
  });
});

describe('GatewayStore locked-profile protections', () => {
  it('refuses to delete a locked Gateway', async () => {
    const locked = await store.create({ name: 'Hosted', host: 'gateway.example.local', locked: true });
    await expect(store.remove(locked.id)).rejects.toMatchObject({ statusCode: 403 });
    expect(await store.get(locked.id)).not.toBeNull();
  });

  it('allows renaming a locked Gateway but ignores host/port/protocol changes', async () => {
    const locked = await store.create({ name: 'Hosted', host: 'gateway.example.local', locked: true });
    const updated = await store.update(locked.id, { name: 'Renamed Hosted', host: '10.0.0.9', port: 9999 });
    expect(updated.name).toBe('Renamed Hosted');
    expect(updated.host).toBe('gateway.example.local');
    expect(updated.port).toBe(443);
  });
});

describe('GatewayStore write-chain resilience (regression test)', () => {
  it('does not permanently break future mutations after one mutation throws', async () => {
    const locked = await store.create({ name: 'Hosted', host: 'gateway.example.local', locked: true });

    // This mutation is expected to reject (locked Gateway can't be deleted).
    await expect(store.remove(locked.id)).rejects.toMatchObject({ statusCode: 403 });

    // Every subsequent mutation must still work - a prior rejection must not
    // permanently poison the internal write-chain/queue.
    const second = await store.create({ name: 'Second', host: '10.0.0.5' });
    expect(second.id).toBeTruthy();

    const updated = await store.update(second.id, { name: 'Second Renamed' });
    expect(updated.name).toBe('Second Renamed');

    await store.setActive(second.id);
    expect(await store.getActiveId()).toBe(second.id);

    await store.remove(second.id);
    expect(await store.get(second.id)).toBeNull();
  });

  it('handles many interleaved concurrent mutations without losing writes', async () => {
    const creations = Array.from({ length: 15 }, (_, i) =>
      store.create({ name: `Concurrent ${i}`, host: `192.0.2.${i}` })
    );
    const results = await Promise.all(creations);
    expect(new Set(results.map((r) => r.id)).size).toBe(15);
    expect((await store.list()).length).toBe(15);
  });

  it('survives a mix of successful and rejected concurrent mutations', async () => {
    const locked = await store.create({ name: 'Hosted', host: 'gateway.example.local', locked: true });

    const ops = [
      store.remove(locked.id).catch((e) => e), // expected to reject
      store.create({ name: 'A', host: '10.0.0.1' }),
      store.remove(locked.id).catch((e) => e), // expected to reject
      store.create({ name: 'B', host: '10.0.0.2' }),
    ];
    const [removeResult1, createA, removeResult2, createB] = await Promise.all(ops);

    expect(removeResult1).toBeInstanceOf(Error);
    expect(removeResult2).toBeInstanceOf(Error);
    expect(createA.id).toBeTruthy();
    expect(createB.id).toBeTruthy();

    const list = await store.list();
    expect(list.map((g) => g.id).sort()).toEqual([locked.id, createA.id, createB.id].sort());
  });
});
