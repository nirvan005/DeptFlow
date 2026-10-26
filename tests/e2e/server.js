import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { openDatabase } from '../../server/src/db/database.js';
import { seedDatabase } from '../../server/src/db/seed.js';
import { createApp } from '../../server/src/app.js';

// Browser journeys never use the user's demo database or running development server.
const directory = mkdtempSync(join(tmpdir(),'deptflow-browser-'));
const db = openDatabase(join(directory,'qa.sqlite'));
seedDatabase(db);
const server = createApp(db,{sessionSecret:'isolated-browser-test-session-secret'}).listen(3107,'127.0.0.1');
function cleanup() {
  db.close();
  if (dirname(directory) === tmpdir() && basename(directory).startsWith('deptflow-browser-')) rmSync(directory,{recursive:true,force:true});
}
process.once('exit',cleanup);
for (const signal of ['SIGINT','SIGTERM']) process.once(signal,() => server.close(() => process.exit(0)));
