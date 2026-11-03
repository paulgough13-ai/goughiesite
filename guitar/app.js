(function () {
"use strict";
/* ===== core: data, helpers, audio ===== */
var D = JSON.parse(document.getElementById("site-data").textContent);
var OPEN = { 6: 40, 5: 45, 4: 50, 3: 55, 2: 59, 1: 64 };
var SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
var FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
var PC = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
var DEG = ["1", "b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7"];
var FLAT_KEYS = { 5: 1, 10: 1, 3: 1, 8: 1, 1: 1 };

function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function pad2(n) { return (n < 10 ? "0" : "") + n; }
function todayStr(d) { d = d || new Date(); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
function parseDay(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
function fmtDate(s) { return parseDay(s).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }); }
function weekKey(n) { return "w" + pad2(n); }
function weekHref(n) { return "#week-" + pad2(n); }
function W(n) { return D.weeks[n - 1]; }
function stripHtml(h) { var d = document.createElement("div"); d.innerHTML = h; return d.textContent || ""; }

var LS = {
  get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* unavailable */ } }
};
var PREFS = LS.get("gtr52-prefs", { left: false, lowTop: false, flats: false });
function savePrefs() { LS.set("gtr52-prefs", PREFS); }

/* ----- audio ----- */
var ctx = null, master = null, noiseBuf = null;
function audio() {
  if (!ctx) {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9;
    var comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}
var pluckCache = {};
function pluckBuffer(midi) {
  if (pluckCache[midi]) return pluckCache[midi];
  var f = 440 * Math.pow(2, (midi - 69) / 12), sr = ctx.sampleRate, len = Math.floor(sr * 1.8);
  var buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
  var n = Math.max(2, Math.round(sr / f)), ring = new Float32Array(n), i, idx = 0;
  for (i = 0; i < n; i++) ring[i] = Math.random() * 2 - 1;
  for (i = 0; i < len; i++) { var nx = (idx + 1) % n, v = ring[idx]; d[i] = v; ring[idx] = 0.4985 * (v + ring[nx]); idx = nx; }
  pluckCache[midi] = buf; return buf;
}
function pluck(midi, when, gain, dur, dest) {
  var c = audio(); if (!c) return;
  when = when || c.currentTime;
  var src = c.createBufferSource(), g = c.createGain();
  src.buffer = pluckBuffer(midi);
  g.gain.setValueAtTime(gain == null ? 0.32 : gain, when);
  if (dur) { g.gain.setValueAtTime(gain == null ? 0.32 : gain, when + dur); g.gain.exponentialRampToValueAtTime(0.0001, when + dur + 0.08); }
  src.connect(g); g.connect(dest || master); src.start(when);
  if (dur) src.stop(when + dur + 0.1);
}
function noise() {
  if (noiseBuf) return noiseBuf;
  var len = ctx.sampleRate * 0.5; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  var d = noiseBuf.getChannelData(0); for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}
function chime() {
  var c = audio(); if (!c) return; var t = c.currentTime + 0.02;
  [76, 79, 83].forEach(function (m, i) { pluck(m, t + i * 0.09, 0.3); });
}

/* ----- pitch helpers ----- */
function midiOf(s, f) { return OPEN[s] + f; }
function nameOf(midi, flats) { return ((flats || PREFS.flats) ? FLATS : SHARPS)[((midi % 12) + 12) % 12]; }
function pcName(pc, flats) { pc = ((pc % 12) + 12) % 12; return ((flats || PREFS.flats) ? FLATS : SHARPS)[pc]; }

/* ----- chord symbols ----- */
var QUAL = {
  "": [0, 4, 7], "m": [0, 3, 7], "7": [0, 4, 7, 10], "maj7": [0, 4, 7, 11], "m7": [0, 3, 7, 10], "m7b5": [0, 3, 6, 10],
  "dim7": [0, 3, 6, 9], "dim": [0, 3, 6], "6": [0, 4, 7, 9], "m6": [0, 3, 7, 9], "5": [0, 7], "sus2": [0, 2, 7],
  "sus4": [0, 5, 7], "aug": [0, 4, 8], "7alt": [0, 4, 8, 10, 13], "7#5": [0, 4, 8, 10], "m(maj7)": [0, 3, 7, 11],
  "maj7#5": [0, 4, 8, 11], "7#11": [0, 4, 7, 10, 18], "9": [0, 4, 7, 10, 14], "m9": [0, 3, 7, 10, 14], "maj9": [0, 4, 7, 11, 14]
};
function parseChord(sym) {
  var m = /^([A-G][#b]?)(.*)$/.exec(String(sym).trim()); if (!m || !(m[1] in PC)) return null;
  var q = m[2]; if (!(q in QUAL)) { if (q === "min") q = "m"; else if (q === "M7" || q === "Maj7") q = "maj7"; else return null; }
  return { root: PC[m[1]], q: q, iv: QUAL[q] };
}
function chordName(c, shift) { var pc = c.root + (shift || 0); return pcName(pc, FLAT_KEYS[((pc % 12) + 12) % 12]) + c.q; }
/* ===== fretboard diagrams ===== */
var NS = "http://www.w3.org/2000/svg";
function sv(tag, attrs, parent) {
  var e = document.createElementNS(NS, tag);
  for (var k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

function bestShift(lo, hi, d) {
  var opts = [d, d - 12, d + 12].filter(function (k) { return lo + k >= 0 && hi + k <= 22; });
  opts.sort(function (a, b) { return Math.abs(a) - Math.abs(b); });
  return opts.length ? opts[0] : 0;
}

function transposeSpec(spec, d) {
  if (!d || !spec.root) return spec;
  var s = JSON.parse(JSON.stringify(spec));
  var pc = (PC[spec.root] + d + 120) % 12;
  s.flats = !!FLAT_KEYS[pc] || (spec.flats && pc !== 7 && pc !== 2 && pc !== 9 && pc !== 4 && pc !== 11);
  s.root = pcName(pc, s.flats);
  if (s.type === "scale") {
    if (s.frets[1] - s.frets[0] < 11) {
      var k = bestShift(s.frets[0], s.frets[1], d);
      s.frets = [s.frets[0] + k, s.frets[1] + k];
    }
  } else {
    var fs = s.notes.map(function (n) { return n[1]; });
    var lo = Math.min.apply(null, fs), hi = Math.max.apply(null, fs);
    var k2 = bestShift(lo, hi, d);
    s.notes = s.notes.map(function (n) { var c = n.slice(); c[1] += k2; return c; });
    if (s.hlpos) s.hlpos = s.hlpos.map(function (p) { return [p[0], p[1] + k2]; });
    if (s.frets) s.frets = [Math.max(0, s.frets[0] + k2), Math.min(22, s.frets[1] + k2)];
  }
  return s;
}

function expand(spec) {
  var notes = [], rootPc = spec.root ? PC[spec.root] : null;
  if (spec.type === "scale") {
    var ivSet = {}, hlSet = {};
    spec.iv.forEach(function (i) { ivSet[i] = true; });
    (spec.hl || []).forEach(function (i) { hlSet[i] = true; });
    (spec.strings || [1, 2, 3, 4, 5, 6]).forEach(function (s) {
      for (var f = spec.frets[0]; f <= spec.frets[1]; f++) {
        var iv = ((midiOf(s, f) - rootPc) % 12 + 12) % 12;
        if (ivSet[iv]) notes.push({ s: s, f: f, iv: iv, hl: !!hlSet[iv] });
      }
    });
  } else {
    var hp = {};
    (spec.hlpos || []).forEach(function (p) { hp[p[0] + ":" + p[1]] = true; });
    spec.notes.forEach(function (n) {
      var m = midiOf(n[0], n[1]);
      notes.push({ s: n[0], f: n[1], lab: n[2] || null,
        iv: rootPc === null ? null : ((m - rootPc) % 12 + 12) % 12, hl: !!hp[n[0] + ":" + n[1]] || !!n[3] });
    });
  }
  notes.forEach(function (n) { n.midi = midiOf(n.s, n.f); n.name = nameOf(n.midi, spec.flats); });
  var range = spec.frets;
  if (!range) {
    var fs = notes.map(function (n) { return n.f; }).filter(function (f) { return f > 0; });
    var lo = fs.length ? Math.min.apply(null, fs) : 1, hi = fs.length ? Math.max.apply(null, fs) : 3;
    lo = lo <= 3 ? 0 : lo - 1; hi = Math.max(hi, lo + 4);
    range = [lo, hi];
  }
  return { notes: notes, range: range };
}

function labelFor(n, spec, mode) {
  if (mode === "custom" && n.lab) return n.lab;
  if (mode === "degree" && n.iv !== null && n.iv !== undefined) return (spec.deg && spec.deg[n.iv]) || DEG[n.iv];
  if (mode === "none") return "";
  if (mode === "quiz") return n.lab || "";
  return n.name;
}

/* realistic fretboard materials: rosewood, nickel frets, bone nut, wound strings, pearl inlays */
var BOARD_N = 0, FRET_TAPER = 0.75;
function fretPos(n) { return 1 - Math.pow(2, -n * FRET_TAPER / 12); }
function boardDefs(svg, id) {
  var defs = sv("defs", {}, svg);
  function grad(gid, attrs, stops) {
    var g = sv(attrs.r ? "radialGradient" : "linearGradient", Object.assign({ id: id + gid }, attrs), defs);
    stops.forEach(function (st) { sv("stop", { offset: st[0], "stop-color": st[1] }, g); });
  }
  grad("wood", { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, "#2b1a11"], [0.1, "#4b3021"], [0.5, "#5a3b28"], [0.9, "#472d1f"], [1, "#22150e"]]);
  grad("fret", { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, "#5d6266"], [0.35, "#e9edef"], [0.55, "#ffffff"], [0.8, "#9aa1a5"], [1, "#4f5458"]]);
  grad("nut", { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, "#cfc2a4"], [0.4, "#fbf5e6"], [1, "#d8cbb0"]]);
  grad("plain", { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, "#6b7074"], [0.45, "#f7f8f8"], [1, "#55595c"]]);
  grad("wound", { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, "#6a5a45"], [0.45, "#efe2c8"], [1, "#4d4132"]]);
  grad("pearl", { cx: 0.38, cy: 0.35, r: 0.7 }, [[0, "#ffffff"], [0.4, "#efe9f4"], [0.7, "#d3e7e1"], [1, "#b2a690"]]);
  var pat = sv("pattern", { id: id + "wind", width: 1.7, height: 8, patternUnits: "userSpaceOnUse", patternTransform: "skewX(-38)" }, defs);
  sv("rect", { x: 0, y: 0, width: 0.65, height: 8, fill: "#000", opacity: 0.45 }, pat);
  var f = sv("filter", { id: id + "grain", x: 0, y: 0, width: 1, height: 1, "color-interpolation-filters": "sRGB" }, defs);
  sv("feTurbulence", { type: "fractalNoise", baseFrequency: "0.005 0.3", numOctaves: 4, seed: 7, result: "n" }, f);
  sv("feColorMatrix", { in: "n", type: "matrix", values: "0 0 0 0 0.08  0 0 0 0 0.04  0 0 0 0 0.02  2.2 0 0 0 -0.85", result: "dark" }, f);
  sv("feColorMatrix", { in: "n", type: "matrix", values: "0 0 0 0 0.55  0 0 0 0 0.36  0 0 0 0 0.22  0 -2.4 0 0 1.05", result: "light" }, f);
  var m = sv("feMerge", { result: "grain" }, f); sv("feMergeNode", { in: "light" }, m); sv("feMergeNode", { in: "dark" }, m);
  sv("feComposite", { in: "grain", in2: "SourceAlpha", operator: "in" }, f);
}

/* scale-degree colours, as on the Scales tool: root red, 2 orange, 3 yellow, 4 green, 5 blue, 6 purple, 7 pink.
   The degree comes from the interval label, so #4 is a 4th, b5 a 5th and b9 a 2nd. */
var DEG_VAR = ["--d-root", "--d-2", "--d-3", "--d-4", "--d-5", "--d-6", "--d-7"];
function degreeIndex(iv, spec) {
  if (iv === null || iv === undefined) return -1;
  var lab = (spec.deg && spec.deg[iv]) || DEG[iv], m = /(\d+)/.exec(lab || "");
  return m ? (+m[1] - 1) % 7 : -1;
}

/* draw a fretboard into holder; returns the expanded notes */
function drawBoard(holder, spec, opts) {
  opts = opts || {};
  holder.innerHTML = "";
  var x = expand(spec), first = Math.max(1, x.range[0]), last = x.range[1];
  var slots = last - first + 1, slotW = opts.slotW || (slots > 12 ? 44 : 54), left = 40, top = 22, sp = 26;
  var width = left + slots * slotW + 14, boardH = sp * 5, height = top + boardH + 40;
  var mirror = PREFS.left, flip = PREFS.lowTop;
  var svg = sv("svg", { viewBox: "0 0 " + width + " " + height, width: width, height: height, role: "img",
    "aria-label": (spec.title || "Fretboard") + " diagram" }, holder);
  var X = function (v) { return mirror ? width - v : v; };
  var p0 = fretPos(first - 1), span = fretPos(last) - p0, W = slots * slotW;
  var lineX = function (n) { return left + (fretPos(n) - p0) / span * W; };
  var xOf = function (f) { return X(f === 0 ? 24 : lineX(f - 1) + (lineX(f) - lineX(f - 1)) * 0.56); };
  var midX = function (f) { return X((lineX(f - 1) + lineX(f)) / 2); };
  var yOf = function (s) { return top + ((flip ? 7 - s : s) - 1) * sp; };
  var bx0 = X(left), bx1 = X(left + slots * slotW);
  var id = "fb" + (++BOARD_N), bx = Math.min(bx0, bx1), by = top - 12, bh = boardH + 24, dir = mirror ? -1 : 1;
  boardDefs(svg, id);
  sv("rect", { x: bx, y: by + 3, width: W, height: bh, rx: 2, fill: "#000", opacity: 0.22 }, svg);
  sv("rect", { x: bx, y: by, width: W, height: bh, rx: 2, fill: "url(#" + id + "wood)", class: "wood-real" }, svg);
  sv("rect", { x: bx, y: by, width: W, height: bh, rx: 2, fill: "#000", filter: "url(#" + id + "grain)" }, svg);
  sv("rect", { x: bx, y: by, width: W, height: 1.2, fill: "#fff", opacity: 0.12 }, svg);
  sv("rect", { x: bx, y: by + bh - 1.5, width: W, height: 1.5, fill: "#000", opacity: 0.35 }, svg);
  function inlay(cx, cy) { sv("circle", { cx: cx, cy: cy, r: 4.6, fill: "url(#" + id + "pearl)", stroke: "#000", "stroke-opacity": 0.3, "stroke-width": 0.6 }, svg); }
  [3, 5, 7, 9, 15, 17, 19, 21].forEach(function (f) { if (f >= first && f <= last) inlay(midX(f), top + boardH / 2); });
  [12, 24].forEach(function (f) { if (f >= first && f <= last) { inlay(midX(f), top + sp * 1.5); inlay(midX(f), top + sp * 3.5); } });
  for (var i = 0; i <= slots; i++) {
    var fx = X(lineX(first - 1 + i));
    if (i === 0 && first === 1) {
      sv("rect", { x: dir > 0 ? fx - 7 : fx, y: by - 1, width: 7, height: bh + 2, rx: 1, fill: "url(#" + id + "nut)", stroke: "#8f846c", "stroke-width": 0.5 }, svg);
      continue;
    }
    sv("rect", { x: dir > 0 ? fx + 1.4 : fx - 4.4, y: by, width: 3, height: bh, fill: "#000", opacity: 0.32 }, svg);
    sv("rect", { x: fx - 1.6, y: by, width: 3.2, height: bh, rx: 1, fill: "url(#" + id + "fret)" }, svg);
  }
  for (var s = 1; s <= 6; s++) {
    var th = 0.9 + (s - 1) * 0.45, sy = yOf(s), sx0 = Math.min(bx0, bx1) - (first === 1 ? 0 : 0), swid = W;
    sv("rect", { x: sx0, y: sy + 1.6, width: swid, height: th + 0.6, fill: "#000", opacity: 0.4 }, svg);
    sv("rect", { x: sx0, y: sy - th / 2, width: swid, height: th, fill: "url(#" + id + (s >= 3 ? "wound" : "plain") + ")", class: "gstring-real" }, svg);
    if (s >= 3) sv("rect", { x: sx0, y: sy - th / 2, width: swid, height: th, fill: "url(#" + id + "wind)" }, svg);
    var sl = sv("text", { x: X(7), y: sy + 4, class: "slabel" }, svg);
    sl.textContent = ["e", "B", "G", "D", "A", "E"][s - 1];
  }
  for (var f = first; f <= last; f++) {
    if ([1, 3, 5, 7, 9, 12, 15, 17, 19, 21].indexOf(f) > -1 || f === first) {
      var t = sv("text", { x: midX(f), y: top + boardH + 32, class: "fnum" }, svg); t.textContent = f;
    }
  }
  (spec.muted || []).forEach(function (s) { var m = sv("text", { x: X(25), y: yOf(s) + 5, class: "muted" }, svg); m.textContent = "×"; });
  var mode = opts.mode || "note";
  x.notes.forEach(function (n) {
    var dg = mode === "quiz" ? -1 : degreeIndex(n.iv, spec);
    var g = sv("g", { class: "dot" + (n.iv === 0 && mode !== "quiz" ? " root" : "") + (n.hl ? " hl" : "") + (dg >= 0 ? " dg" : "") + (n.f === 0 ? " open" : ""),
      tabindex: "0", role: "button", "aria-label": (mode === "quiz" ? "Mystery note" : n.name) + ", string " + n.s + ", fret " + n.f }, svg);
    if (dg >= 0) g.style.setProperty("--dc", "var(" + DEG_VAR[dg] + ")");
    sv("circle", { cx: xOf(n.f), cy: yOf(n.s), r: 11 }, g);
    var lab = labelFor(n, spec, mode);
    var tx = sv("text", { x: xOf(n.f), y: yOf(n.s) + 3.5, class: lab.length > 2 ? "small" : "" }, g);
    tx.textContent = lab;
    var hit = function (ev) {
      if (ev.type === "keydown" && ev.key !== "Enter" && ev.key !== " ") return;
      ev.preventDefault(); pluck(n.midi); flash(g, 0);
    };
    g.addEventListener("click", hit); g.addEventListener("keydown", hit);
    n.node = g;
  });
  return x.notes;
}

function flash(node, delayMs) {
  setTimeout(function () { node.classList.add("ping"); setTimeout(function () { node.classList.remove("ping"); }, 260); }, delayMs);
}

function playNotes(notes, isChord) {
  var c = audio(); if (!c || !notes) return;
  var seen = {}, list = notes.slice().sort(function (a, b) { return a.midi - b.midi || a.s - b.s; })
    .filter(function (n) { var k = n.s + ":" + n.f; if (seen[k]) return false; seen[k] = true; return true; });
  var step = isChord ? 0.07 : 0.24, t0 = c.currentTime + 0.05;
  if (isChord) list.sort(function (a, b) { return b.s - a.s; });
  list.forEach(function (n, i) { pluck(n.midi, t0 + i * step); flash(n.node, i * step * 1000 + 50); });
}

/* A boards section: figures with play, key select and shared label mode */
function boardsHTML(specs) {
  return specs.map(function (s, i) {
    var span = s.frets ? s.frets[1] - Math.max(1, s.frets[0]) : 0;
    var keySel = s.root ? '<label class="keysel"><span class="vh">Key</span><select data-key="' + i + '" aria-label="Transpose ' + esc(s.title) + '">' +
      Array.apply(null, Array(12)).map(function (_, d) {
        var pc = (PC[s.root] + d) % 12;
        return '<option value="' + d + '">' + (d === 0 ? esc(s.root) + " (as written)" : "in " + pcName(pc, FLAT_KEYS[pc])) + "</option>";
      }).join("") + "</select></label>" : "";
    return '<figure class="board' + (span > 8 ? " wide" : "") + '" data-i="' + i + '"><figcaption><span class="btitle">' + esc(s.title) +
      '</span><button type="button" class="play" data-play="' + i + '">Play</button>' + keySel + '</figcaption><div class="board-svg"></div>' +
      (s.cap ? '<p class="cap">' + esc(s.cap) + "</p>" : "") + "</figure>";
  }).join("");
}
function mountBoards(root, specs) {
  var mode = "note", shift = specs.map(function () { return 0; }), notesBy = [];
  var hasCustom = specs.some(function (sp) { return sp.notes && sp.notes.some(function (n) { return n[2]; }); });
  var seg = $(".seg", root);
  if (seg) {
    if (!hasCustom) $('[data-mode="custom"]', seg).hidden = true;
    seg.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-mode]"); if (!b) return;
      mode = b.getAttribute("data-mode");
      $$("button", seg).forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      render();
    });
  }
  function render() {
    $$(".board", root).forEach(function (fig) {
      var i = +fig.getAttribute("data-i"), sp = transposeSpec(specs[i], shift[i]);
      notesBy[i] = drawBoard($(".board-svg", fig), sp, { mode: mode });
      fig.classList.toggle("shifted", shift[i] !== 0);
    });
  }
  root.addEventListener("click", function (e) {
    var b = e.target.closest("[data-play]"); if (!b) return;
    var i = +b.getAttribute("data-play"); playNotes(notesBy[i], specs[i].type === "chord");
  });
  root.addEventListener("change", function (e) {
    var s = e.target.closest("[data-key]"); if (!s) return;
    shift[+s.getAttribute("data-key")] = +s.value; render();
  });
  render();
  return render;
}

