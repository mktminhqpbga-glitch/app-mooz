# Cài đặt & kết nối AI · 0.42.0

Mở **Cài đặt & kết nối AI** từ thanh công cụ trái trong canvas, hoặc thanh điều khiển ở thư viện/Đăng bài/Affiliate. Thiết lập giao diện cũng nằm ở đây.

## Chrome và cửa sổ AI

**Tải Workflow Connect** lưu ZIP có sẵn trong gói app vào Tải về, không cần mở trang GitHub hay đăng nhập GitHub. ZIP được tạo từ mã tiện ích trong repo. Giải nén → Chrome `chrome://extensions` → bật Chế độ nhà phát triển → Tải tiện ích đã giải nén → chọn thư mục có manifest.json. **Kết nối Chrome** mở mã ghép nối; giữ app và các tab AI mở khi chạy.

Muse, ChatGPT và Gemini hiện có bộ kết nối website. Workflow Connect vẫn 1.0.0, dùng chung các bản app có giao thức tương thích. Thêm địa chỉ website khác không tự tạo bộ điều khiển; chưa hỗ trợ tự động với mọi website AI.

## Thêm dịch vụ AI khác

Chọn mẫu DeepSeek/Groq/OpenRouter hoặc nhập tên, URL API gốc và model của dịch vụ hỗ trợ **OpenAI Chat Completions**. Tên model trong mẫu chỉ để bắt đầu; kiểm tra model được tài khoản cung cấp rồi sửa nếu cần. API cần tên miền HTTPS công khai. Khóa nhập trong ô password, không đưa vào URL. App chỉ gửi khi bạn chạy node/giao việc; có thể tính phí theo dịch vụ bạn chọn.

Kết nối dùng được trong **Tạo văn bản**, **Chat trong dự án**, **AI viết content** ở Đăng bài và **AI viết kịch bản** ở Affiliate. Những nơi dùng bộ chọn cuộc trò chuyện hiển thị dịch vụ này với tiền tố API; không phải mở một tab website. Chọn đúng kết nối/model trước khi chạy.

Mặc định chỉ gửi và nhận văn bản. Bật **Model hỗ trợ đọc ảnh** khi model thực sự hỗ trợ nội dung image_url theo chuẩn Chat Completions. Chưa tạo ảnh/video đầu ra hoặc gửi video tham chiếu qua kết nối tùy chỉnh này. Để tạo ảnh/video dùng các adapter Muse/Gemini/OpenAI/fal đã có theo khả năng từng dịch vụ.

Tên/model/URL được lưu trên máy; **API key chỉ giữ trong bộ nhớ của phiên app** và phải nhập lại khi mở lại app. Danh sách kết nối trả cho giao diện chỉ có trạng thái đã nhập khóa, không trả khóa. Khóa không nằm trong tệp dự án/xuất workflow. Đổi máy chủ cần nhập lại khóa, không tự gửi khóa cũ sang nơi khác. Xóa kết nối sẽ yêu cầu node đang dùng chọn lại AI.

**Thiết lập AI trong dự án** mở bảng hiện có để chọn tab và nhập khóa Google/OpenAI/fal của dự án. Nút chỉ có tác dụng khi đang mở canvas; thư viện hướng dẫn mở một dự án trước. Lồng tiếng OpenAI vẫn dùng khóa OpenAI của bảng này.

Kiểm thử: kết nối API mô phỏng qua native transport → Tạo văn bản và viết content; model/URL đúng, chặn redirect, lỗi không có văn bản/không hỗ trợ ảnh, tệp cấu hình không chứa khóa và mở lại không giữ khóa. Không gọi API trả phí hoặc thử tài khoản thật.
