# Theo dõi đánh giá bổ sung và Trung tâm báo lỗi · 0.45.1

Đã đọc đủ các lần đánh giá 1–4 trong tệp người dùng gửi. Phần đầu dựa trên 0.44.0; phần sau đã xác nhận usability 0.45.0 có trên repo. Không coi những lỗi đã được xác nhận sửa là lỗi mới.

## Đã xử lý trong đợt này

1. **Trung tâm báo lỗi:** tự ghi lỗi thao tác/giao diện, ghi chú tái hiện, gộp lỗi lặp, lọc Chưa xử lý/Đã xử lý, mở lại, giữ trên máy và xem/xuất JSON đã lọc dữ liệu riêng. [Cách dùng](DIAGNOSTICS.md).
2. **Thông báo không che node:** chuyển thông báo sang hàng riêng trong header. Lần đóng gói Mac đã chứng minh notice cũ che nút đổi tên; không dùng force-click để giấu lỗi này.
3. **Nhập workflow không chờ lưu mới Fit:** lỗi phát hiện ở Mac 0.45.0 đã được tái hiện bằng ghi tệp bị giữ chờ, sửa và bổ sung hit-test trước khi việc lưu hoàn tất. Trả lại góc nhìn cũ nếu nhập thất bại.
4. **Tên Chat:** áp các thay đổi nhãn được đề nghị tại workspace-hub, connections, workflow-chat và bảng ảnh đính kèm; giữ chức năng Chat trong dự án. Có kiểm thử nhãn riêng.
5. **Theme:** chọn Đen tím làm mặc định khi chưa có cài đặt hợp lệ; theme người dùng đã lưu vẫn được giữ.
6. **Cài Mac chưa ký:** thêm đường dẫn Gatekeeper vào QUICKSTART; không hướng dẫn tắt bảo vệ toàn máy, không dựng ảnh giả của macOS.
7. **Hiệu năng 100 node:** thêm phép đo nhập và sắp xếp trong Electron, giữ nguyên 100 node và ghi thời gian theo máy chạy. Chưa dùng phép đo một máy để quảng cáo thông lượng sản xuất video.

## Phân biệt việc đã làm với backlog

- Agent vẫn ở giai đoạn thiết kế; không đổi nhãn để tuyên bố app có vòng lặp tự vận hành. API canvas chung, log/trạng thái agent, lớp gọi model chung và màn duyệt phải được triển khai/kiểm thử như các phần riêng.
- Mẫu workflow và kiểm tra trước chạy đã có một phần trong app; cần rà hợp nhất thay vì tạo công cụ trùng chức năng.
- Xuất toàn bộ dự án và media thành ZIP, tour checklist trong app, chuyển toàn app thành một cửa sổ và agent đăng bài riêng là công việc tiếp theo, không được ghi là hoàn tất trong bản sửa lỗi này.
- Lịch đăng vẫn cần app mở và máy thức; chưa có dịch vụ cloud chạy lịch thay máy người dùng.

## Kiểm chứng

Kết quả kiểm thử được ghi sau khi chạy bản sửa: bộ đơn vị, toàn bộ nhóm Electron, phép đo 100 node, kiểm tra báo cáo và trạng thái GitHub Actions theo commit. Các luồng AI/đăng bài trong kiểm thử dùng fixture; media/FFmpeg, IPC, file lưu và clipboard dùng thành phần thật.


Kết quả trên máy kiểm thử: **225/225 kiểm thử đơn vị**, **14/14 nhóm Electron** qua. Phép đo 100 node: nhập **117 ms**, sắp xếp **142 ms**; số này phụ thuộc máy, không phải cam kết tốc độ chung. Kiểm thử Trung tâm báo lỗi xác nhận tự ghi lỗi, lọc trước khi lưu/xuất, ghi chú không lẫn/mất khi lỗi khác xuất hiện, mở lại/đánh dấu xử lý, clipboard native và file JSON đúng bản chụp đã xem.

Một lần chạy fixture Muse bị chờ quá hạn 30 giây; chạy riêng đã qua. Fixture đã được bổ sung trạng thái chẩn đoán khi thất bại, báo lỗi ngay khi hàng chờ vào trạng thái lỗi, và chờ tối đa 60 giây khi hệ thống vẫn đang xử lý. Lần chạy toàn bộ tiếp theo đã qua; không dùng force-click hoặc bỏ kiểm thử. GitHub Actions tiếp tục chạy lại bộ kiểm thử trên Mac trước khi đóng gói.
