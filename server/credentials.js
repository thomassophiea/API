/**
 * Process-lifetime, in-memory Gateway credential storage.
 *
 * Per the security requirements for this application, Gateway
 * passwords are:
 *   - never written to disk,
 *   - never returned in any API response,
 *   - never logged,
 *   - held only in server process memory for as long as the local
 *     application process is running.
 *
 * Restarting the app (or the container) clears all stored credentials
 * and the user is prompted to re-enter them. This is an intentional,
 * documented trade-off (see README "Credentials" section) - a fuller
 * encrypted-at-rest credential vault is called out as future work
 * rather than something invented ad-hoc here.
 */

const credentials = new Map();

export function setCredentials(gatewayId, { username, password }) {
  credentials.set(gatewayId, { username, password });
}

export function getCredentials(gatewayId) {
  return credentials.get(gatewayId) || null;
}

export function clearCredentials(gatewayId) {
  credentials.delete(gatewayId);
}

export function hasCredentials(gatewayId) {
  return credentials.has(gatewayId);
}
