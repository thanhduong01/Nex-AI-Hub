import 'server-only';
import { adminClient } from '../supabase/admin';
import { decryptSecret } from '../crypto';
import { AppError, dbError } from '../errors';
import type { Connection } from '../types';
export async function connectionKey(connectionId: string) {
  const { data, error } = await adminClient().rpc('get_connection_secret', {
    p_connection: connectionId,
  });
  dbError(error);
  if (!data) throw new AppError('CONNECTION_UNAVAILABLE', 'Chưa có API key cho kết nối.', 409);
  return decryptSecret(data, connectionId);
}
export async function languageModel(connection: Connection, apiKey: string) {
  switch (connection.provider) {
    case 'openai':
      return (await import('@ai-sdk/openai')).createOpenAI({ apiKey }).chat(connection.model);
    case 'anthropic':
      return (await import('@ai-sdk/anthropic')).createAnthropic({ apiKey })(connection.model);
    case 'google':
      return (await import('@ai-sdk/google')).createGoogle({ apiKey })(connection.model);
  }
}
export function providerErrorCode(error: unknown) {
  const status =
    error && typeof error === 'object' && 'statusCode' in error ? error.statusCode : null;
  if (status === 429)
    return {
      code: 'PROVIDER_LIMIT',
      message: 'Nhà cung cấp đang giới hạn tốc độ hoặc quota. Kiểm tra kết nối và thử lại sau.',
    };
  if (status === 401 || status === 403)
    return {
      code: 'PROVIDER_AUTH',
      message: 'Khóa hoặc quyền truy cập AI không hợp lệ. Liên hệ chủ doanh nghiệp.',
    };
  if (status === 400 || status === 404)
    return {
      code: 'PROVIDER_REQUEST',
      message: 'Model hoặc độ dài ngữ cảnh chưa được nhà cung cấp chấp nhận. Kiểm tra cấu hình.',
    };
  return {
    code: 'PROVIDER_ERROR',
    message:
      'Phản hồi AI bị gián đoạn. Câu hỏi và phần trả lời đã nhận được giữ lại; chi phí chưa rõ sẽ chờ đối soát.',
  };
}
