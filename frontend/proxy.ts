import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/auth/callback', '/api/keep-alive', '/privacy', '/terms'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always let public paths through
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // "/" is the public landing page, so it can't short-circuit here — a signed-in
  // visitor should still be forwarded to their dashboard. Handled after auth resolves.
  const isLanding = pathname === '/';

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(toSet: { name: string; value: string; options?: object }[]) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const onboardingDone = user?.user_metadata?.onboarding_complete === true;

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    return NextResponse.redirect(url);
  };

  if (isLanding) {
    if (!user) return response;                     // anonymous visitor → landing page
    return redirectTo(onboardingDone ? '/dashboard' : '/onboarding');
  }

  if (!user) return redirectTo('/login');

  // New user hasn't finished onboarding — send them there
  if (!onboardingDone && !pathname.startsWith('/onboarding')) {
    return redirectTo('/onboarding');
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
