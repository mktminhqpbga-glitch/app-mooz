# Giao diện Workflow 0.40.0

Thanh trên giữ Kết nối Chrome, Thêm node, Kịch bản tổng, Lưu, Chạy workflow và Thêm. Không cần mở menu để tạo node hoặc kịch bản. Công cụ phụ, mở cửa sổ AI, kết nối và cập nhật nằm trong Thêm. Sidebar giữ các lối về dự án, ảnh chung, trợ lý, đăng bài, Chat AI và Cửa sổ; khi timeline mở, Chat AI dùng lối vào sidebar thay nút nổi.

Dự án mới bắt đầu bằng hai node Yêu cầu → Tạo ảnh; ảnh hiện ngay trong node tạo, bỏ thẻ xem trước mẫu dư thừa. Nội dung mẫu bằng tiếng Việt về sản phẩm. Dự án đã lưu không bị thay mẫu.

Menu Thêm node lấy tên từ cùng một danh mục với tiêu đề node: tên tiếng Việt, Hay dùng, Dùng gần đây, tìm không dấu và mô tả ngắn. Tên tự đặt của người dùng không bị đổi. Bảng ảnh chung có thể dùng toàn workflow; Ảnh tham chiếu riêng chỉ đi theo dây đã nối; Gán vai trò ảnh phân biệt nhân vật/bối cảnh/trang phục/tư thế; Tổng ảnh gom thành phẩm để tải/đăng. Thêm một node ảnh tham chiếu riêng không còn tự nối đến tất cả node tạo. Các dây đã lưu được giữ nguyên.

Nối thêm văn bản thêm nội dung bạn gõ sau một nguồn; Gộp nhiều văn bản nhận nhiều dây vào một cổng và dùng dấu phân cách. Ghép dòng thời gian (node) nhận các clip đã nối, khác thanh Dòng thời gian ở dưới dùng để sắp/xuất. Lồng tiếng · OpenAI là đường đang hoạt động: thêm node hoặc chọn Lồng tiếng AI ở trang chủ → chọn dự án → nhập/nối lời đọc → Thêm → Kết nối AI → OpenAI API → Thực hiện. Ứng dụng lồng tiếng riêng vẫn chờ tích hợp, chưa thêm nhà cung cấp mới.

Node mới dùng kích thước thực để tìm chỗ trống gần node đang chọn, không dời node cũ và đưa node mới vào vùng nhìn. Sắp xếp tất cả tách từng cụm có dây, xếp trái → phải, rồi đặt node rời theo nhóm/thứ tự tạo trên lưới 2–5 cột tùy vùng nhìn và kích thước. Chỉ xếp node chưa nối dây giữ nguyên tọa độ các node có dây. Ctrl/⌘Z hoàn tác sắp xếp. Nếu toàn luồng quá lớn, sắp xếp giữ mức nhìn đọc được thay vì ép xuống 25%; dùng bản đồ nhỏ để kéo xem hoặc bấm Vừa màn hình khi cần xem tổng quan. Nút zoom bị khóa tại 25% và 250%.

Nút Gọn / Đầy đủ trong công cụ khung vẽ lưu riêng theo dự án, không thay đổi đầu vào/kết quả AI. Chế độ gọn thu ô nhập, thông tin phụ và nhãn cổng; nhãn hiện lại khi rê chuột, chọn node hoặc kéo dây. Ảnh tham chiếu riêng và node dòng thời gian có nút thu gọn cổng chưa dùng, luôn giữ mọi cổng đã nối và một cổng trống. Màu/biểu tượng phân nhóm văn bản, ảnh, video, âm thanh và kiểm soát; node kiểm soát có viền đứt và nhãn riêng. Mã node ở Về node này hoặc tooltip tiêu đề, vẫn sao chép được.

Giao diện → Sáng / Tối / Theo hệ thống và Giao diện lớn (+17%) được lưu trên máy, dùng chung các cửa sổ. Chế độ sáng áp dụng thư viện, Đăng bài và Affiliate; khung vẽ giữ nền tối. Chữ nhãn/trạng thái chính tối thiểu 12px ở mức giao diện tiêu chuẩn, 14px ở mức lớn; zoom khung vẽ vẫn có thể làm nội dung node nhỏ khi xem toàn luồng. Giao diện lớn không đổi zoom canvas. Cửa sổ liệt kê dự án/công cụ đang mở để quay lại; không chuyển toàn app thành một cửa sổ và không đóng công việc đang chạy.

Tạo, đổi tên, xóa/hoàn tác, khôi phục và lưu dự án qua API gửi thông báo để thư viện tự làm mới. Kết quả đọc danh sách cũ không được ghi đè kết quả mới hơn. Cài đặt giao diện nằm riêng, không ghi token/khóa AI và không làm thay dữ liệu dự án.

