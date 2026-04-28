import { type IKastPlugin, type KastPluginContext, PluginHook } from '@kast-cms/plugin-sdk';

export class ExamplePlugin implements IKastPlugin {
  async onLoad(ctx: KastPluginContext): Promise<void> {
    ctx.on(PluginHook.CONTENT_CREATED, (payload) => {
      process.stderr.write(`[kast-plugin-example] content.created: ${JSON.stringify(payload)}\n`);
    });
  }
}

export default ExamplePlugin;
