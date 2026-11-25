// TradeX: floating favourites toolbar for drawing tools (TradingView-style).
// Star a tool in the left drawing toolbar's flyout and it appears on a small floating bar over the chart.
// Click a button to arm that tool (click again to disarm). Drag the grip to move the bar; double-click the grip to
// switch between horizontal and vertical. Stars and bar position are kept in localStorage, so they survive a reload.
(function () {
  const FAV_KEY = "tradexDrawFavs", POS_KEY = "tradexFavBar";
  const DEFAULT_FAVS = [
    "datepricerange",
    "trendline",
    "box",
    "parallelchannel",
    "position",
    "ray",
    "text",
    "freehand",
    "fibretracement",
    "path",
    "hline",
    "fibcircles"
  ];

  const BUILTIN_TOOLS = {
    datepricerange: {
      label: "Measure / Date & Price Range",
      icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="6" width="16" height="12" rx="1.5"/><path d="M4 18 20 6" opacity="0.6"/><path d="M8 6v3M12 6v2M16 6v3"/></svg>'
    },
    trendline: {
      label: "Trend Line",
      icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="19" x2="20" y2="5"/><circle cx="4" cy="19" r="1.5" fill="currentColor"/><circle cx="20" cy="5" r="1.5" fill="currentColor"/></svg>'
    },
    box: {
      label: "Rectangle",
      icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="6" width="16" height="12" rx="1.5"/><circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="20" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/><circle cx="20" cy="18" r="1.5" fill="currentColor"/></svg>'
    },
    parallelchannel: {
      label: "Parallel Channel",
      icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="16" x2="21" y2="8"/><line x1="3" y1="21" x2="21" y2="13"/><line x1="3" y1="11" x2="21" y2="3" stroke-dasharray="2 2"/></svg>'
    },
    longposition: {
      label: "Long Position",
      icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4.5" width="16" height="7.5" rx="1" fill="#00bcd4" fill-opacity="0.35"/><rect x="4" y="12" width="16" height="7.5" rx="1" fill="#ff5722" fill-opacity="0.25"/><line x1="4" y1="12" x2="20" y2="12"/><path d="M12 16V8m-2.5 2.5L12 8l2.5 2.5"/></svg>'
    },
    shortposition: {
      label: "Short Position",
      icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4.5" width="16" height="7.5" rx="1" fill="#ff5722" fill-opacity="0.25"/><rect x="4" y="12" width="16" height="7.5" rx="1" fill="#00bcd4" fill-opacity="0.35"/><line x1="4" y1="12" x2="20" y2="12"/><path d="M12 8v8m-2.5-2.5L12 16l2.5-2.5"/></svg>'
    },
    position: {
      label: "Long / Short Position",
      icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4.5" width="16" height="7.5" rx="1" fill="#00bcd4" fill-opacity="0.35"/><rect x="4" y="12" width="16" height="7.5" rx="1" fill="#ff5722" fill-opacity="0.25"/><line x1="4" y1="12" x2="20" y2="12"/><path d="M12 16V8m-2.5 2.5L12 8l2.5 2.5"/></svg>'
    },
    ray: {
      label: "Ray",
      icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="19" x2="21" y2="6"/><circle cx="4" cy="19" r="1.6" fill="currentColor"/></svg>'
    },
    text: {
      label: "Text",
      icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6h14M12 6v13"/></svg>'
    },
    freehand: {
      label: "Brush",
      icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 12 17 4.5a2.12 2.12 0 0 1 3 3L12.5 15"/><path d="M7 14a3 3 0 0 0-3 3c0 1.3-1.2 1.3-2 2"/></svg>'
    },
    fibretracement: {
      label: "Fib Retracement",
      icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="5" x2="21" y2="5"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="3" y1="20" x2="21" y2="20"/><line x1="3" y1="20" x2="21" y2="5" stroke-dasharray="2 2" opacity="0.6"/></svg>'
    },
    path: {
      label: "Path",
      icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19 9 11 13 14 17 8 20 4"/><path d="M17.2 5.5 20 4 19.4 7.1"/></svg>'
    },
    hline: {
      label: "Horizontal Line",
      icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/></svg>'
    },
    fibcircles: {
      label: "Fib Circles",
      icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="10"/></svg>'
    }
  };

  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (_) { return d; } };
  const keep = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };

  const css = document.createElement("style");
  css.textContent = `
  .tx-favbar { position:absolute; z-index:29; display:flex; align-items:center; gap:3px; padding:4px 6px; border-radius:9px;
    background:var(--panel, #1b1a17); border:1px solid var(--line, #2f2c27); box-shadow:0 8px 24px rgba(0,0,0,.6);
    user-select:none; touch-action:none }
  .tx-favbar.tx-vert { flex-direction:column }
  .tx-favbar[hidden] { display:none!important }
  .tx-grip { width:14px; height:32px; cursor:grab; display:flex; align-items:center; justify-content:center; color:var(--faint, #5e584f) }
  .tx-vert .tx-grip { width:32px; height:14px }
  .tx-grip:active { cursor:grabbing }
  .tx-fav { width:32px; height:32px; border:0; border-radius:5px; background:transparent; color:var(--dim, #958c7e);
    display:flex; align-items:center; justify-content:center; cursor:pointer; padding:0; transition:background .12s, color .12s }
  .tx-fav:hover { background:var(--raised, #24221e); color:var(--text, #e6dfd2) }
  .tx-fav.on { background:var(--raised, #24221e); color:#2962ff; font-weight:600 }
  .tx-fav svg { width:20px; height:20px; display:block }`;
  document.head.appendChild(css);

  let ws = null, bar = null, favs = [], active = null, restored = false, pos = load(POS_KEY, null);

  function toolInfo() {
    const m = { ...BUILTIN_TOOLS };
    const groups = (ws && ws.drawToolbar && ws.drawToolbar.def && ws.drawToolbar.def.groups) || (ws && ws.toolbarDef && ws.toolbarDef.groups) || [];
    for (const g of groups) {
      for (const t of (g.tools || [])) {
        m[t.type] = { label: typeof t.label === "string" ? t.label : (t.label ? String(t.label) : t.type), icon: t.icon || (m[t.type] ? m[t.type].icon : "") };
      }
      for (const s of (g.sections || [])) {
        for (const t of (s.tools || [])) {
          m[t.type] = { label: typeof t.label === "string" ? t.label : (t.label ? String(t.label) : t.type), icon: t.icon || (m[t.type] ? m[t.type].icon : "") };
        }
      }
    }
    return m;
  }
  const activeDrawings = () => (ws.active || ws).chart.drawings;

  function place() {
    if (!bar || bar.hidden) return;
    const host = bar.parentElement || document.body, W = host.clientWidth, H = host.clientHeight;
    const w = bar.offsetWidth || 380, h = bar.offsetHeight || 36;
    // Default spot: centered near the top
    let x = pos ? pos.x : Math.round((W - w) / 2), y = pos ? pos.y : 48;
    x = Math.max(4, Math.min(x, W - w - 4)); y = Math.max(4, Math.min(y, H - h - 4));
    bar.style.left = x + "px"; bar.style.top = y + "px";
  }

  function render() {
    if (!bar) return;
    const info = toolInfo();
    const list = favs.length ? favs.filter((t) => info[t]) : DEFAULT_FAVS;
    bar.querySelectorAll(".tx-fav").forEach((b) => b.remove());
    for (const t of list) {
      const item = info[t] || BUILTIN_TOOLS[t];
      if (!item) continue;
      const b = document.createElement("button");
      b.className = "tx-fav" + (t === active ? " on" : ""); b.dataset.tool = t;
      b.title = item.label; b.setAttribute("aria-label", item.label); b.setAttribute("aria-pressed", t === active ? "true" : "false");
      b.innerHTML = item.icon;
      b.draggable = true;
      b.addEventListener("dragstart", (ev) => {
        b.dataset.dragging = "1";
        b.style.opacity = "0.4";
        try { ev.dataTransfer.effectAllowed = "move"; ev.dataTransfer.setData("text/plain", t); } catch (_) {}
      });
      b.addEventListener("dragend", () => {
        delete b.dataset.dragging;
        b.style.opacity = "";
      });
      b.addEventListener("dragover", (ev) => {
        ev.preventDefault();
        try { ev.dataTransfer.dropEffect = "move"; } catch (_) {}
      });
      b.addEventListener("drop", (ev) => {
        ev.preventDefault();
        let src = null;
        try { src = ev.dataTransfer.getData("text/plain"); } catch (_) {}
        if (!src) {
          const draggingEl = bar.querySelector('.tx-fav[data-dragging="1"]');
          src = draggingEl && draggingEl.dataset.tool;
        }
        if (!src || src === t) return;
        const cur = (favs.length ? [...favs] : [...DEFAULT_FAVS]);
        const fromIdx = cur.indexOf(src);
        const toIdx = cur.indexOf(t);
        if (fromIdx === -1 || toIdx === -1) return;
        cur.splice(fromIdx, 1);
        cur.splice(toIdx, 0, src);
        favs = cur;
        keep(FAV_KEY, favs);
        try {
          const d = activeDrawings();
          if (d && d.setFavorites) d.setFavorites(favs);
        } catch (_) {}
        render();
      });
      b.onclick = () => {
        const d = activeDrawings();
        if (d) {
          d.setTool(d.getTool() === t ? null : t);
          if (ws.refocusActive) try { ws.refocusActive(); } catch (_) {}
        }
      };
      bar.appendChild(b);
    }
    bar.hidden = false;
    place();
  }

  function normalizeFavs(arr) {
    const out = [];
    for (const x of (arr || [])) {
      const k = (x === "longposition" || x === "shortposition") ? "position" : x;
      if (k && !out.includes(k)) out.push(k);
    }
    return out;
  }

  function onFavorites(list) {
    favs = (list && list.length) ? normalizeFavs(list) : [...DEFAULT_FAVS];
    if (restored) keep(FAV_KEY, favs);
    render();
  }
  function onActive(type) {
    active = type || null;
    if (bar) bar.querySelectorAll(".tx-fav").forEach((b) => { const on = b.dataset.tool === active; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
  }

  function makeBar(host) {
    bar = document.createElement("div");
    bar.className = "tx-favbar" + (pos && pos.vert ? " tx-vert" : ""); bar.hidden = false;
    bar.setAttribute("role", "toolbar"); bar.setAttribute("aria-label", "Favourite drawing tools");
    const grip = document.createElement("div");
    grip.className = "tx-grip"; grip.title = "Drag to move. Double-click to rotate.";
    grip.innerHTML = '<svg width="6" height="14" viewBox="0 0 6 14" fill="currentColor"><circle cx="1.5" cy="2" r="1.2"/><circle cx="4.5" cy="2" r="1.2"/><circle cx="1.5" cy="7" r="1.2"/><circle cx="4.5" cy="7" r="1.2"/><circle cx="1.5" cy="12" r="1.2"/><circle cx="4.5" cy="12" r="1.2"/></svg>';
    bar.appendChild(grip);
    for (const ev of ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "dblclick", "wheel", "contextmenu", "touchstart"])
      bar.addEventListener(ev, (e) => e.stopPropagation());
    grip.addEventListener("pointerdown", (e) => {
      e.preventDefault(); grip.setPointerCapture(e.pointerId);
      const sx = e.clientX - bar.offsetLeft, sy = e.clientY - bar.offsetTop;
      const move = (m) => { pos = { x: m.clientX - sx, y: m.clientY - sy, vert: bar.classList.contains("tx-vert") }; place(); };
      const up = () => { grip.removeEventListener("pointermove", move); grip.removeEventListener("pointerup", up); if (pos) keep(POS_KEY, pos); };
      grip.addEventListener("pointermove", move); grip.addEventListener("pointerup", up);
    });
    grip.addEventListener("dblclick", () => {
      bar.classList.toggle("tx-vert");
      pos = { x: bar.offsetLeft, y: bar.offsetTop, vert: bar.classList.contains("tx-vert") }; keep(POS_KEY, pos); place();
    });
    host.appendChild(bar);
  }

  function mount(workspace, host) {
    ws = workspace; restored = false; active = null;
    if (bar) bar.remove();
    makeBar(host);
    const tb = ws.drawToolbar;
    if (tb && !tb.txHooked) {
      tb.txHooked = true;
      const sf = tb.setFavorites.bind(tb), sa = tb.setActiveTool.bind(tb);
      tb.setFavorites = (list) => { sf(list); if (ws && ws.drawToolbar === tb) onFavorites(list); };
      tb.setActiveTool = (t) => { sa(t); if (ws && ws.drawToolbar === tb) onActive(t); };
    }
    const saved = load(FAV_KEY, null);
    favs = saved && saved.length ? saved : [...DEFAULT_FAVS];
    render();

    let tries = 0;
    const restore = () => {
      if (ws !== workspace) return;
      const d = ws.chart && ws.chart.drawings;
      if (d && d.supported) {
        restored = true;
        if (favs.length && d.setFavorites) d.setFavorites(favs);
        render();
      } else if (tries++ < 100) setTimeout(restore, 100);
      else restored = true;
    };
    restore();
  }

  window.addEventListener("resize", place);
  window.TradeXFavBar = { mount, state: () => ({ favs: [...favs], active, hidden: !bar || bar.hidden, pos }) };
})();
