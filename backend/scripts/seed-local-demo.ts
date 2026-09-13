import { readFile } from 'fs/promises';
import path from 'path';
import { prisma } from '../src/lib/prisma';
import { parseCSV } from '../src/services/ingestion';
import { ingestCsvIntoPrisma } from '../src/services/ingest-prisma';
import { materializeCodedOpportunities } from '../src/services/opportunity-discovery';

const COMPANY_ID = process.env.COMPANY_ID ?? 'a2b5adf8-901f-466b-87ec-fd8f489afe2c';
const DEMO_DIR = path.resolve(process.cwd(), 'generated-data');

async function main() {
  const company = await prisma.company.findUnique({ where: { id: COMPANY_ID } });
  if (!company) {
    throw new Error(`Company ${COMPANY_ID} is not in local Prisma. Finish onboarding first.`);
  }

  const [customerBuffer, orderBuffer] = await Promise.all([
    readFile(path.join(DEMO_DIR, 'customers.csv')),
    readFile(path.join(DEMO_DIR, 'orders.csv')),
  ]);
  const [customers, orders] = await Promise.all([parseCSV(customerBuffer), parseCSV(orderBuffer)]);

  await prisma.customer.deleteMany({ where: { companyId: COMPANY_ID } });
  await prisma.product.deleteMany({ where: { companyId: COMPANY_ID } });

  const result = await ingestCsvIntoPrisma(COMPANY_ID, customers, orders);
  const agent = await prisma.agent.findFirst({
    where: { companyId: COMPANY_ID },
    orderBy: { createdAt: 'desc' },
  });
  const opportunities = await materializeCodedOpportunities(COMPANY_ID, agent?.id);
  console.log(
    JSON.stringify({
      companyId: COMPANY_ID,
      customers: result.metrics.totalCustomers,
      orders: result.metrics.totalOrders,
      metrics: result.metrics.totalMetricsRecords,
      orderSummary: result.orderSummary,
      opportunities: opportunities.map((row) => ({ type: row.type, audience: row.audienceSize })),
    }),
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
