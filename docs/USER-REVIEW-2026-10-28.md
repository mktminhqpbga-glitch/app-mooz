# Xử lý đánh giá người dùng ngày 28/10/2026

Cơ sở: 0.44.0 `cbf440f`. Bản sửa 0.45.0 trên nhánh `feat/review-usability-045`, được đưa vào `main` theo yêu cầu ngày 28/10/2026. GitHub Actions chạy lại kiểm thử và đóng gói Mac cho đúng commit; bộ cài nằm trong artifact, chưa Publish Release.

| Mục đánh giá | Cách xử lý |
|---|---|
| P0.1 Sidebar hẹp | Rail 62px dưới 760px, icon có tên truy cập/tooltip; mở drawer để tìm và đọc nhãn. |
| P0.2 Thông báo cắt | Tối đa 3 dòng chọn được; nút Xem đầy đủ mở bản chụp nội dung, Sao chép và fallback phím tắt. Nằm trong viewport phía trên dock. |
| P0.3 Tên Chat cũ | Hộp chọn dự án mặc định trung tính; đổi `launchChat` thành `launchProject`, `appTool` mặc định canvas. Chat trong dự án vẫn là chức năng thật, không xóa mọi chuỗi Chat trên toàn repo. |
| P1.4 Nhóm cửa sổ | Cửa sổ có nhóm riêng với nhãn, tách khỏi nhóm Ứng dụng ở cuối sidebar. |
| P1.5 Bản đồ che | Giữ góc trên trái; mặc định thu thành nút Bản đồ, người dùng bấm mới mở. Không đổi thuật toán lưới/sắp xếp. |
| P1.6 Đường vào đăng bài | Tên thẻ trang chủ là Trung tâm & Đăng bài, đúng đích overview. Bản nháp vẫn truy cập trong mục Đăng bài. |
| P1.7 Thời lượng Affiliate | Preview mỗi cảnh + tổng giây clip, giây lời đọc và ký tự; mục tiêu riêng có lưu nháp, cảnh báo vượt mục tiêu/lời đọc vượt clip. Dùng cùng parser và phép đo với builder. |
| P1.8 Anh–Việt | Nhãn ghi chú, nhóm, đổi tên, nút timeline và hướng dẫn chỉnh sửa được Việt hóa. Tên menu/node đã chung NodeCatalog từ trước; không ghi nhận nhầm là lỗi còn tồn tại hoặc đổi tên người dùng đặt. |

Bổ sung: bảng lệnh ⌘/Ctrl+K (tên, mô tả, từ khóa công dụng, Arrow/Enter/Esc); tìm “ghép video”/“tách cảnh”; theme Đen tím áp dụng thật cho thư viện/canvas/Affiliate/Đăng bài/cài đặt; [bắt đầu trong 5 phút](QUICKSTART.md); ghi rõ tiện ích và giao thức trong README.

Giữ kịch bản riêng 1–12 cảnh, AI 3–5 cảnh; giữ Lưu nháp, bản đồ góc trên và ô tìm sidebar. Không gọi AI trả phí/đăng bài thật trong kiểm thử. Thời lượng là ước lượng, không phải cam kết kết quả AI hay báo giá.

## Phần tiếp theo trong thiết kế MooZ Agent

Panel chỉnh node bên phải, cấu hình mặc định/chỉ dẫn ba mức, thay nhận diện và hợp nhất cửa sổ vẫn theo [đặc tả MooZ Agent](../designs/MOOZ-AGENT-PLAN.md). Đợt này sửa các điểm P0/P1 trên app thật trước; không tuyên bố prototype đã là bộ cài.

