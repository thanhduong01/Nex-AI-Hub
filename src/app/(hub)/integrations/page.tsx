import Link from 'next/link';
import { CONNECTION_PRESETS } from '@/lib/connection-presets';
import { notFound } from 'next/navigation';
import { pageUser } from '@/lib/auth';
import { connectionsData } from '@/lib/data';
import { dbError } from '@/lib/errors';
import { Heading, Notice, ProviderMark, Badge } from '@/components/ui';
import { ConnectionForm } from '@/components/connection-form';
import { ActionForm, TestConnection } from '@/components/forms';
import { Modal } from '@/components/modal';
import { PROVIDERS, type Member, type Provider, type ProviderAccount } from '@/lib/types';
export default async function Integrations() {
  const { member, db } = await pageUser();
  if (member.role !== 'owner') notFound();
  const [
    connections,
    { data: people, error: a },
    { data: grants, error: b },
    { data: accounts, error: c },
    { data: workspace, error: d },
  ] = await Promise.all([
    connectionsData(),
    db.from('members').select('*'),
    db.from('connection_grants').select('*'),
    db.from('provider_accounts').select('*'),
    db.from('workspaces').select('monthly_budget').eq('id', member.workspace_id).single(),
  ]);
  dbError(a);
  dbError(b);
  dbError(c);
  dbError(d);
  const directory = people as Member[];
  return (
    <>
      <Heading
        title="Nguồn AI"
        description="Chọn AI cho nhóm. Bạn kết nối một lần, nhân viên sử dụng trong Hub."
      />
      <Notice>
        Chọn nền tảng → dán API key → kết nối. Hub chọn sẵn model; bạn có thể chỉnh trong Tùy chọn
        nâng cao.
      </Notice>
      {Number(workspace?.monthly_budget) <= 0 ? (
        <Notice tone="amber">
          Ngân sách workspace đang là $0.{' '}
          <Link className="text-link" href="/usage">
            Đặt ngân sách
          </Link>{' '}
          để bắt đầu chat sau khi kết nối.
        </Notice>
      ) : null}
      <div className="section-heading">
        <h2>Chọn nền tảng AI</h2>
      </div>
      <div className="provider-grid">
        {(Object.keys(CONNECTION_PRESETS) as Provider[]).map((provider) => {
          const preset = CONNECTION_PRESETS[provider];
          const sources = connections.filter((connection) => connection.provider === provider);
          return (
            <section key={provider} className="panel provider-card source-card">
              <div className="row between">
                <div className="row">
                  <ProviderMark provider={provider} />
                  <h3>{preset.name}</h3>
                </div>
                <Badge tone={sources.some((c) => c.enabled) ? 'green' : ''}>
                  {sources.length
                    ? `${sources.filter((c) => c.enabled).length} nguồn đang bật`
                    : 'Chưa kết nối'}
                </Badge>
              </div>
              <p className="provider-intro">{preset.description}</p>
              <ul className="source-list">
                {sources.map((connection) => (
                  <li key={connection.id}>
                    <div className="row between source-detail">
                      <div>
                        <strong>{connection.name}</strong>
                        <p className="small muted">{connection.model}</p>
                      </div>
                      <Badge tone={connection.enabled ? 'green' : ''}>
                        {connection.enabled ? 'Đang bật' : 'Đang tắt'}
                      </Badge>
                    </div>
                    <p className="tiny muted">
                      {grants?.filter((g) => g.connection_id === connection.id).length || 0} nhân
                      viên được cấp quyền
                    </p>
                    <div className="row source-actions">
                      <Modal title={`Quản lý ${connection.name}`} trigger="Quản lý">
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
                    </div>
                  </li>
                ))}
              </ul>
              <footer>
                <span className="small muted">
                  {sources.length
                    ? 'Dùng thêm model hoặc API key khác'
                    : `Model gợi ý: ${preset.modelLabel}`}
                </span>
                <Modal
                  title={`Kết nối ${preset.name}`}
                  description="Dán API key để nhóm chat ngay trong Hub."
                  trigger={sources.length ? 'Thêm kết nối' : 'Kết nối'}
                  primary={!sources.length}
                >
                  <ConnectionForm people={directory} provider={provider} />
                </Modal>
              </footer>
            </section>
          );
        })}
        <section className="panel provider-card source-card">
          <div className="row between">
            <div className="row">
              <ProviderMark provider="meta" />
              <h3>Meta AI</h3>
            </div>
            <Badge tone="amber">Chỉ nhập hội thoại</Badge>
          </div>
          <p className="provider-intro">
            Hub chưa hỗ trợ chat trực tiếp với Meta AI. Bạn có thể nhập hội thoại đã có để lưu chung
            theo dự án.
          </p>
          <footer>
            <span className="small muted">Định dạng Nex JSON</span>
            <Link className="btn" href="/imports">
              Nhập hội thoại
            </Link>
          </footer>
        </section>
      </div>
      <p className="hint mt24">
        Nhân viên chỉ đăng nhập Hub; API key được mã hóa và không hiển thị cho họ. Cấp hạn mức tại{' '}
        <Link className="text-link" href="/team">
          Nhân viên
        </Link>{' '}
        để họ có thể chat. Phí API tách riêng với gói Plus/Pro.
      </p>
      <details className="source-subscriptions mt32">
        <summary>
          Tài khoản & gói website <span className="small muted">Tùy chọn</span>
        </summary>
        <p className="small muted mt12 mb24">
          Chỉ theo dõi gói Plus/Pro, ngày gia hạn và ghi chú. Thông tin này không kết nối chat hay
          đồng bộ hội thoại website vào Hub.
        </p>
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
      </details>
    </>
  );
}
