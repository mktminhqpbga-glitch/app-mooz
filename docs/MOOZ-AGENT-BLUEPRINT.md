# MooZ Agent — thiết kế bộ điều phối

Ngày đối chiếu mã: 28/10/2026. Đây là phân tích và đặc tả cho bước phát triển tiếp theo; các mục “cần bổ sung” chưa phải tính năng đã triển khai.

## Sản phẩm cần đạt

Người dùng giao mục tiêu, ví dụ: “Dùng sản phẩm và nhân vật này tạo video bán hàng 40 giây, ghép nhạc, viết content rồi lên lịch cho các Page đã chọn”. MooZ chuyển yêu cầu thành kế hoạch có đầu ra kiểm chứng được, dùng các công cụ hiện có, theo dõi từng bước và chỉ kết thúc khi có bằng chứng hoặc nêu rõ phần bị chặn.

Agent là lớp điều phối. Workflow là kế hoạch thực thi có bước và dây dữ liệu; canvas là một cách xem/sửa kế hoạch. Nhà cung cấp AI là công cụ tạo hoặc phân tích nội dung. Cả ba cần dùng chung một trạng thái công việc.

## Hiện trạng đã đối chiếu

| Khả năng | Có trong mã | Khoảng thiếu |
|---|---|---|
| Chat → kế hoạch | `workflow-chat.js` nhận JSON `reply/scenes`, giới hạn 10 tác vụ, duyệt/tự tạo node mới, lưu hội thoại | Chỉ biết tạo cảnh ảnh/video; chủ động chặn `tools/actions/commands`. Chưa có hợp đồng kế hoạch tổng quát |
| Chạy đồ thị | `app.js`, `workflow-runtime.js`: phụ thuộc node, quyền sở hữu node, FIFO theo tab, hủy/chờ/giãn lượt | Các map chạy thuộc renderer; chưa có nhật ký bền vững chung cho mọi lượt trên desktop |
| Công cụ | `ai-providers.js`, `media-studio.js`, `workflow-tools.js`, catalog node | Định nghĩa UI chưa thay thế được tool registry có schema, kết quả, quyền và quy tắc thử lại |
| AI qua Chrome/API | Adapter, relay và cửa sổ riêng; Muse có request ID, poll trạng thái không gửi lại prompt | DOM nhà cung cấp vẫn có thể đổi. Cần định danh kết quả đồng nhất giữa mọi adapter, kiểm tra theo lượt và phiên chat |
| Lưu trữ | ProjectStore, ChatStore, IndexedDB theo dự án, ghi tuần tự | Chat checkpoint là lịch sử/kế hoạch, chưa phải execution journal; media chưa có kho phiên bản dùng chung |
| Đăng bài | PostingStore/Service, lịch, trạng thái gửi/xử lý, MusePublishing, xác nhận thủ công khi cần | Phải đưa trạng thái thật này về lượt agent; câu “đã đăng” trong chat không đủ chứng minh |
| Chẩn đoán | Báo lỗi cục bộ, lọc dữ liệu nhạy cảm, xuất báo cáo | Cần liên kết lỗi với `runId/stepId/attemptId` và hành động sửa thích hợp |

Không nên bỏ các kiểm tra hiện có để cho AI chạy mã tùy ý, cũng không cần viết lại canvas/media/publishing từ đầu.

## Vòng đời một yêu cầu

