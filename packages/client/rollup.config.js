import typescript from 'rollup-plugin-typescript2';
import pkg from './package.json' assert { type: 'json' };
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

const input = './src/lib.ts';

const plugins = [
  nodeResolve({
    customResolveOptions: {
      moduleDirectories: ['node_modules', '../../node_modules'],
    },
  }),
  commonjs({
    include: '../../node_modules/**',
  }),
  typescript({
    typescript: require('typescript'),
  }),
];

// Note: add here any additional dependency that should not be included in the bundle.
const external = [
  ...Object.keys(pkg.peerDependencies || {}),
];

export default [
  {
    input,
    output: [
      {
        file: pkg.main,
        format: 'cjs',
      },
      {
        file: pkg.module,
        format: 'esm',
      }
    ],
    plugins,
    external,
  },
  {
    input,
    output: {
      file: pkg.browser,
      name: 'xcmon',
      format: 'umd',
      globals: {
        'ws': 'WebSocket_'
      }
    },
    plugins,
    external,
  }
];