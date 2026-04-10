/* ================================================================
   Sensors Module — IR, RFID, Ultrasonic Water
   All data comes from Firebase Realtime Database
   ================================================================ */

let irTimeline = null;
let waterChart = null;
let waterHistory = [];
let irHistory = [];
let rfidLog = [];
let eventLog = [];
let tankHeightCm = 100;

// ================================================================
// IR SENSOR LISTENER — /sensors/ir
// ================================================================
function initIRListener() {
  db.ref('/sensors/ir').on('value', snap => {
    const data = snap.val();
    if (!data) return;

    const detected = data.detected === true;
    const count = data.detection_count || 0;
    const zone = data.zone || '—';
    const lastTs = data.last_triggered ? formatTime(data.last_triggered) : '—';

    // Update stat card
    setEl('ov-ir-count', count);
    setEl('ov-ir-last', detected ? '🔴 ACTIVE' : `Last: ${lastTs}`);
    document.getElementById('ir-indicator')?.classList.toggle('active', detected);

    // Overview IR circle
    const circle = document.getElementById('ir-circle');
    const label = document.getElementById('ir-label-text');
    const pulse = document.getElementById('ir-pulse');
    if (circle) {
      circle.classList.toggle('active', detected);
      label.textContent = detected ? 'DETECTED' : 'NO MOTION';
    }
    if (pulse) pulse.style.display = detected ? 'block' : 'none';

    // Overview IR details
    setEl('ir-det-count', count);
    setEl('ir-last-time', lastTs);
    setEl('ir-zone', zone);

    // Sensors page big IR
    const radarCenter = document.getElementById('ir-radar-center');
    const bigLabel = document.getElementById('ir-big-label');
    if (radarCenter) {
      radarCenter.classList.toggle('active', detected);
      bigLabel.textContent = detected ? 'DETECTED!' : 'IDLE';
    }
    document.querySelectorAll('.radar-ring').forEach(r => r.classList.toggle('active', detected));
    setEl('ibs-count', count);
    setEl('ibs-last', lastTs);
    setEl('ibs-zone', zone);

    // Badge alert
    const badge = document.getElementById('ir-badge');
    if (badge && detected) badge.style.display = 'flex';

    // Update IR timeline data
    irHistory.push({ t: Date.now(), detected: detected ? 1 : 0 });
    if (irHistory.length > 48) irHistory.shift();
    if (irTimeline) updateIRChart();
  });
}

// ================================================================
// RFID LISTENER — /sensors/rfid
// ================================================================
function initRFIDListener() {
  db.ref('/sensors/rfid').on('value', snap => {
    const data = snap.val();
    if (!data) return;

    const tagId = data.tag_id || '—';
    const animalName = data.animal_name || 'Unknown';
    const time = data.timestamp ? formatTime(data.timestamp) : '—';
    const readCount = data.read_count || 0;

    // Stat card
    setEl('ov-rfid-count', readCount);
    setEl('ov-rfid-last', animalName);

    // Overview RFID display
    setEl('rfid-tag-hex', tagId);
    setEl('rfid-animal-name', animalName);
    setEl('rfid-time', time);

    // Sensors page RFID
    setEl('rfid-hex-big', tagId);
    setEl('rfid-name-big', animalName);
    setEl('rfid-time-big', time);

    // RFID page
    setEl('rfc-hex', tagId);
    setEl('rfc-animal', animalName);
    setEl('rfc-time', time);

    // Add to log table
    const logEntry = { tagId, animalName, time, readCount };
    rfidLog.unshift(logEntry);
    if (rfidLog.length > 50) rfidLog.pop();
    renderRFIDLog();

    // Flash scanner animation
    flashRFIDScan();
  });
}

