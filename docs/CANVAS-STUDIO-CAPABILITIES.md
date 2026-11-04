# Canvas Studio · Đối chiếu chức năng với ảnh tham khảo LibTV

MooZ dùng bố cục canvas tài nguyên và bước xử lý tương tự các ảnh tham khảo. Danh sách này phân biệt công cụ có bộ xử lý thật với chức năng cần khả năng từ dịch vụ AI. Không có API hay model mới được tự đăng ký/mua trong đợt này.

| Chức năng trong ảnh | Khả năng trong MooZ | Điều kiện / giới hạn |
| --- | --- | --- |
| Canvas vô hạn, zoom, pan, minimap | Dùng bộ canvas và tọa độ hiện có, thay lớp trình bày | Giữ graph, ID, dây nối và tệp dự án cũ |
| Node ảnh/video xem trước | Thẻ tài nguyên và các bước tạo có ảnh/video thật | Không tự dùng thumbnail thay thành phẩm |
| Nối nguồn tham chiếu | Cổng có kiểu văn bản/ảnh/video và kiểm tra vòng lặp | Một dây là quan hệ dữ liệu; không tự tạo khả năng mới cho AI |
| Thanh công cụ theo lựa chọn | Tác vụ cho một node hoặc nhóm node đang chọn | Công cụ dùng lại handler thật; trạng thái bận phải chặn thao tác xung đột |
| Nhóm và mẫu luồng | Nhóm node, nhân bản và mẫu canvas theo dự án | Mẫu bỏ kết quả AI cũ, dữ liệu phiên và tab đích; chốt lại tab khi chạy |
| Kho nhân vật cá nhân | Thư viện ảnh, tên, mô tả và thẻ lưu cục bộ, thêm vào canvas | Kho cá nhân dùng chung các dự án qua IndexedDB; không có nhân vật giả làm thư viện chính thức |
| Cắt, xoay/lật, chỉnh sáng/màu ảnh | Xử lý ảnh trên máy, tạo node ảnh mới | Ảnh gốc được giữ; đổi kích thước không phải AI phục hồi chi tiết |
| Cắt, xoay/lật, chỉnh màu video; tách tiếng | Các node hậu kỳ và FFmpeg đang có | Thời gian xử lý phụ thuộc máy và độ dài tệp |
| Hàng đợi bên canvas | Mở/đóng ngăn hàng đợi trong workspace | Phải thể hiện tác vụ thật và không gửi lại AI khi trạng thái chưa rõ |
| Kho prompt và media | Dùng kho đang có trong dự án | Không sao chép thành một kho giả độc lập |
| Chạy AI bằng ảnh/video tham chiếu | Kết nối các tab AI hiện có | Cần đăng nhập; đúng model/chế độ và khả năng nhận tham chiếu trên website |
| Nhiều góc độ, thay nhân vật/trang phục, chuyển động tham chiếu | Chỉ dùng được khi AI/tab đã chọn thực sự hỗ trợ | Không cam kết tương đương công cụ chuyên biệt LibTV chỉ bằng một prompt |
| Xóa vật thể, vẽ lại vùng ảnh, AI HD, tách lớp, panorama | Chưa có bộ xử lý chuyên biệt trong đợt này | Không tạo nút hoạt động giả hoặc chuyển một thay đổi CSS thành kết quả AI |
| Nhân vật chính thức và dịch vụ model của LibTV | Không được sao chép vào MooZ | Cần nguồn dữ liệu/dịch vụ, giấy phép và kết nối riêng |

## Dữ liệu và kiểm chứng

- Mẫu canvas có định dạng `mooz-canvas-preset` phiên bản 1. Mẫu chỉ giữ đầu vào và thiết lập, không chứa API key, token, session, lựa chọn tab, kết quả AI hoặc phản hồi đang chờ.
- Blob và đường dẫn nội bộ phải được nhúng trước khi lưu mẫu. Đường dẫn media có chữ ký/xác thực cần nhúng nội dung thay cho lưu khóa trong URL. Mẫu tối đa 20 MB.
- Nhân bản/chèn mẫu tạo ID node mới và nối lại các dây nội bộ; các tham chiếu đến node ngoài mẫu không được tự chép sang một luồng độc lập.
- Các kiểm tra giao diện dùng tài nguyên và dịch vụ fixture, không gọi AI trả phí hoặc đăng bài thật. Phần hoạt động thực tế của website AI cần kiểm tra với tài khoản/mạng của người dùng.
