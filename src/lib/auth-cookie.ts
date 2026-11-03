import { SESSION_SECONDS } from './session';
// @supabase/ssr supplies its own long-lived default. Enforce the Hub policy at
// the final write boundary while preserving deletion cookies (maxAge = 0).
export function authCookieOptions<T extends { maxAge?: number }>(
  options: T,
  production = process.env.NODE_ENV === 'production',
) {
  return {
    ...options,
    httpOnly: true,
    secure: production,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: options.maxAge === 0 ? 0 : SESSION_SECONDS,
  };
}
