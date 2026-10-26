import session from 'express-session';
export class SQLiteSessionStore extends session.Store {
  constructor(db) { super(); this.db = db; }
  get(sid, callback) {
    try {
      const row = this.db.prepare('SELECT data FROM sessions WHERE sid=? AND expires>?').get(sid,Date.now());
      callback(null,row ? JSON.parse(row.data) : null);
    } catch (error) { callback(error); }
  }
  set(sid, value, callback = () => {}) {
    try {
      const expires = value.cookie.expires ? new Date(value.cookie.expires).getTime() : Date.now()+28800000;
      this.db.prepare('INSERT INTO sessions VALUES (?,?,?) ON CONFLICT(sid) DO UPDATE SET data=excluded.data,expires=excluded.expires').run(sid,JSON.stringify(value),expires);
      this.db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
      callback();
    } catch (error) { callback(error); }
  }
  destroy(sid,callback = () => {}) {
    try { this.db.prepare('DELETE FROM sessions WHERE sid=?').run(sid); callback(); } catch(error) { callback(error); }
  }
  touch(sid,value,callback) { this.set(sid,value,callback); }
}
