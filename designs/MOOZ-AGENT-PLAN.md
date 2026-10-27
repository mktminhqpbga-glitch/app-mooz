# MooZ Agent — Bản chốt thiết kế và kế hoạch triển khai

Ngày: 28/10/2026 · Nền tảng khảo sát: Workflow 0.44.0, commit `cbf440f`.

Đây là đặc tả cho lần thiết kế lại, kèm prototype tương tác `mooz-agent-prototype.html`. Prototype dùng dữ liệu minh họa, chưa thay thế giao diện chạy thật. Những khả năng ở phần “đề xuất” là mục tiêu triển khai, không phải tuyên bố tính năng đã hoàn tất.

## 1. Sản phẩm được chốt

**MooZ Agent**: không gian sản xuất nội dung bằng AI, từ nguyên liệu đến thành phẩm và đăng bài. Workflow là quy trình thực thi; agent nhận mục tiêu, đề xuất hoặc vận hành workflow trong phạm vi bạn cho phép.

Ưu tiên: ít vùng gây chú ý, chỉnh sửa đúng chỗ, thấy tiến độ và biết sửa lỗi ở đâu. Mẫu chủ lực: **Một sản phẩm → Một video bán hàng hoàn chỉnh**. Giữ đường chỉnh sửa sâu bằng canvas, thêm chế độ từng bước cho người muốn làm nhanh.

Phạm vi lần thiết kế này: đổi nhận diện, bố cục toàn app, bảng chỉnh sửa node, cài đặt mặc định/chỉ dẫn AI, giao diện tùy chỉnh, hợp nhất đường đi giữa dự án–sản xuất–đăng bài. Bổ sung chức năng để hoàn thiện quy trình hiện có trước khi tạo ứng dụng AI mới.

## 2. Nhận diện, logo và phong cách

Cập nhật theo đánh giá người dùng: ưu tiên Đen tím. Ngọc/Lam/Cam vẫn là preset tùy chọn trong kế hoạch; theme Đen tím đã được triển khai trên nhánh tối ưu app thật.

- Tên hiển thị: **MooZ Agent**; tên tệp cài dự kiến `MooZ-Agent-<version>-<arch>`.
- Biểu tượng: chữ **M** liên tục tạo từ đường gấp mềm, hai đầu có điểm nối, đặt trong hình vuông bo góc. Ý nghĩa: các bước được nối thành công việc; dùng được cả ở Dock và kích thước nhỏ.
- Logo dùng hình học đơn giản, có phiên bản màu, một màu, sáng/tối. Không thêm robot, nhiều tia sáng hoặc chữ nhỏ vào icon app.
- Biểu tượng giao diện nét đồng nhất, nhãn tiếng Việt, tên menu trùng tên node. Không dùng emoji thay icon công cụ; emoji vẫn dùng được trong nội dung bài đăng.
- Nền phẳng, viền nhẹ, bo 10–14px, một màu nhấn chính; hiệu ứng chỉ giúp nhận biết lựa chọn và tiến độ.
- Dùng font hệ thống hỗ trợ tiếng Việt tốt, không tải font từ mạng. Nội dung 14px, nhãn tối thiểu 12px ở 100%, tiêu đề trang 22–26px. Có mức chữ 100/115/125% và khoảng cách Gọn/Thoải mái.

### Bảng màu ưu tiên theo đánh giá 28/10: Đen tím

| Vai trò | Tối mặc định | Sáng |
|---|---|---|
| Nền ứng dụng | `#0D0B14` | `#F4F6F7` |
| Thanh điều hướng/panel | `#15111F` | `#FFFFFF` |
| Bề mặt trường nhập/thẻ | `#20192F` | `#EEF2F4` |
| Viền | `#40334F` | `#CBD5DB` |
| Chữ chính | `#F5F0FC` | `#17252E` |
| Chữ phụ | `#B6AAC8` | `#536570` |
| Nút chính / tương tác | `#7C3AED` / `#8B5CF6` | `#7C3AED` |
| Chữ trên nút chính | `#FFFFFF` | `#FFFFFF` |

