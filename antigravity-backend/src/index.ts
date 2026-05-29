import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { connectDB } from './config/mongodb.js';
import authRoutes from './routes/auth.js';
import contentRoutes from './routes/content.js';
import adminRoutes from './routes/admin.js';
import scrapeRoutes, { pwBrowser } from './routes/scrape.js';

const app = express();

app.use(cors({
  origin: config.server.frontendUrl,
  credentials: true,
}));

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ 
    name: 'Antigravity API', 
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      scrape: '/api/content/scrape'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/content', scrapeRoutes);

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await connectDB();
  
  const PORT = config.server.port;
  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║           Antigravity Backend Running                ║
╠═══════════════════════════════════════════════════════╣
║  Database:  MongoDB                            ║
║  Server:    http://localhost:${PORT}                  ║
║  Health:   http://localhost:${PORT}/health            ║
║  API:      http://localhost:${PORT}/api              ║
╚═══════════════════════════════════════════════════════╝
    `);
  });
}

start();

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  if (pwBrowser) { await pwBrowser.close(); }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  if (pwBrowser) { await pwBrowser.close(); }
  process.exit(0);
});

export default app;