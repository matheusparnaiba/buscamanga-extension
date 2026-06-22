async function run() {
  const res = await fetch('https://api.github.com/repos/inkdex/extensions/git/trees/master?recursive=1', {
    headers: { 'User-Agent': 'Node' }
  });
  const data = await res.json();
  if (data.tree) {
    const apcFiles = data.tree.filter(f => f.path.includes('AllPornComic'));
    console.log(apcFiles.map(f => f.path).join('\n'));
  } else {
    console.log(data);
  }
}
run();
