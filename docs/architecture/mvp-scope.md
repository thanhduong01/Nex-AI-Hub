# Nex AI Hub — Phạm vi MVP và kiểm soát chi phí

Ngày: 02/11/2026. Hướng đã chọn: 1 chủ doanh nghiệp + 5 nhân viên, chỉ đăng nhập Hub, API do công ty quản lý; Owner xem toàn bộ dự án công việc, nhân viên thấy dự án sở hữu/được chia sẻ. Các chi tiết triển khai dưới đây là đề xuất, chưa phải phần mềm đã triển khai. Cơ sở: [kiến trúc v0.2](architecture-v0.2.md).

## 1. Kết quả cần đạt

Nhân viên mở Hub, chọn dự án, chọn AI và trao đổi. Dữ liệu được lưu với nguồn và người thực hiện; nhân viên tìm lại được nội dung trong phạm vi mình được phép. Chủ doanh nghiệp cấu hình kết nối và xem chi phí theo người/dự án/nhà cung cấp.

Hội thoại mới trong Hub là luồng chính. Lịch sử từ website/app được nhập riêng, hiển thị nguồn và mức độ đầy đủ. Không đặt đồng bộ toàn bộ lịch sử bên ngoài làm điều kiện để nhân viên bắt đầu làm việc trong Hub.

## 2. Màn hình và luồng sử dụng

| Màn hình | Chức năng bắt buộc | Người sử dụng |
|---|---|---|
| Đăng nhập | Đăng nhập, khôi phục truy cập, đăng xuất; khóa tài khoản thì thu hồi phiên | Cả 6 người |
| Dự án | Tạo dự án, xem dự án có quyền, thêm thành viên với quyền đọc/đóng góp, lưu trữ | Theo quyền dự án |
| Hội thoại | Chọn AI/model, gửi/dừng, xem streaming, thử lại thành lượt mới, tạo nhánh khi đổi AI | Thành viên có quyền đóng góp |
| Kho hội thoại | Tìm kiếm, lọc dự án/nguồn/thời gian, xem trích dẫn, xuất dữ liệu có quyền | Theo quyền nội dung |
| Nguồn AI và tài khoản | Tài khoản hiện có, gói, ngày gia hạn; thêm/kiểm tra/thu hồi kết nối API; chọn model được dùng | Owner |
| Nhân viên và quyền dùng | Tạo/mời/khóa 5 nhân viên, cấp quyền kết nối và hạn mức | Owner |
| Chi phí | Báo cáo usage, cấu hình ngân sách và cảnh báo, xem các lượt chưa đối soát | Owner; Employee xem usage của mình |
| Nhập dữ liệu | Preview/import export, gán dự án và xem kết quả thiếu/trùng/lỗi | Owner; quyền import có thể cấp riêng |

Ví dụ luồng: nhân viên A tạo “Nghiên cứu sản phẩm” → chọn một model được cấp quyền → gửi câu hỏi → Hub lưu câu hỏi trước khi gọi API → hiển thị và lưu phản hồi → ghi usage → A tìm lại bằng từ khóa hoặc chia sẻ dự án với B.

“Lưu vào dự án” không đồng nghĩa tự gửi mọi dữ liệu dự án làm ngữ cảnh. Mỗi lượt chỉ sử dụng nhánh hội thoại và tài liệu được chọn/phù hợp với quyền. Đổi nhà cung cấp phải hiển thị nơi nhận dữ liệu.

## 3. Phân quyền

| Thao tác | Owner — chủ doanh nghiệp | Employee — nhân viên |
|---|---|---|
| Thêm hoặc xem secret API | Cấu hình/thay thế; không cần hiển thị lại secret đã lưu | Không |
| Cấp quyền kết nối, chỉnh ngân sách | Có | Không |
| Xem danh sách và nội dung dự án | Toàn bộ dự án công việc trong workspace | Dự án mình sở hữu hoặc được chia sẻ |
| Tạo dự án và chat | Tạo dự án; chat ở dự án mình sở hữu/có quyền đóng góp, chịu giới hạn chi phí | Tạo dự án; chat ở dự án mình sở hữu/có quyền đóng góp, chịu giới hạn chi phí |
| Chia sẻ dự án | Chủ dự án hoặc người được ủy quyền | Nếu là chủ dự án/người được ủy quyền |
| Tìm kiếm, tải tệp, xuất hội thoại | Toàn bộ dự án công việc; tải/xuất theo cùng phạm vi đọc là thiết kế đề xuất | Theo quyền đọc dự án |
| Xem usage toàn công ty | Có, mặc định không cần nội dung prompt | Chỉ usage của mình |
| Khóa nhân viên và bàn giao | Có; thu hồi phiên, kết nối được cấp, bàn giao quyền sở hữu | Không |

