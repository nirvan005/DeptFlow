import { test,expect } from '@playwright/test';
async function login(page,email) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password',{exact:true}).fill('Demo@123');
  await page.getByRole('button',{name:'Sign in to workspace'}).click();
  await expect(page.getByRole('heading',{name:/Welcome back/})).toBeVisible();
}
test('student desktop screens load with no JavaScript errors',async ({page}) => {
  const errors = [];page.on('pageerror',e => errors.push(e.message));
  await page.setViewportSize({width:1440,height:1000});
  await login(page,'ananya@deptflow.edu');
  await expect(page.getByRole('heading',{name:'Big ideas start with a small step.'})).toBeVisible();
  await page.screenshot({path:'test-results/student-dashboard-desktop.png',fullPage:true});
  for (const [route,heading] of [['/activities','Department activities'],['/activities/new','A new academic opportunity'],['/projects','Projects worth building'],['/projects/1/apply','Campus Connect'],['/students/5','Ananya Sharma'],['/academics','Your academic hub']]) {
    await page.goto(route);await expect(page.getByRole('heading',{name:heading,exact:true}).first()).toBeVisible();
    await expect(page.getByText('We couldn’t load this page')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});
test('HOD and faculty detail screens render their scoped records',async ({page}) => {
  const errors = [];page.on('pageerror',e => errors.push(e.message));
  await login(page,'hod@deptflow.edu');
  for (const [route,heading] of [['/students','Your department, connected.'],['/faculty','Faculty overview'],['/reviews','Your review queue'],['/activities/2','Industry visit to innovation centre'],['/applications/3','Explainable AI for Healthcare'],['/academics/new','Share something useful']]) {
    await page.goto(route);await expect(page.getByRole('heading',{name:heading,exact:true}).first()).toBeVisible();
    await expect(page.getByText('We couldn’t load this page')).toHaveCount(0);
  }
  await page.getByRole('button',{name:'Sign out'}).click();
  await login(page,'rohan@deptflow.edu');
  await page.goto('/students');await page.getByRole('button',{name:'Project students',exact:true}).click();
  await expect(page.getByText('Diya Mukherjee')).toBeVisible();
  await page.getByRole('link',{name:"View Diya Mukherjee's profile",exact:true}).click();
  await expect(page.getByText('You are viewing this student as a project guide.')).toBeVisible();
  expect(errors).toEqual([]);
});
test('mobile navigation and core screens fit the viewport',async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await login(page,'ananya@deptflow.edu');
  await expect(page.getByRole('button',{name:'Open navigation'})).toBeVisible();
  await page.getByRole('button',{name:'Open navigation'}).click();
  await page.locator('nav').getByRole('link',{name:'Projects',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Projects worth building'})).toBeVisible();
  for (const route of ['/','/activities/new','/projects','/academics']) {
    await page.goto(route);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('.loading')).toHaveCount(0);
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(fits,`${route} should not overflow horizontally`).toBe(true);
  }
  await page.goto('/');await expect(page.getByRole('heading',{name:/Welcome back/})).toBeVisible();
  await page.screenshot({path:'test-results/student-dashboard-mobile.png',fullPage:true});
});
