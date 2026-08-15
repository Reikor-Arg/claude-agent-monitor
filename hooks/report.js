// Hook PostToolUse: imprime el estado por systemMessage (se muestra al usuario,
// NO entra al contexto del modelo → 0 tokens).
// Dedupe: si la línea es igual a la anterior, no imprime nada. La UI descarta
// mensajes repetidos, y además evita ensuciar la pantalla en cada tool call.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { scan, formatLine } = require('../core.js');

let input = '';
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', () => {
  let cwd = process.cwd();
  let sessionId = 'default';
  try {
    const payload = JSON.parse(input);
    if (payload.cwd) cwd = payload.cwd;
    if (payload.session_id) sessionId = payload.session_id;
  } catch (e) {}

  let line;
  try {
    line = formatLine(scan(cwd).agents);
  } catch (e) {
    process.exit(0);
  }
  if (!line) process.exit(0);

  const stateFile = path.join(os.tmpdir(), `agent-monitor-${sessionId}.last`);
  try {
    if (fs.readFileSync(stateFile, 'utf8') === line) process.exit(0);
  } catch (e) {}
  try {
    fs.writeFileSync(stateFile, line);
  } catch (e) {}

  process.stdout.write(JSON.stringify({ systemMessage: line }));
  process.exit(0);
});
