// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import http from 'http';
import express from 'express';
import request from 'supertest';

let app;
let storePath;
let tmpDir;
let createGatewayRouter;
let createGatewayProxyRouter;
let recordRequest;
let GatewayStore;

async function resetStore() {
  await fs.writeFile(storePath, JSON.stringify({ gateways: [], activeGatewayId: null }), 'utf-8');
}

function buildApp(appMode) {
  const testApp = express();
  testApp.use(express.json());
  testApp.use('/api/gateways', createGatewayRouter({ appMode }));
  testApp.use('/api/gateways', createGatewayProxyRouter({ appMode, logRequest: recordRequest }));
  // Minimal error handler mirroring server.js's safety net.
  testApp.use((err, req, res, _next) => {
    res.status(err?.statusCode || 500).json({ error: 'Internal server error' });
  });
  return testApp;
}

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gateway-routes-test-'));
  storePath = path.join(tmpDir, 'gateways.json');
  // Must be set before store.js is first imported, since its singleton
  // reads GATEWAY_STORE_PATH at module-load time.
  process.env.GATEWAY_STORE_PATH = storePath;

  ({ createGatewayRouter } = await import('../routes/gateways.js'));
  ({ createGatewayProxyRouter } = await import('../proxy.js'));
  ({ recordRequest } = await import('../requestLog.js'));
  ({ GatewayStore } = await import('../store.js'));
});

