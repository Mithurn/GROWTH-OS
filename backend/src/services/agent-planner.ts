import { z } from 'zod';
import { openai, openRouterConfig } from '../config/openrouter';
import { SHADOW_SYSTEM_PROMPT, type Planner } from '@growthos/agent-core';
import { catalogFor } from '@growthos/agent-core';
import { assertPlatformBudget, estimateOpenRouterCost, recordCost } from './cost-ledger';

function toOpenAiTools(mode: 'shadow' | 'live' = 'shadow') {
  return catalogFor(mode).map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: z.toJSONSchema(t.inputSchema) as Record<string, unknown>,
    },
  }));
}

export interface PlannerDeps {
  complete?: typeof openai.chat.completions.create;
  budget?: typeof assertPlatformBudget;
  charge?: typeof recordCost;
  source?: 'platform' | 'byok';
}

/**
 * Production planner. Owns the prompt (DESIGN.md / 12-factor §2).
 * Tests use scriptedPlanner instead — this file talks to OpenRouter.
 * A model call is refused when the platform monthly cap is explicitly set
 * and exhausted. Usage is recorded fail-soft onto cost_ledger.
 */
export function openRouterPlanner(deps: PlannerDeps = {}): Planner {
  const complete = deps.complete ?? openai.chat.completions.create.bind(openai.chat.completions);
  const budget = deps.budget ?? assertPlatformBudget;
  const charge = deps.charge ?? recordCost;
  const source = deps.source ?? 'platform';

  return {
    async plan({ goal, steps, tools, companyId, runId }) {
      if (companyId) {
        const gate = await budget(companyId, source);
        if (!gate.allowed) {
          return {
            type: 'finish',
            summary: gate.reason ?? 'Platform budget exhausted.',
          };
        }
      }

      const trace = steps
        .map((s, i) => {
          if (s.error) return `${i + 1}. ${s.tool ?? s.node} ERROR: ${s.error}`;
          if (s.tool) return `${i + 1}. ${s.tool} → ${JSON.stringify(s.result).slice(0, 400)}`;
          return `${i + 1}. ${s.node}`;
        })
        .join('\n');

      const completion = await complete({
        model: openRouterConfig.defaultModel,
        temperature: 0.2,
        messages: [
          { role: 'system', content: SHADOW_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              `Goal: ${goal}`,
              `Available tools: ${tools.map((t) => t.name).join(', ')}`,
              trace ? `Trace so far:\n${trace}` : 'No steps yet. Start with growthos_query_metrics.',
            ].join('\n\n'),
          },
        ],
        tools: toOpenAiTools('shadow'),
        tool_choice: 'auto',
      });

      if (companyId) {
        const tokensIn = completion.usage?.prompt_tokens ?? 0;
        const tokensOut = completion.usage?.completion_tokens ?? 0;
        await charge({
          companyId,
          runId,
          provider: 'openrouter',
          model: openRouterConfig.defaultModel,
          tokensIn,
          tokensOut,
          estimatedCost: await estimateOpenRouterCost(companyId, tokensIn, tokensOut),
          source,
        });
      }

      const msg = completion.choices[0]?.message;
      const toolCalls = msg?.tool_calls ?? [];
      if (toolCalls.length === 0) return { type: 'idle' };

      const mapped = toolCalls.map((c) => {
        const name = 'function' in c ? c.function.name : '';
        let args: unknown;
        try {
          args = JSON.parse(('function' in c ? c.function.arguments : '') || '{}');
        } catch {
          args = {};
        }
        return { name, args };
      });

      const fin = mapped.find((c) => c.name === 'growthos_finish');
      if (fin) {
        const summary = (fin.args as { summary?: string })?.summary ?? msg?.content ?? '';
        return { type: 'finish', summary: summary || 'Finished.' };
      }

      return { type: 'calls', calls: mapped };
    },
  };
}
