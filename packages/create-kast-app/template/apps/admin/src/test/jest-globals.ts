/**
 * apps/admin ships no test runner, and its tsconfig declares an explicit
 * `types` list, so jest's globals are neither typed nor installed here. Specs
 * import them from this module instead: the app keeps typechecking without
 * jest's types, and the files still run verbatim under the API's jest
 * (`pnpm --filter @kast-cms/api exec jest --config <config pointed at this app>`),
 * which injects the same globals before the module is evaluated.
 */
interface Matchers {
  toBe(expected: unknown): void;
  toBeNull(): void;
  toEqual(expected: unknown): void;
}

interface JestGlobals {
  describe: (name: string, fn: () => void) => void;
  it: (name: string, fn: () => void | Promise<void>) => void;
  expect: (value: unknown) => Matchers;
}

const globals = globalThis as unknown as JestGlobals;

export const describe = globals.describe;
export const it = globals.it;
export const expect = globals.expect;
