/**
 * Deployment mode resolution.
 *
 * APP_MODE=local  (default) - the app is running on an engineer's own
 *   machine/network. Users may register arbitrary Gateway hosts/IPs.
 *
 * APP_MODE=hosted - the app is running on shared/public infrastructure
 *   (e.g. Railway). Arbitrary custom Gateway targets are refused by
 *   default to avoid turning the public deployment into an open SSRF
 *   proxy that could reach internal/private infrastructure. Only the
 *   single pre-configured CAMPUS_CONTROLLER_URL Gateway (if any) is
 *   available, matching the previous hosted/demo behavior.
 *
 * ALLOW_CUSTOM_GATEWAYS explicitly overrides the mode default when a
 * hosted operator has evaluated and accepted the SSRF risk.
 */

function computeAppMode(env = process.env) {
  const explicitMode = (env.APP_MODE || '').toLowerCase();
  const onRailway = Boolean(env.RAILWAY_ENVIRONMENT || env.RAILWAY_PROJECT_ID || env.RAILWAY_SERVICE_ID);
  const mode = explicitMode === 'hosted' || explicitMode === 'local'
    ? explicitMode
    : (onRailway ? 'hosted' : 'local');

  let allowCustomGateways;
  if (env.ALLOW_CUSTOM_GATEWAYS !== undefined) {
    allowCustomGateways = String(env.ALLOW_CUSTOM_GATEWAYS).toLowerCase() === 'true';
  } else {
    allowCustomGateways = mode === 'local';
  }

  return {
    mode,
    allowCustomGateways,
    legacyGatewayUrl: env.CAMPUS_CONTROLLER_URL || null,
  };
}

export { computeAppMode };
