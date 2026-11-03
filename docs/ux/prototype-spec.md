# Nex AI Hub — Đặc tả prototype UI/UX

## Cơ sở và phạm vi

Thiết kế cho 1 chủ doanh nghiệp và 5 nhân viên, theo architecture-v0.2. Điểm vào chính là công việc theo dự án; quản lý nguồn AI dành cho Owner. Nhân viên đăng nhập Hub, chọn kết nối được cấp và làm việc trong phạm vi dự án. Gói thuê bao website được ghi nhận riêng với kết nối API. Nhập lịch sử là bản sao một chiều có nguồn gốc; chưa biểu diễn đồng bộ nền thời gian thực.

## Danh sách màn hình

| Màn hình / route | Nội dung chính | Tương tác prototype |
|---|---|---|
| Đăng nhập `#/login` | Form, quên mật khẩu, chọn vai trò thử | Vào workspace mẫu, xem thông báo khôi phục mẫu |
| Tổng quan `#/overview` | Ô hỏi nhanh, ngân sách, dự án gần đây, hội thoại, nguồn AI | Chọn AI, bắt đầu chat, đi tới dự án |
| Dự án `#/projects` | Tất cả / của tôi / được chia sẻ, tìm kiếm | Tạo dự án mẫu, lọc, mở chi tiết |
| Chi tiết `#/project/p1` | Hội thoại, tài liệu, thành viên, phạm vi quyền | Tab, xem tệp, chia sẻ, tạo hội thoại |
| Hội thoại mới `#/chat/new` | Gợi ý bắt đầu, dự án, model, tài liệu | Soạn, gửi phản hồi cố định mẫu, dừng |
| Hội thoại `#/chat/c1` | Tin nhắn, bảng, trích dẫn, ngữ cảnh, chi phí mẫu | Xem tệp, tạo nhánh bằng AI khác, chọn tài liệu |
| Kho hội thoại `#/library` | Tìm nội dung, lọc nguồn AI / nguồn gốc | Tìm, lọc, mở hội thoại được phép xem |
| Nguồn AI `#/integrations` | API, quyền sử dụng, danh mục tài khoản/gói | Chi tiết, cấu hình khóa giả, kiểm tra kết nối mẫu |
| Nhân viên `#/team` | 5 nhân viên, nguồn AI, hạn mức, trạng thái | Chi tiết, xem trước lời mời, khóa/mở khóa mẫu |
| Chi phí `#/usage` | Tổng sử dụng, giới hạn, biểu đồ, nhân viên | Xem ngân sách, bản xuất mẫu, trạng thái hết hạn mức |
| Nhập lịch sử `#/imports` | Chọn nguồn → kiểm tra → kết quả | Tệp mẫu, bản trùng, thiếu tệp, phân loại dự án |
| Nhật ký `#/audit` | Hoạt động, tác nhân, đối tượng, thời điểm | Xem bảng mẫu và bộ lọc thiết kế |
| Cài đặt `#/settings` | Workspace, quyền, thông báo, hồ sơ | Tab, switch, form và thông báo lưu mẫu |

## Các luồng cần duyệt

1. **Làm việc hằng ngày:** đăng nhập → dự án → hội thoại → chọn nguồn AI → gửi → đọc kết quả → xem tài liệu tham chiếu.
2. **Cộng tác:** tạo dự án → thêm nhân viên → cấp chỉ xem hoặc đóng góp → kiểm tra góc nhìn nhân viên.
3. **Tiếp tục với AI khác:** hội thoại cũ → chọn AI → nhánh mới. Không đổi nhãn nguồn của các tin nhắn cũ.
4. **Quản trị:** nguồn AI → kiểm tra kết nối mẫu → quyền nhân viên → hạn mức → báo cáo sử dụng.
5. **Tập trung lịch sử:** chọn nguồn export → tệp mẫu → kiểm tra trùng/thiếu → dự án nhận → kết quả.

## Quyền và thông điệp

| Tình huống | UX |
|---|---|
| Owner xem dự án nhân viên | Luôn đọc được; quyền đóng góp vẫn xét riêng |
| Nhân viên là chủ dự án | Xem, đóng góp và quản lý chia sẻ |
| Nhân viên được chia sẻ chỉ xem | Đọc hội thoại; ô soạn bị khóa và có lý do |
| Không thuộc dự án | Trang “Bạn chưa có quyền truy cập” và đường về dự án |
| Owner mở phần quản trị | Có API, tài khoản, nhân viên, import, nhật ký |
| Nhân viên | Ẩn điều hướng quản trị; mở route quản trị bị từ chối trong UX mẫu |

Hiển thị rõ “Dự án công việc — chủ doanh nghiệp có quyền xem nội dung” ở bước tạo, chi tiết và hội thoại. Không đặt tên “riêng tư” cho dự án chỉ vì chưa chia sẻ với đồng nghiệp.

## Trạng thái và khả năng tiếp cận

- Trống: giải thích lợi ích và CTA tạo dự án đầu tiên.
- Đang tải: skeleton với nhãn status; có nút kết thúc trạng thái mẫu.
- Lỗi kết nối: thông điệp dữ liệu đã lưu được giữ, nút thử lại.
- Hết ngân sách: dừng gửi, vẫn cho đọc và xem bản xuất.
- Chỉ xem: khóa ô nhập và giải thích quyền đóng góp.
- Không có kết quả: đổi từ khóa hoặc bỏ lọc.
- Meta chưa xác minh: thể hiện trạng thái bằng chữ, không chỉ màu.
- Form có nhãn, SVG trang trí ẩn với trình đọc màn hình, nút icon có tên; modal dùng dialog, có đóng/Escape; focus rõ, hỗ trợ giảm chuyển động.

## Responsive

Desktop có sidebar cố định, ngữ cảnh bên cạnh chat và các bảng quản trị. Tablet rút bớt cột phụ; ngữ cảnh vẫn truy cập qua nút. Mobile chuyển sidebar thành menu phủ, thẻ xếp dọc, ô nhập 16px, bảng cuộn trong vùng riêng. Hộp thoại co theo chiều ngang, có cuộn bên trong khi nội dung dài.

## Giới hạn và bàn giao triển khai

Các kết nối, biểu đồ, file, nội dung AI và giao dịch import chỉ là fixture. Một số thao tác cấu hình chỉ mở preview/notification, chưa cập nhật mọi bảng phụ. Bản prototype chưa kiểm chứng tính khả dụng API, parser export hoặc đồng bộ website. Khi triển khai cần bổ sung kiểm tra quyền phía server, quản lý credential, lưu hội thoại, cancellation thật, đối soát usage, xử lý lỗi provider, kiểm thử bằng bàn phím/trình đọc màn hình và dữ liệu thực.
