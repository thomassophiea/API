import { Agent, fetch as undiciFetch } from 'undici';

/**
 * All outbound HTTP(S) traffic to a Gateway flows through this module so
 * TLS handling, timeouts, and base-URL construction stay in one place
 * (see architecture note in README - "GatewayApiClient").
 */

export function gatewayBaseUrl(gateway) {
  const protocol = gateway.protocol === 'http' ? 'http' : 'https';
  return `${protocol}://${gateway.host}:${gateway.port}`;
}

/**
 * Returns an undici Agent configured for this Gateway's TLS trust
 * preference. Certificate verification is ON by default; it is only
 * disabled for a specific Gateway when the user has explicitly marked
 * that profile as "trust self-signed certificate for this Gateway" -
 * we never disable verification globally.
 */
export function gatewayAgent(gateway) {
  return new Agent({
    connect: {
      rejectUnauthorized: !gateway.trustSelfSigned,
    },
  });
}

/**
 * Performs a request against a Gateway's real API surface.
 * `endpoint` must start with '/' and is appended directly to the
 * Gateway base URL, e.g. '/management/v1/oauth2/token'.
 */
export async function gatewayRequest(gateway, endpoint, { method = 'GET', headers = {}, body, timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    const response = await undiciFetch(`${gatewayBaseUrl(gateway)}${endpoint}`, {
      method,
      headers,
      body,
      dispatcher: gatewayAgent(gateway),
      signal: controller.signal,
    });
    return { response, durationMs: Date.now() - start };
  } finally {
    clearTimeout(timeout);
  }
}
