# MooZ Studio — giao diện công cụ sáng tạo

Áp dụng cho Thư viện dự án, Canvas, Video hàng loạt / Luồng A–Z, Đăng bài, Affiliate và các dialog dùng chung. Nền tảng thực tế: Electron + HTML/CSS/JavaScript, không chuyển framework.

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

- **Thư viện:** header ngắn, hướng dẫn thu gọn được, card dự án và hành động rõ, ảnh trang trí không lấn nội dung.
- **Canvas:** canvas là vùng chính, node có header/body rõ và cổng đủ dễ bấm; thanh công cụ không che vùng làm việc.
- **Video hàng loạt:** khung soạn + hàng đợi, dock chạy giữ đúng khoảng trống; kho tải lên/kết quả tách riêng; card media không tràn nút.
- **Luồng A–Z:** phân biệt đầu vào/xử lý/kết quả bằng nhãn và màu; cổng optional có nét đứt, có lựa chọn node/tọa độ/nút di chuyển và phím mũi tên. Giữ nguyên graph và bản chốt của tác vụ.
- **Đăng bài:** ba card mỗi hàng trên desktop rộng; nội dung và hành động chính luôn thấy, tùy chọn trong disclosure, không xếp chữ dọc thành nút hẹp.
- **Affiliate:** nguồn ở bên trái, nội dung ở bên phải, chân panel không che điều khiển; trên cửa sổ hẹp chuyển thành một cột cuộn được.
- **Dialog/cài đặt:** tiêu đề và nhãn rõ, footer có khoảng trống, không giấu focus dưới phần cố định.

## Kiểm chứng

Mở cả năm workspace Electron với dữ liệu thử, sáng/tối/violet, 1500/1008/640px, cỡ chữ lớn và reduced-motion. Kiểm tra local font thật, màu tương phản, không tràn ngang, input/dialog/focus, chọn/nối/di chuyển node không cần kéo, giữ dữ liệu khi đổi màn/mở lại. Không gửi AI trả phí hoặc đăng bài thật.
