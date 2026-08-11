import { NotFoundException } from '@nestjs/common';
import { assertCanManageUser } from '../../common/authorization/role-rank.util';
import type { AuthUser } from '../../common/types/auth.types';
import type { PrismaService } from '../../prisma/prisma.service';
import type { TrashModel } from './dto/trash-query.dto';

/**
 * Restoring a user clears `isActive`, and `isActive` is the whole
 * authentication gate, so the trash routes can hand an account back its ability
 * to sign in — and destroy it. Both therefore answer to the same rank rule as
 * `/users` (BR-USR-006), or an ADMIN reaches through the trash a peer they are
 * refused on their own route. The other trashable models carry no privilege.
 */
export async function assertActorOutranksTarget(
  prisma: PrismaService,
  model: TrashModel,
  id: string,
  actor: AuthUser,
): Promise<void> {
  if (model !== 'user') return;
  const target = await prisma.user.findFirst({
    where: { id },
    select: { roles: { select: { role: { select: { name: true } } } } },
  });
  if (target === null) throw new NotFoundException(`user ${id} not found in trash`);
  assertCanManageUser(
    actor.roles,
    target.roles.map((r) => r.role.name),
  );
}
