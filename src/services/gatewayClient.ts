/**
 * Frontend client for this app's own Gateway-management backend
 * (server/routes/gateways.js). This is deliberately separate from
 * GatewayApiClient (src/services/api.ts), which talks to the Gateway's
 * real management API *through* the backend proxy - this file only
 * manages Gateway *profiles* (add/edit/delete/test/select).
 */

export interface GatewayProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: 'https' | 'http';
  username: string;
  trustSelfSigned: boolean;
  locked: boolean;
  hasStoredCredentials: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GatewayListResponse {
  appMode: 'local' | 'hosted';
  allowCustomGateways: boolean;
  activeGatewayId: string | null;
  gateways: GatewayProfile[];
}

export interface GatewayInput {
  name: string;
  host: string;
  port?: number;
  protocol?: 'https' | 'http';
  username?: string;
  password?: string;
  trustSelfSigned?: boolean;
  remember?: boolean;
}

export interface TestConnectionResult {
  success: boolean;
  stage?: 'validation' | 'network' | 'tls' | 'auth' | 'api';
  message: string;
  tls?: string;
  authentication?: string;
  api?: string;
  latencyMs?: number;
}

async function handleJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || `Request failed with HTTP ${response.status}`);
  }
  return data as T;
}

export const gatewayClient = {
  async list(): Promise<GatewayListResponse> {
    const response = await fetch('/api/gateways');
    return handleJson<GatewayListResponse>(response);
  },

  async create(input: GatewayInput): Promise<GatewayProfile> {
    const response = await fetch('/api/gateways', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return handleJson<GatewayProfile>(response);
  },

  async update(id: string, patch: Partial<GatewayInput>): Promise<GatewayProfile> {
    const response = await fetch(`/api/gateways/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    return handleJson<GatewayProfile>(response);
  },

  async remove(id: string): Promise<void> {
    const response = await fetch(`/api/gateways/${id}`, { method: 'DELETE' });
    if (!response.ok && response.status !== 204) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Delete failed with HTTP ${response.status}`);
    }
  },

  async select(id: string): Promise<{ activeGatewayId: string | null }> {
    const response = await fetch(`/api/gateways/${id}/select`, { method: 'POST' });
    return handleJson(response);
  },

  async test(id: string, credentials?: { username: string; password: string; remember?: boolean }): Promise<TestConnectionResult> {
    const response = await fetch(`/api/gateways/${id}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials || {}),
    });
    // Test results use 400 for a "well-formed failure", handle both here.
    const text = await response.text();
    return text ? JSON.parse(text) : { success: false, message: 'Empty response from server' };
  },
};
