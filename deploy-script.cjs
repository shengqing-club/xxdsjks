const fs = require("fs");
const https = require("https");

const TOKEN = "nfc_tVus6xqfzogFX8B8ik7YZWTAcyo95b26b97d";
const SITE_ID = "532a093a-47ad-4bc0-8bb4-716f00636921";

function api(method, urlPath, body, contentType) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.netlify.com",
      path: urlPath,
      method: method,
      headers: {
        "Authorization": "Bearer " + TOKEN,
        "User-Agent": "WorkBuddy-Deploy/1.0"
      }
    };
    if (contentType) options.headers["Content-Type"] = contentType;
    if (body) options.headers["Content-Length"] = Buffer.byteLength(body);

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function deploy() {
  console.log("Creating deploy...");
  const zipPath = __dirname + "/deploy.zip";
  const zipBuffer = fs.readFileSync(zipPath);
  console.log("Zip size:", (zipBuffer.length / 1024 / 1024).toFixed(2), "MB");

  const result = await api("POST", "/api/v1/sites/" + SITE_ID + "/deploys", zipBuffer, "application/zip");
  console.log("Status:", result.status);

  if (result.body && result.body.id) {
    console.log("Deploy ID:", result.body.id);
    console.log("State:", result.body.state);
    if (result.body.deploy_ssl_url) console.log("Deploy URL:", result.body.deploy_ssl_url);
    if (result.body.ssl_url) console.log("Site URL:", result.body.ssl_url);
    if (result.body.published_at) console.log("Published:", result.body.published_at);
  } else {
    console.log("Response:", JSON.stringify(result.body, null, 2));
  }
}

deploy().catch(err => { console.error("Error:", err.message); process.exit(1); });
