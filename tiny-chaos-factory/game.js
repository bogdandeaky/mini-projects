/* Tiny Chaos Factory v2 */

const audio = { ctx: null, muted: false };

function loadMuted() {
  try { return localStorage.getItem("tiny-chaos-factory-muted") === "1"; } catch { return false; }
}
function saveMuted() {
  try { localStorage.setItem("tiny-chaos-factory-muted", audio.muted ? "1" : "0"); } catch { /* ignore */ }
}
function ensureAudio() {
  if (audio.ctx || audio.muted) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  audio.ctx = new AC();
}
function playTone({ freq = 440, duration = 0.08, type = "sine", volume = 0.035, slideTo = null, when = 0 }) {
  if (audio.muted || !audio.ctx) return;
  const t0 = audio.ctx.currentTime + when;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + duration);
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain);
  gain.connect(audio.ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}
function playNoise({ duration = 0.18, volume = 0.05, when = 0 }) {
  if (audio.muted || !audio.ctx) return;
  const t0 = audio.ctx.currentTime + when;
  const bufferSize = Math.floor(audio.ctx.sampleRate * duration);
  const buffer = audio.ctx.createBuffer(1, bufferSize, audio.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const source = audio.ctx.createBufferSource();
  const gain = audio.ctx.createGain();
  const filter = audio.ctx.createBiquadFilter();
  source.buffer = buffer;
  filter.type = "lowpass";
  filter.frequency.value = 900;
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audio.ctx.destination);
  source.start(t0);
}
function initAudio() {
  audio.muted = loadMuted();
  ensureAudio();
  if (audio.ctx?.state === "suspended") audio.ctx.resume();
}
function toggleMute() {
  audio.muted = !audio.muted;
  saveMuted();
  if (!audio.muted) ensureAudio();
  return audio.muted;
}
function isMuted() { return audio.muted; }

function sfxDeliver(combo = 1) {
  const bump = Math.min(combo, 6) * 30;
  playTone({ freq: 520 + bump, slideTo: 880 + bump, duration: 0.12, volume: 0.04 });
  playTone({ freq: 880 + bump, slideTo: 1320 + bump, duration: 0.1, volume: 0.028, when: 0.05, type: "triangle" });
}
function sfxSoup() {
  playNoise({ duration: 0.22, volume: 0.07 });
  playTone({ freq: 180, slideTo: 60, duration: 0.2, type: "sawtooth", volume: 0.03 });
}
function sfxMachine() { playTone({ freq: 320, slideTo: 420, duration: 0.05, volume: 0.025, type: "square" }); }
function sfxPlace() { playTone({ freq: 240, duration: 0.04, volume: 0.022, type: "triangle" }); }
function sfxReject() { playTone({ freq: 160, slideTo: 90, duration: 0.1, type: "sawtooth", volume: 0.028 }); }
function sfxStart() {
  [440, 554, 659, 880].forEach((freq, i) => playTone({ freq, duration: 0.08, volume: 0.03, when: i * 0.05, type: "triangle" }));
}
function sfxEnd(record) {
  if (record) {
    playTone({ freq: 660, slideTo: 990, duration: 0.16, volume: 0.04 });
    playTone({ freq: 990, slideTo: 1320, duration: 0.18, volume: 0.035, when: 0.08 });
    [0, 0.12, 0.24].forEach((when) => playTone({ freq: 880, duration: 0.06, volume: 0.025, when, type: "triangle" }));
    return;
  }
  playTone({ freq: 440, slideTo: 220, duration: 0.22, volume: 0.03, type: "sawtooth" });
}
function sfxSlowMo() { playTone({ freq: 990, slideTo: 440, duration: 0.25, volume: 0.03, type: "triangle" }); }
function sfxCrowded() { playTone({ freq: 130, duration: 0.12, volume: 0.03, type: "sawtooth" }); }

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const comboEl = document.getElementById("combo");
const deliveredEl = document.getElementById("delivered");
const chaosEl = document.getElementById("chaos");
const timeEl = document.getElementById("time");
const targetEl = document.getElementById("target");
const targetNextEl = document.getElementById("target-next");
const bestScoreEl = document.getElementById("best-score");
const messageEl = document.getElementById("message");
const startBtn = document.getElementById("start");
const resetBtn = document.getElementById("reset");
const slowmoBtn = document.getElementById("slowmo");
const muteBtn = document.getElementById("mute");
const phaseBanner = document.getElementById("phase-banner");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayBody = document.getElementById("overlay-body");
const overlayStars = document.getElementById("overlay-stars");
const overlayStats = document.getElementById("overlay-stats");
const overlayAction = document.getElementById("overlay-action");
const overlayAbout = document.getElementById("overlay-about");
const whyBtn = document.getElementById("why-btn");
const toolButtons = [...document.querySelectorAll(".tool")];

