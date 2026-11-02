const MedversePages = {
  init(page) {
    const fn = this[page];
    if (fn) fn.call(this);
  },

  home() {
    const row = document.getElementById("homeDoctors");
    if (!row) return;
    row.innerHTML = MV.doctors.slice(0, 4).map(d => doctorCard(d)).join("");
    row.querySelectorAll("[data-doc]").forEach(btn => {
      btn.addEventListener("click", () => showDoctor(btn.dataset.doc));
    });
  },

  doctors() {
    const grid = document.getElementById("docGrid");
    const search = document.getElementById("docSearch");
    const chips = document.getElementById("docChips");
    let spec = "Բոլորը";

    chips.innerHTML = MV.specialties.map(s =>
      `<button class="chip ${s === "Բոլորը" ? "active" : ""}" data-spec="${esc(s)}">${esc(s)}</button>`
    ).join("");

    const draw = () => {
      const q = search.value.trim().toLowerCase();
      const list = MV.doctors.filter(d => {
        const okSpec = spec === "Բոլորը" || d.specialty === spec;
        const blob = (d.name + d.specialty + d.focus + d.clinic).toLowerCase();
        return okSpec && (!q || blob.includes(q));
      });
      grid.innerHTML = list.length
        ? list.map(d => doctorCard(d)).join("")
        : `<div class="card empty">Այս զտիչին համապատասխան բժիշկ չկա։ Փորձեք այլ մասնագիտություն։</div>`;
      grid.querySelectorAll("[data-doc]").forEach(btn => {
        btn.addEventListener("click", () => showDoctor(btn.dataset.doc));
      });
    };

    chips.addEventListener("click", e => {
      const b = e.target.closest("[data-spec]");
      if (!b) return;
      spec = b.dataset.spec;
      chips.querySelectorAll(".chip").forEach(c => c.classList.toggle("active", c === b));
      draw();
    });
    search.addEventListener("input", draw);
    draw();
  },

  map() {
    if (typeof initYerevanMap === "function") initYerevanMap(MV.places);
  },

  medicines() {
    const grid = document.getElementById("medGrid");
    const search = document.getElementById("medSearch");
    const chips = document.getElementById("medChips");
    let cat = "Բոլորը";

    chips.innerHTML = MV.medCats.map(c =>
      `<button class="chip ${c === "Բոլորը" ? "active" : ""}" data-cat="${c}">${c}</button>`
    ).join("");

    const draw = () => {
      const q = search.value.trim().toLowerCase();
      const list = MV.medicines.filter(m => {
        const ok = cat === "Բոլորը" || m.cat === cat;
        const blob = (m.name + m.generic + m.use + m.cat).toLowerCase();
        return ok && (!q || blob.includes(q));
      });
      grid.innerHTML = list.map(m => `
        <article class="card med-card">
          <span class="tag">${esc(m.cat)}</span>
          <h3>${esc(m.name)}</h3>
          <p class="muted" style="font-size:0.82rem">${esc(m.generic)}</p>
          <p style="margin-top:10px;font-size:0.92rem">${esc(m.use)}</p>
          <button class="btn btn-ghost btn-sm" style="margin-top:14px" data-med="${m.id}">Բացել նկարագիրը</button>
        </article>
      `).join("");
      grid.querySelectorAll("[data-med]").forEach(b => b.addEventListener("click", () => showMed(b.dataset.med)));
    };

    chips.addEventListener("click", e => {
      const b = e.target.closest("[data-cat]");
      if (!b) return;
      cat = b.dataset.cat;
      chips.querySelectorAll(".chip").forEach(c => c.classList.toggle("active", c === b));
      draw();
    });
    search.addEventListener("input", draw);
    draw();
  },

  lab() {
    const kpis = document.getElementById("labKpis");
    const table = document.getElementById("labTable");
    const ranges = document.getElementById("labRanges");
    const L = MV.labs;

    document.getElementById("labMeta").textContent =
      `${L.patient} · վերցված ${L.drawn} · ${L.lab}`;

    kpis.innerHTML = L.kpis.map(k => `
      <article class="card kpi">
        <span class="muted">${esc(k.label)}</span>
        <b class="status-${k.status}">${esc(k.value)}</b>
        <span class="muted">${esc(k.note)}</span>
      </article>
    `).join("");

    ranges.innerHTML = L.panels.slice(0, 6).map(p => {
      const span = Math.max(p.high - p.low, 1);
      const pct = Math.max(4, Math.min(96, ((p.value - p.low) / span) * 100));
      const spark = sparkline(p.spark);
      return `
        <div class="range-row">
          <div class="range-label"><span>${esc(p.name)}</span><span>${p.value} ${esc(p.unit)}</span></div>
          <div class="range-track"><i class="range-marker" style="left:${pct}%"></i></div>
          ${spark}
        </div>
      `;
    }).join("");

    table.innerHTML = `
      <thead><tr><th>Թեստ</th><th>Արդյունք</th><th>Նորմա</th><th>Նշում</th></tr></thead>
      <tbody>
        ${L.panels.map(p => {
          const flag = p.value < p.low ? "Ցածր" : p.value > p.high ? "Բարձր" : "Նորմա";
          const cls = flag === "Նորմա" ? "status-ok" : flag === "Բարձր" ? "status-high" : "status-watch";
          return `<tr>
            <td>${esc(p.name)}</td>
            <td>${p.value} ${esc(p.unit)}</td>
            <td>${p.low}–${p.high}</td>
            <td class="${cls}">${flag}</td>
          </tr>`;
        }).join("")}
      </tbody>
    `;
  },

  journal() {
    const KEY = "medverse-journal";
    const load = () => {
      try {
        const raw = localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : MV.journalSeed.slice();
      } catch {
        return MV.journalSeed.slice();
      }
    };
    let entries = load();
    let mood = "🌿";

    const save = () => localStorage.setItem(KEY, JSON.stringify(entries));
    const list = document.getElementById("journalList");
    const moods = document.getElementById("moods");
    moods.innerHTML = ["🌿", "🌤", "💧", "⚡️", "🌙"].map(m =>
      `<button type="button" class="mood ${m === mood ? "active" : ""}" data-mood="${m}">${m}</button>`
    ).join("");
    moods.addEventListener("click", e => {
      const b = e.target.closest("[data-mood]");
      if (!b) return;
      mood = b.dataset.mood;
      moods.querySelectorAll(".mood").forEach(x => x.classList.toggle("active", x === b));
    });

    const draw = () => {
      if (!entries.length) {
        list.innerHTML = `<div class="card empty">Գրառում դեռ չկա։ Սկզբնական նշումները մնում են, մինչև գրեք ձերը։</div>`;
        return;
      }
      list.innerHTML = entries.map(e => `
        <article class="card entry">
          <div class="meta"><span>${esc(e.date)}</span><span>${e.mood}</span></div>
          <h3 style="margin:6px 0">${esc(e.title)}</h3>
          <p class="muted">${esc(e.body)}</p>
          <button class="btn btn-ghost btn-sm" style="margin-top:10px" data-del="${e.id}">Ջնջել</button>
        </article>
      `).join("");
      list.querySelectorAll("[data-del]").forEach(b => {
        b.onclick = () => {
          entries = entries.filter(x => x.id !== b.dataset.del);
          save();
          draw();
          toast("Գրառումը ջնջվեց այս բրաուզերից։");
        };
      });
    };

    document.getElementById("journalForm").addEventListener("submit", ev => {
      ev.preventDefault();
      const title = document.getElementById("jTitle").value.trim();
      const body = document.getElementById("jBody").value.trim();
      if (!title || !body) return;
      entries.unshift({
        id: "j" + Date.now(),
        date: new Date().toISOString().slice(0, 10),
        mood,
        title,
        body,
        tags: []
      });
      save();
      ev.target.reset();
      draw();
      toast("Պահվեց միայն այս սարքում։");
    });
    draw();
  },

  emergency() {
    const grid = document.getElementById("emGrid");
    const search = document.getElementById("emSearch");
    const draw = () => {
      const q = search.value.trim().toLowerCase();
      const list = MV.emergencies.filter(e =>
        !q || (e.title + e.blurb).toLowerCase().includes(q)
      );
      grid.innerHTML = list.map(e => `
        <article class="card guide" data-em="${e.id}">
          <div class="severity ${e.severity === "call" ? "sev-call" : e.severity === "urgent" ? "sev-urgent" : "sev-self"}">
            ${e.severity === "call" ? "Զանգել շտապ օգնություն" : e.severity === "urgent" ? "Շտապ / հնարավոր է հիվանդանոց" : "Առաջին օգնություն · հետևել"}
          </div>
          <h3 style="margin:8px 0 6px">${esc(e.title)}</h3>
          <p class="muted">${esc(e.blurb)}</p>
          <div class="guide-body">
            <ol>${e.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>
          </div>
        </article>
      `).join("");
      grid.querySelectorAll(".guide").forEach(card => {
        card.addEventListener("click", () => card.classList.toggle("open"));
      });
    };
    search.addEventListener("input", draw);
    draw();
  },

  articles() {
    const grid = document.getElementById("artGrid");
    const chips = document.getElementById("artChips");
    let cat = "Բոլորը";
    chips.innerHTML = MV.articleCats.map(c =>
      `<button class="chip ${c === "Բոլորը" ? "active" : ""}" data-cat="${c}">${c}</button>`
    ).join("");

    const draw = () => {
      const list = MV.articles.filter(a => cat === "Բոլորը" || a.cat === cat);
      grid.innerHTML = list.map(a => `
        <article class="card article-card">
          <div class="article-cover" style="background:${a.cover}"><span class="badge">${esc(a.cat)}</span></div>
          <div class="article-body">
            <p class="read">${a.mins} րոպե ընթերցում</p>
            <h3>${esc(a.title)}</h3>
            <p class="muted">${esc(a.dek)}</p>
            <button class="btn btn-ghost btn-sm" style="margin-top:12px" data-art="${a.id}">Կարդալ</button>
          </div>
        </article>
      `).join("");
      grid.querySelectorAll("[data-art]").forEach(b => b.onclick = () => showArticle(b.dataset.art));
    };

    chips.addEventListener("click", e => {
      const b = e.target.closest("[data-cat]");
      if (!b) return;
      cat = b.dataset.cat;
      chips.querySelectorAll(".chip").forEach(c => c.classList.toggle("active", c === b));
      draw();
    });
    draw();
  }
};

