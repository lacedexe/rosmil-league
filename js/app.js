/**
 * ROSMIL LEAGUE — Interactive Baseball Platform Engine
 * Manages teams, rosters, seasons, series, games, and the core BAT LOG / iSCORE scoring system.
 * All individual stats are calculated dynamically from plate appearances (PA).
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
    events: []
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

  // Ensure state arrays exist
  if (!Array.isArray(db.teams)) db.teams = [];
  if (!Array.isArray(db.players)) db.players = [];
  if (!Array.isArray(db.games)) db.games = [];
  if (!Array.isArray(db.seasons)) db.seasons = [];
  if (!Array.isArray(db.series)) db.series = [];
  if (!Array.isArray(db.events)) db.events = [];

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
    ['Double', 'Doble'],
    ['Triple', 'Triple'],
    ['Home Run', 'Home Run'],
    ['Walk', 'Base por bolas (BB)'],
    ['HBP', 'Golpeado por lanzamiento (HBP)'],
    ['Strikeout Swinging', 'Ponche tirándole (SO)'],
    ['Strikeout Looking', 'Ponche cantado (SO)'],
    ['Groundout', 'Rodado / out'],
    ['Flyout', 'Elevado / out'],
    ['Lineout', 'Línea / out'],
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

  // Storage Status Indicator
  function updateStorageStatus(msg) {
    const el = $('#storageStatus');
    if (el) el.textContent = msg;
  }

  // State Persistence & Re-render
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch (e) {
      console.error('Error guardando en localStorage:', e);
      alert('Aviso: Almacenamiento local lleno o restringido.');
    }
    renderAll();

    // Firebase Cloud Sync
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

  // Utilities
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
    return p?.role === 'pitcher' || p?.role === 'two-way' || p?.isPitcher === true;
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

  // Baseball Metric Computations
  function batterStats(pid, sourcePAs) {
    const rows = sourcePAs.filter(x => x.batter === pid);
    const s = {
      PA: rows.length,
      AB: 0,
      R: 0,
      H: 0,
      TB: 0,
      HR: 0,
      RBI: 0,
      BB: 0,
      HBP: 0,
      SO: 0,
      SB: 0,
      SF: 0
    };

    rows.forEach(pa => {
      const r = pa.result;
      if (AB_RESULTS.has(r)) s.AB++;
      if (HIT_RESULTS.has(r)) {
        s.H++;
        s.TB += r === 'Single' ? 1 : r === 'Double' ? 2 : r === 'Triple' ? 3 : 4;
        if (r === 'Home Run') s.HR++;
      }
      if (r === 'Walk') s.BB++;
      if (r === 'HBP') s.HBP++;
      if (r === 'Strikeout Swinging' || r === 'Strikeout Looking') s.SO++;
      if (r === 'Sac Fly') s.SF++;
      s.R += Number(pa.runs) || 0;
      s.RBI += Number(pa.rbi) || 0;
      s.SB += Number(pa.sb) || 0;
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
      H: 0,
      ER: 0,
      BB: 0,
      HBP: 0,
      SO: 0,
      HR: 0
    };

    rows.forEach(pa => {
      const r = pa.result;
      outs += Number(pa.outs) || 0;
      if (HIT_RESULTS.has(r)) {
        s.H++;
        if (r === 'Home Run') s.HR++;
      }
      if (r === 'Walk') s.BB++;
      if (r === 'HBP') s.HBP++;
      if (r === 'Strikeout Swinging' || r === 'Strikeout Looking') s.SO++;
      s.ER += Number(pa.earnedRuns) || 0;
    });

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

  // Navigation
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
      season: 'Temporada',
      standings: 'Posiciones',
      games: 'Juegos',
      teams: 'Equipos',
      players: 'Jugadores',
      stats: 'Estadísticas',
      leaders: 'Líderes',
      history: 'Historial',
      admin: 'Administración'
    };
    $('#pageTitle').textContent = names[view] || view;
    renderAll();
  }

  // Modal Handling
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

  // Select Population
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

  // Modal Preparations
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
      if (p.photo) {
        $('#playerPreview').src = p.photo;
        $('#playerPreview').style.display = 'block';
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

    const selected = new Set(
      t?.players || db.players.filter(p => p.team === tid).map(p => p.id)
    );
    $('#teamRoster').innerHTML = db.players.length
      ? db.players
          .map(
            p =>
              `<label><input type="checkbox" name="rosterPlayer" value="${p.id}" ${
                selected.has(p.id) ? 'checked' : ''
              }>${
                p.photo ? `<img class="avatar" src="${p.photo}" alt="">` : ''
              }<span>${esc(p.name)} <small class="muted">#${esc(p.number)}</small></span></label>`
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

  // Playoff Series Calculator
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

  function remove(type, key, view) {
    if (!confirm('¿Estás seguro de que deseas eliminar este registro?')) return;
    if (type === 'games') {
      db.games = db.games.filter(x => x.id !== key);
      updateSeriesFromGames();
      recalcStats();
    } else {
      db[type] = db[type].filter(x => x.id !== key);
    }
    save();
    show(view);
  }

  // Renderers
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
              <th>Jugadores</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${db.teams
              .map(
                t => `
              <tr>
                <td>${t.logo ? `<img class="teamlogo" src="${t.logo}" alt="">` : ''}<b>${esc(t.name)}</b></td>
                <td>${esc(t.city || '—')}</td>
                <td>${esc(t.manager || '—')}</td>
                <td>${db.players.filter(p => p.team === t.id).length}</td>
                <td class="actions">
                  <button class="btn" data-edit-team="${t.id}">Editar</button>
                  <button class="btn danger" data-del-team="${t.id}">Eliminar</button>
                </td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`;

    $$('[data-del-team]').forEach(b => (b.onclick = () => remove('teams', b.dataset.delTeam, 'teams')));
    $$('[data-edit-team]').forEach(
      b =>
        (b.onclick = () => {
          openModal('teamModal');
          prepareTeamModal(b.dataset.editTeam);
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
              <th>Jugador</th>
              <th>#</th>
              <th>Equipo</th>
              <th>Rol</th>
              <th>Posición</th>
              <th>Picheos</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${db.players
              .map(
                p => `
              <tr>
                <td>${p.photo ? `<img class="avatar" src="${p.photo}" alt="">` : ''}<b>${esc(p.name)}</b></td>
                <td>${esc(p.number || '—')}</td>
                <td>${esc(teamName(p.team))}</td>
                <td>${p.role === 'two-way' ? 'Lanzador + bateador' : isPitcher(p) ? 'Lanzador' : 'Bateador'}</td>
                <td>${esc(p.position || '—')}</td>
                <td>${isPitcher(p) ? (p.pitchTypes || []).length : '—'}</td>
                <td class="actions">
                  <button class="btn" data-edit-player="${p.id}">Editar</button>
                  <button class="btn danger" data-del-player="${p.id}">Eliminar</button>
                </td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`;

    $$('[data-del-player]').forEach(b => (b.onclick = () => remove('players', b.dataset.delPlayer, 'players')));
    $$('[data-edit-player]').forEach(
      b =>
        (b.onclick = () => {
          openModal('playerModal');
          preparePlayerModal(b.dataset.editPlayer);
        })
    );
  }

  function gameStatus(g) {
    return (g.batLog || []).length ? 'BAT LOG completo' : 'BAT LOG pendiente';
  }

  function gameHTML(g) {
    const sr = g.series ? getSeries(g.series) : null;
    const paCount = (g.batLog || []).length;
    return `
      <div class="gamecard">
        <div class="head">
          <span class="muted">${esc(g.date)} ${esc(g.time)} • ${esc(seasonName(g.season))}</span>
          <span class="pill">${sr ? `Serie: ${esc(teamName(sr.teamA))} vs ${esc(teamName(sr.teamB))}` : 'Juego de liga'}</span>
        </div>
        <div class="teamscore">
          <b>${esc(teamName(g.away))}</b>
          <div class="score">${g.awayScore} — ${g.homeScore}</div>
          <b>${esc(teamName(g.home))}</b>
        </div>
        <div class="muted" style="text-align:center;margin-top:8px">
          Juego ${esc(g.gameNumber || '—')} ${g.stadium ? '• ' + esc(g.stadium) : ''}
        </div>
        <div class="head" style="margin-top:12px">
          <span class="tag">${gameStatus(g)}</span>
          <span class="muted">${paCount} apariciones al plato</span>
        </div>
        <div class="actions" style="margin-top:11px">
          <button class="btn red" data-score-game="${g.id}">BAT LOG / iSCORE</button>
          <button class="btn" data-edit-game="${g.id}">Editar</button>
          <button class="btn danger" data-del-game="${g.id}">Eliminar</button>
        </div>
      </div>`;
  }

  function renderGames() {
    const el = $('#gamesList');
    el.innerHTML = db.games.length
      ? db.games.slice().reverse().map(gameHTML).join('')
      : empty('No hay juegos', 'Registra el primer partido y asígnalo a una temporada.');

    $$('[data-del-game]').forEach(b => (b.onclick = () => remove('games', b.dataset.delGame, 'games')));
    $$('[data-edit-game]').forEach(
      b =>
        (b.onclick = () => {
          openModal('gameModal');
          prepareGameModal(b.dataset.editGame);
        })
    );
    $$('[data-score-game]').forEach(b => (b.onclick = () => openScorebook(b.dataset.scoreGame)));
  }

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
                      <b>${esc(teamName(sr.teamA))} vs ${esc(teamName(sr.teamB))}</b>
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
            <b>${esc(s.name)}</b>
            <div class="muted">${s.type === 'league' ? 'Liga' : 'Eliminatoria'} • ${esc(s.start || '')} ${
      s.end ? '→ ' + esc(s.end) : ''
    }</div>
          </div>
          <div class="actions">
            <span class="tag">${
              s.type === 'league' ? `${esc(s.gamesCount || 0)} juegos` : `Mejor de ${esc(s.bestOf)}`
            }</span>
            <button class="btn" data-edit-season="${s.id}">Editar</button>
            ${s.type === 'elimination' ? `<button class="btn red" data-new-series="${s.id}">+ Serie</button>` : ''}
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
          openModal('seasonModal');
          prepareSeasonModal(b.dataset.editSeason);
        })
    );
    $$('[data-new-series]').forEach(
      b =>
        (b.onclick = () => {
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
        const gs = db.games.filter(g => g.home === t.id || g.away === t.id);
        let w = 0,
          l = 0;
        gs.forEach(g => {
          const own = g.home === t.id ? g.homeScore : g.awayScore;
          const opp = g.home === t.id ? g.awayScore : g.homeScore;
          if (Number(own) > Number(opp)) w++;
          else if (Number(own) < Number(opp)) l++;
        });
        const pct = w + l ? w / (w + l) : 0;
        return { ...t, w, l, pct };
      })
      .sort((a, b) => b.pct - a.pct || b.w - a.w);

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
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (t, i) => `
              <tr>
                <td>${i + 1}</td>
                <td><b>${esc(t.name)}</b></td>
                <td>${t.w}</td>
                <td>${t.l}</td>
                <td>${t.pct.toFixed(3).replace('0.', '.')}</td>
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
          <h3 style="margin:0">Bateo y picheo</h3>
          <div class="muted">El marcador por sí solo no suma estadísticas. Solo cuentan las apariciones del BAT LOG / iSCORE.</div>
        </div>
        <button class="btn blue" data-open-face>⚔ Cara a cara</button>
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
              <th>H</th>
              <th>BB</th>
              <th>SO</th>
              <th>ERA</th>
              <th>WHIP</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                ({ p, s, ps }) => `
              <tr>
                <td><b>${esc(p.name)}</b></td>
                <td>${esc(teamName(p.team))}</td>
                <td>${s.PA}</td>
                <td>${s.AB}</td>
                <td>${s.R}</td>
                <td>${s.H}</td>
                <td>${s.HR}</td>
                <td>${s.RBI}</td>
                <td>${s.BB}</td>
                <td>${s.SO}</td>
                <td>${s.SB}</td>
                <td>${fmtAvg(s.AVG)}</td>
                <td>${fmtAvg(s.OBP)}</td>
                <td>${fmtAvg(s.OPS)}</td>
                <td>${ps.IP}</td>
                <td>${ps.H}</td>
                <td>${ps.BB}</td>
                <td>${ps.SO}</td>
                <td>${ps.ERA.toFixed(2)}</td>
                <td>${ps.WHIP.toFixed(2)}</td>
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

  function renderLeaders() {
    const el = $('#leadersArea');
    if (!db.players.length) {
      el.innerHTML = empty('Sin líderes', 'Registra jugadores y BAT LOG.');
      return;
    }
    const source = allPAs();
    const hitters = db.players
      .map(p => ({ p, s: batterStats(p.id, source) }))
      .filter(x => x.s.PA > 0)
      .sort((a, b) => b.s.AVG - a.s.AVG)
      .slice(0, 10);

    el.innerHTML = hitters.length
      ? '<h3>Bateo — AVG</h3>' +
        hitters
          .map(
            (x, i) => `
          <div class="gamecard">
            <div class="head">
              <div>
                <b>${i + 1}. ${esc(x.p.name)}</b>
                <div class="muted">${esc(teamName(x.p.team))}</div>
              </div>
              <strong>${fmtAvg(x.s.AVG)}</strong>
            </div>
            <div class="muted" style="margin-top:7px">
              ${x.s.H} H • ${x.s.HR} HR • ${x.s.RBI} RBI • ${x.s.SO} SO
            </div>
          </div>`
          )
          .join('')
      : empty('Sin líderes', 'Aún no hay BAT LOG registrados.');
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
            <b>${esc(e.type)}</b>
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

  function renderAll() {
    populateSelects();
    recalcStats();
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
    renderHistory();
    renderHomeGames();
  }

  // Roster Filter Helpers
  function teamPlayers(teamId, onlyBatter = false, onlyPitcher = false) {
    return db.players.filter(
      p => p.team === teamId && (!onlyBatter || isBatter(p)) && (!onlyPitcher || isPitcher(p))
    );
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

  // BAT LOG / iSCORE
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
              <b>${esc(x.p.name)}</b>
              <div class="subtle">PA ${x.s.PA} • AB ${x.s.AB}</div>
            </div>
            <strong>${fmtAvg(x.s.AVG)}</strong>
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
              <b>${esc(x.p.name)}</b>
              <div class="subtle">BF ${x.s.BF}</div>
            </div>
            <strong>ERA ${x.s.ERA.toFixed(2)}</strong>
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
          <b>${esc(playerName(pa.batter))}</b>
          <div class="subtle">${esc(teamName(pa.half === 'away' ? g.away : g.home))}</div>
        </div>
        <div><b>${esc(playerName(pa.pitcher))}</b></div>
        <div>
          <span class="resultPill">${esc(resultLabel(pa.result))}</span>${
          pa.pitchType ? ` <span class="tag">${esc(pa.pitchType)}</span>` : ''
        }
        </div>
        <div>${Number(pa.outs) || 0} out</div>
        <div class="actions">
          <button class="btn" data-edit-pa="${pa.id}">Editar</button>
          <button class="btn danger" data-del-pa="${pa.id}">×</button>
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
          <div class="eyebrow">BAT LOG / iSCORE</div>
          <h2 style="margin:0">${esc(teamName(g.away))} ${g.awayScore} — ${g.homeScore} ${esc(
      teamName(g.home)
    )}</h2>
          <div class="muted">${esc(seasonName(g.season))} • Juego ${esc(g.gameNumber || '—')} • ${esc(
      g.date
    )}</div>
        </div>
        <div class="actions">
          <button class="btn red" data-add-pa="${g.id}">+ Registrar PA</button>
          <button class="btn blue" data-open-face>⚔ Cara a cara</button>
          <button class="btn" data-close-score>Volver a juegos</button>
        </div>
      </div>
      <div class="notice good" style="margin-top:14px">
        ${
          log.length
            ? `Este juego ya tiene ${log.length} apariciones registradas; esas apariciones alimentan las estadísticas.`
            : 'Este juego todavía no tiene BAT LOG. El resultado <b>no</b> modifica las estadísticas hasta que registres las apariciones.'
        }
      </div>
      <div class="statgrid">
        <div class="statbox"><small>PA registradas</small><b>${log.length}</b></div>
        <div class="statbox"><small>Hits visitante</small><b>${awayHits}</b></div>
        <div class="statbox"><small>Hits local</small><b>${homeHits}</b></div>
        <div class="statbox"><small>SO pitchers visitante</small><b>${psAway.reduce(
          (n, x) => n + x.s.SO,
          0
        )}</b></div>
        <div class="statbox"><small>SO pitchers local</small><b>${psHome.reduce(
          (n, x) => n + x.s.SO,
          0
        )}</b></div>
        <div class="statbox"><small>Registros completos</small><b>${log.length ? 'Sí' : 'No'}</b></div>
      </div>
      <div class="scorebook">
        <div class="panel">
          <div class="head">
            <h2>Libro de apariciones</h2>
            <span class="muted">Cada PA une bateador + pitcher</span>
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
              : empty('BAT LOG vacío', 'Pulsa “+ Registrar PA” para comenzar el juego.')
          }
        </div>
        <div>
          <div class="panel">
            <h2>Visitante — bateadores</h2>
            ${renderGamePlayerMini(bsAway)}
          </div>
          <div class="panel">
            <h2>Local — bateadores</h2>
            ${renderGamePlayerMini(bsHome)}
          </div>
          <div class="panel">
            <h2>Pitchers</h2>
            ${renderPitcherMini(psAway.concat(psHome))}
          </div>
        </div>
      </div>`;

    $$('[data-add-pa]').forEach(b => (b.onclick = () => openPAModal(g.id)));
    $$('[data-edit-pa]').forEach(b => (b.onclick = () => openPAModal(g.id, b.dataset.editPa)));
    $$('[data-del-pa]').forEach(b => (b.onclick = () => deletePA(g.id, b.dataset.delPa)));
    $$('[data-close-score]').forEach(b => (b.onclick = () => closeModals()));
    $$('[data-open-face]').forEach(b => (b.onclick = () => openFaceoff()));
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

  function deletePA(gid, paid) {
    const g = getGame(gid);
    if (!g) return;
    if (confirm('¿Eliminar esta aparición al plato?')) {
      g.batLog = (g.batLog || []).filter(x => x.id !== paid);
      recalcStats();
      $('#scoreModal').classList.add('open');
      renderScorebook(g);
      save();
    }
  }

  // Batter vs Pitcher Face-off
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
              <h3>${esc(bp?.name || 'Bateador')}</h3>
              <div class="subtle">${esc(teamName(bp?.team))} • Bateador</div>
            </div>
          </div>
          <div class="metricrow">
            <div class="metric"><b>${bs.PA}</b><small>PA</small></div>
            <div class="metric"><b>${bs.AB}</b><small>AB</small></div>
            <div class="metric"><b>${bs.H}</b><small>H</small></div>
            <div class="metric"><b>${fmtAvg(bs.AVG)}</b><small>AVG</small></div>
          </div>
        </div>
        <div class="playercard">
          <div class="playerhead">
            ${pp?.photo ? `<img src="${pp.photo}" alt="">` : ''}
            <div>
              <h3>${esc(pp?.name || 'Lanzador')}</h3>
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
          <div class="statbox"><small>Ponches al bateador</small><b>${bs.SO}</b></div>
          <div class="statbox"><small>Hits</small><b>${bs.H}</b></div>
          <div class="statbox"><small>Promedio</small><b>${fmtAvg(bs.AVG)}</b></div>
          <div class="statbox"><small>HR</small><b>${bs.HR}</b></div>
          <div class="statbox"><small>BB</small><b>${bs.BB}</b></div>
          <div class="statbox"><small>K%</small><b>${fmtPct(bs.KPct * 100)}</b></div>
        </div>
      </div>
      <div class="panel">
        <h2>Historial de enfrentamientos</h2>
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
            : empty(
                'Sin enfrentamientos',
                'Registra BAT LOG con estos dos jugadores para crear su historial cara a cara.'
              )
        }
      </div>`;
  }

  // Event Listeners Initialization
  function initEvents() {
    // Nav view switcher
    $$('nav button').forEach(b => b.addEventListener('click', () => show(b.dataset.view)));
    $$('[data-go]').forEach(b => b.addEventListener('click', () => show(b.dataset.go)));

    // Modal openers & closers
    $$('[data-modal]').forEach(b => b.addEventListener('click', () => openModal(b.dataset.modal)));
    $$('.close').forEach(b => b.addEventListener('click', closeModals));
    $$('.modal').forEach(m =>
      m.addEventListener('click', e => {
        if (e.target === m) closeModals();
      })
    );

    // Form select dependencies
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

    // Team Form Submit
    $('#teamForm').addEventListener('submit', e => {
      e.preventDefault();
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
        db.players.forEach(p => {
          if (roster.includes(p.id)) p.team = tid;
          else if (p.team === tid) p.team = '';
        });
        closeModals();
        save();
        show('teams');
      };
      readImage(f.get('logoFile'), finish);
    });

    // Player Form Submit
    $('#playerForm').addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const pid = f.get('id') || id();
      let p = db.players.find(x => x.id === pid);
      const role = f.get('role');

      const finish = photo => {
        if (!p) {
          p = { id: pid };
          db.players.push(p);
        }
        Object.assign(p, {
          name: f.get('name'),
          number: f.get('number'),
          team: f.get('team'),
          role,
          position: f.get('position'),
          bats: f.get('bats'),
          throws: f.get('throws'),
          age: f.get('age'),
          height: f.get('height'),
          weight: f.get('weight'),
          isPitcher: role === 'pitcher' || role === 'two-way',
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

    // Season Form Submit
    $('#seasonForm').addEventListener('submit', e => {
      e.preventDefault();
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

    // Series Form Submit
    $('#seriesForm').addEventListener('submit', e => {
      e.preventDefault();
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

    // Game Form Submit
    $('#gameForm').addEventListener('submit', e => {
      e.preventDefault();
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

    // PA Form Submit
    $('#paForm').addEventListener('submit', e => {
      e.preventDefault();
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

    // Clear Data Button in Admin View
    const clearBtn = $('#clearData');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        const confirmed = confirm(
          '¿Estás seguro de que deseas borrar TODOS los datos de la liga? Esta acción no se puede deshacer.'
        );
        if (confirmed) {
          localStorage.removeItem(KEY);
          db = { teams: [], players: [], games: [], seasons: [], series: [], events: [] };
          if (typeof firebaseInitialized !== 'undefined' && firebaseInitialized && firestoreDb) {
            firestoreDb.collection('leagues').doc('main').set(db);
          }
          recalcStats();
          renderAll();
          alert('Todos los datos han sido borrados con éxito.');
          show('home');
        }
      });
    }
  }

  // Legacy Migration
  try {
    if (!localStorage.getItem(KEY)) {
      const oldRaw =
        localStorage.getItem('rosmilLeagueDataV3') || localStorage.getItem('rosmilLeagueDataV2');
      if (oldRaw) {
        const o = JSON.parse(oldRaw);
        db.teams = o.teams || [];
        db.players = o.players || [];
        db.games = o.games || [];
        db.seasons = o.seasons || [];
        db.series = o.series || [];
        db.events = o.events || [];
        db.games.forEach(g => (g.batLog = Array.isArray(g.batLog) ? g.batLog : []));
        db.teams.forEach(t => {
          t.players = t.players || db.players.filter(p => p.team === t.id).map(p => p.id);
        });
        db.players.forEach(p => {
          p.role =
            p.role ||
            (p.isPitcher && p.isBatter ? 'two-way' : p.isPitcher ? 'pitcher' : 'batter');
          p.isPitcher = !!p.isPitcher;
          p.isBatter = p.isBatter !== false;
          p.pitchTypes = p.pitchTypes || [];
        });
        localStorage.setItem(KEY, JSON.stringify(db));
      }
    }
  } catch (e) {
    console.error('Error durante la migración de datos heredados:', e);
  }

  // Real-time Cloud Synchronization
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
                db = {
                  teams: Array.isArray(cloudData.teams) ? cloudData.teams : [],
                  players: Array.isArray(cloudData.players) ? cloudData.players : [],
                  games: Array.isArray(cloudData.games) ? cloudData.games : [],
                  seasons: Array.isArray(cloudData.seasons) ? cloudData.seasons : [],
                  series: Array.isArray(cloudData.series) ? cloudData.series : [],
                  events: Array.isArray(cloudData.events) ? cloudData.events : []
                };
                db.games.forEach(g => {
                  if (!Array.isArray(g.batLog)) g.batLog = [];
                });
                try {
                  localStorage.setItem(KEY, JSON.stringify(db));
                } catch (e) {}
                recalcStats();
                renderAll();
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
  initFirebaseSync();
})();
