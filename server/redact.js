/**
 * Central log/response redaction utilities.
 *
 * Nothing in this application should ever log or return, in full:
 *   - passwords
 *   - Authorization headers / bearer tokens
 *   - session cookies
 *   - refresh tokens
 *
 * Every place that logs request/response metadata or persists gateway
 * profiles for display MUST pass through redact() first.
 */

const SENSITIVE_KEYS = [
  'password',
  'pass',
  'pwd',
  'secret',
  'authorization',
  'auth',
  'token',
  'access_token',
  'accesstoken',
  'refresh_token',
  'refreshtoken',
  'cookie',
  'set-cookie',
  'apikey',
  'api_key',
  'x-api-key',
];

export const REDACTED = '***REDACTED***';

export function isSensitiveKey(key) {
  const normalized = String(key).toLowerCase();
  return SENSITIVE_KEYS.some((k) => normalized === k || normalized.includes(k));
}

/**
 * Deep-clones an object/array/headers-like structure and replaces any
 * sensitive field values with a redaction marker. Safe to call on
 * arbitrary, possibly-circular JSON-ish data (headers, bodies, errors).
 */
export function redact(value, seen = new WeakSet()) {
  if (value === null || value === undefined) return value;

  if (typeof Headers !== 'undefined' && value instanceof Headers) {
    const out = {};
    for (const [k, v] of value.entries()) {
      out[k] = isSensitiveKey(k) ? REDACTED : v;
    }
    return out;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, seen));
  }

  if (typeof value === 'object') {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = isSensitiveKey(k) ? REDACTED : redact(v, seen);
    }
    return out;
  }

  return value;
}

/** Redacts a single credential pair for safe logging, e.g. { username, password }. */
export function redactCredentials({ username, password } = {}) {
  return {
    username: username || undefined,
    password: password ? REDACTED : undefined,
  };
}

/** Strips password/secret fields from a gateway profile before it leaves the server. */
export function toSafeGatewayProfile(profile) {
  if (!profile) return profile;
  const { password, ...safe } = profile;
  return safe;
}
