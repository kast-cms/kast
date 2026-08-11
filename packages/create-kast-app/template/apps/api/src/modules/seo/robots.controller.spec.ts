import { RobotsController } from './robots.controller';
import type { SeoRepository } from './seo.repository';

describe('RobotsController', () => {
  function build(stored: string | null): {
    controller: RobotsController;
    findRobotsTxt: jest.Mock;
  } {
    const findRobotsTxt = jest.fn().mockResolvedValue(stored);
    const repo = { findRobotsTxt } as unknown as SeoRepository;
    return { controller: new RobotsController(repo), findRobotsTxt };
  }

  it('serves the saved robots.txt setting', async () => {
    const { controller } = build('User-agent: *\nDisallow: /private');
    await expect(controller.getRobots()).resolves.toBe('User-agent: *\nDisallow: /private\n');
  });

  it('falls back to allow-all when nothing is saved', async () => {
    const { controller } = build(null);
    await expect(controller.getRobots()).resolves.toBe('User-agent: *\nAllow: /\n');
  });

  it('caches the setting instead of reading it per request', async () => {
    const { controller, findRobotsTxt } = build('User-agent: *\nDisallow: /');
    await controller.getRobots();
    await controller.getRobots();
    expect(findRobotsTxt).toHaveBeenCalledTimes(1);
  });
});
