# Đăng bài trong Workflow

Ứng dụng **Đăng bài** mở từ danh mục ứng dụng trên trang chủ hoặc nút Đăng bài ở sidebar canvas. Hoạt động trong Workflow desktop. Tiện ích Chrome tiếp tục làm cầu nối đến ChatGPT đang đăng nhập; phiên đăng nhập ChatGPT không cấp quyền đăng mạng xã hội.

## Từ kết quả đến hàng chờ

1. Dưới kết quả ảnh/video hoàn tất, bấm **Thêm vào hàng chờ**. App chép bản sao tệp vào kho Đăng bài và mở phần **Soạn bài**. Sửa/xóa kết quả canvas sau đó không thay tệp đã chép.
2. Muốn một bài có nhiều ảnh, thêm node **Tổng ảnh**. Nối nhiều cổng ảnh kết quả vào **Các ảnh kết quả**, rồi thêm cả bộ vào hàng chờ. Hiện nhận tối đa 8 ảnh/bài hoặc một video. Cổng Cả bộ ảnh cũng có thể nối sang cổng tham chiếu của các node AI.
3. Trong Đăng bài, chọn tab ChatGPT và chỉnh **Prompt viết content chung**. Mỗi thẻ có **Viết content**, vùng sửa nội dung và nơi đăng. Ảnh được gửi trực tiếp; video gửi ba khung minh họa cùng ngữ cảnh prompt nguồn khi giải mã được. Nếu không đọc được khung video, vẫn nhập được media để viết content thủ công; TikTok yêu cầu thời lượng đọc được nên cần thêm lại một MP4 hợp lệ. ChatGPT không đọc toàn bộ video hay âm thanh qua ba khung này, nên cần kiểm tra content trước khi đăng.
4. Chọn một hoặc nhiều tài khoản đã kết nối. Chọn **Đăng ngay** hoặc **Hẹn giờ đăng**, rồi bấm nút đưa vào hàng chờ. App tạo một mục riêng cho mỗi nơi đăng. Có thể bật **Tự xếp hàng đăng sau khi ChatGPT viết xong** trên từng thẻ nếu muốn bỏ bước kiểm tra thủ công đó.
5. **Hàng chờ đăng** hiện các mục đang đợi/đang gửi. **Đã gửi** hiện bài đã được nền tảng nhận hoặc đăng. **Cần sửa** hiện lý do lỗi và nơi gặp lỗi; rút mục đó để sửa, kết nối lại hoặc đổi thời gian rồi xếp lại. Mục thành công ở nền tảng khác được giữ nguyên.

Lịch dùng múi giờ hệ điều hành và lưu mốc UTC. Máy phải thức, app phải còn chạy và có mạng. App kiểm tra bài đến hạn mỗi 15 giây. Khi mở lại sau thời gian hẹn, bài đã được xếp hàng sẽ được xử lý; lịch này chưa chạy trên máy chủ đám mây. **Tạm dừng hàng chờ** ngăn bắt đầu bài mới và được giữ sau khi khởi động lại; tác vụ đang gửi vẫn hoàn tất. **Dừng tải lên** chỉ dùng được trước bước gửi cuối. Mỗi bài có **Lịch sử xử lý**, mốc thời gian và lý do lỗi. App xử lý tối đa hai tài khoản song song, tuần tự từng tài khoản và ưu tiên lịch đến hạn trước. Việc chia bài cho nhiều nền tảng được lưu đủ trước khi kích hoạt; hàng chờ dang dở được phục hồi khi mở lại. Không tự chạy lại tác vụ lỗi. Nếu chưa biết bài có được đăng do mất mạng hoặc app thoát giữa bước gửi, app đánh dấu **Cần kiểm tra**, chặn gửi lại. Sau khi kiểm tra tài khoản và xác nhận chưa đăng, có thể mở lại bản nháp bằng **Đã kiểm tra: chưa đăng**.

## Facebook Page trực tiếp

Mở **Kết nối nền tảng → Facebook Page trực tiếp**, nhập Page ID và **Page access token**. App kiểm tra token có thuộc đúng Page trước khi lưu. Cần quyền đăng của người quản lý Page và các quyền API phù hợp, gồm `pages_manage_posts` và `pages_read_engagement`. Cấp quyền/lấy token thực hiện trong công cụ và ứng dụng Meta của bạn; tích hợp này không cung cấp ứng dụng OAuth Meta đã được duyệt sẵn. Token hết hạn hoặc thiếu quyền sẽ báo lỗi để kết nối lại.