const COLORS = { gray: "#8d8aa3", red: "#ff5c7a", blue: "#5cb4ff", green: "#7dffb2", yellow: "#ffe27a" };
const COLOR_NAMES = ["red", "blue", "green", "yellow"];
const STATS_KEY = "tiny-chaos-factory-stats-v2";
const SLOT_COUNT = 5;
const BELT_Y = 230;
const BELT_LEFT = 80;
const BELT_RIGHT = 880;
const EXIT_X = BELT_RIGHT + 20;
const REJECT_X = 790;
const REJECT_W = 70;
const SLOT_SPACING = (BELT_RIGHT - BELT_LEFT) / (SLOT_COUNT + 1);
const SETUP_SECONDS = 8;
const RUN_SECONDS = 60;
const SLOWMO_SECONDS = 5;

const SOUP_LINES = [
  "Wrong blob. Minor soup.",
  "That blob had dreams.",
  "Soup happens.",
  "The exit wanted better.",
  "Chaos +1. Oops.",
];

const COMBO_LINES = ["", "Nice!", "Clean line!", "Chef's kiss!", "Soup wizard!", "Factory legend!"];

const state = {
  phase: "menu",
  running: false,
  score: 0,
  delivered: 0,
  chaos: 0,
  combo: 0,
  bestComboRun: 0,
  timeLeft: RUN_SECONDS,
  setupLeft: SETUP_SECONDS,
  spawnEvery: 3.2,
  overloadWarned: false,
  spawnTimer: 0,
  blobs: [],
  particles: [],
  floatTexts: [],
  slots: Array(SLOT_COUNT).fill(null),
  slotPulse: Array(SLOT_COUNT).fill(0),
  selectedTool: "cutter",
  selectedPaintColor: "blue",
  orders: [],
  lastFrame: 0,
  shake: 0,
  flash: 0,
  beltOffset: 0,
  exitGlow: 0,
  slowMoLeft: 0,
  slowMoUses: 1,
  attractBlobs: [],
  attractTimer: 0,
  menuTime: 0,
};

function randItem(list) { return list[Math.floor(Math.random() * list.length)]; }
function slotX(index) { return BELT_LEFT + SLOT_SPACING * (index + 1); }

function defaultStats() {
  return { bestScore: 0, bestDelivered: 0, bestCombo: 0, runs: 0, totalDelivered: 0 };
}

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return raw ? { ...defaultStats(), ...JSON.parse(raw) } : defaultStats();
  } catch {
    return defaultStats();
  }
}