function renderRFIDLog() {
  const body = document.getElementById('rfid-log-body');
  if (!body) return;
  if (rfidLog.length === 0) {
    body.innerHTML = '<tr><td colspan="5" class="empty-row">No RFID reads yet</td></tr>';
    return;
  }
  body.innerHTML = rfidLog.map((r, i) => `
    <tr>
      <td style="color:var(--text3)">${i + 1}</td>
      <td style="font-family:'JetBrains Mono',monospace;color:var(--purple)">${r.tagId}</td>
      <td style="font-weight:600;color:var(--text)">${r.animalName}</td>
      <td>${r.time}</td>
      <td><span style="background:rgba(0,229,160,0.1);color:var(--green);padding:2px 8px;border-radius:4px;font-size:0.72rem;font-weight:700">REGISTERED</span></td>
    </tr>
  `).join('');
}

function flashRFIDScan() {
  const anim = document.getElementById('rfid-anim');
  if (!anim) return;
  anim.style.borderColor = 'rgba(168,85,247,0.6)';
  anim.style.background = 'rgba(168,85,247,0.08)';
  setTimeout(() => {
    if (anim) {
      anim.style.borderColor = '';
      anim.style.background = '';
    }
  }, 600);
}

function clearRFIDLog() {
  rfidLog = [];
  renderRFIDLog();
}

// ================================================================
// ULTRASONIC WATER LISTENER — /sensors/ultrasonic
// ================================================================
function initWaterListener() {
  db.ref('/sensors/ultrasonic').on('value', snap => {
    const data = snap.val();
    if (!data) return;

    const dist = data.distance_cm || 0;
    const pct = data.water_level_pct || 0;
    const height = data.tank_height_cm || 100;
    tankHeightCm = height;

    const lowThresh = parseInt(document.getElementById('low-thresh')?.value || 20);
    const status = pct <= 5 ? 'EMPTY' : pct <= lowThresh ? 'LOW' : pct >= 90 ? 'FULL' : 'NORMAL';
    const statusClass = pct <= lowThresh ? 'crit' : pct >= 90 ? 'warn' : 'good';

    // Stat card
    setEl('ov-water', `${pct}%`);
    setEl('ov-water-dist', `${dist} cm distance`);

    // Overview water gauge
    updateWaterGauge('water-fill-ov', 'water-pct-label', pct);
    setEl('wstat-dist', `${dist} cm`);
    setEl('wstat-lvl', `${pct}%`);
    const wstatStatus = document.getElementById('wstat-status');
    if (wstatStatus) { wstatStatus.textContent = status; wstatStatus.className = `wstat-val ${statusClass}`; }

    // Water page big gauge
    updateWaterGauge('water-fill-big', 'water-pct-big', pct);
    setEl('wip-dist', `${dist} cm`);
    setEl('wip-pct', `${pct}%`);
    setEl('wip-tank', `${height} cm`);
    const wipStatus = document.getElementById('wip-status-val');
    if (wipStatus) { wipStatus.textContent = status; wipStatus.className = `wip-val ${statusClass}`; }

    // Alert if low
    if (pct <= lowThresh) {
      showAlert(`💧 Water level critical: ${pct}%`);
      addEvent({ type: 'WATER', message: `⚠️ Low water alert: ${pct}% (${dist}cm)`, timestamp: Date.now() });
      // Auto-open motor if enabled
      if (document.getElementById('water-motor-auto')?.checked) {
        sendMotorCommand('OPEN');
      }
    }

    // Water history chart
    waterHistory.push({ t: Date.now(), pct });
    if (waterHistory.length > 48) waterHistory.shift();
    if (waterChart) updateWaterHistoryChart();
  });
}

function updateWaterGauge(fillId, labelId, pct) {
  const fill = document.getElementById(fillId);
  const label = document.getElementById(labelId);
  if (fill) fill.style.height = `${Math.min(100, Math.max(0, pct))}%`;
  if (label) label.textContent = `${pct}%`;
}

function updateThresholdLabel(which, val) {
  document.getElementById(`${which}-thresh-label`).textContent = `${val}%`;
}