Ảnh được tải lên ở chế độ chưa công khai trước; sau đó gửi một bài feed gắn toàn bộ ảnh. Video được gửi bằng API video của Page; trạng thái **Đã gửi · đang xử lý** được kiểm tra lại để nhận biết xử lý hoàn tất/thất bại. Không dùng tự click trình duyệt Facebook và không sao chép cookie tài khoản.

## YouTube trực tiếp · đăng nhập Google

1. Trong [Google Cloud Console](https://console.cloud.google.com/), tạo/chọn dự án, bật **YouTube Data API v3**.
2. Cấu hình OAuth consent screen. Nếu app đang ở chế độ thử nghiệm, thêm tài khoản Google của bạn vào danh sách test users.
3. Tạo **OAuth client ID → Desktop app**, tải JSON. Không dùng cấu hình Web app cho luồng này.
4. Trong Đăng bài → Kết nối nền tảng → YouTube, dán JSON rồi bấm **Kiểm tra & kết nối**. Trình duyệt mở Google, chọn đúng kênh và cấp đủ quyền `youtube.upload`, `youtube.readonly`. App chỉ lắng nghe callback tạm thời tại `127.0.0.1`, kiểm tra state, dùng PKCE và đóng cổng khi hoàn tất/hủy.
5. Khi chọn YouTube trên thẻ video, nhập tiêu đề, **chủ động chọn quyền riêng tư** và video có dành cho trẻ em hay không. Khai báo nội dung tổng hợp/chỉnh sửa bằng AI khi áp dụng.

Token làm mới cùng cấu hình OAuth được giữ trong kho mã hóa của hệ điều hành khi hỗ trợ. Upload dùng giao thức resumable, gửi từng khối 8 MiB, kiểm tra số byte nền tảng nhận và theo dõi xử lý sau upload. Phiên tải chưa hoàn tất không được tự gửi lại khi kết quả cuối chưa rõ. Dự án YouTube chưa được audit có thể bị giới hạn upload riêng tư; OAuth ở chế độ Testing có thể cấp refresh token chỉ dùng được 7 ngày. Cần xét duyệt/quyền phù hợp nếu phân phối cho người khác, không thể bỏ qua bằng app.

## Instagram chuyên nghiệp trực tiếp

1. Chuyển Instagram sang **Professional (Business/Creator)** và liên kết với Facebook Page.
2. Cấp Page token quyền phù hợp gồm `instagram_basic`, `instagram_content_publish` và quyền Page qua ứng dụng Meta của bạn. Kết nối Facebook Page trước.
3. Chọn **Instagram chuyên nghiệp · qua Page**, chọn đúng Page. App đọc tài khoản liên kết và xác nhận ID/username.
4. Chọn **Kho media cho Instagram · Cloudinary**, nhập Cloud name, API key, API secret từ [Cloudinary Console](https://console.cloudinary.com/), đồng ý media sẽ có URL công khai.

Instagram đọc media qua URL công khai, không đọc tệp cục bộ. App ký yêu cầu tải lên Cloudinary, dùng URL JPEG cho ảnh, tạo container ảnh/album/Reels, đợi media sẵn sàng rồi gửi yêu cầu xuất bản. Media vẫn nằm trong Cloudinary của bạn sau khi đăng; quản lý/xóa tại Cloudinary, chi phí/hạn mức tùy tài khoản. Mỗi tệp qua tích hợp này tối đa 100 MB; Reels cần MP4/MOV. Content tối đa 2.200 ký tự. Nếu tài khoản/quyền/API hoặc tệp chưa phù hợp, app báo lý do và không giả định đã đăng thành công.

## TikTok trực tiếp · video

Tạo ứng dụng tại [TikTok for Developers](https://developers.tiktok.com/), cấu hình Login Kit, Content Posting API và callback OAuth của ứng dụng đó. Tài khoản của bạn phải cấp scope `video.publish`. **Tích hợp hiện tại nhận token đã cấp quyền; chưa cung cấp máy chủ callback OAuth TikTok hay ứng dụng TikTok đã audit sẵn.** Nếu chưa có ứng dụng/token, chưa thể kết nối chỉ bằng tên tài khoản.

Chọn **TikTok · token đã cấp quyền** và nhập access token. Để tự làm mới, cung cấp refresh token cùng client key/client secret đã cấp token. Không có refresh token thì cần kết nối lại khi hết hạn. App đọc creator info, tên tài khoản, các quyền riêng tư và giới hạn thời lượng được nền tảng cho phép.

Trên thẻ video, chủ động chọn ai được xem, xác nhận quyền dùng nội dung/âm nhạc và khai báo AIGC/quảng bá thương hiệu khi áp dụng. Không mặc định đăng công khai. Bình luận/Duet/Stitch mặc định tắt; bạn chủ động bật nếu muốn. Quyền nào bị TikTok khóa thì không thể bật lại từ app. App kiểm tra lại tài khoản/khả năng trước upload, gửi video bằng FILE_UPLOAD theo quy tắc chia khối TikTok, rồi kiểm tra publish status. Chỉ mở liên kết bài cụ thể nếu API trả post ID công khai; bài riêng tư có thể chỉ có liên kết tài khoản. Tài khoản/app chưa audit có giới hạn riêng tư và hạn mức do TikTok áp dụng.

Kết nối trực tiếp này nhận **một video**, chưa hỗ trợ Photo Post hoặc đăng khi app/máy đã tắt. Với luồng khác có thể dùng cổng máy chủ đã cấu hình.

## Cổng đa nền tảng · n8n / Make

LinkedIn, Pinterest, X, nền tảng khác hoặc một luồng tùy chỉnh dùng cổng của bạn. Chọn **Cổng đa nền tảng · n8n / Make**, tên tài khoản, nền tảng và URL webhook HTTPS của workflow đã cấu hình. Mỗi kết nối tương ứng một tài khoản/nơi đăng.

Cổng cần đăng nhập/cấp quyền với nền tảng đích và triển khai hợp đồng bên dưới. Dán một URL webhook mặc định chưa đủ để đăng. App không kèm máy chủ n8n/Make, thông tin OAuth của các nền tảng hoặc workflow cổng đã triển khai. Cổng phải xử lý toàn bộ media hoặc báo rõ chưa đăng, không âm thầm bỏ ảnh hay thay đổi nơi đăng.

### Kiểm tra kết nối

App gửi POST JSON:

```json
{"type":"workflow.connection.test","protocol":"workflow-publish-v1"}
```

Cổng trả:

```json
{"ok":true,"protocol":"workflow-publish-v1"}
```

Nhánh này chỉ kiểm tra cấu hình và không đăng nội dung. Bearer token được gửi trong `Authorization` nếu bạn cấu hình.

### Đăng nội dung

App gửi POST `multipart/form-data` với header `Idempotency-Key: <jobId>` và các trường:

| Trường | Nội dung |
| --- | --- |
| `type` | `workflow.publish` |
| `protocol` | `workflow-publish-v1` |
| `jobId` | ID cố định cho mục trong hàng chờ của tài khoản đó |
| `platform` | facebook, instagram, tiktok, youtube, linkedin, pinterest, x hoặc other |
| `title` | Tên thẻ |
| `caption` | Nội dung đã được lưu |
| `media` | Mảng JSON gồm field, kind, mime, name |
| `file0`, `file1`… | Dữ liệu tệp, đúng thứ tự trong mảng media |

Video chỉ gửi tệp video gốc; ba ảnh minh họa dành cho ChatGPT không được gửi đi để đăng. Không gửi prompt nguồn, API key hay token của kết nối khác.

Cổng phải lưu `jobId` và kết quả sau khi đăng. Nhận lại ID đó phải trả kết quả trước, không tạo bài trùng. Chỉ trả `published` khi nền tảng xác nhận đăng thành công:

```json
{"ok":true,"postId":"id-do-nen-tang-tra","url":"https://nen-tang/bai-dang","status":"published"}
```

Nếu nền tảng đã nhận nhưng còn xử lý, có thể trả `status: "processing"`; mục được đánh dấu đã gửi. App sẽ kiểm tra lại khoảng mỗi phút bằng POST JSON `type: "workflow.status"`, `protocol`, `jobId`, `postId`, `platform`. Cổng trả `{"ok":true,"status":"published"}`, `status: "processing"` hoặc `status: "failed"` kèm `errorCode`. Nếu cổng chưa hỗ trợ kiểm tra, app báo chưa xác nhận được trạng thái; không tự đăng lại. Cổng cũng có thể đợi nền tảng xử lý hoàn tất trước khi trả lời lượt đăng, trong giới hạn 5 phút.

Nếu chắc chắn chưa có bài công khai, trả HTTP lỗi kèm:

```json
{"ok":false,"notPublished":true}
```

Có thể thêm `errorCode` là `AUTH_EXPIRED`, `PERMISSION_DENIED`, `MEDIA_UNSUPPORTED`, `CAPTION_TOO_LONG`, `RATE_LIMIT` hoặc `INVALID_ACCOUNT` để app hiện lý do và cách sửa tương ứng.

Không trả `notPublished: true` khi không chắc chắn. Mất mạng, phản hồi không đọc được hoặc thiếu xác nhận sẽ được xếp **Cần kiểm tra**, không tự gửi lại. Thông báo lỗi của cổng không được hiển thị nguyên văn để tránh lộ thông tin xác thực; xem execution n8n/Make cho chi tiết.

## Lưu trữ và giới hạn

- Media và metadata hàng chờ nằm trong thư mục `posting` của dữ liệu ứng dụng, tách khỏi dự án. Mỗi tệp tối đa 128 MB, tổng 256 MB/bài.
- Token và URL webhook được mã hóa bằng Electron `safeStorage` nếu kho khóa hệ điều hành hỗ trợ. Khi không hỗ trợ mã hóa an toàn, kết nối chỉ giữ trong phiên, không ghi token dạng rõ xuống đĩa. Sau khi mở lại cần kết nối lại.
- **Ngắt kết nối** xóa thông tin khỏi app, không tự thu hồi quyền đã cấp tại Google/Meta/TikTok hoặc xóa media Cloudinary; quản lý quyền ở trang bảo mật của từng nền tảng nếu cần.
- Xóa mục khỏi danh sách chuyển dữ liệu đó sang thư mục `.trash` cục bộ; không xóa bài trên nền tảng và chưa có UI khôi phục thùng rác.
- Muốn dùng lại thành phẩm, chọn **Dùng lại thành bản nháp** trên mục đã gửi; bản sao chưa được xếp hàng và chưa đăng. Không tự nhân bản lại mục đã đăng. Kết quả ảnh/video không thay đổi dù nguồn canvas chạy lại. Bấm thêm trùng cùng tệp từ cùng nguồn sẽ dùng lại bản sao hiện có; kết quả có dữ liệu mới tạo một bản nháp mới.

## Kiểm thử

`tests/desktop-posting.test.cjs` kiểm tra lưu tệp theo khối, phân quyền cửa sổ, chống trùng, lịch theo nơi đăng, rút/sửa lỗi, trạng thái chưa xác định, hợp đồng Facebook/webhook, ảnh/ngữ cảnh ChatGPT và bảo vệ token. `tests/desktop-posting-smoke.cjs` mở Electron thật, gom ảnh trên canvas, chép media, soạn content, hẹn giờ đa nền tảng, thử lại riêng mục lỗi và nhập MP4 thật kèm ba khung. `tests/desktop-posting-native.test.cjs` kiểm tra callback OAuth loopback thật (state/PKCE/hủy/timeout), token refresh, dữ liệu khối YouTube/TikTok, container Instagram/Cloudinary, giới hạn native, khôi phục chia hàng chờ, tạm dừng, thứ tự lịch, lỗi lưu và dừng trước/sau bước gửi. Electron smoke còn đi qua IPC OAuth YouTube, chọn quyền đăng và tạm dừng/tiếp tục bằng giao diện. API Google/Meta/TikTok/Cloudinary/ChatGPT/webhook dùng phản hồi mô phỏng; **chưa xác minh đăng bài trên tài khoản thật** vì chưa có cấu hình/quyền API. Cần kiểm tra từng tài khoản thật trước khi dùng tự động đăng nội dung thực tế.
