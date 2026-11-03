import { createHash } from 'node:crypto';
import { ownerUser } from '@/lib/auth';
import { importSchema } from '@/lib/schemas';
import { checkOrigin, readJson, rateLimit, json, failure } from '@/lib/http';
import { adminClient } from '@/lib/supabase/admin';
import { dbError } from '@/lib/errors';
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { member, sessionId } = await ownerUser();
    await rateLimit(`import:${member.user_id}`, 10, 3600);
    const d = await readJson(request, importSchema, 1000000);
    const items = d.items.map((item) => ({
      ...item,
      hash: createHash('sha256')
        .update(
          JSON.stringify({
            source: item.source,
            source_id: item.source_id,
            messages: item.messages.map((m) => ({
              role: m.role,
              content: m.content,
              created_at: m.created_at || null,
            })),
          }),
        )
        .digest('hex'),
    }));
    const { data, error } = await adminClient().rpc('import_conversations', {
      p_actor: member.user_id,
      p_session: sessionId,
      p_project: d.project_id,
      p_items: items,
    });
    dbError(error);
    return json(data);
  } catch (e) {
    return failure(e);
  }
}
