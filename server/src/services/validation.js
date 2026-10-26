import { z } from 'zod';
const text = (min,max) => z.string().trim().min(min).max(max);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'Use a valid date.').refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v,'Use a valid calendar date.');
export const loginSchema = z.object({email:z.email().max(254),password:text(1,128)}).strict();
export const activitySchema = z.object({title:text(4,150),category:z.enum(['SEMINAR_WORKSHOP','INDUSTRIAL_VISIT','ACADEMIC_EVENT','LEAVE_PERMISSION']),start_date:date,end_date:date,description:text(15,3000)}).strict().refine(d => d.end_date >= d.start_date,{message:'End date must be on or after the start date.',path:['end_date']});
export const decisionSchema = z.object({decision:z.enum(['APPROVE','REJECT']),comment:text(3,1000),expected_status:text(1,40)}).strict();
export const applicationSchema = z.object({statement:text(15,2000)}).strict();
export const projectSchema = z.object({title:text(4,150),description:text(20,3000),programme_eligibility:z.enum(['UG','PG','BOTH']),capacity:z.number().int().min(1).max(100),is_active:z.boolean(),guide_id:z.number().int().positive().optional()}).strict();
const nullableDate = date.nullable();
export const academicSchema = z.object({
  type:z.enum(['NOTICE','ACADEMIC_DATE','EXAM_SCHEDULE','TIMETABLE','SYLLABUS','REGULATION','REGISTRATION_RESOURCE']),title:text(4,150),body:text(10,4000),programme_audience:z.enum(['UG','PG','BOTH']),semester:z.number().int().min(1).max(8).nullable(),admission_batch:z.number().int().min(2000).max(2100).nullable(),academic_year:z.string().regex(/^\d{4}-\d{2}$/,'Use YYYY-YY, for example 2026-27.'),start_date:nullableDate,end_date:nullableDate,reference_url:z.url().max(2000).refine(v => /^https?:\/\//i.test(v),'Only HTTP or HTTPS links are supported.').nullable(),status:z.enum(['DRAFT','PUBLISHED','ARCHIVED'])
}).strict().superRefine((d,ctx) => {
  const issue = (path,message) => ctx.addIssue({code:'custom',path:[path],message});
  if (d.programme_audience === 'PG' && d.semester > 4) issue('semester','PG semester must be between 1 and 4.');
  if (d.type === 'ACADEMIC_DATE' && !d.start_date) issue('start_date','An academic date needs a start date.');
  if (d.end_date && (!d.start_date || d.end_date < d.start_date)) issue('end_date','End date requires a start date and cannot be earlier.');
  if (!['NOTICE','ACADEMIC_DATE'].includes(d.type) && !d.reference_url) issue('reference_url','A resource requires a reference link.');
});
