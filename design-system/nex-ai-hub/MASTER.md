# Nex AI Hub — Design system v0.1

## Hướng thiết kế

Áp dụng skill `ui-ux-pro-max`, tham khảo kết quả tra cứu Swiss Minimalism cho dashboard cộng tác nội bộ. Chọn cấu trúc workspace từ đặc tả sản phẩm, không dùng mẫu landing page do công cụ tìm kiếm gợi ý. Bảng màu được điều chỉnh sang xanh rừng và nền trắng ấm để tạo không gian đọc, làm việc dài và phân cấp rõ giữa nội dung với quản trị.

## Tokens

| Thành phần | Giá trị / quy tắc |
|---|---|
| Nền chính | `#FBFCF9` |
| Nền sidebar | `#F1F3EE` |
| Thẻ / form | `#FFFFFF` |
| Xanh thương hiệu | `#153E2D` |
| Hành động chính | `#226649` |
| Chữ phụ | `#69726A` |
| Viền | `#E2E6DE` |
| Typography | Inter nếu có sẵn, sau đó font hệ thống; không tải font từ mạng |
| Tiêu đề trang | 28–32px desktop, 26px mobile; chat 20–22px |
| Nội dung hội thoại | 13px desktop / 14px mobile, line-height 1.8–1.85 |
| Ô nhập mobile | 16px |
| Nhịp khoảng cách | 4, 8, 12, 16, 20, 24, 32px |
| Bo góc | Nút 6–8px, ô nhập 8px, thẻ 12–16px |
| Biểu tượng | SVG nét thống nhất, thông thường 16–18px, tên truy cập trên nút |
| Chuyển động | Ngắn, nhẹ; tôn trọng prefers-reduced-motion |

## Thành phần tái sử dụng

Sidebar theo vai trò, topbar, ô tìm kiếm, thanh prototype, page heading, tab, thẻ dự án, dòng hội thoại, avatar group, badge trạng thái, metric strip, bảng, form field, dialog, toast, biểu đồ, composer và context panel.

Mỗi vùng có một hành động chính màu xanh. Secondary dùng viền, tertiary dùng text. Lỗi và hết ngân sách có thông điệp bằng chữ; màu chỉ là tín hiệu bổ sung. Mọi nội dung AI mẫu có nhận diện nhà cung cấp; chi phí ghi rõ là dữ liệu minh họa.

## Nguyên tắc nội dung

- Giao diện tiếng Việt, câu ngắn, dùng “dự án”, “hội thoại”, “nguồn AI”, “quyền đóng góp”.
- Trình bày rõ chủ doanh nghiệp được xem dự án công việc.
- Tách gói Plus/Pro khỏi kết nối API để không tạo kỳ vọng tái sử dụng subscription làm API.
- Không hứa đồng bộ website liên tục; import có nguồn, thời điểm và cảnh báo thiếu dữ liệu.
- Không hiển thị thông tin kỹ thuật credential cho nhân viên.

## Điểm cần duyệt khi chuyển sang sản phẩm thật

Tên thương hiệu/logo cuối cùng, độ lớn chữ dữ liệu dày đặc, mức ưu tiên màn mobile, ngân sách và ngưỡng cảnh báo thật, nhà cung cấp/model được duyệt, chính sách lưu dữ liệu và khả năng import mỗi nền tảng. Prototype dùng chữ cái trong dấu nhà cung cấp để tránh giả định bộ logo chính thức.
