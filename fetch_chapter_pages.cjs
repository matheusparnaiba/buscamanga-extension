async function run() {
  const url = `https://hipertoon.com/api/trpc/reader.chapterPages?batch=1&input=${encodeURIComponent('{"0":{"json":{"seriesSlug":"aniki-no-kanojo-ni-naru-onnanoko-ni-nacchatta-otouto","chapterNumber":21.5}}}')}`;
  const res = await fetch(url);
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
}
run();
