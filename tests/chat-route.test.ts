import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  conversationData: vi.fn(),
  adminClient: vi.fn(),
  streamText: vi.fn(),
  languageModel: vi.fn(),
  connectionKey: vi.fn(),
  rateLimit: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ currentUser: mocks.currentUser }));
vi.mock('@/lib/data', () => ({ conversationData: mocks.conversationData }));
vi.mock('@/lib/supabase/admin', () => ({ adminClient: mocks.adminClient }));
vi.mock('ai', () => ({ streamText: mocks.streamText }));
vi.mock('@/lib/ai/provider', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai/provider')>('@/lib/ai/provider');
  return { ...actual, languageModel: mocks.languageModel, connectionKey: mocks.connectionKey };
});
vi.mock('@/lib/http', async () => {
  const actual = await vi.importActual<typeof import('@/lib/http')>('@/lib/http');
  return { ...actual, rateLimit: mocks.rateLimit };
});
import { POST } from '@/app/api/chat/route';
const Q = '00000000-0000-4000-8000-000000000001',
  RID = '00000000-0000-4000-8000-000000000002',
  REQUEST = '00000000-0000-4000-8000-000000000003';
let rpc: ReturnType<typeof vi.fn>;
const connection = {
  id: 'connection',
  workspace_id: 'workspace',
  provider: 'openai',
  model: 'stale-model',
  max_output_tokens: 8192,
  enabled: true,
};
function request(body: Record<string, unknown> = {}) {
  return new Request('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversation_id: Q,
      request_id: REQUEST,
      content: 'Private current question',
      ...body,
    }),
  }) as NextRequest;
}
async function* parts(items: Record<string, unknown>[]) {
  for (const item of items) yield item;
}
beforeEach(() => {
  vi.stubEnv('APP_URL', 'http://localhost:3000');
  vi.clearAllMocks();
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: connection, error: null }),
  };
  mocks.currentUser.mockResolvedValue({
    db: { from: vi.fn(() => query) },
    member: { user_id: 'alice' },
    sessionId: 'session',
  });
  mocks.conversationData.mockResolvedValue({
    canWrite: true,
    conversation: { connection_id: 'connection' },
    project: { id: 'project' },
    messages: [{ id: 'last', role: 'user', content: 'Earlier question', status: 'complete' }],
  });
  rpc = vi.fn(async (name: string) => ({
    data:
      name === 'begin_run'
        ? { is_new: true, run: { id: RID, model: 'snapshot-model', max_output_tokens: 128 } }
        : name === 'run_can_continue'
          ? true
          : null,
    error: null,
  }));
  mocks.adminClient.mockReturnValue({ rpc });
  mocks.connectionKey.mockResolvedValue('synthetic-key');
  mocks.languageModel.mockResolvedValue('synthetic-model');
  mocks.streamText.mockReturnValue({
    fullStream: parts([
      { type: 'text-delta', text: 'Response text' },
      { type: 'finish', finishReason: 'stop', totalUsage: { inputTokens: 12, outputTokens: 8 } },
    ]),
  });
});
afterEach(() => vi.unstubAllEnvs());
describe('Chat route integration with provider/database boundaries mocked', () => {
  it('persists prompt before dispatch, uses run snapshots, streams and settles exact token usage', async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    const events = (await response.text())
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(events.map((e) => e.type)).toEqual(['start', 'delta', 'done']);
    expect(rpc).toHaveBeenCalledWith(
      'begin_run',
      expect.objectContaining({
        p_actor: 'alice',
        p_prompt: 'Private current question',
        p_last_message: 'last',
      }),
    );
    expect(mocks.languageModel).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'snapshot-model' }),
      'synthetic-key',
    );
    expect(mocks.streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        maxOutputTokens: 128,
        maxRetries: 0,
        streamRetries: 0,
        messages: [
          { role: 'user', content: 'Earlier question' },
          { role: 'user', content: 'Private current question' },
        ],
      }),
    );
    expect(rpc).toHaveBeenCalledWith(
      'finish_run',
      expect.objectContaining({
        p_run: RID,
        p_status: 'completed',
        p_text: 'Response text',
        p_input: 12,
        p_output: 8,
      }),
    );
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.streamText.mock.invocationCallOrder[0]!,
    );
  });
  it('does not dispatch a second paid request when request ID already exists', async () => {
    rpc.mockImplementation(async (name: string) => ({
      data: name === 'begin_run' ? { is_new: false, run: { id: RID } } : true,
      error: null,
    }));
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe('EXISTING_RUN');
    expect(mocks.streamText).not.toHaveBeenCalled();
    expect(mocks.languageModel).not.toHaveBeenCalled();
  });
  it('does not call provider when the budget reservation is denied', async () => {
    rpc.mockImplementation(async () => ({ data: null, error: { message: 'BUDGET_EXCEEDED' } }));
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(mocks.streamText).not.toHaveBeenCalled();
    expect((await response.json()).error).toBe('BUDGET_EXCEEDED');
  });
  it('rejects read-only contributors before credentials or provider calls', async () => {
    mocks.conversationData.mockResolvedValue({ canWrite: false });
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(mocks.connectionKey).not.toHaveBeenCalled();
    expect(mocks.streamText).not.toHaveBeenCalled();
  });
  it('keeps partial output and null usage on provider failure; never refunds unknown costs as zero', async () => {
    mocks.streamText.mockReturnValue({
      fullStream: parts([
        { type: 'text-delta', text: 'Partial text' },
        {
          type: 'error',
          error: { statusCode: 429, responseBody: 'private provider error containing key' },
        },
      ]),
    });
    const response = await POST(request()),
      text = await response.text();
    expect(text).toContain('Partial text');
    expect(text).not.toContain('private provider error');
    expect(rpc).toHaveBeenCalledWith(
      'finish_run',
      expect.objectContaining({
        p_status: 'failed',
        p_text: 'Partial text',
        p_input: null,
        p_output: null,
        p_error: 'PROVIDER_LIMIT',
      }),
    );
  });
  it('does not mark a truncated stream as complete', async () => {
    mocks.streamText.mockReturnValue({
      fullStream: parts([{ type: 'text-delta', text: 'Truncated' }]),
    });
    await (await POST(request())).text();
    expect(rpc).toHaveBeenCalledWith(
      'finish_run',
      expect.objectContaining({ p_status: 'interrupted', p_input: null, p_output: null }),
    );
  });
  it('checks permissions again after reservation and before contacting a provider', async () => {
    rpc.mockImplementation(async (name: string) => ({
      data:
        name === 'begin_run'
          ? { is_new: true, run: { id: RID, model: 'model', max_output_tokens: 128 } }
          : false,
      error: null,
    }));
    await (await POST(request())).text();
    expect(mocks.streamText).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith(
      'finish_run',
      expect.objectContaining({ p_status: 'failed', p_input: null, p_output: null }),
    );
  });
  it('rejects cross-origin requests before authentication or database work', async () => {
    const res = await POST(
      new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { Origin: 'https://other.example' },
        body: '{}',
      }),
    );
    expect(res.status).toBe(403);
    expect(mocks.currentUser).not.toHaveBeenCalled();
  });
});
