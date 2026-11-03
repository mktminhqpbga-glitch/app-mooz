# Rà thao tác và luồng sử dụng — 0.61.4

Đã mở app Electron bằng dữ liệu thử riêng và thao tác trên cả năm màn: Thư viện, Canvas, Video hàng loạt, Đăng bài và Affiliate. Không gửi AI trả phí hay đăng bài lên tài khoản thật.

## Lỗi tái hiện và sửa

- **Kết nối nền tảng có thể bấm mà không hiện phản hồi:** nhập URL webhook sai rồi chuyển sang Facebook. Trường URL đã ẩn vẫn tham gia kiểm tra HTML, chặn sự kiện submit trước khi app hiện lỗi. Form nay chỉ bật trường của kiểu kết nối đang chọn; mọi lần submit đi qua xử lý lỗi hiển thị trong dialog. Khi đổi hoặc mở lại dialog, phản hồi cũ được xóa. Trong lúc kết nối, khóa chọn kiểu để tránh đổi dữ liệu giữa chừng; kết thúc luôn mở lại nút.
- **Affiliate che ô chọn tab khi cửa sổ thấp:** thanh hành động sticky nằm trong form phủ lên các điều khiển nguồn. Tách phần nhập/cuộn và chân panel chứa nút, lý do chưa thể chạy, cùng phản hồi thao tác. Trên màn nhỏ, nội dung cuộn thành một trang; không để chân panel phủ lên các ô nhập. Bỏ tooltip trùng với lý do đã hiển thị dưới nút.
- **Chữ thương hiệu Batch bị cắt ở khoảng 1100px:** dành một hàng riêng cho dòng mô tả dưới logo/tên, giữ tên trên một dòng, kiểm tra kích thước thực tế trong app.

## Prompt chung cho video

Theo yêu cầu bổ sung, có nút **Prompt chung** cạnh **Thêm bước** trong Luồng & tab AI. Nhập tối đa 4.000 ký tự, chọn bổ sung vào prompt của mỗi cảnh (mặc định) hoặc thay prompt video từng cảnh. **Lưu vào luồng** lưu cả cấu hình đang sửa; để trống và lưu để bỏ prompt chung. Ảnh, lời đọc, tỷ lệ, thời lượng vẫn theo sản phẩm/cảnh; không gửi AI khi lưu và không thay prompt của tác vụ đã xếp hàng. Không áp dụng cho bước đọc ảnh, viết kịch bản hoặc tạo ảnh.

`desktop-batch-common-prompt-smoke.cjs` kiểm chứng bằng click UI và IPC thật: lưu/hủy/mở lại/xóa prompt, hai cách dùng trên hai cảnh, sửa khi sản phẩm A đang chạy không làm thay prompt đã chốt, sản phẩm B có ảnh riêng, bốn yêu cầu video qua transport giả lập và hai MP4 ghép thật.

## Luồng đã thao tác trên Electron

| Mục | Kiểm chứng |
| --- | --- |
| Thư viện & cài đặt | Tạo/mở dự án, dữ liệu riêng giữa dự án, khởi động lại, cập nhật, clipboard và tải tệp qua IPC. |
| Canvas | Nhân bản giữ ảnh/dây/nhóm/ghi chú và bỏ thông tin phiên; sửa bản sao độc lập; lưu/mở lại; sơ đồ văn bản và copy; tìm/lọc/chọn node; các nút thêm nhanh. |
| Công cụ cục bộ | Cắt/xoay/chỉnh màu video, trích MP3, tải xuống; đọc lại kích thước, điểm ảnh và PCM. Logo, đổi tỷ lệ và phụ đề chạy FFmpeg trên MP4 thử. |
| Video hàng loạt | Từng dòng thành video riêng; gom prompt; tham chiếu, thời lượng/tỷ lệ, ảnh của từng sản phẩm, hàng đợi, dừng/tiếp tục, tiến trình, lịch sử, dọn mục xong, kho tải lên/kết quả; nhập ảnh/hủy/lỗi tệp qua picker mới. |
| Đăng bài | Chọn nhiều nơi đăng, AI viết nội dung bằng phản hồi giả lập, duyệt nội dung, nội dung riêng theo nền tảng, hẹn giờ, lỗi/retry không nhân đôi bài, pause/resume, lịch kéo thả, yêu thích/nhãn, thống kê giả lập và lưu sau mở lại. Mở mục “Nơi đăng & thiết lập”/“Thao tác khác” bằng click trước khi dùng các nút bên trong. |
| Kết nối | Cả bảy kiểu đều cho phản hồi khi thiếu/sai thiết lập; URL sai của kiểu đã ẩn không chặn Facebook; trường không hoạt động bị disable; giữ dữ liệu đang nhập khi đổi kiểu và xóa bí mật khi đóng. |
| Affiliate | Nguồn sản phẩm/ảnh → bốn bước AI giả lập → storyboard → workflow 14 node → nháp đăng bài giữ link affiliate; nguồn bị chặn có thông báo; chọn tab, làm mới, nguồn công khai, lý do nút khóa, pause/resume và ví dụ. |
| Bố cục | Năm màn sáng/tối, 1500/1008/640px; bổ sung đo chân Affiliate và logo Batch ở 1500/1100/1008/640px, gồm cửa sổ thấp 600px. |

Các bộ Electron đã chạy tại workspace: `desktop-smoke`, `desktop-ui-refresh-smoke`, `desktop-workspace-smoke`, `desktop-posting-smoke`, `desktop-affiliate-smoke`, `desktop-canvas-tools-smoke`, `desktop-extra-tools-smoke`, `desktop-batch-composer-smoke`, `desktop-layout-review-smoke`, `desktop-product-import-smoke`, `desktop-interaction-audit-smoke`. Kiểm tra unit liên quan Posting/Affiliate/version: 49 ca đạt.

`desktop-interaction-audit-smoke.cjs` thêm 12 nhóm kiểm chứng hồi quy cùng ảnh chụp/số đo, được chạy cả trong đóng gói Mac nhanh. Workflow Windows vẫn chạy cài installer thật, nâng cấp từ bản trước giữ dự án/theme, thao tác picker Windows thật, mở lại giữ dữ liệu và gỡ installer giữ profile. Kết quả đóng gói được lưu trong artifacts của đúng commit.

## Giới hạn kiểm chứng

Các thao tác với AI, Shopee và mạng xã hội dùng nguồn/phản hồi thử có kiểm soát; chưa xác nhận đăng nhập hay đăng bài bằng tài khoản khách hàng. Dịch vụ OAuth Meta và URL Chrome Web Store chưa được cung cấp; những nút phụ thuộc dịch vụ vẫn khóa kèm giải thích. MooZ Connect vẫn là 1.8.1, không đổi giao thức trong bản này. Bản đóng gói chưa có chứng thư ký phát hành/notarization.
