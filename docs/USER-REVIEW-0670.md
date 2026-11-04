# MooZ Agent 0.67.0 · Đợt rà soát và hoàn thiện

## Giao diện và thao tác

- Thư viện, Canvas, Video hàng loạt, Đăng bài và Affiliate: rút lời giới thiệu, tiêu đề phụ và hướng dẫn lặp. Giữ nhãn trường, lỗi, tiến độ, thông tin kết nối và xác nhận cần thiết.
- Cài đặt: API, nhịp gửi và hướng dẫn cài tiện ích mặc định thu gọn. Trạng thái AI bị chặn tự mở để người dùng xử lý. Sửa kết nối API đã lưu sẽ mở đúng form. Không xóa dữ liệu khi đóng/mở phần mở rộng.
- Canvas: mục AI ngắn trên thanh công cụ; mở để kiểm tra từng dịch vụ. Escape hoặc bấm ra ngoài đóng danh sách. Thông báo cập nhật vẫn ở ngoài. Các bước kết nối, nhập kịch bản và Flow Studio dùng lời ngắn hơn.
- Video hàng loạt: phân biệt ảnh sản phẩm và ảnh nhân vật cố định. Sửa chiều cao khung soạn desktop để các lựa chọn AI, thời lượng và tab chạy không bị đẩy dưới thanh chạy. Cửa sổ thấp/cỡ chữ lớn vẫn cuộn được.
- Hàng đợi: chọn tất cả theo đúng trang; thể hiện chọn một phần; tìm kiếm cập nhật số mục và phân trang ngay; nút chỉ bật khi có mục phù hợp; dọn mục xong trong dự án đang mở.
- Đăng bài: giữ bố cục ba thẻ một hàng trên desktop. Khóa thao tác đang chờ để tránh bấm lặp; lưu dữ liệu đã chốt và không xóa các thay đổi mới hơn.
- Đăng bài/Affiliate: phản hồi làm mới cũ không ghi đè danh sách mới; lựa chọn AI được giữ khi mất rồi có lại kết nối. Không tự đổi sang tab còn lại.
- Thư viện: chống mở dialog/gửi form lặp, chặn đóng khi lưu/khôi phục chưa xong và bỏ phản hồi refresh lỗi cũ.
- Nút Kết nối Chrome từ Đăng bài/Affiliate mở thẳng hộp ghép Chrome ở Thư viện, thay vì chỉ chuyển màn.

## Kết nối

Tiện ích đi kèm **MooZ Connect 1.9.1**, giao thức kết nối 1. Giữ các cải thiện 0.66: phục hồi ngắn, chuyển lại đúng phản hồi chờ ACK, không gửi lại AI và không dựa vào đồng hồ Chrome để kết luận hạn mã.

- Timeout xác thực trong lúc nối lại được xem là lỗi tạm thời, cho phép thử tiếp trong thời gian phục hồi còn lại.
- Nếu quyền truy cập bị gỡ, hiển thị lỗi có thể xử lý thay vì mắc kẹt ở Đang nối lại.
- Socket đã bị bỏ không được gửi xác thực sau khi người dùng ngắt hoặc đổi kết nối.

Cập nhật cả app và tiện ích. Nếu relay đã triển khai bản sửa 0.66 thì đợt này không có thay đổi server mới. Nếu chưa triển khai, làm theo [hướng dẫn 0.66](USER-REVIEW-0660.md). Blueprint tắt tự động deploy; file cài mới không chứng minh dịch vụ Render của người dùng đã được cập nhật.

## Kiểm chứng và phạm vi

- Bộ unit/integration: 424 kiểm thử đạt, gồm vòng đời reconnect, timeout, giữ phản hồi, chống gửi lại, graph và scheduler.
- Electron thật: năm màn ở sáng/tối, 1500/1008/640, cỡ chữ lớn, chuyển động giảm, font local, tương phản và không tràn ngang; thao tác node bằng phím và nối bằng danh sách.
- Kiểm tra thao tác và cài đặt: mở hộp ghép thực tế từ các màn, thu gọn/mở form không mất bản nháp, xóa mã/khóa chưa lưu khi đóng, form sửa API hiện đúng.
- Các smoke liên quan Thư viện, Đăng bài, Affiliate và khung soạn video đã chạy với dữ liệu cô lập. Không gửi AI trả phí, đọc Shopee thật hoặc đăng bài thật.

Đây là các phần đã rà soát và có kiểm chứng; không phải cam kết mọi website AI/mạng bên ngoài luôn hoạt động. Các guard nhận đúng lượt gửi, đúng chat và loại media vẫn giữ nguyên. Render mất host/khởi động lại hoặc app/Chrome thoát vẫn có thể cần ghép lại và kiểm tra kết quả chưa rõ trạng thái.
