import { pageUser } from '@/lib/auth';
import { workspaceData } from '@/lib/data';
import { Shell } from '@/components/shell';
export const dynamic = 'force-dynamic';
export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const { member } = await pageUser();
  const { workspace, usage } = await workspaceData();
  return (
    <Shell member={member} workspace={workspace} usage={usage}>
      {children}
    </Shell>
  );
}
