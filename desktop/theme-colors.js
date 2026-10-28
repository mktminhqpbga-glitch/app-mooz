/* One palette contract for every window. All foreground decisions use WCAG contrast. */
(function(root){
 const DEFAULT_ACCENT='#9b87f5',themes=['dark','light','violet','system'];
 const surfaces={dark:{bg:'#0b0e14',panel:'#131821',raised:'#1c2330',line:'#303b4d',ink:'#f0f3fa',muted:'#aab6ca',success:'#79dbb0',danger:'#ff9eaf',warning:'#f1cc83'},violet:{bg:'#100e17',panel:'#191620',raised:'#24202e',line:'#3c354c',ink:'#f6f2fc',muted:'#beb2ce',success:'#89dfba',danger:'#ffa9b6',warning:'#edcb91'},light:{bg:'#f5f6fa',panel:'#ffffff',raised:'#edf0f6',line:'#ccd4e2',ink:'#1a2335',muted:'#56647c',success:'#146b4a',danger:'#ac2542',warning:'#85540c'}};
 function hex(value){if(typeof value!=='string'||!/^#[\da-f]{6}$/i.test(value))throw Error('Màu nhấn cần mã HEX dạng #9b87f5.');return value.toLowerCase();}
 const rgb=value=>hex(value).slice(1).match(/../g).map(x=>parseInt(x,16));
 const luminance=value=>rgb(value).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
 function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
 function mix(a,b,t){const x=rgb(a),y=rgb(b);return '#'+x.map((n,i)=>Math.round(n*(1-t)+y[i]*t).toString(16).padStart(2,'0')).join('');}
 function readable(color,background,minimum=4.5){if(contrast(color,background)>=minimum)return color;const end=contrast('#ffffff',background)>contrast('#000000',background)?'#ffffff':'#000000';for(let i=1;i<=100;i++){const next=mix(color,end,i/100);if(contrast(next,background)>=minimum)return next;}return end;}
 function palette(theme,accent=DEFAULT_ACCENT){const base=surfaces[theme]||surfaces.violet,fill=hex(accent),ink=contrast('#ffffff',fill)>contrast('#000000',fill)?'#ffffff':'#000000';return {...base,accent:fill,accentInk:ink,link:readable(fill,base.raised),soft:mix(base.panel,fill,theme==='light'?.1:.13),hover:mix(base.raised,fill,.06),focus:readable(fill,base.raised,3),dangerSoft:mix(base.panel,base.danger,.1),successSoft:mix(base.panel,base.success,.1)};}
 function apply(element,value,systemLight=false){const mode=value.theme==='system'?(systemLight?'light':'dark'):value.theme,p=palette(mode,value.accent||DEFAULT_ACCENT);element.dataset.uiTheme=mode;element.dataset.uiSize=value.size||'standard';for(const [key,color]of Object.entries(p))element.style.setProperty('--mooz-'+key.replace(/[A-Z]/g,s=>'-'+s.toLowerCase()),color);element.style.colorScheme=mode==='light'?'light':'dark';return p;}
 const api=Object.freeze({DEFAULT_ACCENT,themes,hex,contrast,readable,palette,apply});if(typeof module!=='undefined')module.exports=api;else root.MooZTheme=api;
})(globalThis);
