// @ts-check
import { test, expect } from './fixtures.ts';

test('popup page renders correctly', async ({ page, extensionId }) => {
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
