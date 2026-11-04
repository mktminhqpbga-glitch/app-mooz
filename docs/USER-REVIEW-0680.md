# MooZ Agent 0.68.0 · Canvas Studio

Canvas mới tham khảo bố cục LibTV trong ảnh người dùng cung cấp. Bản này giữ Electron, graph và bộ kết nối AI hiện có. Tiện ích Chrome vẫn là MooZ Connect 1.9.1.

## Sử dụng

1. Mở dự án. Bấm **+** ở dock để thêm văn bản, ảnh, video hoặc bước xử lý; cũng có thể kéo tệp vào nền canvas.
2. Bấm thẻ để chọn, Shift/Ctrl/Cmd + bấm để chọn nhiều thẻ. Mở **Thiết lập** để sửa nội dung, prompt và thông số; nối cổng trên canvas hoặc chọn nguồn trong **Đầu vào & dây nối**.
3. Chọn nhóm, mở **Thiết lập luồng**, chọn một AI và tab cho cả nhóm. Các bước AI giữ cùng tab, chạy theo dây phụ thuộc; nếu tab bận thì chờ trên tab đó. Nút Dừng ngừng các bước tiếp theo.
4. Bấm biểu tượng nhân vật để mở kho cá nhân dùng chung các dự án. Tạo/sửa nhân vật, tải ảnh và thêm vào canvas; nối ảnh nhân vật vào các bước cần tham chiếu. Ảnh sản phẩm là đầu vào riêng.
5. Chọn ảnh rồi **Chỉnh ảnh** để cắt, xoay/lật, chỉnh sáng/màu hoặc đổi kích thước. Kết quả là node ảnh mới có dây nối về nguồn; giữ ảnh gốc.
6. Chọn các node rồi **Lưu mẫu**. Trong **Tài nguyên → Mẫu luồng**, chèn mẫu để tạo bộ node mới với dây nội bộ riêng. Mẫu giữ đầu vào và thiết lập, bỏ kết quả AI, khóa và tab phiên cũ.
7. Mở hàng đợi bằng dock: xem tác vụ canvas và hàng đợi hàng loạt hiện có. Lịch sử canvas giữ trạng thái thật sau khi mở lại; tác vụ gián đoạn yêu cầu kiểm tra tab AI trước khi chạy lại.

Kho prompt/media, hậu kỳ video và công cụ trước đây nằm trong ngăn Tài nguyên/Công cụ. Zoom, kéo nền, bản đồ, nhóm, nhân bản, hoàn tác/làm lại và lưu/nhập/xuất workflow vẫn sử dụng graph hiện có.

## Phạm vi

Canvas chính chạy một nhóm mỗi lần; hàng đợi hàng loạt giữ bộ chạy riêng hiện có. AI qua tab vẫn cần Chrome/app hoạt động, tài khoản đã đăng nhập và website hỗ trợ tác vụ được chọn. Không tự gửi lại AI khi mất kết nối hoặc chưa rõ kết quả.

Các công cụ chuyên biệt LibTV như chuyển động tham chiếu, thay trang phục, xóa/vẽ lại vùng ảnh, tách lớp, panorama và AI nâng độ nét chưa có bộ xử lý mới trong bản này. Đổi kích thước ảnh là xử lý cục bộ. Kho nhân vật chính thức của LibTV không được sao chép. Xem [bảng đối chiếu](CANVAS-STUDIO-CAPABILITIES.md).

## Kiểm chứng

- 432/432 kiểm thử logic đạt.
- Electron thật với hồ sơ thử riêng: workflow cũ, ảnh/dây/nhóm, chọn nhiều thẻ, từ chối dây sai kiểu, sửa prompt, nhân vật IndexedDB, mẫu luồng không chứa khóa và tạo ID mới, chỉnh ảnh đối chiếu pixel, lưu rồi mở lại.
- Bộ chạy hai bước: giữ đúng tab đã chọn dù danh sách tab đảo thứ tự, truyền kết quả bước trước sang bước sau và giữ lịch sử thành công sau khi mở lại. Đường truyền AI được mô phỏng; không dùng lượt AI trả phí.
- Giao diện sáng/tối ở 1500, 1008 và 640 px; hàng đợi không khóa canvas. Sửa thông báo trạng thái che nút và thao tác bấm thẻ làm mất lựa chọn nhiều node.

Kiểm tra Windows gồm cài/nâng cấp/mở/gỡ bằng installer thật trong CI. Gói Mac tạo cho Apple Silicon và Intel; trạng thái/chữ ký của gói được ghi trong workflow đóng gói. Không phát hành GitHub Release.
