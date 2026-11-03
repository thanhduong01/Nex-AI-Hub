import Link from 'next/link';
import { notFound } from 'next/navigation';
import { pageUser } from '@/lib/auth';
import { dbError } from '@/lib/errors';
import { Heading, dateTime } from '@/components/ui';
const labels: Record<string, string> = {
  'projects.insert': 'Tạo dự án',
  'projects.update': 'Cập nhật dự án',
  'project_members.insert': 'Chia sẻ dự án',
  'project_members.update': 'Đổi quyền dự án',
  'project_members.delete': 'Thu hồi chia sẻ',
  'connection.save': 'Cấu hình nguồn AI',
  'employee.update': 'Cập nhật nhân viên',
  'employee.invite': 'Mời nhân viên',
  'workspaces.update': 'Cấu hình workspace',
  'members.update': 'Cập nhật hồ sơ',
  'provider_accounts.insert': 'Thêm tài khoản AI',
  'provider_accounts.update': 'Cập nhật tài khoản AI',
  'conversation.read': 'Xem hội thoại',
  'conversation.export': 'Xuất hội thoại',
  'document.download': 'Tải tài liệu',
  'history.import': 'Nhập lịch sử',
  'usage.reconcile': 'Đối soát usage',
};
export default async function Audit({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { db, member } = await pageUser();
  if (member.role !== 'owner') notFound();
  const page = Math.max(0, Number.parseInt((await searchParams).page || '0') || 0);
  const [{ data, error }, { data: people, error: b }] = await Promise.all([
    db
      .from('audit_events')
      .select('id,actor_id,action,resource_id,created_at')
      .order('created_at', { ascending: false })
      .range(page * 50, page * 50 + 49),
    db.from('members').select('user_id,display_name'),
  ]);
  dbError(error);
  dbError(b);
  return (
    <>
      <Heading
        title="Nhật ký hoạt động"
        description="Theo dõi truy cập và thay đổi quan trọng; không ghi nội dung prompt hoặc khóa API."
      />
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Người thực hiện</th>
              <th>Hoạt động</th>
              <th>Tài nguyên</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((row) => (
              <tr key={row.id}>
                <td>{dateTime(row.created_at)}</td>
                <td>
                  {people?.find((p) => p.user_id === row.actor_id)?.display_name || 'Hệ thống'}
                </td>
                <td>{labels[row.action] || row.action}</td>
                <td className="mono tiny">{row.resource_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data?.length ? <p className="empty muted">Chưa có hoạt động.</p> : null}
      </div>
      <div className="row mt24">
        {page > 0 ? (
          <Link className="btn" href={`?page=${page - 1}`}>
            Trang trước
          </Link>
        ) : null}
        {data?.length === 50 ? (
          <Link className="btn" href={`?page=${page + 1}`}>
            Trang tiếp
          </Link>
        ) : null}
      </div>
    </>
  );
}
