import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { pageUser } from '@/lib/auth';
import { projectsData, connectionsData, workspaceData } from '@/lib/data';
import { dbError } from '@/lib/errors';
import {
  Heading,
  Metric,
  Notice,
  ProjectCard,
  Empty,
  ConnectionOptions,
  money,
  ProviderMark,
} from '@/components/ui';
import { PROVIDERS, type Conversation } from '@/lib/types';
import { ActionForm } from '@/components/forms';
import { NewProject } from '@/components/project-forms';
export default async function Overview() {
  const { db, member } = await pageUser();
  const [projects, connections, { workspace, usage }, { data: recent, error }] = await Promise.all([
    projectsData(),
    connectionsData(),
    workspaceData(),
    db.from('conversations').select('*').order('updated_at', { ascending: false }).limit(5),
  ]);
  dbError(error);
  const limit = member.role === 'owner' ? workspace.monthly_budget : member.monthly_limit,
    used = Number(usage.recorded) + Number(usage.reserved),
    writeable = projects.filter((p) => p.created_by === member.user_id);
  return (
    <>
      <Heading
        title={`Chào bạn, ${member.display_name.split(' ')[0]}.`}
        description="Mọi AI, mọi dự án. Cùng một không gian làm việc."
      >
        <NewProject />
      </Heading>
      <div className="welcome-grid">
        <section className="start-panel">
          <div className="eyebrow">KHÔNG GIAN CHO Ý TƯỞNG TIẾP THEO</div>
          <h2>Bạn muốn bắt đầu từ đâu?</h2>
          <p>Chọn dự án và nguồn AI để mở một cuộc trao đổi.</p>
          {writeable.length && connections.some((c) => c.enabled) ? (
            <ActionForm kind="conversation" label="Bắt đầu hội thoại" className="quick-live">
              <input
                name="title"
                className="input"
                placeholder="Chủ đề muốn tìm hiểu…"
                maxLength={200}
                required
                aria-label="Tên hội thoại"
              />
              <div className="form-grid mt12">
                <select name="project_id" className="input" aria-label="Dự án">
                  {writeable.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select name="connection_id" className="input" aria-label="Nguồn AI">
                  <ConnectionOptions connections={connections} />
                </select>
              </div>
            </ActionForm>
          ) : (
            <div className="panel panel-padding mt24">
              <p>
                {!projects.length
                  ? 'Tạo dự án đầu tiên để bắt đầu.'
                  : !connections.some((c) => c.enabled)
                    ? 'Chưa có nguồn AI sẵn sàng. Chủ doanh nghiệp cần cấu hình kết nối và cấp quyền.'
                    : 'Mở dự án được chia sẻ để tiếp tục công việc.'}
              </p>
              <Link
                href={
                  member.role === 'owner' && !connections.length ? '/integrations' : '/projects'
                }
                className="text-link mt12"
              >
                {member.role === 'owner' && !connections.length
                  ? 'Thiết lập nguồn AI'
                  : 'Đi tới dự án'}{' '}
                <ArrowRight size={15} />
              </Link>
            </div>
          )}
          <div className="hero-foot mt24">
            Ngữ cảnh tách theo hội thoại · Lịch sử được lưu trong dự án
          </div>
        </section>
        <aside className="budget-hero">
          <div className="eyebrow">
            {member.role === 'owner' ? 'NGÂN SÁCH WORKSPACE' : 'HẠN MỨC CỦA BẠN'}
          </div>
          <div className="hero-money">
            {money(Math.max(0, limit - used))}
            <small> còn khả dụng</small>
          </div>
          <div className="track">
            <span style={{ width: `${limit ? Math.min(100, (used / limit) * 100) : 0}%` }} />
          </div>
          <div className="budget-stats">
            <span>Đã ghi nhận {money(usage.recorded)}</span>
          </div>
          <Link className="budget-link" href="/usage">
            Xem chi tiết sử dụng <ArrowRight size={16} />
          </Link>
        </aside>
      </div>
      {!limit ? (
        <Notice tone="amber">
          Chưa có ngân sách được cấp. Bạn vẫn có thể tổ chức dự án, đọc và nhập lịch sử.
        </Notice>
      ) : null}
      <div className="metrics-strip">
        <Metric label="Dự án đang hoạt động" value={projects.length} />
        <Metric label="Lượt AI tháng này" value={usage.runs} />
        <Metric label="Nguồn AI sẵn sàng" value={connections.filter((c) => c.enabled).length} />
        <Metric
          label="Chờ đối soát"
          value={usage.pending}
          note={`${money(usage.reserved)} đang giữ trước`}
        />
      </div>
      <div className="section-heading">
        <h2>Tiếp tục công việc</h2>
        <Link className="text-link" href="/projects">
          Tất cả dự án <ArrowRight size={16} />
        </Link>
      </div>
      {projects.length ? (
        <div className="project-grid">
          {projects.slice(0, 3).map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      ) : (
        <Empty description="Tạo dự án để giữ hội thoại và tài liệu theo mục tiêu công việc." />
      )}
      <div className="bottom-grid">
        <section className="panel panel-padding">
          <div className="section-heading">
            <h2>Hội thoại gần đây</h2>
            <Link href="/library" className="text-link">
              Xem tất cả
            </Link>
          </div>
          {recent?.length ? (
            (recent as Conversation[]).map((c) => (
              <Link
                key={c.id}
                className="conversation-item"
                prefetch={false}
                href={`/chat/${c.id}`}
              >
                <div className="conversation-text">
                  <div className="conversation-title">{c.title}</div>
                  <span className="conversation-sub">
                    {projects.find((p) => p.id === c.project_id)?.name || 'Dự án'} ·{' '}
                    {c.source === 'hub' ? 'Trong Hub' : 'Đã nhập'}
                  </span>
                </div>
                <ArrowRight size={16} />
              </Link>
            ))
          ) : (
            <p className="muted small">Hội thoại đầu tiên sẽ xuất hiện tại đây.</p>
          )}
        </section>
        <aside className="panel panel-padding status-panel">
          <h2>Nguồn AI</h2>
          <div className="status-list mt24">
            {connections.map((c) => (
              <div key={c.id} className="provider-status-row">
                <ProviderMark provider={c.provider} />
                <span>{PROVIDERS[c.provider].name}</span>
                <span className={`pill ${c.enabled ? 'green' : ''}`}>
                  {c.enabled ? 'Đã bật' : 'Đang tắt'}
                </span>
              </div>
            ))}
          </div>
          <p className="status-note">Gói Plus/Pro và ngân sách API được quản lý riêng.</p>
        </aside>
      </div>
    </>
  );
}
