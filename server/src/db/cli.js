import '../config.js';
import { resolve } from 'node:path';
import { openDatabase, defaultPath } from './database.js';
import { seedDatabase } from './seed.js';
const reset = process.argv.includes('--reset-demo');
if (reset && process.env.DATABASE_PATH && resolve(process.env.DATABASE_PATH) !== resolve(defaultPath)) {
  throw new Error('Reset is restricted to server/data/deptflow.sqlite. Remove DATABASE_PATH to reset the local demo.');
}
const db = openDatabase();
if (reset) db.transaction(() => {
  for (const table of ['sessions','workflow_events','allocations','project_requests','activity_requests','academic_items','projects']) db.exec(`DELETE FROM ${table}`);
  db.exec("DELETE FROM users WHERE role='STUDENT'");
  db.exec('DELETE FROM users');
})();
console.log(seedDatabase(db) ? 'Demo data created. Password for all demo accounts: Demo@123' : 'Database already seeded; existing records preserved.');
db.close();
