# Báo cáo kiểm chứng — 03/11/2026

## Kết quả

Bản MVP ban đầu đã hoàn tất `npm run check`: ESLint, TypeScript strict, 66 tests / 5 files, production build Next.js đều pass. `npm run format:check` pass. Sau khi bổ sung SQL tạo Owner, toàn bộ **75 tests / 6 files**, ESLint và TypeScript strict đều pass. Đây là kiểm chứng trong môi trường phát triển, không phải xác nhận Supabase/provider production đã hoạt động.

| Bộ kiểm tra | Số test | Phạm vi thực tế |
|---|---:|---|
| `tests/database.test.ts` | 31 | Migration chạy nguyên bản trong PostgreSQL WASM/PGlite; RLS, sessions, budget, idempotency, audit/import/branch, thu hồi quyền |
| `tests/api-security.test.ts` | 1 | SDK `@supabase/ssr` thật, cookie adapter thật; mock mạng Supabase và Next cookie jar; login/logout ghi đúng Max-Age và flags |
| `tests/core.test.ts` | 23 | Crypto/tamper/AAD, expiry/redirect, schema/body limit/origin, context isolation, parser imports và CSV injection |
| `tests/chat-route.test.ts` | 8 | Route handler thật; mock database/provider boundary; reservation trước dispatch, snapshot, stream thành công/lỗi/truncated, idempotency và permission recheck |
| `tests/export.test.ts` | 3 | Pagination hơn 1.000 dòng, chặn bản xuất thiếu hoặc quá lớn thay vì cắt ngầm |
| `tests/bootstrap-owner.test.ts` | 9 | SQL tạo Owner với pgcrypto thật: bcrypt, email identity, quyền đọc qua session/RLS, chống ghi đè tài khoản, kiểm tra đầu vào và rollback khi lỗi membership |

PGlite dùng một connection và serialize câu lệnh. Test xác minh reservation đã commit được tính cho lượt sau; **chưa** xác minh lock contention bằng nhiều connection Supabase thật. Auth schema/claims trong test SQL là fixture, không phải Supabase Auth service.

SQL tạo Owner chưa chạy trên project Supabase thật. Script nằm ngoài migrations và cần quản trị viên thay các placeholder trong SQL Editor trước khi chạy. Mật khẩu/tài khoản fixture chỉ dùng trong kiểm thử, không được tạo trên production.

## Những lỗi đã phát hiện và sửa

- Thay cấu hình output giữa lúc đọc và giữ budget gây reservation lệch: run giữ snapshot model, output cap và đơn giá; dispatch dùng snapshot.
- `@supabase/ssr` ghi default cookie dài hơn cấu hình: adapter cuối cùng ép `Max-Age=604800`, giữ `Max-Age=0` khi xóa. Database vẫn áp dụng deadline tuyệt đối không gia hạn.
- Đổi mật khẩu chỉ kết thúc một phiên: bổ sung thu hồi toàn bộ session Hub và yêu cầu dừng các run của người dùng.
- Quyền có thể thay đổi trong lúc chờ budget lock: recheck sau khi lấy lock; streaming cũng kiểm lại quyền định kỳ.
- Metadata tài liệu được ghi qua RLS ngay lúc insert sau upload, thay cho chỉ tin kiểm tra trước đó.
- Export lớn có thể vướng Supabase default row cap: đếm và phân trang, chặn kết quả thiếu hoặc trên giới hạn 3 MB/5.000 dòng.
- Link hội thoại không prefetch nội dung, tránh audit “xem” chỉ do prefetch tự động.

## HTTP production local

Đã chạy `next start` trên localhost và kiểm tra:

- `/login`, `/setup` trả HTTP 200.
- Trang bảo vệ chuyển tới `/setup` khi thiếu cấu hình; API bảo vệ trả `SETUP_REQUIRED`, không có demo auth bypass.
- Mutation từ origin khác trả HTTP 403 khi APP_URL được đặt.
- Header `Cache-Control: private, no-store`, `X-Frame-Options: DENY`; nonce trong CSP khớp mọi script trên HTML login/setup.
- Không có tên biến secret/service key hoặc code AES trong client static chunks sau build.

Trình duyệt tự động bị tắt trong Work settings tại thời điểm kiểm tra. Chưa kiểm tra trực quan/keyboard của ứng dụng production mới bằng browser. Prototype trước đó đã có visual QA nhưng không thay cho QA của bản React hiện tại.

## Dependency và hiệu năng

- Dependency khóa phiên bản qua package-lock; Node 22.
- `npm audit --omit=dev`: **0 vulnerabilities** tại lần kiểm tra.
- `npm audit` đầy đủ: 16 cảnh báo **moderate** trong chuỗi ESLint/minimatch của tooling phát triển; không có high/critical hoặc runtime advisory. Không dùng `audit fix --force` vì đề xuất downgrade linter/config không tương thích. Cần theo dõi bản vá upstream; CI/lint chạy trên source trong repository được kiểm soát.
- Server Components cho trang dữ liệu, client islands cho form/chat; auth memoized trong request, truy vấn độc lập chạy song song. Không cache thông tin cá nhân giữa user.
- Markdown renderer tải động, streaming UI gom cập nhật khoảng 60 ms; provider SDK chỉ tải phía server theo nguồn được dùng.
- Index trên project/conversation/message/run/audit, full-text search theo RLS, giới hạn page và context; không có font/analytics từ bên thứ ba trong critical path.
- Chưa có latency p95, Web Vitals hoặc benchmark người dùng đồng thời trên hạ tầng thật. Không suy ra hiệu năng production từ thời gian build.

## Cần nghiệm thu khi có hạ tầng

Supabase Auth + SMTP + Storage thật, refresh token qua browser restart, nhiều phiên/thiết bị, concurrency PostgreSQL nhiều connection, chat với model/provider thật và usage billing, Vercel function cancellation/timeouts, mobile/keyboard/accessibility, backup/restore. Xem checklist cụ thể trong `docs/deployment.md`.

Không dùng dữ liệu thật hoặc thực hiện request AI tính phí trong các kiểm thử trên. Meta chat, web search/grounding, OCR/PDF parsing, media/agent và đồng bộ website liên tục chưa nằm trong phần đã triển khai.
