# Chrome trên máy khác · MooZ Agent 0.51.0

**Không có tên miền hoặc không dùng được Quick Tunnel?** Dùng [Relay Internet](OUTBOUND-RELAY.md): app và Chrome đều mở kết nối WSS ra relay do bạn triển khai. Bộ Render có gói Free trong hạn mức, không cần hosting PHP, Cloudflare Tunnel hay Tailscale; extension cần 1.3.0. Vẫn phải kiểm tra máy Chrome được phép truy cập hostname của dịch vụ.

Máy A chạy MooZ để điều phối workflow, lưu dự án và xuất thành phẩm. Máy B chạy Chrome với các tab AI đã đăng nhập và Workflow Connect **1.2.0 trở lên** (bản đóng kèm **1.2.2**). Hai máy có thể ở hai mạng Internet khác nhau. Không cần cài MooZ trên máy B. Chọn Cloudflare Tunnel nếu không muốn cài Tailscale.

## Cách nhanh: Cloudflare Tunnel, không cần Tailscale

**Trên máy A (MooZ):**

1. Cài MooZ **0.50.1 trở lên**, mở **Cài đặt & kết nối AI → Chrome ở máy khác**.
2. Bấm **Tải cloudflared**. MooZ tải bản phù hợp với kiến trúc app từ kho phát hành chính thức `cloudflare/cloudflared`, kiểm tra kích thước/SHA256 trong metadata GitHub, rồi kiểm tra phiên bản trước khi thay công cụ cũ. Công cụ chỉ nằm trong thư mục dữ liệu MooZ; không cần Homebrew, `sudo`, tài khoản Cloudflare hay chỉnh InfinityFree. Nếu đã cài cloudflared qua Homebrew/WinGet, bấm **Kiểm tra công cụ** để dùng bản có sẵn.
3. Bấm **Bắt đầu Cloudflare Tunnel**, đợi thông báo đường kết nối đã được xác nhận (có thể mất khoảng 90 giây). App đợi công cụ báo hostname hợp lệ/đăng ký kết nối, rồi gửi kiểm tra HTTPS không chứa mã hay khóa phiên qua tunnel. Chỉ bật tạo mã khi trả về đúng định danh phiên MooZ và nonce mới. Mỗi lần tạo mã kiểm tra lại đường này; không chỉ dựa vào log công cụ. Đây chưa phải xác nhận Chrome máy B đã kết nối.
4. Bấm **Tạo & sao chép mã**. Mã vẫn hiện dạng ẩn trong ô; có thể bấm **Hiện mã**, chọn rồi dùng ⌘C/Ctrl+C nếu cần. Mã mới hủy mã chưa dùng trước đó.

**Trên máy B (Chrome):**

1. Tải ZIP bằng nút **Tải tiện ích Chrome** trong MooZ rồi chuyển sang máy B. Giải nén ZIP, mở `chrome://extensions`, bật **Chế độ nhà phát triển → Tải tiện ích đã giải nén** và chọn thư mục vừa giải nén. Nếu đã dùng Workflow Connect 1.2.0 thì không bắt buộc cài lại để kết nối Cloudflare.
2. Mở Workflow Connect, dán mã, bấm **Kết nối** và chấp nhận quyền tới đúng hostname Cloudflare của mã. Máy B không cần cloudflared hay Tailscale.
3. Mở/đăng nhập các tab Muse, ChatGPT hoặc Gemini. Trở về MooZ trên A, **Làm mới danh sách chat / Cập nhật tab AI**, chọn tab của B và thử một tác vụ nhỏ.

**Hằng ngày:** giữ máy A thức và MooZ mở. MooZ giữ cloudflared chạy nền, không cần giữ cửa sổ Terminal. Máy B giữ Chrome và tab AI hoạt động. Bấm **Dừng kết nối từ xa** để dừng đúng tiến trình tunnel do MooZ mở và thu hồi mã/phiên. Thoát app cũng dừng tunnel. App không cài cloudflared thành dịch vụ hệ thống và không dừng các tunnel bạn tự chạy.

Quick Tunnel tạo địa chỉ ngẫu nhiên `*.trycloudflare.com` mới mỗi lần bắt đầu; sau khi thoát app hoặc tunnel dừng, bấm Bắt đầu và ghép mã mới. Không dùng lại link kiểm tra cố định trong chat hoặc tab trình duyệt cũ: bấm **Sao chép địa chỉ kiểm tra** trong MooZ để lấy đúng URL hiện tại. Không tự mở lại đường công khai khi app khởi động. Nếu chỉ Chrome/mạng B bị ngắt trong khi tunnel A còn chạy, có thể dùng **Kết nối lại** trong tiện ích; tác vụ AI đang dở vẫn cần đối chiếu, không tự phát lại.

