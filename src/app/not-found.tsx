import Link from 'next/link';
export default function NotFound() {
  return (
    <main id="main" className="panel empty">
      <h1>Không tìm thấy nội dung</h1>
      <p>Nội dung không tồn tại hoặc chưa được chia sẻ với bạn.</p>
      <Link className="btn primary" href="/overview">
        Về tổng quan
      </Link>
    </main>
  );
}