/* ===== rendered tab with play, speed, loop and bar select ===== */
var TAB_STR = { e: 1, B: 2, G: 3, D: 4, A: 5, E: 6 };
var tabPlayer = { timer: null, btn: null };
function stopTab() {
  if (tabPlayer.timer) clearTimeout(tabPlayer.timer);
  tabPlayer.timer = null;
  if (tabPlayer.btn) { tabPlayer.btn.textContent = "Play tab"; tabPlayer.btn.setAttribute("aria-pressed", "false"); }
  tabPlayer.btn = null;
}
function mountTabs(root) {
  $$("pre > code", root).forEach(function (code) {
    if (code.closest(".tab-raw")) return;
    var lines = code.textContent.replace(/\s+$/, "").split("\n"), tabIdx = [];
    lines.forEach(function (l, i) { if (/^[eBGDAE]\|/.test(l)) tabIdx.push(i); });
    if (tabIdx.length < 2) return;
    var firstTab = tabIdx[0], lastTab = tabIdx[tabIdx.length - 1];
    var heads = lines.slice(0, firstTab), feet = lines.slice(lastTab + 1);
    var tabs = lines.slice(firstTab, lastTab + 1).filter(function (l) { return /^[eBGDAE]\|/.test(l); });
    var cols = Math.max.apply(null, lines.map(function (l) { return l.length; }));
    var cw = 10, lh = 22, padT = 14 + heads.length * 20, x0 = 6;
    var width = x0 + cols * cw + 10, height = padT + (tabs.length - 1) * lh + 16 + feet.length * 20 + 6;
    var wrap = document.createElement("div"); wrap.className = "tab";
    var bar = document.createElement("div"); bar.className = "tab-bar";
    bar.innerHTML = '<button type="button" class="play" aria-pressed="false">Play tab</button>' +
      '<label class="tab-ctl"><span>Speed</span><select class="t-speed"><option value="0.34">Slow</option><option value="0.22" selected>Medium</option><option value="0.13">Fast</option><option value="0.08">Very fast</option></select></label>' +
      '<label class="tab-ctl"><input type="checkbox" class="t-loop"> Loop</label><label class="tab-ctl t-barwrap" hidden><span>Section</span><select class="t-bar"></select></label>';
    wrap.appendChild(bar);
    var scroll = document.createElement("div"); scroll.className = "tab-scroll"; wrap.appendChild(scroll);
    var svg = sv("svg", { viewBox: "0 0 " + width + " " + height, width: width, height: height, role: "img", "aria-label": "Guitar tab" }, scroll);
    var cx = function (i) { return x0 + i * cw + cw / 2; };
    var txt = function (x, y, s, cls, anchor) { var t = sv("text", { x: x, y: y, class: cls, "text-anchor": anchor || "middle" }, svg); t.textContent = s; return t; };
    var runs = function (line, cb) { var re = /\S+/g, m; while ((m = re.exec(line))) cb(m[0], m.index); };
    heads.forEach(function (l, r) { runs(l, function (s, i) { txt(x0 + i * cw, 16 + r * 20, s, "tab-note", "start"); }); });
    var events = [], barCols = {};
    tabs.forEach(function (l, r) {
      var y = padT + r * lh, sNum = TAB_STR[l[0]], end = l.replace(/\s+$/, "").length;
      sv("line", { x1: cx(1), x2: x0 + end * cw, y1: y, y2: y, class: "tab-line" }, svg);
      txt(x0 + cw / 2, y + 4, l[0], "tab-str");
      var i = 2;
      while (i < l.length) {
        var c = l[i];
        if (/\d/.test(c)) {
          var j = i; while (j < l.length && /\d/.test(l[j])) j++;
          var num = l.slice(i, j), mid = (cx(i) + cx(j - 1)) / 2, harm = l[i - 1] === "<";
          var g = sv("g", { class: "tab-num" + (harm ? " harm" : "") }, svg);
          sv("rect", { x: mid - (num.length * 4.6 + 3), y: y - 7.5, width: num.length * 9.2 + 6, height: 15, rx: 3 }, g);
          var t = sv("text", { x: mid, y: y + 4.5, "text-anchor": "middle" }, g); t.textContent = num;
          events.push({ col: i, s: sNum, f: parseInt(num, 10), node: g });
          i = j; continue;
        }
        if (c === "|") {
          if (i < end - 1) barCols[i] = true;
          sv("line", { x1: cx(i), x2: cx(i), y1: padT - 2, y2: padT + (tabs.length - 1) * lh + 2, class: "tab-barline" }, svg);
        } else if (/[hpbrt~\/\\x<>]/.test(c)) {
          sv("rect", { x: cx(i) - 4.5, y: y - 6, width: 9, height: 12, class: "tab-gap" }, svg);
          txt(cx(i), y + 4, c === "x" ? "×" : c === "<" || c === ">" ? "" : c, "tab-tech");
        }
        i++;
      }
      sv("line", { x1: cx(1), x2: cx(1), y1: padT, y2: padT + (tabs.length - 1) * lh, class: "tab-open" }, svg);
    });
    var footY = padT + (tabs.length - 1) * lh + 26;
    feet.forEach(function (l, r) { runs(l, function (s, i) { txt(x0 + i * cw, footY + r * 20, s, "tab-note", "start"); }); });
    var raw = document.createElement("details"); raw.className = "tab-raw";
    raw.innerHTML = "<summary>Plain text tab</summary>";
    var pre = document.createElement("pre"); pre.textContent = lines.join("\n"); raw.appendChild(pre); wrap.appendChild(raw);
    code.parentNode.replaceWith(wrap);

    /* sections between internal barlines */
    var cuts = Object.keys(barCols).map(Number).sort(function (a, b) { return a - b; });
    var sections = [];
    if (cuts.length) {
      var edges = [0].concat(cuts).concat([cols + 1]);
      for (var k = 0; k < edges.length - 1; k++) {
        var a = edges[k], b = edges[k + 1];
        if (events.some(function (ev) { return ev.col > a && ev.col < b; })) sections.push([a, b]);
      }
    }
    var barSel = $(".t-bar", bar);
    if (sections.length > 1) {
      $(".t-barwrap", bar).hidden = false;
      barSel.innerHTML = '<option value="-1">Whole tab</option>' + sections.map(function (s, k) { return '<option value="' + k + '">Bar ' + (k + 1) + "</option>"; }).join("");
    }
    var btn = $(".play", bar);
    btn.addEventListener("click", function () {
      if (tabPlayer.btn === btn) { stopTab(); return; }
      stopTab();
      var c = audio(); if (!c) return;
      tabPlayer.btn = btn; btn.textContent = "Stop"; btn.setAttribute("aria-pressed", "true");
      (function playOnce() {
        var step = +$(".t-speed", bar).value, sel = sections.length > 1 ? +barSel.value : -1;
        var evs = sel < 0 ? events : events.filter(function (ev) { return ev.col > sections[sel][0] && ev.col < sections[sel][1]; });
        var byCol = {};
        evs.forEach(function (ev) { (byCol[ev.col] = byCol[ev.col] || []).push(ev); });
        var colsSorted = Object.keys(byCol).map(Number).sort(function (a, b) { return a - b; });
        var t0 = c.currentTime + 0.05;
        colsSorted.forEach(function (col, k) {
          byCol[col].forEach(function (ev) { pluck(midiOf(ev.s, ev.f), t0 + k * step); flash(ev.node, k * step * 1000 + 50); });
        });
        var total = colsSorted.length * step * 1000 + 250;
        tabPlayer.timer = setTimeout(function () {
          if (tabPlayer.btn !== btn) return;
          if ($(".t-loop", bar).checked) playOnce(); else stopTab();
        }, total);
      })();
    });
  });
}
/* ===== storage: local cache, synced to the account when available ===== */
var S = {
  mode: "local",
  progress: LS.get("gtr52-progress", {}),
  logs: LS.get("gtr52-logs", []),
  recs: LS.get("gtr52-recs", {}),
  stats: LS.get("gtr52-stats", {}),
  col: null
};
var CAP = { assets: null, sample: null, downloads: null };
var writeChain = Promise.resolve();
function queue(fn) { writeChain = writeChain.then(fn).catch(function () { setSync("error"); }); return writeChain; }
var debounces = {};
function later(key, fn, ms) { clearTimeout(debounces[key]); debounces[key] = setTimeout(fn, ms || 600); }

function setSync(state) {
  var b = $("#sync-badge"); if (!b) return;
  var txt = { local: "On this device", sync: "Synced", saving: "Saving…", error: "Sync paused, saved on this device" }[state];
  b.textContent = txt; b.setAttribute("data-state", state);
}

function wk(n) {
  var k = weekKey(n);
  if (!S.progress[k]) S.progress[k] = { k: {}, done: false };
  if (!S.progress[k].k) S.progress[k].k = {};
  return S.progress[k];
}
function saveProgress() {
  LS.set("gtr52-progress", S.progress);
  if (!S.col) return;
  setSync("saving");
  later("progress", function () {
    queue(function () { return S.col.doc("progress").set({ kind: "progress", weeks: S.progress }).then(function () { setSync("sync"); }); });
  });
}
function saveRecs() {
  LS.set("gtr52-recs", S.recs);
  if (S.col) queue(function () { return S.col.doc("recordings").set({ kind: "recordings", weeks: S.recs }); });
}
function saveStats() {
  LS.set("gtr52-stats", S.stats);
  if (S.col) later("stats", function () { queue(function () { return S.col.doc("stats").set({ kind: "stats", data: S.stats }); }); }, 1500);
}
function addLog(entry) {
  entry.id = "log-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  entry.at = Date.now();
  S.logs.push(entry); LS.set("gtr52-logs", S.logs);
  if (S.col) { setSync("saving"); queue(function () { var d = Object.assign({ kind: "log" }, entry); return S.col.doc(entry.id).set(d).then(function () { setSync("sync"); }); }); }
  return entry;
}
function deleteLog(id) {
  S.logs = S.logs.filter(function (l) { return l.id !== id; }); LS.set("gtr52-logs", S.logs);
  if (S.col) queue(function () { return S.col.doc(id).delete(); });
}

function weekStarted(n) { var w = S.progress[weekKey(n)]; return !!(w && w.k && Object.keys(w.k).some(function (k) { return w.k[k]; })); }
function weekDone(n) { var w = S.progress[weekKey(n)]; return !!(w && w.done); }
function currentWeek() { for (var n = 1; n <= 52; n++) if (!weekDone(n)) return n; return 52; }

function withTimeout(p, ms) { return Promise.race([p, new Promise(function (r) { setTimeout(function () { r(null); }, ms); })]); }

function initCaps() {
  if (!window.claude || typeof window.claude.use !== "function") return;
  window.claude.use("assets").then(function (a) { CAP.assets = a; rerender("caps"); }, function () {});
  window.claude.use("sample").then(function (s) { CAP.sample = s; rerender("caps"); }, function () {});
  window.claude.use("downloads").then(function (d) { CAP.downloads = d; }, function () {});
  Promise.all([window.claude.use("db"), window.claude.use("user")]).then(function (r) {
    var db = r[0], user = r[1];
    if (!db || !user) return;
    return user.id().then(function (uid) {
      if (!uid) return;
      var col = db.collection("data/users/" + uid);
      return withTimeout(Promise.all([col.doc("progress").get(), col.doc("recordings").get(), col.doc("stats").get(),
        col.where("kind", "==", "log").get()]), 10000).then(function (res) {
        if (!res) { setSync("error"); return; }
        S.col = col; S.mode = "sync";
        var p = res[0], rc = res[1], st = res[2], lg = res[3];
        /* merge: remote values win; local-only items are uploaded */
        var remoteP = p.exists ? (p.data().weeks || {}) : {};
        var mergedP = Object.assign({}, S.progress, remoteP);
        var needP = Object.keys(S.progress).some(function (k) { return !(k in remoteP); });
        S.progress = mergedP; LS.set("gtr52-progress", S.progress);
        var remoteR = rc.exists ? (rc.data().weeks || {}) : {};
        var needR = Object.keys(S.recs).some(function (k) { return !(k in remoteR); });
        S.recs = Object.assign({}, S.recs, remoteR); LS.set("gtr52-recs", S.recs);
        if (st.exists) { S.stats = Object.assign({}, S.stats, st.data().data || {}); LS.set("gtr52-stats", S.stats); }
        var remoteLogs = lg.docs.map(function (d) { return d.data(); }), have = {};
        remoteLogs.forEach(function (l) { have[l.id] = true; });
        var localOnly = S.logs.filter(function (l) { return !have[l.id]; });
        S.logs = remoteLogs.concat(localOnly); LS.set("gtr52-logs", S.logs);
        if (needP) queue(function () { return col.doc("progress").set({ kind: "progress", weeks: S.progress }); });
        if (needR) saveRecs();
        localOnly.forEach(function (l) { queue(function () { return col.doc(l.id).set(Object.assign({ kind: "log" }, l)); }); });
        setSync("sync");
        rerender("sync");
      });
    });
  }).catch(function () { setSync("error"); });
}
/* ===== metronome with speed trainer ===== */
var running = []; /* stop callbacks for anything making sound */
function stopAllSound() { running.slice().forEach(function (f) { try { f(); } catch (e) { /* ignore */ } }); running = []; stopTab(); }

function metronomeHTML() {
  return '<div class="card met"><h2>Metronome</h2>' +
    '<div class="met-row"><button type="button" class="nudge" data-nudge="-5" aria-label="Slower by 5">&minus;5</button>' +
    '<span class="met-bpm">60</span><span class="met-unit">BPM</span><span class="grow"></span>' +
    '<button type="button" class="nudge" data-nudge="5" aria-label="Faster by 5">+5</button></div>' +
    '<input type="range" class="m-bpm" min="30" max="240" value="60" aria-label="Tempo in BPM">' +
    '<div class="row2"><label>Clicks per beat <select class="m-sub"><option value="1">Quarter notes</option><option value="2">Eighth notes</option><option value="3">Triplets</option><option value="4">Sixteenths</option></select></label>' +
    '<button type="button" class="tap">Tap tempo</button></div>' +
    '<div class="beats" aria-hidden="true"><span class="beat"></span><span class="beat"></span><span class="beat"></span><span class="beat"></span></div>' +
    '<details class="trainer"><summary>Speed trainer</summary><p class="hint">Raises the tempo automatically, for the "loop and nudge" method.</p>' +
    '<div class="trow"><label>Add <input type="number" class="t-step" value="5" min="1" max="20"> BPM</label>' +
    '<label>every <input type="number" class="t-bars" value="4" min="1" max="32"> bars</label>' +
    '<label>up to <input type="number" class="t-max" value="120" min="40" max="240"> BPM</label></div>' +
    '<label class="opt"><input type="checkbox" class="t-on"> Use speed trainer</label></details>' +
    '<button type="button" class="btn m-go" aria-pressed="false">Start</button></div>';
}
function mountMetronome(root) {
  var bpm = $(".m-bpm", root), out = $(".met-bpm", root), sub = $(".m-sub", root), go = $(".m-go", root), lights = $$(".beat", root);
  var on = false, timer = null, next = 0, tick = 0, taps = [];
  function show() { out.textContent = bpm.value; }
  bpm.addEventListener("input", show); show();
  $$("[data-nudge]", root).forEach(function (b) { b.addEventListener("click", function () { bpm.value = Math.max(30, Math.min(240, +bpm.value + +b.getAttribute("data-nudge"))); show(); }); });
  $(".tap", root).addEventListener("click", function () {
    var t = performance.now(); taps = taps.filter(function (x) { return t - x < 2500; }); taps.push(t);
    if (taps.length >= 3) { var gaps = []; for (var i = 1; i < taps.length; i++) gaps.push(taps[i] - taps[i - 1]); var avg = gaps.reduce(function (a, b) { return a + b; }) / gaps.length; bpm.value = Math.round(60000 / avg); show(); }
  });
  function click(when, level) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = level === 2 ? 1760 : level === 1 ? 1180 : 760;
    g.gain.setValueAtTime(level === 0 ? 0.12 : 0.3, when); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    o.connect(g); g.connect(master); o.start(when); o.stop(when + 0.06);
  }
  function schedule() {
    var s = +sub.value;
    while (next < ctx.currentTime + 0.12) {
      var beat = Math.floor(tick / s) % 4, isBeat = tick % s === 0;
      if (isBeat && beat === 0 && tick > 0 && $(".t-on", root).checked) {
        var barsDone = Math.floor(tick / s / 4), every = Math.max(1, +$(".t-bars", root).value);
        if (barsDone % every === 0) { var nv = Math.min(+$(".t-max", root).value, +bpm.value + +$(".t-step", root).value); bpm.value = nv; show(); }
      }
      click(next, isBeat ? (beat === 0 ? 2 : 1) : 0);
      if (isBeat) (function (b, w) { setTimeout(function () { lights.forEach(function (l, i) { l.classList.toggle("on", i === b); }); }, Math.max(0, (w - ctx.currentTime) * 1000)); })(beat, next);
      next += 60 / +bpm.value / s; tick++;
    }
  }
  function stop() { on = false; clearInterval(timer); go.textContent = "Start"; go.setAttribute("aria-pressed", "false"); lights.forEach(function (l) { l.classList.remove("on"); }); running = running.filter(function (f) { return f !== stop; }); }
  go.addEventListener("click", function () {
    if (on) { stop(); return; }
    if (!audio()) return;
    on = true; go.textContent = "Stop"; go.setAttribute("aria-pressed", "true");
    tick = 0; next = ctx.currentTime + 0.06; timer = setInterval(schedule, 25); schedule(); running.push(stop);
  });
  return { setBpm: function (v) { bpm.value = v; show(); } };
}

/* ===== practice timer ===== */
function timerHTML() {
  return '<div class="card ptimer"><h2>Practice timer</h2><p class="sub">The daily routine, block by block</p>' +
    '<div class="seg small" role="group" aria-label="Session length"><button type="button" data-len="60" aria-pressed="true">60 min</button><button type="button" data-len="30" aria-pressed="false">30 min</button></div>' +
    '<ol class="blocks"></ol><div class="tclock" aria-live="polite">05:00</div><div class="tnow"></div>' +
    '<div class="trow2"><button type="button" class="btn t-go">Start</button><button type="button" class="btn ghost t-skip">Skip block</button></div>' +
    '<p class="tdone" hidden>Session complete. <button type="button" class="linkbtn t-log">Log this session</button></p></div>';
}
function mountTimer(root, onLog) {
  var full = D.routine.map(function (r) { return { name: r[0], min: r[1], what: r[2] }; });
  var short = [{ name: "Warm-up", min: 5, what: full[0].what }, { name: "Main focus", min: 15, what: full[3].what }, { name: "Play", min: 10, what: full[4].what }];
  var plan = full, idx = 0, remain = plan[0].min * 60, on = false, last = 0, iv = null, total = 0;
  var list = $(".blocks", root), clock = $(".tclock", root), now = $(".tnow", root), go = $(".t-go", root);
  function draw() {
    list.innerHTML = plan.map(function (b, i) { return '<li class="' + (i < idx ? "past" : i === idx ? "cur" : "") + '"><span>' + esc(b.name) + "</span><span>" + b.min + " min</span></li>"; }).join("");
    var m = Math.floor(remain / 60), s = Math.floor(remain % 60);
    clock.textContent = pad2(m) + ":" + pad2(s);
    now.textContent = idx < plan.length ? plan[idx].what : "";
  }
  function tick() {
    var t = Date.now(), dt = (t - last) / 1000; last = t; remain -= dt; total += dt;
    if (remain <= 0) { chime(); idx++; if (idx >= plan.length) { finish(); return; } remain = plan[idx].min * 60; }
    draw();
  }
  function finish() { stop(); idx = plan.length - 1; remain = 0; draw(); $(".tdone", root).hidden = false; }
  function stop() { on = false; clearInterval(iv); go.textContent = "Resume"; }
  go.addEventListener("click", function () {
    if (on) { stop(); return; }
    audio(); on = true; last = Date.now(); iv = setInterval(tick, 250); go.textContent = "Pause";
  });
  $(".t-skip", root).addEventListener("click", function () { chime(); idx++; if (idx >= plan.length) { finish(); return; } remain = plan[idx].min * 60; draw(); });
  $$("[data-len]", root).forEach(function (b) {
    b.addEventListener("click", function () {
      $$("[data-len]", root).forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      plan = b.getAttribute("data-len") === "30" ? short : full; idx = 0; remain = plan[0].min * 60; total = 0; if (on) stop(); go.textContent = "Start"; $(".tdone", root).hidden = true; draw();
    });
  });
  $(".t-log", root).addEventListener("click", function () { onLog && onLog(Math.max(1, Math.round(total / 60))); });
  draw();
  running.push(function () { if (on) stop(); });
}

