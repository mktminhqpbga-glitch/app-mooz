# MooZ Agent · Tạo video hàng loạt

Bản thiết kế ngày 28/10/2026. Phạm vi đợt này: **logic và HTML tương tác để xem trước**. Chưa thêm ứng dụng này vào bản cài MooZ, chưa gọi AI thật, chưa điều khiển tab Chrome.

Mở [HTML tự chứa](../designs/mooz-batch-video-preview.html) bằng Chrome. Không cần cài thư viện, không cần API key, không cần chạy server. Mọi tài nguyên minh họa được nhúng hoặc tạo trên máy. Nguồn có thể chỉnh sửa nằm trong `designs/batch-video/`.

## Luồng sử dụng đã chốt

**Ảnh sản phẩm → bản luồng riêng → hàng chờ AI → video hoàn tất → xem/duyệt → màu + nhạc + cắt → xuất thành phẩm.**

Bốn khu vực trong một không gian:

| Khu vực | Người dùng làm gì |
|---|---|
| Video hàng loạt | Nhập nhiều sản phẩm, chọn nhóm, xếp hàng, chạy/tạm dừng, xem tab đang xử lý, xem lỗi và kết quả |
| Luồng & tab AI | Chỉnh các bước, yêu cầu bổ sung, AI của từng bước, tỷ lệ, số cảnh, thời lượng hoặc Không chọn; chọn các tab được phép dùng |
| Kho media | Tải trước ảnh, MP3/WAV/M4A, MP4/WebM/MOV; tìm/lọc, xem/nghe, đổi tên, bỏ khỏi kho, chọn lại khi cần |
| Hậu kỳ & xuất | Chọn video, chỉnh sáng/tương phản/bão hòa; chọn nhạc; kéo điểm cắt và đoạn nhạc; nghe thử, chỉnh âm lượng riêng và xuất |

Chế độ **Gọn bảng** ẩn phần tổng quan/trạm AI để dành chỗ cho danh sách; tự dùng trên màn hình thấp và có nút mở lại tổng quan.

Không để người dùng phải nhân bản 13 canvas bằng tay. Canvas/luồng là mẫu, mỗi sản phẩm nhận một phiên chạy độc lập.

## 1. Nhập sản phẩm và chốt đầu vào

Có hai chế độ: **mỗi ảnh là một sản phẩm** hoặc **gom nhiều ảnh thành một sản phẩm**. Có thể thêm ảnh tham chiếu sau trong chi tiết bản nháp. Mỗi sản phẩm có ID/SKU, tên, danh sách ảnh và ghi chú riêng. Ảnh nhân vật/ảnh chung có thể bổ sung ở bản tích hợp nhưng phải có vai trò rõ, không trộn với ảnh SKU.

Khi bấm Xếp hàng, chốt một snapshot gồm ảnh đầu vào, ghi chú, phiên bản luồng, nhà cung cấp theo bước và thiết lập. Sửa luồng gốc sau đó chỉ áp dụng cho mục xếp hàng mới; không âm thầm sửa lệnh đang chạy. Đổi ảnh/tên/ghi chú có ảnh hưởng prompt của mục đã xếp hàng cần rút về bản nháp và chốt lại trong bản tích hợp.

Bản HTML cho tải ảnh thật, chọn ảnh từ kho, sửa tên và ghi chú của sản phẩm nháp. Giữ tối đa 100 sản phẩm để bản xem trước nhẹ.

## 2. Luồng tùy chỉnh

Mẫu mặc định gồm:

1. Đọc ảnh sản phẩm — AI nhận đúng ảnh của sản phẩm, trích thông tin nhìn thấy, ghi rõ thông tin chưa biết.
2. Viết kịch bản — nội dung tiếng Việt, hook/cảnh/CTA, chỉ dùng thông tin đã xác nhận.
3. Tạo ảnh — giữ thiết kế, màu sắc, nhân vật và ảnh tham chiếu tương ứng.
4. Tạo video — dùng ảnh/cảnh đã đạt, không lấy video cũ làm kết quả mới.
5. Ghép thành phẩm — nối đúng thứ tự, đo kích thước/thời lượng thật, giữ bản gốc.

Trong HTML, chọn một bước để sửa ở bảng bên phải. Có thể đổi AI, đổi yêu cầu, thêm/xóa/đưa bước lên hoặc xuống. Bộ kiểm tra không cho chạy luồng thiếu bước tạo video hoặc thiếu bước ghép ở cuối. AI không hỗ trợ loại bước đó không xuất hiện trong bộ chọn.

