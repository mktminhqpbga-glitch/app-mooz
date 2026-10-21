# Workflow Data Updater

Extension Chrome/Edge Manifest V3 với nút **Cập nhật** để tải dữ liệu từ repository GitHub công khai và lưu vào `chrome.storage.local`.

## Cài đặt

1. Đưa mã nguồn này lên GitHub, nhánh `main` của `mktminhqpbga-glitch/workflow` (hoặc repository công khai khác).
2. Mở trang quản lý extension của Chrome/Edge, bật Developer mode.
3. Chọn **Load unpacked**, chọn thư mục `extension` trong bản tải xuống của repository.
4. Mở extension, nhập repository và nhánh, bấm **Cập nhật**. Giữ popup mở đến khi hoàn tất.

## Thêm dữ liệu

Liệt kê các đường dẫn trong `data/index.json`. Hỗ trợ UTF-8: JSON, TXT, CSV và Markdown; tối đa 50 tệp và tổng dung lượng 2 MB. Commit các thay đổi lên GitHub rồi bấm **Cập nhật**. Tất cả tệp được tải từ cùng một commit; chỉ thay thế bản dữ liệu trong bộ nhớ khi toàn bộ tải xuống và kiểm tra thành công. Tệp bị xóa khỏi danh sách cũng bị xóa khỏi bản dữ liệu mới.

Dữ liệu lưu trong khóa `snapshot`, gồm nguồn, commit, thời điểm cập nhật và `files` ánh xạ đường dẫn sang nội dung văn bản. Dữ liệu được giữ khi đóng trình duyệt; gỡ extension sẽ xóa dữ liệu. Nội dung tải về không được chạy như JavaScript hoặc hiển thị dưới dạng HTML. Không hỗ trợ repository riêng tư hoặc token trong phiên bản này. GitHub có thể giới hạn tần suất yêu cầu.

## Kiểm thử

Chạy `node --test tests/updater.test.mjs`. Không cần cài thư viện. Cần kiểm tra thao tác Load unpacked và lưu dữ liệu trên Chrome/Edge thật trước khi phát hành.
