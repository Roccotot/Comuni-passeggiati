/* ============================================================
   Comuni Passeggiati — app.js
   ============================================================ */

// ── Stato globale ──────────────────────────────────────────
const state = {
  comuni: [],
  visited: {},          // { id: true }
  filtered: [],
  page: 1,
  pageSize: 100,
  sort: { col: 'comune', dir: 'asc' },
  filters: { regione: '', provincia: '', visitato: '' },
  search: '',
  mapReady: false,
  pendingToggle: null,  // { id, comune, newVal }
};

// ── Riferimenti DOM ────────────────────────────────────────
const $ = id => document.getElementById(id);
const dom = {
  loading:      () => $('loading-spinner'),
  tableWrap:    () => $('table-container'),
  tbody:        () => $('table-body'),
  tableInfo:    () => $('table-info'),
  pagination:   () => $('pagination-container'),
  searchInput:  () => $('search-input'),
  filterReg:    () => $('filter-regione'),
  filterProv:   () => $('filter-provincia'),
  filterVis:    () => $('filter-visitato'),
  pageSizeSel:  () => $('page-size-select'),
  badgeTotale:  () => $('badge-totale'),
  badgePct:     () => $('badge-pct'),
  progressIt:   () => $('progress-italia'),
  txtItalia:    () => $('txt-italia'),
  mapBadge:     () => $('map-badge'),
  statsContainer: () => $('stats-container'),
  modalTitolo:  () => $('modal-titolo'),
  modalTesto:   () => $('modal-testo'),
  modalHeader:  () => $('modal-header'),
  btnConferma:  () => $('btn-conferma'),
  toastEl:      () => $('toast-notifica'),
  toastTesto:   () => $('toast-testo'),
};

// ── Leaflet map ────────────────────────────────────────────
let map, layerAll, layerVisited;

// ── Salvataggio ────────────────────────────────────────────
function saveVisited() {
  localStorage.setItem('comuni_visited', JSON.stringify(state.visited));
}

function exportData() {
  const blob = new Blob([JSON.stringify(state.visited, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'comuni-passeggiati.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('💾 Salva il file scaricato dentro la cartella salvataggi/', 'bg-success');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      // Unisce i dati importati con quelli esistenti
      state.visited = { ...state.visited, ...data };
      saveVisited();
      updateStats();
      renderTable();
      if (state.mapReady) updateMapMarkers();
      showToast(`✅ Importati ${Object.keys(data).length} comuni visitati!`, 'bg-success');
    } catch {
      showToast('❌ File non valido', 'bg-danger');
    }
  };
  reader.readAsText(file);
}

// ===========================================================
// INIT
// ===========================================================
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  setupEventListeners();
});

async function loadData() {
  if (typeof window.COMUNI_DATA === 'undefined') {
    dom.loading().innerHTML =
      '<div class="alert alert-danger">Errore: comuni-data.js non trovato.<br><small>Assicurati che tutti i file siano nella stessa cartella.</small></div>';
    return;
  }
  state.comuni = window.COMUNI_DATA;

  // Carica dati visitati: prima prova il file salvataggi/, poi localStorage
  state.visited = await loadVisited();

  dom.loading().classList.add('d-none');
  dom.tableWrap().classList.remove('d-none');

  populateFilters();
  applyFilters();
  updateStats();
}

async function loadVisited() {
  // Su file:// i fetch locali sono bloccati: usa sempre localStorage
  return JSON.parse(localStorage.getItem('comuni_visited') || '{}');
}

// ===========================================================
// FILTRI E RICERCA
// ===========================================================
function populateFilters() {
  const regioni = [...new Set(state.comuni.map(c => c.regione))].sort();
  const sel = dom.filterReg();
  regioni.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r; opt.textContent = r;
    sel.appendChild(opt);
  });
}

function updateProvince() {
  const reg = state.filters.regione;
  const provSet = new Set(
    state.comuni.filter(c => !reg || c.regione === reg).map(c => c.provincia)
  );
  const sel = dom.filterProv();
  sel.innerHTML = '<option value="">Tutte le Province</option>';
  [...provSet].sort().forEach(p => {
    const opt = document.createElement('option');
    opt.value = p; opt.textContent = p;
    sel.appendChild(opt);
  });
  state.filters.provincia = '';
}