Tím dùng cho hành động chính/lựa chọn; chữ nhấn trên nền tối dùng tím nhạt để dễ đọc. Trạng thái còn có chữ và icon: Đang chạy, Cần duyệt, Lỗi, Xong; không nhận biết bằng màu đơn thuần. Màu nhóm văn bản/ảnh/video/âm thanh chỉ dùng ở icon/nhãn nhỏ để canvas bớt sặc sỡ. Tôn trọng Giảm chuyển động của hệ điều hành; không nhấp nháy nền.

## 3. Bố cục không gian làm việc

```text
┌ MooZ Agent ─ Dự án / tên công việc ─ Đã lưu ─ Thêm bước ─ Chạy ─┐
│ Điều hướng │                                                    │
│ Dự án      │             Không gian làm việc       │ Chỉnh sửa │
│ Sản xuất   │             Từng bước / Canvas        │ node chọn │
│ Thành phẩm │                                       │           │
│ Đăng bài   │                                       │           │
│            │                                       │           │
│ Công cụ    │                                       │           │
│ Cài đặt    │                                       │           │
├────────────┴─ Tiến độ / hàng chờ công việc ──────────┴───────────┤
```

- Điều hướng trái 192px, có thể thu còn 64px. Trong canvas, tab **Bước / Tài nguyên** mở thư viện node và ảnh bên trái; kéo vào luồng hoặc bấm thêm. Công cụ thực thi hay dùng vẫn có nhãn và ô tìm, không dồn tất cả vào menu nhiều tầng.
- Trung tâm chiếm phần lớn diện tích. Header chỉ giữ đường dẫn dự án, trạng thái lưu, Thêm bước, Chạy/Dừng và menu dự án. Trạng thái AI là một mục Kết nối trong cài đặt và một chỉ báo tổng hợp, mở ra mới xem từng AI.
- Bảng phải rộng mặc định 360px, kéo chỉnh trong 320–480px. Chỉ bảng này cuộn nội dung thiết lập; nút Áp dụng/Chạy bước nằm ở chân bảng.
- Panel không đè lên canvas/timeline. Khi mở panel, cập nhật vùng vẽ và bản đồ; giữ vị trí node đang chọn trong vùng nhìn, không tự chạy Fit toàn bộ.
- Ở cửa sổ hẹp: tự thu thanh trái; nếu không còn chỗ cho canvas đọc được, panel phải thành ngăn phủ có nút Đóng và trả focus, không ép canvas về 25%.
- Zoom và Vừa màn hình ở góc trên trái canvas; bản đồ nhỏ dưới cụm này, có nút thu. Dòng thời gian thu mặc định, mở khi cần biên tập. Chỉ có một bản chỉnh sửa timeline được đồng bộ giữa dock và node tổng hợp.

## 4. Bấm node → chỉnh bên phải

“Nút” trong yêu cầu được hiểu là **node/bước công việc**. Bấm Chạy, Tải, Dừng vẫn thực hiện hành động tương ứng, không tự mở một bảng sửa không liên quan.

### Trên node chỉ còn

Tên + icon nhóm, trạng thái, tóm tắt 1–2 dòng, preview nhỏ nếu có kết quả, cổng nối và một hành động chính phù hợp. Giữ preview đặc thù cho Bảng ảnh chung và Tổng hợp video; vẫn kéo dây từ từng ảnh. Không biến cả thẻ thành vùng kéo khiến nút/cổng khó bấm.

### Các tab của bảng chỉnh sửa

| Tab | Nội dung |
|---|---|
| Thiết lập | Tên, AI, tài khoản/cuộc chat, model, prompt và thông số đúng loại node |
| Chỉ dẫn AI | Chỉ dẫn vai trò, định dạng trả lời, điều cần giữ/tránh, mặc định kế thừa và bản xem yêu cầu thực tế |
| Kết quả | Văn bản/ảnh/video bản gốc, thông tin thật, lịch sử phiên bản, tải hoặc đưa sang Đăng bài |
| Nhật ký | Lượt chạy, thời gian, bước lỗi, lý do, hướng sửa; mã node kỹ thuật và chẩn đoán ở đây |

