import { pathsToModuleNameMapper } from 'ts-jest'
import type {Config} from '@jest/types'

import { compilerOptions } from './tsconfig.json'

interface JestConfigWithSWCJest extends Omit<Config.InitialOptions, 'transform'> {
  transform?: {
    [regex: string]: ['@swc/jest'];
  };
}

const jestConfig : JestConfigWithSWCJest = {
  roots: ['<rootDir>'],
  modulePaths: [compilerOptions.baseUrl],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    ...pathsToModuleNameMapper(compilerOptions.paths , { useESM: true })
  },
  testEnvironment: "node",
  testMatch: [
    "**/?(*.)+(spec|test).ts?(x)"
  ],
  collectCoverage: true,
  coveragePathIgnorePatterns: [
    ".*/dist",
    "testing",
    "src/services/telemetry/metrics",
    "src/services/notification/log.ts"
  ],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    // '^.+\\.[tj]sx?$' to process ts,js,tsx,jsx with `ts-jest`
    // '^.+\\.m?[tj]sx?$' to process ts,js,tsx,jsx,mts,mjs,mtsx,mjsx with `ts-jest`
    '^.+\\.tsx?$': [
      '@swc/jest'
    ],
  },
}

export default jestConfig