# Affiliate Shopee trong Workflow · 0.39.0

Mở **Thư viện → Ứng dụng → Affiliate Shopee**. Đây là một cửa sổ riêng trong app Mac, dùng chung ChatGPT, canvas và ứng dụng Đăng bài. Không cần chạy máy chủ Python hoặc cài thêm app bên ngoài.

## Luồng dùng

1. Mở và đăng nhập Muse, Gemini hoặc ChatGPT trong Chrome đã kết nối hoặc cửa sổ AI của app. Chọn cuộc trò chuyện tại Affiliate Shopee; mỗi lượt xử lý dùng riêng một cuộc trò chuyện, tránh nhập thêm khi đang chạy.
2. Dán link affiliate Shopee Việt Nam hoặc link ngắn `s.shopee.vn` / `shp.ee`, bấm **Tạo kịch bản từ link**. Link tracking gốc được giữ nguyên; app không tạo link affiliate, không kiểm tra quyền nhận hoa hồng.
3. App mở link công khai, lấy tên/mô tả/ảnh từ JSON-LD Product hoặc Open Graph. Link chưa mở tới sản phẩm, trang yêu cầu JavaScript/đăng nhập/CAPTCHA, CDN bị chặn hoặc thiếu metadata sẽ báo lỗi trước bước AI. Không gọi API Shopee nội bộ, dùng cookie Chrome hay vượt CAPTCHA.
4. Bốn lượt AI đã chọn: hồ sơ từ trích dẫn nguồn → ba góc kể chuyện và chọn góc → 3–5 cảnh có lời đọc/ảnh nguồn/thời lượng/chỉ dẫn hình → lượt kiểm tra nội dung riêng. Trích dẫn không có trong nguồn, ảnh/thời lượng sai, thiếu công bố liên kết tiếp thị hoặc thiếu kiểm tra từng cảnh sẽ dừng. Kịch bản được so với lịch sử đã lưu, kể cả mục xóa khỏi danh sách, để hạn chế bản gần trùng sau khi đổi tên sản phẩm.
5. Xem lại từng cảnh, tải JSON/content nếu cần. Chọn Muse hoặc Google Veo, tùy chọn lời đọc OpenAI, bấm **Tạo workflow trên canvas**. Tạo node không tự gửi yêu cầu video/giọng nói. Chọn tab AI hoặc cấu hình API trong dự án rồi **Chạy workflow** khi sẵn sàng.
6. Mỗi cảnh giữ ảnh nguồn riêng, nối vào tạo video; lời đọc tùy chọn có node riêng. Node cuối ghép cảnh hoặc đồng bộ từng bản đọc. Kết quả hoàn tất có **Tải kết quả / Thêm vào hàng chờ**. Hàng chờ nhận bản sao tệp cùng content và link gốc, ở trạng thái bản nháp.
7. Trong **Đăng bài**, kiểm tra nội dung, chọn tài khoản/nền tảng đã kết nối, đăng ngay hoặc hẹn giờ. Mục Affiliate không tự đăng bài hoặc tự kết nối tài khoản.

## Điều kiện và giới hạn

- Kịch bản dùng Muse/Gemini/ChatGPT web qua bộ kết nối hiện có, không cần API key viết kịch bản. Bốn lượt được kiểm tra định dạng, không tự gọi lại khi AI trả sai. Không bảo đảm AI luôn trả đúng định dạng hoặc mọi tuyên bố đều chính xác; dữ liệu người bán cũng cần kiểm chứng.
- Tạo video cần tài khoản Muse có quyền/hạn mức hoặc API Google Veo. Lồng tiếng dùng OpenAI API cần khóa/số dư trong Kết nối AI của dự án; đăng nhập ChatGPT web không cấp quyền TTS. Có thể tính phí theo nhà cung cấp. Chưa kiểm chứng sinh video người cầm sản phẩm hay chất lượng giọng thật trong tài khoản người dùng.
- Một tác vụ biên tập mỗi lượt để giữ trật tự trong tab AI; tối đa 50 tác vụ chờ/chạy, 200 tác vụ lưu cục bộ. Tạm dừng chỉ ngừng nhận việc tiếp theo. Dừng tác vụ hủy chờ/gửi đang quản lý, không tự bắt đầu bước kế tiếp. Thoát app dừng việc đang chạy; mở lại giữ hàng chờ tạm dừng, đánh dấu lượt bị gián đoạn để người dùng kiểm tra trước khi tạo phiên bản mới.
- Ảnh thu nhỏ tối đa 1600px, giữ tỷ lệ; giới hạn tải 8 MB/ảnh, 20 MB tổng byte nguồn. Ảnh lưu thành tệp riêng, thông tin hàng chờ không chứa base64 lớn. Không tải lên máy chủ Workflow. Chỉ nội dung kịch bản được gửi tới tab AI đã chọn; ảnh nguồn đi vào canvas và được gửi khi chạy node tạo video.
- Xóa khỏi danh sách là ẩn tác vụ; dữ liệu và lịch sử chống trùng còn trên máy. Chưa có công cụ dọn hàng loạt hoặc đồng bộ đám mây.
- Chống trùng dựa trên tương đồng câu chữ, không bảo đảm phát hiện mọi ý tưởng trùng. Kiểm tra AI là lượt riêng, không thay thế người kiểm duyệt sản phẩm/thương mại.

