import { ZodError } from 'zod';
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const messages: Record<string, string> = {
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  NOT_FOUND: 'Không tìm thấy nội dung hoặc bạn chưa được cấp quyền.',
  BUDGET_EXCEEDED:
    'Ngân sách chưa được cấp hoặc không đủ cho lượt này. Câu hỏi của bạn vẫn ở ô soạn.',
  CONNECTION_UNAVAILABLE: 'Kết nối AI chưa được cấu hình, bị tắt hoặc chưa được cấp cho bạn.',
  RUN_IN_PROGRESS: 'Hội thoại đang có một lượt xử lý. Hãy đợi hoặc dừng lượt đó.',
  CONVERSATION_CHANGED: 'Hội thoại vừa có nội dung mới. Tải lại trước khi gửi.',
  MODEL_CHANGED: 'Cấu hình model đã thay đổi. Tạo nhánh mới để tiếp tục.',
  IDEMPOTENCY_CONFLICT: 'Mã lượt này đã được dùng cho hội thoại khác.',
  KEY_REQUIRED: 'Cần API key cho kết nối mới.',
  INVALID_INPUT: 'Dữ liệu không hợp lệ.',
};
export function dbError(error: { message?: string; code?: string } | null): void {
  if (!error) return;
  const match = Object.keys(messages).find((k) => error.message?.includes(k));
  if (match) throw new AppError(match, messages[match]!, match === 'FORBIDDEN' ? 403 : 409);
  if (error.code === '42501') throw new AppError('FORBIDDEN', messages.FORBIDDEN!, 403);
  if (error.code === '23505')
    throw new AppError('CONFLICT', 'Nội dung đã tồn tại. Tải lại để xem bản hiện có.', 409);
  throw new AppError('DATABASE_ERROR', 'Không thể lưu hoặc đọc dữ liệu. Vui lòng thử lại.', 503);
}
export function publicError(error: unknown): { code: string; message: string; status: number } {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError)
    return {
      code: 'VALIDATION_ERROR',
      message: error.issues[0]?.message || 'Dữ liệu không hợp lệ.',
      status: 422,
    };
  console.error(
    JSON.stringify({
      event: 'unhandled_error',
      type: error instanceof Error ? error.name : 'unknown',
    }),
  );
  return { code: 'INTERNAL_ERROR', message: 'Có lỗi xảy ra. Vui lòng thử lại.', status: 500 };
}
