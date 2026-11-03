import { AuthForm } from '@/components/auth-form';
import { Mark } from '@/components/ui';
export default function Forgot() {
  return (
    <main id="main" className="auth-single">
      <div className="brand">
        <Mark />
        nex ai hub
      </div>
      <h1>Khôi phục truy cập</h1>
      <p className="muted mb24">Nhập email công việc để nhận hướng dẫn đặt lại mật khẩu.</p>
      <AuthForm mode="forgot" />
    </main>
  );
}
