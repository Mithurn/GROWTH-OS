import { NextResponse } from 'next/server';

// Called by Vercel cron every 9 minutes to prevent Render backend cold starts
export async function GET() {
  const results = await Promise.allSettled([
    fetch('https://xeno-crm-backend-n6d8.onrender.com/health'),
    fetch('https://xeno-channel-service-0dpu.onrender.com/health'),
  ]);

  const [backend, channel] = results.map(r =>
    r.status === 'fulfilled' && r.value.ok ? 'ok' : 'unreachable'
  );

  return NextResponse.json({ backend, channel, ts: new Date().toISOString() });
}
