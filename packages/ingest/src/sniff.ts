import { createHash } from 'crypto';
import type { MappingSpec } from '@growthos/contracts';

const CUSTOMER_TARGETS: Record<string, string[]> = {
  external_customer_id: ['customer_id', 'id', 'external_id', 'user_id', 'customerid'],
  first_name: ['first_name', 'firstname', 'first', 'given_name'],
  last_name: ['last_name', 'lastname', 'last', 'surname', 'family_name'],
  email: ['email', 'email_address', 'e-mail'],
  phone: ['phone', 'phone_number', 'mobile', 'whatsapp'],
  city: ['city', 'town'],
  state: ['state', 'province', 'region'],
  signup_date: ['signup_date', 'created_at', 'signed_up', 'registered_at'],
};

const ORDER_TARGETS: Record<string, string[]> = {
  external_order_id: ['order_id', 'id', 'order_number'],
  customer_id: ['customer_id', 'user_id', 'email'],
  product_sku: ['product_sku', 'sku', 'product_id'],
  amount: ['amount', 'total', 'order_total', 'price'],
  quantity: ['quantity', 'qty'],
  order_date: ['order_date', 'created_at', 'purchased_at'],
};

export interface CsvProfile {
  delimiter: ',' | ';' | '\t';
  headers: string[];
  fingerprint: string;
  sampleRows: string[][];
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function detectDelimiter(headerLine: string): CsvProfile['delimiter'] {
  const counts: Array<readonly [CsvProfile['delimiter'], number]> = [
    [',', (headerLine.match(/,/g) ?? []).length],
    [';', (headerLine.match(/;/g) ?? []).length],
    ['\t', (headerLine.match(/\t/g) ?? []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ',';
}

function splitLine(line: string, delimiter: string): string[] {
  return line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ''));
}

export function fingerprintHeaders(headers: string[]): string {
  const normalized = headers.map((h) => h.trim().toLowerCase()).sort();
  return createHash('sha256').update(normalized.join('|')).digest('hex').slice(0, 16);
}

/**
 * Header + delimiter sniffer. Pure JS on purpose — DuckDB is the later
 * statistical profiler, not a Render install we add casually.
 */
export function sniffCsv(text: string, sampleLimit = 5): CsvProfile {
  const lines = stripBom(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const headerLine = lines[0] ?? '';
  const delimiter = detectDelimiter(headerLine);
  const headers = splitLine(headerLine, delimiter);
  const sampleRows = lines.slice(1, sampleLimit + 1).map((line) => splitLine(line, delimiter));
  return {
    delimiter,
    headers,
    fingerprint: fingerprintHeaders(headers),
    sampleRows,
  };
}

function scoreHeader(header: string, aliases: string[]): number {
  const h = header.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (aliases.includes(h)) return 0.96;
  if (aliases.some((a) => h.includes(a) || a.includes(h))) return 0.72;
  return 0;
}

function proposeFor(
  entity: MappingSpec['entity'],
  headers: string[],
  targets: Record<string, string[]>,
): MappingSpec {
  const used = new Set<string>();
  const columns: MappingSpec['columns'] = [];
  for (const [target, aliases] of Object.entries(targets)) {
    let best: { header: string; score: number } | undefined;
    for (const header of headers) {
      if (used.has(header)) continue;
      const score = scoreHeader(header, aliases);
      if (score > 0 && (!best || score > best.score)) best = { header, score };
    }
    if (best) {
      used.add(best.header);
      columns.push({
        entity,
        source_column: best.header,
        target_field: target,
        transform: target === 'email' ? 'email' : target === 'phone' ? 'phone' : 'identity',
        confidence: best.score,
        reasoning: `Header matched ${target} aliases.`,
      });
    }
  }
  return {
    version: 1,
    fingerprint: fingerprintHeaders(headers),
    entity,
    columns,
    unmapped: headers.filter((h) => !used.has(h)),
  };
}

export function proposeMapping(headers: string[]): MappingSpec {
  const customer = proposeFor('customer', headers, CUSTOMER_TARGETS);
  const order = proposeFor('order', headers, ORDER_TARGETS);
  return customer.columns.length >= order.columns.length ? customer : order;
}