Trước tích hợp thật cần bổ sung đồ thị cổng có kiểu, dependency giữa các bước và trình biên dịch luồng sang runner hiện có. Các thay đổi luồng nằm trong bản nháp cho đến khi bấm **Lưu luồng**. Trình sửa mẫu trong HTML là chuỗi tuần tự; không giả định kéo bước tùy ý vẫn tạo đồ thị hợp lệ về nội dung. Kịch bản có thể được mở rộng thành chế độ AI tự viết / dùng kịch bản của người dùng theo cùng hợp đồng đầu ra.

**Không chọn thời lượng** tiếp tục là lựa chọn hợp lệ: không chèn số giây vào prompt hay tham số API. Số cảnh, thời lượng yêu cầu và thời lượng đo thực phải là các trường riêng. Không đổi nhãn “40 giây” để che việc AI chỉ trả 10 giây.

## 3. Chia 12–13 sản phẩm cho 4 tab Muse

Người dùng chọn các tab đang mở được phép dùng, đặt tên dễ nhớ và giới hạn chạy đồng thời. Không phải tự gán từng sản phẩm vào một tab.

Ví dụ tất cả bước AI dùng Muse, có 4 tab được chọn và 13 sản phẩm:

- Tab 1–4 nhận các bước của 4 sản phẩm đầu. Một tab chỉ có một lease/tác vụ tại một thời điểm.
- Tác vụ hoàn tất và kết quả đã xác minh thì nhả lease. Bộ điều phối lấy bước sẵn sàng tiếp theo theo thứ tự ưu tiên của sản phẩm.
- Những sản phẩm hoàn tất chuyển sang Đã xong, không bị chạy lại. Tab trống nhận sản phẩm tiếp theo, đến sản phẩm thứ 13.
- Khi tất cả bước dùng Muse và thời gian tương tự nhau, người dùng sẽ thấy gần như các đợt **4 → 4 → 4 → 1**. Đây không phải cam kết mọi sản phẩm mất cùng thời gian; bước ghép trên máy có hàng đợi riêng.

Nếu bước đọc ảnh dùng Gemini, viết kịch bản dùng ChatGPT và tạo video dùng Muse: mỗi bước lấy tab thuộc đúng nhóm AI. Không chiếm tab Muse trong lúc đang chờ Gemini. Có thể có nhiều sản phẩm trong pipeline, nhưng mỗi bước giữ lease trên đúng tài nguyên.

Trong HTML, có 4 tab Muse được chọn sẵn; 2 tab Gemini và 1 tab ChatGPT có thể bật trong Nhóm tab AI. Tất cả đều được ghi rõ là mô phỏng. Điều chỉnh tốc độ mô phỏng không thay thời lượng clip.

### Ràng buộc khi nối vào app thật

- Scheduler ở desktop host, dùng chung cho mọi chiến dịch/dự án. Bộ hàng đợi theo từng renderer hiện có cần được bọc/mở rộng để tránh hai cửa sổ dùng chung tab cùng lúc.
- Lease theo ID tab + phiên chat + tài khoản/nhà cung cấp; có attempt ID và quyền sở hữu rõ ràng. Không chỉ đếm “4 node đang chạy”.
- Mỗi sản phẩm dùng cuộc trò chuyện mới hoặc context đã được xác minh. Khi tái dùng tab cho sản phẩm tiếp theo, tạo/chọn chat riêng và xác nhận URL/ID trước khi đính kèm.
- Nếu phải đổi tab giữa các bước của cùng sản phẩm, gửi đúng các artifact cần cho bước đó; không dựa vào lịch sử chat của tab trước.
- Ảnh, caption và video được gắn `productId/runId/stepId/attemptId`. Bộ thu kết quả chỉ nhận output thuộc lượt gửi đó, loại ảnh đầu vào, thumbnail và output cũ.
- Mất tab/mất mạng sau khi gửi thì chuyển “Cần đối chiếu”; không tự gửi lại một lệnh có thể đã được dịch vụ nhận. Hạn mức, giãn lượt và khả năng chạy nền vẫn theo adapter hiện có.

## 4. Trạng thái và xử lý lỗi

| Trạng thái | Ý nghĩa và thao tác |
|---|---|
| Bản nháp | Sửa ảnh, tên, ghi chú; chưa giữ tài nguyên và chưa gửi AI |
| Đang chờ | Đã chốt dữ liệu, đợi đúng loại AI/tab rảnh |
| Đang chạy | Đang thực hiện một bước, hiển thị tên tab và tiến độ |
| Đã xong | Bước cuối đã đạt; có artifact/video để xem và hậu kỳ |
| Có lỗi | Có lý do ở bước cụ thể; các sản phẩm khác tiếp tục |
| Đã dừng | Không chạy bước sau; có thể xem những gì đã xong và chọn chạy tiếp |
| Cần đối chiếu (bản thật) | Chưa biết dịch vụ đã nhận/hoàn tất chưa; kiểm tra receipt/chat trước khi thử lại |