1. **Thu thập:** mục tiêu, sản phẩm, media gốc, nhân vật, thời lượng, nền tảng, tài khoản đích, lịch và giới hạn sử dụng. Thiếu thông tin quyết định mới hỏi; phần còn lại dùng mặc định hiển thị được.
2. **Lập kế hoạch:** AI trả dữ liệu theo schema; ứng dụng kiểm tra công cụ, phụ thuộc, kiểu đầu vào, giới hạn và khả năng của nhà cung cấp. Chưa chạy trong bước này.
3. **Chốt phạm vi:** hiển thị số cảnh, thời lượng dự kiến, công cụ/tài khoản, hành động đăng và chi phí đã biết. Cho phép lưu mức tự động hóa theo dự án. Khi người dùng đã cho phép phạm vi, không hỏi lại từng thao tác con.
4. **Thực thi:** scheduler lấy bước sẵn sàng, khóa đúng tài nguyên, lưu trạng thái trước khi gửi, ghi receipt ngay khi nhận. Một tab chỉ phục vụ một lượt tại một thời điểm trên toàn app.
5. **Xác minh:** kiểm tra đúng lượt, đúng loại tệp, tệp đọc được, kích thước/thời lượng thực; so mục tiêu và gắn cảnh báo/chặn theo loại lỗi.
6. **Sửa có giới hạn:** chọn lại kết quả đúng lượt, đổi phương án đã cho phép, hoặc tạo lại riêng cảnh lỗi theo ngân sách. Không chạy lại các nhánh đã duyệt còn hợp lệ.
7. **Hoàn tất:** lưu thành phẩm, phiên bản và báo cáo. Đăng bài theo phạm vi đã duyệt; hiển thị riêng “đã gửi”, “đang xử lý”, “đã đăng được xác minh”, “cần đối chiếu”.

## Hợp đồng dữ liệu nên tách riêng

- `TaskBrief`: yêu cầu gốc, ràng buộc, đầu vào có phiên bản, timezone, đích đăng, giới hạn người dùng đã chọn.
- `Plan`: `planId/version`, bước, phụ thuộc, tool ID/version, tham số đã kiểm tra, tiêu chí hoàn thành, ước lượng và quyền được cấp. Thay đổi mục tiêu làm tăng phiên bản kế hoạch.
- `Run`: `runId`, phiên bản kế hoạch, thời điểm, trạng thái, hạn mức, các lần duyệt. Một run tham chiếu kế hoạch bất biến.
- `StepAttempt`: `stepId/attemptId`, trạng thái, input fingerprint, adapter, account/tab/chat URL, thời điểm gửi, request/receipt ID, loại lỗi và output IDs. Ghi ý định trước khi gọi, ghi receipt sau khi nhận; khoảng hở giữa hai lần ghi phải được phục hồi thành trạng thái cần đối chiếu.
- `Artifact`: ID, loại MIME, hash nội dung, đường dẫn nội bộ, thông số thật, nguồn run/step/attempt, vai trò input/output, phiên bản và kết quả kiểm tra. Không dùng blob URL tạm làm danh tính bền vững.
- `Grant`: dự án/kế hoạch, công cụ, tài khoản đích, hành động, hạn mức và thời hạn. Prompt/model không được tự mở rộng quyền.

Tool registry cần khai báo `inputSchema`, `outputSchema`, capability, handler, timeout, cách hủy, khóa tài nguyên, loại tác dụng, preflight, validator và recovery policy. Ví dụ tách `ai.generate_video`, `media.concat`, `posting.prepare`, `posting.submit`, `posting.check` thành công cụ có trạng thái riêng. Không cho model gọi IPC thô hoặc shell.

## Trạng thái và khôi phục

Bước chạy dùng: `pending → ready → running → verifying → succeeded`, cùng `waiting_user`, `retry_wait`, `blocked`, `failed`, `cancelled`, `unknown`. Thông báo tiếng Việt cho người dùng, mã ổn định cho chương trình.

`unknown` là trạng thái bắt buộc: đã bắt đầu gửi nhưng chưa biết phía dịch vụ nhận chưa. Lúc này chỉ đối chiếu bằng receipt/request ID/phiên chat; không coi timeout là quyền gửi lại. Không thể bảo đảm “đúng một lần” với mọi website; có thể chặn phát lại mù, lưu dấu vết và yêu cầu đối chiếu khi không xác minh được.

