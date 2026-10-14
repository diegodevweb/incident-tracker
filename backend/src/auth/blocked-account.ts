import { UserRole } from '@prisma/client';

type AccountState = {
  role: UserRole;
  disabledAt: Date | null;
  companyId: number | null;
  company: { disabledAt: Date | null } | null;
};

/**
 * Conta que não pode entrar nem usar um token: usuário desativado, usuário de
 * empresa desativada ou usuário CLIENT sem empresa (não teria o que ver).
 */
export function isBlockedAccount(user: AccountState) {
  return Boolean(
    user.disabledAt ||
    user.company?.disabledAt ||
    (user.role === UserRole.CLIENT && !user.companyId),
  );
}
