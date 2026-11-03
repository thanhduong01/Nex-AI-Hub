import Link from 'next/link';
import { Folder, MessageSquare, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { PROVIDERS, type Project, type Connection } from '@/lib/types';
export const money = (value: number | string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 4,
  }).format(Number(value));
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
export function Mark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path
          d="M5 17V7h3l8 10h3V7M5 7l14 10"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
export function Avatar({ name }: { name: string }) {
  return (
    <span className="avatar" title={name}>
      {name
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()}
    </span>
  );
}
export function Badge({ children, tone = '' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}
export function ProviderMark({ provider }: { provider: keyof typeof PROVIDERS }) {
  const p = PROVIDERS[provider];
  return (
    <span className={`provider-symbol ${p.className}`} aria-hidden="true">
      {p.letter}
    </span>
  );
}
export function Heading({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
export function Notice({ children, tone = '' }: { children: React.ReactNode; tone?: string }) {
  return (
    <div className={`info-banner ${tone}`}>
      <ShieldCheck size={17} />
      <span>{children}</span>
    </div>
  );
}
export function Empty({
  title = 'Chưa có nội dung',
  description,
  children,
}: {
  title?: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="panel empty">
      <div className="empty-icon">
        <Folder size={25} />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note?: string;
}) {
  return (
    <div className="metric">
      <div className="metric-top">{label}</div>
      <div className="metric-number">{value}</div>
      {note ? <p className="tiny muted mt12">{note}</p> : null}
    </div>
  );
}
export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/projects/${project.id}`} className="project-card">
      <div className="row between">
        <span className="project-icon green">
          <Folder size={19} />
        </span>
        <Badge>{project.archived_at ? 'Đã lưu trữ' : project.category}</Badge>
      </div>
      <h3>{project.name}</h3>
      <p>{project.description || 'Không gian lưu ý tưởng, tài liệu và trao đổi của dự án.'}</p>
      <footer>
        <span className="row gap6">
          <MessageSquare size={14} />
          Mở dự án
        </span>
        <ArrowUpRight size={16} />
      </footer>
    </Link>
  );
}
export function ConnectionOptions({ connections }: { connections: Connection[] }) {
  return (
    <>
      {connections
        .filter((c) => c.enabled)
        .map((c) => (
          <option key={c.id} value={c.id}>
            {PROVIDERS[c.provider].name} · {c.model}
          </option>
        ))}
    </>
  );
}
