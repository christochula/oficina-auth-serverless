import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { build } from 'esbuild';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const outputDirectory = resolve(repositoryRoot, '.build');
await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

const entryPoints = {
  handler: './src/handler.ts',
  authorizer: './src/authorizer.ts',
  notification: './src/notification.ts',
};

await build({
  entryPoints,
  absWorkingDir: repositoryRoot,
  outdir: '.build',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: 'inline',
  minify: false,
  external: ['datadog-lambda-js'],
  logLevel: 'info',
});
