import { prisma } from '../src/lib/prisma';
import { backfillCampaignEmbeddings } from '../src/services/campaign-embeddings';

async function main() {
  const companyId = process.env.COMPANY_ID;
  const count = await backfillCampaignEmbeddings(companyId);
  console.log(JSON.stringify({ embedded: count, companyId: companyId ?? 'all tenants' }));
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
