import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`PAGE ERROR: ${msg.text()}`);
    }
  });

  page.on('pageerror', error => {
    console.log(`EXCEPTION: ${error.message}`);
  });

  await page.goto('http://localhost:5173/');
  await new Promise(r => setTimeout(r, 3000));
  
  await browser.close();
})();
