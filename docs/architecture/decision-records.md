# Nex AI Hub — Architecture Decision Records

Ngày: 02/11/2026. **ADR-008 được chọn ở mức hướng kiến trúc và ADR-011 được chọn ở mức chính sách quyền xem; các ADR khác vẫn Proposed nếu chưa ghi trạng thái riêng.** Cơ sở yêu cầu hiện tại: [architecture-v0.2.md](architecture-v0.2.md). Các nhãn nguồn S1–S18 trong ADR-001 đến ADR-007 tham chiếu [bản v0.1](architecture-v0.1.md); ADR-008 và ADR-009 tham chiếu v0.2. Lựa chọn API không đồng nghĩa đã duyệt mức ngân sách hoặc mua dịch vụ.

## ADR-001 — Lõi chung, hai đường tiếp nhận hội thoại

- **Bối cảnh:** Người dùng cần chat trong Hub và gom lịch sử từ website/app hiện có.
- **Quyết định đề xuất:** Dùng AI Gateway cho hội thoại mới, Import & Sync cho dữ liệu bên ngoài; cùng ghi vào Conversation Archive có nguồn gốc rõ ràng.
- **Lựa chọn khác:** Chỉ chat API không bao phủ lịch sử bên ngoài; chỉ gom tab không giải quyết kho dữ liệu; chỉ đồng bộ không giảm chuyển giao diện.
- **Hệ quả tích cực:** Một mô hình dự án/quyền/tìm kiếm áp dụng cho mọi dữ liệu.
- **Đánh đổi:** Phải đối soát nhiều nguồn, duy trì adapter và hiển thị giới hạn hỗ trợ.

## ADR-002 — Modular monolith và worker cùng codebase

- **Bối cảnh:** Đã xác nhận 5 nhân viên và một chủ doanh nghiệp; chưa xác định đội phát triển, tải request hay nhu cầu triển khai độc lập.
- **Quyết định đề xuất:** Một backend có ranh giới module, worker dùng chung codebase; triển khai riêng worker khi cần.
- **Lựa chọn khác:** Monolith không chia module dễ bắt đầu nhưng khó thay connector; microservices tăng giao tiếp mạng, vận hành và nhất quán dữ liệu.
- **Hệ quả tích cực:** Dễ triển khai, kiểm tra quyền và quản lý giao dịch; ít dịch vụ phải vận hành.
- **Đánh đổi:** Các module dùng chung chu kỳ phát hành và có thể cùng chịu tác động khi backend lỗi. Xem lại khi có đội độc lập hoặc nút thắt đã đo.

## ADR-003 — Tách tài khoản, thuê bao, kết nối và quyền nội bộ

- **Bối cảnh:** Tài khoản/gói trả phí không đồng nghĩa quyền API, quyền đọc lịch sử hoặc quyền xem dự án trong Hub.
- **Quyết định đề xuất:** Các thực thể riêng; secret chỉ ở máy chủ, danh mục tài khoản không chứa mật khẩu/cookie. Cấp quyền kết nối qua Hub; quản trị nội dung dự án là quyền riêng.
- **Lựa chọn khác:** Dùng chung đăng nhập nhà cung cấp gây khó quy trách nhiệm; gộp tài khoản với API key không mô tả được billing/scopes và nhiều kết nối.
- **Hệ quả tích cực:** Thu hồi và kiểm toán theo người; quản lý được cả tài khoản chưa có API.
- **Đánh đổi:** Nhiều bước cấu hình hơn. Với phạm vi v0.2, không cấp seat nhà cung cấp cho nhân viên; thu hồi quyền trong Hub là luồng chính. Chỉ theo dõi seat riêng nếu mô hình kinh doanh thay đổi về sau.
- **Tham chiếu:** S3, S8, S11–S14 trong tài liệu kiến trúc.

## ADR-004 — Thu nhận một chiều, dữ liệu nguồn có phiên bản

