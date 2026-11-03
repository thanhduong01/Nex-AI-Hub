import 'server-only';
import { AppError } from './errors';
export function isConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.CREDENTIAL_ENCRYPTION_KEY,
  );
}
export function publicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new AppError('SETUP_REQUIRED', 'Ứng dụng chưa được kết nối Supabase.', 503);
  return { url, key };
}
export function appOrigin() {
  const url = process.env.APP_URL;
  if (!url) throw new AppError('SETUP_REQUIRED', 'Cần cấu hình APP_URL.', 503);
  return new URL(url).origin;
}
