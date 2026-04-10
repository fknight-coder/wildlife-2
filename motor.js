/* ================================================================
   Motor Control Module — 12V Gear Motor
   Sends commands to Firebase → ESP32 reads and actuates
   ================================================================ */

let motorLog = [];
let autoCloseTimer = null;

// ================================================================
// MOTOR STATE LISTENER — /actuators/motor
// ================================================================
function initMotorListener() {
  db.ref('/actuators/motor').on('value', snap => {
    const data = snap.val();
    if (!data) return;

    const state = data.state || 'UNKNOWN';
    const ts = data.last_triggered ? formatTime(data.last_triggered) : '—';

    updateMotorUI(state);
    setEl('ov-motor', state);

    // Log
    if (motorLog.length === 0 || motorLog[0].state !== state) {
      motorLog.unshift({ state, time: ts, by: data.command_by || 'System' });
      if (motorLog.length > 30) motorLog.pop();
      renderMotorLog();
    }
  });
}

function updateMotorUI(state) {
  const label = document.getElementById('motor-state-label');
  const gateBar = document.getElementById('gate-bar');

  if (label) {
    label.textContent = state;
    label.className = `motor-state-label ${state}`;
  }

  if (gateBar) {
    if (state === 'OPEN') {
      gateBar.className = 'gate-bar opening';
    } else {
      gateBar.className = 'gate-bar closed';
    }
  }

  // Highlight active button
  document.querySelectorAll('.motor-btn').forEach(btn => btn.style.opacity = '1');
  const btnMap = { OPEN: 'btn-open', CLOSED: 'btn-close', MOVING: 'btn-stop' };
  const activeBtn = document.getElementById(btnMap[state]);
  if (activeBtn) {
    document.querySelectorAll('.motor-btn').forEach(btn => btn.style.opacity = '0.5');
    activeBtn.style.opacity = '1';
    activeBtn.style.boxShadow = '0 0 16px rgba(0,229,160,0.3)';
  }
}

// ================================================================
// SEND MOTOR COMMAND
// ================================================================
function sendMotorCommand(command) {
  const now = Date.now();

  // Prevent rapid duplicate commands
  const btns = document.querySelectorAll('.motor-btn');
  btns.forEach(b => b.disabled = true);
  setTimeout(() => btns.forEach(b => b.disabled = false), 1500);

  // Write command to Firebase — ESP32 reads this path
  dbUpdate('/actuators/motor', {
    command: command,
    last_triggered: now,
    command_by: 'Dashboard'
  });

  // ESP32 will update /actuators/motor/state after executing
  // For demo, we simulate state change
  setTimeout(() => {
    const state = command === 'OPEN' ? 'OPEN' : command === 'CLOSE' ? 'CLOSED' : 'IDLE';
    dbUpdate('/actuators/motor', { state });
  }, 800);

  // Log event
  addEvent({ type: 'MOTOR', message: `⚙️ Motor command: ${command} (from Dashboard)`, timestamp: now });

  // Auto-close if rule enabled
  if (command === 'OPEN' && document.getElementById('rule-autoclose')?.checked) {
    if (autoCloseTimer) clearTimeout(autoCloseTimer);
    autoCloseTimer = setTimeout(() => {
      sendMotorCommand('CLOSE');
      addEvent({ type: 'MOTOR', message: '⚙️ Motor auto-closed after 30s', timestamp: Date.now() });
    }, 30000);
  }

  // Alert if rule enabled
  if (document.getElementById('rule-alert')?.checked) {
    showAlert(`⚙️ Motor: ${command} command sent`);
  }
}

function renderMotorLog() {
  const list = document.getElementById('motor-log-list');
  if (!list) return;

  if (motorLog.length === 0) {
    list.innerHTML = '<div class="no-events">No motor activity yet</div>';
    return;
  }

  list.innerHTML = motorLog.map(item => `
    <div class="motor-log-item">
      <div class="mli-cmd ${item.state}">⚙️ ${item.state}</div>
      <div class="mli-time">🕐 ${item.time} · by ${item.by}</div>
    </div>
  `).join('');
}

function updateRule(ruleName, enabled) {
  dbUpdate('/settings/motor_rules', { [ruleName]: enabled });
}

// ================================================================
// RFID-TRIGGERED MOTOR OPEN
// ================================================================
db.ref('/sensors/rfid').on('value', snap => {
  const data = snap.val();
  if (!data) return;

  if (document.getElementById('rule-rfid')?.checked && data.tag_id) {
    // Auto-open gate on RFID
    const timeSinceRead = Date.now() - (data.timestamp || 0);
    if (timeSinceRead < 3000) { // Only for fresh reads (< 3 seconds old)
      sendMotorCommand('OPEN');
      addEvent({ type: 'MOTOR', message: `⚙️ Gate auto-opened for ${data.animal_name}`, timestamp: Date.now() });
    }
  }
});
