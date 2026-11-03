import { notFound } from 'next/navigation';
import { pageUser } from '@/lib/auth';
import { connectionsData } from '@/lib/data';
import { dbError } from '@/lib/errors';
import { Heading, Notice, ProviderMark, Badge } from '@/components/ui';
import { ConnectionForm } from '@/components/connection-form';
import { ActionForm, TestConnection } from '@/components/forms';
import { Modal } from '@/components/modal';
import { PROVIDERS, type Member, type ProviderAccount } from '@/lib/types';
export default async function Integrations() {
  const { member, db } = await pageUser();
  if (member.role !== 'owner') notFound();
  const [
    connections,
    { data: people, error: a },
    { data: grants, error: b },
    { data: accounts, error: c },
  ] = await Promise.all([
    connectionsData(),
    db.from('members').select('*'),
    db.from('connection_grants').select('*'),
    db.from('provider_accounts').select('*'),
  ]);
  dbError(a);
  dbError(b);
  dbError(c);
  const directory = people as Member[];
  return (
    <>
      <Heading
        title="Nguồn AI"
        description="Quản lý kết nối chung và tài khoản AI của doanh nghiệp."
      >
        <Modal title="Thêm kết nối API" trigger="Thêm kết nối" primary>
          <ConnectionForm people={directory} />
        </Modal>
      </Heading>
      <Notice>
        Nhân viên chỉ đăng nhập Hub. API key không hiển thị cho nhân viên; thuê bao website được
        quản lý riêng ở bên dưới.
      </Notice>
      <div className="section-heading">
        <h2>Kết nối API ({connections.length})</h2>
      </div>
      <div className="provider-grid">
        {connections.map((connection) => (
          <section key={connection.id} className="panel provider-card">
            <div className="row between">
              <div className="row">
                <ProviderMark provider={connection.provider} />
                <div>
                  <h3>{connection.name}</h3>
                  <span className="tiny muted">{PROVIDERS[connection.provider].name}</span>
                </div>
              </div>
              <Badge tone={connection.enabled ? 'green' : ''}>
                {connection.enabled ? 'Đang bật' : 'Đang tắt'}
              </Badge>
            </div>
            <p className="provider-intro">{connection.model}</p>
            <div className="provider-key">
              API key đã mã hóa ·{' '}
              {grants?.filter((g) => g.connection_id === connection.id).length || 0} nhân viên được
              cấp
            </div>
            <footer>
              <Modal title="Cấu hình kết nối" trigger="Quản lý">
                <ConnectionForm
                  connection={connection}
                  people={directory}
                  grants={
                    grants
                      ?.filter((g) => g.connection_id === connection.id)
                      .map((g) => g.user_id) || []
                  }
                />
              </Modal>
              <TestConnection id={connection.id} />
            </footer>
          </section>
        ))}
        <section className="panel provider-card">
          <div className="row between">
            <h3>Meta AI</h3>
            <Badge tone="amber">Chưa tích hợp API</Badge>
          </div>
          <p className="provider-intro">
            Có thể quản lý tài khoản và nhập nội dung qua định dạng Nex JSON. Chat trực tiếp chỉ
            được mở sau khi kiểm chứng quyền API.
          </p>
        </section>
      </div>
      <div className="section-heading mt32">
        <h2>Tài khoản & gói hiện có</h2>
        <span className="tiny muted">Thông tin quản lý, không lưu mật khẩu website</span>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nền tảng</th>
              <th>Gói</th>
              <th>Gia hạn</th>
              <th>Ghi chú</th>
              <th>Quản lý</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(PROVIDERS).map(([id, p]) => {
              const account = (accounts as ProviderAccount[])?.find((a) => a.provider === id);
              return (
                <tr key={id}>
                  <td>
                    <div className="row">
                      <ProviderMark provider={id as keyof typeof PROVIDERS} />
                      <strong>{p.name}</strong>
                    </div>
                  </td>
                  <td>{account?.plan || 'Chưa ghi nhận'}</td>
                  <td>{account?.renewal_date || 'Chưa thiết lập'}</td>
                  <td className="small muted">{account?.notes || '—'}</td>
                  <td>
                    <Modal title={`Tài khoản ${p.name}`} trigger="Chỉnh sửa">
                      <ActionForm kind="account" initial={{ provider: id }}>
                        <div className="field">
                          <label htmlFor={`${id}-label`}>Tên bản ghi</label>
                          <input
                            id={`${id}-label`}
                            className="input"
                            name="label"
                            maxLength={100}
                            required
                            defaultValue={account?.label || p.name}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`${id}-plan`}>Tên gói</label>
                          <input
                            id={`${id}-plan`}
                            className="input"
                            name="plan"
                            maxLength={100}
                            defaultValue={account?.plan || ''}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`${id}-renew`}>Ngày gia hạn</label>
                          <input
                            id={`${id}-renew`}
                            className="input"
                            type="date"
                            name="renewal_date"
                            defaultValue={account?.renewal_date || ''}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`${id}-notes`}>Ghi chú</label>
                          <textarea
                            id={`${id}-notes`}
                            className="input"
                            name="notes"
                            maxLength={1000}
                            defaultValue={account?.notes || ''}
                          />
                        </div>
                      </ActionForm>
                    </Modal>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
