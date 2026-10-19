/* ============================================================
   Billetera Virtual - Fase 1
   "Base de datos" simulada con localStorage:
   - bv_users:   objeto { "correo": { name, email, passHash, balance, transactions } }
   - bv_session: correo del usuario que tiene la sesión iniciada
   ============================================================ */

const USERS_KEY = "bv_users";
const SESSION_KEY = "bv_session";

const $ = (selector) => document.querySelector(selector);

/* ---------- Utilidades de almacenamiento ---------- */
function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/* Guardamos un hash de la contraseña, nunca la contraseña en texto plano.
   (En un sistema real esto se hace en el servidor, con más protecciones.) */
async function hashPassword(text) {
  if (!window.crypto || !crypto.subtle) return text; // respaldo si el navegador no lo permite
  const data = new TextEncoder().encode(text);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const formatMoney = (amount) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(amount);

/* ---------- Mensajes ---------- */
function showMessage(text, type = "error", selector = "#auth-msg") {
  const msg = $(selector);
  msg.textContent = text;
  msg.className = `msg ${type}`;
}

/* ---------- Cambio de pantallas ---------- */
function showAuth() {
  selectedContact = null;
  $("#transfer-panel").hidden = true;
  setPanel(null, false);
  $("#chat-log").innerHTML = "";
  $("#app-view").hidden = true;
  $("#auth-view").hidden = false;
}

function showApp(user) {
  $("#auth-view").hidden = true;
  $("#app-view").hidden = false;
  $("#user-name").textContent = user.name;
  refreshDashboard(user);
}

/* ---------- Historial (vacío en la Fase 1) ---------- */
function renderTransactions(transactions) {
  const list = $("#tx-list");
  list.innerHTML = "";
  $("#tx-empty").hidden = transactions.length > 0;

  transactions.forEach((tx) => {
    const item = document.createElement("li");
    const sign = tx.amount >= 0 ? "in" : "out";

    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = tx.description;
    const date = document.createElement("div");
    date.className = "tx-date";
    date.textContent = `${tx.category} - ${formatDate(tx.timestamp)}`;
    info.append(title, date);

    const amount = document.createElement("span");
    amount.className = `tx-amount ${sign}`;
    amount.textContent = formatMoney(tx.amount);

    item.append(info, amount);
    list.append(item);
  });
}

/* ---------- Gastos: categorías, filtros, gráfico y análisis (Fase 2) ---------- */
const CATEGORY_COLORS = {
  Comida: "#2d5bff",
  Transporte: "#14c6a5",
  Servicios: "#f5a524",
  Entretenimiento: "#9b5de5",
  Otros: "#8792ab",
};

// days = cuántos días hacia atrás desde hoy (0 = solo hoy)
const RANGES = {
  daily: { days: 0, label: "de hoy" },
  weekly: { days: 6, label: "de esta semana" },
  monthly: { days: 29, label: "de este mes" },
};

let currentRange = "weekly";
let chart = null;

const formatDate = (iso) =>
  new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });

// Llenamos el selector de categorías desde CATEGORY_COLORS
Object.keys(CATEGORY_COLORS).forEach((name) => {
  $("#exp-cat").add(new Option(name, name));
});

function filterByRange(transactions, range) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - RANGES[range].days);
  return transactions.filter((tx) => new Date(tx.timestamp) >= start);
}

// Suma los gastos (montos negativos) por categoría
function totalsByCategory(transactions) {
  const totals = {};
  transactions.filter((tx) => tx.amount < 0 && CATEGORY_COLORS[tx.category]).forEach((tx) => {
    totals[tx.category] = (totals[tx.category] || 0) + Math.abs(tx.amount);
  });
  return totals;
}

