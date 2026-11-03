'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutGrid,
  Folder,
  MessagesSquare,
  Plug,
  Users,
  ChartNoAxesCombined,
  Upload,
  Activity,
  Settings,
  LogOut,
  Menu,
  X,
  Search,
  ChevronDown,
} from 'lucide-react';
import { Mark, Avatar, money } from './ui';
import type { Member, Workspace, Usage } from '@/lib/types';
const main = [
  ['/overview', 'Tổng quan', LayoutGrid],
  ['/projects', 'Dự án', Folder],
  ['/library', 'Kho hội thoại', MessagesSquare],
] as const;
const admin = [
  ['/integrations', 'Nguồn AI', Plug],
  ['/team', 'Nhân viên', Users],
  ['/usage', 'Chi phí sử dụng', ChartNoAxesCombined],
  ['/imports', 'Nhập dữ liệu', Upload],
  ['/audit', 'Nhật ký hoạt động', Activity],
] as const;
export function Shell({
  member,
  workspace,
  usage,
  children,
}: {
  member: Member;
  workspace: Workspace;
  usage: Usage;
  children: React.ReactNode;
}) {
  const path = usePathname(),
    router = useRouter(),
    [open, setOpen] = useState(false),
    [logoutError, setLogoutError] = useState('');
  const budget = member.role === 'owner' ? workspace.monthly_budget : member.monthly_limit,
    used = Number(usage.recorded) + Number(usage.reserved),
    percent = budget ? Math.min(100, (used / budget) * 100) : 0;
  const links =
    member.role === 'owner'
      ? admin
      : ([['/usage', 'Sử dụng của tôi', ChartNoAxesCombined]] as const);
  function item([href, title, Icon]: readonly [string, string, typeof Folder]) {
    const active = path === href || path.startsWith(href + '/');
    return (
      <Link
        key={href}
        className={`nav-item ${active ? 'active' : ''}`}
        aria-current={active ? 'page' : undefined}
        href={href}
        onClick={() => setOpen(false)}
      >
        <Icon size={18} />
        <span>{title}</span>
      </Link>
    );
  }
  return (
    <div className="shell">
      <button
        className={`mobile-scrim ${open ? 'open' : ''}`}
        aria-label="Đóng điều hướng"
        onClick={() => setOpen(false)}
      />
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Điều hướng chính">
        <Link href="/overview" className="brand">
          <Mark />
          <span>
            nex<span className="font-normal"> ai hub</span>
          </span>
        </Link>
        <Link href="/settings" className="workspace-select">
          <span className="workspace-logo">N</span>
          <span className="workspace-info">
            <strong>{workspace.name}</strong>
            <br />
            <small>Không gian công việc</small>
          </span>
          <ChevronDown size={16} />
        </Link>
        <nav>
          <div className="nav-group">
            <div className="nav-label">KHÔNG GIAN LÀM VIỆC</div>
            {main.map(item)}
          </div>
          <div className="nav-group">
            <div className="nav-label">{member.role === 'owner' ? 'QUẢN TRỊ' : 'CÁ NHÂN'}</div>
            {links.map(item)}
          </div>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-budget">
            <span className="label">
              {member.role === 'owner' ? 'Ngân sách workspace' : 'Hạn mức của bạn'}
            </span>
            <div className="row between mt12">
              <strong>{money(used)}</strong>
              <span className="tiny muted">/ {money(budget)}</span>
            </div>
            <div className="track">
              <span style={{ width: `${percent}%` }} />
            </div>
            <span className="tiny muted">
              {usage.pending
                ? `${usage.pending} lượt chờ đối soát`
                : 'Chi phí API trong tháng · UTC'}
            </span>
          </div>
          {item(['/settings', 'Cài đặt', Settings])}
          <div className="sidebar-account">
            <Avatar name={member.display_name} />
            <div className="name">
              <strong>{member.display_name}</strong>
              <br />
              <small>{member.role === 'owner' ? 'Chủ doanh nghiệp' : 'Nhân viên'}</small>
            </div>
            <button
              className="icon-button"
              aria-label="Đăng xuất"
              onClick={async () => {
                try {
                  const res = await fetch('/api/auth/logout', { method: 'POST' });
                  if (!res.ok) throw new Error();
                  router.replace('/login');
                  router.refresh();
                } catch {
                  setLogoutError('Chưa thể đăng xuất. Thử lại khi có kết nối.');
                }
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
          {logoutError ? (
            <p role="alert" className="form-error">
              {logoutError}
            </p>
          ) : null}
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <div className="row gap6">
            <button
              className="icon-button nav-toggle"
              aria-label={open ? 'Đóng điều hướng' : 'Mở điều hướng'}
              onClick={() => setOpen(!open)}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="breadcrumbs">
              <span className="breadcrumb-parent">Không gian làm việc</span>
              <span className="breadcrumb-parent">/</span>
              <span>
                {[...main, ...admin, ['/settings', 'Cài đặt', Settings] as const].find(([href]) =>
                  path.startsWith(href),
                )?.[1] || 'Hội thoại'}
              </span>
            </div>
          </div>
          <div className="top-actions">
            <Link href="/library" className="search-trigger" aria-label="Tìm kiếm hội thoại">
              <Search size={18} />
              <span>Tìm trong không gian làm việc…</span>
            </Link>
            <Avatar name={member.display_name} />
          </div>
        </header>
        <main id="main" className="content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
