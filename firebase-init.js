/* ================================================================
   Firebase Initialization + Real-time Listeners
   Firebase config: unplugged-spirit-818a6
   ================================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyDPicDOQj13hEWS6Ywmm3CwHHZmiJf1VNM",
  authDomain: "unplugged-spirit-818a6.firebaseapp.com",
  databaseURL: "https://unplugged-spirit-818a6-default-rtdb.firebaseio.com",
  projectId: "unplugged-spirit-818a6",
  storageBucket: "unplugged-spirit-818a6.firebasestorage.app",
  messagingSenderId: "1012597888526",
  appId: "1:1012597888526:web:17014b8696f03c7a914e5f"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ---- Connection State ----
let fbConnected = false;

db.ref('.info/connected').on('value', snap => {
  fbConnected = snap.val() === true;
  const dot = document.getElementById('fb-dot');
  const label = document.getElementById('fb-label');
  if (dot && label) {
    if (fbConnected) {
      dot.className = 'fb-dot connected';
      label.textContent = 'Firebase Connected';
      label.style.color = 'var(--green)';
    } else {
      dot.className = 'fb-dot error';
      label.textContent = 'Disconnected';
      label.style.color = 'var(--red)';
    }
  }
});

// ================================================================
// DATABASE HELPERS
// ================================================================

function dbRead(path, callback) {
  db.ref(path).on('value', snap => {
    callback(snap.val());
  });
}

function dbReadOnce(path, callback) {
  db.ref(path).once('value').then(snap => callback(snap.val()));
}

function dbWrite(path, data) {
  return db.ref(path).set(data);
}

function dbPush(path, data) {
  return db.ref(path).push(data);
}

function dbUpdate(path, data) {
  return db.ref(path).update(data);
}

// ================================================================
// DEMO DATA — Simulated sensor values if Firebase is empty
// This makes the dashboard look great even before ESP32 pushes data
// ================================================================

const DEMO_MODE = true;  // Set false when ESP32 is live

function startDemoSimulation() {
  if (!DEMO_MODE) return;

  console.log('[Demo] Starting sensor simulation...');

  // Write initial demo data to Firebase so listeners trigger
  const now = Date.now();

  // GPS
  dbWrite('/sensors/gps', {
    lat: 18.5204,
    lng: 73.8567,
    speed_kmh: 0.0,
    altitude_m: 551,
    satellites: 8,
    fix: true,
    timestamp: now
  });

  // IR
  dbWrite('/sensors/ir', {
    detected: false,
    detection_count: 47,
    last_triggered: now - 300000,
    zone: 'North Gate'
  });

  // RFID
  dbWrite('/sensors/rfid', {
    tag_id: 'A1 B2 C3 D4',
    animal_name: 'Elephant-007',
    timestamp: now - 120000,
    read_count: 12
  });

  // Ultrasonic Water
  dbWrite('/sensors/ultrasonic', {
    distance_cm: 38,
    water_level_pct: 62,
    tank_height_cm: 100,
    timestamp: now
  });

  // System
  dbWrite('/system', {
    esp32_cam: { online: true, last_ping: now },
    esp32_node1: { online: true, last_ping: now },
    esp32_node2: { online: true, last_ping: now }
  });

  // Motor
  dbWrite('/actuators/motor', {
    state: 'CLOSED',
    command: 'IDLE',
    last_triggered: now - 600000
  });

  // Push some initial events
  dbPush('/events', { type: 'SYSTEM', message: 'Dashboard connected to Firebase', timestamp: now });
  dbPush('/events', { type: 'RFID', message: 'Elephant-007 detected at North Gate', timestamp: now - 120000 });
  dbPush('/events', { type: 'IR', message: 'Motion detected — Zone: North Gate', timestamp: now - 300000 });
  dbPush('/events', { type: 'WATER', message: 'Water level: 62% — Normal', timestamp: now - 600000 });
  dbPush('/events', { type: 'GPS', message: 'GPS fix acquired — 8 satellites', timestamp: now - 900000 });

  // Simulate ongoing sensor changes
  simulateOngoingData();
}

function simulateOngoingData() {
  // IR random triggers every 20–40 seconds
  const irInterval = setInterval(() => {
    const count = Math.floor(Math.random() * 80) + 40;
    const detected = Math.random() > 0.7;
    db.ref('/sensors/ir').update({
      detected,
      detection_count: count,
      last_triggered: Date.now(),
      zone: ['North Gate', 'South Perimeter', 'Water Hole', 'Den Area'][Math.floor(Math.random() * 4)]
    });
    if (detected) {
      dbPush('/events', { type: 'IR', message: `Motion detected — Zone: ${['North Gate','South Perimeter','Water Hole'][Math.floor(Math.random()*3)]}`, timestamp: Date.now() });
      window._irBadgeCount = (window._irBadgeCount || 0) + 1;
    }
  }, 25000);

  // GPS drift every 10 seconds
  let gLat = 18.5204, gLng = 73.8567;
  const gpsInterval = setInterval(() => {
    gLat += (Math.random() - 0.5) * 0.002;
    gLng += (Math.random() - 0.5) * 0.002;
    db.ref('/sensors/gps').update({
      lat: parseFloat(gLat.toFixed(6)),
      lng: parseFloat(gLng.toFixed(6)),
      speed_kmh: parseFloat((Math.random() * 3).toFixed(1)),
      satellites: Math.floor(Math.random() * 4) + 6,
      timestamp: Date.now()
    });
  }, 10000);

  // Water level drift every 15 seconds
  let waterPct = 62;
  const waterInterval = setInterval(() => {
    waterPct = Math.max(5, Math.min(98, waterPct + (Math.random() - 0.48) * 2));
    const dist = 100 - waterPct;
    db.ref('/sensors/ultrasonic').update({
      distance_cm: parseFloat(dist.toFixed(1)),
      water_level_pct: Math.round(waterPct),
      timestamp: Date.now()
    });
  }, 15000);

  // RFID random scans every 30 seconds
  const rfidAnimals = [
    { id: 'A1 B2 C3 D4', name: 'Elephant-007' },
    { id: 'F3 E2 91 AA', name: 'Leopard-003' },
    { id: '7C D0 45 B1', name: 'Wolf-Alpha' },
    { id: '22 88 CC 11', name: 'Deer-015' },
  ];
  const rfidInterval = setInterval(() => {
    if (Math.random() > 0.6) {
      const animal = rfidAnimals[Math.floor(Math.random() * rfidAnimals.length)];
      db.ref('/sensors/rfid').set({
        tag_id: animal.id,
        animal_name: animal.name,
        timestamp: Date.now(),
        read_count: Math.floor(Math.random() * 20) + 1
      });
      dbPush('/events', { type: 'RFID', message: `${animal.name} detected — Tag: ${animal.id}`, timestamp: Date.now() });
    }
  }, 30000);

  // System ping every 5 seconds
  const pingInterval = setInterval(() => {
    const now = Date.now();
    db.ref('/system').update({
      'esp32_cam/last_ping': now,
      'esp32_node1/last_ping': now,
      'esp32_node2/last_ping': now
    });
  }, 5000);

  window._demoIntervals = [irInterval, gpsInterval, waterInterval, rfidInterval, pingInterval];
}
