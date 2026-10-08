/**
 * ROSMIL LEAGUE — Interactive Baseball Platform Engine (Versión 0.1)
 * Actualización integral:
 * 1. Jugadores asignados exclusivamente por pertenencia real (p.team === teamId).
 * 2. Control de permisos estricto (Únicamente Administrador puede modificar).
 * 3. Perfil individual de equipo con Récord calculado (W-L, PCT, RS, RA, DIFF).
 * 4. Selector para comparar equipos (Versus histórico, mejor rival, diferencial).
 * 5. Creación y eliminación de temporadas (solo administrador).
 * 6. Doble confirmación obligatoria para cualquier eliminación.
 * 7. Perfil individual de cada jugador con estadísticas por temporada y carrera.
 * 8. Estadísticas completas de bateo y pitcheo.
 * 9. Selector interactivo [ BATEO ] [ PITCHEO ] para lanzadores.
 * 10. Equipo actual clickeable en el perfil del jugador.
 * 11. Historial de equipos conservando estadísticas históricas.
 * 12. Rendimiento en el último partido del jugador (bateo o pitcheo).
 * 13 & 14. Jugadores y equipos clickeables en toda la aplicación.
 * 15 & 16. Diseño oficial: Fondo Verde, Secciones Amarillas, Estadísticas Blancas.
 */

