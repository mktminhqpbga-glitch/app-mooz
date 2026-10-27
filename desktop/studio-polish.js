/* Decorative line icons only. Existing labels, handlers and node data stay intact. */
(()=>{
 const paths={
  arrow:'M6 18L18 6 M6 6h12v12',
  image:'M3 3h18v18H3z M3 16l5-5 5 5 3-3 5 5 M8 7h.01',
  sparkle:'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',
  queue:'M4 6h16 M4 12h12 M4 18h8 M18 15l3 3-3 3',
  grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  script:'M6 3h12v18H6z M9 7h6 M9 11h6 M9 15h4',
  download:'M12 3v12 M7 10l5 5 5-5 M4 17v4h16v-4',
  upload:'M12 16V4 M7 9l5-5 5 5 M4 17v4h16v-4',
  folder:'M3 6h7l2 3h9v12H3z',
  arrange:'M3 4h6v6H3z M15 4h6v6h-6z M9 16h6v6H9z M6 10v3h12v-3 M12 13v3',
  copy:'M8 8h13v13H8z M16 8V3H3v13h5',
  select:'M4 3l15 9-7 2-3 7z',
  settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',
  erase:'M14 3l7 7-11 11H5l-4-4z M7 11l7 7 M10 21h12',
  trash:'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
  home:'M3 10l9-7 9 7v11h-6v-7H9v7H3z',
  send:'M3 3l18 9-18 9 4-9z M7 12h14',
  chat:'M3 4h18v13H9l-6 4z M7 8h10 M7 12h6',
  windows:'M3 3h15v15H3z M7 21h14V7',
  voice:'M9 4a3 3 0 0 1 6 0v8a3 3 0 0 1-6 0z M5 10v2a7 7 0 0 0 14 0v-2 M12 19v3 M8 22h8'
 };
 const icons={referenceBoardBtn:'image',creativeToolsBtn:'sparkle',batchManagerBtn:'queue',flowStudioBtn:'grid',batchImagesBtn:'image',scriptImportBtn:'script',storyDashboardBtn:'script',promptLibraryBtn:'folder',mediaLibraryBtn:'download',workflowExportBtn:'download',workflowImportBtn:'upload',arrangeNodesBtn:'arrange',arrangeLooseBtn:'arrange',duplicateSelectionBtn:'copy',runOptionsBtn:'select',clearPromptsBtn:'erase',resetBtn:'trash',connectionsOpen:'settings',commandPaletteOpen:'select',appearanceOpen:'settings',studioHome:'home',studioPosting:'send',studioChat:'chat',windowSwitcherOpen:'windows',desktopUpdateButton:'download'};
 function svg(kind){const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.classList.add('finish-icon');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('aria-hidden','true');const p=document.createElementNS(s.namespaceURI,'path');p.setAttribute('d',paths[kind]);s.append(p);return s;}
 function decorate(){for(const [id,kind]of Object.entries(icons)){const b=document.getElementById(id);if(!b||!b.closest('.studio-sidebar')||b.querySelector('.finish-icon'))continue;if(!b.getAttribute('aria-label'))b.setAttribute('aria-label',b.textContent.trim());if(!b.title)b.title=b.textContent.trim();const label=document.createElement('span');label.className='finish-label';label.textContent=b.textContent.replace(/^(?:[＋+⇩⇄↔←⚙↗]|↻)\s*/u,'');b.replaceChildren(svg(kind),label);}
 for(const [id,kind]of [['aiAppsWorkflow','grid'],['aiAppsHubPosting','send'],['aiAppsAffiliate','sparkle'],['aiAppsVoice','voice']]){const holder=document.querySelector('#'+id+' .app-icon');if(holder&&!holder.querySelector('.finish-icon'))holder.replaceChildren(svg(kind));}}
 for(const holder of document.querySelectorAll('.app-arrow,.top .mark'))holder.replaceChildren(svg('arrow'));
 if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',decorate,{once:true});else decorate();
})();
