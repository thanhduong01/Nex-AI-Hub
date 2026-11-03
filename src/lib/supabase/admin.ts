import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { publicEnv } from '../env';
import { AppError } from '../errors';
export function adminClient() {
  const { url } = publicEnv(),
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new AppError('SETUP_REQUIRED', 'Thiếu cấu hình máy chủ Supabase.', 503);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
