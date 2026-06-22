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

  console.log("Navigating to hipertoon chapter page...");
  await page.goto("https://hipertoon.com/manga/aniki-no-kanojo-ni-naru-onnanoko-ni-nacchatta-otouto/capitulo-21.5", { waitUntil: 'networkidle0' });
  
  // WAIT a bit for any lazy loaded images or API calls
  await new Promise(r => setTimeout(r, 5000));
  
  console.log("Done. Closing browser.");
  await browser.close();
}
run();
