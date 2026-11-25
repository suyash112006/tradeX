// TradeX: Chart Settings Template Manager
// Adds Save / Apply / Delete templates to the Chart settings dialog footer,
// persisted in localStorage and synced to /api/templates under "_chart_settings".
(function () {
  const LS_KEY = "tradex_chart_settings_templates";
  let memList = null;

  function loadList() {
    if (memList) return memList;
    try {
      const raw = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
      memList = Array.isArray(raw) ? raw : [];
    } catch (_) {
      memList = [];
    }
    return memList;
  }

  function saveList(list) {
    memList = Array.isArray(list) ? list : [];
    try { localStorage.setItem(LS_KEY, JSON.stringify(memList)); } catch (_) {}
    try {
      fetch("/api/templates")
        .then((r) => r.json())
        .then((all) => {
          const payload = (all && typeof all === "object" && !all.error) ? all : {};
          payload._chart_settings = memList;
          return fetch("/api/templates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            keepalive: true
          });
        })
        .catch(() => {});
    } catch (_) {}
  }

  // Sync from backend on load
  try {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((all) => {
        if (all && Array.isArray(all._chart_settings)) {
          const local = loadList();
          const byName = new Map();
          for (const t of local) if (t && t.name) byName.set(t.name, t);
          for (const t of all._chart_settings) if (t && t.name) byName.set(t.name, t);
          memList = Array.from(byName.values());
          try { localStorage.setItem(LS_KEY, JSON.stringify(memList)); } catch (_) {}
        }
      })
      .catch(() => {});
  } catch (_) {}

  let openMenu = null;
  function closeMenu() {
    if (openMenu) {
      openMenu.remove();
      openMenu = null;
    }
    document.removeEventListener("pointerdown", onDocDown, true);
  }
  function onDocDown(e) {
    if (!openMenu) return;
    if (openMenu.contains(e.target)) return;
    if (e.target && e.target.closest && e.target.closest(".tradex-cs-tpl-btn")) return;
    closeMenu();
  }

  function cloneConfig(cfg) {
    try { return JSON.parse(JSON.stringify(cfg || {})); } catch (_) { return {}; }
  }

  function attachFooter(footerEl, dialog) {
    if (!footerEl || footerEl.querySelector(".tradex-cs-tpl-btn")) return;

    const tplBtn = document.createElement("button");
    tplBtn.type = "button";
    tplBtn.className = "vela-sd-btn tradex-cs-tpl-btn";
    tplBtn.style.cssText = "display:inline-flex;align-items:center;gap:6px;";
    tplBtn.innerHTML = '<span>Template</span><svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 4.5 6 7.5 9 4.5"/></svg>';

    tplBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (openMenu) {
        closeMenu();
        return;
      }

      const menu = document.createElement("div");
      menu.className = "vela-dsp-menu tradex-cs-tpl-menu";
      menu.setAttribute("role", "menu");
      menu.style.cssText = [
        "position:fixed !important",
        "z-index:999999 !important",
        "background:#141414 !important",
        "border:1px solid #282828 !important",
        "border-radius:8px !important",
        "box-shadow:0 12px 36px rgba(0,0,0,0.85),0 2px 8px rgba(0,0,0,0.5) !important",
        "color:#d4d4d4 !important",
        "font:12px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif !important",
        "min-width:210px !important",
        "max-width:270px !important",
        "max-height:360px !important",
        "overflow-y:auto !important",
        "padding:5px !important",
        "display:flex !important",
        "flex-direction:column !important",
        "gap:2px !important",
        "user-select:none !important",
        "box-sizing:border-box !important"
      ].join(";");

      menu.addEventListener("pointerdown", (ev) => ev.stopPropagation());
      menu.addEventListener("click", (ev) => ev.stopPropagation());

      const renderMenu = () => {
        menu.replaceChildren();
        const list = loadList();

        if (list.length > 0) {
          const hdr = document.createElement("div");
          hdr.textContent = "Saved Templates";
          hdr.style.cssText = "padding:6px 8px 3px;font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#666;";
          menu.appendChild(hdr);

          list.forEach((tpl) => {
            const row = document.createElement("button");
            row.type = "button";
            row.className = "vela-dsp-mi";
            row.style.cssText = "all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;gap:8px;padding:0 6px 0 8px;height:30px;border-radius:5px;color:#ccc;font-size:12px;width:100%;transition:background 0.1s,color 0.1s;";
            row.onpointerenter = () => { row.style.background = "rgba(255,255,255,0.08)"; row.style.color = "#fff"; };
            row.onpointerleave = () => { row.style.background = ""; row.style.color = "#ccc"; };

            const upCol = (tpl.config && tpl.config.candles && tpl.config.candles.upColor) || "#00a8b5";
            const dnCol = (tpl.config && tpl.config.candles && tpl.config.candles.downColor) || "#d9531e";
            const swatch = document.createElement("span");
            swatch.style.cssText = `width:12px;height:12px;border-radius:3px;border:1px solid rgba(255,255,255,0.18);flex-shrink:0;background:linear-gradient(135deg, ${upCol} 50%, ${dnCol} 50%);`;

            const nameEl = document.createElement("span");
            nameEl.textContent = tpl.name;
            nameEl.style.cssText = "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";

            const upd = document.createElement("span");
            upd.title = "Save current changes to this template";
            upd.innerHTML = '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12.5 14H3.5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h7l3 3v8a1 1 0 0 1-1 1z"/><path d="M10.5 14v-4h-5v4M5.5 2v3h4"/></svg>';
            upd.style.cssText = "width:20px;height:20px;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#666;flex-shrink:0;";
            upd.onmouseenter = () => { upd.style.background = "rgba(255,255,255,0.12)"; upd.style.color = "#fff"; };
            upd.onmouseleave = () => { upd.style.background = ""; upd.style.color = "#666"; };
            upd.onclick = (ev) => {
              ev.stopPropagation();
              if (!window.confirm(`Update chart template "${tpl.name}" with current settings?`)) return;
              let liveCfg = (dialog && dialog.config) ? cloneConfig(dialog.config) : {};
              try {
                const ws = window.ws;
                const ch = ws && (ws.chart || (ws.active && ws.active.chart));
                if (ch && ch.renderer && ch.renderer.getConfig) liveCfg = cloneConfig(ch.renderer.getConfig());
              } catch (_) {}
              const hubSettings = (typeof window.HubSettingsLoad === "function") ? cloneConfig(window.HubSettingsLoad()) : null;
              let hostSettings = null;
              try {
                const ws = window.ws;
                const cell = ws && (ws.active || (ws.cells && ws.cells()[0]));
                if (cell) {
                  hostSettings = {
                    watermark: !!cell.watermarkOn,
                    replayWatermark: !!cell.replayWatermarkOn,
                    bars: cell.state ? cell.state.bars : undefined,
                    indicatorTitles: cell.indicatorTitlesOn !== false,
                    indicatorValues: cell.indicatorValuesOn !== false,
                    statusline: cell.statusline && cell.statusline.partVisible ? {
                      name: !!cell.statusline.partVisible("name"),
                      market: !!cell.statusline.partVisible("market"),
                      ohlc: !!cell.statusline.partVisible("ohlc"),
                      change: !!cell.statusline.partVisible("change")
                    } : undefined
                  };
                }
              } catch (_) {}
              const updated = loadList().map((x) => x.name === tpl.name ? { name: tpl.name, config: liveCfg, hubSettings, hostSettings } : x);
              saveList(updated);
              try { localStorage.setItem("tradex_chart_config", JSON.stringify(liveCfg)); } catch (_) {}
              if (hostSettings) try { localStorage.setItem("tradex_chart_host_settings", JSON.stringify(hostSettings)); } catch (_) {}
              renderMenu();
            };

            const del = document.createElement("span");
            del.innerHTML = '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m4 4 8 8M12 4l-8 8"/></svg>';
            del.style.cssText = "width:20px;height:20px;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#666;flex-shrink:0;";
            del.onmouseenter = () => { del.style.background = "rgba(242,54,69,0.2)"; del.style.color = "#f23645"; };
            del.onmouseleave = () => { del.style.background = ""; del.style.color = "#666"; };
            del.onclick = (ev) => {
              ev.stopPropagation();
              if (!window.confirm(`Delete chart template "${tpl.name}"?`)) return;
              saveList(loadList().filter((x) => x.name !== tpl.name));
              renderMenu();
            };

            row.append(swatch, nameEl, upd, del);
            row.onclick = () => {
              const cfg = cloneConfig(tpl.config);
              if (tpl.hubSettings && typeof window.HubSettingsSave === "function") {
                const prevInd = window.HubSettingsLoad ? window.HubSettingsLoad().indicatorBars : false;
                window.HubSettingsSave(cloneConfig(tpl.hubSettings));
                if (typeof window.HubThemeApply === "function") window.HubThemeApply();
                try { window.parent.postMessage({ evt: "hub:theme" }, location.origin); } catch (_) {}
                if (!!tpl.hubSettings.indicatorBars !== !!prevInd) {
                  try { window.parent.postMessage({ evt: "hub:reload" }, location.origin); } catch (_) {}
                }
              }
              if (tpl.hostSettings) {
                try { localStorage.setItem("tradex_chart_host_settings", JSON.stringify(tpl.hostSettings)); } catch (_) {}
                try {
                  const ws = window.ws;
                  const cell = ws && (ws.active || (ws.cells && ws.cells()[0]));
                  if (cell) {
                    const hs = tpl.hostSettings;
                    if (typeof hs.watermark === "boolean" && cell.setWatermarkVisible) cell.setWatermarkVisible(hs.watermark);
                    if (typeof hs.replayWatermark === "boolean" && cell.setReplayWatermarkVisible) cell.setReplayWatermarkVisible(hs.replayWatermark);
                    if (hs.statusline && cell.setStatuslinePart) {
                      for (const [k, v] of Object.entries(hs.statusline)) cell.setStatuslinePart(k, !!v);
                    }
                    if (typeof hs.indicatorTitles === "boolean" && cell.setIndicatorTitlesVisible) cell.setIndicatorTitlesVisible(hs.indicatorTitles);
                    if (typeof hs.indicatorValues === "boolean" && cell.setIndicatorValuesVisible) cell.setIndicatorValuesVisible(hs.indicatorValues);
                    if (hs.bars && cell.state) {
                      cell.state.bars = Number(hs.bars);
                      cell.inner?.setMarket?.({ bars: Math.max(cell.state.bars, cell.rangeBars || 0) });
                    }
                  }
                } catch (_) {}
              }
              try { localStorage.setItem("tradex_chart_config", JSON.stringify(cfg)); } catch (_) {}
              if (dialog && dialog.onImport) dialog.onImport(cfg);
              else if (dialog && dialog.onChange) dialog.onChange(cfg);
              if (dialog && dialog.refresh) dialog.refresh(cfg);
              closeMenu();
            };
            menu.appendChild(row);
          });

          const sep = document.createElement("div");
          sep.style.cssText = "height:1px;background:#282828;margin:4px 0;";
          menu.appendChild(sep);
        }

        const saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.className = "vela-dsp-mi";
        saveBtn.style.cssText = "all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;gap:8px;padding:0 6px 0 8px;height:30px;border-radius:5px;color:#e6dfd2;font-size:12px;font-weight:500;width:100%;";
        saveBtn.onpointerenter = () => { saveBtn.style.background = "rgba(255,255,255,0.08)"; saveBtn.style.color = "#fff"; };
        saveBtn.onpointerleave = () => { saveBtn.style.background = ""; saveBtn.style.color = "#e6dfd2"; };
        saveBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg><span>Save as…</span>';

        const inputRow = document.createElement("div");
        inputRow.style.cssText = "display:none;align-items:center;gap:6px;padding:4px;";
        const inp = document.createElement("input");
        inp.type = "text";
        inp.placeholder = "Template name";
        inp.maxLength = 60;
        inp.style.cssText = "flex:1;min-width:0;height:26px;padding:0 8px;border-radius:4px;border:1px solid #333;background:#0d0d0d;color:#fff;font-size:12px;outline:none;";

        const okBtn = document.createElement("button");
        okBtn.type = "button";
        okBtn.textContent = "Save";
        okBtn.style.cssText = "height:26px;padding:0 11px;border-radius:4px;border:1px solid #444;background:#2b2b2b;color:#fff;font-size:11px;font-weight:500;cursor:pointer;";

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.textContent = "✕";
        cancelBtn.style.cssText = "height:26px;width:26px;border-radius:4px;border:1px solid #333;background:#181818;color:#888;font-size:12px;cursor:pointer;";

        inputRow.append(inp, okBtn, cancelBtn);

        saveBtn.onclick = () => {
          saveBtn.style.display = "none";
          inputRow.style.display = "flex";
          requestAnimationFrame(() => inp.focus());
        };
        cancelBtn.onclick = () => {
          inputRow.style.display = "none";
          saveBtn.style.display = "flex";
          inp.value = "";
        };

        const doSave = () => {
          const name = inp.value.trim();
          if (!name) return;
          let liveCfg = (dialog && dialog.config) ? cloneConfig(dialog.config) : {};
          try {
            const ws = window.ws;
            const ch = ws && (ws.chart || (ws.active && ws.active.chart));
            if (ch && ch.renderer && ch.renderer.getConfig) {
              liveCfg = cloneConfig(ch.renderer.getConfig());
            }
          } catch (_) {}
          const hubSettings = (typeof window.HubSettingsLoad === "function") ? cloneConfig(window.HubSettingsLoad()) : null;
          let hostSettings = null;
          try {
            const ws = window.ws;
            const cell = ws && (ws.active || (ws.cells && ws.cells()[0]));
            if (cell) {
              hostSettings = {
                watermark: !!cell.watermarkOn,
                replayWatermark: !!cell.replayWatermarkOn,
                bars: cell.state ? cell.state.bars : undefined,
                indicatorTitles: cell.indicatorTitlesOn !== false,
                indicatorValues: cell.indicatorValuesOn !== false,
                statusline: cell.statusline && cell.statusline.partVisible ? {
                  name: !!cell.statusline.partVisible("name"),
                  market: !!cell.statusline.partVisible("market"),
                  ohlc: !!cell.statusline.partVisible("ohlc"),
                  change: !!cell.statusline.partVisible("change")
                } : undefined
              };
            }
          } catch (_) {}
          const cur = loadList().filter((x) => x.name !== name);
          cur.push({ name, config: liveCfg, hubSettings, hostSettings });
          saveList(cur);
          // Also persist as active default setting for page refresh
          try { localStorage.setItem("tradex_chart_config", JSON.stringify(liveCfg)); } catch (_) {}
          if (hostSettings) {
            try { localStorage.setItem("tradex_chart_host_settings", JSON.stringify(hostSettings)); } catch (_) {}
          }
          if (hubSettings && typeof window.HubSettingsSave === "function") {
            window.HubSettingsSave(hubSettings);
          }
          renderMenu();
        };
        okBtn.onclick = doSave;
        inp.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") { ev.preventDefault(); doSave(); }
          if (ev.key === "Escape") { ev.preventDefault(); cancelBtn.click(); }
        });

        menu.append(saveBtn, inputRow);
      };

      renderMenu();
      document.body.appendChild(menu);

      const rect = tplBtn.getBoundingClientRect();
      const mRect = menu.getBoundingClientRect();
      let top = rect.top - mRect.height - 6;
      if (top < 8) top = rect.bottom + 6;
      let left = rect.left;
      if (left + mRect.width > window.innerWidth - 8) left = window.innerWidth - mRect.width - 8;
      menu.style.top = `${Math.max(8, top)}px`;
      menu.style.left = `${Math.max(8, left)}px`;

      openMenu = menu;
      setTimeout(() => document.addEventListener("pointerdown", onDocDown, true), 0);
    });

    footerEl.appendChild(tplBtn);
  }

  function clearChartThemeOverrides() {
    try {
      const raw = JSON.parse(localStorage.getItem("tradex_chart_config") || "{}");
      ["layout", "grid", "crosshair", "panes", "candles", "bars", "line", "area", "baseline"].forEach((k) => delete raw[k]);
      if (raw.priceScale && "borderColor" in raw.priceScale) delete raw.priceScale.borderColor;
      localStorage.setItem("tradex_chart_config", JSON.stringify(raw));
    } catch (_) {}
  }

  function applyHubThemeChange(dialog) {
    clearChartThemeOverrides();
    if (typeof window.HubThemeApply === "function") window.HubThemeApply();
    if (typeof window.applyTheme === "function") window.applyTheme();
    try { window.parent.postMessage({ evt: "hub:theme" }, location.origin); } catch (_) {}
    try {
      const ws = window.ws;
      const ch = ws && (ws.chart || (ws.active && ws.active.chart));
      if (dialog && dialog.refresh && ch && ch.renderer && ch.renderer.getConfig) {
        dialog.refresh(ch.renderer.getConfig());
      }
    } catch (_) {}
  }

  function injectInterface(rootEl, dialog) {
    if (!rootEl || typeof window.HubSettingsLoad !== "function" || typeof window.HubPresets !== "object") return;

    const tabMarker = document.createElement("div");
    tabMarker.dataset.sdTab = "interface";
    tabMarker.dataset.sdTabLabel = "Interface";
    rootEl.appendChild(tabMarker);

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;gap:10px;padding:6px 0;";

    const mkHeading = (txt) => {
      const h = document.createElement("div");
      h.textContent = txt;
      h.style.cssText = "font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#888;margin-top:8px;margin-bottom:2px;";
      return h;
    };

    const s = window.HubSettingsLoad();
    const t = (typeof window.HubTheme === "object" && window.HubTheme) ? window.HubTheme : window.HubThemeApply();

    // Theme presets
    wrap.appendChild(mkHeading("Theme"));
    const preRow = document.createElement("div");
    preRow.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;";
    Object.entries(window.HubPresets).forEach(([k, p]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = p.label;
      const isOn = s.preset === k;
      b.style.cssText = `flex:1;min-width:90px;padding:7px 8px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:500;background:${p.bg};color:${p.text};border:${isOn ? "2px solid #ffffff" : `1px solid ${p.line}`};`;
      b.onclick = () => {
        window.HubSettingsSave({ ...window.HubSettingsLoad(), preset: k, overrides: {} });
        applyHubThemeChange(dialog);
      };
      preRow.appendChild(b);
    });
    wrap.appendChild(preRow);

    // Font selector
    if (window.HubFonts) {
      wrap.appendChild(mkHeading("Font"));
      const sel = document.createElement("select");
      sel.style.cssText = "width:100%;height:32px;padding:0 10px;border-radius:6px;border:1px solid #333;background:#141414;color:#e6dfd2;font-size:12px;outline:none;";
      Object.entries(window.HubFonts).forEach(([k, f]) => sel.add(new Option(f.label, k)));
      sel.value = s.font;
      sel.onchange = () => {
        window.HubSettingsSave({ ...window.HubSettingsLoad(), font: sel.value });
        applyHubThemeChange(dialog);
      };
      wrap.appendChild(sel);
    }

    const addColorRows = (title, items) => {
      wrap.appendChild(mkHeading(title));
      items.forEach(([key, label]) => {
        const row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;justify-content:space-between;min-height:30px;gap:12px;";
        const lbl = document.createElement("span");
        lbl.textContent = label;
        lbl.style.cssText = "font-size:13px;color:var(--vela-fg,#d4d4d4);";
        const sw = document.createElement("button");
        sw.type = "button";
        sw.className = "tradex-swatch-btn";
        sw.style.cssText = `width:44px;height:20px;border-radius:4px;border:1px solid rgba(255,255,255,0.2);background:${t[key]};cursor:pointer;padding:0;flex-shrink:0;`;
        sw.onclick = () => {
          if (window.TradeXHubSettingsUI) {
            window.TradeXHubSettingsUI.openColorPicker(sw, window.HubTheme[key], (val) => {
              sw.style.background = val;
              clearChartThemeOverrides();
              const cur = window.HubSettingsLoad();
              cur.overrides[key] = val;
              window.HubSettingsSave(cur);
              if (typeof window.HubThemeApply === "function") window.HubThemeApply();
              if (typeof window.applyTheme === "function") window.applyTheme();
              try { window.parent.postMessage({ evt: "hub:theme" }, location.origin); } catch (_) {}
            });
          }
        };
        row.append(lbl, sw);
        wrap.appendChild(row);
      });
    };

    addColorRows("Candles", [["up", "Rising candle"], ["down", "Falling candle"]]);

    // Let indicators recolour candles
    const indRow = document.createElement("label");
    indRow.style.cssText = "display:flex;align-items:center;justify-content:space-between;min-height:30px;cursor:pointer;font-size:13px;color:var(--vela-fg,#d4d4d4);";
    const indChk = document.createElement("input");
    indChk.type = "checkbox";
    indChk.checked = !!s.indicatorBars;
    indChk.onchange = () => {
      window.HubSettingsSave({ ...window.HubSettingsLoad(), indicatorBars: indChk.checked });
      try { window.parent.postMessage({ evt: "hub:reload" }, location.origin); } catch (_) {}
    };
    indRow.append("Let indicators recolour candles", indChk);
    wrap.appendChild(indRow);

    addColorRows("Interface", [
      ["bg", "Chart background"],
      ["panel", "Panels and bars"],
      ["text", "Text"],
      ["dim", "Secondary text"],
      ["line", "Borders"],
      ["grid", "Grid lines"],
      ["accent", "Accent (selection, price)"]
    ]);

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "vela-sd-btn";
    resetBtn.textContent = "Reset colours to theme";
    resetBtn.style.cssText = "margin-top:6px;align-self:flex-start;";
    resetBtn.onclick = () => {
      window.HubSettingsSave({ ...window.HubSettingsLoad(), overrides: {} });
      applyHubThemeChange(dialog);
    };
    wrap.appendChild(resetBtn);

    rootEl.appendChild(wrap);
  }

  window.TradeXChartTemplates = { attachFooter, injectInterface, loadList, saveList };
})();
