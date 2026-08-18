// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import https from 'https';
import { validateHost, testGatewayConnection } from '../testConnection.js';

describe('validateHost', () => {
  it('requires a non-empty host', () => {
    expect(validateHost('')).toBeTruthy();
    expect(validateHost(undefined)).toBeTruthy();
    expect(validateHost('   ')).toBeTruthy();
  });

  it('accepts plain hostnames, FQDNs, and IPs', () => {
    expect(validateHost('10.20.30.40')).toBeNull();
    expect(validateHost('gateway.example.local')).toBeNull();
    expect(validateHost('gateway-lab-01.corp.example.com')).toBeNull();
  });

  it('rejects hosts containing a protocol, path, credentials, or shell metacharacters', () => {
    expect(validateHost('https://10.0.0.1')).toBeTruthy();
    expect(validateHost('10.0.0.1/admin')).toBeTruthy();
    expect(validateHost('user:pass@10.0.0.1')).toBeTruthy();
    expect(validateHost('10.0.0.1; rm -rf /')).toBeTruthy();
    expect(validateHost('10.0.0.1 && echo hi')).toBeTruthy();
    expect(validateHost('$(whoami)')).toBeTruthy();
  });
});

describe('testGatewayConnection', () => {
  it('reports a validation error for an invalid host without attempting a network call', async () => {
    const result = await testGatewayConnection(
      { host: 'bad host with spaces', port: 443, protocol: 'https' },
      { username: 'admin', password: 'pw' }
    );
    expect(result.success).toBe(false);
    expect(result.stage).toBe('validation');
  });

  it('classifies an unreachable Gateway (connection refused) with a useful message', async () => {
    // Nothing is listening on this port.
    const result = await testGatewayConnection(
      { host: '127.0.0.1', port: 65534, protocol: 'http' },
      { username: 'admin', password: 'pw' }
    );
    expect(result.success).toBe(false);
    expect(result.stage).toBe('network');
    expect(result.message).not.toMatch(/something went wrong/i);
    expect(result.message.length).toBeGreaterThan(10);
  });

  it('classifies a slow/unresponsive Gateway as a timeout', async () => {
    const server = http.createServer((req, res) => {
      // Never respond - forces the client-side timeout to fire.
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;

    try {
      const result = await testGatewayConnection(
        { host: '127.0.0.1', port, protocol: 'http' },
        { username: 'admin', password: 'pw' }
      );
      expect(result.success).toBe(false);
      expect(result.message.toLowerCase()).toContain('timed out');
    } finally {
      server.close();
    }
  }, 15000);

  describe('against a mock Gateway HTTP server', () => {
    let server;
    let port;
    let lastAuthBody = null;

    beforeAll(async () => {
      server = http.createServer((req, res) => {
        if (req.method === 'OPTIONS' && req.url === '/management/v1/oauth2/token') {
          res.writeHead(200);
          return res.end();
        }
        if (req.method === 'POST' && req.url === '/management/v1/oauth2/token') {
          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', () => {
            lastAuthBody = JSON.parse(body);
            if (lastAuthBody.userId === 'admin' && lastAuthBody.password === 'correct-password') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({ access_token: 'fake-token-for-tests' }));
            }
            res.writeHead(401, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'invalid_grant' }));
          });
          return;
        }
        if (req.method === 'GET' && req.url === '/management/v1/globalsettings') {
          if (req.headers.authorization === 'Bearer fake-token-for-tests') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ ok: true }));
          }
          res.writeHead(401);
          return res.end();
        }
        res.writeHead(404);
        res.end();
      });
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      port = server.address().port;
    });

    afterAll(() => {
      server.close();
    });

    it('succeeds end-to-end with valid credentials and reports latency', async () => {
      const result = await testGatewayConnection(
        { host: '127.0.0.1', port, protocol: 'http' },
        { username: 'admin', password: 'correct-password' }
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe('Connected');
      expect(result.authentication).toBe('OK');
      expect(result.api).toBe('Reachable');
      expect(typeof result.latencyMs).toBe('number');
    });

    it('reports HTTP 401 clearly on authentication rejection', async () => {
      const result = await testGatewayConnection(
        { host: '127.0.0.1', port, protocol: 'http' },
        { username: 'admin', password: 'wrong-password' }
      );
      expect(result.success).toBe(false);
      expect(result.stage).toBe('auth');
      expect(result.message).toContain('401');
    });

    it('requires both username and password', async () => {
      const result = await testGatewayConnection({ host: '127.0.0.1', port, protocol: 'http' }, {});
      expect(result.success).toBe(false);
      expect(result.stage).toBe('auth');
    });

    it('never includes the password in the result', async () => {
      const result = await testGatewayConnection(
        { host: '127.0.0.1', port, protocol: 'http' },
        { username: 'admin', password: 'correct-password' }
      );
      expect(JSON.stringify(result)).not.toContain('correct-password');
    });
  });
});