Backlog còn cần triển khai/đánh giá riêng: viết lại kịch bản có phiên bản giữ nguồn, nghe thử lời đọc qua nhà cung cấp, xem chính xác bài đăng và lịch theo thương hiệu, ước lượng tài nguyên tại canvas, so khung hình với ảnh sản phẩm, xuất nhiều tỷ lệ một chạm và nhật ký lỗi đã lọc thông tin riêng. Khả năng mẫu workflow/kiểm tra trước chạy đang có phải được kiểm tra trước khi tạo một đường chức năng trùng lặp.

Theo phản hồi màu mới, **Đen tím** là hướng thiết kế ưu tiên; theme được chọn trong app, không ghi đè lựa chọn sáng/tối hiện có. Màu nút chính `#7c3aed`, tương tác `#8b5cf6`, nền `#0d0b14`, chữ trắng dịu; giữ preset khác cho tùy chỉnh sau.


## Kết quả kiểm chứng trên bản sửa

- `npm test`: **220/220**, không lỗi (217 kiểm thử hiện có + 3 kiểm thử parser/ước lượng/theme mới).
- `npm run test:desktop`: **13/13 nhóm Electron**, không lỗi. Giữ toàn bộ 12 nhóm trước và thêm `desktop-user-review-smoke.cjs`.
- `node tests/desktop-user-review-smoke.cjs`: chạy lại sau chỉnh nhãn mobile/focus; qua cả đổi tên node tiếng Việt, thêm ghi chú bằng Enter, đọc đúng clipboard hoặc kiểm tra fallback chọn toàn bộ văn bản.
- `node tests/compact-toolbar-smoke.cjs`: Chromium thật, qua các chiều rộng 620–1500px. Kiểm tra native mới bổ sung 360px, rail 62px, drawer tìm kiếm, không tràn ngang/chồng lên dock.
- Affiliate: nguồn mô phỏng → kịch bản riêng 12 cảnh → preview từng cảnh/cảnh báo mục tiêu → lưu/reload giữ nháp và mục tiêu → 12 node video. Không phát sinh yêu cầu AI.
- Toàn bộ suite vẫn kiểm tra thật các file MP4/FFmpeg, lưu dự án/khôi phục, nhận kết quả AI bằng fixture và hàng chờ đăng bài. Không xác minh tài khoản AI đang đăng nhập hoặc bài đăng thật.

| Mục | Bằng chứng tương tác |
|---|---|
| P0.1 | Electron 360×800, đo rail/canvas, mở/đóng drawer, nhãn icon ẩn đúng, không tràn ngang |
| P0.2 | Thông báo dài 18 câu, wrap/chọn, modal giữ nguyên văn, clipboard/fallback, nằm trên dock |
| P0.3 | Hộp chọn dự án HTML trung tính; luồng Lồng tiếng hiện có vẫn qua suite UX |
| P1.4 | Nút Cửa sổ thuộc nav riêng, danh sách nhiều cửa sổ và chuyển về trang chủ qua suite UX |
| P1.5 | Từ 6 node có nút Bản đồ; mặc định đóng; mở/thu thật và di chuyển viewport qua suite UX |
| P1.6 | Tên thẻ Trung tâm & Đăng bài khớp overview; suite workspace và studio-refresh đi qua cửa này |
| P1.7 | Parser preview = builder, đủ 12 cảnh; phát hiện lời đọc vượt 15 giây; mục tiêu lưu/reload; 12 node thật |
| P1.8 | Danh mục menu/node qua unit/UX; bấm đổi tên hiện tiếng Việt; Enter thêm Ghi chú có placeholder tiếng Việt |

Các dòng trên dùng chung bộ kiểm thử đã nêu, không phải 8 bộ kiểm thử độc lập. Giao diện đã được xem bằng ảnh chụp Electron thật, gồm theme Đen tím; preview thiết kế được cập nhật cùng hướng màu. Phiên bản ứng dụng được nâng thành 0.45.0 để phân biệt bộ cài mới; tiện ích Workflow Connect vẫn 1.0.0. Kiểm tra trạng thái đóng gói tại GitHub Actions của repo trước khi tải artifact.
