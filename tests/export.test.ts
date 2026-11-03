import { describe, it, expect, vi } from 'vitest';
import { boundedExport } from '@/lib/export-data';
describe('Complete bounded exports', () => {
  it('paginates past Supabase default response row limits', async () => {
    const fixture = Array.from({ length: 1201 }, (_, id) => ({ id, content: 'text' }));
    const page = vi.fn(async (from: number, to: number) => fixture.slice(from, to + 1));
    expect(await boundedExport(fixture.length, page)).toEqual(fixture);
    expect(page).toHaveBeenCalledTimes(13);
  });
  it('refuses an incomplete export if rows are capped or permissions change', async () => {
    await expect(boundedExport(101, async () => [])).rejects.toThrow(/quyền truy cập/);
  });
  it('rejects size and row limits instead of truncating silently', async () => {
    const page = vi.fn(async () => [{ content: 'x'.repeat(100) }]);
    await expect(boundedExport(5001, page)).rejects.toThrow(/vượt giới hạn/);
    expect(page).not.toHaveBeenCalled();
    await expect(boundedExport(1, page, 5000, 50)).rejects.toThrow(/vượt 3 MB/);
  });
});
