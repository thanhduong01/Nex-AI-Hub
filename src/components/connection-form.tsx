import { ActionForm } from './forms';
import { Notice } from './ui';
import type { Connection, Member } from '@/lib/types';
export function ConnectionForm({
  connection,
  people,
  grants = [],
}: {
  connection?: Connection;
  people: Member[];
  grants?: string[];
}) {
  const prefix = connection?.id || 'new';
  return (
    <ActionForm
      kind="connection"
      initial={connection ? { id: connection.id, provider: connection.provider } : {}}
      label={connection ? 'Lưu kết nối' : 'Tạo kết nối'}
    >
      <div className="form-grid">
        <div className="field">
          <label htmlFor={`${prefix}-provider`}>Nhà cung cấp</label>
          <select
            id={`${prefix}-provider`}
            name="provider"
            className="input"
            defaultValue={connection?.provider || 'openai'}
            disabled={!!connection}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Claude / Anthropic</option>
            <option value="google">Gemini / Google</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${prefix}-name`}>Tên kết nối</label>
          <input
            id={`${prefix}-name`}
            name="name"
            className="input"
            required
            maxLength={100}
            defaultValue={connection?.name}
            placeholder="Kết nối của công ty"
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-model`}>Model ID</label>
        <input
          id={`${prefix}-model`}
          name="model"
          className="input"
          required
          maxLength={120}
          defaultValue={connection?.model}
          placeholder="Model ID trong tài khoản API của bạn"
        />
        <p className="hint">Dùng model chat văn bản mà API key được phép truy cập.</p>
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-key`}>
          {connection ? 'Thay API key (để trống nếu giữ nguyên)' : 'API key'}
        </label>
        <input
          id={`${prefix}-key`}
          name="api_key"
          type="password"
          autoComplete="new-password"
          className="input"
          minLength={10}
          maxLength={500}
          required={!connection}
        />
        <p className="hint">
          Mã hóa trước khi lưu. Khóa đã lưu không được gửi trở lại trình duyệt.
        </p>
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor={`${prefix}-input`}>USD / 1 triệu input token</label>
          <input
            id={`${prefix}-input`}
            name="input_price"
            type="number"
            min="0"
            max="10000"
            step="0.000001"
            className="input"
            required
            defaultValue={connection?.input_price}
          />
        </div>
        <div className="field">
          <label htmlFor={`${prefix}-output`}>USD / 1 triệu output token</label>
          <input
            id={`${prefix}-output`}
            name="output_price"
            type="number"
            min="0"
            max="10000"
            step="0.000001"
            className="input"
            required
            defaultValue={connection?.output_price}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-cap`}>Giới hạn output token / lượt</label>
        <input
          id={`${prefix}-cap`}
          name="max_output_tokens"
          className="input"
          type="number"
          min="128"
          max="8192"
          required
          defaultValue={connection?.max_output_tokens || 2048}
        />
      </div>
      <Notice>
        Điền đơn giá hiện hành từ nhà cung cấp. Giá dùng để giữ trước ngân sách, cần đối soát với
        hóa đơn thực tế. Không dùng giá gói Plus/Pro thay cho giá API.
      </Notice>
      <fieldset className="mt24 mb24">
        <legend className="small">Cấp quyền sử dụng</legend>
        {people
          .filter((p) => p.role !== 'owner' && p.status === 'active')
          .map((p) => (
            <label className="check-field mt12" key={p.user_id}>
              <input
                type="checkbox"
                name="grants"
                value={p.user_id}
                defaultChecked={grants.includes(p.user_id)}
              />
              {p.display_name}
            </label>
          ))}
      </fieldset>
      <label className="check-field mb24">
        <input type="checkbox" name="enabled" defaultChecked={connection?.enabled || false} />
        Bật kết nối cho người được cấp quyền
      </label>
    </ActionForm>
  );
}
