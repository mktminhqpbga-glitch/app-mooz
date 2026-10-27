# Trung tâm báo lỗi · 0.45.1

Mở **Báo lỗi** ở thanh công cụ hoặc **Cài đặt & kết nối AI → Trung tâm báo lỗi**. Dữ liệu dùng chung các cửa sổ và được lưu trên máy, không tự gửi tới máy chủ hay người hỗ trợ.

## Ghi và xử lý lỗi

- Lỗi thao tác desktop/IPC, lỗi JavaScript chưa xử lý và thông báo lỗi trên canvas/Affiliate/Đăng bài được ghi từ khi phiên bản có chức năng này chạy. Không thể lấy lại những lỗi trước đó nếu app chưa ghi nhận.
- Một lỗi giống nhau được gộp, có số lần, lần đầu/lần gần nhất, phiên bản app và nơi phát sinh. **Chưa xử lý** là trạng thái theo dõi, không phải khẳng định app vẫn đang tái hiện lỗi đó.
- Dùng **Ghi lỗi bạn gặp** cho lỗi không có thông báo, nhập cách tái hiện và kết quả bạn mong đợi. Ghi chú đang nhập không bị mất khi một lỗi khác xuất hiện.
- Chọn **Đánh dấu đã xử lý** hoặc **Mở lại lỗi**. Nếu lỗi được ghi nhận lại, mục đó được mở lại. **Xóa các lỗi đã xử lý** giữ các lỗi còn mở.

## Xuất để gửi hỗ trợ

Chọn **Xem / xuất báo cáo**, đọc bản JSON rồi **Sao chép** hoặc **Tải báo lỗi JSON**. Hai nút xuất chính bản chụp đang xem; lỗi xuất hiện sau đó sẽ có trong lần mở báo cáo tiếp theo. Báo cáo gồm phiên bản app, loại hệ điều hành/kiến trúc, thời gian, thông báo và ghi chú đã lưu. Sau đó bạn chủ động đính kèm tệp JSON vào cuộc trò chuyện hỗ trợ.

Không thu prompt, request body, nội dung chat, media hoặc ảnh màn hình tự động. Khóa phiên được app biết, dạng token thông dụng, URL, đường dẫn cá nhân và email được lọc trước khi lưu/xuất. Bộ lọc không thể đoán mọi thông tin riêng tư viết tự do: vẫn xem lại nội dung trước khi chia sẻ. Không dán mật khẩu vào phần ghi chú.

Tối đa **200 mục**, thông báo/ghi chú tối đa **2.000 ký tự** mỗi trường. Khi đầy, mục cũ nhất được bỏ để giữ lỗi gần nhất. Tệp lỗi hỏng được giữ thành bản sao; lỗi lưu xuống đĩa hiện cảnh báo và vẫn cho xuất các mục đang giữ trong bộ nhớ.

## Giới hạn

Đây là nơi ghi nhận và chuẩn bị báo cáo; app chưa tự sửa code, chưa tự gửi báo cáo cho AI và chưa có agent điều phối workflow hoàn chỉnh. Việc tự động đăng bài vẫn dùng các quyền và luồng duyệt đang có.
