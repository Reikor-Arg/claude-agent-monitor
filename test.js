// Chequeo mínimo: node test.js
// Lo que se rompe en silencio es el marcador de salida — si deja de matchear,
// todo lo terminado vuelve a aparecer como colgado.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const core = require('./core.js');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-monitor-test-'));
const workspace = path.join(tmp, 'proyecto');
const tasks = path.join(tmp, 'claude', core.getSlug(workspace), 'sesion', 'tasks');
fs.mkdirSync(tasks, { recursive: true });
process.env.LOCALAPPDATA = '';
const realTmpdir = os.tmpdir;
os.tmpdir = () => tmp;

fs.writeFileSync(path.join(tasks, 'bcorriendo.output'), 'compilando...\n');
fs.writeFileSync(path.join(tasks, 'bterminada.output'), 'listo\n\n[exited with code 0]\n');
fs.writeFileSync(path.join(tasks, 'bfallada.output'), 'boom\n\n[exited with code 1]\n');

const { agents } = core.scan(workspace);
const ids = agents.map((a) => a.id).sort();

assert.deepStrictEqual(ids, ['bcorriendo'], `esperaba solo la que corre, salio: ${ids}`);
assert.strictEqual(agents[0].snippet, 'compilando...');
assert.strictEqual(agents[0].working, true);
assert.strictEqual(core.formatLine([]), null, 'sin agentes no se imprime nada');

os.tmpdir = realTmpdir;
fs.rmSync(tmp, { recursive: true, force: true });
console.log('ok');
