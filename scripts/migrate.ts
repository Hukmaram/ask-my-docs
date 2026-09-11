import 'dotenv/config';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { pool } from '../src/db/pool.js';

async function migrate(): Promise<void> {
  const migrationsDir = path.resolve('src/db/migrations');
  console.log(`Reading migrations from: ${migrationsDir}`);

  const files = (await fs.readdir(migrationsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No SQL migration files found.');
    return;
  }

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    console.log(`Executing migration: ${file}...`);
    const sql = await fs.readFile(filePath, 'utf-8');
    await pool.query(sql);
    console.log(`✓ Migration applied: ${file}`);
  }

  console.log('\nAll database migrations applied successfully.');
}

migrate()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
