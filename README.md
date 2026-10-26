# MooZ Studio v1 — app tối giản, viết lại cho app-mooz

App mới, giao diện tối giản, rõ ràng, dễ dùng. Mở `app.html` trong trình duyệt
là dùng được, không cần build, không cần máy chủ.

## Luồng làm việc — chỉ 4 bước

1. **Kịch bản:** dán kịch bản tổng theo mẫu (`TÊN PHIM / NHÂN VẬT / BỐI CẢNH /
   CẢNH + Prompt ảnh / Prompt video`), bấm Phân tích kịch bản.
2. **Tạo nội dung:** sửa prompt từng shot, sao chép prompt video đã ghép
   (phong cách + nhân vật + prompt cảnh) sang tab Muse/Gemini/Veo/fal.ai
   của bạn, tải kết quả về.
3. **Duyệt & Hàng đợi:** duyệt shot, đánh dấu đã có video khi đã tải kết quả thật.
4. **Ghép & Timeline:** xem thứ tự shot và tổng thời lượng, ghép video thật
   bằng công cụ dựng của bạn theo đúng thứ tự này.
5. **Đăng bài:** soạn bản nháp, chọn nền tảng, hẹn giờ. Bản này chưa đăng thật.

Thêm: **Affiliate Shopee** (nhập link + dữ kiện thật, tạo 3 góc kể chuyện
theo mẫu — app không tự đọc Shopee, không tạo link affiliate) và
**Thương hiệu** (lưu tên, giọng văn, màu/phong cách trên máy).

## Làm được gì, và không làm gì

- Làm được: phân tích kịch bản, giữ nhân vật/phong cách nhất quán trong
  prompt shot, quản lý duyệt shot, tính tổng thời lượng, xuất/nhập dự án
  JSON, lưu dữ liệu trên máy (localStorage).
- Không tự làm: không gọi AI thật, không tạo video thật, không đăng bài
  thật, không đọc Shopee tự động. Mọi bước tạo/đăng thật đều do bạn bấm
  và kiểm tra.

## Lịch sử

Bản Workflow đầy đủ trước đây (MuseFlow 0.39.0, canvas node, Electron,
đăng bài đa nền tảng, Affiliate Shopee đầy đủ) vẫn còn trong lịch sử Git
của repo này ở commit `b74502b` và nhánh `film-canvas` (commit `0c07b97`).
Muốn khôi phục bản cũ: checkout commit đó. Bản mới này cố tình tối giản
để dễ dùng, không thay thế toàn bộ tính năng cũ trong một lần viết lại.

## Kiểm thử nhanh

```sh
node --check studio.js
```

Mở `app.html`, bấm “Dùng kịch bản mẫu” ở bước Kịch bản, rồi Phân tích
kịch bản — phải thấy 2 shot, đồ thị phim ở Tổng quan, và tổng 10 giây.
