'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {UpdateService,isDeveloperIDSigned,latestPublicRelease,newer,stableVersion}=require('../desktop/updater.cjs');
class Engine extends EventEmitter{
 constructor(){super();this.checks=0;this.downloads=0;this.installs=0;this.version='0.32.0';}
 async checkForUpdates(){this.checks++;this.emit('checking-for-update');this.emit('update-available',{version:this.version});}
 async downloadUpdate(){this.downloads++;this.emit('download-progress',{percent:42,transferred:42,total:100});this.emit('update-downloaded',{version:this.version});}
 quitAndInstall(){this.installs++;}
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function native(options={}){const engine=options.engine||new Engine();return {engine,service:new UpdateService({version:'0.31.0',packaged:true,platform:'darwin',signed:true,engine,...options})};}
test('development and non-Mac builds do not contact a release service',async()=>{
 let calls=0;const updater=new UpdateService({version:'0.31.0',fetchRelease:async()=>{calls++;}});updater.start();assert.equal((await updater.check()).state,'disabled');assert.equal(calls,0);await assert.rejects(updater.install(),/chưa sẵn sàng/);updater.stop();
});
test('unsigned Mac checks stable release without using native download or installation',async()=>{
 const engine=new Engine();const updater=new UpdateService({version:'0.31.0',packaged:true,platform:'darwin',engine,fetchRelease:async()=>({version:'0.32.0'})});
 assert.equal((await updater.check()).state,'available');assert.equal(updater.status().mode,'manual');assert.equal(engine.checks,0);assert.equal(engine.downloads,0);assert.equal(updater.releaseURL(),'https://github.com/mktminhqpbga-glitch/workflow/releases/tag/v0.32.0');await assert.rejects(updater.install(),/chưa sẵn sàng/);
});
test('signed update downloads once in background, reports progress and never installs on quit',async()=>{
 const {engine,service}=native();const progress=[];service.on('status',value=>progress.push(value));await Promise.all([service.check(),service.check()]);await tick();
 assert.equal(engine.checks,1);assert.equal(engine.downloads,1);assert.equal(engine.installs,0);assert.equal(engine.autoInstallOnAppQuit,false);assert.equal(engine.disableDifferentialDownload,false);assert.equal(engine.allowDowngrade,false);assert.equal(engine.allowPrerelease,false);assert.equal(service.status().state,'downloaded');assert.ok(progress.some(value=>value.progress?.percent===42));service.stop();
});
test('cancelled install preserves downloaded update and never quits',async()=>{
 const {engine,service}=native({prepareInstall:async()=>false});await service.check();await tick();await service.install();assert.equal(engine.installs,0);assert.equal(service.status().state,'downloaded');
});
test('install awaits successful save and explicit approval before invoking updater',async()=>{
 const events=[];let finish;const ready=new Promise(resolve=>{finish=resolve;});const engine=new Engine();engine.quitAndInstall=(silent,restart)=>{assert.equal(silent,false);assert.equal(restart,true);events.push('install');};
 const {service}=native({engine,prepareInstall:async()=>{events.push('save-start');await ready;events.push('saved');return true;},onInstallStart:()=>events.push('approved')});
 await service.check();await tick();const install=service.install();assert.deepEqual(events,['save-start']);finish();await install;assert.deepEqual(events,['save-start','saved','approved','install']);
});
test('failed save prevents installation and exposes no raw secret error',async()=>{
 const {engine,service}=native({prepareInstall:async()=>{throw Error('sensitive-path-or-token');}});await service.check();await tick();await service.install();assert.equal(engine.installs,0);assert.equal(service.status().state,'error');assert.ok(!JSON.stringify(service.status()).includes('sensitive-path-or-token'));
});
test('failed checks can be retried and concurrent checks share one request',async()=>{
 let attempts=0;const updater=new UpdateService({version:'0.31.0',packaged:true,platform:'darwin',fetchRelease:async()=>{if(++attempts===1)throw Error('offline');return {version:'0.32.0'};}});
 assert.equal((await updater.check()).state,'error');assert.equal((await updater.check()).state,'available');assert.equal(attempts,2);
});
test('synchronous updater failures do not permanently block retry',async()=>{
 const engine=new Engine();engine.checkForUpdates=()=>{if(++engine.checks===1)throw Error('sync failure');engine.emit('update-not-available');return Promise.resolve();};
 const {service}=native({engine});assert.equal((await service.check()).state,'error');assert.equal((await service.check()).state,'idle');assert.equal(engine.checks,2);
});
test('no-update, old or malformed versions never download',async()=>{
 assert.equal(stableVersion('v0.32.0'),'0.32.0');assert.equal(newer('0.9.0','0.31.0'),false);assert.equal(stableVersion('v0.32.0/../../bad'),null);
 for(const version of ['0.30.0','bad','0.32.0-beta.1']){const {engine,service}=native();engine.version=version;await service.check();await tick();assert.equal(engine.downloads,0);assert.equal(service.status().state,'idle');}
});
test('automatic polling waits 30 seconds then repeats every six hours, and stops cleanly',()=>{
 const delays=[],cleared=[];const updater=new UpdateService({version:'0.31.0',packaged:true,platform:'darwin',fetchRelease:async()=>null,schedule:(_fn,ms)=>{delays.push(ms);return 1;},repeat:(_fn,ms)=>{delays.push(ms);return 2;},clearSchedule:id=>cleared.push(id),clearRepeat:id=>cleared.push(id)});
 updater.start();updater.start();assert.deepEqual(delays,[30000,21600000]);updater.stop();assert.deepEqual(cleared,[1,2]);
});
test('code signing requires a verified Developer ID signature, not ad-hoc signing',async()=>{
 let commands=0;assert.equal(await isDeveloperIDSigned('/App.app',async()=>{commands++;return {stderr:commands===1?'':'Authority=Developer ID Application: Example\nTeamIdentifier=ABCDEFGHIJ\n'};}),true);
 assert.equal(await isDeveloperIDSigned('/App.app',async()=>({stderr:'Signature=adhoc\nTeamIdentifier=not set'})),false);
 assert.equal(await isDeveloperIDSigned('/App.app',async()=>{throw Error('invalid signature');}),false);
});
test('manual release discovery accepts only stable published Mac builds and fixed endpoint',async()=>{
 let url;const request=async(uri,options)=>{url=uri;assert.equal(options.redirect,'error');return new Response(JSON.stringify({tag_name:'v0.32.0',assets:[{name:'Workflow-0.32.0-mac-arm64.zip'}]}));};
 assert.deepEqual(await latestPublicRelease(request),{version:'0.32.0'});assert.equal(url,'https://api.github.com/repos/mktminhqpbga-glitch/workflow/releases/latest');
 assert.equal(await latestPublicRelease(async()=>new Response('',{status:404})),null);
 assert.equal(await latestPublicRelease(async()=>new Response(JSON.stringify({tag_name:'v0.32.0',assets:[]}))),null);
 assert.equal(await latestPublicRelease(async()=>new Response(JSON.stringify({tag_name:'v0.32.0',prerelease:true,assets:[{name:'Workflow-0.32.0-mac-arm64.zip'}]}))),null);
 await assert.rejects(latestPublicRelease(async()=>new Response('',{status:403})),/failed/);
});

test('unsigned clients keep polling even after an earlier update was found',async()=>{
 let count=0;const service=new UpdateService({version:'0.31.0',packaged:true,platform:'darwin',fetchRelease:async()=>({version:++count===1?'0.32.0':'0.33.0'})});
 assert.equal((await service.check()).latestVersion,'0.32.0');assert.equal((await service.check()).latestVersion,'0.33.0');assert.equal(count,2);
});
