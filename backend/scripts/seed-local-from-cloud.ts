import { prisma } from '../src/lib/prisma';

const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function rest<T>(path: string): Promise<T> {
  const res = await fetch(`${base}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json() as Promise<T>;
}

type Company = {
  id: string;
  user_id?: string | null;
  company_name: string;
  industry?: string | null;
  onboarding_profile?: unknown;
  onboarding_completed_at?: string | null;
};
type Agent = {
  id: string;
  company_id: string;
  name: string;
  goal: string;
  status: string;
  guardrails: unknown;
  performance?: unknown;
};

async function main() {
  const companies = await rest<Company[]>('companies?select=*');
  const agents = await rest<Agent[]>('agents?select=*');
  console.log(`cloud companies=${companies.length} agents=${agents.length}`);

  for (const c of companies) {
    await prisma.company.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        userId: c.user_id ?? undefined,
        companyName: c.company_name,
        industry: c.industry ?? undefined,
        onboardingProfile: (c.onboarding_profile as object) ?? undefined,
        onboardingCompletedAt: c.onboarding_completed_at
          ? new Date(c.onboarding_completed_at)
          : undefined,
      },
      update: {
        companyName: c.company_name,
        industry: c.industry ?? undefined,
      },
    });
  }

  for (const a of agents) {
    await prisma.agent.upsert({
      where: { id: a.id },
      create: {
        id: a.id,
        companyId: a.company_id,
        name: a.name,
        goal: a.goal,
        status: a.status || 'discovering',
        guardrails: (a.guardrails as object) ?? {},
        performance: (a.performance as object) ?? undefined,
      },
      update: {
        name: a.name,
        goal: a.goal,
        status: a.status,
        guardrails: (a.guardrails as object) ?? {},
      },
    });
  }

  if ((await prisma.company.count()) === 0) {
    await prisma.company.create({
      data: { companyName: 'Local Demo', industry: 'D2C Brand' },
    });
  }

  if ((await prisma.agent.count()) === 0) {
    const company = await prisma.company.findFirstOrThrow();
    await prisma.agent.create({
      data: {
        companyId: company.id,
        name: 'Repeat Purchase Agent',
        goal: 'Increase repeat purchases',
        status: 'running',
        guardrails: { max_budget: 50000, frequency_cap: 3, channels: ['whatsapp', 'email'] },
      },
    });
  }

  console.log(
    JSON.stringify({
      localCompanies: await prisma.company.count(),
      localAgents: await prisma.agent.count(),
    }),
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
