import { NextResponse } from 'next/server';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') ??
  'https://xeno-crm-backend-n6d8.onrender.com';

// Hit by an external cron (cron-job.org) every 10 minutes. Render free services spin
// down after 15 minutes without inbound traffic and take ~1 minute to wake, so this is
// what keeps a cold visitor from waiting on a spin-up. /health/ready also touches
// Postgres, which keeps Supabase from auto-pausing the project.
//
// Deliberately pings the backend only. Render's 750 free instance-hours are shared
// across the workspace, and 24/7 for one service is already ~730h — keeping the channel
// service warm too would exhaust the allowance and suspend everything. The channel
// service wakes on demand at campaign launch instead.
export async function GET() {
  const startedAt = Date.now();

  try {
    const res = await fetch(`${BACKEND_URL}/health/ready`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(90_000), // a cold start can take ~60s
    });

    return NextResponse.json({
      backend: res.ok ? 'ok' : 'degraded',
      status: res.status,
      latencyMs: Date.now() - startedAt,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        backend: 'unreachable',
        error: err instanceof Error ? err.message : 'unknown',
        latencyMs: Date.now() - startedAt,
        ts: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