### Tương tác phải nhất quán

- Bấm một node mở panel của node đó; bấm node khác cập nhật panel. Đóng panel giữ nguyên node và kết quả.
- Sửa ô nhập ghi ngay vào bản nháp của node, tự lưu sau khoảng nghỉ ngắn; hiện Đang lưu/Đã lưu/Lưu lỗi chính xác. Chuyển node không mất chữ và không nhận chữ từ node trước.
- Chỉ thao tác Chạy mới gửi yêu cầu AI; thay model/prompt/màu hoặc chuyển tab không gửi AI.
- Nhiều node được chọn: chỉ sửa trường chung có cùng ý nghĩa; giá trị khác nhau hiện “Nhiều giá trị”; không ghi đè hàng loạt khi chỉ mở panel.
- Undo/Redo cho đổi thông số, mặc định, nối dây, sắp xếp và đổi tên; gom việc gõ liên tục thành một thao tác, không tạo hàng trăm mốc.
- Lượt đang chạy dùng bản cấu hình chụp lúc bắt đầu. Chỉnh mới áp dụng lượt sau; ảnh hưởng prompt/nguồn làm đầu ra cũ được đánh dấu Cần cập nhật, không tự đăng thành phẩm đã lỗi thời.
- Xóa node đóng panel hoặc chuyển về phần tổng quan; kéo node/cổng không được vô tình đổi trường đang nhập. Bấm cổng không mở thêm hộp thoại.

## 5. Mặc định và “yêu cầu ẩn”

Hiện logic liên quan đang rải ở `app.js`, `workflow-tools.js`, `story-workflow.js` và adapter AI. Mục tiêu là gom phần **chỉ dẫn của app** thành mẫu có tên, có phiên bản và sửa được; không hứa hiển thị chỉ dẫn nội bộ của dịch vụ AI bên ngoài.

### Ba mức cấu hình

1. **Mặc định ứng dụng theo loại node**: áp dụng cho node mới tạo, ví dụ Tạo video mặc định 9:16, prompt tiếng Việt.
2. **Mặc định dự án**: thương hiệu, ngôn ngữ, phong cách, tỷ lệ, AI ưu tiên của dự án. Chỉ áp dụng cho những trường node đang để Kế thừa.
3. **Thiết lập riêng của node**: ghi đè từng trường, có nhãn “Riêng node này” và nút trở lại kế thừa.

Mức node ưu tiên hơn dự án, dự án ưu tiên hơn mặc định ứng dụng. Nội dung từ dây nối là đầu vào của tác vụ, không âm thầm ghi đè chỉ dẫn hệ thống. Mỗi trường định nghĩa rõ cách ghép nhiều nguồn; bản xem yêu cầu hiện thứ tự, ảnh/video tham chiếu và AI nhận yêu cầu.

Mặc định ứng dụng được chụp khi tạo node để cập nhật preset không làm thay đổi dự án cũ. Đổi mặc định dự án liệt kê các node đang kế thừa sẽ bị ảnh hưởng trước khi áp dụng. “Lưu làm mặc định cho node mới”, “Áp dụng cho các node được chọn”, “Khôi phục mẫu gốc” là ba thao tác riêng.

### Có thể sửa

- Vai trò AI: chuyên viên viết kịch bản, nhiếp ảnh sản phẩm, người viết content…
- Yêu cầu bổ sung, văn phong/ngôn ngữ, cách chia cảnh, độ dài mong muốn, format người dùng.
- AI/model, thông số được nhà cung cấp hỗ trợ, ảnh tham chiếu, quy tắc loại trừ.
- Quy định thương hiệu và mẫu content, hashtag/emoji, điểm cần duyệt trước khi chuyển bước.

