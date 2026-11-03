import { notFound } from 'next/navigation';
import { pageUser } from '@/lib/auth';
import { dbError } from '@/lib/errors';
import { Heading, Avatar, Badge, Notice, Metric, money } from '@/components/ui';
import { ActionForm } from '@/components/forms';
import { Modal } from '@/components/modal';
import type { Member } from '@/lib/types';
export default async function Team() {
  const { db, member } = await pageUser();
  if (member.role !== 'owner') notFound();
  const { data, error } = await db
    .from('members')
    .select('*')
    .eq('role', 'employee')
    .order('created_at');
  dbError(error);
  const people = data as Member[];
  return (
    <>
      <Heading
        title="Nhân viên"
        description="Mỗi nhân viên có tài khoản Hub riêng; công ty quản lý kết nối AI."
      >
        <Modal
          title="Mời nhân viên"
          description="Gửi email mời tới đúng người trong công ty."
          trigger="Mời nhân viên"
          primary
        >
          <ActionForm kind="invite" label="Gửi lời mời">
            <div className="field">
              <label htmlFor="invite-name">Họ tên</label>
              <input
                id="invite-name"
                className="input"
                name="display_name"
                maxLength={100}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="invite-email">Email công việc</label>
              <input id="invite-email" className="input" type="email" name="email" required />
            </div>
            <Notice>
              Nhân viên mới bắt đầu với hạn mức $0. Sau khi mời, cấp nguồn AI và ngân sách để bắt
              đầu sử dụng.
            </Notice>
          </ActionForm>
        </Modal>
      </Heading>
      <div className="metrics-strip">
        <Metric label="Tổng nhân viên" value={people.length} />
        <Metric label="Đang hoạt động" value={people.filter((p) => p.status === 'active').length} />
        <Metric label="Đang khóa" value={people.filter((p) => p.status === 'suspended').length} />
        <Metric
          label="Hạn mức cá nhân"
          value={money(people.reduce((sum, p) => sum + Number(p.monthly_limit), 0))}
        />
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nhân viên</th>
              <th>Email</th>
              <th>Hạn mức / tháng</th>
              <th>Trạng thái</th>
              <th>Quản lý</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.user_id}>
                <td>
                  <div className="row">
                    <Avatar name={p.display_name} />
                    <strong>{p.display_name}</strong>
                  </div>
                </td>
                <td>{p.email}</td>
                <td>{money(p.monthly_limit)}</td>
                <td>
                  <Badge tone={p.status === 'active' ? 'green' : 'red'}>
                    {p.status === 'active' ? 'Hoạt động' : 'Đã khóa'}
                  </Badge>
                </td>
                <td>
                  <Modal title={p.display_name} trigger="Quản lý">
                    <ActionForm kind="employee" initial={{ user_id: p.user_id }}>
                      <div className="field">
                        <label htmlFor={`${p.user_id}-limit`}>Hạn mức tháng · USD</label>
                        <input
                          id={`${p.user_id}-limit`}
                          className="input"
                          name="monthly_limit"
                          type="number"
                          min="0"
                          max="100000"
                          step="0.01"
                          required
                          defaultValue={p.monthly_limit}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`${p.user_id}-status`}>Trạng thái</label>
                        <select
                          id={`${p.user_id}-status`}
                          className="input"
                          name="status"
                          defaultValue={p.status}
                        >
                          <option value="active">Hoạt động</option>
                          <option value="suspended">Khóa tài khoản</option>
                        </select>
                      </div>
                      <Notice>
                        Khóa sẽ thu hồi các phiên Hub và chặn yêu cầu mới. Quyền dùng AI được quản
                        lý ở màn Nguồn AI.
                      </Notice>
                    </ActionForm>
                  </Modal>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!people.length ? (
          <div className="empty">
            <h3>Chưa có nhân viên</h3>
            <p>Mời 5 nhân viên của bạn để bắt đầu cộng tác.</p>
          </div>
        ) : null}
      </div>
      <Notice>
        Chủ doanh nghiệp xem được toàn bộ dự án công việc. Nhân viên chỉ thấy dự án của mình và được
        chia sẻ.
      </Notice>
    </>
  );
}
