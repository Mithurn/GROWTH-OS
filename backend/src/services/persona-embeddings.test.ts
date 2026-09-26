import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../lib/prisma';
import * as embeddings from '../lib/embeddings';
import { embedPersona, searchSimilarPersonas } from './persona-embeddings';

vi.mock('../lib/embeddings', () => ({
  embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  toVectorLiteral: (v: number[]) => `[${v.join(',')}]`,
}));

describe('embedPersona', () => {
  beforeEach(() => vi.clearAllMocks());

  it('embeds the persona name, description, and current matched customer count', async () => {
    vi.mocked(prisma.persona.count).mockResolvedValue(42);

    await embedPersona('co_1', 'VIP Loyalists', 'High spenders who order frequently');

    expect(embeddings.embed).toHaveBeenCalledWith(
      expect.stringContaining('Persona: VIP Loyalists'),
    );
    expect(embeddings.embed).toHaveBeenCalledWith(expect.stringContaining('matches 42 customers'));
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });
});

describe('searchSimilarPersonas', () => {
  beforeEach(() => vi.clearAllMocks());

  it('scopes the query to the given company and returns fused, ranked results', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { persona_name: 'VIP Loyalists', content: 'High spenders', score: 0.033 },
    ]);

    const results = await searchSimilarPersonas('co_1', 'high value repeat customers', 1);

    expect(results).toEqual([{ personaName: 'VIP Loyalists', content: 'High spenders', score: 0.033 }]);
  });

  it('returns an empty array, not an error, when there is no embedded persona history', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);
    const results = await searchSimilarPersonas('co_1', 'anything', 3);
    expect(results).toEqual([]);
  });
});