function renderChart(totals) {
  const labels = Object.keys(totals);
  const canvas = $("#expense-chart");
  const hasData = labels.length > 0 && typeof Chart !== "undefined";
  canvas.hidden = !hasData;
  $("#chart-empty").hidden = hasData;
  if (chart) { chart.destroy(); chart = null; }
  if (!hasData) return;

  chart = new Chart(canvas, {
    type: currentChartType,
    data: {
      labels,
      datasets: [{
        data: labels.map((l) => totals[l]),
        backgroundColor: labels.map(chartColor),
        borderColor: cssVar("--card"),
        borderWidth: currentChartType === "bar" ? 0 : 2,
      }],
    },
    options: {
      plugins: {
        legend: { display: currentChartType !== "bar", position: "bottom" },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${formatMoney(ctx.parsed.y ?? ctx.parsed)}` } },
      },
      scales: currentChartType === "bar" ? { y: { beginAtZero: true } } : {},
    },
  });
}

function renderInsight(totals) {
  const entries = Object.entries(totals);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  const label = RANGES[currentRange].label;

  if (total === 0) {
    $("#insight").textContent = `Todavía no registraste gastos ${label}.`;
    return;
  }
  const [category, value] = entries.sort((a, b) => b[1] - a[1])[0];
  const percent = Math.round((value / total) * 100);
  $("#insight").textContent =
    `Aviso: Tu mayor gasto ${label} ha sido en '${category}' con un ${percent}% del total (${formatMoney(total)} en total).`;
}

// Vuelve a dibujar todo el panel con los datos actuales del usuario
function refreshDashboard(user = getUsers()[localStorage.getItem(SESSION_KEY)]) {
  ensureUserData(user);
  const visible = filterByRange(user.transactions, currentRange);
  const totals = totalsByCategory(visible);
  $("#balance-amount").textContent = hideBalance ? "***" : formatMoney(user.balance);
  renderTransactions(visible);
  renderChart(totals);
  renderInsight(totals);
  renderGoals(user);
  renderContacts(user);
  renderProfile(user);
  renderLoginLog(user);
}

document.querySelectorAll(".range-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentRange = btn.dataset.range;
    document.querySelectorAll(".range-tab").forEach((b) => b.classList.toggle("active", b === btn));
    refreshDashboard();
  });
});

$("#expense-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = parseFloat($("#exp-amount").value);
  const description = $("#exp-desc").value.trim();
  const category = $("#exp-cat").value;

  if (!(amount > 0) || !description) {
    return showMessage("Ingresá un monto mayor a 0 y una descripción.", "error", "#exp-msg");
  }

  const users = getUsers();
  const user = users[localStorage.getItem(SESSION_KEY)];
  if (amount > user.balance) {
    return showMessage("Saldo insuficiente para registrar este gasto.", "error", "#exp-msg");
  }
  user.balance = Math.round((user.balance - amount) * 100) / 100;
  user.transactions.unshift({ description, category, amount: -amount, timestamp: new Date().toISOString() });
  saveUsers(users);

  event.target.reset();
  showMessage("Gasto registrado.", "ok", "#exp-msg");
  refreshDashboard(user);
});

/* ---------- Fase 3: metas, rendimientos, contactos y perfil ---------- */
const YIELD_RATE = 0.04; // interés ficticio del 4%
let selectedContact = null;

// Crea un elemento con clase y texto (textContent evita inyectar HTML del usuario)
function el(tag, className = "", text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Generador pseudoaleatorio con semilla: mismo dato de entrada, mismo resultado
function seededRandom(seed) {
  let h = 1779033703;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 3432918353);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Completa los datos nuevos en usuarios creados en fases anteriores
function ensureUserData(user) {
  user.goals = user.goals || [];
  user.contacts = user.contacts || [];
  user.loginLog = user.loginLog || [];
  if (!user.alias) {
    const base = user.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
    user.alias = `${base}.bv`;
  }
  if (!user.cvu) {
    const rand = seededRandom(user.email);
    user.cvu = Array.from({ length: 22 }, () => Math.floor(rand() * 10)).join("");
  }
  return user;
}

// Suma o resta al saldo y deja el registro en el historial
function addTransaction(user, description, category, amount) {
  user.balance = Math.round((user.balance + amount) * 100) / 100;
  user.transactions.unshift({ description, category, amount, timestamp: new Date().toISOString() });
}

// Aplica un cambio al usuario actual y guarda. Si `change` devuelve un texto, es un error y no se guarda nada.
function updateUser(change, msgSelector) {
  const users = getUsers();
  const user = ensureUserData(users[localStorage.getItem(SESSION_KEY)]);
  const error = change(user);
  if (error) {
    showMessage(error, "error", msgSelector);
    return false;
  }
  saveUsers(users);
  refreshDashboard(user);
  return true;
}

/* --- Metas --- */
function renderGoals(user) {
  const list = $("#goal-list");
  list.innerHTML = "";
  $("#goal-empty").hidden = user.goals.length > 0;

  user.goals.forEach((goal, index) => {
    const percent = Math.min(100, Math.round((goal.saved / goal.target) * 100));
    const item = el("li", "goal");

    const head = el("div", "goal-head");
    head.append(el("strong", "", goal.name), el("span", "goal-amounts", `${formatMoney(goal.saved)} de ${formatMoney(goal.target)}`));

    const bar = el("div", "bar");
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    bar.setAttribute("aria-valuenow", percent);
    const fill = el("div", "bar-fill");
    fill.style.width = `${percent}%`;
    bar.append(fill);

    const form = el("form", "goal-add");
    form.dataset.index = index;
    const input = el("input");
    input.type = "number";
    input.min = "0.01";
    input.step = "0.01";
    input.placeholder = "Monto a aportar";
    input.setAttribute("aria-label", `Monto a aportar a ${goal.name}`);
    const button = el("button", "btn-ghost", "Aportar");
    button.type = "submit";
    form.append(input, button);

    item.append(head, bar, el("p", "goal-pct", `${percent}% completado`), form);
    list.append(item);
  });
}

$("#goal-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("#goal-name").value.trim();
  const target = parseFloat($("#goal-target").value);
  if (!name || !(target > 0)) {
    return showMessage("Ingresá un nombre y un monto meta mayor a 0.", "error", "#goal-msg");
  }
  updateUser((user) => { user.goals.push({ name, target, saved: 0 }); }, "#goal-msg");
  event.target.reset();
  showMessage("Meta creada.", "ok", "#goal-msg");
});

// Un solo "oyente" para todos los formularios de aporte (delegación de eventos)
$("#goal-list").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  const index = Number(form.dataset.index);
  const amount = parseFloat(form.querySelector("input").value);
  if (!(amount > 0)) return showMessage("Ingresá un monto mayor a 0.", "error", "#goal-msg");

  const done = updateUser((user) => {
    if (amount > user.balance) return "Saldo insuficiente para este aporte.";
    const goal = user.goals[index];
    goal.saved = Math.round((goal.saved + amount) * 100) / 100;
    addTransaction(user, `Aporte a la meta: ${goal.name}`, "Metas", -amount);
  }, "#goal-msg");
  if (done) showMessage("Aporte realizado.", "ok", "#goal-msg");
});

/* --- Cargar saldo y simular rendimiento --- */
$("#topup-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = parseFloat($("#topup-amount").value);
  if (!(amount > 0)) return showMessage("Ingresá un monto mayor a 0.", "error", "#balance-msg");
  updateUser((user) => { addTransaction(user, "Carga de saldo", "Ingresos", amount); }, "#balance-msg");
  event.target.reset();
  showMessage("Saldo cargado.", "ok", "#balance-msg");
});

$("#yield-btn").addEventListener("click", () => {
  let gain = 0;
  const done = updateUser((user) => {
    gain = Math.round(user.balance * YIELD_RATE * 100) / 100;
    if (!(gain > 0)) return "No tenés saldo libre para generar rendimientos.";
    addTransaction(user, `Rendimientos (${YIELD_RATE * 100}%)`, "Rendimientos", gain);
  }, "#balance-msg");
  if (done) showMessage(`Pasó el tiempo: ganaste ${formatMoney(gain)} de rendimiento.`, "ok", "#balance-msg");
});

/* --- Contactos y transferencias --- */
function renderContacts(user) {
  const list = $("#contact-list");
  list.innerHTML = "";
  $("#contact-empty").hidden = user.contacts.length > 0;

  user.contacts.forEach((contact, index) => {
    const item = el("li");
    const button = el("button", index === selectedContact ? "contact selected" : "contact");
    button.type = "button";
    button.append(el("strong", "", contact.name), el("span", "", contact.alias));
    button.addEventListener("click", () => {
      selectedContact = index;
      $("#transfer-title").textContent = `Transferir a ${contact.name}`;
      $("#transfer-panel").hidden = false;
      $("#transfer-amount").focus();
      refreshDashboard();
    });
    item.append(button);
    list.append(item);
  });
}

$("#contact-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("#contact-name").value.trim();
  const alias = $("#contact-alias").value.trim();
  if (!name || !alias) return showMessage("Completá el nombre y el alias o CVU.", "error", "#contact-msg");
  updateUser((user) => { user.contacts.push({ name, alias }); }, "#contact-msg");
  event.target.reset();
  showMessage("Contacto guardado.", "ok", "#contact-msg");
});

$("#transfer-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = parseFloat($("#transfer-amount").value);
  if (!(amount > 0)) return showMessage("Ingresá un monto mayor a 0.", "error", "#contact-msg");

  let name = "";
  const done = updateUser((user) => {
    const contact = user.contacts[selectedContact];
    if (!contact) return "Elegí un contacto primero.";
    if (amount > user.balance) return "Saldo insuficiente para esta transferencia.";
    name = contact.name;
    addTransaction(user, `Transferencia enviada a ${contact.name}`, "Transferencias", -amount);
  }, "#contact-msg");
  if (done) {
    event.target.reset();
    showMessage(`Enviaste ${formatMoney(amount)} a ${name}.`, "ok", "#contact-msg");
  }
});

$("#transfer-cancel").addEventListener("click", () => {
  selectedContact = null;
  $("#transfer-panel").hidden = true;
  refreshDashboard();
});

/* --- Mi perfil y QR ilustrativo --- */
function buildFakeQR(seed) {
  const n = 25, cell = 6, rand = seededRandom(seed);
  const inFinder = (x, y) => (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
  let shapes = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!inFinder(x, y) && rand() > 0.52) {
        shapes += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}"/>`;
      }
    }
  }
  // Los tres cuadrados de esquina que caracterizan a un QR
  [[0, 0], [n - 7, 0], [0, n - 7]].forEach(([x, y]) => {
    shapes += `<rect x="${(x + 0.5) * cell}" y="${(y + 0.5) * cell}" width="${6 * cell}" height="${6 * cell}" fill="none" stroke="currentColor" stroke-width="${cell}"/>`;
    shapes += `<rect x="${(x + 2) * cell}" y="${(y + 2) * cell}" width="${3 * cell}" height="${3 * cell}"/>`;
  });
  return `<svg viewBox="0 0 ${n * cell} ${n * cell}" fill="currentColor" role="img" aria-label="Código QR ilustrativo">${shapes}</svg>`;
}

function renderProfile(user) {
  $("#profile-name").textContent = user.name;
  $("#profile-alias").textContent = user.alias;
  $("#profile-cvu").textContent = user.cvu;
  $("#qr").innerHTML = buildFakeQR(user.cvu);
}

/* --- Navegación entre secciones --- */
document.querySelectorAll(".nav-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".nav-tab").forEach((t) => t.classList.toggle("active", t === tab));
    document.querySelectorAll(".panel").forEach((p) => { p.hidden = p.dataset.panel !== tab.dataset.panel; });
    if (chart) chart.resize();
  });
});

