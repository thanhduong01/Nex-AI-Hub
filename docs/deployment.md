# Cấu hình Supabase và deploy Vercel

## 1. Tạo project Supabase riêng

Tạo project dành riêng cho Nex AI Hub. Chọn vùng gần nhóm sử dụng và đặt Vercel Functions cùng vùng hoặc vùng gần nhất. Không áp dụng migration này vào database của Nex Ads Hub hoặc ứng dụng khác.

Trong Supabase SQL Editor, chạy theo đúng thứ tự:

1. `supabase/migrations/202611030001_hub.sql`
2. `supabase/migrations/202611030002_storage.sql`

Migration đầu tạo bảng, RLS, session, budget và RPC. Migration thứ hai tạo bucket **project-files** private, giới hạn 3 MB. Không tạo public read policy cho bucket; ứng dụng tải tệp qua route có xác thực. Giữ schema `private` ngoài danh sách exposed schemas của Data API.

Với database mới, lưu migration đã áp dụng trong version control. Với môi trường có dữ liệu, backup và kiểm tra trên staging trước khi thay schema. Không có script rollback xóa dữ liệu tự động; rollback ứng dụng bằng bản deployment trước, còn database dùng migration khắc phục hoặc restore backup đã kiểm chứng.

## 2. Cấu hình Supabase Auth

- Tắt public email signup. Nhân viên được Owner mời qua Hub; bootstrap tạo Owner bằng Admin API.
- Bật email/password, yêu cầu mật khẩu tối thiểu 12 ký tự. JWT ngắn hạn khoảng 1 giờ; không đặt JWT sống 7 ngày.
- Auth Site URL: URL production chính xác, ví dụ `https://nex-ai-hub.example.com`.
- Redirect allowlist: URL callback production và local cần thiết, ví dụ `http://localhost:3000/auth/callback`, `https://nex-ai-hub.example.com/auth/callback`. Không dùng wildcard rộng cho production.
- Cấu hình **custom SMTP** để mời nhân viên và khôi phục truy cập. Kiểm thử bằng địa chỉ nội bộ có quyền; cấu hình SPF/DKIM theo nhà cung cấp email.
- Nếu gói Supabase hỗ trợ time-box sessions, đặt 7 ngày làm lớp bổ sung. Ứng dụng vẫn tự kiểm tra deadline trong `private.hub_sessions` nên không phụ thuộc tính năng trả phí này.

Để invitation/recovery dùng được khi mở trên thiết bị khác, dùng TokenHash trong email template, ví dụ:

**Invite user:**

```html
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&amp;type=invite&amp;next=/reset-password">Thiết lập tài khoản Nex AI Hub</a>
```

**Reset password:**

```html
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&amp;type=recovery&amp;next=/reset-password">Đặt lại mật khẩu</a>
```

Callback cũng hỗ trợ code exchange từ flow PKCE. Liên kết chỉ dùng một lần; tắt link tracking của email provider nếu nó làm hỏng liên kết. Khi thử local bằng template SiteURL, tạm dùng Site URL local trong project staging, không sửa Site URL production đang phục vụ người dùng.

## 3. Biến môi trường

Sao chép `.env.example` thành `.env.local` để chạy local. Không commit `.env.local`.

| Biến | Nguồn / ý nghĩa |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL trong Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key của project (legacy anon key cũng được SDK chấp nhận) |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret/server key, chỉ server và bootstrap; không bao giờ đưa vào client bundle |
| `CREDENTIAL_ENCRYPTION_KEY` | Khóa AES 256 bit, base64; tạo một lần bằng `openssl rand -base64 32` |
| `APP_URL` | Origin chính xác người dùng mở, không có path. Local mặc định `http://localhost:3000` |

Cookie production dùng Secure/HttpOnly/SameSite=Lax. Adapter ghi `Max-Age=604800` dù thư viện SSR đưa default dài hơn. Refresh cookie không gia hạn deadline DB: mỗi Supabase session ID chỉ được đăng ký một lần, `expires_at = created_at + 7 days`. Khi hết hạn phải đăng nhập lại. Logout thu hồi phiên hiện tại; đổi mật khẩu thu hồi mọi phiên Hub của người dùng; khóa nhân viên cũng thu hồi mọi phiên và yêu cầu dừng lượt đang chạy.