**Tạm dừng hàng chờ** ngừng cấp việc mới, để bước đang chạy hoàn tất. **Dừng sản phẩm** chỉ dừng mục được chọn, không hủy cả lô. Trong bản thật, hủy tác vụ từ xa là best effort; kết quả về muộn phải được giữ có nguồn gốc, không tự kích hoạt bước sau.

Retry giữ bước đã hoàn tất còn hợp lệ, tiếp tục từ bước lỗi. Không chạy lại toàn bộ kịch bản/ảnh/video vì lỗi tải tệp hoặc lỗi lưu. Tự retry chỉ áp dụng lỗi chắc chắn chưa gửi và có số lần trần; lỗi không xác định cần đối chiếu.

HTML có nút **Thử mô phỏng lỗi** trong chi tiết mục đang chờ/chạy. Nó làm bước kế tiếp lỗi, nhả slot và cho phép thử nút chạy tiếp, không phát sinh giao dịch AI.

## 5. Kho media dùng chung

Media có ID, tên hiển thị, loại MIME, dung lượng, thời lượng/kích thước thật, Blob/đường dẫn, hash và trạng thái đang được dùng. Có bộ lọc ảnh/âm thanh/video và tìm tên. Video kết quả và video xuất hậu kỳ cũng có thể vào kho để chọn tiếp.

Đổi tên không đổi danh tính tệp. Bỏ một tệp khỏi kho không làm mất bản đang dùng trong sản phẩm/recipe đã chốt. Bản thật nên lưu artifact bất biến và chỉ garbage collect khi không còn tham chiếu. Kho là dùng chung; ảnh tham chiếu vẫn phải được gán đúng sản phẩm.

HTML dùng IndexedDB cho tệp người dùng tải lên và video xuất; cấu hình/luồng/trạng thái dùng localStorage. Tệp không rời trình duyệt. Nếu storage bị từ chối, báo rõ chỉ giữ trong phiên. Xóa dữ liệu trình duyệt có thể làm mất kho; đây chưa phải cơ chế sao lưu trên thư mục dự án của app.

## 6. Hậu kỳ, đoạn nhạc và xuất

Chọn video đã xong → mở phòng hậu kỳ. Hoặc chọn một MP4/WebM thật từ kho. Mỗi sản phẩm có recipe riêng, không sửa video nguồn.

Recipe gồm:

- Sáng/tương phản/bão hòa, preset Nguyên bản / Mềm tự nhiên / Nổi bật / Trắng đen.
- Điểm vào/ra video theo giây, hiển thị bằng dải khung hình với hai tay cắt.
- Media nhạc đã chọn, điểm vào/ra của nguồn nhạc, âm lượng nhạc và âm lượng video gốc riêng.
- Lặp nhạc nếu đoạn đã chọn ngắn hơn video; nếu không lặp thì phần còn lại im lặng.
- Độ phân giải và định dạng xuất; lưu recipe cùng nguồn và thời điểm xuất.

Dải nhạc hiển thị biên độ giải mã từ tệp thật. Kéo cả vùng chọn để dịch đến đoạn mong muốn; kéo hai mép để thay điểm cắt. Có ô số và phím trái/phải (Shift để đi 1 giây) cho người không dùng chuột.

Quan hệ thời gian: ở thời điểm video `t`, nhạc phát tại `audioIn + (t - videoIn)`. Khi lặp, dùng modulo độ dài đoạn nhạc. Không phát từ đầu MP3 khi người dùng đã chọn đoạn ở giữa. Xem trước và xuất phải dùng cùng recipe và cùng phép căn thời gian.

HTML xuất thật bằng canvas + Web Audio + MediaRecorder, theo thời gian phát. Bộ lọc màu được vẽ vào frame xuất, âm thanh được trộn vào stream; không chỉ thay CSS của preview rồi tải lại video gốc. Video xuất được đo metadata, tải xuống và thêm vào kho. Cắt một đoạn ngắn để thử nhanh.

Giới hạn: định dạng/codecs phụ thuộc trình duyệt; MP4 chỉ cho chọn khi browser báo hỗ trợ, có WebM làm lựa chọn khác. Preview giới hạn 180 giây/lần xuất và không upscale khi chọn cạnh 720/1080 lớn hơn nguồn. Bản tích hợp app nên xuất bằng FFmpeg worker/tiến trình nền để nhanh hơn thời gian thực, có tiến độ, hủy, tên tệp không trùng và hàng chờ xuất riêng.

## 7. Mô hình dữ liệu để tích hợp

