import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const CAMPUS_CONTROLLER_URL = process.env.CAMPUS_CONTROLLER_URL || 'https://tsophiea.ddns.net';

console.log('[Proxy Server] Starting...');
console.log('[Proxy Server] Target:', CAMPUS_CONTROLLER_URL);
console.log('[Proxy Server] Port:', PORT);

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Proxy configuration
const proxyOptions = {
  target: CAMPUS_CONTROLLER_URL,
  changeOrigin: true,
  secure: false,
  followRedirects: true,
  logLevel: 'debug',
  timeout: 60000,
  proxyTimeout: 60000,
  pathRewrite: (path, req) => {
    if (path.includes('/platformmanager/')) {
      const rewritten = path.replace(/^\/management\/platformmanager/, '/platformmanager');
      console.log(`[Proxy] Path rewrite (platformmanager): ${path} -> ${rewritten}`);
      return rewritten;
    }
    console.log(`[Proxy] Path preserved: ${path}`);
    return path;
  },

  onProxyReq: (proxyReq, req, res) => {
    const targetUrl = `${CAMPUS_CONTROLLER_URL}${req.url}`;
    console.log(`[Proxy] ${req.method} ${req.url} -> ${targetUrl}`);

    if (req.headers.authorization) {
      proxyReq.setHeader('Authorization', req.headers.authorization);
    }
  },

  onProxyRes: (proxyRes, req, res) => {
    console.log(`[Proxy] ${req.method} ${req.url} <- ${proxyRes.statusCode}`);
    proxyRes.headers['Access-Control-Allow-Origin'] = req.headers.origin || '*';
    proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
  },

  onError: (err, req, res) => {
    console.error(`[Proxy Error] ${req.method} ${req.url}:`, err.message);
    res.status(500).json({
      error: 'Proxy Error',
      message: err.message,
      path: req.url
    });
  }
};

// Proxy all /api/* requests to Campus Controller
app.use('/api', (req, res, next) => {
  console.log(`[Proxy Middleware] Received: ${req.method} ${req.url}`);
  next();
}, createProxyMiddleware(proxyOptions));

// Serve static files from the build directory
const buildPath = path.join(__dirname, 'build');
console.log('[Proxy Server] Serving static files from:', buildPath);

app.use(express.static(buildPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (filePath.match(/\.(js|css)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (filePath.match(/\.(jpg|jpeg|png|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=604800');
    }
  }
}));

// Handle React routing - serve index.html for all non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(buildPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Proxy Server] Running on port ${PORT}`);
  console.log(`[Proxy Server] Proxying /api/* to ${CAMPUS_CONTROLLER_URL}`);
  console.log(`[Proxy Server] Health check available at http://localhost:${PORT}/health`);
});

process.on('SIGTERM', () => {
  console.log('[Proxy Server] SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Proxy Server] SIGINT received, shutting down gracefully');
  process.exit(0);
});