**Chính sách đã được người dùng chọn:** Owner xem toàn bộ dự án công việc; Employee chỉ thấy dự án của mình hoặc được chia sẻ. MVP có hai vai trò này; nếu thêm Admin kỹ thuật về sau, quyền của Admin cần định nghĩa riêng.

Trên màn hình tạo/chia sẻ dự án, thông báo “Dự án công việc — chủ doanh nghiệp có quyền xem nội dung”. Dùng tên “Dự án của tôi” cho nơi tổ chức công việc của nhân viên. Quyền xem của Owner không đồng nghĩa quyền sửa nội dung, gửi prompt hoặc chia sẻ lại dự án của người khác; các thao tác đó vẫn theo quyền đóng góp/quản lý dự án.

Quy tắc đọc phía backend: người dùng phải đang hoạt động và thuộc workspace của dự án; sau đó cho đọc nếu là Owner của workspace, chủ dự án hoặc thành viên có quyền đọc. Quy tắc áp dụng đồng nhất cho danh sách, tìm kiếm và đoạn trích, API hội thoại, tệp, xuất dữ liệu và job nền. Kiểm tra lại quyền khi thực thi job hoặc cấp đường dẫn tải. URL đã ký chỉ có hiệu lực ngắn; nếu cần thu hồi ngay cả URL đã cấp thì dùng đường tải qua backend có xác thực.

Ghi audit khi mở nội dung, tải/xuất hoặc thay đổi quyền; lưu actor, tài nguyên, hành động và thời điểm thay vì sao chép nội dung prompt vào log. Quyền Owner xem nhiều dự án không tự mở rộng ngữ cảnh gửi tới AI; người dùng vẫn chọn đúng dự án/tài liệu cho từng lượt.

## 4. Kiểm soát chi phí

### 4.1 Ngân sách và đo lường

- Tổng ngân sách API công ty theo tháng, gồm cả chủ doanh nghiệp và 5 nhân viên.
- Hạn mức từng người; hạn mức theo provider có thể thêm nếu cần quản trị. Quyền sử dụng một model không đồng nghĩa người đó có quota riêng tại nhà cung cấp.
- Ngưỡng cảnh báo cấu hình được; đề xuất 80% và 95%. Khi ngân sách khả dụng không đủ, chặn lượt AI mới, giữ nội dung người dùng vừa soạn và vẫn cho đọc/xuất hội thoại đã lưu.
- Không tự nâng hạn mức, mua credits hoặc bật tự nạp tiền. Các thay đổi cấu hình ngân sách có audit.
- Theo dõi riêng chi phí thuê bao hiện có, chi phí API theo bảng giá, credits áp dụng và số tiền thực thanh toán. Không cộng trùng.

### 4.2 Luồng kiểm tra trước và sau mỗi lượt

1. Kiểm tra người dùng, quyền dự án, model, provider và bộ công cụ được bật.
2. Ước lượng input gồm ngữ cảnh gửi lại; đặt giới hạn output và số lượt công cụ trước khi dự toán.
3. Dùng giao dịch để giữ trước ngân sách chung và ngân sách người dùng. Nếu không đủ, trả lý do và không gọi provider.
4. Chạy yêu cầu, lưu mã lượt và thông tin request của provider nếu có.
5. Đối soát token/công cụ/tệp và giá có hiệu lực; cập nhật usage, giải phóng phần giữ trước còn thừa khi đã có căn cứ.
6. Timeout hoặc usage chưa rõ giữ trạng thái pending reconciliation; không tự coi chi phí bằng 0 rồi hoàn toàn bộ ngân sách giữ trước.

Tạo tiêu đề tự động, tóm tắt, xử lý tệp hoặc tác vụ AI nền cũng phải đi qua bộ kiểm soát chi phí; không có đường gọi phụ bỏ qua ngân sách. Nếu chưa tính được cận trên hợp lý cho một tính năng, không bật tính năng đó dưới chế độ chặn ngân sách nghiêm ngặt của MVP.

Giới hạn tại Hub kiểm soát lượt gửi qua Hub; không bảo đảm hóa đơn không thể vượt đúng một con số vì còn usage báo muộn, lượt đã chạy, công cụ đặc thù hoặc usage ngoài Hub. Nên dùng project/key dành cho ứng dụng và đối chiếu dashboard nhà cung cấp; không chia sẻ key cho công cụ ngoài rồi kỳ vọng báo cáo Hub bao phủ mọi chi phí.

### 4.3 Cách xác định số tiền

Chưa đặt ngân sách bằng tiền và chưa báo giá API. Thu thập: số lượt mỗi ngày, độ dài câu hỏi/lịch sử, độ dài phản hồi, tỷ trọng model và công cụ/tệp. Khi định giá phải lấy bảng giá chính thức còn hiệu lực của model thực tế, không dùng giá thuê bao Plus/Pro để quy đổi.

