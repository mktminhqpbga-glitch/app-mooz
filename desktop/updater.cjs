'use strict';
const {EventEmitter}=require('node:events');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const RELEASES='https://github.com/mktminhqpbga-glitch/workflow/releases';
const LATEST='https://api.github.com/repos/mktminhqpbga-glitch/workflow/releases/latest';
function stableVersion(value){const match=/^v?((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/.exec(String(value||''));return match?match[1]:null;}
function newer(candidate,current){const a=stableVersion(candidate),b=stableVersion(current);if(!a||!b)return false;const left=a.split('.').map(Number),right=b.split('.').map(Number);for(let i=0;i<3;i++){if(left[i]!==right[i])return left[i]>right[i];}return false;}
async function isDeveloperIDSigned(bundle,run=promisify(execFile)){
  try{await run('/usr/bin/codesign',['--verify','--deep','--strict',bundle],{timeout:15000});const result=await run('/usr/bin/codesign',['--display','--verbose=4',bundle],{timeout:15000});return /^Authority=Developer ID Application:/m.test(result.stderr)&&/^TeamIdentifier=[A-Z0-9]{10}$/m.test(result.stderr);}
  catch{return false;}
}
async function latestPublicRelease(fetcher){
  const response=await fetcher(LATEST,{headers:{Accept:'application/vnd.github+json','User-Agent':'Workflow-Desktop'},redirect:'error',signal:AbortSignal.timeout(20000)});
  if(response.status===404)return null;
  if(!response.ok)throw Error('Release check failed');
  const text=await response.text();if(Buffer.byteLength(text)>1024*1024)throw Error('Release metadata too large');
  const release=JSON.parse(text);if(release.draft||release.prerelease)return null;
  const version=stableVersion(release.tag_name);if(!version)throw Error('Invalid stable release');
  // A source-only GitHub release cannot update the desktop application.
  if(!Array.isArray(release.assets)||!release.assets.some(asset=>/^Workflow-.*-mac-(?:arm64|x64)\.zip$/.test(asset.name||'')))return null;
  return {version};
}
class UpdateService extends EventEmitter{
  constructor({version,packaged=false,platform=process.platform,signed=false,engine=null,fetchRelease,prepareInstall=async()=>false,onInstallStart=()=>{},onInstallFailed=()=>{},schedule=setTimeout,repeat=setInterval,clearSchedule=clearTimeout,clearRepeat=clearInterval}={}){
    super();this.engine=engine;this.fetchRelease=fetchRelease;this.prepareInstall=prepareInstall;this.onInstallStart=onInstallStart;this.onInstallFailed=onInstallFailed;
    this.schedule=schedule;this.repeat=repeat;this.clearSchedule=clearSchedule;this.clearRepeat=clearRepeat;this.timers=[];this.pending=null;this.downloading=null;
    const mode=!packaged||platform!=='darwin'?'unavailable':signed&&engine?'native':'manual';
    this.value={state:mode==='unavailable'?'disabled':'idle',mode,currentVersion:version,latestVersion:null,progress:null,message:mode==='unavailable'?'Cập nhật ứng dụng dùng trong bản cài macOS.':mode==='manual'?'Bản thử chưa ký: app tự kiểm tra bản mới; tải và cài qua trang phát hành.':'App tự kiểm tra và tải bản mới trong nền. Bạn quyết định khi nào cài.'};
    this.handlers=[];
    if(mode==='native')this.configureEngine();
  }
  status(){return structuredClone(this.value);}
  set(patch){Object.assign(this.value,patch);this.emit('status',this.status());return this.status();}
  configureEngine(){
    const engine=this.engine;engine.autoDownload=false;engine.autoInstallOnAppQuit=false;engine.allowPrerelease=false;engine.allowDowngrade=false;engine.disableDifferentialDownload=false;
    // Do not forward raw URLs, filesystem paths or request headers to the UI/logs.
    engine.logger={info(){},warn(){},error(){},debug(){}};
    const on=(name,fn)=>{engine.on(name,fn);this.handlers.push([name,fn]);};
    on('checking-for-update',()=>this.set({state:'checking',progress:null,message:'Đang kiểm tra phiên bản mới…'}));
    on('update-available',info=>{
      const version=stableVersion(info?.version);
      if(!version||!newer(version,this.value.currentVersion)){this.set({state:'idle',latestVersion:null,progress:null,message:'Bạn đang dùng phiên bản mới nhất.'});return;}
      this.set({state:'available',latestVersion:version,message:'Có phiên bản '+version+'. Đang chuẩn bị tải nền…'});
      void this.download().catch(()=>{});
    });
    on('update-not-available',()=>this.set({state:'idle',latestVersion:null,progress:null,message:'Bạn đang dùng phiên bản mới nhất.'}));
    on('download-progress',value=>this.set({state:'downloading',progress:{percent:Math.max(0,Math.min(100,Number(value.percent)||0)),transferred:Math.max(0,Number(value.transferred)||0),total:Math.max(0,Number(value.total)||0)},message:'Đang tải bản cập nhật trong nền…'}));
    on('update-downloaded',info=>{const version=stableVersion(info?.version);if(!version||!newer(version,this.value.currentVersion)){this.fail('download');return;}this.set({state:'downloaded',latestVersion:version,progress:null,message:'Bản '+version+' đã tải xong. Lưu công việc và chọn Cài và khởi động lại khi sẵn sàng.'});});
    on('error',()=>{const kind=this.value.state==='installing'?'install':this.value.state==='downloading'?'download':'check';if(kind==='install')this.onInstallFailed();this.fail(kind);});
  }
  fail(kind){return this.set({state:'error',progress:null,message:kind==='install'?'Chưa cài được cập nhật. Dự án đã lưu vẫn được giữ; hãy thử lại hoặc mở trang phát hành.':kind==='download'?'Chưa tải được cập nhật. Kiểm tra mạng hoặc dung lượng đĩa rồi thử lại.':'Chưa kiểm tra được cập nhật. Kiểm tra mạng rồi thử lại.'});}
  start(){if(this.value.mode==='unavailable'||this.timers.length)return;const first=this.schedule(()=>void this.check().catch(()=>{}),30000);first.unref?.();const interval=this.repeat(()=>void this.check().catch(()=>{}),6*60*60*1000);interval.unref?.();this.timers=[first,interval];}
  check(){
    if(this.value.mode==='unavailable')return Promise.resolve(this.status());
    if(this.pending)return this.pending;
    if(['downloading','downloaded','installing'].includes(this.value.state)||(this.value.mode==='native'&&this.value.state==='available'))return Promise.resolve(this.status());
    this.set({state:'checking',progress:null,message:'Đang kiểm tra phiên bản mới…'});
    this.pending=Promise.resolve().then(async()=>{try{
      if(this.value.mode==='native')await this.engine.checkForUpdates();
      else{const result=await this.fetchRelease();if(result&&newer(result.version,this.value.currentVersion))this.set({state:'available',latestVersion:stableVersion(result.version),message:'Có bản '+result.version+'. Mở trang phát hành để tải bản cài mới.'});else this.set({state:'idle',latestVersion:null,message:'Chưa có bản cài mới hơn trên kênh phát hành.'});}
      return this.status();
    }catch{this.fail('check');return this.status();}}).finally(()=>{this.pending=null;});
    return this.pending;
  }
  download(){
    if(this.downloading)return this.downloading;
    if(this.value.mode!=='native'||this.value.state!=='available')return Promise.resolve(this.status());
    this.set({state:'downloading',progress:null,message:'Đang tải bản cập nhật trong nền…'});
    this.downloading=Promise.resolve().then(()=>this.engine.downloadUpdate()).then(()=>this.status(),()=>this.fail('download')).finally(()=>{this.downloading=null;});
    return this.downloading;
  }
  async install(){
    if(this.value.mode!=='native'||this.value.state!=='downloaded')throw Error('Bản cập nhật chưa sẵn sàng để cài.');
    this.set({state:'installing',message:'Đang lưu và chuẩn bị cài…'});
    try{
      if(!await this.prepareInstall()){this.set({state:'downloaded',message:'Đã hoãn cài đặt. Bản cập nhật vẫn sẵn sàng.'});return this.status();}
      this.onInstallStart();this.engine.quitAndInstall(false,true);return this.status();
    }catch{this.onInstallFailed();return this.fail('install');}
  }
  releaseURL(){return this.value.latestVersion?RELEASES+'/tag/v'+this.value.latestVersion:RELEASES;}
  stop(){this.clearSchedule(this.timers[0]);this.clearRepeat(this.timers[1]);this.timers=[];for(const [name,handler]of this.handlers)this.engine?.removeListener(name,handler);this.handlers=[];}
}
module.exports={UpdateService,isDeveloperIDSigned,latestPublicRelease,stableVersion,newer};
