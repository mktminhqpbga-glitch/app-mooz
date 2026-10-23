# Workflow Desktop — bản alpha

Workflow Desktop đưa canvas AI hiện có vào ứng dụng Electron có thể đóng gói cho macOS. Đây là bản alpha để phát triển và kiểm thử; chưa phải bản phát hành macOS đã ký hoặc được Apple công chứng.

## Kiến trúc

```text
Workflow Desktop
├── Thư viện dự án: tạo, đặt tên, mở, đổi tên, khôi phục
├── Canvas riêng cho từng dự án
│   ├── Đồ thị node, cấu hình và trạng thái lưu cục bộ
│   ├── IndexedDB/media và phiên ứng dụng tách theo dự án
│   └── Chạy workflow, trạng thái lưu và dừng tác vụ
├── Bộ nối Chrome qua WebSocket localhost có xác thực
│   └── Extension Workflow → các tab AI đã đăng nhập trong Chrome
├── Cửa sổ AI do app quản lý (tùy chọn, đăng nhập riêng)
└── Kết nối API nhà cung cấp (tùy chọn, cần khóa và quyền model)
```

- `desktop/main.cjs` quản lý cửa sổ, dự án, IPC, yêu cầu mạng và tải tệp. Renderer được sandbox, tách context và không được dùng trực tiếp Node.js.
- `desktop/preload.cjs` cung cấp các thao tác desktop qua IPC; host kiểm tra cửa sổ gọi và dữ liệu đầu vào.
- `desktop/renderer.js` chuyển những thao tác trình duyệt mà canvas cần sang host desktop, giữ khả năng chạy extension hiện có.
- `desktop/project-store.cjs` lưu dự án bằng tệp JSON, tuần tự hóa ghi và thay tệp qua tên tạm. Dữ liệu hỏng được giữ lại và báo lỗi thay vì tự thay bằng dự án rỗng.
- Extension gốc vẫn là bộ nối cần thiết khi dùng **các tab Chrome hiện có**. `background.js` tải `desktop/chrome-relay-worker.js`; trang `desktop/connect.html` dùng để ghép nối với app.

Ứng dụng không lấy cookie hoặc sao chép phiên đăng nhập Chrome vào Electron. Kết nối Chrome chuyển lệnh đến bộ nối trên đúng tab đã chọn; không phải dịch vụ điều khiển trình duyệt từ Internet.

## Chạy từ mã nguồn

Yêu cầu Node.js 22.12 trở lên, npm và hệ điều hành được Electron hỗ trợ. Nên dùng Node.js 24 LTS. Trên Mac, dùng bản Node phù hợp Apple Silicon hoặc Intel của máy.

Tại thư mục repository:

```sh
npm ci
npm run setup:desktop
npm start
```

`npm ci` dùng lockfile để cài dependency. `setup:desktop` chuẩn bị binary Electron; chạy lại khi vừa cài dependency hoặc binary Electron chưa có. Không tắt kiểm tra TLS để xử lý lỗi tải xuống.

App mở **Thư viện dự án**. Tạo dự án có tên rồi mở canvas. Muốn quay về thư viện, dùng menu **Dự án → Thư viện dự án** hoặc `⌘⇧P` trên Mac.

## Dùng các tab AI đang đăng nhập trong Chrome

1. Giải nén/cập nhật repository vào một thư mục cố định trên Mac.
2. Mở `chrome://extensions`, bật **Developer mode**, chọn **Load unpacked** và chọn **thư mục gốc repository có `manifest.json` và `app.html`**. Không chọn thư mục con `extension/`.
3. Nếu đã cài extension trước đó, bấm **Reload** sau khi cập nhật mã. Tải lại các tab ChatGPT, Gemini hoặc Muse đang mở để bộ nối mới hoạt động.
4. Trong app desktop, bấm **Kết nối Chrome** ở thư viện hoặc canvas và sao chép URI ghép nối được hiển thị.
5. Bấm biểu tượng extension Workflow trong Chrome. Chọn **Kết nối app desktop** để mở trang kết nối, dán URI và thực hiện kết nối.
6. Giữ app desktop đang mở. Trong phần **Kết nối AI** của canvas, làm mới danh sách và chọn đúng tab/cuộc trò chuyện, rồi kiểm tra kết nối.
7. Chạy thử một node trước khi chạy cả workflow. Kiểm tra prompt, tệp và kết quả trên tab thật.

URI ghép nối chứa thông tin xác thực kết nối cục bộ. Không đưa URI vào workflow, commit Git hoặc gửi công khai. Relay chỉ hoạt động khi app còn chạy; nếu app tạo URI mới sau khi khởi động lại, ghép nối lại bằng URI mới.

Nếu không thấy tab, kiểm tra đúng extension gốc đã được tải lại, đúng URI đang dùng và trạng thái kết nối Chrome trước khi sửa thông tin đăng nhập AI. Ghép nối thành công chỉ chứng minh kênh kết nối hoạt động; cần kiểm tra composer và chạy tác vụ thật để xác minh provider.

Tab đang được workflow sử dụng cần giữ mở. Tránh đổi cuộc trò chuyện hoặc sửa bản nháp trong lúc chạy. Bộ nối có thể thay nội dung bản nháp và tệp chưa gửi để chuẩn bị yêu cầu mới.

## Cửa sổ AI trong app và API

Menu **AI** có thể mở cửa sổ ChatGPT, Gemini hoặc Muse do Electron quản lý. Đây là lựa chọn khác với tab Chrome và cần **đăng nhập riêng**. Nhà cung cấp có thể hạn chế đăng nhập hoặc hành vi trong trình duyệt nhúng; không coi mở được cửa sổ là đã kết nối hay tạo nội dung thành công.

