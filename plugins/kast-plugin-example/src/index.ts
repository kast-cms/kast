import { type IKastPlugin, type KastPluginContext, PluginHook } from '@kast-cms/plugin-sdk';

/**
 * Minimal reference plugin.
 *
 * Demonstrates the full Kast plugin contract: implement `IKastPlugin`, subscribe
 * to lifecycle hooks via `ctx.on(...)` inside `onLoad`, and export the class as
 * the default export. The context (`KastPluginContext`) exposes `on`,
 * `getConfig`, `setConfig` and `pluginName` — there is no logger, so diagnostics
 * are written to stderr.
 */
export class ExamplePlugin implements IKastPlugin {
  async onLoad(ctx: KastPluginContext): Promise<void> {
    ctx.on(PluginHook.CONTENT_CREATED, (payload) => {
      process.stderr.write(`[kast-plugin-example] content.created: ${JSON.stringify(payload)}\n`);
    });
  }
}

export default ExamplePlugin;
