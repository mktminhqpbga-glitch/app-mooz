# Một luồng, một tab — 0.65.0

- Trong canvas, **AI của toàn bộ luồng** chọn một nhà cung cấp hỗ trợ tất cả các bước AI. Mỗi node chỉ còn yêu cầu của bước; không chọn AI/tab riêng cho node. Ghép, lưu và hậu kỳ tiếp tục xử lý trên máy.
- Ngoài canvas, tại form **Nhập đầu vào & chạy**, chọn **Tab chạy toàn bộ luồng**. Màn tạo video trực tiếp cũng có **Tab chạy toàn bộ tác vụ**. Chọn một tab cụ thể hoặc **Tự chọn một tab đang trống**.
- Tab đang bận vẫn chọn được: tác vụ xếp hàng chờ đúng tab đó, dù có tab khác rảnh. Chế độ Tự chọn dùng các tab đã bật trong Nhóm tab AI. Chọn thủ công một tab là cho phép dùng tab đó cho tác vụ này.
- Mỗi tác vụ giữ tab từ bước AI đầu tiên qua các bước AI còn lại và ghép/xuất cuối. Hai tab có thể giữ hai tác vụ; tác vụ mới chờ khi hết tab hoặc đạt giới hạn đồng thời. Hạn mức gửi yêu cầu theo nhà cung cấp vẫn áp dụng.
- Mất kết nối/chưa sẵn sàng: chờ đúng tab đã nhận luồng, không đổi sang tab khác. Dừng/lỗi chỉ giải phóng tab sau khi yêu cầu đang gửi đã kết thúc. Chạy tiếp giữ danh tính tab cũ; khởi động lại không tự gửi lại yêu cầu chưa rõ kết quả.
- Mẫu cũ một AI được chuyển sang cấu hình một AI, bỏ lựa chọn tab riêng từng bước. Mẫu dùng nhiều AI cần chọn lại một AI hỗ trợ toàn bộ luồng. Các bản chốt lịch sử không bị viết lại; tác vụ cũ đã chạy nhận lại tab thực tế từ lịch sử bước/yêu cầu nếu còn thông tin. Tác vụ cũ có nhiều AI được dừng để người dùng tạo lượt mới theo mẫu đã chọn.
- Ảnh tham chiếu cố định theo mẫu, ảnh sản phẩm riêng từng tác vụ và kho prompt Canvas giữ cách hoạt động của 0.64.0.

Kiểm chứng: 410 unit test; tám tình huống điều phối gồm giữ tab khi đảo thứ tự nhóm, song song hai luồng và chờ luồng thứ ba, chờ đúng tab chọn tay, giữ tab qua bước local, mất kết nối/kết nối lại, dừng/retry, khôi phục bản cũ, và lỗi ghi nhật ký trước khi gửi. Electron kiểm tra canvas/form chọn tab bên ngoài, dữ liệu ảnh/prompt, danh sách tab đang mở, cập nhật khi mất kết nối, lưu qua mở lại, composer và giao diện năm màn. AI dùng phản hồi thử, không gọi dịch vụ trả phí.

Thông báo **Cuộc trò chuyện Muse đã đổi** là cơ chế chặn nhận kết quả từ chat khác trong lúc đang chờ, không đủ để kết luận relay Render mất kết nối. Giữ đúng tab/không chuyển chat trên tab đang chạy. Cùng máy có thể dừng kết nối từ xa và ghép Chrome trực tiếp; hai máy có thể dùng Tailscale. Không thay hosting/gói phí hay cấu hình mạng của người dùng trong bản này. Tiện ích vẫn 1.8.1, giao thức không đổi.
