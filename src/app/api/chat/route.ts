import { streamText } from 'ai';
import { currentUser } from '@/lib/auth';
import { conversationData } from '@/lib/data';
import { adminClient } from '@/lib/supabase/admin';
import { chatSchema } from '@/lib/schemas';
import { AppError, dbError } from '@/lib/errors';
import { checkOrigin, readJson, rateLimit, failure, json } from '@/lib/http';
import { buildContext, INSTRUCTIONS } from '@/lib/ai/context';
import { languageModel, connectionKey, providerErrorCode } from '@/lib/ai/provider';
import type { Connection, Run } from '@/lib/types';
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { db, member, sessionId } = await currentUser();
    await rateLimit(`chat:${member.user_id}`, 20);
    const d = await readJson(request, chatSchema, 100000),
      ctx = await conversationData(d.conversation_id);
    if (!ctx.canWrite)
      throw new AppError('FORBIDDEN', 'Bạn cần quyền đóng góp để gửi tin nhắn.', 403);
    const { data: connection, error: a } = await db
      .from('connections')
      .select('*')
      .eq('id', ctx.conversation.connection_id || '00000000-0000-0000-0000-000000000000')
      .eq('enabled', true)
      .maybeSingle();
    dbError(a);
    if (!connection)
      throw new AppError(
        'CONNECTION_UNAVAILABLE',
        'Chọn nguồn AI được cấp quyền. Hội thoại nhập cần tạo nhánh mới.',
        409,
      );
    const unique = [...new Set(d.document_ids)];
    const docs = unique.length
      ? await db
          .from('documents')
          .select('id,name,text_content')
          .eq('project_id', ctx.project.id)
          .in('id', unique)
      : { data: [], error: null };
    dbError(docs.error);
    if (docs.data?.length !== unique.length || docs.data?.some((doc) => doc.text_content === null))
      throw new AppError(
        'DOCUMENT_UNAVAILABLE',
        'Một tài liệu chưa được cấp quyền hoặc chưa có bản văn bản. Chỉ chọn TXT/Markdown/CSV/JSON nhỏ hơn 120 KB.',
        403,
      );
    const prepared = buildContext(ctx.messages, docs.data || [], d.content);
    const key = await connectionKey(connection.id); // Decrypt before reserving; construct model from the immutable run snapshot.
    const admin = adminClient();
    const { data: started, error: b } = await admin.rpc('begin_run', {
      p_actor: member.user_id,
      p_session: sessionId,
      p_conversation: d.conversation_id,
      p_request: d.request_id,
      p_prompt: d.content,
      p_input_upper: prepared.inputUpper,
      p_last_message: ctx.messages.at(-1)?.id || null,
    });
    dbError(b);
    const run = started.run as Run;
    if (!started.is_new)
      return json(
        {
          error: 'EXISTING_RUN',
          message:
            'Lượt này đã được ghi nhận. Tải lại hội thoại để xem kết quả; không gửi thêm tới AI.',
          run_id: run.id,
        },
        409,
      );
    const abort = new AbortController();
    let disconnected = false;
    const disconnect = () => {
      disconnected = true;
      abort.abort('client_disconnected');
    };
    request.signal.addEventListener('abort', disconnect, { once: true });
    if (request.signal.aborted) disconnect();
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        let output = '',
          lastCheckpoint = 0,
          polling = false,
          complete = false;
        let inputTokens: number | null = null,
          outputTokens: number | null = null;
        let finalStatus: Run['status'] = 'failed',
          errorCode: string | null = null;
        const send = (event: unknown) => {
          if (!disconnected) {
            try {
              controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
            } catch {
              disconnect();
            }
          }
        };
        const deadline = setTimeout(() => abort.abort('deadline'), 240000);
        const poll = setInterval(async () => {
          if (polling) return;
          polling = true;
          try {
            const { data, error } = await admin.rpc('run_can_continue', { p_run: run.id });
            if (error || !data) abort.abort('permission_or_cancel');
          } catch {
            abort.abort('permission_check_failed');
          } finally {
            polling = false;
          }
        }, 2500);
        send({ type: 'start', run_id: run.id, omitted: prepared.omitted });
        try {
          const permission = await admin.rpc('run_can_continue', { p_run: run.id });
          dbError(permission.error);
          if (!permission.data)
            throw new AppError('FORBIDDEN', 'Quyền truy cập vừa thay đổi.', 403);
          const model = await languageModel({ ...connection, model: run.model } as Connection, key);
          const result = streamText({
            model,
            instructions: INSTRUCTIONS,
            messages: prepared.messages,
            maxOutputTokens: run.max_output_tokens,
            maxRetries: 0,
            streamRetries: 0,
            abortSignal: abort.signal,
            providerOptions:
              connection.provider === 'openai' ? { openai: { store: false } } : undefined,
          });
          for await (const part of result.fullStream) {
            if (part.type === 'text-delta') {
              output += part.text;
              if (output.length > 500000) {
                abort.abort('output_limit');
                break;
              }
              send({ type: 'delta', text: part.text });
              if (Date.now() - lastCheckpoint > 1500) {
                dbError(
                  (await admin.rpc('checkpoint_run', { p_run: run.id, p_text: output })).error,
                );
                lastCheckpoint = Date.now();
              }
            } else if (part.type === 'finish') {
              inputTokens = part.totalUsage.inputTokens ?? null;
              outputTokens = part.totalUsage.outputTokens ?? null;
              complete = ['stop', 'length'].includes(part.finishReason);
              if (part.finishReason === 'length')
                send({
                  type: 'notice',
                  message: 'Đã đạt giới hạn độ dài phản hồi. Bạn có thể gửi câu hỏi tiếp theo.',
                });
            } else if (part.type === 'error') throw part.error;
          }
          finalStatus = abort.signal.aborted ? 'cancelled' : complete ? 'completed' : 'interrupted';
          if (!complete) errorCode = abort.signal.aborted ? 'CANCELLED' : 'INCOMPLETE_STREAM';
        } catch (e) {
          finalStatus = abort.signal.aborted ? 'cancelled' : 'failed';
          const mapped = providerErrorCode(e);
          errorCode = abort.signal.aborted ? 'CANCELLED' : mapped.code;
          send({
            type: 'error',
            message: abort.signal.aborted
              ? 'Lượt đã dừng. Phần nội dung đã nhận được giữ lại.'
              : mapped.message,
          });
        } finally {
          clearTimeout(deadline);
          clearInterval(poll);
          request.signal.removeEventListener('abort', disconnect);
          try {
            const saved = await admin.rpc('finish_run', {
              p_run: run.id,
              p_status: finalStatus,
              p_text: output,
              p_input: inputTokens,
              p_output: outputTokens,
              p_error: errorCode,
            });
            dbError(saved.error);
            send({
              type: 'done',
              status: finalStatus,
              usage_pending: inputTokens === null || outputTokens === null,
            });
          } catch {
            console.error(JSON.stringify({ event: 'run_finalize_failed', run_id: run.id }));
            send({
              type: 'error',
              message:
                'Chưa xác nhận được lần lưu cuối. Không gửi lại tự động; tải lại để kiểm tra và liên hệ quản trị đối soát lượt.',
            });
          }
          if (!disconnected) {
            try {
              controller.close();
            } catch {
              /* already disconnected */
            }
          }
        }
      },
      cancel() {
        disconnect();
      },
    });
    return new Response(body, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'private, no-store, no-transform',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return failure(e);
  }
}
