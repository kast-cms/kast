import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../../common/types/auth.types';
import { PluginService } from '../../plugin/plugin.service';
import type { InviteUserDto } from '../../users/dto/user.dto';
import { UsersService } from '../../users/users.service';
import { McpTool } from '../mcp-tool.decorator';
import type { ToolContext } from '../types/mcp.types';

/**
 * Plugin control and user onboarding. Both are administrative surfaces, so every
 * tool here sits at admin or above and the two mutating ones support dry run —
 * an agent proposing to disable a plugin or invite a colleague should be able to
 * show the operator what it is about to do.
 */
@Injectable()
export class McpPlatformTools {
  constructor(
    private readonly plugins: PluginService,
    private readonly users: UsersService,
  ) {}

  @McpTool({
    name: 'list_plugins',
    description: 'List registered plugins with their enabled state',
    role: 'admin',
    inputSchema: { type: 'object', properties: {} },
    dryRunable: false,
  })
  async listPlugins(
    _args: Record<string, unknown>,
    _user: AuthUser,
    _ctx: ToolContext,
  ): Promise<unknown> {
    return this.plugins.list();
  }

  @McpTool({
    name: 'enable_plugin',
    description: 'Enable a registered plugin, loading it into the running API',
    role: 'admin',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string' }, dryRun: { type: 'boolean' } },
      required: ['name'],
    },
    dryRunable: true,
  })
  async enablePlugin(
    args: Record<string, unknown>,
    _user: AuthUser,
    ctx: ToolContext,
  ): Promise<unknown> {
    const name = args['name'] as string;
    if (ctx.dryRun) return this.previewPluginToggle(name, true);
    return this.plugins.enable(name);
  }

  @McpTool({
    name: 'disable_plugin',
    description: 'Disable a plugin, unloading it from the running API',
    role: 'admin',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string' }, dryRun: { type: 'boolean' } },
      required: ['name'],
    },
    dryRunable: true,
  })
  async disablePlugin(
    args: Record<string, unknown>,
    _user: AuthUser,
    ctx: ToolContext,
  ): Promise<unknown> {
    const name = args['name'] as string;
    if (ctx.dryRun) return this.previewPluginToggle(name, false);
    return this.plugins.disable(name);
  }

  @McpTool({
    name: 'invite_user',
    description:
      'Invite a user by email with the given roles. Kast has no create-user-with-password ' +
      'path: accounts are established by the invitee setting their own password.',
    role: 'admin',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        roleNames: { type: 'array', items: { type: 'string' }, minItems: 1 },
        dryRun: { type: 'boolean' },
      },
      required: ['email', 'roleNames'],
    },
    dryRunable: true,
  })
  async inviteUser(
    args: Record<string, unknown>,
    user: AuthUser,
    ctx: ToolContext,
  ): Promise<unknown> {
    const dto = {
      email: args['email'] as string,
      roleNames: args['roleNames'] as string[],
      ...(args['firstName'] !== undefined ? { firstName: args['firstName'] as string } : {}),
      ...(args['lastName'] !== undefined ? { lastName: args['lastName'] as string } : {}),
    } as InviteUserDto;

    if (ctx.dryRun) {
      // Runs the same escalation and duplicate checks the real invite runs, so a
      // preview that reports wouldInvite cannot be refused a moment later.
      await this.users.assertInvitable(dto, user);
      return {
        action: 'invite_user',
        email: dto.email,
        roleNames: dto.roleNames,
        wouldInvite: true,
      };
    }
    return this.users.invite(dto, user);
  }

  /**
   * Reports what the toggle would change, including the state the operator
   * cannot see from the record alone: a disable does not unload the plugin on
   * any other replica until that replica restarts.
   */
  private async previewPluginToggle(
    name: string,
    enable: boolean,
  ): Promise<Record<string, unknown>> {
    const record = await this.plugins.requireRegistered(name);
    return {
      action: enable ? 'enable_plugin' : 'disable_plugin',
      name,
      currentlyActive: record.isActive,
      wouldChange: record.isActive !== enable,
      note: 'Takes effect on this API process immediately; other replicas apply it on restart.',
    };
  }
}
