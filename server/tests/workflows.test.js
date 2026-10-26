import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { openDatabase } from '../src/db/database.js';
import { seedDatabase } from '../src/db/seed.js';
import { createApp } from '../src/app.js';

function setup(t) {
  const db = openDatabase(':memory:');
  seedDatabase(db);
  const app = createApp(db,{sessionSecret:'test-secret-for-isolated-lab-tests'});
  t.after(() => db.close());
  return {db,app,login:async email => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({email:`${email}@deptflow.edu`,password:'Demo@123'}).expect(200);
    return agent;
  }};
}
const activity = {title:'Accessible web workshop',category:'SEMINAR_WORKSHOP',start_date:'2026-11-02',end_date:'2026-11-03',description:'Attend a practical workshop on designing accessible web applications.'};
const decision = (status,value = 'APPROVE') => ({decision:value,expected_status:status,comment:'Reviewed and recorded for this demonstration.'});
const academic = {type:'NOTICE',title:'UG semester seven update',body:'A sample announcement for the eligible undergraduate cohort.',programme_audience:'UG',semester:7,admission_batch:2023,academic_year:'2026-27',start_date:null,end_date:null,reference_url:null,status:'DRAFT'};

test('session login, restoration, invalid password and logout',async t => {
  const {app,login} = setup(t);
  await request(app).get('/api/dashboard').expect(401);
  await request(app).post('/api/auth/login').send({email:'ananya@deptflow.edu',password:'wrong'}).expect(401);
  const student = await login('ananya');
  const me = await student.get('/api/auth/me').expect(200);
  assert.equal(me.body.name,'Ananya Sharma'); assert.equal(me.body.password_hash,undefined);
  await student.post('/api/auth/logout').expect(200);
  await student.get('/api/auth/me').expect(401);
});
test('activity completes both approval stages atomically with history and stale-decision protection',async t => {
  const {db,login} = setup(t), student = await login('ananya'),faculty = await login('aarav'),hod = await login('hod');
  const created = await student.post('/api/activities').send(activity).expect(201),id = created.body.id;
  await hod.post(`/api/activities/${id}/decision`).send(decision('PENDING_FACULTY')).expect(409);
  await student.post(`/api/activities/${id}/decision`).send(decision('PENDING_FACULTY')).expect(403);
  await faculty.post(`/api/activities/${id}/decision`).send(decision('PENDING_FACULTY')).expect(200);
  await faculty.post(`/api/activities/${id}/decision`).send(decision('PENDING_FACULTY')).expect(409);
  const result = await hod.post(`/api/activities/${id}/decision`).send(decision('PENDING_HOD')).expect(200);
  assert.equal(result.body.status,'APPROVED');assert.equal(result.body.events.length,3);
  assert.equal(db.prepare('SELECT count(*) AS n FROM workflow_events WHERE activity_request_id=?').get(id).n,3);
  const dashboard = await student.get('/api/dashboard').expect(200);
  assert.equal(dashboard.body.recent.find(r => r.kind === 'activity' && r.id === id).category,'SEMINAR_WORKSHOP');
});
test('faculty ownership, student profile privacy and guide-only access are enforced',async t => {
  const {login} = setup(t),student = await login('ananya'),faculty = await login('rohan'),otherFaculty = await login('aarav');
  await student.get('/api/students/6').expect(403);
  await student.get('/api/faculty').expect(403);
  await otherFaculty.get('/api/activities/2').expect(403);
  const profile = await faculty.get('/api/students/7').expect(200);
  assert.equal(profile.body.scope,'PROJECT_ONLY');assert.deepEqual(profile.body.activities,[]);assert.equal(profile.body.applications.length,1);
  await faculty.get('/api/activities/2').expect(403);
  const students = await otherFaculty.get('/api/students').expect(200);
  assert.deepEqual(students.body.map(s => s.id).sort(),[5,6]);
  const directory = await student.get('/api/students').expect(403);
  assert.ok(directory.body.message);
});
test('project request, guide recommendation and final allocation update capacity',async t => {
  const {login} = setup(t),student = await login('ananya'),guide = await login('aarav'),hod = await login('hod');
  const created = await student.post('/api/projects/1/requests').send({statement:'I would like to build accessible and useful student-facing software.'}).expect(201);
  await student.post('/api/projects/5/requests').send({statement:'Another application should not be allowed while one is active.'}).expect(409);
  await guide.post(`/api/project-requests/${created.body.id}/decision`).send(decision('PENDING_GUIDE')).expect(200);
  const allocated = await hod.post(`/api/project-requests/${created.body.id}/decision`).send(decision('PENDING_HOD')).expect(200);
  assert.equal(allocated.body.status,'ALLOCATED');
  const rows = await student.get('/api/allocations').expect(200);assert.equal(rows.body.length,1);
  const catalogue = await student.get('/api/projects').expect(200);assert.equal(catalogue.body.find(p => p.id === 1).available,2);
});
test('competing final confirmations cannot allocate the last seat twice',async t => {
  const {db,login} = setup(t),student = await login('sana'),neel = await login('neel'),guide = await login('rohan'),hod = await login('hod');
  const make = async agent => {
    const r = await agent.post('/api/projects/6/requests').send({statement:'I want to explore distributed systems reliability through simulation.'}).expect(201);
    await guide.post(`/api/project-requests/${r.body.id}/decision`).send(decision('PENDING_GUIDE')).expect(200);
    return r.body.id;
  };
  const first = await make(student),second = await make(neel);
  const result = await Promise.all([first,second].map(id => hod.post(`/api/project-requests/${id}/decision`).send(decision('PENDING_HOD'))));
  assert.deepEqual(result.map(r => r.status).sort(),[200,409]);
  assert.equal(db.prepare('SELECT count(*) AS n FROM allocations WHERE project_id=6').get().n,1);
  assert.equal(db.prepare("SELECT count(*) AS n FROM project_requests WHERE project_id=6 AND status='PENDING_HOD'").get().n,1);
});
test('rejection is terminal and permits a fresh application; eligibility and full projects are checked',async t => {
  const {login} = setup(t),student = await login('ananya'),guide = await login('aarav');
  await student.post('/api/projects/2/requests').send({statement:'This project belongs to a different programme and is ineligible.'}).expect(403);
  await student.post('/api/projects/4/requests').send({statement:'This project is already full and should not accept applications.'}).expect(409);
  const r = await student.post('/api/projects/1/requests').send({statement:'I would like to contribute to an accessible campus application.'}).expect(201);
  await guide.post(`/api/project-requests/${r.body.id}/decision`).send(decision('PENDING_GUIDE','REJECT')).expect(200);
  await guide.post(`/api/project-requests/${r.body.id}/decision`).send(decision('REJECTED')).expect(409);
  await student.post('/api/projects/5/requests').send({statement:'I have revised my interests and would like to explore search.'}).expect(201);
});
test('academic publishing states and programme/semester/batch audiences cannot be bypassed',async t => {
  const {login} = setup(t),hod = await login('hod'),ug = await login('ananya'),pg = await login('neel'),otherBatch = await login('diya'),faculty = await login('aarav');
  const created = await hod.post('/api/academic-items').send(academic).expect(201),id = created.body.id;
  await ug.get(`/api/academic-items/${id}`).expect(404);
  await faculty.patch(`/api/academic-items/${id}`).send({...academic,status:'PUBLISHED'}).expect(403);
  await hod.patch(`/api/academic-items/${id}`).send({...academic,status:'PUBLISHED'}).expect(200);
  await ug.get(`/api/academic-items/${id}`).expect(200);
  await pg.get(`/api/academic-items/${id}`).expect(404);
  await otherBatch.get(`/api/academic-items/${id}`).expect(404);
  const bypass = await pg.get('/api/academic-items?programme=UG&semester=7&status=PUBLISHED').expect(200);
  assert.ok(!bypass.body.some(i => i.id === id));
  await hod.patch(`/api/academic-items/${id}`).send({...academic,status:'ARCHIVED'}).expect(200);
  await ug.get(`/api/academic-items/${id}`).expect(404);
});
test('input, origin and project editing rules reject invalid changes',async t => {
  const {login} = setup(t),student = await login('ananya'),faculty = await login('rohan'),hod = await login('hod');
  await student.post('/api/activities').send({...activity,end_date:'2026-10-01'}).expect(400);
  await student.post('/api/activities').send({...activity,start_date:'2026-02-30'}).expect(400);
  await student.post('/api/activities').set('Origin','https://unrelated.example').send(activity).expect(403);
  const p = (await hod.get('/api/projects')).body.find(p => p.id === 4);
  const body = {title:p.title,description:p.description,programme_eligibility:p.programme_eligibility,capacity:1,is_active:true,guide_id:p.guide_id};
  await faculty.patch('/api/projects/4').send(body).expect(403);
  await hod.patch('/api/projects/4').send({...body,capacity:0}).expect(400);
  await hod.post('/api/academic-items').send({...academic,type:'SYLLABUS',reference_url:'javascript:alert(1)'}).expect(400);
  await hod.post('/api/academic-items').send({...academic,type:'ACADEMIC_DATE'}).expect(400);
});

