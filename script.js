/**
 * ═══════════════════════════════════════════════════════════
 *  DevFlow — Developer Productivity Dashboard
 *  script.js  |  Nafisa Tabassum Nusrat  |  Front-End Web Developer
 *  Fully functional, debugged edition — Georgia typography
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

/* ═══════════════════════════════════════════
   STORAGE HELPERS
═══════════════════════════════════════════ */
const KEYS = {
  theme      : 'devflow_theme',
  tasks      : 'devflow_tasks',
  timerTotal : 'devflow_timer_total',
  timerDate  : 'devflow_timer_date',
  analytics  : 'devflow_analytics',
  streak     : 'devflow_streak',
};

const store = {
  get (key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  },
  set (key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  },
};

/* ─── Demo seed data (used when no real data exists) ─── */
const DEMO_CODING = [3.5, 5.2, 4.8, 6.8, 5.5, 2.1, 4.0];
const DEMO_TASKS  = [4,   7,   5,   9,   6,   3,   5  ];

function getAnalyticsData () {
  return store.get(KEYS.analytics, { coding: [...DEMO_CODING], tasks: [...DEMO_TASKS] });
}

/* ═══════════════════════════════════════════
   TOAST NOTIFICATION
═══════════════════════════════════════════ */
function showToast (msg, type) {
  type = type || 'default';
  var toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.style.borderLeftColor =
    type === 'success' ? 'var(--accent3)' :
    type === 'error'   ? '#ff4c4c'        : 'var(--accent1)';
  toast.classList.add('show');
  clearTimeout(toast._tid);
  toast._tid = setTimeout(function () { toast.classList.remove('show'); }, 2800);
}

/* ═══════════════════════════════════════════
   FORWARD DECLARATIONS (so modules can call each other)
═══════════════════════════════════════════ */
var _analyticsChart = null;
var _prodChart      = null;

/* Called by various modules – defined fully below */
function refreshAnalyticsColors () {}
function refreshProdColors       () {}
function updateProductivityScore () {}
function logCodingHoursToAnalytics () {}
function refreshAnalyticsTaskData  () {}

