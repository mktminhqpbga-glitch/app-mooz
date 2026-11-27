import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const host = '127.0.0.1';

function json(res, status, data) {
  res.writeHead(status, {'content-type':'application/json'});
  res.end(JSON.stringify(data));
}
async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, host, resolve);
  });
  return server.address().port;
}
async function availablePort() {
  const probe = http.createServer();
  const port = await listen(probe);
  await new Promise(resolve => probe.close(resolve));
  return port;
}

test('local AI/Meta settings, safe status, Meta report and read-only API checks', async t => {
  const temp = await mkdtemp(join(tmpdir(), 'mooz-connections-'));
  await mkdir(join(temp, 'data'));
  await writeFile(join(temp, 'package.json'), '{"type":"module"}');
  await copyFile(join(root, 'server.js'), join(temp, 'server.js'));
  const metaCalls = [];
  const meta = http.createServer((req, res) => {
    metaCalls.push({url:req.url, authorization:req.headers.authorization});
    if (req.headers.authorization !== 'Bearer meta-test-key') return json(res, 401, {error:'bad key'});
    if (req.url.startsWith('/v27.0/me?')) return json(res,200,{id:'111',name:'Test User'});
    if (req.url.startsWith('/v27.0/act_1234567890?')) return json(res,200,{id:'act_1234567890',name:'Test account',account_status:1});
    if (req.url.startsWith('/v27.0/act_1234567890/insights?')) return json(res,200,{data:[{
      campaign_id:'c-real',campaign_name:'Real Campaign',spend:'125000',ctr:'1.80',cpm:'25000',
      frequency:'1.42',impressions:'5000',clicks:'90'
    }]});
    return json(res,404,{error:'bad path'});
  });
  const ai = http.createServer((req, res) => {
    if (req.headers.authorization !== 'Bearer ai-test-key') return json(res,401,{error:'bad key'});
    if (req.url === '/v1/models') return json(res,200,{data:[{id:'test-model'}]});
    if (req.url === '/v1/chat/completions') return json(res,200,{choices:[{message:{content:'Xin chào'}}]});
    return json(res,404,{error:'bad path'});
  });
  const metaPort = await listen(meta);
  const aiPort = await listen(ai);
  const port = await availablePort();
  let logs = '';
  const child = spawn(process.execPath, ['server.js'], {
    cwd:temp,
    env:{ ...process.env, PORT:String(port), NODE_ENV:'test',
      MOOZ_TEST_META_GRAPH_ORIGIN:'http://' + host + ':' + metaPort,
      AI_API_KEY:'', META_ACCESS_TOKEN:'' },
    stdio:['ignore','pipe','pipe']
  });
  child.stdout.on('data', chunk => { logs += chunk.toString(); });
  child.stderr.on('data', chunk => { logs += chunk.toString(); });
  t.after(async () => {
    child.kill('SIGTERM');
    await new Promise(resolve => {
      if (child.exitCode !== null || child.signalCode !== null) return resolve();
      child.once('exit',resolve);
    });
    await Promise.all([new Promise(resolve => meta.close(resolve)), new Promise(resolve => ai.close(resolve))]);
    await rm(temp,{recursive:true,force:true});
  });
  const base = 'http://' + host + ':' + port;
  let started = false;
  for (let i=0; i<100; i++) {
    try {
      const response = await fetch(base + '/api/state');
      if (response.ok) {started=true;break;}
    } catch {}
    if (child.exitCode !== null) break;
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  assert.equal(started,true,'Mooz test server starts');
  const call = async (path, method='GET', payload, headers={}) => fetch(base+path,{
    method,headers:{...headers,...(payload ? {'content-type':'application/json'} : {})},
    body:payload ? JSON.stringify(payload) : undefined
  });
  let response = await call('/api/meta/report','POST');
  assert.equal(response.status,400);
  response = await call('/api/connections','PUT',{
    aiBaseUrl:'http://' + host + ':' + aiPort + '/v1/',
    aiModel:'test-model',aiApiKey:'ai-test-key',
    metaAccountId:'1234567890',metaAccessToken:'meta-test-key'
  });
  assert.equal(response.status,200);
  const config = await response.json();
  assert.equal(config.aiConfigured,true);
  assert.equal(config.metaConfigured,true);
  assert.equal(config.metaAccountId,'act_1234567890');
  assert.equal(JSON.stringify(config).includes('test-key'),false);
  assert.equal((await stat(join(temp,'data','connections.json'))).mode & 0o777,0o600);
  assert.equal((await call('/api/connections/test','POST',{kind:'meta'})).status,200);
  assert.equal((await call('/api/connections/test','POST',{kind:'ai'})).status,200);
  response = await call('/api/ai','POST',{prompt:'Bạn tư vấn giúp'});
  assert.equal(response.status,200);
  assert.equal((await response.json()).reply,'Xin chào');
  response = await call('/api/meta/report','POST');
  assert.equal(response.status,200);
  const report = await response.json();
  assert.equal(report.campaigns.length,1);
  assert.equal(report.campaigns[0].name,'Real Campaign');
  assert.equal(report.campaigns[0].spend,125000);
  const state = await (await call('/api/state')).json();
  assert.equal(state.campaigns[0].id,'c1','existing demo data is not replaced');
  assert.equal(state.metaReport.source,'meta');
  assert.equal(state.connections.meta,true);
  assert.equal(JSON.stringify(state).includes('test-key'),false);
  assert.equal(metaCalls.length,3);
  assert.equal(metaCalls.every(entry => entry.authorization==='Bearer meta-test-key'),true);
  assert.equal(metaCalls.some(entry => entry.url.includes('access_token')),false);
  response = await call('/api/connections','PUT',{aiBaseUrl:'https://good.example/v1/',aiApiKey:''});
  assert.equal(response.status,200);
  const safe = await (await call('/api/connections')).json();
  assert.equal(safe.aiKeyPresent,true,'empty key preserves previous key');
  response = await call('/api/connections','PUT',{aiBaseUrl:'http://example.net/v1'});
  assert.equal(response.status,400);
  response = await call('/api/meta/report','POST',undefined,{origin:'https://external.example'});
  assert.equal(response.status,403);
  assert.equal(logs.includes('ai-test-key') || logs.includes('meta-test-key'),false);
  assert.ok((await readFile(join(temp,'data','store.json'),'utf8')).includes('"metaReport"'));
});
