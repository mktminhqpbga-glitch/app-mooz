# Canvas cho luồng A → Z — 0.62.0

Vào **Video hàng loạt → Luồng & tab AI**. Canvas mới là màn mặc định. Luồng bán hàng trước đây vẫn có nút mở riêng, giữ các cấu hình và tác vụ đã chốt từ bản cũ. Lần đầu nâng cấp, canvas nhận một bản sao từ cấu hình luồng bán hàng hiện có.

## Thiết lập mẫu

1. **Luồng mới**: chọn canvas trống hoặc mẫu Ảnh sản phẩm → Video, Prompt + nhân vật → Video, Kịch bản có sẵn → Video, Yêu cầu → Văn bản. Đặt tên Luồng 1, Luồng 2… hoặc tên của bạn.
2. **Đầu vào A/B/C…**: thêm văn bản, ảnh, video hoặc âm thanh; đặt tên và đánh dấu **Bắt buộc điền khi chạy** hoặc để tùy chọn. Văn bản có giá trị mặc định; tệp được chọn riêng trong form chạy. Ảnh nhân vật là đầu vào ảnh tùy chọn nối vào cổng **Nhân vật**.
3. **Bước xử lý**: chọn Đọc sản phẩm, Viết kịch bản, Viết văn bản, Chia kịch bản có sẵn, Tạo ảnh, Tạo video, Ghép video hoặc Nhạc nền / lời đọc. Các bước AI chọn nhà cung cấp và tab cụ thể hoặc tự chia cho tab rảnh. Model là model đang chọn trong tab AI; app không tự đổi model trong website.
4. **Nối dây**: bấm cổng ra rồi cổng vào, hoặc kéo dây giữa hai cổng. Chỉ nối dữ liệu cùng loại. Chọn dây để xóa; kéo node để đổi vị trí; dùng Sắp xếp, Vừa khung, zoom, Hoàn tác/Làm lại hoặc Ctrl/Cmd Z. Vị trí node không quyết định dữ liệu hay thứ tự thực hiện.
5. **Kết quả Z**: luồng có một kết quả đích, loại văn bản/ảnh/video/âm thanh. Video có thể qua ghép cảnh và thêm nhạc; ảnh và văn bản được lưu trực tiếp thành tệp phù hợp.
6. **Lưu mẫu** giữ cấu hình để dùng lại; **Nhân bản** tạo mẫu riêng. Bản nháp chưa hoàn chỉnh vẫn lưu được, nhưng app chặn chạy nếu dây nối thiếu, sai loại, có vòng lặp hoặc có node không đi tới Z.

Mỗi luồng tối đa 40 node, 120 dây nối và 12 cảnh. Từ hai cảnh trở lên, Tạo ảnh/Tạo video cần cổng Kịch bản để giữ đúng nội dung từng cảnh. Kịch bản tự nhập dùng mỗi đoạn cách một dòng trống làm một cảnh, hoặc JSON đủ các trường cảnh; app không gửi AI để sửa lời tự nhập.

## Chạy tác vụ

Tại canvas bấm **Nhập đầu vào & chạy**, hoặc trong màn sản xuất bấm **Luồng đã lưu**. App dựng form theo đúng đầu vào của mẫu, đánh dấu mục bắt buộc và cho phép bỏ trống mục tùy chọn.

