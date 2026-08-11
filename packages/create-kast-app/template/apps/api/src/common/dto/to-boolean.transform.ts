import { Transform, type TransformFnParams } from 'class-transformer';

/**
 * Re-reads a declared-boolean property from the raw request body.
 *
 * The global pipe (main.ts) runs with `transformOptions.enableImplicitConversion`,
 * and class-transformer applies a bare `Boolean(value)` to any property whose
 * design type is Boolean BEFORE any `@Transform` runs. By the time a transform
 * that inspects `value` executes, `"false"` has already become `true`, so such a
 * transform is a silent no-op — the shape this repo previously used.
 *
 * Nest registers `express.urlencoded` by default, so `curl -d 'isActive=false'`
 * delivers every value as a string; a JSON client can send `{"isActive":"false"}`
 * just as easily. Without this, those requests mean the OPPOSITE of what they say.
 *
 * Only the two canonical literals convert. Anything else is passed through
 * unchanged so `@IsBoolean()` still rejects it rather than guessing — `"maybe"`
 * is a client bug and must surface as a 400, not as `true`.
 */
export const toBoolean = ({ key, obj }: TransformFnParams): unknown => {
  const source = obj as Record<string, unknown>;
  // Own-property check: a body cannot reach an inherited Object.prototype member.
  if (!Object.hasOwn(source, key)) return undefined;
  const raw = source[key];
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return raw;
};

/**
 * `@IsBoolean()`-compatible decorator for a boolean DTO property. Use this on
 * EVERY declared boolean, not only the ones a browser form posts — the pipe's
 * implicit conversion applies to all of them.
 */
export const BooleanFlag = (): PropertyDecorator => Transform(toBoolean);
