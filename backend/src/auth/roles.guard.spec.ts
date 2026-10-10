import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const buildContext = (user?: { role: UserRole }) =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  const buildGuard = (requiredRoles?: UserRole[]) => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles);

    return new RolesGuard(reflector);
  };

  it('allows any user when the route declares no roles', () => {
    const guard = buildGuard(undefined);

    expect(guard.canActivate(buildContext({ role: UserRole.CLIENT }))).toBe(
      true,
    );
  });

  it('allows a user whose role is listed', () => {
    const guard = buildGuard([UserRole.ADMIN]);

    expect(guard.canActivate(buildContext({ role: UserRole.ADMIN }))).toBe(
      true,
    );
  });

  it('blocks a user whose role is not listed', () => {
    const guard = buildGuard([UserRole.ADMIN]);

    expect(() =>
      guard.canActivate(buildContext({ role: UserRole.CLIENT })),
    ).toThrow(ForbiddenException);
  });

  it('blocks when roles are required but there is no authenticated user', () => {
    const guard = buildGuard([UserRole.ADMIN]);

    expect(() => guard.canActivate(buildContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