**Lưu ý về dịch vụ:** [Cloudflare mô tả Quick Tunnel](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) dành cho thử nghiệm, không có bảo đảm thời gian hoạt động, giới hạn 200 yêu cầu đang diễn ra và không hỗ trợ SSE. Bộ nối MooZ dùng WebSocket, không dùng SSE. Để chạy thường xuyên, nên cấu hình tunnel có tên/hostname ổn định của Cloudflare và nhập WSS ở mục nâng cao. Không bật thử thách JavaScript hoặc email Access cho đường WSS của extension; bộ nối này không thực hiện đăng nhập tương tác Cloudflare Access.

**Kết nối và dữ liệu:** A chỉ mở thêm một cổng loopback riêng cho `/remote`, yêu cầu Origin extension và mã/khóa phiên hợp lệ; không chuyển tiếp giao diện app, tệp máy hay endpoint ghép cùng máy `/`. HTTPS/WSS có kiểm tra chứng chỉ; không có cờ bỏ xác minh TLS. Cloudflare là proxy TLS nên có thể đọc dữ liệu chuyển tiếp; đây không phải mã hóa đầu cuối giữa A và B. Chỉ dùng nếu bạn chấp nhận đưa dữ liệu workflow qua Cloudflare. Giới hạn 128 MB/thông điệp của bộ nối vẫn áp dụng.

### Nếu máy báo `command not found: brew`

Đó là chưa có Homebrew, không phải lỗi MooZ. Dùng nút **Tải cloudflared** ở bước 2, không cần chạy lệnh `brew`. Nếu cần cài riêng, xem [trang tải Cloudflare](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/). Máy có Homebrew có thể dùng `brew install cloudflared`, Windows có WinGet có thể dùng `winget install --id Cloudflare.cloudflared --exact`.

### Lỗi Cloudflare thường gặp

| Hiện tượng | Cách xử lý |
| --- | --- |
| Không tải được công cụ / GitHub giới hạn | Thử lại sau hoặc cài cloudflared từ trang chính thức rồi bấm Kiểm tra công cụ |
| SHA256 không khớp | Tệp không được cài/chạy; tải lại, không bỏ kiểm tra |
| Không đăng ký được tunnel / timeout cổng 7844 | Kiểm tra Internet, DNS và firewall cho cloudflared kết nối ra TCP 7844; app dùng HTTP/2 |
| Đường đã khởi động nhưng Chrome chưa vào được | Đợi DNS/edge sẵn sàng rồi thử mã còn hiệu lực; kiểm tra hai máy đang mở và quyền hostname |
| Tunnel bị ngắt / máy A ngủ | App thu hồi mã/phiên khi nhận thấy tunnel dừng; khởi động tunnel và ghép mã mới, đối chiếu kết quả đang dở |
| Nút sao chép bị mờ | Chưa xác nhận tunnel; Tải công cụ → Bắt đầu, xem thông báo hoặc bấm Kiểm tra đường truyền |
| Error 1033 ở URL cũ | Đối chiếu hostname với app. Dùng nút Sao chép địa chỉ kiểm tra; mỗi Quick Tunnel có địa chỉ riêng |
| Công cụ chạy nhưng kiểm tra lỗi 1033 | Chưa bật mã. Giữ cửa sổ app mở, kiểm tra mạng/công cụ; có thể bấm Kiểm tra đường truyền cùng địa chỉ sau khi xử lý |
| Your request was blocked trên máy Chrome | Mạng/máy ảo/edge đang từ chối truy cập từ máy đó. Nhờ bên quản trị kiểm tra và cho phép nếu phù hợp; không phải lỗi TTL mã |
| HTTPS đã xác nhận nhưng WebSocket chưa kết nối | Dán đúng mã hiện tại, kiểm tra quyền hostname của tiện ích và việc mạng hỗ trợ WSS; một kiểm tra HTTPS không chứng minh đường từ mọi máy đều được phép |

## Cách thay thế: Tailscale trên hai máy

### Cài Tailscale lần đầu

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

## Đường truyền Tailscale và giới hạn

Luồng: `MooZ (loopback) ↔ Tailscale Serve trên A ↔ WSS/TLS trong mạng riêng ↔ Workflow Connect trên B ↔ tab AI`. Dữ liệu tham chiếu và kết quả đi qua cùng bộ nối AI đang có; không gửi cookie Chrome hay khóa API của app sang máy B. Tailscale không phải máy chủ đăng bài và không thay thế quyền API của các nền tảng.

MooZ chỉ lắng nghe `127.0.0.1`; app không mở WebSocket thô lên `0.0.0.0`. Tiện ích chỉ chấp nhận mã từ xa chứa `wss://`; không có tùy chọn bỏ kiểm tra chứng chỉ hoặc hạ xuống `ws://`. Quyền HTTPS cho tên máy được xin khi người dùng bấm Kết nối, không cấp sẵn quyền tới mọi website. Bộ nối vẫn chỉ thao tác các tab Muse, ChatGPT và Gemini đã hỗ trợ.

Giới hạn hiện tại: tối đa 128 MB cho một thông điệp JSON và hàng chờ có giới hạn; base64 lớn hơn tệp gốc khoảng 1/3. Video/ảnh lớn phụ thuộc tốc độ hai đường mạng. Tệp vượt giới hạn sẽ báo lỗi, không được coi là hoàn tất. Các công cụ hậu kỳ vẫn có giới hạn tệp riêng trong app.

