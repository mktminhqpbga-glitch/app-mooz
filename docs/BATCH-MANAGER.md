# Hàng đợi và Kho ảnh tham chiếu — tích hợp PDF, đợt 1

Mở **Tạo node → Hàng đợi · Kho ảnh**. Đây là phần bổ sung vào Workflow hiện tại, không phải một extension hoặc tài khoản Muse mới.

## Cách dùng

1. Thêm nhiều ảnh PNG/JPG/WebP. Mỗi ảnh tối đa 8 MB. Tệp hỏng bị bỏ riêng, các tệp hợp lệ vẫn được lưu. Tag được tạo từ tên tệp và thêm hậu tố khi trùng. Có thể đổi tag hoặc xóa ảnh khỏi kho.
2. Nhập prompt, dùng `@tag` để chọn ảnh. Khi gõ `@`, chọn gợi ý bằng chuột hoặc phím lên/xuống và Enter; Escape đóng gợi ý. Cũng có ô tìm tag và nút Chèn tag.
3. Chọn cách tách: mỗi dòng, mỗi đoạn cách bằng dòng trống, hoặc toàn bộ nội dung là một tác vụ. Chọn AI, cuộc trò chuyện, tỷ lệ và thời lượng.
4. Bấm **Thêm vào hàng đợi**. Tag chưa có ảnh chặn toàn bộ đợt. Ảnh, prompt, thiết lập và cuộc trò chuyện được chốt tại thời điểm xếp hàng. Đổi tag, xóa ảnh trong kho hoặc đổi cuộc trò chuyện mặc định sau đó không làm thay đổi các tác vụ đã chốt.
5. Bấm **Chạy hàng đợi**. Chọn 1–6 tác vụ song song cho toàn hàng đợi; mặc định 1. Giới hạn này dùng chung với các thẻ Flow Studio. Mỗi tab AI vẫn chỉ xử lý một tác vụ, các lượt gửi giữ khoảng cách 5 giây theo bộ chạy hiện có. Muốn dùng nhiều tab, thêm từng đợt với tab tương ứng trước khi chạy.
6. Mở một dòng kết quả để xem prompt, Task ID, thông báo lỗi, phát video / xem ảnh và tải tệp. Dùng bộ lọc, tìm kiếm hoặc phân trang 10 mục. Kết quả được lưu theo từng Task ID, không đổi sang video mới khi chạy lại cùng thẻ. Dọn mục đã xong không xóa node và video trên canvas.

**Dán → thêm sau 2 giây** mặc định bật. Nó tự xếp hàng, không tự bật bộ điều phối. Nếu hàng đợi đã chạy, tác vụ mới được nhận tự động. Gõ tay không tự xếp hàng. Hoàn tác chỉ áp dụng khi toàn bộ đợt vừa thêm còn chờ.

Thẻ **Tạo hàng loạt / Flow Studio** cũng đưa tác vụ vào cùng hàng đợi; bấm Tạo trên thẻ hoặc Tạo tất cả sẽ bật bộ điều phối. Các ảnh gắn thủ công và `@tag` đều được chốt vào tác vụ. Giới hạn thời lượng 5/10/15 giây trong màn hình hàng đợi là yêu cầu gửi cho AI, không bảo đảm dịch vụ hỗ trợ. Flow Studio giữ các thời lượng hiện có.

## Lưu và phục hồi

- Kho ảnh và hàng đợi lưu cục bộ trong hồ sơ trình duyệt. Tối đa 50 prompt/đợt, 200 mục trong danh sách; tối đa 8 ảnh/tác vụ, tổng dữ liệu ảnh đang được kho và tác vụ giữ là 32 MB.
- Dữ liệu ảnh được giữ theo mã tài sản bất biến. Xóa tag không xóa ảnh còn được tác vụ tham chiếu. Dọn kết quả thu hồi ảnh không còn được dùng.
- Tác vụ đang chạy khi trang bị tải lại chuyển thành **Cần kiểm tra**. Không tự gửi lại vì AI có thể vẫn chạy hoặc đã hoàn thành. Tác vụ chờ được giữ và chỉ tiếp tục sau khi bạn bật hàng đợi.
- Khi mất kết nối hoặc không rõ đã gửi hay chưa, tác vụ chuyển sang Cần kiểm tra. Xem tab AI trước; nếu có video, dùng Công cụ → Nhập video kết quả trên node. Việc nhập khôi phục đầu ra node, chưa tự đóng mục Cần kiểm tra trong hàng đợi.
- Chỉ một trang Workflow được quyền quản lý hàng đợi trong cùng hồ sơ, được bảo vệ bằng Web Locks. Trang thứ hai hiển thị thông báo, không tiếp quản hoặc tự gửi tác vụ. Đóng trang quản lý rồi tải lại trang muốn sử dụng.
- Khi Workflow bị đóng, bộ điều phối không chạy nền. Không có đồng bộ kho ảnh/hàng đợi giữa máy hoặc giữa hồ sơ trình duyệt.

## Đối chiếu với PDF v1.0

| Hạng mục | Trạng thái ở đợt này |
|---|---|
| Kho ảnh chung, tag duy nhất, upload nhiều ảnh và chặn tệp hỏng | Đã có; lưu ngay sau khi chọn, chưa có màn hình duyệt tệp trước khi lưu |
| Gợi ý @tag, thiếu tag chặn đợt, thứ tự ảnh theo tag xuất hiện | Đã có ở Hàng đợi; Flow Studio nhận @tag khi tạo/chạy thẻ |
| Snapshot ảnh và thiết lập lúc xếp hàng | Đã có, dùng chung cho Flow Studio |
| Chế độ tách prompt, bộ đếm, dán tự thêm, hoàn tác | Đã có |
| Dispatcher dùng chung, giới hạn song song, thêm việc khi đang chạy | Đã có trên các tab/API hiện có |
| Dải đang chạy, thời gian thực, bộ lọc, tìm kiếm, phân trang | Đã có; không bịa phần trăm tiến độ |
| Xem kết quả và tải tệp đúng đầu ra node | Đã có; bộ kết nối AI vẫn cần kiểm tra với tài khoản thật |
| Chạy lại lỗi / dừng, bảo vệ khi mất kết nối | Chạy lại thủ công; chưa tự retry/failover tài khoản |
| Tài khoản cách ly, đăng nhập, health-check và phân phối theo slot tài khoản | Chưa triển khai; tab/cửa sổ không tương đương phiên tài khoản cách ly |
| Tự phục hồi tác vụ đang chạy bằng ID tác vụ của nhà cung cấp | Chưa có; chuyển Cần kiểm tra thay cho tự gửi lại |
| Backend API, mã hóa thông tin đăng nhập, lưu trữ máy chủ | Chưa triển khai; đợt này không thu thập cookie/tài khoản |
| Canvas Studio kéo thả tự do theo tọa độ | Chưa thay giao diện thẻ sắp theo thứ tự hiện có |

## Kiểm chứng

`node --test tests/*.test.mjs`

`node tests/batch-manager-smoke.cjs`

`node tests/flow-studio-smoke.cjs`

Kiểm tra trình duyệt dùng Chromium thật, API AI được mô phỏng. Không được xem kết quả này là xác nhận dịch vụ Muse/Gemini/ChatGPT đang đăng nhập thật.
