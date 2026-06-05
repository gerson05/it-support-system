const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1366, height: 768 });

  // Login
  await page.goto('http://localhost:3000/login.html');
  await page.fill('input[name=username]', 'admin');
  await page.fill('input[name=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL('**/index.html**', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1500);
  console.log('Logged in, URL:', page.url());

  // Test 1: verify .page-container transform after animation
  await page.waitForTimeout(500);
  const transform = await page.evaluate(() => {
    const el = document.querySelector('.page-container') || document.querySelector('#app');
    if (!el) return 'element not found';
    return window.getComputedStyle(el).transform;
  });
  console.log('page-container computed transform:', transform);
  const badTransform = transform && transform !== 'none' && transform !== 'matrix(1, 0, 0, 1, 0, 0)';
  console.log(badTransform ? '❌ BAD: transform still active (will trap fixed modals)' : '✅ OK: no active transform');

  // Navigate to tech-requests via SPA
  await page.evaluate(() => { window.location.hash = '#tech-requests'; });
  await page.waitForTimeout(1500);

  // Click "Nueva Solicitud" button
  const newBtn = await page.$('#btn-new-tr, button:has-text("Nueva"), button:has-text("Solicitud")');
  if (newBtn) {
    await newBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'test-modal-tr.png', fullPage: false });

    const overlay = await page.$('#tr-modal-overlay');
    if (overlay) {
      const bbox = await overlay.boundingBox();
      const scrollH = await overlay.evaluate(el => el.scrollHeight);
      const clientH = await overlay.evaluate(el => el.clientHeight);
      console.log('TR overlay bbox:', JSON.stringify(bbox));
      console.log('TR overlay scrollHeight:', scrollH, '/ clientHeight:', clientH);
      console.log(scrollH > clientH ? '✅ Overlay has scrollable content' : '⚠️  Content fits without scroll');
    }
    console.log('Screenshot saved: test-modal-tr.png');
  } else {
    console.log('⚠️  Nueva Solicitud button not found');
    await page.screenshot({ path: 'test-modal-page.png' });
    console.log('Page screenshot saved: test-modal-page.png');
  }

  await browser.close();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
