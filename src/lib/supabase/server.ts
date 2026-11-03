import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { publicEnv } from '../env';
import { SESSION_SECONDS } from '../session';
import { authCookieOptions } from '../auth-cookie';
export async function createClient() {
  const jar = await cookies();
  const { url, key } = publicEnv();
  return createServerClient(url, key, {
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_SECONDS,
    },
    cookies: {
      getAll: () => jar.getAll(),
      setAll(items) {
        try {
          items.forEach(({ name, value, options }) =>
            jar.set(name, value, authCookieOptions(options)),
          );
        } catch {
          /* Server Components cannot write; proxy handles refresh. */
        }
      },
    },
  });
}
