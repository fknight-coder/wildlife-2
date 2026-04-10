/* ================================================================
   Main App — Navigation, Init, Utilities
   WildWatch IoT Dashboard
   ================================================================ */

const PAGE_TITLES = {
  overview: 'System Overview',
  camera: 'ESP32-CAM Feed',
  sensors: 'Sensor Dashboard',
  rfid: 'RFID Animal Tracker',
  gps: 'GPS Tracker — NEO-6M',
  water: 'Water Level Monitor',
  motor: 'Motor Control',
  events: 'Event Log',
};

// ================================================================
// INITIALIZATION
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
  runLoadingSequence();
});

async function runLoadingSequence() {
  const overlay = document.getElementById('loading-overlay');
  const fill = document.getElementById('lf');
  const status = document.getElementById('loading-status');

  const steps = [
    [15, 'Connecting to Firebase...'],
    [35, 'Initializing map layers...'],
    [55, 'Starting sensor listeners...'],
    [75, 'Loading Chart.js...'],
    [90, 'Rendering dashboard...'],
    [100, 'Ready!'],
  ];

  for (const [pct, msg] of steps) {
    if (fill) fill.style.width = `${pct}%`;
    if (status) status.textContent = msg;
    await sleep(250 + Math.random() * 200);
  }

  await sleep(300);
  overlay?.classList.add('hidden');
  setTimeout(() => { if (overlay) overlay.style.display = 'none'; }, 600);

  initApp();
}

async function initApp() {
  // Clock
  updateClock();
  setInterval(updateClock, 1000);

  // Navigation
  setupNav();

  // Initialize sidebar overview map
  initOverviewMap();

  // All Firebase listeners
  initIRListener();
  initRFIDListener();
  initWaterListener();
  initCameraListener();
  initSystemListener();
  initGPSListener();
  initMotorListener();
  initEventsListener();

  // Charts
  initIRChart();
  initWaterChart();

  // Mobile hamburger
  document.getElementById('hamburger')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });

  // Start demo simulation (writes demo data to Firebase)
  setTimeout(() => startDemoSimulation(), 1200);
}

// ================================================================
// NAVIGATION
// ================================================================
function setupNav() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(item.dataset.page);
    });
  });
}

function navigateTo(page) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Show target page
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  const navEl = document.getElementById(`nav-${page}`);
  if (navEl) navEl.classList.add('active');

  // Update topbar title
  setEl('topbar-title', PAGE_TITLES[page] || page);

  // Page-specific lazy init
  if (page === 'gps') onGPSPageOpen();

  // Close mobile sidebar
  document.getElementById('sidebar')?.classList.remove('open');
}

// ================================================================
// CLOCK
// ================================================================
function updateClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  setEl('topbar-time', timeStr);
  setEl('sidebar-clock', `${dateStr} · ${timeStr}`);
}

// ================================================================
// ALERTS
// ================================================================
let alertTimeout = null;
function showAlert(message) {
  const chip = document.getElementById('alert-chip');
  const chipText = document.getElementById('alert-chip-text');
  if (!chip || !chipText) return;

  chip.style.display = 'flex';
  chipText.textContent = message;

  if (alertTimeout) clearTimeout(alertTimeout);
  alertTimeout = setTimeout(() => {
    chip.style.display = 'none';
  }, 8000);
}

// ================================================================
// UTILITY FUNCTIONS
// ================================================================

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function formatTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function formatRelTime(ts) {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  if (diff < 10000) return 'just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return formatTime(ts);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
