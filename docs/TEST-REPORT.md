# Kết quả kiểm thử lại — 21/10/2026

Mã được sửa sau khi kiểm tra bổ sung phát hiện nút Dừng tạo kịch bản chỉ dừng chờ trên canvas, chưa gửi lệnh dừng tới tab Gemini/ChatGPT. Kiểm thử hồi quy thất bại trước sửa (`0 !== 1` lệnh dừng), đạt sau sửa. Lệnh dừng không đúng request ID cũng không còn bấm dừng một phiên AI khác.

## Đã chạy và đạt

- `node --test tests/*.test.mjs`: 14 kiểm thử, 14 đạt, 0 lỗi, 0 bỏ qua. Các phản hồi API là giả lập.
- `node tests/browser-smoke.cjs`: Chromium thật, `chrome.*` và phản hồi AI giả lập. Kiểm tra thêm/xóa dữ liệu qua nhập workflow, các node mới, lựa chọn thời lượng, cấu hình kết nối, video gốc, chạy lại, lưu, viết kịch bản và dừng yêu cầu tại tab AI. Kiểm tra chuỗi Yêu cầu → Tạo văn bản → Tạo ảnh, đảm bảo text đầu ra thành prompt đầu vào và kết quả được lưu. Không có lỗi JavaScript trang.
- Trong cùng harness, xuất MP4 **thật** qua FFmpeg WASM đi kèm. Đầu vào là hai clip 1 giây được tạo cục bộ bằng ffmpeg: 160×90 và 160×120, kèm âm thanh tần số khác nhau. Bản xuất được đọc bằng ffprobe, xác nhận H.264, AAC và thời lượng 1,9–2,5 giây. Đây là đường chuyển mã/ghép clip, không phải API giả lập.
- `node tests/bridge-smoke.cjs`: DOM nhà cung cấp giả lập trên Chromium. Gemini: dọn draft/tệp cũ, nhận byte video gốc và ảnh, đợi upload, gửi một lần, nhận phản hồi mới, chạy lại và hủy. ChatGPT: textarea, phản hồi văn bản, ảnh kết quả được lưu thành data URL, từ chối video chưa hỗ trợ trước khi gửi. Từ chối message từ sender không thuộc extension.

## Chưa thể xác nhận

- Cài Load unpacked qua tự động hóa: Chromium của môi trường bị chính sách quản trị chặn tải extension. Harness không xác minh quyền/tiêm content script trên một bản cài extension thật.
- Không có browser connector tới Chrome của người dùng, không có phiên Muse/Gemini/ChatGPT đăng nhập trong môi trường thử.
- Không có các biến khóa Google/Gemini/OpenAI/fal.ai cần thiết. Không gọi API trả phí, Veo hoặc Motion Control thật.
- Chưa kiểm tra WebM, timeline dài, chất lượng AI phân tích video, bám chuyển động, hoặc dịch vụ tạo được clip 15–60 giây.
- DOM giả lập kiểm tra logic chờ/gửi/hủy nhưng không chứng minh selector khớp giao diện AI đang triển khai ngoài thực tế.

Không kết luận hoàn tất cả 17 yêu cầu chỉ dựa trên các kiểm thử trên.


## Sửa lỗi Run / dọn dẹp trong 0.6.3

Báo lỗi thực tế của người dùng cho thấy các fixture trước thiếu lịch sử chat và dùng form đơn giản, nên đã bỏ sót lỗi phạm vi composer. Đã tái hiện đúng lỗi “Không dọn được tệp đính kèm cũ” bằng mã 0.6.2 khi composer không có form, cùng nằm trong main với lịch sử có tệp. Test dùng mã cũ thất bại trước sửa.

