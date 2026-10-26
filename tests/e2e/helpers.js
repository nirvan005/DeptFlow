import { expect } from '@playwright/test';
export async function login(page,name) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(`${name}@deptflow.edu`);
  await page.getByLabel('Password',{exact:true}).fill('Demo@123');
  await page.getByRole('button',{name:'Sign in to workspace'}).click();
  await expect(page.getByRole('heading',{name:/Welcome back/})).toBeVisible();
}
export async function logout(page) {
  await page.getByRole('button',{name:'Sign out'}).click();
  await expect(page.getByRole('button',{name:'Sign in to workspace'})).toBeVisible();
}
export async function loaded(page) {
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('.loading')).toHaveCount(0);
  await expect(page.getByText('We couldn’t load this page')).toHaveCount(0);
}
