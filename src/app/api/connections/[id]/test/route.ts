import { ownerUser } from '@/lib/auth';
import { uuid } from '@/lib/schemas';
import { connectionKey } from '@/lib/ai/provider';
import { verifyConnection } from '@/lib/ai/verify-connection';
import { checkOrigin, json, failure, rateLimit } from '@/lib/http';
import { AppError, dbError } from '@/lib/errors';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const { db, member } = await ownerUser();
    await rateLimit(`connection-test:${member.user_id}`, 10);
    const id = uuid.parse((await params).id),
      { data: c, error } = await db
        .from('connections')
        .select('id,provider,model')
        .eq('id', id)
        .eq('workspace_id', member.workspace_id)
        .maybeSingle();
    dbError(error);
    if (!c) throw new AppError('NOT_FOUND', 'Không tìm thấy kết nối.', 404);
    const key = await connectionKey(id);
    await verifyConnection(c.provider, c.model, key);
    return json({
      ok: true,
      message:
        'Khóa và model được API nhà cung cấp chấp nhận. Chưa thực hiện lượt chat tính phí hoặc kiểm tra hạn mức billing.',
    });
  } catch (e) {
    return failure(e);
  }
}