/* ═══════════════════════════════════════════
   THEME MANAGER
═══════════════════════════════════════════ */
var ThemeManager = (function () {
  var html       = document.documentElement;
  var btn        = document.getElementById('themeToggle');
  var icon       = document.getElementById('themeIcon');
  var settingBtn = document.getElementById('settingThemeBtn');

  function apply (theme) {
    html.setAttribute('data-theme', theme);
    store.set(KEYS.theme, theme);
    if (icon) icon.className = theme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
    requestAnimationFrame(function () {
      refreshAnalyticsColors();
      refreshProdColors();
    });
  }

  function toggle () {
    apply(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    showToast('Theme switched!', 'success');
  }

  function init () {
    apply(store.get(KEYS.theme, 'dark'));
    if (btn)        btn.addEventListener('click', toggle);
    if (settingBtn) settingBtn.addEventListener('click', toggle);
  }

  function current () { return html.getAttribute('data-theme'); }

  return { init: init, toggle: toggle, current: current };
}());

/* ═══════════════════════════════════════════
   SIDEBAR
═══════════════════════════════════════════ */
var SidebarManager = (function () {
  var sidebar   = document.getElementById('sidebar');
  var toggleBtn = document.getElementById('sidebarToggle');
  var navItems  = document.querySelectorAll('.nav-item');

  function init () {
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () { sidebar.classList.toggle('open'); });
    }

    navItems.forEach(function (item) {
      item.addEventListener('click', function (e) {
        navItems.forEach(function (i) { i.classList.remove('active'); });
        item.classList.add('active');
        if (window.innerWidth <= 768) sidebar.classList.remove('open');
        var sectionId = item.dataset.section;
        var el = document.getElementById(sectionId);
        if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      });
    });

    document.addEventListener('click', function (e) {
      if (window.innerWidth <= 768 && sidebar
          && !sidebar.contains(e.target)
          && toggleBtn && !toggleBtn.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }

  return { init: init };
}());

/* ═══════════════════════════════════════════
   CODING TIMER
═══════════════════════════════════════════ */
var TimerManager = (function () {
  var running      = false;
  var startTime    = null;   // Date.now() at last start press
  var sessionMs    = 0;      // accumulated ms before current start
  var totalSeconds = 0;      // today's saved total in whole seconds
  var tickId       = null;

  var btnStart = document.getElementById('btnStart');
  var btnPause = document.getElementById('btnPause');
  var btnReset = document.getElementById('btnReset');
  var display  = document.getElementById('timerDisplay');
  var totalEl  = document.getElementById('timerTotal');
  var summaryEl= document.getElementById('summaryTime');
  var ring     = document.getElementById('timerRing');
  var CIRC     = 552.92;

  function fmt (s) {
    var h   = Math.floor(s / 3600);
    var m   = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    return [h, m, sec].map(function (n) { return String(n).padStart(2, '0'); }).join(':');
  }

  function setRing (totalSec) {
    if (!ring) return;
    var cycle = 25 * 60;
    var pct   = (totalSec % cycle) / cycle;
    ring.style.strokeDashoffset = CIRC * (1 - pct);
  }

  function currentSessionSec () {
    if (!running) return Math.floor(sessionMs / 1000);
    return Math.floor((sessionMs + Date.now() - startTime) / 1000);
  }

  function updateDisplays (sessSec, grandSec) {
    if (display)    display.textContent   = fmt(sessSec);
    if (totalEl)    totalEl.textContent   = fmt(grandSec);
    if (summaryEl)  summaryEl.textContent = fmt(grandSec);
    setRing(grandSec);
    /* sync hero score */
    var ss = document.getElementById('summaryScore');
    var hs = document.getElementById('heroScore');
    if (ss && hs) hs.textContent = ss.textContent;
  }

  function tick () {
    var sessSec  = currentSessionSec();
    var grandSec = totalSeconds + sessSec;
    updateDisplays(sessSec, grandSec);
    if (running) tickId = requestAnimationFrame(tick);
  }

  function loadSavedTotal () {
    var today = new Date().toDateString();
    var saved = store.get(KEYS.timerDate, '');
    if (saved !== today) {
      store.set(KEYS.timerDate, today);
      store.set(KEYS.timerTotal, 0);
      return 0;
    }
    return store.get(KEYS.timerTotal, 0);
  }

  function init () {
    totalSeconds = loadSavedTotal();
    sessionMs    = 0;
    updateDisplays(0, totalSeconds);
    if (btnPause) btnPause.disabled = true;

    /* ── START ── */
    if (btnStart) {
      btnStart.addEventListener('click', function () {
        if (running) return;
        running   = true;
        startTime = Date.now();
        btnStart.disabled = true;
        if (btnPause) btnPause.disabled = false;
        cancelAnimationFrame(tickId);
        tickId = requestAnimationFrame(tick);
        showToast('⏱ Timer started!', 'success');
      });
    }

    /* ── PAUSE ── */
    if (btnPause) {
      btnPause.addEventListener('click', function () {
        if (!running) return;
        running    = false;
        sessionMs += Date.now() - startTime;
        startTime  = null;
        cancelAnimationFrame(tickId);
        if (btnStart) btnStart.disabled = false;
        btnPause.disabled = true;

        /* Commit session into totalSeconds */
        totalSeconds += Math.floor(sessionMs / 1000);
        sessionMs     = 0;
        store.set(KEYS.timerTotal, totalSeconds);
        updateDisplays(0, totalSeconds);

        /* Feed analytics */
        logCodingHoursToAnalytics(totalSeconds / 3600);
        updateProductivityScore();
        showToast('⏸ Timer paused.', 'default');
      });
    }

    /* ── RESET (session only) ── */
    if (btnReset) {
      btnReset.addEventListener('click', function () {
        running   = false;
        sessionMs = 0;
        startTime = null;
        cancelAnimationFrame(tickId);
        if (btnStart) btnStart.disabled = false;
        if (btnPause) btnPause.disabled = true;
        if (display)  display.textContent = '00:00:00';
        if (ring)     ring.style.strokeDashoffset = CIRC;
        showToast('🔄 Session reset.', 'default');
      });
    }

    /* ── FULL RESET from Settings ── */
    var fullReset = document.getElementById('btnResetTimer');
    if (fullReset) {
      fullReset.addEventListener('click', function () {
        running = false; sessionMs = 0; totalSeconds = 0; startTime = null;
        cancelAnimationFrame(tickId);
        store.set(KEYS.timerTotal, 0);
        updateDisplays(0, 0);
        if (ring)     ring.style.strokeDashoffset = CIRC;
        if (btnStart) btnStart.disabled = false;
        if (btnPause) btnPause.disabled = true;
        showToast('⏱ Timer data cleared.', 'success');
      });
    }
  }

  function getTotalHours () {
    return (totalSeconds + currentSessionSec()) / 3600;
  }

  return { init: init, getTotalHours: getTotalHours };
}());

/* ═══════════════════════════════════════════
   TASK MANAGER
═══════════════════════════════════════════ */
var TaskManager = (function () {
  var tasks        = [];
  var editId       = null;
  var activeFilter = 'all';

  var grid      = document.getElementById('taskGrid');
  var form      = document.getElementById('taskForm');
  var btnAdd    = document.getElementById('btnAddTask');
  var btnSave   = document.getElementById('btnSaveTask');
  var btnCancel = document.getElementById('btnCancelTask');
  var inputEl   = document.getElementById('taskInput');
  var priEl     = document.getElementById('taskPriority');
  var tabs      = document.querySelectorAll('.tab-btn');
  var modal     = document.getElementById('editModal');
  var editInput = document.getElementById('editTaskInput');
  var editPri   = document.getElementById('editTaskPriority');
  var btnUpdate = document.getElementById('btnUpdateTask');
  var btnClose  = document.getElementById('btnCloseModal');

  function uid () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function esc  (s) {
    return s.replace(/[&<>"']/g, function (c) {
      return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c];
    });
  }
  function priLabel (p) { return ({ high:'🔴 High', medium:'🟡 Medium', low:'🟢 Low' })[p] || p; }

  function saveToStorage  () { store.set(KEYS.tasks, tasks); }
  function loadFromStorage () { tasks = store.get(KEYS.tasks, []); }

  function filtered () {
    switch (activeFilter) {
      case 'active':    return tasks.filter(function (t) { return !t.completed; });
      case 'completed': return tasks.filter(function (t) { return  t.completed; });
      case 'high':      return tasks.filter(function (t) { return t.priority === 'high'; });
      default:          return tasks;
    }
  }

  function render () {
    if (!grid) return;
    var shown = filtered();
    grid.innerHTML = '';

    if (!shown.length) {
      grid.innerHTML = '<div class="task-empty"><i class="fa-solid fa-inbox"></i>No tasks here yet.</div>';
    } else {
      shown.forEach(function (t) {
        var card = document.createElement('div');
        card.className = 'task-card priority-' + t.priority + (t.completed ? ' completed' : '');
        card.dataset.id = t.id;
        card.innerHTML =
          '<div class="task-card-top">' +
            '<span class="task-title">' + esc(t.title) + '</span>' +
            '<div class="task-actions">' +
              '<button class="task-btn complete-btn" title="' + (t.completed ? 'Undo' : 'Mark complete') + '">' +
                '<i class="fa-solid ' + (t.completed ? 'fa-rotate-left' : 'fa-check') + '"></i>' +
              '</button>' +
              '<button class="task-btn edit-btn" title="Edit task"><i class="fa-solid fa-pen"></i></button>' +
              '<button class="task-btn delete-btn" title="Delete task"><i class="fa-solid fa-trash"></i></button>' +
            '</div>' +
          '</div>' +
          '<div class="task-card-footer">' +
            '<span class="priority-badge ' + t.priority + '">' + priLabel(t.priority) + '</span>' +
            '<span class="task-date">' + new Date(t.created).toLocaleDateString() + '</span>' +
          '</div>';

        (function (tid) {
          card.querySelector('.complete-btn').addEventListener('click', function () { toggleComplete(tid); });
          card.querySelector('.edit-btn').addEventListener('click',     function () { openEdit(tid); });
          card.querySelector('.delete-btn').addEventListener('click',   function () { deleteTask(tid); });
        }(t.id));

        grid.appendChild(card);
      });
    }

    updateSummaryCards();
    updateHeroStats();
    refreshAnalyticsTaskData();
    updateProductivityScore();
  }

  function addTask () {
    if (!inputEl) return;
    var title = inputEl.value.trim();
    if (!title) { showToast('⚠️ Please enter a task title.', 'error'); return; }
    tasks.unshift({
      id: uid(), title: title,
      priority : priEl ? priEl.value : 'medium',
      completed: false,
      created  : Date.now(),
    });
    saveToStorage();
    render();
    inputEl.value = '';
    if (priEl) priEl.value = 'medium';
    if (form)  form.style.display = 'none';
    showToast('✅ Task added!', 'success');
  }

  function toggleComplete (id) {
    var t = tasks.find(function (x) { return x.id === id; });
    if (t) { t.completed = !t.completed; saveToStorage(); render(); }
  }

  function deleteTask (id) {
    tasks = tasks.filter(function (x) { return x.id !== id; });
    saveToStorage();
    render();
    showToast('🗑 Task deleted.', 'default');
  }

  function openEdit (id) {
    var t = tasks.find(function (x) { return x.id === id; });
    if (!t) return;
    editId = id;
    if (editInput) editInput.value = t.title;
    if (editPri)   editPri.value   = t.priority;
    if (modal)     modal.style.display = 'flex';
  }

  function commitEdit () {
    var t = tasks.find(function (x) { return x.id === editId; });
    if (!t) return;
    var title = editInput ? editInput.value.trim() : '';
    if (!title) { showToast('⚠️ Task title cannot be empty.', 'error'); return; }
    t.title    = title;
    t.priority = editPri ? editPri.value : 'medium';
    saveToStorage();
    render();
    if (modal) modal.style.display = 'none';
    editId = null;
    showToast('✏️ Task updated!', 'success');
  }

  function updateSummaryCards () {
    var completed = tasks.filter(function (t) { return t.completed; }).length;
    var active    = tasks.filter(function (t) { return !t.completed; }).length;
    var el = function (id) { return document.getElementById(id); };
    if (el('summaryCompleted')) el('summaryCompleted').textContent = completed;
    if (el('summaryActive'))    el('summaryActive').textContent    = active;
    if (el('psReviews'))        el('psReviews').textContent        = completed;
    if (el('psTasks'))          el('psTasks').textContent          = tasks.length;
  }

  function init () {
    loadFromStorage();
    render();

    if (btnAdd) {
      btnAdd.addEventListener('click', function () {
        if (!form) return;
        var isOpen = form.style.display === 'flex';
        form.style.display = isOpen ? 'none' : 'flex';
        if (!isOpen && inputEl) inputEl.focus();
      });
    }

    if (btnSave)   btnSave.addEventListener('click', addTask);
    if (btnCancel) btnCancel.addEventListener('click', function () {
      if (form) form.style.display = 'none';
      if (inputEl) inputEl.value = '';
    });
    if (inputEl) inputEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') addTask(); });

    if (btnUpdate) btnUpdate.addEventListener('click', commitEdit);
    if (btnClose)  btnClose.addEventListener('click', function () {
      if (modal) modal.style.display = 'none';
      editId = null;
    });
    if (modal) modal.addEventListener('click', function (e) {
      if (e.target === modal) { modal.style.display = 'none'; editId = null; }
    });

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        activeFilter = tab.dataset.filter;
        render();
      });
    });

    var clearBtn = document.getElementById('btnClearTasks');
    if (clearBtn) clearBtn.addEventListener('click', function () {
      tasks = [];
      saveToStorage();
      render();
      showToast('🗑 All tasks cleared.', 'success');
    });
  }

  return {
    init        : init,
    getCompleted: function () { return tasks.filter(function (t) { return t.completed; }).length; },
    getTotal    : function () { return tasks.length; },
  };
}());

