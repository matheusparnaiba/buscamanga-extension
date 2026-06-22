async function check() {
  try {
    const res = await fetch("https://hipertoon.com/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      }
    });
    console.log("Status:", res.status);
    console.log("Server:", res.headers.get("server"));
  } catch (err) {
    console.log("Error:", err.message);
  }
}
check();
