# Rà soát đường đi của kết quả — 0.29.0

Ảnh người dùng cung cấp có đầu ra ảnh trên Muse, node Generate Image còn chờ, trạng thái dùng sai chữ video và chọn chat hiển thị đã đổi. Đây là bằng chứng đầu ra tồn tại nhưng node chưa nhận được, không phải bằng chứng Muse chưa tạo. Không có DOM/báo cáo mới của ảnh này, nên không khẳng định một nguyên nhân duy nhất trên tài khoản thật.

## Các thiếu sót tìm được và sửa

1. Dò ảnh trước đây chỉ thêm ảnh từ lớp assistant nhận biết được hoặc marker attachment. Ảnh thuần nằm trong giao diện khác bị bỏ sót. Nay dò ảnh có kích thước tự nhiên từ 128px, ảnh chưa biết cấu trúc chỉ được nhận sau biên prompt mới, trước ô nhập, không phải user/composer và không thuộc nguồn có trước. Avatar/placeholder vẫn bị loại.
2. Biên prompt mới chỉ dùng main/role=main; giao diện dùng div thuần không có đường dự phòng. Nay dùng tổ tiên chung của prompt mới và ô nhập, vẫn kiểm tra thứ tự.
3. Composer scope không coi attachment marker là lịch sử; có thể bao quá rộng. Thêm marker lịch sử và không loại nhầm media trả lời nằm trước ô nhập chỉ vì cùng tổ tiên rộng.
4. Trạng thái node tạo ảnh ghi video. Nay phản ánh đúng loại yêu cầu.
5. Nhánh Muse không lưu lại URL chat sau kết quả như Gemini/ChatGPT. Nay trả URL từ bridge, đối chiếu URL hiện tại đúng tab rồi cập nhật; ghi chuyển tiếp cùng origin trong phiên để mục đã chốt URL cũ không bị chặn sai. Không bỏ kiểm tra chuyển chat tùy ý. Khi URL đổi mà không thấy receipt prompt hiện tại, không lấy kết quả từ chat khác.
6. Bridge cũ có thể còn trên tab sau cập nhật extension. Nếu bridge báo phiên bản khác manifest, chặn trước khi gửi và yêu cầu tải lại tab. Bridge rất cũ không có trường version vẫn giữ đường tương thích cũ.
7. Timer thông báo 5 giây liên tục reset làm nhánh kiểm tra thiếu credits không chạy. Nay kiểm tra phản hồi mới độc lập với timer, không dựa thông báo credits cũ trong lịch sử.

## Các đường đã kiểm tra

| Đường | Kiểm chứng |
|---|---|
| Node Muse tạo ảnh/video | Receipt, nguồn mới, ảnh thuần, video blob lồng, không có văn bản, bỏ lịch sử và nội dung ngoài chat |
| Truyền kết quả dài | START/STATUS/ACK; rơi ACK/poll không gửi trùng; trả đúng byte video, trích khung cuối |
| Định tuyến tab | URL được xác minh sau kết quả, cập nhật target, chuyển tiếp mục đã chốt URL cũ; bridge cũ bị chặn trước gửi |
| Run All / nhiều nhánh | Producer chung chạy một lần; tab riêng chạy song song; cùng tab FIFO; lỗi chặn descendants; dừng không khởi động nhánh chờ |
| Hàng đợi / Flow Studio | Snapshot prompt/ảnh/tab; cap dùng chung; đúng kết quả Task ID; MP4 preview; khoảng cách gửi 5 giây |
| Kịch bản tổng | Ảnh → video → ghép cảnh/đoạn/phần/chương; phạm vi chạy, cache và chạy lại cảnh sửa; MP4 thật với provider mô phỏng |
| Gemini / ChatGPT | Gửi một lần, chờ upload/streaming, phản hồi mới, DOM hiện đại, writing block và transport video |

## Giới hạn

Các kiểm thử chạy Chromium thật, DOM/provider AI mô phỏng. Chưa truy cập phiên Muse thật, không thể bảo đảm mọi thay đổi HTML đều được bao phủ. Shadow DOM đóng/iframe hoặc kết quả chỉ vẽ bằng canvas chưa có đường tự lấy. Nếu tiếp tục kẹt, báo cáo mới có lastScan (loại, số ứng viên, loại do baseline, receipt, matching, đổi URL) cùng cấu trúc ảnh/video để phân biệt thiếu selector, nguồn cũ, sai chat và lỗi tải. Không chứa URL ảnh/video, prompt hoặc cookie.

Cập nhật extension rồi tải lại cả Workflow và tab Muse khi tác vụ đã dừng. Kết quả đã có trên Muse không cần tạo lại chỉ để thử bộ nhận.
