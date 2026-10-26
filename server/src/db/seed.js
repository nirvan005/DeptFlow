import { hashSync } from 'bcryptjs';

export function seedDatabase(db) {
  if (db.prepare('SELECT count(*) AS n FROM users').get().n) return false;
  const now = new Date();
  const at = days => new Date(now.getTime() + days * 86400000).toISOString();
  const date = days => at(days).slice(0, 10);
  const password = hashSync('Demo@123', 10);
  db.transaction(() => {
    const user = db.prepare('INSERT INTO users (id,name,email,password_hash,role,programme,programme_name,admission_batch,current_semester,student_number,advisor_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
    [
      [1,'Dr. Mira Sen','hod@deptflow.edu','HOD',null,null,null,null,null,null],
      [2,'Dr. Aarav Mehta','aarav@deptflow.edu','FACULTY',null,null,null,null,null,null],
      [3,'Dr. Kavya Rao','kavya@deptflow.edu','FACULTY',null,null,null,null,null,null],
      [4,'Dr. Rohan Das','rohan@deptflow.edu','FACULTY',null,null,null,null,null,null],
      [5,'Ananya Sharma','ananya@deptflow.edu','STUDENT','UG','B.Tech · Computer Science',2023,7,'23CS001',2],
      [6,'Ishaan Patel','ishaan@deptflow.edu','STUDENT','UG','B.Tech · Computer Science',2023,7,'23CS014',2],
      [7,'Diya Mukherjee','diya@deptflow.edu','STUDENT','UG','B.Tech · Computer Science',2024,5,'24CS008',3],
      [8,'Arjun Roy','arjun@deptflow.edu','STUDENT','PG','M.Tech · Computer Science',2025,3,'25PG003',3],
      [9,'Sana Khan','sana@deptflow.edu','STUDENT','PG','M.Tech · Computer Science',2025,3,'25PG011',4],
      [10,'Neel Banerjee','neel@deptflow.edu','STUDENT','PG','M.Tech · Computer Science',2026,1,'26PG006',4]
    ].forEach(([id,name,email,role,...rest]) => user.run(id,name,email,password,role,...rest));
    const project = db.prepare('INSERT INTO projects VALUES (?,?,?,?,?,?,?,?,?)');
    [
      [1,2,'Campus Connect','Build an accessible campus companion that helps students discover academic resources and collaborate across the department.','UG',3],
      [2,3,'Explainable AI for Healthcare','Explore interpretable machine learning models for clinical decision support, with a focus on trust and responsible evaluation.','PG',2],
      [3,4,'Smart Energy Observatory','Design an IoT dashboard to understand energy usage patterns and suggest practical ways to reduce consumption.','BOTH',2],
      [4,2,'Secure Digital Credentials','Prototype a verifiable academic credential system with privacy-conscious sharing and verification.','UG',1],
      [5,3,'Indian Language Search','Develop a semantic search prototype for multilingual academic documents and evaluate retrieval quality.','BOTH',2],
      [6,4,'Distributed Systems Lab','Investigate fault tolerance and consistency through a visual simulation of distributed services.','PG',1]
    ].forEach(row => project.run(...row,1,at(-12),at(-12)));
    const activity = db.prepare('INSERT INTO activity_requests VALUES (?,?,?,?,?,?,?,?,?,?,?)');
    const event = db.prepare('INSERT INTO workflow_events (activity_request_id,project_request_id,actor_id,action,from_status,to_status,comment,created_at) VALUES (?,?,?,?,?,?,?,?)');
    const activityRows = [
      [1,6,2,'National workshop on web accessibility','SEMINAR_WORKSHOP',4,5,'Requesting permission to attend a two-day workshop on inclusive web development.','PENDING_FACULTY'],
      [2,7,3,'Industry visit to innovation centre','INDUSTRIAL_VISIT',7,7,'A learning visit to explore software engineering practices in a professional environment.','PENDING_HOD'],
      [3,8,3,'Research methodology symposium','ACADEMIC_EVENT',-8,-7,'Presenting a poster on interpretable machine learning and discussing research methods.','APPROVED'],
      [4,9,4,'Permission for external seminar','LEAVE_PERMISSION',-2,-2,'Requesting permission to attend an external technical seminar.','REJECTED'],
      [5,6,2,'Open source contribution meetup','ACADEMIC_EVENT',9,9,'Participating in a student-led session about contributing to open source projects.','PENDING_HOD']
    ];
    for (const [id,sid,aid,title,category,start,end,description,status] of activityRows) {
      activity.run(id,sid,aid,title,category,date(start),date(end),description,status,at(-5),at(-1));
      event.run(id,null,sid,'SUBMITTED',null,'PENDING_FACULTY','Request submitted for advisor review.',at(-5));
      if (['PENDING_HOD','APPROVED'].includes(status)) event.run(id,null,aid,'APPROVED','PENDING_FACULTY','PENDING_HOD','Recommended. This supports the student’s academic development.',at(-3));
      if (status === 'APPROVED') event.run(id,null,1,'APPROVED','PENDING_HOD','APPROVED','Approved. Please share your learnings with the department.',at(-1));
      if (status === 'REJECTED') event.run(id,null,aid,'REJECTED','PENDING_FACULTY','REJECTED','The date conflicts with a scheduled assessment. Please choose another session.',at(-1));
    }
    const application = db.prepare('INSERT INTO project_requests VALUES (?,?,?,?,?,?,?)');
    const apps = [
      [1,6,4,'I would like to explore secure credential verification and build a practical prototype.','ALLOCATED',2],
      [2,7,3,'I am interested in using connected sensors and visualization to improve energy awareness.','PENDING_GUIDE',4],
      [3,8,2,'My research interests include transparent and reliable machine learning for healthcare.','PENDING_HOD',3],
      [4,9,6,'I would like to study how distributed services recover from failures.','REJECTED',4]
    ];
    for (const [id,sid,pid,statement,status,guide] of apps) {
      application.run(id,sid,pid,statement,status,at(-6),at(-1));
      event.run(null,id,sid,'SUBMITTED',null,'PENDING_GUIDE','Project application submitted.',at(-6));
      if (['PENDING_HOD','ALLOCATED'].includes(status)) event.run(null,id,guide,'RECOMMENDED','PENDING_GUIDE','PENDING_HOD','A good fit for the project. Recommended for allocation.',at(-3));
      if (status === 'ALLOCATED') {
        event.run(null,id,1,'ALLOCATED','PENDING_HOD','ALLOCATED','Allocation confirmed. Please coordinate with your guide.',at(-1));
        db.prepare('INSERT INTO allocations (student_id,project_id,request_id,approved_by,allocated_at) VALUES (?,?,?,?,?)').run(sid,pid,id,1,at(-1));
      }
      if (status === 'REJECTED') event.run(null,id,guide,'REJECTED','PENDING_GUIDE','REJECTED','Please strengthen the proposal and apply again.',at(-1));
    }
    const item = db.prepare('INSERT INTO academic_items (type,title,body,programme_audience,semester,admission_batch,academic_year,start_date,end_date,reference_url,status,created_by,updated_by,published_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    const year = `${now.getFullYear()}-${String(now.getFullYear()+1).slice(-2)}`;
    [
      ['NOTICE','A little curiosity goes a long way','Sample notice: Join our student research conversations this Friday. Bring an idea, ask a question, and meet fellow builders.','BOTH',null,null,null,null,null,'PUBLISHED'],
      ['NOTICE','UG project proposal window is open','Sample notice: Discuss your interests with a faculty guide and submit your project application through DeptFlow.','UG',null,null,null,null,null,'PUBLISHED'],
      ['NOTICE','PG research progress review','Sample notice: Prepare a short overview of your research question, methods, and next steps for your guide.','PG',null,null,null,null,null,'PUBLISHED'],
      ['ACADEMIC_DATE','Project proposal presentations','Sample academic milestone: Present your project proposal and discuss it with your faculty guide.','BOTH',null,null,date(5),date(5),null,'PUBLISHED'],
      ['ACADEMIC_DATE','Semester registration deadline','Sample reminder: Complete the required institute registration formalities before the deadline.','BOTH',null,null,date(10),date(10),null,'PUBLISHED'],
      ['TIMETABLE','UG class timetables','Official reference: CSE undergraduate timetable resources. Refer to the source for the applicable version.','UG',null,null,null,null,'https://nitdgp.ac.in/department/computer-science-engineering/ug-4-1','PUBLISHED'],
      ['SYLLABUS','PG curriculum & syllabus','Official reference: Postgraduate curriculum and syllabus resources from the CSE department.','PG',null,null,null,null,'https://nitdgp.ac.in/department/computer-science-engineering/pg','PUBLISHED'],
      ['REGULATION','UG & PG academic regulations','Official reference: Published academic regulations. Verify the applicable version at the source.','BOTH',null,null,null,null,'https://nitdgp.ac.in/p/regulations-1','PUBLISHED'],
      ['EXAM_SCHEDULE','Semester examination schedules','Official reference: Check the institute examination page for the applicable schedule.','BOTH',null,null,null,null,'https://nitdgp.ac.in/p/examinations-1','PUBLISHED'],
      ['REGISTRATION_RESOURCE','Semester registration resources','Official reference: Registration notifications and reference forms.','BOTH',null,null,null,null,'https://nitdgp.ac.in/p/registrations-1','PUBLISHED'],
      ['NOTICE','Next semester planning','Sample draft: Academic planning details for the coming term.','BOTH',null,null,null,null,null,'DRAFT'],
      ['NOTICE','Previous project orientation','Sample archived notice: Orientation session from the previous project cycle.','BOTH',null,null,null,null,null,'ARCHIVED']
    ].forEach(([type,title,body,audience,semester,batch,start,end,url,status]) => item.run(type,title,body,audience,semester,batch,year,start,end,url,status,1,1,status === 'DRAFT' ? null : at(-2),at(-3),at(-2)));
  })();
  return true;
}
