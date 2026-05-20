const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const PORT = 3000;

// Fetch the content of a public URL
function fetchURL(url) {
  return new Promise((resolve, reject) => {
    // Convert GitHub repo URLs to raw README
    let fetchUrl = url;
    const githubMatch = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/);
    if (githubMatch) {
      fetchUrl = `https://raw.githubusercontent.com/${githubMatch[1]}/${githubMatch[2]}/main/README.md`;
      console.log(`→ GitHub repo detected, fetching README: ${fetchUrl}`);
    }

    const lib = fetchUrl.startsWith("https") ? https : http;
    lib.get(fetchUrl, { headers: { "User-Agent": "LevelUp/1.0" } }, (res) => {
      // Follow redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchURL(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to fetch URL — status ${res.statusCode}`));
      }
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => resolve(data.slice(0, 12000))); // cap at 12k chars so prompt stays manageable
    }).on("error", reject);
  });
}

// Run a prompt through claude -p and return the response
function runClaude(prompt) {
  return new Promise((resolve, reject) => {
    const escaped = prompt.replace(/'/g, `'\\''`);
    exec(`echo '${escaped}' | claude -p`, { maxBuffer: 1024 * 1024 * 10 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout.trim());
    });
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Serve the HTML file
  if (req.method === "GET") {
    const filePath = path.join(__dirname, "level-up.html");
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("level-up.html not found — make sure it's in the same folder as server.js");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(data);
    });
    return;
  }

  // Handle POST — fetch URL then proxy to claude -p
  if (req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const { prompt, url } = JSON.parse(body);

        let finalPrompt = prompt;

        // If a URL was provided, fetch its content and inject into the prompt
        if (url) {
          console.log(`→ Fetching: ${url}`);
          const content = await fetchURL(url);
          console.log(`← Got ${content.length} chars of content`);

          finalPrompt = `${prompt}

Here is the actual content from that URL:

---
${content}
---

Base your skill cards on what you actually find in the content above.`;
        }

        console.log("→ Running claude -p...");
        const result = await runClaude(finalPrompt);
        console.log("← Done.");

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ text: result }));

      } catch (err) {
        console.error("Error:", err.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(405);
  res.end("Method not allowed");
});

server.listen(PORT, () => {
  console.log(`\nLevel Up is running.`);
  console.log(`Open this in your browser: http://localhost:${PORT}\n`);
});
