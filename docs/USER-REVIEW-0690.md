# MooZ Agent 0.69.0 · Thiết kế lại toàn bộ app

Bản này thay giao diện ở cả Thư viện, Canvas Studio, Hàng loạt, Đăng bài, Affiliate, cài đặt và các hộp thoại, theo bố cục và cách trình bày trong ảnh LibTV người dùng cung cấp. Không chỉ đổi màu hoặc thay riêng màn workflow.

## Các màn làm việc

| Màn | Giao diện mới |
| --- | --- |
| Trang chủ | Rail biểu tượng hẹp, gallery dự án, nút mở Canvas Studio bằng hộp chọn dự án thật, tạo canvas mới |
| Canvas | Media không có khung dashboard; tiêu đề/kích thước nhỏ phía trên; process gọn và preview kết quả riêng; dock công cụ, thanh ngữ cảnh, ngăn hàng đợi |
| Prompt | Bảng soạn nổi kéo/đổi kích thước được; prompt lớn, AI/tỷ lệ/thời lượng, tải ảnh và chọn nguồn thực từ canvas; tự lưu bản nháp |
| Hàng loạt | Vùng soạn nổi, nút gửi trong khung, queue bên phải, gallery media lớn; Luồng và Hậu kỳ dùng cùng thiết kế |
| Đăng bài | Mỗi bài có media lớn và phần soạn cạnh nhau; tổng quan thành phẩm/lịch, kho media, thương hiệu và tài khoản được bố trí lại |
| Affiliate | Vùng ảnh và phân cảnh lớn; nguồn và lịch sử mở thành ngăn phụ; lỗi vẫn thấy khi ngăn nguồn đóng |
| Cài đặt / kết nối | Kiểu chữ, màu, điều khiển và hộp thoại chung; MooZ Connect 1.9.2 dùng giao diện kết nối mới |

Mặc định cài mới là Graphite tối trung tính. Các lựa chọn theme đã lưu vẫn được giữ; có thể chọn Graphite trong **Giao diện**. Canvas có nút sáng/tối riêng và mặc định mở tối.

## Chức năng và dữ liệu

- Các workspace giữ handler, kho dữ liệu, bộ chạy và kiểm tra quyền hiện có. Công cụ hàng loạt vẫn truy cập được dữ liệu cũ; không thay hàng chờ cũ bằng một danh sách giả.
- Canvas Studio có lối mở chính từ trang chủ và **Chuyển màn hình**. Sửa race khiến hộp chọn dự án trống khi nhiều lần cập nhật danh sách chạy cùng lúc.
- Bước tạo ảnh/video mới có preview kết quả riêng. Khi có preview, generator giữ dạng process gọn; kết quả cũ không có preview vẫn hiển thị được. Preview khung cuối riêng không làm mất video gốc.
- Prompt chỉ chạy AI khi bấm mũi tên gửi hoặc Ctrl/Cmd+Enter. Prompt/Loại trừ đầu vào chỉ lưu, không gọi AI. Lỗi lưu giữ bản nháp.
- Menu chuột phải dùng thao tác thật: xem media lớn, chỉnh ảnh, tải, sao chép ảnh/node, nhân bản, dán, sắp xếp, nhóm và xóa theo lựa chọn.
- Giữ một AI và tab cho cả nhóm khi chạy. Không bổ sung model LibTV giả vào danh sách AI hiện có.

Các bộ xử lý chuyên biệt LibTV như tách lớp, panorama, AI HD hoặc chuyển động tham chiếu vẫn cần dịch vụ hỗ trợ. Xem [bảng đối chiếu khả năng](CANVAS-STUDIO-CAPABILITIES.md).

## Kiểm chứng

Kiểm tra logic và Electron với hồ sơ thử riêng, không dùng lượt AI trả phí hay đăng bài thật. Native QA đi qua các màn ở 1500 và 640 px, bốn mục Hàng loạt, sáu mục Đăng bài, nguồn/lịch sử/bản nháp Affiliate, hủy trình chọn tệp và cài đặt. Bộ chạy fixture kiểm tra nút gửi prompt thật, hai bước giữ cùng tab, truyền kết quả và lưu/mở lại. Kiểm tra canvas giữ graph cũ, nguồn tham chiếu, nhân vật, ảnh đã chỉnh và mẫu luồng.

`npm test` chạy kiểm thử logic. `npm run test:studio` / `npm run test:desktop` chạy bộ Electron cho giao diện mới; các bài dựa vào bố cục cũ được giữ riêng ở `test:desktop:legacy-layout`.

Gói cài được tạo cho Mac Apple Silicon/Intel và Windows x64, không tạo GitHub Release. Windows kiểm tra cài/nâng cấp/mở/gỡ bằng installer thật; nâng cấp vẫn giữ dữ liệu dự án và theme đã chọn.
