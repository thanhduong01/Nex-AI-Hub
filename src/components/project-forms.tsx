import { ActionForm } from './forms';
import { Modal } from './modal';
import { Notice, ConnectionOptions } from './ui';
import type { Connection, Member, Project, ProjectMember } from '@/lib/types';
export function NewProject() {
  return (
    <Modal
      title="Tạo dự án mới"
      description="Giữ ý tưởng và trao đổi theo đúng mục tiêu."
      trigger="Tạo dự án"
      primary
    >
      <ActionForm kind="project" label="Tạo dự án">
        <div className="field">
          <label htmlFor="project-name">Tên dự án</label>
          <input
            id="project-name"
            name="name"
            className="input"
            required
            maxLength={100}
            placeholder="Ví dụ: Nghiên cứu sản phẩm mới"
          />
        </div>
        <div className="field">
          <label htmlFor="project-description">Mô tả</label>
          <textarea
            id="project-description"
            name="description"
            className="input"
            maxLength={1000}
          />
        </div>
        <div className="field">
          <label htmlFor="project-category">Phân loại</label>
          <select id="project-category" name="category" className="input">
            {['Nghiên cứu', 'Marketing', 'Thương hiệu', 'Vận hành', 'Sản phẩm'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <Notice>Dự án công việc — chủ doanh nghiệp có quyền xem nội dung.</Notice>
      </ActionForm>
    </Modal>
  );
}
export function NewConversation({
  project,
  connections,
  parentId,
}: {
  project: Project;
  connections: Connection[];
  parentId?: string;
}) {
  return (
    <Modal
      title={parentId ? 'Tiếp tục bằng AI khác' : 'Hội thoại mới'}
      description={
        parentId
          ? 'Tạo một nhánh trong cùng dự án. Hội thoại gốc được giữ nguyên.'
          : 'Chọn nguồn AI cho cuộc trao đổi này.'
      }
      trigger={parentId ? 'Tạo nhánh với AI khác' : 'Hội thoại mới'}
      primary={!parentId}
    >
      <ActionForm
        kind="conversation"
        initial={{ project_id: project.id, ...(parentId ? { parent_id: parentId } : {}) }}
        label={parentId ? 'Tạo nhánh' : 'Mở hội thoại'}
      >
        <div className="field">
          <label htmlFor="conversation-title">Tên hội thoại</label>
          <input
            id="conversation-title"
            className="input"
            name="title"
            maxLength={200}
            required
            defaultValue={parentId ? 'Phân tích theo góc nhìn mới' : ''}
            placeholder="Chủ đề muốn trao đổi…"
          />
        </div>
        <div className="field">
          <label htmlFor="conversation-connection">Nguồn AI / model</label>
          <select id="conversation-connection" name="connection_id" className="input" required>
            <option value="">Chọn kết nối được cấp quyền</option>
            <ConnectionOptions connections={connections} />
          </select>
        </div>
        <Notice>
          {parentId
            ? 'Nhánh mới sao chép các tin nhắn hoàn chỉnh. Ngữ cảnh sẽ được gửi sang nguồn AI bạn chọn khi bạn bấm gửi.'
            : 'Chưa phát sinh chi phí khi tạo hội thoại. Ngân sách được kiểm tra trước mỗi lượt gửi.'}
        </Notice>
      </ActionForm>
    </Modal>
  );
}
export function ShareProject({
  project,
  members,
  people,
  canManage,
}: {
  project: Project;
  members: ProjectMember[];
  people: Member[];
  canManage: boolean;
}) {
  return (
    <Modal title="Quyền truy cập dự án" description={project.name} trigger="Chia sẻ">
      <Notice>Chủ doanh nghiệp luôn có quyền xem. Quyền đóng góp được cấp riêng.</Notice>
      {members.map((m) => (
        <div className="file-row" key={m.user_id}>
          <span className="grow">
            {people.find((p) => p.user_id === m.user_id)?.display_name || 'Thành viên'}
          </span>
          {canManage ? (
            <ActionForm
              kind="share"
              initial={{ project_id: project.id, user_id: m.user_id }}
              className="inline-form"
              label="Lưu"
            >
              <select
                className="input"
                name="permission"
                defaultValue={m.permission}
                aria-label="Quyền thành viên"
              >
                <option value="viewer">Chỉ xem</option>
                <option value="contributor">Đóng góp</option>
                <option value="remove">Thu hồi</option>
              </select>
            </ActionForm>
          ) : (
            <span className="pill">{m.permission === 'contributor' ? 'Đóng góp' : 'Chỉ xem'}</span>
          )}
        </div>
      ))}
      {canManage ? (
        <ActionForm kind="share" initial={{ project_id: project.id }} label="Thêm thành viên">
          <div className="field mt24">
            <label htmlFor="member-select">Nhân viên</label>
            <select id="member-select" name="user_id" className="input" required>
              <option value="">Chọn thành viên</option>
              {people
                .filter(
                  (p) =>
                    p.user_id !== project.created_by &&
                    !members.some((m) => m.user_id === p.user_id) &&
                    p.status === 'active',
                )
                .map((p) => (
                  <option key={p.user_id} value={p.user_id}>
                    {p.display_name}
                  </option>
                ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="member-permission">Quyền</label>
            <select id="member-permission" name="permission" className="input">
              <option value="viewer">Chỉ xem</option>
              <option value="contributor">Đóng góp</option>
            </select>
          </div>
        </ActionForm>
      ) : (
        <p className="small muted mt24">Chỉ chủ dự án có thể quản lý chia sẻ.</p>
      )}
    </Modal>
  );
}
