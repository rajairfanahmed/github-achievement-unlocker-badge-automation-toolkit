import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const envPath = resolve(root, '.env');
const examplePath = resolve(root, '.env.example');

if (existsSync(envPath)) {
  console.log('[postinstall] .env already exists. Skipping template copy.');
  process.exit(0);
}

if (!existsSync(examplePath)) {
  console.log('[postinstall] .env.example not found. Skipping .env creation.');
  process.exit(0);
}

copyFileSync(examplePath, envPath);
console.log('[postinstall] Created .env from .env.example. Fill required values before running.');
