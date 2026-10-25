'use strict';
const affiliate='https://s.shopee.vn/example?tracking=keep-exact';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABgCAIAAAAip+O/AAAAd0lEQVR4nO3PQREAIAwDQbSjBE144Y8IHmmHvYmA7DjNG+kDrwGkA0gHkO4DwFw7OwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIC6gOIBpANIB5CuPeACB8G88r1PA14AAAAASUVORK5CYII=';
const sourceHTML='<!doctype html><script type="application/ld+json">'+JSON.stringify({'@graph':[{'@type':'Product',name:'Áo cotton MooZ',description:'Áo làm từ cotton. Màu trắng.',image:['https://down-vn.img.susercontent.com/file/product-photo']}]})+'</script>';
const hook='Một góc nhìn tối giản cho chiếc áo cotton của bạn.';
function answer(prompt){
 if(prompt.includes('Lập hồ sơ JSON'))return {category:'Áo',audience:'Người thích trang phục tối giản',facts:[{source:'description',quote:'Áo làm từ cotton.'}],unknowns:['Chưa có bảng kích cỡ']};
 if(prompt.includes('Đề xuất 3 góc'))return {candidates:[{angle:'Soi chất liệu',situation:'Quan sát ảnh sản phẩm',hook,fact_ids:['F0','F1'],score:9},{angle:'Màu sắc',situation:'Nền trung tính',hook:'Cùng xem màu trắng trên mẫu áo trong ảnh nguồn.',fact_ids:['F1'],score:7},{angle:'Thông tin cần biết',situation:'Bảng thông tin',hook:'Chọn áo bắt đầu từ dữ liệu thay vì lời hứa.',fact_ids:['F0'],score:6}]};
 if(prompt.includes('Viết 3–5 cảnh'))return {scenes:[{title:'Mở đầu',narration:hook,visual_prompt:'Cận cảnh ảnh áo nguồn, giữ nguyên màu trắng.',fact_ids:['F0'],image_index:0,seconds:5},{title:'Chất liệu',narration:'Nguồn sản phẩm ghi áo làm từ cotton, màu trắng.',visual_prompt:'Máy quay chậm, giữ đúng áo trong ảnh nguồn.',fact_ids:['F1'],image_index:0,seconds:6},{title:'Xem thêm',narration:'Xem thông tin chi tiết ở link trong bài. Có liên kết tiếp thị.',visual_prompt:'Khung cuối giữ nguyên sản phẩm.',fact_ids:['F0'],image_index:0,seconds:5}]};
 if(prompt.includes('Kiểm tra từng cảnh'))return {approved:true,reviewed_scene_ids:[1,2,3],issues:[],summary:'Đã đối chiếu đủ ba cảnh với dữ kiện nguồn.'};
 throw Error('Unknown fixture phase');
}
module.exports={affiliate,image,sourceHTML,answer};
