# Workflow · MuseFlow 0.6.1

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

## Quy trình sử dụng

### Tạo văn bản và phân tích video gốc

- Thêm **Yêu cầu**, **Tạo văn bản**, và **Video đầu vào** hoặc **Ảnh đầu vào**.
- Nối Yêu cầu vào cổng Yêu cầu; có thể nối một node Yêu cầu khác vào cổng Quy tắc.
- Nối ảnh vào cổng Ảnh, video vào cổng Video gốc. Video được gửi nguyên tệp, không chụp ba khung hình thay thế.
- Chọn Gemini tab hoặc Google API để phân tích video. ChatGPT tab và OpenAI adapter trong bản này hỗ trợ văn bản/ảnh, **chưa hỗ trợ video gốc**.
- Bấm **Tạo văn bản**. Nối đầu ra văn bản sang prompt của node tạo ảnh/video, hoặc chọn **Dùng kết quả làm kịch bản** để mở trình tạo node cảnh.
- Cửa sổ **Kịch bản → Node** cũng có chức năng viết kịch bản trực tiếp bằng AI theo mẫu chuẩn.

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

Không cần npm/build để cài extension. Tạo lại gói cài bằng `python tools/package.py`. Kiểm thử tự động:

```sh
node --test tests/*.test.mjs
# Cần Playwright và Chromium cho hai harness trình duyệt:
node tests/browser-smoke.cjs
node tests/bridge-smoke.cjs
```

Harness chạy DOM Chromium thật với `chrome.*` và dịch vụ AI giả lập. Kiểm tra luồng node, lưu/nhập workflow, dữ liệu video gốc, dọn tệp, chờ upload, gửi đúng một lần và hủy. **Không thay thế kiểm thử trên tài khoản AI thật.** Môi trường phát triển chặn cài extension qua tự động hóa; chưa xác minh Load unpacked tự động, API tạo nội dung trả phí, chat AI đăng nhập và Motion Control đầu cuối. FFmpeg/timeline kế thừa mã gốc, chưa chạy xuất MP4 đầu cuối trong lần thay đổi này.

Đối chiếu cả 17 yêu cầu và bước kiểm tra thực tế: [PROGRESS.md](docs/PROGRESS.md).
