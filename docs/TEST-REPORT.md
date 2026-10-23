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

## 0.8.0 — chat cố định, gửi hai bước, ID tham chiếu và chẩn đoán Muse

- `node --test tests/*.test.mjs`: 17/17 đạt, API giả lập.
- `node tests/staged-send-smoke.cjs`: Chromium, đồng hồ ảo. Video gốc được chọn qua input `video/*`; không gửi trước 120 giây; yêu cầu gửi sớm trong lúc upload không gửi thiếu tệp; hoàn tất upload mới gửi. Tự bấm Gửi trên trang không gây gửi trùng; đổi đường dẫn chat và Dừng đều chặn gửi.
- `node tests/muse-support-smoke.cjs`: chọn nút có SVG chưa nhận diện, lần chọn không gửi draft, ghi nhớ đúng nút, từ chối nút bị vô hiệu hóa, báo cáo không chứa prompt.
- `node tests/browser-smoke.cjs`: bổ sung ID độc nhất được lưu; hai ảnh được gửi đúng thứ tự và bảng đối chiếu ID; từ chối chạy khi tab đổi cuộc trò chuyện. Giữ kiểm tra xuất FFmpeg WASM thật và đọc MP4 bằng ffprobe.
- Các harness bridge/Muse cũ vẫn dùng DOM giả lập. ChatGPT không còn bị cấm video ở adapter tab; nếu input không nhận video thì báo lỗi và không gửi. Khả năng model hiểu video thật chưa xác minh.

Không có phiên đăng nhập Muse/Gemini/ChatGPT thật. Tính năng chọn nút Muse cần người dùng chọn trên giao diện thật; không khẳng định lỗi Muse đã được xác minh hết.

## 0.8.1 — hồi quy theo ảnh lỗi thực tế

- Muse: lịch sử thay đổi trong lúc nút Gửi đang chờ; vẫn phải bấm Gửi. Nút được bấm nhưng không gửi, đồng thời xuất hiện thêm nội dung lịch sử: trả lỗi sau thời gian xác nhận, không phát thông báo “đã nhận yêu cầu”, không bấm lần hai. Thử đường gửi qua handler Enter khi nút không nhận diện được. Thêm SVG mũi tên có tọa độ khác fixture cũ.
- ChatGPT: fixture thẻ video không class attachment, chỉ có tên `workflow-XXXXXXXX…` và thanh tiến trình. Nhận diện được tệp, điền prompt, chờ upload, gửi sớm/tự gửi 120 giây, gửi thủ công không trùng, đổi chat và hủy đều được kiểm tra bằng đồng hồ ảo.
- UI: ID nằm trong header thay vì body, cỡ chữ không quá 10px. Giữ kiểm thử ánh xạ thứ tự hai ảnh, chọn chat, lưu và xuất MP4 thật.

Không có tài khoản Muse/ChatGPT/Gemini đăng nhập thật trong môi trường này; các fixture được mở rộng theo ảnh lỗi nhưng không thay cho kiểm thử giao diện thật.

## 0.8.2 — ChatGPT đã trả lời nhưng Workflow báo chưa nhận prompt

`node tests/gpt-response-smoke.cjs` kiểm tra trên Chromium với đồng hồ ảo:

- Writing block/turn assistant không có `data-message-author-role`, nội dung có thể chỉnh sửa: vẫn lấy đúng nội dung, không lấy tiêu đề/nút Copy và không coi đây là composer.
- Composer biến mất sau gửi: vẫn xác nhận và nhận kết quả.
- Bắt đầu phản hồi sau 25 giây: không thất bại ở mốc 15 giây.
- ChatGPT giữ draft nhưng có user turn mới khớp prompt: không gửi thêm lần nữa.
- Chờ đoạn writing đang streaming kết thúc trước khi trả kết quả.
- Click không gửi, chỉ lịch sử cũ thay đổi: không báo thành công, hết 90 giây báo chưa xác nhận, chỉ click một lần.

