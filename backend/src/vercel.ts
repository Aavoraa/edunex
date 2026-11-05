/**
 * Vercel entry point: the Express app as a function. Unlike server.ts (the local server) it does not
 * listen on a port or start the notification dispatcher timer; functions only run while serving a request.
 *
 * The app is imported statically: Vercel's builder packs this entry and everything it imports into one
 * CommonJS file, and a dynamic import('./app.js') would be left outside it as an ES module that the
 * function cannot load ("Cannot use import statement outside a module").
 *
 * Missing or invalid settings: env.ts throws a ConfigError while the module loads (logged with the names
 * of the settings, never their values). Errors while building the app give a stand-in that answers 503.
 */
import express from 'express';
import { createApp } from './app.js';

function load(): express.Express {
  try {
    return createApp();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('The server failed to start', err);
    const fallback = express();
    fallback.use((_req, res) => {
      res.status(503).json({ success: false, error: 'SERVER_NOT_CONFIGURED', message: 'The server failed to start. See the function logs in Vercel.' });
    });
    return fallback;
  }
}

export default load();