/* ---------- Fase 4: ajustes, modo oscuro y asistente financiero ---------- */
const THEME_KEY = "bv_theme";
const PANELS = [
  { panel: "#chat-panel", button: "#chat-fab" },
  { panel: "#settings-panel", button: "#settings-fab" },
];

// Abre el panel indicado y cierra el otro. setPanel(null, false) cierra todos.
function setPanel(target, open) {
  PANELS.forEach(({ panel, button }) => {
    const show = panel === target && open;
    $(panel).hidden = !show;
    $(button).setAttribute("aria-expanded", String(show));
  });
}

PANELS.forEach(({ panel, button }) => {
  $(button).addEventListener("click", () => {
    const opening = $(panel).hidden;
    setPanel(panel, opening);
    if (opening && panel === "#chat-panel") openChat();
  });
});

document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => setPanel(btn.dataset.close, false));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setPanel(null, false);
});

/* --- Modo oscuro (se recuerda en localStorage) --- */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $("#dark-toggle").checked = theme === "dark";
  if (typeof Chart !== "undefined") {
    Chart.defaults.color = theme === "dark" ? "#9aa6c7" : "#666666";
    Chart.defaults.borderColor = theme === "dark" ? "#27345f" : "rgba(0, 0, 0, 0.1)";
  }
  if (!$("#app-view").hidden) refreshDashboard(); // redibuja el gráfico con los colores nuevos
}

