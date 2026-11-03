import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { adminClient } from '@/lib/supabase/admin';
import { appOrigin } from '@/lib/env';
import { safeNextPath } from '@/lib/session';
import { uuid } from '@/lib/schemas';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = appOrigin();
  try {
    const db = await createClient(),
      code = url.searchParams.get('code'),
      hash = url.searchParams.get('token_hash'),
      type = url.searchParams.get('type');
    const result = code
      ? await db.auth.exchangeCodeForSession(code)
      : hash && (type === 'invite' || type === 'recovery')
        ? await db.auth.verifyOtp({ token_hash: hash, type })
        : null;
    if (!result || result.error || !result.data.user) throw new Error('callback failed');
    const claims = await db.auth.getClaims(),
      sid = uuid.parse(claims.data?.claims.session_id);
    const { error } = await adminClient().rpc('register_hub_session', {
      p_user: result.data.user.id,
      p_session: sid,
    });
    if (error) {
      await db.auth.signOut({ scope: 'local' });
      throw new Error('membership required');
    }
    const next =
      type === 'invite' || type === 'recovery'
        ? '/reset-password'
        : safeNextPath(url.searchParams.get('next'));
    return NextResponse.redirect(new URL(next, origin));
  } catch {
    return NextResponse.redirect(new URL('/login?error=link', origin));
  }
}
