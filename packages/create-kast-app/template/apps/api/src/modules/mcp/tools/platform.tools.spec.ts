import type { AuthUser } from '../../../common/types/auth.types';
import type { PluginService } from '../../plugin/plugin.service';
import type { UsersService } from '../../users/users.service';
import { McpPlatformTools } from './platform.tools';

const AGENT: AuthUser = {
  id: 'u1',
  email: 'agent@kast.local',
  roles: ['admin'],
  isAgentToken: true,
  agentTokenId: 'at1',
};

const DRY = { dryRun: true };
const WET = { dryRun: false };

describe('McpPlatformTools', () => {
  let plugins: {
    list: jest.Mock;
    enable: jest.Mock;
    disable: jest.Mock;
    requireRegistered: jest.Mock;
  };
  let users: { invite: jest.Mock; assertInvitable: jest.Mock };
  let tools: McpPlatformTools;

  beforeEach(() => {
    plugins = {
      list: jest.fn(async () => ({ data: [] })),
      enable: jest.fn(async () => ({ data: {} })),
      disable: jest.fn(async () => ({ data: {} })),
      requireRegistered: jest.fn(async () => ({ isActive: false, isSystemPlugin: false })),
    };
    users = {
      invite: jest.fn(async () => ({ data: { id: 'u2' } })),
      assertInvitable: jest.fn(async () => undefined),
    };
    tools = new McpPlatformTools(
      plugins as unknown as PluginService,
      users as unknown as UsersService,
    );
  });

  describe('enable_plugin', () => {
    it('reports the current state and whether the call would change it', async () => {
      const result = (await tools.enablePlugin({ name: 'kast-plugin-r2' }, AGENT, DRY)) as Record<
        string,
        unknown
      >;

      expect(result['currentlyActive']).toBe(false);
      expect(result['wouldChange']).toBe(true);
      expect(plugins.enable).not.toHaveBeenCalled();
    });

    it('says the change would be a no-op when the plugin is already enabled', async () => {
      plugins.requireRegistered.mockResolvedValueOnce({ isActive: true, isSystemPlugin: false });

      const result = (await tools.enablePlugin({ name: 'kast-plugin-r2' }, AGENT, DRY)) as Record<
        string,
        unknown
      >;

      expect(result['wouldChange']).toBe(false);
    });

    it('refuses the preview for a plugin that is not registered', async () => {
      plugins.requireRegistered.mockRejectedValueOnce(new Error('Plugin "nope" is not registered'));

      await expect(tools.enablePlugin({ name: 'nope' }, AGENT, DRY)).rejects.toThrow(
        'is not registered',
      );
    });

    it('enables for real when not a dry run', async () => {
      await tools.enablePlugin({ name: 'kast-plugin-r2' }, AGENT, WET);

      expect(plugins.enable).toHaveBeenCalledWith('kast-plugin-r2');
    });
  });

  describe('disable_plugin', () => {
    it('warns that other replicas keep running the plugin until they restart', async () => {
      plugins.requireRegistered.mockResolvedValueOnce({ isActive: true, isSystemPlugin: false });

      const result = (await tools.disablePlugin({ name: 'kast-plugin-r2' }, AGENT, DRY)) as Record<
        string,
        unknown
      >;

      expect(result['wouldChange']).toBe(true);
      expect(String(result['note'])).toMatch(/restart/i);
      expect(plugins.disable).not.toHaveBeenCalled();
    });
  });

  describe('invite_user', () => {
    it('runs the real escalation and duplicate checks before reporting success', async () => {
      const result = (await tools.inviteUser(
        { email: 'new@kast.local', roleNames: ['editor'] },
        AGENT,
        DRY,
      )) as Record<string, unknown>;

      expect(users.assertInvitable).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@kast.local', roleNames: ['editor'] }),
        AGENT,
      );
      expect(result['wouldInvite']).toBe(true);
      expect(users.invite).not.toHaveBeenCalled();
    });

    it('fails the preview when the invite itself would be refused', async () => {
      users.assertInvitable.mockRejectedValueOnce(
        new Error('A user with this email already exists'),
      );

      await expect(
        tools.inviteUser({ email: 'taken@kast.local', roleNames: ['editor'] }, AGENT, DRY),
      ).rejects.toThrow('already exists');
    });

    it('passes only the optional fields that were supplied', async () => {
      await tools.inviteUser(
        { email: 'new@kast.local', roleNames: ['editor'], firstName: 'Ada' },
        AGENT,
        WET,
      );

      const [dto] = users.invite.mock.calls[0] as [Record<string, unknown>];
      expect(dto).toEqual({ email: 'new@kast.local', roleNames: ['editor'], firstName: 'Ada' });
      expect(Object.hasOwn(dto, 'lastName')).toBe(false);
    });
  });

  it('lists plugins without a dry-run branch', async () => {
    await tools.listPlugins({}, AGENT, WET);

    expect(plugins.list).toHaveBeenCalledTimes(1);
  });
});
