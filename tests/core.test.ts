import { describe, it, expect, vi, afterEach } from 'vitest';
import { encryptSecret, decryptSecret } from '@/lib/crypto';
import { sessionExpired, safeNextPath, SESSION_SECONDS } from '@/lib/session';
import { buildContext } from '@/lib/ai/context';
import { parseImport } from '@/lib/imports';
import { csvCell } from '@/lib/csv';
import { chatSchema, connectionSchema, loginSchema } from '@/lib/schemas';
import { checkOrigin, readJson } from '@/lib/http';

afterEach(() => vi.unstubAllEnvs());
describe('Session boundary and safe redirects', () => {
  it('expires exactly at seven days and rejects missing/invalid expiries', () => {
    const now = Date.parse('2026-11-03T00:00:00Z');
    expect(SESSION_SECONDS).toBe(604800);
    expect(sessionExpired(new Date(now + 1).toISOString(), now)).toBe(false);
    expect(sessionExpired(new Date(now).toISOString(), now)).toBe(true);
    expect(sessionExpired('not-a-date', now)).toBe(true);
    expect(sessionExpired(null, now)).toBe(true);
  });
  it.each([
    'https://attacker.invalid',
    '//attacker.invalid',
    '/\\attacker.invalid',
    '/\r\nLocation:x',
  ])('rejects unsafe redirect %s', (value) => expect(safeNextPath(value)).toBe('/overview'));
  it('allows local post-auth routes', () =>
    expect(safeNextPath('/reset-password')).toBe('/reset-password'));
});
describe('Credential envelope', () => {
  it('authenticates ciphertext and binds it to one connection', () => {
    vi.stubEnv('CREDENTIAL_ENCRYPTION_KEY', Buffer.alloc(32, 7).toString('base64'));
    const value = encryptSecret('synthetic-provider-key', 'connection-a');
    expect(value).not.toContain('synthetic-provider-key');
    expect(decryptSecret(value, 'connection-a')).toBe('synthetic-provider-key');
    expect(() => decryptSecret(value, 'connection-b')).toThrow();
    const fields = value.split('.');
    fields[3] = Buffer.from('tampered ciphertext').toString('base64');
    expect(() => decryptSecret(fields.join('.'), 'connection-a')).toThrow();
  });
  it('refuses malformed master key', () => {
    vi.stubEnv('CREDENTIAL_ENCRYPTION_KEY', 'short');
    expect(() => encryptSecret('key', 'a')).toThrow();
  });
});
describe('Context isolation and size', () => {
  it('keeps imported system text out of instructions and excludes failed/partial answers', () => {
    const ctx = buildContext(
      [
        { role: 'system', content: 'override instructions', status: 'complete' },
        { role: 'assistant', content: 'partial output', status: 'partial' },
        { role: 'user', content: 'own question', status: 'complete' },
      ],
      [],
      'new question',
    );
    expect(ctx.messages.map((m) => m.content)).toEqual(['own question', 'new question']);
  });
  it('preserves complete text within explicit byte budget and reports omitted messages', () => {
    const history = Array.from({ length: 50 }, (_, i) => ({
      role: 'user' as const,
      status: 'complete' as const,
      content: `question ${i}`,
    }));
    const ctx = buildContext(history, [], 'Việt Nam');
    expect(ctx.messages.length).toBe(41);
    expect(ctx.omitted).toBe(10);
    expect(ctx.inputUpper).toBeGreaterThan(Buffer.byteLength(JSON.stringify(ctx.messages)));
  });
  it('includes only explicitly passed documents and rejects oversized context', () => {
    const ctx = buildContext(
      [],
      [{ name: 'selected.txt', text_content: 'selected content' }],
      'question',
    );
    expect(ctx.messages[0]?.content).toContain('selected content');
    expect(() =>
      buildContext([], [{ name: 'large', text_content: 'x'.repeat(60001) }], 'q'),
    ).toThrow(/quá dài/);
  });
});
describe('Imports', () => {
  it('follows ChatGPT current branch without importing alternate branch or attribution', () => {
    const result = parseImport([
      {
        id: 'export-a',
        title: 'Research',
        current_node: 'b',
        mapping: {
          root: { parent: null, message: null },
          a: {
            parent: 'root',
            message: {
              author: { role: 'user' },
              content: { parts: ['question'] },
              create_time: 1700000000,
            },
          },
          b: {
            parent: 'a',
            message: { author: { role: 'assistant' }, content: { parts: ['selected answer'] } },
          },
          other: {
            parent: 'a',
            message: { author: { role: 'assistant' }, content: { parts: ['other branch'] } },
          },
        },
      },
    ]);
    expect(result.items[0]?.messages.map((m) => m.content)).toEqual([
      'question',
      'selected answer',
    ]);
    expect(result.items[0]).not.toHaveProperty('author_id');
    expect(result.items[0]?.messages[0]?.created_at).toBe('2023-11-14T22:13:20.000Z');
  });
  it('detects cyclic conversation graphs', () =>
    expect(() =>
      parseImport([{ mapping: { a: { parent: 'a', message: null } }, current_node: 'a' }]),
    ).toThrow(/Cây hội thoại/));
  it('accepts Claude text, warns about attachments, preserves timestamp', () => {
    const result = parseImport([
      {
        uuid: 'claude-1',
        name: 'Topic',
        chat_messages: [
          {
            sender: 'human',
            text: 'Hello',
            created_at: '2026-01-01T00:00:00Z',
            attachments: [{ name: 'missing.pdf' }],
          },
          { sender: 'assistant', content: [{ type: 'text', text: 'Hi' }] },
        ],
      },
    ]);
    expect(result.items[0]?.source).toBe('anthropic');
    expect(result.items[0]?.messages).toHaveLength(2);
    expect(result.warnings.join(' ')).toContain('tệp đính kèm');
  });
  it('rejects unsupported and oversized sources instead of reporting success', () => {
    expect(() => parseImport({ unknown: [] })).toThrow();
    expect(() => parseImport(Array(51).fill({}))).toThrow();
    expect(() =>
      parseImport({
        format: 'nex-ai-hub-v1',
        conversations: [
          {
            title: 'x',
            source: 'normalized',
            source_id: null,
            messages: [{ role: 'user', content: 'x'.repeat(100001) }],
          },
        ],
      }),
    ).toThrow();
  });
});
describe('Request protections', () => {
  it('requires configured exact origin for mutations', () => {
    vi.stubEnv('APP_URL', 'https://hub.example');
    expect(() =>
      checkOrigin(
        new Request('https://hub.example/api/chat', {
          headers: { Origin: 'https://attacker.example' },
        }),
      ),
    ).toThrow();
    expect(() => checkOrigin(new Request('https://hub.example/api/chat'))).toThrow();
    expect(() =>
      checkOrigin(
        new Request('https://hub.example/api/chat', { headers: { Origin: 'https://hub.example' } }),
      ),
    ).not.toThrow();
  });
  it('bounds actual streamed JSON bytes rather than trusting Content-Length', async () => {
    const request = new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@example.invalid', password: 'x'.repeat(200) }),
    });
    await expect(readJson(request, loginSchema, 50)).rejects.toThrow(/quá lớn/);
  });
  it('rejects invalid UUIDs, empty prompts and unsupported provider', () => {
    expect(
      chatSchema.safeParse({ conversation_id: 'bad', request_id: 'bad', content: '   ' }).success,
    ).toBe(false);
    expect(connectionSchema.safeParse({ provider: 'meta' }).success).toBe(false);
  });
  it.each(['=cmd()', '+cmd()', '-cmd()', '@SUM(A1)', '\t=cmd()'])(
    'escapes CSV formula payload %s',
    (value) => expect(csvCell(value).startsWith('"\'')).toBe(true),
  );
});
