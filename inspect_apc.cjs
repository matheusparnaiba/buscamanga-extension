async function run() {
  const res = await fetch('https://raw.githubusercontent.com/inkdex/extensions/master/0.9/stable/AllPornComic/index.js');
  const text = await res.text();
  
  // Find lines with 'Cloudflare detected' or 'throw'
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Cloudflare') || lines[i].includes('throw new Error(')) {
      console.log(`Line ${i+1}: ${lines[i]}`);
    }
  }
}
run();