function doctorAvatar(d, large) {
  const size = large ? " avatar lg" : " avatar";
  if (d.photo) return `<img class="${size.trim()}" src="${esc(d.photo)}" alt="${esc(d.name)}" />`;
  return `<div class="${size.trim()}" style="background:${d.color}">${d.initials}</div>`;
}

function doctorCard(d) {
  return `
    <article class="card doc-card">
      <div class="doc-top">
        ${doctorAvatar(d)}
        <div>
          <h3>${esc(d.name)}</h3>
          <div class="meta"><span class="badge">${esc(d.specialty)}</span></div>
        </div>
      </div>
      <p class="muted">${esc(d.focus)} · ${esc(d.clinic)}</p>
      <div class="meta">
        <span class="stars">${stars(d.rating)} ${d.rating}</span>
        <span>Հաջորդը՝ ${esc(d.next)}</span>
      </div>
      <button class="btn btn-primary btn-sm" data-doc="${d.id}">Դիտել պրոֆիլը</button>
    </article>
  `;
}

function showDoctor(id) {
  const d = MV.doctors.find(x => x.id === id);
  if (!d) return;
  openModal(`
    <div class="doc-top" style="margin-bottom:16px">
      ${doctorAvatar(d, true)}
      <div>
        <p class="eyebrow">Բժիշկ</p>
        <h2>${esc(d.name)}</h2>
        <p class="muted">${esc(d.specialty)} · ${d.years} տարի</p>
      </div>
    </div>
    <p>${esc(d.bio)}</p>
    <div class="grid grid-2" style="margin-top:18px">
      <div class="card" style="padding:14px"><strong>Կլինիկա</strong><p class="muted">${esc(d.clinic)}</p></div>
      <div class="card" style="padding:14px"><strong>Մոտակա ժամը</strong><p class="muted">${esc(d.next)}</p></div>
      <div class="card" style="padding:14px"><strong>Ժամեր</strong><p class="muted">${esc(d.hours)}</p></div>
      <div class="card" style="padding:14px"><strong>Լեզուներ</strong><p class="muted">${d.langs.map(esc).join(" · ")}</p></div>
    </div>
    <p class="disclaimer">Ցուցադրական պրոֆիլ։ Գրանցումները ոչ մի տեղ չեն ուղարկվում։</p>
    <button class="btn btn-primary" style="margin-top:12px" id="bookFake">Խնդրել ժամ</button>
  `);
  document.getElementById("bookFake").onclick = () => toast("Հարցումը նշվեց տեղում — այս մակետում սերվեր չկա։");
}

