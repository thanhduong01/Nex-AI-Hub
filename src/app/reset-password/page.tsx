import { AuthForm } from '@/components/auth-form';
import { pageUser } from '@/lib/auth';
export default async function Reset() {
  await pageUser();
  return (
    <main id="main" className="auth-single">
      <h1>Thiết lập mật khẩu</h1>
      <p className="muted mb24">Chọn mật khẩu riêng cho tài khoản Nex AI Hub của bạn.</p>
      <AuthForm mode="password" />
    </main>
  );
}
