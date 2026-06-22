async function run() {
  const res = await fetch("https://sakuramangas.org", {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
    },
  });
  console.log("Status: ", res.status);
  console.log("URL: ", res.url);
  const text = await res.text();
  console.log("Length: ", text.length);
  if (text.includes("Just a moment")) {
    console.log("Cloudflare Challenge detected!");
  }
}
run();