afterAll(async () => {
  delete process.env.GATEWAY_STORE_PATH;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('Gateway routes - local mode', () => {
  beforeEach(async () => {
    await resetStore();
    app = buildApp({ mode: 'local', allowCustomGateways: true });
  });

  it('GET /api/gateways starts empty', async () => {
    const res = await request(app).get('/api/gateways');
    expect(res.status).toBe(200);
    expect(res.body.gateways).toEqual([]);
    expect(res.body.activeGatewayId).toBeNull();
    expect(res.body.appMode).toBe('local');
  });

  it('POST /api/gateways creates a Gateway and never returns the password', async () => {
    const res = await request(app)
      .post('/api/gateways')
      .send({ name: 'Lab Gateway', host: '10.20.30.40', username: 'admin', password: 'hunter2' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.name).toBe('Lab Gateway');
    expect(res.body.password).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
    expect(res.body.hasStoredCredentials).toBe(true);
  });

  it('POST /api/gateways defaults protocol to https and port to 443', async () => {
    const res = await request(app).post('/api/gateways').send({ name: 'Lab', host: '10.0.0.1' });
    expect(res.body.protocol).toBe('https');
    expect(res.body.port).toBe(443);
  });

  it('POST /api/gateways rejects a missing display name', async () => {
    const res = await request(app).post('/api/gateways').send({ host: '10.0.0.1' });
    expect(res.status).toBe(400);
  });

  it('POST /api/gateways rejects an invalid/injected host', async () => {
    const res = await request(app).post('/api/gateways').send({ name: 'Bad', host: '10.0.0.1; rm -rf /' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/host/i);
  });

  it('POST /api/gateways rejects an out-of-range port', async () => {
    const res = await request(app).post('/api/gateways').send({ name: 'Bad', host: '10.0.0.1', port: 999999 });
    expect(res.status).toBe(400);
  });

  it('PUT /api/gateways/:id updates a Gateway', async () => {
    const created = (await request(app).post('/api/gateways').send({ name: 'Lab', host: '10.0.0.1' })).body;
    const res = await request(app).put(`/api/gateways/${created.id}`).send({ name: 'Renamed' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed');
  });

  it('DELETE /api/gateways/:id removes a Gateway', async () => {
    const created = (await request(app).post('/api/gateways').send({ name: 'Lab', host: '10.0.0.1' })).body;
    const del = await request(app).delete(`/api/gateways/${created.id}`);
    expect(del.status).toBe(204);
    const list = await request(app).get('/api/gateways');
    expect(list.body.gateways).toEqual([]);
  });

  it('POST /api/gateways/:id/select switches the active Gateway without restarting anything', async () => {
    const first = (await request(app).post('/api/gateways').send({ name: 'First', host: '10.0.0.1' })).body;
    const second = (await request(app).post('/api/gateways').send({ name: 'Second', host: '10.0.0.2' })).body;
    const res = await request(app).post(`/api/gateways/${second.id}/select`);
    expect(res.status).toBe(200);
    expect(res.body.activeGatewayId).toBe(second.id);

    const list = await request(app).get('/api/gateways');
    expect(list.body.activeGatewayId).toBe(second.id);
    // First Gateway profile must be untouched by switching active Gateway.
    expect(list.body.gateways.find((g) => g.id === first.id).host).toBe('10.0.0.1');
  });

  it('POST /api/gateways/:id/select 404s for an unknown ID', async () => {
    const res = await request(app).post('/api/gateways/does-not-exist/select');
    expect(res.status).toBe(404);
  });

  it('proxy routes API requests to the selected Gateway (routing/context correctness)', async () => {
    const created = (
      await request(app).post('/api/gateways').send({ name: 'Lab', host: '127.0.0.1', port: 65533, protocol: 'http' })
    ).body;
    // Nothing is listening on 65533, so this exercises the real proxy path
    // end-to-end and confirms it fails safely rather than hanging/crashing.
    const res = await request(app).get(`/api/gateways/${created.id}/proxy/management/v1/globalsettings`);
    expect(res.status).toBe(502);
    expect(res.body.error).toBeTruthy();
  });

  it('proxy 404s for an unknown Gateway ID', async () => {
    const res = await request(app).get('/api/gateways/does-not-exist/proxy/management/v1/globalsettings');
    expect(res.status).toBe(404);
  });

  it('proxy does not forward a stale Content-Encoding header for a gzip-compressed upstream response (regression: ERR_CONTENT_DECODING_FAILED)', async () => {
    // undici (used by the proxy to call the real Gateway) transparently
    // decompresses gzip/deflate responses before we read the body via
    // .text()/.arrayBuffer(). If the proxy blindly forwards the
    // upstream's original `Content-Encoding: gzip` header alongside the
    // now-decompressed body, browsers try to gzip-decode plain JSON and
    // fail with net::ERR_CONTENT_DECODING_FAILED. See server/proxy.js.
    const payload = JSON.stringify({ ok: true });
    const gzipped = zlib.gzipSync(payload);

    const upstream = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' });
      res.end(gzipped);
    });
    await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
    const upstreamPort = upstream.address().port;

    try {
      const created = (
        await request(app).post('/api/gateways').send({ name: 'GzipLab', host: '127.0.0.1', port: upstreamPort, protocol: 'http' })
      ).body;

      const res = await request(app).get(`/api/gateways/${created.id}/proxy/management/v1/globalsettings`);
      expect(res.status).toBe(200);
      expect(res.headers['content-encoding']).toBeUndefined();
      expect(res.body).toEqual({ ok: true });
    } finally {
      await new Promise((resolve) => upstream.close(resolve));
    }
  });
});

describe('Gateway routes - hosted mode restrictions', () => {
  beforeEach(async () => {
    await resetStore();
    app = buildApp({ mode: 'hosted', allowCustomGateways: false });
  });

  it('refuses to create a custom Gateway', async () => {
    const res = await request(app).post('/api/gateways').send({ name: 'Evil', host: '10.0.0.5', username: 'a', password: 'b' });
    expect(res.status).toBe(403);
  });

  it('refuses to edit a non-locked Gateway host in hosted mode', async () => {
    // Directly seed a non-locked Gateway into the store file to simulate a
    // pre-existing profile, since creation itself is blocked above.
    const seedStore = new GatewayStore(storePath);
    const seeded = await seedStore.create({ name: 'Seeded', host: '10.0.0.1' });

    const res = await request(app).put(`/api/gateways/${seeded.id}`).send({ host: '10.0.0.99' });
    expect(res.status).toBe(403);
  });

  it('refuses to proxy to a non-locked Gateway target', async () => {
    const seedStore = new GatewayStore(storePath);
    const seeded = await seedStore.create({ name: 'Seeded', host: '10.0.0.1' });

    const res = await request(app).get(`/api/gateways/${seeded.id}/proxy/management/v1/globalsettings`);
    expect(res.status).toBe(403);
  });
});