function applyFilters() {
  const { regione, provincia, visitato } = state.filters;
  const q = state.search.toLowerCase().trim();

  state.filtered = state.comuni.filter(c => {
    if (regione && c.regione !== regione) return false;
    if (provincia && c.provincia !== provincia) return false;
    if (visitato === '1' && !state.visited[c.id]) return false;
    if (visitato === '0' && state.visited[c.id]) return false;
    if (q && !c.comune.toLowerCase().includes(q) &&
             !c.provincia.toLowerCase().includes(q) &&
             !c.regione.toLowerCase().includes(q)) return false;
    return true;
  });

  // Ordinamento
  const { col, dir } = state.sort;
  state.filtered.sort((a, b) => {
    let va = a[col], vb = b[col];
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return dir === 'asc' ? -1 : 1;
    if (va > vb) return dir === 'asc' ? 1 : -1;
    return 0;
  });

  state.page = 1;
  renderTable();
}

// ===========================================================
// RENDERING TABELLA
// ===========================================================
function renderTable() {
  const start = (state.page - 1) * state.pageSize;
  const slice = state.filtered.slice(start, start + state.pageSize);

  dom.tableInfo().textContent =
    `Mostrando ${start + 1}–${Math.min(start + state.pageSize, state.filtered.length)} di ${state.filtered.length} comuni`;

  dom.tbody().innerHTML = slice.map(c => {
    const vis = !!state.visited[c.id];
    return `<tr class="${vis ? 'visitato' : 'non-visitato'}" data-id="${c.id}" data-nome="${escHtml(c.comune)}" title="${vis ? 'Visitato — clicca per rimuovere' : 'Non visitato — clicca per segnare'}">
      <td class="fw-semibold">${escHtml(c.comune)}</td>
      <td>${escHtml(c.provincia)}</td>
      <td>${escHtml(c.regione)}</td>
      <td class="text-end">${c.lat != null ? c.lat.toFixed(5) : '—'}</td>
      <td class="text-end">${c.lng != null ? c.lng.toFixed(5) : '—'}</td>
    </tr>`;
  }).join('');

  renderPagination();
  updateSortIcons();
}

function renderPagination() {
  const totalPages = Math.ceil(state.filtered.length / state.pageSize);
  const nav = dom.pagination();
  if (totalPages <= 1) { nav.innerHTML = ''; return; }

  const maxPages = 7;
  let pages = [];

  if (totalPages <= maxPages) {
    pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  } else {
    const p = state.page;
    pages = [1];
    if (p > 3) pages.push('…');
    for (let i = Math.max(2, p - 1); i <= Math.min(totalPages - 1, p + 1); i++) pages.push(i);
    if (p < totalPages - 2) pages.push('…');
    pages.push(totalPages);
  }

  nav.innerHTML = `<ul class="pagination pagination-sm mb-0">
    <li class="page-item ${state.page === 1 ? 'disabled' : ''}">
      <a class="page-link" data-page="${state.page - 1}" href="#">‹</a>
    </li>
    ${pages.map(p => p === '…'
      ? `<li class="page-item disabled"><span class="page-link">…</span></li>`
      : `<li class="page-item ${p === state.page ? 'active' : ''}">
           <a class="page-link" data-page="${p}" href="#">${p}</a>
         </li>`
    ).join('')}
    <li class="page-item ${state.page === totalPages ? 'disabled' : ''}">
      <a class="page-link" data-page="${state.page + 1}" href="#">›</a>
    </li>
  </ul>`;

  nav.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      const p = parseInt(el.dataset.page);
      if (p >= 1 && p <= totalPages && p !== state.page) {
        state.page = p;
        renderTable();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });
}

function updateSortIcons() {
  document.querySelectorAll('#comuni-table th.sortable').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.col === state.sort.col) {
      th.classList.add('sort-' + state.sort.dir);
    }
  });
}

// ===========================================================
// CHECKBOX + CONFERMA
// ===========================================================
let confirmModal;

function handleRowClick(e) {
  const row = e.target.closest('tr[data-id]');
  if (!row) return;

  const id = row.dataset.id;
  const nome = row.dataset.nome;
  const currentlyVisited = !!state.visited[id];
  const newVal = !currentlyVisited;

  state.pendingToggle = { id, nome, newVal };

  if (newVal) {
    dom.modalHeader().className = 'modal-header segna';
    dom.modalTitolo().textContent = '🟢 Segna come visitato';
    dom.modalTesto().innerHTML =
      `Hai passeggiato per la via principale di <strong>${escHtml(nome)}</strong>?`;
    dom.btnConferma().className = 'btn btn-success btn-sm px-4';
    dom.btnConferma().textContent = 'Sì, confermo!';
  } else {
    dom.modalHeader().className = 'modal-header rimuovi';
    dom.modalTitolo().textContent = '🔴 Rimuovi visita';
    dom.modalTesto().innerHTML =
      `Vuoi rimuovere <strong>${escHtml(nome)}</strong> dai comuni visitati?`;
    dom.btnConferma().className = 'btn btn-danger btn-sm px-4';
    dom.btnConferma().textContent = 'Sì, rimuovi';
  }

  if (!confirmModal) {
    confirmModal = new bootstrap.Modal($('modal-conferma'));
  }
  confirmModal.show();
}

