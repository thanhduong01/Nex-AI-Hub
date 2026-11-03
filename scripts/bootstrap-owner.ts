import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
const env = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    OWNER_EMAIL: z.email(),
    OWNER_PASSWORD: z.string().min(12).max(128),
    OWNER_NAME: z.string().min(1),
    WORKSPACE_NAME: z.string().min(1).default('NexMO Workspace'),
  })
  .parse(process.env);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
async function main() {
  const existing = await db.from('members').select('user_id').eq('role', 'owner').limit(1);
  if (existing.error) throw new Error('Database chưa sẵn sàng. Chạy migrations trước.');
  if (existing.data.length)
    throw new Error('Workspace đã có Owner. Script không thay đổi tài khoản hiện có.');
  // Provision without emailing or publicly exposing a signup endpoint.
  const auth = await db.auth.admin.createUser({
    email: env.OWNER_EMAIL,
    password: env.OWNER_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: env.OWNER_NAME },
  });
  if (auth.error)
    throw new Error(
      'Không tạo được tài khoản Auth. Kiểm tra email trùng hoặc chính sách mật khẩu.',
    );
  const workspace = await db
    .from('workspaces')
    .insert({ name: env.WORKSPACE_NAME, monthly_budget: 0 })
    .select('id')
    .single();
  if (workspace.error)
    throw new Error(
      'Đã tạo Auth user nhưng chưa tạo workspace. Kiểm tra Supabase trước khi chạy lại.',
    );
  const member = await db.from('members').insert({
    user_id: auth.data.user.id,
    workspace_id: workspace.data.id,
    email: env.OWNER_EMAIL.toLowerCase(),
    display_name: env.OWNER_NAME,
    role: 'owner',
    monthly_limit: 0,
  });
  if (member.error)
    throw new Error(
      'Đã tạo Auth user/workspace nhưng chưa cấp Owner. Kiểm tra dữ liệu và hoàn tất membership thủ công.',
    );
  console.log(
    'Đã tạo Owner và workspace. Ngân sách ban đầu $0. Xóa OWNER_PASSWORD khỏi .env.local sau khi hoàn tất.',
  );
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Bootstrap thất bại.');
  process.exitCode = 1;
});
