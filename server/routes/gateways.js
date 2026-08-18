import { Router } from 'express';
import { gatewayStore } from '../store.js';
import { setCredentials, getCredentials, clearCredentials, hasCredentials } from '../credentials.js';
import { toSafeGatewayProfile } from '../redact.js';
import { testGatewayConnection, validateHost } from '../testConnection.js';

const VALID_PROTOCOLS = new Set(['https', 'http']);

function validateGatewayInput(body, { partial = false } = {}) {
  const errors = [];
  if (!partial || body.name !== undefined) {
    if (!body.name || !String(body.name).trim()) errors.push('Display name is required.');
  }
  if (!partial || body.host !== undefined) {
    const hostError = validateHost(body.host);
    if (hostError) errors.push(hostError);
  }
  if (body.port !== undefined) {
    const port = Number(body.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push('Port must be an integer between 1 and 65535.');
  }
  if (body.protocol !== undefined && !VALID_PROTOCOLS.has(body.protocol)) {
    errors.push('Protocol must be "https" or "http".');
  }
  return errors;
}

export function createGatewayRouter({ appMode }) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const [gateways, activeGatewayId] = await Promise.all([gatewayStore.list(), gatewayStore.getActiveId()]);
      res.json({
        appMode: appMode.mode,
        allowCustomGateways: appMode.allowCustomGateways,
        activeGatewayId,
        gateways: gateways.map((g) => ({ ...toSafeGatewayProfile(g), hasStoredCredentials: hasCredentials(g.id) })),
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req, res) => {
    try {
      if (!appMode.allowCustomGateways) {
        return res.status(403).json({ error: 'Adding custom Gateways is disabled in hosted mode.' });
      }
      const errors = validateGatewayInput(req.body);
      if (errors.length) return res.status(400).json({ error: errors.join(' ') });

      const { username, password, remember = true, ...rest } = req.body;
      const created = await gatewayStore.create({ ...rest, username });
      if (remember && username && password) {
        setCredentials(created.id, { username, password });
      }
      res.status(201).json({ ...toSafeGatewayProfile(created), hasStoredCredentials: hasCredentials(created.id) });
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      const existing = await gatewayStore.get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Gateway not found' });
      if (!appMode.allowCustomGateways && !existing.locked) {
        return res.status(403).json({ error: 'Editing custom Gateways is disabled in hosted mode.' });
      }
      const errors = validateGatewayInput(req.body, { partial: true });
      if (errors.length) return res.status(400).json({ error: errors.join(' ') });

      const { username, password, remember, ...rest } = req.body;
      const updated = await gatewayStore.update(req.params.id, { ...rest, ...(username !== undefined ? { username } : {}) });
      if (remember && username && password) {
        setCredentials(req.params.id, { username, password });
      }
      res.json({ ...toSafeGatewayProfile(updated), hasStoredCredentials: hasCredentials(updated.id) });
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      await gatewayStore.remove(req.params.id);
      clearCredentials(req.params.id);
      res.status(204).end();
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.post('/:id/select', async (req, res) => {
    try {
      const activeGatewayId = await gatewayStore.setActive(req.params.id);
      res.json({ activeGatewayId });
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.get('/:id/status', async (req, res) => {
    try {
      const gateway = await gatewayStore.get(req.params.id);
      if (!gateway) return res.status(404).json({ error: 'Gateway not found' });
      res.json({ id: gateway.id, hasStoredCredentials: hasCredentials(gateway.id) });
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.post('/:id/test', async (req, res) => {
    try {
      const gateway = await gatewayStore.get(req.params.id);
      if (!gateway) return res.status(404).json({ error: 'Gateway not found' });

      const bodyCreds = req.body?.username && req.body?.password ? req.body : null;
      const creds = bodyCreds || getCredentials(gateway.id);
      if (!creds) {
        return res.status(400).json({ success: false, stage: 'auth', message: 'No credentials provided or stored for this Gateway.' });
      }

      const result = await testGatewayConnection(gateway, creds);
      if (result.success && (req.body?.remember ?? true) && bodyCreds) {
        setCredentials(gateway.id, bodyCreds);
      }
      res.status(result.success ? 200 : 400).json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ success: false, stage: 'internal', message: err.message || 'Unexpected error while testing the connection.' });
    }
  });

  return router;
}