- **Bối cảnh:** Cần gom dữ liệu về một chỗ; chưa có yêu cầu ghi ngược và chưa xác minh cơ chế đồng bộ phổ thông cho cả bốn nền tảng.
- **Quyết định đề xuất:** Import/API lịch sử/extension là adapter đọc; lưu provenance, revision, độ đầy đủ theo phạm vi, cursor và tombstone. Tiếp tục chat trong Hub tạo nhánh mới.
- **Lựa chọn khác:** Hai chiều có thêm xung đột sửa/xóa và phụ thuộc quyền ghi ở nguồn; coi file export là đồng bộ trực tiếp gây kỳ vọng sai.
- **Hệ quả tích cực:** Dễ đối soát và không thay đổi ngoài ý muốn dữ liệu gốc.
- **Đánh đổi:** Phản hồi trong Hub không xuất hiện tự động trong app nguồn. Cần hiển thị rõ phiên bản mới/cũ và trạng thái thiếu.
- **Tham chiếu:** S2, S5, S7, S8, S15 trong tài liệu kiến trúc.

## ADR-005 — PostgreSQL và kho tệp riêng tư

- **Bối cảnh:** Quyền, dự án, tài khoản và usage có quan hệ chặt; nội dung provider lại khác nhau và có tệp lớn.
- **Quyết định đề xuất:** PostgreSQL cho dữ liệu quan hệ/JSONB; object storage cho tệp và bản nguồn chọn lọc. Bắt đầu tìm kiếm bằng DB; đánh giá tiếng Việt trên dữ liệu thật.
- **Lựa chọn khác:** MySQL vẫn khả thi theo kinh nghiệm đội; MongoDB cần xử lý quan hệ/quyền cẩn thận; search engine/vector DB riêng tăng vận hành trước khi nhu cầu được chứng minh.
- **Hệ quả tích cực:** Giao dịch và mô hình quyền tập trung; giữ metadata đặc thù của provider.
- **Đánh đổi:** Cần quản lý index, migration và tính nhất quán DB–tệp. Thêm công cụ tìm kiếm khi chất lượng hoặc hiệu năng không đạt.
- **Tham chiếu:** S16–S17 trong tài liệu kiến trúc.

## ADR-006 — Web app trước; extension là connector, desktop là phương án sau

- **Bối cảnh:** Cần nhiều nhân viên dùng chung và giảm chuyển công cụ; chưa biết hệ điều hành, bề mặt chat và yêu cầu giữ nguyên app gốc.
- **Quyết định đề xuất:** Web app cho quản lý/chat API, import cho lịch sử; extension chỉ phát hành theo nguồn đã qua thử nghiệm. Nghiên cứu desktop sau nếu giá trị gom cửa sổ đủ lớn.
- **Lựa chọn khác:** Desktop wrapper hỗ trợ quản lý cửa sổ/phiên nhưng tăng bảo trì và không tự giải quyết quyền lấy lịch sử; nhúng website chưa được chứng minh khả thi với mọi nguồn.
- **Hệ quả tích cực:** Phát hành tập trung, hỗ trợ nhiều thiết bị, có đường nhập dữ liệu khi connector lỗi.
- **Đánh đổi:** Chưa gom nguyên vẹn mọi tính năng app gốc vào một cửa sổ; capture trình duyệt không bao phủ mobile/native.
- **Tham chiếu:** S15, S18 trong tài liệu kiến trúc.

## ADR-007 — Adapter theo khả năng; không tự chuyển nhà cung cấp

