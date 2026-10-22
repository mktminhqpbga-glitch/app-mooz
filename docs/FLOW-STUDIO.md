# Tạo hàng loạt · Flow Studio

Mở **Tạo node (biểu tượng ＋) → Tạo hàng loạt**. Cửa sổ này chứa toàn bộ giao diện thẻ, không chiếm thêm thanh công cụ khi đóng.

1. Nhập vào **Thẻ tổng**, mỗi dòng là một prompt; dòng trống được bỏ qua. Chọn mặc định ảnh/video, AI và tỷ lệ rồi bấm **Tạo thẻ từ prompt**. Thao tác này chỉ thêm thẻ, chưa gọi AI. Các lần bấm thêm vào danh sách đang có; không ghi đè thẻ cũ.
2. Hoặc bấm **Thêm thẻ**, nhập prompt riêng. Mỗi thẻ sửa được prompt nhiều dòng, AI, tỷ lệ và thời lượng nếu tạo video.
3. Chọn ảnh, thả ảnh hoặc dán ảnh vào thẻ cần dùng. Mỗi thẻ tối đa tám ảnh, tổng 20 MB. Ảnh thuộc riêng thẻ đó, không tự chuyển sang thẻ khác. Chờ đọc ảnh xong trước khi bấm chạy; giao diện khóa nút tạo trong lúc đọc.
4. Kéo tay nắm **⠿** ở đầu thẻ và thả lên đầu một thẻ khác để đổi vị trí. Thứ tự thẻ là bố cục hiển thị, không tạo phụ thuộc giữa các tác vụ.
5. Bấm **Tạo** trên một thẻ hoặc **Tạo tất cả**. Các thẻ chạy độc lập; cùng tab AI xếp hàng, tab khác có thể xử lý đồng thời. Các lần gửi vẫn cách nhau tối thiểu năm giây. Chuẩn bị ảnh có thể khiến thứ tự gửi khác thứ tự hiển thị.
6. Kết quả và lỗi hiện trên từng thẻ. Một thẻ thất bại không hủy các thẻ khác; sửa và chạy lại riêng thẻ lỗi. **Dừng** hủy tác vụ của thẻ; **Dừng các thẻ** hủy cả tác vụ đang chạy và đang đợi của Flow Studio, không dừng nhánh khác ngoài cửa sổ này.
7. Dùng **Tải kết quả** hoặc **Xem trên canvas** để nối kết quả sang video/Output. Khi prompt, ảnh hoặc thiết lập đã đổi, cần tạo lại trước khi tải. Đóng Flow Studio vẫn để tác vụ chạy; mở lại để xem kết quả.

Thẻ dùng các node thật trên canvas và bộ chạy AI hiện có. Prompt tổng, danh sách/thứ tự thẻ, prompt riêng, ảnh và kết quả được lưu cùng workflow; xuất/nhập workflow cũng giữ chúng. Tối đa 50 thẻ. Khóa API và quyền dịch vụ vẫn được cấu hình trong Kết nối AI. Muốn chọn cuộc trò chuyện riêng cho một thẻ, dùng Xem trên canvas và chọn chat tại node tương ứng.

Kiểm thử Chromium dùng phản hồi AI mô phỏng: tách prompt theo dòng, tham chiếu riêng, AI theo thẻ, hàng đợi/chờ 5 giây, lỗi độc lập, kết quả, dừng tác vụ, kéo đổi thứ tự và lưu/mở lại. Chưa xác nhận chất lượng đầu ra với tài khoản AI thật.
