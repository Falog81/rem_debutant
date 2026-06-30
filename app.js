(function() {
      'use strict';

      // ========== Configuration ==========
      const DB_NAME = 'remunerationProDB';
      const DB_VERSION = 3;
      const STORE_NAME = 'contracts';
      const STORAGE_KEYS = {
        theme: 'remuneration_theme',
        goal: 'remuneration_monthly_goal',
        weeklyGoal: 'remuneration_weekly_goal',
        lastBackup: 'remuneration_last_backup',
        autoSnapshot: 'remuneration_auto_snapshot',
        dailyLieu: 'remuneration_daily_lieu'
      };

      // Import logique métier pure
      const {
        todayStr,
        addDays,
        formatDate,
        formatEuro,
        formatSignedNumber,
        formatSignedEuro,
        getWeekRange,
        getMonthLabel,
        getIAGTarif,
        getIAGTierInfo,
        calculateAmount,
        computeStats,
        contractTypeLabel,
        filterContracts,
        sortContracts,
        getContractsByPeriod,
        groupByDate,
        getDayContracts,
        getWeekContracts,
        getMonthContracts,
        normalizeReference,
        normalizeContract,
        sanitizeContracts,
      } = window.RemunerationLogic;

      // Contract types configuration
      const PROVIDERS = ['PLENITUDE', 'PRIMEO'];
      
      const CONTRACT_TYPES = {
        PLENITUDE: {
          ENERGY: [
            { value: 'ELEC_3', label: 'Électricité 3 kVA', requiresPower: false, requiresConso: false },
            { value: 'ELEC_6', label: 'Électricité 6-9 kVA', requiresPower: false, requiresConso: false },
            { value: 'ELEC_12', label: 'Électricité 12 kVA', requiresPower: false, requiresConso: false },
            { value: 'DUAL', label: 'Dual Énergie', requiresPower: true, requiresConso: true },
            { value: 'GAZ_1_6', label: 'Gaz seule 1–6 kWh', requiresPower: false, requiresConso: false },
            { value: 'GAZ_6_13', label: 'Gaz seule 6–13 kWh', requiresPower: false, requiresConso: false },
            { value: 'GAZ_13_PLUS', label: 'Gaz seule 13+ kWh', requiresPower: false, requiresConso: false },
          ]
        },
        PRIMEO: {
          ENERGY: [
            { value: 'PRIMEO_ELEC_6', label: 'Primeo Électricité 6 kVA', requiresPower: false, requiresConso: false },
            { value: 'PRIMEO_ELEC_9', label: 'Primeo Électricité 9 kVA', requiresPower: false, requiresConso: false },
            { value: 'PRIMEO_ELEC_12', label: 'Primeo Électricité 12 kVA', requiresPower: false, requiresConso: false }
          ]
        }
      };

      const DUAL_POWER = ['3', '6-9', '12'];
      const DUAL_CONSO = ['1-6', '6-13', '13+'];

      // ========== State ==========
      let contracts = [];
      let currentTab = 'contrats';

      // Edit state
      let editingId = null;

      // Charts state
      let dailyContractsChart = null;
      let typeDistributionChart = null;
      let dayChart = null;
      let weekChart = null;
      let monthChart = null;
      let yearChart = null;

      // ========== DOM Elements ==========
      const $ = (sel) => document.querySelector(sel);
      const $$ = (sel) => document.querySelectorAll(sel);

      // Header
      const currentDateEl = $('#currentDate');
      const themeToggle = $('#themeToggle');
      const btnInstall = $('#btnInstall');
      const offlineBadge = $('#offlineBadge');

      // Tabs
      const tabBtns = $$('.tab-btn');
      const tabContents = $$('.tab-content');

      // Form
      const formTitle = $('#formTitle');
      const btnSubmitContract = $('#btnSubmitContract');
      const btnCancelEdit = $('#btnCancelEdit');

      const addContractForm = $('#addContractForm');
      const contractDate = $('#contractDate');
      const contractName = $('#contractName');
      const contractRef = $('#contractRef');
      const contractRefLabel = $('#contractRefLabel');
      const contractIagOnly = $('#contractIagOnly');
      const energyRow = $('#energyRow');
      const contractProvider = $('#contractProvider');
      const contractType = $('#contractType');
      const contractPower = $('#contractPower');
      const contractConso = $('#contractConso');
      const contractAxa = $('#contractAxa');
      const contractDigi = $('#contractDigi');
      const contractAssurance = $('#contractAssurance');
      const formError = $('#formError');
      const btnClearForm = $('#btnClearForm');
      const contractIagRef = $('#contractIagRef');

      const powerGroup = $('#powerGroup');
      const consoGroup = $('#consoGroup');
      const optionsGroup = $('#optionsGroup');
      const iagGroup = $('#iagGroup');
      const iagRefGroup = $('#iagRefGroup');
      const cancelGroup = $('#cancelGroup');
      const cancelEnergyLabel = $('#cancelEnergyLabel');
      const cancelIagLabel = $('#cancelIagLabel');
      const contractEnergyCancelled = $('#contractEnergyCancelled');
      const contractIagCancelled = $('#contractIagCancelled');

      // Filters
      const searchName = $('#searchName');
      const filterProvider = $('#filterProvider');
      const filterDate = $('#filterDate');
      const filterType = $('#filterType');
      const sortBy = $('#sortBy');

      // Lists
      const contractsList = $('#contractsList');
      const contractsEmpty = $('#contractsEmpty');
      const contractsCount = $('#contractsCount');

      // Day
      const dayDate = $('#dayDate');
      const dayKpis = $('#dayKpis');
      const dayComparison = $('#dayComparison');
      const dayNote = $('#dayNote');
      const dayContractsList = $('#dayContractsList');
      const dayContractsEmpty = $('#dayContractsEmpty');
      const dayChartEl = $('#dayChart');

      // Week
      const weekDate = $('#weekDate');
      const weekRange = $('#weekRange');
      const weekNumber = $('#weekNumber');
      const weekKpis = $('#weekKpis');
      const weekComparison = $('#weekComparison');
      const weekStats = $('#weekStats');
      const weekContractsList = $('#weekContractsList');
      const weekContractsEmpty = $('#weekContractsEmpty');
      const weekChartEl = $('#weekChart');
      const weeklyGoal = $('#weeklyGoal');
      const weekGoalProgress = $('#weekGoalProgress');
      const weekProjection = $('#weekProjection');

      // Month
      const monthDate = $('#monthDate');
      const monthLabel = $('#monthLabel');
      const monthKpis = $('#monthKpis');
      const monthStats = $('#monthStats');
      const monthlyGoal = $('#monthlyGoal');
      const goalProgress = $('#goalProgress');
      const monthProjection = $('#monthProjection');
      const iagTier = $('#iagTier');
      const monthChartEl = $('#monthChart');

      // Year
      const yearSelect = $('#yearSelect');
      const yearKpis = $('#yearKpis');
      const yearMonthly = $('#yearMonthly');
      const yearChartEl = $('#yearChart');

      // Stats
      const globalKpis = $('#globalKpis');
      const recordsKpis = $('#recordsKpis');
      const globalStats = $('#globalStats');
      const amountBreakdown = $('#amountBreakdown');
      const dailyContractsChartEl = $('#dailyContractsChart');
      const typeDistributionChartEl = $('#typeDistributionChart');

      // Export
      const exportDayDate = $('#exportDayDate');
      const exportDayLieu = $('#exportDayLieu');
      const btnGenerateDay = $('#btnGenerateDay');
      const btnCopyDay = $('#btnCopyDay');
      const btnShareDay = $('#btnShareDay');
      const dayExportPreview = $('#dayExportPreview');
      const exportRangeStart = $('#exportRangeStart');
      const exportRangeEnd = $('#exportRangeEnd');
      const exportMonthDate = $('#exportMonthDate');
      const btnGenerateRange = $('#btnGenerateRange');
      const btnGenerateRangeCompact = $('#btnGenerateRangeCompact');
      const btnGenerateMonth = $('#btnGenerateMonth');
      const btnGenerateMonthCompact = $('#btnGenerateMonthCompact');
      const btnCopyRange = $('#btnCopyRange');
      const btnCopyMonth = $('#btnCopyMonth');
      const btnShareRange = $('#btnShareRange');
      const btnShareMonth = $('#btnShareMonth');
      const rangeExportPreview = $('#rangeExportPreview');
      const monthExportPreview = $('#monthExportPreview');
      const btnExportJSON = $('#btnExportJSON');
      const btnExportCSV = $('#btnExportCSV');
      const btnImportMerge = $('#btnImportMerge');
      const btnImportReplace = $('#btnImportReplace');
      const importFile = $('#importFile');
      const btnRestoreAuto = $('#btnRestoreAuto');
      const restoreStatus = $('#restoreStatus');
      const btnClearAll = $('#btnClearAll');
      const backupStatus = $('#backupStatus');

      // Toast
      const toastContainer = $('#toastContainer');

      // ========== Utilities ==========
      function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
      }

      // Toast avec un bouton d'action (ex: "Annuler" après une suppression).
      function showToastAction(message, actionLabel, onAction, type = 'info', duration = 6000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const span = document.createElement('span');
        span.textContent = message;
        const btn = document.createElement('button');
        btn.className = 'btn-sm';
        btn.style.marginLeft = '12px';
        btn.textContent = actionLabel;
        let used = false;
        btn.onclick = () => {
          if (used) return;
          used = true;
          toast.remove();
          onAction();
        };
        toast.appendChild(span);
        toast.appendChild(btn);
        toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), duration);
      }

      function daysBetween(startStr, endStr) {
        const a = new Date(startStr + 'T00:00:00');
        const b = new Date(endStr + 'T00:00:00');
        return Math.round((b - a) / 86400000);
      }

      function showError(msg) {
        formError.textContent = msg;
        formError.classList.add('show');
      }

      function clearError() {
        formError.textContent = '';
        formError.classList.remove('show');
      }

      async function copyToClipboard(text) {
        try {
          await navigator.clipboard.writeText(text);
          showToast('Copié dans le presse-papier', 'success');
        } catch {
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
          showToast('Copié dans le presse-papier', 'success');
        }
      }

      // ========== IndexedDB ==========
      function openDB() {
        return new Promise((resolve, reject) => {
          const req = indexedDB.open(DB_NAME, DB_VERSION);
          
          req.onupgradeneeded = (e) => {
            const db = e.target.result;
            let store;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            } else {
              store = req.transaction.objectStore(STORE_NAME);
            }
            if (!store.indexNames.contains('date')) store.createIndex('date', 'date', { unique: false });
            if (!store.indexNames.contains('provider')) store.createIndex('provider', 'provider', { unique: false });
            if (!store.indexNames.contains('type')) store.createIndex('type', 'type', { unique: false });
            if (!store.indexNames.contains('reference')) store.createIndex('reference', 'reference', { unique: false });
          };

          req.onsuccess = (e) => resolve(e.target.result);
          req.onerror = (e) => reject(e.target.error);
        });
      }

      async function loadContracts() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        });
      }

      async function saveContract(contract) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.put(contract);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      }

      async function bulkReplaceContracts(newContracts) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.clear();
          newContracts.forEach((c) => store.put(c));
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      }

      async function deleteContract(id) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.delete(id);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      }

      async function clearAllContracts() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.clear();
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      }

      // ========== Business Logic spécifique UI ==========
      // ----- Helpers de mise en forme des exports (style "sections") -----
      const WEEKDAYS_FR = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

      function weekdayShort(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return WEEKDAYS_FR[d.getDay()] || '';
      }

      // "29/06" (jour/mois, sans année)
      function dmShort(dateStr) {
        const p = String(dateStr).split('-');
        return p.length === 3 ? `${p[2]}/${p[1]}` : dateStr;
      }

      function providerLabel(p) {
        if (p === 'PLENITUDE') return 'Plénitude';
        if (p === 'PRIMEO') return 'Primeo';
        if (p === 'IAG') return 'IAG';
        return p || '—';
      }

      // Libellé de type abrégé pour le détail ("Électricité 6-9 kVA" -> "Élec 6-9")
      function shortTypeLabel(c) {
        return contractTypeLabel(c).replace('Électricité', 'Élec').replace(' kVA', '');
      }

      // Répartition des contrats énergie actifs par fournisseur puis par type,
      // avec le nombre de PCP (PleniCoach Premium) et de digitalisations.
      // -> { 'Plénitude': { types:{'Élec 6-9':35,...}, total, pcp, digi }, 'Primeo': {...} }
      function energyBreakdownByProvider(list) {
        const out = {};
        list.forEach((c) => {
          if (!c.type || c.energyCancelled) return; // énergie active uniquement
          const prov = providerLabel(c.provider);
          const entry = out[prov] || (out[prov] = { types: {}, total: 0, pcp: 0, digi: 0 });
          // Sous l'en-tête du fournisseur, on ne répète pas son nom dans le type.
          const label = shortTypeLabel(c).replace(/^Primeo\s+/, '');
          entry.types[label] = (entry.types[label] || 0) + 1;
          entry.total++;
          if (c.axa) entry.pcp++;            // PCP = PleniCoach Premium
          if (c.digitalisation) entry.digi++;
        });
        return out;
      }

      // Nombre de jours distincts ayant au moins un contrat actif (non annulé).
      function countProductionDays(list) {
        const days = new Set();
        list.forEach((c) => {
          const energyActive = c.type && !c.energyCancelled;
          const iagActive = c.iagType && !c.iagCancelled;
          if (energyActive || iagActive) days.add(c.date);
        });
        return days.size;
      }

      // "  Label ........... valeur" — alignement par pointillés sur une largeur cible.
      function dottedLine(label, value, width = 24) {
        const l = String(label);
        const v = String(value);
        const dots = Math.max(2, width - l.length - v.length);
        return `  ${l} ${'.'.repeat(dots)} ${v}`;
      }

      // Bandeau de titre encadré.
      function headerBox(title) {
        const inner = `  ${title}`;
        const width = Math.max(30, inner.length + 2);
        const bar = '═'.repeat(width);
        return `${bar}\n${inner}\n${bar}`;
      }

      // Construit un export texte structuré (Synthèse / Rémunération / Détail).
      // opts: { detail = true, showTarif = false }
      function buildStructuredExport(title, list, opts = {}) {
        const detail = opts.detail !== false;
        const showTarif = !!opts.showTarif;
        const stats = computeStats(list);
        const lines = [];

        lines.push(headerBox(title));
        lines.push('');

        // --- SYNTHÈSE ---
        lines.push('📊 SYNTHÈSE');
        lines.push(dottedLine('Contrats actifs', stats.total));
        lines.push(dottedLine('⚡ Énergie', stats.energy));
        lines.push(dottedLine('🛡️ Assurance', stats.iag));
        if (stats.cancelled > 0) lines.push(dottedLine('🚫 Annulés', stats.cancelled));
        if (stats.energy > 0) {
          // Détail des contrats énergie par fournisseur puis par type.
          const breakdown = energyBreakdownByProvider(list);
          Object.keys(breakdown).forEach((prov) => {
            const e = breakdown[prov];
            const entries = Object.entries(e.types)
              .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
            lines.push('');
            lines.push(`  ${prov.toUpperCase()} (${e.total})`);
            entries.forEach(([label, n]) => lines.push(`    ${label} : ${n}`));
            // PCP / Digitalisation : options propres à Plénitude.
            if (prov === 'Plénitude') {
              lines.push('');
              lines.push(`    PCP : ${e.pcp}`);
              lines.push(`    Digitalisation : ${e.digi}`);
            }
          });
          lines.push('');
          lines.push(`  Taux d'attache assurance : ${stats.attachRate.toFixed(0)} %`);
        }

        // Indicateurs de production (jours travaillés + moyennes).
        const prodDays = countProductionDays(list);
        lines.push('');
        lines.push(dottedLine('Jours de production', prodDays));
        if (prodDays > 0) {
          lines.push(dottedLine('Moy. contrats/jour', (stats.total / prodDays).toFixed(1).replace('.', ',')));
          lines.push(dottedLine('Moy. €/jour', formatEuro(stats.totalAmount / prodDays)));
        }
        if (opts.monthlyGoal > 0) {
          const { contracts: curMonth } = getMonthContracts(contracts, todayStr());
          const curTotal = computeStats(curMonth).total;
          lines.push(dottedLine('Objectif du mois', `${curTotal} / ${opts.monthlyGoal}`));
        }
        lines.push('');

        // --- RÉMUNÉRATION ---
        lines.push('💶 RÉMUNÉRATION');
        lines.push(dottedLine('Énergie', formatEuro(stats.energyAmount)));
        lines.push(dottedLine('Assurance', formatEuro(stats.iagAmount)));
        lines.push('  ' + '─'.repeat(22));
        lines.push(dottedLine('TOTAL', formatEuro(stats.totalAmount)));
        if (showTarif && stats.iag > 0) {
          lines.push(`  (Assurance : ${formatEuro(getIAGTarif(stats.iag))}/u — palier ${stats.iag}/40)`);
        }

        if (!detail) return lines.join('\n');

        // --- DÉTAIL (groupé par jour) ---
        lines.push('');
        lines.push('📋 DÉTAIL');
        if (list.length === 0) {
          lines.push('  Aucun contrat sur la période.');
          return lines.join('\n');
        }

        const byDate = groupByDate(list);
        Object.keys(byDate).sort().forEach((ds) => {
          lines.push(` ▸ ${weekdayShort(ds)} ${dmShort(ds)}`);
          byDate[ds]
            .slice()
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
            .forEach((c) => {
              const isEnergy = !!c.type;
              const hasIag = !!c.iagType;

              // Ligne principale (nom + type + fournisseur)
              if (isEnergy) {
                lines.push(`   • ${c.name} — ${shortTypeLabel(c)} (${providerLabel(c.provider)})`);
              } else {
                lines.push(`   • ${c.name} — Assurance seule`);
              }

              // Ligne secondaire : montant + options/tags
              const tags = [];
              if (isEnergy) {
                if (c.axa) tags.push('Plenicoach');
                if (c.digitalisation) tags.push('Digi');
                if (hasIag) tags.push(`+Assurance${c.iagReference ? ` ${c.iagReference}` : ''}`);
              } else if (hasIag && c.iagReference) {
                tags.push(`réf. ${c.iagReference}`);
              }
              const cl = cancelLabel(c);
              if (cl) tags.push(`🚫 ${cl}`);

              const head = isEnergy
                ? formatEuro(c.energyCancelled ? 0 : calculateAmount(c))
                : '🛡️ Assurance';
              const tail = tags.length ? ` · ${tags.join(' · ')}` : '';
              lines.push(`     ${head}${tail}`);
            });
        });

        return lines.join('\n');
      }

      // Objectif mensuel courant (nombre de contrats), saisi dans l'onglet Mois.
      function currentMonthlyGoal() {
        return parseInt(monthlyGoal.value, 10) || 0;
      }

      // Libellé de type très court pour l'export journalier (ex : "Elec 6kva", "Dual 6+6").
      function compactTypeLabel(c) {
        const t = String(c.type || '');
        if (t === 'DUAL') return contractTypeLabel(c); // "Dual 6+6"
        const map = {
          ELEC_3: 'Elec 3kva', ELEC_6: 'Elec 6kva', ELEC_9: 'Elec 9kva', ELEC_12: 'Elec 12kva',
          PRIMEO_ELEC_6: 'Elec 6kva', PRIMEO_ELEC_9: 'Elec 9kva', PRIMEO_ELEC_12: 'Elec 12kva',
          GAZ_1_6: 'Gaz 1-6kwh', GAZ_6_13: 'Gaz 6-13kwh', GAZ_13_PLUS: 'Gaz 13+kwh',
        };
        return map[t] || t.replace(/_/g, ' ');
      }

      // Export journalier très compact : date, lieu, puis listes par catégorie
      // (Plénitude + PCP, Primeo, Assurance) avec uniquement le type et la référence.
      // Les parties annulées ne sont pas listées.
      function buildDailyCompactExport(dateStr, lieu) {
        const dayContracts = getDayContracts(contracts, dateStr);
        const lines = [];
        lines.push(formatDate(dateStr));
        lines.push((lieu || '').trim().toUpperCase());

        const plen = [];   // Plénitude (et gaz) : "Type [ref] +PCP"
        const primeo = []; // Primeo : type puis "[ref]" sur la ligne suivante
        const assu = [];   // Assurance : références seules

        dayContracts.forEach((c) => {
          // Partie énergie active
          if (c.type && !c.energyCancelled) {
            const label = compactTypeLabel(c);
            if (c.provider === 'PRIMEO') {
              primeo.push(label);
              if (c.reference) primeo.push(`[${c.reference}]`);
            } else {
              const ref = c.reference ? ` [${c.reference}]` : '';
              const pcp = c.axa ? ' +PCP' : '';
              plen.push(`${label}${ref}${pcp}`);
            }
          }
          // Partie assurance active
          if (c.iagType && !c.iagCancelled && c.iagReference) {
            assu.push(c.iagReference);
          }
        });

        if (plen.length) { lines.push(''); lines.push('PLENITUDE'); plen.forEach((l) => lines.push(l)); }
        if (primeo.length) { lines.push(''); lines.push('PRIMEO'); primeo.forEach((l) => lines.push(l)); }
        if (assu.length) { lines.push(''); lines.push('ASSU'); assu.forEach((l) => lines.push(l)); }

        if (!plen.length && !primeo.length && !assu.length) {
          lines.push('');
          lines.push('Aucun contrat ce jour.');
        }

        return lines.join('\n');
      }

      // Export pour une plage de dates libre (du / au). Tolère l'inversion.
      function buildRangeExportText(startStr, endStr, opts = {}) {
        let s = startStr, e = endStr;
        if (s > e) { const t = s; s = e; e = t; }
        const list = getContractsByPeriod(contracts, s, e);
        const title = `EXPORT · ${dmShort(s)} → ${formatDate(e)}`;
        return buildStructuredExport(title, list, { monthlyGoal: currentMonthlyGoal(), ...opts });
      }

      function buildMonthExportText(dateStr, opts = {}) {
        const { contracts: monthContracts } = getMonthContracts(contracts, dateStr);
        const title = `EXPORT · ${getMonthLabel(dateStr)}`;
        return buildStructuredExport(title, monthContracts, { showTarif: true, monthlyGoal: currentMonthlyGoal(), ...opts });
      }

      function toCSV(rows) {
        const esc = (v) => {
          const s = String(v ?? '');
          if (/[\";\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
          return s;
        };
        return rows.map((r) => r.map(esc).join(';')).join('\n');
      }

      function isDuplicateReference(reference, exceptId = null) {
        const refNorm = normalizeReference(reference);
        if (!refNorm) return false;
        return contracts.some((c) => normalizeReference(c.reference) === refNorm && c.id !== exceptId);
      }

      function setEditMode(id) {
        editingId = id;
        formTitle.textContent = '✏️ Modifier un contrat';
        btnSubmitContract.textContent = '💾 Enregistrer modifications';
        btnCancelEdit.style.display = '';
      }

      function clearEditMode() {
        editingId = null;
        formTitle.textContent = '➕ Ajouter un contrat';
        btnSubmitContract.textContent = '➕ Ajouter le contrat';
        btnCancelEdit.style.display = 'none';
      }

      function fillFormFromContract(c) {
        contractDate.value = c.date;
        contractName.value = c.name || '';

        const isIagOnly = !c.type && !!c.iagType;
        contractIagOnly.checked = isIagOnly;

        if (isIagOnly) {
          contractRef.value = c.iagReference || c.reference || '';
          contractProvider.value = '';
          contractType.dataset.provider = '';
          contractType.value = '';
          contractAssurance.checked = false;
          contractIagRef.value = '';
          contractAxa.checked = false;
          contractDigi.checked = false;
          contractEnergyCancelled.checked = false;
          contractIagCancelled.checked = !!c.iagCancelled;
          updateFormFields();
          updateCancelVisibility();
          return;
        }

        contractRef.value = c.reference || '';
        contractProvider.value = c.provider || '';
        contractType.dataset.provider = '';
        updateFormFields();

        contractType.value = c.type || '';
        updateFormFields();

        contractAxa.checked = !!c.axa;
        contractDigi.checked = !!c.digitalisation;

        if (c.type === 'DUAL') {
          // Remap ancienne valeur 6/9 vers 6-9 pour l'UI
          const powerUi = (c.power === '6' || c.power === '9') ? '6-9' : c.power;
          contractPower.value = powerUi || DUAL_POWER[0];
          contractConso.value = c.conso || DUAL_CONSO[0];
        }

        contractAssurance.checked = !!c.iagType;
        contractIagRef.value = c.iagReference || '';

        contractEnergyCancelled.checked = !!c.energyCancelled;
        contractIagCancelled.checked = !!c.iagCancelled;
        updateCancelVisibility();
      }

      // ========== Form Management ==========
      function populateTypeOptions(provider) {
        contractType.innerHTML = '<option value="">-- Choisir --</option>';

        const types = CONTRACT_TYPES[provider];
        if (!types) return;

        const energyGroup = document.createElement('optgroup');
        energyGroup.label = 'Énergie';
        types.ENERGY.forEach((t) => {
          const opt = document.createElement('option');
          opt.value = t.value;
          opt.textContent = t.label;
          energyGroup.appendChild(opt);
        });
        contractType.appendChild(energyGroup);
      }

      function updateFormFields() {
        const iagOnly = !!contractIagOnly.checked;
        const provider = contractProvider.value;
        const type = contractType.value;

        powerGroup.style.display = 'none';
        consoGroup.style.display = 'none';
        optionsGroup.style.display = 'none';
        iagGroup.style.display = 'none';
        iagRefGroup.style.display = 'none';

        contractRefLabel.textContent = 'Référence *';
        contractRef.placeholder = 'Ex: A-12345678, VTCO12345678, 406XXXXX';

        if (iagOnly) {
          energyRow.style.display = 'none';
          contractProvider.required = false;
          contractType.required = false;

          contractProvider.value = '';
          contractType.value = '';
          contractType.dataset.provider = '';

          contractAxa.checked = false;
          contractDigi.checked = false;

          iagGroup.style.display = 'none';
          iagRefGroup.style.display = 'none';

          contractRefLabel.textContent = 'Référence Assurance *';
          contractRef.placeholder = 'Ex: 406XXXXX / A-12345678';
          return;
        }

        energyRow.style.display = '';
        contractProvider.required = true;
        contractType.required = true;

        if (!provider) {
          populateTypeOptions('');
          return;
        }

        if (contractType.dataset.provider !== provider) {
          populateTypeOptions(provider);
          contractType.dataset.provider = provider;
        }

        if (!type) {
          iagGroup.style.display = 'none';
          return;
        }

        const isPlenitude = provider === 'PLENITUDE';

        const showEnergyOptions = isPlenitude && (type === 'DUAL' || ['ELEC_3', 'ELEC_6', 'ELEC_12', 'GAZ_1_6', 'GAZ_6_13', 'GAZ_13_PLUS'].includes(type));

        if (type === 'DUAL') {
          powerGroup.style.display = '';
          consoGroup.style.display = '';

          if (showEnergyOptions) {
            optionsGroup.style.display = '';
          }

          // Affichage des puissances : 3, 6-9, 12
          contractPower.innerHTML = DUAL_POWER.map((p) => `<option value="${p}">${p} kVA</option>`).join('');
          contractConso.innerHTML = DUAL_CONSO.map((c) => `<option value="${c}">${c} kWh</option>`).join('');
        } else if (['ELEC_3', 'ELEC_6', 'ELEC_12', 'GAZ_1_6', 'GAZ_6_13', 'GAZ_13_PLUS', 'PRIMEO_ELEC_6', 'PRIMEO_ELEC_9', 'PRIMEO_ELEC_12'].includes(type)) {
          if (showEnergyOptions) {
            optionsGroup.style.display = '';
          } else {
            contractAxa.checked = false;
            contractDigi.checked = false;
          }
        }

        // Assurance : option dès qu'un contrat énergie est choisi
        iagGroup.style.display = '';
        iagRefGroup.style.display = contractAssurance.checked ? '' : 'none';

        if (!isPlenitude) {
          contractAxa.checked = false;
          contractDigi.checked = false;
        }
      }

      // Affiche les cases d'annulation pour les seules parties présentes
      // (énergie et/ou assurance) du contrat en cours de saisie.
      function updateCancelVisibility() {
        const iagOnly = !!contractIagOnly.checked;
        const hasEnergy = !iagOnly && !!contractProvider.value && !!contractType.value;
        const hasIag = iagOnly || (!iagOnly && contractAssurance.checked);
        if (cancelEnergyLabel) cancelEnergyLabel.style.display = hasEnergy ? '' : 'none';
        if (cancelIagLabel) cancelIagLabel.style.display = hasIag ? '' : 'none';
        if (!hasEnergy && contractEnergyCancelled) contractEnergyCancelled.checked = false;
        if (!hasIag && contractIagCancelled) contractIagCancelled.checked = false;
        if (cancelGroup) cancelGroup.style.display = (hasEnergy || hasIag) ? '' : 'none';
      }

      function refreshForm() {
        updateFormFields();
        updateCancelVisibility();
      }

      contractIagOnly.addEventListener('change', refreshForm);

      contractProvider.addEventListener('change', () => {
        contractType.dataset.provider = '';
        refreshForm();
      });
      contractType.addEventListener('change', refreshForm);
      contractAssurance.addEventListener('change', refreshForm);

      function resetFormUI() {
        addContractForm.reset();
        contractDate.value = todayStr();
        contractIagOnly.checked = false;
        contractType.dataset.provider = '';
        refreshForm();
        clearError();
        clearEditMode();
      }

      btnClearForm.addEventListener('click', resetFormUI);
      btnCancelEdit.addEventListener('click', resetFormUI);

      addContractForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearError();

        const iagOnly = !!contractIagOnly.checked;

        const date = contractDate.value.trim();
        const name = contractName.value.trim().toUpperCase();
        const reference = contractRef.value.trim();
        const provider = contractProvider.value;
        const type = contractType.value;
        const assuranceChecked = contractAssurance.checked;
        const iagReferenceInput = contractIagRef.value.trim();

        if (!date || !name || !reference) {
          showError('Tous les champs obligatoires (*) doivent être remplis.');
          return;
        }

        if (!iagOnly && (!provider || !type)) {
          showError('Veuillez sélectionner le fournisseur et le type énergie.');
          return;
        }

        if (isDuplicateReference(reference, editingId)) {
          const ok = confirm('⚠️ Doublon détecté : cette référence existe déjà. Continuer quand même ?');
          if (!ok) return;
        }

        const base = {
          id: editingId || (Date.now() + '_' + Math.random().toString(36).substr(2, 9)),
          date,
          name,
          reference,
          provider: iagOnly ? 'IAG' : provider,
          type: iagOnly ? null : type,
          power: null,
          conso: null,
          axa: false,
          digitalisation: false,
          iagType: null,
          iagReference: null,
          energyCancelled: false,
          iagCancelled: false,
        };

        if (!iagOnly) {
          const isPlenitude = provider === 'PLENITUDE';

          if (type === 'DUAL') {
            let power = contractPower.value;
            const conso = contractConso.value;
            if (!power || !conso) {
              showError('Veuillez sélectionner la puissance et la consommation.');
              return;
            }

            // Normalisation du palier 6-9 vers 6 pour la grille DUAL_TARIFS
            if (power === '6-9') power = '6';

            base.power = power;
            base.conso = conso;

            if (isPlenitude) {
              base.axa = contractAxa.checked;
              base.digitalisation = contractDigi.checked;
            }
          } else if (['ELEC_3', 'ELEC_6', 'ELEC_12', 'GAZ_1_6', 'GAZ_6_13', 'GAZ_13_PLUS'].includes(type)) {
            if (isPlenitude) {
              base.axa = contractAxa.checked;
              base.digitalisation = contractDigi.checked;
            }
          } else {
            base.axa = false;
            base.digitalisation = false;
          }

          if (assuranceChecked && !iagReferenceInput) {
            showError('Veuillez saisir la référence Assurance.');
            return;
          }

          base.energyCancelled = !!contractEnergyCancelled.checked;

          if (assuranceChecked) {
            base.iagType = 'ASSURANCE';
            base.iagReference = iagReferenceInput ? iagReferenceInput : null;
            base.iagCancelled = !!contractIagCancelled.checked;
          }

          if (base.provider === 'PRIMEO') {
            base.axa = false;
            base.digitalisation = false;
          }
        } else {
          base.iagType = 'ASSURANCE';
          base.iagReference = reference;
          base.axa = false;
          base.digitalisation = false;
          base.power = null;
          base.conso = null;
          base.iagCancelled = !!contractIagCancelled.checked;
        }

        const normalized = normalizeContract(base);

        try {
          await saveContract(normalized);

          const existingIdx = contracts.findIndex((c) => c.id === normalized.id);
          if (existingIdx >= 0) {
            contracts[existingIdx] = normalized;
            showToast('✅ Contrat modifié', 'success');
          } else {
            contracts.push(normalized);
            showToast('✅ Contrat ajouté avec succès', 'success');
          }

          contracts.sort((a, b) => b.date.localeCompare(a.date));
          saveSnapshot();
          resetFormUI();
          renderAll();
        } catch (err) {
          showError(`Erreur lors de l'enregistrement : ${err.message}`);
        }
      });

      // ========== Rendering ==========
      function cancelLabel(c) {
        const e = !!c.energyCancelled, a = !!c.iagCancelled;
        if (e && a) return 'Annulé (énergie + assurance)';
        if (e) return 'Annulé (énergie)';
        if (a) return 'Annulé (assurance)';
        return '';
      }

      // KPI "Annulés" affiché seulement s'il y a au moins une annulation.
      function cancelledKpiHtml(stats) {
        if (!stats.cancelled) return '';
        return `<div class="kpi kpi-cancelled"><div class="kpi-label">🚫 Annulés</div><div class="kpi-value">${stats.cancelled}</div><div class="kpi-sub">Énergie ${stats.cancelledEnergy} / Assurance ${stats.cancelledIag}</div></div>`;
      }

      function renderContractItem(contract) {
        const div = document.createElement('div');
        div.className = 'list-item';
        const cl = cancelLabel(contract);
        if (cl) div.classList.add('cancelled');

        const content = document.createElement('div');
        content.className = 'list-item-content';

        const title = document.createElement('div');
        title.className = 'list-item-title';
        title.textContent = contract.name;

        const meta = document.createElement('div');
        meta.className = 'list-item-meta';

        let metaText = `📅 ${formatDate(contract.date)} • 🔖 ${contract.reference} • `;
        metaText += `${contractTypeLabel(contract)}`;

        if (contract.axa) metaText += ' • Plenicoach';
        if (contract.digitalisation) metaText += ' • Digi';
        if (contract.iagType) metaText += ' • Assurance';
        if (contract.iagReference) metaText += ` • Réf assurance ${contract.iagReference}`;
        if (cl) metaText += ` • 🚫 ${cl}`;

        meta.textContent = metaText;

        content.appendChild(title);
        content.appendChild(meta);

        const actions = document.createElement('div');
        actions.className = 'list-item-actions';

        const badge = document.createElement('span');
        const providerText = contract.provider || 'IAG';
        badge.className = `badge badge-${String(providerText).toLowerCase()}`;
        badge.textContent = providerText === 'IAG' ? 'Assurance' : providerText;

        const amount = document.createElement('div');
        amount.className = 'amount';
        const dispAmount = contract.energyCancelled ? 0 : calculateAmount(contract);
        amount.textContent = formatEuro(dispAmount);
        if (contract.energyCancelled) amount.classList.add('struck');

        const editBtn = document.createElement('button');
        editBtn.className = 'btn-sm btn-ghost';
        editBtn.textContent = '✏️';
        editBtn.title = 'Modifier';
        editBtn.onclick = () => {
          setEditMode(contract.id);
          fillFormFromContract(contract);
          showToast('Mode édition activé', 'info');
          if (currentTab !== 'contrats') {
            document.querySelector('.tab-btn[data-tab="contrats"]').click();
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-sm btn-danger';
        deleteBtn.textContent = '🗑️';
        deleteBtn.title = 'Supprimer';
        deleteBtn.onclick = async () => {
          if (!confirm(`Supprimer le contrat ${contract.name} ?`)) return;
          const removed = { ...contract };
          await deleteContract(removed.id);
          contracts = contracts.filter((c) => c.id !== removed.id);
          if (editingId === removed.id) resetFormUI();
          saveSnapshot();
          renderAll();
          showToastAction('Contrat supprimé', '↩️ Annuler', async () => {
            await saveContract(removed);
            contracts.push(removed);
            contracts.sort((a, b) => b.date.localeCompare(a.date));
            saveSnapshot();
            renderAll();
            showToast('Suppression annulée', 'success');
          }, 'warning');
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn-sm btn-ghost';
        cancelBtn.textContent = '🚫';
        cancelBtn.title = "Annuler / réactiver";
        cancelBtn.onclick = async () => {
          const hasE = !!contract.type, hasA = !!contract.iagType;
          let eC = !!contract.energyCancelled, aC = !!contract.iagCancelled;
          if (hasE && hasA) {
            const ans = prompt("État d'annulation — tape un chiffre :\n1 = Énergie annulée\n2 = Assurance annulée\n3 = Les deux annulées\n0 = Tout réactiver");
            if (ans === null) return;
            if (ans === '1') { eC = true; aC = false; }
            else if (ans === '2') { eC = false; aC = true; }
            else if (ans === '3') { eC = true; aC = true; }
            else if (ans === '0') { eC = false; aC = false; }
            else { showToast('Choix invalide', 'warning'); return; }
          } else if (hasE) {
            eC = !eC;
          } else if (hasA) {
            aC = !aC;
          }
          const updated = { ...contract, energyCancelled: hasE ? eC : false, iagCancelled: hasA ? aC : false };
          try {
            await saveContract(updated);
            const idx = contracts.findIndex((c) => c.id === updated.id);
            if (idx >= 0) contracts[idx] = updated;
            saveSnapshot();
            renderAll();
            const lbl = cancelLabel(updated);
            showToast(lbl ? `Marqué : ${lbl}` : 'Contrat réactivé', 'success');
          } catch (err) {
            showToast('Erreur : ' + err.message, 'error');
          }
        };

        actions.appendChild(badge);
        actions.appendChild(amount);
        actions.appendChild(editBtn);
        actions.appendChild(cancelBtn);
        actions.appendChild(deleteBtn);

        div.appendChild(content);
        div.appendChild(actions);

        return div;
      }

      function renderContractsList() {
        const filters = {
          search: searchName.value,
          provider: filterProvider.value,
          date: filterDate.value,
          type: filterType ? filterType.value : '',
        };

        const filtered = sortContracts(
          filterContracts(contracts, filters),
          sortBy ? sortBy.value : 'date_desc'
        );

        if (contractsCount) {
          const n = filtered.length;
          contractsCount.textContent = n === 0
            ? ''
            : `${n} contrat${n > 1 ? 's' : ''} affiché${n > 1 ? 's' : ''} sur ${contracts.length}`;
        }

        if (filtered.length === 0) {
          contractsList.innerHTML = '';
          contractsList.style.display = 'none';
          contractsEmpty.style.display = '';
          return;
        }

        contractsList.style.display = '';
        contractsEmpty.style.display = 'none';
        contractsList.innerHTML = '';

        filtered.forEach((c) => {
          contractsList.appendChild(renderContractItem(c));
        });
      }

      function renderDay() {
        const date = dayDate.value;
        const dayContracts = getDayContracts(contracts, date);
        const stats = computeStats(dayContracts);

        dayKpis.innerHTML = `
          <div class="kpi"><div class="kpi-label">Total contrats</div><div class="kpi-value">${stats.total}</div></div>
          <div class="kpi"><div class="kpi-label">Énergie</div><div class="kpi-value">${stats.energy}</div></div>
          <div class="kpi"><div class="kpi-label">Assurance</div><div class="kpi-value">${stats.iag}</div></div>
          <div class="kpi"><div class="kpi-label">€ Énergie</div><div class="kpi-value">${formatEuro(stats.energyAmount)}</div></div>
          <div class="kpi"><div class="kpi-label">€ Assurance</div><div class="kpi-value">${formatEuro(stats.iagAmount)}</div><div class="kpi-sub">Tarif: ${formatEuro(getIAGTarif(stats.iag))}</div></div>
          <div class="kpi"><div class="kpi-label">€ Total</div><div class="kpi-value">${formatEuro(stats.totalAmount)}</div></div>
        `;

        dayKpis.insertAdjacentHTML('beforeend', cancelledKpiHtml(stats));

        const prevDate = addDays(date, -1);
        const prevContracts = getDayContracts(contracts, prevDate);
        const prevStats = computeStats(prevContracts);
        dayComparison.innerHTML = `
          <div class="stat-bar">
            <div class="stat-bar-header">
              <div class="stat-bar-title">Comparaison avec la veille (${formatDate(prevDate)})</div>
              <div class="stat-bar-value">${formatSignedNumber(stats.total - prevStats.total)}</div>
            </div>
            <div style="font-size:12px; color:var(--muted); line-height:1.5;">
              Δ Énergie: ${formatSignedNumber(stats.energy - prevStats.energy)} • Δ Assurance: ${formatSignedNumber(stats.iag - prevStats.iag)} • Δ € Énergie: ${formatSignedEuro(stats.energyAmount - prevStats.energyAmount)} • Δ € Assurance: ${formatSignedEuro(stats.iagAmount - prevStats.iagAmount)} • Δ € Total: ${formatSignedEuro(stats.totalAmount - prevStats.totalAmount)}
            </div>
          </div>
        `;

        dayNote.textContent = `Date analysée : ${formatDate(date)}`;

        renderDayChart(stats);

        if (dayContracts.length === 0) {
          dayContractsList.innerHTML = '';
          dayContractsList.style.display = 'none';
          dayContractsEmpty.style.display = '';
          return;
        }

        dayContractsList.style.display = '';
        dayContractsEmpty.style.display = 'none';
        dayContractsList.innerHTML = '';
        dayContracts.forEach((c) => dayContractsList.appendChild(renderContractItem(c)));
      }

      function renderWeek() {
        const date = weekDate.value;
        const { info: week, contracts: weekContracts } = getWeekContracts(contracts, date);
        const stats = computeStats(weekContracts);

        weekRange.textContent = `${formatDate(week.start)} → ${formatDate(week.end)}`;
        weekNumber.textContent = `Semaine ${week.week}`;

        weekKpis.innerHTML = `
          <div class="kpi"><div class="kpi-label">Total contrats</div><div class="kpi-value">${stats.total}</div></div>
          <div class="kpi"><div class="kpi-label">Énergie</div><div class="kpi-value">${stats.energy}</div></div>
          <div class="kpi"><div class="kpi-label">Assurance</div><div class="kpi-value">${stats.iag}</div></div>
          <div class="kpi"><div class="kpi-label">€ Énergie</div><div class="kpi-value">${formatEuro(stats.energyAmount)}</div></div>
          <div class="kpi"><div class="kpi-label">€ Assurance</div><div class="kpi-value">${formatEuro(stats.iagAmount)}</div><div class="kpi-sub">Tarif: ${formatEuro(getIAGTarif(stats.iag))}</div></div>
          <div class="kpi"><div class="kpi-label">€ Total</div><div class="kpi-value">${formatEuro(stats.totalAmount)}</div></div>
        `;

        weekKpis.insertAdjacentHTML('beforeend', cancelledKpiHtml(stats));

        const prevWeekDate = addDays(date, -7);
        const { info: prevWeek, contracts: prevWeekContracts } = getWeekContracts(contracts, prevWeekDate);
        const prevStats = computeStats(prevWeekContracts);
        weekComparison.innerHTML = `
          <div class="stat-bar">
            <div class="stat-bar-header">
              <div class="stat-bar-title">Comparaison avec semaine précédente (S${prevWeek.week} : ${formatDate(prevWeek.start)} → ${formatDate(prevWeek.end)})</div>
              <div class="stat-bar-value">${formatSignedNumber(stats.total - prevStats.total)}</div>
            </div>
            <div style="font-size:12px; color:var(--muted); line-height:1.5;">
              Δ Énergie: ${formatSignedNumber(stats.energy - prevStats.energy)} • Δ Assurance: ${formatSignedNumber(stats.iag - prevStats.iag)} • Δ € Énergie: ${formatSignedEuro(stats.energyAmount - prevStats.energyAmount)} • Δ € Assurance: ${formatSignedEuro(stats.iagAmount - prevStats.iagAmount)} • Δ € Total: ${formatSignedEuro(stats.totalAmount - prevStats.totalAmount)}
            </div>
          </div>
        `;

        weekStats.innerHTML = '';
        Object.entries(stats.byType).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
          const bar = document.createElement('div');
          bar.className = 'stat-bar';
          const pct = stats.total > 0 ? (count / stats.total * 100) : 0;
          bar.innerHTML = `
            <div class="stat-bar-header"><div class="stat-bar-title">${type.replace(/_/g, ' ')}</div><div class="stat-bar-value">${count}</div></div>
            <div class="stat-bar-progress"><div class="stat-bar-fill" style="width:${pct}%"></div></div>
          `;
          weekStats.appendChild(bar);
        });

        renderWeekChart(weekContracts);

        // Objectif hebdomadaire
        const wGoal = parseInt(weeklyGoal.value, 10) || 0;
        if (wGoal > 0) {
          const pct = Math.min(100, (stats.total / wGoal) * 100);
          weekGoalProgress.innerHTML = `
            <div class="stat-bar">
              <div class="stat-bar-header"><div class="stat-bar-title">Progression objectif</div><div class="stat-bar-value">${stats.total} / ${wGoal}</div></div>
              <div class="stat-bar-progress"><div class="stat-bar-fill" style="width:${pct}%"></div></div>
            </div>
            <p style="margin-top:8px; font-size:13px; color:var(--muted);">${pct.toFixed(1)}% de l'objectif hebdo atteint</p>
          `;
        } else {
          weekGoalProgress.innerHTML = '<p style="color:var(--muted); font-size:13px;">Définissez un objectif hebdomadaire ci-dessus.</p>';
        }

        // Projection (uniquement si la semaine en cours contient aujourd'hui)
        const todayW = todayStr();
        if (todayW >= week.start && todayW <= week.end && stats.total > 0) {
          const daysElapsed = Math.min(7, daysBetween(week.start, todayW) + 1);
          const projTotal = Math.round(stats.total / daysElapsed * 7);
          const projEuro = stats.totalAmount / daysElapsed * 7;
          weekProjection.innerHTML = `
            <div class="stat-bar">
              <div class="stat-bar-header"><div class="stat-bar-title">Projection fin de semaine</div><div class="stat-bar-value">≈ ${projTotal}</div></div>
              <div style="font-size:12px; color:var(--muted);">≈ ${formatEuro(projEuro)} — sur la base de ${daysElapsed} jour${daysElapsed > 1 ? 's' : ''} écoulé${daysElapsed > 1 ? 's' : ''}</div>
            </div>
          `;
        } else {
          weekProjection.innerHTML = '';
        }

        weekContractsList.innerHTML = '';
        if (weekContracts.length === 0) {
          weekContractsList.style.display = 'none';
          weekContractsEmpty.style.display = '';
          return;
        }
        weekContractsList.style.display = '';
        weekContractsEmpty.style.display = 'none';
        weekContracts.forEach((c) => weekContractsList.appendChild(renderContractItem(c)));
      }

      function renderMonth() {
        const date = monthDate.value;
        const { contracts: monthContracts } = getMonthContracts(contracts, date);
        const stats = computeStats(monthContracts);

        monthLabel.textContent = getMonthLabel(date);

        monthKpis.innerHTML = `
          <div class="kpi"><div class="kpi-label">Total contrats</div><div class="kpi-value">${stats.total}</div></div>
          <div class="kpi"><div class="kpi-label">Énergie</div><div class="kpi-value">${stats.energy}</div></div>
          <div class="kpi"><div class="kpi-label">Assurance</div><div class="kpi-value">${stats.iag}</div></div>
          <div class="kpi"><div class="kpi-label">% Assurance</div><div class="kpi-value">${stats.total > 0 ? ((stats.iag / stats.total) * 100).toFixed(1) : 0}%</div></div>
          <div class="kpi"><div class="kpi-label">€ Énergie</div><div class="kpi-value">${formatEuro(stats.energyAmount)}</div></div>
          <div class="kpi"><div class="kpi-label">€ Assurance</div><div class="kpi-value">${formatEuro(stats.iagAmount)}</div><div class="kpi-sub">Tarif: ${formatEuro(getIAGTarif(stats.iag))}</div></div>
          <div class="kpi"><div class="kpi-label">€ Total</div><div class="kpi-value">${formatEuro(stats.totalAmount)}</div></div>
          <div class="kpi"><div class="kpi-label">Tarif Assurance</div><div class="kpi-value">${formatEuro(getIAGTarif(stats.iag))}</div><div class="kpi-sub">Par assurance</div></div>
          <div class="kpi"><div class="kpi-label">Taux d'attache assurance</div><div class="kpi-value">${stats.attachRate.toFixed(0)}%</div><div class="kpi-sub">${stats.energyWithIag}/${stats.energy} contrats énergie</div></div>
        `;
        monthKpis.insertAdjacentHTML('beforeend', cancelledKpiHtml(stats));

        monthStats.innerHTML = '';
        Object.entries(stats.byType).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
          const bar = document.createElement('div');
          bar.className = 'stat-bar';
          const pct = stats.total > 0 ? (count / stats.total * 100) : 0;
          bar.innerHTML = `
            <div class="stat-bar-header"><div class="stat-bar-title">${type.replace(/_/g, ' ')}</div><div class="stat-bar-value">${count}</div></div>
            <div class="stat-bar-progress"><div class="stat-bar-fill" style="width:${pct}%"></div></div>
          `;
          monthStats.appendChild(bar);
        });

        const goal = parseInt(monthlyGoal.value, 10) || 0;
        if (goal > 0) {
          const pct = Math.min(100, (stats.total / goal) * 100);
          goalProgress.innerHTML = `
            <div class="stat-bar">
              <div class="stat-bar-header"><div class="stat-bar-title">Progression objectif</div><div class="stat-bar-value">${stats.total} / ${goal}</div></div>
              <div class="stat-bar-progress"><div class="stat-bar-fill" style="width:${pct}%"></div></div>
            </div>
            <p style="margin-top:12px; font-size:13px; color:var(--muted);">${pct.toFixed(1)}% de l'objectif atteint</p>
          `;
        } else {
          goalProgress.innerHTML = '<p style="color:var(--muted); font-size:13px;">Définissez un objectif mensuel ci-dessus.</p>';
        }

        // Projection (si le mois sélectionné est le mois en cours)
        const todayM = todayStr();
        const monthPrefix = date.slice(0, 7);
        if (monthPrefix === todayM.slice(0, 7) && stats.total > 0) {
          const dayNum = parseInt(todayM.slice(8, 10), 10);
          const daysInMonth = new Date(parseInt(monthPrefix.slice(0, 4), 10), parseInt(monthPrefix.slice(5, 7), 10), 0).getDate();
          const projTotal = Math.round(stats.total / dayNum * daysInMonth);
          const projEuro = stats.totalAmount / dayNum * daysInMonth;
          monthProjection.innerHTML = `
            <div class="stat-bar">
              <div class="stat-bar-header"><div class="stat-bar-title">Projection fin de mois</div><div class="stat-bar-value">≈ ${projTotal}</div></div>
              <div style="font-size:12px; color:var(--muted);">≈ ${formatEuro(projEuro)} — sur la base de ${dayNum} jour${dayNum > 1 ? 's' : ''} écoulé${dayNum > 1 ? 's' : ''}</div>
            </div>
          `;
        } else {
          monthProjection.innerHTML = '';
        }

        renderIagTier(iagTier, stats);
        renderMonthChart(monthContracts);
      }

      // Indicateur de progression vers le palier assurance (40 => 20 €/unité).
      function renderIagTier(el, stats) {
        if (!el) return;
        const info = getIAGTierInfo(stats.iag);
        const pct = Math.min(100, (info.count / info.threshold) * 100);
        if (info.reached) {
          el.innerHTML = `
            <div class="stat-bar">
              <div class="stat-bar-header"><div class="stat-bar-title">Palier 20 € atteint ✅</div><div class="stat-bar-value">${info.count} / ${info.threshold}</div></div>
              <div class="stat-bar-progress"><div class="stat-bar-fill" style="width:100%"></div></div>
            </div>
            <p style="margin-top:8px; font-size:13px; color:var(--muted);">Chaque assurance est rémunérée 20 € (${stats.iag} × 20 € = ${formatEuro(stats.iagAmount)}).</p>`;
        } else if (info.count === 0) {
          el.innerHTML = `<p style="color:var(--muted); font-size:13px;">Aucune assurance sur cette période. Le palier 20 €/unité se débloque à ${info.threshold} assurances.</p>`;
        } else {
          el.innerHTML = `
            <div class="stat-bar">
              <div class="stat-bar-header"><div class="stat-bar-title">Vers le palier 20 €</div><div class="stat-bar-value">${info.count} / ${info.threshold}</div></div>
              <div class="stat-bar-progress"><div class="stat-bar-fill" style="width:${pct}%"></div></div>
            </div>
            <p style="margin-top:8px; font-size:13px; color:var(--muted);">Encore <strong>${info.remaining}</strong> assurance${info.remaining > 1 ? 's' : ''} pour passer à <strong>20 €/unité</strong> (actuellement 10 €/unité).</p>`;
        }
      }

      // ========== Vue annuelle ==========
      function populateYearOptions() {
        if (!yearSelect) return;
        const years = new Set(contracts.map((c) => c.date.slice(0, 4)).filter(Boolean));
        years.add(String(new Date().getFullYear()));
        const sorted = Array.from(years).sort((a, b) => b.localeCompare(a));
        const current = yearSelect.value;
        yearSelect.innerHTML = sorted.map((y) => `<option value="${y}">${y}</option>`).join('');
        if (current && sorted.includes(current)) yearSelect.value = current;
        else yearSelect.value = sorted[0];
      }

      function getYearData(year) {
        const prefix = String(year);
        const list = contracts.filter((c) => c.date.slice(0, 4) === prefix);
        const months = [];
        for (let m = 1; m <= 12; m++) {
          const mk = `${prefix}-${String(m).padStart(2, '0')}`;
          const monthContracts = list.filter((c) => c.date.slice(0, 7) === mk);
          months.push({ month: m, contracts: monthContracts, stats: computeStats(monthContracts) });
        }
        return { list, months, stats: computeStats(list) };
      }

      const MONTH_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

      function renderYear() {
        populateYearOptions();
        const year = (yearSelect && yearSelect.value) ? yearSelect.value : String(new Date().getFullYear());
        const { months, stats } = getYearData(year);

        yearKpis.innerHTML = `
          <div class="kpi"><div class="kpi-label">Total contrats</div><div class="kpi-value">${stats.total}</div></div>
          <div class="kpi"><div class="kpi-label">Énergie</div><div class="kpi-value">${stats.energy}</div></div>
          <div class="kpi"><div class="kpi-label">Assurance</div><div class="kpi-value">${stats.iag}</div></div>
          <div class="kpi"><div class="kpi-label">€ Énergie</div><div class="kpi-value">${formatEuro(stats.energyAmount)}</div></div>
          <div class="kpi"><div class="kpi-label">€ Assurance</div><div class="kpi-value">${formatEuro(stats.iagAmount)}</div></div>
          <div class="kpi"><div class="kpi-label">€ Total année</div><div class="kpi-value">${formatEuro(stats.totalAmount)}</div></div>
        `;

        yearMonthly.innerHTML = '';
        let cumul = 0;
        months.forEach((mo) => {
          cumul += mo.stats.totalAmount;
          if (mo.stats.total === 0) return; // n'afficher que les mois avec activité
          const bar = document.createElement('div');
          bar.className = 'stat-bar';
          bar.innerHTML = `
            <div class="stat-bar-header">
              <div class="stat-bar-title">${MONTH_SHORT[mo.month - 1]} ${year}</div>
              <div class="stat-bar-value">${formatEuro(mo.stats.totalAmount)}</div>
            </div>
            <div style="font-size:12px; color:var(--muted); line-height:1.5;">
              ${mo.stats.total} contrats (Énergie ${mo.stats.energy} / Assurance ${mo.stats.iag}) • Cumul annuel ${formatEuro(cumul)}
            </div>
          `;
          yearMonthly.appendChild(bar);
        });
        if (!yearMonthly.children.length) {
          yearMonthly.innerHTML = '<p style="color:var(--muted); font-size:13px;">Aucun contrat sur cette année.</p>';
        }

        renderYearChart(months);
      }

      function renderYearChart(months) {
        if (typeof Chart === 'undefined' || !yearChartEl) return;
        if (yearChart) { yearChart.destroy(); yearChart = null; }

        const labels = months.map((mo) => MONTH_SHORT[mo.month - 1]);
        const contractsData = months.map((mo) => mo.stats.total);
        const euroData = months.map((mo) => mo.stats.totalAmount);

        const ctx = yearChartEl.getContext('2d');
        yearChart = new Chart(ctx, {
          data: {
            labels,
            datasets: [
              { type: 'bar', label: 'Contrats', data: contractsData, backgroundColor: 'rgba(59, 130, 246, 0.5)', yAxisID: 'y' },
              { type: 'line', label: '€ Total', data: euroData, borderColor: '#7cffb2', backgroundColor: 'rgba(124, 255, 178, 0.2)', tension: 0.2, fill: true, pointRadius: 3, yAxisID: 'y1' },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true, position: 'top' } },
            scales: {
              y: { beginAtZero: true, position: 'left', ticks: { precision: 0 }, title: { display: true, text: 'Contrats' } },
              y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: '€' } },
            },
          },
        });
      }

      function renderDayChart(stats) {
        if (typeof Chart === 'undefined' || !dayChartEl) return;

        if (dayChart) {
          dayChart.destroy();
          dayChart = null;
        }

        const ctx = dayChartEl.getContext('2d');
        dayChart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: ['Énergie', 'Assurance'],
            datasets: [
              {
                label: 'Contrats',
                data: [stats.energy, stats.iag],
                backgroundColor: ['#3B82F6', '#EC4899'],
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { precision: 0 },
              },
            },
          },
        });
      }

      function renderWeekChart(weekContracts) {
        if (typeof Chart === 'undefined' || !weekChartEl) return;

        const byDay = groupByDate(weekContracts);
        const dates = Object.keys(byDay).sort();

        if (weekChart) {
          weekChart.destroy();
          weekChart = null;
        }

        if (dates.length === 0) return;

        const labels = dates.map((d) => formatDate(d));
        const energyData = [];
        const iagData = [];

        dates.forEach((d) => {
          const st = computeStats(byDay[d]);
          energyData.push(st.energy);
          iagData.push(st.iag);
        });

        const ctx = weekChartEl.getContext('2d');
        weekChart = new Chart(ctx, {
          type: 'line',
          data: {
            labels,
            datasets: [
              {
                label: 'Énergie',
                data: energyData,
                borderColor: '#3B82F6',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                tension: 0.2,
                fill: true,
                pointRadius: 3,
              },
              {
                label: 'Assurance',
                data: iagData,
                borderColor: '#EC4899',
                backgroundColor: 'rgba(236, 72, 153, 0.2)',
                tension: 0.2,
                fill: true,
                pointRadius: 3,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: true, position: 'top' },
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { precision: 0 },
              },
            },
          },
        });
      }

      function renderMonthChart(monthContracts) {
        if (typeof Chart === 'undefined' || !monthChartEl) return;

        const byDay = groupByDate(monthContracts);
        const dates = Object.keys(byDay).sort();

        if (monthChart) {
          monthChart.destroy();
          monthChart = null;
        }

        if (dates.length === 0) return;

        const labels = dates.map((d) => formatDate(d));
        const energyData = [];
        const iagData = [];

        dates.forEach((d) => {
          const st = computeStats(byDay[d]);
          energyData.push(st.energy);
          iagData.push(st.iag);
        });

        const ctx = monthChartEl.getContext('2d');
        monthChart = new Chart(ctx, {
          type: 'line',
          data: {
            labels,
            datasets: [
              {
                label: 'Énergie',
                data: energyData,
                borderColor: '#3B82F6',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                tension: 0.2,
                fill: true,
                pointRadius: 3,
              },
              {
                label: 'Assurance',
                data: iagData,
                borderColor: '#EC4899',
                backgroundColor: 'rgba(236, 72, 153, 0.2)',
                tension: 0.2,
                fill: true,
                pointRadius: 3,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: true, position: 'top' },
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { precision: 0 },
              },
            },
          },
        });
      }

      function renderCharts(stats, byDay) {
        if (typeof Chart === 'undefined') return;

        // Graphique quotidien (tous les contrats)
        if (dailyContractsChartEl) {
          const dates = Object.keys(byDay).sort();
          const counts = dates.map((d) => computeStats(byDay[d]).total);

          if (dailyContractsChart) {
            dailyContractsChart.destroy();
            dailyContractsChart = null;
          }

          if (dates.length > 0) {
            const ctx = dailyContractsChartEl.getContext('2d');
            dailyContractsChart = new Chart(ctx, {
              type: 'line',
              data: {
                labels: dates.map((d) => formatDate(d)),
                datasets: [
                  {
                    label: 'Contrats par jour',
                    data: counts,
                    borderColor: 'rgba(99, 102, 241, 1)',
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    tension: 0.2,
                    fill: true,
                    pointRadius: 3,
                  },
                ],
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: true, position: 'top' },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: { precision: 0 },
                  },
                },
              },
            });
          }
        }

        // Graphique de répartition par type
        if (typeDistributionChartEl) {
          const entries = Object.entries(stats.byType).sort((a, b) => b[1] - a[1]);

          if (typeDistributionChart) {
            typeDistributionChart.destroy();
            typeDistributionChart = null;
          }

          if (entries.length > 0) {
            const labels = entries.map(([key]) => key.replace(/_/g, ' '));
            const values = entries.map(([, count]) => count);
            const baseColors = [
              '#6366F1', '#F97316', '#10B981', '#EC4899', '#3B82F6',
              '#F59E0B', '#22C55E', '#A855F7', '#EF4444', '#0EA5E9',
            ];
            const colors = values.map((_, idx) => baseColors[idx % baseColors.length]);

            const ctx2 = typeDistributionChartEl.getContext('2d');
            typeDistributionChart = new Chart(ctx2, {
              type: 'doughnut',
              data: {
                labels,
                datasets: [
                  {
                    data: values,
                    backgroundColor: colors,
                    borderWidth: 1,
                  },
                ],
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'right',
                  },
                },
              },
            });
          }
        }
      }

      function renderAmountBreakdown(stats) {
        if (!amountBreakdown) return;
        const totalAmt = stats.totalAmount || 0;
        amountBreakdown.innerHTML = '';
        if (totalAmt === 0) {
          amountBreakdown.innerHTML = '<p style="color:var(--muted); font-size:13px;">Aucune rémunération à afficher.</p>';
          return;
        }

        const addHeading = (txt) => {
          const h = document.createElement('div');
          h.style.cssText = 'font-weight:700; margin:8px 0 6px; color:var(--muted); font-size:13px;';
          h.textContent = txt;
          amountBreakdown.appendChild(h);
        };
        const addBar = (title, amount) => {
          const bar = document.createElement('div');
          bar.className = 'stat-bar';
          const pct = totalAmt > 0 ? (amount / totalAmt * 100) : 0;
          bar.innerHTML = `
            <div class="stat-bar-header"><div class="stat-bar-title">${title}</div><div class="stat-bar-value">${formatEuro(amount)}</div></div>
            <div class="stat-bar-progress"><div class="stat-bar-fill" style="width:${pct}%"></div></div>
            <div style="font-size:11px; color:var(--muted); margin-top:4px;">${pct.toFixed(1)}% de la rémunération</div>
          `;
          amountBreakdown.appendChild(bar);
        };

        addHeading('Par fournisseur');
        addBar('Plénitude (énergie)', stats.providerAmount.PLENITUDE || 0);
        addBar('Primeo (énergie)', stats.providerAmount.PRIMEO || 0);
        addBar('Assurance', stats.iagAmount || 0);

        addHeading('Par type');
        Object.entries(stats.byTypeAmount)
          .sort((a, b) => b[1] - a[1])
          .forEach(([key, amount]) => addBar(key.replace(/_/g, ' '), amount));
      }

      function renderStats() {
        const stats = computeStats(contracts);

        globalKpis.innerHTML = `
          <div class="kpi"><div class="kpi-label">Total contrats</div><div class="kpi-value">${stats.total}</div></div>
          <div class="kpi"><div class="kpi-label">Énergie</div><div class="kpi-value">${stats.energy}</div></div>
          <div class="kpi"><div class="kpi-label">Assurance</div><div class="kpi-value">${stats.iag}</div></div>
          <div class="kpi"><div class="kpi-label">€ Énergie</div><div class="kpi-value">${formatEuro(stats.energyAmount)}</div></div>
          <div class="kpi"><div class="kpi-label">€ Assurance</div><div class="kpi-value">${formatEuro(stats.iagAmount)}</div></div>
          <div class="kpi"><div class="kpi-label">€ Total</div><div class="kpi-value">${formatEuro(stats.totalAmount)}</div></div>
          <div class="kpi"><div class="kpi-label">Taux d'attache assurance</div><div class="kpi-value">${stats.attachRate.toFixed(0)}%</div><div class="kpi-sub">${stats.energyWithIag}/${stats.energy} contrats énergie</div></div>
        `;
        globalKpis.insertAdjacentHTML('beforeend', cancelledKpiHtml(stats));

        renderAmountBreakdown(stats);

        const byDay = groupByDate(contracts);
        const byMonthList = {};
        contracts.forEach((c) => {
          const monthKey = c.date.slice(0, 7);
          (byMonthList[monthKey] = byMonthList[monthKey] || []).push(c);
        });

        // Records exprimés en "items" (comme le Total) pour rester cohérents.
        const bestDay = Object.entries(byDay)
          .map(([d, list]) => [d, computeStats(list).total])
          .sort((a, b) => b[1] - a[1])[0] || ['--', 0];
        const bestMonth = Object.entries(byMonthList)
          .map(([m, list]) => [m, computeStats(list).total])
          .sort((a, b) => b[1] - a[1])[0] || ['--', 0];

        recordsKpis.innerHTML = `
          <div class="kpi"><div class="kpi-label">Meilleur jour</div><div class="kpi-value">${bestDay[1]}</div><div class="kpi-sub">${bestDay[0] !== '--' ? formatDate(bestDay[0]) : '--'}</div></div>
          <div class="kpi"><div class="kpi-label">Meilleur mois</div><div class="kpi-value">${bestMonth[1]}</div><div class="kpi-sub">${bestMonth[0] !== '--' ? getMonthLabel(bestMonth[0] + '-01') : '--'}</div></div>
        `;

        globalStats.innerHTML = '';
        Object.entries(stats.byType).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
          const bar = document.createElement('div');
          bar.className = 'stat-bar';
          const pct = stats.total > 0 ? (count / stats.total * 100) : 0;
          bar.innerHTML = `
            <div class="stat-bar-header"><div class="stat-bar-title">${type.replace(/_/g, ' ')}</div><div class="stat-bar-value">${count}</div></div>
            <div class="stat-bar-progress"><div class="stat-bar-fill" style="width:${pct}%"></div></div>
          `;
          globalStats.appendChild(bar);
        });

        renderCharts(stats, byDay);
      }

      function renderAll() {
        renderContractsList();
        if (currentTab === 'jour') renderDay();
        if (currentTab === 'semaine') renderWeek();
        if (currentTab === 'mois') renderMonth();
        if (currentTab === 'annee') renderYear();
        if (currentTab === 'stats') renderStats();
        updateBackupStatus();
      }

      // ========== Tabs ==========
      tabBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const tab = btn.dataset.tab;
          tabBtns.forEach((b) => b.classList.remove('active'));
          tabContents.forEach((c) => c.classList.remove('active'));
          btn.classList.add('active');
          document.querySelector(`#tab-${tab}`).classList.add('active');
          currentTab = tab;
          renderAll();
        });
      });

      // ========== Filters ==========
      searchName.addEventListener('input', renderContractsList);
      filterProvider.addEventListener('change', renderContractsList);
      filterDate.addEventListener('change', renderContractsList);
      if (filterType) filterType.addEventListener('change', renderContractsList);
      if (sortBy) sortBy.addEventListener('change', renderContractsList);
      dayDate.addEventListener('change', renderDay);
      weekDate.addEventListener('change', renderWeek);
      monthDate.addEventListener('change', renderMonth);
      if (yearSelect) yearSelect.addEventListener('change', renderYear);

      monthlyGoal.addEventListener('change', () => {
        const val = parseInt(monthlyGoal.value, 10) || 0;
        localStorage.setItem(STORAGE_KEYS.goal, val.toString());
        renderMonth();
      });

      if (weeklyGoal) weeklyGoal.addEventListener('change', () => {
        const val = parseInt(weeklyGoal.value, 10) || 0;
        localStorage.setItem(STORAGE_KEYS.weeklyGoal, val.toString());
        renderWeek();
      });

      // ========== Export handlers ==========
      btnGenerateDay.addEventListener('click', () => {
        const d = exportDayDate.value || todayStr();
        const lieu = (exportDayLieu.value || '').trim();
        if (!lieu) { showToast('Renseigne le lieu avant de générer', 'warning'); exportDayLieu.focus(); return; }
        localStorage.setItem(STORAGE_KEYS.dailyLieu, lieu);
        dayExportPreview.textContent = buildDailyCompactExport(d, lieu);
        showToast('Export journalier généré', 'success');
      });

      btnCopyDay.addEventListener('click', () => {
        const text = dayExportPreview.textContent || '';
        if (!text.trim()) { showToast("Génère d'abord l'export journalier", 'warning'); return; }
        copyToClipboard(text);
      });

      btnShareDay.addEventListener('click', () => shareText(dayExportPreview.textContent || ''));

      btnGenerateRange.addEventListener('click', () => {
        const s = exportRangeStart.value, e = exportRangeEnd.value;
        if (!s || !e) { showToast('Choisis une date de début et de fin', 'warning'); return; }
        rangeExportPreview.textContent = buildRangeExportText(s, e);
        showToast('Export généré', 'success');
      });

      btnGenerateRangeCompact.addEventListener('click', () => {
        const s = exportRangeStart.value, e = exportRangeEnd.value;
        if (!s || !e) { showToast('Choisis une date de début et de fin', 'warning'); return; }
        rangeExportPreview.textContent = buildRangeExportText(s, e, { detail: false });
        showToast('Récap généré', 'success');
      });

      btnGenerateMonth.addEventListener('click', () => {
        const d = exportMonthDate.value || todayStr();
        monthExportPreview.textContent = buildMonthExportText(d);
        showToast('Export mois généré', 'success');
      });

      btnGenerateMonthCompact.addEventListener('click', () => {
        const d = exportMonthDate.value || todayStr();
        monthExportPreview.textContent = buildMonthExportText(d, { detail: false });
        showToast('Récap mois généré', 'success');
      });

      btnCopyRange.addEventListener('click', () => {
        const text = rangeExportPreview.textContent || '';
        if (!text.trim()) {
          showToast("Génère d'abord un export", 'warning');
          return;
        }
        copyToClipboard(text);
      });

      btnCopyMonth.addEventListener('click', () => {
        const text = monthExportPreview.textContent || '';
        if (!text.trim()) {
          showToast("Génère d'abord un export mois", 'warning');
          return;
        }
        copyToClipboard(text);
      });

      async function shareText(text) {
        if (!text || !text.trim()) {
          showToast("Génère d'abord un export", 'warning');
          return;
        }
        if (navigator.share) {
          try {
            await navigator.share({ text });
          } catch (e) { /* partage annulé par l'utilisateur */ }
        } else {
          copyToClipboard(text);
          showToast('Partage non disponible — copié dans le presse-papier', 'info');
        }
      }

      btnShareRange.addEventListener('click', () => shareText(rangeExportPreview.textContent || ''));
      btnShareMonth.addEventListener('click', () => shareText(monthExportPreview.textContent || ''));

      function downloadText(filename, text, mime = 'text/plain') {
        const blob = new Blob([text], { type: `${mime};charset=utf-8` });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }

      // ========== Sécurité des données (sauvegardes) ==========
      function updateBackupStatus() {
        if (!backupStatus) return;
        const last = localStorage.getItem(STORAGE_KEYS.lastBackup);
        if (!last) {
          backupStatus.textContent = contracts.length
            ? "⚠️ Aucune sauvegarde JSON n'a encore été faite. Exportez vos données pour les sécuriser."
            : 'Aucune sauvegarde pour le moment.';
          return;
        }
        const when = formatDate(new Date(last).toISOString().slice(0, 10));
        const days = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
        if (days <= 0) {
          backupStatus.textContent = `✅ Dernière sauvegarde : aujourd'hui (${when}).`;
        } else {
          backupStatus.textContent = `Dernière sauvegarde : ${when} (il y a ${days} jour${days > 1 ? 's' : ''}).`
            + (days >= 7 ? ' ⚠️ Pensez à exporter une nouvelle sauvegarde.' : '');
        }
      }

      function maybeRemindBackup() {
        if (!contracts.length) return;
        const last = localStorage.getItem(STORAGE_KEYS.lastBackup);
        const stale = !last || (Date.now() - new Date(last).getTime()) > 7 * 86400000;
        if (stale) {
          setTimeout(() => showToast('💾 Pensez à exporter une sauvegarde JSON (onglet Export)', 'warning'), 1200);
        }
      }

      // Snapshot automatique local : filet de sécurité contre un effacement /
      // remplacement accidentel. Mis à jour à chaque modification sûre.
      function saveSnapshot() {
        try {
          localStorage.setItem(STORAGE_KEYS.autoSnapshot, JSON.stringify({
            savedAt: new Date().toISOString(),
            contracts,
          }));
        } catch (e) { /* quota dépassé : on ignore */ }
        updateRestoreStatus();
      }

      function updateRestoreStatus() {
        if (!restoreStatus) return;
        const raw = localStorage.getItem(STORAGE_KEYS.autoSnapshot);
        if (!raw) { restoreStatus.textContent = 'Aucune sauvegarde automatique pour le moment.'; return; }
        try {
          const snap = JSON.parse(raw);
          const n = (snap.contracts || []).length;
          const when = formatDate(new Date(snap.savedAt).toISOString().slice(0, 10));
          restoreStatus.textContent = `↩️ Sauvegarde auto : ${n} contrat${n > 1 ? 's' : ''}, du ${when}.`;
        } catch { restoreStatus.textContent = ''; }
      }

      btnExportJSON.addEventListener('click', () => {
        const payload = {
          version: 1,
          exportedAt: new Date().toISOString(),
          contracts,
          goal: parseInt(monthlyGoal.value, 10) || 0,
          weeklyGoal: weeklyGoal ? (parseInt(weeklyGoal.value, 10) || 0) : 0,
        };
        downloadText(`remuneration_backup_${todayStr()}.json`, JSON.stringify(payload, null, 2), 'application/json');
        localStorage.setItem(STORAGE_KEYS.lastBackup, new Date().toISOString());
        updateBackupStatus();
        showToast('Backup JSON téléchargé', 'success');
      });

      btnExportCSV.addEventListener('click', () => {
        const rows = [
          ['id', 'date', 'name', 'reference', 'provider', 'type', 'power', 'conso', 'axa', 'digitalisation', 'iagType', 'iagReference', 'energyCancelled', 'iagCancelled', 'amount'],
        ];
        contracts.forEach((c) => {
          rows.push([
            c.id,
            c.date,
            c.name,
            c.reference,
            c.provider,
            c.type ?? '',
            c.power ?? '',
            c.conso ?? '',
            c.axa ? 1 : 0,
            c.digitalisation ? 1 : 0,
            c.iagType ?? '',
            c.iagReference ?? '',
            c.energyCancelled ? 1 : 0,
            c.iagCancelled ? 1 : 0,
            c.energyCancelled ? 0 : calculateAmount(c),
          ]);
        });
        downloadText(`remuneration_contracts_${todayStr()}.csv`, toCSV(rows), 'text/csv');
        showToast('CSV téléchargé', 'success');
      });

      let importMode = 'merge';
      btnImportMerge.addEventListener('click', () => { importMode = 'merge'; importFile.value = ''; importFile.click(); });
      btnImportReplace.addEventListener('click', () => { importMode = 'replace'; importFile.value = ''; importFile.click(); });

      importFile.addEventListener('change', async () => {
        const file = importFile.files && importFile.files[0];
        if (!file) return;
        try {
          const txt = await file.text();
          const data = JSON.parse(txt);
          const imported = sanitizeContracts(data.contracts || data);

          if (importMode === 'replace') {
            if (!confirm(`Remplacer TOUTES les données par ${imported.length} contrat(s) importé(s) ? Vos contrats actuels seront supprimés (une sauvegarde auto est conservée pour annuler).`)) return;
            saveSnapshot(); // conserve l'état actuel AVANT le remplacement
            await bulkReplaceContracts(imported);
            contracts = imported;
            contracts.sort((a, b) => b.date.localeCompare(a.date));
            showToast('Import (remplacement) terminé', 'success');
          } else {
            // Fusion : on conserve l'existant ; un même id est mis à jour.
            const byId = new Map(contracts.map((c) => [c.id, c]));
            let added = 0, updated = 0;
            imported.forEach((c) => {
              if (byId.has(c.id)) updated++; else added++;
              byId.set(c.id, c);
            });
            const merged = Array.from(byId.values());
            await bulkReplaceContracts(merged);
            contracts = merged;
            contracts.sort((a, b) => b.date.localeCompare(a.date));
            saveSnapshot(); // nouvel état sûr après fusion
            showToast(`Fusion : ${added} ajouté(s), ${updated} mis à jour`, 'success');
          }

          if (data.goal !== undefined) {
            monthlyGoal.value = data.goal;
            localStorage.setItem(STORAGE_KEYS.goal, String(data.goal));
          }
          if (data.weeklyGoal !== undefined && weeklyGoal) {
            weeklyGoal.value = data.weeklyGoal;
            localStorage.setItem(STORAGE_KEYS.weeklyGoal, String(data.weeklyGoal));
          }
          resetFormUI();
          renderAll();
          updateBackupStatus();
        } catch (err) {
          showToast(`Import JSON échoué: ${err.message}`, 'error');
        }
      });

      btnRestoreAuto.addEventListener('click', async () => {
        const raw = localStorage.getItem(STORAGE_KEYS.autoSnapshot);
        if (!raw) { showToast('Aucune sauvegarde auto disponible', 'warning'); return; }
        let snap;
        try { snap = JSON.parse(raw); } catch { showToast('Sauvegarde auto illisible', 'error'); return; }
        const restored = sanitizeContracts(snap.contracts || []);
        if (!confirm(`Restaurer ${restored.length} contrat(s) de la sauvegarde auto ? Les données actuelles seront remplacées.`)) return;
        await bulkReplaceContracts(restored);
        contracts = restored;
        contracts.sort((a, b) => b.date.localeCompare(a.date));
        resetFormUI();
        renderAll();
        updateBackupStatus();
        showToast('Sauvegarde auto restaurée', 'success');
      });

      btnClearAll.addEventListener('click', async () => {
        if (!confirm('Tout effacer ? Une sauvegarde auto est conservée pour pouvoir restaurer.')) return;
        saveSnapshot(); // capture l'état actuel avant effacement
        await clearAllContracts();
        contracts = [];
        resetFormUI();
        renderAll();
        updateBackupStatus();
        showToast('Toutes les données ont été effacées (restaurable via « ↩️ Restaurer »)', 'warning');
      });

      // ========== Theme ==========
      themeToggle.addEventListener('change', () => {
        const theme = themeToggle.value;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(STORAGE_KEYS.theme, theme);
        showToast('Thème appliqué', 'success');
      });

      // ========== PWA : installation, hors-ligne, service worker ==========
      let deferredPrompt = null;

      function updateOnlineStatus() {
        if (offlineBadge) offlineBadge.style.display = navigator.onLine ? 'none' : '';
      }
      window.addEventListener('online', updateOnlineStatus);
      window.addEventListener('offline', updateOnlineStatus);
      updateOnlineStatus();

      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (btnInstall) btnInstall.style.display = '';
      });
      if (btnInstall) {
        btnInstall.addEventListener('click', async () => {
          if (!deferredPrompt) return;
          deferredPrompt.prompt();
          await deferredPrompt.userChoice;
          deferredPrompt = null;
          btnInstall.style.display = 'none';
        });
      }
      window.addEventListener('appinstalled', () => {
        if (btnInstall) btnInstall.style.display = 'none';
        showToast('✅ Application installée', 'success');
      });

      if ('serviceWorker' in navigator) {
        // Auto-récupération : si un nouveau service worker prend le contrôle
        // (déploiement d'une mise à jour), on recharge une seule fois pour
        // éviter qu'un app.js périmé du cache ne soit servi avec un HTML neuf.
        // On ne recharge que sur une MISE À JOUR (un contrôleur existait déjà),
        // pas lors de la toute première installation.
        const hadController = !!navigator.serviceWorker.controller;
        let reloading = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (reloading || !hadController) return;
          reloading = true;
          window.location.reload();
        });
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('./sw.js').catch(() => {});
        });
      }

      // ========== Init ==========
      async function init() {
        const today = todayStr();
        currentDateEl.textContent = formatDate(today);

        contractDate.value = today;
        dayDate.value = today;
        weekDate.value = today;
        monthDate.value = today;
        exportDayDate.value = today;
        exportDayLieu.value = localStorage.getItem(STORAGE_KEYS.dailyLieu) || '';
        exportRangeStart.value = today.slice(0, 8) + '01'; // 1er du mois courant
        exportRangeEnd.value = today;
        exportMonthDate.value = today;

        const savedTheme = localStorage.getItem(STORAGE_KEYS.theme) || 'auto';
        themeToggle.value = savedTheme;
        document.documentElement.setAttribute('data-theme', savedTheme);

        const savedGoal = localStorage.getItem(STORAGE_KEYS.goal);
        if (savedGoal) monthlyGoal.value = savedGoal;

        const savedWeeklyGoal = localStorage.getItem(STORAGE_KEYS.weeklyGoal);
        if (savedWeeklyGoal && weeklyGoal) weeklyGoal.value = savedWeeklyGoal;

        try {
          contracts = sanitizeContracts(await loadContracts());
          contracts.sort((a, b) => b.date.localeCompare(a.date));
        } catch (err) {
          console.error('Error loading contracts:', err);
          contracts = [];
        }

        populateYearOptions();
        refreshForm();
        renderAll();
        updateBackupStatus();
        maybeRemindBackup();
        if (contracts.length) saveSnapshot(); else updateRestoreStatus();

        showToast('✅ Application chargée', 'success');
      }

      init();
    })();