Bộ unit 17 ca và các harness bridge, staged-send, UI/FFmpeg được chạy hồi quy. Đây là kiểm thử mô phỏng DOM, chưa có phiên ChatGPT đăng nhập thật.

Kiểm chứng hồi quy: chạy cùng fixture bằng `ai-bridge.js` của 0.8.1 tái hiện đúng lỗi “Chưa xác nhận AI nhận prompt” dù writing block đã xuất hiện; fixture đạt với mã sửa 0.8.2.

## 0.8.3 — lựa chọn kết quả có xem trước

- `tests/gpt-response-smoke.cjs`: thêm turn không có role assistant/writing marker, chỉ có nút `copy-turn-action-button`; tự nhận nội dung markdown và đợi kết thúc streaming.
- `tests/result-picker-smoke.cjs`: chọn kết quả có xem trước, chưa xác nhận thì chưa nhập; xác nhận hoàn tất lượt đang chờ qua đúng request ID, chỉ có một lần gửi ban đầu, request ID sai bị từ chối; sau 120 giây không gửi thêm.
- `tests/browser-smoke.cjs`: mock thao tác chọn trả kết quả từ tab vào đúng node đang chờ qua promise cũ, không tạo yêu cầu AI mới; giữ kiểm tra FFmpeg và UI hiện có.
- Các bridge và staged-send giữ kiểm tra gửi, upload, dừng và không gửi trùng.

Đây là cơ chế khôi phục có người dùng chọn rõ câu trả lời và xác nhận nội dung. Tự nhận diện vẫn cần xác minh trên phiên ChatGPT thật; ảnh chụp không cung cấp cấu trúc DOM.

## 0.9.0 — tám node sản xuất

- `node --test tests/*.test.mjs`: 20 kiểm thử, thêm đánh giá kỹ thuật sai tỷ lệ/thời lượng/âm thanh, cấu hình không hợp lệ, đọc biến thể JSON/đánh số và tên thư mục không đi xuyên đường dẫn.
- `node tests/tools-smoke.cjs`: Chromium với chrome.* và phản hồi AI mô phỏng. Kiểm tra đủ tám mục menu; khóa ảnh giữ nguyên khi thay nguồn; metadata khóa và vai trò vào đúng ảnh; duyệt sửa prompt và chặn gửi trước duyệt; hủy không gửi; khóa vẫn đúng byte sau lưu IndexedDB/tải lại. Chia hai cảnh thành bốn node tạo, chặn tạo trùng. Bộ tải có tệp + manifest đúng thư mục/ID/prompt; chọn biến thể thứ hai làm prompt đầu ra; phân tích nhận đúng byte video gốc.
- Trong cùng harness, tạo MP4 thật 160×90, dài 1 giây có AAC bằng ffmpeg hệ thống; node kiểm tra gọi FFprobe WASM đi kèm và xác nhận kích thước/thời lượng/luồng audio. Thư viện WASM trả trạng thái -1 mặc định nhưng JSON thăm dò hợp lệ; dùng dữ liệu JSON, kiểm tra luồng video/kích thước và lỗi cấu trúc thay cho kết luận từ mã trả về. Ảnh vuông thật được báo chưa đạt tỷ lệ 16:9.
- Giữ harness UI cũ gồm xuất MP4 thật và kiểm tra bằng ffprobe hệ thống.

Không có phiên AI đăng nhập thật. Kiểm thử vận chuyển video/rules/ảnh không chứng minh chất lượng phân tích, khóa nhân vật hoặc AI làm đúng prompt. Có luồng âm thanh không đồng nghĩa có tiếng nghe rõ. Tải theo bộ kiểm tra yêu cầu downloads và dữ liệu tệp, không xác minh đường dẫn đĩa Downloads thật trong môi trường này.

## 0.9.1 — rút gọn prompt ảnh

