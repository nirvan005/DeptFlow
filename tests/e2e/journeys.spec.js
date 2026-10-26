import { test,expect } from '@playwright/test';
import { login,logout,loaded } from './helpers.js';

test('activity: student submits, faculty approves, HOD approves, student sees final history',async ({page}) => {
  await login(page,'ananya');
  await page.goto('/activities/new');
  await page.getByLabel('Activity title').fill('QA accessible systems workshop');
  await page.getByLabel('Start date',{exact:true}).fill('2026-11-12');
  await page.getByLabel('End date',{exact:true}).fill('2026-11-13');
  await page.getByLabel('Description & purpose').fill('Attend a practical workshop and share the accessibility techniques learned with the department.');
  await page.getByRole('button',{name:'Submit request'}).click();
  await expect(page).toHaveURL(/\/activities\/\d+$/);
  const detail = new URL(page.url()).pathname;
  await expect(page.locator('.page-heading .badge')).toHaveText('Awaiting faculty');
  await page.reload();await expect(page.getByRole('heading',{name:'QA accessible systems workshop'})).toBeVisible();
  await logout(page);await login(page,'aarav');
  await page.goto('/reviews');
  await page.getByRole('link',{name:/QA accessible systems workshop/}).click();
  await page.getByLabel('Review comment').fill('Recommended: this is a useful academic opportunity.');
  await page.getByRole('button',{name:'Approve request'}).click();
  await expect(page.locator('.page-heading .badge')).toHaveText('Awaiting HOD');
  await logout(page);await login(page,'hod');
  await page.goto('/reviews');
  await page.getByRole('link',{name:/QA accessible systems workshop/}).click();
  await page.getByLabel('Review comment').fill('Approved. Please share a short learning summary afterwards.');
  await page.getByRole('button',{name:'Approve request'}).click();
  await expect(page.locator('.page-heading .badge')).toHaveText('Approved');
  await logout(page);await login(page,'ananya');await page.goto(detail);
  await expect(page.locator('.timeline-event')).toHaveCount(3);
  await expect(page.getByText('Approved. Please share a short learning summary afterwards.',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Approve request'})).toHaveCount(0);
});

test('project: offering creation, student application, recommendation, allocation, and seat update',async ({page}) => {
  await login(page,'aarav');await page.goto('/projects/new');
  await page.getByLabel('Project title').fill('QA inclusive campus navigator');
  await page.getByLabel('Project description').fill('Develop an accessible campus navigation prototype and evaluate the experience with students.');
  await page.getByLabel('Student capacity').fill('2');
  await page.getByRole('button',{name:'Create project',exact:true}).click();
  await expect(page.locator('.project-card').filter({hasText:'QA inclusive campus navigator'})).toBeVisible();
  await logout(page);await login(page,'ananya');await page.goto('/projects');
  const card = page.locator('.project-card').filter({hasText:'QA inclusive campus navigator'});
  await card.getByRole('link',{name:'Explore & apply'}).click();
  await page.getByLabel('Why would you like to work on this project?').fill('I would like to contribute accessible interface design skills and learn how to evaluate user experience.');
  await page.getByRole('button',{name:'Submit application'}).click();
  await expect(page).toHaveURL(/\/applications\/\d+$/);const detail = new URL(page.url()).pathname;
  await expect(page.locator('.page-heading .badge')).toHaveText('Awaiting guide');
  await logout(page);await login(page,'aarav');await page.goto(detail);
  await page.getByLabel('Review comment').fill('A strong fit for the proposed project.');
  await page.getByRole('button',{name:'Recommend to HOD'}).click();
  await expect(page.locator('.page-heading .badge')).toHaveText('Awaiting HOD');
  await logout(page);await login(page,'hod');await page.goto(detail);
  await page.getByLabel('Review comment').fill('Seat confirmed. Please begin with your guide.');
  await page.getByRole('button',{name:'Confirm allocation'}).click();
  await expect(page.locator('.page-heading .badge')).toHaveText('Allocated');
  await logout(page);await login(page,'ananya');await page.goto('/projects?tab=allocations');
  await expect(page.getByRole('link',{name:'QA inclusive campus navigator',exact:true})).toBeVisible();
  await page.goto('/projects');
  await expect(page.locator('.project-card').filter({hasText:'QA inclusive campus navigator'})).toContainText('1 of 2 seats available');
  await page.goto(detail);await expect(page.locator('.timeline-event')).toHaveCount(3);
});

test('rejection feedback is visible and a new activity can be submitted',async ({page}) => {
  await login(page,'neel');await page.goto('/activities/new');
  await page.getByLabel('Activity title').fill('QA research seminar permission');
  await page.getByLabel('Start date',{exact:true}).fill('2026-11-15');await page.getByLabel('End date',{exact:true}).fill('2026-11-15');
  await page.getByLabel('Description & purpose').fill('Attend a research seminar to discuss distributed systems and reliability evaluation.');
  await page.getByRole('button',{name:'Submit request'}).click();await expect(page).toHaveURL(/\/activities\/\d+$/);const detail = new URL(page.url()).pathname;
  await logout(page);await login(page,'rohan');await page.goto(detail);
  await page.getByLabel('Review comment').fill('Please choose a date that does not overlap the lab assessment.');
  await page.getByRole('button',{name:'Reject with feedback'}).click();
  await expect(page.locator('.page-heading .badge')).toHaveText('Rejected');
  await logout(page);await login(page,'neel');await page.goto(detail);
  await expect(page.getByText('Please choose a date that does not overlap the lab assessment.',{exact:true})).toBeVisible();
  await page.goto('/activities/new');await expect(page.getByRole('button',{name:'Submit request'})).toBeVisible();
});

test('Academic Hub: targeted draft, publication, audience restrictions, edit and archive',async ({page}) => {
  await login(page,'hod');await page.goto('/academics/new');
  await page.getByLabel('Title',{exact:true}).fill('QA UG cohort announcement');
  await page.getByLabel('Content / description').fill('A targeted announcement for the undergraduate semester seven admission cohort.');
  await page.getByLabel('Programme audience').selectOption('UG');await page.getByLabel('Semester (optional)').selectOption('7');
  await page.getByLabel('Admission batch (optional)').fill('2023');
  await page.getByRole('button',{name:'Save draft'}).click();await expect(page).toHaveURL(/\/academics\/\d+$/);const detail = new URL(page.url()).pathname;
  await logout(page);await login(page,'ananya');await page.goto(detail);
  await expect(page.getByRole('heading',{name:'We couldn’t load this page'})).toBeVisible();
  await logout(page);await login(page,'hod');await page.goto(`${detail}/edit`);
  await page.getByLabel('Publishing state').selectOption('PUBLISHED');await page.getByRole('button',{name:'Publish item'}).click();
  await expect(page.locator('.academic-detail-tags')).toContainText('Published');
  await logout(page);await login(page,'ananya');await page.goto('/academics');
  await page.getByRole('link',{name:'QA UG cohort announcement',exact:true}).click();await expect(page.getByRole('heading',{name:'QA UG cohort announcement'})).toBeVisible();
  await logout(page);await login(page,'neel');await page.goto(detail);await expect(page.getByRole('heading',{name:'We couldn’t load this page'})).toBeVisible();
  await logout(page);await login(page,'diya');await page.goto(detail);await expect(page.getByRole('heading',{name:'We couldn’t load this page'})).toBeVisible();
  await logout(page);await login(page,'hod');await page.goto(`${detail}/edit`);await page.getByLabel('Publishing state').selectOption('ARCHIVED');await page.getByRole('button',{name:'Archive item'}).click();
  await expect(page.locator('.academic-detail-tags')).toContainText('Archived');
  await logout(page);await login(page,'ananya');await page.goto(detail);await expect(page.getByRole('heading',{name:'We couldn’t load this page'})).toBeVisible();
});

test('filters, empty results and retry after a temporary API failure',async ({page}) => {
  await login(page,'hod');await page.goto('/students');
  await page.getByRole('combobox',{name:'UG & PG',exact:true}).selectOption('PG');
  await expect(page.locator('tbody tr')).toHaveCount(3);
  await page.getByRole('combobox',{name:'All advisors'}).selectOption('4');await expect(page.locator('tbody tr')).toHaveCount(2);
  await page.getByRole('textbox',{name:'Search by student name or roll number…'}).fill('No matching student');
  await expect(page.getByRole('heading',{name:'No students match this view'})).toBeVisible();
  await page.route('**/api/activities',route => route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Temporary test outage. Please retry.'})}));
  await page.goto('/activities');await expect(page.getByText('Temporary test outage. Please retry.')).toBeVisible();
  await page.unroute('**/api/activities');await page.getByRole('button',{name:'Try again'}).click();await loaded(page);
  await expect(page.locator('tbody tr').first()).toBeVisible();
});

test('expired sessions return to sign-in on the next protected action',async ({page,context}) => {
  await login(page,'ananya');await context.clearCookies();
  await page.locator('nav').getByRole('link',{name:'Activities',exact:true}).click();
  await expect(page.getByRole('button',{name:'Sign in to workspace'})).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test('project application links show the selected offering rather than all projects under its guide',async ({page}) => {
  await login(page,'hod');await page.goto('/projects');
  await page.getByRole('link',{name:'Applications for Secure Digital Credentials',exact:true}).click();
  await expect(page).toHaveURL(/project_id=4/);
  await expect(page.locator('.record-row')).toHaveCount(1);
  await expect(page.locator('.record-row')).toContainText('Secure Digital Credentials');
});
