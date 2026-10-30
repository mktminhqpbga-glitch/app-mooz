# Kết nối qua relay Internet · MooZ 0.51.0 / Workflow Connect 1.3.0

MooZ và extension cùng mở kết nối WSS ra máy chủ relay. Không cần mở cổng router, chạy Cloudflare Tunnel, cài Tailscale, mua tên miền hoặc nâng cấp hosting InfinityFree. Relay Node.js không chạy trên hosting PHP Free của InfinityFree.

Đây là một cách kết nối mới, không tự vượt chặn mạng. Máy Chrome vẫn phải được nhà cung cấp/mạng cho phép truy cập HTTPS/WSS tới địa chỉ dịch vụ. Cần thử chính địa chỉ đã triển khai từ máy ảo Muse; không suy ra rằng mọi hostname Render đều được phép chỉ vì một WebSocket khác hoạt động.

## 1. Triển khai dịch vụ của bạn trên Render

1. Đăng nhập https://dashboard.render.com bằng GitHub hoặc phương thức Render hỗ trợ. Không gửi mật khẩu/token vào chat.
2. Mở [Triển khai bộ relay](https://render.com/deploy?repo=https://github.com/mktminhqpbga-glitch/app-mooz), hoặc tạo **New → Blueprint** từ repo này. File `render.yaml` đã khai báo web service Node.js ở thư mục `relay-server`, plan `free` và khóa quản trị sinh ngẫu nhiên.
3. Kiểm tra **Instance Type = Free** trước khi triển khai. Nếu tài khoản/giao diện không cho chọn Free, dừng lại để kiểm tra với Render; không tự chọn gói trả phí. Render có thể áp dụng yêu cầu xác minh tài khoản theo chính sách riêng.
4. Đợi dịch vụ báo **Live**. Dịch vụ có URL như `https://mooz-relay-xxxx.onrender.com`; không cần custom domain. Đừng dùng địa chỉ trang Dashboard làm địa chỉ dịch vụ.
5. Trong dịch vụ đó, mở **Environment**, xem giá trị **RELAY_ADMIN_KEY**. Chỉ sao chép vào MooZ trên máy bạn, không gửi cho máy Chrome hoặc đăng công khai. Giá trị này cho phép app tạo phòng relay; nó không phải mã ghép Chrome.
6. Trên máy Chrome, thử mở `https://<địa-chỉ-dịch-vụ>/health`. JSON chứa `"service":"mooz-outbound-relay"` cho thấy HTTPS tới được dịch vụ. Nếu bị 403, nhờ nhà cung cấp mạng/máy ảo/dịch vụ kiểm tra quyền truy cập. HTTPS thành công vẫn cần kiểm thử WSS trong extension.

### Nếu cấu hình bằng tay trong Render

| Trường | Giá trị |
| --- | --- |
| Service type | Web Service, Node |
| Repository | `https://github.com/mktminhqpbga-glitch/app-mooz` |
| Root Directory | `relay-server` |
| Build Command | `npm ci --omit=dev` |
| Start Command | `node server.cjs` |
| Health Check Path | `/health` |
| Instance Type | Free |
| Environment | `RELAY_ADMIN_KEY`: giá trị ngẫu nhiên ít nhất 32 ký tự; Node 24 |
| Auto deploy | Off, triển khai lại có thể ngắt phiên đang chạy |

## 2. Máy chạy MooZ

1. Cài **MooZ 0.51.0 trở lên**. Vào **Cài đặt & kết nối AI → Chrome ở máy khác → Relay Internet**.
2. Dán URL HTTPS của dịch vụ và RELAY_ADMIN_KEY. URL HTTPS gốc được đổi sang `wss://…/remote`; không chấp nhận HTTP/WS công khai.
3. Bấm **Kết nối relay**. App kiểm tra dịch vụ rồi đăng nhập bằng WSS. Gói Free vừa ngủ có thể cần khoảng một phút để mở lại.
4. Bấm **Tạo & sao chép mã**. Mã là `workflow-connect://relay?...`, dùng một lần trong 10 phút. Tạo mã mới thu hồi phòng/mã trước đó; nếu Chrome đang kết nối, ngắt phiên đó trước khi đổi.

Khóa quản trị chỉ giữ trong phiên app, không ghi vào thiết lập, dự án hay báo cáo. Sau khi khởi động lại MooZ, cần nhập lại khóa; không tự kết nối nền. Nếu chỉ đường relay bị ngắt nhưng app vẫn mở, khóa còn trong phiên để bạn bấm Kết nối relay lại. Khóa không được đưa vào mã ghép Chrome.

## 3. Máy Chrome

1. Cài/cập nhật **Workflow Connect 1.3.0**, bấm **Tải lại** ở `chrome://extensions` và tải lại các tab AI đang dùng. Bản 1.2.x vẫn dùng được kết nối cũ, nhưng không có transport relay mới.
2. Mở extension, dán mã mới và bấm **Kết nối**; chấp nhận quyền tới đúng hostname dịch vụ của bạn.
3. Mở/đăng nhập các tab AI. Trong MooZ, làm mới danh sách chat, chọn đúng tab và thử một tác vụ nhỏ.
4. **Kiểm tra đường truyền** trong extension chỉ kiểm tra dịch vụ HTTPS; không gửi khóa/mã hay làm việc với tab AI.

Một app ghép một Chrome tại một thời điểm; Chrome đó có thể có nhiều tab AI. Giữ app và Chrome hoạt động. Thời hạn 10 phút chỉ để ghép ban đầu, không bắt tạo lại mã mỗi 10 phút sau khi đã kết nối.

## Mất mạng, thu hồi và khởi động lại

- Nếu chỉ Chrome mất mạng trong khi app và relay còn hoạt động, dùng **Kết nối lại** trong extension. Khóa resume ở broker và khóa app đều đổi sau lần kết nối thành công. Không tạo lại/gửi lại tác vụ AI đang dở.
- Nếu app mất kết nối tới relay, rời app, relay restart/redeploy/ngủ hoặc phòng hết hạn, app giữ tác vụ ở trạng thái cần đối chiếu. Kết nối lại app, tạo mã mới để ghép Chrome. Relay không lưu phòng/credential trên đĩa và không phục hồi công việc tự động.
- **Thu hồi phiên từ xa** hủy phòng/khóa đang dùng nhưng giữ kết nối quản trị app để tạo phòng mới. **Dừng kết nối từ xa** đóng relay của app và xóa khóa quản trị khỏi bộ nhớ phiên.
- Phòng có thời gian sống tối đa 24 giờ; mã chưa dùng hết hạn 10 phút. Sau khi hết phiên/phòng, cần ghép lại.
- **Sao chép báo cáo kết nối** không chứa khóa quản trị, mã ghép, khóa mã hóa, khóa resume hay nội dung AI.

## Dữ liệu và giới hạn

Ảnh, video, văn bản, lệnh và phản hồi app–extension được mã hóa AES-256-GCM trước khi đi qua broker, theo khóa riêng trong mã ghép. Dữ liệu được chia khung khoảng 192 KiB, xác thực thứ tự/phiên/hướng truyền rồi ghép lại ở hai đầu. Relay không có khóa đó, không giải mã nội dung và không lưu tệp. Cookie AI ở lại Chrome; danh sách thao tác/tab/script cho phép giữ nguyên.

Render vẫn thấy metadata kết nối, kích thước/thời điểm và lưu lượng. Dịch vụ nhận khóa quản trị của chính nó để xác thực app. Ai có mã ghép có thể dùng quyền kết nối trong thời hạn của mã; chỉ dán vào extension của bạn.

Giới hạn 128 MB cho một thông điệp JSON (khác kích thước tệp gốc). Base64 và mã hóa làm tăng lưu lượng. Có backpressure và giới hạn bộ đệm; mạng tắc/lỗi sẽ ngắt, không coi là thành công. Chỉ chạy **một instance** relay: phòng đang giữ trong RAM; không dùng autoscale/multiple instances với bản này. Mặc định tối đa 4 phòng và 24 socket, mã quản trị mạnh bắt buộc, handshake có thời hạn; đây là relay cá nhân, chưa phải dịch vụ đa tenant công khai.

## Gói Free có giới hạn

Theo [Render Free](https://render.com/docs/free), web service Free có thể ngủ sau 15 phút không hoạt động, cần khoảng một phút để mở lại, và các dịch vụ Free chia sẻ hạn mức 750 giờ/workspace/tháng. Băng thông ra và build có hạn mức riêng; video qua relay tính vào lưu lượng ra. Khi hết hạn mức, dịch vụ có thể bị tạm dừng; tài khoản có phương thức thanh toán có thể phát sinh phí vượt hạn mức theo chính sách Render. Theo dõi **Usage/Billing**, không coi đây là lời cam kết miễn phí không giới hạn hay hoạt động 24/7.

Không tạo tác vụ AI hoặc request rác chỉ để giữ dịch vụ thức. Ping/pong của bộ nối dùng để phát hiện mất kết nối. Bản blueprint tắt auto deploy để các lần sửa app không vô tình triển khai lại relay.

## Tự triển khai ở nơi khác

Bộ `relay-server` chỉ cần Node >=22.12, `npm ci --omit=dev`, `RELAY_ADMIN_KEY` và `PORT`. Có thể chạy ở dịch vụ hỗ trợ Node/WebSocket khác hoặc VPS do bạn quản lý, phía trước có TLS hợp lệ và chuyển tiếp WebSocket Upgrade/Origin. Không đưa cổng WS thô ra Internet hoặc tắt xác minh chứng chỉ. App tôn trọng proxy môi trường/hệ thống được cấu hình; proxy không hỗ trợ sẽ báo lỗi, không tự bỏ qua proxy để đi trực tiếp.

## Đã kiểm thử và phần còn cần thử

Kiểm thử gồm broker HTTP/WS thật, mã hóa/chia khung/Unicode/gói trên 2 MB, từ chối chỉnh sửa/phản chiếu/phát lại, phòng/khóa một lần/resume luân chuyển, hết hạn/thu hồi, master key và khóa phiên không vào báo cáo/thiết lập, giữ trạng thái sau khi mất kết nối mà không phát lại công việc, hủy setup và proxy. Kiểm thử native chạy Electron và Chrome extension riêng qua TLS broker cục bộ, có từ chối chứng chỉ không tin cậy, gửi AI qua DOM fixture, ảnh/video thật và so khớp dữ liệu. Chưa triển khai trong tài khoản Render của người dùng, chưa xác nhận kết nối tới Render từ máy ảo Muse thật; cần làm bước thử ở trên sau khi dịch vụ Live.
