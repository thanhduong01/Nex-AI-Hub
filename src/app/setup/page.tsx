import { Mark } from '@/components/ui';
export default function Setup() {
  return (
    <main id="main" className="setup-page">
      <div className="brand">
        <Mark />
        nex ai hub
      </div>
      <span className="eyebrow">CHUẨN BỊ KHÔNG GIAN LÀM VIỆC</span>
      <h1>Kết nối dữ liệu để bắt đầu.</h1>
      <p>
        Giao diện ứng dụng đã sẵn sàng. Cần cấu hình Supabase trước khi đăng nhập và lưu dữ liệu
        thật.
      </p>
      <ol className="setup-steps">
        <li>
          <strong>Tạo project Supabase</strong>
          <span>Chọn vùng gần người dùng và Vercel.</span>
        </li>
        <li>
          <strong>Chạy database migrations</strong>
          <span>Áp dụng các tệp trong supabase/migrations theo thứ tự.</span>
        </li>
        <li>
          <strong>Cấu hình môi trường</strong>
          <span>Điền các biến trong .env.example vào .env.local hoặc Vercel.</span>
        </li>
        <li>
          <strong>Tạo chủ doanh nghiệp</strong>
          <span>Chạy npm run bootstrap theo docs/deployment.md.</span>
        </li>
      </ol>
      <p className="small muted">Trang này không hiển thị khóa hoặc thông tin cấu hình bí mật.</p>
      <a href="/login" className="btn primary">
        Đến đăng nhập
      </a>
    </main>
  );
}
