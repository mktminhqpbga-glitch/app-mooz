# Rà soát sản phẩm · MooZ Agent 0.58.0

Ngày kiểm tra: 01/11/2026. Tiện ích đi kèm: **MooZ Connect 1.8.0**, giao thức 1.

Đối chiếu tài liệu góp ý người dùng với app Electron chạy thật. Một số nhận xét dựa trên markup hoặc phiên bản cũ; bảng dưới phân biệt phần đã sửa, hành vi đã có và phần cần cấu hình phát hành thực tế.

| Góp ý | Xử lý / kết quả |
| --- | --- |
| Tên Workflow / MooZ / MuseFlow lẫn nhau | Bộ cài, cửa sổ, thanh desktop, tiện ích, tệp tải và thông báo chính dùng MooZ Agent / MooZ Connect; thêm biểu tượng MooZ cho bộ cài và cửa sổ. |
| Batch khác màu các màn khác | Batch dùng cùng giao diện toàn app; đổi sáng/tối tại Batch đồng bộ sang Thư viện, Canvas, Đăng bài và Affiliate. |
| Thiếu quy chuẩn khoảng cách, nút, thẻ | Thêm `desktop/design-system.css` dùng chung sau theme: khoảng cách, bo góc, cỡ điều khiển, focus, màu ngữ nghĩa và dialog. Màu từng bề mặt vẫn sửa được trong Giao diện. Các khối CSS timeline cũ còn được giữ; chưa tuyên bố đã viết lại toàn bộ stylesheet. |
| Thanh công cụ canvas quá dài | Runtime đã có sidebar tìm công cụ từ bản trước. Bản này ẩn thanh markup cũ trước khi sidebar khởi tạo, tránh nháy hàng nút cũ; nút chạy/lưu vẫn trực tiếp. |
| Nhiều cửa sổ, mất tên thương hiệu | Giữ cửa sổ tác vụ độc lập để theo dõi công việc; menu Chuyển màn hình chung có bốn lối vào và danh sách cửa sổ/trạng thái đang chạy. Tiêu đề dự án kèm MooZ Agent. **Chưa chuyển sang kiến trúc tab trong một cửa sổ.** |
| Không thu nhỏ được | Cả năm màn cho phép rộng 640 px, cao 520 px. Đã đo thực tế ở 640 px; không tràn ngang tài liệu. |
| Kết nối mạng xã hội quá kỹ thuật | Thu gọn hướng dẫn token/cấu hình vào phần nâng cao; Facebook hiển thị ngay lý do chưa đăng nhập được. **Dịch vụ OAuth, ứng dụng Meta và quyền thật vẫn cần bên phát hành thiết lập.** YouTube/TikTok còn cần cấu hình nhà cung cấp tương ứng, chưa trở thành đăng nhập một chạm được cấp sẵn. |
| Tiện ích chưa lên Chrome Web Store | Thêm cấu hình URL Store được xác thực. Khi chưa có trang thật, hiển thị đúng hướng dẫn ZIP đi kèm thay vì giả lập Store; khi đã cấu hình, nút cài đặt/cập nhật mở trang Store. **Chưa có listing được duyệt.** |
| Phiên bản khó hiểu | Hiển thị phiên bản app và tiện ích thực; manifest gốc và ZIP đều 1.8.0. Xóa hướng dẫn tĩnh 1.5.0 khỏi mặt tiền Shopee. Kiểm tra tương thích tối thiểu vẫn giữ bên trong. |
| Save / Delete / Run… chưa dịch | Dịch các nhãn, tooltip và menu canvas được nêu trong góp ý; bảo toàn ID/giao thức dữ liệu. |
| Di sản MuseFlow trong giao diện | Thay nội dung, tiền tố lỗi, tooltip và tên tệp tải hiện cho khách. Định dạng dự án, appId, khóa lưu dữ liệu và đường tải cũ còn giữ để tương thích. |
| Lồng tiếng trông như app chưa hoàn thiện | Chuyển sang nhóm Công cụ trong dự án, ghi rõ Lồng tiếng trong canvas và dùng OpenAI API; bỏ lời hứa app riêng chưa tích hợp. |
| Lấy ảnh Shopee bị khóa không rõ lý do | Có hướng dẫn ngay cạnh nút: kết nối Chrome/chọn tab sản phẩm hoặc nhập link; cập nhật khi đổi nguồn/tab, kể cả khi thao tác thất bại. |
| Facebook có nút xám trống lý do | Giải thích thiếu dịch vụ đăng nhập và chưa có/chưa chọn Page; chỉ bật nhập Page khi có Page hợp lệ được chọn. |
| Không có đường về Soạn bài | Thêm Soạn bài vào nav chính; bấm quay về đúng danh sách bản nháp. |
| Popup chứa nhiều thuật ngữ vận hành | Đổi tên MooZ Connect, hướng dẫn giữ app/Chrome hoạt động và trạng thái kết nối; bỏ tunnel/Tailscale/máy ảo khỏi chân trang chính. Công cụ chẩn đoán kỹ thuật vẫn giữ. |
| Không biết AI sẵn sàng hay chưa | Có câu tổng hợp đang kiểm tra/sẵn sàng/thiếu kết nối bên dưới chip AI, cập nhật cùng kiểm tra tự động. Không xem chỉ có tab mở là đã đăng nhập thành công. |
| Nút canvas chỉ có biểu tượng, phím tắt sai OS | Thêm nhãn và ARIA cho kéo nền, nhóm, zoom; tooltip và bảng lệnh dùng Ctrl trên Windows/Linux, ⌘ trên Mac. Khi cửa sổ hẹp giữ biểu tượng/ARIA để đủ chỗ. |
| Số 0/trống trước khi tải | Dùng trạng thái đang mở/… cho bộ đếm ban đầu thay vì dữ liệu 0 giả; vùng Batch có trạng thái tải. |
| Bấm Kết nối Chrome làm đóng hướng dẫn | Chặn hành vi mặc định/lan truyền của nút trong summary. Kiểm tra bấm mở/đóng ba lần liên tiếp, hướng dẫn không đổi trạng thái. |
| Canvas mới/trống thiếu hướng dẫn | Dự án mới vốn đã có luồng mẫu thật; thêm lời mời và nút tạo node/dùng mẫu cho graph thực sự trống, không phủ lên dự án có dữ liệu hoặc dữ liệu hỏng. |

