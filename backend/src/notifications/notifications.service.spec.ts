import { UserRole } from '@prisma/client';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import {
  NOTIFICATIONS_LIST_SIZE,
  NotificationsService,
} from './notifications.service';

describe('NotificationsService', () => {
  const client: JwtPayload = {
    sub: 2,
    email: 'cliente@example.com',
    role: UserRole.CLIENT,
    companyId: 7,
  };
  let prisma: {
    notification: {
      findMany: jest.Mock;
      count: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let service: NotificationsService;

  beforeEach(() => {
    prisma = {
      notification: {
        findMany: jest.fn().mockResolvedValue([{ id: 1 }]),
        count: jest.fn().mockResolvedValue(3),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    service = new NotificationsService(prisma as unknown as PrismaService);
  });

  it("lists only the user's own notices, newest first, with the unread count, leaving deleted incidents out", async () => {
    await expect(service.list(client)).resolves.toEqual({
      unreadCount: 3,
      items: [{ id: 1 }],
    });

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 2, incident: { deletedAt: null } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: NOTIFICATIONS_LIST_SIZE,
      }),
    );
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { userId: 2, readAt: null, incident: { deletedAt: null } },
    });
  });

  it('shows only the id, title and source of the incident', async () => {
    await service.list(client);

    const [[{ select }]] = prisma.notification.findMany.mock.calls as [
      [{ select: Record<string, unknown> }],
    ];
    expect(select.incident).toEqual({
      select: { id: true, title: true, source: true },
    });
  });

  it("marks all the user's unread notices as read", async () => {
    await expect(service.markRead(client)).resolves.toEqual({
      unreadCount: 3,
    });

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 2, readAt: null },
      data: { readAt: expect.any(Date) as Date },
    });
  });

  it('marks only the notices of one incident when asked', async () => {
    await service.markRead(client, 10);

    expect(prisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 2, readAt: null, incidentId: 10 },
      }),
    );
  });
});
