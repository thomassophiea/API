import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { computeAppMode } from './server/appMode.js';
import { bootstrapLegacyGateway } from './server/bootstrap.js';
import { createGatewayRouter } from './server/routes/gateways.js';
import { createGatewayProxyRouter } from './server/proxy.js';
import { recordRequest, getRecentRequests } from './server/requestLog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || process.env.BACKEND_PORT || 3000;
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

async function start() {
  await bootstrapLegacyGateway(appMode.legacyGatewayUrl);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Running on port ${PORT}`);
    console.log(`[Server] Health check: http://localhost:${PORT}/health`);
  });
}

start();

process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app;
