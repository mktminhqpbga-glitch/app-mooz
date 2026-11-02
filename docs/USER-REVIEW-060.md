# MooZ Agent 0.60.0 · Đối chiếu góp ý khách hàng

Bản này dùng MooZ Connect **1.8.1**. Cập nhật tiện ích, tải lại các tab Muse rồi làm mới danh sách chat. Không cần ghép lại Chrome nếu mã ghép hiện tại còn hiệu lực. Giữ appId và thư mục dữ liệu cũ để tiếp tục mở dự án, hàng chờ và kho media đã có.

## Video hàng loạt theo ảnh tham chiếu

Bố cục: thanh dự án và thống kê thật ở trên; khung nhập lớn ở trái; hàng chờ có thẻ mở rộng, Dừng / xóa, kết quả và lịch sử ở phải. Nền tối xanh, thẻ tách màu, nút nhấn xanh; giao diện sáng và màu người dùng tùy chỉnh vẫn hoạt động. Không đưa số RAM, số tài khoản hay thông tin gói dịch vụ mô phỏng vào sản phẩm.

- Dự án Batch nhóm các tác vụ trên máy; dữ liệu cũ được đưa vào dự án đầu tiên. Đổi dự án không hủy tác vụ đang chạy. Kho media dùng chung, từng tác vụ giữ ảnh và luồng đã chốt riêng. Đây là dự án Batch, không phải thư mục xuất bên ngoài hay tài khoản AI.
- Văn bản: mỗi dòng một video, hoặc toàn bộ nội dung một video.
- Ảnh tham chiếu: chọn các sản phẩm/ảnh riêng và luồng xử lý hiện có.
- Đầu → Cuối: chọn hai ảnh trong kho, gửi theo thứ tự và chỉ dẫn chuyển giữa hai khung. Việc bám sát hai khung vẫn phụ thuộc AI.
- Nối dài: chọn video gốc trong kho, dùng Muse tạo một đoạn tiếp theo. Giữ video gốc; ghép các đoạn trong Hậu kỳ. Chưa hỗ trợ gửi video gốc ở chế độ này cho Grok/Flow.
- Mỗi thẻ có Dừng và Dừng & xóa thẻ khi đang chạy/chờ. Xóa yêu cầu dừng, gỡ thẻ, giữ tệp đã lưu trong kho. Khóa tab vẫn được giữ tới khi lời gọi cũ kết thúc; kết quả đến muộn không hồi sinh thẻ hoặc gán sang sản phẩm khác.
- Kho chọn ảnh: khung có giới hạn theo cửa sổ, tên tệp dài xuống dòng, nút Đóng không bị đẩy ra ngoài, dung lượng nhỏ dùng KB.

## Muse: nhận nhầm video và không xác nhận được ảnh

Mỗi yêu cầu ảnh/video/văn bản có mã riêng trong tin nhắn. Tệp phải nằm sau biên tin nhắn vừa gửi; không lấy clip vừa nạp từ lịch sử khi chưa thấy tin nhắn hiện tại. Đổi chat hoặc có tin nhắn người dùng khác chen vào thì dừng thu kết quả. Kiểm tra requestId nếu có trước khi nhận/ACK tác vụ. Không gửi lại prompt để thử nhận tệp.

Ảnh nối vào node viết văn bản không tự chuyển sang node video. Node video luôn hiện số ảnh/video thực sự gửi; có nút **Nối ảnh từ node viết kịch bản** để người dùng tạo dây tham chiếu rõ ràng từ đúng nhánh nguồn. Không lấy ảnh của nhánh sản phẩm khác. Có thể xem lại prompt đã gửi. Kết quả cũ còn hiển thị khi lỗi hoặc đầu vào đổi được gắn nhãn rõ.

Bộ dò ô nhập giữ vùng form tải tệp khi ảnh/video xem trước xuất hiện hoặc textarea được dựng lại. Nhận diện thumbnail, ảnh nền và thẻ tên tệp; nhiều tệp cần đủ xác nhận. Không coi giá trị input.files hay spinner là tải thành công. Sau 90 giây chưa xác nhận được thì báo tiếng Việt và chưa gửi prompt. Điều này không chứng minh kết nối tới Muse thật luôn thành công: lỗi mạng/tài khoản/dịch vụ vẫn cần xem trên tab.

## Đối chiếu danh sách audit

