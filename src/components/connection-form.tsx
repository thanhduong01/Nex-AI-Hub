'use client';
import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { ActionForm } from './forms';
import { CONNECTION_PRESETS, PRESET_REVIEWED_ON } from '@/lib/connection-presets';
import type { Connection, Member, Provider } from '@/lib/types';

export function ConnectionForm({
  connection,
  people,
  grants = [],
  provider = 'openai',
}: {
  connection?: Connection;
  people: Member[];
  grants?: string[];
  provider?: Provider;
}) {
  const selected = connection?.provider || provider;
  const preset = CONNECTION_PRESETS[selected];
  const prefix = connection?.id || `new-${selected}`;
  const [custom, setCustom] = useState(!!connection);
  const employees = people.filter((p) => p.role !== 'owner' && p.status === 'active');
  const [selectedGrants, setSelectedGrants] = useState(
    connection ? grants : employees.map((p) => p.user_id),
  );
  const [model, setModel] = useState(connection?.model || preset.model);
  const [inputPrice, setInputPrice] = useState(
    String(connection?.input_price ?? preset.input_price),
  );
  const [outputPrice, setOutputPrice] = useState(
    String(connection?.output_price ?? preset.output_price),
  );
  return (
    <ActionForm
      kind="connection"
      className="connection-form"
      initial={{ ...(connection ? { id: connection.id } : {}), provider: selected }}
      label={connection ? 'Lưu thay đổi' : 'Kiểm tra và kết nối'}
    >
      <div className="field">
        <div className="row between connection-key-label">
          <label htmlFor={`${prefix}-key`}>
            {connection ? 'API key mới (nếu cần thay)' : 'API key'}
          </label>
          <a
            href={preset.keyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="connection-help-link"
          >
            Lấy API key <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
        <input
          id={`${prefix}-key`}
          name="api_key"
          type="password"
          autoComplete="new-password"
          className="input"
          minLength={10}
          maxLength={500}
          required={!connection}
          placeholder={connection ? 'Để trống để giữ khóa hiện tại' : `Dán API key ${preset.name}`}
          aria-describedby={`${prefix}-key-help`}
        />
        <p id={`${prefix}-key-help`} className="hint">
          Chỉ Owner thiết lập một lần. Nhân viên không thấy khóa này.
        </p>
      </div>
      <div className="connection-summary">
        <span className="eyebrow">{connection || custom ? 'Model đang chọn' : 'Model gợi ý'}</span>
        <strong>{custom ? model || 'Chưa chọn model' : preset.modelLabel}</strong>
        <p className="small muted">
          {selectedGrants.length
            ? `${selectedGrants.length} nhân viên được cấp quyền sử dụng.`
            : 'Hiện chỉ Owner sử dụng nguồn này.'}{' '}
          Có thể chỉnh bên dưới.
        </p>
      </div>
      <details className="connection-advanced">
        <summary>
          Tùy chọn nâng cao <span className="small muted">Model, chi phí và quyền sử dụng</span>
        </summary>
        <div className="connection-advanced-body">
          <div className="field">
            <label htmlFor={`${prefix}-name`}>Tên nguồn</label>
            <input
              id={`${prefix}-name`}
              name="name"
              className="input"
              required
              maxLength={100}
              defaultValue={connection?.name || preset.name}
            />
          </div>
          <label className="check-field mb24">
            <input
              type="checkbox"
              checked={custom}
              onChange={(e) => {
                setCustom(e.target.checked);
                if (!e.target.checked) {
                  setModel(preset.model);
                  setInputPrice(String(preset.input_price));
                  setOutputPrice(String(preset.output_price));
                }
              }}
            />
            Tự chọn model và đơn giá
          </label>
          {custom ? (
            <>
              <div className="field">
                <label htmlFor={`${prefix}-model`}>Model ID</label>
                <input
                  id={`${prefix}-model`}
                  name="model"
                  className="input"
                  required
                  maxLength={120}
                  value={model}
                  onChange={(e) => {
                    setModel(e.target.value);
                    setInputPrice('');
                    setOutputPrice('');
                  }}
                />
              </div>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor={`${prefix}-input`}>USD / 1 triệu token đầu vào</label>
                  <input
                    id={`${prefix}-input`}
                    name="input_price"
                    type="number"
                    min="0"
                    max="10000"
                    step="0.000001"
                    className="input"
                    required
                    value={inputPrice}
                    onChange={(e) => setInputPrice(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`${prefix}-output`}>USD / 1 triệu token đầu ra</label>
                  <input
                    id={`${prefix}-output`}
                    name="output_price"
                    type="number"
                    min="0"
                    max="10000"
                    step="0.000001"
                    className="input"
                    required
                    value={outputPrice}
                    onChange={(e) => setOutputPrice(e.target.value)}
                  />
                </div>
              </div>
              <p className="hint">Đổi model cần nhập lại đúng đơn giá của model đó.</p>
            </>
          ) : (
            <>
              <input type="hidden" name="model" value={preset.model} />
              <input type="hidden" name="input_price" value={preset.input_price} />
              <input type="hidden" name="output_price" value={preset.output_price} />
              <p className="small muted">
                Đơn giá tham khảo: ${preset.input_price} đầu vào / ${preset.output_price} đầu ra mỗi
                triệu token. Kiểm tra ngày {PRESET_REVIEWED_ON}.
              </p>
            </>
          )}
          <p className="hint">
            <a href={preset.pricingUrl} target="_blank" rel="noopener noreferrer">
              Xem đơn giá nhà cung cấp
            </a>
            . Hub dùng giá này để giữ ngân sách và ước tính chi phí.
          </p>
          <div className="field mt24">
            <label htmlFor={`${prefix}-cap`}>Giới hạn token phản hồi mỗi lượt</label>
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
          <fieldset className="mt24 mb24">
            <legend className="small">Nhân viên được sử dụng</legend>
            {employees.length ? (
              employees.map((person) => (
                <label className="check-field mt12" key={person.user_id}>
                  <input
                    type="checkbox"
                    name="grants"
                    value={person.user_id}
                    checked={selectedGrants.includes(person.user_id)}
                    onChange={(e) =>
                      setSelectedGrants((ids) =>
                        e.target.checked
                          ? [...ids, person.user_id]
                          : ids.filter((id) => id !== person.user_id),
                      )
                    }
                  />
                  {person.display_name}
                </label>
              ))
            ) : (
              <p className="hint">
                Chưa có nhân viên. Bạn có thể cấp quyền sau khi mời họ vào Hub.
              </p>
            )}
          </fieldset>
          <label className="check-field">
            <input type="checkbox" name="enabled" defaultChecked={connection?.enabled ?? true} />
            Bật nguồn AI này
          </label>
        </div>
      </details>
      <p className="hint mb24">
        Sử dụng API được tính phí riêng với gói Plus/Pro. Bước kiểm tra kết nối không gửi câu hỏi
        tới AI.
      </p>
    </ActionForm>
  );
}