$("#dark-toggle").addEventListener("change", (event) => {
  const theme = event.target.checked ? "dark" : "light";
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
});

applyTheme(
  localStorage.getItem(THEME_KEY) || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
);

/* --- Chatbot: reglas simples que leen los datos del usuario --- */
const BOT_INTENTS = [
  [/\b(hola|buenas|buen dia|buenos dias)\b/, (u) =>
    `¡Hola, ${u.name.split(" ")[0]}! ¿Qué querés revisar: tu saldo, tus ahorros, tus gastos o tus transferencias?`],

  [/transfer|envi|contacto/, (u) => {
    const sent = u.transactions.filter((t) => t.category === "Transferencias");
    if (!sent.length) {
      return u.contacts.length
        ? `Tenés ${u.contacts.length} contacto(s) guardado(s), pero todavía no hiciste transferencias. Elegí uno en la sección Contactos.`
        : "Todavía no hiciste transferencias. Guardá un contacto en la sección Contactos para empezar.";
    }
    const total = sent.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    return `Hiciste ${sent.length} transferencia(s) por ${formatMoney(total)} en total. La última: ${sent[0].description} (${formatMoney(Math.abs(sent[0].amount))}).`;
  }],

  [/saldo|cuanto tengo|dinero disponible|plata/, (u) => {
    if (hideBalance) return "Tenés activado el modo incógnito, así que no te muestro el saldo. Podés desactivarlo en Ajustes.";
    const inGoals = u.goals.reduce((sum, g) => sum + g.saved, 0);
    let text = `Tu saldo disponible es ${formatMoney(u.balance)}.`;
    if (inGoals > 0) text += ` Además tenés ${formatMoney(inGoals)} apartados en tus metas.`;
    if (u.balance <= 0) text += " Podés sumar dinero con el botón «Cargar saldo».";
    return text;
  }],

  [/ahorr|meta/, (u) => {
    if (!u.goals.length) return "Todavía no tenés metas de ahorro. Creá una en la sección Metas y andá aportando desde tu saldo.";
    const lines = u.goals.map((g) => {
      const percent = Math.min(100, Math.round((g.saved / g.target) * 100));
      return `• ${g.name}: ${percent}% (${formatMoney(g.saved)} de ${formatMoney(g.target)})`;
    });
    return `Así van tus metas:\n${lines.join("\n")}`;
  }],

  [/gast|categoria|se me va/, (u) => {
    const totals = totalsByCategory(filterByRange(u.transactions, "weekly"));
    const entries = Object.entries(totals);
    const total = entries.reduce((sum, [, value]) => sum + value, 0);
    if (!total) return "Esta semana todavía no registraste gastos.";
    const [category, value] = entries.sort((a, b) => b[1] - a[1])[0];
    return `Esta semana gastaste ${formatMoney(total)}. Lo que más pesa es «${category}», con el ${Math.round((value / total) * 100)}%.`;
  }],

  [/rendimiento|interes|invert/, (u) => {
    const gains = u.transactions.filter((t) => t.category === "Rendimientos");
    const total = gains.reduce((sum, t) => sum + t.amount, 0);
    return `El rendimiento ficticio es del ${YIELD_RATE * 100}% sobre tu saldo libre. ` +
      (gains.length ? `Ya acumulaste ${formatMoney(total)}.` : "Probalo con el botón «Simular rendimiento».");
  }],

  [/ayuda|que podes|que sabes|opciones/, () =>
    "Puedo contarte sobre:\n• Tu saldo\n• Tus metas de ahorro\n• Tus transferencias\n• En qué gastás más\n• Los rendimientos"],
];

