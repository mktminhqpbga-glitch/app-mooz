# Ảnh nhân vật tham chiếu tùy chọn — 0.61.5

Vào **Video hàng loạt → Luồng & tab AI → Ảnh nhân vật tham chiếu**, cạnh **Prompt chung**. Tải một ảnh từ máy hoặc chọn ảnh có trong kho, xem trước và bấm **Lưu vào luồng**. Việc lưu ảnh không gọi AI hoặc tạo thêm sản phẩm.

- Mặc định **tắt**. Bật **Dùng ảnh nhân vật tham chiếu** khi cần; tắt vẫn giữ ảnh đã chọn để bật lại. **Bỏ chọn ảnh** xóa lựa chọn trong luồng, không xóa tệp của bạn khỏi kho.
- Áp dụng cho bước **Tạo ảnh** và **Tạo video** trong luồng sản phẩm. Bước đọc ảnh/viết kịch bản chỉ nhận ảnh sản phẩm. Các chế độ Văn bản, Đầu → Cuối và Nối dài vẫn dùng đầu vào riêng của chúng.
- Ảnh sản phẩm hoặc ảnh của đúng cảnh được gửi trước, ảnh nhân vật ở cuối. Prompt ghi rõ vai trò và yêu cầu giữ nhất quán nhận diện nhân vật khi xuất hiện, không thay ảnh sản phẩm bằng ảnh nhân vật. Khả năng giữ nhận diện thực tế tùy dịch vụ AI.
- Một ảnh nhân vật, tối đa 20 MB. Khi bật, mỗi sản phẩm tối đa 7 ảnh sản phẩm để tổng đầu vào không vượt 8 ảnh; báo lỗi trước khi xếp hàng nếu vượt giới hạn hoặc ảnh đã bị bỏ khỏi kho.
- Ảnh và trạng thái bật/tắt được chốt riêng theo luồng của mỗi tác vụ. Đổi/tắt/bỏ ảnh không thay tác vụ đã xếp hàng. Lưu và mở lại app vẫn giữ ảnh trong kho cục bộ.

Đã mở Electron và kiểm tra qua nút thật: trạng thái mặc định, chọn từ kho rỗng/có ảnh, picker thuộc cửa sổ gốc, hủy chọn, tệp hỏng, preview, lưu/hủy/mở lại/bỏ chọn, bật/tắt, dialog nhỏ 640px. Transport AI và thao tác chọn tệp OS được giả lập có kiểm soát trong bộ này.

Kiểm tra luồng ba sản phẩm, mỗi sản phẩm hai cảnh: **6 yêu cầu tạo ảnh + 6 yêu cầu video** qua IPC thật, ba MP4 ghép cục bộ. Thay ảnh khi sản phẩm A đang chạy: cả hai cảnh vẫn nhận nhân vật A, sản phẩm B nhận nhân vật B. Mỗi video giữ ảnh riêng của đúng cảnh. Tắt tham chiếu cho sản phẩm sau thì không gửi ảnh nhân vật. 23 ca unit liên quan gồm kiểm tra giới hạn, lựa chọn một ảnh, từ chối trước khi đọc nhiều tệp và bản chốt riêng của hàng đợi.

Kiểm tra picker sản phẩm và Prompt chung được giữ lại. Đóng gói Mac chạy thêm `desktop-batch-character-reference-smoke.cjs`. Kiểm tra bộ cài Windows mở picker ảnh nhân vật thật, xác nhận preview/lưu và không tạo thêm sản phẩm; giữ quy trình cài/nâng cấp/gỡ và bảo toàn dữ liệu của bản trước. Không gửi AI trả phí hay đăng bài thật.
