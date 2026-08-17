import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { readFileSync } from 'fs';

// Read version from package.json
const packageJson = JSON.parse(
  readFileSync(path.resolve(__dirname, './package.json'), 'utf-8')
);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    '__APP_VERSION__': JSON.stringify(packageJson.version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'json-summary'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        'dist/'
      ],
      // Set just under the measured numbers (38.7 / 67.3 / 76.1 / 38.7) so an
      // unrelated change cannot fail CI on rounding, while any real drop does.
      thresholds: {
        lines: 37,
        functions: 65,
        branches: 74,
        statements: 37
      }
    },
    // maxForks:1 runs one file at a time, each in its own fresh fork process,
    // so memory never accumulates across files. execArgv raises the per-fork
    // V8 heap limit for any single test file with a heavy module graph.
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 1,
        minForks: 1,
        execArgv: ['--max-old-space-size=4096'],
      },
    },
  }
});
