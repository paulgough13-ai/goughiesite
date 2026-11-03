/* Supabase backend for the 52 Week Guitar Program on your own site.
   It provides the same services the page uses on claude.ai (db, user, assets,
   sample, downloads) through window.claude.use(name), so app.js runs unchanged.
   With no Supabase settings in config.js, everything stays on this device. */
(function () {
  "use strict";
  var cfg = window.GTR_CONFIG || {};
  var configured = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase && window.supabase.createClient);
  var sb = configured ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  }) : null;
  var TABLE = "guitar_docs", BUCKET = cfg.clipBucket || "guitar-clips";
  var sessionP = sb ? sb.auth.getSession().then(function (r) { return r.data.session; }, function () { return null; }) : Promise.resolve(null);

  function err(code, message) { return { code: code, message: message || code }; }

  /* ----- db: collection and document API over one table ----- */
  function makeDb(uid) {
    function snap(row, id) {
      return { id: id, exists: !!row, data: function () { return row ? row.data : undefined; }, metadata: { fromCache: false, hasPendingWrites: false } };
    }
    function docRef(id) {
      return {
        id: id, path: "data/users/" + uid + "/" + id,
        get: function () {
          return sb.from(TABLE).select("data").eq("user_id", uid).eq("id", id).maybeSingle().then(function (r) {
            if (r.error) throw err("unavailable", r.error.message);
            return snap(r.data, id);
          });
        },
        set: function (data) {
          return sb.from(TABLE).upsert({ user_id: uid, id: id, kind: String(data.kind || "doc"), data: data, updated_at: new Date().toISOString() })
            .then(function (r) { if (r.error) throw err("unavailable", r.error.message); });
        },
        update: function (data) {
          return docRef(id).get().then(function (s) { return docRef(id).set(Object.assign({}, s.data() || {}, data)); });
        },
        delete: function () {
          return sb.from(TABLE).delete().eq("user_id", uid).eq("id", id).then(function (r) { if (r.error) throw err("unavailable", r.error.message); });
        }
      };
    }
    function collection() {
      var filters = [];
      var q = {
        doc: function (id) { return docRef(id); },
        where: function (field, op, value) {
          if (field !== "kind" || (op !== "==" && op !== "eq")) throw err("invalid_argument", "Only kind == value queries are supported");
          filters.push(value); return q;
        },
        get: function () {
          var req = sb.from(TABLE).select("id,data").eq("user_id", uid);
          if (filters.length) req = req.eq("kind", filters[0]);
          return req.limit(5000).then(function (r) {
            if (r.error) throw err("unavailable", r.error.message);
            var docs = (r.data || []).map(function (row) { return snap(row, row.id); });
            return { docs: docs, size: docs.length, empty: !docs.length, docChanges: function () { return []; }, metadata: { fromCache: false, hasPendingWrites: false } };
          });
        }
      };
      return q;
    }
    return { collection: collection, doc: function (path) { return docRef(String(path).split("/").pop()); } };
  }

  /* ----- assets: clips in Supabase Storage ----- */
  function makeAssets(uid) {
    return {
      upload: function (file) {
        var ext = (file.name && file.name.indexOf(".") > -1) ? file.name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") : "bin";
        var path = uid + "/" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10) + "." + ext;
        return sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false }).then(function (r) {
          if (r.error) {
            var m = String(r.error.message || "");
            throw err(/size|large/i.test(m) ? "too_large" : /mime|type/i.test(m) ? "unsupported_type" : /policy|permission|auth/i.test(m) ? "not_granted" : "upstream_error", m);
          }
          var url = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
          return { id: path, url: url, sizeBytes: file.size, contentType: file.type || "" };
        });
      },
      list: function () { return Promise.resolve({ assets: [], usage: { files: 0, bytes: 0, maxFiles: 0, maxBytes: 0 } }); },
      delete: function (id) {
        return sb.storage.from(BUCKET).remove([id]).then(function (r) { if (r.error) throw err("upstream_error", r.error.message); return { deleted: true }; });
      }
    };
  }

  /* ----- sample: the coach, through a Supabase Edge Function ----- */
  function makeSample() {
    function sample(input, opts) {
      opts = opts || {};
      var messages = typeof input === "string" ? [{ role: "user", content: input }] : input;
      return sessionP.then(function () { return sb.auth.getSession(); }).then(function (r) {
        var s = r.data.session;
        if (!s) throw err("not_granted", "Sign in to use the coach");
        return fetch(cfg.supabaseUrl.replace(/\/$/, "") + "/functions/v1/" + (cfg.coachFunction || "coach"), {
          method: "POST", signal: opts.signal,
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + s.access_token, apikey: cfg.supabaseAnonKey },
          body: JSON.stringify({ messages: messages })
        });
      }).then(function (res) {
        if (res.status === 429) throw err("rate_limited");
        if (res.status === 401 || res.status === 403) throw err("not_granted", "Sign in to use the coach");
        return res.json().then(function (j) {
          if (!res.ok || j.error) throw err("upstream_error", j.error || ("HTTP " + res.status));
          if (opts.onText) opts.onText({ text: j.text, delta: j.text });
          return { text: j.text, truncated: !!j.truncated, modelTierApplied: "default" };
        });
      }, function (e) {
        if (e && e.code) throw e;
        if (e && e.name === "AbortError") throw err("cancelled");
        throw err("upstream_error", String(e));
      });
    }
    sample.json = function (input, opts) { return sample(input, opts).then(function (r) { return JSON.parse(r.text); }); };
    sample.limits = function () { return Promise.resolve({ maxPromptBytes: 100000 }); };
    return sample;
  }

  /* ----- downloads: a plain browser download ----- */
  var downloads = {
    save: function (req) {
      var blob = req.data instanceof Blob ? req.data : new Blob([req.data], { type: /\.csv$/.test(req.filename) ? "text/csv" : "application/json" });
      var a = document.createElement("a"), url = URL.createObjectURL(blob);
      a.href = url; a.download = req.filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      return Promise.resolve({ status: "saved" });
    }
  };

  /* ----- window.claude.use ----- */
  window.claude = {
    use: function (name) {
      if (name === "downloads") return Promise.resolve(downloads);
      if (!sb) return Promise.resolve(null);
      return sessionP.then(function (s) {
        if (!s) return null;
        var uid = s.user.id;
        if (name === "db") return makeDb(uid);
        if (name === "user") return { id: function () { return Promise.resolve(uid); }, me: function () { return Promise.resolve({ id: uid, name: s.user.email || "", email: s.user.email || null, isOwner: true, canEdit: true }); }, isOwner: function () { return Promise.resolve(true); }, canEdit: function () { return Promise.resolve(true); } };
        if (name === "assets") return makeAssets(uid);
        if (name === "sample") return cfg.coach === false ? null : makeSample();
        return null;
      });
    }
  };

  /* ----- account menu: sign in, sign out, import a backup ----- */
  function el(html) { var d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstChild; }
  function mountAccount() {
    var bar = document.querySelector(".topbar .topbar-in");
    if (!bar || !sb) return;
    var btn = el('<button type="button" class="iconbtn" id="acct-btn" aria-expanded="false" aria-controls="acct-panel">Sign in</button>');
    var panel = el('<div class="popover acct" id="acct-panel" hidden></div>');
    bar.appendChild(btn); document.querySelector(".topbar").appendChild(panel);
    btn.addEventListener("click", function () { var open = panel.hidden; panel.hidden = !open; btn.setAttribute("aria-expanded", open ? "true" : "false"); });
    document.addEventListener("click", function (e) { if (!panel.hidden && !e.target.closest("#acct-panel, #acct-btn")) { panel.hidden = true; btn.setAttribute("aria-expanded", "false"); } });
    sessionP.then(function (s) {
      if (!s) {
        panel.innerHTML = '<form class="acct-form"><p class="acct-h">Sign in to sync your progress, upload clips and use the coach.</p>' +
          '<label>Email <input type="email" id="acct-email" autocomplete="username" required></label>' +
          '<label>Password <input type="password" id="acct-pass" autocomplete="current-password" required></label>' +
          '<button type="submit" class="btn">Sign in</button><p class="acct-msg" aria-live="polite"></p></form>';
        panel.querySelector("form").addEventListener("submit", function (e) {
          e.preventDefault();
          var msg = panel.querySelector(".acct-msg"); msg.textContent = "Signing in…";
          sb.auth.signInWithPassword({ email: panel.querySelector("#acct-email").value.trim(), password: panel.querySelector("#acct-pass").value }).then(function (r) {
            if (r.error) { msg.textContent = "That email and password didn't match. Check them and try again."; return; }
            location.reload();
          });
        });
        return;
      }
      btn.textContent = "Account";
      panel.innerHTML = '<p class="acct-h">Signed in as ' + (s.user.email || "you").replace(/[<>&]/g, "") + "</p>" +
        '<label class="acct-imp">Import a backup (JSON)<input type="file" id="acct-import" accept="application/json,.json"></label>' +
        '<p class="acct-msg" aria-live="polite"></p><button type="button" class="btn ghost" id="acct-out">Sign out</button>';
      panel.querySelector("#acct-out").addEventListener("click", function () { sb.auth.signOut().then(function () { location.reload(); }); });
      panel.querySelector("#acct-import").addEventListener("change", function (e) {
        var f = e.target.files && e.target.files[0], msg = panel.querySelector(".acct-msg"); if (!f) return;
        f.text().then(function (txt) {
          var b = JSON.parse(txt), uid = s.user.id, rows = [];
          if (b.progress) rows.push({ user_id: uid, id: "progress", kind: "progress", data: { kind: "progress", weeks: b.progress } });
          if (b.stats) rows.push({ user_id: uid, id: "stats", kind: "stats", data: { kind: "stats", data: b.stats } });
          (b.logs || []).forEach(function (l) { if (l && l.id) rows.push({ user_id: uid, id: l.id, kind: "log", data: Object.assign({ kind: "log" }, l) }); });
          if (!rows.length) throw new Error("empty");
          msg.textContent = "Importing " + rows.length + " records…";
          return sb.from(TABLE).upsert(rows).then(function (r) {
            if (r.error) throw r.error;
            try { ["gtr52-progress", "gtr52-logs", "gtr52-stats"].forEach(function (k) { localStorage.removeItem(k); }); } catch (x) { /* ignore */ }
            msg.textContent = "Imported. Reloading…"; setTimeout(function () { location.reload(); }, 800);
          });
        }).catch(function () { msg.textContent = "That file isn't a backup from this site. Use Export everything (JSON) on the Log page."; });
      });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAccount); else mountAccount();
})();
