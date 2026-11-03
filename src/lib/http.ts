import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { appOrigin } from './env';
import { AppError, dbError, publicError } from './errors';
import { adminClient } from './supabase/admin';
export function checkOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== appOrigin())
    throw new AppError('CSRF', 'Nguồn yêu cầu không hợp lệ. Mở lại đúng địa chỉ ứng dụng.', 403);
}
export async function readJson<T>(
  request: Request,
  schema: z.ZodType<T>,
  maxBytes = 1000000,
): Promise<T> {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > maxBytes) throw new AppError('TOO_LARGE', 'Dữ liệu gửi lên quá lớn.', 413);
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new AppError('BAD_REQUEST', 'Cần dữ liệu JSON.', 415);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError('BAD_REQUEST', 'Thiếu dữ liệu.', 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new AppError('TOO_LARGE', 'Dữ liệu gửi lên quá lớn.', 413);
    }
    chunks.push(value);
  }
  let body: unknown;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new AppError('BAD_REQUEST', 'JSON không hợp lệ.', 400);
  }
  return schema.parse(body);
}
export async function rateLimit(key: string, limit = 60, window = 60) {
  const hash = createHash('sha256').update(key).digest('hex');
  const { data, error } = await adminClient().rpc('consume_rate_limit', {
    p_key: hash,
    p_limit: limit,
    p_window: window,
  });
  dbError(error);
  if (!data) throw new AppError('RATE_LIMIT', 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.', 429);
}
export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
export function failure(error: unknown) {
  const e = publicError(error);
  return json({ error: e.code, message: e.message }, e.status);
}
