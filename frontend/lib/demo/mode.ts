/**
 * Demo mode: the whole app runs on bundled sample data, with no backend and no sign-in.
 *
 * The flag is a cookie rather than sessionStorage because `proxy.ts` runs on the server
 * and has to know to skip the Supabase redirect. Nothing sensitive lives in it.
 */
const DEMO_COOKIE = 'growthos-demo';

export function isDemo(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').some((c) => c === `${DEMO_COOKIE}=1`);
}

export function enterDemo(): void {
  document.cookie = `${DEMO_COOKIE}=1; path=/; max-age=86400; SameSite=Lax`;
  // A full navigation, so the server-side proxy sees the cookie on the very next request.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = '/dashboard';
}

export function exitDemo(): void {
  document.cookie = `${DEMO_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = '/';
}

export const DEMO_COOKIE_NAME = DEMO_COOKIE;
