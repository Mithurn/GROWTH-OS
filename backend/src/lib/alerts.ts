import { logger } from './logger';

export type AlertSeverity = 'warning' | 'critical';

export interface Alert {
  /** Alerts sharing a key are sent at most once per cooldown, so an outage is one message, not hundreds. */
  key: string;
  severity: AlertSeverity;
  title: string;
  detail?: string;
}

const COOLDOWN_MS = Number(process.env.ALERT_COOLDOWN_MS) || 60 * 60 * 1000;
const SEND_TIMEOUT_MS = 5_000;
const lastSent = new Map<string, number>();

/**
 * Posts to `ALERT_WEBHOOK_URL`, which can be a Slack or Discord incoming webhook (the body
 * carries both `text` and `content`). Unset means alerts are logged only, so local and CI
 * stay quiet. Never throws: an alerting failure must not take a request down with it.
 */
export async function sendAlert(alert: Alert): Promise<void> {
  const now = Date.now();
  const previous = lastSent.get(alert.key);
  if (previous !== undefined && now - previous < COOLDOWN_MS) return;
  lastSent.set(alert.key, now);

  logger.warn({ alert }, 'Alert raised');

  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;

  const icon = alert.severity === 'critical' ? '🚨' : '⚠️';
  const service = process.env.ALERT_SERVICE_NAME ?? 'growthos-backend';
  const message = `${icon} [${service}] ${alert.title}${alert.detail ? `\n${alert.detail}` : ''}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message, content: message }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!res.ok) logger.warn({ status: res.status }, 'Alert webhook rejected the message');
  } catch (err) {
    logger.warn({ err }, 'Alert webhook unreachable');
  }
}

/** Test seam: forget cooldowns. */
export function resetAlertCooldowns(): void {
  lastSent.clear();
}