function botReply(text) {
  const user = ensureUserData(getUsers()[localStorage.getItem(SESSION_KEY)]);
  const clean = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const match = BOT_INTENTS.find(([pattern]) => pattern.test(clean));
  return match
    ? match[1](user)
    : "No estoy seguro de haber entendido. Probá preguntarme por tu saldo, ahorros, transferencias o gastos.";
}

function addChatMessage(text, who) {
  const log = $("#chat-log");
  log.append(el("div", `chat-msg ${who}`, text));
  log.scrollTop = log.scrollHeight;
}

function sendChat(text) {
  addChatMessage(text, "user");
  setTimeout(() => addChatMessage(botReply(text), "bot"), 400); // pequeña pausa para que se sienta natural
}

function openChat() {
  if (!$("#chat-log").children.length) {
    const user = ensureUserData(getUsers()[localStorage.getItem(SESSION_KEY)]);
    addChatMessage(`¡Hola, ${user.name.split(" ")[0]}! Soy tu asistente financiero. Preguntame por tu saldo, tus ahorros, tus gastos o tus transferencias.`, "bot");
  }
  $("#chat-input").focus();
}

$("#chat-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const text = $("#chat-input").value.trim();
  if (!text) return;
  event.target.reset();
  sendChat(text);
});

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => sendChat(chip.dataset.q));
});

