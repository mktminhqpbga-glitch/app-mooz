# Trung tâm điều hành Workflow

Mở từ **Không gian làm việc → Trung tâm điều hành**. Các phần dùng chung dữ liệu trên máy và nối với Workflow Studio, Chat AI, hàng chờ Đăng bài hiện có. Lồng tiếng AI vẫn chưa được tích hợp thêm nhà cung cấp mới.

## Tài khoản & Page

Kết nối nhiều Facebook Page trong một lần chọn bằng Facebook Login qua broker hoặc User access token; nhóm tài khoản theo thương hiệu, kiểm tra quyền/kết nối và ngắt kết nối cục bộ. [Thiết lập Meta OAuth](META-LOGIN.md). YouTube, Instagram, TikTok và cổng đa nền tảng giữ cơ chế [kết nối hiện có](PUBLISHING.md).

## Bộ thương hiệu

Lưu tên, nhóm khách hàng, giọng văn, thông tin sản phẩm đã xác nhận, quy tắc, màu/phong cách; thêm 1 logo + 8 ảnh tham chiếu, 8 MB/ảnh và 32 MB/bộ. PNG/JPEG/WebP, tối đa 100 thương hiệu. Hồ sơ nằm trong dữ liệu ứng dụng, không tự tải lên máy chủ.

Trong Chat AI, chọn bộ thương hiệu cho dự án. Các lượt chat mới gửi thông tin chữ của bộ đã chọn. Ảnh chỉ gửi khi bật **Gửi ảnh tham chiếu của thương hiệu**; tính chung giới hạn 8 tệp và 20 MB/lượt chat. Logo không tự dùng làm ảnh tham chiếu tạo ảnh; dùng trong công cụ gắn logo. Khi tạo node từ kế hoạch, ảnh được chốt vào bảng tham chiếu riêng để sửa bộ thương hiệu sau đó không làm đổi ảnh đã dùng.

Thành phẩm thêm từ dự án nhận bộ thương hiệu của dự án. Có thể đổi thương hiệu trên thẻ Soạn bài. Khi chọn lần đầu, app chụp thông tin thương hiệu vào bài; bấm **Làm mới hồ sơ** trên bản nháp nếu muốn chốt lại thông tin mới nhất; sửa hồ sơ sau đó không làm thay nội dung/ảnh đã xếp hàng. ChatGPT dùng snapshot này khi viết content. Lưu trữ thương hiệu không xóa thành phẩm và ảnh cũ. Xung đột sửa hồ sơ giữa hai cửa sổ được báo để mở lại, không ghi đè âm thầm.

## Lịch nội dung và duyệt bài

Xem tháng/tuần, lọc theo thương hiệu/nền tảng/tài khoản hoặc Page, tìm nội dung/nhãn. Bài đã có lịch xuất hiện theo múi giờ máy; dữ liệu lưu UTC. Kéo bài đang chờ sang ngày khác, kiểm tra ngày/giờ trong hộp thoại rồi lưu, hoặc bấm bài để đổi giờ bằng bàn phím. App đổi chính mục hàng chờ đó; không tạo lượt đăng mới. Bài đang gửi/đã gửi không đổi lịch. Nếu dữ liệu vừa thay đổi, app yêu cầu làm mới.

Bản chưa xếp hàng hoặc chưa hẹn ngày cần hoàn thiện trong **Soạn bài**. Có thể nhập **Content riêng theo nền tảng**; để trống dùng content chung. Mỗi nơi đăng được chốt nội dung riêng trước khi kích hoạt hàng chờ.

Bật **Yêu cầu duyệt nội dung trước khi xếp hàng** nếu muốn chặn đăng khi chưa duyệt. Bấm **Duyệt nội dung** sau khi kiểm tra bản chung, các bản riêng và thành phẩm. Đổi nội dung làm mất trạng thái đã duyệt. Đây là duyệt trên máy bởi người đang dùng app, chưa có tài khoản/luồng duyệt nhóm từ xa. Tự xếp hàng sau khi ChatGPT viết xong vẫn cần bước duyệt nếu đã bật yêu cầu này.

Lịch chỉ chạy khi app mở, máy thức và có mạng. Không có cron đám mây chạy khi tắt máy. Bài lỗi/chưa rõ kết quả không tự gửi lại.

## Kho thành phẩm và hậu kỳ

Kho gom các bản gốc đã thêm từ canvas, giữ bản sao riêng với media. Tìm, gắn nhãn (tối đa 10 nhãn, 32 ký tự/nhãn), đánh dấu yêu thích, tải từng tệp và dùng lại thành bản nháp. Kết quả khác dữ liệu từ cùng node được nhóm thành các phiên bản; thêm lại cùng tệp dùng bản sao hiện có. Bản chụp nguồn cũ dùng khóa có asset ID được nhận diện cùng nguồn để nhóm phiên bản/chống nhập trùng.

