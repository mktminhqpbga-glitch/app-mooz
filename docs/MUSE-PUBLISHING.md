# Đăng qua Muse · Workflow 0.41.0

Luồng: ảnh/video đã kiểm tra → Đăng bài → Muse tự viết content có icon theo hướng dẫn đã đặt → Muse dùng công cụ đăng lên đúng Page/kênh. Phần viết và đăng nằm trong cùng một yêu cầu gửi Muse, không gọi ChatGPT riêng và không gửi ảnh preview thay cho video.

1. Kết nối Page/kênh trong Muse trước. Mở đúng cuộc trò chuyện Muse trong app, hoặc kết nối Workflow Connect rồi mở tab Muse trong Chrome.
2. Trên node ảnh/video/âm thanh hậu kỳ có video hoàn tất, bấm **Thêm vào hàng chờ**. Thành phẩm được chép vào bản nháp Đăng bài; chưa gửi Muse ở bước này.
3. Mở **Đăng bài → Muse · Content & lịch**. Chọn Muse tự viết từ ảnh/video, đặt giọng văn, độ dài, icon, hashtag, lời kêu gọi hành động và các điều cần tránh. Có thể chọn dùng content tự soạn thay vì để Muse viết.
4. Chọn lịch mặc định: gửi ngay, hoặc một giờ sắp tới theo **giờ Việt Nam (UTC+7)**. Mỗi bài chỉ gửi một lần vào mốc gần nhất, không tạo bài đăng lặp lại hằng ngày. Trên từng thẻ vẫn có thể chọn Đăng ngay hoặc Hẹn giờ riêng; thời gian riêng theo múi giờ hiển thị của máy.
5. Bấm **Đăng qua Muse** để lưu nơi đăng: chọn cuộc trò chuyện, nền tảng, tên nhận biết và URL/ID Page hoặc kênh đã nối bên Muse. Có thể tạo nhiều nơi đăng dùng chung chat; app gửi lần lượt. Nút Kiểm tra chỉ xác nhận tab/ô chat Muse sẵn sàng, chưa xác minh quyền nền tảng.
6. Trên thẻ thành phẩm, chọn nơi đăng qua Muse và bấm **Gửi Muse theo cài đặt**. Khi bật tự viết, content có thể để trống. App chốt hướng dẫn vào mục hàng chờ riêng cho mỗi nơi đăng; sửa cài đặt sau đó không đổi bài đang chờ.
7. Muse nhận tệp gốc và dữ liệu đích, viết content rồi dùng công cụ đăng của chính Muse. Content trả về được giữ trên thẻ. Nếu đang yêu cầu duyệt content trước khi gửi, cần chuyển sang chế độ dùng content đã soạn; content do Muse viết ngay lúc đăng chưa thể được duyệt trước trong app.

## Trạng thái và tránh gửi trùng

App phân biệt phản hồi AI với xác nhận trực tiếp của nền tảng. Sau khi Muse trả lời, mục ở **Đã gửi**, ghi **Muse báo đã đăng · chờ kiểm tra** hoặc **Muse đã nhận · cần kiểm tra**, kèm nội dung và phản hồi. Mở liên kết bài/Muse để kiểm tra; nút **Đã kiểm tra: đã đăng** ghi nhận xác nhận thủ công. Muse báo thiếu quyền hay chưa đăng thì xem lý do, sửa kết nối/thiết lập, xác nhận đã kiểm tra chưa đăng rồi mới đưa lại vào hàng chờ.

Nếu mất tab/phản hồi sau khi bắt đầu gửi, trạng thái là Cần kiểm tra; app không tự gửi lại. Xếp lại cùng mục đã gửi bị chặn. Mã tác vụ được ghi trước bước gửi, nhận kết quả dùng cơ chế tác vụ Muse hiện có. Kiểm tra trạng thái nền không gửi thêm prompt đăng. Xác nhận thủ công không gửi thêm bài.

## Điều kiện và giới hạn

- Muse cần có công cụ đăng và tài khoản đích đã kết nối. App không tạo quyền đăng cho Muse. Nếu Muse hỏi xác nhận, quyền riêng tư hoặc thiếu tài khoản, xử lý trong cuộc trò chuyện; chưa có API riêng để app độc lập xác minh công cụ đăng của Muse.
- Một lượt nhận một video gốc tối đa 100 MB, hoặc tối đa 8 ảnh với mỗi ảnh tối đa 8 MB; không trộn album và video trong một lượt. Muse/dịch vụ đích có thể có giới hạn thấp hơn.
- Lịch chạy trên máy khi app mở, máy thức và tab Muse còn sẵn sàng. Đây không phải lịch chạy trên máy chủ khi tắt máy.
- Nơi đăng gắn với đúng URL cuộc trò chuyện và đường kết nối Chrome/trong app; không tự chọn chat theo tên gần giống. Sau mở lại, chỉ gắn lại khi tìm thấy đúng URL duy nhất. Nếu chat đổi URL hay không xác định được, kết nối lại nơi đăng.
- Thiết lập content/lịch lưu trên máy. Định tuyến tài khoản dùng kho mã hóa hệ điều hành như các kết nối đăng khác; nếu hệ điều hành không hỗ trợ, giao diện ghi chỉ giữ trong phiên. Tiện ích Workflow Connect vẫn 1.0.0, không cần cài lại cho tính năng này.

Đã kiểm thử quy tắc thời gian Việt Nam, chốt hướng dẫn, bản gốc/preview, trạng thái không chắc chắn, nhiều nơi đăng cùng chat và xác nhận thủ công. Electron thật chạy đường UI với MP4 thật và giao diện Muse mô phỏng. Chưa đăng lên tài khoản xã hội thật hoặc xác minh công cụ đăng trên tài khoản Muse của người dùng.
