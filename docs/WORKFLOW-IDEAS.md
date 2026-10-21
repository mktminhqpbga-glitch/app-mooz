# Các hướng cải tiến tiếp theo

Ngày đánh giá: 2026-10-21. Người dùng cung cấp https://labs.toby.vn/ để tham khảo.

## Trạng thái tham khảo bên ngoài

Đã thử đọc Toby Labs (trang chủ và robots.txt), Weavy, TapNow, tài liệu ComfyUI về subgraph và n8n về xử lý lỗi. Các yêu cầu đều bị proxy môi trường trả HTTP 403. Vì vậy chưa xác minh được giao diện/tính năng hiện tại, mức độ phổ biến hay giá/quyền truy cập. Không khẳng định các tính năng bên dưới có trên Toby Labs hoặc là xu hướng mới được xác nhận.

Các đường dẫn cần đối chiếu khi truy cập được:

- https://labs.toby.vn/
- https://www.weavy.ai/
- https://www.tapnow.ai/
- https://docs.comfy.org/interface/features/subgraph
- https://docs.n8n.io/flow-logic/error-handling/

## Đề xuất theo nhu cầu của Workflow

| Ý tưởng | Giá trị thực tế | Phần cần làm thêm |
|---|---|---|
| Chỉnh một vùng ảnh / mặt nạ | Sửa sản phẩm, nền hoặc chi tiết mà vẫn giữ phần ảnh đã duyệt | Trình vẽ mask, chọn model inpainting, giữ bản gốc để so sánh |
| Tự hạ nhạc khi có lời đọc | Nghe rõ lời mà không cần chỉnh âm lượng từng đoạn | Sidechain compression/ducking, đồng hồ âm lượng và nghe thử |
| Phụ đề theo từng từ | Dễ theo dõi nội dung dạng video ngắn | Timestamp cấp từ, giao diện sửa và xuất ASS/karaoke |
| Đồng bộ khẩu hình | Giọng đọc khớp miệng nhân vật | Adapter model chuyên dụng, API/quyền sử dụng và kiểm tra chất lượng |
| Mẫu có tham số / nhóm có cổng vào-ra | Dùng lại cả dây chuyền, chỉ thay sản phẩm, nhân vật hoặc tỷ lệ | Subworkflow thật thay vì chèn bản sao các node |
| So sánh phiên bản | Giữ nhiều kết quả đã duyệt, chọn bản tốt rồi nối tiếp | Bộ xem A/B, lịch sử và lựa chọn đầu ra rõ ràng |

Ưu tiên phù hợp trước: **ducking nhạc/lời đọc** và **chỉnh ảnh bằng mặt nạ**. Chưa triển khai các ý tưởng này trong bản 0.14.0; bảy mục đã được người dùng chọn mới là phạm vi thực hiện.
