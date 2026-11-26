# Mooz Studio

Ứng dụng quản lý marketing tiếng Việt. Bản hiện tại lưu cài đặt, bản nháp, danh sách và đề xuất trên máy chủ. Các số liệu, chiến dịch và hội thoại ban đầu là dữ liệu mẫu. Chưa kết nối Meta, chưa đăng bài, nhận webhook, tạo tệp Custom Audience hay tạo/chỉnh sửa quảng cáo trên Facebook.

## Chạy ứng dụng

Cần Node.js 22 trở lên. Trong thư mục dự án chạy:

```sh
npm start
```

Mở http://127.0.0.1:3000. Dữ liệu lưu trong `data/store.json`. Để chọn cổng khác, dùng biến môi trường `PORT`. Máy chủ chỉ lắng nghe localhost, ứng dụng chưa có đăng nhập và chưa phù hợp để đưa ra Internet.

## Kết nối AI tùy chọn

Cấu hình `AI_BASE_URL` là URL HTTPS của API tương thích OpenAI, ví dụ `https://api.openai.com/v1/`, `AI_MODEL` là tên model, và `AI_API_KEY` là khóa bí mật trong môi trường chạy. Khởi động lại máy chủ sau khi cấu hình. Tính năng soạn phản hồi trong Hộp thư sẽ gửi câu hỏi và thông tin sản phẩm đã cài đến dịch vụ AI. Câu trả lời chỉ hiển thị trong app và không gửi cho khách.

## Phạm vi tiếp theo

Cần triển khai xác thực người dùng, quản lý token Meta, Graph API, webhook được xác thực, lịch chạy, hàng đợi có thể thử lại, quy trình duyệt và thực thi quảng cáo với giới hạn ngân sách phía máy chủ. Việc kết nối phụ thuộc quyền Meta, phiên bản API và tài sản của doanh nghiệp.

## Meta Ads Scraper

Ứng dụng con nằm tại `apps/meta-ads-scraper`, lấy từ https://github.com/athm793/meta-ads-scraper (commit `737feee`), giấy phép Apache 2.0. Giấy phép và thông báo tác quyền được giữ trong thư mục ứng dụng con. Tệp `src/lib/browser.ts` đã được sửa để hỗ trợ biến `MOOZ_CHROMIUM_PATH` trỏ đến Chromium có sẵn.

Cài một lần bằng `npm run setup:scraper`, sau đó chạy `npm start` để khởi động Mooz Studio ở cổng 3000 và ứng dụng nghiên cứu ở cổng 3101. Cả hai chỉ lắng nghe trên máy cục bộ. Khi dùng máy chủ từ xa, địa chỉ localhost trên trình duyệt của người dùng là máy người dùng, do đó cần cấu hình truy cập riêng cho ứng dụng con. Ứng dụng con dùng giao diện tiếng Anh và lưu SQLite riêng trong `apps/meta-ads-scraper/data`.

Trong mục Nghiên cứu quảng cáo của Mooz, nút phân tích gửi tối đa 20 quảng cáo đã lưu, ưu tiên quảng cáo chạy lâu, cùng thông tin sản phẩm đã cài đến nhà cung cấp AI. Các quảng cáo công khai không chứng minh được CPA, ROAS, lợi nhuận hay đối tượng nhắm mục tiêu của đối thủ. Kết quả phân tích cần được xem xét trước khi áp dụng.
