'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import * as actions from '@/app/actions';
import {
  projectSchema,
  shareSchema,
  conversationSchema,
  connectionSchema,
  accountSchema,
  employeeSchema,
  workspaceSchema,
  inviteSchema,
} from '@/lib/schemas';
import type { ActionResult } from '@/lib/types';
type Kind =
  | 'project'
  | 'edit-project'
  | 'share'
  | 'conversation'
  | 'connection'
  | 'account'
  | 'employee'
  | 'workspace'
  | 'profile'
  | 'invite'
  | 'reconcile';
const schemas = {
  project: projectSchema,
  'edit-project': projectSchema,
  share: shareSchema,
  conversation: conversationSchema,
  connection: connectionSchema,
  account: accountSchema,
  employee: employeeSchema,
  workspace: workspaceSchema,
  profile: z.object({ display_name: z.string().trim().min(1).max(100) }),
  invite: inviteSchema,
  reconcile: z.object({ id: z.string().uuid(), actual_cost: z.coerce.number().min(0) }),
};
export function ActionForm({
  kind,
  initial = {},
  children,
  label = 'Lưu thay đổi',
  className = '',
  confirmText,
}: {
  kind: Kind;
  initial?: Record<string, unknown>;
  children: React.ReactNode;
  label?: string;
  className?: string;
  confirmText?: string;
}) {
  const [busy, start] = useTransition(),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [savedConnection, setSavedConnection] = useState(false);
  const router = useRouter();
  return (
    <form
      className={className}
      onInvalidCapture={(e) => {
        const target = e.target as HTMLElement;
        const details = target.closest('details');
        if (details) details.open = true;
      }}
      onChange={() => {
        if (kind === 'connection') {
          setSavedConnection(false);
          setMessage('');
        }
      }}
      onSubmit={(e) => {
        e.preventDefault();
        if (busy || savedConnection) return;
        setError('');
        setMessage('');
        const form = e.currentTarget,
          fd = new FormData(form);
        const input: Record<string, unknown> = { ...initial, ...Object.fromEntries(fd) };
        if (kind === 'connection') {
          input.enabled = fd.has('enabled');
          input.grants = fd.getAll('grants');
          if (!input.api_key) delete input.api_key;
        }
        if (kind === 'account') input.renewal_date = input.renewal_date || null;
        const valid = schemas[kind].safeParse(input);
        if (!valid.success) {
          setError(valid.error.issues[0]?.message || 'Kiểm tra dữ liệu.');
          return;
        }
        if (confirmText && !window.confirm(confirmText)) return;
        start(async () => {
          try {
            let res: ActionResult;
            switch (kind) {
              case 'project':
                res = await actions.createProject(input);
                break;
              case 'edit-project':
                res = await actions.updateProject(String(initial.id), input);
                break;
              case 'share':
                res = await actions.shareProject(input);
                break;
              case 'conversation':
                res = await actions.createConversation(input);
                break;
              case 'connection':
                res = await actions.saveConnection(input);
                break;
              case 'account':
                res = await actions.saveAccount(input);
                break;
              case 'employee':
                res = await actions.saveEmployee(input);
                break;
              case 'workspace':
                res = await actions.saveWorkspace(input);
                break;
              case 'profile':
                res = await actions.saveProfile(input);
                break;
              case 'invite':
                res = await actions.inviteEmployee(input);
                break;
              case 'reconcile':
                res = await actions.reconcileRun(input);
                break;
            }
            if (res.error) {
              setError(res.error);
              return;
            }
            if (res.id && (kind === 'project' || kind === 'conversation')) {
              form.closest('dialog')?.close();
              router.push(`${kind === 'project' ? '/projects' : '/chat'}/${res.id}`);
            } else {
              if (kind === 'connection') {
                const keyInput = form.querySelector<HTMLInputElement>('input[name="api_key"]');
                if (keyInput) keyInput.value = '';
                setSavedConnection(true);
              }
              setMessage(res.message || 'Đã lưu thay đổi.');
              router.refresh();
            }
          } catch {
            setError('Mất kết nối. Vui lòng kiểm tra lại trước khi gửi lần nữa.');
          }
        });
      }}
    >
      <fieldset disabled={busy}>
        {children}
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
        <button type="submit" className="btn primary" disabled={busy || savedConnection}>
          {busy
            ? kind === 'connection'
              ? 'Đang kiểm tra và lưu…'
              : 'Đang xử lý…'
            : savedConnection
              ? 'Đã lưu kết nối'
              : label}
        </button>
      </fieldset>
    </form>
  );
}
export function ArchiveButton({ id, archived }: { id: string; archived: boolean }) {
  const [busy, start] = useTransition(),
    [error, setError] = useState('');
  const router = useRouter();
  return (
    <div>
      <button
        className="btn"
        disabled={busy}
        onClick={() => {
          if (
            !window.confirm(
              archived
                ? 'Khôi phục dự án này?'
                : 'Lưu trữ dự án? Nội dung vẫn đọc được; gửi AI mới sẽ bị dừng.',
            )
          )
            return;
          start(async () => {
            try {
              const res = await actions.archiveProject(id, !archived);
              if (res.error) setError(res.error);
              else router.refresh();
            } catch {
              setError('Mất kết nối. Vui lòng thử lại.');
            }
          });
        }}
      >
        {busy ? 'Đang lưu…' : archived ? 'Khôi phục' : 'Lưu trữ dự án'}
      </button>
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
export function TestConnection({ id }: { id: string }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  return (
    <div>
      <button
        className="btn"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const res = await fetch(`/api/connections/${id}/test`, { method: 'POST' });
            const body = await res.json();
            setMessage(body.message);
          } catch {
            setMessage('Không kiểm tra được kết nối.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Đang kiểm tra…' : 'Kiểm tra khóa'}
      </button>
      {message ? (
        <p className="small muted mt12" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
