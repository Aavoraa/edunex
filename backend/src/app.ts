import crypto from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { api } from './routes/index.js';
import { docsRouter } from './routes/docs.routes.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { apiLimiter, noStore, sanitizeBody } from './middleware/security.js';
import { logger } from './utils/logger.js';
import { pool } from './config/db.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use(pinoHttp({
    logger,
    genReqId: (req, res) => {
      const id = (req.headers['x-request-id'] as string) || crypto.randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },
    autoLogging: { ignore: (req) => req.url === '/api/health' },
  }));

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Swagger UI needs inline styles; nothing else is served from the API.
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        scriptSrc: ["'self'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
    // Helmet's default is no-referrer, but OpenStreetMap's tile servers refuse
    // browser requests without a Referer ("Access blocked" tiles). Send only the
    // origin to other sites; full URLs (which contain student ids) stay private.
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));

  app.use(cors({
    origin(origin, cb) {
      // Native mobile apps and server-to-server calls send no Origin header.
      if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
      cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Type', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
  }));

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());
  app.use(sanitizeBody);

  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ success: true, data: { status: 'ok', database: 'up', time: new Date().toISOString() }, message: 'Healthy' });
    } catch {
      res.status(503).json({ success: false, message: 'Database unavailable', error: 'DB_DOWN' });
    }
  });

  app.use('/api/docs', docsRouter);
  app.use('/api', apiLimiter, noStore, api);
  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
