import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/jwt-payload.interface';

// O sino mostra os mais recentes; os antigos continuam no histórico do chamado.
export const NOTIFICATIONS_LIST_SIZE = 20;

// Os avisos de um chamado excluído somem com ele (e voltam se for restaurado).
const VISIBLE_INCIDENT = {
  deletedAt: null,
} satisfies Prisma.IncidentWhereInput;

/** Os avisos de quem está logado. Cada um só vê e marca os próprios. */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: JwtPayload) {
    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId: user.sub, incident: VISIBLE_INCIDENT },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: NOTIFICATIONS_LIST_SIZE,
        select: {
          id: true,
          type: true,
          metadata: true,
          readAt: true,
          createdAt: true,
          // A origem muda o nome das criticidades (webhook x painel).
          incident: { select: { id: true, title: true, source: true } },
        },
      }),
      this.countUnread(user),
    ]);

    return { unreadCount, items };
  }

  async markRead(user: JwtPayload, incidentId?: number) {
    await this.prisma.notification.updateMany({
      where: {
        userId: user.sub,
        readAt: null,
        ...(incidentId ? { incidentId } : {}),
      },
      data: { readAt: new Date() },
    });

    return { unreadCount: await this.countUnread(user) };
  }

  private countUnread(user: JwtPayload) {
    return this.prisma.notification.count({
      where: { userId: user.sub, readAt: null, incident: VISIBLE_INCIDENT },
    });
  }
}
