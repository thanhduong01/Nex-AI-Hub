import Link from 'next/link';
import { notFound } from 'next/navigation';
import { pageUser } from '@/lib/auth';
import { conversationData, connectionsData, documentsData } from '@/lib/data';
import { uuid } from '@/lib/schemas';
import { dbError, AppError } from '@/lib/errors';
import { Chat } from '@/components/chat';
import { NewConversation } from '@/components/project-forms';
import { Notice } from '@/components/ui';
export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  if (!uuid.safeParse(id).success) notFound();
  const { member, db } = await pageUser();
  let ctx;
  try {
    ctx = await conversationData(id);
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
  const [connections, documents, { data: runs, error }] = await Promise.all([
    connectionsData(),
    documentsData(ctx.project.id),
    db.from('runs').select('id,status').eq('conversation_id', id).eq('status', 'running').limit(1),
  ]);
  dbError(error);
  dbError(
    (
      await db.rpc('record_access', {
        p_project: ctx.project.id,
        p_action: 'conversation.read',
        p_resource: id,
      })
    ).error,
  );
  const connection = connections.find((c) => c.id === ctx.conversation.connection_id) || null;
  return (
    <>
      <div className="chat-heading">
        <div>
          <Link className="text-link small" href={`/projects/${ctx.project.id}`}>
            {ctx.project.name}
          </Link>
          <h1 className="mt12">{ctx.conversation.title}</h1>
          <p>
            {ctx.conversation.source === 'hub'
              ? 'Hội thoại trong Hub'
              : `Nhập từ ${ctx.conversation.source} · Tác giả gốc chưa xác định`}
          </p>
        </div>
        <div className="row wrap">
          <a className="btn" href={`/api/conversations/${id}/export`}>
            Xuất JSON
          </a>
          {ctx.canWrite ? (
            <NewConversation project={ctx.project} connections={connections} parentId={id} />
          ) : null}
        </div>
      </div>
      {ctx.conversation.parent_id ? (
        <Notice>
          Đây là một nhánh mới.{' '}
          <Link className="text-link" prefetch={false} href={`/chat/${ctx.conversation.parent_id}`}>
            Xem hội thoại gốc
          </Link>
        </Notice>
      ) : null}
      <Chat
        key={`${id}:${ctx.messages.at(-1)?.id}:${ctx.messages.at(-1)?.content.length}:${runs?.length}`}
        conversationId={id}
        initialMessages={ctx.messages}
        connection={connection}
        documents={documents}
        canWrite={ctx.canWrite}
        userName={member.display_name}
        activeRunId={runs?.[0]?.id || null}
      />
      {ctx.messages.length === 200 ? (
        <p className="tiny muted mt24">
          Đang hiển thị 200 tin nhắn gần nhất. Xuất JSON để xem lịch sử đầy đủ.
        </p>
      ) : null}
    </>
  );
}
