/** Verify that local runtime secrets are absent from publishable source and built output. */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
const values = [];
if (existsSync('.dev.vars')) {
  for (const line of readFileSync('.dev.vars', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^(IFIND_MCP_TOKEN|MODEL_API_KEY)=(.+)$/);
    if (!match) continue;
    let value = match[2].trim(); try { value = JSON.parse(value); } catch { /* dotenv bare string */ }
    if (typeof value === 'string' && value.length > 15) values.push(value);
  }
}
const sources = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const files = new Set(sources);
function collect(directory) {
  if (!existsSync(directory)) return;
  for (const name of readdirSync(directory)) {
    const file = path.join(directory, name); const stat = statSync(file);
    if (stat.isDirectory()) collect(file); else files.add(file);
  }
}
collect('dist');
const leaked = [];
for (const file of files) {
  if (!existsSync(file) || !statSync(file).isFile()) continue;
  if (/^\.dev\.vars|^\.env(?!\.example$)/.test(file.replaceAll('\\', '/'))) { leaked.push(file); continue; }
  const bytes = readFileSync(file);
  if (values.some(value => bytes.includes(Buffer.from(value)))) leaked.push(file);
}
if (leaked.length) { console.error('Local secret found in publishable files:', leaked.join(', ')); process.exitCode = 1; }
else console.log(`Secret check passed for ${files.size} source/build files. Credential values were not printed.`);
