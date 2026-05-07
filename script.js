/* SCRIPTS */

let pyodide = null;

async function initKernel() {
  try {
    pyodide = await loadPyodide();
    await pyodide.loadPackage("numpy");
    document.getElementById('loading-screen').style.display = 'none';
    const inp = document.getElementById('terminal-input');
    inp.disabled = false;
    inp.focus();
  } catch (err) {
    document.getElementById('ls-text').textContent = 'Error: ' + err.message;
    const spinner = document.querySelector('.ls-spinner');
    if (spinner) spinner.style.display = 'none';
  }
}

function toBinary(str) {
  return [...str.slice(0, 64)].map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
}

async function typewriter(el, text, delay) {
  el.textContent = '';
  for (const ch of text) {
    el.textContent += ch;
    await new Promise(r => setTimeout(r, delay));
  }
}

function spawnParticles(mode = 'hit') {
  const canvas = document.getElementById('hardware-canvas');
  const hitColors  = ['#E879F9', '#ffffff'];
  const missColors = ['#f87171', '#dc2626'];
  const colors   = mode === 'miss' ? missColors : hitColors;
  const interval = mode === 'miss' ? 40 : 15;
  for (let i = 0; i < 30; i++) {
    setTimeout(() => {
      const p = document.createElement('div');
      p.className = 'hw-particle';
      p.style.left = (Math.random() * 95) + '%';
      p.style.top = (Math.random() * 20) + '%';
      p.style.background = colors[i % 2];
      p.style.animationDuration = (0.5 + Math.random() * 0.6) + 's';
      canvas.appendChild(p);
      p.addEventListener('animationend', () => p.remove(), { once: true });
    }, i * interval);
  }
}

function generarExplicacion(codigoUsuario, bytecode, latenciaActivada, tiempoEjecucion) {
  const partes = [];

  if (/\bimport\b/.test(codigoUsuario)) {
    partes.push('El sistema operativo cargó un módulo externo en la memoria del proceso.');
  }
  if (/[+\-*/]/.test(codigoUsuario)) {
    partes.push('La Unidad Aritmético Lógica (ALU) del procesador ejecutó una operación de cálculo.');
  }
  if (/[\[\]]|\bfor\b/.test(codigoUsuario)) {
    partes.push('El gestor de memoria realizó asignación dinámica para estructuras iterativas o de lista.');
  }

  const instrucciones = bytecode.split('\n').filter(l => /^\s+\d+/.test(l)).length;
  partes.push(`El compilador CPython tradujo esta abstracción en <strong>${instrucciones}</strong> instrucciones de bajo nivel.`);

  if (latenciaActivada) {
    partes.push(`<span style="color:#f87171"><strong>Cache Miss detectado.</strong> El procesador falló al predecir la ubicación del dato, obligando a las señales eléctricas a viajar hasta la memoria principal (RAM). El tiempo se disparó a <strong>${tiempoEjecucion} ms</strong>.</span>`);
  } else {
    partes.push(`<span style="color:#34d399"><strong>Cache Hit exitoso.</strong> Los datos estaban precargados en la memoria ultrarrápida L1. Las señales eléctricas se mantuvieron en el núcleo del procesador, logrando un tiempo de <strong>${tiempoEjecucion} ms</strong>.</span>`);
  }

  return partes.map(p => `<p style="margin:0.25rem 0">${p}</p>`).join('');
}

