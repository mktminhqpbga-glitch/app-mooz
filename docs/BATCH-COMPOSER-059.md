# Khu vực sản xuất mới · 0.59.0

Bố cục tham khảo ảnh mẫu người dùng: khung nhập lớn bên trái, tùy chọn sát cạnh dưới; hàng chờ, kết quả và lịch sử bên phải. Giao diện dùng theme/màu đã chọn trong MooZ.

## Nhập và chạy

- **Văn bản:** nhập mỗi dòng một yêu cầu, hoặc chọn gộp toàn bộ thành một video. Chọn Muse, Grok hoặc Google Flow/Veo, tỷ lệ và thời lượng yêu cầu. Bấm **Xếp hàng & chạy**. Mỗi yêu cầu tạo một tác vụ riêng, tạo video rồi lưu thành phẩm qua bộ xử lý cục bộ. Nếu thiếu tab đã chọn/sẵn sàng, tác vụ giữ trạng thái chờ với lý do thật.
- **Ảnh tham chiếu:** thêm ảnh sản phẩm như trước; mỗi ảnh thành một sản phẩm hoặc gom ảnh cho một sản phẩm. Mở **Chỉnh sửa/Chi tiết** để sửa tên, ảnh và yêu cầu riêng trong khung trái. Gỡ ảnh chỉ gỡ liên kết của sản phẩm, không xóa tệp dùng chung. Đóng chi tiết để quay lại ô nhập.
- Tại chế độ ảnh, các sản phẩm bản nháp được chọn sẽ dùng luồng đã lưu; nếu chưa chọn bản nháp ảnh nào, áp dụng cho tất cả bản nháp ảnh. AI trong thanh dưới chỉ chọn AI cho bước tạo video. Các bước đọc ảnh/viết kịch bản/tạo ảnh vẫn theo **Luồng xử lý**. Nếu nhà cung cấp video không đổi, tab đã chỉ định trong luồng vẫn được giữ; đổi nhà cung cấp mới bỏ liên kết tab cũ. Tỷ lệ/thời lượng/yêu cầu bổ sung được chốt vào từng tác vụ sắp chạy.
- Thay tùy chọn không thay dữ liệu/luồng của tác vụ đã xếp hàng. Văn bản chưa gửi được lưu trên máy, không tự gửi khi mở lại app.

## Theo dõi

- **Xem tiến trình** mở trạng thái các tab, luồng và lý do tạm dừng. **Tạm dừng** ngừng cấp việc mới; bước đã gửi chờ kết thúc. **Tiếp tục/Chạy hàng chờ** khởi động theo các tab và bộ điều phối hiện có.
- Bộ lọc/tìm kiếm được thu gọn. Hàng chờ cuộn độc lập ở màn hình lớn; lịch sử vẫn nhìn thấy bên dưới. Cửa sổ nhỏ chuyển thành bố cục dọc.
- **Dọn mục đã xong** chỉ ẩn mục hoàn tất khỏi hàng chờ. Lịch sử, video, ảnh và dữ liệu nhiệm vụ vẫn được giữ sau khi mở lại app. Mở mục từ lịch sử để xem kết quả, tải video hoặc hậu kỳ.
- Trạng thái kết nối hiển thị số tab thật, số tác vụ đang xử lý và giới hạn lô. Các nhà cung cấp, chế độ gửi và giới hạn vẫn theo khả năng thực của MooZ; ảnh tham khảo không được dùng để giả lập dữ liệu máy, tài khoản hoặc kết quả video.

## Kiểm chứng

- Kiểm thử hợp đồng văn bản, giới hạn đầu vào và snapshot từng tác vụ; từ chối cấu hình không hợp lệ trước khi thay trạng thái cả nhóm.
- Electron thật: văn bản lưu/khôi phục; hai dòng thành hai video riêng, không lẫn prompt; một yêu cầu nhiều dòng thành một video; thời lượng/tỷ lệ gửi đúng; nhận MP4 và ghép/lưu cục bộ; dọn hàng chờ không mất lịch sử/tệp; chỉnh và gỡ ảnh riêng; bố cục sáng/tối và 640 px.
- Luồng sản phẩm cũ: 13 sản phẩm, 4 tab, 26 tệp video, xuất MP4 với nhạc/cắt/màu; dữ liệu sau reload, rút nháp và sửa JSON vẫn được kiểm tra.
- AI dùng phản hồi mô phỏng, không gọi tài khoản trả phí. Chưa xác minh phiên website thật của người dùng trong lượt này.

Tiện ích giữ **MooZ Connect 1.8.0**, không cần thay chỉ vì nâng app lên 0.59.0.