Đóng/mở app: bước chưa gửi có thể tiếp tục; bước đã có receipt tiếp tục poll; bước đang gửi mà thiếu receipt chuyển `unknown`. Thay đổi nguồn hoặc tham số đánh dấu kết quả cũ không còn hợp lệ và lan tới bước phụ thuộc, không xóa âm thầm bản người dùng đã duyệt. Không chạy lại chỉ vì lỗi lưu kết quả sau khi nhà cung cấp đã hoàn tất.

Scheduler đặt ở desktop host để chia sẻ khóa giữa các dự án, đăng bài và Affiliate. Khóa theo nhà cung cấp + tài khoản + tab/chat hoặc quota API; cần xử lý cả hai dự án dùng chung một tab. Cơ chế FIFO trong từng canvas hiện tại chưa đủ cho trường hợp này.

## Nhận đúng kết quả AI — ưu tiên cao nhất

Mỗi lượt chụp baseline trước khi gửi, ghi receipt của tin nhắn người dùng và chỉ nhận kết quả thuộc câu trả lời tiếp theo của đúng phiên chat. Tách ảnh tham chiếu/thumbnail/avatar/video poster khỏi ảnh/video tạo ra. Kiểm tra tải được byte thực, giải mã được và đo kích thước/thời lượng bằng công cụ.

Nếu chỉ thấy ảnh từ lượt trước, trạng thái vẫn là chờ/không xác định, không gắn `success`. Nếu DOM thay đổi hoặc chuyển chat, trả lỗi chẩn đoán có thể sửa; không tự chọn tab khác. Kết quả trả nhiều ảnh phải là danh sách artifact có thứ tự, không lấy tùy ý ảnh cuối trang. Cần test riêng Muse/Gemini/ChatGPT và lưu fixture cấu trúc đã bỏ nội dung riêng tư.

Kiểm tra kỹ thuật có thể kết luận chắc chắn về tệp/thời lượng. Đánh giá đúng sản phẩm, nhân vật hay độ hấp dẫn là đánh giá nội dung có độ bất định; nên có bằng chứng xem trước và cho người dùng sửa. Không gộp hai loại kiểm tra thành một dấu “đã kiểm chứng” chung.

## Thời lượng, lịch và ngân sách

- Nhà cung cấp trả 10 giây dù yêu cầu 40 giây: bộ lập kế hoạch có thể chia cảnh/ghép để đạt 40 giây, báo giới hạn thay vì đổi số giây trên nhãn. Clip thiếu không tự coi thành công đủ mục tiêu.
- Giữ `targetDuration`, `requestedClipDuration`, `actualDuration` riêng; validator tổng đối chiếu sau ghép, dùng sai số công bố theo fps/encoder.
- Lịch lưu UTC và timezone IANA của người dùng; hiển thị cả giờ địa phương khi duyệt. App desktop tắt/ngủ không bảo đảm gửi đúng giờ: dùng lịch nền tảng nếu được hỗ trợ, hoặc báo rõ cần app chạy; hệ thống server chạy lịch là hạng mục riêng.
- API có giá biết trước thì ước lượng; tab theo gói thuê bao không bịa giá/token. Giới hạn số lượt, số lần thử lại, thời gian và dung lượng vẫn áp dụng.
- Hạn mức kiểm tra trước khi bắt đầu tác vụ có chi phí. Mặc định không tự tạo lại sau lỗi không xác định. Retry có backoff và số lần trần; lỗi quyền/đăng nhập phải chờ sửa cấu hình.

## Giao diện tập trung vào công việc

