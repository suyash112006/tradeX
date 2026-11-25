// TradeX: Drawing Properties Floating Toolbar Enhancements (.vela-dpop).
// 1. Removes all hover tooltip tags/bubbles from drawing tools.
// 2. Implements the Template button (⊞+) with guaranteed popup menu.
// 3. Connects backend persistence (/api/templates) and synced drawing state.
(function () {
  const TPL_KEY = "tradex_tool_templates";
  let memTemplates = null;

  function normalizeTemplates(data) {
    if (!data || typeof data !== "object") return {};
    const res = {};
    for (const [tool, list] of Object.entries(data)) {
      if (Array.isArray(list)) {
        res[tool] = list;
      } else if (list && typeof list === "object") {
        res[tool] = Object.entries(list).map(([name, settings]) => ({ name, settings }));
      } else {
        res[tool] = [];
      }
    }
    return res;
  }

  const loadTemplates = () => {
    if (memTemplates) return memTemplates;
    try {
      const parsed = JSON.parse(localStorage.getItem(TPL_KEY) || "{}");
      memTemplates = normalizeTemplates(parsed);
    } catch (_) {
      memTemplates = {};
    }
    return memTemplates;
  };

  function syncWithVelaDrawings(tpls) {
    try {
      const ws = window.ws;
      if (!ws) return;
      if (ws.chart && ws.chart.drawings && ws.chart.drawings.setToolTemplates) {
        ws.chart.drawings.setToolTemplates(tpls);
      }
      if (ws.cells) {
        ws.cells().forEach((c) => {
          if (c && c.chart && c.chart.drawings && c.chart.drawings.setToolTemplates) {
            c.chart.drawings.setToolTemplates(tpls);
          }
        });
      }
    } catch (_) {}
  }

  const saveTemplates = (tpls) => {
    memTemplates = normalizeTemplates(tpls);
    try { localStorage.setItem(TPL_KEY, JSON.stringify(memTemplates)); } catch (_) {}
    try {
      fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(memTemplates),
        keepalive: true
      }).catch(() => {});
    } catch (_) {}
    syncWithVelaDrawings(memTemplates);
  };

  function fetchBackendTemplates() {
    try {
      fetch("/api/templates")
        .then((r) => r.json())
        .then((data) => {
          if (data && typeof data === "object" && !data.error) {
            const local = loadTemplates();
            const normalizedBackend = normalizeTemplates(data);
            const merged = Object.assign({}, local, normalizedBackend);
            memTemplates = merged;
            try { localStorage.setItem(TPL_KEY, JSON.stringify(merged)); } catch (_) {}
            syncWithVelaDrawings(merged);
          }
        })
        .catch(() => {});
    } catch (_) {}
  }
  fetchBackendTemplates();

  function getSettingsColor(s) {
    if (!s) return "#2962ff";
    if (s.style && s.style.lineColor) return s.style.lineColor;
    if (s.style && s.style.fillColor) return s.style.fillColor;
    if (s.profitColor) return s.profitColor;
    if (s.lossColor) return s.lossColor;
    if (s.text && s.text.color) return s.text.color;
    return "#2962ff";
  }

  // Cached context captured by hooking popup
  let capturedPopup = null;
  let capturedDrawing = null;
  let capturedActions = null;

  function hookPopup(popup) {
    if (!popup || popup.__tradexHooked) return;
    popup.__tradexHooked = true;
    popup.showTip = function () {}; // Never show hover tooltip tags
    const origOpen = popup.open.bind(popup);
    popup.open = function (drawings, anchor, actions, cb) {
      capturedPopup = this;
      capturedDrawing = Array.isArray(drawings) ? drawings[0] : drawings;
      capturedActions = actions;
      const res = origOpen(drawings, anchor, actions, cb);
      if (this.el) injectEnhancements(this.el);
      return res;
    };
  }

  // Active drawing finder
  function getActiveDrawing() {
    if (capturedDrawing) {
      return { drawing: capturedDrawing, actions: capturedActions, popup: capturedPopup };
    }
    try {
      const ws = window.ws;
      if (!ws) return null;
      const chart = ws.chart || (ws.active && ws.active.chart);
      if (!chart) return null;

      // 1. Check userDrawings on renderer
      const r = chart.renderer;
      if (r && r.userDrawings) {
        const ud = r.userDrawings;
        if (ud.popup && ud.popup.current) {
          return { drawing: ud.popup.current.drawing, actions: ud.popup.current.actions, popup: ud.popup };
        }
        if (ud.selectedIds && ud.selectedIds.size > 0) {
          const id = Array.from(ud.selectedIds)[0];
          const d = (ud.drawings || []).find((x) => x.id === id);
          if (d) return { drawing: d, actions: null, popup: ud.popup };
        }
      }

      // 2. Check chart.drawings port
      if (chart.drawings) {
        const port = chart.drawings.port || (chart.drawings.ctrl && chart.drawings.ctrl.port);
        if (port) {
          if (port.popup && port.popup.current) {
            return { drawing: port.popup.current.drawing, actions: port.popup.current.actions, popup: port.popup };
          }
          if (port.selectedIds && port.selectedIds.size > 0) {
            const id = Array.from(port.selectedIds)[0];
            const d = (port.drawings || []).find((x) => x.id === id);
            if (d) return { drawing: d, actions: null, popup: port.popup };
          }
        }
        if (chart.drawings.all) {
          const all = chart.drawings.all();
          if (all.length > 0) return { drawing: all[all.length - 1], actions: null, popup: null };
        }
      }
    } catch (_) {}
    return null;
  }

  // Active open subwindow reference
  let currentOpenSubwin = null;

  function closeTemplateSubwindow() {
    if (currentOpenSubwin) {
      currentOpenSubwin.remove();
      currentOpenSubwin = null;
    }
    document.removeEventListener("pointerdown", onOutsidePointerDown, true);
  }

  function onOutsidePointerDown(e) {
    if (!currentOpenSubwin) return;
    if (currentOpenSubwin.contains(e.target)) return;
    const tplBtn = document.querySelector(".tradex-template-btn");
    if (tplBtn && tplBtn.contains(e.target)) return;
    closeTemplateSubwindow();
  }

  // Open the Template Subwindow guaranteed
  function openTemplateSubwindow(triggerBtn) {
    // Toggle: if already open, close it
    if (currentOpenSubwin) {
      closeTemplateSubwindow();
      return;
    }

    const ctx = getActiveDrawing();
    const drawing = (ctx && ctx.drawing) || { type: "trendline", style: {} };
    const actions = (ctx && ctx.actions) || {};
    const type = drawing.type || "trendline";

    const allTemplates = loadTemplates();
    const savedList = (allTemplates[type] && allTemplates[type].length) ? allTemplates[type] : (allTemplates["_generic"] || []);

    const subwin = document.createElement("div");
    subwin.className = "vela-dsp-menu tradex-template-subwin";
    subwin.setAttribute("role", "menu");
    subwin.style.cssText = `
      position: fixed !important;
      z-index: 999999 !important;
      background: #141414 !important;
      border: 1px solid #282828 !important;
      border-radius: 8px !important;
      box-shadow: 0 12px 36px rgba(0,0,0,0.85), 0 2px 8px rgba(0,0,0,0.5) !important;
      color: #d4d4d4 !important;
      font: 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      min-width: 200px !important;
      max-width: 260px !important;
      max-height: 360px !important;
      padding: 5px !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 2px !important;
      user-select: none !important;
      box-sizing: border-box !important;
      pointer-events: auto !important;
    `;

    // Prevent any click inside the subwindow from closing it or propagating to the chart
    subwin.addEventListener("pointerdown", (e) => e.stopPropagation());
    subwin.addEventListener("click", (e) => e.stopPropagation());

    const renderItems = () => {
      subwin.replaceChildren();

      const createItem = (item, isCustom) => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "vela-dsp-mi";
        row.setAttribute("role", "menuitem");
        row.style.cssText = `
          all: unset;
          box-sizing: border-box;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 6px 0 8px;
          height: 30px;
          border-radius: 5px;
          color: #cccccc;
          font-size: 12px;
          transition: background 0.1s ease, color 0.1s ease;
          width: 100%;
        `;

        row.onpointerenter = () => {
          row.style.background = "rgba(255, 255, 255, 0.08)";
          row.style.color = "#ffffff";
        };
        row.onpointerleave = () => {
          row.style.background = "";
          row.style.color = "#cccccc";
        };

        const dot = document.createElement("span");
        dot.className = "vela-dsp-mi-dot";
        dot.style.cssText = `
          width: 12px;
          height: 12px;
          border-radius: 3px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          flex-shrink: 0;
          background: ${getSettingsColor(item.settings)};
        `;

        const title = document.createElement("span");
        title.className = "vela-dsp-mi-t";
        title.textContent = item.label || item.name;
        title.style.cssText = "flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;";

        row.append(dot, title);

        if (isCustom) {
          const updBtn = document.createElement("span");
          updBtn.className = "vela-dsp-mi-s";
          updBtn.setAttribute("role", "button");
          updBtn.setAttribute("aria-label", `Update ${item.name}`);
          updBtn.title = "Save current changes to this template";
          updBtn.innerHTML = '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12.5 14H3.5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h7l3 3v8a1 1 0 0 1-1 1z"/><path d="M10.5 14v-4h-5v4M5.5 2v3h4"/></svg>';
          updBtn.style.cssText = "width:20px;height:20px;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#666;flex-shrink:0;transition:background 0.1s, color 0.1s;";
          updBtn.onmouseenter = () => { updBtn.style.background = "rgba(255,255,255,0.12)"; updBtn.style.color = "#ffffff"; };
          updBtn.onmouseleave = () => { updBtn.style.background = ""; updBtn.style.color = "#666"; };
          updBtn.onclick = (e) => {
            e.stopPropagation();
            if (!window.confirm(`Update template "${item.name}" with current drawing settings?`)) return;
            let settings = { style: { ...(drawing.style || {}) }, text: drawing.text ? { ...drawing.text } : undefined };
            try {
              if (actions.resolve) {
                const resolved = actions.resolve();
                if (resolved && resolved.serialize) {
                  const ser = resolved.serialize();
                  settings = { style: { ...ser.style }, text: ser.text ? { ...ser.text } : undefined };
                }
              }
            } catch (_) {}
            if (actions.saveTemplate) actions.saveTemplate(item.name);
            const tpls = loadTemplates();
            const list = (tpls[type] || []).map((t) => t.name === item.name ? { ...t, settings } : t);
            tpls[type] = list;
            saveTemplates(tpls);
            renderItems();
          };
          row.appendChild(updBtn);

          const delBtn = document.createElement("span");
          delBtn.className = "vela-dsp-mi-x";
          delBtn.setAttribute("role", "button");
          delBtn.setAttribute("aria-label", `Delete ${item.name}`);
          delBtn.innerHTML = '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m4 4 8 8M12 4l-8 8"/></svg>';
          delBtn.style.cssText = `
            width: 20px;
            height: 20px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #666;
            flex-shrink: 0;
            transition: background 0.1s, color 0.1s;
          `;
          delBtn.onmouseenter = () => { delBtn.style.background = "rgba(242, 54, 69, 0.2)"; delBtn.style.color = "#f23645"; };
          delBtn.onmouseleave = () => { delBtn.style.background = ""; delBtn.style.color = "#666"; };
          delBtn.onclick = (e) => {
            e.stopPropagation();
            const confirmed = window.confirm(`Delete template "${item.name}"?`);
            if (!confirmed) return;
            if (actions.removeTemplate) actions.removeTemplate(item.name);
            const tpls = loadTemplates();
            tpls[type] = (tpls[type] || []).filter((t) => t.name !== item.name);
            saveTemplates(tpls);
            renderItems();
          };
          row.appendChild(delBtn);
        }

        row.onclick = (e) => {
          e.stopPropagation();

          // Apply settings directly to drawing upon click selection
          if (actions.applyToolSettings) {
            actions.applyToolSettings(item.settings);
          } else {
            if (item.settings && item.settings.style) {
              Object.assign(drawing.style || {}, item.settings.style);
            }
            if (item.settings && item.settings.text) {
              drawing.text = Object.assign({}, drawing.text || {}, item.settings.text);
            }
          }

          try {
            const ws = window.ws;
            const chart = ws && (ws.chart || (ws.active && ws.active.chart));
            if (chart && chart.renderer && chart.renderer.userDrawings) {
              chart.renderer.userDrawings.render();
            }
          } catch (_) {}

          if (window.scheduleSave) window.scheduleSave();
          closeTemplateSubwindow();
        };

        return row;
      };

      // Saved templates
      const tpls = loadTemplates();
      const currentSaved = tpls[type] || [];
      if (currentSaved.length > 0) {
        const sh = document.createElement("div");
        sh.className = "vela-dsp-mh";
        sh.textContent = "Saved";
        sh.style.cssText = "padding: 6px 8px 3px; font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #666;";
        subwin.appendChild(sh);
        currentSaved.forEach((s) => subwin.appendChild(createItem(s, true)));

        const sep = document.createElement("div");
        sep.className = "vela-dsp-msep";
        sep.style.cssText = "height: 1px; background: #282828; margin: 4px 0;";
        subwin.appendChild(sep);
      }

      // 3. Save as style... row
      const saveBox = document.createElement("div");
      saveBox.style.cssText = "display: flex; flex-direction: column;";

      const saveRowBtn = document.createElement("button");
      saveRowBtn.type = "button";
      saveRowBtn.className = "vela-dsp-mi";
      saveRowBtn.style.cssText = `
        all: unset;
        box-sizing: border-box;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 6px 0 8px;
        height: 30px;
        border-radius: 5px;
        color: #e6dfd2;
        font-size: 12px;
        font-weight: 500;
        transition: background 0.1s ease, color 0.1s ease;
      `;
      saveRowBtn.onmouseenter = () => {
        saveRowBtn.style.background = "rgba(255, 255, 255, 0.08)";
        saveRowBtn.style.color = "#ffffff";
      };
      saveRowBtn.onmouseleave = () => {
        saveRowBtn.style.background = "";
        saveRowBtn.style.color = "#e6dfd2";
      };
      saveRowBtn.innerHTML = `
        <span style="display:flex;align-items:center;color:#e6dfd2;margin-right:2px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>
        </span>
        <span class="vela-dsp-mi-t">Save as style…</span>`;

      const inputRow = document.createElement("div");
      inputRow.className = "vela-dsp-mname";
      inputRow.style.cssText = "display: none; align-items: center; gap: 6px; padding: 4px;";

      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.placeholder = "Style name";
      nameInput.maxLength = 60;
      nameInput.style.cssText = "flex: 1; min-width: 0; height: 26px; padding: 0 8px; border-radius: 4px; border: 1px solid #333; background: #0d0d0d; color: #fff; font-size: 12px; outline: none;";
      nameInput.onfocus = () => { nameInput.style.borderColor = "#666"; };
      nameInput.onblur = () => { nameInput.style.borderColor = "#333"; };

      const confirmBtn = document.createElement("button");
      confirmBtn.type = "button";
      confirmBtn.className = "tradex-save-btn";
      confirmBtn.textContent = "Save";
      confirmBtn.style.cssText = `
        height: 26px;
        padding: 0 11px;
        border-radius: 4px;
        border: 1px solid #444;
        background: #2b2b2b;
        color: #ffffff;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.1s, border-color 0.1s;
      `;
      confirmBtn.onmouseenter = () => { confirmBtn.style.background = "#383838"; confirmBtn.style.borderColor = "#666"; };
      confirmBtn.onmouseleave = () => { confirmBtn.style.background = "#2b2b2b"; confirmBtn.style.borderColor = "#444"; };

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "tradex-cancel-btn";
      cancelBtn.textContent = "✕";
      cancelBtn.style.cssText = `
        height: 26px;
        width: 26px;
        border-radius: 4px;
        border: 1px solid #333;
        background: #181818;
        color: #888888;
        font-size: 12px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background 0.1s, color 0.1s, border-color 0.1s;
      `;
      cancelBtn.onmouseenter = () => { cancelBtn.style.background = "#282828"; cancelBtn.style.color = "#ffffff"; cancelBtn.style.borderColor = "#444"; };
      cancelBtn.onmouseleave = () => { cancelBtn.style.background = "#181818"; cancelBtn.style.color = "#888888"; cancelBtn.style.borderColor = "#333"; };

      inputRow.append(nameInput, confirmBtn, cancelBtn);
      saveBox.append(saveRowBtn, inputRow);
      subwin.appendChild(saveBox);

      saveRowBtn.onclick = (e) => {
        e.stopPropagation();
        saveRowBtn.style.display = "none";
        inputRow.style.display = "flex";
        requestAnimationFrame(() => nameInput.focus());
      };

      cancelBtn.onclick = (e) => {
        e.stopPropagation();
        inputRow.style.display = "none";
        saveRowBtn.style.display = "flex";
        nameInput.value = "";
      };

      const doSave = () => {
        const name = nameInput.value.trim();
        if (!name) return;

        let settings = {
          style: { ...(drawing.style || {}) },
          text: drawing.text ? { ...drawing.text } : undefined
        };
        try {
          if (actions.resolve) {
            const resolved = actions.resolve();
            if (resolved && resolved.serialize) {
              const ser = resolved.serialize();
              settings = { style: { ...ser.style }, text: ser.text ? { ...ser.text } : undefined };
            }
          }
        } catch (_) {}

        if (actions.saveTemplate) {
          actions.saveTemplate(name);
        }

        const t = loadTemplates();
        t[type] = (t[type] || []).filter((x) => x.name !== name);
        t[type].push({ name, settings });
        saveTemplates(t);

        if (window.scheduleSave) window.scheduleSave();
        renderItems();
      };

      confirmBtn.onclick = (e) => { e.stopPropagation(); doSave(); };
      nameInput.onkeydown = (e) => {
        e.stopPropagation();
        if (e.key === "Enter") doSave();
        if (e.key === "Escape") cancelBtn.click();
      };

      // 4. Reset to default row
      const resetSep = document.createElement("div");
      resetSep.className = "vela-dsp-msep";
      resetSep.style.cssText = "height: 1px; background: #282828; margin: 4px 0;";
      subwin.appendChild(resetSep);

      const resetRow = document.createElement("button");
      resetRow.type = "button";
      resetRow.className = "vela-dsp-mi";
      resetRow.setAttribute("role", "menuitem");
      resetRow.style.cssText = `
        all: unset;
        box-sizing: border-box;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 6px 0 8px;
        height: 28px;
        border-radius: 5px;
        color: #777;
        font-size: 12px;
        transition: background 0.1s ease, color 0.1s ease;
      `;
      resetRow.innerHTML = '<span class="vela-dsp-mi-t">Reset to default</span>';
      resetRow.onmouseenter = () => { resetRow.style.color = "#fff"; resetRow.style.background = "rgba(255,255,255,0.08)"; };
      resetRow.onmouseleave = () => { resetRow.style.color = "#777"; resetRow.style.background = ""; };
      resetRow.onclick = (e) => {
        e.stopPropagation();
        if (actions.resetSettings) actions.resetSettings();
        if (window.scheduleSave) window.scheduleSave();
        closeTemplateSubwindow();
      };
      subwin.appendChild(resetRow);
    };

    renderItems();
    document.body.appendChild(subwin);

    // Compute coordinate positions directly under the trigger button
    const rect = triggerBtn.getBoundingClientRect();
    const subH = 320;
    const subW = 220;
    const winH = window.innerHeight;
    const winW = window.innerWidth;

    let left = rect.left;
    let top = rect.bottom + 6;

    if (top + subH > winH - 10) {
      top = Math.max(10, rect.top - subH - 6);
    }
    if (left + subW > winW - 10) {
      left = winW - subW - 10;
    }
    if (left < 10) left = 10;

    subwin.style.left = `${left}px`;
    subwin.style.top = `${top}px`;

    currentOpenSubwin = subwin;

    // Attach outside pointerdown dismiss with safety delay
    setTimeout(() => {
      document.addEventListener("pointerdown", onOutsidePointerDown, true);
    }, 60);
  }

  function injectEnhancements(popEl) {
    if (!popEl) return;

    // A) REMOVE ALL TOOLTIP TAGS / BUBBLES
    popEl.addEventListener("mouseover", (e) => { e.stopImmediatePropagation(); }, true);
    popEl.querySelectorAll("[data-tip], [title]").forEach((el) => {
      el.removeAttribute("title");
      el.removeAttribute("data-tip");
    });

    const g = popEl.querySelector("div");
    if (!g) return;

    // Remove any alert button if previously injected
    const oldAlert = g.querySelector(".tradex-alert-btn");
    if (oldAlert) oldAlert.remove();

    // 1. Grip handle: Clean dots matching .tx-favbar
    let grip = g.querySelector(".vela-dpop-grip");
    if (grip) {
      grip.removeAttribute("title");
      grip.removeAttribute("data-tip");
      grip.style.width = "14px";
      grip.style.height = "32px";
      grip.style.margin = "0";
      grip.style.padding = "0";
      grip.style.color = "var(--faint, #5e584f)";
      grip.innerHTML = '<svg width="6" height="14" viewBox="0 0 6 14" fill="currentColor"><circle cx="1.5" cy="2" r="1.2"/><circle cx="4.5" cy="2" r="1.2"/><circle cx="1.5" cy="7" r="1.2"/><circle cx="4.5" cy="7" r="1.2"/><circle cx="1.5" cy="12" r="1.2"/><circle cx="4.5" cy="12" r="1.2"/></svg>';
    }

    // 2. Template button ⊞+
    let tplBtn = g.querySelector(".tradex-template-btn");
    if (!tplBtn) {
      tplBtn = document.createElement("button");
      tplBtn.type = "button";
      tplBtn.className = "vela-dpop-btn tradex-dpop-btn tradex-template-btn";
      tplBtn.setAttribute("aria-label", "Templates");
      tplBtn.setAttribute("aria-haspopup", "menu");
      tplBtn.setAttribute("aria-expanded", "false");
      tplBtn.style.width = "32px";
      tplBtn.style.height = "32px";
      tplBtn.style.borderRadius = "5px";
      tplBtn.style.margin = "0";
      tplBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.5"/>
          <rect x="14" y="3.5" width="6.5" height="6.5" rx="1.5"/>
          <rect x="3.5" y="14" width="6.5" height="6.5" rx="1.5"/>
          <path d="M14 17.5h6.5M17.25 14.25v6.5"/>
        </svg>`;

      tplBtn.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
      });

      tplBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        openTemplateSubwindow(tplBtn);
      });

      // Insert immediately after grip (or as first child)
      if (grip && grip.nextSibling) {
        g.insertBefore(tplBtn, grip.nextSibling);
      } else if (grip) {
        g.appendChild(tplBtn);
      } else {
        g.insertBefore(tplBtn, g.firstChild);
      }
    }

    // 3. Format all buttons to match .tx-favbar spacing and dimensions
    g.querySelectorAll("button").forEach((btn) => {
      btn.removeAttribute("title");
      btn.removeAttribute("data-tip");

      if (btn.classList.contains("vela-dpop-grip")) return;

      // Dropdown buttons with text/spans (like line width '1px ⌵' and line style)
      const spans = btn.querySelectorAll("span");
      const hasSpans = spans.length > 0 || btn.textContent.trim().length > 0;
      if (hasSpans) {
        btn.style.width = "auto";
        btn.style.minWidth = "46px";
        btn.style.padding = "0 6px";
        btn.style.gap = "4px";
        btn.style.height = "32px";
        btn.style.margin = "0";
        btn.style.borderRadius = "5px";

        // Internal chevron icons should be 12px
        spans.forEach((sp, idx) => {
          const svg = sp.querySelector("svg");
          if (svg && (idx > 0 || sp.innerHTML.includes("12") || svg.getAttribute("width") === "12")) {
            svg.style.width = "12px";
            svg.style.height = "12px";
          }
        });
      } else {
        // Normal square buttons: 32px x 32px
        btn.style.width = "32px";
        btn.style.height = "32px";
        btn.style.padding = "0";
        btn.style.margin = "0";
        btn.style.borderRadius = "5px";
        btn.style.flexShrink = "0";
      }
    });

    // 4. Dividers
    g.querySelectorAll('div[style*="width: 1px"], div[style*="width:1px"]').forEach((d) => {
      d.style.width = "1px";
      d.style.height = "18px";
      d.style.margin = "0 3px";
      d.style.background = "var(--line, #2f2c27)";
      d.style.display = "flex";
      d.style.flexShrink = "0";
    });
  }

  // Ensure "Text alignment" (middle, top, bottom / left, center, right) is directly in the Label section below Style
  function ensureTextAlignmentInDialog(dialogEl) {
    if (!dialogEl) return;
    const rows = dialogEl.querySelectorAll(".vela-dsp-row");
    rows.forEach((row) => {
      const lab = row.querySelector(".vela-dsp-lab");
      if (!lab || lab.textContent.trim().toLowerCase() !== "style") return;

      const fold = row.closest(".vela-dsp-fold");
      if (!fold) return;
      const foldHead = fold.querySelector(".vela-dsp-fold-h");
      const foldText = (foldHead ? foldHead.textContent : "").toLowerCase();
      if (!foldText.includes("label") && !foldText.includes("text")) return;

      // Check if next row is already alignment
      const next = row.nextElementSibling;
      if (next && (next.classList.contains("tradex-align-row") || (next.textContent && next.textContent.includes("alignment")))) {
        return;
      }

      const ctx = getActiveDrawing();
      if (!ctx || !ctx.drawing) return;
      const d = ctx.drawing;
      const actions = ctx.actions || (ctx.popup && ctx.popup.current && ctx.popup.current.actions);

      const getV = () => {
        const tx = (d.live ? d.live().text : d.text) || {};
        return tx.vAlign || (tx.side === "below" ? "bottom" : (tx.side === "above" ? "top" : "middle"));
      };
      const getH = () => {
        const tx = (d.live ? d.live().text : d.text) || {};
        return tx.hAlign || (tx.place === "start" ? "left" : (tx.place === "end" ? "right" : "center"));
      };

      const alignRow = document.createElement("div");
      alignRow.className = "vela-dsp-row tradex-align-row";

      const labEl = document.createElement("span");
      labEl.className = "vela-dsp-lab";
      labEl.textContent = "Text alignment";
      labEl.title = "Text alignment";
      alignRow.appendChild(labEl);

      // Segment 1: Vertical (Middle | Top | Bottom)
      const segV = document.createElement("div");
      segV.className = "vela-dsp-seg";
      segV.setAttribute("role", "group");
      segV.setAttribute("aria-label", "Vertical");
      segV.setAttribute("data-full", "");

      const vBtns = [
        { val: "middle", text: "Middle" },
        { val: "top", text: "Top" },
        { val: "bottom", text: "Bottom" }
      ].map((item) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = item.text;
        btn.title = item.text;
        btn.setAttribute("aria-label", item.text);
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (actions && actions.patch) {
            actions.patch({ "text.vAlign": item.val, "text.side": item.val === "bottom" ? "below" : (item.val === "middle" ? "middle" : "above") });
          } else if (d.text) {
            d.text.vAlign = item.val;
            d.text.side = item.val === "bottom" ? "below" : (item.val === "middle" ? "middle" : "above");
          }
          updateStates();
          if (window.ws && window.ws.chart) {
            try { window.ws.chart.renderer.userDrawings.render(); } catch (_) {}
          }
          if (window.scheduleSave) window.scheduleSave();
        });
        segV.appendChild(btn);
        return { btn, val: item.val };
      });
      alignRow.appendChild(segV);

      // Segment 2: Horizontal (Left | Center | Right)
      const segH = document.createElement("div");
      segH.className = "vela-dsp-seg";
      segH.setAttribute("role", "group");
      segH.setAttribute("aria-label", "Horizontal");
      segH.setAttribute("data-full", "");

      const hBtns = [
        { val: "left", text: "Left" },
        { val: "center", text: "Center" },
        { val: "right", text: "Right" }
      ].map((item) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = item.text;
        btn.title = item.text;
        btn.setAttribute("aria-label", item.text);
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (actions && actions.patch) {
            actions.patch({ "text.hAlign": item.val, "text.place": item.val === "left" ? "start" : (item.val === "right" ? "end" : "middle") });
          } else if (d.text) {
            d.text.hAlign = item.val;
            d.text.place = item.val === "left" ? "start" : (item.val === "right" ? "end" : "middle");
          }
          updateStates();
          if (window.ws && window.ws.chart) {
            try { window.ws.chart.renderer.userDrawings.render(); } catch (_) {}
          }
          if (window.scheduleSave) window.scheduleSave();
        });
        segH.appendChild(btn);
        return { btn, val: item.val };
      });
      alignRow.appendChild(segH);

      function updateStates() {
        const curV = getV();
        vBtns.forEach((b) => b.btn.setAttribute("aria-pressed", String(b.val === curV)));
        const curH = getH();
        hBtns.forEach((b) => b.btn.setAttribute("aria-pressed", String(b.val === curH)));
      }
      updateStates();

      // Insert directly below Style row
      row.parentNode.insertBefore(alignRow, row.nextSibling);
    });
  }

  // Hook all popups on the workspace
  function mount(ws) {
    if (!ws) return;
    const hookCell = (cell) => {
      try {
        if (cell && cell.chart && cell.chart.renderer && cell.chart.renderer.userDrawings) {
          hookPopup(cell.chart.renderer.userDrawings.popup);
        }
      } catch (_) {}
    };
    if (ws.chart && ws.chart.renderer && ws.chart.renderer.userDrawings) {
      hookPopup(ws.chart.renderer.userDrawings.popup);
    }
    if (ws.cells) ws.cells().forEach(hookCell);
    if (ws.events) {
      ws.events.on("cell:created", ({ id }) => {
        if (ws.cell) hookCell(ws.cell(id));
      });
      ws.events.on("drawing:templates", () => {
        try {
          const tpls = ws.chart.drawings.toolTemplates();
          if (tpls && Object.keys(tpls).length) saveTemplates(tpls);
        } catch (_) {}
      });
    }
  }

  // Observe DOM for .vela-dpop and .vela-dsp appearance
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === 1) {
          if (node.classList && node.classList.contains("vela-dpop")) {
            injectEnhancements(node);
          } else {
            const p = node.querySelector && node.querySelector(".vela-dpop");
            if (p) injectEnhancements(p);
          }

          if (node.classList && (node.classList.contains("vela-dsp") || node.classList.contains("vela-dialog"))) {
            ensureTextAlignmentInDialog(node);
          } else {
            const dlg = node.querySelector && node.querySelector(".vela-dsp, .vela-dialog");
            if (dlg) ensureTextAlignmentInDialog(dlg);
          }
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Polling fallback to keep buttons synchronized and hook active popups
  setInterval(() => {
    if (window.ws) mount(window.ws);

    const p = document.querySelector(".vela-dpop");
    if (p) {
      p.querySelectorAll("[data-tip], [title]").forEach((el) => {
        el.removeAttribute("title");
        el.removeAttribute("data-tip");
      });
      if (!p.querySelector(".tradex-template-btn")) {
        injectEnhancements(p);
      }
    }

    const dlg = document.querySelector(".vela-dsp, .vela-dialog");
    if (dlg) {
      ensureTextAlignmentInDialog(dlg);
    }
  }, 200);

  window.TradeXDrawingTemplates = {
    mount,
    load: loadTemplates,
    save: saveTemplates,
    fetch: fetchBackendTemplates,
    syncWithVela: syncWithVelaDrawings,
    syncFromVela: (type, name, settings, isRemove) => {
      if (!type || !name) return;
      const tpls = loadTemplates();
      if (isRemove) {
        tpls[type] = (tpls[type] || []).filter((t) => t.name !== name);
      } else {
        const list = (tpls[type] || []).filter((t) => t.name !== name);
        list.push({ name, settings: settings || {} });
        tpls[type] = list;
      }
      saveTemplates(tpls);
    }
  };
})();
