# MooZ Agent 0.48.0

MooZ có vòng Agent cho công việc sáng tạo trong app: nhận mục tiêu → lập kế hoạch bằng AI → kiểm tra kế hoạch → người dùng duyệt → gọi công cụ → đo kết quả → đánh giá → sửa có giới hạn → lưu thành phẩm. Canvas vẫn là cách chỉnh workflow thủ công, Chat vẫn là nơi hỏi đáp.

## Cách dùng

1. Trang dự án → **MooZ Agent** → chọn hoặc tạo dự án. Trong canvas, nút hình tia sáng **MooZ Agent** ở thanh trái mở cùng không gian nhiệm vụ.
2. Viết mục tiêu rõ: sản phẩm, đầu ra, độ dài, nhạc, có cần bản nháp hay không. Chọn tối đa 8 tệp hoặc kết quả có sẵn trong dự án. Hỗ trợ ảnh, video, âm thanh và TXT/MD. Tệp được sao chép vào dự án.
3. Chọn AI lập kế hoạch; chọn AI ảnh/video và tab riêng nếu nhiệm vụ cần chúng. Bấm **Cập nhật tab AI** sau khi tự mở thêm tab. API dùng cấu hình hiện có trong **AI & kết nối**. Đóng tab hoặc đổi cuộc trò chuyện có thể làm nhiệm vụ dừng; không tự chuyển sang một cuộc trò chuyện khác.
4. Đặt tỷ lệ và thời lượng tổng (để trống nếu không yêu cầu). Hạn mức mặc định: 20 lượt AI, 1 lần sửa mỗi bước, 60 phút hoạt động. Có thể sửa trước khi duyệt hoặc tiếp tục.
5. **Lập kế hoạch** có dùng một lượt AI. Xem từng công cụ và ước tính lượt còn lại; có thể sửa JSON, app kiểm tra lại cả đồ thị. **Duyệt & bắt đầu** mới cho chạy công cụ.
6. Theo dõi kết quả, kích thước/thời lượng thực, đánh giá, nhật ký và tiến độ. Chuyển sang canvas để chỉnh node; kết quả vẫn thuộc dự án đó. Lưu tệp dùng trình tải desktop, tên trùng được đánh số, không ghi đè tự động.

## Công cụ có thật

| Nhóm | Công cụ |
| --- | --- |
| AI | Viết/phân tích văn bản, tạo ảnh, tạo video qua các bộ nối đã có |
| Hậu kỳ | Ghép video theo thứ tự, cắt, chỉnh màu, đổi khung, trộn nhạc/lời đọc, chèn SRT |
| Giọng đọc | OpenAI TTS bằng khóa phiên đã cấu hình |
| Thành phẩm | Đọc kích thước/thời lượng, SHA-256 và dung lượng; lưu tệp thật |
| Đăng bài | Sao chép media/content thành bản nháp; xếp hàng/hẹn giờ tới đúng tài khoản được cấp quyền |

Đầu ra của bước trước truyền vào bước sau bằng tham chiếu có kiểu, không bằng câu “đã tạo xong” của AI. Ảnh/video trùng đúng byte với tham chiếu không được công nhận là ảnh/video mới. Video cuối phải đạt thời lượng yêu cầu; app không kéo dài giả hoặc xuất thiếu. Một clip AI có thể vẫn chỉ dài 10 giây: kế hoạch cần tạo đủ cảnh rồi ghép, hoặc báo chưa đạt. Từ chối của dịch vụ không được tự gửi lại.

## Kiểm tra và tự sửa

Kiểm tra kỹ thuật luôn bật. Khi bật đánh giá nội dung, AI xem ảnh hoặc ba khung hình của video, so yêu cầu và đề xuất prompt sửa cho riêng bước chưa đạt. Mỗi lần sửa có lưu đầu ra cũ; những bước đã đạt được giữ nguyên. Số lần sửa bị giới hạn theo từng bước. Cuối nhiệm vụ có một lượt đối chiếu mục tiêu với các thành phẩm thật; kiểm tra này cũng diễn ra trước bước gửi bài.

AI đánh giá nội dung có thể sai. Ba khung hình không chứng minh toàn bộ chuyển động/âm thanh đều đúng; người dùng cần xem video trước khi sử dụng. Tắt đánh giá nội dung nghĩa là hoàn tất theo kế hoạch và kiểm tra kỹ thuật, không có xác nhận ngữ nghĩa của AI.