Kết nối API không cần relay Chrome nhưng cần API key, quyền model và hạn mức của tài khoản. API key trong desktop chỉ dùng ở session memory, không được lưu vào tệp dự án; có thể phải nhập lại khi đóng/mở dự án. Không đặt khóa vào prompt hoặc tên dự án.

App và extension không loại bỏ giới hạn tài khoản, hạn mức tạo nội dung hoặc yêu cầu quyền truy cập của nhà cung cấp. Không có cơ chế vượt các giới hạn đó.

## Lưu và khôi phục dự án

Dữ liệu lưu dưới thư mục `projects` trong Electron `userData`. Trên macOS, thư mục mặc định thường ở `~/Library/Application Support/`; tên thư mục ứng dụng có thể khác giữa chạy từ mã nguồn và bản đóng gói. Không giả định hai bản dùng chung dữ liệu.

Mỗi dự án có UUID và thư mục riêng:

```text
projects/<UUID>/
├── project.json
├── project.json.previous
└── project.json.before-restore-<UUID>  # khi đã khôi phục
```

- `project.json` chứa thông tin dự án và storage hiện tại; giới hạn tệp 64 MB.
- `project.json.previous` giữ **một bản trước lần ghi thành công gần nhất**, không phải lịch sử phiên bản dài hạn. Những lần tự lưu hoặc đổi tên tiếp theo có thể thay bản này.
- Dự án hỏng vẫn hiện trong thư viện với thông báo cần khôi phục. Nếu bản trước hợp lệ, đóng canvas của dự án rồi chọn **Khôi phục** và xác nhận.
- Khi khôi phục, tệp hiện tại được giữ dưới tên `before-restore` để đối chiếu thủ công, kể cả khi JSON hiện tại bị hỏng.

Khôi phục này áp dụng cho storage JSON. **Không cam kết khôi phục lịch sử toàn bộ media IndexedDB**: bản JSON cũ có thể tham chiếu asset đã thay đổi hoặc không còn tồn tại. Khi cần sao lưu độc lập, xuất workflow và tải riêng media quan trọng. Sao lưu cả thư mục dữ liệu ứng dụng khi app đã đóng nếu cần giữ trạng thái cục bộ; bản sao cục bộ không thay thế sao lưu sang thiết bị khác.

## Chạy và dừng

Canvas chạy workflow trong cửa sổ của dự án. **Đóng canvas hoặc thoát app không duy trì công việc nền bền vững**. Dừng tác vụ trong app không bảo đảm nhà cung cấp đã hủy phần xử lý phía dịch vụ hoặc hoàn lại phí.

Trước khi đóng, dùng **Dừng tất cả**, kiểm tra trạng thái lưu và xác nhận kết quả cần giữ. Khi mở lại, kiểm tra các tác vụ chưa hoàn tất trên tab/provider trước khi chạy lại để tránh gửi trùng. Alpha chưa có hàng đợi chạy không người giám sát hoặc cơ chế tự khôi phục mọi tác vụ sau crash.

## Kiểm thử

Từ thư mục gốc:

```sh
npm test
npm run test:desktop
```

`npm test` gồm các test module hiện có và `tests/desktop-*.test.cjs`. Desktop smoke dùng Electron thật và cần môi trường hiển thị. Trên Linux có Xvfb:

```sh
xvfb-run -a npm run test:desktop
```

Harness trình duyệt mở rộng:

```sh
npm run test:browser
npm run test:reliability
```

Các harness hiện tại dùng Chromium tại `/usr/bin/chromium`; đường kiểm tra media cần `ffmpeg` và `ffprobe`. Fixture AI và nhiều API trình duyệt được mô phỏng. Test thành công không chứng minh đã gửi/nhận trên tài khoản AI thật hoặc đã chạy trên macOS. Không dùng tài khoản trả phí trong smoke test tự động.

## Đóng gói cho macOS

Trên máy Mac đã cài dependency và Electron:

```sh
npm run dist:mac
```

Đầu ra nằm trong `dist/` theo cấu hình electron-builder. Chỉ tạo thư mục ứng dụng để kiểm tra:

```sh
npm run package:desktop -- --mac
```

Workflow CI tại `.github/workflows/desktop.yml` chạy unit tests rồi tạo ZIP macOS **chưa ký**; nó chỉ tải artifact vào lần chạy GitHub Actions, không xuất bản release. Bản thử chưa có Developer ID hoặc notarization. Cơ chế cập nhật đã được triển khai từ 0.31.0, nhưng tải nền/tự cài chỉ hoạt động trên bản Mac đã ký và có release hợp lệ; bản unsigned chỉ kiểm tra bản mới. Xem [AUTO-UPDATE.md](AUTO-UPDATE.md). Không coi artifact unsigned là bản cài đã được Apple xác minh; không hướng dẫn tắt Gatekeeper để phát hành.

Build macOS trong CI chỉ được coi là đạt khi xem được kết quả chạy và artifact tương ứng. Máy Linux phát triển có thể kiểm thử Electron/Linux; chưa thể chứng minh binary Mac chạy đúng trên Apple Silicon/Intel bằng các kiểm tra đó.

## Những việc cần hoàn tất trước khi phát hành

- QA bản cài trên Mac thật: đăng nhập Chrome, ghép nối, chọn chat, upload media, nhận kết quả, hủy và kết nối lại.
- Xác minh luồng mất mạng, app đóng đột ngột và kết quả dịch vụ trả về muộn.
- Cấu hình secrets cho workflow signed release, ký/notarize và kiểm tra cài cập nhật trên Mac thật.
- Hoàn thiện phiên bản dữ liệu, sao lưu media và phục hồi tác vụ nếu cần chạy nền lâu dài.
- Giữ các thông báo giấy phép GPL-2.0-or-later và bên thứ ba khi phân phối.
