async function check() {
  const hash = "cb667c376085b54642b70ab815636582";
  const urls = [
    `https://cdn.hipertoon.com/storage/chapters/${hash}/1.webp`,
    `https://cdn.hipertoon.com/storage/chapters/${hash}/01.webp`,
    `https://cdn.hipertoon.com/storage/chapters/${hash}/0.webp`,
    `https://cdn.hipertoon.com/storage/chapters/${hash}/00.webp`,
    `https://cdn.hipertoon.com/storage/chapters/${hash}/1.jpg`,
    `https://cdn.hipertoon.com/storage/chapters/${hash}/01.jpg`
  ];
  
  for (const url of urls) {
    const res = await fetch(url, { method: "HEAD" });
    console.log(res.status, url);
  }
}
check();
