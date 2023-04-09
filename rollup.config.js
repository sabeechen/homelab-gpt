// Import rollup plugins

import {copy} from '@web/rollup-plugin-copy';
import { nodeResolve } from '@rollup/plugin-node-resolve';
const terser  = require('@rollup/plugin-terser');
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'server/static/build/chat-main.js',
  input: 'ts/chat-main.ts',
  plugins: [
    // Entry point for application build; can specify a glob to build multiple
    // HTML files for non-SPA app
    // html({
    //   input: 'html/*.html',
    // }),
    typescript(),
    commonjs(),
    // Resolve bare module specifiers to relative paths
    nodeResolve(),
    // Minify JS
    terser({
      ecma: 2020,
      module: true,
      warnings: true,
    }),
    // Print bundle summary
    copy({
      patterns: ['images/**/*'],
    }),
  ],
  output: {
    dir: 'server/static',
    sourcemap: true
  },
  preserveEntrySignatures: 'strict',
};