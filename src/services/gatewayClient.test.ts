import { describe, it, expect, vi, afterEach } from 'vitest';
import { gatewayClient } from './gatewayClient';

function mockFetchOnce(body: unknown, init: { status?: number } = {}) {
  const status = init.status ?? 200;
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  });
}

describe('gatewayClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('list() calls the Gateway profile endpoint and returns parsed JSON', async () => {
    const payload = { appMode: 'local', allowCustomGateways: true, activeGatewayId: null, gateways: [] };
    global.fetch = mockFetchOnce(payload);
    const result = await gatewayClient.list();
    expect(global.fetch).toHaveBeenCalledWith('/api/gateways');
    expect(result).toEqual(payload);
  });

  it('create() posts to /api/gateways and never needs to read a password back', async () => {
    const created = { id: '1', name: 'Lab', host: '10.0.0.1', port: 443, protocol: 'https', username: 'admin', trustSelfSigned: false, locked: false, hasStoredCredentials: true, createdAt: 'x', updatedAt: 'x' };
    global.fetch = mockFetchOnce(created, { status: 201 });
    const result = await gatewayClient.create({ name: 'Lab', host: '10.0.0.1', username: 'admin', password: 'hunter2' });
    expect(result).toEqual(created);
    expect('password' in result).toBe(false);

    const [, requestInit] = (global.fetch as any).mock.calls[0];
    expect(requestInit.method).toBe('POST');
  });

  it('update() sends a PUT request scoped to the given Gateway ID', async () => {
    global.fetch = mockFetchOnce({ id: '1', name: 'Renamed' });
    await gatewayClient.update('1', { name: 'Renamed' });
    const [url, requestInit] = (global.fetch as any).mock.calls[0];
    expect(url).toBe('/api/gateways/1');
    expect(requestInit.method).toBe('PUT');
  });

  it('remove() sends a DELETE request and resolves on 204 with no body', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204, text: async () => '', json: async () => ({}) });
    await expect(gatewayClient.remove('1')).resolves.toBeUndefined();
    const [url, requestInit] = (global.fetch as any).mock.calls[0];
    expect(url).toBe('/api/gateways/1');
    expect(requestInit.method).toBe('DELETE');
  });

  it('select() posts to the select endpoint for the given Gateway ID', async () => {
    global.fetch = mockFetchOnce({ activeGatewayId: '2' });
    const result = await gatewayClient.select('2');
    expect(result.activeGatewayId).toBe('2');
    const [url] = (global.fetch as any).mock.calls[0];
    expect(url).toBe('/api/gateways/2/select');
  });

  it('test() surfaces a well-formed failure result instead of throwing on HTTP 400', async () => {
    global.fetch = mockFetchOnce({ success: false, stage: 'auth', message: 'Authentication rejected by Gateway. HTTP 401' }, { status: 400 });
    const result = await gatewayClient.test('1', { username: 'admin', password: 'wrong' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('401');
  });

  it('list() throws a descriptive error (not "something went wrong") on failure', async () => {
    global.fetch = mockFetchOnce({ error: 'Gateway not found' }, { status: 404 });
    await expect(gatewayClient.list()).rejects.toThrow('Gateway not found');
  });
});
