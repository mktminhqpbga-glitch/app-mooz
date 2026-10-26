# Film Canvas — đồ thị làm phim kiểu Infinite Canvas

## Đây là gì

Film Canvas là lớp đồ thị làm phim đặt trên app-mooz hiện có, học ý tưởng từ
Infinite Canvas nhưng **không copy code của project đó**:

- Đồ thị: **Phim → Nhân vật / Phong cách → Cảnh → Shot**, dây nối thể hiện
  shot nào dùng nhân vật và phong cách nào, để prompt giữ nhất quán giữa các shot.
- **Tự xếp layout** theo luồng (cột = đường dài nhất từ gốc), **minimap** SVG
  tổng quan đồ thị, **xuất/nhập JSON** (`film-canvas.json`, version 1).
- **Phân tích kịch bản tổng** theo đúng mẫu sẵn có của app
  (`TÊN PHIM / NHÂN VẬT / BỐI CẢNH / HỒI-CHƯƠNG / PHẦN / ĐOẠN / CẢNH +
  Prompt ảnh / Prompt video / Audio`) thành đồ thị, rồi ghép prompt shot từ
  phong cách + nhân vật + prompt cảnh + máy quay + âm thanh.
- Shot có thời lượng 1–60 giây, tỷ lệ 9:16 / 16:9 / 1:1 / 4:3 / 3:4.

## Cách dùng

1. Trên thanh công cụ canvas, bấm **Canvas phim**.
2. Dán kịch bản tổng, bấm **Phân tích kịch bản**. Kiểm tra danh sách shot
   và minimap trước khi làm gì tiếp.
3. Bấm **Xuất JSON** để lưu đồ thị, hoặc **Nhập JSON** để mở lại đồ thị cũ.
4. Copy prompt shot từ panel để dùng với node tạo ảnh/video sẵn có của app.

## Giới hạn — nói rõ, không hứa quá

- Panel này **chỉ chuẩn bị đồ thị và prompt**. Nó không tự gửi AI, không tự
  chạy video, không tự tạo node trên canvas chính, không có sân khấu 3D
  (director stage) như Infinite Canvas bản đầy đủ, và không bảo đảm AI giữ
  khuôn mặt/trang phục chính xác tuyệt đối — giống giới hạn đã ghi ở
  `docs/MASTER-STORY.md`.
- Tối đa 1000 node, kịch bản tối đa 500.000 ký tự, mỗi shot phải nối tới
  ít nhất một scene, đồ thị không được có chu trình. Vi phạm sẽ báo lỗi
  rõ ràng thay vì tạo đồ thị nửa vời.
- Tính năng này sống ở `film-canvas.js` + `film-canvas.css`, nạp trước
  `app.js`. Logic thuần túy nên test được bằng Node mà không cần trình duyệt.

## Kiểm thử

```sh
node --check film-canvas.js
node --test tests/film-canvas.test.mjs
```

Test bao phủ: phân tích kịch bản, prompt shot dùng lại nhân vật/phong cách,
layout đặt shot sau scene, xuất/nhập JSON, và các lỗi (shot mồ côi, thời
lượng sai, chu trình, kịch bản không có cảnh).

## Nguồn và giấy phép

- Gốc app-mooz: GPL-2.0-or-later (xem `LICENSE`, `THIRD_PARTY_NOTICES.md`).
- Ý tưởng Infinite Canvas: project gốc dùng giấy phép MIT; ở đây chỉ học
  ý tưởng (node dùng lại, tự xếp, minimap, xuất/nhập), code trong file này
  là code viết mới, không sao chép mã nguồn của project đó.