/* ═══════════════════════════════════════════
   ANALYTICS LINE CHART  (3 lines + random on refresh)
═══════════════════════════════════════════ */

/* Generate a smooth random 7-point dataset between min and max */
function randomDataset (min, max) {
  var data = [];
  var prev = Math.random() * (max - min) + min;
  for (var i = 0; i < 7; i++) {
    /* nudge prev value by ±30% of range, clamp to [min, max] */
    var delta = (Math.random() - 0.5) * (max - min) * 0.6;
    prev = Math.min(max, Math.max(min, prev + delta));
    data.push(Math.round(prev * 10) / 10);
  }
  return data;
}

function initAnalyticsChart () {
  var canvas = document.getElementById('analyticsChart');
  if (!canvas || typeof Chart === 'undefined') return;

  if (_analyticsChart) { _analyticsChart.destroy(); _analyticsChart = null; }

  var ctx = canvas.getContext('2d');

  function isDark () { return ThemeManager.current() === 'dark'; }

  function makeGrad (hex, alpha1, alpha2) {
    alpha1 = alpha1 || '55';
    alpha2 = alpha2 || '00';
    var g = ctx.createLinearGradient(0, 0, 0, 300);
    g.addColorStop(0, hex + alpha1);
    g.addColorStop(1, hex + alpha2);
    return g;
  }

  function getColors () {
    return isDark()
      ? { grid:'rgba(255,255,255,0.06)', tick:'#7b7b9a', tt:'#1a1a2e', ttText:'#e8e8f0', ttBody:'#7b7b9a' }
      : { grid:'rgba(0,0,0,0.06)',       tick:'#5a5a78', tt:'#ffffff', ttText:'#1a1a2e', ttBody:'#5a5a78' };
  }

  var c = getColors();

  /* Saved real data for today's day slot */
  var saved = getAnalyticsData();

  /* Fresh random sets for the other days — regenerated every page load */
  var codingData    = randomDataset(1.5, 9);
  var tasksDoneData = randomDataset(2, 10);
  var completedData = randomDataset(1, 8);

  /* Slot today's real values in */
  var today = new Date().getDay();
  var idx   = today === 0 ? 6 : today - 1;
  codingData[idx]    = saved.coding[idx]  || codingData[idx];
  tasksDoneData[idx] = saved.tasks[idx]   || tasksDoneData[idx];
  completedData[idx] = TaskManager.getCompleted() || completedData[idx];

  _analyticsChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
      datasets: [
        {
          label               : 'Coding Hours',
          data                : codingData,
          borderColor         : '#b04cff',
          backgroundColor     : makeGrad('#b04cff','44','00'),
          borderWidth         : 2.5,
          pointBackgroundColor: '#b04cff',
          pointBorderColor    : '#fff',
          pointBorderWidth    : 2,
          pointRadius         : 5,
          pointHoverRadius    : 9,
          fill                : true,
          tension             : 0.45,
        },
        {
          label               : 'Tasks Done',
          data                : tasksDoneData,
          borderColor         : '#00e5b0',
          backgroundColor     : makeGrad('#00e5b0','44','00'),
          borderWidth         : 2.5,
          pointBackgroundColor: '#00e5b0',
          pointBorderColor    : '#fff',
          pointBorderWidth    : 2,
          pointRadius         : 5,
          pointHoverRadius    : 9,
          fill                : true,
          tension             : 0.45,
        },
        {
          label               : 'In Progress',
          data                : completedData,
          borderColor         : '#ff9e3d',
          backgroundColor     : makeGrad('#ff9e3d','44','00'),
          borderWidth         : 2.5,
          pointBackgroundColor: '#ff9e3d',
          pointBorderColor    : '#fff',
          pointBorderWidth    : 2,
          pointRadius         : 5,
          pointHoverRadius    : 9,
          fill                : true,
          tension             : 0.45,
        },
      ],
    },
    options: {
      responsive         : true,
      maintainAspectRatio: false,
      interaction        : { intersect: false, mode: 'index' },
      animation          : {
        duration : 1200,
        easing   : 'easeInOutQuart',
        /* stagger each dataset for a wave-like reveal */
        delay    : function (ctx) {
          return ctx.dataIndex * 60 + ctx.datasetIndex * 180;
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor : c.tt,
          borderColor     : isDark() ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
          borderWidth     : 1,
          titleColor      : c.ttText,
          bodyColor       : c.ttBody,
          titleFont       : { family: 'Georgia, "Times New Roman", serif', size: 12, weight: 'bold' },
          bodyFont        : { family: 'Georgia, "Times New Roman", serif', size: 12 },
          padding         : 12,
          cornerRadius    : 10,
          callbacks       : { label: function (ctx) { return '  ' + ctx.dataset.label + ': ' + ctx.parsed.y; } },
        },
      },
      scales: {
        x: {
          grid  : { color: c.grid, drawBorder: false },
          ticks : { color: c.tick, font: { family: 'Georgia, "Times New Roman", serif', size: 11 } },
          border: { display: false },
        },
        y: {
          grid  : { color: c.grid, drawBorder: false },
          ticks : { color: c.tick, font: { family: 'Georgia, "Times New Roman", serif', size: 11 }, padding: 8 },
          border: { display: false },
          beginAtZero: true,
        },
      },
    },
  });

  window.analyticsChartInstance = _analyticsChart;
}

