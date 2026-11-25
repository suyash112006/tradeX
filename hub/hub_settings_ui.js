// TradeX: Hub Settings Rich Color Picker Window & Settings Templates
(function () {
  const CUSTOM_COLORS_KEY = "tradex_custom_colors";
  const HUB_TPL_KEY = "tradex_hub_settings_templates";

  // 10 columns x 8 rows palette matching TradingView-style color window
  const PALETTE_ROWS = [
    ["#ffffff", "#e0e0e0", "#c0c0c0", "#a0a0a0", "#808080", "#606060", "#404040", "#2a2a2a", "#1a1a1a", "#000000"],
    ["#f23645", "#ff9800", "#fbc02d", "#8bc34a", "#00e676", "#00e5ff", "#29b6f6", "#2962ff", "#7e57c2", "#ec407a"],
    ["#fccbc9", "#ffe0b2", "#fff9c4", "#dcedc8", "#c8e6c9", "#b2ebf2", "#b3e5fc", "#bbdefb", "#d1c4e9", "#f8bbd0"],
    ["#f4989c", "#ffcc80", "#fff59d", "#c5e1a5", "#a5d6a7", "#80deea", "#81d4fa", "#90caf9", "#b39ddb", "#f48fb1"],
    ["#ee6b6e", "#ffb74d", "#fff176", "#aed581", "#81c784", "#4dd0e1", "#4fc3f7", "#64b5f6", "#9575cd", "#f06292"],
    ["#e53935", "#ffa726", "#ffee58", "#9ccc65", "#66bb6a", "#26c6da", "#29b6f6", "#42a5f5", "#7e57c2", "#ec407a"],
    ["#b71c1c", "#ef6c00", "#f9a825", "#558b2f", "#2e7d32", "#00838f", "#0277bd", "#1565c0", "#4527a0", "#ad1457"],
    ["#7f1010", "#9c4200", "#8d6e00", "#33691e", "#1b5e20", "#004d40", "#01579b", "#0d47a1", "#311b92", "#6a0d38"]
  ];

  const DEFAULT_CUSTOM = ["#9e9e9e", "#bdbdbd", "#2962ff", "#00a8b5", "#f23645", "#ff9800", "#787b86"];

  function loadCustomColors() {
    try {
      const raw = JSON.parse(localStorage.getItem(CUSTOM_COLORS_KEY) || "null");
      if (Array.isArray(raw) && raw.length) return raw;
    } catch (_) {}
    return [...DEFAULT_CUSTOM];
  }
  function saveCustomColors(arr) {
    try { localStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(arr.slice(0, 14))); } catch (_) {}
  }

  function parseColor(str) {
    if (!str || typeof str !== "string") return { hex: "#ffffff", alpha: 1 };
    const s = str.trim();
    if (s.startsWith("rgba") || s.startsWith("rgb")) {
      const m = s.match(/[\d.]+/g);
      if (m && m.length >= 3) {
        const r = Math.max(0, Math.min(255, Math.round(Number(m[0]))));
        const g = Math.max(0, Math.min(255, Math.round(Number(m[1]))));
        const b = Math.max(0, Math.min(255, Math.round(Number(m[2]))));
        const a = m.length >= 4 ? Math.max(0, Math.min(1, Number(m[3]))) : 1;
        const hex = "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
        return { hex, alpha: a };
      }
    }
    let h = s.startsWith("#") ? s.slice(1) : s;
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length === 8) {
      const a = Math.max(0, Math.min(1, parseInt(h.slice(6, 8), 16) / 255));
      return { hex: "#" + h.slice(0, 6).toLowerCase(), alpha: a };
    }
    if (h.length === 6) return { hex: "#" + h.toLowerCase(), alpha: 1 };
    return { hex: "#ffffff", alpha: 1 };
  }

  function formatColor(hex, alpha) {
    if (alpha >= 0.999) return hex;
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgba(${r},${g},${b},${Math.round(alpha * 100) / 100})`;
  }

  let activePicker = null;
  function closeColorPicker() {
    if (activePicker) {
      activePicker.remove();
      activePicker = null;
    }
    document.removeEventListener("pointerdown", onOutsidePicker, true);
  }
  function onOutsidePicker(e) {
    if (!activePicker) return;
    if (activePicker.contains(e.target)) return;
    if (e.target && e.target.closest && e.target.closest(".tradex-swatch-btn")) return;
    closeColorPicker();
  }

  function openColorPicker(anchorEl, currentColor, onSelect) {
    closeColorPicker();
    let { hex, alpha } = parseColor(currentColor);

    const pop = document.createElement("div");
    pop.className = "tradex-color-pop";
    pop.style.cssText = [
      "position:fixed",
      "z-index:999999",
      "width:248px",
      "background:#141414",
      "border:1px solid #2b2b2b",
      "border-radius:10px",
      "padding:10px",
      "box-shadow:0 14px 38px rgba(0,0,0,0.88)",
      "color:#d4d4d4",
      "font:12px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
      "user-select:none",
      "box-sizing:border-box"
    ].join(";");

    pop.addEventListener("pointerdown", (e) => e.stopPropagation());
    pop.addEventListener("click", (e) => e.stopPropagation());

    const grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(10,1fr);gap:4px;";

    const swatchEls = [];
    const updateSelectionUI = () => {
      swatchEls.forEach(({ el, c }) => {
        if (c.toLowerCase() === hex.toLowerCase()) {
          el.style.boxShadow = "0 0 0 2px #141414, 0 0 0 3.5px #ffffff";
          el.style.transform = "scale(1.06)";
        } else {
          el.style.boxShadow = "inset 0 0 0 1px rgba(255,255,255,0.12)";
          el.style.transform = "";
        }
      });
    };

    PALETTE_ROWS.forEach((row) => {
      row.forEach((c) => {
        const sw = document.createElement("button");
        sw.type = "button";
        sw.style.cssText = `width:18px;height:18px;border-radius:4px;border:0;padding:0;cursor:pointer;background:${c};transition:transform 0.08s;`;
        sw.onclick = () => {
          hex = c;
          emit();
          updateSelectionUI();
          updateSliderBg();
        };
        swatchEls.push({ el: sw, c });
        grid.appendChild(sw);
      });
    });

    const sep = document.createElement("div");
    sep.style.cssText = "height:1px;background:#262626;margin:10px 0 8px;";

    const customRow = document.createElement("div");
    customRow.style.cssText = "display:flex;flex-wrap:wrap;gap:5px;align-items:center;";

    const renderCustomRow = () => {
      customRow.replaceChildren();
      loadCustomColors().forEach((c) => {
        const sw = document.createElement("button");
        sw.type = "button";
        sw.style.cssText = `width:18px;height:18px;border-radius:4px;border:0;padding:0;cursor:pointer;background:${c};box-shadow:inset 0 0 0 1px rgba(255,255,255,0.15);`;
        sw.onclick = () => {
          hex = parseColor(c).hex;
          emit();
          updateSelectionUI();
          updateSliderBg();
        };
        customRow.appendChild(sw);
      });

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.textContent = "+";
      addBtn.title = "Add custom colour";
      addBtn.style.cssText = "width:18px;height:18px;border-radius:4px;border:1px dashed #444;background:#1c1c1c;color:#ccc;font-size:13px;line-height:1;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;";

      const hiddenInp = document.createElement("input");
      hiddenInp.type = "color";
      hiddenInp.value = hex;
      hiddenInp.style.cssText = "position:absolute;opacity:0;width:0;height:0;pointer-events:none;";
      hiddenInp.oninput = () => {
        hex = hiddenInp.value.toLowerCase();
        emit();
        updateSelectionUI();
        updateSliderBg();
      };
      hiddenInp.onchange = () => {
        const list = loadCustomColors().filter((x) => x.toLowerCase() !== hiddenInp.value.toLowerCase());
        list.push(hiddenInp.value.toLowerCase());
        saveCustomColors(list);
        renderCustomRow();
      };
      addBtn.onclick = () => hiddenInp.click();
      customRow.append(addBtn, hiddenInp);
    };
    renderCustomRow();

    const opLabel = document.createElement("div");
    opLabel.textContent = "Opacity";
    opLabel.style.cssText = "margin:10px 0 6px;font-size:12px;color:#999;";

    const opRow = document.createElement("div");
    opRow.style.cssText = "display:flex;align-items:center;gap:8px;";

    const trackWrap = document.createElement("div");
    trackWrap.style.cssText = "position:relative;flex:1;height:12px;border-radius:6px;background-image:linear-gradient(45deg,#333 25%,transparent 25%),linear-gradient(-45deg,#333 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#333 75%),linear-gradient(-45deg,transparent 75%,#333 75%);background-size:8px 8px;background-position:0 0,0 4px,4px -4px,-4px 0;background-color:#1e1e1e;cursor:pointer;";

    const trackFill = document.createElement("div");
    trackFill.style.cssText = "position:absolute;inset:0;border-radius:6px;";

    const thumb = document.createElement("div");
    thumb.style.cssText = "position:absolute;top:50%;width:14px;height:14px;border-radius:50%;background:#ffffff;box-shadow:0 1px 4px rgba(0,0,0,0.65);transform:translate(-50%,-50%);pointer-events:none;";

    const pctBox = document.createElement("div");
    pctBox.style.cssText = "width:46px;height:24px;border-radius:5px;border:1px solid #333;background:#0f0f0f;color:#e6e6e6;font-size:11px;display:flex;align-items:center;justify-content:center;font-variant-numeric:tabular-nums;";

    const updateSliderBg = () => {
      const n = parseInt(hex.slice(1), 16);
      const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
      trackFill.style.background = `linear-gradient(to right, rgba(${r},${g},${b},0), rgba(${r},${g},${b},1))`;
      thumb.style.left = `${Math.round(alpha * 100)}%`;
      pctBox.textContent = `${Math.round(alpha * 100)}%`;
    };

    const emit = () => {
      const val = formatColor(hex, alpha);
      onSelect(val);
    };

    const setAlphaFromEvent = (ev) => {
      const rect = trackWrap.getBoundingClientRect();
      alpha = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      updateSliderBg();
      emit();
    };
    trackWrap.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      setAlphaFromEvent(ev);
      const onMove = (mv) => setAlphaFromEvent(mv);
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });

    trackWrap.append(trackFill, thumb);
    opRow.append(trackWrap, pctBox);

    pop.append(grid, sep, customRow, opLabel, opRow);
    document.body.appendChild(pop);

    updateSelectionUI();
    updateSliderBg();

    const aRect = anchorEl.getBoundingClientRect();
    const pRect = pop.getBoundingClientRect();
    let left = aRect.left - pRect.width - 8;
    if (left < 8) left = Math.min(window.innerWidth - pRect.width - 8, aRect.right + 8);
    let top = aRect.top;
    if (top + pRect.height > window.innerHeight - 8) top = window.innerHeight - pRect.height - 8;
    pop.style.left = `${Math.max(8, left)}px`;
    pop.style.top = `${Math.max(8, top)}px`;

    activePicker = pop;
    setTimeout(() => document.addEventListener("pointerdown", onOutsidePicker, true), 0);
  }

  // ---- Hub Settings Templates ----
  let memTemplates = null;
  function loadTemplates() {
    if (memTemplates) return memTemplates;
    try {
      const raw = JSON.parse(localStorage.getItem(HUB_TPL_KEY) || "[]");
      memTemplates = Array.isArray(raw) ? raw : [];
    } catch (_) {
      memTemplates = [];
    }
    return memTemplates;
  }
  function saveTemplates(list) {
    memTemplates = Array.isArray(list) ? list : [];
    try { localStorage.setItem(HUB_TPL_KEY, JSON.stringify(memTemplates)); } catch (_) {}
    try {
      fetch("/api/templates")
        .then((r) => r.json())
        .then((all) => {
          const payload = (all && typeof all === "object" && !all.error) ? all : {};
          payload._hub_settings = memTemplates;
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

  try {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((all) => {
        if (all && Array.isArray(all._hub_settings)) {
          const byName = new Map();
          for (const t of loadTemplates()) if (t && t.name) byName.set(t.name, t);
          for (const t of all._hub_settings) if (t && t.name) byName.set(t.name, t);
          memTemplates = Array.from(byName.values());
          try { localStorage.setItem(HUB_TPL_KEY, JSON.stringify(memTemplates)); } catch (_) {}
        }
      })
      .catch(() => {});
  } catch (_) {}

  window.TradeXHubSettingsUI = {
    openColorPicker,
    closeColorPicker,
    loadTemplates,
    saveTemplates
  };
})();
