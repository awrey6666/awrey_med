const PIN_COLOR = {
  "Հիվանդանոց": "#c24a3b",
  "Կլինիկա": "#146850",
  "Դեղատուն": "#5aa0c4",
  "Լաբորատորիա": "#b8892a"
};

function initYerevanMap(rawPlaces) {
  const stage = document.getElementById("mapStage");
  const list = document.getElementById("placeList");
  const chips = document.getElementById("mapChips");
  const detail = document.getElementById("placeDetail");
  if (!stage || typeof L === "undefined") return;
  if (stage.dataset.ready === "1") return;
  stage.dataset.ready = "1";

  const places = rawPlaces
    .map((p, i) => ({ ...p, id: String(p.id ?? i), lat: Number(p.lat), lng: Number(p.lng) }))
    .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));

  const types = ["Բոլորը", ...Array.from(new Set(places.map(p => p.type)))];
  let type = "Բոլորը";
  let active = places[0]?.id;

  if (chips) {
    chips.innerHTML = types.map(t =>
      `<button class="chip ${t === "Բոլորը" ? "active" : ""}" type="button" data-type="${t}">${t}</button>`
    ).join("");
  }

  const map = L.map(stage, { scrollWheelZoom: true }).setView([40.181, 44.514], 13);
  L.tileLayer("https://tile{s}.maps.2gis.com/tiles?x={x}&y={y}&z={z}&v=1.1&key=cb1_4nsp_1_2f1ab1e7e6ab0a70fc9d1f29", {
    subdomains: "0123",
    maxZoom: 18,
    attribution: '&copy; <a href="https://2gis.ru">2GIS</a>'
  }).addTo(map);

  const markers = new Map();
  for (const p of places) {
    const color = PIN_COLOR[p.type] || "#146850";
    const marker = L.circleMarker([p.lat, p.lng], {
      radius: 9,
      color: "#fff",
      weight: 2,
      fillColor: color,
      fillOpacity: 1
    }).addTo(map);
    marker.bindPopup(`<strong>${escapeHtml(p.name)}</strong><br>${escapeHtml(p.note || "")}`);
    marker.on("click", () => select(p.id, false));
    markers.set(p.id, marker);
  }

  function visible() {
    return places.filter(p => type === "Բոլորը" || p.type === type);
  }

  function select(id, fly) {
    const shown = visible();
    if (!shown.find(p => p.id === id)) id = shown[0]?.id;
    active = id;
    const sel = places.find(p => p.id === active);
    list.querySelectorAll("[data-place]").forEach(el => {
      el.classList.toggle("active", el.dataset.place === active);
    });
    markers.forEach((marker, key) => {
      const place = places.find(p => p.id === key);
      const on = key === active;
      const show = !place || type === "Բոլորը" || place.type === type;
      marker.setStyle({ radius: on ? 12 : 8, opacity: show ? 1 : 0, fillOpacity: show ? 1 : 0 });
      if (show) marker.addTo(map);
      else map.removeLayer(marker);
    });
    if (!sel || !detail) return;
    const gis = `https://2gis.ru/geo/${sel.lng},${sel.lat}`;
    detail.innerHTML = `
      <h3>${escapeHtml(sel.name)}</h3>
      <p class="muted" style="margin:8px 0">${escapeHtml(sel.note || "")}</p>
      <p><strong>Ժամեր</strong> · ${escapeHtml(sel.hours || "")}</p>
      <p><strong>Սպասում</strong> · ${escapeHtml(sel.wait || "")}</p>
      <p style="margin-top:10px"><a href="${gis}" target="_blank" rel="noopener">Բացել 2ԳԻՍ-ում</a></p>`;
    const marker = markers.get(sel.id);
    if (marker) {
      if (fly) map.flyTo([sel.lat, sel.lng], 15, { duration: 0.6 });
      marker.openPopup();
    }
  }

  function drawList() {
    const shown = visible();
    list.innerHTML = shown.map(p => `
      <article class="card place ${p.id === active ? "active" : ""}" data-place="${p.id}">
        <div class="meta"><span class="badge ${p.type === "Հիվանդանոց" ? "" : "badge-blue"}">${escapeHtml(p.type)}</span><span>${escapeHtml(p.wait || "")}</span></div>
        <h3 style="font-size:1.05rem;margin:6px 0 4px">${escapeHtml(p.name)}</h3>
        <p class="muted" style="font-size:0.86rem">${escapeHtml(p.note || "")}</p>
      </article>`).join("");
    list.querySelectorAll("[data-place]").forEach(el => {
      el.addEventListener("click", () => select(el.dataset.place, true));
    });
    if (shown.length) {
      const bounds = L.latLngBounds(shown.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds.pad(0.18));
    }
    select(active, false);
  }

  chips?.addEventListener("click", e => {
    const b = e.target.closest("[data-type]");
    if (!b) return;
    type = b.dataset.type;
    chips.querySelectorAll(".chip").forEach(c => c.classList.toggle("active", c === b));
    drawList();
  });

  drawList();
  setTimeout(() => map.invalidateSize(), 80);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

document.addEventListener("DOMContentLoaded", () => {
  if (window.YEREVAN_PLACES && document.getElementById("mapStage")) initYerevanMap(window.YEREVAN_PLACES);
});
