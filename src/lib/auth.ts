import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import { isConfigured } from './env';
import { AppError, dbError } from './errors';
import { sessionExpired } from './session';
import type { Member } from './types';
export const currentUser = cache(async () => {
  if (!isConfigured()) throw new AppError('SETUP_REQUIRED', 'Ứng dụng chưa được cấu hình.', 503);
  const db = await createClient();
  const { data, error } = await db.auth.getClaims();
  if (error || !data?.claims?.sub)
    throw new AppError('UNAUTHENTICATED', 'Vui lòng đăng nhập.', 401);
  const [{ data: member, error: memberError }, { data: session, error: sessionError }] =
    await Promise.all([
      db.from('members').select('*').eq('user_id', data.claims.sub).maybeSingle(),
      db.rpc('session_info'),
    ]);
  dbError(memberError);
  dbError(sessionError);
  if (!member || member.status !== 'active' || !session || sessionExpired(session.expires_at))
    throw new AppError(
      'UNAUTHENTICATED',
      'Phiên đã hết hạn hoặc tài khoản không còn quyền truy cập.',
      401,
    );
  return {
    db,
    member: member as Member,
    sessionId: session.session_id as string,
    expiresAt: session.expires_at as string,
  };
});
export async function pageUser() {
  if (!isConfigured()) redirect('/setup');
  try {
    return await currentUser();
  } catch (e) {
    if (e instanceof AppError && e.status === 401) redirect('/login?expired=1');
    throw e;
  }
}
export async function ownerUser() {
  const ctx = await currentUser();
  if (ctx.member.role !== 'owner')
    throw new AppError('FORBIDDEN', 'Chỉ chủ doanh nghiệp được quản trị mục này.', 403);
  return ctx;
}
