const PAGES = [
  { href: "index.html", id: "home", label: "Գլխավոր" },
  { href: "doctors.html", id: "doctors", label: "Բժիշկներ" },
  { href: "map.html", id: "map", label: "Քարտեզ" },
  { href: "medicines.html", id: "medicines", label: "Դեղեր" },
  { href: "lab.html", id: "lab", label: "Անալիզներ" },
  { href: "journal.html", id: "journal", label: "Օրագիր" },
  { href: "emergency.html", id: "emergency", label: "Արտակարգ" },
  { href: "articles.html", id: "articles", label: "Հոդվածներ" }
];

const ICONS = {
  mark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/></svg>`,
  search: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.2-3.2"/></svg>`
};

function currentPage() {
  return document.body.dataset.page || "home";
}

function renderHeader() {
  const page = currentPage();
  const links = PAGES.map(p =>
    `<li><a class="${p.id === page ? "active" : ""} ${p.id === "emergency" ? "nav-cta" : ""}" href="${p.href}">${p.label}</a></li>`
  ).join("");

  document.getElementById("site-header").innerHTML = `
    <header class="nav" id="nav">
      <div class="nav-inner">
        <a class="logo" href="index.html">
          <span class="logo-mark">${ICONS.mark}</span>
          Medverse
        </a>
        <button class="nav-toggle" id="navToggle" aria-label="Բացել մենյուն"><span></span><span></span><span></span></button>
        <ul class="nav-links" id="navLinks">${links}</ul>
      </div>
    </header>
  `;

  const toggle = document.getElementById("navToggle");
  const list = document.getElementById("navLinks");
  toggle.addEventListener("click", () => list.classList.toggle("open"));
  window.addEventListener("scroll", () => {
    document.getElementById("nav").classList.toggle("scrolled", window.scrollY > 8);
  }, { passive: true });
}

function renderFooter() {
  document.getElementById("site-footer").innerHTML = `
    <footer class="footer">
      <div class="wrap foot-grid">
        <div>
          <a class="logo" href="index.html"><span class="logo-mark">${ICONS.mark}</span> Medverse</a>
          <p style="margin-top:12px">Հանգիստ բժշկական տարածք Աուրելի և ցանկացած բրաուզերի համար։ Միայն ցուցադրական տվյալներ — ոչ կլինիկա, ոչ քարտ, ոչ խորհուրդ։</p>
        </div>
        <div>
          <h4>Բաժիններ</h4>
          <a href="doctors.html">Գտնել բժիշկ</a>
          <a href="map.html">Խնամքի քարտեզ</a>
          <a href="medicines.html">Դեղերի ցանկ</a>
          <a href="lab.html">Անալիզներ</a>
        </div>
        <div>
          <h4>Գործիքներ</h4>
          <a href="journal.html">Առողջության օրագիր</a>
          <a href="emergency.html">Արտակարգ ուղեցույց</a>
          <a href="articles.html">Հոդվածներ</a>
        </div>
        <div>
          <h4>Աուրել</h4>
          <p>hello@medverse.local</p>
          <p>Նավահանգստի թաղամաս · հորինված քաղաք</p>
          <p>Արտակարգ դեպքում՝ տեղական ծառայություններ</p>
        </div>
      </div>
      <div class="wrap legal">© 2026 Medverse. Ուսումնական մակետ։ Իրական խնամքի համար դիմեք լիցենզավորված բժշկի։</div>
    </footer>
    <button class="fab" type="button" data-pro-call>Զանգել 911</button>
    <div class="toast" id="toast"></div>
    <div class="modal-back" id="modalBack" role="dialog" aria-modal="true">
      <div class="modal" id="modal"></div>
    </div>
  `;
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2400);
}

function openModal(html) {
  const back = document.getElementById("modalBack");
  const modal = document.getElementById("modal");
  modal.innerHTML = `<button class="modal-close" aria-label="Փակել">×</button>${html}`;
  back.classList.add("open");
  modal.querySelector(".modal-close").onclick = closeModal;
}

function closeModal() {
  document.getElementById("modalBack").classList.remove("open");
}

function stars(n) {
  const full = Math.round(n);
  return "★★★★★".slice(0, full) + "☆☆☆☆☆".slice(0, 5 - full);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

document.addEventListener("DOMContentLoaded", () => {
  renderHeader();
  renderFooter();
  document.getElementById("modalBack").addEventListener("click", e => {
    if (e.target.id === "modalBack") closeModal();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeModal();
  });
  if (typeof MedversePages !== "undefined") MedversePages.init(currentPage());
  if (!document.querySelector("script[data-pro-call-js]")) {
    const script = document.createElement("script");
    script.src = "public/js/pro-call.js";
    script.dataset.proCallJs = "1";
    document.body.appendChild(script);
  }
});
