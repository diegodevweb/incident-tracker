import { Prisma } from '@prisma/client';

/**
 * Campos do cliente que podem sair nas respostas. Nunca usar `client: true`:
 * isso devolve a linha inteira do usuário, com o hash da senha.
 */
export const PUBLIC_CLIENT_SELECT = {
  id: true,
  name: true,
  email: true,
} satisfies Prisma.UserSelect;