Dialog cài đặt đã có cuộn và các màn khác đã có empty state: giữ hành vi đúng, không tạo chức năng trùng.

## Bằng chứng kiểm thử

- Unit: nhận diện sản phẩm, bảo toàn thư mục dự án cũ, kiểm tra URL phân phối, ZIP/manifest đồng nhất cùng các bộ kiểm tra hiện có.
- Electron: năm cửa sổ dùng chung theme; đo chiều ngang thực tại 640 px; kiểm tra theme Batch đồng bộ toàn app; cài tiện ích/phiên bản thật; kết nối Chrome lặp ba lần; mẫu dự án/graph trống; điều hướng Soạn bài và Chuyển màn hình; lý do nút Shopee/Facebook bị khóa.
- Các kiểm tra chức năng giữ nguyên: chọn nhiều Page, token mã hóa, hàng đăng không gửi trùng; sản phẩm/ảnh riêng; FFmpeg xuất MP4 thật; relay và nhiều Chrome; nhân bản canvas; tác vụ Muse nhận kết quả có đối chiếu mã lượt.
- Các phản hồi AI/Meta/mạng xã hội dùng fixture. **Chưa kiểm thử tài khoản khách, đăng bài thật hoặc trình duyệt máy ảo Muse của người dùng trong lượt này.**
- Ảnh và số đo từ `tests/desktop-product-review-smoke.cjs` nằm trong artifact **MooZ-UI-review** của bản đóng gói Mac; Windows có artifact kiểm tra app đã đóng gói riêng.

## Cấu hình trước khi phân phối cho khách

`desktop/distribution.json` có hai giá trị công khai, mặc định `null`:

- `chromeWebStoreURL`: URL listing thật dạng `https://chromewebstore.google.com/detail/<tên>/<id>` sau khi được duyệt.
- `metaOAuthURL`: URL gốc HTTPS của dịch vụ `services/meta-auth`, sau khi triển khai và cấu hình ứng dụng/quyền Meta thực tế. Không đặt secret hay token trong tệp này.

Nếu chưa có hai dịch vụ trên, app nói rõ cần cài ZIP thủ công và Facebook chưa được nhà cung cấp cấu hình. Không thể gọi đây là bản đã hoàn tất toàn bộ onboarding thương mại chỉ nhờ giao diện mới.

Bộ cài hiện là bản chưa ký số/notarize. Kênh đóng gói chạy với `--publish never`, không tự tạo hay xuất bản GitHub Release. Windows tải/cài bản mới thủ công; bản Mac chỉ tự kiểm tra/cập nhật khi có kênh phát hành phù hợp.

Giữ `com.museflow.workflow`, giao thức `workflow://`, thư mục dữ liệu cũ, khóa lưu và định dạng dự án để nâng cấp không tạo một thư viện trống. Đóng app Workflow cũ trước khi mở MooZ Agent; kiểm tra dự án trên máy thật trước khi xóa bộ cài cũ.

Giấy phép dự án hiện là GPL-2.0-or-later; giữ LICENSE và THIRD_PARTY_NOTICES cùng mã nguồn tương ứng khi phân phối theo giấy phép này. Phần đổi nhận diện không thay thế giấy phép của các thành phần nguồn mở.
