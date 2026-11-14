const LAKH = 100_000;
const THOUSAND = 1_000;
const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

export function formatCurrency(amount: number): string {
  if (amount >= LAKH) return `₹${(amount / LAKH).toFixed(1)}L`;
  if (amount >= THOUSAND) return `₹${(amount / THOUSAND).toFixed(0)}K`;
  return `₹${Math.round(amount)}`;
}

export function timeAgo(date: string | number | Date): string {
  const minutes = Math.floor((Date.now() - new Date(date).getTime()) / MS_PER_MINUTE);
  if (minutes < 1) return 'just now';
  if (minutes < MINUTES_PER_HOUR) return `${minutes}m ago`;
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) return `${hours}h ago`;
  return `${Math.floor(hours / HOURS_PER_DAY)}d ago`;
}
