# Workflow · MuseFlow 0.7.2

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
- Với node **Tạo văn bản** dùng Gemini/ChatGPT tab: bấm chạy để đưa tệp và prompt vào chat. Tự gửi sau ít nhất 2 phút kể từ khi bridge bắt đầu xử lý, đồng thời phải hoàn tất tải tệp. Bấm **Gửi ngay** trên node để yêu cầu gửi sớm; vẫn đợi upload. Bấm Gửi trên trang AI cũng được nhận diện để tránh gửi hai lần. Bấm Dừng hủy lượt đang chờ. API và tạo ảnh/video giữ cách gửi trực tiếp.
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
