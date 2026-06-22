const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  const trpcCalls = [];

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/trpc')) {
      try {
        const text = await response.text();
        trpcCalls.push({ url, response: text.substring(0, 1000) });
      } catch (e) {
        trpcCalls.push({ url, error: e.message });
      }
    }
  });

  await page.goto('https://hipertoon.com', { waitUntil: 'networkidle2' });
  
  console.log(JSON.stringify(trpcCalls, null, 2));

  await browser.close();
})();
