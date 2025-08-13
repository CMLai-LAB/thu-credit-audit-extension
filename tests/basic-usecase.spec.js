// @ts-check
import { test, expect } from './fixtures.ts';

test('Can operate on the current ui to query course result', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  // Fetch the body of the page
  const body = page.locator('body');

  // Assert that these strings appear somewhere in the page
  await expect(body).toContainText('必修科目表');
  await expect(body).toContainText('學年度');
  await expect(body).toContainText('學制');
  await expect(body).toContainText('學系');

  // Check if the departments list is loaded
  await expect(body).toContainText('學系清單已載入');
});

test('user can query for cs-114-bachelor mustlist', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  // Fill in options
  await page.selectOption('select#setyear', { label: '114' });
  await new Promise(r => setTimeout(r, 1000));
  await page.selectOption('select#stype', { label: '日間學士班' });
  await new Promise(r => setTimeout(r, 1000));
  await page.selectOption('select#majr', { label: '資工系' });
  await page.waitForSelector('select#stype:enabled');
  await page.selectOption('select#stype', { label: '日間學士班' });
  await page.waitForSelector('select#majr:enabled');
  await page.selectOption('select#majr', { label: '資工系' });
  await page.waitForSelector('select[name="p_grop"].form-control:enabled');
  await page.selectOption('select[name="p_grop"].form-control', { label: '一般組' });

  await page.click('button#fetchBtn');

  await expect(page.locator('body')).toContainText('基礎課程');
  await expect(page.locator('body')).toContainText('通識必修科目');
  await expect(page.locator('body')).toContainText('學系必修科目');
});