| Mục | Thay đổi / tình trạng |
| --- | --- |
| 1 · Store/Facebook chưa cấu hình | Giữ đúng `null` trong distribution.json; hướng dẫn cài ZIP thủ công, Facebook báo chưa cấu hình, nút một chạm bị khóa. Chưa có URL thật để kích hoạt hai dịch vụ. |
| 2 · 0 tab báo nhiều tab, đếm lỗi lặp | Kiểm tra 0 tab trước lựa chọn cũ; hướng dẫn thiết lập/nhập liệu không thành sự cố. Gộp lỗi hệ thống giống nhau từ IPC/node/thông báo, tránh tăng do nhiều điểm quan sát cùng một lỗi. |
| 3 · Xem đầy đủ | Lấy lỗi đầy đủ của từng node cùng tên/ID, thêm vào tóm tắt lượt chạy; cho sao chép. |
| 4 · Cửa sổ chồng | Một BrowserWindow thật, các WebContentsView cho Canvas, Batch, Đăng bài, Affiliate; thanh tab cố định cùng nút Giao diện. Home là tab Thư viện. Giữ phiên dự án độc lập và kiểm tra lưu/dừng trước khi đóng. Cửa sổ website AI bên ngoài vẫn riêng. |
| 6 · Nút khóa như đang bật | Quy tắc disabled chung màu trung tính, không dùng màu nút chính hay bóng nhấn. |
| 7 · Chữ gấp, thao tác dưới đáy | Caption thanh trái không gấp; vùng công cụ cuộn có giới hạn; gọn chân thanh trái; hành động Affiliate giữ ở chân vùng nhập; lịch co đủ 6 hàng; luồng Batch gọn và cuộn riêng. Nội dung dài vẫn cuộn trong vùng của nó. |
| 8 · Hai dấu chọn Đăng bài | Nhóm Soạn bài không tô active đồng thời với bộ lọc bài. |
| 9 · Hộp Facebook quá cao | Header/footer cố định trong dialog, chỉ phần thân cuộn; nút Đóng ở cả đầu và chân. |
| 10 · Tạm dừng hàng chờ trống | Chốt giá trị trước khi await, cập nhật trạng thái và thông báo tạm dừng/tiếp tục, kể cả hàng chờ trống. |
| 11 · Form trống thành lỗi hệ thống | Kiểm tra Page ID/token trước IPC; backend cũng lọc lỗi nhập liệu. Các mục tự ghi sai trước đây được đánh dấu đã xử lý, không xóa báo cáo thủ công. |
| 12 · Không thấy Giao diện | Nút trên thanh tab luôn có; giữ nút ở màn làm việc và thêm lối mở riêng trong Cài đặt, không chuyển nút gốc vào hộp ẩn. Màu từng phần và cỡ chữ vẫn dùng cơ chế chung. |
| 13 · Các lỗi nhỏ | Affiliate là danh sách giai đoạn, không tạo hình nút bấm; có ví dụ ghi rõ chưa gọi AI. Checkbox trợ lý ghi đối tượng/hành động. Chọn ảnh hàng loạt dùng nhãn tiếng Việt; prompt có hộp mở rộng; lỗi node không bị ellipsis. |
| 14 · Tên cũ | Tiêu đề native lấy tên tab/dự án và MooZ Agent 0.60.0; document titles Đăng bài/Affiliate đúng thương hiệu; menu Chỉnh sửa và hành động tiếng Việt. Giữ tên kỹ thuật/data keys cũ để không mất dữ liệu. |

## Kiểm chứng và giới hạn

**376/376 ca nền đã qua**; bộ bắt buộc có **32 script tích hợp** (Electron/Chromium, chạy theo các nhóm). Các ca thực thi gồm: một cửa sổ thật chứa năm tab, chuyển tab giữ trạng thái/timer; ghép ảnh đúng nhánh; chi tiết lỗi node và toàn bộ prompt; 0 tab không tăng báo lỗi; form Facebook trống; tạm dừng/tiếp tục hàng trống; footer hộp Facebook trong khung; ví dụ Affiliate không tạo tác vụ; đóng tab có lưu.

Batch chạy MP4 fixture qua bộ điều phối thật và FFmpeg: hai kiểu văn bản, ảnh sản phẩm, hai khung, video gốc nối dài, dự án riêng, kho với tên dài, Dừng/xóa thẻ và giữ tệp, lịch sử sau dọn hàng chờ/khởi động lại. Bộ ca cũ vẫn kiểm tra 13 sản phẩm/4 tab/26 clip, hậu kỳ và xuất MP4.

Muse kiểm tra clip lịch sử xuất hiện trước receipt, tin nhắn chen vào, đổi chat, requestId sai, form lồng/video preview, textarea dựng lại, thẻ tên tệp, ảnh nền, không có preview và tải thiếu tệp. Ca thiếu xác nhận phải gửi 0 lần; ca đúng chỉ gửi một lần.

Cũng chạy lại quản lý nhiều Chrome, relay TLS/outbound, độc lập tab ID, thu hồi từng thiết bị và không phát lại prompt. Chưa kiểm thử với tài khoản Muse/Meta thật hoặc khả năng máy ảo bị hệ điều hành treo Chrome; các dịch vụ AI/xã hội là fixture. Độ đúng nội dung hình ảnh và thời lượng thực tế phụ thuộc AI, không thể bảo đảm chỉ từ DOM.

Đóng gói Mac và Windows dùng `--publish never`. Không tạo GitHub Release trong đợt này.
