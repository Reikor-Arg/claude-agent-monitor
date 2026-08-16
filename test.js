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

// Una muda desde hace 40 min: es el caso que el monitor existe para mostrar,
// y un corte por antiguedad la hacia desaparecer.
const vieja = path.join(tasks, 'bcolgada.output');
fs.writeFileSync(vieja, 'esperando respuesta del servidor\n');
const hace8min = new Date(Date.now() - 8 * 60 * 1000);
fs.utimesSync(vieja, hace8min, hace8min);

const { agents } = core.scan(workspace);
const ids = agents.map((a) => a.id).sort();

assert.deepStrictEqual(ids, ['bcolgada', 'bcorriendo'], `terminadas fuera, mudas dentro; salio: ${ids}`);

const colgada = agents.find((a) => a.id === 'bcolgada');
assert.strictEqual(colgada.level, 'stuck', 'a los 40 min tiene que estar en stuck');
assert.strictEqual(agents[0].id, 'bcolgada', 'lo trabado va primero');

const corriendo = agents.find((a) => a.id === 'bcorriendo');
assert.strictEqual(corriendo.snippet, 'compilando...');
assert.strictEqual(corriendo.working, true);
assert.strictEqual(corriendo.level, 'ok');

assert.ok(core.formatTable(agents).includes('1 possibly stuck'), 'la tabla avisa cuantas hay trabadas');
assert.strictEqual(core.formatLine([]), null, 'sin agentes no se imprime nada');

os.tmpdir = realTmpdir;
fs.rmSync(tmp, { recursive: true, force: true });
console.log('ok');