### Phần kỹ thuật được xem và giải thích

Mã tương quan lượt chạy, nhận đúng kết quả, giới hạn tệp, cấu trúc dữ liệu bắt buộc và kiểm tra quyền đăng bài không nằm trong ô văn bản tự do. Nếu người dùng thay định dạng đầu ra, app cần kiểm tra nó vẫn đọc được để nối bước. API có trường system thì gửi đúng vai trò; tab web chỉ có thể ghép chỉ dẫn vào nội dung gửi và sẽ ghi rõ điều đó.

Thời lượng/tỷ lệ là yêu cầu mong muốn, không phải cam kết của model. Nếu chọn 40 giây nhưng nhà cung cấp chỉ hỗ trợ 10 giây, app phải báo trước và đưa lựa chọn **chia thành nhiều cảnh rồi ghép**, hoặc dùng thời lượng được hỗ trợ; không hiển thị thành công giả cho yêu cầu chưa đạt.

## 6. Các nhóm node chỉnh gì

| Nhóm | Thiết lập bên phải |
|---|---|
| Sản phẩm/nguồn | Link, ảnh/video tải lên, dữ liệu đọc được, nguồn gốc và thông tin cần bổ sung |
| Yêu cầu/kịch bản | Tự viết hay AI viết, kịch bản mẫu, lời thoại, chia cảnh, định dạng trả về |
| Tạo ảnh | AI/chat/model, prompt, tỷ lệ, ảnh tham chiếu và vai trò từng ảnh |
| Tạo video | AI, prompt chuyển động, thời lượng hỗ trợ, khung đầu/cuối, video tham chiếu nếu AI hỗ trợ |
| Âm thanh | Giọng đọc được hỗ trợ, tốc độ, nội dung đọc, âm lượng và nhạc nền |
| Tổng hợp video | Thứ tự clip, giữ tỷ lệ, fps, âm thanh/phụ đề; một video dài là đầu ra chính |
| Tổng ảnh | Bộ ảnh, thứ tự, chọn ảnh đạt, tải bộ hoặc chuyển thành một nháp đăng bài |
| Duyệt/kiểm tra | Điều kiện đạt, nội dung cần người duyệt, lý do chặn; phân biệt kiểm tra thông số với đánh giá bằng AI |

Không hiện mọi model và tham số trên mọi loại node. Danh mục khả năng của từng AI quyết định ô nào được dùng, mục nào chưa được hỗ trợ và lý do.

## 7. Luồng sản xuất chủ lực

**Nguồn sản phẩm → Kịch bản → Ảnh/cảnh → Video từng cảnh → Lồng tiếng/nhạc → Tổng hợp video → Duyệt → Đăng bài.**

- Tạo dự án bằng mẫu, nhập link/ảnh/thông tin, chọn kịch bản AI hoặc kịch bản của mình.
- Duyệt kịch bản trước lượt tạo tệp có chi phí; giữ nguyên lời người dùng nếu chọn dùng kịch bản riêng.
- Mỗi cảnh có trạng thái và phiên bản; cảnh lỗi chạy lại riêng. Thay cảnh nguồn chỉ đánh dấu các bước phụ thuộc cần chạy lại.
- Nhận ảnh/video phải gắn với đúng lượt và cuộc chat, loại ảnh đầu vào/avatar/kết quả cũ. Nếu không chắc, yêu cầu chọn kết quả từ lượt đó thay vì lấy ảnh cuối trang.
- Tổng hợp video tạo một tệp dài, thể hiện kích thước, fps và thời lượng thực tế; preview thu nhỏ không đổi file xuất.
- Đầu ra được duyệt chuyển sang một nháp đăng bài; không nhân đôi mỗi lần bấm. Thay video tạo phiên bản mới và yêu cầu kiểm tra nháp đang giữ phiên bản nào.
- Mọi màn hình lỗi có bước lỗi, nguyên nhân đã biết, hướng xử lý và Thử lại đúng phạm vi. Không gửi lại yêu cầu AI/đăng bài chỉ vì app nối lại.
- Nhận kết quả khi tab AI ở nền: chuyển theo dõi tác vụ sang dịch vụ kết nối, giảm lệ thuộc timer của trang và dùng tín hiệu kết quả khi adapter có hỗ trợ. Kiểm tra riêng tab ẩn/cửa sổ thu nhỏ. Nếu phía dịch vụ dừng sinh nội dung khi ẩn, app báo đang chờ dịch vụ và hướng xử lý; không hứa mọi website đều chạy nền, không tự giật focus liên tục.
- Xuất media: chọn thư mục một lần cho một đợt, đặt tên không trùng hoặc chọn chính sách ghi đè trước khi chạy; xử lý FFmpeg ngoài luồng giao diện, có tiến độ và Dừng, dọn tệp tạm khi hủy. Xem trước dùng bản nhẹ, tải/xuất dùng file gốc.

