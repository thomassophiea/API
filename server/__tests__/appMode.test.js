// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { computeAppMode } from '../appMode.js';

describe('computeAppMode', () => {
  it('defaults to local mode with custom Gateways allowed when no env vars are set', () => {
    const result = computeAppMode({});
    expect(result.mode).toBe('local');
    expect(result.allowCustomGateways).toBe(true);
    expect(result.legacyGatewayUrl).toBeNull();
  });

  it('auto-detects hosted mode from Railway environment variables', () => {
    const result = computeAppMode({ RAILWAY_ENVIRONMENT: 'production' });
    expect(result.mode).toBe('hosted');
    expect(result.allowCustomGateways).toBe(false);
  });

  it('auto-detects hosted mode from RAILWAY_PROJECT_ID', () => {
    expect(computeAppMode({ RAILWAY_PROJECT_ID: 'abc123' }).mode).toBe('hosted');
  });

  it('respects an explicit APP_MODE override even on Railway', () => {
    const result = computeAppMode({ RAILWAY_ENVIRONMENT: 'production', APP_MODE: 'local' });
    expect(result.mode).toBe('local');
    expect(result.allowCustomGateways).toBe(true);
  });

  it('respects an explicit APP_MODE=hosted outside of Railway', () => {
    const result = computeAppMode({ APP_MODE: 'hosted' });
    expect(result.mode).toBe('hosted');
    expect(result.allowCustomGateways).toBe(false);
  });

  it('ALLOW_CUSTOM_GATEWAYS explicitly overrides the mode default', () => {
    const result = computeAppMode({ APP_MODE: 'hosted', ALLOW_CUSTOM_GATEWAYS: 'true' });
    expect(result.mode).toBe('hosted');
    expect(result.allowCustomGateways).toBe(true);
  });

  it('ALLOW_CUSTOM_GATEWAYS=false locks down local mode too', () => {
    const result = computeAppMode({ APP_MODE: 'local', ALLOW_CUSTOM_GATEWAYS: 'false' });
    expect(result.allowCustomGateways).toBe(false);
  });

  it('surfaces CAMPUS_CONTROLLER_URL as legacyGatewayUrl', () => {
    const result = computeAppMode({ CAMPUS_CONTROLLER_URL: 'https://gateway.example.local' });
    expect(result.legacyGatewayUrl).toBe('https://gateway.example.local');
  });
});