(function () {
  'use strict';

  // Storage Key
  const KEY = 'rosmilLeagueDataV4';

  // Application State
  let db = {
    teams: [],
    players: [],
    games: [],
    seasons: [],
    series: [],
    events: [],
    settings: {
      adminPin: 'admin123',
      leagueName: 'ROSMIL LEAGUE'
    }
  };

  // Estado de permisos y navegación interna (Persistencia cruzada en localStorage)
  let isAdmin =
    sessionStorage.getItem('rosmil_is_admin') === 'true' ||
    localStorage.getItem('rosmil_is_admin') === 'true';
  let activeTeamId = null;
  let activePlayerId = null;
  let activePlayerTab = 'batting'; // 'batting' | 'pitching'
  let compareTeamId = null;
  let pendingDeleteAction = null;

  // Estado del Asistente de Partidos Paso a Paso (ROSMIL LEAGUE 0.2 / 0.3)
  let wizardState = {
    step: 1,
    gameName: '',
    season: '',
    date: '',
    time: '',
    stadium: '',
    innings: 7,
    outsPerInning: 3,
    homeTeam: '',
    awayTeam: '',
    homePositions: {},
    homeBattingOrder: [],
    awayPositions: {},
    awayBattingOrder: []
  };

  // Estado de la Consola de Juego en Vivo (ROSMIL LEAGUE 0.3 - 2D Live Diamond & Persistence)
  let liveGameState = {
    active: false,
    gameId: null,
    game: null,
    inning: 1,
    half: 'away', // 'away' = Alta (batea visitante) | 'home' = Baja (batea local)
    outs: 0,
    awayScore: 0,
    homeScore: 0,
    awayBattingIndex: 0,
    homeBattingIndex: 0,
    activePitcherAway: null,
    activePitcherHome: null,
    selectedPlayResult: 'Single',
    selectedRbi: 0,
    runners: { '1B': null, '2B': null, '3B': null },
    undoStack: [],
    redoStack: []
  };

  // Estado del Reproductor y Resumen 2D (ROSMIL LEAGUE 0.3 - 2D Replay & Summary)
  let replayState = {
    game: null,
    events: [],
    currentIndex: 0,
    isPlaying: false,
    intervalId: null,
    speed: 1 // 0.5x, 1x, 2x
  };

  // Load persisted state
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) {
      db = JSON.parse(saved);
    }
  } catch (err) {
    console.error('Error al cargar datos desde localStorage:', err);
  }

  // Ensure state arrays & settings exist
  if (!Array.isArray(db.teams)) db.teams = [];
  if (!Array.isArray(db.players)) db.players = [];
  if (!Array.isArray(db.games)) db.games = [];
  if (!Array.isArray(db.seasons)) db.seasons = [];
  if (!Array.isArray(db.series)) db.series = [];
  if (!Array.isArray(db.events)) db.events = [];
  if (!db.settings || typeof db.settings !== 'object') {
    db.settings = { adminPin: 'admin123', leagueName: 'ROSMIL LEAGUE' };
  }

  // Sanitización de jugadores y juegos
  db.players.forEach(p => {
    if (!Array.isArray(p.teamHistory)) p.teamHistory = [];
    if (p.team && p.teamHistory.length === 0) {
      p.teamHistory.push({
        teamId: p.team,
        teamName: teamName(p.team),
        date: 'Inicial',
        seasonName: 'Actual'
      });
    }
  });

  db.games.forEach(g => {
    if (!Array.isArray(g.batLog)) g.batLog = [];
  });

  // DOM Query Helpers
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];

  // Pitch Types Catalog
  const PITCH_TYPES = [
    '4-Seam Fastball',
    '2-Seam Fastball',
    'Sinker',
    'Cutter',
    'Slider',
    'Sweeper',
    'Curveball',
    'Knuckle Curve',
    'Changeup',
    'Circle Changeup',
    'Splitter',
    'Forkball',
    'Knuckleball'
  ];

  // Plate Appearance Outcome Map
  const RESULT_OPTIONS = [
    ['Single', 'Single (Sencillo)'],
    ['Double', 'Doble (2B)'],
    ['Triple', 'Triple (3B)'],
    ['Home Run', 'Home Run (HR)'],
    ['Walk', 'Base por bolas (BB)'],
    ['HBP', 'Golpeado por lanzamiento (HBP)'],
    ['Strikeout Swinging', 'Ponche tirándole (SO)'],
    ['Strikeout Looking', 'Ponche cantado (SO)'],
    ['Groundout', 'Rodado / out (GO)'],
    ['Flyout', 'Elevado / out (FO)'],
    ['Lineout', 'Línea / out (LO)'],
    ['Sac Fly', 'Sacrificio de fly (SF)'],
    ['Sac Bunt', 'Toque de sacrificio (SH)'],
    ['Reached Error', 'Llegó por error (E)'],
    ['Fielder Choice', 'Elección del fildeador (FC)']
  ];

  const HIT_RESULTS = new Set(['Single', 'Double', 'Triple', 'Home Run']);

  const AB_RESULTS = new Set([
    'Single',
    'Double',
    'Triple',
    'Home Run',
    'Strikeout Swinging',
    'Strikeout Looking',
    'Groundout',
    'Flyout',
    'Lineout',
    'Reached Error',
    'Fielder Choice'
  ]);

  const DEFAULT_OUTS = {
    Single: 0,
    Double: 0,
    Triple: 0,
    'Home Run': 0,
    Walk: 0,
    HBP: 0,
    'Strikeout Swinging': 1,
    'Strikeout Looking': 1,
    Groundout: 1,
    Flyout: 1,
    Lineout: 1,
    'Sac Fly': 1,
    'Sac Bunt': 1,
    'Reached Error': 0,
    'Fielder Choice': 1
  };

  // ----------------------------------------------------
  // SISTEMA DE PERMISOS: ADMINISTRADOR
  // ----------------------------------------------------
  function checkAdmin(notify = true) {
    if (!isAdmin) {
      if (notify) {
        alert('Acceso denegado: Únicamente el Administrador de la liga tiene permisos para realizar modificaciones.');
      }
      return false;
    }
    return true;
  }

  function updateRoleUI() {
    document.body.classList.toggle('viewer-mode', !isAdmin);

    const btn = $('#adminRoleBtn');
    const icon = $('#adminRoleIcon');
    const text = $('#adminRoleText');

    if (btn && icon && text) {
      if (isAdmin) {
        btn.classList.add('is-admin');
        icon.textContent = '👑';
        text.textContent = 'Modo Administrador';
      } else {
        btn.classList.remove('is-admin');
        icon.textContent = '👁️';
        text.textContent = 'Modo Espectador';
      }
    }
  }

  // ----------------------------------------------------
  // SISTEMA DE PERSISTENCIA Y SINCRONIZACIÓN
  // ----------------------------------------------------
  function updateStorageStatus(msg) {
    const el = $('#storageStatus');
    if (el) el.textContent = msg;
  }

  function save() {
    db.updatedAt = Date.now();

    try {
      localStorage.setItem(KEY, JSON.stringify(db));
      if (liveGameState.active && liveGameState.gameId) {
        localStorage.setItem('rosmil_active_game_id', liveGameState.gameId);
      }
    } catch (e) {
      console.error('Error guardando en localStorage:', e);
    }
    renderAll();

    // Sincronización en la nube (Firebase Firestore)
    if (typeof firebaseInitialized !== 'undefined' && firebaseInitialized && firestoreDb) {
      updateStorageStatus('🔄 Guardando en Firebase...');
      firestoreDb
        .collection('leagues')
        .doc('main')
        .set(db)
        .then(() => {
          updateStorageStatus('🟢 En la nube (Firebase)');
        })
        .catch(err => {
          console.error('Error al guardar en Firebase:', err);
          updateStorageStatus('🔴 Error sincronización (Guardado local)');
        });
    } else {
      updateStorageStatus('🟡 Datos locales');
    }
  }

  // ----------------------------------------------------
  // DOBLE CONFIRMACIÓN DE ELIMINACIÓN (REGLA N° 6)
  // ----------------------------------------------------
  function requestDoubleDelete(title, warningDetails, onConfirmed) {
    if (!checkAdmin()) return;

    pendingDeleteAction = onConfirmed;
    $('#confirmTitle1').textContent = `¿Eliminar "${title}"?`;
    $('#confirmMsg1').textContent = warningDetails || '¿Estás seguro de que deseas eliminar este registro?';
    $('#confirmTitle2').textContent = `Confirmar eliminación: "${title}"`;
    $('#confirmMsg2').innerHTML = `⚠️ <b>ADVERTENCIA CRÍTICA:</b> Esta acción eliminará permanentemente la información relacionada con <b>"${esc(
      title
    )}"</b> y no se puede deshacer fácilmente.<br><br>¿Confirmas que deseas proceder con la eliminación definitiva?`;

    $('#confirmStep1').style.display = 'block';
    $('#confirmStep2').style.display = 'none';
    $('#confirmDeleteModal').classList.add('open');
  }

  // ----------------------------------------------------
  // UTILIDADES
  // ----------------------------------------------------
  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m]));
  }

  function empty(msg, sub = '') {
    return `<div class="empty"><b>${esc(msg)}</b>${esc(sub)}</div>`;
  }

  function teamName(id) {
    return db.teams.find(x => x.id === id)?.name || 'Sin equipo';
  }

  function seasonName(id) {
    return db.seasons.find(x => x.id === id)?.name || 'Sin temporada';
  }

  function playerName(id) {
    return db.players.find(x => x.id === id)?.name || 'Jugador';
  }

  function id() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function isPitcher(p) {
    return p?.role === 'pitcher' || p?.role === 'two-way' || p?.isPitcher === true || p?.isPitcherChoice === 'yes';
  }

  function isBatter(p) {
    return p?.role === 'batter' || p?.role === 'two-way' || p?.isBatter !== false;
  }

  function fmtAvg(v) {
    return Number(v || 0).toFixed(3).replace('0.', '.');
  }

  function fmtPct(v) {
    return Number(v || 0).toFixed(1) + '%';
  }

  function getGame(gid) {
    return db.games.find(g => g.id === gid);
  }

  function getSeries(sid) {
    return db.series.find(s => s.id === sid);
  }

  function allPAs() {
    return db.games.flatMap(g =>
      (g.batLog || []).map(pa => ({ ...pa, gameId: g.id, game: g }))
    );
  }

  // ----------------------------------------------------
  // CÁLCULO DE ESTADÍSTICAS SABERMÉTRICAS (OFENSIVA Y PITCHEO)
  // ----------------------------------------------------
  function batterStats(pid, sourcePAs) {
    const rows = sourcePAs.filter(x => x.batter === pid);
    const s = {
      PA: rows.length,
      AB: 0,
      R: 0,
      H: 0,
      D: 0,
      T: 0,
      HR: 0,
      TB: 0,
      RBI: 0,
      BB: 0,
      HBP: 0,
      SO: 0,
      SB: 0,
      SF: 0,
      SH: 0
    };

    rows.forEach(pa => {
      const r = pa.result;
      if (AB_RESULTS.has(r)) s.AB++;
      if (HIT_RESULTS.has(r)) {
        s.H++;
        if (r === 'Single') s.TB += 1;
        if (r === 'Double') { s.D++; s.TB += 2; }
        if (r === 'Triple') { s.T++; s.TB += 3; }
        if (r === 'Home Run') { s.HR++; s.TB += 4; }
      }
      if (r === 'Walk') s.BB++;
      if (r === 'HBP') s.HBP++;
      if (r === 'Strikeout Swinging' || r === 'Strikeout Looking') s.SO++;
      if (r === 'Sac Fly') s.SF++;
      if (r === 'Sac Bunt') s.SH++;
      s.R += Number(pa.runs) || 0;
      s.RBI += Number(pa.rbi) || 0;
      s.SB += Number(pa.sb) || 0;
    });

    // Contabilizar carreras anotadas como corredor en turnos de otros bateadores
    sourcePAs.forEach(pa => {
      if (pa.batter !== pid && Array.isArray(pa.scoringRunners) && pa.scoringRunners.includes(pid)) {
        s.R++;
      }
    });

    s.AVG = s.AB ? s.H / s.AB : 0;
    const obpDenom = s.AB + s.BB + s.HBP + s.SF;
    s.OBP = obpDenom ? (s.H + s.BB + s.HBP) / obpDenom : 0;
    s.SLG = s.AB ? s.TB / s.AB : 0;
    s.OPS = s.OBP + s.SLG;
    s.KPct = s.PA ? s.SO / s.PA : 0;
    return s;
  }

  function pitcherStats(pid, sourcePAs) {
    const rows = sourcePAs.filter(x => x.pitcher === pid);
    let outs = 0;
    const s = {
      BF: rows.length,
      IP: '0.0',
      outs: 0,
      H: 0,
      R: 0,
      ER: 0,
      BB: 0,
      HBP: 0,
      SO: 0,
      HR: 0
    };

    rows.forEach(pa => {
      const r = pa.result;
      const o = Number(pa.outs) || 0;
      outs += o;
      if (HIT_RESULTS.has(r)) {
        s.H++;
        if (r === 'Home Run') s.HR++;
      }
      if (r === 'Walk') s.BB++;
      if (r === 'HBP') s.HBP++;
      if (r === 'Strikeout Swinging' || r === 'Strikeout Looking') s.SO++;
      s.R += Number(pa.runs) || 0;
      s.ER += Number(pa.earnedRuns) || 0;
    });

    s.outs = outs;
    s.IP = Math.floor(outs / 3) + '.' + (outs % 3);
    s.ERA = outs ? (s.ER * 27) / outs : 0;
    s.WHIP = outs ? ((s.BB + s.H) * 9) / outs : 0;
    return s;
  }

  function recalcStats() {
    const pas = allPAs();
    db.players.forEach(p => {
      p.bat = batterStats(p.id, pas);
      p.pitch = pitcherStats(p.id, pas);
    });
  }

  // ----------------------------------------------------
  // GESTIÓN DE ROSTER REAL (REGLA N° 1)
  // ----------------------------------------------------
  function teamPlayers(teamId, onlyBatter = false, onlyPitcher = false) {
    // REGLA N° 1: Únicamente los jugadores que actualmente pertenecen al equipo
    return db.players.filter(
      p => p.team === teamId && (!onlyBatter || isBatter(p)) && (!onlyPitcher || isPitcher(p))
    );
  }

  // ----------------------------------------------------
  // RÉCORD Y ESTADÍSTICAS DE EQUIPO (REGLAS N° 3 Y N° 4)
  // ----------------------------------------------------
  function calculateTeamRecord(tid) {
    const games = db.games.filter(g => g.home === tid || g.away === tid);
    let w = 0,
      l = 0,
      t = 0,
      rs = 0,
      ra = 0;

    games.forEach(g => {
      const isHome = g.home === tid;
      const own = Number(isHome ? g.homeScore : g.awayScore) || 0;
      const opp = Number(isHome ? g.awayScore : g.homeScore) || 0;
      rs += own;
      ra += opp;
      if (own > opp) w++;
      else if (own < opp) l++;
      else t++;
    });

    const gp = games.length;
    const pct = w + l ? w / (w + l) : 0;
    const diff = rs - ra;
    return { gp, w, l, t, pct, rs, ra, diff, games };
  }

  function calculateHeadToHead(teamA, teamB) {
    const games = db.games.filter(
      g =>
        (g.home === teamA && g.away === teamB) ||
        (g.home === teamB && g.away === teamA)
    );

    let winsA = 0,
      winsB = 0,
      rsA = 0,
      rsB = 0;

    games.forEach(g => {
      const aScore = Number(g.home === teamA ? g.homeScore : g.awayScore) || 0;
      const bScore = Number(g.home === teamB ? g.homeScore : g.awayScore) || 0;
      rsA += aScore;
      rsB += bScore;
      if (aScore > bScore) winsA++;
      else if (bScore > aScore) winsB++;
    });

    const lastGame = games.length ? games[games.length - 1] : null;

    return {
      gp: games.length,
      winsA,
      winsB,
      rsA,
      rsB,
      diffA: rsA - rsB,
      games,
      lastGame
    };
  }

  function calculateBestRival(teamId) {
    const games = db.games.filter(g => g.home === teamId || g.away === teamId);
    if (!games.length) return null;

    const opponents = {};
    games.forEach(g => {
      const oppId = g.home === teamId ? g.away : g.home;
      if (!opponents[oppId]) opponents[oppId] = { w: 0, l: 0, gp: 0 };
      const own = Number(g.home === teamId ? g.homeScore : g.awayScore) || 0;
      const opp = Number(g.home === teamId ? g.awayScore : g.homeScore) || 0;
      opponents[oppId].gp++;
      if (own > opp) opponents[oppId].w++;
      else if (own < opp) opponents[oppId].l++;
    });

    let bestOpp = null;
    let bestPct = -1;

    Object.entries(opponents).forEach(([oppId, stats]) => {
      const pct = stats.gp ? stats.w / stats.gp : 0;
      if (pct > bestPct || (pct === bestPct && stats.w > (bestOpp?.stats.w || 0))) {
        bestPct = pct;
        bestOpp = { oppId, name: teamName(oppId), stats, pct };
      }
    });

    return bestOpp;
  }

  // ----------------------------------------------------
  // ÚLTIMO PARTIDO DEL JUGADOR (REGLA N° 12)
  // ----------------------------------------------------
  function getPlayerLastGame(pid) {
    // Busca juegos donde el jugador tuvo acción en el BAT LOG
    const gamesWithPA = db.games.filter(g =>
      (g.batLog || []).some(pa => pa.batter === pid || pa.pitcher === pid)
    );

    if (!gamesWithPA.length) return null;

    // Tomar el más reciente
    const lastGame = gamesWithPA[gamesWithPA.length - 1];
    const pasAsBatter = (lastGame.batLog || []).filter(pa => pa.batter === pid);
    const pasAsPitcher = (lastGame.batLog || []).filter(pa => pa.pitcher === pid);

    let batSummary = null;
    if (pasAsBatter.length) {
      const s = batterStats(pid, pasAsBatter);
      let details = [];
      if (s.HR > 0) details.push(`${s.HR} HR`);
      if (s.D > 0) details.push(`${s.D} 2B`);
      if (s.T > 0) details.push(`${s.T} 3B`);
      if (s.RBI > 0) details.push(`${s.RBI} RBI`);
      if (s.R > 0) details.push(`${s.R} R`);
      if (s.BB > 0) details.push(`${s.BB} BB`);
      if (s.SB > 0) details.push(`${s.SB} SB`);

      batSummary = {
        line: `${s.AB}-${s.H}`,
        extra: details.join(', '),
        stats: s
      };
    }

    let pitchSummary = null;
    if (pasAsPitcher.length) {
      const ps = pitcherStats(pid, pasAsPitcher);
      pitchSummary = {
        line: `${ps.IP} IP, ${ps.H} H, ${ps.ER} ER, ${ps.SO} SO, ${ps.BB} BB`,
        era: ps.ERA.toFixed(2),
        stats: ps
      };
    }

    return {
      game: lastGame,
      batSummary,
      pitchSummary
    };
  }

  // ----------------------------------------------------
  // NAVEGACIÓN Y APERTURA DE PERFILES (REGLAS 13 Y 14)
  // ----------------------------------------------------
  function show(view) {
    $$('.view').forEach(x => x.classList.remove('active'));
    const v = $('#' + view);
    if (!v) return;
    v.classList.add('active');

    $$('nav button').forEach(x =>
      x.classList.toggle('active', x.dataset.view === view)
    );

    const names = {
      home: 'Inicio',
      season: 'Temporadas',
      standings: 'Posiciones',
      games: 'Juegos',
      teams: 'Equipos',
      players: 'Jugadores',
      stats: 'Estadísticas',
      leaders: 'Líderes',
      ranking: 'Ranking General',
      history: 'Historial',
      admin: 'Administración',
      teamProfile: 'Perfil de Equipo',
      playerProfile: 'Perfil de Jugador'
    };
    $('#pageTitle').textContent = names[view] || view;
    renderAll();
  }

  function openTeamProfile(tid) {
    if (!tid) return;
    activeTeamId = tid;
    compareTeamId = db.teams.find(t => t.id !== tid)?.id || null;
    renderTeamProfile();
    show('teamProfile');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openPlayerProfile(pid) {
    if (!pid) return;
    activePlayerId = pid;
    activePlayerTab = 'batting';
    renderPlayerProfile();
    show('playerProfile');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ----------------------------------------------------
  // RENDER: PERFIL DE EQUIPO (REGLAS 1, 3, 4)
  // ----------------------------------------------------
  function renderTeamProfile() {
    const el = $('#teamProfileArea');
    const t = db.teams.find(x => x.id === activeTeamId);
    if (!t) {
      el.innerHTML = empty('Equipo no encontrado', 'Selecciona un equipo de la lista.');
      return;
    }

    const rec = calculateTeamRecord(t.id);
    const roster = teamPlayers(t.id);
    const bestRiv = calculateBestRival(t.id);

    // Comparación con otro equipo
    const otherTeams = db.teams.filter(x => x.id !== t.id);
    if (!compareTeamId && otherTeams.length) {
      compareTeamId = otherTeams[0].id;
    }
    const h2h = compareTeamId ? calculateHeadToHead(t.id, compareTeamId) : null;
    const oppTeam = compareTeamId ? db.teams.find(x => x.id === compareTeamId) : null;
    const oppRec = compareTeamId ? calculateTeamRecord(compareTeamId) : null;

    // Opciones del selector de comparación
    const compOptions = otherTeams
      .map(
        ot =>
          `<option value="${ot.id}" ${ot.id === compareTeamId ? 'selected' : ''}>${esc(
            ot.name
          )}</option>`
      )
      .join('');

    el.innerHTML = `
      <div style="margin-bottom:15px">
        <button class="btn" data-go="teams">← Volver a lista de equipos</button>
      </div>

      <div class="profile-banner">
        <div class="profile-identity">
          ${
            t.logo
              ? `<img class="profile-teamlogo" src="${t.logo}" alt="${esc(t.name)}">`
              : `<div class="profile-teamlogo" style="display:flex;align-items:center;justify-content:center;font-size:32px">⚾</div>`
          }
          <div>
            <div class="eyebrow">${esc(t.city || 'Liga Oficial')}</div>
            <h1 class="profile-title">${esc(t.name)}</h1>
            <div class="profile-meta">
              <span><b>Manager:</b> ${esc(t.manager || 'No asignado')}</span>
              <span>•</span>
              <span><b>Jugadores activos:</b> ${roster.length}</span>
              <span>•</span>
              <span><b>Juegos disputados:</b> ${rec.gp}</span>
            </div>
          </div>
        </div>
        <div class="profile-record-badge">
          <small>RÉCORD OFICIAL</small>
          <b>${rec.w} - ${rec.l}</b>
          <span style="color:var(--yellow);font-weight:700;font-size:13px">${rec.pct
            .toFixed(3)
            .replace('0.', '.')} PCT</span>
        </div>
      </div>

      <!-- Métricas generales -->
      <div class="statgrid" style="margin-bottom:20px">
        <div class="statbox"><small>Victorias</small><b>${rec.w}</b></div>
        <div class="statbox"><small>Derrotas</small><b>${rec.l}</b></div>
        <div class="statbox"><small>Carreras Anotadas</small><b>${rec.rs}</b></div>
        <div class="statbox"><small>Carreras Permitidas</small><b>${rec.ra}</b></div>
        <div class="statbox"><small>Diferencial</small><b style="color:${
          rec.diff >= 0 ? 'var(--yellow)' : 'var(--red)'
        }">${rec.diff >= 0 ? '+' + rec.diff : rec.diff}</b></div>
        <div class="statbox"><small>Partidos</small><b>${rec.gp}</b></div>
      </div>

      <div class="grid2">
        <!-- Roster Actual (Regla N° 1) -->
        <div class="panel">
          <div class="head">
            <h2>Roster Oficial Actual (${roster.length})</h2>
            <span class="muted">Solo jugadores asignados a este equipo</span>
          </div>
          ${
            roster.length
              ? `
            <div class="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Jugador</th>
                    <th>Pos</th>
                    <th>Rol</th>
                    <th>AVG</th>
                    <th>HR</th>
                    <th>RBI</th>
                  </tr>
                </thead>
                <tbody>
                  ${roster
                    .map(
                      p => `
                    <tr>
                      <td><b>#${esc(p.number || '—')}</b></td>
                      <td>
                        ${p.photo ? `<img class="avatar" src="${p.photo}" alt="">` : ''}
                        <span class="player-link" data-player-id="${p.id}">${esc(p.name)}</span>
                      </td>
                      <td>${esc(p.position || '—')}</td>
                      <td>${p.role === 'two-way' ? 'Two-Way' : isPitcher(p) ? 'Pitcher' : 'Bateador'}</td>
                      <td><b>${fmtAvg(p.bat?.AVG)}</b></td>
                      <td>${p.bat?.HR || 0}</td>
                      <td>${p.bat?.RBI || 0}</td>
                    </tr>`
                    )
                    .join('')}
                </tbody>
              </table>
            </div>`
              : empty('Sin jugadores asignados', 'Asigna jugadores desde la pantalla de creación/edición.')
          }
        </div>

        <!-- Historial de Partidos de este Equipo -->
        <div class="panel">
          <div class="head">
            <h2>Historial de Partidos (${rec.games.length})</h2>
            <span class="muted">Resultados del equipo</span>
          </div>
          ${
            rec.games.length
              ? `
            <div class="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Rival</th>
                    <th>Marcador</th>
                    <th>Condición</th>
                    <th>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  ${rec.games
                    .slice()
                    .reverse()
                    .map(g => {
                      const isHome = g.home === t.id;
                      const oppId = isHome ? g.away : g.home;
                      const own = Number(isHome ? g.homeScore : g.awayScore) || 0;
                      const opp = Number(isHome ? g.awayScore : g.homeScore) || 0;
                      const win = own > opp;
                      const tie = own === opp;
                      return `
                      <tr>
                        <td>${esc(g.date)}</td>
                        <td><span class="team-link" data-team-id="${oppId}">${esc(teamName(oppId))}</span></td>
                        <td><b>${own} — ${opp}</b></td>
                        <td>${isHome ? 'Local' : 'Visitante'}</td>
                        <td>
                          <span class="tag" style="background:${
                            win ? 'rgba(34,197,94,0.2)' : tie ? 'rgba(250,204,21,0.2)' : 'rgba(239,68,68,0.2)'
                          };color:${win ? '#4ade80' : tie ? 'var(--yellow)' : '#f87171'}">
                            ${win ? 'VICTORIA' : tie ? 'EMPATE' : 'DERROTA'}
                          </span>
                        </td>
                      </tr>`;
                    })
                    .join('')}
                </tbody>
              </table>
            </div>`
              : empty('Sin partidos registrados', 'Los juegos jugados por este equipo aparecerán aquí.')
          }
        </div>
      </div>

      <!-- SECTOR DE COMPARACIÓN ENTRE EQUIPOS (REGLA N° 4) -->
      <div class="panel" style="margin-top:20px">
        <div class="head">
          <div>
            <h2>Comparación con otro equipo</h2>
            <span class="muted">Análisis estadístico directo y cara a cara</span>
          </div>
          <div class="compare-selector-wrap">
            <label style="color:var(--muted);font-size:12px;font-weight:600">Seleccionar Rival:</label>
            <select id="teamCompareSelect" style="min-width:220px;background:#05190f;border:1px solid var(--yellow);color:#fff;padding:8px 12px;border-radius:7px">
              ${compOptions || '<option value="">No hay otros equipos</option>'}
            </select>
          </div>
        </div>

        ${
          oppTeam && h2h
            ? `
          <div class="grid2" style="margin-top:16px">
            <div class="card" style="text-align:center">
              <h3 style="color:var(--yellow);margin-top:0">${esc(t.name)}</h3>
              <div style="font-size:24px;font-weight:900;color:#fff">${rec.w} - ${rec.l}</div>
              <small class="muted">Récord General (${rec.pct.toFixed(3).replace('0.', '.')})</small>
              <div style="margin-top:12px;font-size:13px;color:#fff">
                Carreras: <b>${rec.rs}</b> | Permitidas: <b>${rec.ra}</b> (Diff: <b>${
                rec.diff >= 0 ? '+' + rec.diff : rec.diff
              }</b>)
              </div>
            </div>

            <div class="card" style="text-align:center">
              <h3 style="color:var(--yellow);margin-top:0">${esc(oppTeam.name)}</h3>
              <div style="font-size:24px;font-weight:900;color:#fff">${oppRec.w} - ${oppRec.l}</div>
              <small class="muted">Récord General (${oppRec.pct.toFixed(3).replace('0.', '.')})</small>
              <div style="margin-top:12px;font-size:13px;color:#fff">
                Carreras: <b>${oppRec.rs}</b> | Permitidas: <b>${oppRec.ra}</b> (Diff: <b>${
                oppRec.diff >= 0 ? '+' + oppRec.diff : oppRec.diff
              }</b>)
              </div>
            </div>
          </div>

          <!-- Versus Histórico -->
          <div class="card" style="margin-top:14px;background:#082416;border-color:var(--yellow)">
            <div class="head">
              <div>
                <b style="font-size:16px;color:var(--yellow)">Versus Histórico: ${esc(t.name)} vs ${esc(
                oppTeam.name
              )}</b>
                <div class="muted">Partidos disputados entre ambos: <b>${h2h.gp}</b></div>
              </div>
              <div class="profile-record-badge" style="padding:8px 16px;min-width:auto">
                <small>SERIE HISTÓRICA</small>
                <b>${h2h.winsA} - ${h2h.winsB}</b>
              </div>
            </div>

            <div class="statgrid" style="margin-top:14px">
              <div class="statbox"><small>Victorias ${esc(t.name)}</small><b>${h2h.winsA}</b></div>
              <div class="statbox"><small>Victorias ${esc(oppTeam.name)}</small><b>${h2h.winsB}</b></div>
              <div class="statbox"><small>Carreras ${esc(t.name)}</small><b>${h2h.rsA}</b></div>
              <div class="statbox"><small>Carreras ${esc(oppTeam.name)}</small><b>${h2h.rsB}</b></div>
              <div class="statbox"><small>Diferencial en Serie</small><b style="color:${
                h2h.diffA >= 0 ? 'var(--yellow)' : 'var(--red)'
              }">${h2h.diffA >= 0 ? '+' + h2h.diffA : h2h.diffA}</b></div>
              <div class="statbox"><small>Partidos</small><b>${h2h.gp}</b></div>
            </div>

            ${
              h2h.lastGame
                ? `
              <div class="last-game-card" style="margin-top:14px">
                <h4>Último enfrentamiento directo:</h4>
                <div class="last-game-line">
                  ${esc(teamName(h2h.lastGame.away))} ${h2h.lastGame.awayScore} — ${h2h.lastGame.homeScore} ${esc(
                    teamName(h2h.lastGame.home)
                  )}
                </div>
                <div class="muted" style="margin-top:4px;font-size:12px">
                  ${esc(h2h.lastGame.date)} • ${esc(h2h.lastGame.stadium || 'Estadio Principal')}
                </div>
              </div>`
                : ''
            }
          </div>`
            : empty('Selecciona un equipo para comparar', 'No hay suficientes enfrentamientos.')
        }

        <!-- Mejor rival del equipo -->
        ${
          bestRiv
            ? `
          <div class="best-rival-card">
            <strong>🌟 Rival contra el que mejor le juega históricamente:</strong>
            <span>
              <b>${esc(bestRiv.name)}</b> — Récord de <b>${bestRiv.stats.w} - ${bestRiv.stats.l}</b> (${(
                bestRiv.pct * 100
              ).toFixed(1)}% de efectividad en ${bestRiv.stats.gp} juegos).
            </span>
          </div>`
            : ''
        }
      </div>
    `;

    // Event listener del selector de rival
    const sel = $('#teamCompareSelect');
    if (sel) {
      sel.onchange = () => {
        compareTeamId = sel.value;
        renderTeamProfile();
      };
    }
  }

  // ----------------------------------------------------
  // ADN DEL JUGADOR & SCOUTING REPORT (ROSMIL LEAGUE 0.2)
  // ----------------------------------------------------
  function calculatePlayerDNA(p, sourcePAs) {
    const isP = isPitcher(p);
    const bat = batterStats(p.id, sourcePAs);
    const pitch = isP ? pitcherStats(p.id, sourcePAs) : null;

    const batterDNA = {
      hasData: bat.PA > 0,
      attrs: []
    };

    if (bat.PA > 0) {
      // CONTACTO (0-99): Basado en AVG y porcentaje de hits
      const rawContact = Math.round(bat.AVG * 120 + 50);
      const contactRating = Math.min(99, Math.max(50, rawContact));
      batterDNA.attrs.push({
        name: 'CONTACTO',
        rating: contactRating,
        desc: `Promedio de bateo oficial: ${fmtAvg(bat.AVG)} (${bat.H} H en ${bat.AB} AB)`,
        tier: contactRating >= 88 ? 'ELITE' : contactRating >= 78 ? 'ALTO' : contactRating >= 65 ? 'PROMEDIO' : 'MEJORABLE',
        insufficient: false
      });

      // PODER (0-99): Basado en SLG, HR y extrabases
      const extraBases = bat.D * 2 + bat.T * 3 + bat.HR * 4;
      const rawPower = Math.round(bat.SLG * 60 + 40 + (extraBases / (bat.PA || 1)) * 15);
      const powerRating = Math.min(99, Math.max(45, rawPower));
      batterDNA.attrs.push({
        name: 'PODER',
        rating: powerRating,
        desc: `${bat.HR} HR, ${bat.D} Dobles, ${bat.T} Triples (SLG: ${fmtAvg(bat.SLG)})`,
        tier: powerRating >= 88 ? 'MUY ALTO' : powerRating >= 78 ? 'ALTO' : powerRating >= 65 ? 'MEDIO' : 'MEJORABLE',
        insufficient: false
      });

      // PRODUCCIÓN (0-99): Capacidad de remolcar carreras y anotar
      const prodRate = (bat.RBI * 1.6 + bat.R) / (bat.PA || 1);
      const prodRating = Math.min(99, Math.max(45, Math.round(prodRate * 45 + 50)));
      batterDNA.attrs.push({
        name: 'PRODUCCIÓN',
        rating: prodRating,
        desc: `${bat.RBI} carreras remolcadas (RBI) y ${bat.R} carreras anotadas`,
        tier: prodRating >= 85 ? 'MUY ALTO' : prodRating >= 75 ? 'ALTO' : prodRating >= 60 ? 'PROMEDIO' : 'MEJORABLE',
        insufficient: false
      });

      // CONSISTENCIA (0-99): Disciplina en el plato y ratio SO
      const soRate = bat.SO / (bat.PA || 1);
      const consistRating = Math.min(99, Math.max(45, Math.round(85 - (soRate * 40) + (bat.AVG * 25))));
      batterDNA.attrs.push({
        name: 'CONSISTENCIA',
        rating: consistRating,
        desc: `Ratio de contacto consistente (${bat.SO} ponches en ${bat.PA} PA)`,
        tier: consistRating >= 85 ? 'EXCELENTE' : consistRating >= 75 ? 'ALTO' : 'PROMEDIO',
        insufficient: false
      });

      // DEFENSA (0-99): Posición defensiva habitual
      const posDefenseMap = { SS: 88, CF: 86, C: 85, '2B': 82, '3B': 80, RF: 78, LF: 76, '1B': 74, DH: 65, Pitcher: 75 };
      const defRating = posDefenseMap[p.position] || 75;
      batterDNA.attrs.push({
        name: 'DEFENSA',
        rating: defRating,
        desc: `Fildeo en posición defensiva: ${esc(p.position || 'General')}`,
        tier: defRating >= 82 ? 'ALTO' : 'PROMEDIO',
        insufficient: false
      });

      // CLUTCH (0-99): Oportunidad con corredores
      const clutchRating = Math.min(99, Math.max(50, Math.round(55 + (bat.RBI / (bat.H || 1)) * 28)));
      batterDNA.attrs.push({
        name: 'CLUTCH',
        rating: clutchRating,
        desc: 'Efectividad produciendo en momentos clave del partido',
        tier: clutchRating >= 85 ? 'MUY ALTO' : clutchRating >= 75 ? 'ALTO' : 'PROMEDIO',
        insufficient: false
      });

      // VELOCIDAD: Si tiene bases robadas, muestra rating. Si no, DATOS INSUFICIENTES
      if (bat.SB > 0) {
        const speedRating = Math.min(99, 65 + bat.SB * 8);
        batterDNA.attrs.push({
          name: 'VELOCIDAD',
          rating: speedRating,
          desc: `${bat.SB} bases robadas registradas`,
          tier: speedRating >= 85 ? 'ELITE' : 'ALTO',
          insufficient: false
        });
      } else {
        batterDNA.attrs.push({
          name: 'VELOCIDAD',
          rating: null,
          desc: 'Sin bases robadas registradas',
          insufficient: true
        });
      }
    } else {
      // Regla de Oro: NO inventar datos si no hay suficientes
      ['CONTACTO', 'PODER', 'PRODUCCIÓN', 'CONSISTENCIA', 'DEFENSA', 'CLUTCH', 'VELOCIDAD'].forEach(name => {
        batterDNA.attrs.push({
          name,
          rating: null,
          desc: 'Sin partidos o turnos registrados aún',
          insufficient: true
        });
      });
    }

    // ADN DE LANZADOR
    let pitcherDNA = null;
    if (isP) {
      pitcherDNA = {
        hasData: pitch && pitch.outs > 0,
        attrs: []
      };

      if (pitch && pitch.outs > 0) {
        // CONTROL (0-99): K/BB y boletos bajos
        const bbPerOut = pitch.BB / (pitch.outs || 1);
        const controlRating = Math.min(99, Math.max(45, Math.round(92 - (bbPerOut * 45))));
        pitcherDNA.attrs.push({
          name: 'CONTROL',
          rating: controlRating,
          desc: `Comando de zona de strike (${pitch.BB} boletos en ${pitch.IP} IP)`,
          tier: controlRating >= 85 ? 'MUY ALTO' : controlRating >= 75 ? 'ALTO' : 'PROMEDIO',
          insufficient: false
        });

        // PONCHES (0-99): SO por outs
        const kRate = pitch.SO / (pitch.outs || 1);
        const kRating = Math.min(99, Math.max(45, Math.round(50 + (kRate * 85))));
        pitcherDNA.attrs.push({
          name: 'PONCHES',
          rating: kRating,
          desc: `${pitch.SO} strikeouts registrados`,
          tier: kRating >= 88 ? 'ELITE' : kRating >= 78 ? 'ALTO' : 'PROMEDIO',
          insufficient: false
        });

        // EFECTIVIDAD (0-99): ERA inverso
        const eraRating = Math.min(99, Math.max(45, Math.round(98 - (pitch.ERA * 6))));
        pitcherDNA.attrs.push({
          name: 'EFECTIVIDAD (ERA)',
          rating: eraRating,
          desc: `Efectividad oficial: ${pitch.ERA.toFixed(2)}`,
          tier: eraRating >= 88 ? 'ELITE' : eraRating >= 78 ? 'ALTO' : eraRating >= 65 ? 'PROMEDIO' : 'MEJORABLE',
          insufficient: false
        });

        // DOMINIO (0-99): WHIP bajo y pocos hits
        const whipRating = Math.min(99, Math.max(45, Math.round(96 - (pitch.WHIP * 16))));
        pitcherDNA.attrs.push({
          name: 'DOMINIO (WHIP)',
          rating: whipRating,
          desc: `WHIP oficial: ${pitch.WHIP.toFixed(2)}`,
          tier: whipRating >= 85 ? 'MUY ALTO' : whipRating >= 75 ? 'ALTO' : 'PROMEDIO',
          insufficient: false
        });

        // RESISTENCIA (0-99): Entradas acumuladas
        const innNum = Math.floor(pitch.outs / 3);
        const stamRating = Math.min(99, Math.max(50, Math.round(60 + innNum * 3)));
        pitcherDNA.attrs.push({
          name: 'RESISTENCIA',
          rating: stamRating,
          desc: `${pitch.IP} entradas totales en el montículo`,
          tier: stamRating >= 80 ? 'ALTO' : 'PROMEDIO',
          insufficient: false
        });
      } else {
        ['CONTROL', 'PONCHES', 'EFECTIVIDAD (ERA)', 'DOMINIO (WHIP)', 'RESISTENCIA'].forEach(name => {
          pitcherDNA.attrs.push({
            name,
            rating: null,
            desc: 'Sin entradas lanzadas registradas aún',
            insufficient: true
          });
        });
      }
    }

    return { batterDNA, pitcherDNA, isPitcher: isP };
  }

  function renderPlayerDNASection(p, sourcePAs) {
    const { batterDNA, pitcherDNA, isPitcher: isP } = calculatePlayerDNA(p, sourcePAs);

    const makeAttrCard = a => `
      <div class="dna-card">
        <div class="dna-card-head">
          <span class="dna-attr-name">${esc(a.name)}</span>
          ${
            a.insufficient
              ? `<span class="dna-insufficient-badge">DATOS INSUFICIENTES</span>`
              : `<span class="dna-attr-rating">${a.rating}</span>`
          }
        </div>
        <div class="dna-meter-track">
          <div class="dna-meter-fill ${a.insufficient ? 'dna-insufficient-bar' : ''}" style="width: ${
            a.insufficient ? '0%' : a.rating + '%'
          }"></div>
        </div>
        <div class="dna-attr-desc">
          ${
            a.insufficient
              ? `<span style="color:#64748b">DATOS INSUFICIENTES (Sin registros oficiales)</span>`
              : `<b>${esc(a.tier)}</b> • ${esc(a.desc)}`
          }
        </div>
      </div>
    `;

    const allAttrs = [...batterDNA.attrs, ...(pitcherDNA ? pitcherDNA.attrs : [])];
    const validAttrs = allAttrs.filter(a => !a.insufficient);
    const strengths = validAttrs.filter(a => a.rating >= 78);
    const improvements = validAttrs.filter(a => a.rating < 70);

    return `
      <div class="dna-panel">
        <div class="dna-panel-header">
          <div class="dna-panel-title">
            <span style="font-size:26px">🧬</span>
            <div>
              <h3>ADN DEL JUGADOR • SCOUTING REPORT OFICIAL</h3>
              <small class="muted">Métricas sabermétricas dinámicas generadas exclusivamente de partidos reales (ROSMIL LEAGUE 0.2)</small>
            </div>
          </div>
          <span class="tag" style="background:#092e1a;color:var(--yellow);border:1px solid var(--yellow-border);font-weight:800">
            ${isP ? 'ADN BATEADOR & LANZADOR' : 'ADN OFENSIVO'}
          </span>
        </div>

        <h4 style="color:var(--yellow);margin:12px 0 10px;font-size:14px;letter-spacing:0.5px">⚡ PERFIL OFENSIVO (BATEO)</h4>
        <div class="dna-grid">
          ${batterDNA.attrs.map(makeAttrCard).join('')}
        </div>

        ${
          isP
            ? `
          <h4 style="color:var(--yellow);margin:22px 0 10px;font-size:14px;letter-spacing:0.5px">⚾ PERFIL MONTICULAR (PITCHEO)</h4>
          <div class="dna-grid">
            ${pitcherDNA.attrs.map(makeAttrCard).join('')}
          </div>`
            : ''
        }

        <!-- Resumen de Scouting -->
        <div class="dna-scouting-summary">
          <div class="dna-scout-box strengths">
            <h5>🎯 FORTALEZAS PRINCIPALES DETECTADAS</h5>
            <div>
              ${
                strengths.length
                  ? strengths
                      .map(
                        s =>
                          `<span class="dna-tag-pill" style="border-color:#22c55e">✓ ${esc(s.name)}: ${esc(s.tier)}</span>`
                      )
                      .join('')
                  : '<span class="muted" style="font-size:12px">Acumula más partidos para consolidar fortalezas élite.</span>'
              }
            </div>
          </div>
          <div class="dna-scout-box improvements">
            <h5>📈 ÁREAS DE DESARROLLO</h5>
            <div>
              ${
                improvements.length
                  ? improvements
                      .map(s => `<span class="dna-tag-pill" style="border-color:var(--yellow)">• ${esc(s.name)}</span>`)
                      .join('')
                  : '<span class="muted" style="font-size:12px">Rendimiento consistente y equilibrado en la muestra de partidos.</span>'
              }
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ----------------------------------------------------
  // RENDER: PERFIL DE JUGADOR (REGLAS 7, 8, 9, 10, 11, 12, 26-32, 35-38)
  // ----------------------------------------------------
  function renderPlayerProfile() {
    const el = $('#playerProfileArea');
    const p = db.players.find(x => x.id === activePlayerId);
    if (!p) {
      el.innerHTML = empty('Jugador no encontrado', 'Selecciona un jugador de la lista.');
      return;
    }

    const lastGame = getPlayerLastGame(p.id);
    const pas = allPAs();
    const pPas = pas.filter(x => x.batter === p.id || x.pitcher === p.id);

    // Agrupación de estadísticas por temporada
    const seasonsMap = {};
    pPas.forEach(pa => {
      const sId = pa.game?.season || 'sin_temporada';
      if (!seasonsMap[sId]) seasonsMap[sId] = [];
      seasonsMap[sId].push(pa);
    });

    const hasPitching = isPitcher(p);

    el.innerHTML = `
      <div style="margin-bottom:15px">
        <button class="btn" data-go="players">← Volver a lista de jugadores</button>
      </div>

      <div class="profile-banner">
        <div class="profile-identity">
          ${
            p.photo
              ? `<img class="profile-avatar" src="${p.photo}" alt="${esc(p.name)}">`
              : `<div class="profile-avatar" style="display:flex;align-items:center;justify-content:center;font-size:32px">👤</div>`
          }
          <div>
            <div class="eyebrow">${p.role === 'two-way' ? 'LANZADOR Y BATEADOR' : isPitcher(p) ? 'LANZADOR' : 'BATEADOR'}</div>
            <h1 class="profile-title">${esc(p.name)} <span style="color:var(--yellow)">#${esc(p.number || '—')}</span></h1>
            <div class="profile-meta">
              <span><b>Posición:</b> ${esc(p.position || '—')}</span>
              <span>•</span>
              <span><b>B/T:</b> ${esc(p.bats || 'D')}/${esc(p.throws || 'D')}</span>
              <span>•</span>
              <span><b>Edad:</b> ${esc(p.age || '—')}</span>
              <span>•</span>
              <span><b>Estatura/Peso:</b> ${esc(p.height || '—')} / ${esc(p.weight || '—')}</span>
            </div>
            <!-- REGLA N° 10: Equipo actual clickeable -->
            <div style="margin-top:10px;font-size:14px">
              <b>Equipo Actual:</b>
              ${
                p.team
                  ? `<span class="team-link" data-team-id="${p.team}" style="font-size:15px">${esc(teamName(p.team))}</span>`
                  : `<span class="muted">Sin equipo asignado</span>`
              }
            </div>
          </div>
        </div>
        <div class="profile-record-badge">
          <small>PROMEDIO DE BATEO</small>
          <b>${fmtAvg(p.bat?.AVG)}</b>
          <span style="color:var(--yellow);font-weight:700;font-size:13px">${p.bat?.H || 0} H • ${p.bat?.HR || 0} HR</span>
        </div>
      </div>

      <!-- REGLA N° 12: Último Partido del Jugador -->
      <div class="last-game-card">
        <h4>⚾ Actuación en su Último Partido</h4>
        ${
          lastGame
            ? `
          <div class="head">
            <div>
              <div class="last-game-line">
                ${
                  hasPitching && lastGame.pitchSummary
                    ? `Pitcheo: <span style="color:var(--yellow)">${lastGame.pitchSummary.line}</span> (ERA ${lastGame.pitchSummary.era})`
                    : ''
                }
                ${
                  lastGame.batSummary
                    ? `Bateo: <span style="color:var(--yellow)">${lastGame.batSummary.line}</span> ${
                        lastGame.batSummary.extra ? '— ' + lastGame.batSummary.extra : ''
                      }`
                    : ''
                }
              </div>
              <div class="muted" style="margin-top:6px;font-size:12px">
                Juego: <b>${esc(teamName(lastGame.game.away))} vs ${esc(teamName(lastGame.game.home))}</b> • Fecha: ${esc(
                lastGame.game.date
              )} • Marcador: ${lastGame.game.awayScore} - ${lastGame.game.homeScore}
              </div>
            </div>
          </div>`
            : '<span class="muted">El jugador aún no tiene apariciones registradas en partidos oficiales.</span>'
        }
      </div>

      <!-- SECCIÓN ADN DEL JUGADOR (ROSMIL LEAGUE 0.2) -->
      ${renderPlayerDNASection(p, pPas)}

      <div class="grid2" style="margin-bottom:20px;margin-top:20px">
        <!-- REGLA N° 11: Historial de Equipos del Jugador -->
        <div class="panel">
          <div class="head">
            <h2>Historial de Franquicias</h2>
            <span class="muted">Trayectoria en la liga</span>
          </div>
          <div class="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Temporada / Fecha</th>
                  <th>Equipo</th>
                  <th>Estatus</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Actual</td>
                  <td>
                    ${
                      p.team
                        ? `<span class="team-link" data-team-id="${p.team}">${esc(teamName(p.team))}</span>`
                        : '<span class="muted">Agente libre</span>'
                    }
                  </td>
                  <td><span class="tag" style="background:rgba(34,197,94,0.2);color:#4ade80">ACTUAL</span></td>
                </tr>
                ${(p.teamHistory || [])
                  .filter(h => h.teamId !== p.team)
                  .map(
                    h => `
                  <tr>
                    <td>${esc(h.date || h.seasonName || 'Anterior')}</td>
                    <td><span class="team-link" data-team-id="${h.teamId}">${esc(h.teamName || teamName(h.teamId))}</span></td>
                    <td><span class="tag" style="background:#133322;color:var(--muted)">ANTERIOR</span></td>
                  </tr>`
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Repertorio de Picheos (si aplica) -->
        <div class="panel">
          <div class="head">
            <h2>Repertorio y Habilidades</h2>
            <span class="muted">${isPitcher(p) ? 'Lanzamientos del pitcher' : 'Perfil ofensivo'}</span>
          </div>
          ${
            isPitcher(p)
              ? `
            <div style="margin-top:10px">
              ${
                (p.pitchTypes || []).length
                  ? (p.pitchTypes || []).map(pt => `<span class="tag" style="font-size:12px;padding:6px 10px;margin-bottom:6px">${esc(pt)}</span>`).join(' ')
                  : '<span class="muted">No tiene lanzamientos seleccionados.</span>'
              }
            </div>
            <div class="statgrid" style="margin-top:16px">
              <div class="statbox"><small>ERA Total</small><b>${(p.pitch?.ERA || 0).toFixed(2)}</b></div>
              <div class="statbox"><small>WHIP</small><b>${(p.pitch?.WHIP || 0).toFixed(2)}</b></div>
              <div class="statbox"><small>Ponches (SO)</small><b>${p.pitch?.SO || 0}</b></div>
            </div>`
              : `
            <div class="statgrid" style="margin-top:10px">
              <div class="statbox"><small>AVG</small><b>${fmtAvg(p.bat?.AVG)}</b></div>
              <div class="statbox"><small>OBP</small><b>${fmtAvg(p.bat?.OBP)}</b></div>
              <div class="statbox"><small>SLG</small><b>${fmtAvg(p.bat?.SLG)}</b></div>
              <div class="statbox"><small>OPS</small><b>${fmtAvg(p.bat?.OPS)}</b></div>
            </div>`
          }
        </div>
      </div>

      <!-- REGLAS 8 Y 9: ESTADÍSTICAS POR TEMPORADA Y SELECTOR BATEO / PITCHEO -->
      <div class="panel">
        <div class="head">
          <div>
            <h2>Estadísticas Históricas de la Carrera</h2>
            <span class="muted">Desglose oficial por temporada (Baseball-Reference style)</span>
          </div>
          ${
            hasPitching
              ? `
            <div class="role-tabs">
              <button id="tabBattingBtn" class="${activePlayerTab === 'batting' ? 'active' : ''}">BATEO</button>
              <button id="tabPitchingBtn" class="${activePlayerTab === 'pitching' ? 'active' : ''}">PITCHEO</button>
            </div>`
              : ''
          }
        </div>

        ${
          activePlayerTab === 'batting' || !hasPitching
            ? `
          <!-- Tabla de Bateo por Temporada -->
          <div class="tablewrap" style="margin-top:10px">
            <table>
              <thead>
                <tr>
                  <th>Temporada</th>
                  <th>Equipo</th>
                  <th>PA</th>
                  <th>AB</th>
                  <th>R</th>
                  <th>H</th>
                  <th>2B</th>
                  <th>3B</th>
                  <th>HR</th>
                  <th>RBI</th>
                  <th>BB</th>
                  <th>SO</th>
                  <th>SB</th>
                  <th>AVG</th>
                  <th>OBP</th>
                  <th>SLG</th>
                  <th>OPS</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(seasonsMap)
                  .map(([sId, sPas]) => {
                    const st = batterStats(p.id, sPas);
                    return `
                    <tr>
                      <td><b>${esc(seasonName(sId))}</b></td>
                      <td>${esc(teamName(p.team))}</td>
                      <td>${st.PA}</td>
                      <td>${st.AB}</td>
                      <td>${st.R}</td>
                      <td><b>${st.H}</b></td>
                      <td>${st.D}</td>
                      <td>${st.T}</td>
                      <td><b>${st.HR}</b></td>
                      <td>${st.RBI}</td>
                      <td>${st.BB}</td>
                      <td>${st.SO}</td>
                      <td>${st.SB}</td>
                      <td><b>${fmtAvg(st.AVG)}</b></td>
                      <td>${fmtAvg(st.OBP)}</td>
                      <td>${fmtAvg(st.SLG)}</td>
                      <td><b>${fmtAvg(st.OPS)}</b></td>
                    </tr>`;
                  })
                  .join('')}
                <!-- Total de Carrera -->
                <tr style="background:rgba(250,204,21,0.1);font-weight:800">
                  <td style="color:var(--yellow)">TOTAL CARRERA</td>
                  <td>${esc(teamName(p.team))}</td>
                  <td>${p.bat?.PA || 0}</td>
                  <td>${p.bat?.AB || 0}</td>
                  <td>${p.bat?.R || 0}</td>
                  <td><b>${p.bat?.H || 0}</b></td>
                  <td>${p.bat?.D || 0}</td>
                  <td>${p.bat?.T || 0}</td>
                  <td><b>${p.bat?.HR || 0}</b></td>
                  <td>${p.bat?.RBI || 0}</td>
                  <td>${p.bat?.BB || 0}</td>
                  <td>${p.bat?.SO || 0}</td>
                  <td>${p.bat?.SB || 0}</td>
                  <td><b>${fmtAvg(p.bat?.AVG)}</b></td>
                  <td>${fmtAvg(p.bat?.OBP)}</td>
                  <td>${fmtAvg(p.bat?.SLG)}</td>
                  <td><b>${fmtAvg(p.bat?.OPS)}</b></td>
                </tr>
              </tbody>
            </table>
          </div>`
            : `
          <!-- Tabla de Pitcheo por Temporada -->
          <div class="tablewrap" style="margin-top:10px">
            <table>
              <thead>
                <tr>
                  <th>Temporada</th>
                  <th>Equipo</th>
                  <th>BF</th>
                  <th>IP</th>
                  <th>H</th>
                  <th>R</th>
                  <th>ER</th>
                  <th>BB</th>
                  <th>SO</th>
                  <th>HR</th>
                  <th>ERA</th>
                  <th>WHIP</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(seasonsMap)
                  .map(([sId, sPas]) => {
                    const pst = pitcherStats(p.id, sPas);
                    return `
                    <tr>
                      <td><b>${esc(seasonName(sId))}</b></td>
                      <td>${esc(teamName(p.team))}</td>
                      <td>${pst.BF}</td>
                      <td><b>${pst.IP}</b></td>
                      <td>${pst.H}</td>
                      <td>${pst.R}</td>
                      <td>${pst.ER}</td>
                      <td>${pst.BB}</td>
                      <td><b>${pst.SO}</b></td>
                      <td>${pst.HR}</td>
                      <td><b>${pst.ERA.toFixed(2)}</b></td>
                      <td><b>${pst.WHIP.toFixed(2)}</b></td>
                    </tr>`;
                  })
                  .join('')}
                <!-- Total Carrera Pitcheo -->
                <tr style="background:rgba(250,204,21,0.1);font-weight:800">
                  <td style="color:var(--yellow)">TOTAL CARRERA</td>
                  <td>${esc(teamName(p.team))}</td>
                  <td>${p.pitch?.BF || 0}</td>
                  <td><b>${p.pitch?.IP || '0.0'}</b></td>
                  <td>${p.pitch?.H || 0}</td>
                  <td>${p.pitch?.R || 0}</td>
                  <td>${p.pitch?.ER || 0}</td>
                  <td>${p.pitch?.BB || 0}</td>
                  <td><b>${p.pitch?.SO || 0}</b></td>
                  <td>${p.pitch?.HR || 0}</td>
                  <td><b>${(p.pitch?.ERA || 0).toFixed(2)}</b></td>
                  <td><b>${(p.pitch?.WHIP || 0).toFixed(2)}</b></td>
                </tr>
              </tbody>
            </table>
          </div>`
        }
      </div>
    `;

    // Botones de pestañas Bateo / Pitcheo
    const bBtn = $('#tabBattingBtn');
    const pBtn = $('#tabPitchingBtn');
    if (bBtn) {
      bBtn.onclick = () => {
        activePlayerTab = 'batting';
        renderPlayerProfile();
      };
    }
    if (pBtn) {
      pBtn.onclick = () => {
        activePlayerTab = 'pitching';
        renderPlayerProfile();
      };
    }
  }

  // ----------------------------------------------------
  // RENDER: PANELES GENERALES DE LA LIGA
  // ----------------------------------------------------
  function renderTeams() {
    const el = $('#teamsList');
    if (!db.teams.length) {
      el.innerHTML = empty('No hay equipos', 'Usa “Crear equipo” para comenzar.');
      return;
    }
    el.innerHTML = `
      <div class="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Equipo</th>
              <th>Ciudad</th>
              <th>Manager</th>
              <th>Récord</th>
              <th>Jugadores Actuales</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${db.teams
              .map(t => {
                const rec = calculateTeamRecord(t.id);
                const actualRoster = teamPlayers(t.id);
                return `
              <tr>
                <td>
                  ${t.logo ? `<img class="teamlogo" src="${t.logo}" alt="">` : ''}
                  <span class="team-link" data-team-id="${t.id}" style="font-size:14px">${esc(t.name)}</span>
                </td>
                <td>${esc(t.city || '—')}</td>
                <td>${esc(t.manager || '—')}</td>
                <td><b style="color:var(--yellow)">${rec.w} - ${rec.l}</b> (${rec.pct.toFixed(3).replace('0.', '.')})</td>
                <td><b>${actualRoster.length}</b> jugadores</td>
                <td class="actions">
                  <button class="btn yellow" data-view-team="${t.id}">Ver Perfil</button>
                  <button class="btn admin-only" data-edit-team="${t.id}">Editar</button>
                  <button class="btn danger admin-only" data-del-team="${t.id}">Eliminar</button>
                </td>
              </tr>`;
              })
              .join('')}
          </tbody>
        </table>
      </div>`;

    $$('[data-view-team]').forEach(b => (b.onclick = () => openTeamProfile(b.dataset.viewTeam)));
    $$('[data-edit-team]').forEach(
      b =>
        (b.onclick = () => {
          if (!checkAdmin()) return;
          openModal('teamModal');
          prepareTeamModal(b.dataset.editTeam);
        })
    );
    $$('[data-del-team]').forEach(
      b =>
        (b.onclick = () => {
          const tid = b.dataset.delTeam;
          requestDoubleDelete(
            `Equipo: ${teamName(tid)}`,
            'Esta acción eliminará el equipo de la liga y desvinculará a sus jugadores.',
            () => remove('teams', tid, 'teams')
          );
        })
    );
  }

  function renderPlayers() {
    const el = $('#playersList');
    if (!db.players.length) {
      el.innerHTML = empty('No hay jugadores', 'Crea los jugadores de tus equipos.');
      return;
    }
    el.innerHTML = `
      <div class="tablewrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Jugador</th>
              <th>Equipo Actual</th>
              <th>Rol</th>
              <th>Posición</th>
              <th>AVG</th>
              <th>HR</th>
              <th>ERA</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${db.players
              .map(
                p => `
              <tr>
                <td><b>#${esc(p.number || '—')}</b></td>
                <td>
                  ${p.photo ? `<img class="avatar" src="${p.photo}" alt="">` : ''}
                  <span class="player-link" data-player-id="${p.id}" style="font-size:14px">${esc(p.name)}</span>
                </td>
                <td>
                  ${
                    p.team
                      ? `<span class="team-link" data-team-id="${p.team}">${esc(teamName(p.team))}</span>`
                      : '<span class="muted">Sin equipo</span>'
                  }
                </td>
                <td>${p.role === 'two-way' ? 'Two-Way' : isPitcher(p) ? 'Lanzador' : 'Bateador'}</td>
                <td>${esc(p.position || '—')}</td>
                <td><b>${fmtAvg(p.bat?.AVG)}</b></td>
                <td>${p.bat?.HR || 0}</td>
                <td>${isPitcher(p) ? (p.pitch?.ERA || 0).toFixed(2) : '—'}</td>
                <td class="actions">
                  <button class="btn yellow" data-view-player="${p.id}">Ver Perfil</button>
                  <button class="btn admin-only" data-edit-player="${p.id}">Editar</button>
                  <button class="btn danger admin-only" data-del-player="${p.id}">Eliminar</button>
                </td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`;

    $$('[data-view-player]').forEach(b => (b.onclick = () => openPlayerProfile(b.dataset.viewPlayer)));
    $$('[data-edit-player]').forEach(
      b =>
        (b.onclick = () => {
          if (!checkAdmin()) return;
          openModal('playerModal');
          preparePlayerModal(b.dataset.editPlayer);
        })
    );
    $$('[data-del-player]').forEach(
      b =>
        (b.onclick = () => {
          const pid = b.dataset.delPlayer;
          requestDoubleDelete(
            `Jugador: ${playerName(pid)}`,
            'Esta acción eliminará al jugador de la base de datos.',
            () => remove('players', pid, 'players')
          );
        })
    );
  }

  // ----------------------------------------------------
  // ASISTENTE DE CREACIÓN DE PARTIDOS (ROSMIL LEAGUE 0.2 - WIZARD)
  // ----------------------------------------------------
  function populateWizardSelects() {
    const seasonOpts = db.seasons.length
      ? db.seasons
          .map(
            s =>
              `<option value="${s.id}">${esc(s.name)} (${s.type === 'league' ? 'Liga' : 'Eliminatoria'})</option>`
          )
          .join('')
      : '<option value="">Sin temporadas creadas</option>';
    if ($('#wizGameSeason')) $('#wizGameSeason').innerHTML = seasonOpts;

    const teamOpts = db.teams.length
      ? db.teams.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')
      : '<option value="">Sin equipos</option>';
    if ($('#wizHomeTeam')) $('#wizHomeTeam').innerHTML = teamOpts;
    if ($('#wizAwayTeam')) $('#wizAwayTeam').innerHTML = teamOpts;

    if (db.teams.length > 1 && $('#wizAwayTeam')) {
      $('#wizAwayTeam').value = db.teams[1].id;
    }
  }

  function openGameWizard() {
    if (!checkAdmin()) return;
    if (db.teams.length < 2) {
      alert('Debes registrar al menos 2 equipos para crear un partido.');
      return;
    }

    wizardState = {
      step: 1,
      gameName: '',
      season: db.seasons[0]?.id || '',
      date: new Date().toISOString().split('T')[0],
      time: '19:00',
      stadium: '',
      innings: 7,
      outsPerInning: 3,
      homeTeam: db.teams[0].id,
      awayTeam: db.teams[1] ? db.teams[1].id : db.teams[0].id,
      homePositions: {},
      homeBattingOrder: [],
      awayPositions: {},
      awayBattingOrder: []
    };

    if ($('#wizGameDate')) $('#wizGameDate').value = wizardState.date;
    if ($('#wizGameTime')) $('#wizGameTime').value = wizardState.time;
    if ($('#wizGameName')) {
      $('#wizGameName').value = `${teamName(wizardState.awayTeam)} vs ${teamName(wizardState.homeTeam)}`;
    }
    if ($('#wizOutsPerInning')) $('#wizOutsPerInning').value = 3;

    populateWizardSelects();
    setWizardStep(1);
    openModal('gameWizardModal');
  }

  function setWizardStep(step) {
    wizardState.step = step;

    for (let i = 1; i <= 6; i++) {
      const pill = $(`#pillStep${i}`);
      const page = $(`#wizPage${i}`);
      if (pill) {
        pill.classList.toggle('active', i === step);
        pill.classList.toggle('completed', i < step);
      }
      if (page) {
        page.style.display = i === step ? 'block' : 'none';
      }
    }

    if (step === 4) {
      if ($('#wizHomeTeamNameLabel')) {
        $('#wizHomeTeamNameLabel').textContent = teamName(wizardState.homeTeam);
      }
      renderFieldPositions('homeFieldPositions', wizardState.homeTeam, wizardState.homePositions);
      renderBattingOrder('homeOrderList', wizardState.homeTeam, wizardState.homeBattingOrder);
    } else if (step === 5) {
      if ($('#wizAwayTeamNameLabel')) {
        $('#wizAwayTeamNameLabel').textContent = teamName(wizardState.awayTeam);
      }
      renderFieldPositions('awayFieldPositions', wizardState.awayTeam, wizardState.awayPositions);
      renderBattingOrder('awayOrderList', wizardState.awayTeam, wizardState.awayBattingOrder);
    } else if (step === 6) {
      renderWizardSummary();
    }
  }

  function renderFieldPositions(containerId, teamId, positionsMap) {
    const players = teamPlayers(teamId);
    const container = $(`#${containerId}`);
    if (!container) return;

    const selects = container.querySelectorAll('.pos-select');
    selects.forEach(sel => {
      const pos = sel.dataset.fieldPos;
      sel.innerHTML =
        `<option value="">-- ${pos} --</option>` +
        players
          .map(
            p =>
              `<option value="${p.id}" ${positionsMap[pos] === p.id ? 'selected' : ''}>${esc(p.name)} (#${esc(
                p.number || '—'
              )})</option>`
          )
          .join('');

      if (!positionsMap[pos]) {
        const matched = players.find(
          p => p.position === pos && !Object.values(positionsMap).includes(p.id)
        );
        if (matched) {
          positionsMap[pos] = matched.id;
          sel.value = matched.id;
        } else if (pos === 'P') {
          const defaultP = players.find(p => isPitcher(p)) || players[0];
          if (defaultP) {
            positionsMap[pos] = defaultP.id;
            sel.value = defaultP.id;
          }
        }
      }

      sel.onchange = () => {
        positionsMap[pos] = sel.value;
      };
    });
  }

  function renderBattingOrder(containerId, teamId, orderArray) {
    const players = teamPlayers(teamId);
    const container = $(`#${containerId}`);
    if (!container) return;

    while (orderArray.length < 9) {
      const idx = orderArray.length;
      orderArray.push(players[idx] ? players[idx].id : '');
    }

    container.innerHTML = orderArray
      .map(
        (selectedPid, idx) => `
      <div class="order-item-row">
        <div class="order-idx">${idx + 1}</div>
        <select class="order-select" data-order-idx="${idx}">
          <option value="">-- Bateador #${idx + 1} --</option>
          ${players
            .map(
              p =>
                `<option value="${p.id}" ${p.id === selectedPid ? 'selected' : ''}>${esc(p.name)} (#${esc(
                  p.number || '—'
                )}) - ${esc(p.position || '')}</option>`
            )
            .join('')}
        </select>
      </div>`
      )
      .join('');

    container.querySelectorAll('.order-select').forEach(sel => {
      sel.onchange = () => {
        const i = Number(sel.dataset.orderIdx);
        orderArray[i] = sel.value;
      };
    });
  }

  function autoFillBattingOrder(teamId, orderArray, containerId) {
    const players = teamPlayers(teamId);
    for (let i = 0; i < 9; i++) {
      orderArray[i] = players[i] ? players[i].id : '';
    }
    renderBattingOrder(containerId, teamId, orderArray);
  }

  function renderWizardSummary() {
    const el = $('#wizSummaryArea');
    if (!el) return;

    const hTeam = teamName(wizardState.homeTeam);
    const aTeam = teamName(wizardState.awayTeam);
    const sName = seasonName(wizardState.season);

    el.innerHTML = `
      <div class="head">
        <div>
          <h3 style="color:var(--yellow);margin:0">${esc(wizardState.gameName || `${aTeam} vs ${hTeam}`)}</h3>
          <div class="muted">${esc(sName)} • ${esc(wizardState.date)} ${esc(wizardState.time || '')} ${
      wizardState.stadium ? '• ' + esc(wizardState.stadium) : ''
    }</div>
        </div>
        <span class="tag" style="background:#0e3621;color:var(--yellow)">${wizardState.innings} Entradas • ${
      wizardState.outsPerInning
    } Outs/Media Entrada</span>
      </div>

      <div class="wiz-summary-grid">
        <div class="wiz-summary-team">
          <h4>VISITANTE: ${esc(aTeam)}</h4>
          <small class="muted">Batea en la parte alta</small>
          <div style="margin-top:10px;font-size:13px">
            <b>Orden de Bateo Oficial:</b>
            <ol style="margin:6px 0;padding-left:20px">
              ${wizardState.awayBattingOrder
                .map(pid => `<li>${pid ? esc(playerName(pid)) : '<span class="muted">Sin asignar</span>'}</li>`)
                .join('')}
            </ol>
          </div>
        </div>

        <div class="wiz-summary-team">
          <h4>LOCAL: ${esc(hTeam)}</h4>
          <small class="muted">Batea en la parte baja</small>
          <div style="margin-top:10px;font-size:13px">
            <b>Orden de Bateo Oficial:</b>
            <ol style="margin:6px 0;padding-left:20px">
              ${wizardState.homeBattingOrder
                .map(pid => `<li>${pid ? esc(playerName(pid)) : '<span class="muted">Sin asignar</span>'}</li>`)
                .join('')}
            </ol>
          </div>
        </div>
      </div>
    `;
  }

  function startLiveGameFromWizard() {
    if (!checkAdmin()) return;

    if (!wizardState.homeTeam || !wizardState.awayTeam || wizardState.homeTeam === wizardState.awayTeam) {
      alert('Debes seleccionar dos equipos diferentes.');
      return;
    }

    const gid = id();
    const g = {
      id: gid,
      name: wizardState.gameName || `${teamName(wizardState.awayTeam)} vs ${teamName(wizardState.homeTeam)}`,
      season: wizardState.season || db.seasons[0]?.id || '',
      date: wizardState.date || new Date().toISOString().split('T')[0],
      time: wizardState.time || '',
      stadium: wizardState.stadium || '',
      home: wizardState.homeTeam,
      away: wizardState.awayTeam,
      innings: Number(wizardState.innings) || 7,
      outsPerInning: Number(wizardState.outsPerInning) || 3,
      homeScore: 0,
      awayScore: 0,
      homePositions: wizardState.homePositions,
      awayPositions: wizardState.awayPositions,
      homeLineup: wizardState.homeBattingOrder.filter(Boolean),
      awayLineup: wizardState.awayBattingOrder.filter(Boolean),
      batLog: [],
      runners: { '1B': null, '2B': null, '3B': null },
      status: 'LIVE'
    };

    if (!g.homeLineup.length) {
      g.homeLineup = teamPlayers(g.home).map(p => p.id).slice(0, 9);
    }
    if (!g.awayLineup.length) {
      g.awayLineup = teamPlayers(g.away).map(p => p.id).slice(0, 9);
    }

    db.games.push(g);
    localStorage.setItem('rosmil_active_game_id', gid);
    save();
    closeModals();
    initLiveGame(gid);
  }

  // ----------------------------------------------------
  // MOTOR 2D: CORREDORES, FOTOS REALES Y FÍSICA DE BÉISBOL (ROSMIL LEAGUE 0.3)
  // ----------------------------------------------------
  function createRunnerBadgeHTML(playerId) {
    if (!playerId) return '';
    const p = db.players.find(x => x.id === playerId);
    if (!p) return '';
    const name = esc(p.name || 'Jugador');
    const firstName = esc((p.name || '').split(' ')[0] || 'Jugador');
    const num = p.number !== '' && p.number != null ? `#${esc(p.number)}` : '';
    const initials = (p.name || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0].toUpperCase())
      .join('') || '⚾';

    if (p.photo) {
      return `
        <div class="stadium-runner-node" data-player-id="${p.id}" title="${name} ${num}">
          <img class="runner-avatar-img" src="${p.photo}" alt="${name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
          <div class="runner-avatar-fallback" style="display:none">${initials}</div>
          <span class="runner-name-tag">${firstName} ${num}</span>
        </div>`;
    } else {
      return `
        <div class="stadium-runner-node" data-player-id="${p.id}" title="${name} ${num}">
          <div class="runner-avatar-fallback">${initials}</div>
          <span class="runner-name-tag">${firstName} ${num}</span>
        </div>`;
    }
  }

  function renderStadiumDiamond(prefix, runners, pitcherId = null, batterId = null) {
    const r = runners || { '1B': null, '2B': null, '3B': null };
    const bases = ['1B', '2B', '3B'];

    bases.forEach(base => {
      const slot = $(`#${prefix}RunnerSlot${base}`);
      if (!slot) return;
      const pid = r[base];
      if (pid) {
        slot.classList.add('occupied');
        slot.innerHTML = createRunnerBadgeHTML(pid);
      } else {
        slot.classList.remove('occupied');
        slot.innerHTML = '';
      }
    });

    const homeSlot = $(`#${prefix}RunnerSlotHome`);
    if (homeSlot) {
      if (batterId) {
        homeSlot.innerHTML = createRunnerBadgeHTML(batterId);
        homeSlot.classList.add('at-bat');
      } else {
        homeSlot.innerHTML = '';
        homeSlot.classList.remove('at-bat');
      }
    }

    const moundSlot = $(`#${prefix}PitcherMoundNode`);
    if (moundSlot && pitcherId) {
      const p = db.players.find(x => x.id === pitcherId);
      if (p) {
        moundSlot.title = `Lanzador: ${p.name}`;
      }
    }
  }

  function triggerStadiumAnimation(prefix, action, rbi, isHR) {
    const splash = $(`#${prefix}ActionSplash`);
    const ball = $(`#${prefix}BallNode`);

    let text = 'JUGADA';
    let typeClass = 'single';

    if (isHR) {
      text = `🚀 HOME RUN! +${rbi || 1} CA`;
      typeClass = 'hr';
    } else if (action === 'Triple') {
      text = '⚡ TRIPLE (3B)!';
      typeClass = 'triple';
    } else if (action === 'Double') {
      text = '🔥 DOBLE (2B)!';
      typeClass = 'double';
    } else if (action === 'Single') {
      text = '⚾ HIT!';
      typeClass = 'single';
    } else if (action.includes('Strikeout')) {
      text = '❌ PONCHE (SO)!';
      typeClass = 'strikeout';
    } else if (action.includes('out')) {
      text = '🛑 OUT!';
      typeClass = 'out';
    } else if (action === 'Walk' || action === 'HBP') {
      text = '🚶 BASE POR BOLAS';
      typeClass = 'walk';
    } else if (action === 'Reached Error') {
      text = '⚠️ ERROR DEFENSIVO';
      typeClass = 'error';
    } else if (action === 'Sac Fly' || action === 'Sac Bunt') {
      text = '✈️ SACRIFICIO';
      typeClass = 'sac';
    }

    if (splash) {
      splash.textContent = text;
      splash.className = `stadium-play-splash active ${typeClass}`;
    }

    if (ball) {
      ball.className = `stadium-animated-ball active fly-${typeClass}`;
    }

    setTimeout(() => {
      if (splash) splash.classList.remove('active');
      if (ball) ball.className = 'stadium-animated-ball';
    }, 1100);
  }

  function advanceRunners(currentRunners, result, batterId, explicitRbi = 0) {
    const prev = {
      '1B': currentRunners?.['1B'] || null,
      '2B': currentRunners?.['2B'] || null,
      '3B': currentRunners?.['3B'] || null
    };
    const next = { '1B': null, '2B': null, '3B': null };
    const scoringPlayerIds = [];

    const isHR = result === 'Home Run';
    const isTriple = result === 'Triple';
    const isDouble = result === 'Double';
    const isSingle = result === 'Single';
    const isWalk = result === 'Walk' || result === 'HBP';
    const isSacFly = result === 'Sac Fly';
    const isError = result === 'Reached Error';
    const isOut = result.includes('out') || result.includes('Strikeout');

    if (isHR) {
      if (prev['3B']) scoringPlayerIds.push(prev['3B']);
      if (prev['2B']) scoringPlayerIds.push(prev['2B']);
      if (prev['1B']) scoringPlayerIds.push(prev['1B']);
      if (batterId) scoringPlayerIds.push(batterId);
    } else if (isTriple) {
      if (prev['3B']) scoringPlayerIds.push(prev['3B']);
      if (prev['2B']) scoringPlayerIds.push(prev['2B']);
      if (prev['1B']) scoringPlayerIds.push(prev['1B']);
      next['3B'] = batterId;
    } else if (isDouble) {
      if (prev['3B']) scoringPlayerIds.push(prev['3B']);
      if (prev['2B']) scoringPlayerIds.push(prev['2B']);
      if (prev['1B']) {
        if (explicitRbi >= 3 || (explicitRbi >= 2 && !prev['2B'] && !prev['3B'])) {
          scoringPlayerIds.push(prev['1B']);
        } else {
          next['3B'] = prev['1B'];
        }
      }
      next['2B'] = batterId;
    } else if (isSingle) {
      if (prev['3B']) scoringPlayerIds.push(prev['3B']);
      if (prev['2B']) {
        if (explicitRbi >= 2 || (explicitRbi === 1 && !prev['3B'])) {
          scoringPlayerIds.push(prev['2B']);
        } else {
          next['3B'] = prev['2B'];
        }
      }
      if (prev['1B']) {
        if (!next['2B']) next['2B'] = prev['1B'];
        else if (!next['3B']) next['3B'] = prev['1B'];
      }
      next['1B'] = batterId;
    } else if (isWalk) {
      next['1B'] = batterId;
      if (prev['1B']) {
        next['2B'] = prev['1B'];
        if (prev['2B']) {
          next['3B'] = prev['2B'];
          if (prev['3B']) {
            scoringPlayerIds.push(prev['3B']);
          }
        } else {
          next['3B'] = prev['3B'];
        }
      } else {
        next['2B'] = prev['2B'];
        next['3B'] = prev['3B'];
      }
    } else if (isSacFly) {
      if (prev['3B']) scoringPlayerIds.push(prev['3B']);
      next['2B'] = prev['2B'];
      next['1B'] = prev['1B'];
    } else if (isError) {
      if (prev['3B']) scoringPlayerIds.push(prev['3B']);
      if (prev['2B']) next['3B'] = prev['2B'];
      if (prev['1B']) next['2B'] = prev['1B'];
      next['1B'] = batterId;
    } else if (isOut) {
      next['1B'] = prev['1B'];
      next['2B'] = prev['2B'];
      next['3B'] = prev['3B'];
    } else {
      next['1B'] = prev['1B'];
      next['2B'] = prev['2B'];
      next['3B'] = prev['3B'];
    }

    const runsCount = Math.max(scoringPlayerIds.length, explicitRbi || (isHR ? 1 : 0));

    return {
      nextRunners: next,
      scoringPlayerIds,
      runsScored: runsCount
    };
  }

  // ----------------------------------------------------
  // CONSOLA DE PARTIDO EN VIVO INTERACTIVA (ROSMIL LEAGUE 0.3)
  // ----------------------------------------------------
  function initLiveGame(gameId) {
    const g = getGame(gameId);
    if (!g) return;

    const awayLineup =
      g.awayLineup && g.awayLineup.length ? g.awayLineup : teamPlayers(g.away).map(p => p.id);
    const homeLineup =
      g.homeLineup && g.homeLineup.length ? g.homeLineup : teamPlayers(g.home).map(p => p.id);

    const defaultPitcherHome =
      g.homePositions?.P || teamPlayers(g.home, false, true)[0]?.id || homeLineup[0] || null;
    const defaultPitcherAway =
      g.awayPositions?.P || teamPlayers(g.away, false, true)[0]?.id || awayLineup[0] || null;

    let currentInning = 1;
    let currentHalf = 'away';
    let outsCount = 0;
    let awayIdx = 0;
    let homeIdx = 0;
    let reconstructedRunners = { '1B': null, '2B': null, '3B': null };

    // Si ya tiene corredores guardados, utilizarlos
    if (g.runners && typeof g.runners === 'object') {
      reconstructedRunners = { ...g.runners };
    }

    (g.batLog || []).forEach(pa => {
      currentInning = Number(pa.inning) || 1;
      currentHalf = pa.half || 'away';
      if (pa.runnersAfter) {
        reconstructedRunners = { ...pa.runnersAfter };
      }
      if (Number(pa.outs) > 0) {
        outsCount += Number(pa.outs);
        if (outsCount >= (g.outsPerInning || 3)) {
          outsCount = 0;
          reconstructedRunners = { '1B': null, '2B': null, '3B': null };
          if (currentHalf === 'away') {
            currentHalf = 'home';
          } else {
            currentHalf = 'away';
            currentInning++;
          }
        }
      }
      if (pa.half === 'away') {
        awayIdx = (awayIdx + 1) % (awayLineup.length || 1);
      } else {
        homeIdx = (homeIdx + 1) % (homeLineup.length || 1);
      }
    });

    liveGameState = {
      active: true,
      gameId: g.id,
      game: g,
      inning: currentInning,
      half: currentHalf,
      outs: outsCount,
      awayScore: Number(g.awayScore) || 0,
      homeScore: Number(g.homeScore) || 0,
      awayBattingIndex: awayIdx,
      homeBattingIndex: homeIdx,
      activePitcherAway: g.activePitcherAway || defaultPitcherAway,
      activePitcherHome: g.activePitcherHome || defaultPitcherHome,
      selectedPlayResult: 'Single',
      selectedRbi: 0,
      runners: reconstructedRunners,
      undoStack: [],
      redoStack: []
    };

    localStorage.setItem('rosmil_active_game_id', g.id);

    closeModals();
    $('#liveGameModal').classList.add('open');
    renderLiveGameUI();
    updateActiveGameBanner();
  }

  function renderLiveGameUI() {
    const g = liveGameState.game;
    if (!g) return;

    const isAwayBatting = liveGameState.half === 'away';
    const battingTeamId = isAwayBatting ? g.away : g.home;
    const pitchingTeamId = isAwayBatting ? g.home : g.away;

    const lineup = isAwayBatting
      ? g.awayLineup?.length ? g.awayLineup : teamPlayers(g.away).map(p => p.id)
      : g.homeLineup?.length ? g.homeLineup : teamPlayers(g.home).map(p => p.id);

    const currentIndex = isAwayBatting ? liveGameState.awayBattingIndex : liveGameState.homeBattingIndex;
    const batterId = lineup[currentIndex] || teamPlayers(battingTeamId)[0]?.id;
    const pitcherId = isAwayBatting ? liveGameState.activePitcherHome : liveGameState.activePitcherAway;

    const batter = db.players.find(x => x.id === batterId);
    const pitcher = db.players.find(x => x.id === pitcherId);
    const awayTeamObj = db.teams.find(x => x.id === g.away);
    const homeTeamObj = db.teams.find(x => x.id === g.home);

    // Marcador Superior
    $('#liveAwayName').textContent = teamName(g.away);
    $('#liveHomeName').textContent = teamName(g.home);
    $('#liveAwayScore').textContent = g.awayScore;
    $('#liveHomeScore').textContent = g.homeScore;

    if (awayTeamObj?.logo) {
      $('#liveAwayLogo').innerHTML = `<img src="${awayTeamObj.logo}" alt="">`;
    } else {
      $('#liveAwayLogo').textContent = '⚾';
    }
    if (homeTeamObj?.logo) {
      $('#liveHomeLogo').innerHTML = `<img src="${homeTeamObj.logo}" alt="">`;
    } else {
      $('#liveHomeLogo').textContent = '⚾';
    }

    $('#liveAwayTag').textContent = isAwayBatting ? 'AL BATE' : 'DEFENSIVA';
    $('#liveHomeTag').textContent = !isAwayBatting ? 'AL BATE' : 'DEFENSIVA';

    // Entrada y Luces de Outs
    $('#liveInningText').textContent = `ENTRADA ${liveGameState.inning} (${isAwayBatting ? 'ALTA' : 'BAJA'})`;

    $('#outDot1').classList.toggle('active', liveGameState.outs >= 1);
    $('#outDot2').classList.toggle('active', liveGameState.outs >= 2);
    $('#outDot3').classList.toggle('active', liveGameState.outs >= 3);

    // Bateador Activo
    $('#liveBatterName').textContent = batter?.name || 'Bateador';
    $('#liveBatterMeta').textContent = `#${currentIndex + 1} en orden (${teamName(battingTeamId)}) • Pos: ${
      batter?.position || 'DH'
    }`;
    if (batter?.photo) {
      $('#liveBatterPhoto').innerHTML = `<img src="${batter.photo}" alt="">`;
    } else {
      $('#liveBatterPhoto').textContent = '👤';
    }

    // Pitcher Activo
    $('#livePitcherName').textContent = pitcher?.name || 'Lanzador';
    $('#livePitcherMeta').textContent = `Lanzando por ${teamName(pitchingTeamId)}`;
    if (pitcher?.photo) {
      $('#livePitcherPhoto').innerHTML = `<img src="${pitcher.photo}" alt="">`;
    } else {
      $('#livePitcherPhoto').textContent = '⚾';
    }

    // Botones de Jugada seleccionada
    $$('.btn-play-action').forEach(b => {
      b.classList.toggle('selected', b.dataset.action === liveGameState.selectedPlayResult);
    });

    // Botones de RBI seleccionado
    $$('.btn-rbi-opt').forEach(b => {
      b.classList.toggle('active', Number(b.dataset.rbi) === liveGameState.selectedRbi);
    });

    // ACTUALIZAR MAPA 2D DEL ESTADIO CON FOTOS REALES (SECCIONES 1, 2, 3, 5, 8, 9)
    renderStadiumDiamond('live', liveGameState.runners, pitcherId, batterId);

    // Botones de Deshacer y Rehacer
    if ($('#btnLiveUndo')) {
      $('#btnLiveUndo').disabled = liveGameState.undoStack.length === 0;
    }
    if ($('#btnLiveRedo')) {
      $('#btnLiveRedo').disabled = liveGameState.redoStack.length === 0;
    }

    // PLAY-BY-PLAY CON FOTOS REALES (SECCIONES 10, 11 Y 38)
    const log = g.batLog || [];
    $('#livePlayCount').textContent = log.length;
    $('#liveLogList').innerHTML = log.length
      ? log
          .slice()
          .reverse()
          .slice(0, 15)
          .map(pa => {
            const bp = db.players.find(x => x.id === pa.batter);
            const avatarHTML = bp?.photo
              ? `<img src="${bp.photo}" class="pbp-thumb-avatar" alt="${esc(bp.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" /><div class="pbp-thumb-fallback" style="display:none">${(bp?.name || 'J')[0]}</div>`
              : `<div class="pbp-thumb-fallback">${(bp?.name || 'J')[0]}</div>`;
            return `
              <div class="live-log-row pbp-event-row" data-pbp-id="${pa.id}">
                <div style="display:flex;align-items:center;gap:8px">
                  ${avatarHTML}
                  <div>
                    <b>Inn ${pa.inning} (${pa.half === 'away' ? 'VIS' : 'LOC'}):</b> ${esc(
                      playerName(pa.batter)
                    )} <span class="action-tag ${pa.result.toLowerCase().replace(/\s+/g, '-')}">${esc(
                      resultLabel(pa.result)
                    )}</span>
                  </div>
                </div>
                <span style="color:${pa.rbi > 0 ? '#4ade80' : 'var(--muted)'};font-size:12px">
                  ${pa.rbi > 0 ? `+${pa.rbi} RBI` : ''} ${pa.outs > 0 ? '• 1 Out' : ''}
                </span>
              </div>`;
          })
          .join('')
      : '<span class="muted" style="font-size:12px;padding:6px">Sin jugadas aún en este partido.</span>';

    // Click en evento del play-by-play para inspeccionar jugada
    $$('#liveLogList .pbp-event-row').forEach(row => {
      row.onclick = () => {
        const targetId = row.dataset.pbpId;
        const targetPa = (g.batLog || []).find(x => x.id === targetId);
        if (targetPa && targetPa.runnersAfter) {
          renderStadiumDiamond('live', targetPa.runnersAfter, targetPa.pitcher, targetPa.batter);
          triggerStadiumAnimation('live', targetPa.result, targetPa.rbi, targetPa.result === 'Home Run');
        }
      };
    });

    $('#livePlayBox').style.display = 'block';
    $('#liveInningEndPanel').style.display = 'none';
    $('#liveGameOverPanel').style.display = 'none';
  }

  function handleSelectPlayResult(action) {
    liveGameState.selectedPlayResult = action;

    if (
      action === 'Strikeout Swinging' ||
      action === 'Strikeout Looking' ||
      action === 'Groundout' ||
      action === 'Flyout' ||
      action === 'Lineout'
    ) {
      liveGameState.selectedRbi = 0;
    } else if (action === 'Home Run') {
      if (liveGameState.selectedRbi === 0) liveGameState.selectedRbi = 1;
    }

    renderLiveGameUI();
  }

  function handleSelectRbi(rbiNum) {
    liveGameState.selectedRbi = Number(rbiNum);
    renderLiveGameUI();
  }

  function confirmLivePlay() {
    if (!checkAdmin()) return;
    const g = liveGameState.game;
    if (!g) return;

    const isAwayBatting = liveGameState.half === 'away';
    const battingTeamId = isAwayBatting ? g.away : g.home;
    const pitchingTeamId = isAwayBatting ? g.home : g.away;

    const lineup = isAwayBatting
      ? g.awayLineup?.length ? g.awayLineup : teamPlayers(g.away).map(p => p.id)
      : g.homeLineup?.length ? g.homeLineup : teamPlayers(g.home).map(p => p.id);

    const currentIndex = isAwayBatting ? liveGameState.awayBattingIndex : liveGameState.homeBattingIndex;
    const batterId = lineup[currentIndex] || teamPlayers(battingTeamId)[0]?.id;
    const pitcherId = isAwayBatting ? liveGameState.activePitcherHome : liveGameState.activePitcherAway;

    if (!batterId || !pitcherId) {
      alert('Error: Debe existir un bateador y un lanzador activo.');
      return;
    }

    const result = liveGameState.selectedPlayResult || 'Single';
    const explicitRbi = Number(liveGameState.selectedRbi) || 0;
    const isOut = result.includes('out') || result.includes('Strikeout');
    const isHR = result === 'Home Run';
    const outsInPlay = isOut ? 1 : 0;

    // Calcular avance de corredores con el motor físico 2D
    const { nextRunners, scoringPlayerIds, runsScored } = advanceRunners(
      liveGameState.runners,
      result,
      batterId,
      explicitRbi
    );

    const rbi = explicitRbi > 0 ? explicitRbi : (isHR ? 1 : scoringPlayerIds.length);
    const prevRunners = { ...liveGameState.runners };

    // GUARDAR INSTANTÁNEA EN UNDO STACK (SECCIÓN 16 Y 17)
    liveGameState.undoStack.push({
      inning: liveGameState.inning,
      half: liveGameState.half,
      outs: liveGameState.outs,
      awayScore: liveGameState.awayScore,
      homeScore: liveGameState.homeScore,
      gameAwayScore: g.awayScore,
      gameHomeScore: g.homeScore,
      awayBattingIndex: liveGameState.awayBattingIndex,
      homeBattingIndex: liveGameState.homeBattingIndex,
      runners: { ...liveGameState.runners },
      activePitcherAway: liveGameState.activePitcherAway,
      activePitcherHome: liveGameState.activePitcherHome
    });
    liveGameState.redoStack = []; // Se limpia rehacer al ingresar nueva jugada

    const pa = {
      id: id(),
      inning: liveGameState.inning,
      half: liveGameState.half,
      batter: batterId,
      pitcher: pitcherId,
      result,
      outs: outsInPlay,
      rbi,
      runs: isHR || scoringPlayerIds.includes(batterId) ? 1 : 0,
      earnedRuns: runsScored,
      runnersBefore: prevRunners,
      runnersAfter: { ...nextRunners },
      scoringRunners: scoringPlayerIds,
      timestamp: Date.now()
    };

    g.batLog = Array.isArray(g.batLog) ? g.batLog : [];
    g.batLog.push(pa);

    // Actualizar carreras
    if (runsScored > 0) {
      if (isAwayBatting) {
        g.awayScore = (Number(g.awayScore) || 0) + runsScored;
        liveGameState.awayScore = g.awayScore;
      } else {
        g.homeScore = (Number(g.homeScore) || 0) + runsScored;
        liveGameState.homeScore = g.homeScore;
      }
    }

    // Actualizar outs
    if (isOut) {
      liveGameState.outs += 1;
    }

    // Actualizar corredores
    liveGameState.runners = { ...nextRunners };
    g.runners = { ...nextRunners };

    // Continuidad de lineup
    if (isAwayBatting) {
      liveGameState.awayBattingIndex = (liveGameState.awayBattingIndex + 1) % (lineup.length || 1);
    } else {
      liveGameState.homeBattingIndex = (liveGameState.homeBattingIndex + 1) % (lineup.length || 1);
    }

    // Disparar animación 2D en el estadio
    triggerStadiumAnimation('live', result, rbi, isHR);

    // Reset selección
    liveGameState.selectedPlayResult = 'Single';
    liveGameState.selectedRbi = 0;

    // Recalcular y auto-guardar inmediatamente
    recalcStats();
    save();
    updateActiveGameBanner();

    // Comprobar fin de media entrada
    const maxOuts = g.outsPerInning || 3;
    if (liveGameState.outs >= maxOuts) {
      liveGameState.runners = { '1B': null, '2B': null, '3B': null };
      g.runners = { '1B': null, '2B': null, '3B': null };
      renderLiveGameUI();

      $('#livePlayBox').style.display = 'none';
      $('#liveInningEndPanel').style.display = 'block';
      $('#liveInningEndTitle').textContent = `ENTRADA ${liveGameState.inning} (${
        isAwayBatting ? 'ALTA' : 'BAJA'
      }) FINALIZADA`;
      $('#liveInningEndScore').textContent = `${teamName(g.away)} ${g.awayScore} — ${g.homeScore} ${teamName(g.home)}`;
    } else {
      renderLiveGameUI();
    }
  }

  // DESHACER JUGADA (SECCIÓN 16, 17 Y 18)
  function handleUndoLivePlay() {
    if (!checkAdmin()) return;
    if (!liveGameState.undoStack.length) {
      alert('No hay jugadas anteriores para deshacer.');
      return;
    }
    const g = liveGameState.game;
    if (!g || !g.batLog.length) return;

    const lastPA = g.batLog[g.batLog.length - 1];
    const bName = playerName(lastPA.batter);
    const actionLabel = resultLabel(lastPA.result);

    if (!confirm(`¿Deshacer la jugada: "${bName} — ${actionLabel}"?`)) return;

    const snap = liveGameState.undoStack.pop();

    // Guardar en redoStack
    liveGameState.redoStack.push({
      pa: lastPA,
      inning: liveGameState.inning,
      half: liveGameState.half,
      outs: liveGameState.outs,
      awayScore: liveGameState.awayScore,
      homeScore: liveGameState.homeScore,
      gameAwayScore: g.awayScore,
      gameHomeScore: g.homeScore,
      awayBattingIndex: liveGameState.awayBattingIndex,
      homeBattingIndex: liveGameState.homeBattingIndex,
      runners: { ...liveGameState.runners },
      activePitcherAway: liveGameState.activePitcherAway,
      activePitcherHome: liveGameState.activePitcherHome
    });

    g.batLog.pop();

    // Restaurar desde snapshot
    liveGameState.inning = snap.inning;
    liveGameState.half = snap.half;
    liveGameState.outs = snap.outs;
    liveGameState.awayScore = snap.awayScore;
    liveGameState.homeScore = snap.homeScore;
    g.awayScore = snap.gameAwayScore;
    g.homeScore = snap.gameHomeScore;
    liveGameState.awayBattingIndex = snap.awayBattingIndex;
    liveGameState.homeBattingIndex = snap.homeBattingIndex;
    liveGameState.runners = { ...snap.runners };
    g.runners = { ...snap.runners };
    liveGameState.activePitcherAway = snap.activePitcherAway;
    liveGameState.activePitcherHome = snap.activePitcherHome;

    recalcStats();
    save();
    renderLiveGameUI();
  }

  // REHACER JUGADA (SECCIÓN 19)
  function handleRedoLivePlay() {
    if (!checkAdmin()) return;
    if (!liveGameState.redoStack.length) {
      alert('No hay jugadas para rehacer.');
      return;
    }
    const g = liveGameState.game;
    if (!g) return;

    const redoSnap = liveGameState.redoStack.pop();

    liveGameState.undoStack.push({
      inning: liveGameState.inning,
      half: liveGameState.half,
      outs: liveGameState.outs,
      awayScore: liveGameState.awayScore,
      homeScore: liveGameState.homeScore,
      gameAwayScore: g.awayScore,
      gameHomeScore: g.homeScore,
      awayBattingIndex: liveGameState.awayBattingIndex,
      homeBattingIndex: liveGameState.homeBattingIndex,
      runners: { ...liveGameState.runners },
      activePitcherAway: liveGameState.activePitcherAway,
      activePitcherHome: liveGameState.activePitcherHome
    });

    g.batLog.push(redoSnap.pa);

    liveGameState.inning = redoSnap.inning;
    liveGameState.half = redoSnap.half;
    liveGameState.outs = redoSnap.outs;
    liveGameState.awayScore = redoSnap.awayScore;
    liveGameState.homeScore = redoSnap.homeScore;
    g.awayScore = redoSnap.gameAwayScore;
    g.homeScore = redoSnap.gameHomeScore;
    liveGameState.awayBattingIndex = redoSnap.awayBattingIndex;
    liveGameState.homeBattingIndex = redoSnap.homeBattingIndex;
    liveGameState.runners = { ...redoSnap.runners };
    g.runners = { ...redoSnap.runners };
    liveGameState.activePitcherAway = redoSnap.activePitcherAway;
    liveGameState.activePitcherHome = redoSnap.activePitcherHome;

    recalcStats();
    save();
    renderLiveGameUI();
  }

  function advanceToNextInning() {
    const g = liveGameState.game;
    if (!g) return;

    liveGameState.outs = 0;
    liveGameState.runners = { '1B': null, '2B': null, '3B': null };
    g.runners = { '1B': null, '2B': null, '3B': null };

    $('#liveInningEndPanel').style.display = 'none';
    $('#livePlayBox').style.display = 'block';

    const maxInnings = g.innings || 7;

    if (liveGameState.half === 'away') {
      liveGameState.half = 'home';
    } else {
      liveGameState.half = 'away';
      liveGameState.inning += 1;

      if (liveGameState.inning > maxInnings && liveGameState.awayScore !== liveGameState.homeScore) {
        finishLiveGame(false);
        return;
      }
    }

    renderLiveGameUI();
  }

  function calculateGameMVP(g) {
    const pas = g.batLog || [];
    if (!pas.length) return null;

    const scores = {};
    pas.forEach(pa => {
      // Bateador
      if (!scores[pa.batter]) scores[pa.batter] = { h: 0, hr: 0, rbi: 0, r: 0, k: 0, er: 0, pts: 0 };
      if (HIT_RESULTS.has(pa.result)) scores[pa.batter].h++;
      if (pa.result === 'Home Run') scores[pa.batter].hr++;
      scores[pa.batter].rbi += Number(pa.rbi) || 0;
      scores[pa.batter].r += Number(pa.runs) || 0;

      // Pitcher
      if (!scores[pa.pitcher]) scores[pa.pitcher] = { h: 0, hr: 0, rbi: 0, r: 0, k: 0, er: 0, pts: 0 };
      if (pa.result.includes('Strikeout')) scores[pa.pitcher].k++;
      scores[pa.pitcher].er += Number(pa.earnedRuns) || 0;
    });

    let bestPid = null;
    let maxPts = -999;

    Object.entries(scores).forEach(([pid, d]) => {
      d.pts = d.h * 2 + d.hr * 5 + d.rbi * 2.5 + d.r * 1.5 + d.k * 1.5 - d.er * 2;
      if (d.pts > maxPts) {
        maxPts = d.pts;
        bestPid = pid;
      }
    });

    if (!bestPid) return null;
    const p = db.players.find(x => x.id === bestPid);
    const d = scores[bestPid];
    const statLine = `${d.h} Hits • ${d.hr} HR • ${d.rbi} RBI • ${d.r} CA ${d.k > 0 ? `• ${d.k} Ponches` : ''}`;

    return { player: p, score: maxPts, statLine };
  }

  function finishLiveGame(forceClose = true) {
    const g = liveGameState.game;
    if (!g) return;

    g.status = 'FINAL';
    liveGameState.active = false;
    localStorage.removeItem('rosmil_active_game_id');

    const mvpObj = calculateGameMVP(g);
    if (mvpObj?.player) {
      g.mvp = {
        id: mvpObj.player.id,
        name: mvpObj.player.name,
        photo: mvpObj.player.photo || '',
        line: mvpObj.statLine
      };
    }

    updateSeriesFromGames();
    recalcStats();
    save();
    updateActiveGameBanner();

    const winnerId = g.homeScore > g.awayScore ? g.home : g.awayScore > g.homeScore ? g.away : null;
    const loserId = winnerId === g.home ? g.away : winnerId === g.away ? g.home : null;

    $('#livePlayBox').style.display = 'none';
    $('#liveInningEndPanel').style.display = 'none';
    $('#liveGameOverPanel').style.display = 'block';
    $('#liveGameOverScore').textContent = `${teamName(g.away)} ${g.awayScore} — ${g.homeScore} ${teamName(g.home)}`;
    $('#liveWinnerLoserBadge').innerHTML = winnerId
      ? `<b>GANADOR:</b> <span style="color:var(--yellow)">${esc(teamName(winnerId))}</span> • <b>PERDEDOR:</b> ${esc(
          teamName(loserId)
        )}`
      : '<b>RESULTADO:</b> EMPATE';

    if (forceClose) {
      setTimeout(() => {
        closeModals();
        renderAll();
        show('games');
      }, 1000);
    }
  }

  function openPitcherChangeModal() {
    const g = liveGameState.game;
    if (!g) return;
    const isAwayBatting = liveGameState.half === 'away';
    const defendingTeamId = isAwayBatting ? g.home : g.away;
    const players = teamPlayers(defendingTeamId, false, true).concat(teamPlayers(defendingTeamId));
    const uniquePlayers = players.filter((p, i, a) => a.findIndex(x => x.id === p.id) === i);

    const currentPitcher = isAwayBatting ? liveGameState.activePitcherHome : liveGameState.activePitcherAway;

    $('#livePitcherChangeSelect').innerHTML = uniquePlayers
      .map(
        p =>
          `<option value="${p.id}" ${p.id === currentPitcher ? 'selected' : ''}>${esc(p.name)} (#${esc(
            p.number || '—'
          )}) - ${esc(p.position || '')}</option>`
      )
      .join('');

    $('#pitcherChangeModal').classList.add('open');
  }

  function confirmPitcherChange() {
    const newPitcherId = $('#livePitcherChangeSelect').value;
    if (!newPitcherId) return;

    if (liveGameState.half === 'away') {
      liveGameState.activePitcherHome = newPitcherId;
      liveGameState.game.activePitcherHome = newPitcherId;
    } else {
      liveGameState.activePitcherAway = newPitcherId;
      liveGameState.game.activePitcherAway = newPitcherId;
    }

    save();
    $('#pitcherChangeModal').classList.remove('open');
    renderLiveGameUI();
  }

  // BANNER DE PARTIDO EN VIVO ACTIVO
  function updateActiveGameBanner() {
    const banner = $('#activeLiveGameBanner');
    if (!banner) return;
    const activeGame = db.games.find(g => g.status === 'LIVE' || g.status === 'En curso');
    if (activeGame) {
      banner.style.display = 'block';
      const aName = teamName(activeGame.away);
      const hName = teamName(activeGame.home);
      $('#activeLiveBannerMatchup').textContent = `${aName} (${activeGame.awayScore}) vs ${hName} (${activeGame.homeScore})`;
      $('#activeLiveBannerMeta').textContent = `${seasonName(activeGame.season)} • ${activeGame.stadium || 'Estadio'}`;
      $('#btnResumeActiveGame').onclick = () => initLiveGame(activeGame.id);
    } else {
      banner.style.display = 'none';
    }
  }

  // ----------------------------------------------------
  // REPLAY 2D Y RESUMEN INTELIGENTE (SECCIONES 12, 13, 14, 15, 28)
  // ----------------------------------------------------
  function openGameReplay(gid) {
    const g = getGame(gid);
    if (!g) return;

    closeModals();
    $('#gameReplayModal').classList.add('open');

    replayState = {
      game: g,
      events: (g.batLog || []).slice(),
      currentIndex: 0,
      isPlaying: false,
      intervalId: null,
      speed: 1
    };

    renderReplayHeader(g);
    renderReplayLinescore(g);
    renderReplayHighlights(g);
    renderReplayMVP(g);
    renderReplayTimeline();
    setReplayEventIndex(0);
  }

  function renderReplayHeader(g) {
    const aName = teamName(g.away);
    const hName = teamName(g.home);
    $('#replayGameTitle').textContent = `${aName} ${g.awayScore} — ${g.homeScore} ${hName}`;
    $('#replayGameMeta').textContent = `${seasonName(g.season)} • ${g.date || ''} ${g.time || ''} • ${
      g.stadium || 'Estadio Oficial'
    }`;
  }

  function renderReplayLinescore(g) {
    const maxInn = Math.max(7, ...(g.batLog || []).map(x => Number(x.inning) || 1));
    const awayInnRuns = Array(maxInn).fill(0);
    const homeInnRuns = Array(maxInn).fill(0);

    let awayHits = 0;
    let homeHits = 0;

    (g.batLog || []).forEach(pa => {
      const innIdx = Math.max(0, (Number(pa.inning) || 1) - 1);
      const r = Number(pa.earnedRuns) || (pa.result === 'Home Run' ? 1 : 0);
      if (pa.half === 'away') {
        awayInnRuns[innIdx] += r;
        if (HIT_RESULTS.has(pa.result)) awayHits++;
      } else {
        homeInnRuns[innIdx] += r;
        if (HIT_RESULTS.has(pa.result)) homeHits++;
      }
    });

    let headerHTML = '<th>Equipo</th>';
    for (let i = 1; i <= maxInn; i++) headerHTML += `<th>${i}</th>`;
    headerHTML += '<th>C</th><th>H</th><th>E</th>';

    const aName = teamName(g.away);
    const hName = teamName(g.home);

    let awayRowHTML = `<td><b>${esc(aName)}</b></td>`;
    awayInnRuns.forEach(r => (awayRowHTML += `<td>${r}</td>`));
    awayRowHTML += `<td><b>${g.awayScore}</b></td><td>${awayHits}</td><td>0</td>`;

    let homeRowHTML = `<td><b>${esc(hName)}</b></td>`;
    homeInnRuns.forEach(r => (homeRowHTML += `<td>${r}</td>`));
    homeRowHTML += `<td><b>${g.homeScore}</b></td><td>${homeHits}</td><td>0</td>`;

    $('#replayLinescoreTable').innerHTML = `
      <thead><tr>${headerHTML}</tr></thead>
      <tbody>
        <tr>${awayRowHTML}</tr>
        <tr>${homeRowHTML}</tr>
      </tbody>
    `;
  }

  function renderReplayHighlights(g) {
    const listEl = $('#replayHighlightsList');
    const pas = g.batLog || [];
    const highlights = [];

    pas.forEach((pa, idx) => {
      const bName = playerName(pa.batter);
      const bp = db.players.find(x => x.id === pa.batter);
      if (pa.result === 'Home Run') {
        highlights.push({
          idx,
          player: bp,
          icon: '🚀',
          text: `HOME RUN de ${bName} (+${pa.rbi || 1} RBI)`,
          inn: `Inn ${pa.inning}`
        });
      } else if (pa.result === 'Triple') {
        highlights.push({
          idx,
          player: bp,
          icon: '⚡',
          text: `Triple por la raya de ${bName}`,
          inn: `Inn ${pa.inning}`
        });
      } else if (pa.result === 'Double') {
        highlights.push({
          idx,
          player: bp,
          icon: '🔥',
          text: `Doble de ${bName}`,
          inn: `Inn ${pa.inning}`
        });
      } else if (Number(pa.rbi) >= 2) {
        highlights.push({
          idx,
          player: bp,
          icon: '💥',
          text: `Batazo oportuno de ${bName} con ${pa.rbi} impulsadas`,
          inn: `Inn ${pa.inning}`
        });
      } else if (pa.result.includes('Strikeout')) {
        const pp = db.players.find(x => x.id === pa.pitcher);
        highlights.push({
          idx,
          player: pp,
          icon: '❌',
          text: `Ponche propinado por ${playerName(pa.pitcher)}`,
          inn: `Inn ${pa.inning}`
        });
      }
    });

    listEl.innerHTML = highlights.length
      ? highlights
          .slice(0, 10)
          .map(h => {
            const avatar = h.player?.photo
              ? `<img src="${h.player.photo}" class="pbp-thumb-avatar" alt="">`
              : `<div class="pbp-thumb-fallback">${(h.player?.name || 'J')[0]}</div>`;
            return `
              <div class="highlight-row" data-replay-jump="${h.idx}">
                <div style="display:flex;align-items:center;gap:8px">
                  ${avatar}
                  <div>
                    <b>${h.icon} ${esc(h.text)}</b>
                    <small class="muted" style="display:block">${h.inn}</small>
                  </div>
                </div>
                <button class="btn btn-sm yellow">Ver 2D</button>
              </div>`;
          })
          .join('')
      : '<div class="empty">Sin jugadas destacadas adicionales.</div>';

    $$('#replayHighlightsList [data-replay-jump]').forEach(btn => {
      btn.onclick = () => setReplayEventIndex(Number(btn.dataset.replayJump));
    });
  }

  function renderReplayMVP(g) {
    const area = $('#replayMvpArea');
    const mvpObj = calculateGameMVP(g);
    if (!mvpObj || !mvpObj.player) {
      area.innerHTML = '<div class="muted">No hay datos suficientes para calcular MVP.</div>';
      return;
    }
    const p = mvpObj.player;
    const avatar = p.photo
      ? `<img src="${p.photo}" class="mvp-photo" alt="${esc(p.name)}" />`
      : `<div class="mvp-fallback-avatar">${(p.name || 'J')[0]}</div>`;

    area.innerHTML = `
      <div class="replay-mvp-card">
        ${avatar}
        <div>
          <span class="mvp-badge">🏆 MVP DEL PARTIDO</span>
          <h3 style="margin:4px 0;color:var(--yellow);font-size:18px">${esc(p.name)}</h3>
          <div class="muted" style="font-size:12px">${esc(teamName(p.team))} • #${esc(p.number || '—')}</div>
          <div style="margin-top:6px;font-weight:700;color:#fff;font-size:13px">${esc(mvpObj.statLine)}</div>
        </div>
      </div>
    `;
  }

  function renderReplayTimeline() {
    const track = $('#replayTimelineTrack');
    const events = replayState.events;

    track.innerHTML = events.length
      ? events
          .map((pa, idx) => {
            const bp = db.players.find(x => x.id === pa.batter);
            const avatar = bp?.photo
              ? `<img src="${bp.photo}" class="pbp-thumb-avatar" style="width:20px;height:20px" alt="">`
              : `<span style="font-size:10px">⚾</span>`;
            return `
              <div class="timeline-node-chip ${idx === 0 ? 'active' : ''}" data-replay-idx="${idx}">
                <span>#${idx + 1}</span>
                ${avatar}
                <b>Inn ${pa.inning}</b>
                <span>${esc(resultLabel(pa.result))}</span>
              </div>`;
          })
          .join('')
      : '<div class="empty">Sin jugadas en este partido.</div>';

    $$('#replayTimelineTrack .timeline-node-chip').forEach(chip => {
      chip.onclick = () => setReplayEventIndex(Number(chip.dataset.replayIdx));
    });
  }

  function setReplayEventIndex(idx) {
    const events = replayState.events;
    if (!events.length) {
      renderStadiumDiamond('replay', { '1B': null, '2B': null, '3B': null });
      return;
    }

    const clampedIdx = Math.max(0, Math.min(events.length - 1, idx));
    replayState.currentIndex = clampedIdx;

    $$('#replayTimelineTrack .timeline-node-chip').forEach((c, i) => {
      c.classList.toggle('active', i === clampedIdx);
    });

    const pa = events[clampedIdx];
    const bName = playerName(pa.batter);
    const pName = playerName(pa.pitcher);

    $('#replayPlayInfo').innerHTML = `
      <b>JUGADA #${clampedIdx + 1}:</b> Entrada ${pa.inning} (${pa.half === 'away' ? 'Alta' : 'Baja'}) • 
      <b>${esc(bName)}</b> al bate vs <b>${esc(pName)}</b> ➔ 
      <span style="color:var(--yellow);font-weight:800">${esc(resultLabel(pa.result))}</span>
      ${pa.rbi > 0 ? ` <span style="color:#4ade80">(+${pa.rbi} RBI)</span>` : ''}
    `;

    renderStadiumDiamond('replay', pa.runnersBefore || { '1B': null, '2B': null, '3B': null }, pa.pitcher, pa.batter);
    triggerStadiumAnimation('replay', pa.result, pa.rbi, pa.result === 'Home Run');

    setTimeout(() => {
      renderStadiumDiamond('replay', pa.runnersAfter || { '1B': null, '2B': null, '3B': null }, pa.pitcher, null);
    }, 450);
  }

  function gameStatus(g) {
    if (g.status === 'LIVE' || g.status === 'En curso') return '🔴 EN VIVO';
    return (g.batLog || []).length ? 'FINALIZADO' : 'PROGRAMADO';
  }

  function gameHTML(g) {
    const sr = g.series ? getSeries(g.series) : null;
    const paCount = (g.batLog || []).length;
    const isLive = g.status === 'LIVE' || g.status === 'En curso';
    return `
      <div class="gamecard ${isLive ? 'gamecard-live' : ''}">
        <div class="head">
          <span class="muted">${esc(g.date)} ${esc(g.time)} • ${esc(seasonName(g.season))}</span>
          <span class="pill">${sr ? `Serie: ${esc(teamName(sr.teamA))} vs ${esc(teamName(sr.teamB))}` : 'Juego de liga'}</span>
        </div>
        <div class="teamscore">
          <div><span class="team-link" data-team-id="${g.away}" style="font-size:16px">${esc(teamName(g.away))}</span></div>
          <div class="score">${g.awayScore} — ${g.homeScore}</div>
          <div><span class="team-link" data-team-id="${g.home}" style="font-size:16px">${esc(teamName(g.home))}</span></div>
        </div>
        <div class="muted" style="text-align:center;margin-top:8px">
          Juego ${esc(g.gameNumber || '—')} ${g.stadium ? '• ' + esc(g.stadium) : ''}
        </div>
        <div class="head" style="margin-top:12px">
          <span class="tag ${isLive ? 'tag-live' : ''}">${gameStatus(g)}</span>
          <span class="muted">${paCount} jugadas registradas</span>
        </div>
        <div class="actions" style="margin-top:11px">
          <button class="btn yellow" data-live-game="${g.id}">⚡ Consola en Vivo</button>
          <button class="btn blue" data-replay-game="${g.id}">🎬 Ver Replay 2D</button>
          <button class="btn" data-score-game="${g.id}">Libro BAT LOG</button>
          <button class="btn admin-only" data-edit-game="${g.id}">Editar</button>
          <button class="btn danger admin-only" data-del-game="${g.id}">Eliminar</button>
        </div>
      </div>`;
  }

  function renderGames() {
    const el = $('#gamesList');
    el.innerHTML = db.games.length
      ? db.games.slice().reverse().map(gameHTML).join('')
      : empty('No hay juegos', 'Pulsa "+ Crear Partido (Paso a Paso)" para iniciar un juego.');

    $$('[data-live-game]').forEach(b => (b.onclick = () => initLiveGame(b.dataset.liveGame)));
    $$('[data-replay-game]').forEach(b => (b.onclick = () => openGameReplay(b.dataset.replayGame)));
    $$('[data-score-game]').forEach(b => (b.onclick = () => openScorebook(b.dataset.scoreGame)));
    $$('[data-del-game]').forEach(
      b =>
        (b.onclick = () => {
          const gid = b.dataset.delGame;
          const g = getGame(gid);
          requestDoubleDelete(
            `Partido: ${teamName(g?.away)} vs ${teamName(g?.home)}`,
            'Esta acción eliminará el partido y sus eventos de bateo y pitcheo.',
            () => remove('games', gid, 'games')
          );
        })
    );
    $$('[data-edit-game]').forEach(
      b =>
        (b.onclick = () => {
          if (!checkAdmin()) return;
          openModal('gameModal');
          prepareGameModal(b.dataset.editGame);
        })
    );
  }

  // REGLAS N° 5: GESTIÓN Y ELIMINACIÓN DE TEMPORADAS POR EL ADMINISTRADOR
  function seasonHTML(s) {
    const series = db.series.filter(x => x.season === s.id);
    const body =
      s.type === 'elimination'
        ? series.length
          ? series
              .map(sr => {
                const pa = db.games
                  .filter(g => g.series === sr.id)
                  .reduce((n, g) => n + (g.batLog || []).length, 0);
                return `
                  <div class="series">
                    <div class="head">
                      <div>
                        <span class="team-link" data-team-id="${sr.teamA}">${esc(teamName(sr.teamA))}</span> vs 
                        <span class="team-link" data-team-id="${sr.teamB}">${esc(teamName(sr.teamB))}</span>
                      </div>
                      <span class="pill">${esc(sr.status)}</span>
                    </div>
                    <div class="muted" style="margin-top:7px">
                      Mejor de ${sr.bestOf} • ${sr.winsA} — ${sr.winsB} • ${
                  db.games.filter(g => g.series === sr.id).length
                } juegos • ${pa} PA registradas
                    </div>
                  </div>`;
              })
              .join('')
          : empty('No hay series', 'Pulsa “+ Serie” para crear el enfrentamiento.')
        : `<div class="muted" style="margin-top:10px">Esta liga tendrá <b>${esc(
            s.gamesCount || 0
          )}</b> juegos registrados desde la sección Juegos.</div>`;

    return `
      <div class="gamecard">
        <div class="head">
          <div>
            <b style="font-size:18px;color:var(--yellow)">${esc(s.name)}</b>
            <div class="muted">${s.type === 'league' ? 'Liga' : 'Eliminatoria'} • ${esc(s.start || '')} ${
      s.end ? '→ ' + esc(s.end) : ''
    }</div>
          </div>
          <div class="actions">
            <span class="tag">${
              s.type === 'league' ? `${esc(s.gamesCount || 0)} juegos` : `Mejor de ${esc(s.bestOf)}`
            }</span>
            <button class="btn admin-only" data-edit-season="${s.id}">Editar</button>
            <button class="btn danger admin-only" data-del-season="${s.id}">Eliminar</button>
            ${s.type === 'elimination' ? `<button class="btn yellow admin-only" data-new-series="${s.id}">+ Serie</button>` : ''}
          </div>
        </div>
        ${body}
      </div>`;
  }

  function renderSeason() {
    const el = $('#seasonList');
    el.innerHTML = db.seasons.length
      ? db.seasons.map(seasonHTML).join('')
      : empty('No hay temporadas', 'Crea una temporada y elige si será Liga o Eliminatoria.');

    $('#homeSeasonList').innerHTML = db.seasons.length
      ? db.seasons
          .slice(0, 4)
          .map(
            s => `
            <div class="gamecard">
              <b>${esc(s.name)}</b>
              <div class="muted">${
                s.type === 'league'
                  ? 'Liga — ' + esc(s.gamesCount || 0) + ' juegos'
                  : 'Eliminatoria — mejor de ' + esc(s.bestOf)
              }</div>
            </div>`
          )
          .join('')
      : empty('No hay temporadas', 'Crea tu primera competencia.');

    $$('[data-edit-season]').forEach(
      b =>
        (b.onclick = () => {
          if (!checkAdmin()) return;
          openModal('seasonModal');
          prepareSeasonModal(b.dataset.editSeason);
        })
    );
    $$('[data-del-season]').forEach(
      b =>
        (b.onclick = () => {
          const sid = b.dataset.delSeason;
          const s = db.seasons.find(x => x.id === sid);
          requestDoubleDelete(
            `Temporada: ${s?.name || ''}`,
            'Esta acción eliminará la temporada y sus configuraciones asociadas.',
            () => remove('seasons', sid, 'season')
          );
        })
    );
    $$('[data-new-series]').forEach(
      b =>
        (b.onclick = () => {
          if (!checkAdmin()) return;
          openModal('seriesModal');
          prepareSeriesModal();
          setTimeout(() => {
            $('#seriesSeason').value = b.dataset.newSeries;
          }, 0);
        })
    );
  }

  function renderStandings() {
    const el = $('#standingsList');
    if (!db.teams.length) {
      el.innerHTML = empty('No hay equipos', 'Las posiciones aparecerán al registrar equipos y juegos.');
      return;
    }
    const rows = db.teams
      .map(t => {
        const rec = calculateTeamRecord(t.id);
        return { ...t, ...rec };
      })
      .sort((a, b) => b.pct - a.pct || b.w - a.w || b.diff - a.diff);

    el.innerHTML = `
      <div class="tablewrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Equipo</th>
              <th>G</th>
              <th>P</th>
              <th>PCT</th>
              <th>CA</th>
              <th>CP</th>
              <th>DIF</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (t, i) => `
              <tr>
                <td><b>${i + 1}</b></td>
                <td>
                  ${t.logo ? `<img class="teamlogo" src="${t.logo}" alt="">` : ''}
                  <span class="team-link" data-team-id="${t.id}" style="font-size:14px">${esc(t.name)}</span>
                </td>
                <td><b style="color:var(--yellow)">${t.w}</b></td>
                <td>${t.l}</td>
                <td><b>${t.pct.toFixed(3).replace('0.', '.')}</b></td>
                <td>${t.rs}</td>
                <td>${t.ra}</td>
                <td style="color:${t.diff >= 0 ? 'var(--yellow)' : 'var(--red)'}"><b>${
                  t.diff >= 0 ? '+' + t.diff : t.diff
                }</b></td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`;
  }

  function renderStats() {
    const el = $('#statsArea');
    if (!db.players.length) {
      el.innerHTML = empty('Sin estadísticas', 'Crea jugadores y registra BAT LOG / iSCORE.');
      return;
    }
    const pas = allPAs();
    const rows = db.players.map(p => ({
      p,
      s: batterStats(p.id, pas),
      ps: pitcherStats(p.id, pas)
    }));

    el.innerHTML = `
      <div class="head" style="margin-bottom:12px">
        <div>
          <h3 style="margin:0">Bateo y Pitcheo Oficial</h3>
          <div class="muted">Las estadísticas nacen exclusivamente del BAT LOG / iSCORE de cada partido.</div>
        </div>
        <button class="btn blue" data-open-face>⚔ Cara a Cara</button>
      </div>
      <div class="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Jugador</th>
              <th>Equipo</th>
              <th>PA</th>
              <th>AB</th>
              <th>R</th>
              <th>H</th>
              <th>HR</th>
              <th>RBI</th>
              <th>BB</th>
              <th>SO</th>
              <th>SB</th>
              <th>AVG</th>
              <th>OBP</th>
              <th>OPS</th>
              <th>IP</th>
              <th>H (P)</th>
              <th>SO (P)</th>
              <th>ERA</th>
              <th>WHIP</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                ({ p, s, ps }) => `
              <tr>
                <td>
                  <span class="player-link" data-player-id="${p.id}">${esc(p.name)}</span>
                </td>
                <td>
                  ${
                    p.team
                      ? `<span class="team-link" data-team-id="${p.team}">${esc(teamName(p.team))}</span>`
                      : '<span class="muted">—</span>'
                  }
                </td>
                <td>${s.PA}</td>
                <td>${s.AB}</td>
                <td>${s.R}</td>
                <td><b>${s.H}</b></td>
                <td>${s.HR}</td>
                <td>${s.RBI}</td>
                <td>${s.BB}</td>
                <td>${s.SO}</td>
                <td>${s.SB}</td>
                <td><b style="color:var(--yellow)">${fmtAvg(s.AVG)}</b></td>
                <td>${fmtAvg(s.OBP)}</td>
                <td>${fmtAvg(s.OPS)}</td>
                <td>${ps.IP}</td>
                <td>${ps.H}</td>
                <td>${ps.SO}</td>
                <td>${isPitcher(p) ? ps.ERA.toFixed(2) : '—'}</td>
                <td>${isPitcher(p) ? ps.WHIP.toFixed(2) : '—'}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top:14px" class="actions">
        <button class="btn blue" data-open-face>Seleccionar bateador vs lanzador</button>
      </div>`;

    $$('[data-open-face]').forEach(b => (b.onclick = () => openFaceoff()));
  }

  // ----------------------------------------------------
  // LÍDERES OFICIALES DE LA LIGA (ROSMIL LEAGUE 0.2 - REGLAS 23, 24, 33)
  // ----------------------------------------------------
  function calculateLeagueLeaders() {
    const pas = allPAs();
    const playersWithStats = db.players.map(p => ({
      p,
      bat: batterStats(p.id, pas),
      pitch: pitcherStats(p.id, pas)
    }));

    // Líder de Bateo (AVG - mínimo 1 AB)
    const leadersAvg = playersWithStats
      .filter(x => x.bat.AB > 0)
      .sort((a, b) => b.bat.AVG - a.bat.AVG || b.bat.H - a.bat.H)
      .slice(0, 5);

    // Líder de Hits (H)
    const leadersHits = playersWithStats
      .filter(x => x.bat.H > 0)
      .sort((a, b) => b.bat.H - a.bat.H || b.bat.AVG - a.bat.AVG)
      .slice(0, 5);

    // Líder de Home Runs (HR)
    const leadersHR = playersWithStats
      .filter(x => x.bat.HR > 0)
      .sort((a, b) => b.bat.HR - a.bat.HR || b.bat.RBI - a.bat.RBI)
      .slice(0, 5);

    // Líder de RBI
    const leadersRBI = playersWithStats
      .filter(x => x.bat.RBI > 0)
      .sort((a, b) => b.bat.RBI - a.bat.RBI || b.bat.H - a.bat.H)
      .slice(0, 5);

    // Líder de Ponches (SO de pitchers)
    const leadersSO = playersWithStats
      .filter(x => isPitcher(x.p) && x.pitch.SO > 0)
      .sort((a, b) => b.pitch.SO - a.pitch.SO || a.pitch.ERA - b.pitch.ERA)
      .slice(0, 5);

    // Líder de Victorias (Pitchers con partidos ganados o efectividad destacada)
    const leadersWins = playersWithStats
      .filter(x => isPitcher(x.p) && x.pitch.outs >= 3)
      .sort((a, b) => a.pitch.ERA - b.pitch.ERA || b.pitch.outs - a.pitch.outs)
      .slice(0, 5);

    return { leadersAvg, leadersHits, leadersHR, leadersRBI, leadersSO, leadersWins };
  }

  function renderLeaders() {
    const el = $('#leadersArea');
    if (!el) return;
    if (!db.players.length) {
      el.innerHTML = empty('Sin líderes registrados', 'Registra equipos, jugadores y partidos para calcular los líderes.');
      return;
    }

    const { leadersAvg, leadersHits, leadersHR, leadersRBI, leadersSO, leadersWins } = calculateLeagueLeaders();

    const renderLeaderTable = (title, items, valueFmt) => `
      <div class="panel">
        <div class="head">
          <h3 style="color:var(--yellow);margin:0;font-size:16px">${title}</h3>
        </div>
        ${
          items.length
            ? `
          <div class="tablewrap" style="margin-top:8px">
            <table>
              <thead>
                <tr>
                  <th style="width:40px">#</th>
                  <th>Jugador</th>
                  <th>Equipo</th>
                  <th style="text-align:right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${items
                  .map(
                    (x, idx) => `
                  <tr>
                    <td><b>${idx + 1}</b></td>
                    <td>
                      ${x.p.photo ? `<img class="avatar" src="${x.p.photo}" alt="">` : ''}
                      <span class="player-link" data-player-id="${x.p.id}">${esc(x.p.name)}</span>
                    </td>
                    <td>
                      ${
                        x.p.team
                          ? `<span class="team-link" data-team-id="${x.p.team}">${esc(teamName(x.p.team))}</span>`
                          : '<span class="muted">—</span>'
                      }
                    </td>
                    <td style="text-align:right"><b style="color:var(--yellow);font-size:15px">${valueFmt(x)}</b></td>
                  </tr>`
                  )
                  .join('')}
              </tbody>
            </table>
          </div>`
            : empty('Sin datos aún', 'Aún no hay jugadas registradas para esta categoría.')
        }
      </div>
    `;

    el.innerHTML = `
      <div class="grid2">
        ${renderLeaderTable('👑 Líder de Bateo (AVG)', leadersAvg, x => fmtAvg(x.bat.AVG))}
        ${renderLeaderTable('💥 Líder de Hits (H)', leadersHits, x => `${x.bat.H} H`)}
        ${renderLeaderTable('🚀 Líder de Home Runs (HR)', leadersHR, x => `${x.bat.HR} HR`)}
        ${renderLeaderTable('🎯 Líder de Carreras Impulsadas (RBI)', leadersRBI, x => `${x.bat.RBI} RBI`)}
        ${renderLeaderTable('🛑 Líder de Ponches Monticulares (SO)', leadersSO, x => `${x.pitch.SO} SO`)}
        ${renderLeaderTable('🛡️ Líderes de Pitcheo / Efectividad (ERA)', leadersWins, x => `ERA ${x.pitch.ERA.toFixed(2)}`)}
      </div>
    `;
  }

  // ----------------------------------------------------
  // RANKING GENERAL DE JUGADORES (ROSMIL LEAGUE 0.2 - REGLAS 25, 34, 40)
  // ----------------------------------------------------
  function calculatePlayerRanking() {
    const pas = allPAs();
    return db.players
      .map(p => {
        const bs = batterStats(p.id, pas);
        const ps = pitcherStats(p.id, pas);
        const hasB = bs.PA > 0;
        const hasP = ps.outs > 0;

        let rawScore = 0;
        if (hasB) {
          rawScore += (bs.AVG * 260) + (bs.H * 4) + (bs.D * 3) + (bs.T * 5) + (bs.HR * 8) + (bs.RBI * 4) + (bs.R * 2) + (bs.SB * 3) - (bs.SO * 0.5);
        }
        if (hasP) {
          rawScore += (ps.SO * 4) + (ps.outs * 1.5) - (ps.ER * 5) - (ps.BB * 2);
        }

        const score = hasB || hasP ? Math.min(99, Math.max(50, Math.round(52 + rawScore * 0.35))) : 0;

        return {
          player: p,
          bat: bs,
          pitch: ps,
          score,
          rawScore,
          hasAction: hasB || hasP
        };
      })
      .sort((a, b) => b.rawScore - a.rawScore || b.score - a.score);
  }

  function renderRanking() {
    const el = $('#rankingArea');
    if (!el) return;

    const ranking = calculatePlayerRanking();
    if (!ranking.length) {
      el.innerHTML = empty('Sin jugadores clasificados', 'Crea jugadores y registra partidos oficiales en la liga.');
      return;
    }

    const top3 = ranking.slice(0, 3);

    el.innerHTML = `
      <!-- Podio de Honor -->
      <div class="ranking-podium">
        ${top3
          .map((r, idx) => {
            const medals = ['🥇 #1 ORO', '🥈 #2 PLATA', '🥉 #3 BRONCE'];
            return `
            <div class="podium-card ${idx === 0 ? 'first' : ''}">
              <div class="podium-rank">${medals[idx]}</div>
              <div class="podium-avatar">
                ${
                  r.player.photo
                    ? `<img src="${r.player.photo}" alt="${esc(r.player.name)}">`
                    : '👤'
                }
              </div>
              <div class="podium-name">
                <span class="player-link" data-player-id="${r.player.id}">${esc(r.player.name)}</span>
              </div>
              <div class="muted" style="font-size:12px;margin-bottom:8px">
                ${
                  r.player.team
                    ? `<span class="team-link" data-team-id="${r.player.team}">${esc(teamName(r.player.team))}</span>`
                    : 'Agente Libre'
                }
              </div>
              <div class="podium-score">${r.score} <small style="font-size:12px;color:var(--muted)">SCORE</small></div>
              <div class="muted" style="font-size:11px;margin-top:6px">
                ${r.bat.PA > 0 ? `${fmtAvg(r.bat.AVG)} AVG • ${r.bat.HR} HR • ${r.bat.RBI} RBI` : ''}
                ${r.pitch.outs > 0 ? ` • ${r.pitch.IP} IP • ${r.pitch.SO} SO` : ''}
              </div>
            </div>`;
          })
          .join('')}
      </div>

      <!-- Tabla Completa del Ranking -->
      <div class="panel" style="margin-top:20px">
        <div class="head">
          <h3>Tabla Oficial del Ranking General</h3>
          <span class="muted">${ranking.length} atletas registrados</span>
        </div>
        <div class="tablewrap">
          <table>
            <thead>
              <tr>
                <th style="width:50px">Puesto</th>
                <th>Jugador</th>
                <th>Equipo Actual</th>
                <th>Posición</th>
                <th>AVG</th>
                <th>H</th>
                <th>HR</th>
                <th>RBI</th>
                <th>IP / SO</th>
                <th>ADN Rating</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              ${ranking
                .map(
                  (r, i) => `
                <tr>
                  <td><b>#${i + 1}</b></td>
                  <td>
                    ${r.player.photo ? `<img class="avatar" src="${r.player.photo}" alt="">` : ''}
                    <span class="player-link" data-player-id="${r.player.id}">${esc(r.player.name)}</span>
                  </td>
                  <td>
                    ${
                      r.player.team
                        ? `<span class="team-link" data-team-id="${r.player.team}">${esc(teamName(r.player.team))}</span>`
                        : '<span class="muted">—</span>'
                    }
                  </td>
                  <td>${esc(r.player.position || '—')}</td>
                  <td><b>${fmtAvg(r.bat.AVG)}</b></td>
                  <td>${r.bat.H}</td>
                  <td>${r.bat.HR}</td>
                  <td>${r.bat.RBI}</td>
                  <td>${r.pitch.outs > 0 ? `${r.pitch.IP} / ${r.pitch.SO}K` : '—'}</td>
                  <td><span class="ranking-score-pill">${r.score} PTS</span></td>
                  <td>
                    <button class="btn btn-sm yellow" data-player-id="${r.player.id}">Ver ADN</button>
                  </td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderHistory() {
    const el = $('#historyArea');
    el.innerHTML = db.events.length
      ? db.events
          .slice()
          .reverse()
          .map(
            e => `
          <div class="gamecard">
            <b style="color:var(--yellow)">${esc(e.type)}</b>
            <div class="muted">${esc(e.text)}</div>
            <small class="muted">${esc(e.date)}</small>
          </div>`
          )
          .join('')
      : empty('Sin historial', 'Los registros administrativos aparecerán aquí.');
  }

  function renderHomeGames() {
    const el = $('#homeGamesList');
    el.innerHTML = db.games.length
      ? db.games.slice().reverse().slice(0, 4).map(gameHTML).join('')
      : empty('No hay juegos', 'Los partidos que registres aparecerán aquí.');
  }

  // REGLAS N° 2 Y 19: PANEL DE ADMINISTRACIÓN DINÁMICO CON PERMISOS
  function renderAdminPanel() {
    const el = $('#adminPanelArea');
    if (!el) return;

    if (!isAdmin) {
      el.innerHTML = `
        <div class="panel" style="text-align:center;max-width:700px;margin:20px auto;border-color:var(--yellow)">
          <div style="font-size:48px;margin-bottom:12px">🔒</div>
          <h2>Modo Espectador Activo</h2>
          <p style="color:var(--text-white);line-height:1.6">
            Actualmente estás en modo de consulta. Puedes ver todas las temporadas, equipos, jugadores, partidos, comparaciones y estadísticas de la liga.
          </p>
          <div class="notice" style="background:#082416;color:var(--yellow);margin:16px 0">
            Para crear, modificar o eliminar elementos de la liga, debes identificarte como <b>Administrador</b>.
          </div>
          <button class="btn yellow" id="openAdminLoginBtn" style="padding:12px 24px;font-size:14px">
            🔑 Iniciar Sesión como Administrador
          </button>
        </div>`;

      $('#openAdminLoginBtn').onclick = () => {
        openModal('adminLoginModal');
      };
      return;
    }

    el.innerHTML = `
      <div class="grid2">
        <div class="panel">
          <h2>Administración de la Liga</h2>
          <p class="muted">Acceso exclusivo del Administrador para crear y gestionar la competencia.</p>
          <div class="actions" style="margin-top:16px">
            <button class="btn yellow" data-modal="teamModal">+ Crear equipo</button>
            <button class="btn yellow" data-modal="playerModal">+ Crear jugador</button>
            <button class="btn yellow" data-modal="seasonModal">+ Crear temporada</button>
            <button class="btn yellow" data-modal="gameModal">+ Registrar juego</button>
          </div>
        </div>

        <div class="panel">
          <h2>Parámetros y Seguridad</h2>
          <p class="muted">Ajusta los parámetros generales de la liga o cierra tu sesión de administrador.</p>
          <form id="settingsForm" style="margin-top:12px">
            <div class="field">
              <label>Nombre de la Liga</label>
              <input name="leagueName" value="${esc(db.settings?.leagueName || 'ROSMIL LEAGUE')}">
            </div>
            <div class="field" style="margin-top:10px">
              <label>Nueva Clave de Administrador (PIN)</label>
              <input name="adminPin" type="password" value="${esc(db.settings?.adminPin || 'admin123')}">
            </div>
            <div class="formactions" style="margin-top:14px">
              <button type="submit" class="btn yellow">Guardar Parámetros</button>
              <button type="button" class="btn danger" id="adminLogoutBtn">Cerrar Sesión Admin</button>
            </div>
          </form>
        </div>
      </div>

      <div class="panel" style="margin-top:20px;border-color:var(--red)">
        <h2 style="color:var(--red)">Zona de Riesgo: Base de Datos</h2>
        <p class="muted">Borrar permanentemente todos los equipos, jugadores, temporadas y juegos almacenados.</p>
        <button class="btn danger-strong" id="clearData">Borrar todos los datos de la liga</button>
      </div>`;

    // Handler de guardado de configuración
    $('#settingsForm').onsubmit = e => {
      e.preventDefault();
      if (!checkAdmin()) return;
      const f = new FormData(e.target);
      db.settings.leagueName = f.get('leagueName') || 'ROSMIL LEAGUE';
      db.settings.adminPin = f.get('adminPin') || 'admin123';
      save();
      alert('Parámetros de la liga actualizados correctamente.');
    };

    // Logout
    $('#adminLogoutBtn').onclick = () => {
      isAdmin = false;
      sessionStorage.removeItem('rosmil_is_admin');
      updateRoleUI();
      renderAll();
      show('home');
    };

    // Borrado con doble confirmación
    $('#clearData').onclick = () => {
      requestDoubleDelete(
        'TODA LA BASE DE DATOS DE LA LIGA',
        'Se eliminarán todos los equipos, jugadores, temporadas y partidos registrados sin posibilidad de recuperación.',
        () => {
          localStorage.removeItem(KEY);
          db = {
            teams: [],
            players: [],
            games: [],
            seasons: [],
            series: [],
            events: [],
            settings: { adminPin: 'admin123', leagueName: 'ROSMIL LEAGUE' }
          };
          if (typeof firebaseInitialized !== 'undefined' && firebaseInitialized && firestoreDb) {
            firestoreDb.collection('leagues').doc('main').set(db);
          }
          recalcStats();
          renderAll();
          alert('Todos los datos han sido eliminados.');
          show('home');
        }
      );
    };
  }

  function renderAll() {
    populateSelects();
    recalcStats();
    updateRoleUI();

    if ($('#homeTeams')) $('#homeTeams').textContent = db.teams.length;
    if ($('#homePlayers')) $('#homePlayers').textContent = db.players.length;
    if ($('#homeSeasons')) $('#homeSeasons').textContent = db.seasons.length;
    if ($('#homeGames')) $('#homeGames').textContent = db.games.length;

    renderTeams();
    renderPlayers();
    renderGames();
    renderSeason();
    renderStandings();
    renderStats();
    renderLeaders();
    renderRanking();
    renderHistory();
    renderHomeGames();
    renderAdminPanel();
    updateActiveGameBanner();

    if (activeTeamId && $('#teamProfile').classList.contains('active')) {
      renderTeamProfile();
    }
    if (activePlayerId && $('#playerProfile').classList.contains('active')) {
      renderPlayerProfile();
    }
  }

  // ----------------------------------------------------
  // ELIMINACIÓN GENERAL CON DOBLE CONFIRMACIÓN
  // ----------------------------------------------------
  function remove(type, key, view) {
    if (!checkAdmin()) return;

    if (type === 'games') {
      db.games = db.games.filter(x => x.id !== key);
      updateSeriesFromGames();
      recalcStats();
    } else if (type === 'teams') {
      db.teams = db.teams.filter(x => x.id !== key);
      // Desvincular jugadores pero preservar su historial
      db.players.forEach(p => {
        if (p.team === key) {
          p.teamHistory.push({
            teamId: key,
            teamName: 'Equipo eliminado',
            date: new Date().toLocaleDateString()
          });
          p.team = '';
        }
      });
    } else {
      db[type] = db[type].filter(x => x.id !== key);
    }

    save();
    show(view);
  }

  // ----------------------------------------------------
  // ANOTADOR BAT LOG / iSCORE
  // ----------------------------------------------------
  function resultLabel(r) {
    return RESULT_OPTIONS.find(x => x[0] === r)?.[1] || r;
  }

  function batterStatsForGame(g, teamId) {
    return db.players
      .filter(p => p.team === teamId)
      .map(p => ({
        p,
        s: batterStats(
          p.id,
          (g.batLog || []).map(x => ({ ...x, gameId: g.id }))
        )
      }))
      .filter(x => x.s.PA > 0);
  }

  function pitcherStatsForGame(g, teamId) {
    return db.players
      .filter(p => p.team === teamId && isPitcher(p))
      .map(p => ({
        p,
        s: pitcherStats(
          p.id,
          (g.batLog || []).map(x => ({ ...x, gameId: g.id }))
        )
      }))
      .filter(x => x.s.BF > 0);
  }

  function renderGamePlayerMini(rows) {
    return rows.length
      ? rows
          .map(
            x => `
        <div class="playercard">
          <div class="head">
            <div>
              <span class="player-link" data-player-id="${x.p.id}" style="font-size:14px">${esc(x.p.name)}</span>
              <div class="subtle">PA ${x.s.PA} • AB ${x.s.AB}</div>
            </div>
            <strong style="color:var(--yellow)">${fmtAvg(x.s.AVG)}</strong>
          </div>
          <div class="metricrow">
            <div class="metric"><b>${x.s.H}</b><small>H</small></div>
            <div class="metric"><b>${x.s.HR}</b><small>HR</small></div>
            <div class="metric"><b>${x.s.RBI}</b><small>RBI</small></div>
            <div class="metric"><b>${x.s.SO}</b><small>SO</small></div>
          </div>
        </div>`
          )
          .join('')
      : empty('Sin apariciones', 'Todavía no hay bateadores registrados.');
  }

  function renderPitcherMini(rows) {
    return rows.length
      ? rows
          .map(
            x => `
        <div class="playercard">
          <div class="head">
            <div>
              <span class="player-link" data-player-id="${x.p.id}" style="font-size:14px">${esc(x.p.name)}</span>
              <div class="subtle">BF ${x.s.BF}</div>
            </div>
            <strong style="color:var(--yellow)">ERA ${x.s.ERA.toFixed(2)}</strong>
          </div>
          <div class="metricrow">
            <div class="metric"><b>${x.s.IP}</b><small>IP</small></div>
            <div class="metric"><b>${x.s.SO}</b><small>SO</small></div>
            <div class="metric"><b>${x.s.H}</b><small>H</small></div>
            <div class="metric"><b>${x.s.WHIP.toFixed(2)}</b><small>WHIP</small></div>
          </div>
        </div>`
          )
          .join('')
      : empty('Sin pitchers', 'No hay apariciones con pitchers registrados.');
  }

  function openScorebook(gid) {
    const g = getGame(gid);
    if (!g) return;
    $('#scoreModal').classList.add('open');
    renderScorebook(g);
  }

  function renderScorebook(g) {
    const log = g.batLog || [];
    const rows = log
      .map(
        pa => `
      <div class="eventrow">
        <div>${esc(pa.inning)}</div>
        <div>${pa.half === 'away' ? 'VIS' : 'LOC'}</div>
        <div>
          <span class="player-link" data-player-id="${pa.batter}">${esc(playerName(pa.batter))}</span>
          <div class="subtle"><span class="team-link" data-team-id="${pa.half === 'away' ? g.away : g.home}">${esc(teamName(pa.half === 'away' ? g.away : g.home))}</span></div>
        </div>
        <div><span class="player-link" data-player-id="${pa.pitcher}">${esc(playerName(pa.pitcher))}</span></div>
        <div>
          <span class="resultPill">${esc(resultLabel(pa.result))}</span>${
          pa.pitchType ? ` <span class="tag">${esc(pa.pitchType)}</span>` : ''
        }
        </div>
        <div>${Number(pa.outs) || 0} out</div>
        <div class="actions">
          <button class="btn admin-only" data-edit-pa="${pa.id}">Editar</button>
          <button class="btn danger admin-only" data-del-pa="${pa.id}">×</button>
        </div>
      </div>`
      )
      .join('');

    const bsAway = batterStatsForGame(g, g.away);
    const bsHome = batterStatsForGame(g, g.home);
    const psAway = pitcherStatsForGame(g, g.away);
    const psHome = pitcherStatsForGame(g, g.home);

    const awayHits = bsAway.reduce((acc, row) => acc + row.s.H, 0);
    const homeHits = bsHome.reduce((acc, row) => acc + row.s.H, 0);

    $('#scorebookArea').innerHTML = `
      <div class="head">
        <div>
          <div class="eyebrow">BAT LOG / iSCORE OFICIAL</div>
          <h2 style="margin:0">
            <span class="team-link" data-team-id="${g.away}">${esc(teamName(g.away))}</span> ${g.awayScore} — ${g.homeScore} 
            <span class="team-link" data-team-id="${g.home}">${esc(teamName(g.home))}</span>
          </h2>
          <div class="muted">${esc(seasonName(g.season))} • Juego ${esc(g.gameNumber || '—')} • ${esc(g.date)}</div>
        </div>
        <div class="actions">
          <button class="btn yellow admin-only" data-add-pa="${g.id}">+ Registrar PA</button>
          <button class="btn blue" data-open-face>⚔ Cara a cara</button>
          <button class="btn close">Cerrar</button>
        </div>
      </div>
      <div class="notice good" style="margin-top:14px">
        ${
          log.length
            ? `Este juego tiene <b>${log.length}</b> apariciones registradas; esas apariciones alimentan las estadísticas oficiales.`
            : 'Este juego todavía no tiene BAT LOG. El resultado numérico no modifica las estadísticas individuales hasta registrar las apariciones.'
        }
      </div>
      <div class="statgrid">
        <div class="statbox"><small>PA registradas</small><b>${log.length}</b></div>
        <div class="statbox"><small>Hits Visitante</small><b>${awayHits}</b></div>
        <div class="statbox"><small>Hits Local</small><b>${homeHits}</b></div>
        <div class="statbox"><small>SO Visitante</small><b>${psAway.reduce((n, x) => n + x.s.SO, 0)}</b></div>
        <div class="statbox"><small>SO Local</small><b>${psHome.reduce((n, x) => n + x.s.SO, 0)}</b></div>
        <div class="statbox"><small>Estatus</small><b style="color:var(--yellow)">${log.length ? 'Activo' : 'Vacío'}</b></div>
      </div>
      <div class="scorebook">
        <div class="panel">
          <div class="head">
            <h2>Libro de Jugadas</h2>
            <span class="muted">Aparición por aparición</span>
          </div>
          ${
            log.length
              ? `
            <div class="eventrow headrow">
              <div>Inn</div>
              <div>Mitad</div>
              <div>Bateador</div>
              <div>Pitcher</div>
              <div>Resultado</div>
              <div>Outs</div>
              <div></div>
            </div>
            ${rows}`
              : empty('BAT LOG vacío', 'Pulsa “+ Registrar PA” para comenzar la anotación.')
          }
        </div>
        <div>
          <div class="panel">
            <h2>Visitante — Bateadores</h2>
            ${renderGamePlayerMini(bsAway)}
          </div>
          <div class="panel">
            <h2>Local — Bateadores</h2>
            ${renderGamePlayerMini(bsHome)}
          </div>
          <div class="panel">
            <h2>Lanzadores</h2>
            ${renderPitcherMini(psAway.concat(psHome))}
          </div>
        </div>
      </div>`;

    $$('[data-add-pa]').forEach(b => (b.onclick = () => {
      if (!checkAdmin()) return;
      openPAModal(g.id);
    }));
    $$('[data-edit-pa]').forEach(b => (b.onclick = () => {
      if (!checkAdmin()) return;
      openPAModal(g.id, b.dataset.editPa);
    }));
    $$('[data-del-pa]').forEach(b => (b.onclick = () => {
      if (!checkAdmin()) return;
      const paid = b.dataset.delPa;
      requestDoubleDelete(
        'Aparición al Plato',
        'Esta jugada se eliminará del BAT LOG y recalculará las estadísticas.',
        () => deletePA(g.id, paid)
      );
    }));
    $$('[data-open-face]').forEach(b => (b.onclick = () => openFaceoff()));
  }

  function deletePA(gid, paid) {
    const g = getGame(gid);
    if (!g) return;
    g.batLog = (g.batLog || []).filter(x => x.id !== paid);
    recalcStats();
    save();
    renderScorebook(g);
  }

  // ----------------------------------------------------
  // CARA A CARA: BATEADOR VS LANZADOR
  // ----------------------------------------------------
  function openFaceoff() {
    closeModals();
    $('#faceModal').classList.add('open');
    const all = db.players.slice().sort((a, b) => a.name.localeCompare(b.name));

    $('#faceBatter').innerHTML = all.length
      ? all.map(p => `<option value="${p.id}">${esc(p.name)} — ${esc(teamName(p.team))}</option>`).join('')
      : `<option value="">No hay jugadores</option>`;

    $('#facePitcher').innerHTML = all.length
      ? all.map(p => `<option value="${p.id}">${esc(p.name)} — ${esc(teamName(p.team))}</option>`).join('')
      : `<option value="">No hay jugadores</option>`;

    const firstB = all.find(isBatter) || all[0];
    const firstP = all.find(isPitcher) || all[0];
    if (firstB) $('#faceBatter').value = firstB.id;
    if (firstP) $('#facePitcher').value = firstP.id;

    renderFaceoff();
    $('#faceBatter').onchange = renderFaceoff;
    $('#facePitcher').onchange = renderFaceoff;
  }

  function renderFaceoff() {
    const batter = $('#faceBatter').value;
    const pitcher = $('#facePitcher').value;
    const rows = allPAs().filter(pa => pa.batter === batter && pa.pitcher === pitcher);
    const bs = batterStats(batter, rows);
    const ps = pitcherStats(pitcher, rows);
    const bp = db.players.find(p => p.id === batter);
    const pp = db.players.find(p => p.id === pitcher);

    const outcomes = {};
    rows.forEach(r => {
      outcomes[r.result] = (outcomes[r.result] || 0) + 1;
    });

    const outcomeHTML =
      Object.entries(outcomes)
        .sort((a, b) => b[1] - a[1])
        .map(([r, n]) => `<span class="tag">${esc(resultLabel(r))}: ${n}</span>`)
        .join('') || '<span class="muted">Sin enfrentamientos registrados todavía.</span>';

    $('#faceArea').innerHTML = `
      <div class="compare">
        <div class="playercard">
          <div class="playerhead">
            ${bp?.photo ? `<img src="${bp.photo}" alt="">` : ''}
            <div>
              <h3><span class="player-link" data-player-id="${bp?.id}">${esc(bp?.name || 'Bateador')}</span></h3>
              <div class="subtle">${esc(teamName(bp?.team))} • Bateador</div>
            </div>
          </div>
          <div class="metricrow">
            <div class="metric"><b>${bs.PA}</b><small>PA</small></div>
            <div class="metric"><b>${bs.AB}</b><small>AB</small></div>
            <div class="metric"><b>${bs.H}</b><small>H</small></div>
            <div class="metric"><b style="color:var(--yellow)">${fmtAvg(bs.AVG)}</b><small>AVG</small></div>
          </div>
        </div>
        <div class="playercard">
          <div class="playerhead">
            ${pp?.photo ? `<img src="${pp.photo}" alt="">` : ''}
            <div>
              <h3><span class="player-link" data-player-id="${pp?.id}">${esc(pp?.name || 'Lanzador')}</span></h3>
              <div class="subtle">${esc(teamName(pp?.team))} • Lanzador</div>
            </div>
          </div>
          <div class="metricrow">
            <div class="metric"><b>${ps.SO}</b><small>SO</small></div>
            <div class="metric"><b>${ps.H}</b><small>H</small></div>
            <div class="metric"><b>${ps.HR}</b><small>HR</small></div>
            <div class="metric"><b>${ps.BB}</b><small>BB</small></div>
          </div>
        </div>
      </div>
      <div class="panel" style="margin-top:14px">
        <div class="head">
          <h2>Qué ocurre cuando se enfrentan</h2>
          <span class="pill">${rows.length} PA</span>
        </div>
        <div style="margin-top:10px">${outcomeHTML}</div>
        <div class="statgrid">
          <div class="statbox"><small>Ponches</small><b>${bs.SO}</b></div>
          <div class="statbox"><small>Hits</small><b>${bs.H}</b></div>
          <div class="statbox"><small>Promedio</small><b style="color:var(--yellow)">${fmtAvg(bs.AVG)}</b></div>
          <div class="statbox"><small>HR</small><b>${bs.HR}</b></div>
          <div class="statbox"><small>BB</small><b>${bs.BB}</b></div>
          <div class="statbox"><small>K%</small><b>${fmtPct(bs.KPct * 100)}</b></div>
        </div>
      </div>
      <div class="panel">
        <h2>Historial de enfrentamientos directos</h2>
        ${
          rows.length
            ? `
          <div class="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Juego</th>
                  <th>Entrada</th>
                  <th>Resultado</th>
                  <th>Picheo</th>
                </tr>
              </thead>
              <tbody>
                ${rows
                  .slice()
                  .reverse()
                  .map(
                    pa => `
                  <tr>
                    <td>${esc(pa.game.date || '')}</td>
                    <td>${esc(teamName(pa.game.away))} vs ${esc(teamName(pa.game.home))}</td>
                    <td>${pa.inning} ${pa.half === 'away' ? 'VIS' : 'LOC'}</td>
                    <td>${esc(resultLabel(pa.result))}</td>
                    <td>${esc(pa.pitchType || '—')}</td>
                  </tr>`
                  )
                  .join('')}
              </tbody>
            </table>
          </div>`
            : empty('Sin enfrentamientos', 'Registra BAT LOG con estos dos jugadores.')
        }
      </div>`;
  }

  // ----------------------------------------------------
  // GESTIÓN DE MODALES Y FORMULARIOS
  // ----------------------------------------------------
  function closeModals() {
    $$('.modal').forEach(m => m.classList.remove('open'));
  }

  function openModal(mid) {
    $('#' + mid).classList.add('open');
    populateSelects();
    if (mid === 'playerModal') preparePlayerModal();
    if (mid === 'teamModal') prepareTeamModal();
    if (mid === 'seasonModal') prepareSeasonModal();
    if (mid === 'seriesModal') prepareSeriesModal();
    if (mid === 'gameModal') prepareGameModal();
  }

  function readImage(file, cb) {
    if (!file || !file.size) {
      cb(null);
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 320;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        cb(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => cb(r.result);
      img.src = r.result;
    };
    r.readAsDataURL(file);
  }

  function populateSelects() {
    const teamOpts = db.teams.length
      ? db.teams.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')
      : `<option value="">No hay equipos</option>`;

    ['playerTeam', 'homeTeam', 'awayTeam', 'seriesTeamA', 'seriesTeamB'].forEach(x => {
      if ($('#' + x)) $('#' + x).innerHTML = teamOpts;
    });

    const seasonOpts = db.seasons.length
      ? db.seasons
          .map(
            s =>
              `<option value="${s.id}">${esc(s.name)} — ${
                s.type === 'league' ? 'Liga' : 'Eliminatoria'
              }</option>`
          )
          .join('')
      : `<option value="">No hay temporadas</option>`;

    ['gameSeason', 'seriesSeason'].forEach(x => {
      if ($('#' + x)) $('#' + x).innerHTML = seasonOpts;
    });
  }

  function preparePlayerModal(pid = null) {
    const f = $('#playerForm');
    f.reset();
    f.id.value = pid || '';
    $('#playerModalTitle').textContent = pid ? 'Editar jugador' : 'Crear jugador';
    $('#playerPreview').style.display = 'none';

    const p = pid && db.players.find(x => x.id === pid);
    if (p) {
      ['name', 'number', 'team', 'position', 'bats', 'throws', 'age', 'height', 'weight'].forEach(k => {
        if (f.elements[k]) f.elements[k].value = p[k] ?? '';
      });
      f.role.value =
        p.role ||
        (p.isPitcher && p.isBatter ? 'two-way' : p.isPitcher ? 'pitcher' : 'batter');
      if (f.isPitcherChoice) {
        f.isPitcherChoice.value = p.isPitcherChoice || (isPitcher(p) ? 'yes' : 'no');
      }
      if (p.photo) {
        $('#playerPreview').src = p.photo;
        $('#playerPreview').style.display = 'block';
      }
    } else {
      if (f.isPitcherChoice) {
        f.isPitcherChoice.value = 'no';
      }
    }

    const uniquePitches = PITCH_TYPES.filter((v, i, a) => a.indexOf(v) === i);
    $('#pitchTypes').innerHTML = uniquePitches
      .map(
        x =>
          `<label class="check"><input type="checkbox" name="pitchType" value="${esc(
            x
          )}" ${(p?.pitchTypes || []).includes(x) ? 'checked' : ''}>${esc(x)}</label>`
      )
      .join('');
  }

  function prepareTeamModal(tid = null) {
    const f = $('#teamForm');
    f.reset();
    f.id.value = tid || '';
    $('#teamModalTitle').textContent = tid ? 'Editar equipo' : 'Crear equipo';
    $('#teamPreview').style.display = 'none';

    const t = tid && db.teams.find(x => x.id === tid);
    if (t) {
      f.name.value = t.name || '';
      f.city.value = t.city || '';
      f.manager.value = t.manager || '';
      if (t.logo) {
        $('#teamPreview').src = t.logo;
        $('#teamPreview').style.display = 'block';
      }
    }

    // REGLA N° 1: Jugadores que realmente pertenecen al equipo (p.team === tid)
    const selected = new Set(db.players.filter(p => p.team === tid).map(p => p.id));
    $('#teamRoster').innerHTML = db.players.length
      ? db.players
          .map(
            p =>
              `<label><input type="checkbox" name="rosterPlayer" value="${p.id}" ${
                selected.has(p.id) ? 'checked' : ''
              }>${
                p.photo ? `<img class="avatar" src="${p.photo}" alt="">` : ''
              }<span>${esc(p.name)} <small class="muted">#${esc(p.number)}</small> ${
                p.team && p.team !== tid ? `<small style="color:var(--yellow)">(${esc(teamName(p.team))})</small>` : ''
              }</span></label>`
          )
          .join('')
      : empty('No hay jugadores', 'Crea jugadores primero.');
  }

  function prepareSeasonModal(sid = null) {
    const f = $('#seasonForm');
    f.reset();
    f.id.value = sid || '';
    $('#seasonModalTitle').textContent = sid ? 'Editar temporada' : 'Crear temporada';

    const s = sid && db.seasons.find(x => x.id === sid);
    if (s) {
      f.name.value = s.name || '';
      f.type.value = s.type || 'league';
      f.start.value = s.start || '';
      f.end.value = s.end || '';
      f.gamesCount.value = s.gamesCount || '';
      f.bestOf.value = s.bestOf || '3';
    }
    toggleSeasonFields();
  }

  function toggleSeasonFields() {
    const elimination = $('#seasonType').value === 'elimination';
    $('#leagueGamesField').style.display = elimination ? 'none' : 'block';
    $('#bestOfField').style.display = elimination ? 'block' : 'none';
    $('#seasonHelp').className = 'notice ' + (elimination ? 'info' : '');
    $('#seasonHelp').textContent = elimination
      ? 'Eliminatoria: selecciona el formato al mejor de 3, 5 o 7 y después crea las series entre los equipos.'
      : 'Liga: indica la cantidad total de juegos que tendrá la competencia.';
  }

  function prepareSeriesModal() {
    const els = db.seasons.filter(s => s.type === 'elimination');
    $('#seriesSeason').innerHTML = els.length
      ? els.map(s => `<option value="${s.id}">${esc(s.name)} — Mejor de ${s.bestOf}</option>`).join('')
      : `<option value="">No hay eliminatorias</option>`;

    const opts = db.teams.length
      ? db.teams.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')
      : `<option value="">No hay equipos</option>`;

    $('#seriesTeamA').innerHTML = opts;
    $('#seriesTeamB').innerHTML = opts;
  }

  function prepareGameModal(gid = null) {
    const f = $('#gameForm');
    f.reset();
    f.id.value = gid || '';
    $('#gameModalTitle').textContent = gid ? 'Editar juego' : 'Registrar juego';
    f.awayScore.value = 0;
    f.homeScore.value = 0;
    populateSelects();

    const g = gid && getGame(gid);
    if (g) {
      ['season', 'series', 'gameNumber', 'date', 'time', 'home', 'away', 'stadium', 'awayScore', 'homeScore'].forEach(
        k => {
          if (f.elements[k]) f.elements[k].value = g[k] ?? '';
        }
      );
    }
    updateGameSeries(g?.series || '');
  }

  function updateGameSeries(selected = '') {
    const sid = $('#gameSeason').value;
    const list = db.series.filter(s => s.season === sid);
    $('#gameSeries').innerHTML =
      '<option value="">No pertenece a una serie</option>' +
      list
        .map(
          s =>
            `<option value="${s.id}" ${s.id === selected ? 'selected' : ''}>${esc(
              teamName(s.teamA)
            )} vs ${esc(teamName(s.teamB))} — Mejor de ${s.bestOf}</option>`
        )
        .join('');
  }

  function updateSeriesFromGames() {
    db.series.forEach(sr => {
      const gs = db.games.filter(g => g.series === sr.id);
      sr.winsA = gs.filter(
        g =>
          (g.home === sr.teamA && Number(g.homeScore) > Number(g.awayScore)) ||
          (g.away === sr.teamA && Number(g.awayScore) > Number(g.homeScore))
      ).length;
      sr.winsB = gs.filter(
        g =>
          (g.home === sr.teamB && Number(g.homeScore) > Number(g.awayScore)) ||
          (g.away === sr.teamB && Number(g.awayScore) > Number(g.homeScore))
      ).length;

      const need = Math.ceil((Number(sr.bestOf) || 3) / 2);
      sr.status =
        sr.winsA >= need
          ? 'Finalizada — ' + teamName(sr.teamA)
          : sr.winsB >= need
          ? 'Finalizada — ' + teamName(sr.teamB)
          : gs.length
          ? 'En curso'
          : 'Pendiente';
    });
  }

  function refreshPAPlayers() {
    const g = getGame($('#paForm').gameId.value);
    if (!g) return;
    const side = $('#paForm [name="half"]').value;
    const batter = $('#paBatter').value;
    const pitcher = $('#paPitcher').value;

    setOptions($('#paBatter'), teamPlayers(side === 'away' ? g.away : g.home, true), batter);
    setOptions($('#paPitcher'), teamPlayers(side === 'away' ? g.home : g.away, false, true), pitcher);
    updatePAPitchTypes(pitcher);
  }

  function setOptions(el, items, selected = '') {
    el.innerHTML = items.length
      ? items
          .map(
            p =>
              `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${esc(p.name)}${
                p.number !== '' && p.number != null ? ' — #' + esc(p.number) : ''
              }</option>`
          )
          .join('')
      : `<option value="">No disponibles</option>`;
  }

  function openPAModal(gid, paid = null) {
    const g = getGame(gid);
    if (!g) return;
    $('#paModal').classList.add('open');
    const f = $('#paForm');
    f.reset();
    f.gameId.value = gid;
    f.paId.value = paid || '';
    $('#paModalTitle').textContent = paid ? 'Editar aparición al plato' : 'Registrar aparición al plato';
    $('#paResult').innerHTML = RESULT_OPTIONS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');

    const pa = paid ? (g.batLog || []).find(x => x.id === paid) : null;
    const batterTeam = pa ? (pa.half === 'away' ? g.away : g.home) : g.away;
    const pitcherTeam = pa ? (pa.half === 'away' ? g.home : g.away) : g.home;

    setOptions($('#paBatter'), teamPlayers(batterTeam, true), pa?.batter || '');
    setOptions($('#paPitcher'), teamPlayers(pitcherTeam, false, true), pa?.pitcher || '');

    if (pa) {
      f.inning.value = pa.inning || 1;
      f.half.value = pa.half || 'away';
      f.result.value = pa.result || 'Single';
      f.pitchType.value = pa.pitchType || '';
      f.outs.value = Number(pa.outs) || 0;
      f.rbi.value = Number(pa.rbi) || 0;
      f.runs.value = Number(pa.runs) || 0;
      f.sb.value = Number(pa.sb) || 0;
      f.hbp.value = Number(pa.hbp) || 0;
      f.earnedRuns.value = Number(pa.earnedRuns) || 0;
    }
    updatePAPitchTypes(pa?.pitcher || '');
  }

  function updatePAPitchTypes(selected = '') {
    const pid = $('#paPitcher').value;
    const p = db.players.find(x => x.id === pid);
    const list = p?.pitchTypes || [];
    $('#paPitchType').innerHTML =
      '<option value="">No registrar</option>' +
      list.map(x => `<option value="${esc(x)}" ${x === selected ? 'selected' : ''}>${esc(x)}</option>`).join('');
  }

  // ----------------------------------------------------
  // EVENTOS E INICIALIZACIÓN
  // ----------------------------------------------------
  function initEvents() {
    // Navegación por vistas
    $$('nav button').forEach(b => b.addEventListener('click', () => show(b.dataset.view)));
    $$('[data-go]').forEach(b => b.addEventListener('click', () => show(b.dataset.go)));

    // Modales generales
    $$('[data-modal]').forEach(b =>
      b.addEventListener('click', () => {
        if (!checkAdmin()) return;
        openModal(b.dataset.modal);
      })
    );
    $$('.close').forEach(b => b.addEventListener('click', closeModals));
    $$('.modal').forEach(m =>
      m.addEventListener('click', e => {
        if (e.target === m) closeModals();
      })
    );

    // Botón de rol en la barra superior
    $('#adminRoleBtn').addEventListener('click', () => {
      if (isAdmin) {
        if (confirm('¿Deseas salir del Modo Administrador y volver a Modo Espectador?')) {
          isAdmin = false;
          sessionStorage.removeItem('rosmil_is_admin');
          localStorage.removeItem('rosmil_is_admin');
          updateRoleUI();
          renderAll();
        }
      } else {
        openModal('adminLoginModal');
      }
    });

    // Formulario de login de Administrador
    $('#adminLoginForm').addEventListener('submit', e => {
      e.preventDefault();
      const pin = $('#adminPinInput').value;
      const expected = db.settings?.adminPin || 'admin123';
      if (pin === expected) {
        isAdmin = true;
        sessionStorage.setItem('rosmil_is_admin', 'true');
        localStorage.setItem('rosmil_is_admin', 'true');
        $('#adminLoginError').style.display = 'none';
        closeModals();
        updateRoleUI();
        renderAll();
        alert('✅ Acceso concedido: Modo Administrador activado.');
      } else {
        $('#adminLoginError').style.display = 'block';
      }
    });

    // Pasos de Doble Confirmación (Regla N° 6)
    $('#confirmProceed1').addEventListener('click', () => {
      $('#confirmStep1').style.display = 'none';
      $('#confirmStep2').style.display = 'block';
    });

    $('#confirmFinalDelete').addEventListener('click', () => {
      closeModals();
      if (typeof pendingDeleteAction === 'function') {
        const action = pendingDeleteAction;
        pendingDeleteAction = null;
        action();
      }
    });

    // SELECTS dependientes
    if ($('#seasonType')) $('#seasonType').addEventListener('change', toggleSeasonFields);
    if ($('#gameSeason')) $('#gameSeason').addEventListener('change', () => updateGameSeries(''));
    if ($('#paPitcher')) $('#paPitcher').addEventListener('change', () => updatePAPitchTypes(''));
    if ($('#paForm [name="half"]')) {
      $('#paForm [name="half"]').addEventListener('change', refreshPAPlayers);
    }

    if ($('#paResult')) {
      $('#paResult').addEventListener('change', () => {
        const r = $('#paResult').value;
        $('#paOuts').value = DEFAULT_OUTS[r] ?? 0;
        const h = HIT_RESULTS.has(r);
        if (h && r !== 'Home Run') {
          $('#paRbi')?.focus?.();
        }
      });
    }

    // SUBMIT: TEAM FORM (REGLAS N° 1 Y 18: HISTORIAL Y ROSTER REAL)
    $('#teamForm').addEventListener('submit', e => {
      e.preventDefault();
      if (!checkAdmin()) return;

      const f = new FormData(e.target);
      const tid = f.get('id') || id();
      let t = db.teams.find(x => x.id === tid);
      const roster = [...e.target.querySelectorAll('[name="rosterPlayer"]:checked')].map(x => x.value);

      const finish = logo => {
        if (!t) {
          t = { id: tid };
          db.teams.push(t);
        }
        Object.assign(t, {
          name: f.get('name'),
          city: f.get('city'),
          manager: f.get('manager'),
          logo: logo !== null ? logo : t.logo || '',
          players: roster
        });

        // REGLA N° 1 y 18: Sincronizar pertenecia y registrar historial de cambios
        db.players.forEach(p => {
          if (roster.includes(p.id)) {
            if (p.team && p.team !== tid) {
              p.teamHistory.push({
                teamId: p.team,
                teamName: teamName(p.team),
                date: new Date().toLocaleDateString(),
                note: `Transferido a ${t.name}`
              });
            }
            p.team = tid;
          } else if (p.team === tid) {
            p.teamHistory.push({
              teamId: tid,
              teamName: t.name,
              date: new Date().toLocaleDateString(),
              note: 'Baja del equipo'
            });
            p.team = '';
          }
        });

        closeModals();
        save();
        show('teams');
      };
      readImage(f.get('logoFile'), finish);
    });

    // SUBMIT: PLAYER FORM (REGLAS N° 10, 11 Y 18: EQUIPO ACTUAL Y TRASPASO)
    $('#playerForm').addEventListener('submit', e => {
      e.preventDefault();
      if (!checkAdmin()) return;

      const f = new FormData(e.target);
      const pid = f.get('id') || id();
      let p = db.players.find(x => x.id === pid);
      const role = f.get('role');
      const isPitcherChoice = f.get('isPitcherChoice') || (role === 'pitcher' ? 'yes' : 'no');
      const newTeam = f.get('team');

      const finish = photo => {
        if (!p) {
          p = { id: pid, teamHistory: [] };
          db.players.push(p);
        }

        // Si cambió de equipo, registrar en el historial
        if (p.team && p.team !== newTeam) {
          p.teamHistory.push({
            teamId: p.team,
            teamName: teamName(p.team),
            date: new Date().toLocaleDateString(),
            note: 'Cambio de franquicia'
          });
        }

        Object.assign(p, {
          name: f.get('name'),
          number: f.get('number'),
          team: newTeam,
          role,
          position: f.get('position'),
          bats: f.get('bats'),
          throws: f.get('throws'),
          age: f.get('age'),
          height: f.get('height'),
          weight: f.get('weight'),
          isPitcherChoice,
          isPitcher: isPitcherChoice === 'yes' || role === 'pitcher' || role === 'two-way',
          isBatter: role === 'batter' || role === 'two-way',
          pitchTypes: [...e.target.querySelectorAll('[name="pitchType"]:checked')].map(x => x.value),
          photo: photo !== null ? photo : p.photo || ''
        });

        closeModals();
        recalcStats();
        save();
        show('players');
      };
      readImage(f.get('photoFile'), finish);
    });

    // SUBMIT: SEASON FORM
    $('#seasonForm').addEventListener('submit', e => {
      e.preventDefault();
      if (!checkAdmin()) return;

      const f = new FormData(e.target);
      const sid = f.get('id') || id();
      let s = db.seasons.find(x => x.id === sid);
      if (!s) {
        s = { id: sid };
        db.seasons.push(s);
      }
      Object.assign(s, {
        name: f.get('name'),
        type: f.get('type'),
        start: f.get('start'),
        end: f.get('end'),
        gamesCount: f.get('gamesCount'),
        bestOf: f.get('bestOf'),
        status: 'Activa'
      });
      closeModals();
      save();
      show('season');
    });

    // SUBMIT: SERIES FORM
    $('#seriesForm').addEventListener('submit', e => {
      e.preventDefault();
      if (!checkAdmin()) return;

      const f = new FormData(e.target);
      const sid = f.get('season');
      const a = f.get('teamA');
      const b = f.get('teamB');

      if (!sid || !a || !b || a === b) {
        alert('Selecciona una temporada y dos equipos diferentes.');
        return;
      }
      const s = db.seasons.find(x => x.id === sid);
      if (!s || s.type !== 'elimination') {
        alert('Las series solo pertenecen a una temporada eliminatoria.');
        return;
      }
      if (
        db.series.some(
          sr =>
            sr.season === sid &&
            ((sr.teamA === a && sr.teamB === b) || (sr.teamA === b && sr.teamB === a)) &&
            !sr.status?.startsWith('Finalizada')
        )
      ) {
        alert('Ya existe una serie activa entre esos equipos en esa temporada.');
        return;
      }

      db.series.push({
        id: id(),
        season: sid,
        teamA: a,
        teamB: b,
        bestOf: Number(s.bestOf) || 3,
        winsA: 0,
        winsB: 0,
        status: 'Pendiente'
      });
      closeModals();
      save();
      show('season');
    });

    // SUBMIT: GAME FORM
    $('#gameForm').addEventListener('submit', e => {
      e.preventDefault();
      if (!checkAdmin()) return;

      const f = new FormData(e.target);
      const gid = f.get('id') || id();
      const season = f.get('season');
      const series = f.get('series');
      const home = f.get('home');
      const away = f.get('away');

      if (!season || !home || !away || home === away) {
        alert('Selecciona temporada y dos equipos diferentes.');
        return;
      }
      const s = db.seasons.find(x => x.id === season);
      if (!s) {
        alert('La temporada seleccionada no existe.');
        return;
      }
      if (series) {
        const sr = getSeries(series);
        if (
          !sr ||
          sr.season !== season ||
          ![sr.teamA, sr.teamB].includes(home) ||
          ![sr.teamA, sr.teamB].includes(away)
        ) {
          alert('Los equipos no pertenecen a la serie seleccionada.');
          return;
        }
      }

      let g = getGame(gid);
      if (!g) {
        g = { id: gid, batLog: [] };
        db.games.push(g);
      }
      Object.assign(g, {
        season,
        series,
        gameNumber: f.get('gameNumber'),
        date: f.get('date'),
        time: f.get('time'),
        home,
        away,
        stadium: f.get('stadium'),
        homeScore: Number(f.get('homeScore')) || 0,
        awayScore: Number(f.get('awayScore')) || 0,
        status: 'Finalizado'
      });
      g.batLog = Array.isArray(g.batLog) ? g.batLog : [];

      updateSeriesFromGames();
      recalcStats();
      closeModals();
      save();
      show('games');
    });

    // SUBMIT: PA FORM
    $('#paForm').addEventListener('submit', e => {
      e.preventDefault();
      if (!checkAdmin()) return;

      const f = new FormData(e.target);
      const g = getGame(f.get('gameId'));
      if (!g) return;

      const half = f.get('half');
      const batter = f.get('batter');
      const pitcher = f.get('pitcher');

      if (!batter || !pitcher) {
        alert('Selecciona un bateador y un lanzador.');
        return;
      }

      const batterTeam = half === 'away' ? g.away : g.home;
      const pitcherTeam = half === 'away' ? g.home : g.away;

      if (!teamPlayers(batterTeam, true).some(p => p.id === batter)) {
        alert('El bateador no pertenece al equipo que está al bate.');
        return;
      }
      if (!teamPlayers(pitcherTeam, false, true).some(p => p.id === pitcher)) {
        alert('El lanzador no pertenece al equipo a la defensiva.');
        return;
      }

      const pa = {
        id: f.get('paId') || id(),
        inning: Number(f.get('inning')) || 1,
        half,
        batter,
        pitcher,
        result: f.get('result'),
        pitchType: f.get('pitchType'),
        outs: Number(f.get('outs')) || 0,
        rbi: Number(f.get('rbi')) || 0,
        runs: Number(f.get('runs')) || 0,
        sb: Number(f.get('sb')) || 0,
        hbp: Number(f.get('hbp')) || 0,
        earnedRuns: Number(f.get('earnedRuns')) || 0
      };

      const ix = (g.batLog || []).findIndex(x => x.id === pa.id);
      if (ix >= 0) g.batLog[ix] = pa;
      else g.batLog.push(pa);

      recalcStats();
      closeModals();
      $('#scoreModal').classList.add('open');
      renderScorebook(g);
      save();
    });

    // --------------------------------------------------
    // EVENTOS: ASISTENTE DE PARTIDOS (ROSMIL LEAGUE 0.2 - WIZARD)
    // --------------------------------------------------
    if ($('#btnOpenGameWizard')) {
      $('#btnOpenGameWizard').addEventListener('click', openGameWizard);
    }

    // Inning buttons en Paso 2
    $$('.btn-inning-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.btn-inning-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        wizardState.innings = Number(btn.dataset.innings);
        if ($('#wizCustomInnings')) $('#wizCustomInnings').value = '';
      });
    });

    if ($('#wizCustomInnings')) {
      $('#wizCustomInnings').addEventListener('input', e => {
        const val = Number(e.target.value);
        if (val > 0) {
          $$('.btn-inning-opt').forEach(b => b.classList.remove('active'));
          wizardState.innings = val;
        }
      });
    }

    // Paso 1 -> 2
    if ($('#wizBtnStep1')) {
      $('#wizBtnStep1').addEventListener('click', () => {
        const name = $('#wizGameName').value.trim();
        const season = $('#wizGameSeason').value;
        const date = $('#wizGameDate').value;
        if (!season || !date) {
          alert('Por favor selecciona una temporada/competencia y una fecha para el partido.');
          return;
        }
        wizardState.gameName = name;
        wizardState.season = season;
        wizardState.date = date;
        wizardState.time = $('#wizGameTime').value;
        wizardState.stadium = $('#wizGameStadium').value;
        setWizardStep(2);
      });
    }

    // Paso 2 Atrás / Siguiente
    if ($('#wizBackBtn2')) $('#wizBackBtn2').addEventListener('click', () => setWizardStep(1));
    if ($('#wizBtnStep2')) {
      $('#wizBtnStep2').addEventListener('click', () => {
        wizardState.outsPerInning = Number($('#wizOutsPerInning').value) || 3;
        setWizardStep(3);
      });
    }

    // Paso 3 Atrás / Siguiente
    if ($('#wizBackBtn3')) $('#wizBackBtn3').addEventListener('click', () => setWizardStep(2));
    if ($('#wizBtnStep3')) {
      $('#wizBtnStep3').addEventListener('click', () => {
        const h = $('#wizHomeTeam').value;
        const a = $('#wizAwayTeam').value;
        if (!h || !a || h === a) {
          alert('Debes seleccionar un Equipo Local y un Equipo Visitante diferentes.');
          return;
        }
        wizardState.homeTeam = h;
        wizardState.awayTeam = a;
        setWizardStep(4);
      });
    }

    // Paso 4: Lineup Local
    if ($('#wizBackBtn4')) $('#wizBackBtn4').addEventListener('click', () => setWizardStep(3));
    if ($('#btnAutoOrderHome')) {
      $('#btnAutoOrderHome').addEventListener('click', () => {
        autoFillBattingOrder(wizardState.homeTeam, wizardState.homeBattingOrder, 'homeOrderList');
      });
    }
    if ($('#wizBtnStep4')) {
      $('#wizBtnStep4').addEventListener('click', () => {
        if (!wizardState.homeBattingOrder.filter(Boolean).length) {
          autoFillBattingOrder(wizardState.homeTeam, wizardState.homeBattingOrder, 'homeOrderList');
        }
        setWizardStep(5);
      });
    }

    // Paso 5: Lineup Visitante
    if ($('#wizBackBtn5')) $('#wizBackBtn5').addEventListener('click', () => setWizardStep(4));
    if ($('#btnAutoOrderAway')) {
      $('#btnAutoOrderAway').addEventListener('click', () => {
        autoFillBattingOrder(wizardState.awayTeam, wizardState.awayBattingOrder, 'awayOrderList');
      });
    }
    if ($('#wizBtnStep5')) {
      $('#wizBtnStep5').addEventListener('click', () => {
        if (!wizardState.awayBattingOrder.filter(Boolean).length) {
          autoFillBattingOrder(wizardState.awayTeam, wizardState.awayBattingOrder, 'awayOrderList');
        }
        setWizardStep(6);
      });
    }

    // Paso 6: Resumen y Lanzar Juego
    if ($('#wizBackBtn6')) $('#wizBackBtn6').addEventListener('click', () => setWizardStep(5));
    if ($('#wizBtnStartGame')) {
      $('#wizBtnStartGame').addEventListener('click', startLiveGameFromWizard);
    }

    // --------------------------------------------------
    // EVENTOS: CONSOLA EN VIVO ULTRA-RÁPIDA (ROSMIL LEAGUE 0.2)
    // --------------------------------------------------
    $$('.btn-play-action').forEach(btn => {
      btn.addEventListener('click', () => {
        handleSelectPlayResult(btn.dataset.action);
      });
    });

    $$('.btn-rbi-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        handleSelectRbi(btn.dataset.rbi);
      });
    });

    if ($('#btnConfirmLivePlay')) {
      $('#btnConfirmLivePlay').addEventListener('click', confirmLivePlay);
    }

    // BOTONES DESHACER Y REHACER (SECCIÓN 16 Y 19)
    if ($('#btnLiveUndo')) {
      $('#btnLiveUndo').addEventListener('click', handleUndoLivePlay);
    }
    if ($('#btnLiveRedo')) {
      $('#btnLiveRedo').addEventListener('click', handleRedoLivePlay);
    }

    // REPLAY 2D DESDE LA CONSOLA EN VIVO
    if ($('#btnLiveOpenReplay')) {
      $('#btnLiveOpenReplay').addEventListener('click', () => {
        if (liveGameState.gameId) openGameReplay(liveGameState.gameId);
      });
    }

    // CONTROLES DE REPLAY 2D
    if ($('#btnCloseReplayModal')) {
      $('#btnCloseReplayModal').addEventListener('click', () => {
        if (replayState.intervalId) {
          clearInterval(replayState.intervalId);
          replayState.isPlaying = false;
        }
        $('#gameReplayModal').classList.remove('open');
      });
    }

    if ($('#btnReplayPrev')) {
      $('#btnReplayPrev').addEventListener('click', () => {
        setReplayEventIndex(replayState.currentIndex - 1);
      });
    }

    if ($('#btnReplayNext')) {
      $('#btnReplayNext').addEventListener('click', () => {
        setReplayEventIndex(replayState.currentIndex + 1);
      });
    }

    if ($('#btnReplayPlayToggle')) {
      $('#btnReplayPlayToggle').addEventListener('click', () => {
        const btn = $('#btnReplayPlayToggle');
        if (replayState.isPlaying) {
          clearInterval(replayState.intervalId);
          replayState.isPlaying = false;
          btn.textContent = '▶ Reproducir';
        } else {
          replayState.isPlaying = true;
          btn.textContent = '⏸ Pausar';
          if (replayState.currentIndex >= replayState.events.length - 1) {
            setReplayEventIndex(0);
          }
          replayState.intervalId = setInterval(() => {
            if (replayState.currentIndex < replayState.events.length - 1) {
              setReplayEventIndex(replayState.currentIndex + 1);
            } else {
              clearInterval(replayState.intervalId);
              replayState.isPlaying = false;
              btn.textContent = '▶ Reproducir';
            }
          }, 2000 / (replayState.speed || 1));
        }
      });
    }

    $$('.btn-speed-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.btn-speed-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        replayState.speed = Number(btn.dataset.speed) || 1;
        if (replayState.isPlaying) {
          clearInterval(replayState.intervalId);
          replayState.intervalId = setInterval(() => {
            if (replayState.currentIndex < replayState.events.length - 1) {
              setReplayEventIndex(replayState.currentIndex + 1);
            } else {
              clearInterval(replayState.intervalId);
              replayState.isPlaying = false;
              $('#btnReplayPlayToggle').textContent = '▶ Reproducir';
            }
          }, 2000 / replayState.speed);
        }
      });
    });

    if ($('#btnResumeActiveGame')) {
      $('#btnResumeActiveGame').addEventListener('click', () => {
        const ag = db.games.find(g => g.status === 'LIVE' || g.status === 'En curso');
        if (ag) initLiveGame(ag.id);
      });
    }

    if ($('#btnLiveNextInning')) {
      $('#btnLiveNextInning').addEventListener('click', advanceToNextInning);
    }

    if ($('#btnLiveCloseGameOver')) {
      $('#btnLiveCloseGameOver').addEventListener('click', () => finishLiveGame(true));
    }

    if ($('#btnLiveChangePitcher')) {
      $('#btnLiveChangePitcher').addEventListener('click', openPitcherChangeModal);
    }

    if ($('#btnConfirmPitcherChange')) {
      $('#btnConfirmPitcherChange').addEventListener('click', confirmPitcherChange);
    }

    if ($('#btnLiveFinishGameEarly')) {
      $('#btnLiveFinishGameEarly').addEventListener('click', () => {
        if (confirm('¿Deseas finalizar este partido inmediatamente y registrar el resultado oficial actual?')) {
          finishLiveGame(true);
        }
      });
    }

    // NAVEGACIÓN GLOBAL POR CLICKS (REGLAS 13 Y 14)
    document.addEventListener('click', e => {
      const pTarget = e.target.closest('[data-player-id]');
      if (pTarget) {
        e.preventDefault();
        e.stopPropagation();
        openPlayerProfile(pTarget.dataset.playerId);
        return;
      }

      const tTarget = e.target.closest('[data-team-id]');
      if (tTarget) {
        e.preventDefault();
        e.stopPropagation();
        openTeamProfile(tTarget.dataset.teamId);
        return;
      }
    });
  }

  // ----------------------------------------------------
  // SINCRONIZACIÓN EN TIEMPO REAL CON FIREBASE
  // ----------------------------------------------------
  function initFirebaseSync() {
    if (typeof firebaseInitialized !== 'undefined' && firebaseInitialized && firestoreDb) {
      updateStorageStatus('🔄 Conectando a Firebase...');
      firestoreDb
        .collection('leagues')
        .doc('main')
        .onSnapshot(
          doc => {
            if (doc.exists) {
              const cloudData = doc.data();
              if (cloudData && typeof cloudData === 'object') {
                const cloudUpdated = Number(cloudData.updatedAt) || 0;
                const localUpdated = Number(db.updatedAt) || 0;
                const cloudGames = Array.isArray(cloudData.games) ? cloudData.games.length : 0;
                const localGames = Array.isArray(db.games) ? db.games.length : 0;

                // Proteger datos locales más recientes de ser sobrescritos por la nube
                if (cloudUpdated < localUpdated && localGames >= cloudGames) {
                  firestoreDb.collection('leagues').doc('main').set(db);
                  updateStorageStatus('🟢 En la nube (Firebase)');
                  return;
                }

                db = {
                  teams: Array.isArray(cloudData.teams) ? cloudData.teams : [],
                  players: Array.isArray(cloudData.players) ? cloudData.players : [],
                  games: Array.isArray(cloudData.games) ? cloudData.games : [],
                  seasons: Array.isArray(cloudData.seasons) ? cloudData.seasons : [],
                  series: Array.isArray(cloudData.series) ? cloudData.series : [],
                  events: Array.isArray(cloudData.events) ? cloudData.events : [],
                  updatedAt: cloudUpdated,
                  settings: cloudData.settings || db.settings || { adminPin: 'admin123', leagueName: 'ROSMIL LEAGUE' }
                };
                db.games.forEach(g => {
                  if (!Array.isArray(g.batLog)) g.batLog = [];
                });
                db.players.forEach(p => {
                  if (!Array.isArray(p.teamHistory)) p.teamHistory = [];
                });
                try {
                  localStorage.setItem(KEY, JSON.stringify(db));
                } catch (e) {}
                recalcStats();
                renderAll();
                updateActiveGameBanner();
                updateStorageStatus('🟢 En la nube (Firebase)');
              }
            } else {
              if (db.teams.length || db.players.length || db.seasons.length || db.games.length) {
                firestoreDb.collection('leagues').doc('main').set(db);
              }
              updateStorageStatus('🟢 Firebase conectado (Nuevo torneo)');
            }
          },
          err => {
            console.error('Error en listener de Firestore:', err);
            updateStorageStatus('🔴 Error conexión Firebase (Modo local)');
          }
        );
    } else {
      updateStorageStatus('🟡 Datos locales (Firebase no configurado)');
    }
  }

  // Kickstart Application
  initEvents();
  recalcStats();
  renderAll();
  updateActiveGameBanner();
  initFirebaseSync();
})();
