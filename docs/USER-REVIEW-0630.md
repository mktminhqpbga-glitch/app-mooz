# MooZ Studio — giao diện 0.63.0

Đã cài [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) bằng installer Codex chính thức vào `.agents/skills/`. Nguồn được chốt tại commit `713eef51b04efc98d6fa565323b495f7c9c89fd4`; thông tin cài nằm trong `ui-ux-pro-max/INSTALLATION.json`, kèm bản quyền MIT. Skill là công cụ phát triển trong repo, không phải phụ thuộc chạy của app.

Đã chạy generator thiết kế và tra cứu riêng product, typography, UX. Gợi ý pattern tự động thiên về landing page nên được điều chỉnh cho công cụ desktop; quy tắc đã chọn được ghi trong [design-system/mooz-studio/MASTER.md](../design-system/mooz-studio/MASTER.md).

## Thay đổi giao diện

- Cả năm không gian Thư viện, Canvas, Video hàng loạt, Đăng bài và Affiliate dùng font **Inter Variable** đi kèm app, không cần Google Fonts hay Internet. Font giữ nguyên từ upstream, kèm giấy phép SIL OFL.
- Thống nhất khoảng cách, tiêu đề, nút chính/phụ, đường viền, dialog và trạng thái focus. Điều hướng Đăng bài dùng SVG thay các ký hiệu rời rạc. Giữ theme sáng/tối/violet, cỡ chữ và màu tùy chỉnh đã lưu.
- Thư viện dùng ảnh đầu thẻ gọn hơn, tên dự án và hành động rõ. Canvas giữ diện tích làm việc và danh sách công cụ ở cửa sổ 1280×800; thanh timeline không tràn hay che nút.
- Video hàng loạt làm rõ khung soạn, các chế độ nhập, hàng đợi render và dock chạy. Kho tải lên/kết quả và xử lý tác vụ vẫn giữ dữ liệu riêng.
- Đăng bài giữ ba thẻ mỗi hàng trên desktop rộng, hai ở cửa sổ vừa, một ở cửa sổ hẹp; nội dung và nút thao tác không xếp chữ thành cột hẹp.
- Affiliate có khoảng cách rõ giữa nguồn, nội dung và kết quả; footer tiếp tục không che form. Cửa sổ hẹp và cỡ chữ lớn có bố cục tương ứng.

## Canvas không bắt buộc kéo chuột

Trong **Video hàng loạt → Luồng & tab AI**, dùng **Node đang chọn** để chọn một node, kể cả node ở ngoài vùng nhìn thấy. Node được đưa vào vùng nhìn được.

- **Di chuyển node:** bốn nút mũi tên hoặc nhập tọa độ X/Y. Nút giữ focus để bấm liên tiếp.
- Khi focus ở node trên canvas, phím mũi tên di chuyển 16 đơn vị; Shift + mũi tên di chuyển 64 đơn vị. App dịch khung nhìn khi cần để giữ node đang di chuyển trong vùng nhìn thấy.
- **Nối bằng danh sách:** chọn node nhận, mở mục này, chọn cổng nhận và node nguồn cùng loại, rồi bấm **Nối vào cổng đã chọn**. Kiểm tra loại dữ liệu và vòng lặp dùng cùng quy tắc với thao tác nối chuột; có thể hoàn tác.
- Cổng nối có vùng bấm 28px trước khi zoom. Dây từ đầu vào tùy chọn có nét đứt. **Vừa khung** dùng kích thước node thực tế, gồm cả cỡ chữ đang chọn.

Các thao tác này chỉnh vị trí hoặc dây nối của bản luồng đang sửa. Tác vụ đã xếp hàng tiếp tục giữ graph và đầu vào đã chốt. Cách chọn AI/model vẫn theo hướng dẫn 0.62.0: chọn nhà cung cấp/tab trong app; model là model đang chọn trong tab AI.

## Kiểm chứng

- Toàn bộ 398 unit test đạt.
- Electron thật: `desktop-studio-system-smoke.cjs` mở cả năm không gian, kiểm tra font local đã tải, không gọi CDN font, sáng/tối ở 1500/1008/640px, cỡ chữ lớn, reduced-motion, tương phản chữ, màu nhấn được giữ và không tràn ngang. Kiểm tra chọn node, nối bằng danh sách, nút/tọa độ/phím mũi tên, hoàn tác, giữ focus và giữ node trong vùng nhìn thấy.
- `desktop-layout-review-smoke.cjs`: tạo dự án, hành động thư viện trong vùng nhìn thấy, thanh công cụ đủ chỗ ở 1280×800, nút timeline hit-test được, resize/zoom, tìm công cụ bằng bàn phím, dialog màu, canvas 360px và Affiliate 640/800px.
- `desktop-ui-refresh-smoke.cjs`, `desktop-theme-smoke.cjs` và `desktop-flow-canvas-smoke.cjs`: các màn sáng/tối, bố cục ba thẻ, cài màu/khôi phục, lưu/nhân bản mẫu, form đầu vào, tác vụ riêng và đầu ra cục bộ.
- Workflow Mac chạy thêm bộ giao diện mới trong chế độ đóng gói nhanh; dùng runner Intel cụ thể để thay runner cũ bị hủy khi còn xếp hàng. Windows kiểm tra font local trong app đã cài, nút/phím di chuyển node, các picker hệ điều hành và cài/nâng cấp/gỡ bằng bộ cài thật.

Kiểm thử AI dùng phản hồi thử có kiểm soát và dữ liệu riêng. Không gửi AI trả phí hay đăng bài thật. MooZ Connect vẫn là **1.8.1**, giao thức kết nối không đổi. Chứng thư phát hành và các dịch vụ bên ngoài tiếp tục theo cấu hình hiện có. Bộ cài được cung cấp qua artifacts, không tạo GitHub Release.
