# Kịch bản tổng và dựng từng hồi/chương

Bản 0.16.0 dùng cấu trúc:

**Kịch bản tổng → Hồi/Chương → Phần → Đoạn → Cảnh (ảnh khung đầu → video chuyển động).**

Video cuối là **một hồi/chương**, không tự nối tất cả hồi thành phim. Mỗi đoạn, phần và hồi có đầu ra MP4 riêng. Thứ tự ghép giữ theo thứ tự trong kịch bản.

## Cách dùng

1. Bấm **＋ Kịch bản tổng**, nhập kịch bản phim. Viết mô tả nhân vật, bối cảnh và phong cách chung ở đầu. Có thể nối các node ảnh nhân vật/bối cảnh vào cổng **Ảnh nhân vật/bối cảnh chung**; chúng được truyền cho từng node tạo ảnh.
2. Với văn xuôi, chọn AI và bấm **AI chia hồi/cảnh**. Kết quả chỉ là bản phân chia, có thể sửa; chưa tạo ảnh/video. Kiểm tra đủ tình tiết và các hồi trước khi dựng. AI có giới hạn độ dài phản hồi; nên chia kịch bản rất dài theo chương.
3. Bấm **Tạo node cho các hồi**. Nếu đã có kịch bản đúng mẫu, có thể bỏ qua bước AI.
4. Dùng **Xem node…** để tới hồi, phần, đoạn hoặc prompt cần chỉnh. Mỗi cảnh có hai prompt riêng: ảnh và chuyển động; video luôn nhận ảnh đầu vào từ cảnh đó. Nếu thiếu `Prompt ảnh`, hệ thống dùng mô tả cảnh làm yêu cầu tạo khung đầu để bạn kiểm tra/sửa.
5. Bấm **Chạy đoạn này**, **Chạy phần này** hoặc **Chạy hồi này**. Hệ thống chạy các bước còn thiếu từ ảnh tới video rồi ghép các cấp dưới lên. Kết quả đã có được dùng lại. Sửa prompt một cảnh đánh dấu những kết quả phụ thuộc cần dựng lại.
6. Tải MP4 ở cấp mong muốn. Nút tải bị khóa khi nội dung nguồn đã thay đổi nhưng chưa dựng lại. Có thể đưa video ghép vào dòng thời gian để tiếp tục âm thanh, phụ đề…

Không tự gửi yêu cầu AI khi chỉ tạo node. Chạy từng đoạn trước giúp kiểm tra nhân vật, ảnh và chuyển động trước khi dựng cả chương. Ảnh tham chiếu hỗ trợ tính nhất quán; không bảo đảm AI giữ khuôn mặt/trang phục hoàn toàn chính xác.

## Mẫu

```text
TÊN PHIM: Hành trình
NHÂN VẬT: Lan, 30 tuổi, tóc đen buộc thấp, áo khoác nâu.
BỐI CẢNH: Làng quê buổi sáng; phong cách chân thực, 16:9.

CHƯƠNG 1: Lên đường
PHẦN 1: Khởi đầu
ĐOẠN 1: Rời nhà
CẢNH 1 (0:00–0:06): Bước ra cửa
Prompt ảnh: Lan đứng trước cửa nhà gỗ, ánh nắng sớm, giữ mô tả nhân vật chung.
Prompt video: Từ ảnh khung đầu, Lan bước chậm ra ngoài; máy quay theo nhẹ.
Audio: Tiếng bước chân, chim hót.

CẢNH 2 (0:06–0:12): Con đường
Prompt ảnh: Lan trên đường làng, nhà gỗ phía sau, áo khoác nâu.
Prompt video: Lan tiếp tục bước đi, máy quay chuyển sang góc bên.
Audio: Gió nhẹ.

ĐOẠN 2: Gặp gỡ
CẢNH 1 (0:00–0:06): Dừng lại
Prompt ảnh: Lan dừng bên gốc cây ven đường, nắng sớm.
Prompt video: Lan quay đầu nhìn về phía xa, biểu cảm tự nhiên.
```

Có thể dùng `HỒI` thay `CHƯƠNG`. Số cảnh chỉ cần duy nhất trong từng đoạn; thời gian cảnh có thể tính lại từ đầu đoạn. Nếu không ghi PHẦN/ĐOẠN, hệ thống thêm cấp mặc định và chia danh sách dài thành nhóm tối đa tám cảnh/đoạn. Những phần/đoạn ghi rõ được giữ nguyên.

## Giới hạn và kiểm thử

- Mỗi cảnh 4–60 giây; tùy AI, thời lượng thực tế có thể khác yêu cầu. Ghép giữ thời lượng thực tế, không ép cả hồi thành clip ngắn. Tối đa 20 hồi/chương, 500 cảnh và 500.000 ký tự mỗi bản dựng.
- Ghép chạy bằng FFmpeg WASM trong trình duyệt, hiện mỗi tệp đầu vào tối đa 100 MB; vẫn cần đủ RAM cho toàn bộ các tệp trong một bước ghép. Các video H.264/AAC cùng cấu hình được nối trực tiếp, tránh mã hóa lặp qua nhiều tầng. Định dạng khác được chuẩn hóa tối đa cạnh dài 1280 px, 24 fps. Hồi dài có thể vượt bộ nhớ hoặc giới hạn tệp: tải các đoạn/phần để lưu trước; chưa có cơ chế ghép nhiều giờ bằng bộ xử lý trên máy chủ.
- Lưu, xuất workflow và mẫu giữ các ID liên kết cấp dựng; bản dựng mới tạo node riêng, không ghi đè bản cũ. Kịch bản đã sửa sau khi AI chia cần chia lại hoặc bỏ bản chia cũ.
- Kiểm thử trình duyệt dùng phản hồi AI mô phỏng; ghép video/âm thanh bằng FFmpeg thật, kiểm tra MP4 bằng ffprobe và màu khung hình theo thứ tự. Chưa xác nhận chất lượng AI thật hoặc một hồi nhiều giờ trong tài khoản người dùng.
