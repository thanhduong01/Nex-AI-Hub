import Link from 'next/link';
import { notFound } from 'next/navigation';
import { File, ArrowRight } from 'lucide-react';
import { pageUser } from '@/lib/auth';
import { projectData, connectionsData, documentsData } from '@/lib/data';
import { uuid } from '@/lib/schemas';
import { dbError, AppError } from '@/lib/errors';
import { Heading, Notice, Empty, Avatar, dateTime } from '@/components/ui';
import { NewConversation, ShareProject } from '@/components/project-forms';
import { ActionForm, ArchiveButton } from '@/components/forms';
import { Modal } from '@/components/modal';
import { FileUpload } from '@/components/file-upload';
import type { Member, Conversation } from '@/lib/types';
export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const raw = (await params).id;
  if (!uuid.safeParse(raw).success) notFound();
  const { db } = await pageUser();
  let detail;
  try {
    detail = await projectData(raw);
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
  const [connections, docs, { data: people, error: a }, { data: conversations, error: b }] =
    await Promise.all([
      connectionsData(),
      documentsData(raw),
      db.from('members').select('*').order('display_name'),
      db
        .from('conversations')
        .select('*')
        .eq('project_id', raw)
        .order('updated_at', { ascending: false })
        .limit(100),
    ]);
  dbError(a);
  dbError(b);
  const { project, members, canManage, canWrite } = detail,
    tab = (await searchParams).tab || 'conversations';
  const directory = people as Member[];
  return (
    <>
      <Heading
        title={project.name}
        description={`Dự án của ${directory.find((p) => p.user_id === project.created_by)?.display_name || 'Thành viên'} · ${project.category}`}
      >
        <div className="row wrap">
          <ShareProject
            project={project}
            members={members}
            people={directory}
            canManage={canManage}
          />
          {canWrite ? (
            <NewConversation project={project} connections={connections} />
          ) : (
            <span className="pill blue">Chỉ xem</span>
          )}
        </div>
      </Heading>
      <div className="project-detail-grid">
        <div>
          <p className="project-description">{project.description}</p>
          <Notice>
            {project.archived_at
              ? 'Dự án đã lưu trữ. Bạn vẫn có thể đọc và tải nội dung.'
              : canWrite
                ? 'Dự án công việc — chủ doanh nghiệp có quyền xem nội dung.'
                : 'Bạn có quyền xem. Cần quyền đóng góp để tạo hoặc tiếp tục hội thoại.'}
          </Notice>
          <div className="detail-tabs">
            {[
              ['conversations', 'Hội thoại'],
              ['files', 'Tài liệu'],
              ['members', 'Thành viên'],
            ].map(([key, label]) => (
              <Link
                key={key}
                href={`/projects/${raw}?tab=${key}`}
                className={`detail-tab ${tab === key ? 'active' : ''}`}
              >
                {label}
              </Link>
            ))}
          </div>
          <section className="panel panel-padding mt24">
            {tab === 'files' ? (
              <>
                {docs.map((doc) => (
                  <div className="file-row" key={doc.id}>
                    <File size={20} />
                    <div className="file-info">
                      <strong>{doc.name}</strong>
                      <p>
                        {Math.ceil(doc.size_bytes / 1024)} KB · {dateTime(doc.created_at)}
                      </p>
                    </div>
                    <a className="btn" href={`/api/documents/${doc.id}`}>
                      Tải về
                    </a>
                  </div>
                ))}
                {!docs.length ? (
                  <p className="muted small mb24">Chưa có tài liệu trong dự án.</p>
                ) : null}
                {canWrite ? (
                  <div className="mt24">
                    <FileUpload projectId={raw} />
                  </div>
                ) : null}
              </>
            ) : tab === 'members' ? (
              <>
                {[project.created_by, ...members.map((m) => m.user_id)].map((id) => (
                  <div className="file-row" key={id}>
                    <Avatar
                      name={directory.find((p) => p.user_id === id)?.display_name || 'Thành viên'}
                    />
                    <div className="grow">
                      {directory.find((p) => p.user_id === id)?.display_name || 'Thành viên'}
                    </div>
                    <span className="pill">
                      {id === project.created_by
                        ? 'Chủ dự án'
                        : members.find((m) => m.user_id === id)?.permission === 'contributor'
                          ? 'Đóng góp'
                          : 'Chỉ xem'}
                    </span>
                  </div>
                ))}
              </>
            ) : conversations?.length ? (
              (conversations as Conversation[]).map((c) => (
                <Link
                  key={c.id}
                  className="conversation-item"
                  prefetch={false}
                  href={`/chat/${c.id}`}
                >
                  <div className="conversation-text">
                    <div className="conversation-title">{c.title}</div>
                    <span className="conversation-sub">
                      {c.source === 'hub' ? 'Trong Hub' : `Nhập từ ${c.source}`} ·{' '}
                      {dateTime(c.updated_at)}
                    </span>
                  </div>
                  <ArrowRight size={17} />
                </Link>
              ))
            ) : (
              <Empty description="Bắt đầu từ một câu hỏi cho dự án này." />
            )}
          </section>
        </div>
        <aside className="panel panel-padding project-side">
          <h3>Thông tin dự án</h3>
          <div className="definition">
            <div className="definition-row">
              <span>Ngày tạo</span>
              <span>{dateTime(project.created_at)}</span>
            </div>
            <div className="definition-row">
              <span>Tài liệu</span>
              <strong>{docs.length}</strong>
            </div>
            <div className="definition-row">
              <span>Thành viên</span>
              <strong>{members.length + 1}</strong>
            </div>
          </div>
          <Notice>
            Chỉ tài liệu được chọn mới gửi tới AI. Nội dung dự án khác không tự được dùng làm ngữ
            cảnh.
          </Notice>
          {canManage ? (
            <div className="stack mt24">
              <Modal title="Chỉnh sửa dự án" trigger="Chỉnh sửa">
                <ActionForm kind="edit-project" initial={{ id: raw, category: project.category }}>
                  <div className="field">
                    <label htmlFor="edit-name">Tên dự án</label>
                    <input
                      id="edit-name"
                      name="name"
                      className="input"
                      defaultValue={project.name}
                      maxLength={100}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="edit-description">Mô tả</label>
                    <textarea
                      id="edit-description"
                      name="description"
                      className="input"
                      defaultValue={project.description}
                      maxLength={1000}
                    />
                  </div>
                </ActionForm>
              </Modal>
              <ArchiveButton id={raw} archived={!!project.archived_at} />
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}