```text
Chi phí API dự kiến = tổng chi phí các lượt nhân viên
                   + tổng chi phí các lượt chủ doanh nghiệp
                   + tổng chi phí tác vụ AI nền
                   + công cụ/lưu trữ API nếu có

Chi phí một lượt = input được tính phí + output được tính phí
                + cache/công cụ/media/lưu trữ áp dụng cho lượt đó
```

Pilot đề xuất kéo dài một tuần làm việc với hạn mức tiền được chủ doanh nghiệp chọn trước khi gọi API thật. Báo cáo pilot cho biết chi phí theo người/model, độ dài ngữ cảnh, chất lượng và số lần chạm quota. Từ đó xác định ngân sách tháng; không mặc định nhân viên có mức dùng bằng nhau.

## 5. Phạm vi theo thứ tự triển khai

| Bước | Công việc | Điều kiện qua bước |
|---|---|---|
| A — Nền tảng | Đăng nhập, 6 danh tính, phân quyền, dự án, danh mục tài khoản và kho bí mật | Kiểm tra quyền server cho đọc/ghi/tìm/xuất; không lộ secret ra client |
| B — Luồng chat hoàn chỉnh | Một provider API trước để kiểm chứng, chat text, lưu streaming, usage, hạn mức, lịch sử | Gửi→lưu→tìm lại được; lỗi không mất prompt; người khác không đọc được dữ liệu ngoài quyền |
| C — Đa provider | Thêm OpenAI/Gemini/Claude còn lại; Meta sau khi kiểm chứng quyền truy cập; đổi model tạo nhánh | Bộ khả năng và tình trạng được hiển thị chính xác; cùng kết nối không trộn ngữ cảnh |
| D — Lịch sử và vận hành | Import nguồn đã xác minh, chống trùng, phân loại, backup, khôi phục, pilot có giới hạn | Import lặp không nhân đôi; thiếu tác giả/tệp được báo; thử khôi phục thành công |

Provider đầu tiên chọn theo quyền truy cập thực tế và tác vụ ưu tiên, chưa mặc định một model cụ thể. Bước B là mốc kỹ thuật, không phải tuyên bố sản phẩm đã đáp ứng đủ bốn nền tảng.

Đề xuất phiên bản đầu ưu tiên chat văn bản và trích dẫn nguồn được API trả về. Search/grounding, tệp, ảnh, voice và deep research bật theo khả năng đã kiểm chứng, được tính phí rõ ràng và có tiêu chí nghiệm thu riêng. Tiện ích trình duyệt, đồng bộ liên tục, tìm kiếm ngữ nghĩa và agent tự động thuộc phần mở rộng; nhu cầu gom dữ liệu bên ngoài được giữ bằng import trước.

## 6. Kiểm tra nghiệm thu trọng yếu

- Hai nhân viên cùng dùng một provider: tách ngữ cảnh, quyền tệp, kết quả tìm kiếm và chi phí đúng người.
- Người chỉ có quyền đọc dự án không thể gửi prompt, sửa hoặc chia sẻ lại bằng cách gọi API trực tiếp.
- Owner xem được dự án chưa từng được thêm làm thành viên; kết quả tìm kiếm bao phủ các dự án công việc trong workspace. Quyền xem không cho phép gọi endpoint ghi/gửi prompt ngoài quyền đóng góp.
- Employee không thấy tiêu đề, đoạn trích, số liệu hay tệp của dự án ngoài quyền, kể cả khi biết ID/URL. Khi được chia sẻ quyền đọc thì xem được; khi thu hồi thì request mới và job chờ bị từ chối.
- Hai lượt đồng thời gần hết ngân sách không cùng sử dụng một khoản tiền khả dụng; có lượt bị chặn/chờ đúng trạng thái.
- Người dùng nhấn gửi lại hoặc trình duyệt retry không tạo trùng lượt do cùng mã yêu cầu. Lượt mới do chủ động thử lại vẫn được ghi riêng.
- Provider lỗi, mất mạng, dừng phản hồi: prompt và phần đã nhận giữ được; không ghi hoàn tất nếu phản hồi dở dang.
- Khóa nhân viên đang đăng nhập: request mới bị chặn và job chờ kiểm tra lại quyền.
- Import hai lần và import dữ liệu không rõ tác giả: không trùng, không tự tạo nguồn/tác giả giả.
- Khi hết ngân sách: đọc/xuất dữ liệu vẫn hoạt động; không tự đổi nhà cung cấp để tiếp tục phát sinh phí.

Đây là tiêu chí thiết kế; chưa chạy kiểm thử vì chưa có triển khai. Quyền xem dự án của Owner đã chốt; mức ngân sách pilot và tính năng AI ưu tiên là hai đầu vào còn cần chốt để hoàn thiện đặc tả.
