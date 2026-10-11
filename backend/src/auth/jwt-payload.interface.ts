import { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: number;
  email: string;
  role: UserRole;
}

export interface JwtTokenPayload extends JwtPayload {
  /** Versão do token do usuário na emissão; muda no logout e invalida o token. */
  tv: number;
}
