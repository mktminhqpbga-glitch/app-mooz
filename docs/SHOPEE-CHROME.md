# Lấy sản phẩm từ Shopee đã đăng nhập trên Chrome

MooZ 0.54.0 dùng **Workflow Connect 1.5.0** để mở và đọc tab Shopee. Chrome có thể ở cùng máy hoặc máy đã ghép qua relay. Nút mở Shopee dùng chính Chrome đang kết nối với app.

1. Cài/cập nhật extension từ **Cài đặt & kết nối AI → Tải Workflow Connect**, giải nén và tải lại tại `chrome://extensions`. Ghép Chrome với MooZ.
2. Vào **Affiliate Shopee**, nhập link sản phẩm hoặc link affiliate gốc. Chọn **Chrome đã đăng nhập Shopee**.
3. Bấm **Mở Shopee trên Chrome**. Tự đăng nhập và hoàn tất yêu cầu xác minh trên Shopee, đợi trang sản phẩm và ảnh hiển thị.
4. Bấm **Cập nhật tab Shopee**, chọn đúng tab sản phẩm rồi **Lấy thông tin & ảnh**.
5. Xem tên, mô tả và ảnh đã lấy về trước khi chọn **AI viết kịch bản** hoặc **Dùng kịch bản của tôi**. Bước lấy sản phẩm không gọi AI, tạo video hay đăng bài.

Link affiliate gốc được giữ riêng với URL trang sản phẩm cuối cùng. Nếu nhập link sản phẩm đầy đủ nhưng chọn tab của sản phẩm khác, app từ chối. Nếu tab chuyển trang sau khi bạn chọn, app yêu cầu cập nhật danh sách.

App chỉ nhận dữ liệu sản phẩm theo cấu trúc và tối đa 5 ảnh từ CDN Shopee; không nhận cookie, mật khẩu hoặc toàn bộ HTML trang. Ảnh tối đa 8 MB/ảnh và 20 MB/sản phẩm, được giải mã/thu nhỏ lại và lưu trên máy. Các tab Shopee không xuất hiện trong danh sách tab AI.

Khi trang chưa tải đủ ảnh, còn màn hình đăng nhập hoặc xác minh, hãy hoàn tất trên Chrome rồi cập nhật/lấy lại. App không tự giải CAPTCHA. Bài kiểm thử dùng Chrome và extension thật với trang Shopee/CDN mẫu; chưa kiểm thử tài khoản Shopee thật trong môi trường phát triển.

## Đăng nhập Facebook bị gián đoạn

Nút Đăng nhập Facebook tiếp tục sử dụng dịch vụ Meta OAuth riêng. Khi lấy trạng thái bị mất mạng, HTTP 5xx hoặc giới hạn lượt gọi, app thử lại tối đa 4 lần trong cùng phiên đăng nhập. Không mở thêm trang cấp quyền và không tự gửi lại bài đăng.

Nếu phiên hết hạn, dịch vụ OAuth khởi động lại, bạn hủy cấp quyền hoặc quyền Page bị thu hồi, cần đăng nhập/cấp quyền lại. Lỗi hiển thị lý do và các Page đã lưu được giữ nguyên. Phiên đang đăng nhập có giới hạn 10 phút; app không khẳng định có thể giữ phiên Facebook vô thời hạn.