function updateTankHeight(val) {
  tankHeightCm = parseFloat(val) || 100;
  db.ref('/sensors/ultrasonic/tank_height_cm').set(tankHeightCm);
}

// ================================================================
// CAMERA LISTENER — /camera
// ================================================================
function initCameraListener() {
  let frameCount = 0;
  db.ref('/camera').on('value', snap => {
    const data = snap.val();
    if (!data) return;

    const url = data.last_capture_url;
    const ts = data.timestamp ? formatTime(data.timestamp) : '—';
    const streamActive = data.stream_active === true;

    if (url) {
      frameCount++;

      // Overview thumb
      const ovWrap = document.getElementById('ov-camera-wrap');
      if (ovWrap) ovWrap.innerHTML = `<img src="${url}" alt="Camera frame" style="width:100%;height:100%;object-fit:cover"/>`;
      setEl('ov-cam-meta', `Last capture: ${ts}`);

      // Camera page
      const frame = document.getElementById('camera-frame');
      if (frame) frame.innerHTML = `<img src="${url}" alt="ESP32-CAM" style="width:100%;height:100%;object-fit:cover;display:block"/>`;
      setEl('cam-timestamp', `Last frame: ${ts}`);
      setEl('c-frames', frameCount);
      setEl('c-last', ts);

      const liveStatus = document.getElementById('cam-live-status');
      if (liveStatus) { liveStatus.textContent = 'LIVE'; liveStatus.className = 'live-badge active'; }
      setEl('c-status', 'Online ✅');

      addEvent({ type: 'CAM', message: `Camera frame received`, timestamp: Date.now() });
    }
  });
}

// ================================================================
// SYSTEM STATUS LISTENER — /system
// ================================================================
function initSystemListener() {
  db.ref('/system').on('value', snap => {
    const data = snap.val();
    if (!data) return;

    const now = Date.now();
    const timeout = 15000; // 15s

    // ESP32-CAM
    const camOnline = data.esp32_cam?.online && (now - (data.esp32_cam?.last_ping || 0)) < timeout;
    setDeviceStatus('cam', camOnline, 'dev-cam', 'dot-cam');

    // Node 1
    const n1Online = data.esp32_node1?.online && (now - (data.esp32_node1?.last_ping || 0)) < timeout;
    setDeviceStatus('node1', n1Online, 'dev-node1', 'dot-node1');

    // Node 2
    const n2Online = data.esp32_node2?.online && (now - (data.esp32_node2?.last_ping || 0)) < timeout;
    setDeviceStatus('node2', n2Online, 'dev-node2', 'dot-node2');
  });
}

function setDeviceStatus(id, online, pillId, dotId) {
  const pill = document.getElementById(pillId);
  const dot = document.getElementById(dotId);
  if (pill) pill.className = `device-pill ${online ? 'online' : 'offline'}`;
  if (dot) dot.className = `dev-dot ${online ? 'online' : 'offline'}`;
}

// ================================================================
// EVENTS LISTENER — /events
// ================================================================
function initEventsListener() {
  db.ref('/events').limitToLast(100).on('value', snap => {
    const raw = snap.val();
    if (!raw) return;

    eventLog = Object.values(raw).sort((a, b) => b.timestamp - a.timestamp);
    renderEventStream('ov-event-stream', eventLog.slice(0, 8));
    renderEventsFull(eventLog);

    const badge = document.getElementById('event-count-badge');
    if (badge) badge.textContent = Math.min(99, eventLog.length);
  });
}

function addEvent(data) {
  dbPush('/events', data);
}