- **Bối cảnh:** Mỗi API khác về công cụ, ngữ cảnh, usage và xử lý lỗi; dữ liệu gửi đi chịu quyền dự án và lựa chọn người dùng.
- **Quyết định đề xuất:** Chuẩn hóa nội dung nhưng giữ metadata nguồn; registry model/capability theo kết nối. Kiểm tra và giới hạn ngữ cảnh/chi phí. Không gửi lại hoặc chuyển provider âm thầm khi kết quả chưa rõ.
- **Lựa chọn khác:** Một giao diện chỉ dựa trên mẫu OpenAI làm mất đặc thù; auto-fallback có thể gửi dữ liệu ngoài lựa chọn, tăng chi phí và làm thay đổi kết quả.
- **Hệ quả tích cực:** Người dùng biết dữ liệu đi đâu, tính năng nào được hỗ trợ và lượt nào bị gián đoạn.
- **Đánh đổi:** Cần duy trì mapping/capability và thêm thao tác xác nhận khi đổi provider. Dự toán usage không luôn trùng hóa đơn.
- **Tham chiếu:** S1, S4, S6, S9 trong tài liệu kiến trúc.

## ADR-008 — API công ty quản lý cho nhân viên chỉ đăng nhập Hub

- **Trạng thái:** Accepted ở mức hướng kiến trúc ngày 02/11/2026, theo lựa chọn “Ưu tiên nhân viên chỉ dùng Hub; có thể xem xét ngân sách API tập trung.” Hạn mức tiền, tài khoản API thực tế và chi tiết triển khai chưa được chốt.
- **Bối cảnh:** Người dùng có một ChatGPT Plus, một Gemini Pro, một Claude Pro và một Meta AI free; muốn 5 nhân viên dùng qua Hub mà không có tài khoản nhà cung cấp riêng.
- **Quyết định:** Dùng credential API của ứng dụng do công ty quản lý, gán danh tính và ngữ cảnh từng nhân viên tại Hub. Tiếp tục đặc tả theo hướng này; mức chi cho gọi API thật được xác định riêng.
- **Lựa chọn khác:** Proxy phiên website cá nhân không giải quyết giới hạn chia sẻ tài khoản và cô lập trạng thái nguồn. Cấp account/seat riêng trái phạm vi người dùng đã nêu. Hub chỉ quản lý/import phù hợp nếu chưa chi API, nhưng không đáp ứng toàn bộ nhu cầu chat của nhân viên.
- **Hệ quả tích cực:** Một đầu mối quản trị/chi phí; nhân viên không đăng nhập provider; usage và quyền theo dự án.
- **Đánh đổi:** API tính phí riêng; các gói hiện có không mặc định cấp hạn mức backend; tính năng API khác app gốc. Meta cần kiểm chứng quyền truy cập.
- **Tham chiếu:** v0.2, S1–S5 và S7–S11.

## ADR-009 — Thu gọn MVP cho 6 danh tính nội bộ, kiểm soát dùng chung kết nối

- **Bối cảnh:** Phạm vi đã rõ là một công ty nhỏ, không cấp tài khoản nhà cung cấp cho từng nhân viên.
- **Quyết định đề xuất:** Giữ User, ProjectMember, ProviderConnection, ConnectionGrant, Run, UsageRecord; bỏ SeatAssignment khỏi MVP. Mỗi Run gắn người thực hiện/dự án và ngữ cảnh riêng. Giới hạn dùng chung theo provider cùng giới hạn từng người.
- **Lựa chọn khác:** Giữ đầy đủ quản trị seat/SSO doanh nghiệp tăng phạm vi không cần thiết; chỉ dựa vào tài khoản provider không phân biệt được tác giả và dự án.
- **Hệ quả tích cực:** Ít cấu hình hơn; có thể khóa từng người mà không đổi credential chung nếu khóa không bị lộ.
- **Đánh đổi:** Cần phân quyền server cho mọi tài nguyên provider dùng chung. Lịch sử website cũ chưa rõ tác giả phải giữ trạng thái chưa biết; không suy đoán từ người nhập hoặc email tài khoản chung.
- **Tham chiếu:** v0.2, các mục 4–6.

## ADR-010 — Quản lý chi tiêu tại Hub theo lượt chạy, người dùng và công ty

