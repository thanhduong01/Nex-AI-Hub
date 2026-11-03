import { pageUser } from '@/lib/auth';
import { workspaceData } from '@/lib/data';
import { Heading, Notice, dateTime } from '@/components/ui';
import { ActionForm } from '@/components/forms';
export default async function Settings() {
  const { member, expiresAt } = await pageUser(),
    { workspace } = await workspaceData();
  return (
    <>
      <Heading title="Cài đặt" description="Hồ sơ cá nhân và cấu hình không gian làm việc." />
      <div className="settings-live">
        <section className="panel panel-padding">
          <h2>Hồ sơ của tôi</h2>
          <p className="small muted mt12 mb24">
            {member.email} · {member.role === 'owner' ? 'Chủ doanh nghiệp' : 'Nhân viên'}
          </p>
          <ActionForm kind="profile">
            <div className="field">
              <label htmlFor="profile-name">Tên hiển thị</label>
              <input
                id="profile-name"
                className="input"
                name="display_name"
                defaultValue={member.display_name}
                maxLength={100}
                required
              />
            </div>
          </ActionForm>
          <div className="divider" />
          <h3>Phiên đăng nhập</h3>
          <p className="small muted mt12">
            Phiên hiện tại hết hạn lúc {dateTime(expiresAt)}. Giữ đăng nhập tối đa 7 ngày kể từ lần
            xác thực, kể cả khi đóng trình duyệt.
          </p>
          <a href="/forgot-password" className="text-link mt12">
            Yêu cầu đổi mật khẩu
          </a>
        </section>
        <section className="panel panel-padding">
          <h2>Không gian làm việc</h2>
          {member.role === 'owner' ? (
            <ActionForm
              kind="workspace"
              initial={{
                monthly_budget: workspace.monthly_budget,
                warning_percent: workspace.warning_percent,
              }}
            >
              <div className="field mt24">
                <label htmlFor="workspace-name">Tên workspace</label>
                <input
                  id="workspace-name"
                  className="input"
                  name="name"
                  defaultValue={workspace.name}
                  maxLength={100}
                  required
                />
              </div>
            </ActionForm>
          ) : (
            <p className="small muted mt24">{workspace.name} · Do chủ doanh nghiệp quản lý</p>
          )}
          <div className="divider" />
          <h3>Quyền dữ liệu công việc</h3>
          <Notice>
            Chủ doanh nghiệp xem được mọi dự án công việc. Nhân viên chỉ thấy dự án mình sở hữu hoặc
            được chia sẻ. Quyền xem không tự cấp quyền sửa/gửi AI.
          </Notice>
          <p className="small muted">
            API key được giữ ở máy chủ. Nội dung gửi tới AI chỉ gồm lịch sử hội thoại đang mở và tài
            liệu được chọn.
          </p>
        </section>
      </div>
    </>
  );
}
