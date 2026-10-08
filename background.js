const DEFAULTS = { speed: 35, loop: false, smooth: true };

async function getSettings() {
  return { ...DEFAULTS, ...(await chrome.storage.local.get(DEFAULTS)) };
}

async function sendToTab(tabId, message) {
  // executeScript may resolve before a newly injected content script registers
  // its listener, so retry the action once after injection.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      if (attempt === 1) throw error;
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.type !== "READER_ACTION") return;
  (async () => {
    const tabId = message.tabId ?? sender.tab?.id;
    if (!tabId) throw new Error("请先打开一个网页");
    const settings = await getSettings();
    const result = await sendToTab(tabId, { ...message.action, settings });
    respond({ ok: true, ...result });
  })().catch((error) => respond({ ok: false, error: error.message }));
  return true;
});

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) return;
  try {
    if (command === "toggle-reading") {
      await sendToTab(tab.id, { type: "TOGGLE", settings: await getSettings() });
    } else if (command === "stop-reading") {
      await sendToTab(tab.id, { type: "STOP" });
    }
  } catch { /* Restricted browser pages cannot receive content scripts. */ }
});
