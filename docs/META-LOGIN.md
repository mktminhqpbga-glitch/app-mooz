# Facebook một lần đăng nhập → chọn nhiều Page

Trong **Trung tâm điều hành → Tài khoản & Page**, chọn **Kết nối Facebook · chọn nhiều Page**. Có hai cách lấy danh sách:

- **Đăng nhập Facebook**: dùng dịch vụ Meta OAuth do bạn triển khai. Facebook mở trong trình duyệt, người dùng cấp quyền; app hiện danh sách Page để chọn. Không nhập mật khẩu Facebook vào Workflow.
- **User access token**: nếu đã có token tài khoản được ứng dụng Meta cấp quyền `pages_show_list`, nhập token để đọc `/me/accounts`, rồi chọn Page. Đây là nhập token thủ công, không phải đăng nhập OAuth.

Workflow **không có ứng dụng Meta đã được duyệt, App ID/secret hoặc máy chủ OAuth dùng chung được cấp sẵn**. Repo cung cấp mã dịch vụ thật và Dockerfile để bạn tự triển khai. Khi chưa cấu hình, nút đăng nhập chưa thể hoạt động chỉ bằng tài khoản Facebook.

## 1. Cấu hình Meta

1. Vào [Meta for Developers](https://developers.facebook.com/apps/), tạo ứng dụng và thiết lập trường hợp sử dụng quản lý Page / **Facebook Login for Business** phù hợp tài khoản của bạn.
2. Điền domain, chính sách quyền riêng tư, hướng dẫn xóa dữ liệu và thông tin ứng dụng theo yêu cầu của Meta.
3. Xin các quyền `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`. Cần vai trò cho phép tạo nội dung trên từng Page. Nếu dùng chế độ Development, tài khoản phải có vai trò trong ứng dụng. Dùng cho người dùng bên ngoài có thể cần Business Verification/App Review/Advanced Access.
4. Nếu dùng **Facebook Login for Business**, tạo cấu hình đăng nhập trong Meta và lấy **Configuration ID**; điền vào `META_CONFIG_ID`. Cấu hình cần cấp **User access token** để đọc `/me/accounts`; các quyền và Page cần được cho phép trong cấu hình đó. Nếu dùng luồng Facebook Login cổ điển được Meta hỗ trợ cho ứng dụng của bạn, có thể để biến này trống.
5. Thêm đúng URL callback HTTPS vào **Valid OAuth Redirect URIs**:

   ```text
   https://meta.ten-mien-cua-ban.com/oauth/callback
   ```

Không dùng callback localhost cho nút Meta này. Callback HTTPS nằm ở dịch vụ máy chủ; mã desktop không chứa App Secret.

## 2. Triển khai dịch vụ

Dịch vụ dùng thư viện chuẩn Node.js, không cần `npm install`. Chạy **Node.js 24**, từ checkout repo đầy đủ:

```bash
node services/meta-auth/server.cjs
```

Cấu hình biến môi trường bằng trình quản lý Secrets của máy chủ/hosting, theo mẫu `services/meta-auth/.env.example`:

| Biến | Giá trị |
| --- | --- |
| `META_APP_ID` | App ID của Meta |
| `META_APP_SECRET` | App Secret, chỉ giữ trên máy chủ |
| `META_PUBLIC_URL` | URL gốc HTTPS, ví dụ `https://meta.ten-mien-cua-ban.com`, không thêm path/query |
| `META_CONFIG_ID` | Configuration ID của Facebook Login for Business, nếu áp dụng |
| `PORT` | Mặc định `8080` |

Node không tự đọc `.env`; dùng cấu hình Secrets của hosting hoặc cơ chế nạp env của môi trường triển khai. Không commit tệp env thật hoặc đưa App Secret vào app desktop/chat.

Có thể đóng gói Docker từ thư mục gốc repo:

```bash
docker build -f services/meta-auth/Dockerfile -t workflow-meta-auth .
docker run --rm --env-file /duong-dan-rieng/meta-auth.env -p 8080:8080 workflow-meta-auth
```

Đặt dịch vụ sau reverse proxy HTTPS hoặc dùng hosting cấp HTTPS, trỏ domain đã khai báo trong Meta vào đó. Kiểm tra `GET https://meta.ten-mien-cua-ban.com/health` trả `{"ok":true,"protocol":"workflow-meta-oauth-v1"}`. Dockerfile và API không tự tạo domain/chứng chỉ, không tự đăng ký tài khoản hosting. Chi phí/hạn mức tùy nhà cung cấp bạn chọn.

Không bật ghi đầy đủ query string trên đường callback ở reverse proxy: query có OAuth code dùng một lần. Không log body/header chứa token, ticket hoặc App Secret. Broker giữ phiên và token tạm **trong RAM**, hết hạn sau 10 phút; chạy một instance hoặc bật sticky routing. Khởi động lại/đổi instance giữa lượt xác thực sẽ cần đăng nhập lại. Dịch vụ có giới hạn số phiên/lượt khởi tạo; nếu đặt sau proxy, giới hạn IP trong Node dùng IP proxy, nên dùng thêm giới hạn phù hợp tại proxy cho nhiều người dùng.

## 3. Kết nối trong Workflow

1. Mở **Tài khoản & Page → Kết nối Facebook · chọn nhiều Page**. Nếu chưa có dịch vụ OAuth, phần User access token được mở sẵn để nhập token thủ công.
2. Nhập URL gốc HTTPS của dịch vụ bạn quản lý. URL này được lưu để dùng lại; không dán URL chứa token.
3. Bấm **Kiểm tra dịch vụ**. App xác nhận `/health` và giao thức `workflow-meta-oauth-v1` trước khi bật **Đăng nhập Facebook**. Sau đó đăng nhập, cấp quyền và chọn Page tại Facebook nếu được hỏi.
4. Quay lại app, chọn một hay nhiều Page, chọn bộ thương hiệu nếu muốn, bấm **Kết nối Page đã chọn**.

Chỉ Page bạn chọn mới được nhập. Page đã kết nối được cập nhật token, giữ ID kết nối nên không mất liên kết với hàng chờ cũ. App kiểm tra token thuộc đúng Page trước khi lưu toàn bộ lựa chọn trong một giao dịch; lỗi lưu sẽ giữ danh sách cũ. Page không có quyền tạo nội dung không được chọn.

## Luồng bảo vệ thông tin xác thực

Desktop tạo verifier/challenge và giữ ticket trong tiến trình chính. Broker tạo OAuth state, đổi code tại Meta, đổi sang user token dài hạn rồi đọc Page được cấp quyền. App Secret chỉ ở broker; `appsecret_proof` của từng Page token được tính trên broker và đi kèm token vào kho mã hóa trên máy.

Trình duyệt chỉ thấy URL đăng nhập/callback, không nhận Page token. Desktop lấy kết quả qua HTTPS bằng ticket + verifier, kết quả chỉ lấy được một lần. Renderer chỉ nhận tên/ID/quyền Page để chọn; token giữ tạm ở main process. Đóng/hủy hộp thoại xóa danh sách tạm. Page token được lưu bằng kho khóa hệ điều hành khi hỗ trợ, không lưu User access token xuống đĩa. Token/quyền vẫn có thể bị thu hồi hoặc hết hiệu lực; app không hứa kết nối vĩnh viễn.

`Ngắt kết nối` trong app xóa kết nối cục bộ, không tự thu hồi quyền ứng dụng tại Meta. Bạn có thể quản lý quyền trong phần cài đặt Facebook/Meta.

## Kiểm thử và giới hạn thực tế

Kiểm thử chạy broker HTTP thật trên loopback, mô phỏng API Meta, xác minh state, verifier/ticket, chống nhận lại kết quả, không lộ token trong URL/renderer, phân trang và lưu nhiều Page nguyên khối. HTTP loopback chỉ bật trong constructor của test; chế độ chạy dịch vụ mặc định yêu cầu `META_PUBLIC_URL` là HTTPS.

Chưa đăng nhập/đăng Page thật vì chưa có cấu hình Meta và tài khoản cấp quyền. Không thể tự hoàn tất App Review hay cấp quyền thay người dùng bằng mã nguồn.
