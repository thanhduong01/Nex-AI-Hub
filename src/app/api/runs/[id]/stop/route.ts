import { currentUser } from '@/lib/auth';
import { uuid } from '@/lib/schemas';
import { checkOrigin, json, failure } from '@/lib/http';
import { dbError } from '@/lib/errors';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const { db } = await currentUser();
    const { error } = await db.rpc('request_stop', { p_run: uuid.parse((await params).id) });
    dbError(error);
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