Với một video, bấm **Đổi tỷ lệ**, **Thêm phụ đề** hoặc **Gắn logo**. App mở dự án, thêm node đầu vào là bản sao video trong kho và node hậu kỳ; chưa tự xử lý hoặc gửi AI. Nếu dự án nguồn không còn trong thư viện, tạo dự án hậu kỳ mới. Kiểm tra thiết lập rồi bấm **Thực hiện**:

- **Đổi tỷ lệ:** 9:16, 16:9, 1:1, 4:3, 3:4; thêm viền để giữ hình, xuất MP4.
- **Gắn logo:** dùng logo của thương hiệu trên bài, chụp logo vào node ảnh riêng; chọn vị trí, độ rộng, độ rõ và lề. Có thể nối ảnh logo khác bằng tay.
- **Phụ đề:** nhập SRT hoặc bật nhận diện bằng OpenAI khi đã có API key; nhận diện có thể tính phí. SRT nhập tay và gắn phụ đề chạy cục bộ.

Hậu kỳ dùng FFmpeg WASM, hiện tối đa 100 MB/tệp, có giới hạn bộ nhớ và thời gian xử lý của máy. Không thay media đã gửi/đang chờ; kết quả mới có thể thêm vào kho như phiên bản mới. Công cụ lồng tiếng hiện có không được tự cấu hình hay chạy thêm.

## Trợ lý AI và lịch sử

Hội thoại văn bản và tối đa 5 kế hoạch gần nhất lưu trên máy theo từng dự án, tối đa 60 tin nhắn / 1 MB dữ liệu mỗi bản lưu. Khi mở lại, app hiện nội dung và đánh dấu kế hoạch đã áp dụng; **không tự tạo hoặc chạy lại**. Ảnh/video đính kèm không lưu trong lịch sử chat; kế hoạch cũ cần ảnh nhưng chưa áp dụng sẽ yêu cầu đính kèm lại và lập kế hoạch mới.

Trợ lý tiếp tục có giới hạn 10 tác vụ ảnh/video/lượt. Việc lên kế hoạch dài ngày có thể cần chia nhiều lượt. Kế hoạch là dữ liệu có kiểm tra, không thực thi mã hay điều khiển hệ điều hành. Kết quả trong chat có nút tải và **Thêm vào hàng chờ đăng**. Xóa chat xóa bản lưu hội thoại cục bộ; không xóa lịch sử tại nhà cung cấp AI. API key/token không được thêm vào dữ liệu chat tự động; nội dung bạn tự nhập là dữ liệu hội thoại.

## Hiệu quả bài đăng

Bấm **Cập nhật thống kê** để đọc chỉ số API cho các bài đã gửi qua app:

| Kết nối trực tiếp | Chỉ số hiện đọc |
| --- | --- |
| Facebook Page | Tổng cảm xúc, bình luận, chia sẻ nếu API cấp quyền/trả dữ liệu |
| YouTube | Lượt xem, thích, bình luận qua YouTube Data API |
| Instagram chuyên nghiệp | Lượt thích, bình luận qua Graph API |
| TikTok / webhook | Chưa có adapter đọc thống kê; app ghi rõ và cung cấp liên kết nền tảng |

Không lấy bài lịch sử bên ngoài app tự động. Ô `—` là chưa có dữ liệu, không được tính là 0. Tổng chỉ gồm các giá trị đã tải trong bộ lọc đang xem; các loại chỉ số không được gộp thành “tương tác” giả định. Mỗi bài có mốc đọc dữ liệu; khi lỗi, giữ giá trị cũ và báo lỗi để biết dữ liệu đã cũ. Không hứa thống kê thời gian thực hay vượt quyền/hạn mức API.

## Kiểm tra

Unit tests kiểm tra hồ sơ/tệp thương hiệu, phân quyền/cách ly chat, OAuth broker thật với API mô phỏng, state/ticket/verifier, phân trang, nhập Page nguyên khối, hủy nhận phản hồi muộn, đổi lịch giữ ID, snapshot thương hiệu, duyệt và content riêng, thống kê không bịa số và phiên bản cũ.

Electron smoke mở giao diện thật, thêm logo/ảnh thật, chọn nhiều Page, gửi brand/reference vào kế hoạch AI mô phỏng, lưu/mở lại chat không chạy lặp, kéo thả lịch, gắn nhãn/yêu thích, chạy FFmpeg thật để gắn logo/đổi khung và đọc thống kê với API mô phỏng. Chưa xác minh OAuth/đăng bài/thống kê trên tài khoản thật vì chưa có cấu hình và quyền của người dùng.
