(function () {
  if (!/\/(?:app\/)?agenda\/?$/.test(location.pathname)) {
    var btn = document.getElementById('fullscreen');
    if (btn && !btn._patched) {
      btn._patched = true;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (window.AgendaFullscreen) {
          if (window.AgendaFullscreen.isFullscreen && window.AgendaFullscreen.isFullscreen()) {
            window.AgendaFullscreen.exit();
          } else {
            window.AgendaFullscreen.enter();
          }
        }
        return false;
      });
    }
    return;
  }

  if (window.__ANGULISMO_TV_AGENDA__) return;
  window.__ANGULISMO_TV_AGENDA__ = true;

  var DATA_URL = 'https://raw.githubusercontent.com/tadeoallende/repos-web/refs/heads/main/datos.json';
  var TRANSMISSION_BASE = 'https://angulismotv.pages.dev/transmision/';
  var LIVE_WINDOW = 2 * 60 * 60 * 1000;
  var channelsMap = new Map();
  var allEvents = [];

  document.title = 'Agenda TV - AngulismoTV';
  document.documentElement.style.background = '#080b19';
  document.body.className = '';
  document.body.innerHTML =
    '<main id="tvAgenda">' +
      '<header class="tv-top">' +
        '<div class="tv-title-wrap">' +
          '<div class="tv-kicker">ANGULISMO TV</div>' +
          '<h1>AGENDA</h1>' +
          '<div id="tvDate" class="tv-date"></div>' +
        '</div>' +
        '<div class="tv-help"><span>▲▼</span> Navegar <span>OK</span> Abrir <span>◀</span> Menú</div>' +
      '</header>' +
      '<section id="tvContent" class="tv-content">' +
        '<div class="tv-loading"><div class="tv-spinner"></div><div>Cargando agenda...</div></div>' +
      '</section>' +
    '</main>';

  var style = document.createElement('style');
  style.textContent = [
    '*{box-sizing:border-box}',
    'html,body{margin:0!important;padding:0!important;width:100%;min-height:100%;overflow-x:hidden;background:#080b19!important;color:#f5f7ff!important;font-family:Inter,system-ui,-apple-system,sans-serif}',
    'body{font-size:20px}',
    '#tvAgenda{width:100%;min-height:100vh;padding:30px 42px 60px;background:radial-gradient(circle at 82% 10%,rgba(70,215,255,.12),transparent 34%),radial-gradient(circle at 18% 55%,rgba(143,85,255,.10),transparent 32%),linear-gradient(180deg,#0a0e22 0%,#070916 100%)}',
    '.tv-top{position:sticky;top:0;z-index:50;display:flex;align-items:flex-end;justify-content:space-between;gap:32px;padding:4px 4px 22px;margin-bottom:16px;background:linear-gradient(180deg,rgba(10,14,34,.98) 0%,rgba(10,14,34,.94) 78%,rgba(10,14,34,0) 100%)}',
    '.tv-kicker{font-size:13px;font-weight:800;letter-spacing:.22em;color:#7ce8ff;margin-bottom:2px}',
    'h1{margin:0;font-size:42px;line-height:1;font-weight:850;letter-spacing:.04em}',
    '.tv-date{margin-top:8px;font-size:16px;color:#aeb8d9;font-weight:600;text-transform:capitalize}',
    '.tv-help{display:flex;align-items:center;gap:10px;color:#91a0c9;font-size:14px;font-weight:650;white-space:nowrap;padding-bottom:4px}',
    '.tv-help span{display:inline-flex;min-width:31px;height:27px;padding:0 8px;align-items:center;justify-content:center;border:1px solid rgba(124,232,255,.4);border-radius:7px;background:rgba(124,232,255,.08);color:#dff9ff;font-size:13px}',
    '.tv-content{max-width:1500px;margin:0 auto}',
    '.tv-day{margin:28px 6px 12px;color:#7ce8ff;font-size:16px;font-weight:800;letter-spacing:.11em;text-transform:uppercase}',
    '.tv-event-wrap{margin:0 0 12px}',
    '.tv-event{width:100%;min-height:94px;display:grid;grid-template-columns:112px 68px minmax(0,1fr) auto;align-items:center;gap:19px;padding:14px 22px;border:2px solid rgba(132,150,205,.16);border-radius:18px;background:linear-gradient(110deg,rgba(23,29,62,.93),rgba(15,20,46,.93));color:#fff;text-align:left;outline:none;box-shadow:0 8px 22px rgba(0,0,0,.18);transition:transform .13s ease,border-color .13s ease,box-shadow .13s ease,background .13s ease}',
    '.tv-event:focus,.tv-channel:focus,.tv-retry:focus{border-color:#7ce8ff!important;box-shadow:0 0 0 4px rgba(124,232,255,.20),0 13px 32px rgba(0,0,0,.32);transform:scale(1.012);background:linear-gradient(110deg,rgba(48,55,102,.98),rgba(30,37,79,.98));z-index:4}',
    '.tv-event[aria-expanded="true"]{border-color:rgba(178,108,255,.52);border-bottom-left-radius:10px;border-bottom-right-radius:10px}',
    '.tv-time{font-size:27px;font-weight:850;letter-spacing:.02em;color:#f9fbff}',
    '.tv-logo-box{width:58px;height:58px;border-radius:13px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.95);overflow:hidden}',
    '.tv-logo{max-width:50px;max-height:50px;object-fit:contain}',
    '.tv-logo-fallback{font-size:25px;color:#5e6b91}',
    '.tv-main{min-width:0}',
    '.tv-name{font-size:21px;font-weight:760;line-height:1.22;white-space:normal;overflow:hidden;text-overflow:ellipsis}',
    '.tv-comp{margin-top:7px;font-size:14px;color:#9aa8cf;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.tv-tail{display:flex;align-items:center;gap:14px}',
    '.tv-status{display:inline-flex;align-items:center;justify-content:center;min-width:92px;height:34px;padding:0 12px;border-radius:999px;font-size:12px;font-weight:850;letter-spacing:.08em}',
    '.tv-status.live{color:#08150f;background:#52f19d;box-shadow:0 0 20px rgba(82,241,157,.26)}',
    '.tv-status.upcoming{color:#dff9ff;background:rgba(67,205,241,.15);border:1px solid rgba(124,232,255,.28)}',
    '.tv-chevron{font-size:24px;color:#7ce8ff;transition:transform .14s ease}',
    '.tv-event[aria-expanded="true"] .tv-chevron{transform:rotate(90deg)}',
    '.tv-channels{display:none;margin:0 12px;padding:13px 14px 15px;border:1px solid rgba(178,108,255,.26);border-top:none;border-radius:0 0 17px 17px;background:rgba(13,17,39,.96)}',
    '.tv-channels.open{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}',
    '.tv-channel{min-height:58px;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:10px 16px;border:2px solid rgba(128,145,198,.14);border-radius:13px;background:rgba(33,40,78,.8);color:#f6f8ff;text-decoration:none;outline:none;font-size:16px;font-weight:720;transition:all .12s ease}',
    '.tv-channel small{font-size:12px;font-weight:700;color:#7ce8ff;letter-spacing:.06em}',
    '.tv-channel-arrow{font-size:19px;color:#7ce8ff}',
    '.tv-empty-channel{grid-column:1/-1;color:#8f9bc0;padding:13px 16px}',
    '.tv-loading,.tv-error,.tv-empty{min-height:390px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;color:#aeb8d9;text-align:center}',
    '.tv-spinner{width:48px;height:48px;border:4px solid rgba(124,232,255,.15);border-top-color:#7ce8ff;border-radius:50%;animation:spin .8s linear infinite}',
    '@keyframes spin{to{transform:rotate(360deg)}}',
    '.tv-retry{min-width:190px;height:56px;border:2px solid rgba(124,232,255,.32);border-radius:14px;background:#202a55;color:white;font-size:16px;font-weight:800;outline:none}',
    '@media(max-width:1100px){#tvAgenda{padding:22px 28px 46px}.tv-event{grid-template-columns:94px 58px minmax(0,1fr) auto;min-height:86px;padding:12px 17px;gap:14px}.tv-time{font-size:23px}.tv-name{font-size:18px}.tv-logo-box{width:50px;height:50px}.tv-logo{max-width:43px;max-height:43px}.tv-channels.open{grid-template-columns:1fr}h1{font-size:36px}}'
  ].join('');
  document.head.appendChild(style);

  var dateEl = document.getElementById('tvDate');
  var now = new Date();
  dateEl.textContent = now.toLocaleDateString('es-AR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function parseART(value) {
    if (!value || typeof value !== 'string') return null;
    var parts = value.trim().split(/\s+/);
    if (parts.length < 2) return null;
    var d = parts[0].split('-').map(Number);
    var t = parts[1].split(':').map(Number);
    if (d.length < 3 || t.length < 2) return null;
    var year, month, day;
    if (d[0] > 1000) { year=d[0]; month=d[1]; day=d[2]; }
    else { day=d[0]; month=d[1]; year=d[2] < 1000 ? d[2]+2000 : d[2]; }
    var utc = Date.UTC(year, month-1, day, (t[0]||0)+3, t[1]||0, t[2]||0);
    var out = new Date(utc);
    return isNaN(out.getTime()) ? null : out;
  }

  function statusFor(start) {
    if (!start) return 'upcoming';
    var diff = Date.now() - start.getTime();
    if (diff >= 0 && diff <= LIVE_WINDOW) return 'live';
    if (diff > LIVE_WINDOW) return 'past';
    return 'upcoming';
  }

  function timeText(start) {
    if (!start) return '--:--';
    try {
      return new Intl.DateTimeFormat('es-AR', {hour:'2-digit',minute:'2-digit',hour12:false}).format(start);
    } catch(e) {
      return String(start.getHours()).padStart(2,'0') + ':' + String(start.getMinutes()).padStart(2,'0');
    }
  }

  function dayKey(start) {
    if (!start) return 'Sin fecha';
    return start.toLocaleDateString('es-AR', {weekday:'long',day:'2-digit',month:'long'});
  }

  function buildChannelMap(channels) {
    channelsMap.clear();
    (Array.isArray(channels) ? channels : []).forEach(function (c) {
      if (c && c.name) channelsMap.set(String(c.name).toLowerCase().trim(), c);
    });
  }

  function channelEntries(event) {
    var result = [];
    var list = Array.isArray(event.canales) ? event.canales : (Array.isArray(event.tv_networks) ? event.tv_networks : []);
    list.forEach(function (raw, index) {
      var name = '';
      var href = '';
      if (typeof raw === 'string') {
        var ref = channelsMap.get(raw.toLowerCase().trim());
        name = ref && ref.name ? ref.name : raw;
        href = TRANSMISSION_BASE + '?c=' + encodeURIComponent(name) + '&o=0';
      } else if (raw && typeof raw === 'object') {
        name = raw.name || ('Canal ' + (index + 1));
        if (raw.url) {
          href = raw.url;
        } else {
          href = TRANSMISSION_BASE + '?e=' + encodeURIComponent(event.id) + '&c=' + encodeURIComponent(name) + '&o=0';
        }
      }
      if (name && href) result.push({name:name,href:href});
    });
    return result;
  }

  function eventMarkup(event) {
    var start = event.__start;
    var status = statusFor(start);
    var logo = event.logoUrl || event.logo || '';
    var channels = channelEntries(event);
    var logoMarkup = logo
      ? '<img class="tv-logo" src="' + escapeHtml(logo) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'block\'"><span class="tv-logo-fallback" style="display:none">●</span>'
      : '<span class="tv-logo-fallback">●</span>';
    var channelMarkup = channels.length
      ? channels.map(function (c) {
          return '<a class="tv-channel tv-focus" tabindex="0" href="' + escapeHtml(c.href) + '">' +
            '<span>' + escapeHtml(c.name) + '</span><span class="tv-channel-arrow">›</span></a>';
        }).join('')
      : '<div class="tv-empty-channel">Sin canales disponibles para este evento.</div>';
    return '<div class="tv-event-wrap" data-event-id="' + escapeHtml(event.id) + '">' +
      '<button class="tv-event tv-focus" tabindex="0" type="button" aria-expanded="false">' +
        '<div class="tv-time">' + escapeHtml(timeText(start)) + '</div>' +
        '<div class="tv-logo-box">' + logoMarkup + '</div>' +
        '<div class="tv-main"><div class="tv-name">' + escapeHtml(event.evento || 'Evento deportivo') + '</div>' +
          '<div class="tv-comp">' + escapeHtml(event.competencia || event.competition_name || '') + '</div></div>' +
        '<div class="tv-tail"><span class="tv-status ' + status + '">' + (status === 'live' ? 'EN VIVO' : 'PRÓXIMO') + '</span><span class="tv-chevron">›</span></div>' +
      '</button>' +
      '<div class="tv-channels">' + channelMarkup + '</div>' +
    '</div>';
  }

  function render() {
    var content = document.getElementById('tvContent');
    var visible = allEvents.filter(function (e) {
      return e.__start && (Date.now() - e.__start.getTime() <= LIVE_WINDOW);
    }).sort(function (a,b) { return a.__start - b.__start; });

    if (!visible.length) {
      content.innerHTML = '<div class="tv-empty"><div>No hay eventos próximos en la agenda.</div></div>';
      return;
    }

    var html = '';
    var currentDay = '';
    visible.forEach(function (event) {
      var key = dayKey(event.__start);
      if (key !== currentDay) {
        currentDay = key;
        html += '<div class="tv-day">' + escapeHtml(key) + '</div>';
      }
      html += eventMarkup(event);
    });
    content.innerHTML = html;
    bindEvents();

    var firstLive = content.querySelector('.tv-status.live');
    var initial = firstLive ? firstLive.closest('.tv-event-wrap').querySelector('.tv-event') : content.querySelector('.tv-event');
    if (initial) setTimeout(function(){ initial.focus(); initial.scrollIntoView({block:'center'}); }, 80);
  }

  function toggleEvent(button, openOnly) {
    var wrap = button.closest('.tv-event-wrap');
    var pane = wrap.querySelector('.tv-channels');
    var open = button.getAttribute('aria-expanded') === 'true';
    var next = openOnly ? true : !open;

    document.querySelectorAll('.tv-event[aria-expanded="true"]').forEach(function (other) {
      if (other !== button) {
        other.setAttribute('aria-expanded','false');
        var p = other.closest('.tv-event-wrap').querySelector('.tv-channels');
        if (p) p.classList.remove('open');
      }
    });

    button.setAttribute('aria-expanded', next ? 'true' : 'false');
    pane.classList.toggle('open', next);
    setTimeout(function(){ button.scrollIntoView({block:'center',behavior:'smooth'}); }, 20);
  }

  function visibleFocusables() {
    return Array.prototype.slice.call(document.querySelectorAll('.tv-focus')).filter(function (el) {
      return el.offsetParent !== null && !el.disabled;
    });
  }

  function focusRelative(delta) {
    var list = visibleFocusables();
    if (!list.length) return;
    var idx = list.indexOf(document.activeElement);
    if (idx < 0) idx = 0;
    var next = Math.max(0, Math.min(list.length - 1, idx + delta));
    list[next].focus();
  }

  function bindEvents() {
    document.querySelectorAll('.tv-event').forEach(function (button) {
      button.addEventListener('click', function(){ toggleEvent(button, false); });
    });
    document.querySelectorAll('.tv-focus').forEach(function (el) {
      el.addEventListener('focus', function(){
        setTimeout(function(){ el.scrollIntoView({block:'center',behavior:'smooth'}); }, 25);
      });
    });
  }

  document.addEventListener('keydown', function (e) {
    var key = e.key;
    var active = document.activeElement;
    if (key === 'ArrowDown') {
      e.preventDefault(); focusRelative(1); return;
    }
    if (key === 'ArrowUp') {
      e.preventDefault(); focusRelative(-1); return;
    }
    if (key === 'ArrowLeft') {
      e.preventDefault();
      if (active && active.classList && active.classList.contains('tv-channel')) {
        var header = active.closest('.tv-event-wrap').querySelector('.tv-event');
        if (header) header.focus();
      } else {
        location.href = 'angulismo://focus-menu';
      }
      return;
    }
    if (key === 'ArrowRight' && active && active.classList && active.classList.contains('tv-event')) {
      e.preventDefault();
      toggleEvent(active, true);
      var first = active.closest('.tv-event-wrap').querySelector('.tv-channel');
      if (first) setTimeout(function(){ first.focus(); }, 40);
      return;
    }
    if ((key === 'Enter' || key === ' ') && active && active.classList && active.classList.contains('tv-event')) {
      e.preventDefault();
      toggleEvent(active, false);
      return;
    }
    if (key === 'Escape' || key === 'Backspace' || e.keyCode === 4) {
      var expanded = document.querySelector('.tv-event[aria-expanded="true"]');
      if (expanded) {
        e.preventDefault();
        toggleEvent(expanded, false);
        expanded.focus();
      }
    }
  }, true);

  function load() {
    fetch(DATA_URL, {cache:'no-store',mode:'cors'})
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        buildChannelMap(data && data.channels);
        allEvents = (data && Array.isArray(data.events) ? data.events : []).map(function (e) {
          var copy = Object.assign({}, e);
          copy.__start = parseART(e.fecha || e.start_time || e.date);
          return copy;
        });
        render();
      })
      .catch(function () {
        var content = document.getElementById('tvContent');
        content.innerHTML = '<div class="tv-error"><div>No se pudo cargar la agenda.</div><button id="tvRetry" class="tv-retry tv-focus" tabindex="0">REINTENTAR</button></div>';
        var retry = document.getElementById('tvRetry');
        retry.addEventListener('click', load);
        retry.focus();
      });
  }

  load();
})();