Sao lưu khóa mã hóa ở secret manager của doanh nghiệp. Không đổi/xóa tùy tiện: ciphertext API key sẽ không giải mã được. Khi cần rotate, quy trình phải giải mã bằng khóa cũ và mã hóa lại bằng khóa mới; bản MVP chưa có tác vụ rotate tự động.

## 4. Bootstrap chủ doanh nghiệp

Trong `.env.local`, điền thêm `OWNER_EMAIL`, `OWNER_PASSWORD` (ít nhất 12 ký tự), `OWNER_NAME`, `WORKSPACE_NAME`, rồi chạy:

```sh
npm ci
npm run bootstrap
```

Script chỉ dùng cho database mới, từ chối khi đã có Owner. Script không gửi email và không in mật khẩu. Nếu xảy ra lỗi giữa việc tạo Auth user và membership, kiểm tra Supabase để hoàn tất bản ghi còn thiếu; không chạy lặp mù hoặc xóa dữ liệu người dùng.

Xóa `OWNER_PASSWORD` khỏi `.env.local` sau bootstrap. Không đưa các biến `OWNER_*` lên Vercel.

## 5. Kiểm tra local

```sh
npm run check
npm run dev
```

Mở đúng origin trong `APP_URL`. Nếu `APP_URL=http://localhost:3000` mà bạn mở `http://127.0.0.1:3000`, kiểm tra origin sẽ từ chối mutation; chọn một địa chỉ nhất quán.

Đăng nhập Owner → Nguồn AI → thêm kết nối → điền model ID, đơn giá token hiện hành và API key → kiểm tra khóa. “Kiểm tra khóa” chỉ gọi API danh sách model, không sinh câu trả lời tính phí và không chứng minh còn đủ billing quota.

Sau đó đặt budget workspace; mặc định **$0** để không tự phát sinh phí. Mời nhân viên, cấp kết nối và hạn mức cá nhân. Thử một lượt chat ngắn trong budget đã chấp thuận.

## 6. Deploy Vercel

1. Push repository riêng của Nex AI Hub tới Git provider do bạn quản lý.
2. Import repository vào Vercel, Framework **Next.js**, Root Directory thư mục gốc repo, Node.js **22.x**.
3. Repo có `vercel.json` chỉ định framework `nextjs`, Install `npm ci`, Build `npm run build`, Output Directory `.next`. File này ghi đè các mục tương ứng trên Dashboard để tránh deploy nhầm thành static site. Root Directory vẫn phải là thư mục gốc repo, không chọn `public`, `src` hoặc `prototype`.
4. Thêm 5 biến ứng dụng ở bảng trên cho môi trường cần dùng. `APP_URL` phải khớp domain của môi trường đó. Preview dùng staging Supabase, không chia sẻ database production cho preview không được tin cậy.
5. Chọn Functions region gần Supabase. Chat khai báo `maxDuration=300`; xác nhận plan hỗ trợ thời gian này. Ứng dụng tự dừng provider sau 240 giây để dành thời gian ghi kết quả.
6. Deploy; cập nhật Auth Site URL/redirect allowlist theo domain cuối. Kiểm tra login, cookie, refresh và mọi bước nghiệm thu ở dưới.

Vercel CDN không cache trang/API có dữ liệu tài khoản (`private, no-store`). CSP dùng nonce theo request, nên app route được render động. Static JS/CSS vẫn hưởng cache theo hash. Không cần server websocket chạy thường trực.

### Khi trang báo Vercel `404 NOT_FOUND`

Nếu `/login` và `/setup` trả Vercel 404 nhưng `/import-template.json` trả 200, deployment đang phục vụ tài nguyên tĩnh của repo mà chưa có các route ứng dụng hoạt động. Đây là dấu hiệu cần kiểm tra framework/build output, không phải lỗi mật khẩu Owner. Chỉ từ HTTP chưa thể biết chính xác giá trị cấu hình Dashboard nào sai.

