import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.{spec,test}.{ts,tsx}', 'test/**/*.{spec,test}.{ts,tsx}'],
    pool: 'forks',
  },
});
