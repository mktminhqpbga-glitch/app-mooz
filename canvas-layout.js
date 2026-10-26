/* Placement uses unscaled canvas rectangles; existing nodes keep their positions. */
(function(root){
 const overlaps=(a,b,gap=36)=>a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;
 function findSpace(anchor,size,obstacles,gap=36){
  const point={x:Math.max(30,anchor.x),y:Math.max(30,anchor.y)};
  const candidates=[point];
  for(const r of obstacles){candidates.push({x:r.x+r.width+gap,y:point.y},{x:point.x,y:r.y+r.height+gap},{x:r.x+r.width+gap,y:r.y},{x:r.x,y:r.y+r.height+gap},{x:r.x-size.width-gap,y:point.y},{x:point.x,y:r.y-size.height-gap});}
  candidates.sort((a,b)=>Math.hypot(a.x-point.x,a.y-point.y)-Math.hypot(b.x-point.x,b.y-point.y));
  for(const p of candidates)if(p.x>=30&&p.y>=30&&!obstacles.some(r=>overlaps({...p,...size},r,gap)))return p;
  return {x:Math.max(30,...obstacles.map(r=>r.x+r.width+gap)),y:point.y};
 }
 function grid(rectangles,{x=60,y=60,columns=Math.min(5,Math.max(2,Math.ceil(Math.sqrt(rectangles.length)))),gap=90}={}){const cells=[],widths=Array.from({length:columns},(_,col)=>Math.max(0,...rectangles.filter((_,i)=>i%columns===col).map(r=>r.width)));let top=y;for(let start=0;start<rectangles.length;start+=columns){let left=x;const row=rectangles.slice(start,start+columns);for(let col=0;col<row.length;col++){cells.push({id:row[col].id,x:left,y:top});left+=widths[col]+gap;}top+=Math.max(...row.map(r=>r.height))+gap;}return cells;}
 const api={findSpace,overlaps,grid};if(typeof module!=='undefined')module.exports=api;else root.WorkflowLayout=api;
})(globalThis);
