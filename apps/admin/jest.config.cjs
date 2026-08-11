/**
 * The admin is a Next app with no test runner of its own, so its pure-logic
 * specs run under the API package's jest (see the `test` script). Only `.ts` is
 * matched: component files need a DOM environment this setup does not provide,
 * which is why each fix keeps its logic in a plain module and the component
 * keeps only the wiring.
 *
 * Adding jest + ts-jest to this package's devDependencies would let the script
 * become a plain `jest`; until then it borrows the API's.
 */
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        isolatedModules: true,
        diagnostics: false,
        tsconfig: { module: 'commonjs', target: 'ES2022', esModuleInterop: true },
      },
    ],
  },
};
