/* Shared distinction between user guidance and application failures. */
(function(root){'use strict';
 const expected=/Chưa có ảnh hợp lệ|Cập nhật MooZ Connect|Chưa mở tab|Không có tab AI|Có nhiều tab AI|Chưa chọn (?:tab|cuộc trò chuyện|tệp|ảnh|Page)|Chọn (?:đúng cuộc trò chuyện|ít nhất một Page|ngày và giờ|sản phẩm trước)|Nhập (?:Page ID|Page ID và token|token|link sản phẩm|URL dịch vụ)|cần nhập (?:Page ID|token)|Thiếu (?:Page ID|token)|Prompt is empty|Yêu cầu không được để trống|Chưa có mục chờ|Chưa có kết nối đăng bài|Đăng nhập Facebook chưa được nhà cung cấp cấu hình/i;
 function kind(value){if(value?.name==='AbortError')return 'cancelled';if(['validation','setup','cancelled','summary','system'].includes(value?.issueKind))return value.issueKind;return expected.test(String(value?.message||value||''))?'validation':'system';}
 function input(message,type='validation'){const error=Error(message);error.issueKind=type;return error;}
 const api={kind,input,shouldRecord:value=>kind(value)==='system'};if(typeof module!=='undefined')module.exports=api;else root.MooZIssuePolicy=api;
})(globalThis);
