const fs = require('fs');
const path = require('path');

const wranglerPath = path.join(__dirname, '../dist/server/wrangler.json');

if (fs.existsSync(wranglerPath)) {
  console.log('Patching wrangler.json for Cloudflare Pages compatibility...');
  const data = fs.readFileSync(wranglerPath, 'utf8');
  const config = JSON.parse(data);

  // 1. Remove reserved assets binding
  if (config.assets) {
    console.log('Removing assets binding...');
    delete config.assets;
  }

  // 2. Remove KV namespaces causing validation errors
  if (config.kv_namespaces) {
    console.log('Removing kv_namespaces...');
    delete config.kv_namespaces;
  }

  // 3. Remove main, rules, and images (not supported by Pages)
  const fieldsToRemove = [
    'main',
    'rules',
    'images',
    'previews',
    'dev',
    'definedEnvironments',
    'exports',
    'ai_search_namespaces',
    'ai_search',
    'agent_memory',
    'secrets_store_secrets',
    'artifacts',
    'unsafe_hello_world',
    'flagship',
    'worker_loaders',
    'ratelimits',
    'vpc_services',
    'vpc_networks',
    'python_modules'
  ];

  fieldsToRemove.forEach(field => {
    if (field in config) {
      console.log(`Removing unsupported field: ${field}...`);
      delete config[field];
    }
  });

  // Write back the modified configuration
  fs.writeFileSync(wranglerPath, JSON.stringify(config), 'utf8');
  console.log('wrangler.json successfully patched for Cloudflare Pages!');
} else {
  console.log('dist/server/wrangler.json not found, skipping patch.');
}
