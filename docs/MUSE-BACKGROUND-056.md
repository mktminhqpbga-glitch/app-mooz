# Muse ở nền và tự chọn Ảnh/Video · MooZ 0.56.0

Dùng MooZ **0.56.0** và Workflow Connect **1.7.0**. Thay thư mục tiện ích, bấm Tải lại trong `chrome://extensions`, tải lại các tab Muse rồi ghép lại với app nếu phiên cũ đã ngắt. Tiện ích vẫn dùng giao thức kết nối 1; bộ nối bên trong tab Muse cần hỗ trợ `modeProtocol: 1`.

## Cách sử dụng trên máy ảo

1. Mở Chrome trên máy ảo Muse, đăng nhập và mở các cuộc trò chuyện cần dùng.
2. Mở Workflow Connect, nhập mã relay từ MooZ và kết nối.
3. Giữ **Giữ Muse chạy nền trong cửa sổ riêng** bật (mặc định bật). Có thể bấm **Chuẩn bị các tab Muse** để chuẩn bị ngay, trước khi cập nhật danh sách tab trong app.
4. Trong MooZ bấm Cập nhật tab và gán đúng cuộc trò chuyện cho từng node hoặc bước của lô.
5. Chạy thử một sản phẩm. Có thể làm việc ở cửa sổ khác; giữ Chrome, relay, máy ảo và cửa sổ AI hoạt động, không đóng hoặc thu nhỏ cửa sổ AI.

Tiện ích giữ nguyên tab ID, URL cuộc trò chuyện và phiên đăng nhập. Khi tab nằm cùng nhiều tab khác hoặc cửa sổ bị thu nhỏ, tiện ích chuyển đúng tab Muse đó sang một cửa sổ Chrome bình thường, `focused: false`. Tab được chọn bên trong cửa sổ riêng; cửa sổ đó không được yêu cầu giành tiêu điểm hệ điều hành. Nếu đã có một tab duy nhất đang được chọn trong cửa sổ không thu nhỏ, tiện ích dùng lại cửa sổ ấy. Không tạo lại cửa sổ ở mỗi cảnh.

Tắt tùy chọn để giữ cách bố trí tab của bạn. Tắt không tự đóng các cửa sổ hoặc xóa kết quả đang có. Các cửa sổ được giữ sau khi chạy để xem và lấy lại tệp.

## Tự chuyển chế độ

Trước khi điền prompt và ngay trước thao tác Gửi, app kiểm tra chế độ hiện tại và chọn đúng Ảnh/Video qua một bộ điều khiển xác định được trong ô chat:

- Nút tab/radio/toggle có trạng thái chọn rõ ràng.
- Danh sách lựa chọn có cả Image và Video.
- Menu liên kết với nút mở của ô chat qua `aria-controls` hoặc `aria-labelledby`.

Sau thao tác đổi, bộ nối phải đọc được trạng thái chọn mới. Nếu nút không phản hồi, có nhiều lựa chọn trùng/không xác định hoặc bản nháp bị thay đổi khi đổi chế độ, app dừng trước Gửi. Không tìm nút Image/Video tùy ý trong lịch sử chat và không thử gửi prompt nhiều lần.

Muse chat tự do không có bộ chọn chế độ rõ ràng vẫn nhận hợp đồng đầu ra trong prompt: ảnh tĩnh hoặc video. Trường hợp này app không thể xác nhận đã đổi một bộ chọn không được nhận diện. Khi Muse đổi giao diện, có thể cần cập nhật bộ nối; mục Chẩn đoán Muse có số lượng loại điều khiển và chế độ nhận diện, không chứa prompt.

Ô gợi ý model API như `muse-image` đã được bỏ khỏi node dùng tab trình duyệt vì nó không điều khiển bộ chọn trên website. Model API vẫn có ở nhà cung cấp API.

## Tải ảnh và lấy kết quả ở nền

Đã bỏ yêu cầu có layout rect đối với ảnh xem trước tệp tải lên Muse. Bộ nối kiểm tra phần tử/tệp hiện có và trạng thái tải, giữ loại bỏ nội dung CSS-hidden, tệp cũ và lịch sử. Điều này khắc phục một điểm chờ khiến tải ảnh xong nhưng chưa gửi khi Chrome không được hiển thị.

Kết quả tiếp tục được đọc qua DOM, nhịp đánh thức từ tiện ích và các lần hỏi trạng thái tác vụ. Nội dung được chuyển qua relay về app. Prompt chỉ gửi một lần; mất phản hồi không phải lý do tự tạo thêm lượt AI. Không dùng ảnh bìa video làm kết quả ảnh.

Các nhà cung cấp tab khác cũng không còn bị tự kích hoạt tab/cửa sổ khi bắt đầu lượt tạo. Những thao tác người dùng chủ động chọn kết quả hoặc mở tab vẫn có thể đưa trang cần thao tác ra trước.

## Giới hạn và kiểm thử

Cửa sổ riêng giữ tab được chọn, nhưng **không thể bảo đảm chạy nếu nền tảng Muse tạm ngưng cả máy ảo/Chrome, máy ngủ, mất mạng hoặc website tự dừng khi cửa sổ không có tiêu điểm**. Bộ nối không giả mạo `document.hidden`, không gắn debugger và không thay chính sách xác minh của dịch vụ. Nếu gặp tình huống đó trên máy ảo thực tế, cần kiểm tra cùng Muse hoặc dùng API do nhà cung cấp hỗ trợ.

Kiểm thử gồm Chrome/extension thật và hai kết nối WSS qua relay TLS cục bộ: cửa sổ Muse được tạo không có tiêu điểm, tab/phiên được giữ, tải ảnh với layout rect rỗng, tự đổi về Image sau khi tải ảnh làm chọn lại Video, nhận ảnh mới và từ chối video sai loại mà không gửi lại. Trang AI là fixture, không phải tài khoản hay máy ảo Muse của người dùng. Fixture visibility dùng giá trị nền vì Playwright mặc định ép focus/visibility cho trang được điều khiển; mã sản phẩm không thay đổi các giá trị này.

## Nhận kết quả mỗi 10 giây · 0.56.1

MooZ 0.56.1 kiểm tra trạng thái ngay sau khi giao tác vụ, sau đó cứ 10 giây hỏi lại đúng mã tác vụ Muse đang chờ. Mỗi tab vẫn theo dõi DOM và được đánh thức ở nền như trước; nhịp 10 giây là nhịp app hỏi và nhận kết quả qua kết nối hiện có.

Khi có kết quả, bộ nối trả ảnh/video/văn bản đã đối chiếu với lượt vừa gửi. App nhận tệp và tiếp tục node hoặc bước hàng loạt. Thời gian sao chép tệp phụ thuộc kích thước và đường truyền. Không mở thêm lượt tạo AI, không tự đổi tab, không tự quét và nhập toàn bộ lịch sử chat.

Trạng thái đang chạy có dòng **App tự kiểm tra kết quả mỗi 10 giây**. Bấm Dừng hủy cả khoảng chờ kiểm tra kế tiếp. Đến hạn chờ tác vụ hoặc mất kết nối kéo dài, app báo lỗi thay vì tiếp tục hỏi vô hạn hoặc tự gửi lại prompt. Chrome/máy ảo phải còn hoạt động để trả lời.

Cài app 0.56.1; Workflow Connect vẫn là **1.7.0**, không cần thay tiện ích nếu đã dùng đúng bản này.
