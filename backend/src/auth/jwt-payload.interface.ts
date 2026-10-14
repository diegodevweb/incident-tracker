import { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: number;
  email: string;
  role: UserRole;
  /** Vem do banco a cada requisição (não do token); ver JwtAuthGuard. */
  mustChangePassword?: boolean;
  /** Empresa do usuário CLIENT, lida do banco a cada requisição; null para ADMIN. */
  companyId?: number | null;
}

export interface JwtTokenPayload extends Omit<
  JwtPayload,
  'mustChangePassword' | 'companyId'
> {
  /** Versão do token do usuário na emissão; muda no logout e invalida o token. */
  tv: number;
}
