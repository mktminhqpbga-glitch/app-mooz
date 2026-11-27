# Mooz Studio

Ứng dụng quản lý marketing tiếng Việt. Bản hiện tại lưu cài đặt, bản nháp, danh sách và đề xuất trên máy chủ. Các số liệu, chiến dịch và hội thoại ban đầu là dữ liệu mẫu. Chưa kết nối Meta, chưa đăng bài, nhận webhook, tạo tệp Custom Audience hay tạo/chỉnh sửa quảng cáo trên Facebook.

## Chạy ứng dụng

Cần Node.js 22 trở lên. Trong thư mục dự án chạy:

```sh
npm start
```

Mở http://127.0.0.1:3000. Dữ liệu lưu trong `data/store.json`. Để chọn cổng khác, dùng biến môi trường `PORT`. Máy chủ chỉ lắng nghe localhost, ứng dụng chưa có đăng nhập và chưa phù hợp để đưa ra Internet.

Nếu MacFlow đang sử dụng cổng 3000, chạy `PORT=3200 npm start` và mở `http://127.0.0.1:3200`.

## Kết nối AI và Meta

Trong **Cài đặt → Kết nối**, nhập địa chỉ API tương thích OpenAI, tên mô hình và khóa AI; dùng chung để soạn phản hồi Hộp thư và phân tích quảng cáo đã lưu. Nút **Thử AI** gọi `GET /models` để kiểm tra kết nối mà không gửi yêu cầu tạo nội dung. Có thể dùng API HTTPS hoặc HTTP ở `localhost`/`127.0.0.1`. Vẫn hỗ trợ biến môi trường cũ `AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY`.

Đối với Meta, nhập **Access Token** có quyền `ads_read` và **ID tài khoản quảng cáo** (ví dụ `act_123456789`). **Thử Meta** kiểm tra người dùng và tài khoản qua Graph API. Trong **Quảng cáo**, **Tải báo cáo thật** đọc tối đa 50 chiến dịch có dữ liệu trong ba ngày gần nhất qua Meta Marketing API v27.0 (chi tiêu, CTR, CPM, tần suất, hiển thị). Các số liệu minh họa được phân biệt rõ với báo cáo Meta và không được dùng thay số liệu Meta. App không tạo, đăng hoặc tắt quảng cáo. Các yêu cầu này chỉ chạy sau khi bạn bấm nút; không có đồng bộ tự động.

Các khóa được lưu riêng trong `data/connections.json`, quyền tệp `0600` trên macOS/Linux. API GET chỉ trả trạng thái kết nối và các trường không bí mật, không trả lại token/khóa đã lưu. Tệp chứa khóa **chưa mã hóa**: chỉ sử dụng ứng dụng trên máy cá nhân, không chia sẻ thư mục dữ liệu hoặc mở cổng ra mạng. Để xóa khóa, dùng thuộc tính `clearAiKey` / `clearMetaKey` trong `PUT /api/connections` hoặc xóa tệp cấu hình khi tắt app. Nên dùng token Meta có phạm vi quyền tối thiểu.

## Phạm vi tiếp theo

Ứng dụng vẫn chưa có xác thực người dùng, đồng bộ webhook, lịch chạy, tạo chiến dịch hoặc thực thi quy tắc tắt quảng cáo. Kết nối Meta phụ thuộc quyền `ads_read` và quyền trên tài khoản quảng cáo. Bản này chỉ đọc dữ liệu báo cáo theo thao tác người dùng.

## Meta Ads Scraper

Ứng dụng con nằm tại `apps/meta-ads-scraper`, lấy từ https://github.com/athm793/meta-ads-scraper (commit `737feee`), giấy phép Apache 2.0. Giấy phép và thông báo tác quyền được giữ trong thư mục ứng dụng con. Tệp `src/lib/browser.ts` đã được sửa để hỗ trợ biến `MOOZ_CHROMIUM_PATH` trỏ đến Chromium có sẵn.

Cài một lần bằng `npm run setup:scraper`, sau đó chạy `npm start` để khởi động Mooz Studio ở cổng 3000 và ứng dụng nghiên cứu ở cổng 3101. Cả hai chỉ lắng nghe trên máy cục bộ. Trong **Nghiên cứu quảng cáo**, Meta Ads Scraper được nhúng ngay trong Mooz qua `/research/` và các API của ứng dụng con được chuyển tiếp qua máy chủ Mooz; bạn không cần mở cổng 3101 bằng trình duyệt. Các màn hình nghiên cứu thông dụng đã được Việt hóa, các phần nâng cao có thể còn tiếng Anh. SQLite lưu riêng trong `apps/meta-ads-scraper/data`. Khi chạy bản production của Next.js, cần `npm --prefix apps/meta-ads-scraper run build` sau khi cập nhật mã nguồn ứng dụng con.

Trong mục Nghiên cứu quảng cáo của Mooz, nút phân tích gửi tối đa 20 quảng cáo đã lưu, ưu tiên quảng cáo chạy lâu, cùng thông tin sản phẩm đã cài đến nhà cung cấp AI. Các quảng cáo công khai không chứng minh được CPA, ROAS, lợi nhuận hay đối tượng nhắm mục tiêu của đối thủ. Kết quả phân tích cần được xem xét trước khi áp dụng.
