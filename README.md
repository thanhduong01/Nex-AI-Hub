# Nex AI Hub

Ứng dụng nội bộ cho chủ doanh nghiệp và nhân viên, triển khai bằng **Next.js 16 + React 19 + TypeScript**, **Supabase Auth/PostgreSQL/Storage** và **Vercel**. Giao diện kế thừa prototype đã duyệt. Code ứng dụng nằm ở `src/`; prototype được giữ trong `prototype/` để đối chiếu.

## Trạng thái

Code, database migrations và kiểm thử tự động đã được chuẩn bị. Chưa kết nối Supabase, SMTP, API provider hoặc deploy lên Vercel theo yêu cầu cấu hình sau của người dùng. Không có tài khoản thật, chi phí AI hay dữ liệu doanh nghiệp được tạo trong quá trình phát triển.

CI GitHub Actions được cung cấp dưới dạng [file mẫu](docs/ci/github-actions.yml.example), chưa bật do token push thiếu quyền `workflow`. Xem [cách bật CI](docs/deployment.md#bật-github-actions-sau-khi-push).

## Chạy

Yêu cầu Node.js 22, npm và một project Supabase riêng khi muốn đăng nhập thật.

```sh
npm ci
cp .env.example .env.local
# Cấu hình theo docs/deployment.md, chạy migrations và bootstrap Owner.
npm run dev
```

Nếu thiếu cấu hình, ứng dụng hiện trang `/setup`; không có cơ chế demo login hoặc bypass phân quyền trong production. Trang đăng nhập: `http://localhost:3000/login`.

```sh
npm run check        # lint + TypeScript + tests + production build
npm run start       # chạy bản build
```

## Chức năng đã viết

- Login email/password, khôi phục mật khẩu, invitation, logout; cookie HttpOnly và phiên Hub tối đa 7 ngày kể từ đăng nhập. Reset mật khẩu thu hồi mọi phiên Hub, khóa nhân viên chặn request tiếp theo.
- Dự án, chỉnh sửa, lưu trữ, chia sẻ viewer/contributor. Owner được đọc toàn bộ nhưng không tự có quyền ghi dự án khác.
- Hội thoại theo dự án; tạo nhánh khi đổi AI; lưu prompt trước gọi AI, streaming, checkpoint, stop, thử lại thành lượt mới, tìm kiếm và xuất JSON.
- OpenAI, Anthropic, Gemini qua API tập trung; encrypted credentials, quyền theo nhân viên, model/giá/output cap do Owner cấu hình. Meta chưa có adapter chat.
- Budget chung/cá nhân, giữ trước atomic, idempotency, một run đang chạy/conversation; lỗi chưa có usage giữ trạng thái chờ đối soát.
- Quản lý tài khoản/gói website riêng với API; quản lý nhân viên, hạn mức, nhật ký truy cập và thay đổi.
- Tải/lưu tài liệu riêng tư. AI đọc văn bản UTF-8 được chọn rõ ràng; PDF hiện lưu và tải về, chưa có OCR/trích xuất.
- Import JSON ChatGPT/Claude và Nex JSON, preview trước khi lưu, chống trùng, không gán giả tác giả; xuất CSV usage an toàn với spreadsheet formula.

## Tài liệu

- [Hướng dẫn Supabase/Vercel](docs/deployment.md)
- [Thiết kế triển khai và security checkpoint](specs/mvp_design.md)
- [Báo cáo kiểm thử và giới hạn](docs/verification.md)
- [Kiến trúc đã chốt](docs/architecture/architecture-v0.2.md)
- [Prototype](prototype/nex-ai-hub/README.md)

## Các giới hạn cần biết

MVP chat văn bản, không web search/grounding, agent/tools, ảnh/voice hoặc browser-session sharing. Import một chiều; chưa tự đồng bộ website. Giá token do Owner nhập và cần kiểm chứng với model thực; báo cáo Hub không thay thế hóa đơn provider. Lịch sử hiển thị 200 tin gần nhất; ngữ cảnh AI dùng tối đa 40 tin hoàn chỉnh gần đây và giới hạn byte. Hạ tầng thật, multi-connection concurrency và provider quota cần nghiệm thu sau provisioning; không tuyên bố phần mềm tuyệt đối không có lỗi.