- `Campaign`: ID, tên, workflow version, defaults, worker pool, max concurrency, trạng thái, thời điểm.
- `Product`: ID/SKU, ảnh theo vai trò, thông tin đã xác nhận, yêu cầu riêng, trạng thái duyệt.
- `ProductRun`: snapshot sản phẩm + luồng, thứ tự bước, đầu ra từng bước, trạng thái và lỗi.
- `SceneRun`: ảnh/video theo số cảnh, thứ tự và ràng buộc nối tiếp; mỗi scene giữ nguồn theo đúng SKU. Bước tạo ảnh/video trong bản tích hợp được mở thành tác vụ từng cảnh, dùng chung pool 4 tab.
- `StepAttempt`: ID, provider/tab/chat, lease, input hash, request/receipt ID, start/end, output IDs.
- `MediaAsset`: ID/hash, loại, thông số thật, nguồn, nơi lưu, tên hiển thị, các tham chiếu.
- `EditRecipe`: source video ID/version, video in/out, audio ID/in/out, gains, màu, loop và export settings.
- `ExportJob`: recipe bất biến, output path/ID, encoder/progress, trạng thái và lỗi. Xuất lại không gọi AI.

Nhật ký chạy thật phải bền vững, ghi ý định trước khi gửi và receipt ngay khi nhận. Sau khi mở lại app: tiếp tục poll tác vụ có receipt; tác vụ có thể đã gửi nhưng thiếu receipt cần đối chiếu. HTML chỉ khôi phục trạng thái mô phỏng về chờ, không phải bằng chứng đã có recovery backend.

## 8. Thứ tự triển khai vào MooZ

1. Chốt bản HTML và cách nhập/nhóm sản phẩm, chọn AI/tab, hậu kỳ nhạc.
2. Thêm Campaign/ProductRun store và artifact bất biến; dùng ProjectStore/MediaLibrary hiện có qua adapter.
3. Đưa scheduler lên host, chia sẻ lease giữa tất cả cửa sổ. Tích hợp provider/receipt hiện có, không tạo đường gửi prompt thứ hai.
4. Biên dịch mẫu luồng thành graph riêng theo SKU và kiểm tra kết quả từng bước.
5. Kho media và recipe hậu kỳ dùng cùng nguồn chuẩn; triển khai waveform/cắt/preview chính xác.
6. Hàng chờ FFmpeg xuất nền, log lỗi theo sản phẩm, tiếp tục sau khởi động và xuất hàng loạt vào thư mục đã chọn.
7. Sau khi chất lượng đầu ra/khôi phục đã đạt, mới nối thành phẩm sang Đăng bài theo cài đặt hiện có.

## 9. Nghiệm thu

- 13 sản phẩm / 4 tab: không có 2 lease cùng tab, không lẫn ảnh/SKU, mọi sản phẩm có trạng thái cuối.
- Đổi AI của bước chỉ nhận tab tương thích; chưa chọn tab thì chặn trước gửi và có chỉ dẫn sửa.
- Tạm dừng không cấp việc mới; lỗi một sản phẩm không dừng cả lô; retry không làm lại bước đã đạt.
- Sửa luồng gốc sau enqueue không làm đổi snapshot đang chạy.
- Tải media, đổi tên, bỏ khỏi kho và mở lại không làm hỏng tệp đang được dùng.
- Kéo đoạn nhạc thay điểm bắt đầu thật; âm lượng 0 là im lặng, màu/cắt có mặt trong tệp xuất.
- Xem trước và tệp xuất có cùng đoạn nhạc/điểm cắt; tệp đọc được bằng FFprobe và phát được.
- Không gọi AI/đăng bài thật trong các kiểm thử bản thiết kế.

## Kết quả kiểm tra bản HTML

Đã chạy trên Chromium thật với tệp HTML mở qua `file://`, không có yêu cầu mạng HTTP/HTTPS. 239 kiểm thử đơn vị của repo đạt, gồm 4 kiểm tra scheduler/định dạng WebM mới.

Kiểm tra tương tác đã đạt: 13 sản phẩm / 4 lease AI không trùng; nhập thêm từng ảnh hoặc gom ảnh; tạm dừng/cấp việc lại; mô phỏng lỗi và retry giữ bước đạt; snapshot không đổi khi lưu luồng mới; tải/đổi tên/bỏ media và mở lại; đổi video sau khi khởi tạo trộn âm thanh; không tràn chiều ngang ở 1536/1024/390px.

Xuất WebM thật từ đoạn video 1–2,2 giây với bão hòa 0 và nhạc nguồn từ giây 5. Dùng FFprobe xác nhận kích thước, luồng hình/âm thanh và duration hữu hạn; giải mã frame kiểm tra RGB trắng đen, giải mã PCM kiểm tra có âm và tần số tương ứng đoạn nhạc đã chọn. Không gọi Muse/Gemini/ChatGPT hay đăng bài thật. MP4 chưa có kiểm tra giải mã tương tự; tùy bộ mã hóa browser.
