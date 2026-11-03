import { AppError } from './errors';

// Supabase caps rows per response. Never treat one successful request as a full export.
export async function boundedExport<T>(
  expected: number,
  loadPage: (from: number, to: number) => Promise<T[]>,
  maxRows = 5000,
  maxBytes = 2800000,
) {
  if (expected > maxRows)
    throw new AppError(
      'TOO_LARGE',
      'Nội dung vượt giới hạn xuất. Liên hệ quản trị để xuất theo kỳ.',
      413,
    );
  const rows: T[] = [];
  let bytes = 0;
  for (let offset = 0; offset < expected; offset += 100) {
    const page = await loadPage(offset, Math.min(offset + 99, expected - 1));
    bytes += new TextEncoder().encode(JSON.stringify(page)).length;
    if (bytes > maxBytes)
      throw new AppError(
        'TOO_LARGE',
        'Bản xuất vượt 3 MB. Liên hệ quản trị để chia nhỏ dữ liệu.',
        413,
      );
    if (page.length !== Math.min(100, expected - offset))
      throw new AppError(
        'EXPORT_CHANGED',
        'Dữ liệu hoặc quyền truy cập đã thay đổi. Hãy xuất lại.',
        409,
      );
    rows.push(...page);
  }
  return rows;
}
