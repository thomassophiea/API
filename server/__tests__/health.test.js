// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';

let app;
let tmpDir;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'health-test-'));
  process.env.GATEWAY_STORE_PATH = path.join(tmpDir, 'gateways.json');
  process.env.APP_MODE = 'local';
  delete process.env.CAMPUS_CONTROLLER_URL;
  // Importing server.js (rather than running it) is safe: app.listen() is
  // guarded behind an isMainModule check so importing it here does not bind
  // a real port or bootstrap a legacy Gateway (see server.js).
  ({ default: app } = await import('../../server.js'));
});

afterAll(async () => {
  delete process.env.GATEWAY_STORE_PATH;
  delete process.env.APP_MODE;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('GET /health', () => {
  it('reports ok status independent of any Gateway configuration', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.appMode).toBe('local');
    expect(res.body.timestamp).toBeTruthy();
  });

  it('does not require authentication or a selected Gateway', async () => {
    // No Gateway has been created/selected in this test's store, yet the
    // health check must still succeed.
    const gatewaysRes = await request(app).get('/api/gateways');
    expect(gatewaysRes.body.gateways).toEqual([]);

    const healthRes = await request(app).get('/health');
    expect(healthRes.status).toBe(200);
  });
});

describe('GET /api/app-mode', () => {
  it('exposes the current deployment mode and custom-Gateway policy', async () => {
    const res = await request(app).get('/api/app-mode');
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('local');
    expect(res.body.allowCustomGateways).toBe(true);
  });
});

describe('404 handling', () => {
  it('returns a JSON 404 for unknown API endpoints instead of the SPA fallback', async () => {
    const res = await request(app).get('/api/totally-not-a-real-endpoint');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });
});