/* ---------- Fase 5: temas de color, estilo de gráfico, privacidad y reinicio ---------- */
const ACCENT_KEY = "bv_accent";
const CHART_KEY = "bv_chart";
const HIDE_KEY = "bv_hide";
const ACCENTS = ["blue", "green", "violet"];
const CHART_TYPES = ["pie", "doughnut", "bar"];

const readPref = (key, valid, fallback) => {
  const value = localStorage.getItem(key);
  return valid.includes(value) ? value : fallback;
};
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
// El color de cada categoría sale de las variables --c1…--c5 del tema activo
const chartColor = (category) => cssVar(`--c${Object.keys(CATEGORY_COLORS).indexOf(category) + 1}`);

let currentChartType = readPref(CHART_KEY, CHART_TYPES, "pie");
let hideBalance = localStorage.getItem(HIDE_KEY) === "1";

/* --- Tema de color --- */
function applyAccent(accent) {
  document.documentElement.dataset.accent = accent; // el CSS hace el resto con [data-accent]
  document.querySelectorAll(".swatch").forEach((swatch) => {
    const active = swatch.dataset.accent === accent;
    swatch.classList.toggle("active", active);
    swatch.setAttribute("aria-checked", String(active));
  });
  if (!$("#app-view").hidden) refreshDashboard(); // el gráfico toma los colores nuevos
}

document.querySelectorAll(".swatch").forEach((swatch) => {
  swatch.addEventListener("click", () => {
    localStorage.setItem(ACCENT_KEY, swatch.dataset.accent);
    applyAccent(swatch.dataset.accent);
  });
});
applyAccent(readPref(ACCENT_KEY, ACCENTS, "blue"));

/* --- Estilo del gráfico (renderChart destruye y vuelve a crear el gráfico) --- */
$("#chart-type").value = currentChartType;
$("#chart-type").addEventListener("change", (event) => {
  currentChartType = event.target.value;
  localStorage.setItem(CHART_KEY, currentChartType);
  refreshDashboard();
});

