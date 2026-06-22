const puppeteer = require("puppeteer");

async function run() {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('response', async response => {
    if (response.url().includes('api/trpc') || response.url().includes('search')) {
      console.log('--- Network Response ---');
      console.log('URL:', decodeURIComponent(response.url()));
    }
  });

  console.log("Navigating to hipertoon search...");
  await page.goto("https://hipertoon.com/search?q=aniki", { waitUntil: 'networkidle0' });
  
  console.log("Done. Closing browser.");
  await browser.close();
}
run();
