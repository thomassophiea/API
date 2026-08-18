import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { computeAppMode } from './server/appMode.js';
import { bootstrapLegacyGateway } from './server/bootstrap.js';
import { createGatewayRouter } from './server/routes/gateways.js';
import { createGatewayProxyRouter } from './server/proxy.js';
import { recordRequest, getRecentRequests } from './server/requestLog.js';
import { redact } from './server/redact.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// In a single-container/production deployment (Docker, Railway) this server
// serves both the API and the built frontend, so PORT is the one port that
// matters and typically defaults to 3000 there (see Dockerfile/docker-compose.yml).
// In native development the Vite dev server owns port 3000 for the frontend,
// so the backend defaults to 3001 (BACKEND_PORT) to avoid colliding with it;
// vite.config.ts proxies /api requests to this same default.
const PORT = process.env.PORT || process.env.BACKEND_PORT || 3001;
const appMode = computeAppMode(process.env);

console.log('[Server] Starting...');
console.log(`[Server] APP_MODE=${appMode.mode} allowCustomGateways=${appMode.allowCustomGateways}`);

// CORS is only relevant when something other than this same server's own
// static frontend is calling the API directly (e.g. hitting the backend
// port straight from a browser during native development). It is
// intentionally restricted to localhost origins rather than reflecting
// any origin.
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(express.json({ limit: '5mb' }));

// Health is intentionally independent of any Gateway being configured or reachable.
app.get('/health', (req, res) => {
  res.json({ status: 'ok', appMode: appMode.mode, timestamp: new Date().toISOString() });
});

app.get('/api/app-mode', (req, res) => {
  res.json({ mode: appMode.mode, allowCustomGateways: appMode.allowCustomGateways });
});

app.get('/api/logs', (req, res) => {
  res.json({ requests: getRecentRequests() });
});

app.use('/api/gateways', createGatewayRouter({ appMode }));
app.use('/api/gateways', createGatewayProxyRouter({ appMode, logRequest: recordRequest }));

// Serve the built frontend (production / Docker / Railway).
const buildPath = path.join(__dirname, 'build');
app.use(express.static(buildPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (filePath.match(/\.(js|css)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (filePath.match(/\.(jpg|jpeg|png|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=604800');
    }
  },
}));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API endpoint not found' });
  res.sendFile(path.join(buildPath, 'index.html'), (err) => {
    if (err) next();
  });
});

// Final safety net: any error that reaches here (thrown/rejected in a route
// that didn't handle it) is reported as a redacted 500 instead of crashing
// the whole process. Individual routes should still handle their own
// expected errors with specific status codes/messages where possible.
app.use((err, req, res, _next) => {
  console.error('[Server] Unhandled request error:', redact({ message: err?.message, stack: err?.stack }));
  if (res.headersSent) return;
  res.status(err?.statusCode || 500).json({ error: 'Internal server error' });
});

process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled promise rejection:', redact({ message: reason?.message || String(reason) }));
});

async function start() {
  await bootstrapLegacyGateway(appMode.legacyGatewayUrl);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Running on port ${PORT}`);
    console.log(`[Server] Health check: http://localhost:${PORT}/health`);
  });
}

// Only actually bind a port / bootstrap the legacy Gateway when this file is
// run directly (`node server.js`), not when imported (e.g. by tests, which
// exercise `app` directly via supertest).
const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  start();

  process.on('SIGTERM', () => {
    console.log('[Server] SIGTERM received, shutting down gracefully');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('[Server] SIGINT received, shutting down gracefully');
    process.exit(0);
  });
}

export default app;