Đã kiểm tra bằng Electron thật: danh sách từ API không tải lại, mở Lồng tiếng hiện có, nhiều lần thêm node không đè nhau, tên menu/card, tìm không dấu, 37 node rời thành lưới, chỉ xếp node rời giữ bố cục, bản đồ, zoom tới giới hạn, đổi giao diện giữa các cửa sổ và khôi phục sau mở lại app. Không gửi yêu cầu AI hoặc bài đăng thật trong kiểm thử UX.

## Tổng hợp video · 0.41.1

Thêm node **Tổng hợp video** → **Gom video kết quả** → kiểm tra **Thứ tự ghép** → **Ghép video**. Kết quả là một MP4 dài; các dòng trong danh sách chỉ là thứ tự clip nguồn. Có thể đưa lên/xuống hoặc bỏ từng clip. Nút gom mặc định chỉ chọn video kết quả hoàn tất, lấy đầu ra hậu kỳ cuối cùng và không tự gom video đầu vào tham chiếu. Nếu đã chọn clip trong node dòng thời gian, thứ tự đó được ưu tiên; vẫn nối tay các cổng Video được.

Video H.264 cùng định dạng (có AAC hoặc không có âm thanh) được ghép trực tiếp không mã hóa lại. Nếu cần mã hóa do khác định dạng, giữ kích thước và fps của clip đầu; clip khác tỷ lệ được đặt vừa bằng viền đệm, không kéo méo/cắt hình. Không tự áp mức 1280px/24fps cho ghép video. Cần đổi thứ tự clip đầu nếu muốn lấy khung của clip khác. Tệp thực tế vẫn phụ thuộc chất lượng video nguồn; không khôi phục chi tiết đã mất trong nguồn.

**Nhạc / lời đọc bổ sung** nằm trong mục tùy chọn; không cần tải nhạc để ghép video. Xem kích thước/thời lượng thật dưới video hoàn chỉnh. Preview hiển thị vừa thẻ không thay kích thước tệp. **Thêm vào hàng chờ** đưa một video hoàn chỉnh sang Đăng bài; Muse nhận tệp này, không nhận từng preview. Thay nguồn/thứ tự sẽ khóa tải/đăng kết quả cũ đến khi ghép lại.

Kiểm thử bằng FFmpeg thật trong Electron: 9 clip 900×1600, 30fps, không tiếng → một MP4 1,8 giây giữ kích thước, đúng thứ tự màu và không mã hóa lại; thử thêm clip khác kích thước/fps/có tiếng để kiểm tra nhánh mã hóa. Một thành phẩm tạo đúng một bản nháp Đăng bài với một tệp output gốc. Không gửi AI hoặc đăng bài thật.

Đề xuất thiết kế hiện đại ở [designs](../designs/README.md) là bản xem thử riêng. Chưa đưa giao diện tổng thể mới vào runtime hay gói cài đặt.

## Công cụ nằm bên trái · 0.42.0

Thanh trái chứa **chính các nút thao tác**: Ảnh tham chiếu chung, Trợ lý sáng tạo, Hàng đợi/Kho ảnh, Tạo hàng loạt, Tạo ảnh hàng loạt, Kịch bản → Node, Bảng điều khiển kịch bản, Kho prompt, Tải media, nhập/xuất workflow, sắp xếp và bảo trì. Cuộn thanh công cụ để tới các mục bên dưới; không còn mở menu “Thêm” để tìm chúng. Lối về dự án/Đăng bài/Chat trong dự án/Cửa sổ nằm gọn ở cuối thanh.

Trạng thái Muse/Gemini/GPT và nút chạy/lưu/thêm node dùng chung thanh trên, bỏ tiêu đề “Quy trình sáng tạo” và hàng trạng thái riêng. Bản đồ nằm ở góc trên trái canvas, ngay dưới cụm zoom. Giữ chức năng kéo bản đồ để di chuyển và giới hạn zoom. Thư viện bỏ thẻ Chat AI độc lập; Chat trong dự án vẫn hoạt động. **Đăng bài & điều hành** là một mục ứng dụng duy nhất, bao gồm soạn bài, lịch, thương hiệu, kho thành phẩm, tài khoản và hiệu quả.

Cài đặt chung ở **Cài đặt & kết nối AI**: tải tiện ích, kết nối Chrome, giao diện, kết nối API tùy chỉnh và lối tới thiết lập AI của dự án. [Hướng dẫn kết nối AI khác](AI-CONNECTIONS.md).