## 8. Đăng bài và agent

Đăng bài nằm trong cùng hệ điều hướng: Bản nháp / Hàng chờ / Lịch / Tài khoản. Thẻ bài giữ tệp gốc, caption, kênh đích và thời điểm theo Asia/Ho_Chi_Minh. Duy trì tùy chọn Muse tự viết content, emoji theo mẫu và đăng theo cấu hình.

Muse và API nền tảng là các đường gửi có khả năng khác nhau; chỉ bật tài khoản/đường đã kết nối. Theo dõi từng nền tảng riêng, thành công một kênh không làm kênh lỗi mất trạng thái. Khi chưa có bằng chứng chắc chắn, hiện **Chờ xác minh**, không tự gửi lại dễ tạo bài trùng.

Agent là ngăn **Trợ lý** mở theo ngữ cảnh, dùng cùng vùng phải với panel chỉnh sửa. Khi rời để quay lại node phải giữ bản nháp hội thoại. Giai đoạn đầu: hiểu mục tiêu, đề xuất các bước, nêu đầu vào còn thiếu, đưa kế hoạch vào workflow. Chỉ sau khi luồng ổn mới cho tự vận hành với giới hạn chi phí, số lần thử và quyền đăng; chưa coi việc đổi tên app là có agent tự chủ hoàn chỉnh.

## 9. Cài đặt tập trung

1. **Giao diện**: Tối/Sáng/Theo máy; màu nhấn Ngọc/Tím/Lam/Cam hoặc mã màu riêng; cỡ chữ; Gọn/Thoải mái; xem thử trước khi lưu; Khôi phục mặc định.
2. **Kết nối AI**: tab trình duyệt/API; khả năng văn bản/ảnh/video/giọng đọc; kiểm tra kết nối; tải tiện ích được đóng gói kèm app.
3. **Mặc định node**: tìm loại node, chỉnh template và chỉ dẫn; xem thay đổi so với gốc.
4. **Thương hiệu & đăng bài**: mẫu content, giọng thương hiệu, hashtag/emoji, kênh, lịch và điểm duyệt.
5. **Tệp & hiệu năng**: thư mục xuất, xử lý trùng tên, cache, chất lượng xem trước, số tác vụ đồng thời.
6. **Trợ giúp & cập nhật**: phiên bản app/tiện ích/giao thức, chẩn đoán, nhật ký đã lọc dữ liệu riêng.

Màu tự chọn chạy qua bộ token, tự chọn chữ tương phản và cảnh báo vùng chữ chưa đạt. Mục tiêu WCAG AA: chữ thường ít nhất 4.5:1, dấu hiệu focus/điều khiển 3:1. Có thể trở về preset dễ đọc. Cài đặt áp dụng cả canvas sáng/tối; zoom canvas tách khỏi cỡ chữ UI. Không cho nhập CSS thực thi tùy ý.

## 10. Kiến trúc và chuyển đổi an toàn

### Tách phần hiển thị khỏi thực thi

