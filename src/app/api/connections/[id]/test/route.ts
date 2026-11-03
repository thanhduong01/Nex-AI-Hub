import { ownerUser } from '@/lib/auth';
import { uuid } from '@/lib/schemas';
import { connectionKey } from '@/lib/ai/provider';
import { checkOrigin, json, failure, rateLimit } from '@/lib/http';
import { AppError, dbError } from '@/lib/errors';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const { db, member } = await ownerUser();
    await rateLimit(`connection-test:${member.user_id}`, 10);
    const id = uuid.parse((await params).id),
      { data: c, error } = await db
        .from('connections')
        .select('id,provider')
        .eq('id', id)
        .maybeSingle();
    dbError(error);
    if (!c) throw new AppError('NOT_FOUND', 'Không tìm thấy kết nối.', 404);
    const key = await connectionKey(id);
    const endpoints = {
      openai: 'https://api.openai.com/v1/models',
      anthropic: 'https://api.anthropic.com/v1/models',
      google: 'https://generativelanguage.googleapis.com/v1beta/models',
    };
    const headers: Record<string, string> =
      c.provider === 'openai'
        ? { Authorization: `Bearer ${key}` }
        : c.provider === 'anthropic'
          ? { 'x-api-key': key, 'anthropic-version': '2023-06-01' }
          : { 'x-goog-api-key': key };
    const res = await fetch(endpoints[c.provider as keyof typeof endpoints], {
      headers,
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
      redirect: 'error',
    });
    if (!res.ok)
      throw new AppError(
        'CONNECTION_FAILED',
        `Nhà cung cấp từ chối kiểm tra (HTTP ${res.status}). Kiểm tra API key và quyền truy cập.`,
        502,
      );
    await res.body?.cancel();
    return json({
      ok: true,
      message:
        'Khóa truy cập được API danh sách model chấp nhận. Chưa thực hiện lượt chat tính phí hoặc kiểm tra hạn mức billing.',
    });
  } catch (e) {
    return failure(e);
  }
}
