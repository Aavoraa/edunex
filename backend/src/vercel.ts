/**
 * Vercel entry point: the Express app as a function. Unlike server.ts (the local server) it does not
 * listen on a port or start the notification dispatcher timer; functions only run while serving a request.
 */
import { createApp } from './app.js';

export default createApp();
