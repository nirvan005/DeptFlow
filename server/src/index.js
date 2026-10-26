import './config.js';
import { openDatabase } from './db/database.js';
import { seedDatabase } from './db/seed.js';
import { createApp } from './app.js';
const db = openDatabase();
seedDatabase(db);
const port = Number(process.env.PORT || 3001);
const server = createApp(db).listen(port,'127.0.0.1',() => console.log(`DeptFlow API: http://127.0.0.1:${server.address().port}`));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,() => server.close(() => {db.close(); process.exit(0);}));
