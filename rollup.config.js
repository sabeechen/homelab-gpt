// Import rollup plugins

import {copy} from '@web/rollup-plugin-copy';
import { nodeResolve } from '@rollup/plugin-node-resolve';
const terser  = require('@rollup/plugin-terser');
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import postcss from 'rollup-plugin-postcss';
import postcssImport from 'postcss-import';
import json from "@rollup/plugin-json"
import { generateSW } from 'rollup-plugin-workbox';

export default {
  input: 'ts/index.ts',
  plugins: [
    // Entry point for application build; can specify a glob to build multiple
    // HTML files for non-SPA app
    // html({
    //   input: 'html/*.html',
    // }),
    typescript(),
    commonjs(),
    json(),
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
    postcss({
      plugins: [postcssImport()],
      inject: false,
      minimize: true,
    }),
    generateSW({
      globDirectory: 'server/',
      globPatterns: [
        'static/*.{js,svg,css,html,json}'
      ],
      swDest: 'server/sw.js',
      ignoreURLParametersMatching: [
        /^utm_/,
        /^fbclid$/
      ]
    }),
  ],
  output: {
    dir: 'server/static',
    sourcemap: true
  },
  preserveEntrySignatures: 'strict'
};