- **Trái:** dự án, nhiệm vụ đang chạy, thành phẩm, đăng bài; công cụ chuyên sâu ở nhóm có tìm kiếm.
- **Giữa:** một nhiệm vụ với mục tiêu, kế hoạch ngắn, tiến độ từng bước và thành phẩm. Hai cách xem cùng dữ liệu: Các bước / Canvas.
- **Phải:** chọn bước/node để sửa tham số, mặc định và yêu cầu bổ sung, nhà cung cấp, input/output, kiểm tra kết quả và lịch sử. Nhấp vùng trống đóng bảng; không tạo một bản form tách rời dữ liệu node.
- **Phần duyệt:** xem/sửa nội dung, video thật và đích đăng ngay cạnh nhau. Lỗi có lý do và thao tác phù hợp: Đăng nhập lại, Chọn đúng kết quả, Đọc lại trạng thái, Chạy lại bước này.
- **Tự động hóa:** 3 mức Duyệt từng giai đoạn / Tự làm trong phạm vi / Chạy theo mẫu đã duyệt. Quyền đăng và hạn mức thể hiện trong cấu hình, lưu phạm vi cho các lượt sau.
- **Màu sắc:** một bảng màu chung trên thư viện/canvas/đăng bài/sản phẩm/cài đặt. Sáng và tối, màu nhấn tùy chỉnh; trạng thái thành công/lỗi không đổi theo màu trang trí.

Không gọi agent là “đã hoàn thiện” chỉ vì đổi tên, logo hoặc thêm ô chat. Inspector bên phải và màn nhiệm vụ là phần cần triển khai tiếp; bản sửa bảng màu không bao gồm các phần này.

## Thứ tự triển khai và điều kiện nghiệm thu

| Giai đoạn | Phạm vi cụ thể | Bằng chứng cần đạt |
|---|---|---|
| 1. Đầu ra tin cậy | Hợp đồng result/receipt/artifact chung, adapter từng AI, phân loại lỗi | Không nhận ảnh cũ/ảnh input; nhiều kết quả đúng thứ tự; đổi chat/timeout/hủy không gửi trùng |
| 2. Điều phối bền vững | Journal + scheduler desktop + khôi phục, giữ runner hiện có qua adapter | Đóng app ở từng điểm gửi/nhận/lưu và mở lại; hai dự án cùng tab không đua; không lặp tác vụ tính phí khi chưa biết trạng thái |
| 3. Agent theo mục tiêu | TaskBrief/Plan có schema, tool registry, validator và quyền | Yêu cầu 40 giây → kế hoạch khả thi → output đo thực; tool/field không hợp lệ bị chặn trước khi chạy; sửa riêng bước lỗi |
| 4. Giao diện nhiệm vụ | Các bước/Canvas + inspector phải dùng chung state | Sửa inspector cập nhật canvas và lưu được; không nhân đôi form; trạng thái task/step/node nhất quán; dùng được bằng bàn phím |
| 5. Khép kín xuất bản | Đưa thành phẩm vào publishing, cấu hình content/đích/lịch và xác minh | Chỉ gửi artifact mới đã duyệt; không đăng trùng khi reload/mất mạng; phân biệt accepted/processing/published/unknown; có link hoặc bằng chứng khi khả dụng |
| 6. Mở rộng | Mẫu bán hàng, lồng tiếng, nền tảng/tool bổ sung | Mỗi adapter qua cùng capability tests và lỗi thực tế; không thêm menu trống hoặc quyền không kiểm tra |

Đợt thực hiện đầu tiên nên là giai đoạn 1–2 trước khi mở thêm loại công cụ. Nó xử lý trực tiếp hai vấn đề người dùng đã gặp: lấy sai kết quả và công việc chỉ tiến triển khi đổi tab. Với throttling/hiển thị của website, cần đo trên Chrome thật; không cam kết thao tác nền luôn hoạt động chỉ bằng một tùy chọn Electron.

Kiểm thử tự động dùng fixture AI, lỗi mạng giả lập và media FFmpeg thật. Sau đó kiểm tra có chọn lọc trên tài khoản thật của người dùng theo hạn mức đã cho phép. Quyền nền tảng, chất lượng model, DOM website và app ngủ/tắt vẫn là giới hạn cần nêu rõ.

## Ranh giới triển khai để tránh tạo thêm lỗi

Trạng thái run ở host là nguồn chuẩn. Canvas và màn Các bước đọc cùng dữ liệu đó; inspector sửa cấu hình node qua một command có kiểm tra và lưu. Không để chat có bộ chạy riêng, canvas một bộ chạy riêng, publishing một bản sao trạng thái. Giai đoạn chuyển tiếp bọc runner hiện có thành adapter, sau đó chuyển dần quyền điều phối lên host.