- **Tải lên** mở hộp chọn tệp của hệ điều hành; có thể **Chọn từ kho**. Ảnh tối đa 20 MB/tệp, video/âm thanh tối đa 100 MB/tệp. Tối đa tám ảnh tổng cộng cho một lượt AI; nhân vật được tính trong tổng này.
- **Thêm vào hàng đợi** chưa bắt đầu hàng đợi đang tạm dừng. **Xếp hàng & chạy** cho phép bộ điều phối bắt đầu khi có tab phù hợp. Thiếu tab thì tác vụ chờ, không tự đổi tab đã gán.
- Trước khi xếp hàng, kiểm tra đủ đầu vào, đúng loại tệp, số cảnh và dây nối. Sau khi xếp, tác vụ giữ riêng graph, phiên bản, tab đã gán và dữ liệu đầu vào. Sửa/nhân bản/xóa mẫu sau đó không thay tác vụ đang chờ/chạy.
- Khi chưa gửi bước nào, có thể rút tác vụ về sửa đầu vào. Khi tác vụ đã gửi, chạy tiếp giữ bản cũ và kết quả đã lưu. Dừng vẫn giữ quyền sử dụng tab đến khi yêu cầu cũ kết thúc; kết quả đến sau không hoàn tất lại tác vụ đã dừng.
- Các bước chỉ nhận dữ liệu từ dây được nối. Không tự lấy ảnh, prompt hoặc kết quả của node khác hay tác vụ trước. Ảnh nhân vật có chỉ dẫn vai trò riêng; khả năng giữ nhận diện thực tế tùy dịch vụ AI.

Trong một tác vụ, các bước thực hiện theo thứ tự phụ thuộc được tính từ dây nối. Nhiều tác vụ tiếp tục dùng hàng đợi và nhóm tab hiện có. Kết quả được xem trong chi tiết tác vụ, tải về hoặc mở trong kho; nút Hậu kỳ dành cho kết quả video.

## Kiểm chứng

- Unit toàn bộ dự án và các hợp đồng graph/media: kiểm tra topo, cổng đúng loại, vòng lặp, node không nối tới Z, cảnh bị thiếu, mặc định/tùy chọn/bắt buộc, tệp đã bỏ khỏi kho, tổng ảnh, bản chốt riêng, không xếp hàng một phần khi đầu vào sai, worker lease khi dừng, và chỉ đọc nguồn được nối.
- `desktop-flow-canvas-smoke.cjs` mở Electron thật: thêm/xóa/kéo node, nối/xóa dây, từ chối nối sai/có vòng lặp, undo/redo, gán tab và giữ pin mất kết nối, tạo/nhân bản/xóa/lưu mẫu và mở lại app. Kiểm tra form phát sinh, hủy chọn/tệp hỏng, ảnh nhân vật tùy chọn, đầu vào mới không lấy dữ liệu tác vụ trước; đổi loại đầu vào không giữ dữ liệu văn bản cũ bị ẩn.
- Năm tác vụ qua IPC và dữ liệu cục bộ thật: hai video có prompt/nhân vật riêng, kết quả văn bản tải thành TXT, kết quả ảnh, và ghép nhạc với video bằng FFmpeg mà không gọi AI. Kiểm tra tách dữ liệu và giữ bản luồng cũ sau sửa mẫu, kết quả và năm mẫu lưu qua khởi động lại. Chụp 1500/1008/640px sáng/tối.
- Giữ kiểm tra các màn cũ, composer video, lựa chọn tab đang mở, nhập ảnh sản phẩm, Prompt chung và ảnh nhân vật của luồng cũ. Các test cũ mở rõ mục luồng bán hàng trước đây; canvas có bộ kiểm tra riêng.
- Đóng gói Mac nhanh chạy unit graph/media và GUI canvas. Kiểm tra bộ cài Windows dùng ứng dụng đã cài, tạo mẫu canvas, kiểm tra mục bắt buộc, chọn ảnh từ hộp thoại Windows thật, xếp tác vụ mà không gọi AI và mở lại giữ mẫu/đầu vào; tiếp tục kiểm tra cài/nâng cấp/gỡ và bảo toàn profile.

AI và thao tác chọn tệp OS trong bộ GUI Electron dùng phản hồi thử có kiểm soát; Windows dùng picker OS thật. Không gọi AI trả phí hoặc đăng bài thật. Chưa xác nhận chất lượng đầu ra bằng tài khoản khách hàng. Extension MooZ Connect vẫn là 1.8.1; giao thức gửi ảnh/video không đổi. Dịch vụ OAuth, Chrome Web Store URL và chứng thư phát hành vẫn theo cấu hình hiện có.
