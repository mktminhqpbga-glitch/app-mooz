# Âm thanh, phụ đề và hậu kỳ (0.14.0)

Tất cả node có trong **Thêm node → Âm thanh · hậu kỳ · mẫu** và menu chuột phải trên canvas.
Node hậu kỳ nhận video từ node AI, Video đầu vào hoặc node hậu kỳ trước đó. Bấm **Thực hiện** hoặc **Run All**. Kết quả là MP4 tải được, xem được và thêm được vào dòng thời gian để xuất riêng/ghép chung. Hậu kỳ sử dụng FFmpeg cục bộ; không gửi video đến AI trừ khi bạn chọn chức năng nhận diện lời nói.

| Node | Cách nối và sử dụng |
|---|---|
| Âm thanh đầu vào | Chọn/thả MP3, WAV, M4A… Dùng để cung cấp nhạc hoặc lời đọc thu sẵn. |
| Âm thanh / nhạc nền | Nối một video + một tệp âm thanh. Chỉnh âm lượng gốc/nhạc (0–2), tắt tiếng gốc, bật/tắt lặp nhạc. Nhạc ngắn không lặp sẽ được thêm đoạn im lặng cho đủ video. |
| Phụ đề | Nối video, nhập SRT hoặc chọn tệp SRT, hoặc nối văn bản SRT. Chỉnh cỡ chữ 10–80. Phông DejaVu Sans đi kèm hỗ trợ tiếng Việt. Phụ đề gắn trực tiếp vào video, giữ âm thanh gốc. Có nút tải SRT riêng. |
| Lồng tiếng | Nối văn bản hoặc nhập lời đọc; chọn giọng/tốc độ. Dùng OpenAI `gpt-4o-mini-tts` để tạo MP3, cần API key có quyền/số dư. Tối đa 4096 ký tự. Đây là giọng AI, không sao chép giọng cá nhân. |
| Đồng bộ lời đọc – cảnh | Nối nhiều video vào cổng Các cảnh theo thứ tự, một hoặc nhiều bản đọc vào cổng Các bản đọc. Một bản đọc chung: phân bổ thời lượng theo số từ từng dòng kịch bản, hoặc chia đều. Một bản đọc mỗi cảnh: khớp đúng thời lượng từng bản đọc. Có thể cắt/giữ khung cuối hoặc đổi tốc độ hình cho khớp. Âm thanh gốc được thay bằng lời đọc. |
| Chuyển cảnh | Nối cảnh trước và cảnh sau; chọn hòa hình/tan hình/quét/trượt. Độ dài chồng 0.1–5 giây, phải ngắn hơn từng clip. Video và âm thanh cùng hòa chuyển; tổng thời lượng bằng hai clip trừ độ chồng. |
| Điều chỉnh tốc độ | Nối video; hệ số 0.25–4. Âm thanh đổi nhịp và giữ cao độ. Đầu ra vẫn là MP4. |
| Mẫu workflow | Đặt tên, lưu toàn bộ hoặc chỉ các node đang chọn. Tối đa 20 mẫu; mỗi mẫu 20 MB. Có thể kèm tệp đầu vào. Chèn mẫu tạo ID mới, remap kết nối và nối thứ tự cảnh của mẫu vào dòng thời gian hiện có. Không sao chép kết quả AI, chat đã chọn hay khóa API. |

## Chuỗi ví dụ

`Kịch bản → Lồng tiếng → Đồng bộ lời đọc – cảnh → Phụ đề → Dòng thời gian`

Các video của từng cảnh cũng nối vào **Đồng bộ lời đọc – cảnh**. Nếu muốn thêm nhạc sau đó: nối đầu ra sang **Âm thanh / nhạc nền**, nối một **Âm thanh đầu vào** chứa nhạc, giảm âm lượng nhạc và giữ lời đọc gốc.

**Nhận diện phụ đề:** bật “Tự nhận diện bằng OpenAI nếu chưa có SRT”, nhập khóa trong **Kết nối AI → OpenAI API**, rồi chạy. Chức năng dùng Whisper API và gửi video/âm thanh gốc, tối đa 25 MB. Có thể tính phí. Khi đã có SRT, node dùng bản đang sửa và không tự nhận diện lại. Xóa SRT nếu muốn nhận diện lại.

## Giới hạn và kiểm thử

- Đồng bộ với một bản đọc chung là phân bổ theo trọng số kịch bản, chưa phải căn từng từ dựa trên lời nói thực. Muốn kiểm soát từng cảnh chính xác, cung cấp một tệp lời đọc cho mỗi cảnh.
- Phụ đề SRT cần thời gian tăng dần, không chồng nhau, không vượt thời lượng video. Đây là phụ đề gắn vào hình; không tạo karaoke theo từng từ.
- Mẫu là bản sao độc lập, không tự cập nhật các bản đã chèn khi chỉnh mẫu gốc. Không kèm tệp thì cần chọn lại các tệp đầu vào.
- Hiệu ứng xuất H.264/AAC, tối đa cạnh dài 1280, 24 fps; có thể thêm viền đen để giữ tỷ lệ thay vì kéo giãn hình. Video được mã hóa lại.
- Hậu kỳ được thử qua Chromium + FFmpeg WASM thật: trộn âm thanh, tăng tốc có tiếng, phụ đề tiếng Việt có điểm ảnh hiển thị, hòa cảnh và tổng thời lượng, khớp lời đọc; kiểm tra codec/thời lượng bằng FFprobe. Chuỗi Run All và mẫu/ID/kết nối cũng được kiểm tra.
- TTS và nhận diện lời nói được kiểm tra với API giả lập; chưa gọi trên tài khoản OpenAI thật trong môi trường này.
