import { pageUser } from '@/lib/auth';
import { projectsData } from '@/lib/data';
import { Heading, ProjectCard, Notice, Empty } from '@/components/ui';
import { NewProject } from '@/components/project-forms';
export default async function Projects({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; archived?: string }>;
}) {
  const { member } = await pageUser(),
    params = await searchParams,
    projects = await projectsData(params.archived === '1');
  const filtered = projects.filter(
    (p) =>
      !params.q ||
      `${p.name} ${p.description}`
        .toLocaleLowerCase('vi')
        .includes(params.q.toLocaleLowerCase('vi')),
  );
  return (
    <>
      <Heading
        title={member.role === 'owner' ? 'Tất cả dự án' : 'Dự án của tôi'}
        description="Sắp xếp ý tưởng, tài liệu và hội thoại theo mục tiêu công việc."
      >
        <NewProject />
      </Heading>
      <Notice>
        {member.role === 'owner'
          ? 'Bạn xem được toàn bộ dự án công việc. Quyền đóng góp được cấp riêng.'
          : 'Bạn thấy dự án của mình và dự án được chia sẻ. Chủ doanh nghiệp có quyền xem nội dung công việc.'}
      </Notice>
      <form className="toolbar">
        <input
          className="input"
          type="search"
          name="q"
          aria-label="Tìm dự án"
          placeholder="Tìm dự án…"
          defaultValue={params.q}
        />
        <label className="check-field">
          <input
            name="archived"
            type="checkbox"
            value="1"
            defaultChecked={params.archived === '1'}
          />
          Bao gồm dự án lưu trữ
        </label>
        <button className="btn">Lọc dự án</button>
      </form>
      {filtered.length ? (
        <div className="project-grid">
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      ) : (
        <Empty
          title="Chưa có dự án phù hợp"
          description="Tạo dự án mới hoặc thử một từ khóa khác."
        />
      )}
      <p className="tiny muted mt24">
        Hiển thị tối đa 100 dự án cập nhật gần nhất trong phạm vi được phép xem.
      </p>
    </>
  );
}
