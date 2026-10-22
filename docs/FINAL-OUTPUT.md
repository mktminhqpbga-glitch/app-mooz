# Output · Xuất video cuối

## Dùng với node MP3 đang có

1. Bấm biểu tượng **Tạo node → Thêm node → Output · Xuất video cuối**. Hoặc kéo từ cổng Âm thanh ra canvas, chọn **Output**; menu này cũng có Âm thanh/nhạc nền và Đồng bộ lời đọc–cảnh.
2. Nối cổng Âm thanh từ node MP3 vào cổng **Nhạc / lời đọc** của Output. Có thể chọn MP3 trực tiếp trong Output hoặc thả tệp âm thanh lên node.
3. Nối đầu ra các video vào cổng **Các video**; hoặc bấm **Nối video từ timeline / canvas**. Nếu timeline có clip, nút lấy các video trong timeline; nếu chưa có, lấy các node video cuối nhánh trên canvas. Không lấy node Xem trước và không lặp cả video nguồn lẫn video hậu kỳ của cùng nhánh.
4. Kiểm tra danh sách cảnh. Thứ tự ưu tiên là thứ tự bạn chỉnh bằng **↑ ↓**, kế đến là timeline, rồi số cảnh/tên video (Cảnh 2 trước Cảnh 10). Nếu không có thông tin, dùng thứ tự tạo node. **Dùng lại thứ tự tự động** bỏ ghi đè thủ công. Hệ thống không suy luận trước/sau bằng nội dung hình ảnh; cần đặt tên cảnh hoặc sắp timeline khi ý đồ dựng khác thứ tự này.
5. Chọn **Thay âm thanh gốc** (mặc định) hoặc **Trộn với âm thanh gốc**. Điều chỉnh âm lượng MP3 nếu cần. Giữ nguyên tổng thời lượng video thực tế: MP3 dài hơn được cắt; ngắn hơn thì thêm khoảng lặng. Bật **Lặp MP3** nếu muốn nhạc chạy tới hết phim; không nên lặp bản lời đọc ngoài ý muốn.
6. Bấm **Xuất video cuối**, hoặc **Run All** để chạy nguồn và Output theo phụ thuộc. Tệp MP4 tự tải xuống sau khi xử lý xong nếu **Tự tải MP4 sau khi hoàn tất** được bật. Có thể tắt để chỉ xem trước/tải bằng nút Tải kết quả.

Không gửi âm thanh lên AI: ghép và trộn chạy bằng FFmpeg WASM cục bộ. Thiết lập tải xuống của trình duyệt có thể yêu cầu chọn nơi lưu. Hình ảnh không được tự ghép vào Output; hãy đưa ảnh qua node tạo video hoặc xuất từ timeline trước.

Nếu một video nguồn chưa tạo được, Output dừng theo lỗi nguồn. Không tự bỏ qua cảnh bị thiếu. Khi sửa nguồn, âm lượng hoặc thứ tự, chạy Output lại trước khi tải; bản xuất cũ không được xem là kết quả mới.

## Giới hạn và kiểm thử

Mỗi tệp đầu vào FFmpeg tối đa 100 MB; video ghép trung gian khi chèn MP3 cũng chịu giới hạn này. Cần đủ bộ nhớ trình duyệt. Video khác định dạng được chuẩn hóa tối đa cạnh dài 1280 px, 24 fps; video H.264/AAC cùng cấu hình được nối trực tiếp trước bước trộn âm thanh. Dự án rất dài nên chia theo đoạn/phần.

Kiểm thử Chromium với chín clip có thứ tự tạo/dây nối đảo ngược, MP3 20 giây khác tần số tiếng gốc: Run All xuất một MP4 thật, kiểm tra thứ tự khung hình, tổng thời lượng thực tế, âm thanh MP3 thay tiếng gốc và một lượt tải tự động. Có kiểm thử menu cổng âm thanh, nhận video trên canvas, chỉnh/lưu thứ tự và chọn MP3 trực tiếp. Không cần tài khoản AI cho bước ghép này.