1. Trong **Settings → Build and Deployment**, kiểm tra Root Directory là gốc repo và framework Next.js.
2. Trong **Deployments**, chọn deployment chứa commit mới có `vercel.json`; kiểm tra Build Logs có chạy `next build`, có các route `/login`, `/setup` và Next.js Functions trong output.
3. Đợi deployment Ready và được gán domain production. Nếu Git không tự deploy, tạo deployment từ nhánh `main` mới nhất; redeploy một commit cũ sẽ không có bản sửa.
4. Mở `/login`: phải có giao diện Nex AI Hub và HTTP 200. Thiếu biến môi trường sẽ hiện hướng dẫn setup, không phải trang Vercel 404. File static trả 200 một mình chưa đủ để nghiệm thu deployment.

Tham khảo: [Vercel 404](https://vercel.com/kb/guide/why-is-my-deployed-project-giving-404), [cấu hình vercel.json](https://vercel.com/docs/project-configuration/vercel-json).

### Bật GitHub Actions sau khi push

Cấu hình CI nằm tại `docs/ci/github-actions.yml.example`. Bản push đầu chưa kích hoạt Actions vì token GitHub hiện tại không có quyền `workflow`. Để bật, dùng tài khoản có quyền tạo workflow để chép nội dung file mẫu thành `.github/workflows/ci.yml` và commit. Workflow chạy `npm ci`, lint, typecheck, tests và production build; không cần secret Supabase hay API key. Trước khi bật CI, chạy `npm run check` tại local cho mỗi thay đổi.

## 7. Nghiệm thu trước khi cho nhân viên dùng

- Owner + hai Employee: kiểm tra create/read/share/viewer/contributor, mở URL dự án không được chia sẻ và thu hồi quyền ngay giữa phiên.
- Đóng/mở browser vẫn login; refresh sau JWT expiry; vượt 7 ngày bị yêu cầu login. Khóa người dùng và đổi mật khẩu làm các phiên cũ mất quyền.
- Hai request gần đồng thời với cùng request ID chỉ gọi provider một lần. Hai conversation gần cạn budget không vượt khoản khả dụng. Chạy trên PostgreSQL/Supabase thật với nhiều connection; PGlite test chưa thay thế kiểm tra này.
- Provider hợp lệ, sai key, quota cạn, model không tồn tại, timeout, bấm dừng và mất kết nối. Prompt và checkpoint tồn tại; không hoàn ngân sách pending thành 0.
- Import cùng file hai lần không nhân bản; export giữ nguồn và thời gian; không suy đoán tác giả gốc. PDF không được coi như đã trích xuất.
- Invitation, reset và expired-link với SMTP thật; xử lý tình huống email đã gửi nhưng membership insert thất bại qua log/Supabase Admin.
- Test mobile/desktop, keyboard, dialog, focus, scroll, mọi form và download trong browser thật.
- Chạy pilot trong budget đã duyệt, đo latency dữ liệu và thời gian provider riêng; kiểm tra usage với dashboard provider.

## 8. Vận hành

- Owner xem `/usage` và xử lý các lượt pending. Lượt running không heartbeat hơn 10 phút có thể đối soát và chuyển interrupted; chỉ nhập giá thực đã xác minh. Không tự release reservation khi timeout.
- Theo dõi lỗi Vercel với event `run_finalize_failed`; log chỉ có run ID, không có prompt/key. Audit app chỉ lưu metadata truy cập/thay đổi.
- Supabase Auth có rate limits riêng; Hub bổ sung counter DB. Bật cảnh báo và xem log auth, không thay bằng in password/token.
- Bảng `private.rate_limits`, `private.hub_sessions` cần retention job định kỳ sau pilot. Có thể xóa rate rows cũ hơn 7 ngày và session hết hạn/revoked quá retention đã chọn; không xóa run pending.
- Sao lưu PostgreSQL theo plan và sao lưu bucket/khóa mã hóa riêng. Backup database không tự chứng minh đã có bản sao file Storage. Thử restore trên staging trước khi coi là đủ.

Nguồn triển khai: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Supabase sessions](https://supabase.com/docs/guides/auth/sessions), [Next.js authentication](https://nextjs.org/docs/app/guides/authentication), [AI SDK streaming](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text).
