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
  var xOf = function (f) { return X(f === 0 ? 24 : left + (f - first) * slotW + slotW / 2); };
  var yOf = function (s) { return top + ((flip ? 7 - s : s) - 1) * sp; };
  var bx0 = X(left), bx1 = X(left + slots * slotW);
  sv("rect", { x: Math.min(bx0, bx1), y: top - 12, width: slots * slotW, height: boardH + 24, rx: 3, class: "wood" }, svg);
  [3, 5, 7, 9, 15, 17, 19, 21].forEach(function (f) {
    if (f >= first && f <= last) sv("circle", { cx: xOf(f), cy: top + boardH / 2, r: 3.5, class: "inlay" }, svg);
  });
  [12, 24].forEach(function (f) {
    if (f >= first && f <= last) {
      sv("circle", { cx: xOf(f), cy: top + sp * 1.5, r: 3.5, class: "inlay" }, svg);
      sv("circle", { cx: xOf(f), cy: top + sp * 3.5, r: 3.5, class: "inlay" }, svg);
    }
  });
  for (var i = 0; i <= slots; i++) {
    var fx = X(left + i * slotW);
    sv("line", { x1: fx, x2: fx, y1: top - 12, y2: top + boardH + 12, class: i === 0 && first === 1 ? "nut" : "fretwire" }, svg);
  }
  for (var s = 1; s <= 6; s++) {
    sv("line", { x1: bx0, x2: bx1, y1: yOf(s), y2: yOf(s), class: "gstring", "stroke-width": (0.8 + (s - 1) * 0.32).toFixed(2) }, svg);
    var sl = sv("text", { x: X(7), y: yOf(s) + 4, class: "slabel" }, svg);
    sl.textContent = ["e", "B", "G", "D", "A", "E"][s - 1];
  }
  for (var f = first; f <= last; f++) {
    if ([1, 3, 5, 7, 9, 12, 15, 17, 19, 21].indexOf(f) > -1 || f === first) {
      var t = sv("text", { x: xOf(f), y: top + boardH + 32, class: "fnum" }, svg); t.textContent = f;
    }
  }
  (spec.muted || []).forEach(function (s) { var m = sv("text", { x: X(25), y: yOf(s) + 5, class: "muted" }, svg); m.textContent = "×"; });
  var mode = opts.mode || "note";
  x.notes.forEach(function (n) {
    var g = sv("g", { class: "dot" + (n.iv === 0 && mode !== "quiz" ? " root" : n.hl ? " hl" : "") + (n.f === 0 ? " open" : ""),
      tabindex: "0", role: "button", "aria-label": (mode === "quiz" ? "Mystery note" : n.name) + ", string " + n.s + ", fret " + n.f }, svg);
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
function chordTones(c, shift) {
  var pc = (c.root + shift + 120) % 12, base = 52 + ((pc - 4 + 12) % 12);
  return { bass: 40 + ((pc - 4 + 12) % 12), tones: c.iv.map(function (i) { return base + i; }), pc: pc, iv: c.iv };
}
function drum(kind, t, vel) {
  vel = vel == null ? 1 : vel;
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
function strum(ch, t, gain, dur, down) {
  var tones = ch.tones.slice(); if (down === false) tones.reverse();
  tones.forEach(function (m, i) { pluck(m, t + i * 0.012, gain, dur); });
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
  var bars = parseBars(preset.bars), swing = preset.style === "swing" || preset.style === "shuffle", spb = swing ? 3 : 4;
  var barI = 0, step = 0, next = ctx.currentTime + 0.08, on = true;
  function stepDur() { return 60 / ui.bpm() / spb; }
  function play(t) {
    var bar = bars[barI], beat = Math.floor(step / spb), sub = step % spb, cur = chordAt(bar, beat), shift = ui.shift();
    if (!cur.c) return;
    var ch = chordTones(cur.c, shift), st = preset.style, ivs = cur.c.iv;
    var third = ivs.indexOf(3) > -1 ? 3 : 4, fifth = ivs.indexOf(6) > -1 && ivs.indexOf(7) < 0 ? 6 : 7;
    if (st === "rock") {
      if (sub === 0 && (beat === 0 || beat === 2)) drum("kick", t);
      if (sub === 2 && beat === 2) drum("kick", t, 0.6);
      if (sub === 0 && (beat === 1 || beat === 3)) drum("snare", t);
      if (sub % 2 === 0) drum("hat", t, sub === 0 ? 1 : 0.6);
      if (sub === 0 && (beat === 0 || beat === 2)) strum(ch, t, 0.12, 0.9);
      if (sub === 2 && (beat === 1 || beat === 3)) strum(ch, t, 0.08, 0.3, false);
      if (sub === 0 || sub === 2) pluck(ch.bass + (sub === 2 && beat === 3 ? fifth : 0), t, 0.42, 0.22);
    } else if (st === "ballad") {
      if (sub === 0 && beat === 0) drum("kick", t, 0.8);
      if (sub === 0 && beat === 2) drum("rim", t);
      if (sub === 0) drum("hat", t, 0.7);
      if (sub === 0 && beat === 0) strum(ch, t, 0.13, 3.2);
      if (sub === 0 && beat === 2) strum(ch, t, 0.07, 1.4);
      if (sub === 0 && (beat === 0 || beat === 2)) pluck(ch.bass + (beat === 2 ? fifth : 0), t, 0.42, 1.2);
    } else if (st === "shuffle") {
      if (sub === 0 || sub === 2) drum("hat", t, sub === 0 ? 1 : 0.55);
      if (sub === 0 && (beat === 0 || beat === 2)) drum("kick", t);
      if (sub === 0 && (beat === 1 || beat === 3)) drum("snare", t, 0.9);
      if (sub === 0 || sub === 2) {
        var walk = [0, third === 3 ? 3 : 4, 7, 9][beat];
        pluck(ch.bass + walk, t, sub === 0 ? 0.42 : 0.3, 0.18);
        strum({ tones: ch.tones.slice(0, 3) }, t, sub === 0 ? 0.08 : 0.05, 0.14);
      }
    } else if (st === "swing") {
      if (sub === 0 || (sub === 2 && (beat === 1 || beat === 3))) drum("ride", t, sub === 0 ? 1 : 0.7);
      if (sub === 0 && (beat === 1 || beat === 3)) drum("hat", t, 0.8);
      if (sub === 0 && beat === 0) drum("kick", t, 0.35);
      if ((beat === 0 && sub === 0) || (beat === 1 && sub === 2)) strum(ch, t, 0.09, 0.32);
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
        pluck(note, t, 0.45, 0.4);
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
    startBand(p, {
      bpm: function () { return +bpm.value; }, shift: function () { return +key.value; },
      mark: function (i) { chips.forEach(function (c, k) { c.classList.toggle("on", k === i); }); },
      stopped: function () { go.textContent = "Play along"; go.setAttribute("aria-pressed", "false"); }
    });
    go.textContent = "Stop"; go.setAttribute("aria-pressed", "true");
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
  $("#app").innerHTML = '<div class="wrap pagehead"><div class="eyebrow">Practice tools</div><h1>Backing tracks</h1><p class="lede">Drums, bass and chords generated in your browser. Pick a track, set the tempo and key, and play over it.</p></div>' +
    '<div class="wrap"><section class="card custom"><h2>Build your own</h2><p class="sub">One chord per bar, separated by spaces. Join two chords in one bar with a plus, for example <code>Am7 D7 Gmaj7 Cmaj7+F#m7b5</code>.</p>' +
    '<div class="cu-row"><input type="text" class="cu-in" value="Am7 D7 Gmaj7 Cmaj7" aria-label="Chord progression"><select class="cu-style" aria-label="Style"><option value="rock">Rock</option><option value="ballad">Ballad</option><option value="shuffle">Shuffle</option><option value="swing">Swing</option></select><button type="button" class="btn auto cu-make">Make track</button></div><p class="cu-msg sub" aria-live="polite"></p><div class="cu-slot"></div></section>' +
    groups.map(function (g) { return '<section class="btgroup"><h2 class="grouphead">' + esc(g[0]) + '</h2><div class="bands">' + g[1].map(bandHTML).join("") + "</div></section>"; }).join("") + "</div>";
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

/* ===== fretboard quiz ===== */
function viewQuiz() {
  var q = S.stats.quiz || (S.stats.quiz = { answered: 0, correct: 0, best: 0, per: {} });
  $("#app").innerHTML = '<div class="wrap pagehead"><div class="eyebrow">Practice tools</div><h1>Fretboard quiz</h1><p class="lede">A note lights up. Name it as fast as you can. The checkpoint target is 3 seconds.</p></div>' +
    '<div class="wrap"><div class="quizbar"><fieldset class="qs"><legend>Strings</legend>' + [6, 5, 4, 3, 2, 1].map(function (s) { return '<label><input type="checkbox" class="q-s" value="' + s + '"' + (s >= 4 ? " checked" : "") + "> " + ["", "e", "B", "G", "D", "A", "E"][s] + "</label>"; }).join("") + "</fieldset>" +
    '<label>Frets up to <select class="q-max"><option>5</option><option>7</option><option selected>12</option><option>15</option></select></label>' +
    '<label class="opt"><input type="checkbox" class="q-nat" checked> Natural notes only</label><label class="opt"><input type="checkbox" class="q-snd"> Play the note first</label></div>' +
    '<div class="quiz card"><div class="q-board board-svg"></div><div class="q-answers"></div><div class="q-feed" aria-live="polite">Press Start, then name the highlighted note.</div>' +
    '<div class="q-row"><button type="button" class="btn auto q-start">Start</button><span class="q-score mono"></span></div></div>' +
    '<div class="statrow"><div><span class="t-k">All-time accuracy</span><span class="t-v q-acc">' + (q.answered ? Math.round(q.correct / q.answered * 100) + "%" : "-") + '</span></div><div><span class="t-k">Answered</span><span class="t-v">' + q.answered + '</span></div><div><span class="t-k">Best streak</span><span class="t-v">' + q.best + '</span></div><div><span class="t-k">Weakest string</span><span class="t-v">' + weakest(q) + "</span></div></div></div>";
  var app = $("#app"), cur = null, t0 = 0, sess = { n: 0, c: 0, streak: 0, times: [] };
  function weakest(qq) { var worst = null, wr = 2; Object.keys(qq.per).forEach(function (s) { var p = qq.per[s]; if (p.n >= 5 && p.c / p.n < wr) { wr = p.c / p.n; worst = s; } }); return worst ? ["", "e", "B", "G", "D", "A", "E"][worst] + " (" + Math.round(wr * 100) + "%)" : "-"; }
  function names() { return $(".q-nat", app).checked ? ["C", "D", "E", "F", "G", "A", "B"] : (PREFS.flats ? FLATS : SHARPS); }
  function drawAnswers() { $(".q-answers", app).innerHTML = names().map(function (nm, i) { return '<button type="button" class="qa" data-pc="' + ($(".q-nat", app).checked ? PC[nm] : i) + '">' + nm + "</button>"; }).join(""); }
  function board(target, reveal) {
    var spec = { type: "notes", title: "Quiz", notes: target ? [[target.s, target.f, reveal ? nameOf(midiOf(target.s, target.f)) : "?", true]] : [], frets: [0, +$(".q-max", app).value] };
    drawBoard($(".q-board", app), spec, { mode: "quiz", slotW: 46 });
  }
  function nextQ() {
    if (!$(".q-feed", app)) return;
    var strs = $$(".q-s", app).filter(function (c) { return c.checked; }).map(function (c) { return +c.value; });
    if (!strs.length) { $(".q-feed", app).textContent = "Pick at least one string."; return; }
    var max = +$(".q-max", app).value, nat = $(".q-nat", app).checked, tries = 0, s, f;
    do { s = strs[Math.floor(Math.random() * strs.length)]; f = Math.floor(Math.random() * (max + 1)); tries++; }
    while ((nat && SHARPS[midiOf(s, f) % 12].length > 1 || (cur && cur.s === s && cur.f === f)) && tries < 100);
    cur = { s: s, f: f }; board(cur, false); t0 = performance.now();
    if ($(".q-snd", app).checked) pluck(midiOf(s, f));
    $(".q-feed", app).textContent = "String " + ["", "e", "B", "G", "D", "A", "E"][s] + ". Which note is this?";
  }
  function answer(pc) {
    if (!cur) return;
    var right = midiOf(cur.s, cur.f) % 12, ok = pc === right, dt = (performance.now() - t0) / 1000;
    q.answered++; sess.n++; var ps = q.per[cur.s] || (q.per[cur.s] = { n: 0, c: 0 }); ps.n++;
    if (ok) { q.correct++; sess.c++; ps.c++; sess.streak++; if (sess.streak > q.best) q.best = sess.streak; sess.times.push(dt); } else sess.streak = 0;
    saveStats(); pluck(midiOf(cur.s, cur.f)); board(cur, true);
    $(".q-feed", app).innerHTML = (ok ? '<b class="good">Right</b>' : '<b class="bad">Not quite</b>, it was ' + nameOf(midiOf(cur.s, cur.f))) + " &middot; " + dt.toFixed(1) + " s" + (ok && dt <= 3 ? " (inside the 3 second target)" : "");
    var avg = sess.times.length ? sess.times.reduce(function (a, b) { return a + b; }) / sess.times.length : 0;
    $(".q-score", app).textContent = sess.c + "/" + sess.n + " this session, streak " + sess.streak + (avg ? ", average " + avg.toFixed(1) + " s" : "");
    $(".q-acc", app).textContent = Math.round(q.correct / q.answered * 100) + "%";
    var c2 = cur; cur = null; setTimeout(function () { if (!cur) nextQ(); void c2; }, ok ? 700 : 1500);
  }
  $(".q-answers", app).addEventListener("click", function (e) { var b = e.target.closest(".qa"); if (b) answer(+b.getAttribute("data-pc")); });
  $(".q-start", app).addEventListener("click", function () { audio(); $(".q-start", app).textContent = "Skip"; nextQ(); });
  $(".q-nat", app).addEventListener("change", drawAnswers);
  $(".q-max", app).addEventListener("change", function () { board(cur, false); });
  document.addEventListener("keydown", quizKeys);
  function quizKeys(e) {
    if (!document.body.contains($(".q-answers", app))) { document.removeEventListener("keydown", quizKeys); return; }
    if (e.target.closest("input, select, textarea")) return;
    var k = e.key.toUpperCase(); if (!/^[A-G]$/.test(k)) return;
    var nat = $(".q-nat", app).checked; if (!nat) return; e.preventDefault(); answer(PC[k]);
  }
  drawAnswers(); board(null, false);
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