## Nhật ký, hạn mức và gián đoạn

- Mục tiêu, quyền, kế hoạch đã duyệt, từng lần thử, đầu ra, lỗi và số lượt đã cấp lưu riêng theo dự án trong `agent-runs/<project>/<run>.json`. Ghi nguyên tử, bảo toàn bản lỗi; không lưu token hay khóa API vào nhật ký.
- Ghi ý định trước khi gọi công cụ; node mới có mã nhiệm vụ/bước/lượt thử. Sau crash hoặc tạm dừng, chỉ nhận lại thành phẩm đúng lượt và đúng SHA; không mặc định gửi lại tác vụ chưa rõ kết quả.
- **Kiểm tra & tiếp tục** giữ các bước thành công. Khi không đối chiếu được, người dùng phải kiểm tra tab/canvas rồi xác nhận chưa có kết quả mới được thử lại. Đăng bài cần đối chiếu trong ứng dụng Đăng bài, không có nút tự đăng lại mù.
- Hạn mức tính cả lập kế hoạch, tạo, đánh giá, sửa prompt và đối chiếu mục tiêu. Lượt đã cấp nhưng mất phản hồi vẫn tính để tránh vượt hạn mức. Đây là số lượt điều phối của Agent, không phải dự toán tiền; giá do dịch vụ quy định. Sau khi xếp lịch, hàng chờ Đăng bài xử lý riêng; lượt AI Muse viết/đăng ở hàng chờ không nằm trong hạn mức Agent, cần kiểm soát thêm ở cài đặt Đăng bài và tài khoản Muse. Thời gian tính khi công cụ hoạt động, không tính thời gian chờ người dùng.
- Đóng dự án đang chạy sẽ yêu cầu lưu/dừng; mở lại không tự gọi AI. App phải mở để tiếp tục điều phối. Không có dịch vụ chạy nền khi app đã thoát.
- Bộ nhớ dự án chỉ lấy tóm tắt và thông số thành phẩm từ các nhiệm vụ đã hoàn tất. File/nội dung AI là dữ liệu tham khảo, không cấp thêm quyền.

## Đăng bài

Mặc định **không cấp quyền đăng**. Agent có thể tạo bản nháp để bạn kiểm tra. Nếu bật quyền đăng, phải chọn trước các tài khoản đã kết nối và giờ đăng (trống = gửi ngay); duyệt kế hoạch có bước gửi là cấp quyền cho nhiệm vụ đó. Caption/media đã thay đổi sau khi chuẩn bị sẽ chặn gửi tự động để bạn kiểm tra lại. Quyền này không mở rộng sang tài khoản khác trong hàng chờ MooZ. Các công cụ/tài khoản đã kết nối trực tiếp trong Muse do Muse quản lý riêng; giới hạn công cụ của MooZ không thay đổi quyền bên trong dịch vụ AI đó.

Hàng chờ theo dõi độc lập từng nền tảng. “Đã gửi cho Muse”, “submitted” hay câu trả lời AI không đồng nghĩa đã đăng thành công. Agent giữ trạng thái **Đang theo dõi đăng bài** cho tới khi hàng chờ có xác nhận thật; bấm đối chiếu hoặc mở Đăng bài để kiểm tra/lỗi/thử lại theo từng nơi. Tạm dừng Agent không rút bài đã xếp vào lịch; muốn hủy lịch cần rút trong Đăng bài.

## Phạm vi và kiểm thử

Đây là Agent dùng công cụ sáng tạo của MooZ, có quyền và hạn mức, không phải bộ điều khiển tự do mọi ứng dụng trên máy. Kế hoạch là dữ liệu JSON được kiểm tra, không phải code/shell. Chỉ công cụ trong danh sách được thực thi; không nhận đường dẫn tùy ý hay quyền từ model.

Kiểm thử tự động gồm đồ thị/quyền, hạn mức, sửa bước, xác minh dịch vụ, crash/khôi phục, chống đăng trùng, bảo toàn dữ liệu lỗi; và desktop thật với bộ nối ChatGPT dùng trang fixture, FFmpeg, tải tệp, bản nháp bền vững, mở lại dự án và bố cục laptop. Không gọi AI trả phí hay đăng lên mạng xã hội thật trong kiểm thử. Cần kiểm tra tài khoản/model thật của người dùng sau khi cài.
