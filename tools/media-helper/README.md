# Bộ tải media cục bộ

Chạy trên máy đang mở Chrome/Edge, không chạy trên máy cloud của Codex. Bộ tải dùng yt-dlp để đọc link video công khai. Không gửi link qua dịch vụ tải bên thứ ba, không đọc cookie hoặc tài khoản trong trình duyệt.

## Bật lần đầu

1. Cài Python 3.10 trở lên nếu máy chưa có.
2. Giải nén bản extension đầy đủ. Windows: bấm `start-windows.bat`. macOS/Linux: mở terminal tại thư mục này và chạy `sh start.sh`.
3. Lần đầu, script tạo `.venv` trong thư mục này và cài yt-dlp từ PyPI. Cần Internet. Nếu thư mục extension không cho ghi, chép riêng thư mục `media-helper` ra một thư mục có quyền ghi rồi chạy.
4. Cửa sổ bộ tải hiện **mã kết nối**. Trong Workflow, mở **Tải media → Bật bộ tải cho link bài đăng**, dán mã, bấm **Kiểm tra bộ tải**.
5. Giữ cửa sổ bộ tải và tab Workflow mở; nhập link rồi bấm **Tải media**. Có thể đóng hộp thoại để làm việc trên canvas trong lúc chờ. Khi xử lý xong, Chrome tải tệp về thư mục tải xuống của trình duyệt.

Lần sau chỉ cần mở lại script. Mã được lưu riêng trên máy, không phải API key của AI. Chỉ lắng nghe `127.0.0.1:9473`, không mở ra mạng LAN. Header xác thực và Origin giới hạn các yêu cầu xử lý; link tải thành phẩm có vé ngẫu nhiên và hết hạn sau 1 giờ.

## Nền tảng và chất lượng

Nhận link YouTube, TikTok, Facebook, Instagram, X/Twitter, Douyin, Vimeo, Dailymotion, Bilibili. Có chọn tối đa 720p, tối đa 1080p hoặc tốt nhất có sẵn. Không tải playlist; tối đa 8 tác vụ xếp hàng, 2 tác vụ xử lý cùng lúc, tối đa 1 GB/tệp.

Nền tảng có thể đổi cách truy cập hoặc yêu cầu đăng nhập/JavaScript runtime/xác minh. Bộ tải sẽ báo lỗi thật; không cam kết tải được mọi link. Không xử lý DRM, không tự lấy cookie và không tự đăng nhập. Có thể cập nhật yt-dlp khi nền tảng thay đổi:

- Windows: `.venv\Scripts\python.exe -m pip install -U yt-dlp`
- macOS/Linux: `.venv/bin/python -m pip install -U yt-dlp`

Nếu có FFmpeg trong PATH, yt-dlp có thể ghép luồng hình/tiếng chất lượng cao. Nếu chưa có FFmpeg, chỉ chọn định dạng đã chứa cả hình và tiếng; chất lượng có thể thấp hơn mức tối đa đã chọn. FFmpeg WASM trong extension không thay cho FFmpeg của bộ tải Python.

Tệp tạm nằm trong `~/.workflow-media/downloads`. Các thư mục tạm cũ hơn 24 giờ được dọn khi khởi động bộ tải; có thể đóng bộ tải rồi xóa thư mục `downloads` để giải phóng dung lượng. Không xóa file `token` trừ khi muốn đổi mã kết nối và ghép lại với extension.

## Kiểm thử của phiên bản này

Đã cài và kiểm tra import yt-dlp 2026.10.21 trong môi trường phát triển; tải metadata YouTube thật bị proxy môi trường trả HTTP 403. Kiểm thử HTTP loopback xác thực, Origin, trạng thái tác vụ, vé tải và hủy dùng worker tải giả lập. Chưa xác minh tải từng nền tảng từ mạng/tài khoản của người dùng.
