# Workflow · MuseFlow 0.27.0

Extension Chrome/Edge dựa trên [MuseFlow / 26Flow](https://github.com/bynne2602/museflow), mở rộng canvas/timeline để làm việc với Muse.ai, Gemini, ChatGPT và API Google, OpenAI, fal.ai. Giữ nguyên giấy phép GPL-2.0-or-later của nguồn gốc và thông báo FFmpeg đi kèm.

[Tải gói extension](downloads/Workflow-extension.zip) · [Đối chiếu 17 yêu cầu](docs/PROGRESS.md)

## Cài đặt đúng thư mục

1. Tải ZIP repository này bằng **Code → Download ZIP**, rồi giải nén.
2. Mở `chrome://extensions` hoặc `edge://extensions`, bật **Developer mode**.
3. Chọn **Load unpacked**, chọn **thư mục gốc `workflow-main` có `manifest.json` và `app.html`**. Không chọn thư mục con `extension`: thư mục đó chỉ chứa bộ cập nhật dữ liệu cũ.
4. Bấm biểu tượng extension để mở canvas trong tab mới.
5. Mở Gemini, ChatGPT hoặc Muse.ai, đăng nhập và mở trang chat. Tải lại tab AI nếu vừa cài/cập nhật extension.
6. Vào **Kết nối AI → Kiểm tra kết nối**. Xanh: tìm thấy ô chat sẵn sàng; đỏ: kiểm tra thất bại/cần đăng nhập; xám: chưa mở tab hoặc chưa nhập khóa. Khóa API đã nhập nhưng chưa gọi thật được hiển thị vàng, không coi là xác thực thành công.

Bấm **Cập nhật extension** để tải gói ZIP mới nhất từ repo. Chrome sẽ hỏi quyền tải xuống khi cần. Nút không tự thay mã đang cài.

Khi thay mã: giải nén bản mới vào thư mục cài đặt, bấm **Reload** trong trang quản lý extension, rồi tải lại canvas và các tab AI. Nút **Cập nhật dữ liệu** chỉ tải dữ liệu; trình duyệt không cho nó tự thay mã thực thi của extension.

## Tạo ảnh hàng loạt

Bấm **＋ Tạo ảnh hàng loạt** trên thanh công cụ. Nhập một prompt mỗi dòng; nếu prompt có nhiều dòng, phân cách các prompt bằng một dòng trống. Chọn AI, tỷ lệ và số ảnh mỗi prompt (1–10); mỗi đợt tối đa 50 ảnh. Có thể thêm loại trừ chung và tối đa 8 ảnh tham chiếu, tổng dung lượng không quá 20 MB.

**Tạo node ảnh** chỉ tạo đồ thị. **Tạo node và chọn chạy** mở danh sách chạy với riêng các node của đợt mới được chọn; xác nhận để chạy tuần tự. Các ảnh tham chiếu được dùng chung cho các node trong đợt, không gắn vào các node cũ. OpenAI adapter tạo ảnh hiện không nhận ảnh tham chiếu; chọn Gemini/Muse/ChatGPT nếu cần chức năng đó.

Trong **Kịch bản → Node**, chọn **Chỉ ảnh** để lấy prompt ảnh từng cảnh mà không tạo video hoặc thay timeline cũ. Có bộ chọn AI riêng cho các node ảnh; AI viết kịch bản và AI tạo ảnh có thể khác nhau.

## Quy trình sử dụng

### Tạo văn bản và phân tích video gốc

- Thêm **Yêu cầu**, **Tạo văn bản**, và **Video đầu vào** hoặc **Ảnh đầu vào**.
- Nối Yêu cầu vào cổng Yêu cầu; có thể nối một node Yêu cầu khác vào cổng Quy tắc.
- Nối ảnh vào cổng Ảnh, video vào cổng Video gốc. Video được gửi nguyên tệp, không chụp ba khung hình thay thế.
- Chọn Gemini tab hoặc Google API để phân tích video. ChatGPT tab và OpenAI adapter trong bản này hỗ trợ văn bản/ảnh, **chưa hỗ trợ video gốc**.
- Bấm **Tạo văn bản**. Nối đầu ra văn bản sang prompt của node tạo ảnh/video, hoặc chọn **Dùng kết quả làm kịch bản** để mở trình tạo node cảnh.
- Cửa sổ **Kịch bản → Node** cũng có chức năng viết kịch bản trực tiếp bằng AI theo mẫu chuẩn. Trạng thái gửi/nhận và lỗi hiển thị ngay cạnh nút gọi AI. Bộ kết nối kiểm tra các tab để chọn ô chat sẵn sàng; khi gửi sẽ chuyển sang tab AI để trình soạn thảo nhận thao tác nhập.

### Tạo ảnh/video

Mỗi node có bộ chọn AI riêng. Danh sách chỉ hiển thị AI hỗ trợ loại đầu ra tương ứng. Node dùng Muse theo mặc định để giữ tương thích workflow gốc; Tạo văn bản mặc định Gemini.

| Kết nối | Văn bản | Ảnh | Video | Đầu vào tham chiếu |
|---|---|---|---|---|
| Muse.ai tab | Không | Có | Có | Ảnh |
| Gemini tab | Có | Có, tùy quyền tài khoản | Chưa hỗ trợ | Ảnh/video gốc |
| ChatGPT tab | Có | Có, tùy quyền tài khoản | Chưa hỗ trợ | Ảnh |
| Google API | Có | Có với model tạo ảnh | Veo, cần quyền API | Ảnh/video cho văn bản; ảnh cho ảnh; một ảnh khởi đầu cho Veo |
| OpenAI API | Có | Có | Chưa hỗ trợ | Ảnh cho văn bản; adapter tạo ảnh hiện chưa nhận ảnh tham chiếu |
| fal.ai API | Không | Không | Kling Motion Control | Đúng một ảnh nhân vật + một video chuyển động |

Nút Gửi dạng mũi tên hoặc máy bay giấy cũng được nhận diện trong composer; bỏ qua nút disabled. Với Muse, nếu bạn bấm Gửi thủ công khi Workflow đang chờ nút, bộ kết nối nhận dấu hiệu tin nhắn/kết quả mới và tiếp tục lấy kết quả, không gửi lại. Video được đọc qua thẻ video/source hoặc liên kết tải, không chỉ marker cũ; clip được chuyển về bộ nhớ Workflow nếu tải được.

Các adapter tab sử dụng ô chat hiện có, dọn bản nháp và tệp chưa gửi trước mỗi lần chạy, đợi xác nhận tải lên và nút Gửi sẵn sàng, chỉ gửi một lần. Không gửi khi chưa xác nhận tệp; lỗi cần kiểm tra tab AI. Giao diện của nhà cung cấp có thể thay đổi. Giữ các tab mở và tránh thao tác thủ công trong lúc node chạy. Nội dung bản nháp chưa gửi trong ô chat AI được thay thế khi chạy node.

### Video dài và Motion Control

- Muse có lựa chọn 4, 5, 6, 8, 10, 15, 20, 30, 60 giây; đây là **thời lượng yêu cầu**, không phải cam kết khả năng của Muse. Hiển thị thời lượng thực của video khi đọc được.
- Veo adapter chỉ nhận 4/6/8 giây. Khả năng model còn phụ thuộc tài khoản, độ phân giải và quyền truy cập. Không gửi yêu cầu 60 giây sai khả năng model.
- Để có chuỗi 30–60 giây, tạo nhiều cảnh và ghép trên timeline; không kéo dài giả một clip bằng cách đổi nhãn thời lượng.
- Với Motion Control: chọn **fal.ai** trong node Tạo video, nối một ảnh nhân vật vào Ảnh tham chiếu và một video gốc vào Video chuyển động. Adapter dùng `fal-ai/kling-video/v2.6/standard/motion-control`, hướng nhân vật theo video và giữ âm thanh gốc. Thời lượng phụ thuộc video nguồn và giới hạn dịch vụ. Cần khóa có quyền model và số dư; chưa kiểm thử dịch vụ thật trong môi trường này.

### API key

Nhập khóa trong **Kết nối AI**; khóa chỉ lưu ở `chrome.storage.session`, không nằm trong workflow, không commit lên GitHub. Đóng trình duyệt hoặc tải lại extension có thể cần nhập lại. Khóa chỉ gửi trực tiếp đến endpoint nhà cung cấp tương ứng. API phát sinh phí theo tài khoản; quyền model và hạn mức do nhà cung cấp quyết định. Không cần API key khi dùng các tab AI.

Google mặc định dùng `gemini-2.5-flash`, `gemini-2.5-flash-image`, `veo-3.0-generate-001`; OpenAI dùng `gpt-4.1-mini`, `gpt-image-1`. Có thể nhập model phù hợp trong từng node API. Google inline media giới hạn 20 MB mỗi tệp trong adapter; tab AI giới hạn 100 MB mỗi tệp. Không có File API/chunk upload cho video lớn trong bản này.

### Lưu, nhập, xuất và cập nhật

Canvas tự lưu cùng media cục bộ trong IndexedDB. Có thể xuất/nhập JSON để sao lưu workflow. Chạy lại xóa kết quả cũ của node trước khi tạo, không nối kết quả cũ vào prompt mới. Tệp tham chiếu được chuyển thành dữ liệu có thể truyền giữa các tab để tránh lỗi URL `blob:` khác nguồn.

**Cập nhật dữ liệu** mở bộ cập nhật GitHub, tải danh sách `data/index.json` và các tệp trong đó từ cùng commit, rồi thay thế bản dữ liệu nguyên tử trong `chrome.storage.local.snapshot`. Dữ liệu này độc lập với canvas; nút không tải mã từ xa để chạy. Chi tiết tại [DATA-UPDATER.md](docs/DATA-UPDATER.md).

## Kiểm thử và giới hạn đã biết

ChatGPT: bộ kết nối hỗ trợ textarea và contenteditable/textbox (kể cả nhãn Hỏi ChatGPT), bỏ qua editor ẩn/readonly và đợi ô nhập dựng xong. Khi chạy node, tab AI được mở trước khi kiểm tra composer. Nếu trang đã đăng nhập mà báo không tìm thấy ô nhập, đó là vấn đề nhận diện giao diện, không phải bằng chứng tài khoản mất đăng nhập.

Không cần npm/build để cài extension. Tạo lại gói cài bằng `python tools/package.py`. Kiểm thử tự động:

```sh
node --test tests/*.test.mjs
# Cần Playwright, Chromium, ffmpeg và ffprobe cho các harness trình duyệt:
node tests/browser-smoke.cjs
node tests/bridge-smoke.cjs
node tests/muse-smoke.cjs
```

Harness chạy DOM Chromium thật với `chrome.*` và dịch vụ AI giả lập. Kiểm tra luồng node, lưu/nhập workflow, dữ liệu video gốc, dọn tệp, chờ upload, gửi đúng một lần và hủy. **Không thay thế kiểm thử trên tài khoản AI thật.** Môi trường phát triển chặn cài extension qua tự động hóa; chưa xác minh Load unpacked tự động, API tạo nội dung trả phí, chat AI đăng nhập và Motion Control đầu cuối. Đã chạy xuất MP4 thật bằng FFmpeg WASM trong Chromium: ghép hai clip khác kích thước, đầu ra H.264 + AAC khoảng 2 giây. Chưa xác minh trên Chrome/Edge cài extension thật hoặc timeline dài. Xem [báo cáo kiểm thử lại](docs/TEST-REPORT.md).

Đối chiếu cả 17 yêu cầu và bước kiểm tra thực tế: [PROGRESS.md](docs/PROGRESS.md).

### 0.8.0 — chọn chat, chuẩn bị trước khi gửi và ID ảnh

- Mở sẵn cuộc trò chuyện cần dùng trong tab AI. Trong node hoặc Cài đặt → Kết nối AI, chọn **Cuộc trò chuyện AI**. Bấm làm mới nếu vừa mở tab. Khi tab đã chọn đóng hoặc chuyển sang chat khác, chọn lại; Workflow không tự tìm chat thay thế.
- Với node **Tạo văn bản** dùng Gemini/ChatGPT tab: bấm chạy để đưa tệp và prompt vào chat. Mặc định tự gửi ngay khi tải tệp xong. Có thể chọn **Chờ 2 phút trước khi gửi** nếu muốn kiểm tra prompt trước. Bấm **Gửi ngay** trên node để yêu cầu gửi sớm; vẫn đợi upload. Bấm Gửi trên trang AI cũng được nhận diện để tránh gửi hai lần. Bấm Dừng hủy lượt đang chờ. API và tạo ảnh/video giữ cách gửi trực tiếp.
- ChatGPT chỉ nhận video gốc nếu ô tải tệp trên trang cho phép loại tệp đó; tải được tệp không chứng minh model có khả năng phân tích video. Dùng Gemini nếu ChatGPT không nhận video.
- Mỗi node có **ID** riêng, bấm để sao chép. ID được lưu cùng workflow, node sao chép được cấp ID khác. Node nhận ảnh liệt kê thứ tự ảnh và ID nguồn; prompt gửi AI có bảng đối chiếu cùng thứ tự tệp. Ví dụ: `Lấy nhân vật từ [IMG-…], đặt vào bối cảnh [IMG-…], giữ nguyên khuôn mặt.` Khung cuối video có hậu tố `-END`. Đây là chỉ dẫn cho model, không bảo đảm model luôn làm đúng.
- Nếu Muse vẫn không bấm Gửi: dừng workflow, vào Cài đặt → **Chọn nút Gửi trên Muse**, rồi bấm đúng mũi tên Gửi tại tab Muse. Lần chọn đó chỉ lưu nút, không gửi bản nháp. Chạy lại node. **Chẩn đoán Muse** tạo báo cáo cấu trúc nút, không đọc nội dung prompt/phản hồi hay URL ảnh.

Sau khi tải và giải nén gói mới, ở `chrome://extensions` hoặc `edge://extensions`, bấm tải lại extension và tải lại các tab AI đang mở. Kiểm thử môi trường hiện tại dùng DOM AI giả lập; chưa xác minh trên phiên AI đăng nhập thật.

### 0.8.1 — sửa nhận diện gửi và thẻ video

- ID nằm cùng hàng với tên node, chữ nhỏ, vẫn bấm sao chép được.
- Muse không báo nhận yêu cầu khi prompt còn trong ô nhập. Lịch sử chat tải thêm không còn làm bỏ qua bước gửi; bổ sung nhận diện SVG mũi tên hướng lên và gửi bằng Enter một lần nếu nút không nhận diện được, không có điều khiển đang bị vô hiệu hóa và không còn upload. Nếu chưa xác nhận được gửi, báo lỗi thay vì tự gửi lại.
- ChatGPT nhận diện cả thẻ tệp/video chỉ hiển thị tên rút gọn, không có class attachment. Chỉ xác nhận tệp từ thẻ trong composer, không dùng FileList làm bằng chứng upload. Giữ chờ upload, 2 phút và Gửi ngay như trước.
- Sau cập nhật, tải lại extension, Workflow và các tab AI. Các lỗi được kiểm thử hồi quy bằng DOM mô phỏng; vẫn cần xác minh trên phiên AI thật.

### 0.8.2 — nhận kết quả ChatGPT dạng “Viết”

Sửa bước xác nhận gửi khi ChatGPT ẩn/thay ô nhập hoặc giữ draft nhưng đã có tin nhắn người dùng khớp prompt. Bổ sung phản hồi dạng turn assistant và writing block, đọc phần nội dung thay vì nút Copy/tiêu đề, không nhầm phần văn bản đang chỉnh sửa thành ô chat. Chờ xác nhận tối đa 90 giây thay cho 15 giây; không tự gửi lại, đợi kết thúc streaming rồi chuyển kết quả về node. Tải lại extension, Workflow và tab ChatGPT sau cập nhật.

### 0.8.3 — lấy kết quả khi tự nhận diện bị kẹt

Bổ sung nhận diện turn hội thoại qua nút sao chép của ChatGPT khi thiếu marker assistant/writing. Vì chưa có DOM từ phiên thật của người dùng, không khẳng định đã khớp mọi giao diện.

Node **Tạo văn bản** qua Gemini/ChatGPT có nút **Chọn kết quả trên tab AI**, dùng được cả khi đang chờ và khi đã báo lỗi:

1. Bấm nút này trên node. Workflow mở đúng tab đã chọn.
2. Bấm vào câu trả lời cần lấy (hoặc bôi đen đoạn muốn lấy rồi bấm trong câu trả lời).
3. Kiểm tra/sửa nội dung trong khung xem trước, bấm **Đưa về Workflow**.

Thao tác này không gửi prompt mới, không bấm Copy hoặc nút trong câu trả lời. Khi lượt đang chờ còn kết nối, kết quả hoàn tất chính lượt đó để chuỗi node có thể tiếp tục. Nếu lượt đã kết thúc, nội dung được nhập vào node và lưu. Hủy hoặc hết 5 phút không nhập nội dung. Sau cập nhật cần tải lại extension, Workflow và các tab AI.

### 0.9.0 — tám node sản xuất

Thêm Khóa nhân vật, Gán vai trò ảnh, Phân tích video, Chia cảnh tự động, Duyệt trước khi chạy, Kiểm tra kết quả, Biến thể prompt và Lưu theo bộ trong menu Thêm node. Hướng dẫn nối cổng, mẫu kịch bản và giới hạn: [docs/PRODUCTION-TOOLS.md](docs/PRODUCTION-TOOLS.md).

Kiểm thử khóa/lưu/tải lại, vai trò, chặn gửi trước duyệt, hủy duyệt, chia cảnh, chọn biến thể, video gốc và tải theo bộ qua Chromium; kiểm tra FFprobe trên video thật có audio. Các phản hồi AI vẫn giả lập; chưa xác minh chất lượng AI trên tài khoản đăng nhập thật.

### 0.9.1 — prompt ảnh ngắn gọn

Giữ nguyên yêu cầu, chỉ thêm `Tạo 1 ảnh, tỷ lệ ….` và negative prompt nếu có. Một ảnh tham chiếu thông thường không thêm bảng ID hoặc đoạn hướng dẫn dài. Nhiều ảnh, ID được nhắc rõ, vai trò và khóa nhân vật vẫn có đối chiếu ngắn theo thứ tự tệp. Prompt video giữ luồng hiện có.

### 0.9.2 — đổi chat trong cùng tab

Sửa trường hợp tên tab mới nhưng địa chỉ chat vẫn cũ: trên node, bấm **Làm mới danh sách chat** để chấp nhận cuộc trò chuyện hiện tại của đúng tab đã chọn, rồi chạy lại. Chọn tab từ danh sách sẽ đọc địa chỉ mới trực tiếp thay vì dùng bản lưu. Tab đóng không tự chuyển sang tab khác; đổi chat giữa lượt đang chạy vẫn bị chặn. Đang cập nhật lựa chọn thì chưa gửi yêu cầu.

Bản 0.9.2 cũng bỏ nút Buy me a coffee, hộp VietQR và các liên kết/ảnh ủng hộ khỏi ứng dụng.

### 0.10.0 — chạy thêm nhánh AI độc lập

Khi một node đang chạy, có thể bấm **Chạy** trên node khác. Tab AI khác nhau chạy đồng thời; yêu cầu dùng cùng một tab được xếp FIFO, không ghi đè prompt. Node dùng đầu ra chưa có sẽ đợi node đầu vào, không gọi lại producer đang chạy. **Dừng** trên node dừng nhánh của nó; nút trên cùng **Dừng tất cả** hủy mọi nhánh đang chạy/chờ. Tiến độ, Gửi ngay và chọn kết quả được gắn đúng request/node.

Nút Run workflow giữ thứ tự chạy đã chọn; để chạy thêm một nhánh trong lúc đó, bấm Chạy trên node độc lập. Đổi chat khi đang chờ vẫn bị chặn; có thể làm mới tab của node chưa chạy trong khi nhánh khác hoạt động. AI phía dịch vụ vẫn có giới hạn riêng; chưa kiểm chứng các phiên đăng nhập thật chạy đồng thời.


### 0.11.0 — Run All tự động và thanh trạng thái AI

**Run All** chạy ngay, tự gửi yêu cầu sau khi tải xong tệp, nhận văn bản và chuyển sang node kế tiếp. Các nhánh đủ đầu vào ở tab khác chạy song song; cùng tab xếp hàng. Mỗi node xử lý một lần trong lượt, dùng kết quả mới thay vì đầu ra cũ. Nhánh lỗi chặn các node phụ thuộc; các nhánh độc lập vẫn tiếp tục. **Dừng tất cả** hủy cả tác vụ đang chạy và đang chờ. **Chọn node** vẫn cho chọn một nhóm và thứ tự chạy riêng. Node Duyệt trước khi chạy vẫn yêu cầu duyệt theo thiết kế.

Tạo văn bản mặc định **Tự gửi khi sẵn sàng**, thay cho chờ 2 phút ở các bản trước. Chế độ chờ 2 phút và **Gửi ngay** vẫn chọn được. Bridge thêm dấu mốc riêng cho từng phản hồi văn bản rồi bỏ dấu mốc khi đưa về node; vẫn nhận diện các phản hồi không có dấu mốc qua cấu trúc trang AI. **Chọn kết quả trên tab AI** chỉ là phương án dự phòng trong **Khôi phục thủ công**, không cần bấm trong luồng bình thường.

Thanh trên cùng hiển thị Muse / Gemini / GPT và API được dùng: **xanh = kết nối, rảnh; vàng = đang làm; xám = lỗi; tím = cần kiểm tra**. Di chuột xem chi tiết; bấm tên AI hoặc ↻ để kiểm tra lại. Tự kiểm tra tab mỗi 15 giây khi rảnh; API chỉ xác minh bằng tác vụ thật, không tự gọi tính phí để thử kết nối.

Kiểm thử Chromium với phản hồi giả lập: tải video xong mới gửi, tự nhận văn bản khi cấu trúc phản hồi thay đổi, không lấy prompt/đoạn đang viết làm kết quả; Run All nhiều nhánh, đợi đầu vào, FIFO, lỗi nhánh, Dừng tất cả và màu trạng thái. Chưa xác minh trên phiên AI đăng nhập thật. Sau cập nhật cần Reload extension rồi tải lại Workflow và các tab AI để thay bridge cũ.


### 0.12.0 — xuất từng clip, ghép tất cả và ảnh thành video

Ở dòng thời gian, **Thêm ảnh/video** chọn đầu ra Tạo ảnh, Tạo video, Ảnh đầu vào, Video đầu vào hoặc Đổi kích thước ảnh. Có thể kéo cổng đầu ra ảnh/video xuống dòng thời gian. Đặt thời lượng mỗi cảnh (1–60 giây), kéo các cảnh để đổi thứ tự.

- **Xuất từng clip**: tải mỗi cảnh thành một video riêng, theo thứ tự và thời lượng đã đặt, dùng MP4 hoặc WebM đang chọn. Tên tệp có số thứ tự và ID/tên node.
- **Xuất tất cả**: ghép mọi cảnh trên dòng thời gian thành một video duy nhất, đúng thứ tự kéo thả. Mọi cảnh phải có tệp trước khi xuất; không tự bỏ qua cảnh chưa có kết quả.
- Hai ảnh cũng ghép được thành một video: ảnh lần lượt xuất hiện theo thời lượng đặt, ví dụ 3 giây + 4 giây = video 7 giây. Có thể trộn ảnh với video. Ảnh được giữ tĩnh; âm thanh của đoạn video được giữ, đoạn ảnh có tiếng im lặng. Đây là ghép cảnh trực tiếp trong trình duyệt, không gọi AI tạo chuyển động.
- **Dừng** hủy xuất hiện tại và các clip còn lại trong đợt xuất riêng. Trình duyệt có thể yêu cầu cho phép tải nhiều tệp khi xuất riêng.

MP4 dùng FFmpeg cục bộ; WebM ảnh/cảnh hỗn hợp và xuất riêng cũng dùng FFmpeg. Kiểm thử Chromium + FFmpeg WASM thật, dùng FFprobe kiểm tra codec, âm thanh và tổng thời lượng, lấy khung hình để xác minh thứ tự ảnh, cùng kiểm thử dừng đợt xuất. Sửa menu thêm clip bị che bởi vùng canvas.


### 0.13.0 — kéo thả và dán tệp vào đầu vào

- Kéo tệp ảnh/video từ máy vào node **Ảnh đầu vào / Video đầu vào** để thêm hoặc thay tệp. Bấm vùng nội dung node ảnh rồi **Ctrl+V / Cmd+V** để dán ảnh đã sao chép vào clipboard.
- Thả tệp lên cổng ảnh/video của node tạo: tự tạo node nguồn, gắn ID và nối đúng cổng. Cổng ảnh tham chiếu nhận nhiều ảnh; cổng đơn nhận một tệp mỗi lần. Thả lên thân node tạo sẽ chọn cổng theo loại tệp. Dán ảnh vào vùng node cũng dùng cách này.
- Kéo nhiều tệp vào dòng thời gian để thêm các cảnh; ô ảnh tham chiếu trong Tạo ảnh hàng loạt cũng nhận kéo thả/dán, tối đa 8 ảnh và tổng 20 MB.
- Mỗi tệp không quá 100 MB; sai loại tệp bị từ chối và giữ nguyên dữ liệu cũ. Khi con trỏ ở ô văn bản, dán vẫn theo cách bình thường. Không tự gửi AI sau khi nhập tệp.

Kiểm thử Chromium: kéo/dán, thay tệp, từ chối sai loại, tạo nối nguồn ảnh/video, nhiều ảnh tham chiếu, thêm cảnh và lưu workflow; các sự kiện clipboard/drop dùng tệp giả lập.


### 0.14.0 — bộ node âm thanh, hậu kỳ và mẫu workflow

Thêm Âm thanh đầu vào, Âm thanh/nhạc nền, Phụ đề, Lồng tiếng, Đồng bộ lời đọc–cảnh, Chuyển cảnh, Điều chỉnh tốc độ và Mẫu workflow vào cả menu thêm node và chuột phải. Các node hậu kỳ nối được vào nhau, chạy qua Run All, có nút dừng/tải tệp và đưa kết quả vào dòng thời gian. Chạy một node phía sau dùng lại kết quả hậu kỳ/giọng đọc nguồn đã có; Run All vẫn tạo kết quả mới cho các node của lượt đó.

Hướng dẫn, cách nối và giới hạn: [docs/MEDIA-STUDIO.md](docs/MEDIA-STUDIO.md). Lồng tiếng và nhận diện phụ đề cần OpenAI API có quyền/số dư; âm thanh tải lên và SRT nhập tay không cần API. Các ý tưởng tiếp theo và tình trạng chưa truy cập được Toby Labs: [docs/WORKFLOW-IDEAS.md](docs/WORKFLOW-IDEAS.md).


### 0.15.0 — Tải media và Kho prompt

Thêm hai nút trên thanh menu: **Tải media** nhận link, nhận diện nền tảng và tải tệp; **Kho prompt** lưu tên/nội dung, tìm kiếm, sao chép, sửa/xóa, lấy từ node đang chọn và tạo node Prompt. Kho lưu riêng trên trình duyệt, không bị Reset canvas xóa.

Link tệp trực tiếp tải ngay. Link bài đăng mạng xã hội cần bật bộ tải Python/yt-dlp cục bộ được đóng gói trong `tools/media-helper`; hướng dẫn ở ngay hộp thoại. Không tự đăng nhập/lấy cookie. Nền tảng có thể từ chối truy cập, nên không bảo đảm mọi link tải được. [Hướng dẫn và phạm vi kiểm thử](docs/MEDIA-LIBRARY.md).


### 0.15.1 — nút Sắp xếp node

Bấm **⇄ Sắp xếp node** trên thanh công cụ để xếp từ trái sang phải theo kết nối, tính cả phụ thuộc khung cuối cảnh trước. Khoảng cách dựa trên kích thước node thực để giảm chồng lấn; khung nhóm đi theo các node trong nhóm. Tự căn khung nhìn và lưu bố cục. **Ctrl+Z** hoàn tác.

### 0.16.0 — kịch bản tổng, dựng từng hồi/chương

Thêm cấu trúc hồi/chương → phần → đoạn → cảnh; tạo ảnh nhân vật/bối cảnh rồi tạo video chuyển động từ ảnh. Chạy và tải MP4 từng cấp, dùng lại cảnh đã có, chỉ dựng lại nhánh bị chỉnh. Xem [hướng dẫn và giới hạn video dài](docs/MASTER-STORY.md).

### 0.16.1 — khoảng chờ 5 giây, giữ video lệch tỷ lệ, xóa prompt

- Các lần gửi yêu cầu tạo văn bản/ảnh/video cách nhau tối thiểu 5 giây; cùng tab còn đợi ít nhất 5 giây sau khi lượt trước trả về. Có thể dừng trong lúc đợi; các tab khác vẫn xử lý đồng thời sau khi được gửi.
- Video AI trả tỷ lệ khác yêu cầu được tự đặt vào khung đã chọn bằng viền đệm, không cắt/méo hình. Ví dụ Muse trả 480×480 khi chọn 9:16: Workflow tạo MP4 480×854, giữ âm thanh và thời lượng, báo rõ đã thêm viền. Đây là đổi khung cục bộ, không làm AI tạo thêm nội dung dọc hoặc nâng chi tiết nguồn. FFmpeg có giới hạn tệp 100 MB và bộ nhớ trình duyệt. Ảnh lệch tỷ lệ được giữ lại kèm thông báo.
- **Xóa prompt canvas** xóa nội dung các node Prompt, Negative Prompt, Yêu cầu cảnh và Text Append; giữ node, dây nối, media, kịch bản tổng, kết quả văn bản AI và Kho prompt. Dừng chạy trước khi xóa; Ctrl+Z để hoàn tác. Các kết quả dựng phụ thuộc bị đánh dấu cần cập nhật.

Kiểm thử: hàng đợi/cooldown và hủy tác vụ; Run All thực tế đo thời gian gửi; xóa/hoàn tác không mất Kho prompt; Muse DOM mô phỏng; video vuông được chuyển 9:16 bằng FFmpeg WASM thật, kiểm tra hình/viền/âm thanh/thời lượng. Phản hồi AI được mô phỏng, chưa xác nhận tài khoản Muse thật.

### 0.17.0 — thanh công cụ biểu tượng gọn

Gom thao tác vào sáu nút có tooltip: Tạo node, Kho tài nguyên, Workflow, Kết nối AI, Cập nhật, Dọn canvas. Chỉ mở tùy chọn khi bấm; bấm lại, bấm ra ngoài hoặc Esc để đóng. Mỗi lần chỉ mở một nhóm. Run All/Dừng tất cả luôn hiện. Các nút chức năng và dữ liệu hiện có được giữ nguyên; Sắp xếp node và Lưu nằm trong nhóm Workflow, Xóa prompt nằm trong Dọn canvas. Hỗ trợ bàn phím và màn hình nhỏ; thanh công cụ giữ một hàng.

Kiểm thử Chromium: menu đóng/mở, phím điều hướng, lưu/tạo node/mở thư viện/cài đặt, menu thêm node và bố cục ở 320, 390, 620, 900, 1500 px.

### 0.18.0 — Output: ghép cảnh, chèn MP3 và tự xuất

Thêm node **Output · Xuất video cuối** vào menu thêm node và menu kéo từ cổng video/âm thanh. Nối nhiều video, nhận thứ tự timeline hoặc số cảnh/tên, chỉnh bằng ↑ ↓; nhận MP3 từ Âm thanh đầu vào hoặc chọn/thả tệp trực tiếp. Run All chạy Output sau các video nguồn, ghép MP4, thay/trộn âm thanh và tự tải kết quả khi hoàn tất. Sửa nguồn/thứ tự sẽ khóa tải bản cũ cho đến khi xuất lại. [Hướng dẫn](docs/FINAL-OUTPUT.md).

### 0.19.0 — nhập và xuất Kho prompt

Mở **Kho tài nguyên → Kho prompt** để dùng **Nhập kho prompt** và **Xuất kho prompt**. Xuất toàn bộ kho ra JSON (kể cả khi đang tìm kiếm), giữ nguyên dấu tiếng Việt và xuống dòng. Nhập JSON gộp với kho hiện tại, giữ mục cũ, bỏ qua mục trùng cả tên lẫn nội dung; cùng tên nhưng khác nội dung được giữ riêng. Tệp lỗi hoặc vượt tổng 500 prompt không làm thay đổi kho.

Định dạng xuất: `{ "format": "workflow-prompt-library", "version": 1, "prompts": [{ "name": "Tên", "content": "Câu lệnh" }] }` (có thêm ngày xuất). Cũng nhận mảng `{name,content}` trực tiếp. Tệp nhập tối đa 64 MB; mỗi tên tối đa 100 ký tự và nội dung tối đa 20.000 ký tự. Chỉ xuất dữ liệu Kho prompt; không kèm workflow, media hay khóa API.

### 0.20.0 — Tạo hàng loạt bằng thẻ Flow Studio

Trong nhóm **Tạo node**, bấm **Tạo hàng loạt** để mở Flow Studio. Thẻ tổng nhận mỗi prompt trên một dòng; bấm Tạo thẻ từ prompt để tạo các thẻ riêng. Từng thẻ có ảnh tham chiếu, prompt, AI, tỷ lệ, chế độ ảnh/video và nút tạo/dừng riêng. Kéo tay nắm ⠿ để đổi bố cục; Tạo tất cả gửi các thẻ độc lập qua hàng đợi theo tab và khoảng cách gửi 5 giây hiện có. Một thẻ lỗi không chặn các thẻ khác. [Hướng dẫn](docs/FLOW-STUDIO.md).

### 0.21.0 — đếm node theo cửa sổ AI

Danh sách chọn chat hiển thị **3 node chọn · Cửa sổ 1 · Tab 2 — Tên chat**, áp dụng Gemini, ChatGPT và Muse. Tính các node tạo ảnh/video/văn bản và Kịch bản tổng, gồm cả thẻ Flow Studio; node không chọn riêng được tính theo tab mặc định (hoặc tab duy nhất). Mỗi node chỉ tính một lần. Số node đang chạy/chờ hiện riêng; khóa đổi cửa sổ của node đang chạy.

Flow Studio có bộ chọn cửa sổ ngay trong từng thẻ và nút làm mới để nhận các tab vừa mở. Số lượng cập nhật khi đổi AI/chat, thêm/xóa node hoặc đổi tab mặc định. Các cửa sổ được đánh số theo danh sách cửa sổ có tab AI; Tab là vị trí trong cửa sổ Chrome. Đây là số node được gán, không phải số lần gọi AI hay mức tải bên trong tài khoản Gemini.

### 0.22.0 — nối nhanh nhiều node

Kéo chọn các node nguồn trên vùng trống của canvas, giữ **Shift** rồi bấm **cổng đầu vào** của node đích. Ví dụ: nhiều ảnh → Tham chiếu, nhiều prompt → Prompt, nhiều video → Các video của Output. Giữ nguyên cách Shift-click node để chọn thêm từng node.

Chỉ nối nguồn tương thích, không thêm dây trùng hoặc tạo vòng lặp. Nguồn có nhiều đầu ra phù hợp cần nối thủ công để chọn đúng đầu ra. Cổng chỉ nhận một nguồn không nhận cả nhóm và không bị thay dây cũ. Dừng node đích đang chạy trước khi nối. Cả lượt nối có thể hoàn tác bằng **Ctrl+Z**; nối dây không tự chạy AI.

### 0.22.1 — kiểm tra ảnh và lỗi tải tệp qua tab AI

ChatGPT, Gemini và Muse kiểm tra ảnh có giải mã được trước khi đính kèm; nhận diện PNG/JPEG/GIF/WebP bằng dữ liệu thực và sửa MIME sai mà giữ nguyên nội dung. Các định dạng khác trình duyệt đọc được được chuyển thành PNG, giữ kích thước và nền trong suốt. Ảnh hỏng, trên 20 MB hoặc trên 40 triệu điểm ảnh bị chặn với thông báo cụ thể. Video không được chuyển thành ảnh.

Kiểm tra thông báo lỗi tải tệp trong vùng nhập chat trong khi chờ tải và trước khi gửi; không coi thẻ lỗi là tải thành công, không tự thử gửi lại. Vẫn cần kiểm tra trên tài khoản thật để xác định lỗi máy chủ, mạng hoặc giới hạn của từng nền tảng. Sau khi cập nhật extension, tải lại các tab AI đang mở để dùng bộ kết nối mới.

### 0.22.2 — khởi tạo các node kịch bản rõ ràng

Nhập nội dung hoặc bấm Điền mẫu hồi/cảnh trong Kịch bản tổng, sau đó bấm Tạo node cho các hồi. Với văn xuôi, chia bằng AI và kiểm tra trước. Các node hồi/phần/đoạn được tự tạo kèm cảnh, ảnh, video và bước ghép; nối dây kịch bản một mình chưa tạo các bước này.

Node cấp dưới chưa khởi tạo hiện lý do và nút Tạo cấu trúc từ kịch bản tổng khi tìm thấy nguồn qua các dây kịch bản. Nút Về kịch bản tổng tìm được cả nguồn nối thủ công. Khi tạo cấu trúc, dùng lại các node trống nối đúng chuỗi, giữ ID và tên đã đặt; không ghi đè node có nội dung hoặc kết quả. Ctrl+Z hoàn tác cả lượt tạo. Dừng tác vụ đang chạy trước khi khởi tạo.

### 0.23.0 — bảng điều khiển và duyệt ảnh kịch bản

Mở **Tạo node → Bảng điều khiển kịch bản**, hoặc nút cùng tên trong Tổng/Hồi/Phần/Đoạn. Chọn phạm vi để xem các ảnh cảnh, số ảnh/video hoàn tất, trạng thái duyệt và lỗi. Dùng Kiểm tra trước khi chạy để phát hiện prompt trống, ảnh tham chiếu chưa chọn, tab đã đóng/đổi, API key thiếu và cấu hình video không hỗ trợ; có nút đi tới node cần sửa. Kiểm tra không gửi yêu cầu tạo AI và không xác nhận hạn mức/đăng nhập thật.

Luồng mới: **Tạo ảnh còn thiếu / đã đổi → Duyệt ảnh từng cảnh hoặc tất cả ảnh hiện tại → Tạo video và ghép**. Tạo lại ảnh hoặc sửa prompt/nguồn ảnh làm mất hiệu lực duyệt của ảnh đó. Duyệt được lưu cùng dự án; tải lại trang không phải duyệt lại ảnh còn nguyên. Có nút đi tới prompt, node ảnh/video, dừng lượt tạo ảnh và tải video phạm vi đã ghép.

Bản dựng mới mặc định bật Duyệt ảnh trước khi tạo video, có thể tắt trong Kịch bản tổng. Các bản dựng cũ chưa có tùy chọn giữ cách chạy tự động trước đây. Các nút Chạy trong canvas cũng kiểm tra đầu vào và chặn video chưa duyệt khi tùy chọn bật. Kiểm thử Chromium dùng AI mô phỏng và FFmpeg/ffprobe thật cho đầu ra MP4/âm thanh/thời lượng.

### 0.24.0 — kết quả mới, khung cuối và nhóm node

- Chạy lại một node tạo xóa kết quả/khung cuối cũ ngay khi lượt chạy được chấp nhận. Dừng hoặc lỗi không để lại kết quả dở dang; phản hồi đến muộn không được nhận. Nút Xóa kết quả cũ trên node và trong menu chuột phải giữ prompt, dây và tệp đầu vào. Bản nháp trong ô AI được làm trống trước khi tải tệp mới; không xóa lịch sử trò chuyện.
- Video có nhãn riêng cho khung cuối của chính nó và khung mở đầu nối từ video trước. Có nút Trích lại khung cuối, Tải ảnh khung cuối và Tách khung cuối thành node ảnh. Nối cổng end frame → reference của video tiếp theo; thiếu khung cuối thì dừng và báo lỗi, không tự gửi yêu cầu thiếu ảnh.
- Kéo chọn nhiều node khi tắt công cụ bàn tay (H); hoặc Shift-click tiêu đề để chọn thêm. Kéo tiêu đề một node đã chọn để di chuyển cả tập. Kéo tên nhóm để di chuyển tất cả node thuộc nhóm.
- **D** hoặc **Workflow → Nhân bản nhóm** tạo nhóm mới với ID và dây nội bộ mới. Không sao chép video, kết quả tạo hay trạng thái duyệt cũ; tệp nguồn được giữ. **⌘C/⌘V** trên macOS (Ctrl+C/V trên Windows/Linux) sao chép/dán nhóm trong canvas; ô nhập văn bản vẫn sao chép/dán bình thường. **Mũi tên** dịch nhóm 10 px; **Shift + mũi tên** dịch 50 px. Không gán ⌘D, ⌘H hoặc tổ hợp Control/Option dùng cho hệ thống. Các thao tác sửa có thể hoàn tác bằng ⌘Z/Ctrl+Z.

Kiểm thử Chromium gồm kéo nhiều node/nhóm, nhân bản và clipboard, xóa kết quả, hủy lượt chạy có phản hồi muộn; trích khung cuối từ MP4 thật. Chưa thử trên thiết bị macOS thật; bộ nối AI dùng phản hồi mô phỏng.

### 0.24.1 — không lấy video trang trí/lịch sử làm kết quả Muse

Bộ nối chỉ nhận media trong vùng trả lời mới, bỏ video ngoài chat, media của tin nhắn cũ tải muộn, placeholder/loading và tài nguyên mascot/avatar. Đợi media ổn định và Muse ngừng trả lời trước khi nhận. Nếu không xác minh được kết quả mới, tiếp tục chờ thay vì chọn một video bất kỳ trên trang.

Khung cuối phải có mã video nguồn trùng với video hiện tại. Khung cũ chưa có thông tin đối chiếu không hiển thị như kết quả hợp lệ; có thể trích lại từ video nguồn. Video nhận nhầm ở bản trước phải xóa kết quả và chạy lại sau khi cập nhật, tải lại tab Muse. Trích lại từ một video vốn đã sai không sửa được nội dung video đó. Kiểm thử trình duyệt dùng video MP4 thật và trang Muse mô phỏng.

### 0.25.0 — node tạo ảnh/video gọn hơn

Phần chính giữ AI, tỷ lệ/thời lượng, trạng thái tối đa hai dòng, xem trước và Chạy/Chạy lại. Bỏ khoảng trống đệm cũ; ảnh/video xem trước tối đa cao 180 px, giữ toàn bộ hình bằng contain. Bốn mục bấm mở: **Kết nối AI** (tab, làm mới, model), **Khung hình/Ảnh tham chiếu** (ID ảnh, khung đầu/cuối và thao tác khung), **Công cụ** (Timeline, xóa kết quả), **Chi tiết** (thông báo đầy đủ và kích thước). Mở/đóng được giữ trong phiên khi node cập nhật tiến độ; không đổi dữ liệu/kết nối hoặc tự gọi AI khi mở mục.

Lỗi tự mở phần Chi tiết; các cảnh báo dài của video thành công vẫn đọc đầy đủ ở đó. Kiểm thử Chromium đo chiều cao node, mở mục và thao tác điều khiển thật, duy trì lựa chọn/tab, xóa kết quả, kéo nhóm và khung cuối.

### 0.25.1 — chờ kết quả Muse bằng mã tác vụ

Tab Muse có bộ nối mới nhận tác vụ và trả mã ngay; Workflow hỏi trạng thái bằng các tin nhắn ngắn. Mất phản hồi khởi tạo/đọc trạng thái sẽ chỉ hỏi lại mã cũ, không gửi lại prompt. Kết quả ở tab Muse được giữ cho tới khi Workflow xác nhận nhận; yêu cầu khởi tạo trùng mã không tạo thêm tác vụ. Dừng node hủy lượt chờ và tác vụ như trước. Đây là nối lại lỗi kênh tạm thời: tải lại/đóng tab Muse hoặc reload extension có thể làm mất mã đang giữ trong bộ nhớ; khi đó báo chưa xác định, không tự chạy lại. Cần tải lại tab Muse sau khi cập nhật để kích hoạt giao thức mới.

Nếu Muse đã tạo xong nhưng node cũ báo lỗi kênh: tải video đó từ Muse, mở **Công cụ → Nhập video kết quả** trên node, chọn tệp MP4/WebM/MOV không quá 100 MB. Hệ thống đọc kích thước/thời lượng và trích khung cuối, lưu vào node mà không gọi AI. Đầu vào không phải video đọc được bị từ chối.

Nhãn thời lượng ghi rõ giây; trang đặt translate=no để tránh trình dịch tự đổi 20s thành những năm 20 hoặc dịch ID/cổng kỹ thuật. Kiểm thử lỗi ACK/kênh đọc bị mất, truy vấn lại không tạo trùng, hủy trước khi gửi, mã tác vụ thực trên DOM mô phỏng và nhập video MP4 thật. Chưa xác nhận trên tài khoản Muse thật.

### 0.25.2 — nhận kết quả trong khung Muse được tái sử dụng

- Cho phép nhận media mới trong khung trả lời đã tồn tại khi có tin nhắn mới chứa đúng prompt đứng trước media; tiếp tục loại URL cũ, lịch sử trước lượt gửi và hình chờ.
- Trả tiến độ qua truy vấn mã tác vụ để khôi phục khi mất thông báo trực tiếp. Trạng thái rút gọn và Chi tiết luôn cập nhật cùng nhau.
- So với 0.24.0: 0.24.1 bổ sung lọc media và nguồn khung cuối; 0.25.0 thu gọn node; 0.25.1 chuyển sang START/STATUS/ACK và cho nhập video đã tạo; 0.25.2 xử lý khung trả lời tái sử dụng.
- Chưa xác minh trên phiên Muse đăng nhập thật. Nhóm tài khoản cách ly, kho ảnh @tag và hàng đợi bền vững theo PDF chưa được triển khai đầy đủ.

### 0.26.0 — Hàng đợi và Kho ảnh theo PDF, đợt 1

- Tạo node → Hàng đợi · Kho ảnh: upload nhiều ảnh, đặt @tag, gợi ý khi gõ, tách prompt theo dòng/đoạn/toàn bộ và chốt ảnh/thiết lập/tab khi xếp hàng.
- Cùng bộ điều phối với Flow Studio; 1–6 tác vụ song song, dải đang chạy, lọc/tìm/phân trang, xem kết quả và tải. Dán tự thêm sau 2 giây có hoàn tác cho đợt chưa chạy.
- Lưu cục bộ, giữ ảnh đã chốt khi tag bị sửa/xóa, chặn điều phối trùng giữa hai cửa sổ. Tác vụ gián đoạn chuyển Cần kiểm tra, không tự gửi lại.
- Chưa có Account Pool cách ly hoặc backend máy chủ. [Hướng dẫn và đối chiếu PDF](docs/BATCH-MANAGER.md).

### 0.27.0 — ảnh tham chiếu phim theo mã @

- Kịch bản tổng → Ảnh tham chiếu của kịch bản tự tạo các ô theo @1/@2/@3 hoặc @ten; hỗ trợ nhập nhiều ảnh theo tên mã, chọn/thả/dán ảnh và đặt nhãn.
- Mỗi cảnh chỉ nối ảnh của mã được nhắc trong cảnh; danh mục đầu phim không kéo toàn bộ nhân vật vào mọi cảnh. Gợi ý khi gõ @, chỉnh mã trong prompt cập nhật dây; thiếu ảnh chặn gửi AI.
- Lưu ảnh cùng workflow, tạo bản dựng mới giữ nguồn riêng, AI chia kịch bản phải giữ mã. Ảnh nối thủ công làm tham chiếu chung vẫn được giữ.
- [Hướng dẫn và ví dụ](docs/MASTER-STORY.md).