function saveStats(data) {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

function updateBestUI(record = false) {
  const stats = loadStats();
  bestScoreEl.textContent = stats.bestScore.toString();
  bestScoreEl.parentElement.classList.toggle("record", record);
}

function formatTarget(target) {
  if (!target) return "—";
  if (target.color && target.shape) return `${target.color} ${target.shape}`;
  if (target.shape) return `${target.shape} (any color)`;
  if (target.color) return `${target.color} (any shape)`;
  return "anything";
}

function blobMatchesTarget(blob, target) {
  if (!target) return false;
  if (target.shape && blob.shape !== target.shape) return false;
  if (target.color && blob.color !== target.color) return false;
  return true;
}

function createTargetForProgress(delivered) {
  if (delivered < 3) return { color: null, shape: "square" };
  if (delivered < 7) return { color: randItem(COLOR_NAMES), shape: null };
  return { color: randItem(COLOR_NAMES), shape: randItem(["square", "triangle"]) };
}

function refillOrders() {
  while (state.orders.length < 2) {
    state.orders.push(createTargetForProgress(state.delivered + state.orders.length));
  }
  targetEl.textContent = formatTarget(state.orders[0]);
  targetNextEl.textContent = formatTarget(state.orders[1]);
}

function advanceOrder() {
  state.orders.shift();
  state.orders.push(createTargetForProgress(state.delivered + state.orders.length));
  targetEl.textContent = formatTarget(state.orders[0]);
  targetNextEl.textContent = formatTarget(state.orders[1]);
  targetEl.classList.add("pulse");
  window.setTimeout(() => targetEl.classList.remove("pulse"), 350);
}

function createMachine(tool) {
  if (tool === "cutter") return { type: "cutter" };
  if (tool === "flipper") return { type: "flipper" };
  if (tool === "painter") return { type: "painter", color: state.selectedPaintColor };
  return null;
}

function newBlob() {
  return {
    x: 20,
    y: BELT_Y,
    speed: 50 + Math.random() * 10,
    color: "gray",
    shape: "circle",
    wobble: Math.random() * Math.PI * 2,
    age: 0,
    pulse: 0,
    mood: "calm",
  };
}

function machineLabel(machine) {
  if (machine.type === "cutter") return "CUT";
  if (machine.type === "painter") return machine.color.toUpperCase();
  if (machine.type === "flipper") return "FLIP";
  return "?";
}

function applyMachine(blob, machine, slotIndex) {
  if (machine.type === "cutter") blob.shape = "square";
  if (machine.type === "painter") blob.color = machine.color;
  if (machine.type === "flipper") blob.shape = blob.shape === "square" ? "triangle" : "square";
  blob.wobble += 0.8;
  blob.pulse = 0.25;
  blob.mood = "dizzy";
  state.slotPulse[slotIndex] = 1;
  sfxMachine();
}

function spawnParticles(x, y, color, kind, count) {
  const total = count || (kind === "soup" ? 32 : kind === "confetti" ? 40 : 18);
  for (let i = 0; i < total; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = kind === "confetti" ? 60 + Math.random() * 180 : 120 + Math.random() * 220;
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (kind === "success" || kind === "confetti" ? 100 : 40),
      life: 0.45 + Math.random() * 0.55,
      age: 0,
      color: kind === "confetti" ? randItem(COLOR_NAMES) : color,
      size: kind === "soup" ? 5 + Math.random() * 9 : 3 + Math.random() * 6,
      kind,
    });
  }
}

function spawnFloatText(x, y, text, color = "#7dffb2") {
  state.floatTexts.push({ x, y, text, color, age: 0, life: 0.9 });
}