/* Refresh analytics data when tasks change */
refreshAnalyticsTaskData = function () {
  if (!_analyticsChart) return;
  var today = new Date().getDay();
  var idx   = today === 0 ? 6 : today - 1;
  /* Update completed dataset with real task count */
  _analyticsChart.data.datasets[2].data[idx] = TaskManager.getCompleted();
  _analyticsChart.update('none');
};

/* Called from timer pause */
logCodingHoursToAnalytics = function (hours) {
  var data  = getAnalyticsData();
  var today = new Date().getDay();
  var idx   = today === 0 ? 6 : today - 1;
  data.coding[idx] = Math.round(hours * 10) / 10;
  store.set(KEYS.analytics, data);
  if (_analyticsChart) {
    _analyticsChart.data.datasets[0].data[idx] = data.coding[idx];
    _analyticsChart.update('none');
  }
};

/* Called from ThemeManager */
refreshAnalyticsColors = function () {
  if (!_analyticsChart) return;
  var d    = ThemeManager.current() === 'dark';
  var grid = d ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  var tick = d ? '#7b7b9a' : '#5a5a78';
  var tt   = d ? '#1a1a2e' : '#ffffff';
  _analyticsChart.options.scales.x.grid.color  = grid;
  _analyticsChart.options.scales.y.grid.color  = grid;
  _analyticsChart.options.scales.x.ticks.color = tick;
  _analyticsChart.options.scales.y.ticks.color = tick;
  _analyticsChart.options.plugins.tooltip.backgroundColor = tt;
  _analyticsChart.options.plugins.tooltip.titleColor      = d ? '#e8e8f0' : '#1a1a2e';
  _analyticsChart.options.plugins.tooltip.bodyColor       = d ? '#7b7b9a' : '#5a5a78';
  _analyticsChart.update();
};

