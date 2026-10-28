# Điều phối gửi AI — MooZ Agent 0.47.1

Bản sửa ngày 29/10/2026, giờ Việt Nam. App 0.47.1 cần **Workflow Connect 1.1.0** trở lên cho tab Chrome. Tiện ích vẫn chỉ có giao diện kết nối, dùng được với app cũ qua giao thức kết nối 1. Khi cập nhật tiện ích, tải lại các tab AI để thay bộ nối đã được nạp trước đó.

## Cách dùng

1. Cài app mới. Trong **Cài đặt & kết nối AI**, bấm **Tải Workflow Connect**, giải nén và cập nhật thư mục tiện ích trong Chrome → `chrome://extensions` → Tải lại. Nếu cài từ thư mục khác, tắt bản cũ để tránh hai tiện ích cùng kết nối.
2. Tải lại tab AI, kết nối tiện ích với app rồi cập nhật danh sách tab.
3. Trong **Nhịp gửi & trạng thái AI**, đặt khoảng cách gửi, thời gian nghỉ sau tác vụ và số tác vụ đồng thời. Mặc định: **5 giây giữa các lượt gửi, nghỉ 5 giây sau kết thúc, tối đa 1 tác vụ mỗi nhà cung cấp**. Chọn bốn tab không tự tăng giới hạn chung. Nếu chọn nhiều tác vụ đồng thời, giới hạn khoảng cách gửi vẫn áp dụng.
4. Khi AI yêu cầu xác minh/ngắt kết nối hoặc báo hạn mức, xem lý do tại đây. Xử lý trực tiếp trên trang AI hoặc theo hướng dẫn hỗ trợ của dịch vụ, sau đó bấm **Kiểm tra và tiếp tục**. App kiểm tra trang thực sự sẵn sàng; không chỉ xóa cờ lỗi.
5. Các cảnh/bài có kết quả chưa rõ cần kiểm tra rồi chạy tiếp thủ công. Bản sửa không tự gửi lại các lượt đó.

## Hành vi đã sửa

- Một bộ điều phối ở tiến trình chính, dùng chung giữa các canvas, Video hàng loạt, Chat AI, viết content, Affiliate và đăng qua Muse. Tab Chrome và cửa sổ AI trong app của cùng nhà cung cấp dùng chung nhóm. App chưa tự xác định tài khoản khác nhau; cách nhóm này có chủ ý giữ giới hạn thận trọng.
- Xin lượt **trước khi thao tác/tải tệp**, rồi xin phép **ngay trước hành động gửi** sau khi tệp đã sẵn sàng. Tốc độ tải tệp khác nhau không làm các lượt bỏ qua giới hạn chung. Quyền gửi hết hạn sau 2 giây phải xin lại; thời điểm thao tác gửi được xác nhận riêng.
- Kiểm tra lại prompt, cuộc trò chuyện và nút Gửi sau khi đợi. Người dùng đã tự gửi trong lúc chờ thì không bấm thêm lần nữa. Prompt/cuộc trò chuyện đổi thì dừng để kiểm tra.
- Nhận diện thông báo dịch vụ về ngắt kết nối Muse, xác minh, giới hạn truy cập/lượt. Loại trừ nội dung hội thoại và phần ẩn để câu trả lời trích dẫn thông báo không tự khóa toàn nhà cung cấp.
- Tạm dừng nhà cung cấp được lưu xuống đĩa qua lần khởi động lại. Chưa có quyền thì không đính kèm/gửi. Video hàng loạt giữ mục chưa chạy ở trạng thái chờ; hàng đợi canvas giữ các mục thuộc AI bị tạm dừng; các AI khác vẫn có thể nhận việc; bài đăng qua Muse chưa gửi được giữ trong hàng chờ. Tác vụ đang chạy có thể kết thúc hoặc báo lỗi cần xem lại; không mặc định rằng mọi yêu cầu cũ đã bị hủy ở máy chủ.
- Mất kết nối sau khi đã gửi hoặc mất mã tác vụ: tạm dừng nhóm liên quan, giữ trạng thái chưa rõ để người dùng kiểm tra; không tiếp tục cấp việc như thể lượt cũ chưa từng được gửi.
- Bỏ nhánh tự tạo một yêu cầu thay thế sau `SCENE_REFUSED`. Người dùng quyết định chỉnh prompt/chạy lại.
- Các POST API được điều phối chung theo máy chủ API. HTTP 429 đặt thời gian chờ theo Retry-After, hoặc 60 giây nếu không có giá trị hợp lệ; không phát lại POST cũ. POST chuyển hướng bị từ chối để không âm thầm gửi body thêm lần nữa.
- Nhật ký điều phối chỉ lưu thời điểm, nhóm AI, mã lượt và trạng thái; không ghi prompt, tệp tham chiếu hay khóa API. Lịch sử sự kiện trong phiên; cài đặt và lý do tạm dừng được lưu cục bộ.

## Giới hạn thực tế

Bản sửa điều phối những tác vụ do app khởi tạo. App không kiểm soát các thao tác người dùng thực hiện trực tiếp trên website, app khác hoặc thiết bị khác. Khoảng chờ không phải cơ chế vượt xác minh và không bảo đảm nhà cung cấp cho phép tự động hóa. Trạng thái “Đã ngắt kết nối Muse” yêu cầu liên hệ hỗ trợ vẫn cần phía Muse khôi phục theo hướng dẫn của họ.

Cập nhật trong file: `desktop/ai-dispatch.cjs`, `desktop/ai-windows.cjs`, `desktop/chrome-relay.cjs`, `desktop/chrome-relay-worker.js`, `composer-controls.js`, `ai-bridge.js`, `muse-bridge.js`; bảng cài đặt tại `desktop/ai-dispatch-ui.js`.

Kiểm thử: điều phối/cooldown/quyền hết hạn và giả mạo, chặn theo nhà cung cấp, giữ trạng thái qua khởi động lại, HTTP 429 không gửi lại POST; app Electron thật với hai tab và thông báo xác minh/ngắt kết nối Muse; tiện ích Chrome thật + relay có xác thực + hai tab; các kiểm thử DOM Muse/Gemini/ChatGPT và hồi quy desktop. Tất cả trang AI trong kiểm thử là fixture; không dùng tài khoản AI thật và không đăng bài thật.