Kế hoạch biên dịch thành DAG có kiểu dữ liệu: chặn chu trình, bước thiếu công cụ, cổng không tương thích và artifact không có quyền dùng. Vòng “kiểm tra → sửa” là attempt mới có số lần trần, không phải vòng lặp vô hạn trong graph. Sửa kế hoạch đang chạy cần phiên bản mới và xác định bước nào còn dùng được; không thay tham số ngầm dưới tác vụ đã gửi.

Bộ nhớ nên có ba lớp: ngữ cảnh ngắn của lượt chat; cấu hình/mục tiêu của dự án; thư viện sản phẩm/thương hiệu do người dùng lưu. Kết quả AI và trang web là dữ liệu tham khảo, không được sửa quyền công cụ hoặc tự lấy dữ liệu dự án khác. Prompt tùy chỉnh ở inspector là yêu cầu bổ sung, không phải cách bỏ kiểm tra của app. Không lưu token/API key vào plan, log hay báo cáo lỗi.

Báo tiến độ từ bước/receipt thật, không suy ra phần trăm từ câu trả lời model. Ước lượng thời gian chỉ hiển thị khi có dữ liệu; UI luôn cho thấy bước đang đợi nhà cung cấp, app đang xử lý hay cần người dùng sửa.

### Tình huống phải thử trước khi gọi bản agent ổn định

| Tình huống | Hành vi chấp nhận |
|---|---|
| Hai dự án dùng cùng tab Muse | Chỉ một lượt gửi; lượt còn lại chờ tài nguyên và có thể hủy |
| AI nhận lệnh rồi app tắt trước receipt | Mở lại hiện cần đối chiếu, không tự gửi lệnh thứ hai |
| Tạo ảnh xong nhưng lưu tệp thất bại | Giữ receipt/kết quả để tải lại; không tạo ảnh mới để chữa lỗi ổ đĩa |
| Thay ảnh sản phẩm khi nhánh video đang chạy | Kết quả gắn input phiên bản cũ; không nhập nhầm vào kế hoạch mới |
| AI trả JSON thiếu hoặc gọi công cụ lạ | Chặn trước thực thi, trình bày lỗi kế hoạch; không chạy phần JSON đọc được |
| Provider đang bận hoặc hết quota | Chờ/backoff khi phù hợp; đổi provider chỉ theo capability và phạm vi đã cho phép |
| Đổi từ Gemini sang ChatGPT khi đang đợi | Lượt cũ vẫn gắn provider/attempt ban đầu; thay lựa chọn chỉ áp dụng lượt tiếp |
| Video đủ thời lượng nhưng sai tỷ lệ hoặc có tệp hỏng | Kiểm tra độc lập, chỉ sửa phần có chính sách xử lý; không chỉ nhìn thumbnail |
| Muse nói “đã đăng” nhưng không có bằng chứng đối chiếu | Hiện chờ xác minh hoặc cần xác nhận, không tự gắn published |
| Lỗi một Page trong đợt nhiều Page | Giữ thành công của từng Page, báo lỗi riêng; chỉ thử lại đích thất bại đã đối chiếu |
| App ngủ đúng giờ hẹn | Sau tỉnh dậy báo lịch trễ và áp chính sách đã chọn; không giấu việc đăng muộn |
| Người dùng bấm Dừng rồi AI vẫn trả kết quả | Không tự chạy bước sau; giữ kết quả đến muộn để người dùng có thể nhận lại |

P0 là đúng kết quả và không gửi lặp khi chưa xác định. P1 là phục hồi, chia sẻ tài nguyên, giới hạn chạy và trạng thái nhất quán. P2 là mẫu agent mới, thêm nhà cung cấp và tối ưu chi phí/chất lượng từ lịch sử có bằng chứng.
