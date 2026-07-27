/** Galaxy Craft chrome — portals + StarCraft tab transitions / swoosh. */
(function () {
  var mount = window.__duckyAppearanceSkinMount;
  if (!mount || !mount.slots) return;

  var slots = mount.slots;
  var key = mount.key;
  var pluginId = mount.pluginId || "galaxycraft";
  var nodes = [];
  var tabObserver = null;
  var hookHandler = null;
  var lastAnimAt = 0;
  var animBusy = false;
  var reduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function track(el) {
    nodes.push(el);
    return el;
  }

  // ── Terran metal frame (corners + striped armor borders) ───────
  var cornerUid = 0;
  function cornerSvgHtml() {
    cornerUid += 1;
    var mid = "gcM" + cornerUid;
    var gid = "gcG" + cornerUid;
    return (
      '<svg class="gc-terran-corner-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      "<defs>" +
      '<linearGradient id="' + mid + '" x1="0%" y1="0%" x2="100%" y2="100%">' +
      '<stop offset="0%" stop-color="#4b5d6e"/>' +
      '<stop offset="50%" stop-color="#252d36"/>' +
      '<stop offset="100%" stop-color="#11151c"/>' +
      "</linearGradient>" +
      '<linearGradient id="' + gid + '" x1="0%" y1="0%" x2="100%" y2="100%">' +
      '<stop offset="0%" stop-color="#0ea5e9" stop-opacity="0.85"/>' +
      '<stop offset="100%" stop-color="transparent" stop-opacity="0"/>' +
      "</linearGradient>" +
      "</defs>" +
      '<path d="M0 0 L100 0 L80 20 L20 20 L20 80 L0 100 Z" fill="url(#' + mid + ')" stroke="#000" stroke-width="2"/>' +
      '<path d="M5 5 L85 5 L65 25" stroke="url(#' + gid + ')" stroke-width="2" fill="none"/>' +
      '<path d="M5 5 L5 85 L25 65" stroke="url(#' + gid + ')" stroke-width="2" fill="none"/>' +
      '<circle cx="10" cy="10" r="4" fill="#111" stroke="#4b5d6e" stroke-width="1"/>' +
      '<circle cx="50" cy="10" r="3" fill="#111" stroke="#4b5d6e" stroke-width="1"/>' +
      '<circle cx="10" cy="50" r="3" fill="#111" stroke="#4b5d6e" stroke-width="1"/>' +
      "</svg>"
    );
  }

  function makeCorner(pos) {
    var el = document.createElement("div");
    el.className = "gc-terran-corner gc-terran-corner--" + pos;
    el.innerHTML = cornerSvgHtml();
    return el;
  }

  var frame = track(document.createElement("div"));
  frame.className = "gc-frame";
  ["tl", "tr", "bl", "br"].forEach(function (c) {
    frame.appendChild(makeCorner(c));
  });
  var stripeTop = document.createElement("div");
  stripeTop.className = "gc-frame-stripe gc-frame-stripe--h top";
  var stripeBot = document.createElement("div");
  stripeBot.className = "gc-frame-stripe gc-frame-stripe--h bottom";
  var stripeL = document.createElement("div");
  stripeL.className = "gc-frame-stripe gc-frame-stripe--v left";
  var stripeR = document.createElement("div");
  stripeR.className = "gc-frame-stripe gc-frame-stripe--v right";
  frame.appendChild(stripeTop);
  frame.appendChild(stripeBot);
  frame.appendChild(stripeL);
  frame.appendChild(stripeR);
  slots.frame.replaceChildren(frame);

  var header = track(document.createElement("div"));
  header.className = "gc-header";
  header.innerHTML = '<div class="gc-header-scan"></div>';
  slots.header.replaceChildren(header);

  var left = track(document.createElement("div"));
  left.className = "gc-rail gc-rail--left";
  slots.left.replaceChildren(left);

  var right = track(document.createElement("div"));
  right.className = "gc-rail gc-rail--right";
  slots.right.replaceChildren(right);

  // Panel hull look is CSS-only (theme.css). Never appendChild/replaceWith into
  // React hosts — that causes removeChild crashes on send / re-render.
  var PANEL_SEL =
    ".dock-rail-shell, .editor-group, .settings-view-sidebar-shell, " +
    ".settings-view-main, .chat-column, .modal";
  var panelObserver = null;

  function decoratePanel(el) {
    if (!el || el.nodeType !== 1) return;
    if (el.getAttribute("data-gc-terran") === "1") return;
    if (!el.matches || !el.matches(PANEL_SEL)) return;
    el.setAttribute("data-gc-terran", "1");
    el.classList.add("gc-sc-panel");
  }

  function decorateAll(root) {
    var scope = root && root.querySelectorAll ? root : document;
    if (scope.matches && scope.matches(PANEL_SEL)) decoratePanel(scope);
    if (!scope.querySelectorAll) return;
    scope.querySelectorAll(PANEL_SEL).forEach(decoratePanel);
  }

  decorateAll(document);
  if (typeof MutationObserver === "function") {
    panelObserver = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type !== "childList") continue;
        for (var j = 0; j < m.addedNodes.length; j++) {
          var n = m.addedNodes[j];
          if (n.nodeType !== 1) continue;
          decoratePanel(n);
          if (n.querySelectorAll) decorateAll(n);
        }
      }
    });
    panelObserver.observe(document.body, { childList: true, subtree: true });
  }

  // ── Swoosh (WebAudio fake + optional plugin wav) ───────────────
  var audioCtx = null;
  function getCtx() {
    if (audioCtx) return audioCtx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
    return audioCtx;
  }

  function playSynthSwoosh() {
    var ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    var filter = ctx.createBiquadFilter();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(160, t + 0.22);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2400, t);
    filter.frequency.exponentialRampToValueAtTime(400, t + 0.22);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.28);

    // noise whoosh
    var len = Math.floor(ctx.sampleRate * 0.22);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.35));
    }
    var noise = ctx.createBufferSource();
    var ng = ctx.createGain();
    var nf = ctx.createBiquadFilter();
    noise.buffer = buf;
    nf.type = "bandpass";
    nf.frequency.value = 900;
    ng.gain.setValueAtTime(0.08, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    noise.connect(nf);
    nf.connect(ng);
    ng.connect(ctx.destination);
    noise.start(t);
  }

  function playWavSwoosh() {
    try {
      var url =
        "/plugin-ui/" +
        encodeURIComponent(pluginId) +
        "/ui/swoosh.wav?t=" +
        Date.now();
      var a = new Audio(url);
      a.volume = 0.45;
      void a.play().catch(function () {
        playSynthSwoosh();
      });
    } catch (_) {
      playSynthSwoosh();
    }
  }

  function playSwoosh() {
    // Prefer plugin wav (shows in Appearance → Sounds as plugin:galaxycraft:swoosh);
    // always fall back to synth so the theme feels alive even if Sounds is off.
    playWavSwoosh();
  }

  // ── Scoped tab transitions (ONE content pane only; out THEN in) ─
  // Never animate sidebar / header / whole window.
  var OUT_MS = 200;
  var IN_MS = 340;
  var pendingHost = null;
  var pendingTimer = 0;

  function contentHostForTab(tab) {
    if (!tab) return null;
    // Settings left nav or header sub-tabs → right content only
    if (
      tab.classList.contains("settings-view-sidebar-tab") ||
      tab.classList.contains("settings-view-header-tab") ||
      tab.closest(".settings-view")
    ) {
      var settings = tab.closest(".settings-view") || document.querySelector(".settings-view");
      return settings ? settings.querySelector(".settings-view-content") : null;
    }
    // File / editor tabs → only that group's body
    if (tab.classList.contains("editor-tab") || tab.closest(".editor-group")) {
      var group = tab.closest(".editor-group");
      return group ? group.querySelector(".editor-group-body") : null;
    }
    return null;
  }

  function clearClones() {
    document.querySelectorAll(".gc-panel-clone").forEach(function (c) {
      c.remove();
    });
  }

  function finishIn(host) {
    if (!host) {
      animBusy = false;
      return;
    }
    clearClones();
    host.classList.add("gc-anim-host");
    host.classList.remove("gc-panel-in");
    void host.offsetWidth;
    host.classList.add("gc-panel-in");
    window.setTimeout(function () {
      host.classList.remove("gc-panel-in", "gc-anim-host");
      animBusy = false;
      pendingHost = null;
    }, IN_MS);
  }

  /** Strict sequence: snapshot slides OUT first, then live host slides IN. */
  function runScopedTransition(host) {
    if (!host) return;
    if (reduced) {
      playSwoosh();
      return;
    }
    var now = Date.now();
    if (animBusy && pendingHost === host) return;
    if (now - lastAnimAt < 120) return;
    lastAnimAt = now;
    animBusy = true;
    pendingHost = host;

    if (pendingTimer) {
      window.clearTimeout(pendingTimer);
      pendingTimer = 0;
    }

    playSwoosh();
    clearClones();

    // 1) ALWAYS shift OLD content away first — fixed overlay outside React tree
    var rect = host.getBoundingClientRect();
    var clone = document.createElement("div");
    clone.className = "gc-panel-clone";
    clone.setAttribute("aria-hidden", "true");
    clone.style.left = rect.left + "px";
    clone.style.top = rect.top + "px";
    clone.style.width = rect.width + "px";
    clone.style.height = rect.height + "px";
    try {
      var shot = host.cloneNode(true);
      shot.classList.remove("gc-anim-host", "gc-panel-in");
      clone.appendChild(shot);
    } catch (_) {
      /* empty ok */
    }
    document.body.appendChild(clone);

    // Hide live host during out so you only see the departing clone
    host.classList.add("gc-anim-host");
    host.style.opacity = "0";

    // 2) After out finishes → reveal + slide NEW content in
    pendingTimer = window.setTimeout(function () {
      pendingTimer = 0;
      host.style.opacity = "";
      finishIn(host);
    }, OUT_MS);
  }

  // pointerdown BEFORE React swaps — capture old content, start OUT
  function onTabPointerDown(ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    var tab = t.closest(
      ".editor-tab, .settings-view-sidebar-tab, .settings-view-header-tab"
    );
    if (!tab) return;
    if (tab.classList.contains("is-active") || tab.disabled) return;
    var ctx = getCtx();
    if (ctx && ctx.state === "suspended") void ctx.resume();
    var host = contentHostForTab(tab);
    if (host) runScopedTransition(host);
  }
  document.addEventListener("pointerdown", onTabPointerDown, true);

  // Fallback when route changes without our pointerdown (hooks / keyboard)
  function snapshotActive() {
    return {
      settings: (
        document.querySelector(".settings-view-sidebar-tab.is-active") || {}
      ).textContent,
      settingsHeader: (
        document.querySelector(".settings-view-header-tab.is-active") || {}
      ).textContent,
      editor: (document.querySelector(".editor-tab.is-active") || {}).textContent,
    };
  }
  var prevSnap = snapshotActive();

  function hostForSnapChange(prev, next) {
    if ((prev.settings || "") !== (next.settings || "")) {
      return document.querySelector(".settings-view-content");
    }
    if ((prev.settingsHeader || "") !== (next.settingsHeader || "")) {
      return document.querySelector(".settings-view-content");
    }
    if ((prev.editor || "") !== (next.editor || "")) {
      var tab = document.querySelector(".editor-tab.is-active");
      return contentHostForTab(tab);
    }
    return null;
  }

  // ── Settings shell enter / leave (left nav SEPARATE from right) ─
  var settingsOpen = !!document.querySelector(".settings-view");
  var settingsShellObserver = null;
  var SIDEBAR_IN_MS = 380;
  var SIDEBAR_OUT_MS = 280;

  function clearSettingsLeaveClones() {
    document
      .querySelectorAll(".gc-sidebar-leave-clone, .gc-settings-main-leave-clone")
      .forEach(function (c) {
        c.remove();
      });
  }

  function placeFixedClone(src, className) {
    if (!src) return null;
    var rect = src.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return null;
    var clone = document.createElement("div");
    clone.className = className;
    clone.setAttribute("aria-hidden", "true");
    clone.style.left = rect.left + "px";
    clone.style.top = rect.top + "px";
    clone.style.width = rect.width + "px";
    clone.style.height = rect.height + "px";
    try {
      clone.appendChild(src.cloneNode(true));
    } catch (_) {
      /* ignore */
    }
    document.body.appendChild(clone);
    return clone;
  }

  /** Settings opened: left slides in L→R + opacity; right slides in separately. */
  function animateSettingsEnter() {
    if (reduced) {
      playSwoosh();
      return;
    }
    var root = document.querySelector(".settings-view");
    if (!root) return;
    var sidebar = root.querySelector(".settings-view-sidebar-shell");
    var main = root.querySelector(".settings-view-content");
    playSwoosh();
    if (sidebar) {
      sidebar.classList.remove("gc-sidebar-in", "gc-sidebar-out");
      void sidebar.offsetWidth;
      sidebar.classList.add("gc-sidebar-in");
      window.setTimeout(function () {
        sidebar.classList.remove("gc-sidebar-in");
      }, SIDEBAR_IN_MS);
    }
    if (main) {
      main.classList.remove("gc-settings-main-in", "gc-panel-in");
      void main.offsetWidth;
      main.classList.add("gc-settings-main-in");
      window.setTimeout(function () {
        main.classList.remove("gc-settings-main-in");
      }, 460);
    }
  }

  /**
   * Settings closing: snapshot left → slide OUT to left; right slides OUT separately.
   * `root` may be a detached .settings-view from MutationRecord.removedNodes.
   */
  function animateSettingsLeave(root) {
    if (!root) return;
    if (reduced) {
      playSwoosh();
      return;
    }
    clearSettingsLeaveClones();
    playSwoosh();
    var sidebar = root.querySelector
      ? root.querySelector(".settings-view-sidebar-shell")
      : null;
    var main = root.querySelector ? root.querySelector(".settings-view-content") : null;
    // Prefer live nodes if still attached (pointerdown path)
    if (!sidebar || !sidebar.isConnected) {
      sidebar =
        document.querySelector(".settings-view-sidebar-shell") || sidebar;
    }
    if (!main || !main.isConnected) {
      main = document.querySelector(".settings-view-content") || main;
    }
    var leftClone = placeFixedClone(sidebar, "gc-sidebar-leave-clone");
    var rightClone = placeFixedClone(main, "gc-settings-main-leave-clone");
    window.setTimeout(function () {
      if (leftClone) leftClone.remove();
      if (rightClone) rightClone.remove();
    }, SIDEBAR_OUT_MS + 40);
  }

  /** Start leave anim BEFORE React unmounts (clicking away from settings). */
  function onNavigateAwayFromSettings(ev) {
    if (!settingsOpen) return;
    var t = ev.target;
    if (!t || !t.closest) return;
    // Clicks inside settings don't leave
    if (t.closest(".settings-view")) return;
    // Likely leaving: editor tab, back, chat row, header nav, etc.
    var leaveHit = t.closest(
      ".editor-tab, .sidebar-tree-row, .app-header-nav-btn, .settings-view-back-btn, .chat-pane-root, .workspace-dock-center .editor-tab"
    );
    if (!leaveHit) return;
    // Back button is inside settings — already returned above unless it's outside
    var root = document.querySelector(".settings-view");
    if (root) animateSettingsLeave(root);
  }
  document.addEventListener("pointerdown", onNavigateAwayFromSettings, true);

  hookHandler = function (ev) {
    var detail = ev && ev.detail;
    var id = detail && detail.id;
    if (!id || detail.source === "galaxycraft") return;
    if (id === "settings.opened") {
      // Enter anim — not the tab-switch out/in path
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(animateSettingsEnter);
      });
      return;
    }
    if (animBusy) return;
    if (id === "tab.changed") {
      // Leaving settings for an editor tab is handled by leave anim + pointerdown
      if (settingsOpen && !document.querySelector(".settings-view")) return;
      var tab = document.querySelector(".editor-tab.is-active");
      // Don't run content swap anim when the active editor tab IS the settings tab opening
      if (tab && tab.closest && document.querySelector(".settings-view")) {
        // Editor tab change while settings open is rare; skip wholesale window anim
      }
      var host = contentHostForTab(tab);
      // Skip if this tab change opened settings (enter owns it)
      if (document.querySelector(".settings-view") && id === "tab.changed") {
        var settingsTab =
          tab &&
          ((tab.textContent || "").toLowerCase().indexOf("setting") >= 0 ||
            (tab.getAttribute("aria-label") || "").toLowerCase().indexOf("setting") >= 0);
        if (settingsTab) return;
      }
      if (host && !host.closest(".settings-view")) runScopedTransition(host);
    }
  };
  window.addEventListener("ducky:hook", hookHandler);

  if (typeof MutationObserver === "function") {
    tabObserver = new MutationObserver(function () {
      var next = snapshotActive();
      var host = hostForSnapChange(prevSnap, next);
      prevSnap = next;
      if (!host) return;
      if (animBusy) return;
      // Intra-settings tab changes only animate the RIGHT content
      runScopedTransition(host);
    });
    tabObserver.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ["class"],
    });

    settingsShellObserver = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type !== "childList") continue;
        for (var a = 0; a < m.addedNodes.length; a++) {
          var add = m.addedNodes[a];
          if (add.nodeType !== 1) continue;
          var entered =
            (add.classList && add.classList.contains("settings-view") && add) ||
            (add.querySelector && add.querySelector(".settings-view"));
          if (entered && !settingsOpen) {
            settingsOpen = true;
            window.requestAnimationFrame(function () {
              window.requestAnimationFrame(animateSettingsEnter);
            });
          }
        }
        for (var r = 0; r < m.removedNodes.length; r++) {
          var rem = m.removedNodes[r];
          if (rem.nodeType !== 1) continue;
          var left =
            (rem.classList && rem.classList.contains("settings-view") && rem) ||
            (rem.querySelector && rem.querySelector(".settings-view"));
          if (left && settingsOpen) {
            settingsOpen = false;
            // If pointerdown already spawned leave clones, skip duplicate
            if (!document.querySelector(".gc-sidebar-leave-clone")) {
              animateSettingsLeave(left);
            }
          }
        }
      }
      // Sync flag if structure changed without matching nodes
      var nowOpen = !!document.querySelector(".settings-view");
      if (nowOpen !== settingsOpen) settingsOpen = nowOpen;
    });
    settingsShellObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // Icon glyph swap removed — svg.replaceWith() orphaned React fibers and
  // crashed the app on Send / toolbar re-renders (removeChild NotFoundError).

  window.__duckyAppearanceSkinCleanups = window.__duckyAppearanceSkinCleanups || {};
  window.__duckyAppearanceSkinCleanups[key] = function () {
    if (tabObserver) {
      tabObserver.disconnect();
      tabObserver = null;
    }
    if (settingsShellObserver) {
      settingsShellObserver.disconnect();
      settingsShellObserver = null;
    }
    if (panelObserver) {
      panelObserver.disconnect();
      panelObserver = null;
    }
    document.querySelectorAll("[data-gc-terran='1']").forEach(function (el) {
      el.removeAttribute("data-gc-terran");
      el.classList.remove("gc-sc-panel");
    });
    if (hookHandler) {
      window.removeEventListener("ducky:hook", hookHandler);
      hookHandler = null;
    }
    document.removeEventListener("pointerdown", onTabPointerDown, true);
    document.removeEventListener("pointerdown", onNavigateAwayFromSettings, true);
    if (pendingTimer) {
      window.clearTimeout(pendingTimer);
      pendingTimer = 0;
    }
    clearClones();
    clearSettingsLeaveClones();
    document
      .querySelectorAll(
        ".gc-panel-in, .gc-anim-host, .gc-sidebar-in, .gc-settings-main-in"
      )
      .forEach(function (el) {
        el.classList.remove(
          "gc-panel-in",
          "gc-anim-host",
          "gc-sidebar-in",
          "gc-settings-main-in"
        );
        el.style.opacity = "";
      });
    slots.frame.replaceChildren();
    slots.header.replaceChildren();
    slots.left.replaceChildren();
    slots.right.replaceChildren();
    nodes.length = 0;
  };
})();
