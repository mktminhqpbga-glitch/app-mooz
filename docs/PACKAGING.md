# Đóng gói app Mac và lấy bản mới

## Cách dễ nhất: bấm nút trên GitHub

Không cần cài Node.js hay Terminal trên máy để dùng cách này.

1. Mở [Đóng gói / Cập nhật app Mac](https://github.com/mktminhqpbga-glitch/app-mooz/actions/workflows/desktop.yml), đăng nhập bằng tài khoản có quyền chạy Actions của repository.
2. Bấm **Run workflow** ở bên phải, chọn nhánh **main**. Workflow lấy mã đã push trên nhánh được chọn.
3. Nếu chỉ muốn tải app về máy, để trống ô **Tạo thêm bản nháp trong Releases**. Nếu muốn chuẩn bị một bản cập nhật cho người dùng, đánh dấu ô đó; version này phải chưa từng có tag/release.
4. Bấm **Run workflow**, mở lần chạy mới và đợi build thành công. Không coi việc bấm nút là đã build xong.
5. Trong **Artifacts**, tải đúng gói:
   - **Workflow-Mac-AppleSilicon-DMG**: Mac M1/M2/M3/M4 và các Mac Apple Silicon.
   - **Workflow-Mac-Intel-DMG**: Mac dùng chip Intel.
6. Giải nén file artifact tải về → mở `.dmg` → kéo **Workflow.app** vào **Applications** → mở app từ Applications.

Artifact **Workflow-update-files** chứa ZIP và metadata phục vụ cập nhật/phát hành; người chỉ muốn cài app chọn artifact DMG để tránh tải cả hai kiến trúc.

Nếu không thấy nút Run workflow: kiểm tra đang đăng nhập đúng tài khoản, workflow đã nằm trên nhánh mặc định `main`, và GitHub Actions đã được bật cho repository. Nếu GitHub hiện nút Enable workflows thì bật trước. Lần build lỗi có log ngay trong job; không cần tải lại toàn bộ repository để đọc lỗi.

## Đóng gói ngay trên máy Mac của bạn

1. Cài **Node.js 24 LTS** từ [nodejs.org](https://nodejs.org/).
2. Vào [repository](https://github.com/mktminhqpbga-glitch/app-mooz), chọn **Code → Download ZIP**, giải nén thành `app-mooz-main`.
3. Mở Terminal. Gõ `cd` và một dấu cách, kéo thư mục `app-mooz-main` vào cửa sổ Terminal, rồi nhấn Return. Đảm bảo đang ở thư mục có `package.json`.
4. Chạy:

```sh
npm ci
npm run setup:desktop
```

Mac Apple Silicon:

```sh
npm run dist:mac -- --arm64
```

Mac Intel:

```sh
npm run dist:mac -- --x64
```

Hoặc tạo cả hai bản:

```sh
npm run dist:mac -- --arm64 --x64
```

Gói cài nằm trong thư mục `dist/`, ví dụ `Workflow-0.31.0-mac-arm64.dmg`. Mở DMG và kéo app vào Applications. Chạy từ bản app đã đóng gói không cần Node.js; Node chỉ phục vụ bước build.

Build DMG phải chạy trên macOS; môi trường Linux không chứng minh đã tạo DMG hoặc chạy app Mac thành công.

## Mỗi lần có tính năng mới

1. Hoàn tất thay đổi mã nguồn.
2. Tăng version; ví dụ từ `0.31.0` lên `0.31.1`:

```sh
npm run version:app -- 0.31.1
npm test
```

Lệnh đồng bộ version giữa package, lockfile, manifest, giao diện và bridge. Không chỉ sửa một nhãn hiển thị.

3. Commit và push thay đổi lên `main`:

```sh
git add .
git commit -m "Release 0.31.1"
git push origin main
```

4. Vào nút **Đóng gói / Cập nhật app Mac → Run workflow**. Muốn có bản để app nhận biết, chọn thêm **Tạo thêm bản nháp trong Releases**.
5. Khi thành công, mở [Releases](https://github.com/mktminhqpbga-glitch/app-mooz/releases), mở draft `v0.31.1`, kiểm tra app rồi chọn **Publish release**. Giữ release stable, không chọn prerelease nếu muốn kênh hiện tại nhận biết.
6. Trong app, bấm **Cập nhật → Kiểm tra bản mới**. App unsigned mở trang tải bản mới; thay app trong Applications và giữ nguyên thư mục dữ liệu dự án.

Bấm Run workflow tạo gói từ mã đã push. Chỉ khi release mới hơn đã publish thì nút Cập nhật trong app mới nhận biết phiên bản mới. Mỗi version chỉ dùng một lần; workflow không ghi đè tag hay release đã có.

## Trạng thái chữ ký

Bạn chưa có Apple Developer nên luồng trên tạo **bản unsigned** và không cần secrets của Apple. macOS có thể yêu cầu xác nhận mở ứng dụng. Không tắt Gatekeeper toàn hệ thống.

- Bản unsigned: tự kiểm tra và dẫn tới trang tải; không tự cài.
- Bản đã ký Developer ID: có thể tải nền, dùng blockmap để giảm tải khi đủ điều kiện, và cài sau khi người dùng xác nhận. Dùng workflow **Build signed macOS update (draft)** khi đã có chứng chỉ.

Không đưa bản unsigned lên kênh tự cài đang phục vụ người dùng bản signed. Xem [AUTO-UPDATE.md](AUTO-UPDATE.md) để cấu hình phát hành signed sau này.
