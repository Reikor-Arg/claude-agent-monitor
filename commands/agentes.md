---
description: Muestra los agentes y tareas en segundo plano que están corriendo ahora
allowed-tools: Bash(node:*)
---

Estado actual de los agentes:

!`node "${CLAUDE_PLUGIN_ROOT}/core.js" --table "$PWD"`

Mostrá esa tabla tal cual. Si hay alguno marcado 🔴 sin output hace varios
minutos, señalalo: es candidato a estar colgado.