## Bằng chứng kiểm tra

Kiểm thử đơn vị dùng phản hồi Shopee/AI giả lập, kiểm tra host/redirect HTTPS, HTML/JSON-LD, giới hạn byte, dẫn nguồn, kiểm tra từng cảnh, chống trùng, hủy, tạm dừng/tiếp tục, khôi phục sau gián đoạn, dữ liệu hỏng và content vào bản nháp.

Electron smoke chạy parser và giải mã ảnh gốc bằng nativeImage thật; giao diện 1000×700 và 1420×950; bốn bước biên tập mô phỏng; tạo đủ 14 node video/ảnh/lời đọc; mở lại không nhân đôi dự án; giữ content/link và chuyển MP4 thật từ fixture vào bản nháp Đăng bài. Không gửi bài thật.

Đã thử kết nối link sản phẩm Shopee shop `1053077389`, item `25176208160` từ môi trường làm việc ngày 25/10/2026 nhưng yêu cầu mạng thất bại. Chưa có bằng chứng đọc sản phẩm này hoặc chạy AI/TTS/video/social thật. Cần thử nguồn và tài khoản thực tế trên máy người dùng trước khi coi luồng sẵn sàng vận hành.

Thiết kế tham khảo luồng được người dùng cung cấp trong [reup-shopee-aff](https://github.com/mktminhqpbga-glitch/reup-shopee-aff), viết lại để dùng dịch vụ desktop và canvas hiện có; không nhúng backend Python, khóa dịch vụ hoặc runtime của repo đó.

## Luồng chọn kịch bản · 0.42.0

1. Dán link → **Lấy thông tin & ảnh**. Bước này chỉ đọc nguồn Shopee công khai và giải mã ảnh, không cần chọn AI và chưa gọi AI.
2. Xem tên, ảnh và mô tả sản phẩm đã lấy. Lỗi quyền đọc/CAPTCHA/thiếu ảnh được báo ở tác vụ, không tự bịa dữ liệu hay gọi AI tiếp.
3. Chọn **AI viết kịch bản** hoặc **Dùng kịch bản của tôi**.
   - AI viết: chọn tab hoặc kết nối API đã cấu hình; có thể dán kịch bản mẫu để tham khảo cấu trúc/nhịp kể. Tiếp tục bốn bước hồ sơ → góc kể → từng cảnh → kiểm tra nguồn. Mẫu không được dùng làm nguồn dữ kiện về sản phẩm.
   - Kịch bản của tôi: nhập tối đa 12.000 ký tự, mỗi đoạn ngăn bằng một dòng trống là một cảnh (tối đa 12 cảnh, 1.800 ký tự/cảnh). Xác nhận đã kiểm tra nội dung. App giữ nguyên lời đọc từng đoạn, không gọi AI viết lại và ghi rõ đây là nội dung bạn xác nhận, chưa kiểm chứng bằng AI. Ước tính thời lượng/gắn ảnh chỉ là điểm bắt đầu; xem lại trên canvas. Không tự thêm công bố affiliate vào lời đọc; content xuất ra có dòng “Có liên kết tiếp thị” và link gốc.
4. Xem từng cảnh → **Tạo workflow trên canvas**. Có thể thêm lời đọc. Bấm tạo workflow chưa gọi sinh video/giọng hoặc đăng bài. Kết quả cuối đưa sang ứng dụng Đăng bài & điều hành như trước.

Tác vụ nguồn và lựa chọn/kịch bản đã gửi được lưu trên máy; mở lại giữ nguyên nội dung. Không tự gửi lại AI sau lỗi/gián đoạn. Nếu đã có workflow, tạo tác vụ sản phẩm mới để làm một phiên bản khác, tránh ghi đè workflow đang dùng. Nguồn đã lấy xong được dùng cho bước kịch bản, không tải lại ảnh chỉ vì chuyển nhánh.
