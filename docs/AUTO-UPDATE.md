# Cập nhật ứng dụng

## Hành vi bản 0.31.0

- Bản cài Mac kiểm tra sau 30 giây mở app, rồi mỗi 6 giờ. Có thể bấm **Cập nhật → Kiểm tra bản mới** bất cứ lúc nào.
- App **được ký Developer ID** dùng electron-updater: kiểm tra bản stable trên GitHub Releases, tải trong nền, hiển thị tiến độ. Chỉ cài khi người dùng chọn **Cài và khởi động lại** và xác nhận trong hộp thoại hệ thống của app.
- App **chưa ký** chỉ tự kiểm tra phiên bản và mở trang phát hành để tải thủ công. Không dùng trình cài native vì macOS yêu cầu chữ ký hợp lệ cho luồng này.
- Chạy từ mã nguồn và Linux: không tự cập nhật ứng dụng macOS. Panel vẫn giải thích trạng thái.
- Thoát app bình thường **không** tự cài bản đã tải. Trước khi cài, app dừng workflow và chờ lưu mọi dự án. Nếu người dùng hủy hoặc lưu lỗi, không tiến hành cài.
- API key, cookie và thư mục dữ liệu không được đóng gói hay tải lên trong quá trình cập nhật.

## Giảm dung lượng tải

Electron-updater 6.8.9 trên Mac hỗ trợ differential download khi có `update.zip` của lần trước trong cache và blockmap tương ứng trên máy chủ. App để `disableDifferentialDownload=false` và giữ việc kiểm tra tính toàn vẹn mặc định.

Lần đầu chưa có cache sẽ tải ZIP đầy đủ. Mất cache, blockmap không dùng được hoặc thay đổi lớn có thể dẫn đến tải đầy đủ. Không thể cam kết mọi lần chỉ tải một phần nhỏ. Cần giữ các tệp `.zip`, `.blockmap` và `latest-mac.yml` của các phiên bản phát hành, nhất là phiên bản cũ mà người dùng còn đang chạy. Không dọn cache cập nhật để tiết kiệm dung lượng nếu muốn dùng lần sau.

Phiên bản giao thức bridge Muse được kiểm tra riêng với phiên bản app, nên các lần nâng app vẫn giữ giao thức tương thích không bắt buộc cài lại extension. Khi bridge thay đổi không tương thích, app yêu cầu nâng tiện ích trước khi gửi tác vụ. Tiện ích cài bằng Load unpacked không tự nâng mã như app.

Không tách mã JavaScript tải từ xa rồi chạy ngoài gói ứng dụng đã ký.

## Nguồn phiên bản

- Repository: `mktminhqpbga-glitch/workflow`.
- Kênh: GitHub Releases **stable, đã publish**. Bản draft/prerelease không được cung cấp qua kênh stable này.
- Tên gói: `Workflow-<version>-mac-arm64.zip` và `Workflow-<version>-mac-x64.zip`.
- Native updater dùng cấu hình `publish` do electron-builder ghi vào `app-update.yml`, xác minh hash và cơ chế kiểm tra chữ ký của macOS.
- Chế độ chưa ký chỉ đọc metadata công khai từ GitHub API; không nhúng GitHub token vào app. Release chỉ có mã nguồn, không có ZIP desktop, không được coi là bản cài mới.

## Khi chưa có Apple Developer

Bạn vẫn dùng được app và tính năng kiểm tra bản mới. Người quản lý có thể đăng gói ZIP chưa ký lên một release stable để app dẫn đến trang tải. Muốn chuyển sang tải nền + tự cài, cần cài một bản có chữ ký Developer ID hợp lệ trước; bản thử unsigned cũ không tự chuyển thành signed một cách bảo đảm.

Chưa bật phân phối tự cài trong bản thử chỉ bằng cách thêm thư viện. Cần chứng chỉ, bản phát hành hợp lệ và kiểm thử trên Mac thật. Không tắt Gatekeeper hoặc bỏ xác minh chữ ký để vượt bước này.

## Quy trình phát hành signed sau này

Workflow `.github/workflows/release.yml` chỉ chạy thủ công trên một tag đã có, tag phải đúng `v` + version trong `package.json`. Cấu hình các GitHub repository secrets:

| Secret | Nội dung |
| --- | --- |
| `MAC_CERTIFICATE_P12` | Chứng chỉ Developer ID Application `.p12`, dạng base64 hoặc nguồn được electron-builder hỗ trợ |
| `MAC_CERTIFICATE_PASSWORD` | Mật khẩu chứng chỉ |
| `APPLE_ID` | Tài khoản Apple phục vụ notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | Mật khẩu ứng dụng cho notarization |
| `APPLE_TEAM_ID` | Team ID của Apple Developer |

Nhập các giá trị trong **GitHub → Settings → Secrets and variables → Actions**, không gửi vào chat hoặc commit. Token phát hành dùng `GITHUB_TOKEN` ngắn hạn do Actions cấp với quyền viết release; không cần đóng gói PAT vào ứng dụng.

Workflow cài dependency theo lockfile, chạy tests, buộc ký, notarize, build cả hai kiến trúc và tạo **draft release** kèm ZIP/DMG/blockmap/metadata. Nó không tự publish. Người quản lý kiểm tra gói trên Mac rồi publish draft để mở cập nhật cho người dùng. Nếu secrets còn thiếu, workflow dừng trước bước build.

Workflow `.github/workflows/desktop.yml` vẫn chỉ tạo artifact unsigned để QA, không đưa nó lên kênh tự cài.

## Kiểm thử và giới hạn

`tests/desktop-updater.test.cjs` dùng SDK giả lập để kiểm tra trạng thái, tải nền, không tự cài khi thoát, xác nhận/lưu trước cài, lỗi và retry, phiên bản stable, signature gate và lịch kiểm tra. `tests/desktop-smoke.cjs` mở Electron thật để kiểm tra panel cập nhật và các chức năng dự án.

Các kiểm thử đó không chứng minh Squirrel.Mac đã thay ứng dụng thành công, notarization được Apple chấp nhận, GitHub Releases đang có bản live hay differential download đã giảm bao nhiêu byte trên Mac thật. Các kiểm tra cuối đó cần hai phiên bản đã ký và một máy Mac.
