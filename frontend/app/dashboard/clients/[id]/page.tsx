import { CompanyPageClient } from "@/components/companies/company-page-client";

export default async function ClientCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <CompanyPageClient id={Number(id)} />;
}