- Gemini/ChatGPT không còn lấy main làm vùng composer; chỉ dọn tệp trong vùng nhập tin và bỏ qua wrapper đính kèm rỗng.
- Không xóa trắng prompt trước khi chạy. Tải tệp trước, lấy lại composer sau khi trang dựng lại ô nhập, rồi thay nội dung một lần bằng thao tác chỉnh sửa native cho contenteditable.
- Fixture bổ sung mô phỏng editor xóa input tổng hợp và dựng lại sau upload. Xác nhận native input, prompt gửi đi đúng nội dung, mỗi lần chỉ gửi một lần, không xóa tệp trong lịch sử.
- Ô nhập trống sau nhấn Gửi không còn được coi riêng là bằng chứng gửi thành công; phải có tin nhắn mới hoặc dấu hiệu AI đang trả lời.
- Muse cũng giới hạn cleanup, preview và nút Gửi vào composer; không bấm nút lịch sử. Sửa biến ngoài phạm vi trong xử lý phản hồi từ chối.
- `node tests/muse-smoke.cjs` đạt với tệp trong lịch sử, composer bị dựng lại sau upload, ảnh trả về và phản hồi từ chối.

Các kiểm tra này vẫn dùng DOM giả lập. Cần tải lại các tab AI sau khi thay bản extension, vì content script cũ có thể còn trong tab đã mở. Chưa xác minh trực tiếp trên phiên đăng nhập của người dùng.


## 0.7.0 — Nhận phản hồi Gemini và tạo ảnh hàng loạt

Người dùng xác nhận prompt đã gửi nhưng Workflow không nhận kết quả. Bộ đọc phản hồi được mở rộng cho các biến thể `model-response`, `.model-response-text`, `.markdown-main-panel`, `message-content`, kể cả custom wrapper có `display: contents`. Ưu tiên phần nội dung câu trả lời, bỏ vùng tin nhắn người dùng và chờ dấu hiệu kết thúc stream. Bộ kết nối báo tiến trình gửi/nhận về UI bằng request ID và tab ID đã xác nhận. Những thay đổi này chưa được kiểm tra trên phiên Gemini thật của người dùng.

Kiểm thử bổ sung đã đạt:

- 17 kiểm thử Node (gồm tách prompt nhiều dòng, số bản sao, giới hạn 50 ảnh).
- DOM Gemini giả lập trả kết quả không có thẻ model-response và wrapper display:contents; Workflow lấy được nội dung.
- Chọn tab chat sẵn sàng khi tab đang active không có composer; khi không có tab sẵn sàng, báo lỗi ngay cạnh nút, giữ kịch bản cũ và không gửi yêu cầu tạo.
- Nút gọi AI vẫn được gắn sự kiện khi đọc session storage thất bại (`FAIL_SESSION_STORAGE=1 node tests/browser-smoke.cjs`).
- Đợt hai prompt × hai ảnh: tạo bốn node Gemini tỷ lệ 16:9, dùng chung ảnh tham chiếu/loại trừ, chỉ chọn bốn node mới, chạy bốn yêu cầu tuần tự qua phản hồi AI giả lập, lưu bốn kết quả.
- Nhập hai cảnh chứa cả prompt ảnh/video với chế độ Chỉ ảnh: tạo hai node ảnh bằng AI đã chọn, không tạo video.
- Đường xuất MP4 FFmpeg WASM thật vẫn đạt với hai clip ngắn.

Không diễn giải các kết quả giả lập thành xác nhận Gemini/ChatGPT/Muse hay API trả phí hoạt động trên tài khoản thật.


## 0.7.1 — Nút Gửi và nhận video Muse

Người dùng cung cấp hai ảnh: prompt/ảnh đã nằm trong composer nhưng chưa Gửi; sau khi tự bấm Gửi, Muse có video nhưng node vẫn chờ. Đây là hai đường cần xử lý riêng, không coi việc điền prompt là đã gửi.

