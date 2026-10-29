# Chrome trên máy khác · MooZ Agent 0.49.0

Máy A chạy MooZ để điều phối workflow, lưu dự án và xuất thành phẩm. Máy B chạy Chrome với các tab AI đã đăng nhập, Workflow Connect **1.2.0** và Tailscale. Hai máy có thể ở hai mạng Internet khác nhau. Không cần cài MooZ trên máy B.

## Cài lần đầu

1. Cài và mở **Tailscale trên cả hai máy** từ https://tailscale.com/download. Đăng nhập cùng mạng riêng (tailnet), bảo đảm hai máy được phép kết nối theo cấu hình Tailscale của bạn.
2. Máy A: mở **Cài đặt & kết nối AI → Chrome ở máy khác → Thiết lập Tailscale**. MooZ dùng HTTPS riêng trên cổng Tailscale 9443 và một đường dẫn riêng cho app; không mở cổng router, không bật Funnel công khai, không xóa cấu hình Serve của ứng dụng khác.
3. Nếu Tailscale yêu cầu bật HTTPS, bấm **Quản trị HTTPS**, bật HTTPS trong Tailscale rồi bấm Thiết lập lại. App không tự đăng nhập Tailscale hay thay đổi quyền quản trị mạng.
4. Bấm **Tải tiện ích Chrome** ngay trong MooZ. Chuyển ZIP sang máy B, giải nén, vào `chrome://extensions`, bật Chế độ nhà phát triển và chọn **Tải tiện ích đã giải nén**. Nếu đã có tiện ích cũ, thay thư mục và bấm **Tải lại**.
5. Máy A: bấm **Tạo & sao chép mã**. Máy B: mở Workflow Connect, dán mã và bấm **Kết nối**. Chrome sẽ xin quyền tới đúng tên máy MooZ trong mã; chỉ chấp nhận nếu đó là máy của bạn.
6. Khi tiện ích báo đã kết nối, mở các tab AI trên B. Trong MooZ bấm **Làm mới danh sách chat / Cập nhật tab AI**, chọn đúng tab và chạy một tác vụ nhỏ trước.

Giữ hai máy, Chrome, MooZ và Tailscale cùng hoạt động. Máy Chrome phải có phiên AI đăng nhập hợp lệ; các bước đăng nhập/xác minh/ngắt kết nối tài khoản vẫn xử lý trên chính website AI. Không có cơ chế vượt CAPTCHA hay che giấu tự động hóa.

## Hằng ngày

- Mỗi lần chỉ ghép một Chrome với MooZ. Nếu Chrome cùng máy đang kết nối, dùng **Ngắt Chrome cùng máy** trước khi ghép máy khác; mã cùng máy cũ bị thu hồi.
- Mã từ xa có hiệu lực **10 phút và dùng một lần**. Tạo mã mới hủy mã chưa dùng trước đó. Không đưa mã vào ảnh chụp, báo lỗi công khai hay cuộc trò chuyện hỗ trợ.
- Sau khi ghép, tiện ích giữ khóa phiên trong bộ nhớ phiên Chrome. Khóa đổi khi kết nối lại và không nằm trong URL WebSocket. Khởi động lại MooZ làm phiên cũ hết hiệu lực: tạo mã mới để ghép lại.
- Mất mạng: tiện ích có **Kết nối lại**. App hủy các yêu cầu đang chờ và giữ trạng thái cần đối chiếu, không tự gửi lại prompt hay chạy lại node. Kiểm tra kết quả trong tab AI trước khi tiếp tục trong Agent/hàng đợi.
- **Thu hồi phiên từ xa** ngắt Chrome và vô hiệu hóa khóa ghép/phiên. **Tắt kết nối từ xa** còn vô hiệu hóa đường nhận từ xa của MooZ; app cố gỡ đúng đường Serve riêng, không dùng lệnh reset toàn bộ Tailscale.
- Tắt kết nối từ xa không thu hồi việc website AI đã nhận, cũng không rút lịch đăng đã xếp; kiểm tra trong AI và Đăng bài.

## Đường truyền và giới hạn

Luồng: `MooZ (loopback) ↔ Tailscale Serve trên A ↔ WSS/TLS trong mạng riêng ↔ Workflow Connect trên B ↔ tab AI`. Dữ liệu tham chiếu và kết quả đi qua cùng bộ nối AI đang có; không gửi cookie Chrome hay khóa API của app sang máy B. Tailscale không phải máy chủ đăng bài và không thay thế quyền API của các nền tảng.

