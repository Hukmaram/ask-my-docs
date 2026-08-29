import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { parse } from 'yaml';

import {
  papersConfigSchema,
  type PapersConfig,
} from './papers.js';

export async function loadPapersConfig(): Promise<PapersConfig> {
  const configPath = path.resolve('config/papers.yaml');

  const file = await readFile(configPath, 'utf-8');

  const rawConfig: unknown = parse(file);

  return papersConfigSchema.parse(rawConfig);
}