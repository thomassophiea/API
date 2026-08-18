import { gatewayRequest } from './gatewayHttp.js';

const HOST_PATTERN = /^[a-zA-Z0-9.-]+$/;

export function validateHost(host) {
  if (!host || !host.trim()) return 'Gateway host/IP is required.';
  if (!HOST_PATTERN.test(host.trim())) {
    return 'Gateway host must be a plain hostname/FQDN or IP address (no protocol, path, or credentials).';
  }
  return null;
}

function classifyNetworkError(err) {
  const code = err?.cause?.code || err?.code;
  if (err?.name === 'AbortError') {
    return { stage: 'network', message: 'Connection timed out while reaching the Gateway.' };
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return { stage: 'network', message: 'Gateway host could not be resolved. Check the hostname/IP.' };
  }
  if (code === 'ECONNREFUSED') {
    return { stage: 'network', message: 'Connection refused by Gateway. Check host, port, and that the Gateway is reachable from this network.' };
  }
  if (code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || code === 'SELF_SIGNED_CERT_IN_CHAIN' || code === 'CERT_HAS_EXPIRED') {
    return {
      stage: 'tls',
      message: 'Certificate verification failed. If this Gateway uses a self-signed lab certificate, enable "Trust self-signed certificate" for this Gateway profile and try again.',
    };
  }
  return { stage: 'network', message: err?.message || 'Unable to reach the Gateway.' };
}

/**
 * Runs the full Test Connection workflow against a real Gateway using
 * only the OAuth2 password-grant flow and endpoints already implemented
 * elsewhere in this app (src/services/api.ts) - nothing here invents a
 * new Gateway API.
 */
export async function testGatewayConnection(gateway, { username, password } = {}) {
  const hostError = validateHost(gateway.host);
  if (hostError) {
    return { success: false, stage: 'validation', message: hostError };
  }

  // Step 1: TLS/network reachability check (mirrors src/services/api.ts testConnectivity()).
  let tlsCheckDurationMs;
  try {
    const { response, durationMs } = await gatewayRequest(gateway, '/management/v1/oauth2/token', {
      method: 'OPTIONS',
      timeoutMs: 8000,
    });
    tlsCheckDurationMs = durationMs;
    if (!response.ok && response.status !== 405) {
      return {
        success: false,
        stage: 'network',
        message: `Gateway responded with HTTP ${response.status} to a basic reachability check.`,
      };
    }
  } catch (err) {
    const { stage, message } = classifyNetworkError(err);
    return { success: false, stage, message };
  }

  if (!username || !password) {
    return {
      success: false,
      stage: 'auth',
      message: 'Username and password are required to complete authentication.',
    };
  }

  // Step 2: Authenticate using the existing OAuth2 password grant.
  const start = Date.now();
  let authResponse;
  try {
    const { response } = await gatewayRequest(gateway, '/management/v1/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ grantType: 'password', userId: username, password, scope: '' }),
      timeoutMs: 10000,
    });
    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, stage: 'auth', message: 'Authentication rejected by Gateway. HTTP 401' };
      }
      return { success: false, stage: 'auth', message: `Authentication failed. HTTP ${response.status}` };
    }
    authResponse = await response.json();
  } catch (err) {
    const { stage, message } = classifyNetworkError(err);
    return { success: false, stage, message };
  }

  // Step 3: least-expensive authenticated request already used elsewhere in the app.
  try {
    const { response } = await gatewayRequest(gateway, '/management/v1/globalsettings', {
      method: 'GET',
      headers: { Authorization: `Bearer ${authResponse.access_token}`, Accept: 'application/json' },
      timeoutMs: 10000,
    });
    const latencyMs = Date.now() - start;
    if (!response.ok) {
      return {
        success: false,
        stage: 'api',
        message: `Authenticated but the API check failed with HTTP ${response.status}.`,
        latencyMs,
      };
    }
    return {
      success: true,
      message: 'Connected',
      tls: 'OK',
      authentication: 'OK',
      api: 'Reachable',
      latencyMs,
    };
  } catch (err) {
    const { stage, message } = classifyNetworkError(err);
    return { success: false, stage, message };
  }
}
