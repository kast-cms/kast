import { defineConfig } from 'tsup';

export default defineConfig({
  // scaffold.ts is a second entry so the CLI e2e suite can drive
  // scaffoldProject directly without spawning the interactive binary.
  entry: ['src/index.ts', 'src/scaffold.ts'],
  format: ['esm'],
  clean: true,
  sourcemap: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
