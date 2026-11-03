# 0.61.2 — danh sách tab AI đang kết nối

- Bộ chọn tab của bước Luồng và Nhóm tab AI chỉ hiện các tab trong kết quả kết nối hiện tại. Không hiện toàn bộ danh tính tab đã đóng được giữ trong cấu hình cũ. Khi mở app, trạng thái online lưu từ phiên trước không được coi là kết nối hiện tại.
- Nếu bước đã gán một tab nay đóng/mất kết nối, hiển thị hướng dẫn bên ngoài danh sách và yêu cầu chọn lại hoặc chọn Tự chia. Không tự đổi workerId của bước hoặc các bản luồng đã chốt cho tác vụ đang chờ.
- Có nút Cập nhật tab ngay cạnh bộ chọn. Danh sách nhận cập nhật khi Chrome/kết nối thay đổi hoặc cửa sổ AI mở/đóng; cập nhật bổ sung nếu tab đóng trong lúc lượt đọc trước còn đang chạy. Không dựng lại toàn bộ form nên nội dung đang chỉnh được giữ. Khi đọc kết nối thất bại, tab lưu cũ không còn là lựa chọn khả dụng.
- Thẻ tiến trình bỏ các tab cũ không còn kết nối; vẫn giữ thẻ của tác vụ đang xử lý để có thể theo dõi.

Kiểm tra tập trung: 16 unit test Batch/AI sites và app Electron thực với 35 bản ghi tab cũ, hai kết nối Muse native/Chrome, lọc theo AI, cảnh báo pin mất kết nối, pool chỉ chứa tab hiện tại, cập nhật đóng/mở, thay đổi trong lúc đang đọc tab, lỗi đọc kết nối và mở lại app. Kiểm tra giữ nguyên bản luồng đã chốt và nội dung form đang chỉnh, không gửi AI trả phí. Companion MooZ Connect giữ phiên bản 1.8.1 vì giao thức extension không thay đổi. Không tạo GitHub Release.
