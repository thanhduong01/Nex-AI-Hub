import Link from 'next/link';
import { Mark, Notice } from '@/components/ui';
import { AuthForm } from '@/components/auth-form';
import { isConfigured } from '@/lib/env';
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  return (
    <main id="main" className="login-page">
      <section className="login-art">
        <div className="brand">
          <Mark />
          nex ai hub
        </div>
        <div>
          <div className="eyebrow">MỌI AI. MỘT KHÔNG GIAN.</div>
          <h1>
            Một không gian.
            <br />
            Mọi ý tưởng.
          </h1>
          <p>
            Gắn kết hội thoại, kiến thức và công việc của đội ngũ — từ ý tưởng đầu tiên đến quyết
            định tiếp theo.
          </p>
          <div className="login-ai-row">
            <span>OpenAI</span>
            <span>Claude</span>
            <span>Gemini</span>
          </div>
        </div>
        <span className="small">Dành cho đội ngũ của bạn.</span>
      </section>
      <section className="login-form">
        <div>
          <h2>Chào mừng trở lại.</h2>
          <p className="muted mt12 mb24">Đăng nhập vào không gian làm việc của bạn.</p>
          {!isConfigured() ? (
            <Notice>
              Ứng dụng chưa kết nối Supabase.{' '}
              <Link href="/setup" className="text-link">
                Xem các bước cấu hình
              </Link>
            </Notice>
          ) : null}
          {query.expired ? (
            <Notice>Phiên đã hết hạn hoặc quyền truy cập thay đổi. Vui lòng đăng nhập lại.</Notice>
          ) : null}
          {query.error ? (
            <Notice tone="amber">Liên kết hết hạn hoặc không hợp lệ. Yêu cầu liên kết mới.</Notice>
          ) : null}
          {query.password ? <Notice>Đã đổi mật khẩu. Đăng nhập để tiếp tục.</Notice> : null}
          <AuthForm />
        </div>
      </section>
    </main>
  );
}