/* --- Modo incógnito --- */
$("#hide-toggle").checked = hideBalance;
$("#hide-toggle").addEventListener("change", (event) => {
  hideBalance = event.target.checked;
  localStorage.setItem(HIDE_KEY, hideBalance ? "1" : "0");
  refreshDashboard();
});

/* --- Restablecer aplicación: borra solo las claves de esta app (prefijo "bv_") --- */
$("#reset-btn").addEventListener("click", () => {
  const ok = confirm("Esto borra TODAS las cuentas, movimientos, metas y contactos de prueba y deja la aplicación en cero. ¿Querés continuar?");
  if (!ok) return;
  Object.keys(localStorage)
    .filter((key) => key.startsWith("bv_"))
    .forEach((key) => localStorage.removeItem(key));
  location.reload();
});

/* ---------- Fase 6: seguridad de la cuenta ---------- */
const MAX_RECOVER_ATTEMPTS = 3;
let recoverEmail = null;
let recoverAttempts = 0;

// Compara respuestas sin importar mayúsculas, tildes ni espacios sobrantes
function normalizeAnswer(text) {
  return text.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/* --- Recuperar contraseña (3 pasos: correo → pregunta → nueva contraseña) --- */
function showRecoverStep(step) {
  ["email", "answer", "password"].forEach((name) => {
    $(`#recover-${name}-form`).hidden = name !== step;
  });
}

function openRecover() {
  recoverEmail = null;
  recoverAttempts = 0;
  document.querySelectorAll("#recover-view form").forEach((form) => form.reset());
  $(".tabs").hidden = true;
  $("#login-form").hidden = true;
  $("#register-form").hidden = true;
  $("#recover-view").hidden = false;
  showRecoverStep("email");
  showMessage("");
  $("#recover-email").focus();
}

function closeRecover(message, type = "ok") {
  recoverEmail = null;
  recoverAttempts = 0;
  $("#recover-view").hidden = true;
  $(".tabs").hidden = false;
  document.querySelector('[data-tab="login"]').click(); // vuelve al login y limpia el mensaje
  if (message) showMessage(message, type);
}

$("#forgot-link").addEventListener("click", openRecover);
$("#recover-back").addEventListener("click", () => closeRecover());

// Paso 1: buscar la cuenta por correo y mostrar su pregunta
$("#recover-email-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const email = $("#recover-email").value.trim().toLowerCase();
  const user = getUsers()[email];
  if (!user) return showMessage("No encontramos una cuenta con ese correo.");
  if (!user.secQuestion) {
    return showMessage("Esta cuenta se creó antes de la recuperación y no tiene pregunta de seguridad.");
  }
  recoverEmail = email;
  $("#recover-question").textContent = user.secQuestion;
  showRecoverStep("answer");
  showMessage("");
  $("#recover-answer").focus();
});

// Paso 2: verificar la respuesta (máximo 3 intentos)
$("#recover-answer-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!recoverEmail) return;
  const user = getUsers()[recoverEmail];
  const given = await hashPassword(normalizeAnswer($("#recover-answer").value));

  if (given !== user.secAnswerHash) {
    recoverAttempts++;
    if (recoverAttempts >= MAX_RECOVER_ATTEMPTS) {
      return closeRecover("Demasiados intentos fallidos. Volvé a empezar la recuperación.", "error");
    }
    return showMessage(`Respuesta incorrecta. Te quedan ${MAX_RECOVER_ATTEMPTS - recoverAttempts} intento(s).`);
  }
  event.target.reset();
  showRecoverStep("password");
  showMessage("Respuesta correcta. Elegí tu nueva contraseña.", "ok");
  $("#recover-new").focus();
});

// Paso 3: guardar la nueva contraseña
$("#recover-password-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!recoverEmail) return;
  const next = $("#recover-new").value;
  if (next.length < 6) return showMessage("La contraseña debe tener al menos 6 caracteres.");
  if (next !== $("#recover-confirm").value) return showMessage("Las contraseñas no coinciden.");

  const users = getUsers();
  users[recoverEmail].passHash = await hashPassword(next);
  saveUsers(users);
  closeRecover("Contraseña actualizada. Ya podés ingresar con la nueva.");
});