/* ═══════════════════════════════════════════
   PRODUCTIVITY DOUGHNUT CHART
═══════════════════════════════════════════ */
function initProductivityChart () {
  var canvas = document.getElementById('productivityChart');
  if (!canvas || typeof Chart === 'undefined') return;

  if (_prodChart) { _prodChart.destroy(); _prodChart = null; }

  var ctx = canvas.getContext('2d');

  function makeGrad (c1, c2) {
    var g = ctx.createLinearGradient(0, 0, 260, 260);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    return g;
  }

  _prodChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Coding', 'Tasks', 'Reviews'],
      datasets: [{
        data: [60, 25, 15],
        backgroundColor: [
          makeGrad('#b04cff','#ff4cb0'),
          makeGrad('#00e5b0','#00a87a'),
          makeGrad('#ff9e3d','#ff6b00'),
        ],
        borderWidth : 0,
        hoverOffset : 8,
      }],
    },
    options: {
      responsive : false,
      cutout     : '72%',
      animation  : { animateRotate: true, duration: 1200, easing: 'easeInOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor : ThemeManager.current() === 'dark' ? '#1a1a2e' : '#ffffff',
          borderColor     : 'rgba(255,255,255,0.1)',
          borderWidth     : 1,
          titleFont       : { family: 'Georgia, "Times New Roman", serif', size: 12 },
          bodyFont        : { family: 'Georgia, "Times New Roman", serif', size: 12 },
          callbacks       : { label: function (ctx) { return ' ' + ctx.label + ': ' + ctx.parsed + '%'; } },
        },
      },
    },
  });

  window.productivityChartInstance = _prodChart;
  setProdDisplayValue(60);
}

