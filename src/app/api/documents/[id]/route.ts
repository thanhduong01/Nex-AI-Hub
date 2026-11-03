import { currentUser } from '@/lib/auth';
import { adminClient } from '@/lib/supabase/admin';
import { uuid } from '@/lib/schemas';
import { AppError, dbError } from '@/lib/errors';
import { failure } from '@/lib/http';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = uuid.parse((await params).id),
      { db } = await currentUser();
    const { data: file, error } = await db.from('documents').select('*').eq('id', id).maybeSingle();
    dbError(error);
    if (!file)
      throw new AppError('NOT_FOUND', 'Không tìm thấy tài liệu hoặc bạn chưa được cấp quyền.', 404);
    dbError(
      (
        await db.rpc('record_access', {
          p_project: file.project_id,
          p_action: 'document.download',
          p_resource: id,
        })
      ).error,
    );
    const result = await adminClient().storage.from('project-files').download(file.storage_path);
    dbError(result.error);
    if (!result.data) throw new AppError('NOT_FOUND', 'Tệp không còn trong kho lưu trữ.', 404);
    return new Response(result.data, {
      headers: {
        'Content-Type': file.mime_type,
        'Content-Disposition': `attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return failure(e);
  }
}
