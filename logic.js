(function(global) {
  'use strict';

  // Tarif / barèmes
  const TARIFS = {
    // Élec seule PLENITUDE
    ELEC_3: 5,   // 3 kVA = 5 €
    ELEC_6_9: 20,  // 6-9 kVA = 20 € (fusion)
    ELEC_12: 25, // 12 kVA et plus = 25 €

    // Primeo (inchangé pour l'instant)
    PRIMEO_ELEC_6: 10,
    PRIMEO_ELEC_9: 15,
    PRIMEO_ELEC_12: 20,

    // Options PLENITUDE
    AXA: 5,
    DIGI: 1.5,

    // Gaz seule PLENITUDE
    GAZ_1_6: 5,      // 1 à 6 kWh
    GAZ_6_13: 20,    // 6 à 13 kWh
    GAZ_13_PLUS: 25, // 13 kWh et plus
  };

  const DUAL_TARIFS = {
    // 3 kVA
    '3|1-6': 10,  // 1 à 6 kWh
    '3|6-13': 25, // 6 à 13 kWh
    '3|13+': 30,  // 13+ kWh

    // 6–9 kVA (fusionnés sous 6-9 en UI, mais stockés 6 ou 9 côté data)
    '6|1-6': 25,
    '6|6-13': 40,
    '6|13+': 45,
    '9|1-6': 25,
    '9|6-13': 40,
    '9|13+': 45,

    // 12 kVA et plus
    '12|1-6': 30,
    '12|6-13': 45,
    '12|13+': 50,
  };

  function todayStr() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }

  function addDays(dateStr, deltaDays) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + deltaDays);
    return d.toISOString().slice(0, 10);
  }

  function formatDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  function formatEuro(amount) {
    return amount.toFixed(2).replace('.', ',') + ' €';
  }

  function formatSignedNumber(n) {
    if (n > 0) return `+${n}`;
    return `${n}`;
  }

  function formatSignedEuro(delta) {
    if (delta === 0) return formatEuro(0);
    const sign = delta > 0 ? '+' : '-';
    return sign + formatEuro(Math.abs(delta));
  }

  function getWeekNumber(d) {
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    return 1 + Math.ceil((firstThursday - target) / 604800000);
  }

  function getWeekRange(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      start: monday.toISOString().slice(0, 10),
      end: sunday.toISOString().slice(0, 10),
      week: getWeekNumber(monday)
    };
  }

  function getMonthLabel(dateStr) {
    const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const [y, m] = dateStr.split('-');
    return `${months[parseInt(m, 10) - 1]} ${y}`;
  }

  function getIAGTarif(nbIAG) {
    if (nbIAG <= 0) return 0;
    if (nbIAG <= 39) return 10;
    return 20;
  }

  function calculateAmount(contract) {
    let amount = 0;
    if (!contract.type) return 0;

    if (String(contract.type).startsWith('PRIMEO_')) {
      amount = TARIFS[contract.type] || 0;
    } else if (contract.type === 'DUAL') {
      const key = `${contract.power}|${contract.conso}`;
      amount = DUAL_TARIFS[key] || 0;
    } else {
      // Normalisation ELEC_6 et ELEC_9 -> ELEC_6_9 pour la rémunération
      const typeKey = (contract.type === 'ELEC_6' || contract.type === 'ELEC_9') ? 'ELEC_6_9' : contract.type;
      amount = TARIFS[typeKey] || 0;
    }

    const allowOptions = contract.provider === 'PLENITUDE';
    if (allowOptions) {
      if (contract.axa) amount += TARIFS.AXA;
      if (contract.digitalisation) amount += TARIFS.DIGI;
    }
    return amount;
  }

  function computeStats(contractsSubset) {
    const stats = {
      total: 0,
      energy: 0,
      iag: 0,
      energyWithIag: 0,
      cancelledEnergy: 0,
      cancelledIag: 0,
      cancelled: 0,
      plenitude: 0,
      primeo: 0,
      byType: {},
      byTypeAmount: {},
      providerAmount: { PLENITUDE: 0, PRIMEO: 0 },
      energyAmount: 0,
      iagAmount: 0,
      totalAmount: 0
    };

    contractsSubset.forEach((c) => {
      const isEnergy = !!c.type;
      const hasIag = !!c.iagType;
      // Une partie annulée n'est plus comptée (ni stats, ni rémunération),
      // mais on la recense séparément pour l'afficher dans les résumés.
      const energyActive = isEnergy && !c.energyCancelled;
      const iagActive = hasIag && !c.iagCancelled;

      if (isEnergy && c.energyCancelled) stats.cancelledEnergy++;
      if (hasIag && c.iagCancelled) stats.cancelledIag++;

      // Comptage par "item" : un contrat énergie + assurance compte pour 2
      // (deux lignes rémunérées). byType reste cohérent avec stats.total,
      // de sorte que la somme des catégories = total (les % font bien 100 %).
      if (energyActive) {
        stats.energy++;
        stats.total++;
        if (iagActive) stats.energyWithIag++;
        const typeKey = c.type + (c.type === 'DUAL' ? `_${c.power}_${c.conso}` : '');
        const amt = calculateAmount(c);
        stats.byType[typeKey] = (stats.byType[typeKey] || 0) + 1;
        stats.byTypeAmount[typeKey] = (stats.byTypeAmount[typeKey] || 0) + amt;
        stats.energyAmount += amt;
        if (c.provider === 'PRIMEO') { stats.primeo++; stats.providerAmount.PRIMEO += amt; }
        else { stats.plenitude++; stats.providerAmount.PLENITUDE += amt; }
      }
      if (iagActive) {
        stats.iag++;
        stats.total++;
        stats.byType.ASSURANCE = (stats.byType.ASSURANCE || 0) + 1;
      }
      if (!isEnergy && !hasIag) {
        stats.byType.SANS_TYPE = (stats.byType.SANS_TYPE || 0) + 1;
      }
    });

    stats.cancelled = stats.cancelledEnergy + stats.cancelledIag;

    const iagTarif = getIAGTarif(stats.iag);
    stats.iagAmount = stats.iag * iagTarif;
    if (stats.iag > 0) stats.byTypeAmount.ASSURANCE = stats.iagAmount;
    // Taux d'attache : part des contrats énergie qui embarquent une assurance.
    stats.attachRate = stats.energy > 0 ? (stats.energyWithIag / stats.energy) * 100 : 0;
    stats.totalAmount = stats.energyAmount + stats.iagAmount;
    return stats;
  }

  // Progression vers le palier assurance (40 assurances => 20 € l'unité).
  function getIAGTierInfo(nbIAG) {
    const THRESHOLD = 40;
    if (nbIAG >= THRESHOLD) {
      return { count: nbIAG, threshold: THRESHOLD, currentTarif: 20, nextTarif: null, remaining: 0, reached: true };
    }
    return {
      count: nbIAG,
      threshold: THRESHOLD,
      currentTarif: nbIAG > 0 ? 10 : 0,
      nextTarif: 20,
      remaining: THRESHOLD - nbIAG,
      reached: false,
    };
  }

  // Code court d'un Dual selon puissance (kVA) et consommation (kWh).
  // Palier conso 1-6 kWh => "-6", 6-13 kWh => "+6", 13+ kWh => "+13".
  // Ex : 6 kVA + 6-13 kWh => "6+6" ; 3 kVA + 1-6 kWh => "3-6" ; 12 kVA + 13+ kWh => "12+13".
  const DUAL_CONSO_SUFFIX = { '1-6': '-6', '6-13': '+6', '13+': '+13' };
  function dualCode(power, conso) {
    const p = (power === '9' || power === '6-9') ? '6' : String(power || '');
    const suffix = DUAL_CONSO_SUFFIX[conso] || (conso ? `?${conso}` : '');
    return p + suffix;
  }

  function contractTypeLabel(c) {
    if (!c.type && c.iagType) return 'Assurance seule';
    if (c.type === 'DUAL') return `Dual ${dualCode(c.power, c.conso)}`;
    const t = String(c.type || '');
    if (t.startsWith('PRIMEO_')) return t.replace('PRIMEO_ELEC_', 'Primeo Élec ').replace('PRIMEO_', 'Primeo ');
    // Fusion visuelle de ELEC_6 / ELEC_9 en "Électricité 6-9 kVA"
    if (t === 'ELEC_6' || t === 'ELEC_9') return 'Électricité 6-9 kVA';
    if (t === 'ELEC_3') return 'Électricité 3 kVA';
    if (t === 'ELEC_12') return 'Électricité 12 kVA';
    if (t === 'GAZ_1_6') return 'Gaz 1-6 kWh';
    if (t === 'GAZ_6_13') return 'Gaz 6-13 kWh';
    if (t === 'GAZ_13_PLUS') return 'Gaz 13+ kWh';
    return t.replace(/_/g, ' ');
  }

  // -------- Gestion des listes / périodes --------
  // Catégorie "métier" d'un contrat, pour le filtre par type.
  function contractCategory(c) {
    if (!c.type && c.iagType) return 'ASSURANCE';
    const t = String(c.type || '');
    if (t === 'DUAL') return 'DUAL';
    if (t.startsWith('PRIMEO_')) return 'PRIMEO';
    if (t.startsWith('GAZ')) return 'GAZ';
    if (t.startsWith('ELEC')) return 'ELEC';
    return 'AUTRE';
  }

  function filterContracts(list, filters) {
    return list.filter((c) => {
      if (filters.search) {
        const search = filters.search.toLowerCase();
        const name = (c.name || '').toLowerCase();
        const ref = (c.reference || '').toLowerCase();
        const iagRef = (c.iagReference || '').toLowerCase();
        if (!name.includes(search) && !ref.includes(search) && !iagRef.includes(search)) return false;
      }
      if (filters.provider && c.provider !== filters.provider) return false;
      if (filters.date && c.date !== filters.date) return false;
      if (filters.type) {
        // "Assurance" = tout contrat incluant une assurance (attachée ou seule).
        // Les autres types filtrent sur la catégorie énergie principale.
        if (filters.type === 'CANCELLED') {
          if (!c.energyCancelled && !c.iagCancelled) return false;
        } else if (filters.type === 'ASSURANCE') {
          if (!c.iagType) return false;
        } else if (contractCategory(c) !== filters.type) {
          return false;
        }
      }
      return true;
    });
  }

  // Tri de la liste des contrats selon une clé choisie dans l'UI.
  function sortContracts(list, sortKey) {
    const arr = list.slice();
    const byName = (a, b) => (a.name || '').localeCompare(b.name || '');
    switch (sortKey) {
      case 'date_asc':
        arr.sort((a, b) => a.date.localeCompare(b.date) || byName(a, b));
        break;
      case 'name_asc':
        arr.sort((a, b) => byName(a, b) || b.date.localeCompare(a.date));
        break;
      case 'amount_desc':
        arr.sort((a, b) => calculateAmount(b) - calculateAmount(a) || b.date.localeCompare(a.date));
        break;
      case 'amount_asc':
        arr.sort((a, b) => calculateAmount(a) - calculateAmount(b) || b.date.localeCompare(a.date));
        break;
      case 'date_desc':
      default:
        arr.sort((a, b) => b.date.localeCompare(a.date) || byName(a, b));
        break;
    }
    return arr;
  }

  function getContractsByPeriod(list, startDate, endDate) {
    return list.filter((c) => c.date >= startDate && c.date <= endDate);
  }

  function groupByDate(list) {
    const map = {};
    list.forEach((c) => {
      map[c.date] = map[c.date] || [];
      map[c.date].push(c);
    });
    return map;
  }

  function getDayContracts(allContracts, dateStr) {
    return allContracts.filter((c) => c.date === dateStr);
  }

  function getWeekContracts(allContracts, dateStr) {
    const info = getWeekRange(dateStr);
    const subset = getContractsByPeriod(allContracts, info.start, info.end);
    return { info, contracts: subset };
  }

  function getMonthContracts(allContracts, dateStr) {
    const monthPrefix = dateStr.slice(0, 7);
    const subset = allContracts.filter((c) => c.date.startsWith(monthPrefix));
    return { month: monthPrefix, contracts: subset };
  }

  // -------- Normalisation / nettoyage --------
  function normalizeReference(ref) {
    return String(ref || '').trim().toLowerCase();
  }

  function normalizeContract(raw) {
    const out = { ...raw };

    if (out.reference === undefined && out.ref !== undefined) out.reference = out.ref;
    if (out.digitalisation === undefined && out.digi !== undefined) out.digitalisation = !!out.digi;
    if (out.axa === undefined && out.AXA !== undefined) out.axa = !!out.AXA;
    if (!out.id) out.id = Date.now() + '_' + Math.random().toString(36).slice(2);
    if (!out.date) out.date = todayStr();
    if (!out.name) out.name = 'SANS_NOM';

    // Migration anciens IAG stockés en tant que "type".
    if (String(out.type || '').startsWith('IAG_')) {
      out.provider = 'IAG';
      out.type = null;
      out.power = null;
      out.conso = null;
      out.axa = false;
      out.digitalisation = false;
      out.iagType = 'ASSURANCE';
      out.iagReference = out.reference || out.iagReference || null;
    }

    // Defaults
    if (out.provider === undefined || out.provider === null || out.provider === '') {
      out.provider = out.type ? 'PLENITUDE' : (out.iagType ? 'IAG' : 'PLENITUDE');
    }
    if (out.type === undefined) out.type = out.type || null;
    if (out.power === undefined) out.power = null;
    if (out.conso === undefined) out.conso = null;
    if (out.iagType === undefined) out.iagType = null;
    // Migration: ancien type d'assurance (PJI/ELA) -> indicateur unique 'ASSURANCE'
    if (out.iagType === 'PJI' || out.iagType === 'ELA') out.iagType = 'ASSURANCE';
    if (out.iagReference === undefined) out.iagReference = null;

    // Nettoyage si pas d'énergie
    if (!out.type) {
      out.power = null;
      out.conso = null;
      out.axa = false;
      out.digitalisation = false;
    }

    // Annulations par partie (énergie / assurance) : une partie inexistante
    // ne peut pas être annulée.
    out.energyCancelled = !!out.energyCancelled;
    out.iagCancelled = !!out.iagCancelled;
    if (!out.type) out.energyCancelled = false;
    if (!out.iagType) out.iagCancelled = false;

    const isPrimeo = out.provider === 'PRIMEO' || String(out.type || '').startsWith('PRIMEO_');
    if (isPrimeo) {
      out.axa = false;
      out.digitalisation = false;
    }

    return out;
  }

  function sanitizeContracts(rawList) {
    if (!Array.isArray(rawList)) return [];
    return rawList.map((c) => normalizeContract(c));
  }

  // Expose logique métier pure dans un namespace global
  global.RemunerationLogic = {
    TARIFS,
    DUAL_TARIFS,
    todayStr,
    addDays,
    formatDate,
    formatEuro,
    formatSignedNumber,
    formatSignedEuro,
    getWeekNumber,
    getWeekRange,
    getMonthLabel,
    getIAGTarif,
    getIAGTierInfo,
    calculateAmount,
    computeStats,
    contractTypeLabel,
    contractCategory,
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
  };
})(window);
