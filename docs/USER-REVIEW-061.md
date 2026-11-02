# MooZ Agent 0.61.0 — giao diện gọn và dễ đọc

- Dùng font Arial và một bộ khoảng cách, cỡ chữ, nút, thẻ, hộp thoại chung cho Thư viện, Canvas, Video hàng loạt, Đăng bài, Affiliate và các thiết lập dùng chung. Giữ cài đặt màu và chế độ sáng/tối của người dùng.
- Video hàng loạt: khung soạn ở trái, hàng đợi ở phải; bỏ cuộn lồng trong danh sách sản phẩm, khung soạn, hàng đợi và lịch sử. Ảnh sản phẩm chia trang 6 mục. Chi tiết sản phẩm và tiến trình/tab AI mở bằng hộp thoại. Bốn chế độ đầu vào giữ nguyên hợp đồng xử lý.
- Hàng đợi render: dòng thu/mở riêng, phần trăm, thanh tiến trình, trạng thái; xem kết quả thật, AI thực hiện, khung hình, thời lượng, tải về, mở trong kho, dừng, chạy tiếp và xóa thẻ. Mỗi trang 6 tác vụ; bản nháp nằm ở vùng soạn, có bộ lọc riêng khi cần xem trong hàng đợi. Lịch sử vẫn giữ tác vụ sau khi dọn hàng đợi.
- Đăng bài: 3 thẻ mỗi hàng trên cửa sổ desktop rộng; 2 hoặc 1 khi cửa sổ hẹp. Media có chiều cao cố định và giữ tỷ lệ. Content và nút chính hiện ngay; nơi đăng, lịch, thương hiệu và thao tác phụ có nhóm mở rộng. Trạng thái mở được giữ khi cập nhật thẻ.
- Hai kho Tệp tải lên và Kết quả tiếp tục tách riêng. Nút trong vùng soạn mở kho tải lên; nút ở hàng đợi mở kho kết quả.

Đã mở app Electron thật, kiểm tra năm không gian, các màn điều hành Đăng bài, luồng/hậu kỳ, hộp thoại thiết lập và sáng/tối ở các độ rộng 1500/1008/640. Kiểm tra accordion, phân trang, chỉnh sản phẩm, tạm dừng, hai kho và giữ trạng thái thiết lập. Dùng hồ sơ và media kiểm thử cục bộ; không gọi AI trả phí hoặc gửi bài thật. Các bộ kiểm thử backend không liên quan không được chạy lại trong lần sửa giao diện này. Bản Mac/Windows được đóng gói với `quick_package`, không tạo GitHub Release.