Tailscale Serve chạy nền nên giữ đường dẫn khi MooZ thoát, nhưng endpoint chỉ hoạt động khi app mở. App ghi nhớ cổng nội bộ để khởi động lại đúng đích. Nếu cổng bị chiếm, app vẫn cho dùng kết nối cùng máy và báo phải thiết lập lại từ xa; không tự báo đường cũ là sẵn sàng. Cấu hình lỗi được giữ nguyên cho tới khi người dùng chọn sao lưu và tạo lại.

## Nâng cao: WSS có sẵn

Có thể dùng reverse proxy/tunnel TLS do bạn quản lý. Mở mục nâng cao, nhập địa chỉ `wss://.../remote`; chuyển tiếp tới `http://127.0.0.1:<cổng từ xa riêng hiện trong mục nâng cao>`, hỗ trợ WebSocket Upgrade, giữ Origin và mã đóng kết nối. Cổng từ xa riêng chỉ nhận `/remote`, nên proxy phải bỏ prefix để chuyển đúng `/remote`. Cổng loopback cũ vẫn nhận cả `/remote` lẫn đường dẫn đầy đủ nhằm giữ tương thích cấu hình trước 0.50.0, nhưng nên chuyển sang cổng từ xa riêng để tránh chuyển tiếp endpoint cùng máy. Không đặt token vào URL WebSocket, không dùng HTTP/WS công khai và không bỏ kiểm tra TLS. Phải dùng một TLS endpoint bạn tin cậy; proxy TLS trên máy đó có thể đọc dữ liệu chuyển tiếp.

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


Kiểm thử Cloudflare bao gồm kiểm tra SHA256 trước khi thực thi, từ chối nguồn tải lạ, xử lý archive Mac chỉ lấy tệp thường `cloudflared`, hostname đầy đủ và trạng thái registered trước khi cho ghép, timeout/dừng/thoát tiến trình, thu hồi mã và hủy RPC khi tunnel mất kết nối, không phát lại tác vụ, không phục hồi URL tạm sau khi khởi động app. Bộ kiểm tra Electron mở giao diện thật và chạy tiến trình CLI fixture thật để thử tải/cài/start/copy clipboard/stop; metadata phát hành và đăng ký Cloudflare của bài đó được mô phỏng. Đã tải/kiểm tra công cụ Linux và archive Mac chính thức; chưa xác minh đường TryCloudflare qua Internet giữa hai máy người dùng. Các kiểm thử WSS/Chromium phía trên dùng TLS proxy cục bộ, không phải tunnel Cloudflare thật.


## Báo cáo và kiểm tra ở hai đầu (0.50.1 / Connect 1.2.2)

- **Máy MooZ:** Kiểm tra đường truyền gửi GET HTTPS qua tunnel tới `/remote/health?probe=<nonce>`; đối chiếu service/protocol, nonce và UUID phiên đang chạy. Lỗi 403 kết thúc kiểm tra ngay, không đổi hostname hay tự tìm đường vòng. Tạo mã chỉ được thực hiện sau kiểm tra thành công. Nếu kiểm tra ban đầu chưa thành công, công cụ có thể vẫn chạy để giữ URL phục vụ chẩn đoán; Dừng kết nối từ xa vẫn dùng được.
- **Sao chép địa chỉ kiểm tra** luôn lấy endpoint hiện tại từ host, chuyển WSS thành HTTPS, không chứa mã/khóa. Mở URL đó trên máy Chrome: `Upgrade Required` cho thấy tới bộ nối; Cloudflare 1033 cho thấy hostname không có tunnel hoạt động; thông báo bị chặn cần kiểm tra chính sách mạng/edge. Việc máy A truy cập được không chứng minh mạng máy B được phép.
- **Sao chép báo cáo kết nối** chứa version app/công cụ, trạng thái, hostname hiện tại, mã kết quả kiểm tra/HTTP và thời điểm; không có mã ghép cặp, khóa phiên, cookie hoặc nội dung AI. Có thể dán báo cáo khi cần hỗ trợ.
- **Extension 1.2.2:** nút Kiểm tra đường truyền chỉ kiểm tra HTTPS trên hostname đã được cấp quyền, không gửi thông tin xác thực, không đụng tab AI và không chạy lại công việc. Với app cũ trả 426, báo chưa có endpoint chẩn đoán; cần 0.50.1 để xác nhận đầy đủ. HTTPS thành công không thay thế kết nối WSS bằng mã.
- Kiểm thử mới có HTTP health thật trên cổng loopback, proxy TLS thật và Chromium extension thật: nonce/UUID chống nhận cache/sai phiên, 1033 không bật mã, 403 không thử lại vô hạn/đổi hostname, endpoint hiện tại/report clipboard, phân loại chặn ở extension nhưng giữ WSS đang hoạt động. Phản hồi của Cloudflare và AI vẫn là fixture; không xác nhận được chính sách mạng máy ảo người dùng từ môi trường phát triển.
