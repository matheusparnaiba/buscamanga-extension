const puppeteer = require("puppeteer");

async function run() {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('response', async response => {
    if (response.url().includes('api/trpc')) {
      console.log('--- TRPC Response ---');
      console.log('URL:', decodeURIComponent(response.url()));
      try {
        const text = await response.text();
        console.log('Response:', text.substring(0, 1000));
      } catch (e) {
        console.log('Could not read response');
      }
    }
  });

  console.log("Navigating to hipertoon manga page...");
  await page.goto("https://hipertoon.com/manga/aniki-no-kanojo-ni-naru-onnanoko-ni-nacchatta-otouto", { waitUntil: 'networkidle0' });
  
  console.log("Done. Closing browser.");
  await browser.close();
}
run();