function updateAnalysisPanel(bytecode, resultStr, isMiss, codigoUsuario, execMs) {
  const panel = document.getElementById('analisis-dinamico');
  if (!panel) return;
  panel.style.opacity = '0';

  const opcodeMatches = [...bytecode.matchAll(/^\s+\d+\s+([A-Z_]+)/gm)].map(m => m[1]);
  const uniqueOpcodes = [...new Set(opcodeMatches)].slice(0, 6);
  const opcodesHtml = uniqueOpcodes.length
    ? uniqueOpcodes.map(op => `<span class="opcode-tag">${op}</span>`).join('')
    : '<span style="color:#4a6a8a">—</span>';

  let typeLabel = '';
  let resultHtml = '';
  if (resultStr === null) {
    resultHtml = '<span style="color:#4a6a8a">Sin valor de retorno</span>';
  } else {
    if (/^-?\d+$/.test(resultStr))          typeLabel = 'int';
    else if (/^-?\d+\.\d+$/.test(resultStr)) typeLabel = 'float';
    else if (/^(True|False)$/.test(resultStr)) typeLabel = 'bool';
    else if (/^\[/.test(resultStr))          typeLabel = 'list';
    else if (/^\{/.test(resultStr))          typeLabel = 'dict/set';
    else if (/^['"]/.test(resultStr))        typeLabel = 'str';
    else                                     typeLabel = 'object';
    resultHtml = `<span style="color:#a7f3d0">${resultStr}</span>`
      + (typeLabel ? ` <span style="color:#4a6a8a; font-size:0.6rem">(${typeLabel})</span>` : '');
  }

  const modeHtml = isMiss
    ? '<span style="color:#f87171">✗ Cache Miss</span> — datos no encontrados en L1/L2/L3. Búsqueda en RAM añadió ~400 ms de latencia.'
    : '<span style="color:#34d399">✓ L1 Cache Hit</span> — datos encontrados en caché L1. Latencia: ~1–3 ms.';

  const explicacionHtml = generarExplicacion(codigoUsuario, bytecode, isMiss, execMs);

  panel.innerHTML = `
    <div class="analysis-card">
      <span class="card-label">Opcodes Ejecutados</span>
      <div class="card-body">${opcodesHtml}</div>
    </div>
    <div class="analysis-card">
      <span class="card-label">Resultado</span>
      <div class="card-body">${resultHtml}</div>
    </div>
    <div class="analysis-card">
      <span class="card-label">Modo de Caché</span>
      <div class="card-body">${modeHtml}</div>
    </div>
    <div class="analysis-card" style="flex:0 0 100%">
      <span class="card-label">Análisis</span>
      <div class="card-body">${explicacionHtml}</div>
    </div>`;
  panel.style.opacity = '1';
}

async function animatePipeline(bytecode, resultStr, value) {
  const isMiss = document.getElementById('sim-toggle')?.checked ?? false;

  const bcContent   = document.querySelector('#hw-bytecode .hw-content');
  const binContent  = document.querySelector('#hw-binary .hw-content');
  const coreContent = document.querySelector('#hw-core .hw-content');
  bcContent.textContent   = '';
  binContent.textContent  = '';
  coreContent.textContent = '';

  await typewriter(bcContent, bytecode, 6);

  const binStr = toBinary(resultStr !== null ? resultStr : value);
  [...binStr].forEach((ch, i) => {
    const span = document.createElement('span');
    span.className = 'hw-rain-char';
    span.textContent = ch;
    span.style.animationDelay = (i * 8) + 'ms';
    binContent.appendChild(span);
  });

  spawnParticles(isMiss ? 'miss' : 'hit');

  const blocks = document.querySelectorAll('#memory-simulator .mem-block');
  const execMs = isMiss ? 400 : (1 + Math.floor(Math.random() * 3));

  if (isMiss) {
    blocks.forEach((b, i) => {
      setTimeout(() => {
        b.classList.add('pulse-miss');
        setTimeout(() => b.classList.remove('pulse-miss'), 800);
      }, i * 180);
    });
    coreContent.textContent = 'EXEC OK  ~' + execMs + 'ms';
  } else {
    blocks[0]?.classList.add('pulse-hit');
    blocks[1]?.classList.add('pulse-hit');
    setTimeout(() => {
      blocks[0]?.classList.remove('pulse-hit');
      blocks[1]?.classList.remove('pulse-hit');
    }, 400);
    coreContent.textContent = 'EXEC OK  ~' + execMs + 'ms';
  }

  updateAnalysisPanel(bytecode, resultStr, isMiss, value, execMs);
}

(function () {
  const output = document.getElementById('terminal-output');
  const input  = document.getElementById('terminal-input');

  function buildPrompt() {
    return (
      '<span class="prompt-user">>>></span>'
    );
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function appendLine(html) {
    const div = document.createElement('div');
    div.className = 'line';
    div.innerHTML = html;
    output.appendChild(div);
    output.scrollTop = output.scrollHeight;
  }

  input.addEventListener('keydown', async function (e) {
    if (e.key !== 'Enter') return;
    var value = input.value.trim();
    if (value === '') return;
    output.innerHTML = '';

    appendLine(buildPrompt() + '<span style="color:#a7f3d0">' + escapeHtml(value) + '</span>');
    input.value = '';
    input.disabled = true;

    try {
      const result = await pyodide.runPythonAsync(value);
      const resultStr = (result !== undefined && result !== null) ? String(result) : null;
      if (resultStr !== null) {
        if (document.getElementById('sim-toggle')?.checked) {
          await new Promise(r => setTimeout(r, 400));
        }
        appendLine('<span style="color:#a7f3d0">' + escapeHtml(resultStr) + '</span>');
      }

      pyodide.globals.set('__user_code', value);
      const bytecode = await pyodide.runPythonAsync(
        "import dis, io; buf = io.StringIO(); dis.dis(__user_code, file=buf); buf.getvalue()"
      );

      console.log('[result]', resultStr);
      console.log('[bytecode]', bytecode);
      await animatePipeline(bytecode + "\n\n\n\n", resultStr, value);
    } catch (err) {
      appendLine('<span style="color:#f87171">' + escapeHtml(String(err)) + '</span>');
    } finally {
      input.disabled = false;
      input.focus();
    }
  });

  input.focus();
})();

window.addEventListener('load', initKernel);

(function () {
  const input = document.getElementById('terminal-input');

  function runSnippet(code) {
    input.value = code;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }

  document.getElementById('btn-esfera').addEventListener('click', function () {
    const val = prompt('Radio de la esfera:');
    if (val === null) return;
    runSnippet(`import math; r = ${val}; print(f"Volumen de esfera (r=${val}): {(4/3) * math.pi * ${val}**3:.2f}")`);
  });

  document.getElementById('btn-ast').addEventListener('click', function () {
    const val = prompt('Expresión Python (ej. x=5):');
    if (val === null) return;
    runSnippet(`import ast; print(ast.dump(ast.parse("${val}")))`);
  });

  document.getElementById('btn-fib').addEventListener('click', function () {
    const val = prompt('Número N:');
    if (val === null) return;
    runSnippet(`def fib(n): return n if n<=1 else fib(n-1)+fib(n-2); print(f"Fibonacci de ${val}: {fib(${val})}")`);
  });
})();

(function () {
  const toggle      = document.getElementById('sim-toggle');
  const timerDisplay = document.getElementById('timer-display');
  const blocks      = document.querySelectorAll('#memory-simulator .mem-block');

  const CODE_SEQ = `
data = list(range(1_000_000))
s = 0
for x in data:
    s += x
s
`;

  const CODE_RAND = `
import random
data = list(range(1_000_000))
indices = list(range(1_000_000))
random.shuffle(indices)
s = 0
for i in indices:
    s += data[i]
s
`;

  function animateHit() {
    return new Promise(resolve => {
      blocks[0].classList.add('pulse-hit');
      blocks[1].classList.add('pulse-hit');
      setTimeout(() => {
        blocks[0].classList.remove('pulse-hit');
        blocks[1].classList.remove('pulse-hit');
        resolve();
      }, 400);
    });
  }

  function animateMiss() {
    return new Promise(resolve => {
      blocks.forEach((block, i) => {
        setTimeout(() => {
          block.classList.add('pulse-miss');
          setTimeout(() => block.classList.remove('pulse-miss'), 800);
        }, i * 180);
      });
      setTimeout(resolve, 720 + 800);
    });
  }

  toggle.addEventListener('change', async function () {
    if (pyodide === null) return;
    toggle.disabled = true;
    timerDisplay.textContent = 'Calculando…';
    try {
      const code = toggle.checked ? CODE_RAND : CODE_SEQ;
      const t0 = performance.now();
      await pyodide.runPythonAsync(code);
      timerDisplay.textContent = (performance.now() - t0).toFixed(1) + ' ms';
      await (toggle.checked ? animateMiss() : animateHit());
    } catch (err) {
      timerDisplay.textContent = 'Error';
    } finally {
      toggle.disabled = false;
    }
  });
})();
