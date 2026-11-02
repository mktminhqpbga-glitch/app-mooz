# Phản hồi kiểm tra 0.60.1 → bản 0.61.1

Các sửa của 0.61.0 được giữ: một cửa sổ với các tab, font/bố cục chung, ba thẻ Đăng bài mỗi hàng desktop, hai kho media, không cuộn lồng trong composer, chi tiết sản phẩm và tiến trình có hộp thoại riêng.

0.61.1 bổ sung:
- Facebook trống Page ID/token: mở đúng phần nhập nâng cao, hiện thông báo có thể đọc ngay trong hộp và đưa tiêu điểm đến thông báo; vẫn là hướng dẫn nhập liệu, không tính sự cố hệ thống.
- Nút Xếp hàng & chạy nằm trong thanh thao tác luôn hiện phía dưới trang, gồm cả cửa sổ thấp/hẹp. Thông tin AI, thời lượng, tỷ lệ vẫn ở vùng soạn.
- Tiêu đề hàng đợi có tooltip đầy đủ. Luồng hiện Tab ở từng bước, nút Lên/Xuống có chữ; tab đã gán nhưng mất kết nối được ghi rõ thay vì hiển thị như tự chọn.
- Chip thiếu tab ghi Cần mở tab, giữ nguyên tên AI.
- Windows có hướng dẫn cập nhật thủ công trong Cập nhật và Cài đặt: mở lượt build Windows thành công → tải artifact MooZ-App-Windows-x64 → giải nén → thoát app → chạy .exe cùng vị trí. Giữ dự án/media. Artifact có thời hạn lưu; kênh này chưa phải hệ thống cập nhật tự động Windows. Có thể cần đăng nhập GitHub/quyền truy cập repo.
- Mỗi bản đóng gói kèm source tương ứng, LICENSE và THIRD_PARTY_NOTICES; không thay giấy phép GPL của repo.

## Kiểm chứng Windows

Workflow Windows chạy kiểm tra từ file cài NSIS .exe trên Windows runner: tìm một bản cài cũ còn tải được, cài vào thư mục kiểm thử riêng, tạo dự án/lưu theme, nâng cấp lên bản mới, mở executable đã cài, kiểm tra phím Ctrl+S, chọn và hủy ảnh bằng hộp thoại Windows thật (thao tác Win32 trên hộp thoại hệ điều hành, không setInputFiles), so byte ảnh đã nhập, kiểm tra shortcut và gỡ cài đặt. Hồ sơ riêng phải còn sau khi gỡ, rồi bộ kiểm thử mới xóa dữ liệu kiểm thử của nó. Báo cáo windows-installer-lifecycle.json chỉ sinh sau khi tất cả kiểm tra đạt; xem artifact MooZ-Windows-review. Đây là Windows CI, không thay kiểm chứng trên máy khách/SmartScreen hoặc với tài khoản AI/Facebook/Shopee thật.

## Các thông tin thương mại còn cần nhà cung cấp

- `desktop/distribution.json` cần URL tiện ích đã được duyệt trên Chrome Web Store và URL HTTPS của dịch vụ OAuth Facebook đã triển khai. Hiện chưa có URL thật được cung cấp; không điền giả.
- Workflow Windows nhận chứng thư qua GitHub Actions secrets `WINDOWS_CERTIFICATE_P12` và `WINDOWS_CERTIFICATE_PASSWORD` (nếu dùng PKCS#12). Không có cấu hình thì bản build vẫn chưa ký; Windows-build-info.txt ghi trạng thái Authenticode thực tế. Khi cấu hình ký, build phải có chữ ký Valid mới được nhận. Dịch vụ ký qua HSM/cloud cần cấu hình theo dịch vụ thực tế được cung cấp.
- Không tạo hoặc phát hành GitHub Release trong lần sửa này. Chưa tuyên bố app đã hoàn tất điều kiện bán thương mại khi còn thiếu cấu hình thật/ký số; không có kiểm chứng đăng bài/AI trả phí bằng tài khoản thật.
