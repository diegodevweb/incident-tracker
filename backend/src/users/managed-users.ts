import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

// O que o admin vê de um usuário que ele gerencia (de empresa ou outro admin).
// Senha e versão de token nunca saem.
export const MANAGED_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
  disabledAt: true,
  mustChangePassword: true,
} satisfies Prisma.UserSelect;

/** Troca o erro de e-mail repetido do banco por 409. */
export async function withUniqueEmail<T>(write: () => Promise<T>) {
  try {
    return await write();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Já existe um usuário com este e-mail');
    }

    throw error;
  }
}