22 kiểm thử unit đạt: giữ nguyên nội dung yêu cầu, tỷ lệ/negative; bỏ bảng ID không dùng cho một ảnh; giữ ID khi nhiều ảnh, được nhắc trong prompt, có vai trò/khóa. Harness UI kiểm tra chính xác prompt gửi với một ảnh là yêu cầu gốc + một dòng ngắn và vẫn nhận đúng tệp; harness tám công cụ giữ kiểm tra vai trò và khóa. Phản hồi AI vẫn giả lập; đây là kiểm thử nội dung gửi đi, không xác minh chất lượng model thật.

## 0.9.2 — URL chat cũ trong cùng tab

Harness UI kiểm tra: đổi URL trong cùng ID tab bị chặn trước gửi; bấm Làm mới ở node thì cập nhật URL, chạy đúng tab và lưu URL mới. Chọn tab khác khi URL thực đã đổi so với cache vẫn dùng URL truy vấn trực tiếp. Tab đã chọn đóng thì báo lỗi, không gửi sang tab khác. Harness staged-send giữ kiểm tra đổi chat trong lúc chờ làm dừng gửi. Phản hồi AI và chrome.* vẫn giả lập.

Kiểm tra UI xác nhận không còn nút/modal ủng hộ và nhấn Escape không phát sinh lỗi; giữ kiểm tra tải lại node, đổi chat, chọn lại URL mới và tab đóng. Đã chạy lại harness UI đầy đủ, gồm xuất MP4 FFmpeg thật.

## 0.10.0 — nhánh độc lập và hàng đợi tab

- `node --test tests/*.test.mjs`: 25 ca. Thêm mutex FIFO theo tab, hủy waiter không cho người sau vượt chủ sở hữu đang chạy; tab khác độc lập; hủy chờ không hủy promise producer.
- `node tests/parallel-smoke.cjs`: Chromium + chrome.* và AI giả lập. Hai tab có hai yêu cầu đang chờ đồng thời; tiến độ/Gửi ngay đúng request; dừng một nhánh vẫn giữ nhánh khác. Gemini và Muse cùng tab chỉ gửi từng lượt; hủy waiter không kẹt hàng đợi. Bridge còn busy sau hủy thì đợi trước khi gửi tiếp. Hai nhánh dùng chung producer chỉ gọi producer một lần; hủy nhánh đợi chưa có request không phát lệnh Muse stop-all. Dừng tất cả dừng cả hai nhánh.
- Harness UI cũ vẫn xác minh chọn chat, gửi, khôi phục kết quả, lưu, tạo ảnh hàng loạt, video đầu ra và xuất FFmpeg WASM thật. Harness tám công cụ giữ khóa, vai trò, duyệt/hủy, chia cảnh, biến thể, lưu theo bộ và FFprobe trên tệp thật.

Không có phiên Muse/Gemini/ChatGPT đăng nhập thật, nên chưa xác minh khả năng chạy đồng thời của dịch vụ hoặc hành vi focus/streaming trên giao diện thật. Nút Run workflow vẫn tuần tự theo danh sách; tính năng mới cho phép chủ động chạy thêm nhánh bằng nút Chạy của node.

## 0.26.0 — tích hợp Batch Manager, đợt 1

- 58 kiểm tra unit đạt, gồm snapshot @tag, bộ điều phối theo giới hạn toàn cục và từng tab, tránh một tab bận chiếm hết slot của AI khác, dừng trong giai đoạn chuẩn bị, mất lưu trữ không gửi yêu cầu, phục hồi không tự gửi lại và kết quả riêng cho từng tác vụ.
- Chromium: batch-manager-smoke đạt với ảnh hợp lệ/hỏng, gợi ý @tag, đổi/xóa tag sau khi xếp hàng, tham chiếu ảnh thật, ảnh đầu ra, MP4 thật được tạo bằng ffmpeg, xem trực tiếp, lưu lại qua reload, dán tự xếp hàng/hoàn tác, lọc/tìm/dọn và khóa điều phối giữa hai trang.
- Flow Studio smoke đạt sau khi chuyển sang cùng hàng đợi và đặt giới hạn song song bằng giao diện; kiểm tra hai AI độc lập, khoảng cách gửi 5 giây, lỗi riêng từng thẻ, dừng cả thẻ đang chạy và thẻ đang chờ, thứ tự và ảnh được lưu.
- Compact generator và Muse job integration smoke đạt; không mất tính năng thu gọn node, khôi phục kết quả và nhập video thủ công.
- API/phiên đăng nhập AI được mô phỏng trong smoke. Chưa kiểm thử trên tài khoản Muse thật; chưa triển khai Account Pool cách ly hoặc backend PDF.

