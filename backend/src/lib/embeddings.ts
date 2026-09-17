import { logger } from './logger';

/**
 * In-process embeddings (Xenova/all-MiniLM-L6-v2, 384 dims — matches
 * `campaign_embeddings.embedding vector(384)` exactly). Runs entirely
 * on-machine via ONNX Runtime, no external API, no extra host — the same
 * "in-process over a dataplane" call ARCHITECTURE_V2.md made for DuckDB's
 * CSV profiler, extended here. The originally planned Supabase Edge
 * Function would have been a second, network-hop-away embedding path for
 * no real benefit once this proved out.
 *
 * Lazily loaded: the ~90MB model downloads (and is cached on disk) on first
 * real use, not at process boot — nothing pays that cost unless
 * search_prior_campaigns or the backfill script actually runs.
 *
 * `@huggingface/transformers` is deliberately excluded from the esbuild
 * bundle (see package.json's build script's --external flag) — bundling it
 * hits a known esbuild/ESM interop failure (`createRequire(import.meta.url)`
 * resolving to `undefined` once bundled to CJS). Resolved at runtime from
 * the real `node_modules`, same as `pg`/`bullmq`/`ioredis`.
 */

type Embedder = (text: string) => Promise<number[]>;

let cached: Promise<Embedder> | null = null;

async function loadEmbedder(): Promise<Embedder> {
  const { pipeline } = await import('@huggingface/transformers');
  const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  return async (text: string) => {
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data as Float32Array);
  };
}

export async function embed(text: string): Promise<number[]> {
  if (!cached) {
    logger.info('Loading embedding model (first use this process — cached after)');
    cached = loadEmbedder();
  }
  const embedder = await cached;
  return embedder(text);
}

/** Test-only: force a fresh (or injected) embedder on the next call. */
export function setEmbedderForTests(embedder: Embedder | null): void {
  cached = embedder ? Promise.resolve(embedder) : null;
}

/** `vector(384)` literal syntax pgvector accepts inline in a raw query: `[0.1,0.2,...]`. */
export function toVectorLiteral(values: number[]): string {
  return `[${values.join(',')}]`;
}
