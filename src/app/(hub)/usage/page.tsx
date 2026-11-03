import { pageUser } from '@/lib/auth';
import { workspaceData } from '@/lib/data';
import { dbError } from '@/lib/errors';
import { Heading, Metric, Notice, Badge, money, dateTime } from '@/components/ui';
import { ActionForm } from '@/components/forms';
import { Modal } from '@/components/modal';
import type { Run } from '@/lib/types';
const statusNames = {
  running: 'Đang chạy',
  completed: 'Hoàn thành',
  failed: 'Lỗi',
  cancelled: 'Đã dừng',
  interrupted: 'Gián đoạn',
};
export default async function UsagePage() {
  const { db, member } = await pageUser();
  const [{ workspace, usage }, { data, error }] = await Promise.all([
    workspaceData(),
    db.from('runs').select('*').order('created_at', { ascending: false }).limit(200),
  ]);
  dbError(error);
  const runs = data as Run[],
    owner = member.role === 'owner',
    limit = owner ? workspace.monthly_budget : member.monthly_limit,
    used = Number(usage.recorded) + Number(usage.reserved);
  return (
    <>
      <Heading
        title={owner ? 'Chi phí sử dụng' : 'Sử dụng của tôi'}
        description="Phân biệt chi phí đã ghi nhận với khoản đang giữ trước."
      >
        <a href="/api/usage/export" className="btn">
          Xuất báo cáo CSV
        </a>
      </Heading>
      <div className="metrics-strip">
        <Metric label="Đã ghi nhận · tháng UTC" value={money(usage.recorded)} />
        <Metric
          label="Đang giữ trước"
          value={money(usage.reserved)}
          note={`${usage.pending} lượt chưa rõ chi phí`}
        />
        <Metric label="Còn khả dụng" value={money(Math.max(0, limit - used))} />
        <Metric label="Lượt AI tháng này" value={usage.runs} />
      </div>
      {limit <= 0 ? (
        <Notice tone="amber">Chưa được cấp ngân sách. Các lượt AI mới đang bị chặn.</Notice>
      ) : (used / limit) * 100 >= workspace.warning_percent ? (
        <Notice tone="amber">
          Đã dùng hoặc giữ trước {Math.round((used / limit) * 100)}% hạn mức tháng. Đọc và xuất hội
          thoại vẫn hoạt động.
        </Notice>
      ) : null}
      {owner ? (
        <div className="panel panel-padding mb24">
          <div className="row between">
            <div>
              <h2>Ngân sách workspace</h2>
              <p className="small muted mt12">
                Giới hạn hiện tại: {money(workspace.monthly_budget)} / tháng UTC
              </p>
            </div>
            <Modal title="Ngân sách AI" trigger="Điều chỉnh">
              <ActionForm kind="workspace" initial={{ name: workspace.name }}>
                <div className="field">
                  <label htmlFor="budget">Ngân sách tháng · USD</label>
                  <input
                    id="budget"
                    className="input"
                    type="number"
                    name="monthly_budget"
                    min="0"
                    max="1000000"
                    step="0.01"
                    required
                    defaultValue={workspace.monthly_budget}
                  />
                </div>
                <div className="field">
                  <label htmlFor="warning">Ngưỡng cảnh báo · %</label>
                  <input
                    id="warning"
                    className="input"
                    type="number"
                    name="warning_percent"
                    min="1"
                    max="99"
                    required
                    defaultValue={workspace.warning_percent}
                  />
                </div>
                <Notice>
                  Đây là giới hạn gửi qua Hub, không tự mua credits hay thay đổi billing nhà cung
                  cấp.
                </Notice>
              </ActionForm>
            </Modal>
          </div>
        </div>
      ) : null}
      <div className="section-heading">
        <h2>Các lượt sử dụng gần đây</h2>
        <span className="tiny muted">Tối đa 200 lượt</span>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Model</th>
              <th>Trạng thái</th>
              <th>Giữ trước</th>
              <th>Ghi nhận</th>
              <th>Đối soát</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td>{dateTime(run.created_at)}</td>
                <td>{run.model}</td>
                <td>
                  <Badge
                    tone={
                      run.status === 'completed' ? 'green' : run.status === 'failed' ? 'red' : ''
                    }
                  >
                    {statusNames[run.status]}
                  </Badge>
                </td>
                <td>{money(run.reserved_cost)}</td>
                <td>{run.actual_cost === null ? 'Chưa xác định' : money(run.actual_cost)}</td>
                <td>
                  {owner && run.usage_state === 'pending' ? (
                    <Modal
                      title="Đối soát chi phí lượt"
                      trigger="Đối soát"
                      description={`Lượt ${run.id}`}
                    >
                      <ActionForm
                        kind="reconcile"
                        initial={{ id: run.id }}
                        label="Xác nhận chi phí"
                        confirmText="Bạn đã kiểm tra chi phí với nhà cung cấp và muốn ghi nhận số tiền này?"
                      >
                        <div className="field">
                          <label htmlFor={`cost-${run.id}`}>Chi phí xác nhận · USD</label>
                          <input
                            id={`cost-${run.id}`}
                            className="input"
                            type="number"
                            name="actual_cost"
                            min="0"
                            max="100000"
                            step="0.000001"
                            required
                          />
                        </div>
                        <Notice>
                          Chỉ nhập khi đã đối chiếu với nhà cung cấp. Lượt đang chạy chỉ có thể được
                          xử lý nếu không cập nhật trong 10 phút. Chi phí không rõ không được mặc
                          định bằng $0.
                        </Notice>
                      </ActionForm>
                    </Modal>
                  ) : (
                    <Badge>
                      {run.usage_state === 'pending'
                        ? 'Chờ đối soát'
                        : run.usage_state === 'reconciled'
                          ? 'Đã đối soát'
                          : 'Theo token'}
                    </Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!runs.length ? <p className="empty muted">Chưa có lượt sử dụng AI.</p> : null}
      </div>
      <Notice>
        Chi phí theo token dùng đơn giá cấu hình tại thời điểm gửi. Cache, reasoning, giá theo bậc
        và hóa đơn nhà cung cấp cần kiểm chứng khi pilot; không cộng phí thuê bao website vào usage
        API.
      </Notice>
    </>
  );
}
