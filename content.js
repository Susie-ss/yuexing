(() => {
  if (window.__yuexingReaderInstalled) return;
  window.__yuexingReaderInstalled = true;

  const state = { timer: null, running: false, settings: { speed: 35, loop: false, smooth: true }, scroller: null, widget: null, widgetRoot: null, minimized: false };
  const isScrollable = (el) => {
    if (!(el instanceof Element)) return false;
    const style = getComputedStyle(el);
    return /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 80;
  };

  function findScroller() {
    const candidates = [...document.querySelectorAll("main, article, [role=main], .markdown-body, pre, div, section")]
      .filter(isScrollable)
      .filter((el) => el.clientHeight > 160)
      .sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight));
    return candidates[0] || document.scrollingElement || document.documentElement;
  }

  function metrics() {
    const el = state.scroller || document.scrollingElement || document.documentElement;
    const top = el === document.scrollingElement || el === document.documentElement || el === document.body ? window.scrollY : el.scrollTop;
    const height = el === document.scrollingElement || el === document.documentElement || el === document.body ? document.documentElement.scrollHeight : el.scrollHeight;
    const view = el === document.scrollingElement || el === document.documentElement || el === document.body ? window.innerHeight : el.clientHeight;
    return { top, height, view };
  }

  function stop() {
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
    state.running = false;
    updateWidget();
    return { running: false, ...metrics() };
  }

  function ensureWidget() {
    if (state.widget?.isConnected) return state.widget;
    const host = document.createElement("div");
    host.id = "yuexing-reader-host";
    host.style.cssText = "all:initial;position:fixed;z-index:2147483647;right:20px;bottom:20px;width:0;height:0;";
    const root = host.attachShadow({ mode: "closed" });
    state.widgetRoot = root;
    root.innerHTML = `
      <style>
        *{box-sizing:border-box} .bubble{position:fixed;right:20px;bottom:20px;width:48px;height:48px;border:1px solid #a9d869;border-radius:50%;background:#c6ed86;color:#26321b;box-shadow:0 6px 24px #0005;display:grid;place-items:center;font:700 18px -apple-system,BlinkMacSystemFont,sans-serif;cursor:pointer;user-select:none}
        .panel{position:fixed;right:20px;bottom:20px;width:210px;padding:14px;border:1px solid #41483a;border-radius:16px;background:#171b16;color:#f2f3ec;box-shadow:0 12px 40px #0008;font:13px -apple-system,BlinkMacSystemFont,sans-serif}
        .head{display:flex;align-items:center;gap:8px;margin-bottom:12px}.title{font-weight:700;margin-right:auto}.state{font-size:11px;color:#bfe986}.actions{display:flex;gap:7px}.actions button,.mini{font:inherit;cursor:pointer;border:0}.head button{width:26px;height:26px;border:0;border-radius:7px;background:#2b3029;color:#d5d7ce;font:16px/1 -apple-system,BlinkMacSystemFont,sans-serif;cursor:pointer}.head .close{font-size:20px}.actions button{height:34px;flex:1;border-radius:9px;background:#c6ed86;color:#26321b;font-weight:700}.actions .stop{flex:0 0 38px;background:#2b3029;color:#d5d7ce}.collapse{background:transparent!important;color:#a4aa9b!important;flex:0 0 25px!important}.hint{margin-top:9px;color:#8e9588;font-size:10px}
        .bubble[hidden],.panel[hidden]{display:none}
      </style>
      <button class="bubble" aria-label="展开阅行控制" title="展开阅行控制">阅</button>
      <section class="panel" aria-label="阅行阅读控制" hidden>
        <div class="head"><span class="title">阅行阅读</span><span class="state">正在阅读</span><button class="open-popup" aria-label="打开阅行正式窗口" title="打开阅行正式窗口">↗</button><button class="close" aria-label="关闭并退出阅行" title="关闭并退出阅行">×</button></div>
        <div class="actions"><button class="toggle">暂停阅读</button><button class="stop" title="停止阅读">■</button><button class="collapse" title="收起">⌄</button></div>
        <div class="hint">拖动此控件可调整位置</div>
      </section>`;
    const bubble = root.querySelector(".bubble");
    const panel = root.querySelector(".panel");
    bubble.addEventListener("click", () => { state.minimized = false; updateWidget(); });
    root.querySelector(".collapse").addEventListener("click", () => { state.minimized = true; updateWidget(); });
    root.querySelector(".toggle").addEventListener("click", () => state.running ? stop() : start());
    root.querySelector(".stop").addEventListener("click", () => { state.settings.loop = false; stop(); state.minimized = true; updateWidget(); });
    root.querySelector(".close").addEventListener("click", closeWidget);
    root.querySelector(".open-popup").addEventListener("click", openPopup);
    let drag = null;
    const dragTarget = panel.querySelector(".head");
    dragTarget.style.cursor = "move";
    dragTarget.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) return;
      drag = { x: event.clientX, y: event.clientY, right: parseFloat(panel.style.right) || 20, bottom: parseFloat(panel.style.bottom) || 20 };
      dragTarget.setPointerCapture(event.pointerId);
    });
    dragTarget.addEventListener("pointermove", (event) => {
      if (!drag) return;
      panel.style.right = `${Math.max(4, Math.min(innerWidth - 80, drag.right - (event.clientX - drag.x)))}px`;
      panel.style.bottom = `${Math.max(4, Math.min(innerHeight - 50, drag.bottom + (event.clientY - drag.y)))}px`;
      bubble.style.right = panel.style.right;
      bubble.style.bottom = panel.style.bottom;
    });
    dragTarget.addEventListener("pointerup", () => { drag = null; });
    document.documentElement.appendChild(host);
    state.widget = host;
    updateWidget();
    return host;
  }

  function updateWidget() {
    if (!state.widget?.isConnected) return;
    const root = state.widgetRoot;
    if (!root) return;
    const bubble = root.querySelector(".bubble");
    const panel = root.querySelector(".panel");
    bubble.hidden = !state.minimized;
    panel.hidden = state.minimized;
    root.querySelector(".state").textContent = state.running ? "正在阅读" : "已暂停";
    root.querySelector(".toggle").textContent = state.running ? "暂停阅读" : "继续阅读";
  }

  function closeWidget() {
    stop();
    state.settings.loop = false;
    state.widget?.remove();
    state.widget = null;
    state.widgetRoot = null;
    state.minimized = false;
  }

  function openPopup() {
    chrome.runtime.sendMessage({ type: "OPEN_READER_POPUP" }, (response) => {
      if (chrome.runtime.lastError || !response?.ok) {
        const root = state.widgetRoot;
        if (root?.isConnected) root.querySelector(".state").textContent = "请点击工具栏阅行图标";
      }
    });
  }

  function start(settings = {}) {
    state.settings = { ...state.settings, ...settings };
    state.scroller = findScroller();
    if (state.timer) clearInterval(state.timer);
    state.running = true;
    state.minimized = true;
    ensureWidget();
    updateWidget();
    const tick = () => {
      const { top, height, view } = metrics();
      if (top + view >= height - 2) {
        if (state.settings.loop) {
          if (state.scroller === document.scrollingElement || state.scroller === document.documentElement || state.scroller === document.body) window.scrollTo({ top: 0, behavior: "auto" });
          else state.scroller.scrollTop = 0;
        } else stop();
        return;
      }
      const amount = Math.max(1, Number(state.settings.speed) || 35) * (view / 800);
      if (state.scroller === document.scrollingElement || state.scroller === document.documentElement || state.scroller === document.body) {
        window.scrollBy({ top: amount, behavior: state.settings.smooth ? "smooth" : "auto" });
      } else state.scroller.scrollTop += amount;
    };
    state.timer = setInterval(tick, 50);
    tick();
    return { running: true, ...metrics() };
  }

  function handle(message) {
    switch (message.type) {
      case "START": return start(message.settings);
      case "PAUSE": return stop();
      case "STOP": state.settings.loop = false; return stop();
      case "TOGGLE": return state.running ? stop() : start(message.settings);
      case "STATUS": return { running: state.running, ...metrics() };
      case "MINIMIZE": state.minimized = true; updateWidget(); return { running: state.running };
      case "EXPAND": state.minimized = false; updateWidget(); return { running: state.running };
      case "SCROLL_TO_TOP": window.scrollTo({ top: 0, behavior: "smooth" }); return { running: state.running };
      default: return { running: state.running };
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    try { respond(handle(message)); } catch (error) { respond({ error: error.message }); }
  });
  window.addEventListener("wheel", () => { if (state.running) stop(); }, { passive: true });
  window.addEventListener("keydown", (event) => {
    if (state.running && ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(event.key)) stop();
  });
})();