function showMed(id) {
  const m = MV.medicines.find(x => x.id === id);
  if (!m) return;
  openModal(`
    <p class="eyebrow">${esc(m.cat)}</p>
    <h2>${esc(m.name)}</h2>
    <p class="muted">${esc(m.generic)}</p>
    <p style="margin-top:14px">${esc(m.use)}</p>
    <p style="margin-top:10px"><strong>Սովորական սխեմա</strong> — ${esc(m.dose)}</p>
    <div class="warn-box">${esc(m.watch)}</div>
    <p class="disclaimer">Միայն ընդհանուր տեղեկություն։ Դեղաչափը, փոխազդեցությունները և «արդյոք սա ինձ համար է» հարցը լուծում են բժիշկն ու դեղագետը։</p>
  `);
}

function showArticle(id) {
  const a = MV.articles.find(x => x.id === id);
  if (!a) return;
  openModal(`
    <p class="eyebrow">${esc(a.cat)} · ${a.mins} րոպե</p>
    <h2>${esc(a.title)}</h2>
    <p class="lede" style="margin:12px 0 18px">${esc(a.dek)}</p>
    ${a.body.split("\n\n").map(p => `<p style="margin-bottom:12px">${esc(p)}</p>`).join("")}
  `);
}

function sparkline(values) {
  const w = 220, h = 48, pad = 4;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  return `<svg class="spark" viewBox="0 0 ${w} ${h}"><polyline fill="none" stroke="#146850" stroke-width="2" points="${pts}"/></svg>`;
}
