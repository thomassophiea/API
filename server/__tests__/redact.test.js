// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { redact, redactCredentials, toSafeGatewayProfile, isSensitiveKey, REDACTED } from '../redact.js';

describe('redact', () => {
  it('flags common sensitive keys regardless of case', () => {
    expect(isSensitiveKey('password')).toBe(true);
    expect(isSensitiveKey('Password')).toBe(true);
    expect(isSensitiveKey('Authorization')).toBe(true);
    expect(isSensitiveKey('X-Api-Key')).toBe(true);
    expect(isSensitiveKey('cookie')).toBe(true);
    expect(isSensitiveKey('refresh_token')).toBe(true);
    expect(isSensitiveKey('name')).toBe(false);
    expect(isSensitiveKey('host')).toBe(false);
  });

  it('redacts password fields in nested objects', () => {
    const input = { username: 'admin', password: 'hunter2', nested: { password: 'again' } };
    const out = redact(input);
    expect(out.username).toBe('admin');
    expect(out.password).toBe(REDACTED);
    expect(out.nested.password).toBe(REDACTED);
  });

  it('redacts Authorization headers', () => {
    const out = redact({ headers: { Authorization: 'Bearer super-secret-token', 'Content-Type': 'application/json' } });
    expect(out.headers.Authorization).toBe(REDACTED);
    expect(out.headers['Content-Type']).toBe('application/json');
  });

  it('redacts Headers-like instances', () => {
    const headers = new Headers({ Authorization: 'Bearer abc', 'X-Custom': 'value' });
    const out = redact(headers);
    expect(out.authorization).toBe(REDACTED);
    expect(out['x-custom']).toBe('value');
  });

  it('handles arrays and preserves non-sensitive values', () => {
    const out = redact([{ password: 'a' }, { name: 'ok' }]);
    expect(out[0].password).toBe(REDACTED);
    expect(out[1].name).toBe('ok');
  });

  it('does not throw on circular references', () => {
    const obj = { name: 'x' };
    obj.self = obj;
    expect(() => redact(obj)).not.toThrow();
  });

  it('redactCredentials never returns the raw password', () => {
    const out = redactCredentials({ username: 'admin', password: 'hunter2' });
    expect(out.username).toBe('admin');
    expect(out.password).toBe(REDACTED);
    expect(JSON.stringify(out)).not.toContain('hunter2');
  });

  it('toSafeGatewayProfile strips the password field entirely', () => {
    const profile = { id: '1', name: 'Lab', host: '10.0.0.1', password: 'hunter2' };
    const safe = toSafeGatewayProfile(profile);
    expect(safe.password).toBeUndefined();
    expect('password' in safe).toBe(false);
    expect(safe.name).toBe('Lab');
    expect(JSON.stringify(safe)).not.toContain('hunter2');
  });

  it('toSafeGatewayProfile handles null/undefined gracefully', () => {
    expect(toSafeGatewayProfile(null)).toBeNull();
    expect(toSafeGatewayProfile(undefined)).toBeUndefined();
  });
});
