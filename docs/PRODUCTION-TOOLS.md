# Tám công cụ sản xuất — 0.9.0

Mở menu Thêm node để chọn. Hai công cụ Phân tích video và Biến thể prompt dùng engine Tạo văn bản hiện có, gồm chọn AI, API/tab, chờ upload, gửi hai bước và khôi phục kết quả. Các công cụ còn lại xử lý tại trình duyệt.

| Công cụ | Cách dùng và kết quả |
|---|---|
| Khóa nhân vật | Nối ảnh chuẩn vào cổng Ảnh, nhập đặc điểm rồi bấm Khóa ảnh và đặc điểm. Node lưu bản sao ảnh và mô tả riêng. Thay ảnh nguồn không đổi bản khóa; muốn đổi phải mở khóa. Nối đầu ra Ảnh vào tham chiếu của node tạo hoặc Gán vai trò ảnh; đầu ra Văn bản có thể nối vào quy tắc/prompt. |
| Gán vai trò ảnh | Nối từng ảnh vào Nhân vật/Bối cảnh/Trang phục/Tư thế. Nối đầu ra Ảnh vào tham chiếu của node tạo. Prompt tự kèm thứ tự ảnh, ID và vai trò; ảnh nhân vật khóa kèm đặc điểm cố định. Cùng một ảnh dùng nhiều vai trò chỉ đính kèm một lần, ghi đầy đủ vai trò và ID tương đương. |
| Phân tích video | Nối Video đầu vào vào Video gốc, chọn AI rồi chạy. Có thể nối yêu cầu bổ sung vào Prompt. Gửi video gốc; yêu cầu AI phân tích nhân vật, trang phục, bối cảnh, hành động, camera, ánh sáng, âm thanh, mốc thời gian và viết prompt tái tạo. Không có video thì không gọi AI. |
| Chia cảnh tự động | Dán kịch bản vào node hoặc nối đầu ra văn bản đã có. Chọn Chỉ ảnh/Chỉ video/Ảnh và video, bấm Tạo các node cảnh. Tạo prompt và node tạo, nối ảnh sang video, đưa video theo thứ tự lên Timeline. Chưa gửi AI ngay; bạn chọn/chạy các node mới. Tối đa 50 cảnh, chặn tạo trùng cùng kịch bản khi các node trước còn tồn tại. |
| Duyệt trước khi chạy | Nối prompt và ảnh/video vào node; nối Văn bản sang prompt của node tạo, Ảnh/Video sang cổng tương ứng. Mỗi lượt dừng với hộp xem prompt có thể sửa và ảnh/video tham chiếu. Duyệt mới tiếp tục gửi; Hủy hoặc Dừng workflow hủy lượt, không gửi. |
| Kiểm tra kết quả | Nối ảnh/video, đặt tỷ lệ và thời lượng cần kiểm tra; tùy chọn yêu cầu luồng âm thanh. Ảnh đọc kích thước thực, video được FFprobe WASM đọc kích thước, thời lượng và luồng âm thanh. Sai số tỷ lệ 3%, thời lượng 0,5 giây. Báo CHƯA ĐẠT rõ từng mục; không tự tạo lại AI. |
| Biến thể prompt | Nối ý tưởng vào Prompt; chọn 2–10 biến thể và định hướng. AI trả các prompt tách biệt. Chọn một biến thể trong danh sách đầu ra rồi nối Văn bản sang node tạo. Kết quả không tách được bị báo lỗi, không tự chuyển cả đoạn sang tạo ảnh. |
| Lưu theo bộ | Nối các tệp cuối vào cổng Ảnh/video (nhận nhiều đầu vào), prompt vào Văn bản. Bấm tải hoặc chạy node để yêu cầu trình duyệt tải vào cùng thư mục trong Downloads, tên theo cảnh và ID; kèm `prompts-and-files.json` ghi prompt, tệp và vai trò ảnh. Không ghi API key. Node báo đã yêu cầu tải, còn hoàn tất/hủy xem trong Downloads. |

## Luồng gợi ý

Ảnh nhân vật → Khóa nhân vật → Gán vai trò ảnh (cổng Nhân vật).
Ảnh nền → Gán vai trò ảnh (cổng Bối cảnh).
Gán vai trò ảnh → Duyệt trước khi chạy (cổng Ảnh).
Yêu cầu → Duyệt trước khi chạy (cổng Prompt).
Duyệt: Văn bản → Tạo ảnh: Prompt; Duyệt: Ảnh → Tạo ảnh: Reference.
Tạo ảnh → Kiểm tra kết quả → Lưu theo bộ (cổng media).

Ví dụ kịch bản chia cảnh:

```text
CẢNH 1 (0:00–0:05): Mở đầu
Prompt ảnh: Cánh đồng buổi sáng, tỷ lệ 16:9.
Prompt video: Máy quay tiến nhẹ qua cánh đồng, gió nhẹ.
Audio: Tiếng gió và chim.

CẢNH 2 (0:05–0:10): Kết
Prompt ảnh: Mặt trời trên cánh đồng, tỷ lệ 16:9.
Prompt video: Máy quay dừng, ánh nắng thay đổi nhẹ.
Audio: Tiếng gió.
```

## Giới hạn được thể hiện rõ

Khóa/ID/vai trò là hướng dẫn cho AI, không bảo đảm model giữ khuôn mặt tuyệt đối. Phân tích nội dung và chất lượng ảnh/video cần dịch vụ AI có khả năng tương ứng; chưa kiểm chứng trên phiên AI thật trong môi trường phát triển. Kiểm tra kỹ thuật không đánh giá diễn xuất hay độ giống nhân vật; có luồng âm thanh không chứng minh có tiếng nghe rõ hoặc đúng nội dung.

Kiểm tra video tải FFmpeg WASM và tối đa 100 MB/tệp. Các node cảnh mới có thể cần chỉnh provider/thời lượng theo quyền dịch vụ. Hai bước gửi, giới hạn model và tính năng chọn kết quả của các bản trước vẫn áp dụng.
