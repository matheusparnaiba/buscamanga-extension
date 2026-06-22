const puppeteer = require("puppeteer");

async function run() {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  // Intercept network requests
  page.on('request', request => {
    if (request.url().includes('api/trpc')) {
      console.log('--- TRPC Request ---');
      console.log('URL:', decodeURIComponent(request.url()));
      console.log('Method:', request.method());
    }
  });

  page.on('response', async response => {
    if (response.url().includes('api/trpc')) {
      console.log('--- TRPC Response ---');
      console.log('URL:', decodeURIComponent(response.url()));
      try {
        const text = await response.text();
        console.log('Response:', text.substring(0, 500));
      } catch (e) {
        console.log('Could not read response');
      }
    }
  });

  console.log("Navigating to hipertoon...");
  await page.goto("https://hipertoon.com/", { waitUntil: 'networkidle0' });
  
  console.log("Done. Closing browser.");
  await browser.close();
}
run();
