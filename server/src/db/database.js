import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const defaultPath = fileURLToPath(new URL('../../data/deptflow.sqlite', import.meta.url));
export function openDatabase(path = process.env.DATABASE_PATH || defaultPath) {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), {recursive: true});
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  db.transaction = callback => {
    const run = (...args) => {
      db.exec('BEGIN IMMEDIATE');
      try { const result = callback(...args); db.exec('COMMIT'); return result; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    };
    run.immediate = run;
    return run;
  };
  db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  return db;
}
