/**
 * The ioredis commands this codebase issues on the connection BullMQ hands back
 * from `Queue.client`.
 *
 * That property is typed as BullMQ's `IRedisClient`, which is deliberately
 * narrow: it promises only the commands BullMQ itself calls, and it drops ones
 * it stops using. `ping` and `eval` both disappeared from it between bullmq
 * 5.76 and 5.81, which compiled fine against this repo's lockfile and broke
 * every freshly generated project, where the caret range resolves to the newer
 * release.
 *
 * The object behind the type is a full ioredis client, so the commands work.
 * Declaring the ones we depend on keeps the assertion in a single place, and
 * makes a genuine removal a compile error here rather than a runtime failure
 * spread across call sites.
 */
export interface RedisCommands {
  ping(): Promise<string>;
  set(key: string, value: string, mode: 'PX', ttlMs: number): Promise<unknown>;
  eval(script: string, numKeys: number, ...keysAndArgs: string[]): Promise<unknown>;
}

/** Narrows a BullMQ queue's client to the commands declared above. */
export async function redisCommands(queue: { client: Promise<unknown> }): Promise<RedisCommands> {
  return (await queue.client) as RedisCommands;
}
