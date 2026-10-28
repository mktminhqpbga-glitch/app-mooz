/* Host seeds are visual preferences only; no credentials or project data in URLs/cache. */
(()=>{
 const query=new URLSearchParams(location.search);let cache={};try{cache=JSON.parse(localStorage.getItem('mooz-appearance-v1')||localStorage.getItem('workflow-appearance')||'{}')||{};}catch{}
 const theme=query.get('uiTheme')||cache.theme||'violet',size=query.get('uiSize')||cache.size||'standard';let accent;try{accent=MooZTheme.hex(query.get('uiAccent')||cache.accent||MooZTheme.DEFAULT_ACCENT);}catch{accent=MooZTheme.DEFAULT_ACCENT;}
 const seed={theme:MooZTheme.themes.includes(theme)?theme:'violet',size:['standard','large'].includes(size)?size:'standard',accent};window.MooZAppearanceSeed=Object.freeze(seed);MooZTheme.apply(document.documentElement,seed,matchMedia('(prefers-color-scheme: light)').matches);
})();
