# Nex AI Hub · UI/UX prototype

Bản thiết kế ngày 03/11/2026, dựa trên architecture-v0.2 và skill `ui-ux-pro-max`.

## Mở prototype

**Cách đơn giản nhất:** mở `Nex-AI-Hub-Prototype.html` bằng Safari hoặc Chrome. File này chứa toàn bộ giao diện, chạy offline, không cần cài thư viện hoặc chạy máy chủ. Trong Finder, chọn **Open With → Safari / Google Chrome** nếu ứng dụng mặc định mở mã nguồn.

**Bản preview đang chạy:** http://127.0.0.1:4173/#/overview — chỉ truy cập trên máy chạy preview. Nếu máy chủ đã dừng, dùng file HTML ở trên hoặc khởi động lại:

```sh
cd '/Users/macbookpro/Documents/ChatGPT/Nex Ai Hubs/prototype/nex-ai-hub/dist'
python3 -m http.server 4173 --bind 127.0.0.1
```

## Cách khám phá

- Bấm **Các màn hình** trên thanh trên cùng để mở bản đồ 13 màn hình và 6 trạng thái.
- Đổi **Vai trò xem thử** để so sánh Chủ doanh nghiệp và Nhân viên Linh.
- Thử tạo dự án → mở hội thoại mới → gửi câu hỏi mẫu → chọn AI.
- Mở một hội thoại có sẵn → chọn AI khác để xem luồng tạo nhánh, giữ nguyên nguồn gốc hội thoại cũ.
- Mở Nguồn AI để xem hai tab Kết nối API và Tài khoản & gói.
- Mở Nhập dữ liệu → Dùng tệp mẫu → kiểm tra → kết quả.
- Dùng menu trạng thái để xem dữ liệu trống, đang tải, lỗi kết nối, hết ngân sách và chỉ xem.

## Phạm vi

Đây là prototype giao diện với điều hướng và trạng thái mô phỏng trong bộ nhớ. Không có backend, xác thực, lưu trữ bền vững, gọi AI, tải tệp lên, gửi email hay thanh toán. Tải lại trang khôi phục dữ liệu mẫu. Các nút cấu hình và xuất báo cáo mở bản xem trước, không thay đổi hệ thống thật.

Tên, email `.example`, số tiền, token, trạng thái kết nối và ngày gia hạn đều là minh họa. Ngân sách thật chưa được chốt. Meta ở trạng thái chờ xác minh khả năng tích hợp. Phân quyền trong prototype chỉ minh họa UX; hệ thống thật phải kiểm tra ở server.

## Tệp bàn giao

- `Nex-AI-Hub-Prototype.html`: file độc lập để xem và chia sẻ nội bộ.
- `dist/`: mã nguồn giao diện tách file, không cần build hoặc dependency.
- `screenshots/`: ảnh desktop/mobile chụp từ prototype.
- `../../docs/ux/prototype-spec.md`: danh sách màn hình, luồng và trạng thái.
- `../../design-system/nex-ai-hub/MASTER.md`: quy tắc thiết kế.

## Đã kiểm tra

- Cú pháp 4 file JavaScript bằng `node --check`.
- Hiển thị trên viewport 1440×1000 và 375×812; các route chính không tràn ngang toàn trang ở 375px. Bảng dữ liệu có cuộn ngang riêng.
- Tạo dự án, chat mô phỏng, chọn AI tạo nhánh, menu mobile, nhập dữ liệu 3 bước, màn gói thuê bao, hết hạn mức và phục hồi từ lỗi.
- Owner chỉ xem dự án p3; nhân viên Linh được đóng góp p3 và bị từ chối p4.
- Không ghi nhận lỗi JavaScript trong console qua các luồng đã thử.

Kiểm tra UX này không thay cho kiểm thử bảo mật hoặc chức năng hệ thống thật.
