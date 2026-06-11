const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const TOKEN = 'nfc_tVus6xqfzogFX8B8ik7YZWTAcyo95b26b97d';
const SITE_ID = '532a093a-47ad-4bc0-8bb4-716f00636921';
const BASE = __dirname;

// Step 1: Create temp directory
const tmpDir = path.join(BASE, 'netlify-deploy-tmp');
if (fs.existsSync(tmpDir)) {
  execSync('cmd /c rmdir /s /q "' + tmpDir + '"', { stdio: 'pipe' });
}
fs.mkdirSync(tmpDir, { recursive: true });
fs.mkdirSync(path.join(tmpDir, '.netlify', 'functions-internal'), { recursive: true });

// Step 2: Copy dist using robocopy (more reliable than xcopy)
console.log('Copying dist files...');
const distPath = path.join(BASE, 'dist');
try {
  execSync('robocopy "' + distPath + '" "' + tmpDir + '" /E /NFL /NDL /NJH /NJS', { stdio: 'pipe' });
} catch(e) {
  // robocopy returns exit codes 0-7 as success
  if (e.status > 7) throw e;
}
console.log('Dist copied successfully');

// Step 3: Zip the bundled function
console.log('Creating function zip...');
const funcDest = path.join(tmpDir, '.netlify', 'functions-internal', 'api.zip');
const funcSrc = path.join(BASE, 'netlify', 'functions', 'api-bundled.js');
execSync('powershell -Command "Compress-Archive -Path \'' + funcSrc + '\' -DestinationPath \'' + funcDest + '\' -Force"', { stdio: 'pipe' });
console.log('Function zip size:', fs.statSync(funcDest).size, 'bytes');

// Step 4: Zip the entire deploy
console.log('Creating deploy zip...');
const deployZipPath = path.join(BASE, 'deploy-full.zip');
if (fs.existsSync(deployZipPath)) fs.unlinkSync(deployZipPath);
execSync('powershell -Command "Compress-Archive -Path \'' + tmpDir + '/*\' -DestinationPath \'' + deployZipPath + '\' -Force"', { stdio: 'pipe' });
console.log('Deploy zip size:', (fs.statSync(deployZipPath).size / 1024 / 1024).toFixed(2), 'MB');

// Step 5: Upload
console.log('Uploading to Netlify...');
const zipBuffer = fs.readFileSync(deployZipPath);

function api(method, urlPath, body, contentType) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.netlify.com',
      path: urlPath,
      method: method,
      headers: {
        'Authorization': 'Bearer ' + TOKEN,
        'User-Agent': 'WorkBuddy-Deploy/1.0'
      }
    };
    if (contentType) opts.headers['Content-Type'] = contentType;
    if (body) opts.headers['Content-Length'] = Buffer.byteLength(body);
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

api('POST', '/api/v1/sites/' + SITE_ID + '/deploys', zipBuffer, 'application/zip').then(result => {
  console.log('Status:', result.status);
  if (result.body && result.body.id) {
    console.log('Deploy ID:', result.body.id);
    console.log('State:', result.body.state);
    console.log('Site URL:', result.body.ssl_url || result.body.url);
    if (result.body.deploy_ssl_url) console.log('Preview:', result.body.deploy_ssl_url);
  } else {
    console.log('Response:', JSON.stringify(result.body, null, 2));
  }
  // Cleanup
  try {
    execSync('cmd /c rmdir /s /q "' + tmpDir + '"', { stdio: 'pipe' });
    if (fs.existsSync(deployZipPath)) fs.unlinkSync(deployZipPath);
  } catch(e) {}
}).catch(err => {
  console.error('Error:', err.message);
});
