async function run() {
  const url = "https://hipertoon.com/api/trpc/auth.me,recommendations.trending,recommendations.latestChapters,recommendations.newlyAdded?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%2C%22meta%22%3A%7B%22values%22%3A%5B%22undefined%22%5D%7D%7D%2C%221%22%3A%7B%22json%22%3A%7B%22limit%22%3A20%7D%7D%2C%222%22%3A%7B%22json%22%3A%7B%22limit%22%3A20%7D%7D%2C%223%22%3A%7B%22json%22%3A%7B%22limit%22%3A10%7D%7D%7D";
  const res = await fetch(url);
  const data = await res.json();
  console.log("Trending:");
  console.log(data[1]?.result?.data?.json.slice(0,1));
  console.log("Latest Chapters:");
  console.log(data[2]?.result?.data?.json.slice(0,1));
}
run();
