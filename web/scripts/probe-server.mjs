import { spawn } from "node:child_process";
import http from "node:http";

const routes = [
  "/",
  "/models",
  "/simulator",
  "/about",
  "/data/results.json",
  "/data/profit_grid.json",
];

async function checkUrl(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        resolve({ status: res.statusCode, length: data.length });
      });
    }).on("error", reject);
  });
}

async function main() {
  console.log("Starting Next.js server on port 3000...");
  const server = spawn("npx.cmd", ["next", "start", "-p", "3000"], {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: true,
  });

  // Wait 4 seconds for server ready
  await new Promise((r) => setTimeout(r, 4000));

  let allOk = true;
  for (const route of routes) {
    const url = `http://localhost:3000${route}`;
    try {
      const { status, length } = await checkUrl(url);
      console.log(`PROBE ${route.padEnd(25)} -> HTTP ${status} (Bytes: ${length})`);
      if (status !== 200) allOk = false;
    } catch (err) {
      console.error(`PROBE ${route.padEnd(25)} -> ERROR: ${err.message}`);
      allOk = false;
    }
  }

  console.log("Shutting down Next.js server...");
  server.kill("SIGINT");
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error("Probe runner error:", err);
  process.exit(1);
});
