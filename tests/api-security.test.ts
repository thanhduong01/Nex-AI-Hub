import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@/lib/supabase/server';
import { SESSION_SECONDS } from '@/lib/session';

const jar = vi.hoisted(() => ({
  entries: new Map<string, string>(),
  writes: [] as {
    name: string;
    value: string;
    options: {
      maxAge?: number;
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: string;
      path?: string;
    };
  }[],
}));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    getAll: () => [...jar.entries].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string, options: (typeof jar.writes)[number]['options']) => {
      jar.writes.push({ name, value, options });
      if (options.maxAge === 0) jar.entries.delete(name);
      else jar.entries.set(name, value);
    },
  }),
}));

beforeEach(() => {
  jar.entries.clear();
  jar.writes = [];
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://fixture.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'fixture-publishable-key');
  vi.stubEnv('NODE_ENV', 'production');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Real Supabase SSR cookie adapter', () => {
  it('overrides the SDK 400-day cookie with seven days and preserves secure deletion on logout', async () => {
    const token = [
      'eyJhbGciOiJIUzI1NiJ9',
      Buffer.from(
        JSON.stringify({
          sub: '00000000-0000-4000-8000-000000000012',
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString('base64url'),
      'fixture-signature',
    ].join('.');
    const user = {
      id: '00000000-0000-4000-8000-000000000012',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'fixture@example.invalid',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    };
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === 'https://fixture.supabase.co/auth/v1/token?grant_type=password')
        return Response.json({
          access_token: token,
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'synthetic-refresh-token',
          user,
        });
      if (url.startsWith('https://fixture.supabase.co/auth/v1/logout'))
        return new Response(null, { status: 204 });
      throw new Error(`Unexpected network call in isolated test: ${url}`);
    });
    vi.stubGlobal('fetch', fetch);
    const client = await createClient();
    const signedIn = await client.auth.signInWithPassword({
      email: 'fixture@example.invalid',
      password: 'synthetic password only',
    });
    expect(signedIn.error).toBeNull();
    const sessionCookies = jar.writes.filter((w) => w.name.startsWith('sb-') && w.value);
    expect(sessionCookies.length).toBeGreaterThan(0);
    for (const cookie of sessionCookies)
      expect(cookie.options).toMatchObject({
        maxAge: SESSION_SECONDS,
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
      });
    expect(SESSION_SECONDS).toBe(604800);
    jar.writes = [];
    const signedOut = await client.auth.signOut({ scope: 'local' });
    expect(signedOut.error).toBeNull();
    const removed = jar.writes.filter((w) => w.name.startsWith('sb-') && w.value === '');
    expect(removed.length).toBeGreaterThan(0);
    for (const cookie of removed)
      expect(cookie.options).toMatchObject({ maxAge: 0, httpOnly: true, secure: true });
    expect(jar.entries.size).toBe(0);
  });
});
