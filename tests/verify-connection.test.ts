import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyConnection } from '@/lib/ai/verify-connection';
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('Provider key and model verification without generation', () => {
  it.each([
    [
      'openai',
      'gpt-4.1-mini',
      'https://api.openai.com/v1/models/gpt-4.1-mini',
      { Authorization: 'Bearer fixture-secret' },
    ],
    [
      'anthropic',
      'claude-haiku-4-5-20251001',
      'https://api.anthropic.com/v1/models/claude-haiku-4-5-20251001',
      { 'x-api-key': 'fixture-secret', 'anthropic-version': '2023-06-01' },
    ],
    [
      'google',
      'models/gemini-2.5-flash-lite',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite',
      { 'x-goog-api-key': 'fixture-secret' },
    ],
  ] as const)(
    'checks %s via metadata GET with credentials only in headers',
    async (provider, model, url, headers) => {
      fetchMock.mockResolvedValue(new Response('{}'));
      await verifyConnection(provider, model, 'fixture-secret');
      expect(fetchMock).toHaveBeenCalledExactlyOnceWith(url, {
        method: 'GET',
        headers,
        signal: expect.any(AbortSignal),
        cache: 'no-store',
        redirect: 'error',
      });
    },
  );
  it('keeps arbitrary model paths on the fixed provider origin', async () => {
    fetchMock.mockResolvedValue(new Response('{}'));
    await verifyConnection('openai', 'ft:custom/model', 'fixture-secret');
    expect(fetchMock.mock.calls[0]![0]).toBe(
      'https://api.openai.com/v1/models/ft%3Acustom%2Fmodel',
    );
  });
  it.each([
    [401, 'CONNECTION_KEY', 400],
    [403, 'CONNECTION_KEY', 400],
    [404, 'CONNECTION_MODEL', 400],
    [429, 'CONNECTION_LIMIT', 429],
    [500, 'CONNECTION_UNAVAILABLE', 502],
  ])(
    'maps HTTP %s to a safe error without returning provider content',
    async (status, code, publicStatus) => {
      fetchMock.mockResolvedValue(
        new Response('fixture-secret private response', { status: Number(status) }),
      );
      await expect(verifyConnection('openai', 'model', 'fixture-secret')).rejects.toMatchObject({
        code,
        status: publicStatus,
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );
  it('does not leak a network error or retry a failed request', async () => {
    fetchMock.mockRejectedValue(new Error('fixture-secret'));
    await expect(verifyConnection('google', 'model', 'fixture-secret')).rejects.toMatchObject({
      code: 'CONNECTION_UNAVAILABLE',
      message: 'Chưa liên hệ được nhà cung cấp. Kiểm tra kết nối và thử lại.',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('aborts an unresponsive provider after ten seconds', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    fetchMock.mockResolvedValue(new Response('{}'));
    await verifyConnection('openai', 'model', 'fixture-secret');
    expect(timeout).toHaveBeenCalledWith(10000);
    timeout.mockRestore();
  });
});