- **Trạng thái:** Proposed.
- **Bối cảnh:** Nhiều nhân viên sử dụng cùng kết nối; chi phí API chưa có ngân sách cụ thể và không thể suy ra từ phí thuê bao cá nhân.
- **Quyết định đề xuất:** Dùng ngân sách chung và hạn mức từng người, dự toán trước khi gửi, giữ trước chi phí trong giao dịch và đối soát usage sau khi chạy. Tất cả thao tác AI do Hub tạo cũng phải đi qua cơ chế này. Cảnh báo ngưỡng cấu hình được và ngừng nhận lượt AI mới khi ngân sách khả dụng không đủ.
- **Lựa chọn khác:** Chỉ xem dashboard nhà cung cấp không phân bổ được đầy đủ chi phí theo nhân viên/dự án; chỉ đặt giới hạn số tin nhắn bỏ qua độ dài ngữ cảnh, công cụ và giá model.
- **Hệ quả tích cực:** Theo dõi được người dùng/nguyên nhân phát sinh phí; hạn chế nhiều request đồng thời cùng vượt ngân sách; vẫn đọc/xuất được dữ liệu khi hết ngân sách.
- **Đánh đổi:** Dự toán khác hóa đơn; lượt đang chạy hoặc usage ngoài Hub có thể phát sinh thêm phí. Phải giữ trạng thái chưa đối soát, giới hạn output/công cụ và kiểm tra số liệu nhà cung cấp; không quảng cáo giới hạn Hub là trần tuyệt đối trên hóa đơn.
- **Tham chiếu:** [MVP scope](mvp-scope.md), mục 4.

## ADR-011 — Owner xem toàn bộ dự án công việc, nhân viên theo quyền dự án

- **Trạng thái:** Accepted ở mức chính sách ngày 02/11/2026, theo lựa chọn “Bạn xem toàn bộ dự án công việc; nhân viên thấy dự án của mình và dự án được chia sẻ.” Các chi tiết kỹ thuật thực thi vẫn là đề xuất.
- **Bối cảnh:** Cần khả năng giám sát và bàn giao công việc trong một công ty có 5 nhân viên; dự án của nhân viên vẫn cần tách quyền với nhau.
- **Quyết định:** Owner có quyền đọc tất cả dự án công việc trong workspace, không cần lời mời từng dự án. Employee chỉ đọc dự án mình sở hữu hoặc được chia sẻ. Giao diện thông báo rõ chủ doanh nghiệp có quyền xem nội dung.
- **Thiết kế thực thi đề xuất:** Kiểm tra tài khoản hoạt động và workspace trước khi áp dụng quyền Owner/chủ dự án/thành viên. Áp dụng cùng phạm vi cho hội thoại, tìm kiếm, trích dẫn, tệp và xuất; kiểm tra lại quyền ở job nền. Ghi audit thao tác đọc/tải/xuất và thay đổi quyền. Quyền xem toàn bộ không tự cấp quyền ghi/chia sẻ lại/gọi AI ở dự án người khác.
- **Lựa chọn khác:** Owner chỉ xem dự án được chia sẻ không phù hợp lựa chọn người dùng; cho mọi nhân viên xem mọi dự án làm mất phạm vi phân quyền cần thiết.
- **Hệ quả tích cực:** Chủ doanh nghiệp theo dõi toàn bộ công việc; quyền nhân viên được kiểm soát tại từng dự án.
- **Đánh đổi:** Dự án công việc không riêng tư với Owner; thông báo quyền xem phải hiện rõ. Tài khoản Owner có phạm vi đọc rộng, nên phải bảo vệ và kiểm toán phù hợp. Admin được ủy quyền về sau không tự có cùng quyền đọc.
- **Tham chiếu:** [Kiến trúc v0.2](architecture-v0.2.md), R10; [MVP scope](mvp-scope.md), mục 3 và 6.
