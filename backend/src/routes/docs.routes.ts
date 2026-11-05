import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import { logger } from '../utils/logger.js';

/**
 * OpenAPI document = docs/openapi/base.yaml + every docs/openapi/paths/*.yaml
 * (one file per module), merged at start-up.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const root = [path.resolve(here, '../../../docs/openapi'), path.resolve(here, '../../../../docs/openapi')].find((p) => existsSync(p));

export function buildSpec() {
  if (!root) return { openapi: '3.0.3', info: { title: 'Edunex API', version: '1.0.0' }, paths: {} };
  const spec = YAML.parse(readFileSync(path.join(root, 'base.yaml'), 'utf8'));
  spec.paths = spec.paths ?? {};
  const dir = path.join(root, 'paths');
  if (existsSync(dir)) {
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.yaml')).sort()) {
      try {
        const part = YAML.parse(readFileSync(path.join(dir, file), 'utf8')) ?? {};
        for (const [p, ops] of Object.entries(part)) {
          spec.paths[p] = { ...(spec.paths[p] ?? {}), ...(ops as object) };
        }
      } catch (err) {
        logger.warn({ err, file }, 'skipping invalid OpenAPI fragment');
      }
    }
  }
  return spec;
}

export const docsRouter = Router();
const spec = buildSpec();
docsRouter.get('/openapi.json', (_req, res) => res.json(spec));
docsRouter.use('/', swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: 'Edunex Smart School 360 API' }));
