/** Reuse the user's existing iFinD skill credential locally, without printing it. */
const fs = require('node:fs');
const path = require('node:path');
const source = process.argv[2];
if (!source) { console.error('Usage: node scripts/configure-ifind-local.cjs <absolute-path-to-existing-mcp_config.json>'); process.exit(1); }
const config = JSON.parse(fs.readFileSync(source, 'utf8'));
if (typeof config.auth_token !== 'string' || config.auth_token.length < 20) throw new Error('Existing iFinD credential is missing or invalid');
const target = path.resolve(__dirname, '..', '.dev.vars');
let text = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
text = text.replace(/^IFIND_MCP_TOKEN=.*\r?\n?/gm, '');
fs.writeFileSync(target, text.trimEnd() + '\nIFIND_MCP_TOKEN=' + JSON.stringify(config.auth_token) + '\n', { mode: 0o600 });
console.log('Local credential configured in ignored .dev.vars. No credential value printed. Restart local preview to apply.');
