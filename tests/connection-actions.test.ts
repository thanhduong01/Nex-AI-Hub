import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  ownerUser: vi.fn(),
  adminClient: vi.fn(),
  connectionKey: vi.fn(),
  verifyConnection: vi.fn(),
  encryptSecret: vi.fn(),
  rateLimit: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ ownerUser: mocks.ownerUser, currentUser: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ adminClient: mocks.adminClient }));
vi.mock('@/lib/ai/provider', () => ({ connectionKey: mocks.connectionKey }));
vi.mock('@/lib/ai/verify-connection', () => ({ verifyConnection: mocks.verifyConnection }));
vi.mock('@/lib/crypto', () => ({ encryptSecret: mocks.encryptSecret }));
vi.mock('@/lib/data', () => ({ projectData: vi.fn() }));
vi.mock('@/lib/http', () => ({ rateLimit: mocks.rateLimit }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
import { saveConnection } from '@/app/actions';
import { AppError } from '@/lib/errors';
const id = '00000000-0000-4000-8000-000000000001';
const employee = '00000000-0000-4000-8000-000000000002';
const input = {
  provider: 'openai',
  name: 'Team AI',
  model: 'gpt-4.1-mini',
  api_key: 'fixture-new-secret',
  input_price: 0.4,
  output_price: 1.6,
  max_output_tokens: 2048,
  enabled: true,
  grants: [employee],
};
let rpc: ReturnType<typeof vi.fn>;
let query: {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};
function edit(changes: Record<string, unknown> = {}) {
  return { ...input, id, api_key: undefined, ...changes };
}
beforeEach(() => {
  vi.resetAllMocks();
  query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { provider: input.provider, model: input.model, enabled: true },
      error: null,
    }),
  };
  mocks.ownerUser.mockResolvedValue({
    db: { from: vi.fn(() => query) },
    member: { user_id: 'owner', workspace_id: 'workspace' },
    sessionId: 'session',
  });
  rpc = vi.fn().mockResolvedValue({ error: null });
  mocks.adminClient.mockReturnValue({ rpc });
  mocks.connectionKey.mockResolvedValue('fixture-stored-secret');
  mocks.encryptSecret.mockReturnValue('encrypted-fixture');
});

describe('Owner connection save with database/provider boundaries mocked', () => {
  it('verifies before encrypting and writing, strips raw key, preserves explicit grants', async () => {
    const result = await saveConnection(input);
    expect(result.ok).toBe(true);
    expect(mocks.verifyConnection).toHaveBeenCalledWith('openai', input.model, input.api_key);
    expect(mocks.verifyConnection.mock.invocationCallOrder[0]!).toBeLessThan(
      rpc.mock.invocationCallOrder[0]!,
    );
    const payload = rpc.mock.calls[0]![1];
    expect(payload).toMatchObject({
      p_actor: 'owner',
      p_session: 'session',
      p_ciphertext: 'encrypted-fixture',
      p_data: { name: input.name, grants: [employee], input_price: 0.4, output_price: 1.6 },
    });
    expect(payload.p_data).not.toHaveProperty('api_key');
    expect(JSON.stringify(result)).not.toContain(input.api_key);
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/integrations');
  });
  it('rejects employees before network requests, decryption or privileged writes', async () => {
    mocks.ownerUser.mockRejectedValue(new AppError('FORBIDDEN', 'Owner only', 403));
    expect(await saveConnection(edit({ model: 'other-model' }))).toEqual({ error: 'Owner only' });
    expect(mocks.connectionKey).not.toHaveBeenCalled();
    expect(mocks.verifyConnection).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('rejects a new connection without a key', async () => {
    expect((await saveConnection({ ...input, api_key: undefined })).error).toMatch(/API key/);
    expect(rpc).not.toHaveBeenCalled();
    expect(mocks.connectionKey).not.toHaveBeenCalled();
  });
  it('leaves existing configuration untouched when a replacement key fails', async () => {
    mocks.verifyConnection.mockRejectedValue(new AppError('CONNECTION_KEY', 'Invalid key', 400));
    expect(await saveConnection(edit({ api_key: 'fixture-bad-key' }))).toEqual({
      error: 'Invalid key',
    });
    expect(mocks.encryptSecret).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('requires a workspace-visible record before accessing a stored key', async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await saveConnection(edit({ model: 'other-model' }))).error).toBeTruthy();
    expect(query.eq).toHaveBeenCalledWith('workspace_id', 'workspace');
    expect(mocks.connectionKey).not.toHaveBeenCalled();
    expect(mocks.verifyConnection).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('does not send stored credentials to a changed provider', async () => {
    expect((await saveConnection(edit({ provider: 'google' }))).error).toMatch(/nền tảng/);
    expect(mocks.connectionKey).not.toHaveBeenCalled();
    expect(mocks.verifyConnection).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('verifies a changed model with the stored key and keeps ciphertext unchanged', async () => {
    expect((await saveConnection(edit({ model: 'new-model' }))).ok).toBe(true);
    expect(mocks.verifyConnection).toHaveBeenCalledWith(
      'openai',
      'new-model',
      'fixture-stored-secret',
    );
    expect(rpc.mock.calls[0]![1].p_ciphertext).toBeNull();
  });
  it('rechecks before enabling a disabled connection', async () => {
    query.maybeSingle.mockResolvedValue({
      data: { provider: input.provider, model: input.model, enabled: false },
      error: null,
    });
    await saveConnection(edit());
    expect(mocks.verifyConnection).toHaveBeenCalledWith(
      'openai',
      input.model,
      'fixture-stored-secret',
    );
  });
  it('allows disabling a connection while the provider is unavailable', async () => {
    mocks.verifyConnection.mockRejectedValue(new Error('Provider offline'));
    expect((await saveConnection(edit({ enabled: false }))).ok).toBe(true);
    expect(mocks.verifyConnection).not.toHaveBeenCalled();
  });
  it('preserves custom models and prices on metadata-only edits without a network call', async () => {
    query.maybeSingle.mockResolvedValue({
      data: { provider: input.provider, model: 'custom', enabled: true },
      error: null,
    });
    expect(
      (
        await saveConnection(
          edit({ model: 'custom', input_price: 3, output_price: 15, grants: [] }),
        )
      ).ok,
    ).toBe(true);
    expect(mocks.verifyConnection).not.toHaveBeenCalled();
    expect(rpc.mock.calls[0]![1].p_data).toMatchObject({
      model: 'custom',
      input_price: 3,
      output_price: 15,
      grants: [],
    });
  });
  it('honors rate limits before provider requests or writes', async () => {
    mocks.rateLimit.mockRejectedValue(new AppError('RATE_LIMIT', 'Try later', 429));
    expect(await saveConnection(input)).toEqual({ error: 'Try later' });
    expect(mocks.verifyConnection).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('does not report success when the final permission check rejects the write', async () => {
    rpc.mockResolvedValue({ error: { message: 'FORBIDDEN' } });
    expect((await saveConnection(input)).error).toMatch(/quyền/);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
