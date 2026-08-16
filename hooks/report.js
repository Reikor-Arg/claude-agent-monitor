// Hook PostToolUse. Dos salidas distintas, a propósito:
//   systemMessage    -> lo ve el usuario, NO entra al contexto (0 tokens)
//   additionalContext -> entra al contexto del agente principal, y por eso solo
//                        se manda cuando hay algo trabado, con el id pelado.
// Dedupe por sesión: si el texto no cambió respecto de la vez anterior, no se
// imprime nada. Sin eso, cada tool call repetiría lo mismo.
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
    const payload = JSON.parse(input.replace(/^\uFEFF/, ''));
    if (payload.cwd) cwd = payload.cwd;
    if (payload.session_id) sessionId = payload.session_id;
  } catch (e) {}

  let agents;
  try {
    agents = scan(cwd).agents;
  } catch (e) {
    process.exit(0);
  }

  const line = formatLine(agents);
  if (!line) process.exit(0);

  // Solo los ids. El tiempo y el detalle ya están en el panel; acá cada palabra
  // se paga en cada turno del agente principal.
  const mudos = agents.filter((a) => a.level !== 'ok');
  // Sin la orden al final el aviso se lee y se ignora: informa pero no pide nada.
  const aviso = mudos.length ? `STUCK? ${mudos.map((a) => a.id).join(' ')} - check tail, then kill or wait` : '';

  const stateFile = path.join(os.tmpdir(), `agent-monitor-${sessionId}.last`);
  const huella = `${line}||${aviso}`;
  try {
    if (fs.readFileSync(stateFile, 'utf8') === huella) process.exit(0);
  } catch (e) {}
  try {
    fs.writeFileSync(stateFile, huella);
  } catch (e) {}

  const salida = { systemMessage: line };
  if (aviso) {
    salida.hookSpecificOutput = {
      hookEventName: 'PostToolUse',
      additionalContext: aviso
    };
  }
  process.stdout.write(JSON.stringify(salida));
  process.exit(0);
});