- `NodeCatalog`: tên, nhóm, icon, khả năng và mô tả thống nhất.
- `NodeSettingsSchema`: trường nhập theo loại node, validator, mặc định và cơ chế kế thừa.
- `Inspector`: render các trường từ schema, giữ bản nháp theo ID node và phiên bản thay đổi.
- `PromptComposer`: hợp nhất chỉ dẫn, prompt, ngữ cảnh/dây nối; bản xem yêu cầu lấy từ đúng bộ dựng dùng khi chạy.
- `RunController`: chụp input/settings, requestId, tiến độ, dừng/khôi phục; không phụ thuộc DOM panel.
- `ProviderCapabilities`: chặn tính năng AI chưa hỗ trợ; dùng lại adapter hiện có.
- `ThemeTokens`: một nguồn màu, kích thước, spacing cho mọi màn hình.

Hiện `app.js` chứa cả render, chọn node và thực thi; schema mặc định cũng nằm tại `addNode()`. Sẽ tách từng phần có kiểm thử rồi nối lại, thay vì dựng một renderer mới làm mất hành vi cũ.

### Dữ liệu và nhận diện ứng dụng

- Nâng schema có version; sao lưu trước chuyển đổi, giữ ID node/dây, file media, tên tự đặt và kết quả cũ. Với dự án cũ, hiển thị giá trị hiệu lực hiện tại, không tự đổi sang preset mới.
- Đổi tên sản phẩm/logo/menu/about/DMG thống nhất; giữ đường dữ liệu, app identity và kênh cập nhật cũ trong giai đoạn chuyển để app vẫn tìm được dự án. Cần kiểm thử đọc dữ liệu từ bản 0.44.0 trước khi đóng gói.
- Tiện ích tiếp tục làm nhiệm vụ kết nối; đổi nhãn thành MooZ Connect khi phù hợp, quản lý tương thích bằng phiên bản giao thức thay vì buộc phiên bản app bằng phiên bản extension.
- Giữ khóa API ngoài dự án và bản xuất; xuất chỉ dẫn hiển thị rõ vì có thể chứa thông tin thương hiệu. Khi chia sẻ mẫu có bước xem lại các trường riêng tư.
- Hướng đến một cửa sổ chính với chuyển không gian nội bộ. Cửa sổ AI/đăng nhập có thể vẫn cần riêng theo điều kiện nhà cung cấp; không đóng tác vụ đang chạy khi đổi mục.

## 11. Lộ trình có điểm hoàn tất cụ thể

| Đợt | Công việc | Hoàn tất khi |
|---|---|---|
| 0 — Thiết kế | Tài liệu này, prototype, palette, biểu tượng và danh sách màn hình | Đọc được cách dùng và xem thử chọn node/theme mà không tác động app |
| 1 — Nền giao diện | Bộ token, nhận diện MooZ Agent, khung điều hướng/header, bố cục responsive | Sáng/tối/màu riêng/cỡ chữ đồng bộ; không tràn 1280×800; mở được dự án cũ |
| 2 — Panel phải | Schema và inspector cho Yêu cầu, Tạo văn bản/ảnh/video trước; sau đó phủ tất cả loại node | Chuyển node giữ đúng bản nháp; card gọn; cổng/preview/Undo/Run vẫn đúng |
| 3 — Chỉ dẫn & mặc định | PromptComposer, 3 mức cài đặt, xem yêu cầu, khôi phục template | Bản xem khớp payload; không đổi dự án cũ; chỉ tác vụ Chạy gửi yêu cầu |
| 4 — Luồng sản xuất | Mẫu một sản phẩm, điểm duyệt, snapshot run, sửa cảnh lỗi, tổng hợp video và phiên bản | Đi từ nguồn đến một video dài và một nháp đăng bài; lỗi chạy lại đúng bước |
| 5 — Hợp nhất & hoàn thiện | Trang dự án, thành phẩm, Affiliate, đăng bài/lịch, cài đặt chung và xử lý lỗi | Cùng hệ điều hướng, không mâu thuẫn nhiều cửa sổ; dữ liệu và hàng chờ giữ nguyên |
| 6 — Agent có giới hạn | Giao mục tiêu, đề xuất kế hoạch, thực hiện bằng công cụ đã ổn | Quyền rõ, nhìn được việc đang làm, dừng được, không tự phát sinh chi phí/đăng ngoài cấu hình |
| 7 — Phát hành | Kiểm thử bản cũ→mới, Mac Intel/Apple Silicon, tài liệu và artifact | Có báo cáo kiểm tra, ảnh giao diện thật, bộ cài đúng commit và phương án khôi phục |

