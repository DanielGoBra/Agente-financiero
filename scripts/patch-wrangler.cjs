const fs = require('fs');
const path = require('path');

const wranglerPath = path.join(__dirname, '../dist/server/wrangler.json');

if (fs.existsSync(wranglerPath)) {
  console.log('Patching wrangler.json for Cloudflare Pages compatibility...');
  const data = fs.readFileSync(wranglerPath, 'utf8');
  const config = JSON.parse(data);

  // Remove reserved assets binding to avoid "The name 'ASSETS' is reserved in Pages projects" error
  if (config.assets) {
    console.log('Removing assets binding...');
    delete config.assets;
  }

  // Remove SESSION kv namespace without ID to avoid "bindings should have a string 'id' field" error
  if (config.kv_namespaces) {
    console.log('Removing kv_namespaces...');
    delete config.kv_namespaces;
  }
  if (config.previews && config.previews.kv_namespaces) {
    console.log('Removing preview kv_namespaces...');
    delete config.previews.kv_namespaces;
  }

  // Write back the modified configuration
  fs.writeFileSync(wranglerPath, JSON.stringify(config), 'utf8');
  console.log('wrangler.json successfully patched!');
} else {
  console.log('dist/server/wrangler.json not found, skipping patch.');
}
