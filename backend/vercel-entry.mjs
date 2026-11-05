/**
 * Vercel entrypoint for the `api` service (vercel.json). Vercel needs the entry file to exist before the
 * build, so this committed file re-exports the bundle that `npm run build:vercel` writes: the whole API
 * (src/vercel.ts and everything it imports) in one ES module. A .mjs file always loads as an ES module,
 * which the function's per-file TypeScript output did not ("Cannot use import statement outside a module").
 */
export { default } from './dist/vercel.mjs';
