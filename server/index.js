import crypto from "crypto";
import path from "path";
import express from "express";
import cookieSession from "cookie-session";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";
import { db, setting, settingsMap } from "./db.js";
import { renderPage, origin, flash, csrfField, esc, paragraphs } from "./layout.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(express.urlencoded({ extended: false }));
app.use(cookieSession({
  name: "medverse",
  keys: [process.env.SESSION_SECRET || "medverse-dev-secret"],
  maxAge: 1000 * 60 * 60 * 24 * 7,
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.VERCEL === "1"
}));
app.use((req, res, next) => {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(16).toString("hex");
  next();
});

function checkCsrf(req, res, next) {
  if (req.body._csrf !== req.session.csrf) {
    res.status(403).send("Հարցումը մերժվեց։ Թարմացրեք էջը և փորձեք նորից։");
    return;
  }
  next();
}

function requireUser(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect("/login");
    if (!roles.includes(req.session.user.role)) return res.status(403).send("Այս բաժինը ձեր դերի համար չէ։");
    next();
  };
}

const legacy = {
  "/index.html": "/",
  "/doctors.html": "/doctors",
  "/map.html": "/map",
  "/medicines.html": "/medicines",
  "/lab.html": "/cabinet?tab=labs",
  "/journal.html": "/cabinet?tab=journal",
  "/emergency.html": "/emergency",
  "/articles.html": "/articles"
};
app.use((req, res, next) => {
  if (legacy[req.path]) return res.redirect(301, legacy[req.path]);
  next();
});

function orgLd(req) {
  return {
    "@context": "https://schema.org",
    "@type": "MedicalOrganization",
    name: setting("site_name"),
    url: origin(req) + "/",
    description: setting("description"),
    address: { "@type": "PostalAddress", addressLocality: setting("city") },
    medicalSpecialty: "PrimaryCare"
  };
}

function crumbs(req, items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: origin(req) + it.path
    }))
  };
}

app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(`User-agent: *\nAllow: /\nDisallow: /cabinet\nDisallow: /login\nDisallow: /register\nDisallow: /profile\nSitemap: ${origin(req)}/sitemap.xml\n`);
});

