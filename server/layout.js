import { setting } from "./db.js";

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

export function paragraphs(text) {
  return String(text || "").split(/\n\n+/).map(p => `<p>${esc(p).replaceAll("\n", "<br>")}</p>`).join("");
}

const NAV = [
  ["/", "Գլխավոր"],
  ["/doctors", "Բժիշկներ"],
  ["/map", "Քարտեզ"],
  ["/medicines", "Դեղեր"],
  ["/emergency", "Արտակարգ"],
  ["/articles", "Հոդվածներ"]
];

export function renderPage(req, opts) {
  const site = setting("site_name") || "Medverse";
  const title = opts.title ? `${opts.title} | ${site}` : site;
  const description = opts.description || setting("description");
  const url = `${origin(req)}${opts.path || req.path}`;
  const robots = opts.noindex ? "noindex, nofollow" : "index, follow";
  const user = req.session.user;
  const links = NAV.map(([href, label]) =>
    `<li><a class="${req.path === href ? "active" : ""} ${href === "/emergency" ? "nav-cta" : ""}" href="${href}">${label}</a></li>`
  ).join("");
  const account = user
    ? `<li><a class="${req.path.startsWith("/cabinet") ? "active" : ""}" href="/cabinet">Կաբինետ</a></li>
       <li><a class="${req.path === "/profile" ? "active" : ""}" href="/profile">${esc(user.name)}</a></li>
       <li><form method="post" action="/logout">${csrfField(req)}<button class="nav-out" type="submit">Դուրս գալ</button></form></li>`
    : `<li><a class="${req.path === "/login" ? "active" : ""}" href="/login">Մուտք</a></li>
       <li><a class="nav-cta" href="/register">Գրանցում</a></li>`;
  const json = (opts.jsonLd || []).map(obj =>
    `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`
  ).join("");
  const flash = req.session.flash;
  delete req.session.flash;
  const flashHtml = flash ? `<div class="flash ${esc(flash.type)}">${esc(flash.message)}</div>` : "";

  return `<!DOCTYPE html>
<html lang="hy">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="robots" content="${robots}" />
  <link rel="canonical" href="${esc(url)}" />
  <meta property="og:type" content="${opts.ogType || "website"}" />
  <meta property="og:locale" content="hy_AM" />
  <meta property="og:site_name" content="${esc(site)}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(url)}" />
  <meta name="twitter:card" content="summary" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Armenian:wght@400;500;600;700&family=Noto+Serif+Armenian:wght@500;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/css/styles.css" />
  ${json}
</head>
<body>
  <a class="skip" href="#main">Անցնել բովանդակությանը</a>
  <header class="nav scrolled">
    <div class="nav-inner">
      <a class="logo" href="/"><span class="logo-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/></svg></span>${esc(site)}</a>
      <button class="nav-toggle" id="navToggle" aria-label="Բացել մենյուն"><span></span><span></span><span></span></button>
      <ul class="nav-links" id="navLinks">${links}${account}</ul>
    </div>
  </header>
  <main id="main">${flashHtml}${opts.body}</main>
  <footer class="footer">
    <div class="wrap foot-grid">
      <div>
        <a class="logo" href="/">${esc(site)}</a>
        <p style="margin-top:12px">${esc(description)}</p>
      </div>
      <div>
        <h2>Բաժիններ</h2>
        <a href="/doctors">Բժիշկներ</a>
        <a href="/map">Քարտեզ</a>
        <a href="/medicines">Դեղեր</a>
        <a href="/articles">Հոդվածներ</a>
      </div>
      <div>
        <h2>Օգնություն</h2>
        <a href="/emergency">Արտակարգ ուղեցույց</a>
        <a href="/register">Գրանցում</a>
        <a href="/login">Մուտք</a>
      </div>
      <div>
        <h2>${esc(setting("city") || "Աուրել")}</h2>
        <p>Ուսումնական հարթակ, ոչ թե կլինիկա։</p>
        <p>Արտակարգ դեպքում զանգեք 911։</p>
      </div>
    </div>
    <div class="wrap legal">© ${new Date().getFullYear()} ${esc(site)}. Բովանդակությունը չի փոխարինում բժշկի խորհրդին։</div>
  </footer>
  <button class="fab" type="button" data-pro-call>Զանգել 911</button>
  <script src="/js/pro-call.js"></script>
  <script>
    document.getElementById("navToggle").addEventListener("click", () => {
      document.getElementById("navLinks").classList.toggle("open");
    });
  </script>
</body>
</html>`;
}

export function origin(req) {
  const forwarded = req.headers["x-forwarded-proto"];
  const proto = (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "") || req.protocol;
  return `${proto}://${req.get("host")}`;
}

export function flash(req, type, message) {
  req.session.flash = { type, message };
}

export function csrfField(req) {
  return `<input type="hidden" name="_csrf" value="${esc(req.session.csrf)}" />`;
}