## 0.27.0 — ảnh tham chiếu kịch bản theo mã @

- 59 unit tests đạt, gồm phân tích mã số/tên, phân biệt @1 và @12, loại email và tách danh mục chung khỏi yêu cầu riêng của cảnh.
- Story references smoke đạt trong Chromium: tự sinh ba ô @1/@2/@3 trước và sau khi tạo cấu trúc, gợi ý khi nhập @, nhập ảnh sai thứ tự theo tên mã, bỏ tệp hỏng, chặn ảnh còn thiếu trước khi gửi AI, kiểm tra chính xác byte ảnh theo từng cảnh, sửa mã cập nhật dây, giữ cảnh không liên quan, lưu ảnh qua reload và nguồn ảnh riêng cho bản dựng mới.
- Story dashboard, hierarchical story và canvas groups/frames smoke đạt: giữ bước duyệt ảnh, ghép MP4/âm thanh đúng thứ tự, dựng lại chọn lọc và thao tác nhóm node.
- AI được mô phỏng; chưa xác minh chất lượng đồng nhất nhân vật trên tài khoản AI thật.

## 0.27.1 — chọn và xóa nhiều mục hàng đợi

- 61 unit tests đạt, gồm xóa đúng các ID đã chọn, không gửi prompt đã xóa, chặn cả đợt xóa nếu chứa tác vụ đang chạy và khôi phục danh sách khi lưu thất bại.
- Batch Manager Chromium smoke đạt: tích ô không mở chi tiết, chọn qua hai trang, giữ lựa chọn khi tìm kiếm, chọn trang/kết quả lọc/bỏ chọn, xóa đúng mục và khóa ô chọn khi AI đang xử lý. Các kiểm tra ảnh tham chiếu, video MP4, lưu lại và quyền quản lý hàng đợi cũng đạt. API AI được mô phỏng.

## 0.28.0 — hàng đợi gọn và nhận diện video Muse

- Unit suite (`node --test tests/*.test.mjs`) đạt: cú pháp khối nhiều dòng/lồng dấu ngoặc, mẫu, từ chối khối thiếu dấu đóng, chuẩn bị node trước khi chạy, rollback chuẩn bị lỗi, hoàn tác/dọn nhóm, giữ hàng đợi khi cleanup lỗi và giới hạn thời lượng.
- Batch Manager và Flow Studio Chromium smoke đạt: giao diện thu gọn, nhập khối, node có ngay trước Run, dọn nhóm hoàn thành, snapshot tham chiếu, chọn nhiều mục, MP4 thật, một tác vụ/tab và khoảng gửi 5 giây.
- Muse bridge, Muse support và Muse job integration Chromium smoke đạt: phản hồi không có assistant class, display:contents, video nạp khi Play; bỏ video lịch sử/body không liên quan; prompt chỉ gửi một lần, nhận video và trích khung cuối dù rơi ACK/poll.
- Chẩn đoán video không chứa URL riêng tư, token hoặc prompt. Báo cáo phiên bản bridge để nhận biết tab chưa tải lại.
- Dịch vụ AI được mô phỏng. Chưa kiểm tra HTML/tài khoản Muse thật của người dùng; không kết luận chỉ từ `selectedSend:null` rằng thao tác gửi bị lỗi.
