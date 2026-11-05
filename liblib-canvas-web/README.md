# Canvas Studio Web

Website canvas độc lập, lấy cảm hứng từ bố cục và cách thao tác của [LibLib Canvas](https://www.liblib.tv/canvas). Đây là mã nguồn mới, không sử dụng mã nguồn hoặc API riêng của LibLib.

## Chạy

```bash
cd liblib-canvas-web
npm start
```

Mở `http://localhost:4173`. Chỉ cần Node.js 20 trở lên; không có bước cài dependency cho website. Dữ liệu dự án, prompt, ảnh, video và nhân vật được lưu trong IndexedDB của trình duyệt. Có thể xuất/nhập từng dự án bằng JSON (kèm tài sản đã tải lên) qua menu dự án.

## Chức năng

- Canvas tối với lưới chấm, kéo nền, phóng to bằng Ctrl/⌘ + cuộn, vừa khung, kéo/chọn nhiều/nhân bản/nhóm/xóa nút, nối nút bằng cổng hai bên.
- Nút ảnh, video, văn bản và nút tạo; xem ảnh/video, sửa văn bản và prompt, menu ngữ cảnh và thanh công cụ khi chọn.
- Khung prompt nổi có tham chiếu từ canvas, thư viện prompt dùng chung giữa các dự án, nhân vật, tỉ lệ và chế độ ảnh/video.
- Hàng đợi lưu yêu cầu và cho phép gắn file kết quả thật. Thư viện tài sản, thư viện nhân vật, nhiều dự án, tự động lưu và xuất/nhập JSON.
- Bố cục dùng được trên desktop, tablet và điện thoại.

Việc tạo ảnh/video tự động **cần một dịch vụ AI có quyền truy cập riêng**. Website không giả lập kết quả AI. Nếu muốn kết nối, gán `window.CANVAS_RENDER_ADAPTER` trước khi gửi yêu cầu; hàm nhận `{mode, prompt, ratio, duration, references}` và trả về `Blob`, `File`, hoặc URL tải được (CORS cho phép). Ví dụ:

```js
window.CANVAS_RENDER_ADAPTER = async (request) => {
  const response = await fetch("/api/render", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.blob();
};
```

Nếu chưa kết nối adapter, yêu cầu vào hàng đợi và nút **Gắn kết quả** cho phép tải ảnh/video tạo ở nơi khác. Không đưa khóa API trực tiếp vào JavaScript trình duyệt.

## Nghiên cứu và giới hạn đối chiếu

Đã dùng CLI của [storytold/craft-anything](https://github.com/storytold/craft-anything) theo chu trình quan sát → dựng → kiểm tra. Route `/canvas` của LibLib chuyển khách chưa đăng nhập về trang chủ, nên đối chiếu giao diện dựa trên ảnh người dùng cung cấp trong cuộc trò chuyện. Những tính năng riêng của LibLib như model nội bộ, AutoLink, chỉnh phần tử bằng AI hay thư viện nhân vật chính thức không thể chạy nếu không có dịch vụ của họ. UI này cung cấp các thao tác tương ứng trong phạm vi website độc lập.

Hai ảnh minh họa ban đầu được tải từ [Unsplash](https://unsplash.com/) (`photo-1534528741775-53994a69daeb` và `photo-1539109136881-3be0616acf4b`); chỉ dùng để trình bày bản dựng, có thể thay bằng ảnh của bạn.

## Kiểm tra

```bash
npm test
```

Kiểm tra trình duyệt dùng Playwright đã có tại workspace phát triển; nếu chạy ở máy khác cần cài `playwright` và trình duyệt Chromium cho bộ kiểm tra. Website không phụ thuộc Playwright.

## Đưa lên mooz.gt.tc

Workflow **Cập nhật website Canvas** trong GitHub Actions đăng website tĩnh lên GitHub Pages khi bấm **Run workflow**. Không cần FTP. Sau khi kích hoạt Pages trong **Settings → Pages → Build and deployment: GitHub Actions**, website có địa chỉ `https://mktminhqpbga-glitch.github.io/app-mooz/`. Để dùng `mooz.gt.tc`, cần đặt custom domain này trong Settings → Pages và đổi bản ghi DNS của tên miền thành CNAME trỏ tới `mktminhqpbga-glitch.github.io`. Tên miền hiện trỏ tới hosting khác, nên bước DNS cần được thực hiện ở nơi quản lý `gt.tc`.
