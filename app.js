const techniqueSelect = document.getElementById("technique");
const cyclesInput = document.getElementById("cycles");
const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const phaseEl = document.getElementById("phase");
const timerEl = document.getElementById("timer");
const cycleEl = document.getElementById("cycle");
const ratioEl = document.getElementById("ratio");
const durationEl = document.getElementById("duration");
const soundToggle = document.getElementById("sound");

const root = document.documentElement;

let techniques = [];
let current = null;
let running = false;
let phaseTimeout = null;
let tickInterval = null;
let cycleIndex = 0;
let phaseIndex = 0;
let phaseEndsAt = 0;
let audioCtx = null;

function ensureAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function playCue(phase) {
  if (!audioCtx || !soundToggle?.checked) return;

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  const base = phase === "inhale" ? 392 : phase === "exhale" ? 330 : 262;
  osc.type = "sine";
  osc.frequency.setValueAtTime(base, now);
  osc.frequency.exponentialRampToValueAtTime(base * 1.08, now + 0.12);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

  osc.connect(gain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.3);
}

const PHASE_STYLES = {
  inhale: { scale: 1.2, glow: 0.7 },
  hold: { scale: 1.2, glow: 0.45 },
  exhale: { scale: 0.9, glow: 0.2 },
  hold_after: { scale: 0.95, glow: 0.25 }
};

const IDLE_GRADIENT = ["#fff2cf", "#ffd08a", "#f06a3f"];
const ACTIVE_GRADIENT = ["#ffe19e", "#ffb24b", "#e24b2f"];

function setOrbTransition(seconds) {
  const orb = document.querySelector(".orb");
  if (!orb) return;
  const duration = Math.max(seconds, 0.1);
  orb.style.transition = `transform ${duration}s ease-in-out, box-shadow ${duration}s ease-in-out`;
}

function setOrbStyle(phase) {
  const style = PHASE_STYLES[phase] || PHASE_STYLES.exhale;
  root.style.setProperty("--scale", style.scale);
  root.style.setProperty("--glow", style.glow);
}

function setPageGradient(palette) {
  root.style.setProperty("--bg-1", palette[0]);
  root.style.setProperty("--bg-2", palette[1]);
  root.style.setProperty("--bg-3", palette[2]);
}

function formatSeconds(seconds) {
  return seconds.toFixed(1).padStart(4, "0");
}

function updateTimer() {
  const remaining = Math.max(0, (phaseEndsAt - performance.now()) / 1000);
  timerEl.textContent = formatSeconds(remaining);
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function totalSeconds(technique, cycles) {
  const perCycle = technique.steps.reduce((sum, step) => sum + step.seconds, 0);
  return perCycle * cycles;
}

function updateDuration() {
  if (!current) return;
  const cycles = Math.max(1, Number(cyclesInput.value || current.cycles));
  const total = totalSeconds(current, cycles);
  durationEl.textContent = `Duration ${formatDuration(total)}`;
}

function stopSession() {
  running = false;
  clearTimeout(phaseTimeout);
  clearInterval(tickInterval);
  phaseTimeout = null;
  tickInterval = null;
  phaseEl.textContent = "Ready";
  phaseEl.className = "phase";
  timerEl.textContent = "00.0";
  cycleEl.textContent = "Cycle 0 / 0";
  setOrbTransition(0.6);
  setOrbStyle("exhale");
  setPageGradient(IDLE_GRADIENT);
  startBtn.disabled = false;
  stopBtn.disabled = true;
}

function nextPhase() {
  if (!running || !current) return;

  const steps = current.steps;
  if (phaseIndex >= steps.length) {
    phaseIndex = 0;
    cycleIndex += 1;
  }

  if (cycleIndex >= current.cycles) {
    stopSession();
    return;
  }

  const step = steps[phaseIndex];
  const label = step.phase.replace("_", " ");
  phaseEl.textContent = label.charAt(0).toUpperCase() + label.slice(1);
  phaseEl.className = `phase ${step.phase}`;

  const duration = step.seconds;
  setOrbTransition(duration);
  setOrbStyle(step.phase);
  playCue(step.phase);

  phaseEndsAt = performance.now() + duration * 1000;
  updateTimer();

  cycleEl.textContent = `Cycle ${cycleIndex + 1} / ${current.cycles}`;
  phaseIndex += 1;

  phaseTimeout = setTimeout(nextPhase, duration * 1000);
}

function startSession() {
  if (!current) return;
  ensureAudioContext();
  setPageGradient(ACTIVE_GRADIENT);

  const cycles = Math.max(1, Number(cyclesInput.value || current.cycles));
  current = { ...current, cycles };

  running = true;
  cycleIndex = 0;
  phaseIndex = 0;

  startBtn.disabled = true;
  stopBtn.disabled = false;

  clearInterval(tickInterval);
  tickInterval = setInterval(updateTimer, 100);

  nextPhase();
}

function selectTechnique(id) {
  current = techniques.find((t) => t.id === id);
  if (!current) return;

  ratioEl.textContent = `Ratio ${current.ratio}`;
  cyclesInput.value = current.cycles;
  updateDuration();
  stopSession();
}

async function loadTechniques() {
  const response = await fetch("./techniques.json");
  techniques = await response.json();
  techniqueSelect.innerHTML = "";

  techniques.forEach((technique) => {
    const option = document.createElement("option");
    option.value = technique.id;
    option.textContent = technique.name;
    techniqueSelect.appendChild(option);
  });

  if (techniques.length > 0) {
    selectTechnique(techniques[0].id);
  }
}

techniqueSelect.addEventListener("change", (event) => {
  selectTechnique(event.target.value);
});

cyclesInput.addEventListener("input", updateDuration);

startBtn.addEventListener("click", startSession);
stopBtn.addEventListener("click", stopSession);

loadTechniques();
