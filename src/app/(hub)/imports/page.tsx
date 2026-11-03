import { notFound } from 'next/navigation';
import { pageUser } from '@/lib/auth';
import { projectsData } from '@/lib/data';
import { dbError } from '@/lib/errors';
import { Heading } from '@/components/ui';
import { ImportWizard } from '@/components/import-wizard';
export default async function Imports() {
  const { member, db } = await pageUser();
  if (member.role !== 'owner') notFound();
  const [projects, { data: grants, error }] = await Promise.all([
    projectsData(),
    db
      .from('project_members')
      .select('project_id')
      .eq('user_id', member.user_id)
      .eq('permission', 'contributor'),
  ]);
  dbError(error);
  return (
    <>
      <Heading
        title="Nhập dữ liệu"
        description="Tập trung hội thoại từ các nền tảng vào đúng dự án công việc."
      />
      <ImportWizard
        projects={projects.filter(
          (p) => p.created_by === member.user_id || grants?.some((g) => g.project_id === p.id),
        )}
      />
    </>
  );
}