/* ===== drone ===== */
var drone = { nodes: null, btn: null };
function stopDrone() {
  if (!drone.nodes) return;
  var t = ctx.currentTime; drone.nodes.g.gain.cancelScheduledValues(t); drone.nodes.g.gain.setTargetAtTime(0, t, 0.15);
  var ns = drone.nodes; setTimeout(function () { ns.osc.forEach(function (o) { try { o.stop(); } catch (e) { /* stopped */ } }); }, 800);
  drone.nodes = null; if (drone.btn) { drone.btn.textContent = "Play drone"; drone.btn.setAttribute("aria-pressed", "false"); } drone.btn = null;
}
function startDrone(pc, btn, withFifth) {
  stopDrone(); if (!audio()) return;
  var base = 45 + ((pc - 9 + 12) % 12); if (base > 50) base -= 12;
  var f = 440 * Math.pow(2, (base - 69) / 12), g = ctx.createGain(), lp = ctx.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 700; lp.connect(g); g.connect(master);
  g.gain.setValueAtTime(0, ctx.currentTime); g.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 0.8);
  var osc = [];
  [[f, 0], [f, 6], [f * 2, -4]].concat(withFifth ? [[f * 1.5, 3]] : []).forEach(function (p) {
    var o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = p[0]; o.detune.value = p[1]; o.connect(lp); o.start(); osc.push(o);
  });
  drone.nodes = { g: g, osc: osc }; drone.btn = btn;
  if (btn) { btn.textContent = "Stop drone"; btn.setAttribute("aria-pressed", "true"); }
  running.push(stopDrone);
}
function droneHTML(root) {
  var r = PC[root || "A"];
  return '<div class="card drone"><h2>Drone</h2><p class="sub">A held root note for hearing modes</p><div class="drow">' +
    '<select class="d-root" aria-label="Drone note">' + SHARPS.map(function (n, i) { return '<option value="' + i + '"' + (i === r ? " selected" : "") + ">" + pcName(i, FLAT_KEYS[i]) + "</option>"; }).join("") + "</select>" +
    '<label class="opt"><input type="checkbox" class="d-fifth" checked> Add the 5th</label>' +
    '<button type="button" class="btn d-go" aria-pressed="false">Play drone</button></div></div>';
}
function mountDrone(root) {
  var go = $(".d-go", root);
  go.addEventListener("click", function () { if (drone.btn === go) stopDrone(); else startDrone(+$(".d-root", root).value, go, $(".d-fifth", root).checked); });
  $(".d-root", root).addEventListener("change", function () { if (drone.btn === go) startDrone(+$(".d-root", root).value, go, $(".d-fifth", root).checked); });
  $(".d-fifth", root).addEventListener("change", function () { if (drone.btn === go) startDrone(+$(".d-root", root).value, go, $(".d-fifth", root).checked); });
}

/* ===== backing tracks ===== */
var band = { stop: null };

/* Recorded instruments. Guitar and bass: FluidR3 GM soundfont (Frank Wen, CC BY 3.0).
   Drums: Big Rusty Drums (Karoryfer Samples, CC0). Anything not yet loaded falls back to the synth voices. */
var SMP = { buf: {}, wait: {}, rr: {}, bus: null };
var BAND_KIT = {
  rock: { gtr: "clean", bass: "bass", drums: ["kick", "snare", "hat"] },
  ballad: { gtr: "acoustic", bass: "bass", drums: ["kick", "rim", "hat"] },
  shuffle: { gtr: "clean", bass: "bass", drums: ["kick", "snare", "hat"] },
  swing: { gtr: "jazz", bass: "upright", drums: ["kick", "ride", "hat"] }
};
var DRUM_LAYERS = { kick: 2, snare: 2, rim: 1, hat: 2, ride: 2 };
var DRUM_GAIN = { kick: 0.95, snare: 1.25, rim: 0.9, hat: 0.42, ride: 0.36 };
var GTR_RANGE = [40, 81], BASS_RANGE = [27, 48], SMP_GAIN = 7.5;
function smpLoad(key) {
  if (SMP.buf[key]) return Promise.resolve(SMP.buf[key]);
  if (!SMP.wait[key]) {
    SMP.wait[key] = fetch("samples/" + key + ".mp3").then(function (r) {
      if (!r.ok) throw new Error("missing");
      return r.arrayBuffer();
    }).then(function (a) {
      return new Promise(function (res, rej) { ctx.decodeAudioData(a, res, rej); });
    }).then(function (b) { SMP.buf[key] = b; return b; }, function () { delete SMP.wait[key]; return null; });
  }
  return SMP.wait[key];
}
function bandBus() {
  if (SMP.bus) return SMP.bus;
  var dry = ctx.createGain(), send = ctx.createGain(), verb = ctx.createConvolver(), wet = ctx.createGain();
  var sr = ctx.sampleRate, len = Math.floor(sr * 1.1), ir = ctx.createBuffer(2, len, sr);
  for (var ch = 0; ch < 2; ch++) {
    var d = ir.getChannelData(ch), lp = 0;
    for (var i = 0; i < len; i++) { lp += 0.35 * ((Math.random() * 2 - 1) - lp); d[i] = lp * Math.pow(1 - i / len, 3.2); }
  }
  verb.buffer = ir; wet.gain.value = 0.22; dry.gain.value = 1;
  dry.connect(master); dry.connect(send); send.connect(verb); verb.connect(wet); wet.connect(master);
  SMP.bus = dry; return dry;
}
function smpPlay(inst, midi, t, gain, dur) {
  var rg = inst === "bass" || inst === "upright" ? BASS_RANGE : GTR_RANGE;
  var m = Math.max(rg[0], Math.min(rg[1], midi)), b = SMP.buf[inst + "/" + m], off = 0;
  for (var k = 1; !b && k <= 3; k++) {
    if (SMP.buf[inst + "/" + (m - k)]) { b = SMP.buf[inst + "/" + (m - k)]; off = k; }
    else if (SMP.buf[inst + "/" + (m + k)]) { b = SMP.buf[inst + "/" + (m + k)]; off = -k; }
  }
  if (!SMP.buf[inst + "/" + m]) smpLoad(inst + "/" + m);
  if (!b) return false;
  var src = ctx.createBufferSource(), g = ctx.createGain(), lv = gain * SMP_GAIN;
  src.buffer = b; src.playbackRate.value = Math.pow(2, (midi - m + off) / 12);
  g.gain.setValueAtTime(lv, t);
  if (dur) { g.gain.setValueAtTime(lv, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12); }
  src.connect(g); g.connect(bandBus()); src.start(t);
  src.stop(t + Math.min(b.duration / src.playbackRate.value, dur ? dur + 0.15 : 30));
  return true;
}
function drumSmp(kind, t, vel) {
  var layers = DRUM_LAYERS[kind]; if (!layers) return false;
  var L = layers > 1 && vel >= 0.8 ? 2 : 1, rr = SMP.rr[kind] = (SMP.rr[kind] || 0) % 2 + 1;
  var b = SMP.buf["drums/" + kind + L + "_" + rr] || SMP.buf["drums/" + kind + L + "_1"];
  if (!b) return false;
  var src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = b; src.playbackRate.value = 1 + (Math.random() - 0.5) * 0.012;
  g.gain.value = DRUM_GAIN[kind] * (L === 2 ? 0.8 + 0.2 * vel : 0.65 + 0.5 * vel);
  src.connect(g); g.connect(bandBus()); src.start(t);
  return true;
}
function gtrVoicing(ch) {
  var r = ch.bass, iv = ch.iv.filter(function (i) { return i !== 0; }).sort(function (a, b) { return a - b; });
  var fifth = [7, 6, 8].filter(function (f) { return ch.iv.indexOf(f) > -1; })[0];
  var low = [r], upper = [r + 12];
  if (fifth) low.push(r + fifth);
  iv.forEach(function (i) { var n = r + 12 + i; if (upper.indexOf(n) < 0) upper.push(n); });
  var notes = low.concat(upper);
  if (notes.length < 6 && iv.length <= 2) notes.push(r + 24);
  while (notes.length > 6) notes.splice(notes.indexOf(r + 12), 1);
  return notes.filter(function (n) { return n <= GTR_RANGE[1]; }).sort(function (a, b) { return a - b; });
}
function bandKeys(preset, shift, kit) {
  var keys = {}, i;
  parseBars(preset.bars).forEach(function (bar) {
    bar.forEach(function (x) { if (x.c) gtrVoicing(chordTones(x.c, shift)).forEach(function (n) { keys[kit.gtr + "/" + n] = 1; }); });
  });
  for (i = BASS_RANGE[0]; i <= BASS_RANGE[1]; i++) keys[kit.bass + "/" + i] = 1;
  kit.drums.forEach(function (d) { for (var l = 1; l <= DRUM_LAYERS[d]; l++) { keys["drums/" + d + l + "_1"] = 1; keys["drums/" + d + l + "_2"] = 1; } });
  return Object.keys(keys);
}
function chordTones(c, shift) {
  var pc = (c.root + shift + 120) % 12, base = 52 + ((pc - 4 + 12) % 12);
  return { bass: 40 + ((pc - 4 + 12) % 12), tones: c.iv.map(function (i) { return base + i; }), pc: pc, iv: c.iv };
}
function drum(kind, t, vel) {
  vel = vel == null ? 1 : vel;
  if (drumSmp(kind, t, vel)) return;
  if (kind === "kick") {
    var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.9 * vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.32); return;
  }
  var src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g2 = ctx.createGain(); src.buffer = noise();
  var dur = { snare: 0.16, hat: 0.04, open: 0.22, ride: 0.35, rim: 0.05 }[kind];
  f.type = kind === "snare" || kind === "rim" ? "highpass" : kind === "ride" ? "bandpass" : "highpass";
  f.frequency.value = { snare: 1400, hat: 7500, open: 7000, ride: 5200, rim: 2500 }[kind];
  var gain = { snare: 0.42, hat: 0.11, open: 0.1, ride: 0.07, rim: 0.2 }[kind] * vel;
  g2.gain.setValueAtTime(gain, t); g2.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g2); g2.connect(master); src.start(t); src.stop(t + dur + 0.02);
  if (kind === "snare") { var tn = ctx.createOscillator(), tg = ctx.createGain(); tn.type = "triangle"; tn.frequency.value = 190; tg.gain.setValueAtTime(0.25 * vel, t); tg.gain.exponentialRampToValueAtTime(0.001, t + 0.08); tn.connect(tg); tg.connect(master); tn.start(t); tn.stop(t + 0.1); }
}
function strum(ch, t, gain, dur, down, inst) {
  var tones = ch.voice ? ch.voice.slice() : ch.tones.slice();
  if (down === false) { tones = tones.slice(-4).reverse(); gain *= 0.8; }
  var gap = 0.007 + Math.random() * 0.006;
  tones.forEach(function (m, i) {
    var g = gain * (0.85 + Math.random() * 0.3) * (down === false && i > 0 ? 0.9 : 1);
    if (!inst || !smpPlay(inst, m, t + i * gap, g, dur)) pluck(m, t + i * 0.012, gain, dur);
  });
}
function parseBars(bars) {
  return bars.map(function (b) {
    var syms = b.split(/\s+/), per = 4 / syms.length;
    return syms.map(function (s) { return { sym: s, c: parseChord(s), beats: per }; });
  });
}
function chordAt(bar, beat) { var acc = 0; for (var i = 0; i < bar.length; i++) { acc += bar[i].beats; if (beat < acc) return bar[i]; } return bar[bar.length - 1]; }

function startBand(preset, ui) {
  stopBand(); if (!audio()) return;
  var kit = BAND_KIT[preset.style] || BAND_KIT.rock, cancelled = false;
  band.stop = function () { cancelled = true; band.stop = null; ui.mark(-1); ui.stopped(); };
  running.push(function () { if (band.stop) band.stop(); });
  if (ui.loading) ui.loading(true);
  var keys = bandKeys(preset, ui.shift(), kit);
  Promise.race([Promise.all(keys.map(smpLoad)), new Promise(function (r) { setTimeout(r, 8000); })]).then(function () {
    if (cancelled) return;
    band.stop = null; if (ui.loading) ui.loading(false);
    runBand(preset, ui, kit);
  });
}
function runBand(preset, ui, kit) {
  var bars = parseBars(preset.bars), swing = preset.style === "swing" || preset.style === "shuffle", spb = swing ? 3 : 4;
  var barI = 0, step = 0, next = ctx.currentTime + 0.08, on = true;
  function stepDur() { return 60 / ui.bpm() / spb; }
  function bassNote(m, t, g, d) { if (!smpPlay(kit.bass, m - 12, t, g * 1.1, d)) pluck(m, t, g, d); }
  function play(t) {
    var bar = bars[barI], beat = Math.floor(step / spb), sub = step % spb, cur = chordAt(bar, beat), shift = ui.shift();
    if (!cur.c) return;
    var ch = chordTones(cur.c, shift), st = preset.style, ivs = cur.c.iv;
    ch.voice = gtrVoicing(ch);
    t += (Math.random() - 0.5) * 0.008;
    var third = ivs.indexOf(3) > -1 ? 3 : 4, fifth = ivs.indexOf(6) > -1 && ivs.indexOf(7) < 0 ? 6 : 7;
    if (st === "rock") {
      if (sub === 0 && (beat === 0 || beat === 2)) drum("kick", t);
      if (sub === 2 && beat === 2) drum("kick", t, 0.6);
      if (sub === 0 && (beat === 1 || beat === 3)) drum("snare", t);
      if (sub % 2 === 0) drum("hat", t, sub === 0 ? 1 : 0.6);
      if (sub === 0 && (beat === 0 || beat === 2)) strum(ch, t, 0.12, 0.9, true, kit.gtr);
      if (sub === 2 && (beat === 1 || beat === 3)) strum(ch, t, 0.08, 0.3, false, kit.gtr);
      if (sub === 0 || sub === 2) bassNote(ch.bass + (sub === 2 && beat === 3 ? fifth : 0), t, 0.42, 0.22);
    } else if (st === "ballad") {
      if (sub === 0 && beat === 0) drum("kick", t, 0.8);
      if (sub === 0 && beat === 2) drum("rim", t);
      if (sub === 0) drum("hat", t, 0.7);
      if (sub === 0 && beat === 0) strum(ch, t, 0.13, 3.2, true, kit.gtr);
      if (sub === 0 && beat === 2) strum(ch, t, 0.07, 1.4, true, kit.gtr);
      if (sub === 0 && (beat === 0 || beat === 2)) bassNote(ch.bass + (beat === 2 ? fifth : 0), t, 0.42, 1.2);
    } else if (st === "shuffle") {
      if (sub === 0 || sub === 2) drum("hat", t, sub === 0 ? 1 : 0.55);
      if (sub === 0 && (beat === 0 || beat === 2)) drum("kick", t);
      if (sub === 0 && (beat === 1 || beat === 3)) drum("snare", t, 0.9);
      if (sub === 0 || sub === 2) {
        var walk = [0, third === 3 ? 3 : 4, 7, 9][beat];
        bassNote(ch.bass + walk, t, sub === 0 ? 0.42 : 0.3, 0.18);
        strum({ voice: ch.voice.slice(0, 3) }, t, sub === 0 ? 0.08 : 0.05, 0.14, true, kit.gtr);
      }
    } else if (st === "swing") {
      if (sub === 0 || (sub === 2 && (beat === 1 || beat === 3))) drum("ride", t, sub === 0 ? 1 : 0.7);
      if (sub === 0 && (beat === 1 || beat === 3)) drum("hat", t, 0.8);
      if (sub === 0 && beat === 0) drum("kick", t, 0.35);
      if ((beat === 0 && sub === 0) || (beat === 1 && sub === 2)) strum(ch, t, 0.09, 0.32, true, kit.gtr);
      if (sub === 0) {
        var nb = beat === 3 ? (function () {
          var nbar = bars[(barI + 1) % bars.length], nx = nbar[0].c || cur.c;
          return chordTones(nx, shift).bass - 1;
        })() : null;
        var nxtInBar = chordAt(bar, beat + 1);
        if (beat !== 3 && nxtInBar !== cur && nxtInBar.c) nb = chordTones(nxtInBar.c, shift).bass - 1;
        var note = beat === 0 ? ch.bass : nb !== null ? nb : ch.bass + (beat === 1 ? third : fifth);
        if (beat === 2 && nb === null) note = ch.bass + fifth;
        if (nb === null && cur.beats === 2 && beat % 2 === 1) note = ch.bass + fifth;
        bassNote(note, t, 0.45, 0.4);
      }
    }
  }
  function sched() {
    while (next < ctx.currentTime + 0.15) {
      var t = next, b = barI;
      if (step === 0) (function (bi, w) { setTimeout(function () { ui.mark(bi); }, Math.max(0, (w - ctx.currentTime) * 1000)); })(b, t);
      play(t);
      next += stepDur() * (swing && step % spb === 0 && preset.style === "swing" ? 1 : 1);
      step++;
      if (step >= spb * 4) { step = 0; barI = (barI + 1) % bars.length; }
    }
  }
  var iv = setInterval(sched, 25); sched();
  band.stop = function () { if (!on) return; on = false; clearInterval(iv); ui.mark(-1); ui.stopped(); band.stop = null; };
  running.push(function () { if (band.stop) band.stop(); });
}
function stopBand() { if (band.stop) band.stop(); }

