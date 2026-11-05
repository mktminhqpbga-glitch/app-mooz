/* Actual Canvas Studio entry and media presentation. Local fixtures; no AI requests. */
'use strict';
const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
function fixture(background,garment=false){return 'data:image/svg+xml;base64,'+Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800"><rect width="600" height="800" fill="${background}"/><ellipse cx="300" cy="745" rx="115" ry="19" fill="#000" opacity=".08"/>${garment?'<path d="m220 160-140 110 80 125 55-40-20 330h210l-20-330 55 40 80-125-140-110c-30 50-130 50-160 0Z" fill="#6c7490"/><path d="M300 213v472" stroke="#d7d8dc" stroke-width="5"/>':'<circle cx="300" cy="210" r="82" fill="#d7b29c"/><path d="M215 205c-10-150 185-150 170 5l-34-55-108 12Z" fill="#302b2a"/><path d="M215 310h170l45 275H170Z" fill="#fbfaf7"/><path d="m220 585-24 160h80l24-140 24 140h80l-24-160Z" fill="#8c969c"/>'}</svg>`).toString('base64');}
async function image(envName,fallback){const file=process.env[envName];if(!file)return fallback;return 'data:image/'+(/\.png$/i.test(file)?'png':'jpeg')+';base64,'+(await fs.readFile(file)).toString('base64');}
(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'mooz-libtv-review-'));
 const review=process.env.MOOZ_UI_AUDIT_DIR||'/tmp/mooz-0681-visual-proof';
 let app;const errors=[];
 try{
  await fs.mkdir(review,{recursive:true});
  const env={...process.env,WORKFLOW_DESKTOP_TEST:'1',WORKFLOW_TEST_DATA:profile};delete env.ELECTRON_RUN_AS_NODE;
  app=await electron.launch({args:['--no-sandbox',path.resolve(__dirname,'..')],env,timeout:60000});
  const home=await app.firstWindow();home.setDefaultTimeout(30000);await home.waitForSelector('#homeOpenCanvas');
  await home.evaluate(()=>workflowDesktop.call('appearance.save',{theme:'light',size:'standard',accent:'#4dc9d4',colors:{}}));
  const project=await home.evaluate(()=>workflowHome.createProject('Phim thời trang'));
  await home.click('#homeOpenCanvas');await home.waitForSelector('#appProjectDialog[open]');await home.selectOption('#appProjectSelect',project.id);
  const opening=app.waitForEvent('window');await home.click('#appProjectOpen');const page=await opening;page.setDefaultTimeout(30000);page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  await page.waitForFunction(()=>!!window.MooZCanvasStudio);await page.evaluate(()=>MooZCanvasStudio.ready);await page.waitForSelector('#canvasStudioDock');
  assert.equal(await page.locator('body').getAttribute('data-canvas-theme'),'dark');
  assert.equal(await page.locator('html').getAttribute('data-ui-theme'),'light','Canvas does not change shared app preference');
  await app.evaluate(()=>{workflowTest.libtvPaidCalls=0;workflowTest.aiConnections.fetch=async()=>{workflowTest.libtvPaidCalls++;throw Error('Unexpected AI call in presentation review');};});
  const portrait=await image('MOOZ_REVIEW_IMAGE_A',fixture('#e9e6e1'));
  const outfit=await image('MOOZ_REVIEW_IMAGE_B',fixture('#e0dfdc',true));
  const graph={nodes:[
   {id:'character',type:'imageInput',x:110,y:180,data:{customName:'Nhân vật tham chiếu',localDataUrl:portrait,fileName:'Nhân vật.jpg',status:'success'}},
   {id:'wardrobe',type:'imageInput',x:510,y:180,data:{customName:'Trang phục',localDataUrl:outfit,fileName:'Trang phục.jpg',status:'success'}},
   {id:'prompt',type:'prompt',x:970,y:650,data:{customName:'Ý tưởng',text:'Cảnh thời trang với ánh sáng tự nhiên. Giữ nhân vật và trang phục từ ảnh tham chiếu, máy quay chuyển động chậm.'}},
   {id:'generate',type:'generateImage',x:970,y:285,data:{customName:'Tạo khung hình',provider:'muse',size:'9:16',status:'success',studioPrompt:'Giữ nguyên nhân vật, trang phục và màu sắc. Ánh sáng tự nhiên.',asset:{id:'review-frame',url:outfit,kind:'image',name:'Khung hình kết quả.jpg'}}},
   {id:'result',type:'preview',x:1370,y:180,data:{customName:'Khung hình kết quả',status:'success',asset:{id:'review-frame',url:outfit,kind:'image',name:'Khung hình kết quả.jpg'}}}
  ],edges:[
   {id:'ref-character',source:'character',sourcePort:'image',target:'generate',targetPort:'reference'},
   {id:'ref-outfit',source:'wardrobe',sourcePort:'image',target:'generate',targetPort:'reference'},
   {id:'text',source:'prompt',sourcePort:'text',target:'generate',targetPort:'prompt'},
   {id:'composition',source:'generate',sourcePort:'image',target:'result',targetPort:'media'}
  ],groups:[{id:'fashion',name:'Phim thời trang',nodeIds:['character','wardrobe','prompt','generate','result'],x:65,y:135,width:1700,height:800}],notes:[],settings:{}};
  await page.setInputFiles('#workflowFileInput',{name:'fashion-review.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(graph))});
  await page.waitForSelector('.node[data-id=character] .studio-node-face img');
  await page.waitForFunction(()=>[...document.querySelectorAll('.studio-node-face img')].every(image=>image.complete&&image.naturalWidth>0));
  assert.equal(await page.locator('.node[data-id=generate]').getAttribute('data-studio-role'),'process','Generator remains a processor when output has its own preview');assert.ok(await page.locator('.node[data-id=generate]').evaluate(node=>node.offsetHeight<450),'Reference thumbnails keep process node compact');await page.evaluate(()=>MooZCanvasStudio.action('save'));
  const appearance=await page.locator('.node[data-id=character]').evaluate(node=>{const style=getComputedStyle(node);return {background:style.backgroundColor,borderWidth:style.borderTopWidth};});
  assert.equal(appearance.background,'rgba(0, 0, 0, 0)','Assets are bare media instead of dashboard cards');
  assert.equal(appearance.borderWidth,'0px','Asset has no dashboard frame');
  assert.equal(await page.locator('body>.studio-sidebar').isVisible(),false);assert.equal(await page.locator('body>.toolbar').isVisible(),false);
  const widths=[];
  for(const [width,height]of [[1500,950],[640,700]]){
   await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),[width,height]);
   await page.evaluate(()=>MooZCanvasStudio.action('fit'));await page.waitForTimeout(250);await page.evaluate(()=>MooZCanvasStudio.select(['generate']));
   assert.equal(await page.locator('#canvasStudioDock').isVisible(),true);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page remains within window width');
   const cluster=await page.locator('.canvas-studio-project-cluster').boundingBox();assert.ok(cluster.width<width*.5,'Project cluster leaves the canvas header open');
   await page.screenshot({path:path.join(review,'libtv-canvas-'+width+'.png')});widths.push({width,height,clusterWidth:cluster.width});
  }
  assert.equal(await page.locator('#canvasStudioToast.error:not([hidden])').count(),0);assert.deepEqual(errors,[]);assert.equal(await app.evaluate(()=>workflowTest.libtvPaidCalls),0);
  await fs.writeFile(path.join(review,'libtv-review.json'),JSON.stringify({canvasEntryViaProjectPicker:true,canvasDarkDefault:true,applicationThemePreserved:true,bareMediaAssets:true,compactProjectCluster:true,widths,rendererErrors:errors,liveAIRequests:0},null,2));
  console.log('PASS LibTV presentation: visible Studio entry, independent dark canvas, bare media assets, compact project cluster, live process/reference graph, dock and responsive screenshots. No AI request.');
 }finally{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await fs.rm(profile,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
