export const now = () => new Date().toISOString();
export function fail(status, message) { throw Object.assign(new Error(message), {status}); }
export function requireRole(user, ...roles) { if (!roles.includes(user.role)) fail(403,'You do not have permission to perform this action.'); }
export function publicUser(row) {
  if (!row) return null;
  const {password_hash, ...user} = row;
  return user;
}
export function createDomain(db) {
  const allActivities = () => db.prepare(`SELECT a.*,u.name AS student_name,u.programme,u.student_number,u.current_semester,u.admission_batch,f.name AS advisor_name FROM activity_requests a JOIN users u ON u.id=a.student_id JOIN users f ON f.id=a.advisor_id ORDER BY a.created_at DESC,a.id DESC`).all();
  const allProjects = () => db.prepare(`SELECT p.*,u.name AS guide_name,(SELECT count(*) FROM allocations a WHERE a.project_id=p.id) AS occupied FROM projects p JOIN users u ON u.id=p.guide_id ORDER BY p.id`).all().map(p => ({...p,available:p.capacity-p.occupied}));
  const allApplications = () => db.prepare(`SELECT r.*,p.title,p.description,p.guide_id,p.programme_eligibility,u.name AS student_name,u.programme,u.student_number,g.name AS guide_name FROM project_requests r JOIN projects p ON p.id=r.project_id JOIN users u ON u.id=r.student_id JOIN users g ON g.id=p.guide_id ORDER BY r.created_at DESC,r.id DESC`).all();
  const activityAccess = (u,r) => u.role === 'HOD' || (u.role === 'STUDENT' ? r.student_id === u.id : r.advisor_id === u.id);
  const applicationAccess = (u,r) => u.role === 'HOD' || (u.role === 'STUDENT' ? r.student_id === u.id : r.guide_id === u.id);
  const activities = u => allActivities().filter(r => activityAccess(u,r));
  const applications = u => allApplications().filter(r => applicationAccess(u,r));
  const projects = u => allProjects().filter(p => u.role !== 'STUDENT' || (p.is_active && [u.programme,'BOTH'].includes(p.programme_eligibility)));
  const events = (type,id) => db.prepare(`SELECT e.*,u.name AS actor_name,u.role AS actor_role FROM workflow_events e JOIN users u ON u.id=e.actor_id WHERE ${type === 'activity' ? 'activity_request_id' : 'project_request_id'}=? ORDER BY e.created_at,e.id`).all(id);
  function getActivity(u,id) {
    const row = allActivities().find(r => r.id === Number(id));
    if (!row) fail(404,'Activity request not found.');
    if (!activityAccess(u,row)) fail(403,'This activity request is not assigned to you.');
    return {...row,events:events('activity',row.id)};
  }
  function getApplication(u,id) {
    const row = allApplications().find(r => r.id === Number(id));
    if (!row) fail(404,'Project application not found.');
    if (!applicationAccess(u,row)) fail(403,'You cannot view this application.');
    return {...row,events:events('project',row.id)};
  }
  function addEvent(type,id,user,action,from,to,comment,time = now()) {
    db.prepare('INSERT INTO workflow_events (activity_request_id,project_request_id,actor_id,action,from_status,to_status,comment,created_at) VALUES (?,?,?,?,?,?,?,?)').run(type === 'activity' ? id : null,type === 'project' ? id : null,user.id,action,from,to,comment,time);
  }
  function submitActivity(user,data) {
    requireRole(user,'STUDENT');
    return db.transaction(() => {
      const time = now();
      const {lastInsertRowid:id} = db.prepare('INSERT INTO activity_requests (student_id,advisor_id,title,category,start_date,end_date,description,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run(user.id,user.advisor_id,data.title,data.category,data.start_date,data.end_date,data.description,'PENDING_FACULTY',time,time);
      addEvent('activity',id,user,'SUBMITTED',null,'PENDING_FACULTY','Submitted for faculty review.',time);
      return getActivity(user,id);
    })();
  }
  function decide(user,type,id,{decision,comment,expected_status}) {
    requireRole(user,'FACULTY','HOD');
    return db.transaction(() => {
      const isActivity = type === 'activity';
      const row = isActivity ? getActivity(user,id) : getApplication(user,id);
      if (row.status !== expected_status) fail(409,'This request has changed. Refresh before making a decision.');
      const first = isActivity ? 'PENDING_FACULTY' : 'PENDING_GUIDE';
      if (![first,'PENDING_HOD'].includes(row.status)) fail(409,'This request has already been resolved.');
      if (user.role === 'FACULTY' && row.status !== first) fail(403,'This request is awaiting the HOD’s decision.');
      if (user.role === 'HOD' && row.status !== 'PENDING_HOD') fail(409,'Faculty review must be completed first.');
      let next = decision === 'REJECT' ? 'REJECTED' : row.status === first ? 'PENDING_HOD' : isActivity ? 'APPROVED' : 'ALLOCATED';
      if (next === 'ALLOCATED') {
        const project = allProjects().find(p => p.id === row.project_id);
        if (!project.is_active) fail(409,'The project is no longer active.');
        if (project.available < 1) fail(409,'This project has no seats available. The application remains pending.');
        if (![row.programme,'BOTH'].includes(project.programme_eligibility)) fail(409,'The student is no longer eligible for this project.');
        if (db.prepare('SELECT id FROM allocations WHERE student_id=?').get(row.student_id)) fail(409,'This student already has a project allocation.');
      }
      const table = isActivity ? 'activity_requests' : 'project_requests';
      const updated = db.prepare(`UPDATE ${table} SET status=?,updated_at=? WHERE id=? AND status=?`).run(next,now(),row.id,row.status);
      if (!updated.changes) fail(409,'Another reviewer has already updated this request.');
      if (next === 'ALLOCATED') db.prepare('INSERT INTO allocations (student_id,project_id,request_id,approved_by,allocated_at) VALUES (?,?,?,?,?)').run(row.student_id,row.project_id,row.id,user.id,now());
      addEvent(type,row.id,user,next === 'REJECTED' ? 'REJECTED' : next === 'PENDING_HOD' && !isActivity ? 'RECOMMENDED' : next === 'ALLOCATED' ? 'ALLOCATED' : 'APPROVED',row.status,next,comment);
      return isActivity ? getActivity(user,id) : getApplication(user,id);
    }).immediate();
  }
  function saveProject(user,data,id) {
    requireRole(user,'FACULTY','HOD');
    return db.transaction(() => {
      const existing = id ? allProjects().find(p => p.id === Number(id)) : null;
      if (id && !existing) fail(404,'Project not found.');
      if (existing && user.role !== 'HOD' && existing.guide_id !== user.id) fail(403,'Only the project guide or HOD can edit this offering.');
      const guide = existing?.guide_id || (user.role === 'FACULTY' ? user.id : data.guide_id);
      if (!db.prepare("SELECT id FROM users WHERE id=? AND role='FACULTY'").get(guide || -1)) fail(400,'Select a faculty guide.');
      if (existing) {
        if (data.capacity < existing.occupied) fail(409,'Capacity cannot be lower than the number of confirmed allocations.');
        const activeRequests = db.prepare("SELECT count(*) AS n FROM project_requests WHERE project_id=? AND status IN ('PENDING_GUIDE','PENDING_HOD')").get(existing.id).n;
        if (!data.is_active && activeRequests) fail(409,'Resolve pending applications before deactivating this project.');
        if (data.programme_eligibility !== existing.programme_eligibility && db.prepare("SELECT count(*) AS n FROM project_requests WHERE project_id=? AND status!='REJECTED'").get(existing.id).n) fail(409,'Eligibility cannot change while the project has active applications or allocations.');
        db.prepare('UPDATE projects SET title=?,description=?,programme_eligibility=?,capacity=?,is_active=?,updated_at=? WHERE id=?').run(data.title,data.description,data.programme_eligibility,data.capacity,Number(data.is_active),now(),existing.id);
        return allProjects().find(p => p.id === existing.id);
      }
      const {lastInsertRowid:newId} = db.prepare('INSERT INTO projects (guide_id,title,description,programme_eligibility,capacity,is_active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run(guide,data.title,data.description,data.programme_eligibility,data.capacity,Number(data.is_active),now(),now());
      return allProjects().find(p => p.id === Number(newId));
    }).immediate();
  }
  function apply(user,id,statement) {
    requireRole(user,'STUDENT');
    return db.transaction(() => {
      const project = allProjects().find(p => p.id === Number(id));
      if (!project) fail(404,'Project not found.');
      if (!project.is_active || ![user.programme,'BOTH'].includes(project.programme_eligibility)) fail(403,'This project is not available for your programme.');
      if (project.available < 1) fail(409,'This project is already full.');
      if (db.prepare("SELECT id FROM project_requests WHERE student_id=? AND status!='REJECTED'").get(user.id)) fail(409,'You already have an active application or allocated project.');
      const time = now();
      const {lastInsertRowid:newId} = db.prepare('INSERT INTO project_requests (student_id,project_id,statement,status,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(user.id,project.id,statement,'PENDING_GUIDE',time,time);
      addEvent('project',newId,user,'SUBMITTED',null,'PENDING_GUIDE','Submitted for guide review.',time);
      return getApplication(user,newId);
    }).immediate();
  }
  function allocations(user) {
    return db.prepare(`SELECT a.*,p.title,g.name AS guide_name,p.guide_id,u.name AS student_name,u.student_number,u.programme FROM allocations a JOIN projects p ON p.id=a.project_id JOIN users g ON g.id=p.guide_id JOIN users u ON u.id=a.student_id ORDER BY a.allocated_at DESC`).all().filter(r => user.role === 'HOD' || (user.role === 'STUDENT' ? r.student_id === user.id : r.guide_id === user.id));
  }
  function students(user,relationship = 'advisees') {
    requireRole(user,'FACULTY','HOD');
    const apps = applications(user);
    return db.prepare("SELECT u.*,a.name AS advisor_name FROM users u LEFT JOIN users a ON a.id=u.advisor_id WHERE u.role='STUDENT' ORDER BY u.name").all().filter(s => user.role === 'HOD' || (relationship === 'projects' ? apps.some(a => a.student_id === s.id) : s.advisor_id === user.id)).map(s => {
      const own = (user.role === 'HOD' || s.advisor_id === user.id ? allApplications() : apps).filter(a => a.student_id === s.id);
      const active = own.find(a => a.status !== 'REJECTED');
      return {...publicUser(s),project_status:active?.status || 'NOT_APPLIED',project_title:active?.title || null,pending_activities:user.role === 'HOD' || s.advisor_id === user.id ? activities(user).filter(a => a.student_id === s.id && a.status.startsWith('PENDING')).length : null};
    });
  }
  function studentProfile(user,id) {
    const student = db.prepare("SELECT u.*,f.name AS advisor_name FROM users u JOIN users f ON f.id=u.advisor_id WHERE u.id=? AND u.role='STUDENT'").get(Number(id));
    if (!student) fail(404,'Student not found.');
    const ownApps = applications(user).filter(a => a.student_id === student.id);
    const full = user.role === 'HOD' || (user.role === 'STUDENT' && user.id === student.id) || (user.role === 'FACULTY' && student.advisor_id === user.id);
    if (!full && !(user.role === 'FACULTY' && ownApps.length)) fail(403,'This student is outside your supervision scope.');
    // An advisee's project summary is visible, but unrelated guides' application details remain private.
    const summary = full ? allApplications().find(a => a.student_id === student.id && a.status !== 'REJECTED') : ownApps.find(a => a.status !== 'REJECTED');
    return {student:publicUser(student),scope:full ? 'FULL' : 'PROJECT_ONLY',activities:full ? activities(user).filter(a => a.student_id === student.id) : [],applications:ownApps,project_summary:summary ? {title:summary.title,guide_name:summary.guide_name,status:summary.status} : null};
  }
  function faculty(user) {
    requireRole(user,'HOD');
    return db.prepare("SELECT id,name,email FROM users WHERE role='FACULTY' ORDER BY name").all().map(f => ({...f,advisees:db.prepare("SELECT count(*) AS n FROM users WHERE advisor_id=? AND role='STUDENT'").get(f.id).n,guided_students:db.prepare('SELECT count(*) AS n FROM allocations a JOIN projects p ON p.id=a.project_id WHERE p.guide_id=?').get(f.id).n,projects:allProjects().filter(p => p.guide_id === f.id).length,pending:allActivities().filter(a => a.advisor_id === f.id && a.status === 'PENDING_FACULTY').length+allApplications().filter(a => a.guide_id === f.id && a.status === 'PENDING_GUIDE').length}));
  }
  function academicItems(user) {
    return db.prepare('SELECT * FROM academic_items ORDER BY COALESCE(published_at,created_at) DESC,id DESC').all().filter(i => user.role === 'HOD' || (i.status === 'PUBLISHED' && (user.role === 'FACULTY' || ([user.programme,'BOTH'].includes(i.programme_audience) && (!i.semester || i.semester === user.current_semester) && (!i.admission_batch || i.admission_batch === user.admission_batch)))));
  }
  function saveAcademic(user,data,id) {
    requireRole(user,'HOD');
    const existing = id ? db.prepare('SELECT * FROM academic_items WHERE id=?').get(Number(id)) : null;
    if (id && !existing) fail(404,'Academic item not found.');
    const time = now();
    const values = [data.type,data.title,data.body,data.programme_audience,data.semester,data.admission_batch,data.academic_year,data.start_date,data.end_date,data.reference_url,data.status,user.id,existing?.published_at || (data.status === 'PUBLISHED' ? time : null),time];
    let itemId = existing?.id;
    if (existing) db.prepare('UPDATE academic_items SET type=?,title=?,body=?,programme_audience=?,semester=?,admission_batch=?,academic_year=?,start_date=?,end_date=?,reference_url=?,status=?,updated_by=?,published_at=?,updated_at=? WHERE id=?').run(...values,itemId);
    else itemId = Number(db.prepare('INSERT INTO academic_items (type,title,body,programme_audience,semester,admission_batch,academic_year,start_date,end_date,reference_url,status,updated_by,published_at,updated_at,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(...values,user.id,time).lastInsertRowid);
    return db.prepare('SELECT * FROM academic_items WHERE id=?').get(itemId);
  }
  function reviews(user) {
    requireRole(user,'FACULTY','HOD');
    return [...activities(user).filter(r => r.status === (user.role === 'HOD' ? 'PENDING_HOD' : 'PENDING_FACULTY')).map(r => ({...r,kind:'activity'})),...applications(user).filter(r => r.status === (user.role === 'HOD' ? 'PENDING_HOD' : 'PENDING_GUIDE')).map(r => ({...r,kind:'project'}))].sort((a,b) => a.created_at.localeCompare(b.created_at));
  }
  function dashboard(user) {
    const act = activities(user), apps = applications(user), alloc = allocations(user);
    const queue = user.role === 'STUDENT' ? [] : reviews(user);
    const recent = [...act.map(a => ({id:a.id,title:a.title,status:a.status,kind:'activity',category:a.category,date:a.updated_at,student_name:a.student_name})),...apps.map(a => ({id:a.id,title:a.title,status:a.status,kind:'project',date:a.updated_at,student_name:a.student_name}))].sort((a,b) => b.date.localeCompare(a.date));
    const hub = academicItems(user).filter(i => i.status === 'PUBLISHED');
    const summary = user.role === 'STUDENT' ? [{label:'Activity requests',value:act.length},{label:'Awaiting approval',value:act.filter(a => a.status.startsWith('PENDING')).length+apps.filter(a => a.status.startsWith('PENDING')).length},{label:'Approved activities',value:act.filter(a => a.status === 'APPROVED').length},{label:'Project allocation',value:alloc.length ? 'Confirmed' : apps.some(a => a.status.startsWith('PENDING')) ? 'In review' : 'Not applied'}] : [{label:'Awaiting your review',value:queue.length},{label:user.role === 'HOD' ? 'Department students' : 'Assigned advisees',value:students(user).length},{label:'Project allocations',value:alloc.length},{label:'Approved activities',value:act.filter(a => a.status === 'APPROVED').length}];
    return {summary,recent:recent.slice(0,6),queue:queue.slice(0,4),notices:hub.filter(i => i.type === 'NOTICE').slice(0,3),upcoming:hub.filter(i => i.start_date && i.start_date >= now().slice(0,10)).sort((a,b) => a.start_date.localeCompare(b.start_date)).slice(0,3),breakdown:{UG:act.filter(a => a.programme === 'UG').length,PG:act.filter(a => a.programme === 'PG').length},activity_counts:{approved:act.filter(a => a.status === 'APPROVED').length,pending:act.filter(a => a.status.startsWith('PENDING')).length,rejected:act.filter(a => a.status === 'REJECTED').length},project:apps.find(a => a.status !== 'REJECTED') || null,guided_students:alloc.length};
  }
  return {activities,projects,applications,getActivity,getApplication,submitActivity,decide,saveProject,apply,allocations,students,studentProfile,faculty,academicItems,saveAcademic,reviews,dashboard};
}