function confermaToggle() {
  if (!state.pendingToggle) return;
  const { id, nome, newVal } = state.pendingToggle;
  state.pendingToggle = null;

  if (newVal) {
    state.visited[id] = true;
  } else {
    delete state.visited[id];
  }

  saveVisited();

  // Aggiorna riga nella tabella
  const row = dom.tbody().querySelector(`tr[data-id="${id}"]`);
  if (row) {
    row.classList.toggle('visitato', newVal);
    row.classList.toggle('non-visitato', !newVal);
    row.title = newVal ? 'Visitato — clicca per rimuovere' : 'Non visitato — clicca per segnare';
  }

  updateStats();
  if (state.mapReady) updateMapMarkers();

  showToast(
    newVal
      ? `✅ ${nome} segnato come visitato!`
      : `❌ Visita rimossa: ${nome}`,
    newVal ? 'bg-success' : 'bg-warning'
  );

  confirmModal.hide();
}

// ===========================================================
// STATISTICHE
// ===========================================================
function updateStats() {
  const total = state.comuni.length;
  const visitedCount = Object.keys(state.visited).length;
  const pct = total > 0 ? ((visitedCount / total) * 100).toFixed(1) : '0.0';

  dom.badgeTotale().textContent = `${visitedCount} / ${total}`;
  dom.badgePct().textContent = `${pct}%`;
  dom.progressIt().style.width = pct + '%';
  dom.txtItalia().textContent = pct + '%';
  if (dom.mapBadge()) dom.mapBadge().textContent = `${visitedCount} visitati`;

  renderStatsPanel();
}

