'use strict';
const {EventEmitter}=require('node:events');
const {WebContentsView,BrowserWindow}=require('electron');
const STRIP_HEIGHT=48;
class WorkspaceTab extends EventEmitter{
 constructor(workspace,key,options){super();this.workspace=workspace;this.owner=workspace.owner;this.key=key;this.title=options.title;this.view=new WebContentsView({webPreferences:options.webPreferences});this.webContents=this.view.webContents;this.id=-this.webContents.id;this.closed=false;this.view.setBackgroundColor(options.backgroundColor||'#111216');this.owner.contentView.addChildView(this.view);this.webContents.once('destroyed',()=>this.finish());this.webContents.on('did-finish-load',()=>workspace.publish());}
 isDestroyed(){return this.closed||this.webContents.isDestroyed();}
 loadURL(url){return this.webContents.loadURL(url);}
 show(){this.workspace.activate(this.key);}
 focus(){this.workspace.activate(this.key);this.owner.focus();this.webContents.focus();}
 hide(){if(this.workspace.active===this.key)this.workspace.activate('home');}
 close(){if(this.isDestroyed())return;const event={defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};this.emit('close',event);if(!event.defaultPrevented)this.destroy();}
 destroy(){if(this.closed)return;this.workspace.remove(this);if(!this.webContents.isDestroyed())this.webContents.close({waitForBeforeUnload:false});this.finish();}
 finish(){if(this.closed)return;this.closed=true;this.workspace.remove(this);this.emit('closed');}
 getTitle(){return this.title;}
 setTitle(value){this.title=String(value);this.workspace.publish();}
 getBounds(){return this.owner.getBounds();}
 getContentBounds(){const b=this.owner.getContentBounds();return {...b,y:b.y+STRIP_HEIGHT,height:Math.max(1,b.height-STRIP_HEIGHT)};}
 setBounds(value){this.workspace.activate(this.key);this.owner.setBounds(value);}
 setSize(...args){this.owner.setSize(...args);}
 setContentSize(width,height,animate){this.workspace.activate(this.key);this.owner.setContentSize(width,height+STRIP_HEIGHT,animate);this.workspace.layout();}
 setMinimumSize(...args){this.owner.setMinimumSize(...args);}
 isFocused(){return this.workspace.active===this.key&&this.owner.isFocused();}
 isVisible(){return this.workspace.active===this.key&&this.owner.isVisible();}
 isMinimized(){return this.owner.isMinimized();}
 restore(){this.owner.restore();}
 minimize(){this.owner.minimize();}
}
class Workspace{
 constructor(owner,{version,appearance}={}){this.owner=owner;this.version=version;this.appearance=appearance;this.tabs=new Map();this.active='home';owner.on('resize',()=>this.layout());owner.on('closed',()=>{for(const tab of [...this.tabs.values()])tab.destroy();});owner.webContents.on('did-finish-load',()=>this.publish());owner.webContents.on('page-title-updated',event=>{event.preventDefault();this.setOwnerTitle();});}
 create(key,options){const old=this.tabs.get(key);if(old&&!old.isDestroyed()){this.activate(key);return old;}const tab=new WorkspaceTab(this,key,options);this.tabs.set(key,tab);this.activate(key);return tab;}
 lookup(contents){return [...this.tabs.values()].find(t=>t.webContents===contents&&!t.isDestroyed())||null;}
 current(){return this.active==='home'?this.owner:this.tabs.get(this.active)||this.owner;}
 activate(key){if(key!=='home'&&!this.tabs.has(key))throw Error('Tab đã đóng.');this.active=key;for(const [id,tab]of this.tabs){tab.view.setVisible(id===key);if(id===key){this.owner.contentView.addChildView(tab.view);tab.webContents.focus();}}if(key==='home')this.owner.webContents.focus();if(this.owner.isMinimized())this.owner.restore();this.owner.show();this.layout();this.publish();}
 layout(){if(this.owner.isDestroyed())return;const {width,height}=this.owner.getContentBounds();for(const tab of this.tabs.values())if(!tab.isDestroyed())tab.view.setBounds({x:0,y:STRIP_HEIGHT,width,height:Math.max(1,height-STRIP_HEIGHT)});}
 remove(tab){if(this.tabs.get(tab.key)!==tab)return;this.tabs.delete(tab.key);if(!this.owner.isDestroyed())try{this.owner.contentView.removeChildView(tab.view);}catch{}if(this.active===tab.key)this.active='home';if(!this.owner.isDestroyed())this.activate(this.active);}
 setOwnerTitle(){if(!this.owner.isDestroyed()){const title=this.active==='home'?'Thư viện':this.tabs.get(this.active)?.title||'MooZ Agent';this.owner.setTitle(title.replace(/\s*·\s*MooZ Agent(?:\s+[\d.]+)?$/,'')+' · MooZ Agent '+this.version);}}
 snapshot(){return {version:this.version,active:this.active,appearance:this.appearance?.(),tabs:[{key:'home',name:'Thư viện',closable:false},...[...this.tabs.values()].filter(t=>!t.isDestroyed()).map(t=>({key:t.key,name:t.title.replace(/\s*·\s*MooZ Agent(?:\s+[\d.]+)?$/,''),closable:true}))]};}
 publish(){if(this.owner.isDestroyed())return;this.setOwnerTitle();this.owner.webContents.send('workflow:event',{type:'workspace',...this.snapshot()});}
 windows(){return [this.owner,...this.tabs.values(),...BrowserWindow.getAllWindows().filter(w=>w!==this.owner)].filter(w=>!w.isDestroyed());}
}
module.exports={Workspace,STRIP_HEIGHT};