function drawShape(x, y, shape, color, scale = 1, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = COLORS[color] || color;
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  if (shape === "circle") {
    ctx.beginPath();
    ctx.arc(x, y, 16 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (shape === "square") {
    ctx.fillRect(x - 14 * scale, y - 14 * scale, 28 * scale, 28 * scale);
    ctx.strokeRect(x - 14 * scale, y - 14 * scale, 28 * scale, 28 * scale);
  } else {
    ctx.beginPath();
    ctx.moveTo(x, y - 17 * scale);
    ctx.lineTo(x + 16 * scale, y + 12 * scale);
    ctx.lineTo(x - 16 * scale, y + 12 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawBlobFace(x, y, blob, scale) {
  const scared = blob.mood === "scared" || blob.mood === "dizzy";
  const eyeY = y - 3 * scale;
  const eyeOffset = 5 * scale;
  ctx.fillStyle = "rgba(10, 8, 20, 0.85)";
  ctx.beginPath();
  ctx.arc(x - eyeOffset, eyeY, 2.3 * scale, 0, Math.PI * 2);
  ctx.arc(x + eyeOffset, eyeY, 2.3 * scale, 0, Math.PI * 2);
  ctx.fill();
  if (scared) {
    ctx.strokeStyle = "rgba(10, 8, 20, 0.85)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y + 8 * scale, 4 * scale, 0.1, Math.PI - 0.1);
    ctx.stroke();
  } else {
    ctx.fillRect(x - 3 * scale, y + 7 * scale, 6 * scale, 1.5 * scale);
  }
}

function drawBackground() {
  const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grd.addColorStop(0, "#171022");
  grd.addColorStop(1, "#0f0a18");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(132, 94, 255, 0.035)";
  for (let i = 0; i < 8; i += 1) {
    const x = ((state.menuTime * 20 + i * 120) % (canvas.width + 100)) - 50;
    ctx.fillRect(x, 40 + i * 42, 80, 2);
  }
}

function drawBelt() {
  ctx.fillStyle = "#241b33";
  ctx.fillRect(40, BELT_Y - 30, 880, 60);

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  for (let x = 60 + state.beltOffset; x < 900; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, BELT_Y - 18);
    ctx.lineTo(x + 12, BELT_Y - 18);
    ctx.stroke();
  }

  ctx.fillStyle = "#7dffb2";
  ctx.font = "bold 14px Segoe UI, sans-serif";
  ctx.fillText("IN", 44, BELT_Y + 5);

  ctx.fillStyle = "#ff5c7a";
  ctx.fillText("OUT", 900, BELT_Y + 5);

  ctx.fillStyle = "rgba(255, 226, 122, 0.12)";
  ctx.fillRect(REJECT_X, BELT_Y - 34, REJECT_W, 68);
  ctx.strokeStyle = "rgba(255, 226, 122, 0.45)";
  ctx.strokeRect(REJECT_X, BELT_Y - 34, REJECT_W, 68);
  ctx.fillStyle = "#ffe27a";
  ctx.font = "bold 11px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("REJECT", REJECT_X + REJECT_W / 2, BELT_Y - 12);
  ctx.fillText("CHUTE", REJECT_X + REJECT_W / 2, BELT_Y + 4);
  ctx.textAlign = "start";

  const target = state.orders[0];
  if (target && state.phase === "playing") {
    ctx.fillStyle = `rgba(125, 255, 178, ${0.08 + state.exitGlow * 0.12})`;
    ctx.fillRect(EXIT_X - 8, BELT_Y - 36, 36, 72);
    ctx.textAlign = "center";
    ctx.fillStyle = "#7dffb2";
    ctx.font = "10px Segoe UI, sans-serif";
    ctx.fillText("WANT", EXIT_X + 10, BELT_Y - 42);
    if (target.shape) drawShape(EXIT_X + 10, BELT_Y - 18, target.shape, target.color || "gray", 0.55, 0.9);
    ctx.textAlign = "start";
  }

  ctx.strokeStyle = `rgba(255, 92, 122, ${0.25 + state.exitGlow * 0.35})`;
  ctx.setLineDash([4, 8]);
  ctx.beginPath();
  ctx.moveTo(EXIT_X, BELT_Y - 36);
  ctx.lineTo(EXIT_X, BELT_Y + 36);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawSlots() {
  state.slots.forEach((machine, index) => {
    const x = slotX(index);
    const pulse = state.slotPulse[index] || 0;
    ctx.strokeStyle = `rgba(167, 137, 255, ${0.25 + pulse * 0.35})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(x - 34, BELT_Y - 54, 68, 108);
    ctx.setLineDash([]);
    if (!machine) return;

    ctx.fillStyle = `rgba(132, 94, 255, ${0.18 + pulse * 0.18})`;
    ctx.fillRect(x - 30, BELT_Y - 50, 60, 100);
    ctx.fillStyle = "#f4f0ff";
    ctx.font = "bold 13px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(machineLabel(machine), x, BELT_Y - 10);
    if (machine.type === "painter") drawShape(x, BELT_Y + 26, "circle", machine.color, 0.55);
    ctx.textAlign = "start";
    if (pulse > 0) state.slotPulse[index] = Math.max(0, pulse - 0.04);
  });
}

function drawBlobs(list) {
  list.forEach((blob) => {
    const bob = Math.sin(blob.wobble) * 3;
    const scale = blob.pulse > 0 ? 1 + blob.pulse * 0.25 : 1;
    drawShape(blob.x, blob.y + bob, blob.shape, blob.color, scale, blob.alpha ?? 1);
    drawBlobFace(blob.x, blob.y + bob, blob, scale);
    if (blob.pulse > 0) blob.pulse = Math.max(0, blob.pulse - 0.02);
  });
}

function drawParticles() {
  state.particles.forEach((p) => {
    const t = 1 - p.age / p.life;
    drawShape(p.x, p.y, p.kind === "soup" ? "circle" : "square", p.color, (p.size / 16) * (1 + (1 - t) * 0.4), t);
  });
}

function drawFloatTexts() {
  state.floatTexts.forEach((item) => {
    const t = 1 - item.age / item.life;
    ctx.fillStyle = item.color;
    ctx.globalAlpha = t;
    ctx.font = `bold ${18 + (1 - t) * 8}px Segoe UI, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(item.text, item.x, item.y - item.age * 42);
    ctx.globalAlpha = 1;
    ctx.textAlign = "start";
  });
}

function drawFlash() {
  if (state.flash <= 0) return;
  ctx.fillStyle = `rgba(255, 92, 122, ${state.flash * 0.22})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawSlowMoOverlay() {
  if (state.slowMoLeft <= 0) return;
  ctx.fillStyle = "rgba(92, 180, 255, 0.08)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#5cb4ff";
  ctx.font = "bold 14px Segoe UI, sans-serif";
  ctx.fillText(`SLOW-MO ${state.slowMoLeft.toFixed(1)}s`, 24, 28);
}

function drawMenuOverlay() {
  if (state.phase !== "menu") return;
  ctx.fillStyle = "rgba(10, 7, 18, 0.35)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.fillStyle = "#f4f0ff";
  ctx.font = "bold 28px Segoe UI, sans-serif";
  ctx.fillText("Tiny Chaos Factory", canvas.width / 2, 110);
  ctx.fillStyle = "#b9aed8";
  ctx.font = "16px Segoe UI, sans-serif";
  ctx.fillText("A toy about blobs, machines, and beautiful soup.", canvas.width / 2, 145);
  ctx.textAlign = "start";
}

function flashMessage(text, tone = "good") {
  messageEl.textContent = text;
  messageEl.style.color = tone === "bad" ? "#ff8da0" : tone === "chaos" ? "#ffe27a" : "#7dffb2";
}

function setPhaseBanner(text, visible) {
  phaseBanner.textContent = text;
  phaseBanner.classList.toggle("hidden", !visible);
}

function comboLabel(combo) {
  return COMBO_LINES[Math.min(combo, COMBO_LINES.length - 1)] || "Unreal.";
}

function calcStars() {
  if (state.delivered >= 12 && state.chaos <= 3) return 3;
  if (state.delivered >= 7 && state.chaos <= 7) return 2;
  if (state.delivered >= 3) return 1;
  return 0;
}

function showOverlay({ title, body, stars, statsHtml, actionText, hidden, showAbout = false }) {
  overlay.classList.toggle("hidden", hidden);
  overlayTitle.textContent = title;
  overlayBody.textContent = body;
  overlayAction.textContent = actionText;
  overlayStars.classList.toggle("hidden", stars == null);
  overlayStats.classList.toggle("hidden", !statsHtml);
  overlayAbout.classList.toggle("hidden", !showAbout);
  if (stars != null) overlayStars.textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
  if (statsHtml) overlayStats.innerHTML = statsHtml;
}

function showWhyOverlay() {
  state.phase = "menu";
  showOverlay({
    hidden: false,
    title: "Why this exists",
    body: "A small browser toy about machines, constraints, chaos, and soup.",
    showAbout: true,
    stars: null,
    statsHtml: null,
    actionText: "Back",
  });
}

function showMenuOverlay() {
  const stats = loadStats();
  showOverlay({
    hidden: false,
    title: "Welcome to the soup line",
    body: "8 seconds to wire your factory. Then survive 60 seconds of orders. Reject bad blobs. Slow-mo once if things get soupy.",
    stars: null,
    statsHtml: stats.runs
      ? `<div><span>Best score</span><span>${stats.bestScore}</span></div>
         <div><span>Best combo</span><span>${stats.bestCombo}</span></div>
         <div><span>Total delivered</span><span>${stats.totalDelivered}</span></div>`
      : null,
    actionText: "Start shift",
    showAbout: false,
  });
}

function finishRun(reason) {
  state.running = false;
  state.phase = "results";
  startBtn.disabled = false;
  slowmoBtn.disabled = true;
  setPhaseBanner("", false);

  const stats = loadStats();
  const record = state.score > stats.bestScore;
  stats.runs += 1;
  stats.totalDelivered += state.delivered;
  stats.bestScore = Math.max(stats.bestScore, state.score);
  stats.bestDelivered = Math.max(stats.bestDelivered, state.delivered);
  stats.bestCombo = Math.max(stats.bestCombo, state.bestComboRun);
  saveStats(stats);
  updateBestUI(record);

  const stars = calcStars();
  if (record) spawnParticles(canvas.width / 2, 120, "yellow", "confetti", 60);
  sfxEnd(record);

  showOverlay({
    hidden: false,
    title: record ? "NEW BEST!" : "Shift over",
    body: record
      ? "The factory remembers this glorious chaos."
      : `${reason} You kept the soup mostly under control. Mostly.`,
    stars,
    statsHtml: `
      <div><span>Score</span><span>${state.score}</span></div>
      <div><span>Delivered</span><span>${state.delivered}</span></div>
      <div><span>Chaos</span><span>${state.chaos}</span></div>
      <div><span>Best combo</span><span>${state.bestComboRun}</span></div>
    `,
    actionText: "Run again",
  });
}

function handleWrongBlob(blob) {
  state.chaos += 1;
  state.combo = 0;
  comboEl.textContent = "0";
  state.score = Math.max(0, state.score - 5);
  state.shake = 0.45;
  state.flash = 1;
  spawnParticles(EXIT_X, BELT_Y, blob.color, "soup");
  spawnFloatText(EXIT_X, BELT_Y - 20, "SOUP!", "#ff8da0");
  sfxSoup();
  flashMessage(randItem(SOUP_LINES), "bad");
}

function handleDelivery(blob) {
  state.combo += 1;
  state.bestComboRun = Math.max(state.bestComboRun, state.combo);
  const comboBonus = Math.min(5, state.combo - 1) * 25;
  const speedBonus = blob.age < 6 ? 40 : blob.age < 9 ? 20 : 0;
  const gained = 100 + comboBonus + speedBonus;
  state.score += gained;
  state.delivered += 1;
  state.exitGlow = 1;
  spawnParticles(EXIT_X, BELT_Y, state.orders[0]?.color || "green", "success");
  const bonusText = speedBonus ? `+${gained} FAST` : comboBonus ? `+${gained} x${state.combo}` : "+100";
  spawnFloatText(EXIT_X, BELT_Y - 24, bonusText, "#7dffb2");
  sfxDeliver(state.combo);
  flashMessage(comboLabel(state.combo), "good");
  advanceOrder();
}

function rejectBlobAt(x, y) {
  if (state.phase !== "playing" || x < REJECT_X || x > REJECT_X + REJECT_W || Math.abs(y - BELT_Y) > 40) return false;
  let closest = null;
  let closestDist = Infinity;
  state.blobs.forEach((blob) => {
    const dist = Math.abs(blob.x - (REJECT_X + REJECT_W / 2));
    if (dist < closestDist && blob.x > BELT_LEFT) {
      closest = blob;
      closestDist = dist;
    }
  });
  if (!closest || closestDist > 50) return false;
  state.blobs = state.blobs.filter((b) => b !== closest);
  state.chaos += 1;
  state.combo = 0;
  comboEl.textContent = "0";
  spawnParticles(closest.x, BELT_Y, closest.color, "soup", 12);
  spawnFloatText(closest.x, BELT_Y - 18, "REJECTED", "#ffe27a");
  sfxReject();
  flashMessage("Blob rejected. Safer than soup.", "chaos");
  return true;
}

function getTimeScale() {
  return state.slowMoLeft > 0 ? 0.45 : 1;
}

function updateEffects(dt) {
  state.particles = state.particles.filter((p) => {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.kind === "soup" ? 520 * dt : 180 * dt;
    p.vx *= 0.98;
    return p.age < p.life;
  });
  state.floatTexts = state.floatTexts.filter((item) => {
    item.age += dt;
    return item.age < item.life;
  });
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 1.6);
  if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 2.4);
  if (state.exitGlow > 0) state.exitGlow = Math.max(0, state.exitGlow - dt * 1.8);
  if (state.slowMoLeft > 0) state.slowMoLeft = Math.max(0, state.slowMoLeft - dt);
  slowmoBtn.textContent = state.slowMoUses > 0 && state.phase === "playing"
    ? state.slowMoLeft > 0 ? `Slow-mo ${state.slowMoLeft.toFixed(1)}s` : "Slow-mo (1x)"
    : "Slow-mo (1x)";
  slowmoBtn.classList.toggle("ready", state.slowMoUses > 0 && state.phase === "playing" && state.slowMoLeft <= 0);
}

function updateAttract(dt) {
  state.menuTime += dt;
  state.attractTimer += dt;
  if (state.attractTimer > 1.8) {
    state.attractTimer = 0;
    state.attractBlobs.push(newBlob());
  }
  state.attractBlobs.forEach((blob) => {
    blob.wobble += dt * 5;
    blob.x += blob.speed * dt * 0.7;
    if (blob.x > EXIT_X) {
      blob.color = randItem(COLOR_NAMES);
      blob.shape = randItem(["circle", "square", "triangle"]);
      blob.x = 24;
    }
  });
  if (state.attractBlobs.length > 8) state.attractBlobs.shift();
}

function update(dt) {
  const scale = getTimeScale();
  const simDt = dt * scale;
  state.beltOffset = (state.beltOffset + simDt * 42) % 24;
  updateEffects(dt);

  if (state.phase === "menu") {
    updateAttract(simDt);
    return;
  }

  if (state.phase === "setup") {
    state.setupLeft -= dt;
    timeEl.textContent = Math.max(0, Math.ceil(state.setupLeft)).toString();
    if (state.setupLeft <= 0) {
      state.phase = "playing";
      state.timeLeft = RUN_SECONDS;
      setPhaseBanner("GO!", true);
      window.setTimeout(() => setPhaseBanner("", false), 900);
      flashMessage("Orders incoming. Match the ticket. Reject the rest.", "good");
    }
    return;
  }

  if (!state.running || state.phase !== "playing") return;

  state.timeLeft -= dt;
  timeEl.textContent = Math.max(0, Math.ceil(state.timeLeft)).toString();
  if (state.timeLeft <= 0) {
    finishRun("Time!");
    return;
  }

  state.spawnTimer += simDt;
  if (state.spawnTimer >= state.spawnEvery) {
    state.spawnTimer = 0;
    state.blobs.push(newBlob());
    state.spawnEvery = Math.max(1.7, state.spawnEvery - 0.01);
  }

  state.blobs.forEach((blob) => {
    blob.age += simDt;
    blob.wobble += simDt * 6;
    blob.x += blob.speed * simDt;
    blob.mood = blob.x > REJECT_X - 40 ? "scared" : blob.mood === "dizzy" ? "dizzy" : "calm";
  });

  state.slots.forEach((machine, index) => {
    if (!machine) return;
    const x = slotX(index);
    state.blobs.forEach((blob) => {
      if (Math.abs(blob.x - x) < 18 && !blob.processedAt?.includes(index)) {
        applyMachine(blob, machine, index);
        blob.processedAt = blob.processedAt || [];
        blob.processedAt.push(index);
      }
    });
  });

  for (let i = state.blobs.length - 1; i >= 0; i -= 1) {
    const blob = state.blobs[i];
    if (blob.x > EXIT_X) {
      if (blobMatchesTarget(blob, state.orders[0])) handleDelivery(blob);
      else handleWrongBlob(blob);
      state.blobs.splice(i, 1);
      scoreEl.textContent = state.score.toString();
      deliveredEl.textContent = state.delivered.toString();
      chaosEl.textContent = state.chaos.toString();
      comboEl.textContent = state.combo.toString();
    } else if (blob.x > 930) {
      state.blobs.splice(i, 1);
    }
  }

  if (state.blobs.length > 22 && !state.overloadWarned) {
    state.overloadWarned = true;
    state.shake = 0.25;
    spawnParticles(BELT_RIGHT - 40, BELT_Y, "yellow", "soup", 16);
    sfxCrowded();
    flashMessage("Crowded belt. Reject a blob or rethink the line.", "chaos");
  } else if (state.blobs.length <= 18) {
    state.overloadWarned = false;
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  ctx.save();
  if (state.shake > 0) {
    const amount = state.shake * 10;
    ctx.translate((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount);
  }
  drawBelt();
  drawSlots();
  if (state.phase === "menu") drawBlobs(state.attractBlobs);
  else drawBlobs(state.blobs);
  drawParticles();
  drawFloatTexts();
  drawFlash();
  drawSlowMoOverlay();
  drawMenuOverlay();
  ctx.restore();
}

function loop(timestamp) {
  const dt = Math.min(0.033, (timestamp - state.lastFrame) / 1000 || 0);
  state.lastFrame = timestamp;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function resetBelt() {
  state.blobs = [];
  state.particles = [];
  state.floatTexts = [];
  state.spawnEvery = 3.2;
  state.spawnTimer = 0;
  state.overloadWarned = false;
  state.combo = 0;
  state.shake = 0;
  state.flash = 0;
  state.exitGlow = 0;
}

function startRun() {
  initAudio();
  overlay.classList.add("hidden");
  resetBelt();
  state.phase = "setup";
  state.running = true;
  state.score = 0;
  state.delivered = 0;
  state.chaos = 0;
  state.combo = 0;
  state.bestComboRun = 0;
  state.setupLeft = SETUP_SECONDS;
  state.timeLeft = RUN_SECONDS;
  state.slowMoLeft = 0;
  state.slowMoUses = 1;
  state.orders = [];
  refillOrders();
  scoreEl.textContent = "0";
  deliveredEl.textContent = "0";
  chaosEl.textContent = "0";
  comboEl.textContent = "0";
  timeEl.textContent = SETUP_SECONDS.toString();
  startBtn.disabled = true;
  slowmoBtn.disabled = false;
  setPhaseBanner("SETUP — place your machines", true);
  sfxStart();
  flashMessage("Setup phase: place machines before blobs arrive.", "chaos");
}

function triggerSlowMo() {
  if (state.phase !== "playing" || state.slowMoUses <= 0 || state.slowMoLeft > 0) return;
  state.slowMoUses -= 1;
  state.slowMoLeft = SLOWMO_SECONDS;
  slowmoBtn.disabled = state.slowMoUses <= 0;
  sfxSlowMo();
  flashMessage("Slow-mo engaged. Think, don't soup.", "good");
}

function updatePainterUI() {
  const painterBtn = document.querySelector('[data-machine="painter"]');
  const swatches = document.getElementById("paint-colors");
  if (!painterBtn || !swatches) return;
  painterBtn.querySelector("small").textContent = `paints → ${state.selectedPaintColor}`;
  swatches.classList.toggle("hidden", state.selectedTool !== "painter");
  swatches.querySelectorAll("[data-color]").forEach((button) => {
    button.classList.toggle("active", button.dataset.color === state.selectedPaintColor);
  });
}

function updateMuteButton() {
  muteBtn.textContent = isMuted() ? "🔇 Muted" : "🔊 Sound";
}

function canvasToSlot(x) {
  return state.slots.findIndex((_, index) => Math.abs(x - slotX(index)) < 36);
}

canvas.addEventListener("touchstart", (event) => {
  event.preventDefault();
  const touch = event.touches[0];
  canvas.dispatchEvent(new MouseEvent("click", {
    clientX: touch.clientX,
    clientY: touch.clientY
  }));
}, { passive: false });

canvas.addEventListener("click", (event) => {
  if (state.phase === "menu") {
    startRun();
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * (canvas.width / rect.width);
  const y = (event.clientY - rect.top) * (canvas.height / rect.height);

  if (rejectBlobAt(x, y)) return;
  if (state.phase === "results") return;
  if (y < BELT_Y - 60 || y > BELT_Y + 60) return;

  const slotIndex = canvasToSlot(x);
  if (slotIndex < 0) return;

  if (state.selectedTool === "remove") {
    state.slots[slotIndex] = null;
    sfxPlace();
    flashMessage(`Removed machine from slot ${slotIndex + 1}.`, "chaos");
    return;
  }

  state.slots[slotIndex] = createMachine(state.selectedTool);
  sfxPlace();
  const machine = state.slots[slotIndex];
  const label = machine.type === "painter" ? `${machine.color} painter` : machine.type;
  flashMessage(`Placed ${label} in slot ${slotIndex + 1}.`, "good");
});

toolButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const tool = button.dataset.machine;
    if (tool === "painter" && state.selectedTool === "painter") {
      const index = COLOR_NAMES.indexOf(state.selectedPaintColor);
      state.selectedPaintColor = COLOR_NAMES[(index + 1) % COLOR_NAMES.length];
      updatePainterUI();
      sfxPlace();
      flashMessage(`Painter color: ${state.selectedPaintColor}`, "chaos");
      return;
    }
    toolButtons.forEach((b) => b.classList.remove("selected"));
    button.classList.add("selected");
    state.selectedTool = tool;
    updatePainterUI();
  });
});

document.querySelectorAll("#paint-colors [data-color]").forEach((button) => {
  button.addEventListener("click", () => {
    state.selectedTool = "painter";
    toolButtons.forEach((b) => b.classList.remove("selected"));
    document.querySelector('[data-machine="painter"]').classList.add("selected");
    state.selectedPaintColor = button.dataset.color;
    updatePainterUI();
    sfxPlace();
    flashMessage(`Painter set to ${button.dataset.color}`, "good");
  });
});

startBtn.addEventListener("click", startRun);
overlayAction.addEventListener("click", () => {
  if (state.phase === "menu" && overlayTitle.textContent === "Why this exists") {
    showMenuOverlay();
    return;
  }
  startRun();
});
whyBtn.addEventListener("click", showWhyOverlay);
resetBtn.addEventListener("click", () => {
  resetBelt();
  state.slots.fill(null);
  flashMessage("Belt cleared. Machines wiped. Fresh chaos.", "chaos");
});
slowmoBtn.addEventListener("click", triggerSlowMo);
muteBtn.addEventListener("click", () => {
  if (isMuted()) initAudio();
  toggleMute();
  updateMuteButton();
});

initAudio();
updateBestUI();
updateMuteButton();
updatePainterUI();
refillOrders();
showMenuOverlay();
render();
requestAnimationFrame(loop);
