'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{FacebookLogin}=require('../desktop/facebook-login.cjs');
function fixture(poll){let opens=0,starts=0;const notices=[],requests=[];
 const login=new FacebookLogin({wait:async()=>{},notify:e=>notices.push(e),pages:{stage:rows=>({pages:rows})},openExternal:async()=>opens++,fetch:async(url,o)=>{
  requests.push({url,body:o?.body});if(url.endsWith('/health'))return Response.json({ok:true,protocol:'workflow-meta-oauth-v1'});
  if(url.endsWith('/sessions')){starts++;return Response.json({id:'a'.repeat(43),ticket:'b'.repeat(43),authURL:'https://www.facebook.com/v24.0/dialog/oauth?redirect_uri='+encodeURIComponent('https://meta.example.com/oauth/callback')});}
  return poll(o);
 }});return {login,notices,requests,opens:()=>opens,starts:()=>starts};
}
test('Facebook login recovers a dropped poll and temporary 503 in the same PKCE session without opening another login',async()=>{
 let calls=0;const bodies=[],f=fixture(async o=>{bodies.push(o.body);if(++calls===1)throw Error('Dropped connection');if(calls===2)return new Response('Temporarily unavailable',{status:503});return Response.json({status:'ready',pages:[{id:'123456'}]});});
 const result=await f.login.login('https://meta.example.com/');assert.equal(result.pages.length,1);assert.equal(f.opens(),1);assert.equal(f.starts(),1);assert.equal(new Set(bodies).size,1);assert.equal(f.notices.filter(n=>n.state==='retrying').length,2);assert.equal(JSON.stringify(f.notices).includes('bbbbbbbb'),false);
});
test('expired OAuth session is reported once, without retrying consent or clearing saved accounts',async()=>{
 let calls=0;const f=fixture(async()=>{calls++;return Response.json({error:'Session invalid or expired.'},{status:403});});await assert.rejects(f.login.login('https://meta.example.com/'),/không còn hiệu lực.*khởi động lại/);assert.equal(calls,1);assert.equal(f.starts(),1);assert.equal(f.login.controller,null);
});
test('persistent network failure has a finite retry budget and consent denial is never retried',async()=>{
 let calls=0;const f=fixture(async()=>{calls++;throw Error('offline');});await assert.rejects(f.login.login('https://meta.example.com/'),/sau 4 lần thử/);assert.equal(calls,5);assert.equal(f.opens(),1);
 calls=0;const denied=fixture(async()=>{calls++;return Response.json({status:'error',errorCode:'CONSENT_DENIED'});});await assert.rejects(denied.login.login('https://meta.example.com/'),/chưa cấp quyền/);assert.equal(calls,1);
});
test('cancel during a retry stops the login and does not issue another poll',async()=>{
 let calls=0;const f=fixture(async()=>{calls++;throw Error('offline');});f.login.wait=async()=>f.login.cancel();await assert.rejects(f.login.login('https://meta.example.com/'),{name:'AbortError'});assert.equal(calls,1);assert.equal(f.login.controller,null);
});
