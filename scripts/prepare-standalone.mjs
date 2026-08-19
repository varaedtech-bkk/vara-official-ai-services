#!/usr/bin/env node
/**
 * Next standalone output omits public/ and .next/static/.
 * Copy them next to server.js so CSS/JS and images load in production.
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const stand = join(root, '.next/standalone');
const server = join(stand, 'server.js');

if (!existsSync(server)) {
  console.error('prepare-standalone: .next/standalone/server.js not found. Did next build run with output: "standalone"?');
  process.exit(1);
}

const publicDir = join(root, 'public');
if (existsSync(publicDir)) {
  cpSync(publicDir, join(stand, 'public'), { recursive: true });
}

mkdirSync(join(stand, '.next'), { recursive: true });
cpSync(join(root, '.next/static'), join(stand, '.next/static'), { recursive: true });

console.log('prepare-standalone: copied public/ and .next/static into .next/standalone');