/* --- Cambiar contraseña desde Ajustes --- */
$("#pw-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const current = $("#pw-current").value;
  const next = $("#pw-new").value;
  const confirmation = $("#pw-confirm").value;
  const fail = (text) => showMessage(text, "error", "#pw-msg");

  if (!current || !next || !confirmation) return fail("Completá los tres campos.");

  const users = getUsers();
  const user = users[localStorage.getItem(SESSION_KEY)];
  if (user.passHash !== (await hashPassword(current))) return fail("La contraseña actual es incorrecta.");
  if (next.length < 6) return fail("La nueva contraseña debe tener al menos 6 caracteres.");
  if (next !== confirmation) return fail("La confirmación no coincide con la nueva contraseña.");
  if (next === current) return fail("La nueva contraseña debe ser distinta a la actual.");

  user.passHash = await hashPassword(next);
  saveUsers(users);
  event.target.reset();
  showMessage("¡Contraseña actualizada con éxito!", "ok", "#pw-msg");
});

/* --- Registro de actividad: últimos 3 inicios de sesión --- */
function renderLoginLog(user) {
  const list = $("#login-log");
  list.innerHTML = "";
  user.loginLog.forEach((date, index) => {
    const item = el("li");
    item.append(el("span", "", date));
    if (index === 0) item.append(el("span", "badge", "Sesión actual"));
    list.append(item);
  });
}

/* ---------- Pestañas Ingresar / Crear cuenta ---------- */
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const isLogin = tab.dataset.tab === "login";
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tab));
    $("#login-form").hidden = !isLogin;
    $("#register-form").hidden = isLogin;
    showMessage("");
  });
});

/* ---------- Registro ---------- */
$("#register-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = $("#reg-name").value.trim();
  const email = $("#reg-email").value.trim().toLowerCase();
  const password = $("#reg-pass").value;
  const question = $("#reg-question").value;
  const answer = $("#reg-answer").value;

  if (!name || !email || !password) return showMessage("Completá todos los campos.");
  if (!question) return showMessage("Elegí una pregunta de seguridad.");
  if (normalizeAnswer(answer).length < 2) return showMessage("La respuesta secreta debe tener al menos 2 caracteres.");
  if (!/^\S+@\S+\.\S+$/.test(email)) return showMessage("Ingresá un correo válido.");
  if (password.length < 6) return showMessage("La contraseña debe tener al menos 6 caracteres.");

  const users = getUsers();
  if (users[email]) return showMessage("Ya existe una cuenta con ese correo.");

  users[email] = {
    name,
    email,
    passHash: await hashPassword(password),
    secQuestion: question,
    secAnswerHash: await hashPassword(normalizeAnswer(answer)), // la respuesta también se guarda con hash
    loginLog: [],
    balance: 0,
    transactions: [],
  };
  saveUsers(users);

  event.target.reset();
  document.querySelector('[data-tab="login"]').click();
  showMessage("Cuenta creada. Ya podés ingresar.", "ok");
});

/* ---------- Login ---------- */
$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = $("#login-email").value.trim().toLowerCase();
  const password = $("#login-pass").value;

  const user = getUsers()[email];
  if (!user || user.passHash !== (await hashPassword(password))) {
    return showMessage("Correo o contraseña incorrectos.");
  }

  const users = getUsers();
  const account = ensureUserData(users[email]);
  account.loginLog = [new Date().toLocaleString("es-AR"), ...account.loginLog].slice(0, 3);
  saveUsers(users);

  localStorage.setItem(SESSION_KEY, email);
  event.target.reset();
  showMessage("");
  showApp(account);
});

/* ---------- Cerrar sesión ---------- */
$("#logout-btn").addEventListener("click", () => {
  localStorage.removeItem(SESSION_KEY);
  showAuth();
});

/* ---------- Al cargar la página: ¿hay sesión activa? ---------- */
const activeUser = getUsers()[localStorage.getItem(SESSION_KEY)];
activeUser ? showApp(activeUser) : showAuth();
