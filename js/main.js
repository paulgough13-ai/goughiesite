// Shared site behaviour. Content lives in photos.js.
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ── Header & footer ─────────────────────────────────────
function renderChrome() {
  const page = document.body.dataset.page;
  const links = [
    ["index.html", "Home", "home"],
    ["galleries.html", "Galleries", "galleries"],
    ["about.html", "About", "about"],
    ["contact.html", "Contact", "contact"],
  ];
  const header = document.createElement("header");
  header.className = "site-header" + (page === "home" ? "" : " solid");
  header.innerHTML = `
    <a href="index.html" class="brand">
      <span class="brand-name">${esc(SITE.name)}</span>
      <span class="brand-tag">${esc(SITE.tagline)}</span>
    </a>
    <button class="menu-btn" aria-label="Menu"><span></span><span></span><span></span></button>
    <nav class="nav">
      ${links.map(([href, label, key]) =>
        `<a href="${href}" class="${key === page || (key === "galleries" && page === "gallery") ? "active" : ""}">${label}</a>`).join("")}
    </nav>`;
  document.body.prepend(header);
  $(".menu-btn", header).addEventListener("click", () => document.body.classList.toggle("menu-open"));

  if (page === "home") {
    const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `
    <span>© ${new Date().getFullYear()} ${esc(SITE.name)}. All images copyright — please ask before use.</span>
    <a href="contact.html">Get in touch</a>`;
  document.body.append(footer);
}

// ── Home: hero slideshow ────────────────────────────────
function initHero() {
  const hero = $(".hero");
  if (!hero) return;
  $(".hero-title", hero).textContent = SITE.tagline;
  const caption = $(".hero-caption", hero);
  const dots = $(".hero-dots", hero);

  const slides = HERO.map((s, i) => {
    const el = document.createElement("div");
    el.className = "hero-slide";
    el.style.backgroundImage = `url("${s.src}")`;
    hero.prepend(el);
    const dot = document.createElement("button");
    dot.setAttribute("aria-label", `Show photo ${i + 1}`);
    dot.addEventListener("click", () => { show(i); restart(); });
    dots.append(dot);
    return el;
  });

  let current = -1, timer;
  function show(i) {
    if (current >= 0) { slides[current].classList.remove("active"); dots.children[current].classList.remove("active"); }
    current = i;
    slides[i].classList.add("active");
    dots.children[i].classList.add("active");
    caption.style.opacity = 0;
    setTimeout(() => { caption.textContent = HERO[i].caption; caption.style.opacity = 1; }, 400);
  }
  const restart = () => { clearInterval(timer); timer = setInterval(() => show((current + 1) % slides.length), 6000); };
  show(0);
  restart();
}

// ── Gallery tiles (home + galleries page) ───────────────
function initTiles() {
  document.querySelectorAll("[data-tiles]").forEach((wrap) => {
    wrap.innerHTML = GALLERIES.map((g) => `
      <a class="tile reveal" href="gallery.html?g=${encodeURIComponent(g.id)}">
        <img src="${esc(g.cover)}" alt="${esc(g.title)}" loading="lazy">
        <div class="tile-label">
          <h3>${esc(g.title)}</h3>
          <p>${esc(g.blurb)}</p>
          <div class="count">${g.photos.length} photographs</div>
        </div>
      </a>`).join("");
  });
}

// ── Single gallery page ─────────────────────────────────
function initGallery() {
  const grid = $(".masonry");
  if (!grid) return;
  const id = new URLSearchParams(location.search).get("g");
  const idx = Math.max(0, GALLERIES.findIndex((g) => g.id === id));
  const g = GALLERIES[idx];

  document.title = `${g.title} — ${SITE.name}`;
  $(".section-title").textContent = g.title;
  $(".lede").textContent = g.blurb;

  grid.innerHTML = g.photos.map((p, i) => `
    <figure data-i="${i}">
      <img src="${esc(p.thumb || p.src)}" alt="${esc(p.caption)}" loading="lazy">
      <figcaption>${esc(p.caption)}</figcaption>
    </figure>`).join("");
  grid.querySelectorAll("img").forEach((img) => {
    if (img.complete) img.classList.add("loaded");
    else img.addEventListener("load", () => img.classList.add("loaded"));
  });
  grid.addEventListener("click", (e) => {
    const fig = e.target.closest("figure");
    if (fig) openLightbox(g.photos, +fig.dataset.i);
  });

  const prev = GALLERIES[(idx - 1 + GALLERIES.length) % GALLERIES.length];
  const next = GALLERIES[(idx + 1) % GALLERIES.length];
  $(".gallery-nav").innerHTML = `
    <a href="gallery.html?g=${prev.id}">← ${esc(prev.title)}</a>
    <a href="galleries.html">All galleries</a>
    <a href="gallery.html?g=${next.id}">${esc(next.title)} →</a>`;
}

// ── Lightbox ────────────────────────────────────────────
let lb, lbPhotos = [], lbIndex = 0;
function buildLightbox() {
  lb = document.createElement("div");
  lb.className = "lightbox";
  lb.innerHTML = `
    <span class="lb-count"></span>
    <button class="lb-btn lb-close" aria-label="Close">✕</button>
    <button class="lb-btn lb-prev" aria-label="Previous">‹</button>
    <img alt="">
    <p class="lb-caption"></p>
    <button class="lb-btn lb-next" aria-label="Next">›</button>`;
  document.body.append(lb);
  $(".lb-close", lb).onclick = closeLightbox;
  $(".lb-prev", lb).onclick = () => step(-1);
  $(".lb-next", lb).onclick = () => step(1);
  lb.addEventListener("click", (e) => { if (e.target === lb) closeLightbox(); });
  document.addEventListener("keydown", (e) => {
    if (!lb.classList.contains("open")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });
  // Swipe on touch screens
  let x0 = null;
  lb.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
  lb.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    x0 = null;
  });
}
function openLightbox(photos, i) {
  if (!lb) buildLightbox();
  lbPhotos = photos;
  render(i);
  lb.classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeLightbox() { lb.classList.remove("open"); document.body.style.overflow = ""; }
function step(d) { render((lbIndex + d + lbPhotos.length) % lbPhotos.length); }
function render(i) {
  lbIndex = i;
  const p = lbPhotos[i];
  $("img", lb).src = p.src;
  $("img", lb).alt = p.caption;
  $(".lb-caption", lb).textContent = p.caption;
  $(".lb-count", lb).textContent = `${i + 1} / ${lbPhotos.length}`;
}

// ── Contact form (sent via Web3Forms; your email is never shown) ──
function initContact() {
  const form = $(".form");
  if (!form) return;
  const status = $(".form-status");
  const button = $("button[type=submit]", form);
  const say = (msg, kind) => { status.textContent = msg; status.className = `form-status ${kind || ""}`; };

  if (!SITE.formKey) {
    say("The contact form isn't switched on yet.", "error");
    button.disabled = true;
    return;
  }
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    if (d.botcheck) return; // hidden field only bots fill in
    button.disabled = true;
    say("Sending…");
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: SITE.formKey,
          subject: `${d.topic} — from ${d.name} (website)`,
          from_name: d.name,
          name: d.name,
          email: d.email,
          topic: d.topic,
          message: d.message,
        }),
      });
      const out = await res.json();
      if (!out.success) throw new Error(out.message);
      form.reset();
      say("Thanks — your message has been sent. I'll get back to you soon.", "ok");
    } catch {
      say("Sorry, something went wrong sending your message. Please try again later.", "error");
    } finally {
      button.disabled = false;
    }
  });
}

// ── Reveal on scroll ────────────────────────────────────
function initReveal() {
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
  }), { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
}

renderChrome();
initHero();
initTiles();
initGallery();
initContact();
initReveal();
document.querySelectorAll("[data-portrait]").forEach((el) => (el.src = SITE.portrait));
