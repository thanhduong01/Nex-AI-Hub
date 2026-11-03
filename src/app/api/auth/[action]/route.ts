import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { adminClient } from '@/lib/supabase/admin';
import { checkOrigin, readJson, rateLimit, json, failure } from '@/lib/http';
import { loginSchema, email, password, uuid } from '@/lib/schemas';
import { AppError, dbError } from '@/lib/errors';
import { currentUser } from '@/lib/auth';
import { appOrigin, isConfigured } from '@/lib/env';
export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  try {
    checkOrigin(request);
    if (!isConfigured())
      throw new AppError('SETUP_REQUIRED', 'Ứng dụng chưa được kết nối Supabase.', 503);
    const { action } = await params,
      db = await createClient();
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    if (action === 'login') {
      const data = await readJson(request, loginSchema, 10000);
      await rateLimit(`login-ip:${ip}`, 30, 900);
      await rateLimit(`login-email:${data.email.toLowerCase()}`, 10, 900);
      const result = await db.auth.signInWithPassword(data);
      if (result.error || !result.data.session)
        throw new AppError(
          'LOGIN_FAILED',
          'Email hoặc mật khẩu không đúng, hoặc tài khoản chưa được kích hoạt.',
          401,
        );
      const claims = await db.auth.getClaims();
      const sid = uuid.parse(claims.data?.claims.session_id);
      const { error } = await adminClient().rpc('register_hub_session', {
        p_user: result.data.user.id,
        p_session: sid,
      });
      if (error) {
        await db.auth.signOut({ scope: 'local' });
        throw new AppError('LOGIN_FAILED', 'Tài khoản chưa được cấp quyền hoặc đang bị khóa.', 403);
      }
      return json({ ok: true });
    }
    if (action === 'logout') {
      const revoked = await db.rpc('revoke_session');
      dbError(revoked.error);
      await db.auth.signOut({ scope: 'local' });
      return json({ ok: true });
    }
    if (action === 'forgot') {
      const data = await readJson(request, z.object({ email }), 10000);
      await rateLimit(`reset:${ip}`, 5, 900);
      await rateLimit(`reset-email:${data.email.toLowerCase()}`, 3, 900);
      await db.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${appOrigin()}/auth/callback?next=/reset-password`,
      });
      return json({
        ok: true,
        message: 'Nếu email hợp lệ, hướng dẫn khôi phục sẽ được gửi tới hộp thư của bạn.',
      });
    }
    if (action === 'password') {
      await currentUser();
      const data = await readJson(request, z.object({ password }), 10000);
      const result = await db.auth.updateUser({ password: data.password });
      if (result.error)
        throw new AppError(
          'PASSWORD_FAILED',
          'Không thể đổi mật khẩu. Hãy dùng liên kết khôi phục mới.',
          400,
        );
      dbError((await db.rpc('revoke_all_sessions')).error);
      await db.auth.signOut({ scope: 'global' });
      return json({ ok: true });
    }
    throw new AppError('NOT_FOUND', 'Không tìm thấy thao tác.', 404);
  } catch (e) {
    return failure(e);
  }
}
