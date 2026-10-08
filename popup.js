const DEFAULTS = { speed: 35, loop: false, smooth: true };
const $ = (id) => document.getElementById(id);
const els = { speed: $("speed"), speedValue: $("speedValue"), loop: $("loop"), smooth: $("smooth"), toggle: $("toggle"), stop: $("stop"), status: $("statusText"), live: document.querySelector(".live"), toast: $("toast"), top: $("top") };
let activeTabId;
let running = false;
let toastTimer;

function updateSpeedUI() {
  const value = Number(els.speed.value);
  els.speedValue.textContent = value;
  els.speed.style.background = `linear-gradient(90deg,#c2ed7d ${((value - 5) / 135) * 100}%,#394033 ${((value - 5) / 135) * 100}%)`;
  document.querySelectorAll(".presets button").forEach((button) => button.classList.toggle("selected", Number(button.dataset.speed) === value));
}

function renderStatus(next) {
  running = next;
  els.toggle.classList.toggle("running", running);
  els.toggle.querySelector("span:last-of-type").textContent = running ? "暂停阅读" : "开始阅读";
  els.toggle.querySelector(".play-icon").textContent = running ? "Ⅱ" : "▶";
  els.live.classList.toggle("running", running);
  els.status.textContent = running ? "正在阅读" : "已就绪";
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 1700);
}

function showError(message) {
  showToast(message || "操作失败，请刷新网页后重试");
  els.status.textContent = "操作失败";
  els.live.classList.remove("running");
}

async function send(action) {
  const response = await chrome.runtime.sendMessage({ type: "READER_ACTION", tabId: activeTabId, action });
  if (!response?.ok) throw new Error(response?.error || "无法控制当前页面");
  if (typeof response.running === "boolean") renderStatus(response.running);
  return response;
}

async function saveSettings() {
  const settings = { speed: Number(els.speed.value), loop: els.loop.checked, smooth: els.smooth.checked };
  await chrome.storage.local.set(settings);
  if (running) await send({ type: "START", settings });
}

async function init() {
  const settings = { ...DEFAULTS, ...(await chrome.storage.local.get(DEFAULTS)) };
  els.speed.value = settings.speed;
  els.loop.checked = settings.loop;
  els.smooth.checked = settings.smooth;
  updateSpeedUI();
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  activeTabId = tab?.id;
  if (!activeTabId || !/^(https?:|file:)/.test(tab.url || "")) {
    els.toggle.disabled = true;
    showError("此页面不支持扩展控制");
    return;
  }
  try {
    const state = await send({ type: "STATUS" });
    renderStatus(Boolean(state.running));
  } catch (error) {
    renderStatus(false);
    showError(error.message);
  }
}

els.speed.addEventListener("input", () => { updateSpeedUI(); saveSettings().catch(() => {}); });
els.loop.addEventListener("change", () => saveSettings().catch(() => {}));
els.smooth.addEventListener("change", () => saveSettings().catch(() => {}));
document.querySelectorAll(".presets button").forEach((button) => button.addEventListener("click", () => {
  els.speed.value = button.dataset.speed;
  updateSpeedUI();
  saveSettings().catch(() => {});
}));
els.toggle.addEventListener("click", async () => {
  els.toggle.disabled = true;
  els.status.textContent = running ? "正在暂停…" : "正在启动…";
  try {
    const settings = { speed: Number(els.speed.value), loop: els.loop.checked, smooth: els.smooth.checked };
    await chrome.storage.local.set(settings);
    const result = await send({ type: running ? "PAUSE" : "START", settings });
    showToast(result.running ? "开始自动阅读" : "已暂停");
  } catch (error) { showError(error.message); }
  finally { els.toggle.disabled = false; }
});
els.stop.addEventListener("click", async () => {
  try { await send({ type: "STOP" }); showToast("阅读已停止"); }
  catch (error) { showError(error.message); }
});
els.top.addEventListener("click", async () => {
  try { await send({ type: "SCROLL_TO_TOP" }); showToast("已回到页面顶部"); }
  catch (error) { showError(error.message); }
});

init();
