'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const defaults = Object.freeze({theme:'dark',size:'standard'});
class UIPreferences {
  constructor(directory) { this.file=path.join(directory,'ui-preferences.json'); this.value={...defaults}; this.pending=Promise.resolve(); }
  async load() { try { const value=JSON.parse(await fs.readFile(this.file,'utf8')); try{this.value=this.validate(value);}catch{this.value={...defaults};} } catch(error) { if(error.code!=='ENOENT' && !(error instanceof SyntaxError)) throw error; } return this.get(); }
  validate(value) { if(!value || !['dark','light','system','violet'].includes(value.theme) || !['standard','large'].includes(value.size)) throw Error('Cài đặt giao diện không hợp lệ.'); return {theme:value.theme,size:value.size}; }
  get() { return {...this.value}; }
  save(value) { const next=this.validate(value); const task=this.pending.catch(()=>{}).then(async()=>{await fs.mkdir(path.dirname(this.file),{recursive:true});const tmp=this.file+'.tmp';await fs.writeFile(tmp,JSON.stringify(next),{mode:0o600});await fs.rename(tmp,this.file);this.value=next;return this.get();});this.pending=task;return task; }
}
module.exports={UIPreferences};
