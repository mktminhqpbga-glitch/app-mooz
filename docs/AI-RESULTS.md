# Nhận kết quả AI · 0.38.2

Gemini / ChatGPT dùng giao thức kết quả 3; Muse giữ giao thức 2 hiện có.

## Sử dụng bản sửa

1. Thay app Workflow bằng bản 0.38.2.
2. Cập nhật tiện ích Workflow trong Chrome từ `downloads/Workflow-extension.zip`, chọn thư mục gốc có `manifest.json`.
3. Dừng lượt cũ trên trang AI, tải lại từng tab Gemini/ChatGPT bằng ⌘R/Ctrl+R. Cửa sổ AI đang mở trong app cũng cần tải lại.
4. Chọn lại đúng cuộc trò chuyện trên node. Thử một lượt trước khi chạy cả workflow.

App chặn bộ nối cũ trước khi gửi để tránh chạy bản đã bị thay thế. Một yêu cầu chỉ bấm gửi một lần. Khi đã có kết quả trên trang nhưng bộ nối chưa đọc được, không tự gửi lại prompt.

## Thay đổi

- Chuyển từ trang chat trống sang ID cuộc trò chuyện do lần gửi đầu tạo ra được chấp nhận. Chuyển sang chat khác trong lúc chờ bị từ chối.
- Nhận tin người dùng lồng nhau, prompt dài bị rút gọn và phản hồi sau đúng tin đã gửi. Áp dụng cho văn bản và ảnh.
- Dấu mở/đóng chỉ đọc trong một khối phản hồi, tránh ghép nội dung từ cả trang. Giữ phương án marker khi lớp HTML thay đổi, vẫn đợi hết streaming và nội dung ổn định.
- Lấy đủ các khối markdown của phản hồi; không chỉ khối đầu tiên.
- Tải ảnh CDN công khai bị CORS do cookie được thử lại cùng URL không gửi cookie. Lỗi tải tạm thời không bị cache vĩnh viễn; thử lại với khoảng nghỉ tối đa 8 giây. Không yêu cầu AI tạo lại ảnh.
- CHECK trả lastScan gồm loại và số phản hồi/ảnh đã nhận diện, không có prompt, URL media hoặc cookie.

## Kiểm chứng

176 unit tests; 5 nhóm Electron smoke, gồm Gemini/ChatGPT text + image qua isolated world thật. Fixture Chromium bao phủ chat mới, prompt rút gọn/lồng nhau, marker lúc streaming, CDN lỗi tạm thời/CORS, đổi chat ngoài ý muốn, upload, chờ gửi, dừng, nền/offscreen, writing block và bridge cũ. Hai fixture cũ được căn thời gian theo upload ổn định 1,5 giây và phản hồi ổn định 3,5 giây.

Các trang nhà cung cấp trong kiểm thử là mô phỏng. Chưa truy cập phiên AI của người dùng. Không hỗ trợ đọc nội dung chưa xuất hiện trong DOM, Shadow DOM đóng hoặc kết quả chỉ vẽ bằng canvas.
