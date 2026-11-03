# Ảnh tham chiếu theo mẫu và kho prompt Canvas — 0.64.0

## Hai loại ảnh riêng

Trong **Luồng & tab AI**, chọn node ảnh. **Loại ảnh** phân biệt:

- **Ảnh sản phẩm · riêng từng tác vụ:** chọn ảnh khi nhập đầu vào cho tác vụ. Lượt mới sau khi xếp hàng không lấy lại ảnh sản phẩm của lượt trước hay tệp mặc định cũ của mẫu. Form đang nhập dở vẫn giữ bản nháp khi đóng/mở lại; đó là cùng lượt chưa xếp hàng.
- **Ảnh nhân vật tham chiếu · cố định theo mẫu:** mỗi mẫu có một đầu vào tham chiếu, tối đa một ảnh. Chọn từ kho hoặc tải lên ở phần thuộc tính node, rồi **Lưu mẫu**. Ảnh được giữ cho các lượt sau đến khi thay hoặc bỏ.

Mẫu Ảnh sản phẩm → Video, Prompt + nhân vật → Video và Kịch bản có sẵn → Video đã phân vai ảnh. Mẫu cũ nhận diện đầu vào nhân vật qua dây vào cổng Nhân vật; các bản luồng đã chốt không bị viết lại. Với mẫu tự thiết kế, chọn đúng Loại ảnh và nối ảnh nhân vật vào cổng **Nhân vật**, ảnh sản phẩm vào cổng **Ảnh sản phẩm/cảnh**. Nếu một mẫu cũ có nhiều đầu vào nhân vật, gộp về một đầu vào trước khi tạo lượt mới.

## Nhập đầu vào và thay ảnh

Form chạy hiển thị **Ảnh nhân vật tham chiếu · cố định theo mẫu** ở trên, **Đầu vào riêng của tác vụ** ở dưới. Bấm **Thay ảnh tham chiếu**, **Chọn từ kho** hoặc **Bỏ ảnh tham chiếu** sẽ lưu lựa chọn vào mẫu ngay, kèm thông báo trong form. Chọn Hủy ở hộp chọn tệp giữ ảnh cũ. Ảnh tham chiếu tùy chọn có thể để trống.

Mỗi tác vụ chốt riêng ảnh sản phẩm, ảnh nhân vật, prompt và phiên bản luồng. Thay ảnh của mẫu chỉ áp dụng cho lượt sau; tác vụ đang chờ/chạy giữ ảnh trước đó. Khi rút một tác vụ về nháp để sửa, ảnh được hiển thị theo bản đã chốt; sửa trong form đó chỉ sửa tác vụ, không đổi mẫu hiện tại. Bản nháp đang sửa trên canvas được giữ khi cập nhật ảnh tham chiếu từ form chạy. Với mẫu cũ nối cùng một ảnh vào cả cổng sản phẩm và nhân vật, app báo cần tách đầu vào; thao tác thay/bỏ ảnh không ghi một mẫu mới sai cấu trúc lên mẫu đang lưu.

Các mẫu khác có lựa chọn ảnh riêng. Nhân bản mẫu sao chép cấu hình tại lúc nhân bản; thay ảnh một mẫu không thay mảng ảnh của mẫu khác. Thumbnails và danh sách ảnh sản phẩm của tác vụ không trộn ảnh nhân vật vào.

## Xem và dùng prompt mẫu

Bấm **Xem prompt mẫu · Kho Canvas** cạnh văn bản đầu vào, prompt của bước hoặc Prompt chung trong luồng cũ.

1. Chọn **Dự án Canvas** chứa kho prompt muốn dùng.
2. Tìm tên/nội dung, bấm một mẫu để xem toàn bộ.
3. Bấm **Dùng prompt này** để đưa nguyên nội dung vào ô đang nhập. Lưu mẫu luồng nếu muốn dùng nội dung đó làm mặc định cho các tác vụ sau.

Kho được đọc trực tiếp từ `workflowPromptLibrary` của dự án Canvas, qua IPC chỉ trả tên/nội dung prompt. Không tạo kho hay bản sao thứ hai; lần mở sau/Làm mới đọc lại các thay đổi đã lưu ở Canvas. **Mở kho trên Canvas** chuyển sang dự án nguồn để thêm/sửa/xóa bằng giao diện quản lý hiện có. Kho rỗng, dự án mất hoặc lỗi đọc được báo rõ.

Canvas lưu prompt tới 20.000 ký tự, còn ô prompt luồng giới hạn 4.000. Mẫu dài vẫn xem đầy đủ; nút dùng bị chặn và có giải thích, không cắt bớt nội dung. Khoảng trắng và xuống dòng được giữ nguyên khi áp dụng vào luồng canvas.

## Relay Render

Bổ sung kiểm tra phản hồi heartbeat cho kết nối WSS từ app đến relay. Nếu socket còn báo mở nhưng máy chủ không trả lời, app ngắt phiên bị treo và báo cần kiểm tra/kết nối lại. Máy vừa thức dậy được một lượt thăm dò mới. Dừng kết nối hủy timer và xóa khóa khỏi phiên như trước; không tự gửi lại yêu cầu AI.

Thay đổi này không làm dịch vụ Render luôn hoạt động và không tự phục hồi phòng đã mất khi máy chủ khởi động lại. Cấu hình mẫu dùng Render Free; relay giữ phòng trong RAM. Hướng dẫn giao diện phân biệt dùng thử và nhu cầu chạy thường xuyên: cùng máy dùng kết nối trực tiếp; hai máy có thể dùng Tailscale hoặc máy chủ luôn hoạt động. Không đổi hosting/gói phí, cấu hình hay chứng chỉ từ xa của người dùng trong lần sửa này.

## Kiểm chứng

- 402 unit test đạt, gồm phân vai ảnh, ảnh mặc định của mẫu, tác vụ mới không lấy ảnh sản phẩm cũ, giới hạn một tham chiếu và tương thích bản luồng cũ.
- Electron thật: tạo hai mẫu, tải/chọn/thay/bỏ ảnh, hủy picker, xếp hai tác vụ có sản phẩm riêng, giữ nguyên bản chốt cũ và mở lại app. Dùng kho prompt Canvas thực, xem/áp dụng giữ nguyên nội dung, chặn mẫu quá dài và đọc lại mẫu sau khi sửa trong Canvas; kiểm tra dialog 1008/640px.
- Giữ kiểm tra canvas A–Z, năm không gian giao diện và bộ cài Windows. Windows xác nhận ảnh được lưu ở mẫu đồng thời được chốt riêng trong tác vụ qua picker OS thật.
- Relay: mô phỏng socket mất phản hồi và máy chủ khỏe; kiểm tra timeout, trạng thái kết nối, dừng, khóa, đổi phiên và không gửi lại công việc AI. Mô phỏng không xác định nguyên nhân sự cố trên dịch vụ Render thực tế của người dùng.

AI dùng dữ liệu thử có kiểm soát; không gọi dịch vụ trả phí hay đăng bài thật. Extension **MooZ Connect 1.8.1** tiếp tục tương thích; không thay giao thức hay đóng gói lại tiện ích.
