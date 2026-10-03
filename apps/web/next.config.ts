import path from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@lumi/shared'],
  // Self-contained server bundle for the Docker image (traces files across the monorepo).
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
};

export default config;
