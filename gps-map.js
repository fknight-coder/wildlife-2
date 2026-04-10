/* ================================================================
   GPS Map Module — NEO-6M via Firebase
   Leaflet.js with dark tile layer + trail history
   ================================================================ */

let overviewMap = null;
let gpsPageMap = null;
let ovMarker = null;
let gpsMarker = null;
let gpsTrailLine = null;
let gpsTrail = [];
let trailPolyline = null;
const MAX_TRAIL = 50;

// ================================================================
// INITIALIZE MAPS
// ================================================================
function initOverviewMap() {
  if (overviewMap) return;
  const el = document.getElementById('overview-map');
  if (!el) return;

  overviewMap = L.map('overview-map', {
    center: [18.5204, 73.8567],
    zoom: 12,
    zoomControl: false,
    attributionControl: false,
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
  }).addTo(overviewMap);
}

function initGPSPageMap() {
  if (gpsPageMap) return;
  const el = document.getElementById('gps-map');
  if (!el) return;

  gpsPageMap = L.map('gps-map', {
    center: [18.5204, 73.8567],
    zoom: 14,
    zoomControl: true,
    attributionControl: false,
  });

  // Satellite layer
  const osmLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 });
  const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 17 });

  osmLayer.addTo(gpsPageMap);
  L.control.layers({ 'Dark Map': osmLayer, 'Satellite': satelliteLayer }, {}, { position: 'topright' }).addTo(gpsPageMap);

  // Draw existing trail
  trailPolyline = L.polyline([], { color: '#00e5a0', weight: 2.5, opacity: 0.7, dashArray: '4 4' }).addTo(gpsPageMap);
}

// ================================================================
// GPS LISTENER — /sensors/gps
// ================================================================
function initGPSListener() {
  db.ref('/sensors/gps').on('value', snap => {
    const data = snap.val();
    if (!data) return;

    const lat = parseFloat(data.lat);
    const lng = parseFloat(data.lng);
    const speed = data.speed_kmh || 0;
    const altitude = data.altitude_m || 0;
    const sats = data.satellites || 0;
    const fix = data.fix === true;
    const ts = data.timestamp ? formatTime(data.timestamp) : '—';

    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

    // Stat card
    setEl('ov-gps-fix', fix ? `${sats} sats` : 'No Fix');
    setEl('ov-gps-sats', `${speed} km/h · ${altitude}m`);

    // GPS data panel
    setEl('gd-lat', lat.toFixed(6));
    setEl('gd-lng', lng.toFixed(6));
    setEl('gd-speed', `${speed.toFixed(1)} km/h`);
    setEl('gd-alt', `${altitude.toFixed(0)} m`);
    setEl('gd-sats', `${sats} satellites`);
    setEl('gd-time', ts);

    // Fix badge
    setGPSFixBadge(fix, 'gps-fix-badge');
    setGPSFixBadge(fix, 'gps-page-fix-badge');

    // Coords text
    setEl('gps-coords-text', `${lat.toFixed(5)}, ${lng.toFixed(5)} · ${speed} km/h`);

    // Add to trail
    const pt = [lat, lng];
    gpsTrail.push({ lat, lng, ts });
    if (gpsTrail.length > MAX_TRAIL) gpsTrail.shift();

    // Update overview map
    updateMapMarker(overviewMap, 'ovMarker', lat, lng, fix, speed, ts);

    // Update GPS page map + trail
    if (gpsPageMap) {
      updateMapMarker(gpsPageMap, 'gpsMarker', lat, lng, fix, speed, ts);
      const trailPts = gpsTrail.map(p => [p.lat, p.lng]);
      if (trailPolyline) trailPolyline.setLatLngs(trailPts);
    }

    // Trail list
    renderTrailList();

    // GPS chipcount update
    setEl('chip-detections', `${gpsTrail.length} GPS points · ${sats} sats`);
  });
}

function updateMapMarker(map, markerRef, lat, lng, fix, speed, ts) {
  if (!map) return;

  const icon = L.divIcon({
    className: '',
    html: `<div style="
      width:28px;height:28px;border-radius:50%;
      background:rgba(4,13,10,0.9);
      border:2px solid ${fix ? '#00e5a0' : '#ef4444'};
      display:flex;align-items:center;justify-content:center;
      font-size:14px;
      box-shadow:0 0 ${fix ? '14px rgba(0,229,160,0.5)' : '10px rgba(239,68,68,0.4)'};
      animation:markerPulse 2s ease-in-out infinite;
    ">📍</div>
    <style>@keyframes markerPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}</style>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });

  if (window[markerRef]) {
    window[markerRef].setLatLng([lat, lng]);
    window[markerRef].setIcon(icon);
  } else {
    window[markerRef] = L.marker([lat, lng], { icon })
      .addTo(map)
      .bindPopup(`
        <div>
          <strong style="color:#00e5a0">📍 GPS Tracker</strong><br>
          <span style="font-family:'JetBrains Mono',monospace;font-size:0.78rem;color:#6b9e87">${lat.toFixed(5)}, ${lng.toFixed(5)}</span><br>
          <span style="font-size:0.75rem;color:#6b9e87">Speed: ${speed} km/h · ${ts}</span>
        </div>
      `);
  }

  // Pan map smoothly
  map.panTo([lat, lng], { animate: true, duration: 1 });
}

function setGPSFixBadge(fix, id) {
  const badge = document.getElementById(id);
  if (!badge) return;
  badge.textContent = fix ? '✅ GPS FIX' : 'NO FIX';
  badge.className = `gps-fix-badge ${fix ? 'fix' : ''}`;
}

function renderTrailList() {
  const list = document.getElementById('trail-list');
  if (!list) return;

  if (gpsTrail.length === 0) {
    list.innerHTML = '<div class="no-events">No trail data</div>';
    return;
  }

  list.innerHTML = gpsTrail.slice(-10).reverse().map((p, i) => `
    <div class="trail-item">${i === 0 ? '🔵' : '·'} ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)} <span style="float:right;opacity:0.6">${p.ts}</span></div>
  `).join('');
}

function clearTrail() {
  gpsTrail = [];
  if (trailPolyline) trailPolyline.setLatLngs([]);
  renderTrailList();
}

// Called when GPS page is opened (lazy init)
function onGPSPageOpen() {
  setTimeout(() => {
    initGPSPageMap();
    // If we already have data, replot it
    if (gpsTrail.length > 0) {
      const last = gpsTrail[gpsTrail.length - 1];
      updateMapMarker(gpsPageMap, 'gpsMarker', last.lat, last.lng, true, 0, last.ts);
      const trailPts = gpsTrail.map(p => [p.lat, p.lng]);
      if (trailPolyline) trailPolyline.setLatLngs(trailPts);
    }
  }, 80);
}
