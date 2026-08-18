import { Router } from 'express';
import { gatewayStore } from './store.js';
import { gatewayBaseUrl, gatewayAgent } from './gatewayHttp.js';
import { fetch as undiciFetch } from 'undici';
import { redact } from './redact.js';

const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade', 'host', 'content-length',
]);

/**
 * Generic authenticated pass-through proxy to a selected Gateway's real
 * API surface. The browser never talks to the Gateway directly - this
 * keeps TLS trust decisions, timeouts, and safe logging centralized on
 * the backend (see README architecture diagram).
 *
 * Route shape: /api/gateways/:id/proxy/<rest-of-real-gateway-path>
 * e.g. /api/gateways/<id>/proxy/management/v1/oauth2/token
 */
export function createGatewayProxyRouter({ appMode, logRequest }) {
  const router = Router();

  router.all('/:id/proxy/*', async (req, res) => {
    let gateway;
    try {
      gateway = await gatewayStore.get(req.params.id);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to load Gateway profile', message: err.message });
    }
    if (!gateway) {
      return res.status(404).json({ error: 'Gateway not found' });
    }
    if (!appMode.allowCustomGateways && !gateway.locked) {
      // Defense in depth: hosted mode should only ever proxy to the
      // single pre-approved legacy Gateway, never an arbitrary target.
      return res.status(403).json({ error: 'Custom Gateway targets are disabled in hosted mode.' });
    }

    const restPath = req.params[0] || '';
    const queryString = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    const targetUrl = `${gatewayBaseUrl(gateway)}/${restPath}${queryString}`;

    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (!HOP_BY_HOP.has(key.toLowerCase()) && value !== undefined) headers[key] = value;
    }

    const hasBody = !['GET', 'HEAD'].includes(req.method);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const start = Date.now();

    try {
      const upstreamResponse = await undiciFetch(targetUrl, {
        method: req.method,
        headers,
        body: hasBody ? JSON.stringify(req.body ?? {}) : undefined,
        dispatcher: gatewayAgent(gateway),
        signal: controller.signal,
      });

      const durationMs = Date.now() - start;
      logRequest?.({
        gatewayId: gateway.id,
        gatewayName: gateway.name,
        method: req.method,
        endpoint: `/${restPath}`,
        status: upstreamResponse.status,
        durationMs,
      });

      res.status(upstreamResponse.status);
      for (const [key, value] of upstreamResponse.headers.entries()) {
        if (!HOP_BY_HOP.has(key.toLowerCase())) res.setHeader(key, value);
      }
      const contentType = upstreamResponse.headers.get('content-type') || '';
      if (contentType.includes('application/json') || contentType.includes('text/')) {
        res.send(await upstreamResponse.text());
      } else {
        res.send(Buffer.from(await upstreamResponse.arrayBuffer()));
      }
    } catch (err) {
      logRequest?.({
        gatewayId: gateway.id,
        gatewayName: gateway.name,
        method: req.method,
        endpoint: `/${restPath}`,
        error: redact({ message: err.message }),
      });
      res.status(502).json({ error: 'Gateway request failed', message: err.message });
    } finally {
      clearTimeout(timeout);
    }
  });

  return router;
}
