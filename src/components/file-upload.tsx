'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function FileUpload({ projectId }: { projectId: string }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const router = useRouter();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget,
          data = new FormData(form),
          file = data.get('file');
        if (!(file instanceof File) || file.size > 3000000) {
          setMessage('Chọn tệp tối đa 3 MB.');
          return;
        }
        setBusy(true);
        setMessage('');
        try {
          const res = await fetch('/api/documents', { method: 'POST', body: data });
          const body = await res.json();
          if (!res.ok) throw new Error(body.message);
          form.reset();
          setMessage('Đã lưu tài liệu.');
          router.refresh();
        } catch (e) {
          setMessage(e instanceof Error ? e.message : 'Không tải lên được.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <input type="hidden" name="project_id" value={projectId} />
      <div className="field">
        <label htmlFor="document-file">Thêm tài liệu · tối đa 3 MB</label>
        <input
          id="document-file"
          type="file"
          name="file"
          accept=".txt,.md,.csv,.json,.pdf"
          className="input"
          required
          disabled={busy}
        />
        <p className="hint">
          PDF dùng để lưu/tải về. AI đọc văn bản UTF-8 TXT, Markdown, CSV, JSON tối đa 120 KB khi
          được chọn rõ ràng.
        </p>
      </div>
      <button className="btn primary" disabled={busy}>
        {busy ? 'Đang tải lên…' : 'Lưu tài liệu'}
      </button>
      {message ? (
        <p className="small mt12" role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
