import { test,expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFileSync } from 'node:fs';
import { login,logout,loaded } from './helpers.js';

test('WCAG A/AA automated checks on login and representative role screens',async ({page},testInfo) => {
  test.setTimeout(120000);
  const violations = [];
  async function audit(route) {
    await page.goto(route);
    if (route !== '/login') await loaded(page);
    const result = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
    for (const v of result.violations) violations.push({route,id:v.id,help:v.help,nodes:v.nodes.map(n => ({target:n.target,summary:n.failureSummary}))});
  }
  await audit('/login');await login(page,'hod');
  for (const route of ['/','/students','/students/7','/faculty','/reviews','/activities/1','/applications/2','/projects','/projects/new','/projects/1/edit','/academics','/academics/new','/academics/1','/academics/1/edit']) await audit(route);
  await logout(page);await login(page,'ananya');
  for (const route of ['/activities/new','/projects/1/apply']) await audit(route);
  await logout(page);await login(page,'neel');await audit('/projects/6/apply');
  await page.setViewportSize({width:390,height:844});await audit('/activities/new');
  await logout(page);await login(page,'aarav');await audit('/activities/1');
  await testInfo.attach('accessibility-results',{body:JSON.stringify(violations,null,2),contentType:'application/json'});
  writeFileSync(testInfo.outputPath('accessibility.json'),JSON.stringify(violations,null,2));
  expect(violations.map(v => ({route:v.route,id:v.id,targets:v.nodes.slice(0,6).map(n => n.target)}))).toEqual([]);
});

for (const width of [390,768,1024,1440]) {
  test(`all HOD screen layouts fit a ${width}px viewport`,async ({page}) => {
    test.setTimeout(60000);
    await page.setViewportSize({width,height:900});await login(page,'hod');
    for (const route of ['/','/activities','/activities/1','/projects','/projects/new','/projects/1/edit','/projects?tab=applications','/projects?tab=allocations','/applications/2','/students','/students/7','/faculty','/faculty/2/pending','/reviews','/academics','/academics/new','/academics/1','/academics/1/edit']) {
      await page.goto(route);await loaded(page);
      const layout = await page.evaluate(() => ({width:innerWidth,scroll:document.documentElement.scrollWidth,wide:[...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right>innerWidth+1).slice(0,12).map(el => ({tag:el.tagName,class:el.className,width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right}))}));
      expect(layout.scroll <= layout.width,`${route}: ${JSON.stringify(layout)}`).toBe(true);
    }
    await page.goto('/');await loaded(page);
    await page.screenshot({path:`test-results/hod-overview-${width}.png`,fullPage:true});
  });
}

test('keyboard login, visible focus, and mobile navigation focus management',async ({page}) => {
  await page.goto('/login');
  await page.getByLabel('Email address').focus();await page.keyboard.type('ananya@deptflow.edu');
  await page.keyboard.press('Tab');await expect(page.getByLabel('Password',{exact:true})).toBeFocused();
  await page.keyboard.type('Demo@123');await page.keyboard.press('Tab');
  await expect(page.getByRole('button',{name:'Sign in to workspace'})).toBeFocused();
  const outline = await page.getByRole('button',{name:'Sign in to workspace'}).evaluate(el => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');await page.keyboard.press('Enter');await expect(page.getByRole('heading',{name:/Welcome back/})).toBeVisible();
  await page.goto('/activities/new');await page.getByLabel('Activity title').focus();
  await page.keyboard.press('Tab');await expect(page.getByLabel('Category',{exact:true})).toBeFocused();
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Open navigation'}).focus();await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog',{name:'Department navigation'});
  await expect(dialog).toBeVisible();
  await dialog.locator('.brand-link').focus();await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('link',{name:'Explore projects'})).toBeFocused();
  await page.keyboard.press('Tab');await expect(dialog.locator('.brand-link')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'Open navigation'})).toBeFocused();
  await expect(page.locator('.sidebar')).toHaveAttribute('inert','');
});
