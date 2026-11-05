# MooZ Studio — giao diện công cụ sáng tạo

Áp dụng cho Thư viện dự án, Canvas, Video hàng loạt / Luồng A–Z, Đăng bài, Affiliate và các dialog dùng chung. Nền tảng thực tế: Electron + HTML/CSS/JavaScript, không chuyển framework.

Từ 0.69, bố cục tham khảo các ảnh LibTV người dùng cung cấp cho toàn app: nền than trung tính, rail biểu tượng hẹp, thanh điều hướng gọn, media và nội dung là vùng chính. Không dùng dashboard nhiều ô số liệu hoặc hình workflow trang trí. `desktop/studio-foundation.css` là lớp giao diện chung; mỗi workspace giữ CSS bố cục riêng.

## Nguồn và quyết định

Dùng UI UX Pro Max cài ở `.agents/skills/ui-ux-pro-max`, nguồn/commit ghi trong `INSTALLATION.json`.

- Đã chạy `--design-system` cho `photo video editor professional`, rồi thử hẹp lại `desktop workflow dashboard`. Các phần Pattern đều thiên về landing page/enterprise gateway nên không chép/persist các bố cục đó vào app. Bố cục bên dưới là điều chỉnh cho công cụ desktop, không phải một mẫu dashboard khớp hoàn toàn từ generator.
- Kết quả đã đối chiếu: domain `product`, query `photo video editor`: **Short Video Editor**, **Photo Editor & Filters**; hướng Minimalism & Swiss Style, editor tối và preview media rõ.
- Domain `typography`, query `Inter professional`: **Minimal Swiss** (Inter/Inter), phù hợp dashboard và công cụ chuyên nghiệp. Font Inter local, không dùng Google Fonts CDN.
- Domain `ux`: **Dragging Movements**, **Focus Not Obscured (Minimum/Enhanced)**. Dùng nút di chuyển + tọa độ + phím mũi tên thay cho yêu cầu phải kéo; giữ focus trong vùng nhìn thấy.
- Không có stack Electron/vanilla CSS trong catalog. Tham khảo phần focus HTML trong `html-tailwind` rồi triển khai bằng CSS gốc; không cài Tailwind.

## Phong cách

Bề mặt trung tính, đường viền mảnh, màu nhấn thương hiệu của người dùng; không gradient trang trí hay hiệu ứng kính. Giữ theme/size/màu tùy chỉnh đã lưu. Thanh điều hướng nhẹ, vị trí được chọn rõ; một hành động chính trong mỗi vùng thao tác.

- Font: Inter Variable, fallback Arial/system sans-serif. Body 15px, control 13–14px; mô tả 12–13px; heading 24–28px. Cỡ lớn dùng token riêng, hỗ trợ tiếng Việt.
- Spacing 4/8/12/16/24/32px. Border radius 8px cho control, 12–16px cho card/dialog. Nút desktop từ 36px, thao tác chính 40px; pointer coarse từ 44px. Cổng canvas có hit area 28px với chấm hiển thị nhỏ bên trong.
- Màu: token `--mooz-*` hiện có là nguồn chuẩn. Foreground được tính theo tương phản, không ép màu trắng lên màu nhấn tùy chọn. Normal text >=4.5:1; focus và control có ý nghĩa >=3:1.
- SVG outline thống nhất; icon trang trí ẩn với screen reader; nút chỉ có icon luôn có tên truy cập. Không dùng emoji làm icon cấu trúc.
- Hover/pressed thay đổi màu/viền, không nhảy kích thước; reduced-motion tắt chuyển động. Focus-visible rõ, form giữ nhãn và lỗi cạnh trường.

## Theo màn

- **Thư viện:** rail 72 px, header và lối mở Canvas Studio rõ, gallery dự án thật, hướng dẫn thu gọn. Không tự tạo ảnh xem trước nếu dự án chưa có media.
- **Canvas Studio 0.68:** tham khảo bố cục media trên canvas của LibTV: thẻ ảnh/video là nội dung chính, nền than trung tính, header dự án mảnh và dock công cụ phía dưới. Thiết lập nằm trong inspector; thanh công cụ hiện theo node/nhóm được chọn. Hàng đợi là ngăn bên không khóa canvas. Thông báo nằm dưới thanh ngữ cảnh, không che nút. Giữ graph/cổng có kiểu và bộ chạy thật; không thêm nút AI khi chưa có bộ xử lý. Kho nhân vật cá nhân, mẫu luồng và bản chỉnh ảnh dùng dữ liệu thật.
- **Video hàng loạt:** rail 68 px, prompt nổi giữa không gian media, nút gửi nằm trong khung soạn, hàng đợi mảnh bên phải. Luồng, kho media và hậu kỳ dùng cùng thiết kế; giữ engine và kho dữ liệu thật.
- **Luồng A–Z:** phân biệt đầu vào/xử lý/kết quả bằng nhãn và màu; cổng optional có nét đứt, có lựa chọn node/tọa độ/nút di chuyển và phím mũi tên. Giữ nguyên graph và bản chốt của tác vụ.
- **Đăng bài:** mỗi bài là một vùng soạn với media lớn và caption bên cạnh; rail icon, tổng quan dùng thành phẩm và lịch thật. Thương hiệu, tài khoản và lịch đồng nhất, không dùng lưới ba card dashboard cũ.
- **Affiliate:** vùng ảnh sản phẩm và phân cảnh là nội dung chính; nguồn và lịch sử là ngăn mở khi cần. Thông báo lỗi ở ngoài ngăn nguồn để luôn thấy.
- **Dialog/cài đặt:** tiêu đề và nhãn rõ, footer có khoảng trống, không giấu focus dưới phần cố định.

## Kiểm chứng

Mở cả năm workspace Electron với dữ liệu thử, sáng/tối/violet, 1500/1008/640px, cỡ chữ lớn và reduced-motion. Kiểm tra local font thật, màu tương phản, không tràn ngang, input/dialog/focus, chọn/nối/di chuyển node không cần kéo, giữ dữ liệu khi đổi màn/mở lại. Không gửi AI trả phí hoặc đăng bài thật.
