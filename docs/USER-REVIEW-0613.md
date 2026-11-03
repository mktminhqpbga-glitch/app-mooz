# 0.61.3 — thao tác thêm ảnh có phản hồi rõ

- Thay lớp input file ẩn phủ vùng tải ảnh bằng nút Chọn ảnh trên máy thực sự: bấm chuột hoặc Enter/Space mở Electron native file dialog, gắn với BrowserWindow chủ của ứng dụng thay vì phụ thuộc file input trong WebContentsView. Kéo thả vẫn hoạt động.
- Hộp thoại luôn hiển thị trạng thái đang mở, đang thêm ảnh, hủy chọn và lỗi đọc/giải mã. Không chỉ báo lỗi bằng toast có thể nằm sau hộp modal. Chống bấm nhiều lần mở nhiều hộp chọn hoặc nhập trùng.
- Mỗi ảnh/Gom ảnh có trạng thái chọn và lời giải thích rõ; gom tối đa 8 ảnh. Giữ hai cách tạo sản phẩm đã có. Chọn ảnh từ kho trống có hướng dẫn; kho có ảnh mở bộ chọn như trước. Nút Xong được đổi thành Đóng để thể hiện đúng chức năng.
- Native bridge chỉ dành cho bề mặt Batch. Chỉ đọc tệp người dùng đã chọn trong hộp hệ điều hành, lọc định dạng ảnh, giới hạn 20 MB/ảnh và 200 MB/lượt; không nhận đường dẫn tùy ý từ renderer. Không trả đường dẫn đầy đủ về giao diện.

Kiểm tra tập trung: 4 unit tests native picker; app Electron thực kiểm tra chủ sở hữu cửa sổ, quyền IPC giữa bề mặt, dữ liệu hai ảnh thật qua IPC, bấm đúp, hủy chọn, gom/tách ảnh, Enter, kéo thả, kho trống/có ảnh và lỗi hiển thị trong modal. Bộ kiểm tra Windows bản cài dùng hộp chọn tệp Win32 thực; báo cáo nằm trong MooZ-Windows-review khi toàn bộ lượt kiểm tra đạt. Không gửi AI trả phí hoặc đăng bài. Extension MooZ Connect giữ 1.8.1; không tạo GitHub Release.
