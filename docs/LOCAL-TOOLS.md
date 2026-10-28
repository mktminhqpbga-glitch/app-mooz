# Công cụ bổ sung · 0.45.3

Các node hậu kỳ dưới đây xử lý bằng FFmpeg đi kèm app, không cần tài khoản AI và không gửi video tới dịch vụ AI. Cần nối một video đầu vào; mỗi tệp tối đa 100 MB theo giới hạn bộ xử lý hiện có. Mỗi lần bấm Thực hiện tạo một tệp kết quả riêng, giữ tệp nguồn. Đây là xử lý cục bộ có mã hóa lại, không phải sửa trực tiếp tệp gốc hay bảo đảm chất lượng bit-for-bit.

| Công cụ | Cách dùng | Kết quả |
|---|---|---|
| Cắt video | Nhập giây bắt đầu/kết thúc. Kết thúc bằng 0 nghĩa là đến hết nguồn. Mốc phải nằm trong thời lượng thực, đoạn tối thiểu 0,05 giây. | MP4 của đoạn đã chọn, giữ kích thước và âm thanh nguồn. Độ chính xác thực phụ thuộc khung hình/định dạng. |
| Xoay / lật video | Chọn 0/90/180/270 độ. Có thể lật ngang sau khi xoay. | MP4 giữ thời lượng/âm thanh; 90/270 độ đổi chỗ chiều rộng và chiều cao. |
| Chỉnh màu video | Độ sáng −0,5…0,5; tương phản 0,1…3; bão hòa 0…3. Giá trị gốc là 0/1/1. | MP4 chỉnh màu. Bão hòa bằng 0 tạo trắng đen. |
| Tách âm thanh | Nối video có tiếng rồi bấm Thực hiện. Video không có luồng âm thanh sẽ báo lỗi. | MP3 có nút tải và cổng Âm thanh, dùng lại ở Nhạc nền/Đồng bộ lời đọc. |

Đường vào: thanh trái → **Hậu kỳ trên máy**, hoặc **Thêm node** → tìm tên công cụ. Khi kéo cổng Video ra vùng trống, menu tạo node cũng có bốn công cụ mới. Tên nút, menu và node dùng chung tên tiếng Việt.

Ví dụ: Video đầu vào → Cắt video → Xoay/lật → Chỉnh màu → Tổng hợp video hoặc Đăng bài. Tách âm thanh có thể nối riêng từ Video đầu vào, rồi nối cổng Âm thanh sang node Âm thanh/nhạc nền. MP3 chỉ tải/dùng làm âm thanh; không được coi là video để đưa vào hàng đăng bài.

Đổi thiết lập hoặc đầu vào sẽ đánh dấu kết quả cũ cần tạo lại, khóa tải/đăng cho các kết quả đó. Trong khi xử lý các node mới, trường cấu hình được khóa và lần chạy dùng bản chụp thiết lập. Nút Dừng dùng cơ chế hủy và hàng chờ FFmpeg có sẵn. Video đã hậu kỳ được nhận ở thanh timeline và Tổng hợp video; chức năng Gom video tránh gom cả bản trung gian lẫn bản đã hậu kỳ ở cuối chuỗi.

## Điều hướng workflow lớn

Ba nút trong nhóm **Dự án** của thanh trái, đồng thời tìm được bằng ⌘K/Ctrl+K:

- **Tìm node:** tìm không dấu theo tên/mã node; lọc lỗi, chưa chạy, đang chạy, đang chờ hoặc có kết quả. Bấm kết quả để chọn và đưa node vào vùng nhìn. Enter chọn mục đầu, mũi tên xuống chuyển tới danh sách, Escape đóng hộp thoại.
- **Chọn node lỗi:** chọn và đưa các node có trạng thái lỗi vào vùng nhìn. Nếu không có lỗi, app báo rõ và không thay vùng chọn.
- **Xem vùng đang chọn:** thu/phóng và căn vùng nhìn vào nhóm đang chọn. Không chọn node nào thì có hướng dẫn chọn trước.

Các thao tác này không chạy node, không gửi prompt và không thay tọa độ/dây nối. Bảng báo lỗi đã có vẫn là nơi ghi cách tái hiện và xuất báo cáo; Tìm node là nơi đi tới vị trí lỗi trong graph.

## Kiểm tra

`tests/media-studio.test.mjs`: kiểm tra mốc cắt vượt nguồn/ngược chiều, góc xoay hợp lệ, số liệu màu có giới hạn và bão hòa 0, từ chối thiếu/nhiều nguồn trước khi nạp FFmpeg, gom đúng đầu ra sau chuỗi hậu kỳ.

`tests/desktop-extra-tools-smoke.cjs`: Electron và FFmpeg thật, nguồn video hai màu có sóng 440 Hz. Dùng nút/ô nhập thật để cắt 0,5–1,5 giây, xoay 90 độ, xuất trắng đen, tách MP3 và tải tệp qua luồng native; giải mã khung hình RGB/âm thanh PCM để kiểm tra kết quả; kiểm tra lật ngang, dùng MP3 đã tách trong node nhạc nền, từ chối nguồn không tiếng, khóa kết quả cũ, tìm/chọn lỗi và lưu/mở lại graph. Giữ tác vụ cắt chờ trong test để kiểm tra trường cấu hình khóa trước khi FFmpeg xử lý thật. Không gọi AI trả phí hoặc đăng bài thật.
