# Workflow Connect 1.0.0 · App 0.39.1

## Tiện ích chỉ kết nối Chrome

Bấm biểu tượng tiện ích để mở một bảng nhỏ: mã kết nối, Kết nối/Ngắt kết nối, trạng thái và thông báo bản mới. Không còn mở canvas hay cài kèm giao diện Workflow, thư viện FFmpeg, dữ liệu và mẫu. Mọi dự án, node, AI, xử lý video và hàng chờ đăng bài nằm trong app desktop. ZIP khoảng 64 KB.

Giải nén `downloads/Workflow-extension.zip`, vào `chrome://extensions`, bật Chế độ nhà phát triển và chọn thư mục có `manifest.json`. Khi thay tiện ích đang dùng, có thể ghi đè thư mục cũ rồi bấm tải lại tiện ích. Sau thay đổi bộ nối AI, dừng lượt cũ và tải lại các tab Muse/Gemini/ChatGPT để chúng nhận bộ nối mới.

Trong app, bấm Kết nối Chrome, sao chép mã và dán vào tiện ích. Giữ app, Chrome và các tab AI mở khi chạy. Mã chỉ có hiệu lực cho phiên app hiện tại.

## App và tiện ích có phiên bản riêng

App 0.39.1 dùng Workflow Connect 1.0.0. Hai số phiên bản không cần trùng. Giao thức kết nối là 1; kiểm tra phiên bản giao thức và khả năng của từng bộ nối AI thay vì so số phiên bản app/tiện ích. App 0.39.x và các bản sau giữ giao thức phù hợp có thể dùng chung tiện ích.

Không thể cam kết mọi bản app cũ hoặc giao thức tương lai đều tương thích. Bản quá cũ thiếu giao thức nhận kết quả cần nâng app; bộ nối còn lưu trên tab có thể cần tải lại tab. App không tự gửi lại prompt để khắc phục mất kết nối.

Tiện ích kiểm tra metadata bản phát hành riêng trên GitHub, lưu bộ nhớ đệm 24 giờ. Khi đang kết nối, dùng nhịp giữ kết nối sẵn có để kiểm tra lại; lỗi mạng có khoảng nghỉ một giờ. Có phiên bản mới thì hiện dấu ↑ trên biểu tượng và liên kết tải trong bảng kết nối. Không gửi mã ghép nối, nội dung chat, cookie hoặc token tới nơi kiểm tra cập nhật. Bản tải thủ công/unpacked chỉ thông báo, người dùng tự thay tệp và tải lại tiện ích; đây không phải tự cài qua Chrome Web Store.

Phát hành app mới bằng `version:app` không đổi phiên bản tiện ích. Khi sửa mã tiện ích/bộ nối cần phát hành lại: tăng `manifest.json.version` và `extension/companion-release.json.version`, cập nhật protocol nếu thay hợp đồng, chạy kiểm thử rồi `npm run package:extension`.

## Sửa AI và video trong app

- Muse được chọn cho văn bản ở node Tạo văn bản, Chat AI, viết kịch bản, viết content đăng bài và biên tập Affiliate, cùng Gemini/ChatGPT theo khả năng tương ứng. API vẫn cần cấu hình riêng; lồng tiếng cần dịch vụ có đầu ra âm thanh.
- Muse gửi/nhận văn bản theo đúng tin nhắn vừa gửi, chờ hết streaming và nội dung ổn định, giữ đoạn xuống dòng. Có chờ gửi/Gửi ngay, dừng và khôi phục thủ công. Giao thức văn bản Muse là 1, bridge cũ thiếu khả năng này bị chặn trước gửi.
- Cổng Video gốc/Video tham chiếu nhận video từ node Video đầu vào. Muse chỉ gửi khi ô tải tệp nhận được loại video, đợi upload xong, gửi một lần; video nguồn không được nhận nhầm là kết quả. Không bảo đảm mọi model/tài khoản Muse đều đọc hay dựng được video tham chiếu. Gemini tab/Google API đọc video theo adapter hiện có; API không hỗ trợ loại đầu vào sẽ báo rõ.
- Node có đầu ra ảnh/video luôn có nút Thêm vào hàng chờ. Khi chưa tạo được tệp, đang chạy hoặc kết quả cần làm mới, nút bị khóa và ghi lý do. Kết quả hoàn tất được chép vào bản nháp Đăng bài; chưa tự đăng.
- Thời lượng đã chọn là yêu cầu, không làm tệp cũ dài ra. Node hiển thị thời lượng clip thực tế bên cạnh mục tiêu và lưu yêu cầu của từng lượt tạo. AI có thể trả clip 10 giây dù được yêu cầu 40 giây.
- **Công cụ → Tiếp nối đủ 40 giây** giữ clip nguồn, dùng khung cuối để tạo các đoạn tiếp và nối vào Output. Ví dụ clip 10 giây cần ba đoạn 10 giây. Tạo luồng không gọi AI; chạy các đoạn mới dùng lượt/hạn mức tương ứng. FFmpeg ghép/cắt đúng mục tiêu khi đủ nguồn, báo thiếu thời lượng nếu clip AI trả về chưa đủ; không giả định một clip ngắn đã thành video 40 giây.

## Kiểm chứng

Unit tests bao phủ khả năng AI, Muse/Gemini viết content, gói companion tối giản, giao thức/phiên bản độc lập và kế hoạch tiếp nối. Electron thật kiểm tra video đầu vào → Muse văn bản, nút đăng bài trống có lý do, sơ đồ tiếp nối, xuất/cắt video 2,5 giây bằng FFmpeg và từ chối nguồn chưa đủ. Kiểm tra tiện ích cài thật trong Chrome for Testing với WebSocket loopback, popup, cập nhật và lọc tab riêng tư. Website/AI và metadata cập nhật trong các ca này là fixture; chưa xác minh tài khoản AI của người dùng.
