/* CI-only: select an available older installer so an upgrade is actually tested. */
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process'),{newer}=require('../desktop/updater.cjs');
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Run this helper only in GitHub Actions.');
const repo=process.env.GITHUB_REPOSITORY;if(!/^[\w.-]+\/[\w.-]+$/.test(repo||''))throw Error('Invalid repository.');
const version=require('../package.json').version,api=route=>JSON.parse(execFileSync('gh',['api',route],{encoding:'utf8',maxBuffer:8*1024*1024}));
const runs=api(`repos/${repo}/actions/workflows/windows-desktop.yml/runs?branch=main&status=success&per_page=30`).workflow_runs;
let found;
for(const run of runs){
 if(!/^[a-f0-9]{40}$/.test(run.head_sha))continue;
 const pkg=api(`repos/${repo}/contents/package.json?ref=${run.head_sha}`),old=JSON.parse(Buffer.from(pkg.content,'base64').toString());if(!newer(version,old.version))continue;
 const artifact=api(`repos/${repo}/actions/runs/${run.id}/artifacts`).artifacts.find(a=>a.name==='MooZ-App-Windows-x64'&&!a.expired);if(!artifact)continue;
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'mooz-baseline-'));execFileSync('gh',['run','download',String(run.id),'-R',repo,'-n',artifact.name,'-D',folder],{stdio:'inherit'});
 const files=fs.readdirSync(folder).filter(f=>f.endsWith('.exe'));if(files.length!==1)throw Error('Expected one baseline installer.');found={installer:path.join(folder,files[0]),version:old.version,run:run.id,source:run.head_sha};break;
}
if(!found)throw Error('No available older Windows installer: an actual version upgrade cannot be certified.');
if(/[\r\n]/.test(found.installer))throw Error('Invalid temporary path.');fs.appendFileSync(process.env.GITHUB_ENV,'MOOZ_WINDOWS_BASELINE='+found.installer+'\n');
console.log(`Baseline for upgrade: ${found.version}, run ${found.run}, source ${found.source}`);
