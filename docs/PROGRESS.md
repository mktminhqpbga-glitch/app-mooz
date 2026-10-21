# Đối chiếu 17 yêu cầu trong ảnh

Tình trạng dựa trên mã nguồn ZIP được cung cấp, không kế thừa các nhãn “đã thêm mã” trong ảnh như bằng chứng đã chạy thật.

| STT | Yêu cầu | Triển khai và kiểm chứng | Phần cần kiểm tra thực tế |
|---|---|---|---|
| 1 | Video vượt 10 giây | Thêm 15/20/30/60s vào node và bộ nhập kịch bản, hiển thị thời lượng thực; UI kiểm thử đạt | Muse có thể giới hạn clip. Veo chỉ 4/6/8s; clip dài cần nhiều cảnh/timeline |
| 2 | Gemini xử lý kịch bản/prompt | Adapter tab/API, tạo kịch bản theo mẫu trong cửa sổ Kịch bản → Node | Tài khoản và model thật |
| 3 | Chọn AI ngay tại node | Bộ chọn riêng cho ảnh/video/văn bản, lọc theo khả năng; UI đạt | Xác minh từng nhà cung cấp thật |
| 4 | Kết nối nhiều AI | Cài đặt liệt kê Muse/Gemini/ChatGPT/Google/OpenAI/fal.ai | Phiên đăng nhập và API thật |
| 5 | Không bắt buộc API key | Nhận diện tab, kiểm tra ô chat, chèn bridge trước khi gửi | Quyền site và trạng thái đăng nhập trên máy người dùng |
| 6 | API tùy chọn | Google, OpenAI, fal.ai; khóa trong session, ngoài workflow; kiểm thử request/response giả lập đạt | Khóa, hạn mức, quyền model, chi phí |
| 7 | Trạng thái AI | Xanh/đỏ/xám cho tab; khóa API chưa xác thực hiển thị vàng | Kiểm tra API bằng yêu cầu tạo thật |
| 8 | Việt hóa | Menu chính, node, cổng, thao tác chạy/lưu/kết nối/kịch bản và thông báo chính | Một số thông báo kỹ thuật và chức năng timeline kế thừa vẫn tiếng Anh |
| 9 | Generate Text | Node có input/output, chạy đơn/workflow, truyền text qua đồ thị, lưu kết quả; UI đạt | Văn bản thực từ nhà cung cấp |
| 10 | Nhận ảnh/video | Cổng yêu cầu/quy tắc/ảnh/video gốc; kiểm thử vận chuyển media đạt | ChatGPT tab/OpenAI adapter không nhận video; dùng Gemini |
| 11 | Phân tích video → kịch bản | Gemini tab/API nhận video và quy tắc; kết quả có thể chuyển sang trình nhập cảnh | Chất lượng phân tích và bố cục cảnh từ AI thật |
| 12 | Video gốc thay ba frame | Không có bước trích ba frame trong đường gửi phân tích. Kiểm thử xác nhận byte video gốc trong Gemini API và bridge | Giới hạn kích thước/định dạng của dịch vụ |
| 13 | Tải ảnh sang AI khác | Chuyển blob URL thành data URL trước khi qua tab; upload qua input file và chờ xác nhận | Giao diện ChatGPT/Gemini/Muse thật, quyền tạo ảnh |
| 14 | Tự gửi sau upload | Đợi preview, hết trạng thái upload và nút Gửi sẵn sàng; gửi một lần; DOM simulation đạt | Selector trên giao diện nhà cung cấp thật |
| 15 | Chạy lại dọn dữ liệu | Xóa bản nháp/tệp chưa gửi trong composer, xóa đầu ra node cũ; rerun/stop simulation đạt | Các biến thể giao diện và upload thất bại thật |
| 16 | Nhân vật theo video | Video Input + ảnh nhân vật → fal Kling Motion Control; schema/queue giả lập đạt | Cần API key/quyền model và kiểm thử đầu cuối. Không cam kết bám chuyển động hoàn hảo |
| 17 | Video ngoài Muse | Google Veo long-running API + fal.ai Motion Control, kiểm tra quyền/khả năng trước khi gửi | Chưa gọi API trả phí, chưa xác nhận video đầu ra thật |

## Kiểm tra trên Chrome/Edge của người dùng

1. Load unpacked từ thư mục gốc có manifest phiên bản 0.6.2, tải lại các tab AI.
2. Mở Gemini/ChatGPT/Muse đã đăng nhập, kiểm tra màu kết nối; không mở tab phải hiển thị xám.
3. Tạo văn bản từ prompt, rồi từ ảnh; xác nhận đầu ra đúng trong node và nối sang node khác được.
4. Dùng Gemini phân tích một video nhỏ có chi tiết chuyển động ở giữa; xác nhận tab nhận video gốc, không phải ba ảnh.
5. Chạy lại sau một lần lỗi upload; xác nhận không còn tệp cũ và chỉ gửi một prompt.
6. Bấm Dừng trong lúc chờ upload/AI; xác nhận node thoát trạng thái chạy. Dừng API là best-effort, tác vụ nhà cung cấp có thể đã bắt đầu.
7. Thử API bằng khóa của người dùng: văn bản trước, ảnh sau; Veo/Motion Control cuối cùng vì có chi phí và yêu cầu quyền model.
8. Xuất/nhập workflow, đóng/mở lại canvas; xác nhận media và đầu ra văn bản còn, khóa không có trong JSON xuất.
9. Xuất một timeline ngắn WebM/MP4 và kiểm tra âm thanh/thời lượng; MP4 hai clip ngắn đã được kiểm tra tự động bằng FFmpeg WASM và ffprobe; WebM và timeline dài chưa kiểm thử.

### 0.8.0

Thêm lựa chọn tab/cuộc trò chuyện, chặn đổi chat; node tạo văn bản qua tab chuẩn bị tệp trước rồi tự gửi sau 2 phút hoặc nhận lệnh Gửi ngay có chờ upload. Mỗi node có ID ổn định và prompt có bảng ánh xạ ID ảnh theo thứ tự đính kèm. Bổ sung công cụ chẩn đoán và ghi nhớ nút Gửi Muse do người dùng chọn. Chưa xác minh với tài khoản AI đăng nhập thật.

### 0.8.1

Sửa báo nhận prompt sai khi lịch sử Muse hydrate, bổ sung nhận diện mũi tên và đường gửi Enter có xác nhận; nhận thẻ video ChatGPT dạng tên tệp rút gọn; đưa ID nhỏ lên cạnh tên node. Kiểm thử hồi quy mô phỏng, chưa xác minh phiên AI thật.

### 0.8.2

Sửa xác nhận và thu kết quả ChatGPT: turn assistant/writing block, composer bị thay/ẩn, draft còn lưu nhưng có user echo khớp prompt; nhận diện Stop streaming và kéo dài chờ xác nhận lên 90 giây, không gửi trùng. Kiểm thử DOM mô phỏng, chưa xác minh phiên ChatGPT thật.

### 0.8.3

Mở rộng nhận diện câu trả lời theo turn/nút sao chép ChatGPT. Thêm chọn kết quả trực tiếp trên tab, xem trước và xác nhận; hoàn tất lượt đang chờ hoặc nhập vào node đã kết thúc mà không gửi prompt lại. Chưa xác minh DOM phiên AI thật.
