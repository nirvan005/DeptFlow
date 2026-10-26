import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,dirname,basename } from 'node:path';
import { spawn } from 'node:child_process';

test('records, workflow history, and signed sessions persist across an actual server restart',async t => {
  const directory = mkdtempSync(join(tmpdir(),'deptflow-persistence-'));
  let child,baseURL,logs='';
  async function start() {
    child = spawn(process.execPath,['server/src/index.js'],{cwd:new URL('../../',import.meta.url),env:{...process.env,PORT:'0',DATABASE_PATH:join(directory,'qa.sqlite'),SESSION_SECRET:'stable-test-secret-across-server-restarts',COOKIE_SECURE:'false'},windowsHide:true,stdio:['ignore','pipe','pipe']});
    // Index prints its actual bound port when PORT=0.
    const url = await new Promise((resolve,reject) => {
      const timeout = setTimeout(() => reject(new Error(`Server startup timed out: ${logs}`)),10000);
      child.stdout.on('data',chunk => {logs+=chunk;const match = String(chunk).match(/http:\/\/127\.0\.0\.1:(\d+)/);if (match) {clearTimeout(timeout);resolve(match[0]);}});
      child.stderr.on('data',chunk => {logs+=chunk;});
      child.once('error',e => {clearTimeout(timeout);reject(e);});
      child.once('exit',code => {clearTimeout(timeout);reject(new Error(`Server exited: ${code}. ${logs}`));});
    });
    baseURL=url;
  }
  async function stop() {
    if (!child || child.exitCode !== null) return;
    await new Promise(resolve => {child.once('exit',resolve);child.kill();});
  }
  t.after(async () => {
    await stop();
    if (dirname(directory) === tmpdir() && basename(directory).startsWith('deptflow-persistence-')) rmSync(directory,{recursive:true,force:true});
  });
  await start();
  const logged = await fetch(`${baseURL}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'ananya@deptflow.edu',password:'Demo@123'})});
  assert.equal(logged.status,200);const cookie = logged.headers.get('set-cookie').split(';')[0];
  const response = await fetch(`${baseURL}/api/activities`,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({title:'Restart persistence check',category:'ACADEMIC_EVENT',start_date:'2026-11-20',end_date:'2026-11-20',description:'A test event that must survive a server process restart.'})});
  assert.equal(response.status,201);const record = await response.json();
  await stop();await start();
  const restored = await fetch(`${baseURL}/api/auth/me`,{headers:{Cookie:cookie}});assert.equal(restored.status,200);assert.equal((await restored.json()).name,'Ananya Sharma');
  const detail = await fetch(`${baseURL}/api/activities/${record.id}`,{headers:{Cookie:cookie}});assert.equal(detail.status,200);const data = await detail.json();
  assert.equal(data.title,'Restart persistence check');assert.equal(data.status,'PENDING_FACULTY');assert.equal(data.events.length,1);
});
