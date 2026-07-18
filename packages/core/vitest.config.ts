import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      // `@inject()` reads `design:paramtypes` metadata, so the test transform must emit it and
      // reflect-metadata must be loaded (setupFiles) — mirroring how a real Adonis app boots.
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['reflect-metadata'],
    include: ['src/**/*.{spec,test}.ts', 'test/**/*.{spec,test}.ts'],
    pool: 'forks',
  },
});
