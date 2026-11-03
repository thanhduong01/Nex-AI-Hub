import Link from 'next/link';
import { pageUser } from '@/lib/auth';
import { projectsData } from '@/lib/data';
import { dbError } from '@/lib/errors';
import { uuid } from '@/lib/schemas';
import { Heading, Empty, dateTime } from '@/components/ui';
import type { Conversation } from '@/lib/types';
export default async function Library({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; project?: string; source?: string; page?: string }>;
}) {
  const params = await searchParams,
    { db } = await pageUser(),
    projects = await projectsData(true);
  const page = Math.max(0, Math.min(333, Number.parseInt(params.page || '0') || 0));
  const { data, error } = await db.rpc('search_conversations', {
    p_query: (params.q || '').slice(0, 200),
    p_project: uuid.safeParse(params.project).success ? params.project : null,
    p_source: ['hub', 'openai', 'anthropic', 'google', 'meta', 'normalized'].includes(
      params.source || '',
    )
      ? params.source
      : null,
    p_offset: page * 30,
  });
  dbError(error);
  const conversations = data as Conversation[];
  return (
    <>
      <Heading
        title="Kho hội thoại"
        description="Tìm lại nội dung công việc trong phạm vi bạn được phép xem."
      />
      <form className="library-filters">
        <input
          className="input grow"
          type="search"
          name="q"
          defaultValue={params.q}
          placeholder="Tìm trong tiêu đề và tin nhắn…"
          aria-label="Từ khóa"
          maxLength={200}
        />
        <select
          className="input"
          name="project"
          defaultValue={params.project || ''}
          aria-label="Dự án"
        >
          <option value="">Mọi dự án</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          className="input"
          name="source"
          defaultValue={params.source || ''}
          aria-label="Nguồn gốc"
        >
          <option value="">Mọi nguồn</option>
          <option value="hub">Trong Hub</option>
          <option value="openai">ChatGPT import</option>
          <option value="anthropic">Claude import</option>
          <option value="normalized">Nex JSON</option>
          <option value="google">Gemini import</option>
          <option value="meta">Meta import</option>
        </select>
        <button className="btn primary">Tìm kiếm</button>
      </form>
      {conversations.length ? (
        <div className="panel panel-padding">
          {conversations.map((c) => (
            <Link prefetch={false} href={`/chat/${c.id}`} className="conversation-item" key={c.id}>
              <div className="conversation-text">
                <div className="conversation-title">{c.title}</div>
                <span className="conversation-sub">
                  {projects.find((p) => p.id === c.project_id)?.name} ·{' '}
                  {c.source === 'hub' ? 'Trong Hub' : c.source}
                </span>
              </div>
              <time>{dateTime(c.updated_at)}</time>
            </Link>
          ))}
        </div>
      ) : (
        <Empty title="Chưa tìm thấy kết quả" description="Thử từ khóa khác hoặc thay đổi bộ lọc." />
      )}
      <div className="row between mt24">
        <span className="small muted">Trang {page + 1} · Tối đa 30 hội thoại/trang</span>
        <div className="row">
          {page > 0 ? (
            <Link
              className="btn"
              href={`?${new URLSearchParams({ ...params, page: String(page - 1) } as Record<string, string>)}`}
            >
              Trang trước
            </Link>
          ) : null}
          {conversations.length === 30 ? (
            <Link
              className="btn"
              href={`?${new URLSearchParams({ ...params, page: String(page + 1) } as Record<string, string>)}`}
            >
              Trang tiếp
            </Link>
          ) : null}
        </div>
      </div>
    </>
  );
}