function renderEventStream(containerId, events) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (events.length === 0) {
    container.innerHTML = '<div class="no-events">No events yet</div>';
    return;
  }

  const icons = { IR:'⚡', RFID:'🏷️', MOTOR:'⚙️', GPS:'📍', WATER:'💧', CAM:'📷', SYSTEM:'🔧' };

  container.innerHTML = events.map(ev => `
    <div class="event-item">
      <div class="event-icon">${icons[ev.type] || '❓'}</div>
      <div class="event-body">
        <div class="event-msg">${ev.message}</div>
        <div class="event-time">${ev.timestamp ? formatRelTime(ev.timestamp) : '—'}</div>
      </div>
      <span class="event-type-badge ev-${ev.type}">${ev.type}</span>
    </div>
  `).join('');
}

function renderEventsFull(events) {
  const filter = document.getElementById('event-filter')?.value || '';
  const filtered = filter ? events.filter(e => e.type === filter) : events;
  renderEventStream('events-full-list', filtered);
}

function filterEvents() {
  renderEventsFull(eventLog);
}

function clearEvents() {
  const container = document.getElementById('events-full-list');
  if (container) container.innerHTML = '<div class="no-events">Events cleared</div>';
}

// ================================================================
// IR CHART
// ================================================================
function initIRChart() {
  const ctx = document.getElementById('ir-timeline-chart');
  if (!ctx) return;

  const labels = Array.from({ length: 24 }, (_, i) => `${(i).toString().padStart(2,'0')}:00`);
  const data = Array.from({ length: 24 }, () => Math.floor(Math.random() * 12));

  irTimeline = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'IR Triggers',
        data,
        backgroundColor: data.map(v => v > 8 ? 'rgba(239,68,68,0.7)' : 'rgba(239,68,68,0.35)'),
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: 'rgba(2,10,7,0.95)', borderColor: 'rgba(239,68,68,0.3)', borderWidth: 1 }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#2e5446', font: { size: 9 }, maxTicksLimit: 8 } },
        y: { grid: { color: 'rgba(0,229,160,0.05)' }, ticks: { color: '#2e5446', font: { size: 9 } }, beginAtZero: true }
      }
    }
  });
}

function updateIRChart() {
  if (!irTimeline) return;
  const newVal = irHistory.filter(h => h.detected).length;
  irTimeline.data.datasets[0].data.push(newVal);
  irTimeline.data.datasets[0].data.shift();
  irTimeline.update('none');
}

// ================================================================
// WATER HISTORY CHART
// ================================================================
function initWaterChart() {
  const ctx = document.getElementById('water-chart');
  if (!ctx) return;

  const labels = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2,'0')}:00`);
  const data = Array.from({ length: 24 }, (_, i) => Math.round(50 + Math.sin(i * 0.4) * 20 + Math.random() * 10));

  waterChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Water Level %',
        data,
        fill: true,
        backgroundColor: 'rgba(0,180,216,0.08)',
        borderColor: 'rgba(0,180,216,0.7)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(0,180,216,0.8)',
        pointRadius: 2,
        pointHoverRadius: 5,
        tension: 0.4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: 'rgba(2,10,7,0.95)', borderColor: 'rgba(0,180,216,0.3)', borderWidth: 1 }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#2e5446', font: { size: 9 }, maxTicksLimit: 8 } },
        y: {
          grid: { color: 'rgba(0,229,160,0.05)' },
          ticks: { color: '#2e5446', font: { size: 9 }, callback: v => v + '%' },
          min: 0, max: 100
        }
      }
    }
  });
}

function updateWaterHistoryChart() {
  if (!waterChart) return;
  const pct = waterHistory[waterHistory.length - 1]?.pct || 0;
  waterChart.data.datasets[0].data.push(pct);
  waterChart.data.datasets[0].data.shift();
  waterChart.update('none');
}

// ================================================================
// Trigger camera capture (write to Firebase so ESP32 can react)
// ================================================================
function triggerCapture() {
  dbWrite('/camera/trigger', { capture: true, timestamp: Date.now() });
  addEvent({ type: 'CAM', message: '📸 Manual capture triggered', timestamp: Date.now() });
}

function setAutoCapture(enabled) {
  dbWrite('/settings/auto_capture_on_ir', enabled);
}
