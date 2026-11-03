import 'server-only';
import { AppError } from '../errors';
import type { Provider } from '../types';

// Read model metadata only: no prompt, generation charge, redirects or automatic retry.
export async function verifyConnection(provider: Provider, model: string, apiKey: string) {
  const origins = {
    openai: 'https://api.openai.com/v1/models/',
    anthropic: 'https://api.anthropic.com/v1/models/',
    google: 'https://generativelanguage.googleapis.com/v1beta/models/',
  };
  const headers: Record<string, string> =
    provider === 'openai'
      ? { Authorization: `Bearer ${apiKey}` }
      : provider === 'anthropic'
        ? { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
        : { 'x-goog-api-key': apiKey };
  let response: Response;
  try {
    const modelId = provider === 'google' ? model.replace(/^models\//, '') : model;
    response = await fetch(origins[provider] + encodeURIComponent(modelId), {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
      redirect: 'error',
    });
    await response.body?.cancel();
  } catch {
    throw new AppError(
      'CONNECTION_UNAVAILABLE',
      'Chưa liên hệ được nhà cung cấp. Kiểm tra kết nối và thử lại.',
      502,
    );
  }
  if (response.status === 401 || response.status === 403)
    throw new AppError(
      'CONNECTION_KEY',
      'API key chưa hợp lệ hoặc chưa có quyền đọc model. Kiểm tra khóa và quyền truy cập.',
      400,
    );
  if (response.status === 404)
    throw new AppError(
      'CONNECTION_MODEL',
      'Model không tồn tại hoặc tài khoản chưa được cấp quyền. Chọn model khác trong Tùy chọn nâng cao.',
      400,
    );
  if (response.status === 429)
    throw new AppError(
      'CONNECTION_LIMIT',
      'Nhà cung cấp đang giới hạn yêu cầu. Vui lòng thử lại sau.',
      429,
    );
  if (!response.ok)
    throw new AppError(
      'CONNECTION_UNAVAILABLE',
      'Nhà cung cấp chưa xác nhận được kết nối. Vui lòng thử lại sau.',
      502,
    );
}