Đợt 1–5 là trọng tâm hoàn thiện app theo yêu cầu hiện tại. Agent vận hành được xây trên chính workflow đã kiểm tra, không chặn việc sử dụng app trước đó. Không chốt thời gian giả khi chưa hoàn tất việc tách phần render hiện tại; mỗi đợt có thể kiểm tra độc lập.

## 12. Tiêu chí nghiệm thu

- Chỉ có một nơi chính sửa thông số node; trường nào cũng có nhãn, giá trị hiệu lực và nguồn mặc định.
- Chọn/chuyển/xóa/nhiều node; chỉnh khi đang chạy; đóng/mở app; Undo/Redo đều giữ đúng dữ liệu.
- Không nhập chung bản nháp giữa node/sản phẩm. Lỗi lưu không được báo Đã lưu.
- Thêm node không đè node cũ. Mở panel/timeline không che nút hoặc kéo méo tọa độ dây. Zoom chạm giới hạn có trạng thái disabled.
- Chạy đúng phụ thuộc, khóa snapshot, lỗi một cảnh không mất cảnh khác. Không chạy AI khi chỉ mở panel hoặc thay màu.
- Kiểm thử nhận text/image/video của từng adapter, ảnh mới trong lượt, tham chiếu và kết quả cũ; live-account check tách khỏi fixture test.
- Ghép/xuất bằng media thật; giữ thứ tự, tỷ lệ, âm thanh, không lặp hộp thoại trùng tên cho một lệnh xuất cả bộ.
- Một kết quả duyệt chuyển đúng một nháp, hẹn giờ đúng múi giờ, bài lỗi có lý do và không tự đăng trùng khi nối lại.
- Kiểm tra bàn phím/focus, chế độ sáng/tối, tương phản, chữ lớn, độ phân giải 1280×800/1440×900/1920×1080 và màn hình Retina.
- Với workflow lớn: không render lại video hoặc reset textarea đang gõ mỗi lần báo tiến độ; dùng preview tải lười, batch cập nhật, đo độ trễ trước/sau.
- Đường dẫn dữ liệu, dự án 0.44.0, tiện ích hiện có và cập nhật app được kiểm tra trước phát hành.

## 13. Prototype để xem ngay

Mở `mooz-agent-prototype.html`. Có thể bấm từng node, chỉnh form bên phải, xem chỉ dẫn/kết quả/nhật ký, thay sáng/tối và màu nhấn. Chỉ là mô phỏng tương tác thiết kế: không gọi AI, tải media, kết nối tài khoản hay đăng bài; dữ liệu minh họa giữ trong bộ nhớ trang.

Đã mở prototype bằng Chromium và kiểm tra: chuyển node giữ riêng bản nháp/chỉ dẫn, đổi sáng/tối/màu, chuyển cách xem, đóng/mở panel, tìm công cụ không dấu; không có lỗi JavaScript. Kiểm tra bố cục 1440×960 và 1280×800. Đây là kiểm tra prototype, chưa phải kiểm thử bản app được triển khai lại.

**Phương án chốt:** MooZ Agent, nền đen tím + chữ trắng dịu, điều hướng trái gọn, công việc ở giữa, chọn node để chỉnh bên phải; cài đặt cá nhân tập trung và workflow sản phẩm làm trục chính.