MooZ chỉ lắng nghe `127.0.0.1`; app không mở WebSocket thô lên `0.0.0.0`. Tiện ích chỉ chấp nhận mã từ xa chứa `wss://`; không có tùy chọn bỏ kiểm tra chứng chỉ hoặc hạ xuống `ws://`. Quyền HTTPS cho tên máy được xin khi người dùng bấm Kết nối, không cấp sẵn quyền tới mọi website. Bộ nối vẫn chỉ thao tác các tab Muse, ChatGPT và Gemini đã hỗ trợ.

Giới hạn hiện tại: tối đa 128 MB cho một thông điệp JSON và hàng chờ có giới hạn; base64 lớn hơn tệp gốc khoảng 1/3. Video/ảnh lớn phụ thuộc tốc độ hai đường mạng. Tệp vượt giới hạn sẽ báo lỗi, không được coi là hoàn tất. Các công cụ hậu kỳ vẫn có giới hạn tệp riêng trong app.

Tailscale Serve chạy nền nên giữ đường dẫn khi MooZ thoát, nhưng endpoint chỉ hoạt động khi app mở. App ghi nhớ cổng nội bộ để khởi động lại đúng đích. Nếu cổng bị chiếm, app vẫn cho dùng kết nối cùng máy và báo phải thiết lập lại từ xa; không tự báo đường cũ là sẵn sàng. Cấu hình lỗi được giữ nguyên cho tới khi người dùng chọn sao lưu và tạo lại.

## Nâng cao: WSS có sẵn

Có thể dùng reverse proxy/tunnel TLS do bạn quản lý. Mở mục nâng cao, nhập địa chỉ `wss://.../remote`; chuyển tiếp tới `http://127.0.0.1:<cổng hiện trong app>`, hỗ trợ WebSocket Upgrade, giữ Origin và mã đóng kết nối. App nhận cả `/remote` lẫn đường dẫn đầy đủ đã cấu hình để tương thích proxy có hoặc không bỏ prefix. Không đặt token vào URL WebSocket, không dùng HTTP/WS công khai và không bỏ kiểm tra TLS. Phải dùng một TLS endpoint bạn tin cậy; proxy TLS trên máy đó có thể đọc dữ liệu chuyển tiếp.

## Xử lý lỗi

| Hiện tượng | Cách xử lý |
| --- | --- |
| Chưa tìm thấy Tailscale | Cài/mở Tailscale trên máy A; khởi động lại app nếu vừa cài CLI |
| Chưa có tên HTTPS / Serve chưa xác nhận | Bật MagicDNS và HTTPS trong Tailscale, cập nhật Tailscale, thiết lập lại |
| Chrome không tới được máy MooZ | Kiểm tra Tailscale trên cả hai máy, app A còn mở, quyền tailnet/ACL và đồng hồ hai máy |
| TLS không được tin cậy | Dùng đúng tên HTTPS của Tailscale hoặc chứng chỉ hợp lệ của proxy; không bỏ xác minh chứng chỉ |
| Mã hết hạn / đã dùng | Tạo mã mới trên A và dán lại trên B |
| Đã có Chrome khác | Ngắt Chrome cũ trong MooZ hoặc tiện ích trước khi ghép máy mới |
| Tác vụ đang chạy bị ngắt | Kiểm tra tab AI, đối chiếu đầu ra rồi tiếp tục; không bấm tạo nhiều lần |

## Kiểm thử

Kiểm thử đơn vị bao gồm định dạng mã, TTL, mã dùng một lần, khóa phiên luân chuyển, thu hồi, cách ly mã cùng máy, bảo toàn cấu hình Serve khác và khôi phục tệp cấu hình lỗi. Kiểm thử tích hợp chạy Electron và Chromium tách tiến trình qua một tunnel WSS cục bộ: từ chối chứng chỉ không tin cậy, gửi/nhận AI qua trang mô phỏng, ảnh/video và gói trên 2 MB giữ nguyên byte, giải mã và tải MP4 thật, mất kết nối sau khi gửi, kết nối lại không phát lại tác vụ, giữ cổng qua khởi động lại và thu hồi phiên.

CLI Tailscale và website AI được mô phỏng trong kiểm thử; TLS dùng chứng chỉ chỉ tin trong bài test. Chưa kiểm tra đường Internet hoặc tài khoản Tailscale thật của người dùng trong môi trường phát triển. Sau khi cài, làm bước thử nhỏ giữa hai máy thật ở mục Cài lần đầu.