function setProdDisplayValue (pct) {
  var v  = Math.min(Math.max(Math.round(pct), 0), 100);
  var el = function (id) { return document.getElementById(id); };
  if (el('prodPercent'))  el('prodPercent').textContent  = v + '%';
  if (el('summaryScore')) el('summaryScore').textContent = v + '%';
  if (el('heroScore'))    el('heroScore').textContent    = v + '%';
}

/* Main recalculation — reassigns all forward declarations */
updateProductivityScore = function () {
  if (!_prodChart) return;

  var completed  = TaskManager.getCompleted();
  var total      = TaskManager.getTotal();
  var hours      = TimerManager.getTotalHours();

  var taskScore  = total > 0 ? Math.min((completed / total) * 100, 100) : 0;
  var hoursScore = Math.min((hours / 8) * 100, 100);
  var revScore   = Math.min(completed * 5, 100);

  var cPct    = Math.max(Math.round(hoursScore * 0.5),  5);
  var tPct    = Math.max(Math.round(taskScore  * 0.35), 5);
  var rPct    = Math.max(100 - cPct - tPct,             5);
  var overall = Math.round(hoursScore * 0.4 + taskScore * 0.4 + revScore * 0.2);

  _prodChart.data.datasets[0].data = [cPct, tPct, rPct];
  _prodChart.update('none');
  setProdDisplayValue(Math.min(overall, 99));

  var psCode    = document.getElementById('psCode');
  var psTasks   = document.getElementById('psTasks');
  var psReviews = document.getElementById('psReviews');
  if (psCode)    psCode.textContent    = hours.toFixed(1) + 'h';
  if (psTasks)   psTasks.textContent   = total;
  if (psReviews) psReviews.textContent = completed;
};

refreshProdColors = function () {
  if (!_prodChart) return;
  _prodChart.options.plugins.tooltip.backgroundColor =
    ThemeManager.current() === 'dark' ? '#1a1a2e' : '#ffffff';
  _prodChart.update();
};