test('offering edits preserve occupancy, pending applications, eligibility, and guide ownership',async t => {
  const {login} = setup(t),hod = await login('hod'),student = await login('ananya'),guide = await login('aarav');
  let result = await hod.post('/api/projects').send({title:'Two student capacity check',description:'A project offering used to verify safe editing around pending and confirmed students.',programme_eligibility:'UG',capacity:2,is_active:true,guide_id:2}).expect(201);
  const projectId = result.body.id;
  const body = {title:result.body.title,description:result.body.description,programme_eligibility:'UG',capacity:2,is_active:true,guide_id:2};
  const r = await student.post(`/api/projects/${projectId}/requests`).send({statement:'A meaningful proposal for a safe capacity editing check.'}).expect(201);
  await hod.patch(`/api/projects/${projectId}`).send({...body,is_active:false}).expect(409);
  await hod.patch(`/api/projects/${projectId}`).send({...body,programme_eligibility:'PG'}).expect(409);
  await guide.post(`/api/project-requests/${r.body.id}/decision`).send(decision('PENDING_GUIDE')).expect(200);
  await hod.post(`/api/project-requests/${r.body.id}/decision`).send(decision('PENDING_HOD')).expect(200);
  const secondStudent = await login('diya');
  // Diya already has an active application; reject it through its actual guide first.
  const otherGuide = await login('rohan');
  await otherGuide.post('/api/project-requests/2/decision').send(decision('PENDING_GUIDE','REJECT')).expect(200);
  const second = await secondStudent.post(`/api/projects/${projectId}/requests`).send({statement:'Another student joins the offering to fill the second seat.'}).expect(201);
  await guide.post(`/api/project-requests/${second.body.id}/decision`).send(decision('PENDING_GUIDE')).expect(200);
  await hod.post(`/api/project-requests/${second.body.id}/decision`).send(decision('PENDING_HOD')).expect(200);
  await hod.patch(`/api/projects/${projectId}`).send({...body,capacity:1}).expect(409);
  const updated = await hod.patch(`/api/projects/${projectId}`).send({...body,title:'Updated valid project title',capacity:3}).expect(200);
  assert.equal(updated.body.occupied,2);assert.equal(updated.body.available,1);
});

test('repeated project decisions and duplicate concurrent applications never create extra events or allocations',async t => {
  const {db,login} = setup(t),student = await login('ananya'),guide = await login('aarav'),hod = await login('hod');
  const submissions = await Promise.all([1,5].map(id => student.post(`/api/projects/${id}/requests`).send({statement:'A concurrent proposal that should create only one active request.'})));
  assert.deepEqual(submissions.map(r => r.status).sort(),[201,409]);
  const created = submissions.find(r => r.status === 201).body;
  const reviewer = created.guide_id === 2 ? guide : await login('kavya');
  await reviewer.post(`/api/project-requests/${created.id}/decision`).send(decision('PENDING_GUIDE')).expect(200);
  await hod.post(`/api/project-requests/${created.id}/decision`).send(decision('PENDING_HOD')).expect(200);
  await hod.post(`/api/project-requests/${created.id}/decision`).send(decision('PENDING_HOD')).expect(409);
  assert.equal(db.prepare('SELECT count(*) AS n FROM allocations WHERE student_id=5').get().n,1);
  assert.equal(db.prepare('SELECT count(*) AS n FROM workflow_events WHERE project_request_id=?').get(created.id).n,3);
});
