import { currentUser } from '@/lib/auth';
import { uuid } from '@/lib/schemas';
import { AppError, dbError } from '@/lib/errors';
import { failure, rateLimit } from '@/lib/http';
import { boundedExport } from '@/lib/export-data';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = uuid.parse((await params).id),
      { db, member } = await currentUser();
    await rateLimit(`export:${member.user_id}`, 20);
    const { data: conversation, error: a } = await db
      .from('conversations')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    dbError(a);
    if (!conversation) throw new AppError('NOT_FOUND', 'Không tìm thấy hội thoại.', 404);
    const { data: latest, error: latestError } = await db
      .from('messages')
      .select('sequence')
      .eq('conversation_id', id)
      .order('sequence', { ascending: false })
      .limit(1);
    dbError(latestError);
    const upper = latest?.[0]?.sequence || 0;
    const { count, error: b } = await db
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', id)
      .lte('sequence', upper);
    dbError(b);
    const messages = await boundedExport(count || 0, async (from, to) => {
      const { data, error } = await db
        .from('messages')
        .select('role,content,created_at,status,author_id')
        .eq('conversation_id', id)
        .lte('sequence', upper)
        .order('sequence')
        .range(from, to);
      dbError(error);
      return data || [];
    });
    dbError(
      (
        await db.rpc('record_access', {
          p_project: conversation.project_id,
          p_action: 'conversation.export',
          p_resource: id,
        })
      ).error,
    );
    const body = JSON.stringify({
      format: 'nex-ai-hub-v1',
      exported_at: new Date().toISOString(),
      conversations: [
        {
          title: conversation.title,
          source: conversation.source === 'hub' ? 'normalized' : conversation.source,
          source_id: conversation.source_id || conversation.id,
          messages,
        },
      ],
    });
    return new Response(body, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="nex-conversation-${id}.json"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    return failure(e);
  }
}
