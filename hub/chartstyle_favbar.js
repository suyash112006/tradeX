// TradeX: Enable stars on Vela's native chart style menu (TradingView-style).
// Vela's style button and menu stay in their native position (Image 3).
// Starring any chart type updates favorites and synchronizes with the main TradeX topbar (Image 1).
(function () {
  const FAV_KEY = "tradex_chart_type_favs";
  const DEFAULT_FAVS = ["candles", "bars"];

  function loadFavs() {
    try {
      const v = JSON.parse(localStorage.getItem(FAV_KEY));
      return Array.isArray(v) && v.length ? v : DEFAULT_FAVS;
    } catch (_) {
      return DEFAULT_FAVS;
    }
  }

  function saveFavs(favs) {
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(favs));
    } catch (_) {}
  }

  // Ensure star colors and hover states inside Vela's menu
  const css = document.createElement("style");
  css.textContent = `
    .vela-menu-item .vela-menu-star.vela-fav {
      color: #e3a33a !important;
      opacity: 1 !important;
    }
    .vela-menu-item .vela-menu-star:hover {
      color: #e3a33a !important;
      opacity: 1 !important;
    }
  `;
  document.head.appendChild(css);

  function mount(ws) {
    if (!ws || !ws.topbar) return;
    const tb = ws.topbar;

    let favs = loadFavs();

    // 1. Hook tb.styleItems to include favorite state for each item
    if (!tb._txStyleItemsHooked && tb.styleItems) {
      tb._txStyleItemsHooked = true;
      const origStyleItems = tb.styleItems.bind(tb);
      tb.styleItems = function () {
        favs = loadFavs();
        return origStyleItems().map((item) => ({
          ...item,
          favorite: favs.includes(item.id),
        }));
      };
    }

    // 2. Hook tb.styleMenu onFavorite
    if (tb.styleMenu && tb.styleMenu.root) {
      tb.styleMenu.root.onFavorite = function (id, wantFav) {
        favs = loadFavs();
        if (wantFav) {
          if (!favs.includes(id)) favs.push(id);
        } else {
          favs = favs.filter((x) => x !== id);
        }
        saveFavs(favs);

        // Instantly refresh menu items so star toggles between ☆ and ★
        tb.styleMenu.setItems(tb.styleItems());

        // Notify parent (hub.html) to update topbar icon buttons
        if (window.LabEmbedded) {
          window.parent.postMessage({ evt: "chartTypeFavs", favs }, location.origin);
        }
      };
    }

    // Initial refresh of menu items so favorites have stars
    if (tb.styleMenu && tb.styleItems) {
      tb.styleMenu.setItems(tb.styleItems());
    }

    // Sync with external / parent messages
    window.addEventListener("message", (e) => {
      if (e.origin !== location.origin || !e.data) return;
      if (e.data.cmd === "priceStyle" && e.data.style) {
        if (ws.active && ws.active.setPriceStyle) ws.active.setPriceStyle(e.data.style);
        tb.setPriceStyle(e.data.style);
      }
      if (e.data.cmd === "chartTypeFavs" && Array.isArray(e.data.favs)) {
        favs = e.data.favs;
        saveFavs(favs);
        if (tb.styleMenu && tb.styleItems) tb.styleMenu.setItems(tb.styleItems());
      }
    });
  }

  window.TradeXStyleFavBar = {
    mount,
    loadFavs,
    saveFavs,
  };
})();
