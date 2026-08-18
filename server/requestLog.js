import { redact } from './redact.js';

/**
 * Small in-memory ring buffer of recent Gateway API request metadata for
 * on-screen diagnostics (Step 10 - "API errors and observability").
 * Only safe, non-secret fields are ever stored: Gateway, method,
 * endpoint, HTTP status, duration, timestamp. Never store request
 * bodies, headers, or error stack traces verbatim.
 */
const MAX_ENTRIES = 200;
const entries = [];

export function recordRequest({ gatewayId, gatewayName, method, endpoint, status, durationMs, error }) {
  const entry = {
    timestamp: new Date().toISOString(),
    gatewayId,
    gatewayName,
    method,
    endpoint,
    status: status ?? null,
    durationMs: durationMs ?? null,
    error: error ? redact(error) : undefined,
  };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.shift();

  const safeSummary = `[Gateway:${gatewayName || gatewayId}] ${method} ${endpoint} -> ${status ?? 'ERROR'} (${durationMs ?? '?'}ms)`;
  if (error) {
    console.error(safeSummary, entry.error);
  } else {
    console.log(safeSummary);
  }
  return entry;
}

export function getRecentRequests() {
  return [...entries].reverse();
}
