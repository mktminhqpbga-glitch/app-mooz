# MooZ Batch Studio — bản HTML xem trước

Mở **[mooz-batch-video-preview.html](../mooz-batch-video-preview.html)** trực tiếp bằng Chrome. Đây là bản xem trước riêng, chưa thay app đang cài.

- Chạy 13 sản phẩm mẫu trên 4 tab Muse mô phỏng; chọn thêm Gemini/ChatGPT theo từng bước.
- Tải/nhóm ảnh thật; chỉnh luồng, xem lỗi và chạy tiếp.
- Kho ảnh, âm thanh và video có tải tệp, lọc, đổi tên, bỏ khỏi kho; IndexedDB giữ tệp trên trình duyệt.
- Video AI là clip mẫu 12 giây. Hậu kỳ màu, âm lượng, kéo/cắt nhạc và xuất dùng media thật trong trình duyệt.
- Có thể chọn video của bạn từ kho để biên tập; xuất ngắn 1–3 giây để thử nhanh. MP4 tùy browser, có WebM.

Logic và giới hạn: [BATCH-VIDEO-STUDIO-PLAN.md](../../docs/BATCH-VIDEO-STUDIO-PLAN.md).

Nguồn: `index.html`, `style.css`, `model.js`, `webm-duration.js`, `app.js`, `assets/demo-video.mp4`. Không CDN, font mạng, analytics, token hay API key.

Tạo lại một HTML tự chứa:

```sh
node tools/build-batch-preview.cjs
```

Kiểm tra scheduler và bản HTML thực:

```sh
node --test tests/batch-video-preview.test.mjs
CHROMIUM_EXECUTABLE=/duong-dan/chrome node tests/batch-video-preview-smoke.cjs
```

Kiểm tra UI dùng Chromium/Playwright và FFmpeg/FFprobe trên máy, không gửi AI thật. Tệp `demo-video.mp4` là đồ họa hình học tự tạo bằng FFmpeg, có chữ DEMO; nhạc mẫu được tổng hợp bằng sóng sin trong mã, không dùng nhạc thương mại.
