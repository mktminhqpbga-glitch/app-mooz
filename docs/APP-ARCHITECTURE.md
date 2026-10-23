# Phân tích và nâng cấp ứng dụng Workflow

## Kết luận

Canvas, các adapter AI và bộ xử lý media có thể tái sử dụng. Phần thiếu để thành ứng dụng là vòng đời dự án, lớp host, kết nối trình duyệt, khôi phục lỗi và quy trình đóng gói. Bản 0.30.0 thêm các lớp này mà giữ khả năng chạy tiện ích gốc.

## Trước thay đổi

- `app.js` là IIFE lớn điều khiển cả giao diện, đồ thị, lưu dữ liệu, dịch vụ AI và media. Phụ thuộc trực tiếp `chrome.*` làm HTML không thể chạy như app desktop độc lập.
- Chỉ một khóa `museflow` chứa canvas hiện tại. Không có danh tính dự án hay bản lưu trước.
- Khi đọc storage/IndexedDB lỗi, logic cũ thay bằng workflow mẫu rồi ghi lại. Canvas cố ý lưu rỗng cũng bị thay bằng mẫu.
- Chạy một node dùng thứ tự toàn canvas, nên một chu trình không liên quan có thể chặn nhánh hợp lệ.
- Nút xóa node × chỉ sửa bộ nhớ, không lên lịch lưu.
- Kiểm thử có sẵn chủ yếu dùng phản hồi AI và Chrome API giả lập. Một số kỳ vọng UI đã cũ.

## Cấu trúc hiện tại

```text
Canvas + bộ chạy workflow + media (giữ tương thích extension)
    │
    ├── Chrome extension: chrome.* thật → tab AI đang đăng nhập
    │
    └── Desktop host adapter (desktop/renderer.js)
            │ IPC có kiểm tra nguồn gọi
            ├── ProjectStore: dự án tách biệt, ghi tuần tự, thay tệp nguyên tử
            ├── ChromeRelay: localhost + mã ghép nối theo phiên
            │       └── extension đồng hành → tab Chrome hiện tại
            ├── AIWindows: cửa sổ AI tùy chọn, phiên đăng nhập riêng
            └── HTTP/API/download: đích được giới hạn, có hủy yêu cầu
```

Không nạp HTML vào Electron rồi giả định Chrome API sẽ hoạt động. Host adapter thực hiện các thao tác mà canvas đang dùng, còn tiện ích đồng hành chạy API Chrome ở đúng trình duyệt đang giữ phiên đăng nhập.

## Vòng đời dữ liệu

Mỗi dự án có UUID, tên và thời điểm tạo/cập nhật. JSON được ghi qua tệp tạm và đổi tên; bản trước được giữ riêng. Không tự ghi đè tệp hỏng. Khôi phục giữ lại tệp bị thay thế để kiểm tra.

Mỗi canvas desktop có partition IndexedDB riêng, tránh trùng khóa media giữa dự án nhập từ cùng JSON. API key chỉ ở bộ nhớ phiên. Cookie AI trong cửa sổ tùy chọn nằm ở partition trình duyệt riêng, không được lấy từ Chrome.

Đóng dự án desktop gọi lifecycle stop/flush, chờ hàng đợi lưu rồi đóng. Đang chạy hoặc lưu lỗi thì có hộp thoại để người dùng chọn ở lại. Việc đóng không cam kết hủy được tác vụ mà dịch vụ AI đã nhận từ trước.

## Kết nối và quyền

Relay chỉ lắng nghe loopback ở cổng ngẫu nhiên, yêu cầu origin extension và mã ngẫu nhiên 256 bit. Tiện ích chỉ cho phép tab AI được hỗ trợ, các loại message đã liệt kê và tệp bridge đóng gói sẵn; không nhận JavaScript tùy ý. Mất kết nối từ chối yêu cầu đang chờ, không phát lại prompt.

Renderer desktop không có Node.js. Cửa sổ AI từ xa không có preload của app. IPC chỉ nhận từ frame chính thuộc `workflow://app`; server tài nguyên chặn thoát thư mục/symlink/private source. Lớp mạng không được dùng để truy cập URL tùy ý.

## Điều đã và chưa chứng minh

Unit tests kiểm tra adapter/đồ thị, lưu dự án, khôi phục, đường dẫn, đích mạng và relay WebSocket. Regression Chromium kiểm tra lỗi lưu/khôi phục và chạy nhánh. Electron smoke dùng host thật để kiểm tra tạo/mở/lưu/reload/đóng dự án, cô lập cửa sổ, từ chối đích mạng và gửi/nhận bridge trên trang fixture. Relay routing được kiểm tra qua kết nối WebSocket thật với peer mô phỏng extension. Harness media tạo và kiểm tra MP4 H.264/AAC thật.

Các kiểm tra này không xác minh: tải bản cài trên macOS, Gatekeeper/chữ ký/notarization, quyền đăng nhập Google trong Electron, tài khoản AI đăng nhập thật, hạn mức tạo ảnh/video hoặc độ ổn định DOM của nhà cung cấp. Không gọi API tính phí để làm smoke test.

## Phần tiếp theo trước phát hành

1. QA macOS Apple Silicon và Intel, ghép nối Chrome thật, upload/tạo nội dung/hủy/mất mạng.
2. Ký và notarize bản cài; xác minh luồng cập nhật đã thêm trong 0.31.0 trên hai phiên bản Mac thật. Xem AUTO-UPDATE.md.
3. Tách `app.js` thành canvas, graph, run service và persistence để giảm phạm vi mỗi thay đổi.
4. Bổ sung lịch sử chạy bền vững, đối chiếu tác vụ sau khi app thoát đột ngột; tránh tạo lại tác vụ tính phí khi chưa xác minh kết quả cũ.
5. Sao lưu media theo phiên bản và garbage collection. Bản JSON trước hiện có thể trỏ tới media đã thay đổi; chưa phải bản backup media hoàn chỉnh.
6. Giới hạn đồng thời trên toàn app khi nhiều dự án dùng chung một tab AI. Hàng đợi hiện vẫn thuộc từng canvas; bridge sẽ từ chối tab đang bận nhưng chưa phải scheduler liên dự án.
