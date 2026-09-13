import { prisma } from '../src/lib/prisma';
import { runShadowObserve } from '../src/services/agent-shadow';

async function main() {
  const agent = process.env.AGENT_ID
    ? await prisma.agent.findUniqueOrThrow({ where: { id: process.env.AGENT_ID } })
    : await prisma.agent.findFirstOrThrow();
  const out = await runShadowObserve({
    companyId: agent.companyId,
    agentId: agent.id,
    goal: agent.goal,
    guardrails: agent.guardrails as { max_budget?: number; channels?: string[] },
  });
  console.log(JSON.stringify(out));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
