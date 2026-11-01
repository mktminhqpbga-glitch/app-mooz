# MooZ 0.57.0 — nhiều Chrome và hàng chờ video

## Ghép máy ảo Muse và Chrome cá nhân cùng lúc

Trong **Cài đặt & kết nối AI → Thiết bị & nhiều Chrome**:

1. Kết nối Chrome chính theo cách đang dùng. Có thể đổi tên thành **Máy ảo Muse** để dễ chọn tab.
2. Bấm **Thêm Chrome**, đặt tên **Chrome trên máy tôi**.
3. Chọn **Chrome trên máy đang chạy app** nếu Chrome ở cùng máy. Nếu là máy khác hoặc máy ảo, chọn **Relay Internet**.
4. Bấm **Thêm & tạo mã riêng**, sao chép mã và dán vào Workflow Connect trên đúng Chrome đó.
5. Chỉ coi là ghép thành công khi danh sách báo **Đã kết nối**. Trong Video hàng loạt, bấm **Cập nhật tab AI → Nhóm tab AI**, đánh dấu các tab được phép nhận việc. Tên tab có kèm tên thiết bị.

Không dùng chung mã giữa hai Chrome. Mỗi thiết bị có kết nối riêng. Thu hồi hoặc gỡ một thiết bị không đóng kết nối còn lại. Tác vụ đang chạy trên thiết bị bị ngắt không được tự gửi sang thiết bị khác; kiểm tra trang AI trước khi chạy lại.

App hỗ trợ tối đa 8 thiết bị đã lưu, gồm Chrome chính. Relay hiện tại hỗ trợ tối đa 4 phòng từ xa đồng thời trên một dịch vụ; các app khác dùng chung relay cũng tính vào giới hạn này. Không cần triển khai lại relay để dùng tính năng này. Extension 1.7.0 vẫn tương thích, giao thức giữ nguyên phiên bản 1.

Tên và định danh thiết bị được lưu cục bộ. Khóa quản trị relay và mã phiên không được ghi vào tệp thiết bị hay báo cáo trạng thái. Sau khi thoát app cần nhập lại khóa relay và ghép lại các thiết bị từ xa; không tự nối lại và không tự gửi lại tác vụ. Mã ghép relay có hạn 10 phút để ghép lần đầu, không phải thời gian tối đa của một công việc. Phiên còn phụ thuộc việc app, Chrome và dịch vụ relay tiếp tục chạy; relay hiện tại giới hạn một phiên phòng ở 24 giờ và Render Free có thể khởi động lại.

## Hàng chờ sản xuất

- Dạng thẻ mặc định: ảnh sản phẩm, mã sản phẩm, tỷ lệ, số cảnh, tiến trình thực tế, các bước đã xong và lý do chờ/lỗi.
- Nút **Dạng bảng / Dạng thẻ** và **Hiện tổng quan / Ẩn tổng quan**; lựa chọn được lưu trên máy.
- Bộ lọc có cả bản nháp và mục đã dừng. Tìm kiếm theo tên hoặc mã sản phẩm, chọn nhiều mục để xếp hàng/dừng.
- Bảng chi tiết có chiều cao giới hạn và cuộn riêng. Tên tệp dài dạng mã được trình bày bằng mã sản phẩm; tên gốc vẫn còn trong ô tên và phần gợi ý.
- Video thành phẩm xuất hiện trên đầu bảng chi tiết. Kết quả từng bước có thể xem lớn hoặc tải riêng; video thành phẩm có nút tải ngay trên thẻ.
- Ảnh bản nháp vẫn có nút gỡ từng ảnh. Đầu vào đã xếp hàng giữ nguyên bản chốt; chỉ mục chưa chạy mới được rút về nháp để sửa.

Giao diện tham khảo từ trang demo công khai `https://viraailap.com/demo` (bản mô phỏng). Không sao chép mã, tài nguyên ảnh/video hay tính năng tài khoản/proxy của trang đó. App vẫn sử dụng bộ điều phối, kho media và luồng AI riêng của MooZ.

## Kiểm tra

- Unit: hai Chrome có cùng ID tab và request ID, định tuyến request/gate/progress, ngắt một máy không hủy lease máy khác, không phát lại prompt, định danh không tái sử dụng sau khi gỡ/khởi động lại.
- Relay: hai phòng mã hóa đồng thời với Chrome cục bộ, thu hồi riêng một phòng, không lộ khóa trong trạng thái/tệp cấu hình.
- Native: Electron cùng hai Chrome/extension thật, một WSS relay và một kết nối cục bộ; ghép bằng giao diện, sao chép mã từ host, nhận đúng kết quả và thu hồi riêng.
- Batch: 13 sản phẩm/4 tab, kho media thật, FFmpeg xuất MP4, chuyển kiểu xem, xem kết quả từng bước, sửa kịch bản và giữ nguyên dữ liệu sau tải lại.

Các website AI và máy chủ TLS trong kiểm thử native là fixture cục bộ. Chưa xác nhận trực tiếp trên tài khoản hoặc máy ảo Muse của người dùng.

## Canvas và giao diện

- **Dự án → Nhân bản canvas** tạo một dự án mới, giữ node/dây nối/nhóm/ghi chú và media cục bộ. Bản sao bỏ các ràng buộc tab và khóa phiên; chọn lại tab AI trước khi chạy. Chỉ nhân bản khi canvas không chạy tác vụ. Giới hạn tệp dự án hiện tại vẫn là 64 MB; thiếu media hoặc vượt giới hạn sẽ báo lỗi, giữ bản gốc.
- **Sáng tạo → Gửi sơ đồ** tạo mô tả văn bản có Mermaid, node, cổng vào/ra, dây nối và thứ tự phụ thuộc. Có tùy chọn bỏ nội dung prompt/ghi chú, sao chép hoặc tải `.txt`. Đây là thao tác xuất để người dùng xem và gửi, không tự gọi AI.
- Thanh công cụ chia riêng hàng trạng thái và hàng thao tác; bỏ nút **Kịch bản tổng** trên thanh trên cùng. Node kịch bản đã có vẫn mở và dùng được; có thể thêm qua bộ chọn node.
- **Cài đặt & kết nối AI → Giao diện → Màu từng phần**: chỉnh nền canvas, thanh bên, node, tiêu đề thẻ, nút thường, vùng nổi, viền, chữ chính và chữ phụ. Màu được lưu, chia sẻ giữa các cửa sổ và giữ khi cập nhật; có nút trở về bảng màu mặc định. Chữ trên node và nút được điều chỉnh theo nền để đọc rõ.
- Không có tab AI sẽ báo **Chưa mở tab**; mất kết nối Chrome báo **Chưa nối Chrome**, thay vì gộp mọi trường hợp vào lỗi chung. Lỗi mạng/bridge thực tế vẫn được giữ trong phần chi tiết.
