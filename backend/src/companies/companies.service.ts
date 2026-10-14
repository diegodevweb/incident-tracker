import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IncidentStatus, Prisma, UserRole } from '@prisma/client';
import { DEFAULT_PAGE_SIZE } from '../incidents/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeCnpj } from './cnpj';
import { CreateCompanyDto } from './dto/create-company.dto';
import { ListCompaniesQueryDto } from './dto/list-companies-query.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

// O que o admin vê de uma empresa, com as contagens da listagem.
const COMPANY_SELECT = {
  id: true,
  name: true,
  cnpj: true,
  disabledAt: true,
  createdAt: true,
  _count: {
    select: {
      users: { where: { role: UserRole.CLIENT } },
      incidents: { where: { status: { not: IncidentStatus.RESOLVED } } },
    },
  },
} satisfies Prisma.CompanySelect;

type CompanyRow = Prisma.CompanyGetPayload<{ select: typeof COMPANY_SELECT }>;

const toCompany = ({ _count, ...company }: CompanyRow) => ({
  ...company,
  userCount: _count.users,
  openIncidents: _count.incidents,
});

/**
 * Empresas clientes, só para o admin. Empresa não é apagada, é desativada:
 * chamados, usuários e chaves de webhook apontam para ela.
 */
@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListCompaniesQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const cnpj = query.q ? normalizeCnpj(query.q) : '';
    const where: Prisma.CompanyWhereInput = {
      ...(query.status === 'active' ? { disabledAt: null } : {}),
      ...(query.status === 'disabled' ? { disabledAt: { not: null } } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q } },
              ...(cnpj ? [{ cnpj: { contains: cnpj } }] : []),
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        select: COMPANY_SELECT,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.company.count({ where }),
    ]);

    return { items: rows.map(toCompany), total, page, pageSize };
  }

  async get(id: number) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: COMPANY_SELECT,
    });

    if (!company) {
      throw new NotFoundException('Empresa não encontrada');
    }

    return toCompany(company);
  }

  async create(data: CreateCompanyDto) {
    const company = await this.withUniqueCnpj(() =>
      this.prisma.company.create({
        data: { name: data.name, cnpj: data.cnpj ?? null },
        select: COMPANY_SELECT,
      }),
    );

    return toCompany(company);
  }

  async update(id: number, data: UpdateCompanyDto) {
    await this.get(id);

    const company = await this.withUniqueCnpj(() =>
      this.prisma.company.update({
        where: { id },
        // cnpj: undefined não muda; null tira.
        data: { name: data.name, cnpj: data.cnpj },
        select: COMPANY_SELECT,
      }),
    );

    return toCompany(company);
  }

  /**
   * Nenhum usuário da empresa entra mais, as sessões abertas caem e as chaves
   * de webhook param de funcionar (o login, o token e a chave conferem a
   * empresa a cada uso).
   */
  async disable(id: number) {
    const company = await this.get(id);

    if (company.disabledAt) {
      return company;
    }

    await this.prisma.$transaction([
      this.prisma.company.update({
        where: { id },
        data: { disabledAt: new Date() },
      }),
      this.prisma.user.updateMany({
        where: { companyId: id },
        data: { tokenVersion: { increment: 1 } },
      }),
    ]);

    return this.get(id);
  }

  /** Reativa a empresa; usuários desativados um a um continuam desativados. */
  async enable(id: number) {
    await this.get(id);

    return toCompany(
      await this.prisma.company.update({
        where: { id },
        data: { disabledAt: null },
        select: COMPANY_SELECT,
      }),
    );
  }

  private async withUniqueCnpj<T>(write: () => Promise<T>) {
    try {
      return await write();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Já existe uma empresa com este CNPJ');
      }

      throw error;
    }
  }
}
