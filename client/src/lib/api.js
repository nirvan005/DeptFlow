export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...options.headers},body:options.body === undefined ? undefined : JSON.stringify(options.body)});
  const data = await response.json().catch(() => ({message:'The server could not be reached. Please try again.'}));
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login') window.dispatchEvent(new Event('deptflow:session-expired'));
    throw Object.assign(new Error(data.message || 'Request failed.'),{status:response.status,fields:data.fields});
  }
  return data;
}
export const labels = {
  PENDING_FACULTY:'Awaiting faculty',PENDING_GUIDE:'Awaiting guide',PENDING_HOD:'Awaiting HOD',APPROVED:'Approved',ALLOCATED:'Allocated',REJECTED:'Rejected',NOT_APPLIED:'Not applied',PUBLISHED:'Published',DRAFT:'Draft',ARCHIVED:'Archived',
  SEMINAR_WORKSHOP:'Seminar / Workshop',INDUSTRIAL_VISIT:'Industrial visit',ACADEMIC_EVENT:'Academic event',LEAVE_PERMISSION:'Leave / Permission',NOTICE:'Notice',ACADEMIC_DATE:'Academic date',EXAM_SCHEDULE:'Exam schedule',TIMETABLE:'Timetable',SYLLABUS:'Syllabus',REGULATION:'Regulations',REGISTRATION_RESOURCE:'Registration form',BOTH:'UG & PG',STUDENT:'Student',FACULTY:'Faculty',HOD:'Head of Department',SUBMITTED:'Submitted',RECOMMENDED:'Recommended'
};
export const label = value => labels[value] || value;
export const formatDate = (value,withTime = false) => value ? new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',...(withTime ? {hour:'numeric',minute:'2-digit'} : {year:'numeric'})}).format(new Date(value.length === 10 ? `${value}T12:00:00` : value)) : '—';
export const initials = name => (name || '').replace(/^Dr\.\s*/,'').split(' ').slice(0,2).map(v => v[0]).join('');
export const recordPath = (kind,id) => kind === 'activity' ? `/activities/${id}` : `/applications/${id}`;
