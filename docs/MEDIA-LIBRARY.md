# Tải media và Kho prompt (0.15.0)

Hai nút ở thanh menu trên cùng, tách riêng khỏi workflow. Reset canvas không xóa kho prompt.

## Kho prompt

Đặt tên và nội dung, bấm **Thêm prompt**. Tìm theo tên/nội dung; mỗi mục có **Sao chép**, **Sửa**, **Xóa**, **Tạo node Prompt**. Nội dung nhiều dòng được sao chép nguyên văn. **Lấy từ node đang chọn** đưa văn bản node vào khung soạn, sau đó bấm thêm để lưu. **Soạn mới** thoát chế độ sửa.

Kho lưu tối đa 500 prompt, tên 100 ký tự, nội dung 20.000 ký tự mỗi mục. Lưu bằng chrome.storage.local, tồn tại sau khi đóng/mở Workflow nhưng chỉ trong hồ sơ trình duyệt đang dùng; gỡ extension có thể mất dữ liệu. Chưa có đồng bộ đám mây hoặc nhập/xuất kho riêng. Nội dung dùng textContent để hiển thị, không thực thi HTML/script trong prompt.

## Tải media

Dán link để tự nhận diện nền tảng. Link tệp trực tiếp (MP4, WebM, MOV, ảnh, MP3…) chuyển ngay sang trình quản lý tải xuống của Chrome/Edge, giữ nguyên tệp. Link bài đăng YouTube/TikTok/Facebook/Instagram/X/Douyin/Vimeo/Dailymotion/Bilibili được xử lý bởi bộ tải cục bộ đi kèm; sau đó chuyển thành phẩm sang Chrome. Không dùng máy chủ tải công khai của bên thứ ba.

Hướng dẫn bật bộ tải có ngay trong hộp thoại và tại [tools/media-helper/README.md](../tools/media-helper/README.md). Cần Python 3.10+, yt-dlp; FFmpeg hệ thống là tùy chọn để ghép luồng hình/tiếng. Mã kết nối chỉ dùng với 127.0.0.1, lưu riêng khỏi dữ liệu workflow/mẫu workflow. Tiến độ và lỗi hiển thị tại hộp thoại. **Hủy tải** dừng tác vụ đang xử lý ở bộ tải; khi tệp đã chuyển sang Chrome, hủy trong trình quản lý tải xuống của Chrome.

Bộ tải chỉ xử lý một video mỗi link và nội dung có thể truy cập công khai. Link riêng tư/DRM, nội dung bị gỡ hoặc nền tảng thay đổi có thể không tải được. Mức chất lượng là giới hạn tối đa, phụ thuộc định dạng có sẵn và FFmpeg.

## Xác minh

- Chromium DOM: CRUD, tìm kiếm, sao chép đúng văn bản, mở lại kho, tạo node, không thực thi HTML; link trực tiếp, nhận dạng nền tảng, luồng helper và hủy (API Chrome/resolver giả lập).
- HTTP server thực trên loopback: xác thực, chặn Origin không hợp lệ, kiểm tra host, trạng thái, vé tải và hủy; worker trích xuất giả lập.
- Đã cài yt-dlp 2026.10.21 và thử metadata YouTube; mạng môi trường chặn HTTP 403. Chưa xác nhận tải thực tế từ các nền tảng.
- Kiểm tra nạp extension MV3 thật được bỏ qua vì bản Chromium ở môi trường này không hỗ trợ nạp unpacked qua CLI/CDP; không coi kiểm thử giả lập là kiểm thử cài đặt thật.
