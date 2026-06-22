async function run() {
  const url = `https://hipertoon.com/api/trpc/search.query?batch=1&input=${encodeURIComponent('{"0":{"json":{"q":"aniki","sort":"relevance","filters":{"genres":null,"type":null,"status":null,"contentRating":null},"limit":30,"offset":0},"meta":{"values":{"filters.genres":["undefined"],"filters.type":["undefined"],"filters.status":["undefined"],"filters.contentRating":["undefined"]}}}}')}`;
  const res = await fetch(url);
  const json = await res.json();
  console.log(JSON.stringify(json[0].result.data.json.items[0], null, 2));
}
run();
