(() => {
  function parsePrompts(text, copies = 1) {
    const value=String(text||'').trim();
    if(!value)throw new Error('Nhập ít nhất một prompt ảnh.');
    if(!Number.isInteger(copies)||copies<1||copies>10)throw new Error('Số ảnh mỗi prompt phải từ 1 đến 10.');
    const lines=value.replace(/\r\n?/g,'\n');
    const prompts=(/\n\s*\n/.test(lines)?lines.split(/\n\s*\n/):lines.split('\n')).map(s=>s.trim()).filter(Boolean);
    if(prompts.length*copies>50)throw new Error('Mỗi đợt tối đa 50 ảnh. Hãy chia thành các đợt nhỏ hơn.');
    return prompts.flatMap((prompt,index)=>Array.from({length:copies},(_,copy)=>({prompt,index:index+1,copy:copy+1})));
  }
  globalThis.WorkflowBatch={parsePrompts};
})();
