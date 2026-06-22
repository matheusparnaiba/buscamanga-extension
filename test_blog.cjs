const fs = require('fs');

async function checkSlime() {
  try {
    console.log("Checking home /wp-json/slimeread/v1/home...");
    let res = await fetch("https://mangalivre.blog/wp-json/slimeread/v1/home");
    console.log("Status:", res.status);
    let text = await res.text();
    console.log("Response:", text.substring(0, 200));

    console.log("Checking recent /wp-json/slimeread/v1/recent...");
    res = await fetch("https://mangalivre.blog/wp-json/slimeread/v1/recent");
    console.log("Status:", res.status);
    text = await res.text();
    console.log("Response:", text.substring(0, 200));
  } catch (err) {
    console.log("Error:", err.message);
  }
}
checkSlime();
