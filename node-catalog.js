/* Canonical Vietnamese names and help for both the picker and node cards. */
(function(root){
 const groups={text:{name:'Văn bản',icon:'T',color:'#bca5ff'},image:{name:'Ảnh',icon:'▧',color:'#90c5ff'},video:{name:'Video',icon:'▷',color:'#8fe0c6'},audio:{name:'Âm thanh',icon:'♫',color:'#f2bc84'},control:{name:'Kiểm soát',icon:'◇',color:'#e6cf87'}};
 const rows=[
 ['masterScript','Kịch bản tổng','text','Viết kịch bản chính, chia hồi và cảnh để phát triển workflow.'],
 ['prompt','Yêu cầu','text','Nhập prompt hoặc nội dung sản phẩm cho các bước AI.'],
 ['generateText','Tạo văn bản','text','Viết hoặc phân tích bằng AI đã chọn; có thể gửi ảnh và video.'],
 ['generateImage','Tạo ảnh','image','Tạo ảnh từ yêu cầu và các ảnh tham chiếu đã nối.'],
 ['generateVideo','Tạo video','video','Tạo chuyển động từ yêu cầu, ảnh hoặc video tham chiếu.'],
 ['finalOutput','Tổng hợp video','video','Nối các video kết quả theo thứ tự thành một video dài để tải hoặc đưa sang Đăng bài.'],
 ['negativePrompt','Loại trừ','text','Liệt kê chi tiết không muốn xuất hiện trong kết quả AI.'],
 ['textAppend','Nối thêm văn bản','text','Thêm đoạn bạn nhập vào sau một văn bản đầu vào.'],
 ['textConcat','Gộp nhiều văn bản','text','Nối nhiều nguồn văn bản theo dấu phân cách; không gọi AI.'],
 ['text','Ghi chú','text','Ghi chú trên khung vẽ; không gửi AI và không có cổng nối.'],
 ['actScript','Kịch bản hồi/chương','text','Phát triển một hồi hoặc chương từ kịch bản tổng.'],
 ['partScript','Kịch bản phần','text','Tách phần nội dung trong một hồi/chương.'],
 ['segmentScript','Kịch bản đoạn','text','Chia nội dung thành các đoạn nhỏ để dựng cảnh.'],
 ['storyPrompt','Yêu cầu cảnh','text','Yêu cầu ảnh/video cho một cảnh, nhận ngữ cảnh từ kịch bản.'],
 ['videoAnalysis','Phân tích video','text','Gửi video gốc cho AI để mô tả và viết prompt tái tạo.'],
 ['sceneSplit','Chia cảnh tự động','text','Tách nội dung kịch bản thành các cảnh.'],
 ['promptVariants','Biến thể prompt','text','Dùng AI viết nhiều cách diễn đạt cho cùng yêu cầu.'],
 ['imageInput','Ảnh đầu vào','image','Chọn hoặc thả một ảnh từ máy để đưa vào workflow.'],
 ['referenceBoard','Bảng ảnh chung','image','Giữ ảnh dùng cho cả workflow; từng ảnh cũng có thể nối riêng.'],
 ['references','Ảnh tham chiếu riêng','image','Gom tối đa 8 ảnh, chỉ gửi đến các node bạn nối.'],
 ['imageRoles','Gán vai trò ảnh','image','Phân ảnh theo nhân vật, bối cảnh, trang phục và tư thế.'],
 ['characterLock','Khóa nhân vật','image','Dùng ảnh để giữ danh tính và đặc điểm nhân vật nhất quán.'],
 ['imageCollection','Tổng ảnh','image','Gom các ảnh kết quả thành một bộ để tải hoặc đưa sang Đăng bài.'],
 ['imageResize','Đổi kích thước ảnh','image','Đổi kích thước ảnh cục bộ, không cần gọi AI.'],
 ['preview','Xem trước','image','Hiển thị kết quả ảnh/video nhận từ node đã nối.'],
 ['videoInput','Video đầu vào','video','Chọn video trên máy để phân tích hoặc làm tham chiếu.'],
 ['timeline','Ghép dòng thời gian (node)','video','Nhận các clip đã nối; sắp thứ tự và xuất ở thanh Dòng thời gian bên dưới.'],
 ['videoAssembly','Ghép video hoàn chỉnh','video','Ghép nhiều clip thành một video theo kịch bản.'],
 ['frameFit','Khung hình · đổi tỷ lệ','video','Đệm khung hình sang tỷ lệ mới và giữ toàn bộ ảnh gốc.'],
 ['watermark','Logo / dấu bản quyền','video','Chèn logo đã nối vào video ở vị trí bạn chọn.'],
 ['subtitles','Phụ đề','video','Gắn phụ đề SRT hoặc nhận diện lời nói vào video.'],
 ['transition','Chuyển cảnh','video','Ghép hai cảnh bằng hiệu ứng chuyển tiếp.'],
 ['speed','Điều chỉnh tốc độ','video','Tăng hoặc giảm tốc độ của video và âm thanh.'],
 ['videoTrim','Cắt video','video','Chọn giây bắt đầu và kết thúc; xuất một đoạn video mới trên máy.'],
 ['videoRotate','Xoay / lật video','video','Xoay 90/180/270 độ hoặc lật ngang; giữ âm thanh nguồn.'],
 ['videoColor','Chỉnh màu video','video','Chỉnh độ sáng, tương phản và bão hòa cục bộ.'],
 ['audioExtract','Tách âm thanh','audio','Tách tiếng từ video thành MP3 để tải hoặc nối sang node nhạc nền.'],
 ['audioInput','Âm thanh đầu vào','audio','Chọn nhạc hoặc bản đọc MP3/WAV/M4A từ máy.'],
 ['voiceover','Lồng tiếng · OpenAI','audio','Tạo MP3 từ lời đọc bằng OpenAI API; cần khóa API và có thể tính phí.'],
 ['audioMix','Âm thanh / nhạc nền','audio','Trộn nhạc/lời đọc với video hoặc thay tiếng gốc.'],
 ['voiceSync','Đồng bộ lời đọc – cảnh','audio','Khớp độ dài từng cảnh theo bản đọc đã nối.'],
 ['review','Duyệt trước khi chạy','control','Chặn bước tiếp theo để bạn kiểm tra và phê duyệt nội dung.'],
 ['qualityCheck','Kiểm tra kết quả','control','Kiểm tra kích thước, tỷ lệ và thời lượng; không tạo ảnh/video.'],
 ['bundleSave','Lưu theo bộ','control','Lưu bộ nội dung và tệp kết quả đã nối; không tạo ảnh/video.'],
 ['workflowTemplate','Mẫu workflow','control','Chọn mẫu đã lưu hoặc lưu nhóm node thành mẫu để dùng lại.']
 ];
 const entries=Object.fromEntries(rows.map(([id,title,group,description])=>[id,{id,title,group,description,...groups[group]}]));
 entries.videoAssembly.internal=true;
 const common=['masterScript','prompt','generateText','generateImage','generateVideo','finalOutput'];
 const fold=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
 const keywords={finalOutput:'ghép video nối clip xuất mp4',sceneSplit:'tách cảnh chia cảnh',textConcat:'gộp chữ nối văn bản',voiceover:'đọc lời thoại giọng nói text to speech tts',referenceBoard:'ảnh chung tham chiếu sản phẩm nhân vật'};
 for(const [id,words]of Object.entries(keywords))entries[id].keywords=words;
 const api={entries,groups,common,match:(entry,query)=>fold(entry.title+' '+entry.description+' '+entry.id+' '+(entry.keywords||'')).includes(fold(query).trim())};
 if(typeof module!=='undefined')module.exports=api;else root.WorkflowNodeCatalog=api;
})(globalThis);
