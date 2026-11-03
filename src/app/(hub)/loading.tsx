export default function Loading() {
  return (
    <div role="status" aria-label="Đang tải nội dung">
      <div className="skeleton" style={{ height: 32, width: '40%' }} />
      <div className="project-grid mt24">
        {[1, 2, 3].map((i) => (
          <div key={i} className="panel skeleton-card">
            <div className="skeleton" />
            <div className="skeleton" />
          </div>
        ))}
      </div>
    </div>
  );
}
