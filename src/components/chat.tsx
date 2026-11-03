'use client';
import { useRef, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { ArrowUp, Square, Copy, RefreshCw } from 'lucide-react';
import { ProviderMark, Avatar } from './ui';
import { PROVIDERS, type Message, type Connection, type DocumentRecord } from '@/lib/types';
import { chatSchema } from '@/lib/schemas';
const Markdown = dynamic(() => import('./markdown'), {
  loading: () => <span className="muted">Đang định dạng…</span>,
});
export function Chat({
  conversationId,
  initialMessages,
  connection,
  documents,
  canWrite,
  userName,
  activeRunId,
}: {
  conversationId: string;
  initialMessages: Message[];
  connection: Connection | null;
  documents: DocumentRecord[];
  canWrite: boolean;
  userName: string;
  activeRunId: string | null;
}) {
  const [messages, setMessages] = useState(initialMessages),
    [draft, setDraft] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [selected, setSelected] = useState<string[]>([]),
    [runId, setRunId] = useState<string | null>(activeRunId);
  const abortRef = useRef<AbortController | null>(null),
    requestRef = useRef<{ id: string; content: string } | null>(null),
    bottom = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => () => abortRef.current?.abort(), []);
  const enabled = canWrite && !!connection?.enabled;
  async function send() {
    if (!enabled || busy) return;
    setError('');
    setNotice('');
    const requestId =
      requestRef.current?.content === draft ? requestRef.current.id : crypto.randomUUID();
    const parsed = chatSchema.safeParse({
      conversation_id: conversationId,
      request_id: requestId,
      content: draft,
      document_ids: selected,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Kiểm tra câu hỏi.');
      return;
    }
    requestRef.current = { id: requestId, content: draft };
    setBusy(true);
    const previous = messages,
      question = draft,
      assistantId = crypto.randomUUID();
    let began = false,
      finished = false;
    abortRef.current = new AbortController();
    const created = new Date().toISOString();
    const optimistic: Message[] = [
      ...messages,
      {
        id: crypto.randomUUID(),
        sequence: 0,
        conversation_id: conversationId,
        run_id: null,
        role: 'user',
        content: question,
        author_id: 'me',
        status: 'complete',
        created_at: created,
      },
      {
        id: assistantId,
        sequence: 0,
        conversation_id: conversationId,
        run_id: null,
        role: 'assistant',
        content: '',
        author_id: null,
        status: 'streaming',
        created_at: created,
      },
    ];
    setMessages(optimistic);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
        signal: abortRef.current.signal,
      });
      if (!res.ok) {
        const data = await res.json();
        if (data.error === 'EXISTING_RUN') {
          router.refresh();
          requestRef.current = null;
        }
        throw new Error(data.message || 'Không thể gửi câu hỏi.');
      }
      if (!res.body) throw new Error('Không nhận được phản hồi từ máy chủ.');
      const reader = res.body.getReader(),
        decoder = new TextDecoder();
      let buffer = '',
        text = '',
        lastRender = 0;
      const flush = () =>
        setMessages((current) =>
          current.map((m) => (m.id === assistantId ? { ...m, content: text } : m)),
        );
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline;
        while ((newline = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newline);
          buffer = buffer.slice(newline + 1);
          if (!line) continue;
          const event = JSON.parse(line);
          if (event.type === 'start') {
            began = true;
            setRunId(event.run_id);
            setDraft('');
            if (event.omitted)
              setNotice(
                `Ngữ cảnh dùng tối đa 40 tin nhắn gần đây và giới hạn dung lượng. ${event.omitted} tin cũ không được gửi trong lượt này.`,
              );
          }
          if (event.type === 'delta') {
            text += event.text;
            if (Date.now() - lastRender > 60) {
              flush();
              lastRender = Date.now();
            }
          }
          if (event.type === 'error') setError(event.message);
          if (event.type === 'notice') setNotice(event.message);
          if (event.type === 'done') {
            finished = true;
            flush();
            setMessages((current) =>
              current.map((m) =>
                m.id === assistantId
                  ? { ...m, status: event.status === 'completed' ? 'complete' : 'partial' }
                  : m,
              ),
            );
            if (event.usage_pending)
              setNotice('Chi phí lượt này đang chờ đối soát; khoản giữ trước chưa được hoàn.');
          }
        }
      }
      flush();
      if (!finished)
        throw new Error('Kết nối bị gián đoạn. Tải lại để kiểm tra phần đã lưu trước khi thử lại.');
      requestRef.current = null;
    } catch (e) {
      if (!began) setMessages(previous);
      if (!abortRef.current?.signal.aborted)
        setError(e instanceof Error ? e.message : 'Không thể kết nối máy chủ.');
      else setNotice('Đã yêu cầu dừng. Tải lại để xem trạng thái được máy chủ ghi nhận.');
    } finally {
      setBusy(false);
      setRunId(null);
      abortRef.current = null;
      if (finished) router.refresh();
    }
  }
  async function stop() {
    if (runId) {
      try {
        const res = await fetch(`/api/runs/${runId}/stop`, { method: 'POST' });
        if (!res.ok) {
          setError('Chưa xác nhận được yêu cầu dừng.');
          return;
        }
      } catch {
        setError('Mất kết nối khi yêu cầu dừng.');
        return;
      }
    }
    abortRef.current?.abort();
    if (!busy) router.refresh();
  }
  return (
    <div className="chat-layout">
      <section className="chat-column">
        {!enabled ? (
          <div className="info-banner">
            {!canWrite
              ? 'Bạn đang ở chế độ chỉ xem. Cần quyền đóng góp để gửi tin nhắn.'
              : 'Kết nối AI chưa sẵn sàng. Tạo nhánh với nguồn được cấp quyền để tiếp tục.'}
          </div>
        ) : null}
        {activeRunId && !busy ? (
          <div className="info-banner amber">
            Hội thoại có lượt đang xử lý.{' '}
            <button className="text-link" onClick={() => router.refresh()}>
              Tải trạng thái
            </button>
            <button className="text-link" onClick={stop}>
              Yêu cầu dừng
            </button>
          </div>
        ) : null}
        <div className="chat-transcript" aria-live="off">
          {!messages.length ? (
            <div className="new-chat">
              <h2>Cùng mở một hướng nghĩ mới.</h2>
              <p>Gửi câu hỏi đầu tiên cho dự án này.</p>
              <div className="suggestions">
                {[
                  'Giúp tôi làm rõ mục tiêu và những câu hỏi cần trả lời.',
                  'Đề xuất một kế hoạch nghiên cứu cho dự án.',
                ].map((s) => (
                  <button
                    key={s}
                    className="suggestion"
                    onClick={() => setDraft(s)}
                    disabled={!enabled}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <article className="message" key={m.id}>
                {m.role === 'user' ? (
                  <Avatar
                    name={
                      m.author_id === 'me' ? userName : m.author_id ? 'Thành viên' : 'Chưa xác định'
                    }
                  />
                ) : connection ? (
                  <ProviderMark provider={connection.provider} />
                ) : (
                  <span className="avatar">AI</span>
                )}
                <div className="message-body">
                  <div className="message-author">
                    <strong>
                      {m.role === 'user'
                        ? m.author_id === 'me'
                          ? userName
                          : m.author_id
                            ? 'Thành viên dự án'
                            : 'Tác giả chưa xác định'
                        : connection
                          ? PROVIDERS[connection.provider].name
                          : 'AI · nội dung nhập'}
                    </strong>
                    {m.status !== 'complete' ? (
                      <span className="pill">
                        {m.status === 'streaming'
                          ? 'Đang phản hồi'
                          : m.status === 'partial'
                            ? 'Chưa hoàn chỉnh'
                            : 'Lượt lỗi'}
                      </span>
                    ) : null}
                  </div>
                  <div className={m.role === 'user' ? 'user-message' : 'ai-message'}>
                    {m.role === 'user' || m.status === 'streaming' ? (
                      <div className="preserve-text">{m.content || 'Đang chờ AI…'}</div>
                    ) : (
                      <Markdown
                        text={
                          m.content ||
                          'Chưa nhận được nội dung. Bạn có thể thử lại bằng một lượt mới.'
                        }
                      />
                    )}
                  </div>
                  {m.content ? (
                    <button
                      className="icon-button"
                      aria-label="Sao chép nội dung"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(m.content);
                          setNotice('Đã sao chép nội dung.');
                        } catch {
                          setError(
                            'Trình duyệt chưa cho phép sao chép. Chọn nội dung và sao chép thủ công.',
                          );
                        }
                      }}
                    >
                      <Copy size={14} />
                    </button>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </div>
        <div ref={bottom} />
        {error ? (
          <div role="alert" className="form-error mt24">
            {error}
            <button type="button" className="text-link" onClick={() => router.refresh()}>
              Tải lại hội thoại
            </button>
          </div>
        ) : null}
        {notice ? (
          <p role="status" className="small muted mt12">
            {notice}
          </p>
        ) : null}
        <form
          className="chat-composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label htmlFor="chat-prompt" className="sr-only">
            Nội dung tin nhắn
          </label>
          <textarea
            id="chat-prompt"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              requestRef.current = null;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
              }
            }}
            disabled={!enabled || busy || !!activeRunId}
            maxLength={20000}
            placeholder={
              canWrite ? 'Tiếp tục trao đổi hoặc đặt câu hỏi…' : 'Bạn đang ở chế độ chỉ xem'
            }
          />
          <div className="composer-controls">
            <span className="row gap6 small muted">
              {connection ? (
                <>
                  <ProviderMark provider={connection.provider} />
                  {connection.model}
                </>
              ) : (
                'Nội dung đã nhập'
              )}
            </span>
            {busy ? (
              <button
                type="button"
                className="send-button"
                aria-label="Dừng phản hồi"
                onClick={stop}
              >
                <Square size={17} />
              </button>
            ) : (
              <button
                className="send-button"
                aria-label="Gửi tin nhắn"
                disabled={!enabled || !draft.trim() || !!activeRunId}
              >
                <ArrowUp size={18} />
              </button>
            )}
          </div>
        </form>
        {messages.some((m) => m.status === 'failed' || m.status === 'partial') && enabled ? (
          <button
            className="text-link mt12"
            disabled={busy}
            onClick={() => {
              const q = [...messages].reverse().find((m) => m.role === 'user');
              if (q) {
                setDraft(q.content);
                requestRef.current = null;
                setNotice(
                  'Câu hỏi được đưa về ô soạn. Bấm gửi sẽ tạo lượt mới và có thể phát sinh phí.',
                );
              }
            }}
          >
            <RefreshCw size={14} />
            Chuẩn bị thử lại bằng lượt mới
          </button>
        ) : null}
        <p className="composer-foot">
          Nội dung được lưu trong dự án công việc. Chủ doanh nghiệp có quyền xem. AI có thể đưa ra
          thông tin sai.
        </p>
      </section>
      <aside className="panel panel-padding chat-context">
        <h3>Ngữ cảnh cho lượt tiếp theo</h3>
        <p className="small muted mt12">Lịch sử trong hội thoại này và tài liệu bạn chọn.</p>
        <fieldset disabled={busy || !enabled} className="mt24">
          <legend className="small">Tài liệu được chọn ({selected.length}/5)</legend>
          {documents
            .filter((d) => d.mime_type !== 'application/pdf' && d.size_bytes <= 120000)
            .map((d) => (
              <label className="check-field file-choice" key={d.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(d.id)}
                  onChange={(e) =>
                    setSelected((s) =>
                      e.target.checked ? [...s, d.id].slice(0, 5) : s.filter((id) => id !== d.id),
                    )
                  }
                />
                <span>{d.name}</span>
              </label>
            ))}
        </fieldset>
        {!documents.length ? (
          <p className="small muted mt12">Thêm tài liệu từ trang dự án.</p>
        ) : null}
        <p className="context-notice mt24">
          PDF và tệp lớn chỉ được lưu/tải về, chưa tự trích xuất để gửi AI. Không tự lấy nội dung từ
          dự án khác.
        </p>
      </aside>
    </div>
  );
}