function bandHTML(id) {
  var p = D.bt[id], bars = parseBars(p.bars);
  return '<div class="card band" data-bt="' + id + '"><div class="band-head"><h3>' + esc(p.name) + '</h3><span class="tagline">' + esc(p.style) + "</span></div>" +
    '<div class="chips">' + bars.map(function (b, i) { return '<span class="chip" data-bar="' + i + '">' + b.map(function (x) { return esc(x.sym); }).join(" ") + "</span>"; }).join("") + "</div>" +
    '<div class="band-ctl"><button type="button" class="btn b-go" aria-pressed="false">Play along</button>' +
    '<label>Tempo <input type="range" class="b-bpm" min="40" max="200" value="' + p.bpm + '"> <output class="b-bpm-out">' + p.bpm + "</output></label>" +
    '<label>Key <select class="b-key">' + [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map(function (d) {
      var fc = bars[0][0].c, nm = fc ? pcName(fc.root + d, FLAT_KEYS[(fc.root + d + 120) % 12]) : "";
      return '<option value="' + d + '"' + (d === 0 ? " selected" : "") + ">" + (d === 0 ? "As written" : (d > 0 ? "+" : "") + d + " (starts on " + nm + ")") + "</option>";
    }).join("") + "</select></label></div></div>";
}
function mountBand(card) {
  var p = D.bt[card.getAttribute("data-bt")], go = $(".b-go", card), bpm = $(".b-bpm", card), out = $(".b-bpm-out", card), key = $(".b-key", card);
  var chips = $$(".chip", card), bars = parseBars(p.bars);
  bpm.addEventListener("input", function () { out.textContent = bpm.value; });
  function relabel() {
    var d = +key.value;
    chips.forEach(function (c, i) { c.textContent = bars[i].map(function (x) { return x.c ? chordName(x.c, d) : x.sym; }).join(" "); });
  }
  key.addEventListener("change", relabel);
  go.addEventListener("click", function () {
    if (go.getAttribute("aria-pressed") === "true") { stopBand(); return; }
    go.textContent = "Stop"; go.setAttribute("aria-pressed", "true");
    startBand(p, {
      bpm: function () { return +bpm.value; }, shift: function () { return +key.value; },
      loading: function (on) { if (go.getAttribute("aria-pressed") === "true") go.textContent = on ? "Loading sounds\u2026" : "Stop"; },
      mark: function (i) { chips.forEach(function (c, k) { c.classList.toggle("on", k === i); }); },
      stopped: function () { go.textContent = "Play along"; go.setAttribute("aria-pressed", "false"); }
    });
  });
}
/* ===== coach (Claude in the page) ===== */
function mdLite(t) {
  var out = [], parts = String(t).split(/```[a-z]*\n?/);
  parts.forEach(function (p, i) {
    if (i % 2 === 1) { out.push("<pre><code>" + esc(p.replace(/\n$/, "")) + "</code></pre>"); return; }
    var lines = p.split("\n"), list = null, para = [];
    function flushP() { if (para.length) { out.push("<p>" + fmt(para.join(" ")) + "</p>"); para = []; } }
    function flushL() { if (list) { out.push("<" + list.t + ">" + list.items.map(function (x) { return "<li>" + fmt(x) + "</li>"; }).join("") + "</" + list.t + ">"); list = null; } }
    lines.forEach(function (l) {
      var m;
      if (/^\s*$/.test(l)) { flushP(); flushL(); return; }
      if ((m = /^\s*[-*] (.*)$/.exec(l))) { flushP(); if (!list || list.t !== "ul") { flushL(); list = { t: "ul", items: [] }; } list.items.push(m[1]); return; }
      if ((m = /^\s*\d+[.)] (.*)$/.exec(l))) { flushP(); if (!list || list.t !== "ol") { flushL(); list = { t: "ol", items: [] }; } list.items.push(m[1]); return; }
      if ((m = /^#{1,4} (.*)$/.exec(l))) { flushP(); flushL(); out.push("<h4>" + fmt(m[1]) + "</h4>"); return; }
      flushL(); para.push(l);
    });
    flushP(); flushL();
  });
  return out.join("");
  function fmt(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>"); }
}

var COACH_RULES = "You are a patient, practical guitar teacher coaching a self-taught adult player through a structured 52 week program. " +
  "Answer in British English. Be specific and encouraging, and keep answers under 250 words unless asked for more. " +
  "Use short paragraphs or bullet points. When you show tab, put it in a fenced code block with six lines labelled e|, B|, G|, D|, A|, E| (high e on top), using h, p, b, r, / and ~ for techniques. " +
  "Never use em dashes or en dashes; use commas, colons or full stops instead. If something would need you to hear them play, say so and suggest how they can check it themselves with a recording.";

function recentLogText(n) {
  var l = S.logs.slice().sort(function (a, b) { return (b.date + b.at) > (a.date + a.at) ? 1 : -1; }).slice(0, n || 12);
  if (!l.length) return "No practice logged yet.";
  return l.map(function (e) { return e.date + ", week " + e.week + ": " + e.minutes + " min" + (e.exercise ? ", " + e.exercise : "") + (e.bpm ? " at " + e.bpm + " BPM" : "") + (e.note ? ' ("' + e.note + '")' : ""); }).join("\n");
}
function weekContext(n) {
  var w = W(n), p = S.progress[weekKey(n)] || {};
  var lesson = w.lesson.map(function (s) { return s[0] + "\n" + stripHtml(s[1]); }).join("\n\n");
  if (lesson.length > 7000) lesson = lesson.slice(0, 7000) + "\n[lesson truncated]";
  var ticks = p.k ? Object.keys(p.k).filter(function (k) { return p.k[k]; }).length : 0;
  return "CURRENT WEEK: Week " + n + " of 52, Phase " + w.phase + " (" + D.phases[w.phase - 1].name + "): " + w.title +
    "\nObjective: " + stripHtml(w.obj) + "\nTheir checklist ticks this week: " + ticks + (p.rating ? "\nTheir own rating of this week: " + p.rating : "") +
    "\n\nLESSON TEXT:\n" + lesson + "\n\nRECENT PRACTICE LOG:\n" + recentLogText(10);
}

function coachHTML(prompts, title, intro) {
  return '<section class="coach card"><h2>' + esc(title || "Ask the coach") + '</h2><p class="sub">' + esc(intro || "Claude knows this week's lesson and your recent practice log.") + "</p>" +
    '<div class="c-unavail" hidden><p>Sign in (top right) to use the coach.</p></div>' +
    '<div class="c-body"><div class="c-quick">' + prompts.map(function (q) { return '<button type="button" class="chipbtn" data-q="' + esc(q) + '">' + esc(q) + "</button>"; }).join("") + "</div>" +
    '<div class="c-thread" aria-live="polite"></div>' +
    '<form class="c-form"><label class="vh" for="c-in">Your question</label><textarea id="c-in" class="c-in" rows="2" placeholder="Ask anything about this week, your technique or what to practise next"></textarea>' +
    '<div class="c-actions"><button type="submit" class="btn c-send">Ask</button><button type="button" class="btn ghost c-stop" hidden>Stop</button><button type="button" class="linkbtn c-clear" hidden>Clear conversation</button></div></form></div></section>';
}
function mountCoach(root, contextFn) {
  var thread = $(".c-thread", root), form = $(".c-form", root), input = $(".c-in", root), send = $(".c-send", root), stopB = $(".c-stop", root), clear = $(".c-clear", root);
  var history = [], ctl = null;
  function avail() { var ok = !!CAP.sample; $(".c-unavail", root).hidden = ok || !window.claude; $(".c-body", root).classList.toggle("disabled", !ok); send.disabled = !ok; $$(".chipbtn", root).forEach(function (b) { b.disabled = !ok; }); }
  avail(); root._avail = avail;
  function bubble(role, html) { var d = document.createElement("div"); d.className = "msg " + role; d.innerHTML = html; thread.appendChild(d); return d; }
  function ask(q) {
    if (!CAP.sample || ctl) return;
    q = q.trim(); if (!q) return;
    bubble("me", "<p>" + esc(q) + "</p>");
    var a = bubble("ai", '<p class="thinking">Thinking&hellip;</p>');
    var msgs = history.length ? history.concat([{ role: "user", content: q }])
      : [{ role: "user", content: COACH_RULES + "\n\n" + contextFn() + "\n\nQUESTION: " + q }];
    ctl = new AbortController(); send.disabled = true; stopB.hidden = false;
    CAP.sample(msgs, { signal: ctl.signal, cache: false, onText: function (u) { a.innerHTML = mdLite(u.text); } }).then(function (r) {
      a.innerHTML = mdLite(r.text); mountTabs(a);
      history = msgs.concat([{ role: "assistant", content: r.text }]);
    }, function (err) {
      var code = err && err.code;
      a.innerHTML = code === "cancelled" ? (err.text ? mdLite(err.text) : "<p>Stopped.</p>") :
        "<p class=\"err\">" + esc(code === "rate_limited" ? "The coach is busy right now. Try again in a minute." : code === "not_granted" ? "Sign in (top right) to use the coach." : "Something went wrong getting an answer. Try asking again.") + "</p>";
    }).then(function () { ctl = null; send.disabled = false; stopB.hidden = true; clear.hidden = !history.length; });
  }
  form.addEventListener("submit", function (e) { e.preventDefault(); var q = input.value; input.value = ""; ask(q); });
  input.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  $$(".chipbtn", root).forEach(function (b) { b.addEventListener("click", function () { ask(b.getAttribute("data-q")); }); });
  stopB.addEventListener("click", function () { if (ctl) ctl.abort(); });
  clear.addEventListener("click", function () { history = []; thread.innerHTML = ""; clear.hidden = true; });
}
/* ===== week view ===== */
var RATINGS = ["Solid", "Shaky", "Needs work"];

function revisitFor(n) {
  if (n <= 1) return null;
  var cands = [], today = todayStr();
  for (var w = 1; w < n; w++) {
    var p = S.progress[weekKey(w)] || {}, score = p.rating === "Needs work" ? 3 : p.rating === "Shaky" ? 2 : 0;
    if (p.rev === today) continue;
    cands.push({ w: w, score: score, rev: p.rev || "0000", why: score ? "You rated it " + p.rating.toLowerCase() + "." : "" });
  }
  var weak = cands.filter(function (c) { return c.score; });
  if (weak.length) { weak.sort(function (a, b) { return b.score - a.score || (a.rev < b.rev ? -1 : 1); }); return weak[0]; }
  var spaced = [1, 3, 7, 15, 31].map(function (o) { return n - o; }).filter(function (w) { return w >= 1; });
  var pool = cands.filter(function (c) { return spaced.indexOf(c.w) > -1; });
  if (!pool.length) return null;
  pool.sort(function (a, b) { return a.rev < b.rev ? -1 : a.rev > b.rev ? 1 : b.w - a.w; });
  var pick = pool[0]; pick.why = "Spaced review keeps older material from fading."; return pick;
}

function revisitHTML(n) {
  var r = revisitFor(n);
  if (!r) return "";
  var w = W(r.w);
  return '<div class="card revisit"><h2>Revisit today</h2><p class="rv-title"><a href="' + weekHref(r.w) + '">Week ' + r.w + ": " + esc(w.title) + "</a></p>" +
    '<p class="sub">' + esc(r.why) + " Use it as your warm-up.</p>" +
    '<button type="button" class="btn ghost rv-done" data-rv="' + r.w + '">Revisited today</button></div>';
}

function logFormHTML(n, ex) {
  var opts = (ex || []).concat(["Full practice session", "Song practice", "Improvising"]);
  return '<form class="logform"><div class="lf-grid">' +
    '<label>Date <input type="date" class="lf-date" required></label>' +
    '<label>Minutes <input type="number" class="lf-min" min="1" max="600" value="60" required></label>' +
    '<label class="span2">Exercise <input type="text" class="lf-ex" list="ex-list-' + n + '" placeholder="What you worked on"></label>' +
    '<datalist id="ex-list-' + n + '">' + opts.map(function (o) { return '<option value="' + esc(o) + '">'; }).join("") + "</datalist>" +
    '<label>Clean BPM <input type="number" class="lf-bpm" min="20" max="320" placeholder="Optional"></label>' +
    '<label class="span2">Note for next time <input type="text" class="lf-note" placeholder="Optional"></label>' +
    '</div><button type="submit" class="btn">Save to log</button><p class="lf-msg" aria-live="polite"></p></form>';
}
function mountLogForm(root, n, onSaved) {
  var f = $(".logform", root); if (!f) return;
  $(".lf-date", f).value = todayStr();
  f.addEventListener("submit", function (e) {
    e.preventDefault();
    var entry = { date: $(".lf-date", f).value || todayStr(), week: n, minutes: Math.max(1, +$(".lf-min", f).value || 0),
      exercise: $(".lf-ex", f).value.trim(), bpm: $(".lf-bpm", f).value ? +$(".lf-bpm", f).value : null, note: $(".lf-note", f).value.trim() };
    addLog(entry);
    $(".lf-msg", f).textContent = "Saved: " + entry.minutes + " min" + (entry.exercise ? ", " + entry.exercise : "") + (entry.bpm ? " at " + entry.bpm + " BPM" : "") + ".";
    $(".lf-ex", f).value = ""; $(".lf-bpm", f).value = ""; $(".lf-note", f).value = "";
    onSaved && onSaved();
  });
}
function entriesHTML(list, showWeek) {
  if (!list.length) return '<p class="empty">Nothing logged yet.</p>';
  return '<ul class="entries">' + list.map(function (e) {
    return '<li><span class="e-date">' + esc(fmtDate(e.date)) + "</span>" + (showWeek ? '<a class="e-wk" href="' + weekHref(e.week) + '">W' + e.week + "</a>" : "") +
      '<span class="e-main">' + e.minutes + " min" + (e.exercise ? " &middot; " + esc(e.exercise) : "") + (e.bpm ? ' &middot; <b>' + e.bpm + " BPM</b>" : "") +
      (e.note ? '<span class="e-note">' + esc(e.note) + "</span>" : "") + '</span><button type="button" class="linkbtn e-del" data-del="' + esc(e.id) + '" aria-label="Delete entry">Delete</button></li>';
  }).join("") + "</ul>";
}
function sortedLogs() { return S.logs.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (b.at || 0) - (a.at || 0); }); }

function clipHTML(n) {
  var r = S.recs[weekKey(n)];
  var player = r ? (/^audio/.test(r.type || "") ? '<audio controls preload="metadata" src="' + esc(r.url) + '"></audio>' : '<video controls playsinline preload="metadata" src="' + esc(r.url) + '"></video>') +
    '<p class="sub">' + esc(r.name || "Clip") + " &middot; uploaded " + esc(fmtDate(todayStr(new Date(r.at)))) + "</p>" : "";
  var can = !!CAP.assets;
  return '<div class="card clip"><h2>Sunday clip</h2>' + player +
    (can ? '<label class="upl"><input type="file" class="clip-in" accept="video/*,audio/*"><span class="btn ghost">' + (r ? "Replace clip" : "Upload this week's clip") + "</span></label>" +
      (r ? '<button type="button" class="linkbtn clip-del">Remove clip</button>' : "") + '<p class="sub clip-msg" aria-live="polite">Video or audio, up to 20 MB. Short phone clips work best.</p>'
      : '<p class="sub">' + (window.claude ? "Sign in (top right) to upload clips." : "Sign in (top right) to upload clips.") + "</p>") +
    (r ? '<a class="linkbtn" href="#recordings">Compare with another week</a>' : "") + "</div>";
}
function mountClip(card, n) {
  var input = $(".clip-in", card), msg = $(".clip-msg", card);
  if (input) input.addEventListener("change", function () {
    var file = input.files && input.files[0]; if (!file) return;
    if (file.size > 20 * 1024 * 1024) { msg.textContent = "That clip is " + (file.size / 1048576).toFixed(1) + " MB. The limit is 20 MB, so trim it or record at a lower resolution."; return; }
    msg.textContent = "Uploading " + file.name + "…";
    CAP.assets.upload(file).then(function (res) {
      var old = S.recs[weekKey(n)];
      S.recs[weekKey(n)] = { id: res.id, url: res.url, type: res.contentType || file.type, name: file.name, at: Date.now(), week: n };
      saveRecs();
      if (old && old.id) CAP.assets.delete(old.id).catch(function () {});
      replaceCard();
    }, function (err) {
      var c = err && err.code;
      msg.textContent = c === "too_large" ? "That file is too large. Keep clips under 20 MB." : c === "unsupported_type" ? "That file type isn't supported. Use a common video or audio format such as MP4, MOV, MP3 or M4A." :
        c === "not_uploader" || c === "not_granted" ? "Sign in (top right) to upload clips." : "The upload didn't finish. Check your connection and try again.";
    });
  });
  var del = $(".clip-del", card);
  if (del) del.addEventListener("click", function () {
    if (del.getAttribute("data-confirm") !== "1") { del.setAttribute("data-confirm", "1"); del.textContent = "Tap again to remove the clip for good"; return; }
    var r = S.recs[weekKey(n)]; delete S.recs[weekKey(n)]; saveRecs();
    if (r && r.id && CAP.assets) CAP.assets.delete(r.id).catch(function () {});
    replaceCard();
  });
  function replaceCard() { var tmp = document.createElement("div"); tmp.innerHTML = clipHTML(n); var nc = tmp.firstChild; card.replaceWith(nc); mountClip(nc, n); }
}

function viewWeek(n) {
  var w = W(n), p = wk(n), prev = n > 1 ? n - 1 : null, nxt = n < 52 ? n + 1 : null;
  var hasHl = w.boards.some(function (s) { return s.hl && s.hl.length; });
  var play = "";
  if (w.bt.length || w.drone) {
    play = '<section class="playalong"><h2>Play along</h2><p class="sub">Generated backing tracks for this week\'s vamps. Change the key or tempo to suit.</p>' +
      w.bt.map(bandHTML).join("") + (w.drone ? droneHTML(w.drone) : "") + "</section>";
  }
  var checks = w.days.map(function (d, i) {
    return '<li><label><input type="checkbox" data-check="d' + i + '"><span><span class="day">' + esc(d[0]) + "</span>" + d[1] + "</span></label></li>";
  });
  if (w.sunday) checks.push('<li><label><input type="checkbox" data-check="sun"><span><span class="day">Sunday recording</span>' + w.sunday + "</span></label></li>");
  var html =
    '<div class="wrap"><div class="hero"><div class="wknum">' + pad2(n) + '</div><div><div class="eyebrow">Week ' + n + " of 52 &middot; Phase " + w.phase + " &middot; " + esc(D.phases[w.phase - 1].name) +
    "</div><h1>" + esc(w.title) + '</h1></div><p class="objective"><b>Objective</b>' + w.obj + "</p></div></div>" +
    '<section class="boards" aria-labelledby="fb-h"><div class="wrap"><div class="boards-head"><h2 id="fb-h">On the fretboard</h2>' +
    "<p>Tap a dot to hear it. Use the key menu to move any diagram to a new key.</p>" +
    '<div class="seg" role="group" aria-label="Dot labels"><button type="button" data-mode="note" aria-pressed="true">Notes</button><button type="button" data-mode="degree" aria-pressed="false">Degrees</button><button type="button" data-mode="custom" aria-pressed="false">Fingers</button><button type="button" data-mode="none" aria-pressed="false">Blank</button></div></div>' +
    '<div class="board-grid">' + boardsHTML(w.boards) + '</div><div class="legend"><span class="l-root">Root</span>' + (hasHl ? '<span class="l-hl">Character or target note</span>' : "") + "<span>Other notes</span></div></div></section>" +
    '<div class="wrap"><div class="main"><article class="lesson">' + play +
    w.lesson.map(function (s) { return "<section><h2>" + esc(s[0]) + "</h2>" + s[1] + "</section>"; }).join("") +
    coachHTML(["Give me a fresh variation of this week's main exercise", "I'm finding this week hard. How should I adjust?", "Explain the key idea of this week another way", "What should I listen for when I review my clip?"]) +
    '<details class="about"><summary>About Phase ' + w.phase + "</summary>" + D.intros[w.phase - 1] + "</details></article>" +
    '<aside class="panel"><div class="card"><h2>This week\'s practice</h2><p class="sub check-count">0 ticked</p><ul class="checklist">' + checks.join("") + "</ul>" +
    '<p class="rate-label">How solid does this week feel?</p><div class="seg small rating" role="group" aria-label="Rate this week">' +
    RATINGS.map(function (r) { return '<button type="button" data-rate="' + r + '" aria-pressed="' + (p.rating === r) + '">' + r + "</button>"; }).join("") + "</div>" +
    '<button type="button" class="btn ghost week-done" aria-pressed="false">Mark week complete</button></div>' +
    '<div class="rv-slot">' + revisitHTML(n) + "</div>" + timerHTML() + metronomeHTML() +
    '<div class="card"><h2>Log a session</h2>' + logFormHTML(n, w.ex) + '<div class="wk-entries"></div><a class="linkbtn" href="#log">See your full log and charts</a></div>' +
    '<div class="clip-slot">' + clipHTML(n) + "</div></aside></div></div>" +
    '<nav class="footnav" aria-label="Previous and next week"><div class="wrap">' +
    (prev ? '<a href="' + weekHref(prev) + '"><small>Previous</small><span>' + prev + ". " + esc(W(prev).title) + "</span></a>" : "<span></span>") +
    (nxt ? '<a class="next" href="' + weekHref(nxt) + '"><small>Next</small><span>' + nxt + ". " + esc(W(nxt).title) + "</span></a>" : '<a class="next" href="#"><small>Finished</small><span>Back to the year</span></a>') +
    "</div></nav>";
  var app = $("#app"); app.innerHTML = html;
  mountBoards($(".boards", app), w.boards);
  mountTabs($(".lesson", app));
  $$(".band", app).forEach(mountBand);
  $$(".drone", app).forEach(mountDrone);
  var met = mountMetronome($(".met", app));
  mountTimer($(".ptimer", app), function (mins) {
    var f = $(".logform", app); $(".lf-min", f).value = mins; $(".lf-ex", f).value = "Full practice session"; f.scrollIntoView({ behavior: "smooth", block: "center" }); $(".lf-ex", f).focus();
  });
  mountCoach($(".coach", app), function () { return weekContext(n); });
  /* checkpoint tasks in the lesson become checkboxes */
  $$("li.task", app).forEach(function (li) {
    var k = li.getAttribute("data-task"), lab = document.createElement("label"), inp = document.createElement("input");
    inp.type = "checkbox"; inp.setAttribute("data-check", k);
    while (li.firstChild) lab.appendChild(li.firstChild);
    li.appendChild(inp); li.appendChild(lab);
    lab.addEventListener("click", function () { inp.click(); });
  });
  var boxes = $$("input[data-check]", app), count = $(".check-count", app), done = $(".week-done", app);
  function refresh() {
    var c = boxes.filter(function (b) { return b.checked; }).length;
    count.textContent = c + " of " + boxes.length + " ticked";
    done.setAttribute("aria-pressed", p.done ? "true" : "false"); done.textContent = p.done ? "Week complete" : "Mark week complete";
    document.body.classList.toggle("is-done", !!p.done);
  }
  boxes.forEach(function (b) {
    b.checked = !!p.k[b.getAttribute("data-check")];
    b.addEventListener("change", function () { p.k[b.getAttribute("data-check")] = b.checked; saveProgress(); refresh(); });
  });
  done.addEventListener("click", function () { p.done = !p.done; if (p.done && !p.doneOn) p.doneOn = todayStr(); saveProgress(); refresh(); });
  $$("[data-rate]", app).forEach(function (b) {
    b.addEventListener("click", function () {
      p.rating = p.rating === b.getAttribute("data-rate") ? null : b.getAttribute("data-rate"); saveProgress();
      $$("[data-rate]", app).forEach(function (x) { x.setAttribute("aria-pressed", x.getAttribute("data-rate") === p.rating ? "true" : "false"); });
    });
  });
  $(".rv-slot", app).addEventListener("click", function (e) {
    var b = e.target.closest(".rv-done"); if (!b) return;
    wk(+b.getAttribute("data-rv")).rev = todayStr(); saveProgress(); $(".rv-slot", app).innerHTML = revisitHTML(n);
  });
  function drawEntries() {
    var list = sortedLogs().filter(function (e) { return e.week === n; }).slice(0, 5);
    $(".wk-entries", app).innerHTML = list.length ? '<h3 class="minihead">This week</h3>' + entriesHTML(list, false) : "";
  }
  mountLogForm(app, n, drawEntries); drawEntries();
  $(".wk-entries", app).addEventListener("click", function (e) { var b = e.target.closest("[data-del]"); if (b) { deleteLog(b.getAttribute("data-del")); drawEntries(); } });
  mountClip($(".clip-slot .clip", app), n);
  refresh();
  VIEW.onCaps = function () {
    var slot = $(".clip-slot", app); if (slot) { slot.innerHTML = clipHTML(n); mountClip($(".clip", slot), n); }
    var co = $(".coach", app); if (co && co._avail) co._avail();
  };
  void met;
}
/* ===== home ===== */
function logStats() {
  var days = {}, total = 0, weekMin = 0, now = new Date(), monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  S.logs.forEach(function (e) { days[e.date] = (days[e.date] || 0) + (+e.minutes || 0); total += +e.minutes || 0; if (parseDay(e.date) >= monday) weekMin += +e.minutes || 0; });
  var streak = 0, d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days[todayStr(d)]) d.setDate(d.getDate() - 1);
  while (days[todayStr(d)]) { streak++; d.setDate(d.getDate() - 1); }
  return { days: days, total: total, weekMin: weekMin, streak: streak, sessions: S.logs.length };
}

function viewHome() {
  var done = 0; for (var n = 1; n <= 52; n++) if (weekDone(n)) done++;
  var cur = currentWeek(), st = logStats(), rv = revisitFor(cur);
  var phases = D.phases.map(function (ph, pi) {
    var cards = D.weeks.filter(function (w) { return w.phase === pi + 1; }).map(function (w) {
      var state = weekDone(w.num) ? "done" : weekStarted(w.num) ? "active" : "todo", r = (S.progress[weekKey(w.num)] || {}).rating;
      return '<a class="wk' + ([13, 26, 39, 52].indexOf(w.num) > -1 ? " review" : "") + (w.num === cur ? " current" : "") + '" href="' + weekHref(w.num) + '" data-state="' + state + '">' +
        '<span class="wk-n">' + pad2(w.num) + '</span><span class="wk-title">' + esc(w.title) + '</span><span class="wk-goal">' + w.goal.replace(/<\/?strong>/g, "") + "</span>" +
        '<span class="state">' + (state === "done" ? "Done" : state === "active" ? "In progress" : "") + (r ? " &middot; " + esc(r) : "") + "</span></a>";
    }).join("");
    return '<section class="phase"><div class="phase-head"><span class="pn-num">' + (pi + 1) + "</span><h2>" + esc(ph.name) + "</h2><p>Weeks " + (pi * 13 + 1) + " to " + (pi * 13 + 13) + ". " + esc(ph.goal) + '</p></div><div class="weeks">' + cards + "</div></section>";
  }).join("");
  var tools = TOOLS.map(function (t) { return '<a class="tool" href="#' + t[0] + '"><span class="tool-n">' + esc(t[1]) + '</span><span class="tool-d">' + esc(t[2]) + "</span></a>"; }).join("");
  $("#app").innerHTML =
    '<div class="wrap ix-hero"><div class="eyebrow">A self-directed year, one hour a day</div><h1>Fifty-two <em>weeks</em><br>on the fretboard</h1>' +
    "<p>Four phases take you from posture and open chords to drop 2 voicings, melodic minor and your own composition. Every week has playable fretboard diagrams, tab you can loop, backing tracks, a coach and a log that tracks your progress.</p>" +
    '<div class="ix-progress"><div class="track" role="progressbar" aria-valuemin="0" aria-valuemax="52" aria-valuenow="' + done + '"><div class="bar" style="width:' + (done / 52 * 100).toFixed(1) + '%"></div></div>' +
    '<span class="mono">' + done + ' of 52 weeks complete</span><a class="btn auto" href="' + weekHref(cur) + '">' + (done ? "Continue with Week " : "Start Week ") + cur + "</a></div>" +
    '<div class="today"><div><span class="t-k">Streak</span><span class="t-v">' + st.streak + " day" + (st.streak === 1 ? "" : "s") + '</span></div><div><span class="t-k">This week</span><span class="t-v">' + st.weekMin + ' min</span></div>' +
    '<div><span class="t-k">All time</span><span class="t-v">' + (st.total / 60).toFixed(1) + " h</span></div>" +
    (rv ? '<div class="t-wide"><span class="t-k">Revisit today</span><a class="t-v" href="' + weekHref(rv.w) + '">Week ' + rv.w + ": " + esc(W(rv.w).title) + "</a></div>" : "") + "</div></div>" +
    '<div class="wrap">' + phases + '</div><div class="wrap"><section class="phase"><div class="phase-head"><span class="pn-num">+</span><h2>Practice tools</h2><p>Use these any day, alongside the weekly plan.</p></div><div class="tools">' + tools + "</div></section></div>" +
    '<div class="wrap"><div class="guide lesson"><div><h2>' + esc(D.guide[0][0]) + "</h2>" + D.guide[0][1] + "</div><div><h2>" + esc(D.guide[1][0]) + "</h2>" + D.guide[1][1] + "</div></div></div>";
}
var TOOLS = [
  ["fretboard-quiz", "Fretboard quiz", "Name the lit note against the clock"],
  ["ear-trainer", "Ear trainer", "Intervals and chord qualities by ear"],
  ["chord-finder", "Chord and scale finder", "Any chord or scale across the neck"],
  ["scales", "Scales and chord shapes", "Colour-coded scale degrees, CAGED positions and movable chord shapes"],
  ["backing-tracks", "Backing tracks", "Every vamp and blues in the program, plus your own"],
  ["drone", "Drone", "A held root note for modes and intonation"],
  ["practice-timer", "Practice timer", "The daily routine, block by block, with the metronome"]
];

/* ===== log ===== */
function heatmapSVG(days) {
  var cols = 20, cell = 13, gap = 3, left = 28, top = 18, w = left + cols * (cell + gap), h = top + 7 * (cell + gap) + 4;
  var now = new Date(), start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) - (cols - 1) * 7);
  var out = '<svg viewBox="0 0 ' + w + " " + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="Practice minutes per day for the last 20 weeks">';
  ["Mon", "", "Wed", "", "Fri", "", "Sun"].forEach(function (l, i) { if (l) out += '<text class="hm-l" x="0" y="' + (top + i * (cell + gap) + 10) + '">' + l + "</text>"; });
  var lastMonth = -1;
  for (var c = 0; c < cols; c++) for (var r = 0; r < 7; r++) {
    var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + c * 7 + r);
    if (r === 0 && d.getMonth() !== lastMonth) { lastMonth = d.getMonth(); out += '<text class="hm-l" x="' + (left + c * (cell + gap)) + '" y="11">' + d.toLocaleDateString("en-GB", { month: "short" }) + "</text>"; }
    if (d > now) continue;
    var m = days[todayStr(d)] || 0, lvl = m === 0 ? 0 : m < 20 ? 1 : m < 45 ? 2 : m < 75 ? 3 : 4;
    out += '<rect class="hm hm' + lvl + '" x="' + (left + c * (cell + gap)) + '" y="' + (top + r * (cell + gap)) + '" width="' + cell + '" height="' + cell + '" rx="2"><title>' + esc(fmtDate(todayStr(d))) + ": " + m + " min</title></rect>";
  }
  return out + "</svg>";
}
function bpmChartSVG(ex) {
  var pts = S.logs.filter(function (e) { return e.exercise === ex && e.bpm; }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.at || 0) - (b.at || 0); });
  if (!pts.length) return '<p class="empty">Log a clean BPM for an exercise to see it climb here.</p>';
  var W2 = 640, H = 230, L = 44, R = 20, T = 16, B = 34;
  var ts = pts.map(function (p) { return parseDay(p.date).getTime(); }), t0 = Math.min.apply(null, ts), t1 = Math.max.apply(null, ts);
  var vs = pts.map(function (p) { return p.bpm; }), vmin = Math.min.apply(null, vs), vmax = Math.max.apply(null, vs);
  var stepV = [5, 10, 20, 25, 50].filter(function (s) { return (vmax - vmin + 10) / s <= 5; })[0] || 50;
  var lo = Math.floor((vmin - 5) / stepV) * stepV, hi = Math.ceil((vmax + 5) / stepV) * stepV;
  if ((hi - lo) / stepV < 2) hi = lo + 2 * stepV;
  var X = function (t) { return t1 === t0 ? L + (W2 - L - R) / 2 : L + (t - t0) / (t1 - t0) * (W2 - L - R); };
  var Y = function (v) { return T + (hi - v) / (hi - lo) * (H - T - B); };
  var out = '<svg class="chart" viewBox="0 0 ' + W2 + " " + H + '" role="img" aria-label="Clean BPM over time for ' + esc(ex) + '">';
  for (var v = lo; v <= hi; v += stepV) { var y = Y(v); out += '<line class="grid" x1="' + L + '" x2="' + (W2 - R) + '" y1="' + y + '" y2="' + y + '"/><text class="axis" x="' + (L - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + Math.round(v) + "</text>"; }
  out += '<text class="axis" x="' + L + '" y="' + (H - 8) + '">' + esc(fmtDate(pts[0].date)) + "</text>";
  if (pts.length > 1) out += '<text class="axis" x="' + (W2 - R) + '" y="' + (H - 8) + '" text-anchor="end">' + esc(fmtDate(pts[pts.length - 1].date)) + "</text>";
  var path = pts.map(function (p, i) { return (i ? "L" : "M") + X(ts[i]).toFixed(1) + " " + Y(p.bpm).toFixed(1); }).join(" ");
  if (pts.length > 1) out += '<path class="area" d="' + path + " L" + X(ts[ts.length - 1]).toFixed(1) + " " + (H - B) + " L" + X(ts[0]).toFixed(1) + " " + (H - B) + ' Z"/><path class="ln" d="' + path + '"/>';
  pts.forEach(function (p, i) { out += '<circle class="pt' + (i === pts.length - 1 ? " last" : "") + '" cx="' + X(ts[i]).toFixed(1) + '" cy="' + Y(p.bpm).toFixed(1) + '" r="' + (i === pts.length - 1 ? 5 : 3) + '"><title>' + esc(fmtDate(p.date)) + ": " + p.bpm + " BPM</title></circle>"; });
  var lp = pts[pts.length - 1];
  out += '<text class="endlab" x="' + Math.min(W2 - R, X(ts[ts.length - 1])) + '" y="' + (Y(lp.bpm) - 10) + '" text-anchor="end">' + lp.bpm + " BPM" + (pts.length > 1 ? " (" + (lp.bpm - pts[0].bpm >= 0 ? "+" : "") + (lp.bpm - pts[0].bpm) + ")" : "") + "</text>";
  return out + "</svg>";
}
function toCSV() {
  var rows = [["date", "week", "minutes", "exercise", "bpm", "note"]].concat(sortedLogs().reverse().map(function (e) { return [e.date, e.week, e.minutes, e.exercise || "", e.bpm || "", e.note || ""]; }));
  return rows.map(function (r) { return r.map(function (c) { c = String(c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(","); }).join("\n");
}
function saveFile(name, data, msgEl) {
  if (CAP.downloads) {
    CAP.downloads.save({ filename: name, data: data }).then(function () { msgEl.textContent = "Saved " + name + "."; }, function (e) {
      msgEl.textContent = e && e.code === "declined" ? "Download cancelled." : "The download didn't go through. The text is shown below so you can copy it.";
      if (!(e && e.code === "declined")) showText();
    });
  } else showText();
  function showText() { msgEl.innerHTML = 'Downloads aren\'t available in this view. Copy the text below instead.<textarea class="exportbox" rows="8" readonly></textarea>'; $(".exportbox", msgEl).value = data; $(".exportbox", msgEl).select(); }
}
function viewLog() {
  var st = logStats(), exs = {};
  S.logs.forEach(function (e) { if (e.exercise && e.bpm) exs[e.exercise] = (exs[e.exercise] || 0) + 1; });
  var exList = Object.keys(exs).sort(function (a, b) { return exs[b] - exs[a]; });
  var cur = currentWeek();
  $("#app").innerHTML = '<div class="wrap pagehead"><div class="eyebrow">Your practice</div><h1>Practice log</h1></div>' +
    '<div class="wrap"><div class="statrow"><div><span class="t-k">Streak</span><span class="t-v">' + st.streak + ' d</span></div><div><span class="t-k">This week</span><span class="t-v">' + st.weekMin + " min</span></div>" +
    '<div><span class="t-k">Sessions</span><span class="t-v">' + st.sessions + '</span></div><div><span class="t-k">All time</span><span class="t-v">' + (st.total / 60).toFixed(1) + " h</span></div></div>" +
    '<div class="logcols"><div class="lc-main">' +
    '<section class="card"><h2>Last 20 weeks</h2><div class="hm-wrap">' + heatmapSVG(st.days) + '</div><div class="hm-key"><span>Less</span><i class="hm0"></i><i class="hm1"></i><i class="hm2"></i><i class="hm3"></i><i class="hm4"></i><span>More</span></div></section>' +
    '<section class="card"><div class="ch-head"><h2>Clean BPM over time</h2>' + (exList.length ? '<select class="ch-ex" aria-label="Exercise">' + exList.map(function (x) { return '<option value="' + esc(x) + '">' + esc(x) + "</option>"; }).join("") + "</select>" : "") + '</div><div class="ch-slot">' + bpmChartSVG(exList[0] || "") + "</div></section>" +
    '<section class="card"><h2>All entries</h2><div class="all-entries">' + entriesHTML(sortedLogs(), true) + "</div>" +
    '<div class="exp"><button type="button" class="btn ghost auto x-csv">Export log (CSV)</button><button type="button" class="btn ghost auto x-json">Export everything (JSON)</button></div><div class="x-msg sub" aria-live="polite"></div></section>' +
    '</div><div class="lc-side"><div class="card"><h2>Add an entry</h2>' + logFormHTML(cur, W(cur).ex) + "</div>" +
    coachHTML(["Review my log and tell me what to focus on next week", "Am I practising enough to stay on schedule?", "Which exercise is improving fastest?"], "Coach review", "Claude reads your log and your progress through the program.") + "</div></div></div>";
  var app = $("#app");
  mountLogForm(app, cur, function () { viewLog(); });
  var sel = $(".ch-ex", app); if (sel) sel.addEventListener("change", function () { $(".ch-slot", app).innerHTML = bpmChartSVG(sel.value); });
  $(".all-entries", app).addEventListener("click", function (e) {
    var b = e.target.closest("[data-del]"); if (!b) return;
    if (b.getAttribute("data-confirm") !== "1") { b.setAttribute("data-confirm", "1"); b.textContent = "Delete?"; return; }
    deleteLog(b.getAttribute("data-del")); viewLog();
  });
  $(".x-csv", app).addEventListener("click", function () { saveFile("guitar-practice-log.csv", toCSV(), $(".x-msg", app)); });
  $(".x-json", app).addEventListener("click", function () { saveFile("guitar-program-backup.json", JSON.stringify({ progress: S.progress, logs: S.logs, recordings: S.recs, stats: S.stats }, null, 2), $(".x-msg", app)); });
  mountCoach($(".coach", app), function () {
    var done = []; for (var n = 1; n <= 52; n++) if (weekDone(n)) done.push(n);
    var rated = Object.keys(S.progress).filter(function (k) { return S.progress[k].rating; }).map(function (k) { return "Week " + (+k.slice(1)) + ": " + S.progress[k].rating; });
    return "PROGRAM STATUS: current week " + cur + " (" + W(cur).title + "). Weeks complete: " + (done.join(", ") || "none") + ". Their own ratings: " + (rated.join("; ") || "none") +
      ". Streak " + st.streak + " days, " + st.weekMin + " minutes this week, " + (st.total / 60).toFixed(1) + " hours in total.\n\nPRACTICE LOG (most recent first):\n" + recentLogText(40);
  });
  VIEW.onCaps = function () { var co = $(".coach", app); if (co && co._avail) co._avail(); };
}

/* ===== recordings ===== */
function viewRecordings() {
  var keys = Object.keys(S.recs).sort(), clips = keys.map(function (k) { return S.recs[k]; });
  var opts = function (sel) { return clips.map(function (c) { return '<option value="' + c.week + '"' + (c.week === sel ? " selected" : "") + ">Week " + c.week + ": " + esc(W(c.week).title) + "</option>"; }).join(""); };
  var media = function (c) { return c ? (/^audio/.test(c.type || "") ? '<audio controls preload="metadata" src="' + esc(c.url) + '"></audio>' : '<video controls playsinline preload="metadata" src="' + esc(c.url) + '"></video>') : ""; };
  var body;
  if (!clips.length) {
    body = '<div class="card empty-state"><h2>No clips yet</h2><p>Each week ends with a Sunday recording. Upload it from the week\'s page, under Sunday clip, and it appears here. Once you have two, you can play them side by side to hear how far you have come.</p><a class="btn auto" href="' + weekHref(currentWeek()) + '">Go to Week ' + currentWeek() + "</a></div>";
  } else {
    var a = clips[0].week, b = clips[clips.length - 1].week;
    body = '<section class="card"><h2>Compare two weeks</h2><div class="cmp"><div><select class="cmp-a" aria-label="First clip">' + opts(a) + '</select><div class="cmp-m cmp-ma">' + media(S.recs[weekKey(a)]) + "</div></div>" +
      '<div><select class="cmp-b" aria-label="Second clip">' + opts(b) + '</select><div class="cmp-m cmp-mb">' + media(S.recs[weekKey(b)]) + "</div></div></div>" +
      '<button type="button" class="btn auto cmp-play">Play both from the start</button></section>' +
      '<section class="card"><h2>All clips</h2><ul class="cliplist">' + clips.map(function (c) { return '<li><a href="' + weekHref(c.week) + '">Week ' + c.week + ": " + esc(W(c.week).title) + '</a><span class="sub">' + esc(c.name || "") + "</span></li>"; }).join("") + "</ul></section>";
  }
  $("#app").innerHTML = '<div class="wrap pagehead"><div class="eyebrow">Your Sunday clips</div><h1>Recordings</h1></div><div class="wrap narrow">' + body + "</div>";
  var app = $("#app"), sa = $(".cmp-a", app);
  if (sa) {
    var sb = $(".cmp-b", app);
    sa.addEventListener("change", function () { $(".cmp-ma", app).innerHTML = media(S.recs[weekKey(+sa.value)]); });
    sb.addEventListener("change", function () { $(".cmp-mb", app).innerHTML = media(S.recs[weekKey(+sb.value)]); });
    $(".cmp-play", app).addEventListener("click", function () { $$(".cmp-m video, .cmp-m audio", app).forEach(function (m) { try { m.currentTime = 0; var p = m.play(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* ignore */ } }); });
  }
}

/* ===== tools index and simple tool pages ===== */
function viewTools() {
  $("#app").innerHTML = '<div class="wrap pagehead"><div class="eyebrow">Any day, any week</div><h1>Practice tools</h1></div><div class="wrap"><div class="tools big">' +
    TOOLS.map(function (t) { return '<a class="tool" href="#' + t[0] + '"><span class="tool-n">' + esc(t[1]) + '</span><span class="tool-d">' + esc(t[2]) + "</span></a>"; }).join("") + "</div></div>";
}
function viewTimer() {
  $("#app").innerHTML = '<div class="wrap pagehead"><div class="eyebrow">Practice tools</div><h1>Practice timer</h1></div><div class="wrap"><div class="two">' + timerHTML() + metronomeHTML() + "</div></div>";
  var app = $("#app"); mountMetronome($(".met", app));
  mountTimer($(".ptimer", app), function (mins) { var cur = currentWeek(); addLog({ date: todayStr(), week: cur, minutes: mins, exercise: "Full practice session", bpm: null, note: "" }); $(".tdone", app).textContent = "Logged " + mins + " min against Week " + cur + "."; });
}
function viewDrone() {
  $("#app").innerHTML = '<div class="wrap pagehead"><div class="eyebrow">Practice tools</div><h1>Drone</h1><p class="lede">Hold a root note while you play a mode over it. Every mode sounds different against the same drone; that difference is what you are learning to hear.</p></div><div class="wrap"><div class="two">' + droneHTML("A") + metronomeHTML() + "</div></div>";
  var app = $("#app"); mountDrone($(".drone", app)); mountMetronome($(".met", app));
}
function viewBacking() {
  var groups = [["Rock and pop", ["g-cdg", "g-pop", "c-amfg", "a-e-fsm-d", "am-jam", "tap-prog", "sweep-prog", "slow-am"]],
    ["Mode vamps", ["a-ionian", "a-dorian", "a-phryg", "a-lydian", "a-mixo", "a-aeol", "d7-vamp"]],
    ["Blues", ["blues-a", "blues-c", "minor-blues", "jazz-blues"]],
    ["Jazz and harmony", ["ii-v-i-vi", "dm-g7", "autumn", "key-change", "e7-am", "minor-prog", "e7alt-am", "minor-ii-v-i", "borrow-iv", "borrow-bvi"]]];
  $("#app").innerHTML = '<div class="wrap pagehead"><div class="eyebrow">Practice tools</div><h1>Backing tracks</h1><p class="lede">Recorded drums, bass and guitar. Pick a track, set the tempo and key, and play over it.</p></div>' +
    '<div class="wrap"><section class="card custom"><h2>Build your own</h2><p class="sub">One chord per bar, separated by spaces. Join two chords in one bar with a plus, for example <code>Am7 D7 Gmaj7 Cmaj7+F#m7b5</code>.</p>' +
    '<div class="cu-row"><input type="text" class="cu-in" value="Am7 D7 Gmaj7 Cmaj7" aria-label="Chord progression"><select class="cu-style" aria-label="Style"><option value="rock">Rock</option><option value="ballad">Ballad</option><option value="shuffle">Shuffle</option><option value="swing">Swing</option></select><button type="button" class="btn auto cu-make">Make track</button></div><p class="cu-msg sub" aria-live="polite"></p><div class="cu-slot"></div></section>' +
    groups.map(function (g) { return '<section class="btgroup"><h2 class="grouphead">' + esc(g[0]) + '</h2><div class="bands">' + g[1].map(bandHTML).join("") + "</div></section>"; }).join("") +
    '<p class="sub credits">Guitar and bass samples from the FluidR3 GM soundfont by Frank Wen (CC BY 3.0). Drums from Big Rusty Drums by Karoryfer Samples (CC0).</p></div>';
  var app = $("#app"); $$(".bands .band", app).forEach(mountBand);
  $(".cu-make", app).addEventListener("click", function () {
    var raw = $(".cu-in", app).value.trim().split(/\s+/).filter(Boolean), bad = [];
    var bars = raw.map(function (b) { var parts = b.split("+"); parts.forEach(function (p) { if (!parseChord(p)) bad.push(p); }); return parts.join(" "); });
    if (!bars.length) { $(".cu-msg", app).textContent = "Type at least one chord."; return; }
    if (bad.length) { $(".cu-msg", app).textContent = "I don't recognise " + bad.join(", ") + ". Try forms like C, Cm, C7, Cmaj7, Cm7, Cm7b5, Cdim7, C6, Csus4 or C7alt."; return; }
    stopBand();
    D.bt.custom = { name: "Your progression", style: $(".cu-style", app).value, bpm: 90, bars: bars };
    $(".cu-msg", app).textContent = "";
    $(".cu-slot", app).innerHTML = bandHTML("custom"); mountBand($(".cu-slot .band", app));
  });
}

/* ===== fretboard scales and chord shapes (tool) ===== */
var FS_HTML = '<div class="fs-tabs" id="fs-tabs">\n  <button data-page="scales" class="fs-tab fs-sel">Fret Scales</button>\n  <button data-page="chords" class="fs-tab">Chord Shapes</button>\n</div>\n\n<div id="fs-pageScales">\n<div class="fs-head">\n  <h2>Fretboard Scales</h2>\n  <p>Pick a key, choose major or minor, then scroll the neck left and right.</p>\n</div>\n\n<p class="fs-label">Key</p>\n<div class="fs-keys" id="fs-keys"></div>\n\n<p class="fs-label">Scale</p>\n<div class="fs-mode" id="fs-mode">\n  <button data-mode="major" class="fs-sel">Major</button>\n  <button data-mode="minor">Minor</button>\n</div>\n\n<p class="fs-label">CAGED shapes</p>\n<div class="fs-caged-ctrl">\n  <div class="fs-caged-row">\n    <div class="fs-chips" id="fs-cagedChips">\n      <button data-shape="all" class="fs-chip">All</button>\n      <button data-shape="C" class="fs-chip" style="color:#56c7e0">C</button>\n      <button data-shape="A" class="fs-chip" style="color:#f48fb1">A</button>\n      <button data-shape="G" class="fs-chip" style="color:#b39ddb">G</button>\n      <button data-shape="E" class="fs-chip" style="color:#ffd166">E</button>\n      <button data-shape="D" class="fs-chip" style="color:#80d8a0">D</button>\n    </div>\n    <button id="fs-pentaBtn" class="fs-penta-btn">Pentatonic</button>\n  </div>\n  <p class="fs-caged-note" id="fs-cagedNote" hidden></p>\n</div>\n\n<p class="fs-showing" id="fs-showing"></p>\n\n<div class="fs-board-wrap">\n  <div class="fs-scroll" id="fs-scroll">\n    <div class="fs-board" id="fs-board"></div>\n    <div class="fs-nums" id="fs-nums"></div>\n  </div>\n</div>\n<p class="fs-scroll-hint">Open strings are on the left of the nut. Swipe to reach the higher frets.</p>\n\n<p class="fs-label" style="margin-top:12px">Scale degrees</p>\n<div class="fs-legend" id="fs-legend"></div>\n</div><!-- /pageScales -->\n\n<div id="fs-pageChords" hidden>\n<div class="fs-head">\n  <h2>Chord Shapes</h2>\n  <p>Pick a root and chord type, then choose a position to see that shape on the neck.</p>\n</div>\n\n<p class="fs-label">Root</p>\n<div class="fs-keys" id="fs-chordKeys"></div>\n\n<p class="fs-label">Chord type</p>\n<div class="fs-ctypes" id="fs-chordTypes"></div>\n\n<p class="fs-label">Position</p>\n<div class="fs-chips" id="fs-chordPos"></div>\n\n<p class="fs-showing" id="fs-chordShowing"></p>\n\n<div class="fs-board-wrap">\n  <div class="fs-scroll" id="fs-chordScroll">\n    <div class="fs-board" id="fs-chordBoard"></div>\n    <div class="fs-nums" id="fs-chordNums"></div>\n  </div>\n</div>\n<p class="fs-scroll-hint">"All tones" maps every chord note on the neck; a position shows one grabbable shape, with muted strings marked ✕.</p>\n\n<p class="fs-label" style="margin-top:12px">Chord tones</p>\n<div class="fs-legend" id="fs-chordLegend"></div>\n</div><!-- /pageChords -->';
function viewScales() {
  $("#app").innerHTML = '<div class="wrap pagehead"><div class="eyebrow">Practice tools</div><h1>Scales and chord shapes</h1><p class="lede">Every scale degree in colour across the whole neck, with CAGED positions and movable chord shapes. Tap a note to hear it.</p></div><div class="wrap"><div class="fs">' + FS_HTML + '</div></div>';
  const fsRoot = $(".fs", $("#app"));

  // ---- music theory ----
  const LETTERS = ['C','D','E','F','G','A','B'];
  const LETTER_SEMI = {C:0,D:2,E:4,F:5,G:7,A:9,B:11};
  const FRETS = 21; // 0 (open) .. 21

  // root spelling chosen per mode so the scale stays clean (no double accidentals)
  // index = pitch class 0..11
  const ROOTS = [
    {pc:0,  label:'C',          major:'C',  minor:'C'},
    {pc:1,  label:'C\u266F / D\u266D', major:'D\u266D', minor:'C\u266F'},
    {pc:2,  label:'D',          major:'D',  minor:'D'},
    {pc:3,  label:'E\u266D / D\u266F', major:'E\u266D', minor:'E\u266D'},
    {pc:4,  label:'E',          major:'E',  minor:'E'},
    {pc:5,  label:'F',          major:'F',  minor:'F'},
    {pc:6,  label:'F\u266F / G\u266D', major:'F\u266F', minor:'F\u266F'},
    {pc:7,  label:'G',          major:'G',  minor:'G'},
    {pc:8,  label:'A\u266D / G\u266F', major:'A\u266D', minor:'G\u266F'},
    {pc:9,  label:'A',          major:'A',  minor:'A'},
    {pc:10, label:'B\u266D / A\u266F', major:'B\u266D', minor:'B\u266D'},
    {pc:11, label:'B',          major:'B',  minor:'B'}
  ];

  // strings high E (top) to low E (bottom): name + open pitch class
  const STRINGS = [
    {name:'E', pc:4},
    {name:'B', pc:11},
    {name:'G', pc:7},
    {name:'D', pc:2},
    {name:'A', pc:9},
    {name:'E', pc:4}
  ];

  const INLAYS = [3,5,7,9,12,15,17,19,21];
  const STR_MIDI = [64,59,55,50,45,40]; // open strings, high e to low E

  // ---- CAGED ----
  const CAGED_COLOR = {C:'#56c7e0', A:'#f48fb1', G:'#b39ddb', E:'#ffd166', D:'#80d8a0'};
  // Per-string fret windows for each shape, in row order:
  // [high E (S1), B (S2), G (S3), D (S4), A (S5), low E (S6)]
  // Each entry is [lo, hi] fret offset from the shape's anchor root.
  // These trace the real (diagonal) scale position, so every note is enclosed.
  const SHAPE_DEF = {
    C:{anchor:'R5', rows:[[-3,0],[-3,0],[-3,-1],[-3,0],[-3,0],[-3,0]]},
    A:{anchor:'R5', rows:[[0,2],[0,3],[-1,2],[-1,2],[-1,2],[0,2]]},
    G:{anchor:'R6', rows:[[-3,0],[-3,0],[-4,-1],[-3,-1],[-3,0],[-3,0]]},
    E:{anchor:'R6', rows:[[-1,2],[0,2],[-1,2],[-1,2],[-1,2],[-1,2]]},
    D:{anchor:'R4', rows:[[0,3],[0,3],[0,4],[0,4],[0,4],[0,3]]}
  };
  const CAGED_ORDER = ['C','A','G','E','D'];

  function computeCagedShapes(anchorPC, activeSet){
    const base = {
      R6:((anchorPC-4)%12+12)%12, // root fret on low E string
      R5:((anchorPC-9)%12+12)%12, // root fret on A string
      R4:((anchorPC-2)%12+12)%12  // root fret on D string
    };
    const out = [];
    CAGED_ORDER.forEach(shape=>{
      if(!activeSet.has(shape)) return;
      const def = SHAPE_DEF[shape];
      const b = base[def.anchor];
      for(let k=-1; k<=2; k++){
        const aFret = b + 12*k;
        const rows = def.rows.map(([lo,hi])=>{
          let s = aFret + lo, e = aFret + hi;
          s = Math.max(0, s); e = Math.min(FRETS, e);
          return e >= s ? {lo:s, hi:e} : null;
        });
        const valid = rows.filter(Boolean).length;
        if(valid >= 4) out.push({shape, rows});
      }
    });
    return out;
  }
  // pixel geometry of the fret columns
  function fretLeft(f){ return f===0 ? 0 : 34 + (f-1)*48; }
  function fretWidth(f){ return f===0 ? 34 : 48; }
  const ROW_H = 40;

  const DEG_COLOR = ['var(--d-root)','var(--d-2)','var(--d-3)','var(--d-4)','var(--d-5)','var(--d-6)','var(--d-7)'];
  const DEG_LABEL = {
    major:['I','ii','iii','IV','V','vi','vii\u00B0'],
    minor:['i','ii\u00B0','III','iv','v','VI','VII']
  };
  const LEGEND_NAME = {
    major:['Root','2nd','3rd','4th','5th','6th','7th'],
    minor:['Root','2nd','\u266D3rd','4th','5th','\u266D6th','\u266D7th']
  };

  function parseRoot(name){
    const letter = name[0];
    let acc = 0;
    for(let i=1;i<name.length;i++){
      if(name[i]==='\u266F') acc++;
      else if(name[i]==='\u266D') acc--;
    }
    return {letter, acc};
  }

  function spell(letter, targetSemi){
    const nat = LETTER_SEMI[letter];
    let diff = ((targetSemi - nat) % 12 + 12) % 12; // 0..11
    if(diff > 6) diff -= 12;                          // nearest accidental
    let name = letter;
    if(diff > 0) name += '\u266F'.repeat(diff);
    else if(diff < 0) name += '\u266D'.repeat(-diff);
    return name;
  }

  function buildScale(rootName, mode){
    const intervals = mode === 'major' ? [0,2,4,5,7,9,11] : [0,2,3,5,7,8,10];
    const {letter, acc} = parseRoot(rootName);
    const rootLetterIdx = LETTERS.indexOf(letter);
    const rootSemi = ((LETTER_SEMI[letter] + acc) % 12 + 12) % 12;
    const map = {}; // pitch class -> {degree, name}
    intervals.forEach((iv, i)=>{
      const semi = (rootSemi + iv) % 12;
      const noteLetter = LETTERS[(rootLetterIdx + i) % 7];
      map[semi] = {degree:i, name:spell(noteLetter, semi)};
    });
    return map;
  }

  // ---- state ----
  let selKey = 0;       // pitch class index into ROOTS
  let selMode = 'major';
  let cagedActive = new Set();   // which CAGED shapes are currently shown
  let pentatonicOn = false;      // when true, show only pentatonic notes

  // ---- build key buttons ----
  const keysEl = document.getElementById('fs-keys');
  ROOTS.forEach((r, i)=>{
    const b = document.createElement('button');
    b.className = 'fs-key-btn' + (i===selKey ? ' fs-sel' : '');
    const parts = r.label.split(' / ');
    if(parts.length === 2){
      b.innerHTML = parts[0] + '<span class="fs-alt">'+parts[1]+'</span>';
    } else {
      b.textContent = r.label;
    }
    b.addEventListener('click', ()=>{
      selKey = i;
      keysEl.querySelectorAll('.fs-key-btn').forEach(x=>x.classList.remove('fs-sel'));
      b.classList.add('fs-sel');
      render();
    });
    keysEl.appendChild(b);
  });

  // ---- mode toggle ----
  document.querySelectorAll('#fs-mode button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      selMode = btn.dataset.mode;
      document.querySelectorAll('#fs-mode button').forEach(x=>x.classList.remove('fs-sel'));
      btn.classList.add('fs-sel');
      render();
    });
  });

  // ---- CAGED shape toggles ----
  const ALL_SHAPES = ['C','A','G','E','D'];
  document.querySelectorAll('#fs-cagedChips .fs-chip').forEach(chip=>{
    chip.addEventListener('click', ()=>{
      const s = chip.dataset.shape;
      if(s === 'all'){
        const allOn = ALL_SHAPES.every(x=>cagedActive.has(x));
        cagedActive = new Set(allOn ? [] : ALL_SHAPES);
      } else if(cagedActive.has(s)){
        cagedActive.delete(s);
      } else {
        cagedActive.add(s);
      }
      render();
    });
  });

  // ---- Pentatonic toggle ----
  // Degrees kept in the pentatonic scale (degree indices into the 7-note scale).
  // Major pentatonic: I, ii, iii, V, vi (drops IV and vii).
  // Minor pentatonic: i, III, iv, v, VII (drops ii and VI).
  const PENTA_DEGREES = { major:[0,1,2,4,5], minor:[0,2,3,4,6] };
  const pentaBtn = document.getElementById('fs-pentaBtn');
  pentaBtn.addEventListener('click', ()=>{
    pentatonicOn = !pentatonicOn;
    render();
  });

  // ---- render fretboard ----
  const boardEl = document.getElementById('fs-board');
  const numsEl = document.getElementById('fs-nums');
  const showingEl = document.getElementById('fs-showing');
  const legendEl = document.getElementById('fs-legend');
  const cagedChips = document.getElementById('fs-cagedChips');
  const cagedNote = document.getElementById('fs-cagedNote');

  function render(){
    const root = ROOTS[selKey];
    const rootName = root[selMode];
    const scale = buildScale(rootName, selMode);

    // header line
    const ordered = Object.values(scale).sort((a,b)=>a.degree-b.degree);
    const noteList = ordered.map(n=>n.name).join('  \u00B7  ');
    showingEl.innerHTML = '<b>'+rootName+' '+(selMode==='major'?'major':'minor')+'</b><br>'+noteList;

    // board
    boardEl.innerHTML = '';
    STRINGS.forEach((str, sIdx)=>{
      const row = document.createElement('div');
      row.className = 'fs-row';
      // string thickness: thicker for the lower strings
      const sw = 1 + sIdx*0.6;
      for(let f=0; f<=FRETS; f++){
        const cell = document.createElement('div');
        cell.className = 'fs-cell' + (f===0 ? ' fs-open' : '');
        cell.style.setProperty('--sw', sw+'px');

        // inlay marker, drawn once on the middle row (between G and D strings)
        if(sIdx===3 && INLAYS.includes(f)){
          if(f===12){
            const i1=document.createElement('span'); i1.className='fs-inlay'; i1.style.left='35%';
            const i2=document.createElement('span'); i2.className='fs-inlay'; i2.style.left='65%';
            cell.appendChild(i1); cell.appendChild(i2);
          } else {
            const il=document.createElement('span'); il.className='fs-inlay';
            cell.appendChild(il);
          }
        }

        const pc = (str.pc + f) % 12;
        if(scale[pc] && (!pentatonicOn || PENTA_DEGREES[selMode].includes(scale[pc].degree))){
          const info = scale[pc];
          const dot = document.createElement('div');
          dot.className = 'fs-dot' + (info.degree===0 ? ' fs-root' : '');
          dot.style.background = DEG_COLOR[info.degree];
          dot.setAttribute('data-midi', STR_MIDI[sIdx] + f);
          dot.innerHTML = '<span class="fs-deg">'+DEG_LABEL[selMode][info.degree]+'</span>'+
                          '<span class="fs-nm">'+info.name+'</span>';
          cell.appendChild(dot);
        }
        row.appendChild(cell);
      }
      boardEl.appendChild(row);
    });

    // fret numbers
    numsEl.innerHTML = '';
    for(let f=0; f<=FRETS; f++){
      const n = document.createElement('div');
      let cls = 'fs-num' + (f===0 ? ' fs-open' : '');
      if(f===12) cls += ' fs-twelve';
      else if(INLAYS.includes(f)) cls += ' fs-mark';
      n.className = cls;
      n.textContent = f===0 ? '0' : f;
      numsEl.appendChild(n);
    }

    // legend
    legendEl.innerHTML = '';
    for(let d=0; d<7; d++){
      const item = document.createElement('div');
      item.className = 'fs-leg';
      item.innerHTML = '<i style="background:'+DEG_COLOR[d]+'"></i>'+
                       '<span>'+DEG_LABEL[selMode][d]+' \u00B7 '+LEGEND_NAME[selMode][d]+'</span>';
      legendEl.appendChild(item);
    }

    // CAGED controls UI state
    document.querySelectorAll('#fs-cagedChips .fs-chip').forEach(chip=>{
      const s = chip.dataset.shape;
      const on = s === 'all'
        ? ALL_SHAPES.every(x=>cagedActive.has(x))
        : cagedActive.has(s);
      chip.classList.toggle('fs-sel', on);
    });
    pentaBtn.classList.toggle('fs-sel', pentatonicOn);
    cagedNote.hidden = !(cagedActive.size > 0 && selMode === 'minor');
    if(!cagedNote.hidden){
      cagedNote.textContent = 'In a minor key the five positions are the CAGED shapes of the '
        + 'relative major (same note positions), so the letters refer to those major chord forms.';
    }

    // CAGED overlay
    if(cagedActive.size > 0){
      const anchorPC = selMode === 'major' ? root.pc : (root.pc + 3) % 12;
      const shapes = computeCagedShapes(anchorPC, cagedActive);
      const boardW = fretLeft(FRETS) + fretWidth(FRETS);
      const boardH = ROW_H * 6;
      const PAD = 4; // inset so the outline hugs the notes

      const overlay = document.createElement('div');
      overlay.className = 'fs-caged-layer';

      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('width', boardW);
      svg.setAttribute('height', boardH);
      svg.setAttribute('viewBox', '0 0 ' + boardW + ' ' + boardH);
      svg.style.position = 'absolute';
      svg.style.left = '0';
      svg.style.top = '0';

      shapes.forEach(box=>{
        const col = CAGED_COLOR[box.shape];
        // build the staircase outline from each string's [lo,hi] window
        const present = [];
        box.rows.forEach((w, i)=>{ if(w) present.push(i); });
        const top = present[0];
        const xL = i => fretLeft(box.rows[i].lo) + PAD;
        const xR = i => fretLeft(box.rows[i].hi) + fretWidth(box.rows[i].hi) - PAD;
        const yT = i => i * ROW_H + PAD;
        const yB = i => (i + 1) * ROW_H - PAD;

        const pts = [];
        present.forEach(i=>{ pts.push([xR(i), yT(i)]); pts.push([xR(i), yB(i)]); });
        for(let j = present.length - 1; j >= 0; j--){
          const i = present[j];
          pts.push([xL(i), yB(i)]); pts.push([xL(i), yT(i)]);
        }

        const poly = document.createElementNS(svgNS, 'polygon');
        poly.setAttribute('points', pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' '));
        poly.setAttribute('fill', col);
        poly.setAttribute('fill-opacity', '0.10');
        poly.setAttribute('stroke', col);
        poly.setAttribute('stroke-width', '3');
        poly.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(poly);

        // label tag at the top-left of the shape
        const tag = document.createElement('span');
        tag.className = 'fs-caged-tag';
        tag.textContent = box.shape;
        tag.style.background = col;
        tag.style.left = (xL(top) + 2) + 'px';
        tag.style.top = (yT(top) - 9) + 'px';
        overlay.appendChild(tag);
      });

      overlay.appendChild(svg);
      boardEl.appendChild(overlay);
    }
  }

  // ================= CHORD SHAPES PAGE =================
  // Roots for chords (single spelling per pitch class)
  const CHORD_ROOT_NAMES = ['C','C\u266F','D','E\u266D','E','F','F\u266F','G','A\u266D','A','B\u266D','B'];
  // enharmonic partner shown as small subtext under each accidental button
  const CHORD_ROOT_ALT = {1:'D\u266D', 3:'D\u266F', 6:'G\u266D', 8:'G\u266F', 10:'A\u266F'};
  const SHARP_NM = ['C','C\u266F','D','D\u266F','E','F','F\u266F','G','G\u266F','A','A\u266F','B'];
  const FLAT_NM  = ['C','D\u266D','D','E\u266D','E','F','G\u266D','G','A\u266D','A','B\u266D','B'];
  function chordNoteName(pc, rootPC){
    const flat = CHORD_ROOT_NAMES[rootPC].indexOf('\u266D') >= 0;
    return (flat ? FLAT_NM : SHARP_NM)[((pc % 12) + 12) % 12];
  }

  // interval (semitones from root) -> label / colour / name
  const IV_LABEL = {0:'R',1:'\u266D9',2:'9',3:'\u266D3',4:'3',5:'4',6:'\u266D5',7:'5',8:'\u266F5',9:'6',10:'\u266D7',11:'7'};
  const IV_NAME  = {0:'Root',1:'\u266D9th',2:'9th',3:'\u266D3rd',4:'3rd',5:'4th',6:'\u266D5th',7:'5th',8:'\u266F5th',9:'6th',10:'\u266D7th',11:'7th'};
  function ivColor(iv){
    if(iv===0) return 'var(--d-root)';
    if(iv===3||iv===4) return 'var(--d-3)';
    if(iv===6||iv===7||iv===8) return 'var(--d-5)';
    if(iv===10||iv===11) return 'var(--d-7)';
    if(iv===9) return 'var(--d-6)';
    if(iv===1||iv===2) return 'var(--d-2)';
    if(iv===5) return 'var(--d-4)';
    return 'var(--muted)';
  }

  const CHORD_TYPES = [
    {id:'maj',  name:'Major', intervals:[0,4,7]},
    {id:'min',  name:'Minor', intervals:[0,3,7]},
    {id:'dom7', name:'7',     intervals:[0,4,7,10]},
    {id:'maj7', name:'Maj7',  intervals:[0,4,7,11]},
    {id:'min7', name:'m7',    intervals:[0,3,7,10]},
    {id:'six',  name:'6',     intervals:[0,4,7,9]},
    {id:'min6', name:'m6',    intervals:[0,3,7,9]},
    {id:'sus4', name:'sus4',  intervals:[0,5,7]},
    {id:'sus2', name:'sus2',  intervals:[0,2,7]}
  ];

  // movable CAGED chord forms. frets are offsets from the root fret on the
  // anchor string, in low-to-high string order [E A D G B e]; 'x' = muted.
  // rootStr: 0=low E, 1=A, 2=D (which string the root sits on).
  const CHORD_SHAPES = {
    maj:  [ {name:'E',rootStr:0,frets:[0,2,2,1,0,0]}, {name:'A',rootStr:1,frets:['x',0,2,2,2,0]}, {name:'D',rootStr:2,frets:['x','x',0,2,3,2]} ],
    min:  [ {name:'E',rootStr:0,frets:[0,2,2,0,0,0]}, {name:'A',rootStr:1,frets:['x',0,2,2,1,0]}, {name:'D',rootStr:2,frets:['x','x',0,2,3,1]} ],
    dom7: [ {name:'E',rootStr:0,frets:[0,2,0,1,0,0]}, {name:'A',rootStr:1,frets:['x',0,2,0,2,0]}, {name:'D',rootStr:2,frets:['x','x',0,2,1,2]} ],
    maj7: [ {name:'E',rootStr:0,frets:[0,2,1,1,0,0]}, {name:'A',rootStr:1,frets:['x',0,2,1,2,0]}, {name:'D',rootStr:2,frets:['x','x',0,2,2,2]} ],
    min7: [ {name:'E',rootStr:0,frets:[0,2,0,0,0,0]}, {name:'A',rootStr:1,frets:['x',0,2,0,1,0]}, {name:'D',rootStr:2,frets:['x','x',0,2,1,1]} ],
    six:  [ {name:'E',rootStr:0,frets:[0,2,2,1,2,0]}, {name:'A',rootStr:1,frets:['x',0,2,2,2,2]}, {name:'D',rootStr:2,frets:['x','x',0,2,0,2]} ],
    min6: [ {name:'E',rootStr:0,frets:[0,2,2,0,2,0]}, {name:'A',rootStr:1,frets:['x',0,2,2,1,2]}, {name:'D',rootStr:2,frets:['x','x',0,2,0,1]} ],
    sus4: [ {name:'E',rootStr:0,frets:[0,2,2,2,0,0]}, {name:'A',rootStr:1,frets:['x',0,2,2,3,0]}, {name:'D',rootStr:2,frets:['x','x',0,2,3,3]} ],
    sus2: [ {name:'E',rootStr:0,frets:[0,2,4,4,0,0]}, {name:'A',rootStr:1,frets:['x',0,2,2,0,0]}, {name:'D',rootStr:2,frets:['x','x',0,2,3,0]} ]
  };
  const STR_PC_L2H = [4,9,2,7,11,4]; // low E, A, D, G, B, high E

  function computeChordPositions(rootPC, typeId){
    const out = [];
    CHORD_SHAPES[typeId].forEach(sh=>{
      const base = (((rootPC - STR_PC_L2H[sh.rootStr]) % 12) + 12) % 12;
      [base, base + 12].forEach(rf=>{
        const voicing = sh.frets.map(o => o === 'x' ? 'x' : rf + o);
        const nums = voicing.filter(v => v !== 'x');
        if(nums.every(v => v >= 0 && v <= FRETS)){
          out.push({shape:sh.name, rootFret:rf, voicing, minFret:Math.min.apply(null,nums), maxFret:Math.max.apply(null,nums)});
        }
      });
    });
    out.sort((a,b)=>a.minFret - b.minFret);
    return out;
  }

  // chord state
  let chordRoot = 0;      // pitch class
  let chordTypeId = 'maj';
  let chordPos = 'all';   // 'all' or index into positions

  const chordKeysEl = document.getElementById('fs-chordKeys');
  const chordTypesEl = document.getElementById('fs-chordTypes');
  const chordPosEl = document.getElementById('fs-chordPos');
  const chordShowingEl = document.getElementById('fs-chordShowing');
  const chordBoardEl = document.getElementById('fs-chordBoard');
  const chordNumsEl = document.getElementById('fs-chordNums');
  const chordLegendEl = document.getElementById('fs-chordLegend');

  // root buttons
  CHORD_ROOT_NAMES.forEach((nm, pc)=>{
    const b = document.createElement('button');
    b.className = 'fs-key-btn' + (pc === chordRoot ? ' fs-sel' : '');
    if(CHORD_ROOT_ALT[pc]){
      b.innerHTML = nm + '<span class="fs-alt">' + CHORD_ROOT_ALT[pc] + '</span>';
    } else {
      b.textContent = nm;
    }
    b.addEventListener('click', ()=>{
      chordRoot = pc; chordPos = 'all';
      chordKeysEl.querySelectorAll('.fs-key-btn').forEach(x=>x.classList.remove('fs-sel'));
      b.classList.add('fs-sel');
      renderChord();
    });
    chordKeysEl.appendChild(b);
  });
  // type buttons
  CHORD_TYPES.forEach(t=>{
    const b = document.createElement('button');
    b.className = 'fs-ctype' + (t.id === chordTypeId ? ' fs-sel' : '');
    b.textContent = t.name;
    b.addEventListener('click', ()=>{
      chordTypeId = t.id; chordPos = 'all';
      chordTypesEl.querySelectorAll('.fs-ctype').forEach(x=>x.classList.remove('fs-sel'));
      b.classList.add('fs-sel');
      renderChord();
    });
    chordTypesEl.appendChild(b);
  });

  function chordDot(cell, iv, nm, midi){
    const dot = document.createElement('div');
    dot.setAttribute('data-midi', midi);
    dot.className = 'fs-dot' + (iv === 0 ? ' fs-root' : '');
    dot.style.background = ivColor(iv);
    dot.innerHTML = '<span class="fs-deg">' + IV_LABEL[iv] + '</span><span class="fs-nm">' + nm + '</span>';
    cell.appendChild(dot);
  }

  function renderChord(){
    const type = CHORD_TYPES.find(t=>t.id === chordTypeId);
    const rootName = CHORD_ROOT_NAMES[chordRoot];
    const chordPCs = type.intervals.map(iv => (chordRoot + iv) % 12);
    const positions = computeChordPositions(chordRoot, chordTypeId);
    if(chordPos !== 'all' && chordPos >= positions.length) chordPos = 'all';

    // header line
    const toneNames = type.intervals.map(iv => chordNoteName((chordRoot + iv) % 12, chordRoot));
    chordShowingEl.innerHTML = '<b>' + rootName + ' ' + type.name + '</b><br>' + toneNames.join('  \u00B7  ');

    // position chips
    chordPosEl.innerHTML = '';
    const mkChip = (val, text)=>{
      const b = document.createElement('button');
      b.className = 'fs-chip' + (chordPos === val ? ' fs-sel' : '');
      b.textContent = text;
      b.addEventListener('click', ()=>{ chordPos = val; renderChord(); });
      chordPosEl.appendChild(b);
    };
    mkChip('all', 'All tones');
    positions.forEach((p, idx)=> mkChip(idx, p.shape + ' \u00B7 ' + p.rootFret));

    const selPos = chordPos === 'all' ? null : positions[chordPos];

    // board
    chordBoardEl.innerHTML = '';
    STRINGS.forEach((str, dIdx)=>{
      const row = document.createElement('div');
      row.className = 'fs-row';
      const sw = 1 + dIdx * 0.6;
      const l2h = 5 - dIdx;
      for(let f=0; f<=FRETS; f++){
        const cell = document.createElement('div');
        cell.className = 'fs-cell' + (f === 0 ? ' fs-open' : '');
        cell.style.setProperty('--sw', sw + 'px');
        if(dIdx === 3 && INLAYS.includes(f)){
          if(f === 12){
            const i1 = document.createElement('span'); i1.className='fs-inlay'; i1.style.left='35%';
            const i2 = document.createElement('span'); i2.className='fs-inlay'; i2.style.left='65%';
            cell.appendChild(i1); cell.appendChild(i2);
          } else {
            const il = document.createElement('span'); il.className='fs-inlay'; cell.appendChild(il);
          }
        }
        const pc = (str.pc + f) % 12;
        const iv = ((pc - chordRoot) % 12 + 12) % 12;
        if(selPos){
          const v = selPos.voicing[l2h];
          if(v !== 'x' && v === f){
            chordDot(cell, iv, chordNoteName(pc, chordRoot), STR_MIDI[dIdx] + f);
          } else if(v === 'x' && f === Math.max(0, selPos.minFret)){
            const x = document.createElement('span'); x.className = 'fs-mute-x'; x.textContent = '\u2715';
            cell.appendChild(x);
          }
        } else if(chordPCs.indexOf(pc) >= 0){
          chordDot(cell, iv, chordNoteName(pc, chordRoot), STR_MIDI[dIdx] + f);
        }
        row.appendChild(cell);
      }
      chordBoardEl.appendChild(row);
    });

    // fret numbers
    chordNumsEl.innerHTML = '';
    for(let f=0; f<=FRETS; f++){
      const n = document.createElement('div');
      let cls = 'fs-num' + (f === 0 ? ' fs-open' : '');
      if(f === 12) cls += ' fs-twelve';
      else if(INLAYS.includes(f)) cls += ' fs-mark';
      n.className = cls;
      n.textContent = f;
      chordNumsEl.appendChild(n);
    }

    // outline box for a selected position
    if(selPos){
      const left = fretLeft(selPos.minFret);
      const right = fretLeft(selPos.maxFret) + fretWidth(selPos.maxFret);
      const box = document.createElement('div');
      box.className = 'fs-chord-box';
      box.style.left = (left + 2) + 'px';
      box.style.width = (right - left - 4) + 'px';
      const tag = document.createElement('span');
      tag.className = 'fs-caged-tag';
      tag.style.background = 'var(--accent)';
      tag.style.left = (left + 4) + 'px';
      tag.style.top = '-9px';
      tag.textContent = selPos.shape + ' shape';
      chordBoardEl.appendChild(box);
      chordBoardEl.appendChild(tag);
    }

    // legend (chord tones)
    chordLegendEl.innerHTML = '';
    type.intervals.forEach(iv=>{
      const item = document.createElement('div');
      item.className = 'fs-leg';
      item.innerHTML = '<i style="background:' + ivColor(iv) + '"></i>' +
        '<span>' + IV_LABEL[iv] + ' \u00B7 ' + IV_NAME[iv] + '</span>';
      chordLegendEl.appendChild(item);
    });
  }

  // ---- tab switching ----
  document.querySelectorAll('#fs-tabs .fs-tab').forEach(t=>{
    t.addEventListener('click', ()=>{
      const page = t.dataset.page;
      document.querySelectorAll('#fs-tabs .fs-tab').forEach(x=>x.classList.toggle('fs-sel', x === t));
      document.getElementById('fs-pageScales').hidden = page !== 'scales';
      document.getElementById('fs-pageChords').hidden = page !== 'chords';
    });
  });

  renderChord();
  render();

  fsRoot.addEventListener('click', e => {
    const d = e.target.closest('.fs-dot'); if(!d || !d.hasAttribute('data-midi')) return;
    audio(); pluck(+d.getAttribute('data-midi'));
    d.classList.add('ping'); setTimeout(() => d.classList.remove('ping'), 160);
  });
}

/* ===== fretboard quiz ===== */
var SNAME = ["", "e", "B", "G", "D", "A", "E"];
function viewQuiz() {
  var q = S.stats.quiz || (S.stats.quiz = { answered: 0, correct: 0, best: 0, per: {} });
  if (!q.rounds) q.rounds = {};
  $("#app").innerHTML = '<div class="wrap pagehead"><div class="eyebrow">Practice tools</div><h1>Fretboard quiz</h1><p class="lede">A note lights up. Name it as fast as you can. The checkpoint target is 3 seconds.</p></div>' +
    '<div class="wrap"><div class="quizbar"><fieldset class="qs"><legend>Strings</legend>' + [6, 5, 4, 3, 2, 1].map(function (s) { return '<label><input type="checkbox" class="q-s" value="' + s + '"' + (s >= 4 ? " checked" : "") + "> " + SNAME[s] + "</label>"; }).join("") + "</fieldset>" +
    '<label>Frets up to <select class="q-max"><option>5</option><option>7</option><option selected>12</option><option>15</option></select></label>' +
    '<label>Round <select class="q-len"><option value="10">10 notes</option><option value="20" selected>20 notes</option><option value="30">30 notes</option><option value="t60">60 second sprint</option><option value="0">Endless</option></select></label>' +
    '<label class="opt"><input type="checkbox" class="q-nat" checked> Natural notes only</label><label class="opt"><input type="checkbox" class="q-snd"> Play the note first</label></div>' +
    '<div class="quiz card"><div class="q-hud" hidden><div class="q-hud-row"><span class="q-prog mono"></span><span class="q-pts mono"></span><span class="q-strk mono"></span></div><div class="q-bar"><span></span></div></div>' +
    '<div class="q-board board-svg"></div><div class="q-answers"></div><div class="q-feed" aria-live="polite">Press Start, then name the highlighted note.</div>' +
    '<div class="q-row"><button type="button" class="btn auto q-start">Start</button><button type="button" class="btn ghost auto q-end" hidden>Finish round</button><span class="q-score mono"></span></div>' +
    '<div class="q-result" hidden aria-live="polite"></div></div>' +
    '<div class="statrow"><div><span class="t-k">All-time accuracy</span><span class="t-v q-acc">' + (q.answered ? Math.round(q.correct / q.answered * 100) + "%" : "-") + '</span></div><div><span class="t-k">Answered</span><span class="t-v q-ans">' + q.answered + '</span></div><div><span class="t-k">Best streak</span><span class="t-v q-bst">' + q.best + '</span></div><div><span class="t-k">Weakest string</span><span class="t-v q-weak">' + weakest(q) + '</span></div><div><span class="t-k">Best round, these settings</span><span class="t-v q-pb">-</span></div></div></div>';
  var app = $("#app"), cur = null, t0 = 0, R = null, tick = null;
  function weakest(qq) { var worst = null, wr = 2; Object.keys(qq.per).forEach(function (s) { var p = qq.per[s]; if (p.n >= 5 && p.c / p.n < wr) { wr = p.c / p.n; worst = s; } }); return worst ? SNAME[worst] + " (" + Math.round(wr * 100) + "%)" : "-"; }
  function names() { return $(".q-nat", app).checked ? ["C", "D", "E", "F", "G", "A", "B"] : (PREFS.flats ? FLATS : SHARPS); }
  function drawAnswers() { $(".q-answers", app).innerHTML = names().map(function (nm, i) { return '<button type="button" class="qa" data-pc="' + ($(".q-nat", app).checked ? PC[nm] : i) + '">' + nm + "</button>"; }).join(""); }
  function board(target, reveal) {
    var spec = { type: "notes", title: "Quiz", notes: target ? [[target.s, target.f, reveal ? nameOf(midiOf(target.s, target.f)) : "?", true]] : [], frets: [0, +$(".q-max", app).value] };
    drawBoard($(".q-board", app), spec, { mode: "quiz", slotW: 46 });
  }
  function strs() { return $$(".q-s", app).filter(function (c) { return c.checked; }).map(function (c) { return +c.value; }); }
  function setupKey() { return [$(".q-len", app).value, strs().join(""), $(".q-max", app).value, $(".q-nat", app).checked ? "n" : "a"].join("|"); }
  function pbText() {
    var pb = q.rounds[setupKey()]; if ($(".q-len", app).value === "0") return "Endless has no rounds";
    if (!pb) return "-";
    return pb.c + (pb.of ? "/" + pb.of : " notes") + (pb.avg ? ", " + pb.avg.toFixed(1) + " s avg" : "");
  }
  function showPB() { $(".q-pb", app).textContent = pbText(); }
  function fmtClock(sec) { sec = Math.max(0, Math.ceil(sec)); return Math.floor(sec / 60) + ":" + ("0" + sec % 60).slice(-2); }
  function hud() {
    if (!R) return;
    var pct, prog;
    if (R.timed) { var left = R.timed - (performance.now() - R.start) / 1000; prog = fmtClock(left) + " left"; pct = 100 * (1 - left / R.timed); }
    else if (R.len) { prog = "Note " + Math.min(R.n + (cur ? 1 : 0), R.len) + " of " + R.len; pct = 100 * R.n / R.len; }
    else { prog = R.n + " answered"; pct = 0; }
    $(".q-prog", app).textContent = prog;
    $(".q-pts", app).textContent = "Score " + R.c + (R.n ? " (" + Math.round(R.c / R.n * 100) + "%)" : "");
    $(".q-strk", app).textContent = "Streak " + R.streak;
    $(".q-bar span", app).style.width = Math.max(0, Math.min(100, pct)) + "%";
    $(".q-bar", app).hidden = !R.len && !R.timed;
  }
  function startRound() {
    if (!strs().length) { $(".q-feed", app).textContent = "Pick at least one string."; return; }
    var v = $(".q-len", app).value;
    R = { len: v.charAt(0) === "t" ? 0 : +v, timed: v.charAt(0) === "t" ? +v.slice(1) : 0, n: 0, c: 0, streak: 0, bestStreak: 0, times: [], missed: [], skipped: 0, start: performance.now(), key: setupKey() };
    $(".q-result", app).hidden = true; $(".q-hud", app).hidden = false; $(".q-answers", app).hidden = false;
    $(".q-end", app).hidden = false; $(".q-start", app).textContent = "Skip"; $(".q-score", app).textContent = "";
    clearInterval(tick); tick = setInterval(function () {
      if (!document.body.contains(app) || !$(".q-hud", app)) { clearInterval(tick); return; }
      hud(); if (R && R.timed && (performance.now() - R.start) / 1000 >= R.timed) endRound();
    }, 200);
    nextQ();
  }
  function nextQ() {
    if (!$(".q-feed", app) || !R) return;
    var ss = strs();
    if (!ss.length) { $(".q-feed", app).textContent = "Pick at least one string."; return; }
    var max = +$(".q-max", app).value, nat = $(".q-nat", app).checked, tries = 0, s, f;
    do { s = ss[Math.floor(Math.random() * ss.length)]; f = Math.floor(Math.random() * (max + 1)); tries++; }
    while ((nat && SHARPS[midiOf(s, f) % 12].length > 1 || (R.last && R.last.s === s && R.last.f === f)) && tries < 100);
    cur = { s: s, f: f }; R.last = cur; board(cur, false); t0 = performance.now();
    if ($(".q-snd", app).checked) pluck(midiOf(s, f));
    $(".q-feed", app).textContent = "String " + SNAME[s] + ". Which note is this?";
    hud();
  }
  function roundDone() { return R && ((R.len && R.n >= R.len) || (R.timed && (performance.now() - R.start) / 1000 >= R.timed)); }
  function answer(pc) {
    if (!cur || !R) return;
    var right = midiOf(cur.s, cur.f) % 12, ok = pc === right, dt = (performance.now() - t0) / 1000;
    q.answered++; R.n++; var ps = q.per[cur.s] || (q.per[cur.s] = { n: 0, c: 0 }); ps.n++;
    if (ok) { q.correct++; R.c++; ps.c++; R.streak++; if (R.streak > R.bestStreak) R.bestStreak = R.streak; if (R.streak > q.best) q.best = R.streak; R.times.push(dt); }
    else { R.streak = 0; R.missed.push({ s: cur.s, f: cur.f, said: pc }); }
    saveStats(); pluck(midiOf(cur.s, cur.f)); board(cur, true);
    $(".q-feed", app).innerHTML = (ok ? '<b class="good">Right</b>' : '<b class="bad">Not quite</b>, it was ' + nameOf(midiOf(cur.s, cur.f))) + " &middot; " + dt.toFixed(1) + " s" + (ok && dt <= 3 ? " (inside the 3 second target)" : "");
    $(".q-acc", app).textContent = Math.round(q.correct / q.answered * 100) + "%";
    $(".q-ans", app).textContent = q.answered; $(".q-bst", app).textContent = q.best; $(".q-weak", app).textContent = weakest(q);
    cur = null; hud();
    setTimeout(function () { if (!R || cur) return; if (roundDone()) endRound(); else nextQ(); }, ok ? 700 : 1500);
  }
  function skip() {
    if (!R) return;
    if (cur) { R.n++; R.skipped++; R.streak = 0; R.missed.push({ s: cur.s, f: cur.f, said: null }); cur = null; }
    if (roundDone()) endRound(); else nextQ();
  }
  function endRound() {
    if (!R) return;
    clearInterval(tick); var r = R; R = null; cur = null;
    var avg = r.times.length ? r.times.reduce(function (a, b) { return a + b; }) / r.times.length : 0;
    var fast = r.times.filter(function (t) { return t <= 3; }).length, pct = r.n ? Math.round(r.c / r.n * 100) : 0;
    var isNew = false, prev = q.rounds[r.key];
    if ((r.len || r.timed) && r.c) {
      var better = !prev || r.c > prev.c || (r.c === prev.c && avg && (!prev.avg || avg < prev.avg));
      if (better) { q.rounds[r.key] = { c: r.c, of: r.len || 0, avg: avg ? Math.round(avg * 100) / 100 : 0, at: todayStr() }; isNew = !!prev || r.c > 0; saveStats(); }
    }
    var verdict = !r.n ? "No notes answered." : pct === 100 ? "Perfect round." : pct >= 90 ? "Excellent." : pct >= 75 ? "Solid. Keep at it." : pct >= 50 ? "Getting there." : "Tough round. Try fewer strings or frets.";
    var miss = {}; r.missed.forEach(function (m) { var k = m.s + ":" + m.f; (miss[k] = miss[k] || { s: m.s, f: m.f, n: 0, said: [] }).n++; if (m.said !== null) miss[k].said.push(m.said); });
    var missList = Object.keys(miss).map(function (k) { return miss[k]; }).slice(0, 10).map(function (m) {
      var said = m.said.length ? ", you said " + m.said.map(function (pc) { return pcName(pc, PREFS.flats); }).join(" then ") : ", skipped";
      return "<li><b>" + esc(nameOf(midiOf(m.s, m.f))) + "</b> on the " + SNAME[m.s] + " string, fret " + m.f + said + "</li>";
    }).join("");
    var head = r.timed ? r.c + " right in " + r.timed + " seconds" : r.len ? r.c + " out of " + r.len : r.c + " out of " + r.n;
    $(".q-result", app).innerHTML = '<div class="qr-head"><span class="qr-score">' + head + '</span>' + (isNew ? '<span class="qr-pb">New best</span>' : "") + "</div>" +
      '<p class="qr-verdict">' + verdict + "</p>" +
      '<div class="statrow qr-stats"><div><span class="t-k">Accuracy</span><span class="t-v">' + (r.n ? pct + "%" : "-") + '</span></div><div><span class="t-k">Average time</span><span class="t-v">' + (avg ? avg.toFixed(1) + " s" : "-") + '</span></div><div><span class="t-k">Inside 3 s</span><span class="t-v">' + fast + (r.c ? " of " + r.c : "") + '</span></div><div><span class="t-k">Best streak</span><span class="t-v">' + r.bestStreak + "</span></div>" + (r.skipped ? '<div><span class="t-k">Skipped</span><span class="t-v">' + r.skipped + "</span></div>" : "") + "</div>" +
      (missList ? '<h3 class="minihead">Notes to work on</h3><ul class="qr-miss">' + missList + "</ul>" : "") +
      '<p class="sub">Best for these settings: ' + esc(pbText()) + "</p>";
    $(".q-result", app).hidden = false; $(".q-hud", app).hidden = true; $(".q-answers", app).hidden = true; $(".q-end", app).hidden = true;
    $(".q-feed", app).textContent = r.n ? "Round over." : "Round ended.";
    $(".q-start", app).textContent = "Play again"; board(null, false); showPB();
    $(".q-start", app).focus();
  }
  $(".q-answers", app).addEventListener("click", function (e) { var b = e.target.closest(".qa"); if (b) answer(+b.getAttribute("data-pc")); });
  $(".q-start", app).addEventListener("click", function () { audio(); if (R) skip(); else startRound(); });
  $(".q-end", app).addEventListener("click", endRound);
  $(".q-nat", app).addEventListener("change", function () { drawAnswers(); showPB(); });
  $(".q-max", app).addEventListener("change", function () { board(cur, false); showPB(); });
  $(".q-len", app).addEventListener("change", showPB);
  $$(".q-s", app).forEach(function (c) { c.addEventListener("change", showPB); });
  document.addEventListener("keydown", quizKeys);
  function quizKeys(e) {
    if (!document.body.contains($(".q-answers", app))) { document.removeEventListener("keydown", quizKeys); clearInterval(tick); return; }
    if (e.target.closest("input, select, textarea")) return;
    var k = e.key.toUpperCase(); if (!/^[A-G]$/.test(k)) return;
    var nat = $(".q-nat", app).checked; if (!nat) return; e.preventDefault(); answer(PC[k]);
  }
  drawAnswers(); board(null, false); showPB();
}

/* ===== ear trainer ===== */
var INTERVALS = [["m2", 1], ["M2", 2], ["m3", 3], ["M3", 4], ["P4", 5], ["Tritone", 6], ["P5", 7], ["m6", 8], ["M6", 9], ["m7", 10], ["M7", 11], ["Octave", 12]];
var EAR_CHORDS = { basic: ["", "m"], seventh: ["", "m", "7", "maj7", "m7"], all: ["", "m", "7", "maj7", "m7", "m7b5", "dim7", "aug", "sus4"] };
var QNAME = { "": "Major", "m": "Minor", "7": "Dominant 7", "maj7": "Major 7", "m7": "Minor 7", "m7b5": "Half-diminished", "dim7": "Diminished 7", "aug": "Augmented", "sus4": "Sus4" };
function viewEar() {
  $("#app").innerHTML = '<div class="wrap pagehead"><div class="eyebrow">Practice tools</div><h1>Ear trainer</h1><p class="lede">Weeks 8 and 23 in a drill. Listen, then pick what you heard. Sing it back before you answer.</p></div>' +
    '<div class="wrap narrow"><div class="card ear"><div class="seg" role="group" aria-label="Drill"><button type="button" data-drill="int" aria-pressed="true">Intervals</button><button type="button" data-drill="chord" aria-pressed="false">Chord qualities</button></div>' +
    '<div class="e-opts"></div><div class="e-ans"></div><div class="q-feed e-feed" aria-live="polite">Press Play to hear the first question.</div>' +
    '<div class="q-row"><button type="button" class="btn auto e-play">Play</button><button type="button" class="btn ghost auto e-next">Next question</button><span class="mono e-score"></span></div></div></div>';
  var app = $("#app"), drill = "int", qn = null, sess = { n: 0, c: 0 }, answered = false;
  var ear = S.stats.ear || (S.stats.ear = { n: 0, c: 0 });
  function opts() {
    $(".e-opts", app).innerHTML = drill === "int"
      ? '<label>Set <select class="e-set"><option value="basic">Starter: m3, M3, P5, Octave</option><option value="mid">Most: add M2, P4, M6, m7</option><option value="all">All twelve</option></select></label><label>Direction <select class="e-dir"><option value="up">Rising</option><option value="down">Falling</option><option value="both">Together</option></select></label>'
      : '<label>Set <select class="e-set"><option value="basic">Major and minor</option><option value="seventh">Add the 7th chords</option><option value="all">Everything</option></select></label><label>Playback <select class="e-dir"><option value="arp">Spread then together</option><option value="block">Together</option></select></label>';
    $(".e-set", app).addEventListener("change", function () { qn = null; answers(); });
    answers();
  }
  function pool() {
    var set = $(".e-set", app).value;
    if (drill === "int") { var keep = { basic: ["m3", "M3", "P5", "Octave"], mid: ["M2", "m3", "M3", "P4", "P5", "M6", "m7", "Octave"] }[set]; return INTERVALS.filter(function (i) { return !keep || keep.indexOf(i[0]) > -1; }); }
    return EAR_CHORDS[set].map(function (q) { return [QNAME[q], q]; });
  }
  function answers() { $(".e-ans", app).innerHTML = pool().map(function (p, i) { return '<button type="button" class="qa wide" data-a="' + i + '">' + esc(p[0]) + "</button>"; }).join(""); }
  function newQ() { var p = pool(); qn = { pick: Math.floor(Math.random() * p.length), root: 48 + Math.floor(Math.random() * 12) }; answered = false; $(".e-feed", app).textContent = "Listen, then choose."; }
  function playQ() {
    var c = audio(); if (!c || !qn) return; var p = pool()[qn.pick], t = c.currentTime + 0.05, dir = $(".e-dir", app).value;
    if (drill === "int") {
      var a = qn.root, b = qn.root + p[1];
      if (dir === "up") { pluck(a, t, 0.4); pluck(b, t + 0.7, 0.4); } else if (dir === "down") { pluck(b, t, 0.4); pluck(a, t + 0.7, 0.4); } else { pluck(a, t, 0.35); pluck(b, t, 0.35); }
    } else {
      var tones = QUAL[p[1]].map(function (i) { return qn.root + i; });
      if (dir === "arp") { tones.forEach(function (m, i) { pluck(m, t + i * 0.28, 0.3); }); tones.forEach(function (m) { pluck(m, t + tones.length * 0.28 + 0.3, 0.22); }); }
      else tones.forEach(function (m, i) { pluck(m, t + i * 0.015, 0.25); });
    }
  }
  $$("[data-drill]", app).forEach(function (b) { b.addEventListener("click", function () { drill = b.getAttribute("data-drill"); $$("[data-drill]", app).forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); }); qn = null; opts(); }); });
  $(".e-play", app).addEventListener("click", function () { if (!qn) newQ(); playQ(); });
  $(".e-next", app).addEventListener("click", function () { newQ(); playQ(); });
  $(".e-ans", app).addEventListener("click", function (e) {
    var b = e.target.closest("[data-a]"); if (!b) return;
    if (!qn) { $(".e-feed", app).textContent = "Press Play first."; return; }
    if (answered) return; answered = true;
    var ok = +b.getAttribute("data-a") === qn.pick, right = pool()[qn.pick][0];
    sess.n++; ear.n++; if (ok) { sess.c++; ear.c++; } saveStats();
    $(".e-feed", app).innerHTML = ok ? '<b class="good">Right</b>, ' + esc(right) + "." : '<b class="bad">Not quite</b>, it was ' + esc(right) + ". Press Play to hear it again.";
    $(".e-score", app).textContent = sess.c + "/" + sess.n + " this session, " + Math.round(ear.c / ear.n * 100) + "% all time";
    if (ok) setTimeout(function () { if (answered && $(".e-feed", app)) { newQ(); playQ(); } }, 1100);
  });
  opts();
}

/* ===== chord and scale finder ===== */
var FINDER = [
  ["Scales", [["Major (Ionian)", [0, 2, 4, 5, 7, 9, 11]], ["Natural minor (Aeolian)", [0, 2, 3, 5, 7, 8, 10]], ["Dorian", [0, 2, 3, 5, 7, 9, 10]], ["Phrygian", [0, 1, 3, 5, 7, 8, 10]], ["Lydian", [0, 2, 4, 6, 7, 9, 11]], ["Mixolydian", [0, 2, 4, 5, 7, 9, 10]], ["Locrian", [0, 1, 3, 5, 6, 8, 10]],
    ["Minor pentatonic", [0, 3, 5, 7, 10]], ["Major pentatonic", [0, 2, 4, 7, 9]], ["Blues", [0, 3, 5, 6, 7, 10]], ["Harmonic minor", [0, 2, 3, 5, 7, 8, 11]], ["Phrygian dominant", [0, 1, 4, 5, 7, 8, 10]], ["Melodic minor", [0, 2, 3, 5, 7, 9, 11]], ["Lydian dominant", [0, 2, 4, 6, 7, 9, 10]], ["Altered", [0, 1, 3, 4, 6, 8, 10]], ["Whole tone", [0, 2, 4, 6, 8, 10]], ["Diminished (half-whole)", [0, 1, 3, 4, 6, 7, 9, 10]]]],
  ["Chords", [["Major", QUAL[""]], ["Minor", QUAL.m], ["Dominant 7", QUAL["7"]], ["Major 7", QUAL.maj7], ["Minor 7", QUAL.m7], ["Half-diminished (m7b5)", QUAL.m7b5], ["Diminished 7", QUAL.dim7], ["Augmented", QUAL.aug], ["Sus2", QUAL.sus2], ["Sus4", QUAL.sus4], ["Major 6", QUAL["6"]], ["Minor 6", QUAL.m6], ["Minor (major 7)", QUAL["m(maj7)"]], ["Dominant 9", [0, 4, 7, 10, 2]], ["Power chord (5)", QUAL["5"]]]]
];
function viewFinder() {
  var optHTML = FINDER.map(function (g, gi) { return '<optgroup label="' + g[0] + '">' + g[1].map(function (o, oi) { return '<option value="' + gi + ":" + oi + '">' + esc(o[0]) + "</option>"; }).join("") + "</optgroup>"; }).join("");
  $("#app").innerHTML = '<div class="wrap pagehead"><div class="eyebrow">Practice tools</div><h1>Chord and scale finder</h1><p class="lede">Every note of any chord or scale, across the first fifteen frets.</p></div>' +
    '<div class="wrap"><div class="finderbar"><label>Root <select class="f-root">' + SHARPS.map(function (n, i) { return '<option value="' + i + '"' + (i === 9 ? " selected" : "") + ">" + pcName(i, FLAT_KEYS[i]) + "</option>"; }).join("") + '</select></label><label>Type <select class="f-type">' + optHTML + "</select></label>" +
    '<div class="seg" role="group" aria-label="Dot labels"><button type="button" data-fm="note" aria-pressed="true">Notes</button><button type="button" data-fm="degree" aria-pressed="false">Degrees</button></div><button type="button" class="play f-play">Play</button></div>' +
    '<div class="card"><div class="f-info"></div><div class="f-board board-svg"></div></div></div>';
  var app = $("#app"), mode = "note", notes = null;
  function draw() {
    var pc = +$(".f-root", app).value, t = $(".f-type", app).value.split(":"), item = FINDER[+t[0]][1][+t[1]], flats = !!FLAT_KEYS[pc];
    var iv = item[1].map(function (x) { return x % 12; });
    var spec = { type: "scale", title: pcName(pc, flats) + " " + item[0], root: pcName(pc, flats), iv: iv, frets: [0, 15], hl: [], deg: {}, flats: flats };
    notes = drawBoard($(".f-board", app), spec, { mode: mode, slotW: 46 });
    var names = iv.slice().sort(function (a, b) { return a - b; }).map(function (i) { return pcName(pc + i, flats); });
    $(".f-info", app).innerHTML = "<h2>" + esc(spec.title) + '</h2><p class="mono">Formula: ' + iv.slice().sort(function (a, b) { return a - b; }).map(function (i) { return DEG[i]; }).join(" ") + " &nbsp;&middot;&nbsp; Notes: " + names.join(" ") + "</p>";
  }
  $(".f-root", app).addEventListener("change", draw); $(".f-type", app).addEventListener("change", draw);
  $$("[data-fm]", app).forEach(function (b) { b.addEventListener("click", function () { mode = b.getAttribute("data-fm"); $$("[data-fm]", app).forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); }); draw(); }); });
  $(".f-play", app).addEventListener("click", function () {
    var one = notes.filter(function (n) { return n.s === 6 || n.s === 5 || n.s === 4; }).filter(function (n) { return n.f >= 0 && n.f <= 9; });
    var seen = {}, oct = one.filter(function (n) { if (seen[n.midi]) return false; seen[n.midi] = 1; return true; }).sort(function (a, b) { return a.midi - b.midi; });
    var root = oct.findIndex(function (n) { return n.iv === 0; }); playNotes(oct.slice(Math.max(0, root), Math.max(0, root) + 9), false);
  });
  draw();
}
/* ===== router and boot ===== */
var VIEW = { name: "", onCaps: null };
function route() {
  stopAllSound();
  VIEW.onCaps = null;
  document.body.classList.remove("is-done");
  var h = (location.hash || "").replace(/^#/, ""), m = /^week-(\d{1,2})$/.exec(h), nav = "home";
  if (m && +m[1] >= 1 && +m[1] <= 52) { viewWeek(+m[1]); nav = "home"; }
  else if (h === "log") { viewLog(); nav = "log"; }
  else if (h === "recordings") { viewRecordings(); nav = "recordings"; }
  else if (h === "tools") { viewTools(); nav = "tools"; }
  else if (h === "fretboard-quiz") { viewQuiz(); nav = "tools"; }
  else if (h === "scales") { viewScales(); nav = "tools"; }
  else if (h === "ear-trainer") { viewEar(); nav = "tools"; }
  else if (h === "chord-finder") { viewFinder(); nav = "tools"; }
  else if (h === "backing-tracks") { viewBacking(); nav = "tools"; }
  else if (h === "drone") { viewDrone(); nav = "tools"; }
  else if (h === "practice-timer") { viewTimer(); nav = "tools"; }
  else viewHome();
  VIEW.name = h;
  $$("[data-nav]").forEach(function (a) { a.setAttribute("aria-current", a.getAttribute("data-nav") === nav ? "page" : "false"); });
  window.scrollTo(0, 0);
}
function rerender(reason) {
  if (reason === "caps") { if (VIEW.onCaps) VIEW.onCaps(); return; }
  /* after sync, redraw unless the person is typing */
  var a = document.activeElement;
  if (a && a.closest && a.closest("#app") && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return;
  var y = window.scrollY; route(); window.scrollTo(0, y);
}

function initDisplay() {
  var btn = $("#display-btn"), panel = $("#display-panel");
  btn.addEventListener("click", function () { var open = panel.hidden; panel.hidden = !open; btn.setAttribute("aria-expanded", open ? "true" : "false"); });
  document.addEventListener("click", function (e) { if (!panel.hidden && !e.target.closest("#display-panel, #display-btn")) { panel.hidden = true; btn.setAttribute("aria-expanded", "false"); } });
  [["#pref-left", "left"], ["#pref-lowtop", "lowTop"], ["#pref-flats", "flats"]].forEach(function (p) {
    var c = $(p[0]); c.checked = !!PREFS[p[1]];
    c.addEventListener("change", function () { PREFS[p[1]] = c.checked; savePrefs(); var y = window.scrollY; route(); window.scrollTo(0, y); });
  });
}

window.addEventListener("hashchange", route);
initDisplay();
route();
initCaps();
})();
