/* The lamp (2026-11-23): a slow lava-lamp field behind the page sections that follow the
   flight. Wax blobs rise when warm and sink when cool, brush past each other, merge and
   part. The pointer is warm: nearby blobs lean toward it and melt into a small spot that
   trails it, and a quick pass drags them along. Scrolling stirs them a little; on a phone a
   touch warms the spot for a moment.

   One simulation, one WebGL shader. Anthony saw three ways of drawing it as mock-ups and
   said "Looks good"; the page uses Lamp at Medium (what the mock-up opened on). The other
   two are still here for his phone test and can go once he has settled:
     ?bg=pick                 shows a small test panel (looks and strengths), and moves even
                              when the device has Reduce Motion on
     ?bg=off|lamp|glow|lines  one look, no panel        &strength=1|2|3

   Care taken:
     - It only runs while the page sections are on screen, never during the flight.
     - Reduce Motion: it moves by itself, so it holds still (one settled picture).
     - No WebGL, or ?bg=off: nothing is added and the page is exactly as it was.
     - Phones: drawn at no more than 1.25x and 30 frames a second.
   The layer's CSS (and the prices panel turning to smoked glass) is in site.css.
   window.__lamp is read only by the checks (work/qa/2026-11-23/lamp.cjs). */
(function () {
  'use strict';
  var page = document.getElementById('main');
  if (!page || !window.URLSearchParams) return;

  var q = new URLSearchParams(location.search);
  var LOOKS = ['off', 'lamp', 'glow', 'lines'];
  var NAMES = { off: 'Off', lamp: 'Lamp', glow: 'Glow', lines: 'Lines' };
  var pick = q.get('bg') === 'pick';
  var look = LOOKS.indexOf(q.get('bg')) >= 0 ? q.get('bg') : 'lamp';
  var strength = Math.min(3, Math.max(1, Math.round(+q.get('strength')) || 2));
  if (look === 'off' && !pick) return;

  var reduceSet = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var still = reduceSet && !pick;                  // the tester's link moves regardless
  var coarse = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  var cv = document.createElement('canvas');
  cv.className = 'lamp';
  cv.setAttribute('aria-hidden', 'true');
  var gl = null;
  try { gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: still }); } catch (e) { gl = null; }
  if (!gl) return;

  /* ---------- shader ---------- */
  var N = 8;
  var VS = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }';
  var FS = [
    'precision highp float;',
    'uniform vec2 uRes;',
    'uniform vec4 uBlob[' + N + '];',     // x, y (px, y down), radius, stretch (tall > 1)
    'uniform vec3 uMouse;',               // x, y, radius (0 = away)
    'uniform int uLook;',                 // 1 lamp, 2 glow, 3 lines
    'uniform float uGain;',               // strength
    'uniform float uPx;',                 // device px per css px
    'const float LN2 = 0.6931;',
    'const vec3 NIGHT = vec3(0.0588, 0.0392, 0.0431);',     // #0f0a0b, the page
    'const vec3 WAX   = vec3(0.118, 0.022, 0.030);',        // what the wax adds over the night
    'const vec3 WARM  = vec3(0.330, 0.045, 0.050);',        // lit from below
    'const vec3 RED   = vec3(0.808, 0.078, 0.090);',        // #ce1417
    'const vec3 IVORY = vec3(0.953, 0.918, 0.859);',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
    'void main(){',
    '  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);',
    // Each blob is a bell: 1 at its centre, 1/2 at its radius. The wax surface is where the sum is 1/2.
    '  float f = 0.; vec2 g = vec2(0.); float soft = 0.;',
    '  for (int i = 0; i < ' + N + '; i++) {',
    '    vec2 d = p - uBlob[i].xy; float r2 = uBlob[i].z * uBlob[i].z;',
    '    vec2 k = vec2(uBlob[i].w, 1. / uBlob[i].w);',          // taller means narrower
    '    vec2 q = d * k;',
    '    float e = exp(-LN2 * dot(q, q) / r2);',
    '    f += e; g += e * (-2. * LN2 / r2) * q * k;',
    '    soft += exp(-dot(d, d) / (r2 * 2.6));',
    '  }',
    '  float mSoft = 0.;',
    '  if (uMouse.z > 0.) {',
    '    vec2 d = p - uMouse.xy; float r2 = uMouse.z * uMouse.z;',
    '    float e = exp(-LN2 * dot(d, d) / r2);',
    '    f += e; g += e * (-2. * LN2 / r2) * d;',
    '    mSoft = exp(-dot(d, d) / (r2 * 5.));',
    '  }',
    '  float gm = max(length(g), 1e-7);',
    '  float sd = (f - .5) / gm;',               // + inside, in px (true near the surface)
    '  vec3 col = NIGHT;',
    '  if (uLook == 1) {',
    '    float e = 3.5 * uPx;',
    '    float inside = smoothstep(-e, e, sd);',
    '    float depth = clamp((f - .5) / .5, 0., 1.);',          // 0 at the surface, 1 deep in the wax
    '    float skin = (1. - depth) * (1. - depth);',
    '    vec2 n = -g / gm;',                     // outward normal
    '    float below = clamp(n.y * .5 + .5, 0., 1.);',
    '    vec3 wax = WAX * (1.22 + .30 * depth);',
    '    wax += WARM * below * below * skin * .66;',             // the lamp is underneath: bottoms glow
    '    wax += WARM * mSoft * .16;',                             // warm under the pointer
    '    vec3 halo = WAX * exp(min(sd, 0.) / (38. * uPx)) * .34;',
    '    col += mix(halo, wax, inside) * uGain;',
    '    col += RED * exp(-abs(sd) / (1.3 * uPx)) * .13 * uGain;',
    '  } else if (uLook == 2) {',
    '    float s = soft + mSoft * .55;',
    '    col += WAX * 1.05 * (1. - exp(-s * 1.15)) * uGain;',
    '    col += WARM * .16 * smoothstep(.75, 1.9, s) * uGain;',
    '  } else if (uLook == 3) {',
    // Evenly spaced rings out from every blob, like a contour map: one ring per third of a radius.
    '    float m = 3.;',
    '    float h = max(-log2(max(f, 1e-6)), 1e-4);',
    '    float u = sqrt(h) * m;',
    '    float du = m * gm / (max(f, 1e-6) * LN2) / (2. * sqrt(h));',
    '    float w = abs(fract(u + .5) - .5) / max(du, 1e-6);',
    '    float line = 1. - smoothstep(.5 * uPx, 1.35 * uPx, w);',
    '    float band = smoothstep(1.4, 1.9, u) * (1. - smoothstep(4.6, 7.4, u));',
    '    float isRim = 1. - smoothstep(.15, .5, abs(u - m));',
    '    col += mix(IVORY * .075, RED * .29, isRim) * line * band * uGain;',
    '    col += WAX * .42 * (1. - exp(-soft * .9)) * uGain;',
    '  }',
    '  col += (hash(gl_FragCoord.xy) - .5) / 255. * 1.6;',   // dither: no banding in the dark
    '  gl_FragColor = vec4(col, 1.);',
    '}'
  ].join('\n');

  var U = {};
  function compile(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function initGL() {
    try {
      var prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      ['uRes', 'uBlob', 'uMouse', 'uLook', 'uGain', 'uPx'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
      gl.viewport(0, 0, cv.width, cv.height);
      return true;
    } catch (e) { return false; }
  }
  if (!initGL()) return;      // a phone whose graphics cannot run the shader: leave the page as it was

  page.insertBefore(cv, page.firstChild);

  /* ---------- the lamp ---------- */
  var W = 1, H = 1, px = 1, base = 1;
  var blobs = [];
  var seedN = 7;
  function rnd() { seedN = (seedN * 16807) % 2147483647; return (seedN - 1) / 2147483646; }
  (function seed() {
    for (var i = 0; i < N; i++) {
      blobs.push({
        lane: 0, x: 0, y: rnd(), vx: 0, vy: 0,
        r: 0.062 + rnd() * rnd() * 0.15,                   // of the short side: a few big, more small
        heat: rnd(), ph: rnd() * 6.283, sp: 0.6 + rnd() * 0.8, st: 1
      });
    }
    blobs.sort(function (a, b) { return a.ph - b.ph; });   // big and small mixed across the width
    blobs.forEach(function (b, i) { b.lane = (i + 0.5) / N + (rnd() - 0.5) * 0.05; b.x = b.lane; });
  })();

  // x, y: the pointer. bx, by: the warm spot, which trails it like something in liquid.
  var mouse = { x: -9999, y: -9999, px: 0, py: 0, bx: 0, by: 0, vx: 0, vy: 0, on: 0, seen: 0, live: false, hold: 2.2, gain: 1 };
  var t = 0, stir = 0;

  function size() {
    var r = cv.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height); base = Math.min(W, H);
    var dpr = window.devicePixelRatio || 1;
    px = (look === 'lines' && !coarse) ? Math.min(dpr, 2) : Math.min(dpr, 1.25);
    var w = Math.round(W * px), h = Math.round(H * px);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
  }

  function physics(dt) {
    t += dt;
    // pointer presence eases in and out; it cools off a couple of seconds after the last move
    var want = (mouse.live && t - mouse.seen < mouse.hold) ? 1 : 0;
    if (mouse.on < 0.02 && want) { mouse.bx = mouse.x; mouse.by = mouse.y; mouse.px = mouse.x; mouse.py = mouse.y; }
    mouse.on += (want - mouse.on) * Math.min(1, dt * (want ? 4 : 1.3));
    var ivx = (mouse.x - mouse.px) / dt, ivy = (mouse.y - mouse.py) / dt;       // px a second
    mouse.px = mouse.x; mouse.py = mouse.y;
    mouse.vx += (ivx - mouse.vx) * Math.min(1, dt * 9); mouse.vy += (ivy - mouse.vy) * Math.min(1, dt * 9);
    mouse.bx += (mouse.x - mouse.bx) * Math.min(1, dt * 6.5); mouse.by += (mouse.y - mouse.by) * Math.min(1, dt * 6.5);
    var R = 0.52 * base;
    for (var i = 0; i < N; i++) {
      var b = blobs[i];
      var bx = b.x * W, by = b.y * H;
      // heat at the bottom, cool at the top: hot wax rises, cool wax sinks
      if (b.y > 0.86) b.heat += (1 - b.heat) * dt * 0.22 * b.sp;
      else if (b.y < 0.14) b.heat += (0 - b.heat) * dt * 0.22 * b.sp;
      var ay = -(b.heat - 0.5) * 0.030 * b.sp;                      // of the height, per s2
      var ax = (b.lane - b.x) * 0.012 + Math.sin(t * 0.07 * b.sp + b.ph) * 0.0035;
      // neighbours: a soft push apart so they brush and part rather than pile up
      for (var j = 0; j < N; j++) {
        if (j === i) continue;
        var o = blobs[j], dx = bx - o.x * W, dy = by - o.y * H, d = Math.sqrt(dx * dx + dy * dy) + 0.001;
        var reach = (b.r + o.r) * base * 0.92;
        if (d < reach) { var k = (1 - d / reach) * 0.010; ax += dx / d * k; ay += dy / d * k; }
      }
      // the pointer: lean toward it, and get dragged by a quick move
      if (mouse.on > 0.01) {
        var mx = mouse.bx - bx, my = mouse.by - by, md = Math.sqrt(mx * mx + my * my) + 0.001;
        if (md < R) {
          var pull = (1 - md / R); pull = pull * pull * mouse.on * mouse.gain;
          var hold = Math.min(1, md / (b.r * base));               // do not collapse onto the point
          ax += mx / md * pull * 0.17 * hold; ay += my / md * pull * 0.17 * hold * (W / H);
          var drag = Math.min(1, dt * 2.2 * pull / mouse.gain);     // a quick pass drags the wax along
          var tvx = Math.max(-0.11, Math.min(0.11, mouse.vx / W * 0.16)), tvy = Math.max(-0.11, Math.min(0.11, mouse.vy / H * 0.16));
          b.vx += (tvx - b.vx) * drag; b.vy += (tvy - b.vy) * drag;
        }
      }
      ay += stir * 0.00009;                                          // scrolling stirs the lamp
      b.vx += ax * dt; b.vy += ay * dt;
      var damp = Math.exp(-dt * 0.55);
      b.vx *= damp; b.vy *= damp;
      b.x += b.vx * dt; b.y += b.vy * dt;
      // wax stretches as it travels and rounds off as it slows
      var tall = 1 + Math.min(0.32, Math.abs(b.vy) * 9) - Math.min(0.2, Math.abs(b.vx) * 9);
      b.st += (tall - b.st) * Math.min(1, dt * 0.9);
      // soft floor and ceiling: wax pools half off screen, as in a lamp
      if (b.y > 1.04) { b.y = 1.04; b.vy *= -0.2; }
      if (b.y < -0.04) { b.y = -0.04; b.vy *= -0.2; }
      if (b.x < -0.05) { b.x = -0.05; b.vx *= -0.3; }
      if (b.x > 1.05) { b.x = 1.05; b.vx *= -0.3; }
    }
    stir *= Math.exp(-dt * 5);
  }

  var data = new Float32Array(N * 4), lost = false;
  function draw() {
    if (lost || look === 'off') return;
    size();
    for (var i = 0; i < N; i++) {
      var b = blobs[i], breathe = 1 + Math.sin(t * 0.31 * b.sp + b.ph) * 0.045;
      data[i * 4] = b.x * W * px; data[i * 4 + 1] = b.y * H * px; data[i * 4 + 2] = b.r * base * px * breathe; data[i * 4 + 3] = b.st;
    }
    gl.uniform2f(U.uRes, cv.width, cv.height);
    gl.uniform4fv(U.uBlob, data);
    gl.uniform3f(U.uMouse, mouse.bx * px, mouse.by * px, mouse.on > 0.01 ? base * 0.062 * px * mouse.on : 0);
    gl.uniform1i(U.uLook, LOOKS.indexOf(look));
    gl.uniform1f(U.uGain, [0, 0.62, 1, 1.5][strength]);
    gl.uniform1f(U.uPx, px);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function step(dt) { physics(dt); draw(); }

  // Start from a settled lamp, not from the seed positions.
  for (var w0 = 0; w0 < 900; w0++) physics(1 / 30);

  /* ---------- input (none when the lamp holds still) ---------- */
  if (!still) {
    var point = function (e) {
      var r = cv.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.seen = t; mouse.live = true;
      // A touch has no hover to follow, so it warms the spot for two seconds and pulls harder.
      var touch = e.pointerType === 'touch';
      mouse.hold = touch ? 2.0 : 2.2; mouse.gain = touch ? 2.4 : 1;
    };
    window.addEventListener('pointermove', point, { passive: true });
    window.addEventListener('pointerdown', point, { passive: true });
    // A mouse leaving the window cools the spot at once. A lifted finger also "leaves", but
    // its warmth should last out its two seconds, so touches are left to the timer.
    document.documentElement.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') mouse.live = false; });
    var lastY = window.scrollY;
    window.addEventListener('scroll', function () {
      var y = window.scrollY; stir += Math.max(-80, Math.min(80, y - lastY)); lastY = y;
    }, { passive: true });
  }

  /* ---------- run only while the page sections are on screen ---------- */
  var visible = false, paused = false, raf = 0, last = 0;
  function frame(now) {
    raf = 0;
    if (!visible || paused || lost || look === 'off' || document.hidden) return;
    if (coarse && now - last < 30) { raf = requestAnimationFrame(frame); return; }   // 30 a second on phones
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    step(dt);
    raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (still || paused) { if (visible) draw(); return; }
    if (!raf && visible && !lost && look !== 'off' && !document.hidden) { last = performance.now() - 34; raf = requestAnimationFrame(frame); }
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { visible = en[en.length - 1].isIntersecting; kick(); }, { rootMargin: '10% 0px' }).observe(page);
  } else { visible = true; kick(); }
  document.addEventListener('visibilitychange', kick);
  window.addEventListener('resize', function () { if (visible) draw(); });
  // A phone can take the graphics context away (the tab in the background); pick up again when it returns.
  cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); lost = true; });
  cv.addEventListener('webglcontextrestored', function () { lost = !initGL(); kick(); });

  /* ---------- the test panel (?bg=pick only) ---------- */
  var ui = null;
  function apply() {
    document.body.classList.toggle('lamp-on', look !== 'off');
    if (ui) {
      ui.querySelectorAll('[data-look]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.look === look)); });
      ui.querySelectorAll('[data-s]').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.s === strength)); });
    }
    if (visible) draw();
    kick();
  }
  if (pick) {
    var css = document.createElement('style');
    css.textContent =
      '.lamp-ui{position:fixed;left:16px;bottom:16px;z-index:400;display:flex;flex-direction:column;gap:8px;max-width:calc(100vw - 20px);padding:12px 14px 14px;background:rgba(15,10,11,.9);border:1px solid rgba(243,234,219,.22);font:500 13px/1.3 Jost,system-ui,sans-serif;color:#f3eadb;}' +
      '.lamp-ui b{font-weight:500;color:#cfc2ae;}' +
      '.lamp-ui p{margin:2px 0 0;max-width:270px;font-weight:400;font-size:12px;color:#998b7c;}' +
      '.lamp-ui div{display:flex;}' +
      '.lamp-ui button{font:inherit;line-height:1;color:#cfc2ae;background:none;border:1px solid rgba(243,234,219,.22);margin-left:-1px;padding:10px 13px;cursor:pointer;}' +
      '.lamp-ui div button:first-child{margin-left:0;}' +
      '.lamp-ui button[aria-pressed="true"]{background:#f3eadb;color:#0f0a0b;border-color:#f3eadb;position:relative;}' +
      '@media (max-width:860px){.lamp-ui{left:10px;bottom:calc(84px + env(safe-area-inset-bottom));font-size:12px;}.lamp-ui button{padding:10px 10px;}}';
    document.head.appendChild(css);
    ui = document.createElement('div');
    ui.className = 'lamp-ui';
    ui.innerHTML = '<b>Background test</b><div>' +
      LOOKS.map(function (l) { return '<button type="button" data-look="' + l + '">' + NAMES[l] + '</button>'; }).join('') +
      '</div><div>' + ['Soft', 'Medium', 'Strong'].map(function (n, i) { return '<button type="button" data-s="' + (i + 1) + '">' + n + '</button>'; }).join('') + '</div>' +
      (reduceSet ? '<p>Reduce Motion is on for this device. This test link moves anyway; on the normal link the background holds still.</p>' : '');
    ui.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.look) look = b.dataset.look;
      if (b.dataset.s) strength = +b.dataset.s;
      apply();
    });
    document.body.appendChild(ui);
  }
  apply();

  window.__lamp = {
    step: step, redraw: draw,
    pause: function () { paused = true; if (raf) { cancelAnimationFrame(raf); raf = 0; } },
    running: function () { return !!raf; },
    look: function () { return look; },
    warm: function () { return mouse.on; },
    blobs: function () { return blobs; }
  };
})();
