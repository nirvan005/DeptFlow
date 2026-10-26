CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('STUDENT','FACULTY','HOD')),
  programme TEXT CHECK(programme IN ('UG','PG')),
  programme_name TEXT,
  admission_batch INTEGER,
  current_semester INTEGER,
  student_number TEXT UNIQUE,
  advisor_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK(role != 'STUDENT' OR (programme IS NOT NULL AND programme_name IS NOT NULL AND admission_batch IS NOT NULL AND student_number IS NOT NULL AND advisor_id IS NOT NULL AND current_semester BETWEEN 1 AND CASE programme WHEN 'UG' THEN 8 ELSE 4 END))
);
CREATE TABLE IF NOT EXISTS activity_requests (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES users(id),
  advisor_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('SEMINAR_WORKSHOP','INDUSTRIAL_VISIT','ACADEMIC_EVENT','LEAVE_PERMISSION')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL CHECK(end_date >= start_date),
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PENDING_FACULTY','PENDING_HOD','APPROVED','REJECTED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY,
  guide_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  programme_eligibility TEXT NOT NULL CHECK(programme_eligibility IN ('UG','PG','BOTH')),
  capacity INTEGER NOT NULL CHECK(capacity > 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS project_requests (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES users(id),
  project_id INTEGER NOT NULL REFERENCES projects(id),
  statement TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PENDING_GUIDE','PENDING_HOD','ALLOCATED','REJECTED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_project_request ON project_requests(student_id) WHERE status IN ('PENDING_GUIDE','PENDING_HOD','ALLOCATED');
CREATE TABLE IF NOT EXISTS allocations (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  project_id INTEGER NOT NULL REFERENCES projects(id),
  request_id INTEGER NOT NULL UNIQUE REFERENCES project_requests(id),
  approved_by INTEGER NOT NULL REFERENCES users(id),
  allocated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS workflow_events (
  id INTEGER PRIMARY KEY,
  activity_request_id INTEGER REFERENCES activity_requests(id),
  project_request_id INTEGER REFERENCES project_requests(id),
  actor_id INTEGER NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  comment TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK((activity_request_id IS NOT NULL) + (project_request_id IS NOT NULL) = 1)
);
CREATE TABLE IF NOT EXISTS academic_items (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('NOTICE','ACADEMIC_DATE','EXAM_SCHEDULE','TIMETABLE','SYLLABUS','REGULATION','REGISTRATION_RESOURCE')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  programme_audience TEXT NOT NULL CHECK(programme_audience IN ('UG','PG','BOTH')),
  semester INTEGER CHECK(semester BETWEEN 1 AND 8),
  admission_batch INTEGER,
  academic_year TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT CHECK(end_date IS NULL OR end_date >= start_date),
  reference_url TEXT,
  status TEXT NOT NULL CHECK(status IN ('DRAFT','PUBLISHED','ARCHIVED')),
  created_by INTEGER NOT NULL REFERENCES users(id),
  updated_by INTEGER NOT NULL REFERENCES users(id),
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (sid TEXT PRIMARY KEY, data TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS student_advisor ON users(advisor_id,programme,current_semester,admission_batch);
CREATE INDEX IF NOT EXISTS activity_reviewer ON activity_requests(advisor_id,status);
CREATE INDEX IF NOT EXISTS activity_student ON activity_requests(student_id);
CREATE INDEX IF NOT EXISTS application_project ON project_requests(project_id,status);
CREATE INDEX IF NOT EXISTS events_activity ON workflow_events(activity_request_id,created_at);
CREATE INDEX IF NOT EXISTS events_project ON workflow_events(project_request_id,created_at);
CREATE INDEX IF NOT EXISTS academic_audience ON academic_items(status,programme_audience,start_date);
PRAGMA user_version = 1;
