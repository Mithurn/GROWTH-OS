import { prisma } from '../src/lib/prisma';
import { materializeCodedOpportunities } from '../src/services/opportunity-discovery';

const COMPANY_ID = process.env.COMPANY_ID ?? 'a2b5adf8-901f-466b-87ec-fd8f489afe2c';

async function main() {
  const agent = await prisma.agent.findFirst({
    where: { companyId: COMPANY_ID },
    orderBy: { createdAt: 'desc' },
  });
  const rows = await materializeCodedOpportunities(COMPANY_ID, agent?.id);
  console.log(JSON.stringify({ companyId: COMPANY_ID, opportunities: rows }, null, 2));
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