function renderStatsPanel() {
  const regionMap = {};
  state.comuni.forEach(c => {
    if (!regionMap[c.regione]) regionMap[c.regione] = {};
    if (!regionMap[c.regione][c.provincia]) regionMap[c.regione][c.provincia] = { total: 0, vis: 0 };
    regionMap[c.regione][c.provincia].total++;
    if (state.visited[c.id]) regionMap[c.regione][c.provincia].vis++;
  });

  const regionStats = Object.entries(regionMap).map(([reg, provMap]) => {
    const total = Object.values(provMap).reduce((s, p) => s + p.total, 0);
    const vis = Object.values(provMap).reduce((s, p) => s + p.vis, 0);
    return { reg, provMap, total, vis, pct: total ? ((vis / total) * 100).toFixed(1) : '0.0' };
  }).sort((a, b) => b.vis - a.vis || a.reg.localeCompare(b.reg));

  const container = dom.statsContainer();
  container.innerHTML = regionStats.map(({ reg, provMap, total, vis, pct }) => {
    const provRows = Object.entries(provMap)
      .sort((a, b) => b[1].vis - a[1].vis || a[0].localeCompare(b[0]))
      .map(([prov, { total: pt, vis: pv }]) => {
        const pp = pt ? ((pv / pt) * 100).toFixed(0) : '0';
        return `<div class="provincia-row">
          <span class="provincia-name">${escHtml(prov)}</span>
          <div class="provincia-progress"><div class="provincia-progress-bar" style="width:${pp}%"></div></div>
          <span class="provincia-count">${pv}/${pt} (${pp}%)</span>
        </div>`;
      }).join('');

    return `<div class="col-12 col-md-6 col-xl-4">
      <div class="stat-regione">
        <div class="stat-regione-header d-flex align-items-center justify-content-between">
          <span class="fw-bold">${escHtml(reg)}</span>
          <div class="stat-pct-circle">${pct}%</div>
        </div>
        <div class="p-2">
          <div class="d-flex align-items-center gap-2 mb-2">
            <div class="progress flex-grow-1 stat-progress">
              <div class="progress-bar bg-success" style="width:${pct}%"></div>
            </div>
            <small class="text-muted fw-semibold">${vis}/${total}</small>
          </div>
          <div class="province-list">${provRows}</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ===========================================================
// MAPPA LEAFLET
// ===========================================================
function initMap() {
  if (state.mapReady) return;

  map = L.map('map', { center: [41.9, 12.5], zoom: 6 });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18
  }).addTo(map);

  layerAll = L.markerClusterGroup({
    maxClusterRadius: 30,
    iconCreateFunction: cluster => L.divIcon({
      html: `<div class="cluster-all">${cluster.getChildCount()}</div>`,
      className: '',
      iconSize: [36, 36]
    })
  });

  layerVisited = L.layerGroup();

  state.comuni.forEach(c => {
    if (!c.lat || !c.lng) return;
    const dotIcon = L.circleMarker([c.lat, c.lng], {
      radius: 3,
      fillColor: '#6c757d',
      fillOpacity: 0.5,
      stroke: false,
    });
    dotIcon.bindPopup(buildPopup(c));
    layerAll.addLayer(dotIcon);
  });

  layerAll.addTo(map);
  layerVisited.addTo(map);

  updateMapMarkers();
  state.mapReady = true;
  map.invalidateSize();
}

function updateMapMarkers() {
  layerVisited.clearLayers();
  Object.keys(state.visited).forEach(id => {
    const c = state.comuni.find(x => x.id === id);
    if (!c || !c.lat || !c.lng) return;
    const marker = L.circleMarker([c.lat, c.lng], {
      radius: 7,
      fillColor: '#198754',
      fillOpacity: 0.85,
      color: '#fff',
      weight: 2,
    });
    marker.bindPopup(buildPopup(c));
    layerVisited.addLayer(marker);
  });
}

function buildPopup(c) {
  const vis = !!state.visited[c.id];
  return `<div style="min-width:140px">
    <strong>${escHtml(c.comune)}</strong><br>
    <small class="text-muted">${escHtml(c.provincia)} — ${escHtml(c.regione)}</small><br>
    <span class="${vis ? 'popup-visitato' : 'popup-non-visitato'}">
      ${vis ? '✅ Visitato' : '⬜ Non visitato'}
    </span>
  </div>`;
}

// ===========================================================
// EVENT LISTENERS
// ===========================================================
function setupEventListeners() {
  // Ricerca (debounce)
  let searchTimer;
  dom.searchInput().addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = e.target.value;
      applyFilters();
    }, 280);
  });

  dom.filterReg().addEventListener('change', e => {
    state.filters.regione = e.target.value;
    updateProvince();
    applyFilters();
  });

  dom.filterProv().addEventListener('change', e => {
    state.filters.provincia = e.target.value;
    applyFilters();
  });

  dom.filterVis().addEventListener('change', e => {
    state.filters.visitato = e.target.value;
    applyFilters();
  });

  $('btn-reset-filtri').addEventListener('click', () => {
    state.filters = { regione: '', provincia: '', visitato: '' };
    state.search = '';
    dom.searchInput().value = '';
    dom.filterReg().value = '';
    dom.filterProv().innerHTML = '<option value="">Tutte le Province</option>';
    dom.filterVis().value = '';
    applyFilters();
  });

  dom.pageSizeSel().addEventListener('change', e => {
    state.pageSize = parseInt(e.target.value);
    state.page = 1;
    renderTable();
  });

  document.querySelectorAll('#comuni-table th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (state.sort.col === col) {
        state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sort.col = col;
        state.sort.dir = 'asc';
      }
      applyFilters();
    });
  });

  dom.tbody().addEventListener('click', handleRowClick);
  dom.btnConferma().addEventListener('click', confermaToggle);

  // Importa
  $('btn-import').addEventListener('click', () => {
    $('import-file-input').click();
  });

  $('import-file-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
      importData(file);
      e.target.value = ''; // reset per permettere di reimportare lo stesso file
    }
  });

  // Tab mappa
  document.getElementById('tab-mappa-link').addEventListener('shown.bs.tab', () => {
    if (!state.mapReady) initMap();
    else map.invalidateSize();
  });

  $('map-show-all').addEventListener('change', e => {
    if (e.target.checked) map.addLayer(layerAll);
    else map.removeLayer(layerAll);
  });
  $('map-show-visited').addEventListener('change', e => {
    if (e.target.checked) map.addLayer(layerVisited);
    else map.removeLayer(layerVisited);
  });
}

// ===========================================================
// UTILITIES
// ===========================================================
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
}

let toastInstance;
function showToast(msg, cls = 'bg-success') {
  const el = dom.toastEl();
  el.className = `toast align-items-center text-white border-0 ${cls}`;
  dom.toastTesto().textContent = msg;
  if (!toastInstance) toastInstance = new bootstrap.Toast(el, { delay: 2800 });
  toastInstance.show();
}