/* ═══════════════════════════════════════════
   GITHUB VIEWER
═══════════════════════════════════════════ */
var GitHubViewer = (function () {
  var input   = document.getElementById('githubInput');
  var btn     = document.getElementById('btnFetchGH');
  var result  = document.getElementById('githubResult');
  var errBox  = document.getElementById('githubError');
  var errMsg  = document.getElementById('ghErrorMsg');

  function extractUsername (val) {
    // Remove trailing slashes/spaces
    val = val.trim().replace(/\/+$/, '');
    // If it looks like a URL, grab the last path segment
    if (val.indexOf('github.com') !== -1) {
      var parts = val.split('/');
      // filter out empty strings
      parts = parts.filter(function (p) { return p.length > 0; });
      return parts[parts.length - 1];
    }
    return val;
  }

  function fetchUser () {
    var raw      = input ? input.value.trim() : '';
    if (!raw) { showToast('⚠️ Please enter a GitHub username or URL.', 'error'); return; }
    var username = extractUsername(raw);
    if (!username) { showToast('⚠️ Could not extract username. Enter a valid GitHub username.', 'error'); return; }

    if (btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading…'; btn.disabled = true; }
    if (result) result.style.display = 'none';
    if (errBox) errBox.style.display = 'none';

    Promise.all([
      fetch('https://api.github.com/users/' + encodeURIComponent(username)),
      fetch('https://api.github.com/users/' + encodeURIComponent(username) + '/repos?sort=updated&per_page=5'),
    ]).then(function (responses) {
      var uRes = responses[0];
      var rRes = responses[1];

      if (!uRes.ok) {
        throw new Error(uRes.status === 404 ? 'User not found.' : 'API error ' + uRes.status + '. Try again.');
      }

      return Promise.all([uRes.json(), rRes.ok ? rRes.json() : Promise.resolve([])]);

    }).then(function (data) {
      var user  = data[0];
      var repos = data[1];

      function set     (id, val) { var e = document.getElementById(id); if (e) e.textContent = val; }
      function setHTML (id, val) { var e = document.getElementById(id); if (e) e.innerHTML  = val; }

      var avatar = document.getElementById('ghAvatar');
      if (avatar) avatar.src = user.avatar_url;

      set('ghName', user.name || user.login);
      set('ghBio',  user.bio  || 'No bio provided.');
      setHTML('ghLocation', '<i class="fa-solid fa-location-dot"></i> ' + (user.location || 'Unknown'));
      setHTML('ghBlog', user.blog
        ? '<i class="fa-solid fa-link"></i> <a href="' + user.blog + '" target="_blank" style="color:var(--accent1)">' + user.blog + '</a>'
        : '<i class="fa-solid fa-link"></i> No website');

      set('ghRepos',     user.public_repos);
      set('ghFollowers', user.followers);
      set('ghFollowing', user.following);
      set('ghGists',     user.public_gists);

      var repoList = document.getElementById('ghReposList');
      if (repoList) {
        repoList.innerHTML = '';
        if (!repos.length) {
          repoList.innerHTML = '<p style="color:var(--text-muted);font-size:13px;font-family:Georgia,serif">No public repositories.</p>';
        } else {
          repos.forEach(function (r) {
            var a = document.createElement('a');
            a.className = 'gh-repo-item';
            a.href    = r.html_url;
            a.target  = '_blank';
            a.rel     = 'noopener noreferrer';
            a.innerHTML =
              '<span class="gh-repo-name"><i class="fa-solid fa-book-bookmark"></i> ' + r.name + '</span>' +
              '<div class="gh-repo-stats">' +
                '<span><i class="fa-solid fa-star"></i> ' + r.stargazers_count + '</span>' +
                '<span><i class="fa-solid fa-code-fork"></i> ' + r.forks_count + '</span>' +
                (r.language ? '<span><i class="fa-solid fa-circle" style="font-size:7px"></i> ' + r.language + '</span>' : '') +
              '</div>';
            repoList.appendChild(a);
          });
        }
      }

      if (result) result.style.display = 'block';
      showToast('✅ Loaded @' + username + "'s profile!", 'success');

    }).catch(function (err) {
      if (errMsg) errMsg.textContent = err.message || 'Something went wrong.';
      if (errBox) errBox.style.display = 'flex';
      showToast('❌ ' + (err.message || 'Error fetching data.'), 'error');

    }).finally(function () {
      if (btn) { btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Fetch'; btn.disabled = false; }
    });
  }

  function init () {
    if (btn)   btn.addEventListener('click', fetchUser);
    if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') fetchUser(); });
  }

  return { init: init };
}());

/* ═══════════════════════════════════════════
   SEARCH BAR
═══════════════════════════════════════════ */
var SearchManager = (function () {
  var SECTIONS = [
    { id:'dashboard', kw:['dashboard','home','overview','hero','start']           },
    { id:'coding',    kw:['coding','timer','time','track','pomodoro','clock']     },
    { id:'tasks',     kw:['task','manager','todo','list','add','complete']         },
    { id:'analytics', kw:['analytics','chart','graph','stats','data']             },
    { id:'github',    kw:['github','git','repo','profile','username']             },
    { id:'settings',  kw:['settings','preferences','theme','clear','reset']       },
  ];

  function init () {
    var input = document.querySelector('.search-input');
    if (!input) return;
    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var q = input.value.trim().toLowerCase();
      if (!q) return;
      var match = null;
      for (var i = 0; i < SECTIONS.length; i++) {
        var s = SECTIONS[i];
        for (var j = 0; j < s.kw.length; j++) {
          if (s.kw[j].indexOf(q) !== -1 || q.indexOf(s.kw[j]) !== -1) { match = s; break; }
        }
        if (match) break;
      }
      if (match) {
        var el = document.getElementById(match.id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        input.value = '';
        showToast('🔍 Jumped to "' + match.id + '"', 'success');
      } else {
        showToast('🔍 No matching section found.', 'default');
      }
    });
  }

  return { init: init };
}());

/* ═══════════════════════════════════════════
   HERO STATS
═══════════════════════════════════════════ */
function updateHeroStats () {
  var el = document.getElementById('heroTasks');
  if (el) el.textContent = TaskManager.getCompleted();
}

function updateHeroStreak () {
  var today = new Date().toDateString();
  var saved = store.get(KEYS.streak, { count: 1, lastDay: today });
  if (saved.lastDay !== today) {
    var yest  = new Date(Date.now() - 86400000).toDateString();
    saved.count   = saved.lastDay === yest ? saved.count + 1 : 1;
    saved.lastDay = today;
    store.set(KEYS.streak, saved);
  }
  var el = document.getElementById('heroStreak');
  if (el) el.textContent = saved.count;
}

/* ═══════════════════════════════════════════
   SVG GRADIENT DEF  (timer ring colour)
═══════════════════════════════════════════ */
function injectSVGDefs () {
  document.body.insertAdjacentHTML('afterbegin',
    '<svg width="0" height="0" style="position:absolute;overflow:hidden">' +
    '<defs>' +
    '<linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="100%">' +
    '<stop offset="0%"   style="stop-color:#b04cff"/>' +
    '<stop offset="100%" style="stop-color:#ff4cb0"/>' +
    '</linearGradient>' +
    '</defs></svg>');
}

/* ═══════════════════════════════════════════
   ENTRANCE ANIMATIONS
═══════════════════════════════════════════ */
function initEntranceAnimations () {
  var items = document.querySelectorAll(
    '.summary-card, .timer-card, .productivity-card, .task-section, ' +
    '.analytics-section, .github-section, .settings-section, .hero-section'
  );
  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry, i) {
      if (entry.isIntersecting) {
        (function (el, delay) {
          setTimeout(function () {
            el.style.opacity   = '1';
            el.style.transform = 'translateY(0)';
          }, delay);
        }(entry.target, i * 60));
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });

  items.forEach(function (el) {
    el.style.opacity    = '0';
    el.style.transform  = 'translateY(22px)';
    el.style.transition = 'opacity 0.55s ease, transform 0.55s ease, box-shadow 0.25s, background 0.25s, border-color 0.25s';
    obs.observe(el);
  });
}

