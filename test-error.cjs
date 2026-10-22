const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR CONSOLE:', msg.text());
    } else {
      console.log('BROWSER CONSOLE:', msg.text());
    }
  });
  page.on('pageerror', err => console.log('BROWSER EXCEPTION:', err.message));
  page.on('requestfailed', req => console.log('REQUEST FAILED:', req.url(), req.failure().errorText));

  console.log('Navigating to http://localhost:5173/validaciones');
  await page.goto('http://localhost:5173/validaciones', { waitUntil: 'networkidle0' });
  
  await page.screenshot({ path: 'test-screenshot.png' });
  console.log('Saved screenshot to test-screenshot.png');
  
  await browser.close();
})();
