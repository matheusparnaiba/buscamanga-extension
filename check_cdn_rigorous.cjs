async function check() {
  const hash = "cb667c376085b54642b70ab815636582";
  const exts = ["webp", "jpg", "png"];
  const names = ["0", "1", "00", "01", "000", "001", "page_1", "p1"];
  
  for (const ext of exts) {
    for (const name of names) {
      const url = `https://cdn.hipertoon.com/storage/chapters/${hash}/${name}.${ext}`;
      try {
        const res = await fetch(url, { method: "HEAD" });
        if (res.status === 200) {
          console.log("FOUND:", url);
          return;
        }
      } catch (e) {}
    }
  }
  console.log("Not found any standard pattern.");
}
check();
