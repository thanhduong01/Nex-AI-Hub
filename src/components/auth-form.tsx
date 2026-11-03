'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { loginSchema, email, password } from '@/lib/schemas';
import { z } from 'zod';
export function AuthForm({ mode = 'login' }: { mode?: 'login' | 'forgot' | 'password' }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const router = useRouter();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        const input = Object.fromEntries(new FormData(e.currentTarget));
        const schema =
          mode === 'login'
            ? loginSchema
            : mode === 'forgot'
              ? z.object({ email })
              : z.object({ password });
        const valid = schema.safeParse(input);
        if (!valid.success) {
          setError(valid.error.issues[0]?.message || 'Kiểm tra dữ liệu.');
          return;
        }
        setBusy(true);
        try {
          const res = await fetch(`/api/auth/${mode}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(valid.data),
          });
          const data = await res.json();
          if (!res.ok) {
            setError(data.message || 'Không thể thực hiện.');
            return;
          }
          if (mode === 'forgot') {
            setMessage(data.message);
            return;
          }
          router.replace(mode === 'login' ? '/overview' : '/login?password=updated');
          router.refresh();
        } catch {
          setError('Không kết nối được máy chủ. Vui lòng thử lại.');
        } finally {
          setBusy(false);
        }
      }}
    >
      {mode !== 'password' ? (
        <div className="field">
          <label htmlFor="email">Email công việc</label>
          <input
            id="email"
            name="email"
            className="input"
            type="email"
            autoComplete="email"
            placeholder="ban@congty.vn"
            required
            disabled={busy}
          />
        </div>
      ) : null}
      {mode !== 'forgot' ? (
        <div className="field">
          <div className="row between">
            <label htmlFor="password">{mode === 'password' ? 'Mật khẩu mới' : 'Mật khẩu'}</label>
            {mode === 'login' ? (
              <Link href="/forgot-password" className="text-link small">
                Quên mật khẩu?
              </Link>
            ) : null}
          </div>
          <input
            id="password"
            name="password"
            className="input"
            type="password"
            autoComplete={mode === 'password' ? 'new-password' : 'current-password'}
            minLength={mode === 'password' ? 12 : 1}
            maxLength={128}
            required
            disabled={busy}
          />
          {mode === 'password' ? (
            <p className="hint">
              Ít nhất 12 ký tự. Sau khi đổi, đăng nhập lại để bắt đầu phiên mới.
            </p>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="form-success" role="status">
          {message}
        </p>
      ) : null}
      <button type="submit" className="btn primary full" disabled={busy}>
        {busy
          ? 'Đang xử lý…'
          : mode === 'login'
            ? 'Vào không gian làm việc'
            : mode === 'forgot'
              ? 'Gửi hướng dẫn khôi phục'
              : 'Lưu mật khẩu'}
      </button>
      {mode === 'login' ? (
        <p className="small muted mt24">
          Giữ đăng nhập 7 ngày trên thiết bị này. Dự án công việc được chủ doanh nghiệp quản lý.
        </p>
      ) : (
        <Link href="/login" className="text-link mt24">
          Về đăng nhập
        </Link>
      )}
    </form>
  );
}
