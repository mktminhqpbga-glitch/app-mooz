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
