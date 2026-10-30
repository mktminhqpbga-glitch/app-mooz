# Tách kịch bản · MooZ 0.53.0

Node **Tách kịch bản** nhận văn bản từ node Tạo văn bản (ChatGPT hoặc AI khác), hoặc nội dung bạn dán. Đây là bước kiểm tra/tách cục bộ; không gọi AI và không tự chạy các node được tạo.

## Luồng sử dụng

1. Trong **Thêm node**, tìm **Tách kịch bản**. Hoặc bấm **Tách kịch bản theo cấu trúc** ngay trong node Tạo văn bản: app tạo/nối một node tách, dùng lại node đã nối nếu đã có.
2. Mở **Cấu trúc, quy tắc & xem kết quả**. Bảng chỉnh sửa nằm bên phải. Chọn tên mảng, tên trường, phần bắt buộc, giới hạn cảnh, cách đánh số và quy tắc nội dung. Bấm **Xác nhận cấu trúc & quy tắc**.
3. Mở **Mẫu yêu cầu dành cho ChatGPT → Tạo / cập nhật node quy tắc**. Nếu node tách nhận đầu vào từ Tạo văn bản và cổng Quy tắc còn trống, app nối mẫu vào đó. Nếu cổng đã có nguồn khác, app giữ nguồn cũ và hướng dẫn gộp hai bộ quy tắc. Chưa gửi AI ở bước này.
4. Chạy node Tạo văn bản. Khi có câu trả lời mới hoàn tất, mở node tách và bấm **Kiểm tra & tách**.
5. Xem từng cảnh, lời thoại, prompt, thời lượng và dữ liệu gốc. Tích **Tôi đã xem và xác nhận các cảnh đã tách**, chọn AI ảnh/video và loại node cần tạo, rồi bấm **Tạo node từ các cảnh đã duyệt**.
6. Chọn tab AI và kiểm tra các node mới trước khi chạy. Mỗi video chỉ nhận ảnh của đúng cảnh; lời thoại được giữ ở node văn bản riêng để nối sang lồng tiếng khi cần.

## Cấu trúc mặc định

```json
{
  "scenes": [
    {
      "scene": 1,
      "title": "Tên cảnh",
      "voiceover": "Lời thoại nguyên văn",
      "imagePrompt": "Yêu cầu tạo ảnh của cảnh",
      "videoPrompt": "Yêu cầu chuyển động của cảnh",
      "duration": null,
      "size": "9:16"
    }
  ]
}
```

Có thể đổi các tên trường, ví dụ `voiceover` thành `loi_doc`, hoặc để trống tên mảng nếu câu trả lời là một mảng JSON. Có thể bỏ yêu cầu lời thoại để chỉ tách prompt ảnh/video. `duration: null` hoặc không có trường thời lượng giữ trạng thái **Không chọn**; app không tự gán 5 giây. Thời lượng có số được giữ đúng, kể cả 8 giây; AI/dịch vụ vẫn phải hỗ trợ giá trị đó, không bảo đảm video thực tế có đúng độ dài.

## Quy tắc kiểm tra

- JSON phải đầy đủ; chấp nhận một khối Markdown JSON đầy đủ. Không tự tìm một đoạn JSON giữa lời dẫn hoặc ghép nhiều tài liệu.
- Từ 1 đến 50 cảnh, trong giới hạn bạn chốt. Số cảnh phải là số nguyên dương không trùng; mặc định liên tục từ 1.
- Trường bắt buộc phải đúng tên và là văn bản không trống. Giữ nguyên nội dung nhiều dòng, dấu ngoặc, emoji và khoảng trắng trong lời thoại/prompt.
- Tiêu đề tối đa 200 ký tự; các nội dung tối đa 20.000 ký tự/trường, đầu vào tối đa 200.000 ký tự. Thời lượng là số lớn hơn 0 đến 120, hoặc null; tỷ lệ 9:16, 16:9, 1:1.
- Trường bổ sung được giữ trong dữ liệu gốc/JSON đầu ra; bạn có thể bật kiểm tra nghiêm để từ chối chúng. Không tự diễn giải trường bổ sung thành prompt.
- Trùng khóa JSON, cấu trúc nguy hiểm, JSON quá sâu, sai kiểu dữ liệu hoặc thiếu trường sẽ báo lỗi. Không tạo một phần các cảnh rồi bỏ qua phần lỗi.

Quy tắc nội dung tự viết được thêm vào yêu cầu cho ChatGPT; bộ tách chỉ xác minh được cấu trúc, loại dữ liệu, số cảnh và giới hạn nêu trên. Cần xem lại ý nghĩa của lời thoại/prompt trước khi duyệt.

## Sửa, tải lại và tránh tạo trùng

Đổi cấu trúc/quy tắc làm mất xác nhận và kết quả tách cũ. Đổi nguồn văn bản yêu cầu tách/duyệt lại. Nếu nguồn AI đang chạy, lỗi hoặc đã cũ, node tách đợi kết quả mới; không dùng lại văn bản cũ âm thầm. Cấu trúc đã xác nhận được lưu cùng dự án và giữ sau khi mở lại; nhập workflow hoặc nhân bản node tách cần xác nhận lại.

Mỗi bộ đầu vào, cấu trúc và lựa chọn tạo node có dấu kiểm tra riêng. Bấm tạo lại cùng một bộ khi các node đã tạo còn tồn tại sẽ báo trùng. Đổi sang một bộ mới tạo một nhóm mới, giữ các kết quả cũ. Tạo node quy tắc không tạo vòng lặp ngược từ node tách vào ChatGPT.

## Kiểm thử

Có kiểm tra parser cho nội dung nhiều dòng/Unicode, tên trường riêng, thiếu/sai trường, số cảnh trùng/thiếu, JSON trùng khóa, prototype, độ sâu/dung lượng, số giây null và sự thay đổi cấu hình. Bài thử Electron dùng ChatGPT DOM fixture, xác nhận cấu trúc, đưa quy tắc vào đúng cổng, nhận câu trả lời lỗi rồi hợp lệ, duyệt 3 cảnh tạo 15 node, kiểm tra ảnh/video đúng cảnh, giữ 8 giây/null, chống trùng và lưu/mở lại. Không gọi tài khoản AI hoặc đăng bài thật.
