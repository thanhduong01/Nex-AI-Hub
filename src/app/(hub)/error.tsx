'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="panel empty">
      <h1>Chưa tải được nội dung</h1>
      <p>
        Kết nối có thể bị gián đoạn hoặc quyền truy cập đã thay đổi. Dữ liệu đã lưu được giữ nguyên.
      </p>
      <button className="btn primary" onClick={reset}>
        Thử lại
      </button>
      <a href="/overview" className="btn">
        Về tổng quan
      </a>
    </div>
  );
}
