import { gatewayStore } from './store.js';

/**
 * When CAMPUS_CONTROLLER_URL is configured (as it already is for the
 * existing Railway/hosted deployment), register it as a single "locked"
 * Gateway profile so the hosted deployment keeps working exactly as
 * before without any manual setup. Locked profiles cannot have their
 * target host changed or be deleted through the API (see server/store.js),
 * which is part of the hosted-mode SSRF mitigation.
 */
export async function bootstrapLegacyGateway(legacyGatewayUrl) {
  if (!legacyGatewayUrl) return null;

  let parsed;
  try {
    parsed = new URL(legacyGatewayUrl);
  } catch {
    console.warn('[Gateway Bootstrap] CAMPUS_CONTROLLER_URL is not a valid URL, skipping legacy Gateway registration.');
    return null;
  }

  const existing = (await gatewayStore.list()).find((g) => g.locked);
  if (existing) return existing;

  const created = await gatewayStore.create({
    name: 'Hosted Gateway',
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : (parsed.protocol === 'http:' ? 80 : 443),
    protocol: parsed.protocol === 'http:' ? 'http' : 'https',
    trustSelfSigned: false,
    locked: true,
  });
  console.log(`[Gateway Bootstrap] Registered locked hosted Gateway -> ${parsed.hostname}`);
  return created;
}