/* ═══════════════════════════════════════════
   BOOT
═══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function () {

  /* ── LOADING SCREEN: dismiss after 3 seconds ── */
  var loaderOverlay = document.getElementById('loaderOverlay');
  var loaderBar     = document.getElementById('loaderBar');

  if (loaderBar) {
    /* Animate progress bar from 0 → 100% over 2.8s */
    loaderBar.style.width = '0%';
    setTimeout(function () { loaderBar.style.width = '100%'; }, 60);
  }

  if (loaderOverlay) {
    setTimeout(function () {
      loaderOverlay.classList.add('loader-hide');
      setTimeout(function () {
        loaderOverlay.style.display = 'none';
      }, 600);
    }, 3000);
  }

  injectSVGDefs();

  /* 1. Theme first — all other modules read current theme */
  ThemeManager.init();
  SidebarManager.init();

  /* 2. Charts before TaskManager (TaskManager.render() calls chart refresh) */
  initAnalyticsChart();
  initProductivityChart();

  /* 3. Data modules */
  TimerManager.init();
  TaskManager.init();

  /* 4. Utility features */
  GitHubViewer.init();
  SearchManager.init();

  /* 5. Hero stats */
  updateHeroStats();
  updateHeroStreak();

  /* 6. Initial productivity score */
  updateProductivityScore();

  /* 7. Entrance animations */
  setTimeout(initEntranceAnimations, 80);

  /* 8. Periodic sync */
  setInterval(updateProductivityScore, 5000);

  console.log(
    '%c DevFlow %c Designed & Developed by Nafisa Tabassum Nusrat ',
    'background:#b04cff;color:#fff;font-family:Georgia,serif;font-size:13px;padding:4px 8px;border-radius:4px 0 0 4px',
    'background:#1a1a2e;color:#aaa;font-family:Georgia,serif;font-size:13px;padding:4px 8px;border-radius:0 4px 4px 0'
  );
});