- Bộ nhận diện dùng chung cho Muse/Gemini/ChatGPT hỗ trợ tên nút, SVG mũi tên/Send và nút submit trong composer. Lọc nút disabled/aria-disabled trước khi lựa chọn; không nhầm nút X, tải tệp hoặc nút trong lịch sử.
- Dọn nút X không có aria-label nếu nó nằm trong khung ảnh tham chiếu. Muse chỉ phát change cho input file, tránh hai handler input/change cùng tải một ảnh. Dedupe ảnh tham chiếu bằng SHA-256 của nội dung.
- Trong khi chờ nút Gửi, Muse theo dõi tin nhắn/kết quả mới. Khi người dùng tự gửi, tiếp tục lấy kết quả và không click thêm.
- Đọc video không cần data-testid cũ, không loại bỏ cả nhóm group/msg. Hỗ trợ video/source, data-video-src/data-video-url và liên kết MP4/WebM. Không bắt buộc metadata preload; node Workflow xác minh khả năng đọc media sau khi nhận. Không coi poster ảnh là lỗi trả sai media quá sớm khi video còn đang sinh.
- Có tiến trình đang chờ nút Gửi / Muse nhận yêu cầu / đang chuyển kết quả về Workflow.

Kiểm thử đạt: 17 test Node; browser-smoke; bridge-smoke với icon-only Send; muse-smoke với nút mũi tên không nhãn, nút Send disabled đặt trước, aria-disabled chuyển sang sẵn sàng, nút X không nhãn, một ảnh có hai URL/yêu cầu trùng và hai handler input/change. Chỉ một ảnh được tải và một prompt được gửi.

Kiểm tra bổ sung gửi thủ công: một video MP4 thật do ffmpeg tạo được phục vụ qua HTTP giả lập, trong wrapper group/msg không có marker cũ và video preload=none. Người dùng giả lập bấm Gửi một lần; bridge trả đúng bytes video về. Kiểm tra node nhận MP4, đọc 160×90, lưu kết quả và trích khung cuối đạt. FFmpeg WASM xuất timeline vẫn đạt.

Giao diện/response server Muse thật chưa được điều khiển trong môi trường này; các thay đổi dựa trên ảnh người dùng và fixture tái hiện các trạng thái tương ứng, không xác nhận phiên đăng nhập thật.


## 0.7.2 — Nhận diện ô Hỏi ChatGPT

Ảnh người dùng cho thấy ô nhập ChatGPT hiện hữu nhưng node báo không tìm thấy. Mã cũ chỉ tìm `#prompt-textarea` và `textarea[data-id=root]`, có thể bỏ qua biến thể UI khác hoặc kiểm tra quá sớm khi tab chưa dựng editor. Không suy luận người dùng chưa đăng nhập từ kết quả này.

- Thêm contenteditable, role textbox và nhãn Hỏi ChatGPT; ưu tiên vùng composer/form và loại textarea ẩn, readonly, search/history.
- Kiểm tra chờ tối đa 3,5 giây; chuyển tab AI lên trước khi xác minh cho yêu cầu tạo. Khi bắt đầu chạy hoặc sau upload, đợi lại editor nếu DOM vừa dựng lại.
- Nhận ChatGPT trên chatgpt.com, www.chatgpt.com và địa chỉ chat.openai.com cũ. Đây không phải hỗ trợ website ChatGPT bên thứ ba.
- Hiển thị lỗi nhận diện ô nhập thay thông báo chung suy đoán đăng nhập; ẩn ô model muse-image khi node đã chọn AI khác.
- Bridge smoke đạt trên fixture ChatGPT hiện đại: không có ID editor cũ, ID cũ là textarea ẩn, textarea readonly giả, textbox xuất hiện trễ và placeholder tiếng Việt. Gửi/nhận văn bản đúng ô trên cả canonical và www. Gemini/native textarea/icon-only Send/rerun/cancel vẫn đạt.
- Browser smoke xác minh tab phải được kích hoạt mới trả composer sẵn sàng. 17 test Node và đường MP4/video node đạt trong lần kiểm tra này.

Chưa có kết nối điều khiển trình duyệt với phiên ChatGPT thật của người dùng. Không coi fixture là xác nhận DOM thật trong ảnh.
