import { Prisma } from '@prisma/client';

/** O que sai da empresa do chamado nas respostas. */
export const PUBLIC_COMPANY_SELECT = {
  id: true,
  name: true,
} satisfies Prisma.CompanySelect;

/**
 * O que sai de quem abriu o chamado. Nunca usar `createdBy: true`: isso
 * devolve a linha inteira do usuário, com o hash da senha. Sem e-mail: quem
 * abriu pode ser um admin, e o cliente só vê o nome dele.
 */
export const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
} satisfies Prisma.UserSelect;
