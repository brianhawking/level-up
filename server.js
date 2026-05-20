const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const PORT = 3000;

// Fetch the content of a public URL
function fetchURL(url) {
  return new Promise((resolve, reject) => {
    let fetchUrl = url;
    const githubMatch = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/);
    if (githubMatch) {
      fetchUrl = `https://raw.githubusercontent.com/${githubMatch[1]}/${githubMatch[2]}/main/README.md`;
      console.log(`→ GitHub repo detected, fetching README: ${fetchUrl}`);
    }

    const lib = fetchUrl.startsWith("https") ? https : http;
    lib.get(fetchUrl, { headers: { "User-Agent": "LevelUp/1.0" } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchURL(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to fetch URL — status ${res.statusCode}`));
      }
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => resolve(data.slice(0, 12000)));
    }).on("error", reject);
  });
}

// Run a prompt through claude -p
function runClaude(prompt) {
  return new Promise((resolve, reject) => {
    const escaped = prompt.replace(/'/g, `'\\''`);
    exec(`echo '${escaped}' | claude -p`, { maxBuffer: 1024 * 1024 * 10 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout.trim());
    });
  });
}

// Check if profile.json exists
function hasProfile() {
  return fs.existsSync(path.join(__dirname, "profile.json"));
}

// Read profile
function getProfile() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "profile.json"), "utf8"));
  } catch {
    return null;
  }
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

  if (req.method === "GET") {

    // Serve profile.json as API endpoint
    if (req.url === "/profile") {
      if (!hasProfile()) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "No profile found" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(fs.readFileSync(path.join(__dirname, "profile.json")));
      return;
    }

    // Route to landing or app based on profile
    const htmlFile = hasProfile() ? "index.html" : "landing.html";
    const filePath = path.join(__dirname, htmlFile);

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end(`${htmlFile} not found — make sure it's in the same folder as server.js`);
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(data);
    });
    return;
  }

  // POST — fetch URL then proxy to claude -p
  if (req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const { prompt, url } = JSON.parse(body);

        let finalPrompt = prompt;

        if (url) {
          console.log(`→ Fetching: ${url}`);
          const content = await fetchURL(url);
          console.log(`← Got ${content.length} chars`);
          finalPrompt = `${prompt}\n\nHere is the actual content from that URL:\n\n---\n${content}\n---\n\nBase your response only on what you actually find in the content above.`;
        }

        // Inject profile context if available
        const profile = getProfile();
        if (profile) {
          finalPrompt = `Developer profile context:\n${JSON.stringify(profile, null, 2)}\n\n${finalPrompt}`;
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
  console.log(`\nLevel Up is running at http://localhost:${PORT}`);
  if (hasProfile()) {
    const p = getProfile();
    console.log(`Profile loaded: ${p.name || "unknown"} — ${p.role || "unknown role"}`);
  } else {
    console.log(`No profile found — landing page will be shown.`);
    console.log(`Run /onboard in Claude Code to get started.`);
  }
  console.log("");
});
