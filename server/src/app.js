import express from 'express';
import session from 'express-session';
import { compareSync } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SQLiteSessionStore } from './middleware/session-store.js';
import { createDomain, fail, publicUser } from './services/domain.js';
import { loginSchema,activitySchema,decisionSchema,applicationSchema,projectSchema,academicSchema } from './services/validation.js';

export function createApp(db,{sessionSecret = process.env.SESSION_SECRET || randomBytes(32).toString('hex')} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({limit:'32kb'}));
  app.use((req,res,next) => {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','same-origin');
    res.setHeader('X-Frame-Options','DENY');
    if (req.path.startsWith('/api')) res.setHeader('Cache-Control','no-store');
    if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.headers.origin) {
      let host;
      try { host = new URL(req.headers.origin).host; } catch { return next(Object.assign(new Error('Invalid request origin.'),{status:403})); }
      // Vite's development proxy retains the browser's original host in X-Forwarded-Host.
      if (host !== req.get('host') && host !== req.get('x-forwarded-host')) return next(Object.assign(new Error('Cross-origin changes are not allowed.'),{status:403}));
    }
    next();
  });
  app.use(session({name:'deptflow.sid',secret:sessionSecret,resave:false,saveUninitialized:false,store:new SQLiteSessionStore(db),cookie:{httpOnly:true,sameSite:'lax',secure:process.env.COOKIE_SECURE === 'true',maxAge:8*60*60*1000}}));
  const domain = createDomain(db);
  app.get('/api/health',(_req,res) => res.json({status:'ok'}));
  app.post('/api/auth/login',(req,res,next) => {
    const data = loginSchema.parse(req.body);
    const row = db.prepare('SELECT * FROM users WHERE email=? COLLATE NOCASE').get(data.email);
    if (!row || !compareSync(data.password,row.password_hash)) fail(401,'Email or password is incorrect.');
    req.session.regenerate(error => {
      if (error) return next(error);
      req.session.userId = row.id;
      req.session.save(error => error ? next(error) : res.json(publicUser(row)));
    });
  });
  app.use('/api',(req,_res,next) => {
    req.user = publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.session.userId || -1));
    if (!req.user) fail(401,'Please sign in to continue.');
    next();
  });
  app.get('/api/auth/me',(req,res) => res.json(req.user));
  app.post('/api/auth/logout',(req,res,next) => req.session.destroy(error => {
    if (error) return next(error);
    res.clearCookie('deptflow.sid'); res.json({success:true});
  }));
  const filter = (rows,query) => rows.filter(r => {
    const q = String(query.q || '').toLowerCase();
    return (!q || [r.title,r.name,r.student_name,r.student_number,r.guide_name,r.body].some(v => String(v || '').toLowerCase().includes(q))) && ['status','programme','category','type','academic_year','current_semester','admission_batch','advisor_id','guide_id','project_id'].every(key => !query[key] || String(r[key]) === String(query[key]));
  });
  app.get('/api/dashboard',(req,res) => res.json(domain.dashboard(req.user)));
  app.get('/api/activities',(req,res) => res.json(filter(domain.activities(req.user),req.query)));
  app.post('/api/activities',(req,res) => res.status(201).json(domain.submitActivity(req.user,activitySchema.parse(req.body))));
  app.get('/api/activities/:id',(req,res) => res.json(domain.getActivity(req.user,req.params.id)));
  app.post('/api/activities/:id/decision',(req,res) => res.json(domain.decide(req.user,'activity',req.params.id,decisionSchema.parse(req.body))));
  app.get('/api/projects',(req,res) => {
    let rows = domain.projects(req.user);
    if (req.query.programme) rows = rows.filter(p => [req.query.programme,'BOTH'].includes(p.programme_eligibility));
    res.json(filter(rows, {...req.query,programme:undefined}));
  });
  app.get('/api/project-guides',(_req,res) => res.json(db.prepare("SELECT id,name,email FROM users WHERE role='FACULTY' ORDER BY name").all()));
  app.post('/api/projects',(req,res) => res.status(201).json(domain.saveProject(req.user,projectSchema.parse(req.body))));
  app.patch('/api/projects/:id',(req,res) => res.json(domain.saveProject(req.user,projectSchema.parse(req.body),req.params.id)));
  app.post('/api/projects/:id/requests',(req,res) => res.status(201).json(domain.apply(req.user,req.params.id,applicationSchema.parse(req.body).statement)));
  app.get('/api/project-requests',(req,res) => res.json(filter(domain.applications(req.user),req.query)));
  app.get('/api/project-requests/:id',(req,res) => res.json(domain.getApplication(req.user,req.params.id)));
  app.post('/api/project-requests/:id/decision',(req,res) => res.json(domain.decide(req.user,'project',req.params.id,decisionSchema.parse(req.body))));
  app.get('/api/allocations',(req,res) => res.json(filter(domain.allocations(req.user),req.query)));
  app.get('/api/reviews',(req,res) => res.json(filter(domain.reviews(req.user),req.query)));
  app.get('/api/students',(req,res) => {
    let rows = filter(domain.students(req.user,req.query.relationship),req.query);
    if (req.query.project_status) rows = rows.filter(r => r.project_status === req.query.project_status);
    res.json(rows);
  });
  app.get('/api/students/:id',(req,res) => res.json(domain.studentProfile(req.user,req.params.id)));
  app.get('/api/faculty',(req,res) => res.json(domain.faculty(req.user)));
  app.get('/api/academic-items',(req,res) => {
    let rows = domain.academicItems(req.user);
    if (req.query.programme) rows = rows.filter(i => [req.query.programme,'BOTH'].includes(i.programme_audience));
    if (req.query.semester) rows = rows.filter(i => i.semester === Number(req.query.semester));
    res.json(filter(rows,{...req.query,programme:undefined}));
  });
  app.get('/api/academic-items/:id',(req,res) => {
    const row = domain.academicItems(req.user).find(i => i.id === Number(req.params.id));
    if (!row) fail(404,'Academic item not found or not available to your audience.');
    res.json(row);
  });
  app.post('/api/academic-items',(req,res) => res.status(201).json(domain.saveAcademic(req.user,academicSchema.parse(req.body))));
  app.patch('/api/academic-items/:id',(req,res) => res.json(domain.saveAcademic(req.user,academicSchema.parse(req.body),req.params.id)));
  app.use('/api',(_req,res) => res.status(404).json({message:'API route not found.'}));
  const dist = fileURLToPath(new URL('../../client/dist',import.meta.url));
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get('/{*path}',(_req,res) => res.sendFile(`${dist}/index.html`));
  }
  app.use((error,_req,res,_next) => {
    if (error.name === 'ZodError') return res.status(400).json({message:error.issues[0]?.message || 'Please check the form.',fields:Object.fromEntries(error.issues.map(i => [i.path.join('.'),i.message]))});
    if (error.code?.startsWith('SQLITE_CONSTRAINT')) return res.status(409).json({message:'This change conflicts with an existing record. Refresh and try again.'});
    if (!error.status) console.error(error);
    res.status(error.status || 500).json({message:error.status ? error.message : 'Something went wrong. Please try again.'});
  });
  return app;
}
