import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
test('Cancel while awaiting a send permit rejects even if permission arrives afterward',async()=>{
 class Element{constructor(){this.isConnected=true;this.parentElement=null;}getAttribute(){return null;}}
 const editor=new Element();let respond,calls=0;const sandbox={Element,DOMException,Date,setTimeout,clearTimeout,getComputedStyle:()=>({display:'block',visibility:'visible'}),document:{querySelectorAll:selector=>selector.startsWith('textarea,')?[editor]:[]},chrome:{runtime:{sendMessage:()=>{calls++;return new Promise(resolve=>respond=resolve);}}}};
 vm.runInNewContext(readFileSync(new URL('../composer-controls.js',import.meta.url),'utf8'),sandbox);
 const controller=new AbortController(),request={dispatchProtocol:1,dispatchToken:'token',requestId:'job'},pending=sandbox.WorkflowComposer.waitTurn(request,'permit',controller.signal);
 controller.abort();respond({ok:true,expiresAt:Date.now()+2000});await assert.rejects(pending,e=>e.name==='AbortError');assert.equal(calls,1);
 await assert.rejects(sandbox.WorkflowComposer.waitTurn(request,'prepare',controller.signal),e=>e.name==='AbortError');assert.equal(calls,1);
});
