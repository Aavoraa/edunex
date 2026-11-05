/**
 * Vercel entry point: the Express app as a function. Unlike server.ts (the local server) it does not
 * listen on a port or start the notification dispatcher timer; functions only run while serving a request.
 *
 * When the project's environment variables are missing or invalid, a stand-in app answers every request
 * with 503 and the names of the settings to fix (never their values), instead of the function crashing
 * with Vercel's opaque FUNCTION_INVOCATION_FAILED.
 */
import express from 'express';

async function load(): Promise<express.Express> {
  try {
    const { createApp } = await import('./app.js');
    return createApp();
  } catch (err) {
    const issues = (err as { issues?: unknown }).issues;
    const message = Array.isArray(issues)
      ? `The server is not configured. In Vercel, set or fix these environment variables, then redeploy: ${issues.join('; ')}`
      : 'The server failed to start. See the function logs in Vercel.';
    // eslint-disable-next-line no-console
    console.error(message, Array.isArray(issues) ? '' : err);
    const fallback = express();
    fallback.use((_req, res) => {
      res.status(503).json({ success: false, error: 'SERVER_NOT_CONFIGURED', message });
    });
    return fallback;
  }
}

export default await load();