app.get("/sitemap.xml", (req, res) => {
  const base = origin(req);
  const urls = ["/", "/doctors", "/map", "/medicines", "/emergency", "/articles"];
  for (const d of db.prepare("SELECT slug FROM doctor_profiles").all()) urls.push(`/doctors/${d.slug}`);
  for (const m of db.prepare("SELECT slug FROM medicines").all()) urls.push(`/medicines/${m.slug}`);
  for (const a of db.prepare("SELECT slug FROM articles").all()) urls.push(`/articles/${a.slug}`);
  const body = urls.map(u => `<url><loc>${esc(base + u)}</loc></url>`).join("");
  res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`);
});

app.get("/", (req, res) => {
  const doctors = db.prepare("SELECT * FROM doctor_profiles ORDER BY rating DESC LIMIT 4").all();
  const cards = doctors.map(d => `
    <article class="card doc-card">
      <div class="doc-top">${photoTag(d)}
        <div><h2 style="font-size:1.15rem"><a href="/doctors/${esc(d.slug)}">${esc(d.name)}</a></h2>
        <p class="muted">${esc(d.specialty)}</p></div>
      </div>
      <p class="muted">${esc(d.clinic)}</p>
      <p class="meta">Հաջորդը՝ ${esc(d.next_slot)}</p>
    </article>`).join("");
  res.send(renderPage(req, {
    title: "Բժիշկներ, քարտեզ և խնամք մեկ տեղում",
    description: setting("description"),
    path: "/",
    jsonLd: [orgLd(req)],
    body: `
    <section class="hero"><div class="wrap hero-grid">
      <div>
        <p class="eyebrow">${esc(setting("site_name"))} · ${esc(setting("city"))}</p>
        <h1>Բժշկություն, որ կապում է բժշկին և պացիենտին։</h1>
        <p class="lede">Գրանցվեք որպես պացիենտ, աշխատեք որպես բժիշկ, կամ կառավարեք ամբողջ կայքը որպես ադմին։ Տվյալները պահվում են տեղական բազայում։</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="/doctors">Դիտել բժիշկներին</a>
          <a class="btn btn-ghost" href="/register">Բացել հաշիվ</a>
        </div>
      </div>
      <div class="card panel">
        <p class="eyebrow">Երեք դեր</p>
        <div class="steps">
          <div class="step"><div class="num">1</div><div><strong>Պացիենտ</strong><p class="muted">Բժիշկներ, այցեր, անալիզներ, օրագիր։</p></div></div>
          <div class="step"><div class="num">2</div><div><strong>Բժիշկ</strong><p class="muted">Իմ պացիենտները, այցերի հաստատում, պրոֆիլ։</p></div></div>
          <div class="step"><div class="num">3</div><div><strong>Ադմին</strong><p class="muted">Օգտատերեր, կապեր, բովանդակություն և SEO։</p></div></div>
        </div>
      </div>
    </div></section>
    <section class="page"><div class="wrap">
      <h2>Բժիշկներ մոտակա ժամով</h2>
      <div class="grid grid-4" style="margin-top:16px">${cards}</div>
      <div class="grid grid-3" style="margin-top:28px">
        <a class="card feature" href="/map"><h3>Քարտեզ</h3><p>Կլինիկաներ, դեղատներ, լաբորատորիա։</p></a>
        <a class="card feature" href="/medicines"><h3>Դեղեր</h3><p>Ընթեռնելի նկարագրեր, ոչ թե դեղատոմս։</p></a>
        <a class="card feature" href="/articles"><h3>Հոդվածներ</h3><p>Կարճ էսսեներ առանձին հասցեով։</p></a>
      </div>
    </div></section>`
  }));
});

app.get("/doctors", (req, res) => {
  const q = String(req.query.q || "").trim();
  const spec = String(req.query.spec || "");
  const specs = db.prepare("SELECT DISTINCT specialty FROM doctor_profiles ORDER BY specialty").all();
  let sql = "SELECT * FROM doctor_profiles WHERE 1=1";
  const args = [];
  if (spec) { sql += " AND specialty = ?"; args.push(spec); }
  if (q) { sql += " AND (name LIKE ? OR clinic LIKE ? OR focus LIKE ?)"; args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  sql += " ORDER BY name";
  const list = db.prepare(sql).all(...args);
  const chips = [`<a class="chip ${spec ? "" : "active"}" href="/doctors">Բոլորը</a>`]
    .concat(specs.map(s => `<a class="chip ${s.specialty === spec ? "active" : ""}" href="/doctors?spec=${encodeURIComponent(s.specialty)}">${esc(s.specialty)}</a>`)).join("");
  const cards = list.map(d => `
    <article class="card doc-card">
      <div class="doc-top">${photoTag(d)}
        <div>
          <h2 style="font-size:1.2rem"><a href="/doctors/${esc(d.slug)}">${esc(d.name)}</a></h2>
          <p><span class="badge">${esc(d.specialty)}</span></p>
        </div>
      </div>
      <p class="muted">${esc(d.focus)} · ${esc(d.clinic)}</p>
      <p class="meta">${d.rating} · ${d.years} տարի · ${esc(d.next_slot)}</p>
    </article>`).join("") || `<p class="card empty">Ոչինչ չի գտնվել։</p>`;
  res.send(renderPage(req, {
    title: "Բժիշկներ",
    description: `Բժիշկների ցանկ ${setting("city")}-ում. մասնագիտություն, կլինիկա և մոտակա ժամ։`,
    path: "/doctors",
    jsonLd: [crumbs(req, [{ name: "Գլխավոր", path: "/" }, { name: "Բժիշկներ", path: "/doctors" }])],
    body: `<section class="page"><div class="wrap">
      <p class="eyebrow">Ցանկ</p><h1>Բժիշկներ</h1>
      <form class="toolbar" method="get" action="/doctors" style="margin-top:16px">
        <div class="search"><input name="q" value="${esc(q)}" placeholder="Անուն կամ կլինիկա" /></div>
        <button class="btn btn-primary" type="submit">Փնտրել</button>
      </form>
      <div class="chips">${chips}</div>
      <div class="grid grid-3" style="margin-top:18px">${cards}</div>
    </div></section>`
  }));
});

app.get("/doctors/:slug", (req, res) => {
  const d = db.prepare("SELECT * FROM doctor_profiles WHERE slug = ?").get(req.params.slug);
  if (!d) return res.status(404).send(notFound(req));
  const user = req.session.user;
  let action = `<p class="disclaimer">Կապ հաստատելու համար <a href="/login">մտեք</a> որպես պացիենտ։</p>`;
  if (user?.role === "patient") {
    const link = db.prepare("SELECT status FROM care_links WHERE patient_id = ? AND doctor_id = ?").get(user.id, d.id);
    if (link) action = `<p class="badge">Կապի կարգավիճակ՝ ${esc(link.status)}</p>`;
    else action = `<form method="post" action="/cabinet/link">${csrfField(req)}<input type="hidden" name="doctor_id" value="${d.id}" /><button class="btn btn-primary" type="submit">Խնդրել կապ</button></form>`;
  }
  res.send(renderPage(req, {
    title: `${d.name} · ${d.specialty}`,
    description: `${d.name}, ${d.specialty}, ${d.clinic}. ${d.focus}.`,
    path: `/doctors/${d.slug}`,
    ogType: "profile",
    jsonLd: [
      crumbs(req, [{ name: "Գլխավոր", path: "/" }, { name: "Բժիշկներ", path: "/doctors" }, { name: d.name, path: `/doctors/${d.slug}` }]),
      { "@context": "https://schema.org", "@type": "Physician", name: d.name, medicalSpecialty: d.specialty, description: d.bio, image: d.photo ? origin(req) + d.photo : undefined, url: origin(req) + `/doctors/${d.slug}`, hospitalAffiliation: d.clinic }
    ],
    body: `<article class="page"><div class="wrap" style="max-width:820px">
      <div class="doc-top" style="margin-bottom:16px">${photoTag(d, true)}
        <div>
          <p class="eyebrow">${esc(d.specialty)}</p>
          <h1>${esc(d.name)}</h1>
        </div>
      </div>
      <p class="lede">${esc(d.focus)} · ${esc(d.clinic)}</p>
      ${paragraphs(d.bio)}
      <div class="grid grid-2" style="margin:18px 0">
        <div class="card panel"><strong>Ժամեր</strong><p class="muted">${esc(d.hours)}</p></div>
        <div class="card panel"><strong>Լեզուներ</strong><p class="muted">${esc(d.langs)}</p></div>
      </div>
      ${action}
    </div></article>`
  }));
});

app.get("/map", (req, res) => {
  const places = db.prepare("SELECT id, name, type, lat, lng, wait, hours, note FROM places WHERE lat IS NOT NULL AND lng IS NOT NULL ORDER BY type, name").all();
  const json = JSON.stringify(places).replace(/</g, "\\u003c");
  res.send(renderPage(req, {
    title: "Բժշկական քարտեզ Երևանում",
    description: "Երևանի հիվանդանոցներ, կլինիկաներ, դեղատներ և լաբորատորիա OpenStreetMap քարտեզի վրա։",
    path: "/map",
    jsonLd: [crumbs(req, [{ name: "Գլխավոր", path: "/" }, { name: "Քարտեզ", path: "/map" }]), {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Բժշկական կետեր Երևանում",
      itemListElement: places.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": p.type === "Դեղատուն" ? "Pharmacy" : "MedicalClinic",
          name: p.name,
          address: p.note,
          geo: { "@type": "GeoCoordinates", latitude: p.lat, longitude: p.lng }
        }
      }))
    }],
    body: `<section class="page"><div class="wrap">
      <p class="eyebrow">Երևան</p>
      <h1>Խնամքի կետերը քաղաքի քարտեզին</h1>
      <p class="lede">OpenStreetMap-ի իրական քարտեզ։ Սեղմեք կետին կամ ցանկի տողին, որպեսզի քարտեզը մոտենա։</p>
      <div class="legend" style="margin-top:14px">
        <span><i style="background:#c24a3b"></i>Հիվանդանոց</span>
        <span><i style="background:#146850"></i>Կլինիկա</span>
        <span><i style="background:#5aa0c4"></i>Դեղատուն</span>
        <span><i style="background:#b8892a"></i>Լաբորատորիա</span>
      </div>
      <div class="chips" id="mapChips" style="margin-bottom:16px"></div>
      <div class="map-layout">
        <div class="map-stage" id="mapStage"></div>
        <div>
          <div class="place-list" id="placeList"></div>
          <div class="card panel" id="placeDetail" style="margin-top:12px"></div>
        </div>
      </div>
      <p class="disclaimer">Քարտեզը © 2ԳԻՍ։ Կետերը հանրային հաստատություններ են, ոչ թե Medverse-ի սեփական կլինիկաներ։</p>
    </div></section>
    <link rel="stylesheet" href="/css/vendor/leaflet.css" />
    <script src="/js/vendor/leaflet.js"></script>
    <script>window.YEREVAN_PLACES = ${json};</script>
    <script src="/js/yerevan-map.js"></script>`
  }));
});

app.get("/medicines", (req, res) => {
  const q = String(req.query.q || "").trim();
  const list = q
    ? db.prepare("SELECT * FROM medicines WHERE name LIKE ? OR cat LIKE ? OR use LIKE ? ORDER BY name").all(`%${q}%`, `%${q}%`, `%${q}%`)
    : db.prepare("SELECT * FROM medicines ORDER BY name").all();
  const cards = list.map(m => `<article class="card med-card"><span class="tag">${esc(m.cat)}</span><h2 style="font-size:1.15rem"><a href="/medicines/${esc(m.slug)}">${esc(m.name)}</a></h2><p>${esc(m.use)}</p></article>`).join("");
  res.send(renderPage(req, {
    title: "Դեղերի ցանկ",
    description: "Դեղերի ուսումնական նկարագրեր. կիրառում, սովորական սխեմա և զգուշացում։",
    path: "/medicines",
    body: `<section class="page"><div class="wrap"><h1>Դեղեր</h1>
      <form class="toolbar" method="get"><div class="search"><input name="q" value="${esc(q)}" placeholder="Փնտրել դեղ" /></div><button class="btn btn-primary">Փնտրել</button></form>
      <div class="grid grid-3">${cards}</div>
      <p class="disclaimer">Սա դեղատոմս չէ։ Դեղաչափը որոշում է բժիշկը։</p>
    </div></section>`
  }));
});

app.get("/medicines/:slug", (req, res) => {
  const m = db.prepare("SELECT * FROM medicines WHERE slug = ?").get(req.params.slug);
  if (!m) return res.status(404).send(notFound(req));
  res.send(renderPage(req, {
    title: m.name,
    description: `${m.name} (${m.generic})՝ ${m.use}`,
    path: `/medicines/${m.slug}`,
    jsonLd: [{ "@context": "https://schema.org", "@type": "Drug", name: m.name, nonProprietaryName: m.generic, description: m.use }],
    body: `<article class="page"><div class="wrap" style="max-width:800px">
      <p class="eyebrow">${esc(m.cat)}</p><h1>${esc(m.name)}</h1>
      <p class="muted">${esc(m.generic)}</p>
      <p style="margin-top:12px">${esc(m.use)}</p>
      <p style="margin-top:10px"><strong>Սովորական սխեմա.</strong> ${esc(m.dose)}</p>
      <div class="warn-box">${esc(m.watch)}</div>
      <p class="disclaimer">Ընդհանուր տեղեկություն, ոչ թե անձնական նշանակում։</p>
    </div></article>`
  }));
});

app.get("/articles", (req, res) => {
  const list = db.prepare("SELECT slug, title, cat, mins, dek FROM articles ORDER BY id").all();
  const cards = list.map(a => `<article class="card article-body"><p class="read">${a.mins} րոպե · ${esc(a.cat)}</p><h2 style="font-size:1.2rem"><a href="/articles/${esc(a.slug)}">${esc(a.title)}</a></h2><p class="muted">${esc(a.dek)}</p></article>`).join("");
  res.send(renderPage(req, {
    title: "Բժշկական հոդվածներ",
    description: "Կարճ բժշկական էսսեներ հայերեն՝ սիրտ, լաբորատորիա, դեղեր, արտակարգ իրավիճակներ։",
    path: "/articles",
    body: `<section class="page"><div class="wrap"><h1>Հոդվածներ</h1><div class="grid grid-3" style="margin-top:16px">${cards}</div></div></section>`
  }));
});

app.get("/articles/:slug", (req, res) => {
  const a = db.prepare("SELECT * FROM articles WHERE slug = ?").get(req.params.slug);
  if (!a) return res.status(404).send(notFound(req));
  res.send(renderPage(req, {
    title: a.title,
    description: a.dek,
    path: `/articles/${a.slug}`,
    ogType: "article",
    jsonLd: [{
      "@context": "https://schema.org",
      "@type": "Article",
      headline: a.title,
      description: a.dek,
      inLanguage: "hy",
      author: { "@type": "Organization", name: setting("site_name") }
    }],
    body: `<article class="page"><div class="wrap" style="max-width:760px">
      <p class="eyebrow">${esc(a.cat)} · ${a.mins} րոպե</p>
      <h1>${esc(a.title)}</h1>
      <p class="lede">${esc(a.dek)}</p>
      ${paragraphs(a.body)}
    </div></article>`
  }));
});

app.get("/emergency", (req, res) => {
  const list = db.prepare("SELECT * FROM emergencies ORDER BY id").all();
  const cards = list.map(e => `<article class="card guide open"><h2 style="font-size:1.15rem">${esc(e.title)}</h2><p class="muted">${esc(e.blurb)}</p><ol>${String(e.steps).split("\n").map(s => `<li>${esc(s)}</li>`).join("")}</ol></article>`).join("");
  res.send(renderPage(req, {
    title: "Արտակարգ ուղեցույց",
    description: "Առաջին օգնության կարճ քայլեր կաթվածի, խեղդման, այրվածքի և այլ սուր դեպքերի համար։ Զանգեք 911։",
    path: "/emergency",
    body: `<section class="page"><div class="wrap">
      <div class="sos-banner"><div><h1>Նախ զանգեք 911։ Հետո կարդացեք։</h1><p>Այս էջը ուսումնական է և չի փոխարինում շտապ օգնությանը։ Զանգը կատակային Pro-պատուհանով է. գումար չի գանձվում։</p></div><button class="btn btn-danger" type="button" data-pro-call>Զանգել 911</button></div>
      <div class="grid grid-2">${cards}</div>
    </div></section>`
  }));
});

app.get("/login", (req, res) => {
  if (req.session.user) return res.redirect("/profile");
  res.send(renderPage(req, {
    title: "Մուտք",
    noindex: true,
    body: `<section class="page"><div class="wrap" style="max-width:480px">
      <h1>Մուտք</h1>
      <form class="card panel form-grid" method="post" action="/login">${csrfField(req)}
        <label>Էլ. փոստ<input name="email" type="email" required /></label>
        <label>Գաղտնաբառ<input name="password" type="password" required /></label>
        <button class="btn btn-primary" type="submit">Մտնել</button>
      </form>
      <p class="disclaimer">Ցուցադրական հաշիվներ՝ admin@medverse.local / Admin123! · patient@medverse.local / Patient123! · okonkwo@medverse.local / Doctor123!</p>
      <p style="margin-top:12px"><a href="/register">Գրանցվել որպես պացիենտ</a></p>
    </div></section>`
  }));
});

app.post("/login", checkCsrf, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(String(req.body.email || "").trim().toLowerCase());
  if (!user || !bcrypt.compareSync(String(req.body.password || ""), user.password_hash)) {
    flash(req, "err", "Էլ. փոստը կամ գաղտնաբառը սխալ է։");
    return res.redirect("/login");
  }
  req.session.user = { id: user.id, role: user.role, name: user.name, email: user.email };
  res.redirect("/profile");
});

app.get("/register", (req, res) => {
  if (req.session.user) return res.redirect("/profile");
  res.send(renderPage(req, {
    title: "Գրանցում",
    noindex: true,
    body: `<section class="page"><div class="wrap" style="max-width:480px">
      <h1>Պացիենտի հաշիվ</h1>
      <form class="card panel form-grid" method="post" action="/register">${csrfField(req)}
        <label>Անուն<input name="name" required /></label>
        <label>Էլ. փոստ<input name="email" type="email" required /></label>
        <label>Հեռախոս<input name="phone" /></label>
        <label>Գաղտնաբառ<input name="password" type="password" minlength="8" required /></label>
        <button class="btn btn-primary" type="submit">Ստեղծել հաշիվ</button>
      </form>
    </div></section>`
  }));
});

app.post("/register", checkCsrf, (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const phone = String(req.body.phone || "").trim();
  const password = String(req.body.password || "");
  if (name.length < 2 || password.length < 8 || !email.includes("@")) {
    flash(req, "err", "Լրացրեք անունը և առնվազն 8 նիշ գաղտնաբառ։");
    return res.redirect("/register");
  }
  try {
    const row = db.prepare("INSERT INTO users (email, password_hash, role, name, phone) VALUES (?,?, 'patient', ?, ?)").run(email, bcrypt.hashSync(password, 10), name, phone);
    req.session.user = { id: Number(row.lastInsertRowid), role: "patient", name, email };
    res.redirect("/profile");
  } catch {
    flash(req, "err", "Այս էլ. փոստն արդեն գրանցված է։");
    res.redirect("/register");
  }
});

app.post("/logout", requireUser, checkCsrf, (req, res) => {
  const next = req.body.next === "login" ? "/login" : "/";
  req.session = null;
  res.redirect(next);
});

const ROLE_LABEL = { patient: "Պացիենտ", doctor: "Բժիշկ", admin: "Ադմին" };
const VISIT_STATUS = { requested: "Սպասում է", confirmed: "Հաստատված", done: "Կատարված", cancelled: "Չեղարկված" };

function yerevanHour() {
  return Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Yerevan", hour: "numeric", hour12: false }));
}

function greeting() {
  const hour = yerevanHour();
  if (hour < 12) return "Բարի առավոտ";
  if (hour < 18) return "Բարի օր";
  return "Բարի երեկո";
}

function monogram(name) {
  const parts = String(name || "").trim().split(/\s+/);
  return esc((parts[0]?.[0] || "") + (parts[1]?.[0] || ""));
}

function profileSnapshot(user) {
  if (user.role === "doctor") {
    const doctor = db.prepare("SELECT * FROM doctor_profiles WHERE user_id = ?").get(user.id);
    const patients = doctor ? db.prepare("SELECT COUNT(*) AS n FROM care_links WHERE doctor_id = ? AND status = 'active'").get(doctor.id).n : 0;
    const waiting = doctor ? db.prepare("SELECT COUNT(*) AS n FROM care_links WHERE doctor_id = ? AND status = 'pending'").get(doctor.id).n : 0;
    const visits = doctor ? db.prepare(`SELECT a.at, a.reason, a.status, u.name AS who FROM appointments a JOIN users u ON u.id = a.patient_id WHERE a.doctor_id = ? ORDER BY a.at DESC LIMIT 4`).all(doctor.id) : [];
    const visitCount = doctor ? db.prepare("SELECT COUNT(*) AS n FROM appointments WHERE doctor_id = ?").get(doctor.id).n : 0;
    return {
      doctor,
      kpis: [
        ["Պացիենտ", patients],
        ["Սպասող կապ", waiting],
        ["Այց", visitCount]
      ],
      events: visits.map(v => ({ title: v.who, meta: `${v.at} · ${VISIT_STATUS[v.status] || v.status}`, note: v.reason })),
      empty: "Այցեր դեռ չկան։ Հաստատեք կապը կաբինետից։"
    };
  }
  if (user.role === "admin") {
    const users = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
    const doctors = db.prepare("SELECT COUNT(*) AS n FROM doctor_profiles").get().n;
    const links = db.prepare("SELECT COUNT(*) AS n FROM care_links WHERE status = 'active'").get().n;
    const latest = db.prepare("SELECT name, role, created_at FROM users ORDER BY id DESC LIMIT 4").all();
    return {
      doctor: null,
      kpis: [
        ["Օգտատեր", users],
        ["Բժիշկ", doctors],
        ["Ակտիվ կապ", links]
      ],
      events: latest.map(u => ({ title: u.name, meta: `${ROLE_LABEL[u.role] || u.role} · ${u.created_at || ""}`, note: "Նոր հաշիվ" })),
      empty: "Օգտատերեր դեռ չկան։"
    };
  }
  const doctors = db.prepare("SELECT COUNT(*) AS n FROM care_links WHERE patient_id = ? AND status = 'active'").get(user.id).n;
  const notes = db.prepare("SELECT COUNT(*) AS n FROM journal_entries WHERE patient_id = ?").get(user.id).n;
  const labs = db.prepare("SELECT COUNT(*) AS n FROM lab_results WHERE patient_id = ?").get(user.id).n;
  const visitCount = db.prepare("SELECT COUNT(*) AS n FROM appointments WHERE patient_id = ?").get(user.id).n;
  const visits = db.prepare(`SELECT a.at, a.reason, a.status, d.name AS who FROM appointments a JOIN doctor_profiles d ON d.id = a.doctor_id WHERE a.patient_id = ? ORDER BY a.at DESC LIMIT 4`).all(user.id);
  const journal = db.prepare("SELECT title, mood, created_at FROM journal_entries WHERE patient_id = ? ORDER BY id DESC LIMIT 2").all(user.id);
  return {
    doctor: null,
    kpis: [
      ["Բժիշկ", doctors],
      ["Այց", visitCount],
      ["Օրագիր", notes],
      ["Անալիզ", labs]
    ],
    events: [
      ...visits.map(v => ({ title: v.who, meta: `${v.at} · ${VISIT_STATUS[v.status] || v.status}`, note: v.reason })),
      ...journal.map(j => ({ title: j.title, meta: j.created_at || "", note: j.mood || "Օրագրի գրառում" }))
    ].slice(0, 5),
    empty: "Դեռ շարժում չկա։ Գտեք բժիշկ և գրեք առաջին նշումը։"
  };
}

app.get("/profile", requireUser, (req, res) => {
  const user = db.prepare("SELECT id, email, role, name, phone, created_at FROM users WHERE id = ?").get(req.session.user.id);
  if (!user) {
    req.session = null;
    res.redirect("/login");
    return;
  }
  const snap = profileSnapshot(user);
  const face = snap.doctor?.photo
    ? photoTag({ photo: snap.doctor.photo, name: user.name }, true)
    : `<div class="avatar lg mono">${monogram(user.name)}</div>`;
  const line = snap.doctor
    ? `${esc(snap.doctor.specialty || "")} · ${esc(snap.doctor.clinic || "")}`
    : esc(user.email);
  const events = snap.events.length
    ? snap.events.map(e => `<div class="time-item"><i></i><div><strong>${esc(e.title)}</strong><p class="muted">${esc(e.meta)}</p><p>${esc(e.note || "")}</p></div></div>`).join("")
    : `<p class="muted">${esc(snap.empty)}</p>`;
  res.send(renderPage(req, {
    title: "Պրոֆիլ",
    noindex: true,
    body: `<section class="page"><div class="wrap profile-grid">
      <div>
        <header class="profile-hero">
          <div class="profile-live"><span class="pulse"></span><span id="liveClock">Երևան</span></div>
          <div class="doc-top">
            ${face}
            <div>
              <p class="eyebrow">${greeting()} · ${esc(ROLE_LABEL[user.role] || user.role)}</p>
              <h1>${esc(user.name)}</h1>
              <p class="muted">${line}</p>
            </div>
          </div>
          <div class="hero-actions" style="margin-top:22px; position:relative; z-index:1">
            <a class="btn btn-primary" href="/cabinet">Կաբինետ</a>
            ${snap.doctor ? `<a class="btn btn-ghost" href="/doctors/${esc(snap.doctor.slug)}">Հանրային էջ</a>` : `<a class="btn btn-ghost" href="/doctors">Գտնել բժիշկ</a>`}
            <form method="post" action="/logout">${csrfField(req)}<button class="btn btn-ghost" type="submit">Դուրս գալ</button></form>
          </div>
        </header>
        <div class="kpi-row" style="margin-top:14px">
          ${snap.kpis.map(([label, n]) => `<article class="card kpi"><span class="muted">${esc(label)}</span><b>${n}</b></article>`).join("")}
        </div>
        <section class="card panel" style="margin-top:14px">
          <p class="eyebrow">Հիմա</p>
          <h2 style="font-size:1.6rem">Ինչ է շարժվում հաշվում</h2>
          <div class="timeline">${events}</div>
        </section>
      </div>
      <div>
      <form class="card panel form-grid" method="post" action="/profile">${csrfField(req)}
        <p class="eyebrow">Հաշիվ</p>
        <h2 style="font-size:1.5rem">Թարմացնել</h2>
        <label>Անուն<input name="name" value="${esc(user.name)}" required /></label>
        <label>Էլ. փոստ<input name="email" type="email" value="${esc(user.email)}" required /></label>
        <label>Հեռախոս<input name="phone" value="${esc(user.phone || "")}" placeholder="+374" /></label>
        <label>Նոր գաղտնաբառ<input name="password" type="password" minlength="8" placeholder="Միայն եթե փոխում եք" /></label>
        <button class="btn btn-primary" type="submit">Պահել</button>
        <p class="muted">Հաշիվը բացվել է ${esc(String(user.created_at || "").slice(0, 16))}։</p>
      </form>
      <form method="post" action="/logout" style="margin-top:10px">${csrfField(req)}<input type="hidden" name="next" value="login" /><button class="btn btn-ghost" type="submit">Մտնել այլ հաշիվ</button></form>
      </div>
    </div></section>
    <script>
      (function () {
        const el = document.getElementById("liveClock");
        if (!el) return;
        const fmt = new Intl.DateTimeFormat("hy-AM", { timeZone: "Asia/Yerevan", weekday: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const tick = () => { el.textContent = "Երևան · " + fmt.format(new Date()); };
        tick();
        setInterval(tick, 1000);
      })();
    </script>`
  }));
});

app.post("/profile", requireUser, checkCsrf, (req, res) => {
  const id = req.session.user.id;
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const phone = String(req.body.phone || "").trim();
  const password = String(req.body.password || "");
  if (name.length < 2 || !email.includes("@")) {
    flash(req, "err", "Անունը և էլ. փոստը պարտադիր են։");
    return res.redirect("/profile");
  }
  const taken = db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(email, id);
  if (taken) {
    flash(req, "err", "Այս էլ. փոստն արդեն զբաղված է։");
    return res.redirect("/profile");
  }
  if (password && password.length < 8) {
    flash(req, "err", "Նոր գաղտնաբառը առնվազն 8 նիշ։");
    return res.redirect("/profile");
  }
  if (password) {
    db.prepare("UPDATE users SET name = ?, email = ?, phone = ?, password_hash = ? WHERE id = ?")
      .run(name, email, phone, bcrypt.hashSync(password, 10), id);
  } else {
    db.prepare("UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?").run(name, email, phone, id);
  }
  if (req.session.user.role === "doctor") {
    db.prepare("UPDATE doctor_profiles SET name = ? WHERE user_id = ?").run(name, id);
  }
  req.session.user = { ...req.session.user, name, email };
  flash(req, "ok", "Պրոֆիլը պահվեց։");
  res.redirect("/profile");
});

app.post("/cabinet/link", requireRole("patient"), checkCsrf, (req, res) => {
  const doctorId = Number(req.body.doctor_id);
  const doc = db.prepare("SELECT id FROM doctor_profiles WHERE id = ?").get(doctorId);
  if (!doc) return res.redirect("/doctors");
  db.prepare("INSERT OR IGNORE INTO care_links (patient_id, doctor_id, status) VALUES (?, ?, 'pending')").run(req.session.user.id, doctorId);
  flash(req, "ok", "Կապի հարցումն ուղարկվեց բժշկին։");
  res.redirect("/cabinet?tab=doctors");
});

app.post("/cabinet/appointment", requireRole("patient"), checkCsrf, (req, res) => {
  const doctorId = Number(req.body.doctor_id);
  const link = db.prepare("SELECT id FROM care_links WHERE patient_id = ? AND doctor_id = ? AND status = 'active'").get(req.session.user.id, doctorId);
  if (!link) {
    flash(req, "err", "Այց կարելի է խնդրել միայն ակտիվ բժշկից։");
    return res.redirect("/cabinet?tab=visits");
  }
  const at = String(req.body.at || "").trim();
  const reason = String(req.body.reason || "").trim().slice(0, 300);
  if (!at) return res.redirect("/cabinet?tab=visits");
  db.prepare("INSERT INTO appointments (patient_id, doctor_id, at, reason, status) VALUES (?,?,?,?, 'requested')").run(req.session.user.id, doctorId, at, reason);
  flash(req, "ok", "Այցի հարցումն ուղարկվեց։");
  res.redirect("/cabinet?tab=visits");
});

app.post("/cabinet/journal", requireRole("patient"), checkCsrf, (req, res) => {
  const title = String(req.body.title || "").trim();
  const body = String(req.body.body || "").trim();
  const mood = String(req.body.mood || "").slice(0, 8);
  if (title && body) {
    db.prepare("INSERT INTO journal_entries (patient_id, mood, title, body) VALUES (?,?,?,?)").run(req.session.user.id, mood, title, body);
  }
  res.redirect("/cabinet?tab=journal");
});

app.post("/cabinet/journal/delete", requireRole("patient"), checkCsrf, (req, res) => {
  db.prepare("DELETE FROM journal_entries WHERE id = ? AND patient_id = ?").run(Number(req.body.id), req.session.user.id);
  res.redirect("/cabinet?tab=journal");
});

app.post("/cabinet/profile", requireRole("doctor"), checkCsrf, (req, res) => {
  const profile = db.prepare("SELECT id FROM doctor_profiles WHERE user_id = ?").get(req.session.user.id);
  if (!profile) return res.redirect("/cabinet");
  db.prepare("UPDATE doctor_profiles SET focus=?, clinic=?, bio=?, hours=?, next_slot=?, langs=? WHERE id=?").run(
    String(req.body.focus || "").slice(0, 120),
    String(req.body.clinic || "").slice(0, 120),
    String(req.body.bio || "").slice(0, 2000),
    String(req.body.hours || "").slice(0, 120),
    String(req.body.next_slot || "").slice(0, 80),
    String(req.body.langs || "").slice(0, 160),
    profile.id
  );
  flash(req, "ok", "Պրոֆիլը թարմացվեց։");
  res.redirect("/cabinet?tab=profile");
});

app.post("/cabinet/appointment/status", requireRole("doctor", "admin"), checkCsrf, (req, res) => {
  const id = Number(req.body.id);
  const status = String(req.body.status || "");
  if (!["confirmed", "done", "cancelled", "requested"].includes(status)) return res.redirect("/cabinet?tab=visits");
  if (req.session.user.role === "doctor") {
    const profile = db.prepare("SELECT id FROM doctor_profiles WHERE user_id = ?").get(req.session.user.id);
    db.prepare("UPDATE appointments SET status = ? WHERE id = ? AND doctor_id = ?").run(status, id, profile?.id || 0);
  } else {
    db.prepare("UPDATE appointments SET status = ? WHERE id = ?").run(status, id);
  }
  res.redirect("/cabinet?tab=visits");
});

app.post("/cabinet/link/status", requireRole("doctor", "admin"), checkCsrf, (req, res) => {
  const id = Number(req.body.id);
  const status = String(req.body.status || "");
  if (!["active", "declined", "pending"].includes(status)) return res.redirect("/cabinet");
  if (req.session.user.role === "doctor") {
    const profile = db.prepare("SELECT id FROM doctor_profiles WHERE user_id = ?").get(req.session.user.id);
    db.prepare("UPDATE care_links SET status = ? WHERE id = ? AND doctor_id = ?").run(status, id, profile?.id || 0);
  } else {
    db.prepare("UPDATE care_links SET status = ? WHERE id = ?").run(status, id);
  }
  res.redirect("/cabinet?tab=links");
});

app.post("/admin/user", requireRole("admin"), checkCsrf, (req, res) => {
  const role = String(req.body.role || "");
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!["patient", "doctor", "admin"].includes(role) || password.length < 8 || !name) {
    flash(req, "err", "Ստուգեք դերը, անունը և գաղտնաբառը (8+ նիշ)։");
    return res.redirect("/cabinet?tab=users");
  }
  try {
    const row = db.prepare("INSERT INTO users (email, password_hash, role, name, phone) VALUES (?,?,?,?,?)").run(email, bcrypt.hashSync(password, 10), role, name, "");
    if (role === "doctor") {
      const slug = email.split("@")[0].replace(/[^a-z0-9]+/gi, "-").toLowerCase() || `doc-${row.lastInsertRowid}`;
      db.prepare("INSERT INTO doctor_profiles (user_id, slug, name, specialty, focus, clinic, bio, hours, langs, rating, years, next_slot) VALUES (?,?,?,?,?,?,?,?,?,0,0,?)")
        .run(Number(row.lastInsertRowid), slug, name, "Թերապիա", "", "", "", "", "", "Ըստ պայմանավորվածության");
    }
    flash(req, "ok", "Օգտատերը ստեղծվեց։");
  } catch {
    flash(req, "err", "Էլ. փոստը զբաղված է կամ տվյալները թերի են։");
  }
  res.redirect("/cabinet?tab=users");
});

app.post("/admin/user/delete", requireRole("admin"), checkCsrf, (req, res) => {
  const id = Number(req.body.id);
  if (id === req.session.user.id) {
    flash(req, "err", "Սեփական ադմին հաշիվը չի ջնջվում։");
    return res.redirect("/cabinet?tab=users");
  }
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  flash(req, "ok", "Օգտատերը ջնջվեց։");
  res.redirect("/cabinet?tab=users");
});

app.post("/admin/link", requireRole("admin"), checkCsrf, (req, res) => {
  db.prepare("INSERT INTO care_links (patient_id, doctor_id, status) VALUES (?,?, 'active') ON CONFLICT(patient_id, doctor_id) DO UPDATE SET status = 'active'")
    .run(Number(req.body.patient_id), Number(req.body.doctor_id));
  flash(req, "ok", "Բժիշկն ու պացիենտը կապվեցին։");
  res.redirect("/cabinet?tab=links");
});

app.post("/admin/lab", requireRole("admin"), checkCsrf, (req, res) => {
  db.prepare("INSERT INTO lab_results (patient_id, name, value, unit, low, high, drawn_at) VALUES (?,?,?,?,?,?, date('now'))")
    .run(Number(req.body.patient_id), String(req.body.name || "").slice(0, 80), String(req.body.value || "").slice(0, 40), String(req.body.unit || "").slice(0, 20), Number(req.body.low), Number(req.body.high));
  flash(req, "ok", "Անալիզը ավելացվեց։");
  res.redirect("/cabinet?tab=labs");
});

app.post("/admin/medicine", requireRole("admin"), checkCsrf, (req, res) => {
  const slug = slugify(req.body.slug || req.body.name);
  db.prepare("INSERT INTO medicines (slug, name, generic, cat, use, dose, watch) VALUES (?,?,?,?,?,?,?) ON CONFLICT(slug) DO UPDATE SET name=excluded.name, generic=excluded.generic, cat=excluded.cat, use=excluded.use, dose=excluded.dose, watch=excluded.watch")
    .run(slug, req.body.name, req.body.generic || "", req.body.cat || "", req.body.use || "", req.body.dose || "", req.body.watch || "");
  res.redirect("/cabinet?tab=medicines");
});

app.post("/admin/medicine/delete", requireRole("admin"), checkCsrf, (req, res) => {
  db.prepare("DELETE FROM medicines WHERE id = ?").run(Number(req.body.id));
  res.redirect("/cabinet?tab=medicines");
});

app.post("/admin/article", requireRole("admin"), checkCsrf, (req, res) => {
  const slug = slugify(req.body.slug || req.body.title);
  db.prepare("INSERT INTO articles (slug, title, cat, mins, dek, body, cover) VALUES (?,?,?,?,?,?,?) ON CONFLICT(slug) DO UPDATE SET title=excluded.title, cat=excluded.cat, mins=excluded.mins, dek=excluded.dek, body=excluded.body")
    .run(slug, req.body.title, req.body.cat || "", Number(req.body.mins) || 5, req.body.dek || "", req.body.body || "", "linear-gradient(135deg,#0f4d3a,#5aa0c4)");
  res.redirect("/cabinet?tab=articles");
});

app.post("/admin/article/delete", requireRole("admin"), checkCsrf, (req, res) => {
  db.prepare("DELETE FROM articles WHERE id = ?").run(Number(req.body.id));
  res.redirect("/cabinet?tab=articles");
});

app.post("/admin/place", requireRole("admin"), checkCsrf, (req, res) => {
  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);
  db.prepare("INSERT INTO places (name, type, x, y, lat, lng, wait, hours, note) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(req.body.name, req.body.type || "Կլինիկա", lng, lat, lat, lng, req.body.wait || "", req.body.hours || "", req.body.note || "");
  res.redirect("/cabinet?tab=places");
});

app.post("/admin/place/delete", requireRole("admin"), checkCsrf, (req, res) => {
  db.prepare("DELETE FROM places WHERE id = ?").run(Number(req.body.id));
  res.redirect("/cabinet?tab=places");
});

app.post("/admin/emergency", requireRole("admin"), checkCsrf, (req, res) => {
  db.prepare("INSERT INTO emergencies (title, severity, blurb, steps) VALUES (?,?,?,?)")
    .run(req.body.title, ["call", "urgent", "self"].includes(req.body.severity) ? req.body.severity : "self", req.body.blurb || "", req.body.steps || "");
  res.redirect("/cabinet?tab=emergency");
});

app.post("/admin/emergency/delete", requireRole("admin"), checkCsrf, (req, res) => {
  db.prepare("DELETE FROM emergencies WHERE id = ?").run(Number(req.body.id));
  res.redirect("/cabinet?tab=emergency");
});

app.post("/admin/seo", requireRole("admin"), checkCsrf, (req, res) => {
  const upsert = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  for (const key of ["site_name", "description", "city"]) {
    upsert.run(key, String(req.body[key] || "").slice(0, 300));
  }
  flash(req, "ok", "SEO կարգավորումները պահվեցին և երևում են հանրային էջերում։");
  res.redirect("/cabinet?tab=seo");
});

app.get("/cabinet", requireUser, (req, res) => {
  const role = req.session.user.role;
  const tab = String(req.query.tab || "overview");
  if (role === "patient") return res.send(patientCabinet(req, tab));
  if (role === "doctor") return res.send(doctorCabinet(req, tab));
  return res.send(adminCabinet(req, tab));
});

function shell(req, title, links, active, inner) {
  const nav = links.map(([id, label]) => `<a class="${active === id ? "active" : ""}" href="/cabinet?tab=${id}">${label}</a>`).join("");
  return renderPage(req, {
    title,
    noindex: true,
    body: `<section class="page"><div class="wrap dash">
      <aside class="card side">
        <strong style="padding:8px 12px">${esc(req.session.user.name)}</strong>
        ${nav}
        <form method="post" action="/logout">${csrfField(req)}<button class="btn btn-ghost btn-sm" type="submit">Դուրս գալ</button></form>
      </aside>
      <div class="dash-main">${inner}</div>
    </div></section>`
  });
}

function patientCabinet(req, tab) {
  const id = req.session.user.id;
  const links = [["overview", "Ամփոփում"], ["doctors", "Իմ բժիշկները"], ["visits", "Այցեր"], ["labs", "Անալիզներ"], ["journal", "Օրագիր"]];
  let inner = "";
  if (tab === "doctors") {
    const rows = db.prepare(`SELECT l.status, d.name, d.specialty, d.slug FROM care_links l JOIN doctor_profiles d ON d.id = l.doctor_id WHERE l.patient_id = ?`).all(id);
    inner = `<h1>Իմ բժիշկները</h1>` + (rows.map(r => `<article class="card panel"><a href="/doctors/${esc(r.slug)}"><strong>${esc(r.name)}</strong></a><p class="muted">${esc(r.specialty)} · ${esc(r.status)}</p></article>`).join("") || `<p class="muted">Դեռ կապ չկա։ Բացեք բժշկի էջը և խնդրեք կապ։</p>`);
  } else if (tab === "visits") {
    const docs = db.prepare(`SELECT d.id, d.name FROM care_links l JOIN doctor_profiles d ON d.id = l.doctor_id WHERE l.patient_id = ? AND l.status = 'active'`).all(id);
    const visits = db.prepare(`SELECT a.at, a.reason, a.status, d.name FROM appointments a JOIN doctor_profiles d ON d.id = a.doctor_id WHERE a.patient_id = ? ORDER BY a.at`).all(id);
    inner = `<h1>Այցեր</h1>
      <form class="card panel form-grid" method="post" action="/cabinet/appointment">${csrfField(req)}
        <label>Բժիշկ<select name="doctor_id">${docs.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join("")}</select></label>
        <label>Օր և ժամ<input name="at" required placeholder="2026-10-20 11:00" /></label>
        <label>Պատճառ<input name="reason" /></label>
        <button class="btn btn-primary" type="submit">Խնդրել այց</button>
      </form>
      <div style="margin-top:14px">${visits.map(v => `<article class="card panel"><strong>${esc(v.name)}</strong><p>${esc(v.at)} · ${esc(v.status)}</p><p class="muted">${esc(v.reason)}</p></article>`).join("")}</div>`;
  } else if (tab === "labs") {
    const labs = db.prepare("SELECT * FROM lab_results WHERE patient_id = ? ORDER BY name").all(id);
    inner = `<h1>Իմ անալիզները</h1><table class="data"><tr><th>Թեստ</th><th>Արդյունք</th><th>Նորմա</th><th>Ամսաթիվ</th></tr>
      ${labs.map(l => `<tr><td>${esc(l.name)}</td><td>${esc(l.value)} ${esc(l.unit)}</td><td>${l.low}–${l.high}</td><td>${esc(l.drawn_at)}</td></tr>`).join("")}</table>`;
  } else if (tab === "journal") {
    const notes = db.prepare("SELECT * FROM journal_entries WHERE patient_id = ? ORDER BY id DESC").all(id);
    inner = `<h1>Օրագիր</h1>
      <form class="card panel form-grid" method="post" action="/cabinet/journal">${csrfField(req)}
        <input name="mood" placeholder="Տրամադրություն" />
        <input name="title" required placeholder="Վերնագիր" />
        <textarea name="body" required rows="4" placeholder="Նշում"></textarea>
        <button class="btn btn-primary" type="submit">Պահել</button>
      </form>
      ${notes.map(n => `<article class="card panel"><strong>${esc(n.title)}</strong> ${esc(n.mood)}<p class="muted">${esc(n.body)}</p>
        <form method="post" action="/cabinet/journal/delete">${csrfField(req)}<input type="hidden" name="id" value="${n.id}" /><button class="btn btn-ghost btn-sm">Ջնջել</button></form></article>`).join("")}`;
  } else {
    const nDoc = db.prepare("SELECT COUNT(*) AS n FROM care_links WHERE patient_id = ? AND status = 'active'").get(id).n;
    const nVis = db.prepare("SELECT COUNT(*) AS n FROM appointments WHERE patient_id = ? AND status != 'cancelled'").get(id).n;
    inner = `<h1>Բարև, ${esc(req.session.user.name)}</h1><p class="lede">Ձեր պացիենտի կաբինետը։ Բժիշկները տեսնում են միայն ձեզ հետ կապված այցերը։</p>
      <div class="grid grid-2" style="margin-top:16px"><div class="card kpi"><span class="muted">Ակտիվ բժիշկ</span><b>${nDoc}</b></div><div class="card kpi"><span class="muted">Այց</span><b>${nVis}</b></div></div>`;
  }
  return shell(req, "Պացիենտի կաբինետ", links, tab, inner);
}

function doctorCabinet(req, tab) {
  const profile = db.prepare("SELECT * FROM doctor_profiles WHERE user_id = ?").get(req.session.user.id);
  const links = [["overview", "Ամփոփում"], ["links", "Պացիենտներ"], ["visits", "Այցեր"], ["profile", "Պրոֆիլ"]];
  if (!profile) return shell(req, "Բժիշկ", links, tab, `<h1>Պրոֆիլ չկա</h1><p>Ադմինը դեռ չի կապել բժշկական քարտը այս հաշվին։</p>`);
  let inner = "";
  if (tab === "links") {
    const rows = db.prepare(`SELECT l.id, l.status, u.name, u.email FROM care_links l JOIN users u ON u.id = l.patient_id WHERE l.doctor_id = ?`).all(profile.id);
    inner = `<h1>Իմ պացիենտները</h1>` + rows.map(r => `<article class="card panel inline"><div><strong>${esc(r.name)}</strong><p class="muted">${esc(r.email)} · ${esc(r.status)}</p></div>
      <form method="post" action="/cabinet/link/status">${csrfField(req)}<input type="hidden" name="id" value="${r.id}" />
        <button class="btn btn-primary btn-sm" name="status" value="active">Ընդունել</button>
        <button class="btn btn-ghost btn-sm" name="status" value="declined">Մերժել</button>
      </form></article>`).join("");
  } else if (tab === "visits") {
    const rows = db.prepare(`SELECT a.id, a.at, a.reason, a.status, u.name FROM appointments a JOIN users u ON u.id = a.patient_id WHERE a.doctor_id = ? ORDER BY a.at`).all(profile.id);
    inner = `<h1>Այցեր</h1>` + rows.map(r => `<article class="card panel"><strong>${esc(r.name)}</strong> · ${esc(r.at)} · ${esc(r.status)}<p class="muted">${esc(r.reason)}</p>
      <form method="post" action="/cabinet/appointment/status">${csrfField(req)}<input type="hidden" name="id" value="${r.id}" />
        <button class="btn btn-primary btn-sm" name="status" value="confirmed">Հաստատել</button>
        <button class="btn btn-ghost btn-sm" name="status" value="done">Կատարված</button>
        <button class="btn btn-ghost btn-sm" name="status" value="cancelled">Չեղարկել</button>
      </form></article>`).join("");
  } else if (tab === "profile") {
    inner = `<h1>Հանրային պրոֆիլ</h1>
      <form class="card panel form-grid" method="post" action="/cabinet/profile">${csrfField(req)}
        <label>Ուղղություն<input name="focus" value="${esc(profile.focus)}" /></label>
        <label>Կլինիկա<input name="clinic" value="${esc(profile.clinic)}" /></label>
        <label>Ժամեր<input name="hours" value="${esc(profile.hours)}" /></label>
        <label>Մոտակա ժամ<input name="next_slot" value="${esc(profile.next_slot)}" /></label>
        <label>Լեզուներ<input name="langs" value="${esc(profile.langs)}" /></label>
        <label>Նկարագիր<textarea name="bio" rows="5">${esc(profile.bio)}</textarea></label>
        <button class="btn btn-primary" type="submit">Պահել</button>
      </form>
      <p class="muted" style="margin-top:8px">Էջը՝ <a href="/doctors/${esc(profile.slug)}">/doctors/${esc(profile.slug)}</a></p>`;
  } else {
    const n = db.prepare("SELECT COUNT(*) AS n FROM care_links WHERE doctor_id = ? AND status = 'active'").get(profile.id).n;
    inner = `<h1>${esc(profile.name)}</h1><p class="lede">${esc(profile.specialty)}. Ակտիվ պացիենտներ՝ ${n}։</p>`;
  }
  return shell(req, "Բժշկի կաբինետ", links, tab, inner);
}

function adminCabinet(req, tab) {
  const links = [["overview", "Ամփոփում"], ["users", "Օգտատերեր"], ["links", "Կապեր"], ["visits", "Այցեր"], ["labs", "Անալիզներ"], ["places", "Քարտեզ"], ["medicines", "Դեղեր"], ["articles", "Հոդվածներ"], ["emergency", "Արտակարգ"], ["seo", "SEO"]];
  const s = settingsMap();
  let inner = "";
  if (tab === "users") {
    const users = db.prepare("SELECT id, name, email, role FROM users ORDER BY id").all();
    inner = `<h1>Օգտատերեր</h1>
      <form class="card panel form-grid" method="post" action="/admin/user">${csrfField(req)}
        <input name="name" placeholder="Անուն" required />
        <input name="email" type="email" placeholder="Էլ. փոստ" required />
        <input name="password" type="text" placeholder="Գաղտնաբառ" required />
        <select name="role"><option value="patient">Պացիենտ</option><option value="doctor">Բժիշկ</option><option value="admin">Ադմին</option></select>
        <button class="btn btn-primary" type="submit">Ստեղծել</button>
      </form>
      <table class="data" style="margin-top:14px"><tr><th>Անուն</th><th>Դեր</th><th></th></tr>
      ${users.map(u => `<tr><td>${esc(u.name)}<br><span class="muted">${esc(u.email)}</span></td><td>${esc(u.role)}</td><td>
        <form method="post" action="/admin/user/delete">${csrfField(req)}<input type="hidden" name="id" value="${u.id}" /><button class="btn btn-ghost btn-sm">Ջնջել</button></form></td></tr>`).join("")}
      </table>`;
  } else if (tab === "links") {
    const patients = db.prepare("SELECT id, name FROM users WHERE role = 'patient' ORDER BY name").all();
    const doctors = db.prepare("SELECT id, name FROM doctor_profiles ORDER BY name").all();
    const rows = db.prepare(`SELECT l.id, l.status, u.name AS patient, d.name AS doctor FROM care_links l JOIN users u ON u.id = l.patient_id JOIN doctor_profiles d ON d.id = l.doctor_id ORDER BY l.id DESC`).all();
    inner = `<h1>Բժիշկ–պացիենտ</h1>
      <form class="card panel inline" method="post" action="/admin/link">${csrfField(req)}
        <select name="patient_id">${patients.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select>
        <select name="doctor_id">${doctors.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join("")}</select>
        <button class="btn btn-primary" type="submit">Կապել</button>
      </form>
      ${rows.map(r => `<article class="card panel inline"><div>${esc(r.patient)} → ${esc(r.doctor)} · ${esc(r.status)}</div>
        <form method="post" action="/cabinet/link/status">${csrfField(req)}<input type="hidden" name="id" value="${r.id}" />
          <button class="btn btn-ghost btn-sm" name="status" value="active">Ակտիվ</button>
          <button class="btn btn-ghost btn-sm" name="status" value="declined">Մերժել</button>
        </form></article>`).join("")}`;
  } else if (tab === "visits") {
    const rows = db.prepare(`SELECT a.id, a.at, a.status, a.reason, u.name AS patient, d.name AS doctor FROM appointments a JOIN users u ON u.id = a.patient_id JOIN doctor_profiles d ON d.id = a.doctor_id ORDER BY a.at`).all();
    inner = `<h1>Բոլոր այցերը</h1>` + rows.map(r => `<article class="card panel">${esc(r.patient)} → ${esc(r.doctor)} · ${esc(r.at)} · ${esc(r.status)}<p class="muted">${esc(r.reason)}</p>
      <form method="post" action="/cabinet/appointment/status">${csrfField(req)}<input type="hidden" name="id" value="${r.id}" />
        <button class="btn btn-ghost btn-sm" name="status" value="confirmed">Հաստատել</button>
        <button class="btn btn-ghost btn-sm" name="status" value="cancelled">Չեղարկել</button>
      </form></article>`).join("");
  } else if (tab === "labs") {
    const patients = db.prepare("SELECT id, name FROM users WHERE role = 'patient'").all();
    inner = `<h1>Անալիզ ավելացնել</h1>
      <form class="card panel form-grid" method="post" action="/admin/lab">${csrfField(req)}
        <select name="patient_id">${patients.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select>
        <input name="name" placeholder="Թեստ" required />
        <input name="value" placeholder="Արժեք" required />
        <input name="unit" placeholder="Միավոր" />
        <input name="low" placeholder="Նորմայի սկիզբ" />
        <input name="high" placeholder="Նորմայի վերջ" />
        <button class="btn btn-primary" type="submit">Ավելացնել</button>
      </form>`;
  } else if (tab === "places") {
    const rows = db.prepare("SELECT * FROM places ORDER BY name").all();
    inner = `<h1>Քարտեզի կետեր</h1>
      <form class="card panel form-grid" method="post" action="/admin/place">${csrfField(req)}
        <input name="name" placeholder="Անուն" required /><input name="type" placeholder="Կլինիկա" />
        <input name="lat" placeholder="Լայնություն, օր. 40.18" required /><input name="lng" placeholder="Երկայնություն, օր. 44.51" required />
        <input name="hours" placeholder="Ժամեր" /><input name="wait" placeholder="Սպասում" /><input name="note" placeholder="Նշում" />
        <button class="btn btn-primary">Ավելացնել</button>
      </form>
      ${rows.map(p => `<article class="card panel inline"><span>${esc(p.name)} · ${esc(p.type)}</span><form method="post" action="/admin/place/delete">${csrfField(req)}<input type="hidden" name="id" value="${p.id}" /><button class="btn btn-ghost btn-sm">Ջնջել</button></form></article>`).join("")}`;
  } else if (tab === "medicines") {
    const rows = db.prepare("SELECT id, name, slug FROM medicines ORDER BY name").all();
    inner = `<h1>Դեղեր</h1>
      <form class="card panel form-grid" method="post" action="/admin/medicine">${csrfField(req)}
        <input name="name" placeholder="Անուն" required /><input name="slug" placeholder="slug (դատարկ թողնել՝ ավտո)" />
        <input name="generic" placeholder="Գեներիկ" /><input name="cat" placeholder="Խումբ" />
        <textarea name="use" placeholder="Կիրառում"></textarea><textarea name="dose" placeholder="Սխեմա"></textarea><textarea name="watch" placeholder="Զգուշացում"></textarea>
        <button class="btn btn-primary">Պահել</button>
      </form>
      ${rows.map(m => `<p class="inline"><a href="/medicines/${esc(m.slug)}">${esc(m.name)}</a>
        <form method="post" action="/admin/medicine/delete">${csrfField(req)}<input type="hidden" name="id" value="${m.id}" /><button class="btn btn-ghost btn-sm">Ջնջել</button></form></p>`).join("")}`;
  } else if (tab === "articles") {
    const rows = db.prepare("SELECT id, title, slug FROM articles ORDER BY id").all();
    inner = `<h1>Հոդվածներ</h1>
      <form class="card panel form-grid" method="post" action="/admin/article">${csrfField(req)}
        <input name="title" placeholder="Վերնագիր" required /><input name="slug" placeholder="slug" />
        <input name="cat" placeholder="Թեմա" /><input name="mins" placeholder="Րոպե" />
        <textarea name="dek" placeholder="Կարճ նկարագիր SEO-ի համար"></textarea>
        <textarea name="body" rows="6" placeholder="Տեքստ, պարբերությունները բաժանեք դատարկ տողով"></textarea>
        <button class="btn btn-primary">Պահել</button>
      </form>
      ${rows.map(a => `<p class="inline"><a href="/articles/${esc(a.slug)}">${esc(a.title)}</a>
        <form method="post" action="/admin/article/delete">${csrfField(req)}<input type="hidden" name="id" value="${a.id}" /><button class="btn btn-ghost btn-sm">Ջնջել</button></form></p>`).join("")}`;
  } else if (tab === "emergency") {
    const rows = db.prepare("SELECT id, title FROM emergencies").all();
    inner = `<h1>Արտակարգ քարտեր</h1>
      <form class="card panel form-grid" method="post" action="/admin/emergency">${csrfField(req)}
        <input name="title" required placeholder="Վերնագիր" />
        <select name="severity"><option value="call">Զանգել</option><option value="urgent">Շտապ</option><option value="self">Առաջին օգնություն</option></select>
        <textarea name="blurb" placeholder="Կարճ"></textarea>
        <textarea name="steps" placeholder="Քայլերը՝ յուրաքանչյուրը նոր տողով"></textarea>
        <button class="btn btn-primary">Ավելացնել</button>
      </form>
      ${rows.map(e => `<p class="inline">${esc(e.title)}<form method="post" action="/admin/emergency/delete">${csrfField(req)}<input type="hidden" name="id" value="${e.id}" /><button class="btn btn-ghost btn-sm">Ջնջել</button></form></p>`).join("")}`;
  } else if (tab === "seo") {
    inner = `<h1>SEO</h1>
      <p class="lede">Այս դաշտերը գնում են title-ի, նկարագրության, Open Graph-ի և կազմակերպության կառուցվածքային տվյալների մեջ։ Քարտեզը՝ <a href="/sitemap.xml">/sitemap.xml</a>։</p>
      <form class="card panel form-grid" method="post" action="/admin/seo">${csrfField(req)}
        <label>Կայքի անուն<input name="site_name" value="${esc(s.site_name)}" /></label>
        <label>Քաղաք<input name="city" value="${esc(s.city)}" /></label>
        <label>Նկարագիր<textarea name="description" rows="4">${esc(s.description)}</textarea></label>
        <button class="btn btn-primary">Պահել</button>
      </form>`;
  } else {
    const counts = {
      users: db.prepare("SELECT COUNT(*) AS n FROM users").get().n,
      doctors: db.prepare("SELECT COUNT(*) AS n FROM doctor_profiles").get().n,
      links: db.prepare("SELECT COUNT(*) AS n FROM care_links WHERE status = 'active'").get().n
    };
    inner = `<h1>Կայքի կառավարում</h1><p class="lede">Օգտատերեր, բժիշկ–պացիենտ կապեր, այցեր, բովանդակություն և SEO մեկ կաբինետից։</p>
      <div class="grid grid-3" style="margin-top:16px">
        <div class="card kpi"><span class="muted">Օգտատեր</span><b>${counts.users}</b></div>
        <div class="card kpi"><span class="muted">Բժիշկ</span><b>${counts.doctors}</b></div>
        <div class="card kpi"><span class="muted">Ակտիվ կապ</span><b>${counts.links}</b></div>
      </div>`;
  }
  return shell(req, "Ադմին", links, tab, inner);
}

function photoTag(d, large) {
  if (!d.photo) return "";
  return `<img class="avatar${large ? " lg" : ""}" src="${esc(d.photo)}" alt="${esc(d.name)}" />`;
}

function notFound(req) {
  return renderPage(req, { title: "Չի գտնվել", noindex: true, body: `<section class="page"><div class="wrap"><h1>Էջը չի գտնվել</h1><p><a href="/">Գլխավոր</a></p></div></section>` });
}

function slugify(value) {
  const raw = String(value || "").trim().toLowerCase();
  const latin = raw.normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return latin || `item-${Date.now()}`;
}

const publicDir = path.join(root, "public");
app.use("/css", express.static(path.join(publicDir, "css")));
app.use("/js", express.static(path.join(publicDir, "js")));
app.use("/img", express.static(path.join(publicDir, "img")));
app.use("/favicon.svg", express.static(path.join(publicDir, "favicon.svg")));
app.use((req, res) => res.status(404).send(notFound(req)));

export default app;

if (!process.env.VERCEL) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Medverse http://localhost:${port}`);
  });
}
