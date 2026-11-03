'use client';
import { useState } from 'react';
import Link from 'next/link';
import { parseImport, type ImportPreview } from '@/lib/imports';
import type { Project } from '@/lib/types';
export function ImportWizard({ projects }: { projects: Project[] }) {
  const [preview, setPreview] = useState<ImportPreview | null>(null),
    [selected, setSelected] = useState<number[]>([]),
    [projectId, setProjectId] = useState(projects[0]?.id || ''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<{ imported: number; duplicates: number } | null>(null);
  const step = result ? 3 : preview ? 2 : 1;
  return (
    <>
      <div className="steps">
        {['Chọn nguồn', 'Xem trước & phân loại', 'Kết quả'].map((label, i) => (
          <div
            key={label}
            className={`step ${step === i + 1 ? 'active' : step > i + 1 ? 'done' : ''}`}
          >
            <span className="step-num">{i + 1}</span>
            {label}
            {i < 2 ? <span className="step-line" /> : null}
          </div>
        ))}
      </div>
      {error ? (
        <div className="form-error" role="alert">
          {error}
        </div>
      ) : null}
      {result ? (
        <section className="panel success-panel">
          <h2>Đã nhập dữ liệu</h2>
          <div className="result-metrics">
            <div>
              <strong>{result.imported}</strong>
              <span>Hội thoại mới</span>
            </div>
            <div>
              <strong>{result.duplicates}</strong>
              <span>Bản trùng bỏ qua</span>
            </div>
          </div>
          <div className="row wrap">
            <Link className="btn primary" href={`/projects/${projectId}`}>
              Mở dự án
            </Link>
            <button
              className="btn"
              onClick={() => {
                setPreview(null);
                setResult(null);
                setError('');
              }}
            >
              Nhập tệp khác
            </button>
          </div>
        </section>
      ) : preview ? (
        <section className="panel panel-padding">
          <h2>Kiểm tra trước khi nhập</h2>
          <div className="field mt24">
            <label htmlFor="import-project">Dự án nhận dữ liệu</label>
            <select
              id="import-project"
              className="input"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={busy}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          {preview.warnings.map((w) => (
            <p key={w} className="info-banner amber">
              {w}
            </p>
          ))}
          <div className="table-wrap">
            <table className="data-table compact no-wide">
              <thead>
                <tr>
                  <th>Chọn</th>
                  <th>Hội thoại</th>
                  <th>Số tin nhắn</th>
                  <th>Nguồn</th>
                </tr>
              </thead>
              <tbody>
                {preview.items.map((item, i) => (
                  <tr key={i}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Chọn ${item.title}`}
                        checked={selected.includes(i)}
                        disabled={busy}
                        onChange={(e) =>
                          setSelected((s) =>
                            e.target.checked ? [...s, i] : s.filter((n) => n !== i),
                          )
                        }
                      />
                    </td>
                    <td>{item.title}</td>
                    <td>{item.messages.length}</td>
                    <td>{item.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row between mt24">
            <button
              className="btn"
              disabled={busy}
              onClick={() => {
                setPreview(null);
                setError('');
              }}
            >
              Quay lại
            </button>
            <button
              className="btn primary"
              disabled={busy || !selected.length || !projectId}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  const res = await fetch('/api/imports', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      project_id: projectId,
                      items: preview.items.filter((_, i) => selected.includes(i)),
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.message);
                  setResult(data);
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Không nhập được dữ liệu.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Đang nhập…' : `Nhập ${selected.length} hội thoại`}
            </button>
          </div>
        </section>
      ) : (
        <div className="import-grid">
          <section className="panel panel-padding">
            <h2>Đưa lịch sử về cùng một nơi</h2>
            <p className="small muted mt12">
              Hỗ trợ JSON export ChatGPT, Claude hoặc định dạng Nex AI Hub v1.
            </p>
            <div className="drop-zone">
              <strong>Chọn tệp JSON để xem trước</strong>
              <p>Đọc trên thiết bị trước. Chỉ gửi những hội thoại đã chọn khi bạn bấm Nhập.</p>
              <label className="btn primary" htmlFor="import-file">
                Chọn tệp JSON
              </label>
              <input
                id="import-file"
                className="file-input"
                type="file"
                accept="application/json,.json"
                onChange={async (e) => {
                  setError('');
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 3000000) {
                    setError('Tệp tối đa 3 MB. Chia nhỏ export trước khi nhập.');
                    return;
                  }
                  try {
                    const parsed = parseImport(JSON.parse(await file.text()));
                    setPreview(parsed);
                    setSelected(parsed.items.map((_, i) => i));
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Tệp không hợp lệ.');
                  }
                }}
              />
            </div>
            {!projects.length ? (
              <p className="form-error">
                Cần tạo dự án hoặc có quyền đóng góp trước khi nhập dữ liệu.
              </p>
            ) : null}
            <a className="text-link" href="/import-template.json" download>
              Tải mẫu Nex JSON
            </a>
          </section>
          <aside className="panel panel-padding">
            <h3>Một bản sao có nguồn gốc</h3>
            <ul className="check-list">
              <li>Chỉ nhập nhánh đang chọn của ChatGPT.</li>
              <li>Giữ nguồn và timestamp nếu có.</li>
              <li>Tự bỏ qua bản trùng trong cùng dự án.</li>
              <li>Không gán người nhập thành tác giả gốc.</li>
            </ul>
            <div className="divider" />
            <p className="small muted">
              Gemini và Meta: chuyển nội dung sang mẫu Nex JSON trước khi nhập. Chưa hỗ trợ ZIP, ảnh
              hoặc tệp đính kèm trong export.
            </p>
            <p className="small muted mt12">
              Đây là nhập một chiều. Thay đổi tại website nguồn không tự cập nhật vào Hub.
            </p>
          </aside>
        </div>
      )}
    </>
  );
}
