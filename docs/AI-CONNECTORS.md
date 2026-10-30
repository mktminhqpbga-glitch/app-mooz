# Grok, Google Flow và Veo · MooZ 0.52.0 / Workflow Connect 1.4.0

| Lựa chọn | Kết nối | Kết quả trong app |
| --- | --- | --- |
| Grok · tab | `https://grok.com/` / `https://www.grok.com/` | Văn bản, ảnh, video; chọn Chat/Imagine và chế độ tạo trong trang trước |
| Google Flow / Veo · tab | `https://flow.google.com/` hoặc `https://labs.google/fx/tools/flow` (cả đường dẫn có ngôn ngữ) | Ảnh/video từ dự án đang mở; chọn model Veo, tỷ lệ và chế độ tại trang Flow |
| Google Gemini / Veo 3 · API | Khóa Google trong Thiết lập AI trong dự án | Adapter Google API hiện có; model phải còn được tài khoản/API cho phép |
| Grok / xAI · API | Mẫu cấu hình trong Cài đặt & kết nối AI | Chat Completions cho văn bản, đọc ảnh khi model hỗ trợ; không phải API tạo ảnh/video |

Veo là model tạo video; Flow là ứng dụng web của Google có thể dùng model đó. Không cần một tab “Veo 3” riêng khi đã chọn Flow. App không tự đăng nhập, mua gói, đổi model hoặc vượt xác minh của nhà cung cấp. Thời lượng/tỷ lệ gửi trong prompt là yêu cầu; chọn thông số tại tab và kiểm tra tệp trả về.

## Cách dùng tab Chrome

1. Cài app 0.52.0 và giải nén/cập nhật Workflow Connect 1.4.0 từ mục **Cài đặt & kết nối AI → Tải Workflow Connect**. Bản này bổ sung quyền tới đúng tên miền Grok/Flow; Chrome có thể yêu cầu chấp nhận quyền. Tải lại extension và các tab AI.
2. Ghép Chrome với app như trước, cùng máy hoặc qua relay Internet. Tiện ích vẫn chỉ hiển thị phần kết nối; không thêm canvas vào tiện ích.
3. Tự mở Grok hoặc Flow, đăng nhập và mở chat/dự án. Với tạo ảnh/video, chọn chế độ đầu ra và model ngay tại trang AI trước.
4. Trong node **Tạo văn bản / Tạo ảnh / Tạo video**, chọn đúng AI và mở **Kết nối AI → Làm mới danh sách chat**, chọn tab của nó. Google Flow chỉ có ở node ảnh/video; không dùng để viết văn bản hoặc lập kế hoạch Agent.
5. Tạo video hàng loạt: **Nhóm tab AI → Cập nhật danh sách tab AI**, đánh dấu từng tab được phép nhận việc, chọn Grok/Flow trong bước phù hợp. Mỗi tab chỉ giữ một tác vụ. Affiliate và trợ lý tạo cảnh cũng có thể chọn chúng làm AI tạo video.

Các nút **Mở Grok**, **Mở Google Flow / Veo** trong Cài đặt mở cửa sổ AI riêng trong app. Nếu nhà cung cấp không cho đăng nhập trong cửa sổ tích hợp, tự mở Chrome và chọn tab qua extension; app không bỏ xác minh hoặc giả danh trình duyệt.

## Đầu vào và nhận kết quả

- Bộ nối tab Grok/Flow hiện gửi văn bản và ảnh tham chiếu. Video tham chiếu bị từ chối trước khi gửi; chưa tuyên bố hỗ trợ kéo video vào hai website này.
- Upload chỉ tiếp tục sau khi trang xác nhận thẻ tệp; không coi FileList là upload thành công. Không tìm thấy nút tải, nút gửi hoặc ô soạn thảo: báo lỗi, chưa gửi prompt.
- Giữ giới hạn và nhịp gửi của bộ điều phối; xác minh, giới hạn dịch vụ hay mất kết nối giữ việc để đối chiếu, không tự gửi lại.
- Kết quả phải thuộc lượt mới sau lúc gửi, loại ảnh cũ/ảnh tham chiếu. Video phải tải được tệp MIME video thật, tối đa 100 MB, đọc được kích thước và thời lượng; poster không phải video. Nếu tệp chỉ còn preview/MSE hoặc quyền tải bị chặn, app chưa đánh dấu hoàn tất.
- Flow có nhiều thẻ kết quả mới không phân biệt được: app báo cần kiểm tra, không tự chọn ngẫu nhiên. Dùng **Khôi phục thủ công / Nhập video kết quả** trong node để lấy đúng tệp đã tải. Không tạo lại prompt để “thử lấy kết quả”.
- Đổi sang chat/dự án khác trong lúc chạy sẽ dừng việc nhận kết quả; không gom toàn bộ media trên trang làm kết quả của node.

## Lưu ý Google API theo tài liệu hiện tại

[Tài liệu Google video](https://ai.google.dev/gemini-api/docs/video), kiểm tra ngày 30/10/2026, thông báo các model Veo 3.1 Preview trong Gemini API đã đóng ngày 22/10/2026. Không coi adapter/API key cũ là đảm bảo còn dùng được một model Veo. Kiểm tra model được cấp trong tài khoản và thông báo API; không tự đổi sang model/dịch vụ khác có thể tính phí. Với mục tiêu chạy Veo qua trình duyệt, dùng **Google Flow / Veo · tab** và chọn model còn có trong tài khoản Flow.

## Phạm vi kiểm thử

Đã thêm kiểm tra domain/path, từ chối website giả mạo, khả năng chọn loại đầu ra và nhóm tab theo AI. Kiểm thử Electron dùng trang DOM mô phỏng, ảnh PNG và video MP4 thực; kiểm tra một lần gửi, kết quả lượt mới, không thêm số giây khi Không chọn, từ chối Flow văn bản và các lựa chọn trên giao diện. Không có tài khoản Grok/Flow đăng nhập trong môi trường phát triển; chưa kiểm thử trực tiếp trên tài khoản thật hoặc gọi model trả phí. Website thay đổi giao diện có thể cần điều chỉnh bộ nối; hãy gửi thông báo lỗi/báo cáo từ app để đối chiếu, không gửi cookie hay API key.
