# MooZ Agent 0.66.0 + MooZ Connect 1.9.0

## Cập nhật cả hai đầu

1. Thay app bằng 0.66.0. Dữ liệu và mẫu luồng vẫn dùng kho hiện có.
2. Trong Cài đặt & kết nối AI, tải tiện ích đi kèm. Giải nén và cập nhật thư mục đã tải trong `chrome://extensions`; kiểm tra phiên bản 1.9.0. Không cài song song nhiều bản của cùng tiện ích. Tải lại tab AI sau khi cập nhật.
3. Nếu dùng Render, dịch vụ relay cũng cần triển khai commit này: **Manual Deploy → Deploy latest commit**. Blueprint để `autoDeployTrigger: off`; push GitHub không chứng minh Render đã cập nhật. Giữ nguyên `RELAY_ADMIN_KEY`. Redeploy làm mất phòng trong RAM, nên kết nối app và tạo mã mới sau khi dịch vụ Live.
4. Ghép lại một lần. Không cần để app ở foreground; cần giữ app và máy chạy hoạt động.

## Thay đổi

- Máy Chrome không tự kết luận mã hết hạn theo đồng hồ của nó. `expires` vẫn phải là mốc thời gian hợp lệ; app/relay phát hành mã xác thực hạn và khóa trước khi cấp quyền. Mã hết hạn thật hoặc bị thu hồi vẫn bị từ chối.
- Relay trả thời lượng còn lại của mã. App dùng thời lượng này thay vì đòi đồng hồ app trùng đồng hồ relay; tương thích broker cũ với thời lượng mặc định 10 phút, broker vẫn kiểm tra hạn thật.
- Relay chỉ dọn phòng chưa từng ghép khi lời mời hết hạn. Phiên đã ghép giữ giới hạn 24 giờ và dùng khóa resume được xoay mỗi lần.
- Cả app và extension mới thương lượng `resultRecovery: 1` trên giao thức kết nối 1. Bản cũ vẫn kết nối nhưng không có cơ chế giữ phản hồi mới.
- Khi mất đường Chrome tạm thời, app giữ các RPC đã gửi và quyền điều phối tối đa 90 giây. Chỉ cùng extension và cùng kiểu kết nối được nối lại để nhận phản hồi. RPC mới để đọc trạng thái chờ cùng phiên; không chuyển sang Chrome khác và không tự gửi lại lệnh tạo AI.
- Extension thử nối lại phiên đã xác thực với khoảng chờ tăng dần, tối đa 8 lần trong cửa sổ 90 giây. Không tự thử lại mã bị từ chối, lỗi mã hóa/giao thức hoặc thao tác ngắt/thu hồi có chủ đích.
- Phản hồi được giữ trong RAM đến khi app ACK theo mã RPC. Lệnh trùng mã không chạy lại. Cache tối đa 64 RPC/128 MB; ACK giải phóng dữ liệu. Kết quả cũ không được đưa sang phiên ghép mới.
- Khi đã gửi AI nhưng hết thời gian phục hồi, giữ lỗi chưa rõ kết quả và dừng an toàn. Luồng Muse được chờ phục hồi 90 giây, chỉ đọc trạng thái, không gọi tạo lần hai. Kiểm tra requestId/chat và loại media vẫn giữ nguyên.
- Màn thiết bị, kết nối từ xa và popup hiển thị đang nối lại. Chặn tạo mã mới trong khi phục hồi; có thể thu hồi phiên để kết thúc chờ.

## Giới hạn thực tế

Không bảo đảm mọi mạng hoặc dịch vụ AI luôn hoạt động. App/Chrome bị thoát, trang AI tải lại, relay khởi động lại/mất kết nối host, hết hạn phiên hoặc mất mạng quá cửa sổ phục hồi có thể cần ghép lại và kiểm tra kết quả trên tab. Không khôi phục tự động thao tác AI chưa rõ trạng thái. Cache phản hồi không phải dữ liệu bền vững qua lần khởi động lại service worker.

Mã sửa tại repo không chứng minh dịch vụ Render của người dùng đã triển khai. Chưa có quyền truy cập môi trường Render của người dùng để kiểm chứng thực tế.

## Kiểm chứng

- Bộ unit/integration dùng WebSocket thật, app relay, ChromeDevices và worker tiện ích: mất mạng ở hai đường kết nối; kết quả chờ ACK; lệnh trùng; hết hạn phục hồi; hủy nối lại; thu hồi; extension khác; đồng hồ Chrome lệch ±24 giờ và relay lệch 24 giờ. Các trang AI trong kiểm thử là fixture, không gọi dịch vụ trả phí.
- Electron + Chromium riêng qua TLS: xác thực, tệp ảnh/video và phản hồi lớn, MP4 giải mã được, khôi phục cùng RPC sau khi ngắt đường truyền và không gửi thêm prompt. Kiểm tra chứng chỉ không tin cậy và thu hồi vẫn giữ nguyên.
- Kiểm tra nhận video Muse tiếp tục từ chối video/chat/lượt gửi khác. Không nới guard để che lỗi kết nối.
