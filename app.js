    const DEFAULT_CENTER = [101.736030, 2.975701];
    const INITIAL_ZOOM = 19.5;
    const DEFAULT_BEARING = 220;
    const DEFAULT_PITCH = 60; // FPV mode default pitch
    // Debug-only shortcuts (Pong, reset-to-start, teleports) are enabled with ?debug=1
    // so accidental keypresses can't disrupt a public visitor's tour.
    const DEBUG_MODE = new URLSearchParams(location.search).has('debug');

    let currentUserCoords = [...START_COORDINATE];
    let gpsInitialized = false; // waits for first real GPS fix before showing marker/camera
    let gpsSignalLost = false;

    const map = new maplibregl.Map({
      container: 'map',
      style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
      center: START_COORDINATE,
      zoom: INITIAL_ZOOM,
      pitch: DEFAULT_PITCH,
      bearing: DEFAULT_BEARING,
      maxPitch: 85 // Enforces allowing the camera to go very low to the ground
    });

    map.keyboard.disable();

    let userHeading = 220;
    let selectedLocationKey = null;

    let controlMode = 'gps'; 
    let isFPVEnabled = true; // Set FPV Mode as default
    let watchId = null;

    // FPV selection intro dive variables
    const LOCK_PITCH = 80;           // over-shoulder framing pitch for the intro dive
    let cameraFocusDiving = false;   // protects the dive animation
    let introFrameHeld = false;      // holds the post-dive framing until the user translates
    let introHoldCoords = null;      // position captured when the dive framing was held

    const manualModeBtn = document.getElementById('manual-mode-btn');
    const gpsRecalibrateBtn = document.getElementById('gps-recalibrate-btn');
    const joystickLeft = document.getElementById('joystick-left');
    const joystickThumbLeft = document.getElementById('joystick-thumb-left');
    const joystickRight = document.getElementById('joystick-right');
    const joystickThumbRight = document.getElementById('joystick-thumb-right');

    const splashScreen = document.getElementById('splash-screen');
    const blockSelectModal = document.getElementById('block-select-modal');
    const legendsToggleBtn = document.getElementById('legends-toggle-btn');
    const legendsPopup = document.getElementById('legends-popup');
    const interiorBadge = document.getElementById('interior-badge');
    const arrivalNotification = document.getElementById('arrival-notification');
    let hasArrived = false;
    let arrivalTimeout = null;
    const ARRIVAL_THRESHOLD_M = 15;

    const INTERIOR_TRIGGER_RADIUS_M = 12;      // enter interior within this many meters (GPS-friendly)
    const INTERIOR_TRIGGER_HYSTERESIS_M = 6;   // leave radius + this before auto-interior exits
    let manualInteriorView = false;    // interior entered via the icon toggle

    let dashOffset = 0;
    let dashAnimationId = null;

    // Building 3D Massing Animation State
    let buildingAnimFrame = null;
    const risenBuildings = {};        // blocks that have completed a full rise this session
    const BUILDING_TARGET_HEIGHTS = {}; // immutable per-block full heights (never clobbered by zeroing)
    BUILDINGS_3D_GEOJSON.features.forEach(f => {
      BUILDING_TARGET_HEIGHTS[f.properties.blockKey] = f.properties.height;
    });
    const BUILDING_RISE_DURATION = 3000; // ms

    // Interior View State (any selected building)
    let isInteriorView = false;
    let interiorBlockKey = null; // building currently in interior view
    const INTERIOR_ZOOM = 19.8;
    const INTERIOR_PITCH = 0;
    const INTERIOR_INSET = 0.00002;
    const INTERIOR_ROOM_COLS = 3;
    const INTERIOR_ROOM_ROWS = 2;
    const INTERIOR_ROOM_GAP = 0.00001;

    function buildingFeature(blockKey) {
      return BUILDINGS_3D_GEOJSON.features.find(f => f.properties.blockKey === blockKey);
    }

    function cancelBuildingAnimations() {
      if (buildingAnimFrame) {
        cancelAnimationFrame(buildingAnimFrame);
        buildingAnimFrame = null;
      }
    }

    // Rise a building from 0 to its full height; plays once per session per block
    // (see risenBuildings). `targetHeight` is passed in so a zeroed height can't
    // sneak in as the target.
    function animateBuildingElevation(blockKey, targetHeight) {
      cancelBuildingAnimations();

      const feature = buildingFeature(blockKey);
      if (!feature) return;
      const startTime = performance.now();
      const duration = BUILDING_RISE_DURATION;

      function step(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);

        feature.properties.height = targetHeight * ease;

        if (map.getSource('buildings-3d-source')) {
          map.getSource('buildings-3d-source').setData(BUILDINGS_3D_GEOJSON);
        }

        if (progress < 1) {
          buildingAnimFrame = requestAnimationFrame(step);
        } else {
          feature.properties.height = targetHeight;
          buildingAnimFrame = null;
          risenBuildings[blockKey] = true;
        }
      }

      buildingAnimFrame = requestAnimationFrame(step);
    }

    // Show (and rise) the selected block's building; all other buildings are zeroed so
    // only one volume is ever raised at a time.
    function showBuilding(blockKey) {
      cancelBuildingAnimations();

      if (!map.getLayer('buildings-3d-layer')) return;
      const feature = buildingFeature(blockKey);
      if (!feature) return;

      const targetHeight = BUILDING_TARGET_HEIGHTS[blockKey] ?? 0;

      BUILDINGS_3D_GEOJSON.features.forEach(f => {
        if (f.properties.blockKey !== blockKey) {
          f.properties.height = 0;
          f.properties.color = '#bfdbfe';
        }
      });
      feature.properties.color = '#22d3ee';

      map.setLayoutProperty('buildings-3d-layer', 'visibility', 'visible');
      map.setPaintProperty('buildings-3d-layer', 'fill-extrusion-opacity', 0.85);

      const source = map.getSource('buildings-3d-source');
      if (!source) return;

      if (risenBuildings[blockKey]) {
        feature.properties.height = targetHeight;
        source.setData(BUILDINGS_3D_GEOJSON);
      } else {
        feature.properties.height = 0;
        source.setData(BUILDINGS_3D_GEOJSON);
        animateBuildingElevation(blockKey, targetHeight);
      }
    }

    // --- INTERIOR VIEW (ANY SELECTED BUILDING) ---

    // Stylized floor plan derived at runtime from a building's ACTUAL footprint: the
    // interior slab follows the exact footprint shape (inset), and the room grid is
    // aligned with parallelogram footprints or clipped to irregular ones.
    function buildInteriorGeoJSON(blockKey) {
      const ring = buildingFeature(blockKey).geometry.coordinates[0];
      const pts = ring.slice(0, -1);
      if (pts.length === 4) {
        return buildParallelogramInterior(pts);
      }
      return buildClippedInterior(pts);
    }

    // Parallelogram footprints: build the plan in a local (u,v) frame so the rooms
    // line up with the building's real orientation and fill its exact shape.
    function buildParallelogramInterior(pts) {
      const A = pts[0], B = pts[1], D = pts[3];
      const e1 = [B[0] - A[0], B[1] - A[1]];
      const e2 = [D[0] - A[0], D[1] - A[1]];
      const e1Len = Math.hypot(e1[0], e1[1]);
      const e2Len = Math.hypot(e2[0], e2[1]);
      const mapUV = (u, v) => [A[0] + u * e1[0] + v * e2[0], A[1] + u * e1[1] + v * e2[1]];

      const insetU = e1Len > 0 ? INTERIOR_INSET / e1Len : 0.02;
      const insetV = e2Len > 0 ? INTERIOR_INSET / e2Len : 0.02;
      const uMin = insetU, uMax = 1 - insetU;
      const vMin = insetV, vMax = 1 - insetV;
      const gapU = e1Len > 0 ? INTERIOR_ROOM_GAP / e1Len : 0.01;
      const gapV = e2Len > 0 ? INTERIOR_ROOM_GAP / e2Len : 0.01;

      const inner = [
        mapUV(uMin, vMax),
        mapUV(uMin, vMin),
        mapUV(uMax, vMin),
        mapUV(uMax, vMax),
        mapUV(uMin, vMax)
      ];

      const aspect = e2Len > 0 ? e1Len / e2Len : 1;
      const gridArea = INTERIOR_ROOM_COLS * INTERIOR_ROOM_ROWS;
      const cols = Math.min(6, Math.max(1, Math.round(Math.sqrt(gridArea * aspect))));
      const rows = Math.min(6, Math.max(1, Math.round(gridArea / cols)));
      const roomU = (uMax - uMin - (cols - 1) * gapU) / cols;
      const roomV = (vMax - vMin - (rows - 1) * gapV) / rows;

      const rooms = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const u0 = uMin + c * (roomU + gapU);
          const u1 = u0 + roomU;
          const v1 = vMax - r * (roomV + gapV);
          const v0 = v1 - roomV;
          rooms.push([
            mapUV(u0, v1),
            mapUV(u0, v0),
            mapUV(u1, v0),
            mapUV(u1, v1),
            mapUV(u0, v1)
          ]);
        }
      }

      return {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', properties: { kind: 'floor' }, geometry: { type: 'Polygon', coordinates: [inner] } },
          { type: 'Feature', properties: { kind: 'rooms' }, geometry: { type: 'MultiPolygon', coordinates: rooms.map(r => [r]) } },
          { type: 'Feature', properties: { kind: 'label' }, geometry: { type: 'Point', coordinates: mapUV(0.5, 0.5) } }
        ]
      };
    }

    // Irregular footprints: shrink the polygon toward its centroid for the floor,
    // then clip an aspect-scaled grid to that exact shape.
    function buildClippedInterior(pts) {
      const centroid = pts.reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1]], [0, 0])
        .map(v => v / pts.length);

      const rAvg = pts.reduce((sum, c) => sum + Math.hypot(c[0] - centroid[0], c[1] - centroid[1]), 0) / pts.length;
      const s = Math.max(0, 1 - INTERIOR_INSET / Math.max(rAvg, 1e-9));
      const inner = pts.map(p => [
        centroid[0] + (p[0] - centroid[0]) * s,
        centroid[1] + (p[1] - centroid[1]) * s
      ]);

      const lngs = inner.map(c => c[0]);
      const lats = inner.map(c => c[1]);
      const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
      const minLat = Math.min(...lats), maxLat = Math.max(...lats);
      const floorW = maxLng - minLng;
      const floorH = maxLat - minLat;
      const aspect = floorH > 0 ? floorW / floorH : 1;
      const gridArea = INTERIOR_ROOM_COLS * INTERIOR_ROOM_ROWS;
      const cols = Math.min(6, Math.max(1, Math.round(Math.sqrt(gridArea * aspect))));
      const rows = Math.min(6, Math.max(1, Math.round(gridArea / cols)));
      const roomW = (floorW - (cols - 1) * INTERIOR_ROOM_GAP) / cols;
      const roomH = (floorH - (rows - 1) * INTERIOR_ROOM_GAP) / rows;

      const rooms = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x0 = minLng + c * (roomW + INTERIOR_ROOM_GAP);
          const x1 = x0 + roomW;
          const y1 = maxLat - r * (roomH + INTERIOR_ROOM_GAP);
          const y0 = y1 - roomH;
          const clipped = clipPolygonToRect(inner, x0, y0, x1, y1);
          if (clipped.length >= 3) {
            rooms.push([clipped]);
          }
        }
      }

      return {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', properties: { kind: 'floor' }, geometry: { type: 'Polygon', coordinates: [inner] } },
          { type: 'Feature', properties: { kind: 'rooms' }, geometry: { type: 'MultiPolygon', coordinates: rooms } },
          { type: 'Feature', properties: { kind: 'label' }, geometry: { type: 'Point', coordinates: centroid } }
        ]
      };
    }

    // Sutherland-Hodgman clip of a polygon against an axis-aligned rectangle.
    // The rectangle (clip region) is convex, so the subject may be any shape.
    function clipPolygonToRect(pts, minX, minY, maxX, maxY) {
      let out = pts;
      out = clipPolygonAxis(out, 0, minX, false);
      out = clipPolygonAxis(out, 0, maxX, true);
      out = clipPolygonAxis(out, 1, minY, false);
      out = clipPolygonAxis(out, 1, maxY, true);
      return out;
    }

    // Clip a polygon to one axis-aligned half-plane (axis 0 = x, 1 = y).
    function clipPolygonAxis(pts, axis, boundary, keepBelow) {
      if (pts.length < 3) return [];
      const result = [];
      for (let i = 0; i < pts.length; i++) {
        const cur = pts[i];
        const nxt = pts[(i + 1) % pts.length];
        const cv = cur[axis], nv = nxt[axis];
        const curIn = keepBelow ? cv <= boundary : cv >= boundary;
        const nxtIn = keepBelow ? nv <= boundary : nv >= boundary;
        if (curIn) result.push(cur);
        if (curIn !== nxtIn) {
          const t = (boundary - cv) / (nv - cv);
          const p = [0, 0];
          p[axis] = boundary;
          p[1 - axis] = cur[1 - axis] + (nxt[1 - axis] - cur[1 - axis]) * t;
          result.push(p);
        }
      }
      return result;
    }

    const INTERIOR_LAYER_IDS = ['interior-floor-layer', 'interior-room-layer', 'interior-outline-layer', 'interior-label-layer'];

    function setInteriorLayersVisibility(visibility) {
      INTERIOR_LAYER_IDS.forEach(id => {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility);
      });
    }

    // Planar point-to-footprint distance in meters (equirectangular approximation).
    function distanceToBuildingMeters(blockKey) {
      const feature = buildingFeature(blockKey);
      if (!feature) return Infinity;
      const ring = feature.geometry.coordinates[0];
      const u = currentUserCoords;
      const cosLat = Math.cos(u[1] * Math.PI / 180);
      let best = Infinity;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[j], b = ring[i];
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const len2 = dx * dx + dy * dy;
        let t = len2 ? ((u[0] - a[0]) * dx + (u[1] - a[1]) * dy) / len2 : 0;
        t = Math.max(0, Math.min(1, t));
        const px = a[0] + t * dx, py = a[1] + t * dy;
        const dLng = (u[0] - px) * cosLat * 111320;
        const dLat = (u[1] - py) * 111320;
        const d = Math.hypot(dLng, dLat);
        if (d < best) best = d;
      }
      return best;
    }

    function distanceBetweenCoords(a, b) {
      const cosLat = Math.cos(a[1] * Math.PI / 180);
      const dx = (b[0] - a[0]) * cosLat * 111320;
      const dy = (b[1] - a[1]) * 111320;
      return Math.hypot(dx, dy);
    }

    document.getElementById('interior-entry-icon').addEventListener('click', () => {
      if (!selectedLocationKey || !isFPVEnabled) return;
      if (isInteriorView) {
        exitInteriorView();
      } else {
        resetCameraFollow();
        manualInteriorView = true;
        enterInteriorView(selectedLocationKey);
      }
    });

    function enterInteriorView(blockKey) {
      if (!isFPVEnabled) return;
      if (isInteriorView && interiorBlockKey === blockKey) return;
      isInteriorView = true;
      interiorBlockKey = blockKey;

      const blockName = BLOCKS[blockKey] ? BLOCKS[blockKey].name : 'Building';
      document.getElementById('interior-badge-title').textContent = blockName + ' · Interior View';
      interiorBadge.classList.add('show');
      visionConeSvg.style.display = 'none';
      setInteriorLayersVisibility('visible');

      if (map.getSource('interior-source')) {
        map.getSource('interior-source').setData(buildInteriorGeoJSON(blockKey));
      }
      if (map.getLayer('interior-label-layer')) {
        map.setLayoutProperty('interior-label-layer', 'text-field', blockName + ' · Interior');
      }

      if (map.getLayer('buildings-3d-layer')) {
        map.setLayoutProperty('buildings-3d-layer', 'visibility', 'none');
      }
      if (blockMarkers[blockKey]) {
        blockMarkers[blockKey].remove();
      }

      map.easeTo({
        center: [...currentUserCoords],
        pitch: INTERIOR_PITCH,
        bearing: 0,
        zoom: INTERIOR_ZOOM,
        duration: 700
      });
    }

    function exitInteriorView() {
      if (!isInteriorView) return;
      isInteriorView = false;
      interiorBlockKey = null;
      manualInteriorView = false;

      interiorBadge.classList.remove('show');
      visionConeSvg.style.display = '';
      setInteriorLayersVisibility('none');

      if (selectedLocationKey) {
        if (map.getLayer('buildings-3d-layer')) {
          map.setLayoutProperty('buildings-3d-layer', 'visibility', 'visible');
        }
        if (blockMarkers[selectedLocationKey]) {
          blockMarkers[selectedLocationKey].addTo(map);
        }
      }

      if (isFPVEnabled) {
        updateFPVCamera();
      }
    }

    function updateInteriorView() {
      const dist = distanceToBuildingMeters(selectedLocationKey);
      const interiorIcon = document.getElementById('interior-entry-icon');

      // Show icon when within 12m of selected building OR already in interior view
      if (selectedLocationKey && !isInteriorView && dist <= INTERIOR_TRIGGER_RADIUS_M) {
        interiorIcon.classList.add('show');
      } else if (isInteriorView) {
        interiorIcon.classList.add('show');
      } else {
        interiorIcon.classList.remove('show');
      }

      if (isInteriorView && !manualInteriorView &&
          dist <= INTERIOR_TRIGGER_RADIUS_M + INTERIOR_TRIGGER_HYSTERESIS_M) {
        return;
      }
      if (isInteriorView && manualInteriorView &&
          dist <= INTERIOR_TRIGGER_RADIUS_M + INTERIOR_TRIGGER_HYSTERESIS_M) {
        // Manual interior stays within radius.
      } else if (isInteriorView) {
        exitInteriorView();
      }
    }

    // --- DEVICE ORIENTATION COMPASS HEADING LISTENER ---
    function handleDeviceOrientation(e) {
      let heading = null;
      if (e.webkitCompassHeading !== undefined && e.webkitCompassHeading !== null) {
        heading = e.webkitCompassHeading; // iOS Compass
      } else if (e.alpha !== null) {
        heading = 360 - e.alpha; // Android Compass fallback
      }

      hasCompassHeading = heading !== null && !isNaN(heading);
      if (hasCompassHeading) {
        userHeading = heading;
        updateVisionConeOrientation();
      }
      updateHeadingAvailability();
    }

    function initDeviceOrientation() {
      if (window.DeviceOrientationEvent) {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
          DeviceOrientationEvent.requestPermission()
            .then(state => {
              if (state === 'granted') {
                window.addEventListener('deviceorientation', handleDeviceOrientation, true);
              }
            })
            .catch(console.error);
        } else {
          window.addEventListener('deviceorientation', handleDeviceOrientation, true);
        }
      }
    }

    // --- GPS POSITION SMOOTHING, HEADING RESOLUTION & OOB DETECTION ---
    let hasCompassHeading = false;
    let hasGpsHeading = false;

    const GPS_DEADBAND = 0.0000135;       // ~1.5m
    const ON_NETWORK_THRESHOLD = GPS_DEADBAND * 4; // ~6m — from path -> hide helper line

    // Soft lane attractor: pull the raw GPS fix toward the nearest walkway segment
    const LANE_ATTRACT_RADIUS_M = 4;      // meters — max cross-track distance to attract
    const GPS_MAX_SPEED_MPS = 2.5;        // brisk walking pace clamp for dead-reckoning
    const GPS_STALE_AFTER_MS = 1500;      // fixes older than this stop extrapolation
    const GPS_VELOCITY_DECAY = 0.85;      // per-frame decay once fixes go stale (frame-graceful settle)

    let gpsVelocityX = 0;                 // deg/frame along lng
    let gpsVelocityY = 0;                 // deg/frame along lat
    let gpsSpeedEstimate = 0;             // m/s, smoothed from fix-to-fix displacement
    let lastFixLat = null;
    let lastFixLng = null;
    let lastFixTime = performance.now();
    let lastGpsFixTime = performance.now();

    // Camera deadband: only pan when marker moves beyond this distance
    const CAMERA_DEADBAND_M = 8;                        // camera pans when marker moves beyond this (meters)
    let cameraCenter = [...START_COORDINATE];           // last position camera was centered on
    let userInteracting = false;   // free-camera mode: user manipulated the camera manually

    let targetCoords = [...START_COORDINATE];  // GPS-filtered destination

    function updateHeadingAvailability() {
      if (controlMode === 'manual') return;
      if (!(hasCompassHeading || hasGpsHeading)) {
        userHeading = map.getBearing();
        updateVisionConeOrientation();
      }
    }

    function applyGpsFix(lng, lat, heading) {
      if (gpsSignalLost) {
        gpsSignalLost = false;
        userContainer.classList.remove('gps-lost');
      }
      if (heading !== null && !isNaN(heading)) {
        hasGpsHeading = true;
        userHeading = heading;
      }

      if (typeof userMarker === 'undefined') return;

      const clampedLng = lng;
      const clampedLat = lat;

      // First fix: snap both coords to the real position, show marker, ease map.
      if (!gpsInitialized) {
        gpsInitialized = true;
        currentUserCoords[0] = clampedLng;
        currentUserCoords[1] = clampedLat;
        targetCoords[0] = clampedLng;
        targetCoords[1] = clampedLat;
        userMarker.setLngLat(currentUserCoords);
        userContainer.style.display = '';
        updateVisionConeOrientation();
        map.easeTo({ center: currentUserCoords, zoom: INITIAL_ZOOM, pitch: DEFAULT_PITCH, bearing: DEFAULT_BEARING, duration: 1200 });
        updateStraightLine();
        updateNearestEntryMarker();
        updateActiveRouteLine();
        updateInteriorView();
        updateHeadingAvailability();
        lastFixLng = clampedLng;
        lastFixLat = clampedLat;
        lastFixTime = performance.now();
        lastGpsFixTime = lastFixTime;
        return;
      }

      // Velocity estimate from real fix-to-fix displacement (deg/sec, clamped to walking pace).
      const now = performance.now();
      if (lastFixLng !== null && lastFixLat !== null) {
        const dtSec = (now - lastFixTime) / 1000;
        if (dtSec > 0) {
          let vx = (clampedLng - lastFixLng) / dtSec;
          let vy = (clampedLat - lastFixLat) / dtSec;
          const speedMps = Math.hypot(
            vx * Math.cos(clampedLat * Math.PI / 180) * 111320,
            vy * 111320
          );
          gpsSpeedEstimate = gpsSpeedEstimate * 0.7 + speedMps * 0.3;
          if (speedMps > GPS_MAX_SPEED_MPS && speedMps > 0) {
            const scale = GPS_MAX_SPEED_MPS / speedMps;
            vx *= scale;
            vy *= scale;
          }
          if (!isNaN(vx) && !isNaN(vy)) {
            gpsVelocityX = vx / 60;
            gpsVelocityY = vy / 60;
          }
        }
      }
      lastFixLng = clampedLng;
      lastFixLat = clampedLat;
      lastFixTime = now;
      lastGpsFixTime = now;

      // Soft lane attractor: pull toward nearest walkway segment, never hard-snap.
      const attracted = applyLaneAttractor(clampedLng, clampedLat);
      targetCoords[0] = attracted[0];
      targetCoords[1] = attracted[1];

      updateStraightLine();
      updateNearestEntryMarker();
      updateActiveRouteLine();
      updateInteriorView();
      updateHeadingAvailability();
    }

    // --- GPS RETRY / RECALIBRATE ---
    function recalibrateGPS() {
      gpsInitialized = false;
      userContainer.style.display = 'none';
      if (typeof watchId !== 'undefined' && watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            applyGpsFix(position.coords.longitude, position.coords.latitude, position.coords.heading);
          },
          (error) => {
            console.warn("GPS recalibration failed.", error);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
        startGPSWatch();
      }
    }

    // --- INITIAL GPS ACQUISITION ---
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          applyGpsFix(position.coords.longitude, position.coords.latitude, position.coords.heading);
        },
        (error) => {
          console.warn("Initial GPS position acquisition failed.", error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }

    function chooseInitialBlock(blockKey) {
      blockSelectModal.classList.remove('open');
      selectLocation(blockKey);
      initDeviceOrientation();
    }

    function toggleControlMode() {
      if (controlMode === 'gps') {
        controlMode = 'manual';
        setUserInteracting(false);
        manualModeBtn.classList.add('active');
        joystickLeft.classList.add('active');
        joystickRight.classList.add('active');
        if (gpsRecalibrateBtn) gpsRecalibrateBtn.style.display = 'none';
        currentUserCoords = [...START_COORDINATE];
        targetCoords = [...START_COORDINATE];
        userMarker.setLngLat(currentUserCoords);
        userContainer.style.display = '';
        map.easeTo({ center: currentUserCoords, zoom: INITIAL_ZOOM, pitch: DEFAULT_PITCH, bearing: DEFAULT_BEARING, duration: 800 });
      } else {
        controlMode = 'gps';
        setUserInteracting(false);
        manualModeBtn.classList.remove('active');
        joystickLeft.classList.remove('active');
        joystickRight.classList.remove('active');
        if (gpsRecalibrateBtn) gpsRecalibrateBtn.style.display = '';
        initDeviceOrientation();
      }
    }

    manualModeBtn.addEventListener('click', toggleControlMode);

    if (gpsRecalibrateBtn) {
      gpsRecalibrateBtn.addEventListener('click', () => {
        if (controlMode === 'gps') recalibrateGPS();
      });
    }

    // --- DUAL JOYSTICK CONTROL SYSTEM ---
    const JOYSTICK_RADIUS = 50;

    let leftJoyActive = false;
    let leftJoyVector = { x: 0, y: 0 };

    let rightJoyActive = false;
    let rightJoyVector = { x: 0, y: 0 };

    // Compass joystick (drag to rotate bearing, tap to recenter)
    let compassActive = false;
    let compassVector = { x: 0, y: 0 };
    let compassStartClientX = 0;
    let compassDragged = false;
    const COMPASS_DRAG_THRESHOLD = 6;   // px before a press counts as a drag
    const COMPASS_ROTATE_STEP = 0.5;    // degrees per normalized x per frame
    const COMPASS_PITCH_STEP = 0.4;     // degrees per normalized y per frame

    function handleJoystickMove(container, thumb, clientX, clientY, vectorObj) {
      const rect = container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let dx = clientX - centerX;
      let dy = clientY - centerY;
      let distance = Math.hypot(dx, dy);

      if (distance > JOYSTICK_RADIUS) {
        dx = (dx / distance) * JOYSTICK_RADIUS;
        dy = (dy / distance) * JOYSTICK_RADIUS;
      }

      thumb.style.transform = `translate(${dx}px, ${dy}px)`;

      vectorObj.x = dx / JOYSTICK_RADIUS;
      vectorObj.y = dy / JOYSTICK_RADIUS;
    }

    // Left Joystick (Movement)
    joystickLeft.addEventListener('pointerdown', (e) => {
      leftJoyActive = true;
      joystickLeft.setPointerCapture(e.pointerId);
      handleJoystickMove(joystickLeft, joystickThumbLeft, e.clientX, e.clientY, leftJoyVector);
    });

    joystickLeft.addEventListener('pointermove', (e) => {
      if (leftJoyActive) {
        handleJoystickMove(joystickLeft, joystickThumbLeft, e.clientX, e.clientY, leftJoyVector);
      }
    });

    function resetLeftJoystick() {
      leftJoyActive = false;
      leftJoyVector = { x: 0, y: 0 };
      joystickThumbLeft.style.transform = `translate(0px, 0px)`;
    }

    joystickLeft.addEventListener('pointerup', resetLeftJoystick);
    joystickLeft.addEventListener('pointercancel', resetLeftJoystick);

    // Right Joystick (Rotation & Orientation)
    joystickRight.addEventListener('pointerdown', (e) => {
      rightJoyActive = true;
      joystickRight.setPointerCapture(e.pointerId);
      handleJoystickMove(joystickRight, joystickThumbRight, e.clientX, e.clientY, rightJoyVector);
    });

    joystickRight.addEventListener('pointermove', (e) => {
      if (rightJoyActive) {
        handleJoystickMove(joystickRight, joystickThumbRight, e.clientX, e.clientY, rightJoyVector);
      }
    });

    function resetRightJoystick() {
      rightJoyActive = false;
      rightJoyVector = { x: 0, y: 0 };
      joystickThumbRight.style.transform = `translate(0px, 0px)`;
    }

    joystickRight.addEventListener('pointerup', resetRightJoystick);
    joystickRight.addEventListener('pointercancel', resetRightJoystick);

    legendsToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = legendsPopup.classList.contains('open');
      if (isOpen) {
        legendsPopup.classList.remove('open');
        legendsToggleBtn.classList.remove('active');
      } else {
        legendsPopup.classList.add('open');
        legendsToggleBtn.classList.add('active');
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-container')) {
        legendsPopup.classList.remove('open');
        legendsToggleBtn.classList.remove('active');
      }
    });

    map.on('style.load', () => {
      const style = map.getStyle();
      if (style && style.layers) {
        style.layers.forEach(layer => {
          if (layer.type === 'symbol' && map.getLayoutProperty(layer.id, 'text-field')) {
            map.setLayoutProperty(layer.id, 'text-rotation-alignment', 'viewport');
            map.setLayoutProperty(layer.id, 'text-field', '');
          }
        });
      }

      // --- ADD 3D BUILDING MASSING LAYER (REAL FOOTPRINTS) ---
      map.addSource('buildings-3d-source', {
        type: 'geojson',
        data: BUILDINGS_3D_GEOJSON
      });

      map.addLayer({
        id: 'buildings-3d-layer',
        type: 'fill-extrusion',
        source: 'buildings-3d-source',
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'base'],
          'fill-extrusion-opacity': 0.85
        },
        layout: {
          'visibility': 'none'
        }
      });

      // --- INTERIOR FLOOR PLAN LAYERS (ANY SELECTED BUILDING) ---
      map.addSource('interior-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      map.addLayer({
        id: 'interior-floor-layer',
        type: 'fill',
        source: 'interior-source',
        filter: ['==', ['get', 'kind'], 'floor'],
        paint: {
          'fill-color': '#eff6ff',
          'fill-opacity': 0.9
        },
        layout: {
          'visibility': 'none'
        }
      });

      map.addLayer({
        id: 'interior-room-layer',
        type: 'fill',
        source: 'interior-source',
        filter: ['==', ['get', 'kind'], 'rooms'],
        paint: {
          'fill-color': '#bfdbfe',
          'fill-opacity': 0.8
        },
        layout: {
          'visibility': 'none'
        }
      });

      map.addLayer({
        id: 'interior-outline-layer',
        type: 'line',
        source: 'interior-source',
        filter: ['==', ['get', 'kind'], 'floor'],
        paint: {
          'line-color': '#2563eb',
          'line-width': 2
        },
        layout: {
          'visibility': 'none'
        }
      });

      map.addLayer({
        id: 'interior-label-layer',
        type: 'symbol',
        source: 'interior-source',
        filter: ['==', ['get', 'kind'], 'label'],
        layout: {
          'visibility': 'none',
          'text-field': 'Interior',
          'text-size': 14,
          'text-font': ['Montserrat Bold', 'Noto Sans Regular'],
          'text-anchor': 'center'
        },
        paint: {
          'text-color': '#1e3a8a',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2
        }
      });

      // --- DYNAMIC ANIMATED ROUTE SOURCE & LAYERS ---
      map.addSource('active-block-route-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });

      map.addLayer({
        id: 'active-block-route-bg',
        type: 'line',
        source: 'active-block-route-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#1e293b',
          'line-width': 6,
          'line-opacity': 0.8
        }
      });

      map.addLayer({
        id: 'active-block-route-anim',
        type: 'line',
        source: 'active-block-route-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#06b6d4',
          'line-width': 4,
          'line-dasharray': [0, 2, 2]
        }
      });

      function animateRouteLine() {
        dashOffset = (dashOffset - 0.2) % 4;
        if (map.getLayer('active-block-route-anim')) {
          map.setPaintProperty('active-block-route-anim', 'line-dasharray', [0, 2, 2]);
          const glowOpacity = 0.7 + Math.sin(Date.now() / 200) * 0.3;
          map.setPaintProperty('active-block-route-anim', 'line-opacity', glowOpacity);
        }
        dashAnimationId = requestAnimationFrame(animateRouteLine);
      }
      animateRouteLine();

      const labelFeatures = Object.keys(BLOCKS).map(key => ({
        type: 'Feature',
        properties: { title: BLOCKS[key].name },
        geometry: { type: 'Point', coordinates: BLOCKS[key].coords }
      }));

      map.addSource('block-labels-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: labelFeatures }
      });

      map.addLayer({
        id: 'block-labels-layer',
        type: 'symbol',
        source: 'block-labels-source',
        layout: {
          'text-field': ['get', 'title'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': [
            'match',
            ['get', 'title'],
            ['Block A', 'Block B', 'Block C', 'Block D', 'LDC'], 14,
            7
          ],
          'text-offset': [0, -1.2],
          'text-anchor': 'bottom',
          'text-rotation-alignment': 'viewport',
          'text-allow-overlap': true
        },
        paint: {
          'text-color': '#1e3a8a',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2.5
        }
      });

      // Tracking Line Layer
      map.addSource('straight-line-source', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: []
          }
        }
      });

      map.addLayer({
        id: 'straight-line-layer',
        type: 'line',
        source: 'straight-line-source',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#f59e0b',
          'line-width': 2,
          'line-dasharray': [3, 3],
          'line-opacity': 0.5
        }
      });

      setTimeout(() => {
        splashScreen.classList.add('fade-out');
        blockSelectModal.classList.add('open');
      }, 1200);
    });

    const nav = new maplibregl.NavigationControl({ 
      showZoom: true,
      showCompass: true, 
      visualizePitch: true 
    });
    map.addControl(nav, 'bottom-right');

    class TopDownControl {
      onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
        
        this._button = document.createElement('button');
        this._button.className = 'topdown-btn';
        this._button.type = 'button';
        this._button.title = 'Toggle Top-Down / FPV View';
        
        this._button.addEventListener('click', () => {
          isFPVEnabled = !isFPVEnabled;
          this._button.classList.toggle('active', !isFPVEnabled);
          toggleFPVMode(isFPVEnabled);
        });

        this._container.appendChild(this._button);
        return this._container;
      }

      onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
      }
    }

    map.addControl(new TopDownControl(), 'bottom-right');

    const navCompass = document.querySelector('.maplibregl-ctrl-compass');
    const compassCenter = document.createElement('div');
    compassCenter.className = 'compass-center';
    let compassThumb = navCompass;
    if (navCompass) {
      navCompass.parentNode.removeChild(navCompass);
      compassCenter.appendChild(navCompass);
      document.getElementById('map').appendChild(compassCenter);
    }

    function setUserInteracting(interacting) {
      userInteracting = interacting;
    }

    map.on('movestart', (e) => {
      if (e.originalEvent) setUserInteracting(true);
    });
    map.on('dragstart', (e) => {
      if (e.originalEvent) setUserInteracting(true);
    });
    map.on('rotatestart', (e) => {
      if (e.originalEvent) setUserInteracting(true);
    });
    map.on('pitchstart', (e) => {
      if (e.originalEvent) setUserInteracting(true);
    });

    // One-shot FPV framing used by explicit controls (compass, FPV/topdown toggle).
    function updateFPVCamera() {
      map.easeTo({
        center: currentUserCoords,
        pitch: DEFAULT_PITCH,
        bearing: userHeading,
        zoom: 19.5,
        duration: 400
      });
    }

    // FPV follows the camera to the user marker is disabled: the camera never
    // auto-realigns. The user is free to pan/zoom/rotate/pitch at any time.
    function followCamera() {
      return;
    }

    function resetCameraFollow() {
      cameraFocusDiving = false;
      introFrameHeld = false;
      introHoldCoords = null;
      cameraCenter = [...currentUserCoords];
    }


    function resetToOverview() {
      const target = controlMode === 'manual' && currentUserCoords ? currentUserCoords : DEFAULT_CENTER;
      map.flyTo({
        center: target,
        zoom: 16.3,
        pitch: 0,
        bearing: -14,
        duration: 1000,
        essential: true
      });
    }

    function toggleFPVMode(enabled) {
      if (!enabled && isInteriorView) exitInteriorView();
      resetCameraFollow();
      if (enabled && isInteriorView) { updateFPVCamera(); return; }
      if (enabled) {
        updateFPVCamera();
      } else {
        resetToOverview();
      }
    }

    const compassBtn = document.querySelector('.maplibregl-ctrl-compass');
    if (compassBtn && compassCenter) {
      function recenterView() {
        if (isFPVEnabled) {
          if (isInteriorView) exitInteriorView();
          resetCameraFollow();
          updateFPVCamera();
        } else {
          resetToOverview();
        }
      }

      function moveCompassThumb(clientX, clientY) {
        const rect = compassCenter.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const radius = rect.width / 2 - 22; // leave room for the 42px thumb
        let dx = clientX - centerX;
        let dy = clientY - centerY;
        const distance = Math.hypot(dx, dy);
        if (distance > radius) {
          dx = (dx / distance) * radius;
          dy = (dy / distance) * radius;
        }
        compassThumb.style.transform = `translate(${dx}px, ${dy}px)`;
        compassVector.x = dx / radius;
        compassVector.y = dy / radius;
      }

      function resetCompass() {
        compassActive = false;
        compassVector = { x: 0, y: 0 };
        compassDragged = false;
        compassThumb.style.transform = `translate(0px, 0px)`;
      }

      compassBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        compassActive = true;
        compassDragged = false;
        compassStartClientX = e.clientX;
        compassBtn.setPointerCapture(e.pointerId);
        moveCompassThumb(e.clientX, e.clientY);
      });

      compassBtn.addEventListener('pointermove', (e) => {
        if (!compassActive) return;
        if (Math.abs(e.clientX - compassStartClientX) > COMPASS_DRAG_THRESHOLD) {
          compassDragged = true;
        }
        moveCompassThumb(e.clientX, e.clientY);
      });

      function compassEnd() {
        const wasDrag = compassDragged;
        resetCompass();
        if (!wasDrag) recenterView();
      }

      compassBtn.addEventListener('pointerup', compassEnd);
      compassBtn.addEventListener('pointercancel', compassEnd);
      compassBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, true);
      // Block MapLibre's own compass drag-rotate / resetNorth handlers so this
      // control behaves purely as our joystick (drag rotates, tap recenters).
      compassBtn.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); }, true);
      compassBtn.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); }, true);
    }

    // --- GALLERY POPUP PANEL LOGIC ---
    const galleryToggleBtn = document.getElementById('gallery-toggle-btn');
    const galleryPanel = document.getElementById('gallery-panel');
    const galleryTitle = document.getElementById('gallery-title');
    const galleryContainer = document.getElementById('gallery-container');
    const galleryCloseBtn = document.getElementById('gallery-close-btn');

    function renderGalleryContent(locationKey) {
      const location = BLOCKS[locationKey];
      if (!location) return;

      galleryTitle.textContent = `${location.name} Gallery`;
      galleryContainer.innerHTML = '';

      if (location.images && location.images.length > 0) {
        location.images.forEach((img, index) => {
          const card = document.createElement('div');
          card.className = 'gallery-card';
          card.innerHTML = `
            <img src="${img.url}" alt="${img.caption}" loading="lazy" onerror="this.style.display='none'" />
            <div class="gallery-card-caption">${img.caption}</div>
          `;
          card.addEventListener('click', () => openLightboxModal(locationKey, index));
          galleryContainer.appendChild(card);
        });
      } else {
        galleryContainer.innerHTML = `<div style="font-size: 12px; color: #64748b; padding: 8px 0; font-weight: 600;">No preview images available.</div>`;
      }
    }

    function toggleGalleryPanel() {
      if (!selectedLocationKey) return;
      galleryPanel.classList.toggle('open');
    }

    function closeGalleryPanel() {
      galleryPanel.classList.remove('open');
    }

    galleryToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleGalleryPanel();
    });

    galleryCloseBtn.addEventListener('click', closeGalleryPanel);

    const imageModal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-img');
    const modalCaption = document.getElementById('modal-caption');
    const modalCounter = document.getElementById('modal-counter');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalPrevBtn = document.getElementById('modal-prev-btn');
    const modalNextBtn = document.getElementById('modal-next-btn');

    let currentModalImages = [];
    let currentModalIndex = 0;

    // Graceful fallback for hotlinked images that fail to load.
    modalImg.addEventListener('load', () => { modalImg.style.display = ''; });
    modalImg.addEventListener('error', () => { modalImg.style.display = 'none'; });

    function openLightboxModal(locationKey, startIndex) {
      const location = BLOCKS[locationKey];
      if (!location || !location.images || location.images.length === 0) return;

      currentModalImages = location.images;
      currentModalIndex = startIndex;
      updateModalView();
      imageModal.classList.add('open');
    }

    function updateModalView() {
      const activeImg = currentModalImages[currentModalIndex];
      modalImg.style.opacity = '0.3';

      setTimeout(() => {
        modalImg.src = activeImg.url;
        modalCaption.textContent = activeImg.caption;
        modalCounter.textContent = `${currentModalIndex + 1} / ${currentModalImages.length}`;
        modalImg.style.opacity = '1';
      }, 100);
    }

    function nextModalImage() {
      if (currentModalImages.length === 0) return;
      currentModalIndex = (currentModalIndex + 1) % currentModalImages.length;
      updateModalView();
    }

    function prevModalImage() {
      if (currentModalImages.length === 0) return;
      currentModalIndex = (currentModalIndex - 1 + currentModalImages.length) % currentModalImages.length;
      updateModalView();
    }

    function closeLightboxModal() {
      imageModal.classList.remove('open');
    }

    modalCloseBtn.addEventListener('click', closeLightboxModal);
    modalNextBtn.addEventListener('click', nextModalImage);
    modalPrevBtn.addEventListener('click', prevModalImage);

    let touchStartX = 0;
    let touchEndX = 0;

    imageModal.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    imageModal.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipeGesture();
    }, { passive: true });

    function handleSwipeGesture() {
      const swipeDistance = touchEndX - touchStartX;
      const SWIPE_THRESHOLD = 40;

      if (swipeDistance < -SWIPE_THRESHOLD) {
        nextModalImage();
      } else if (swipeDistance > SWIPE_THRESHOLD) {
        prevModalImage();
      }
    }

    function calculateBearing(startLng, startLat, destLng, destLat) {
      const rad = Math.PI / 180;
      const dLng = (destLng - startLng) * rad;
      const lat1 = startLat * rad;
      const lat2 = destLat * rad;

      const y = Math.sin(dLng) * Math.cos(lat2);
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
      const bearing = Math.atan2(y, x) * (180 / Math.PI);
      return (bearing + 360) % 360;
    }

    function calculateDistanceSq(coordA, coordB) {
      const dLng = coordA[0] - coordB[0];
      const dLat = coordA[1] - coordB[1];
      return dLng * dLng + dLat * dLat;
    }

    function getClosestPointOnSegment(p, a, b) {
      const x = p[0], y = p[1];
      const x1 = a[0], y1 = a[1];
      const x2 = b[0], y2 = b[1];

      const dx = x2 - x1;
      const dy = y2 - y1;

      if (dx === 0 && dy === 0) return [x1, y1];

      let t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
      t = Math.max(0, Math.min(1, t));

      return [x1 + t * dx, y1 + t * dy];
    }

    function getRouteCoords(route) {
      if (!route || !route.features || route.features.length === 0) return null;
      return route.features[0].geometry.coordinates;
    }

    // Find the nearest point across ALL known building route lines (soft-match source).
    function getNearestSegmentAcrossRoutes(coord) {
      let closestPoint = coord;
      let minDistSq = Infinity;

      Object.keys(BLOCKS).forEach((blockKey) => {
        const block = BLOCKS[blockKey];
        if (!block || !block.route) return;
        const lineCoords = getRouteCoords(block.route);
        if (!lineCoords || lineCoords.length < 2) return;
        for (let i = 0; i < lineCoords.length - 1; i++) {
          const projected = getClosestPointOnSegment(coord, lineCoords[i], lineCoords[i + 1]);
          const distSq = calculateDistanceSq(coord, projected);
          if (distSq < minDistSq) {
            minDistSq = distSq;
            closestPoint = projected;
          }
        }
      });

      return closestPoint;
    }

    // Soft lane attractor: blend raw fix toward nearest walkway within LANE_ATTRACT_RADIUS_M.
    function applyLaneAttractor(lng, lat) {
      const projected = getNearestSegmentAcrossRoutes([lng, lat]);
      const cosLat = Math.cos(lat * Math.PI / 180);
      const distM = Math.hypot(
        (lng - projected[0]) * cosLat * 111320,
        (lat - projected[1]) * 111320
      );
      if (distM >= LANE_ATTRACT_RADIUS_M) return [lng, lat];
      const weight = 1 - distM / LANE_ATTRACT_RADIUS_M;
      return [
        lng + (projected[0] - lng) * weight,
        lat + (projected[1] - lat) * weight
      ];
    }

    function getNearestNetworkPoint(coord) {
      let closestPoint = coord;
      let minDistanceSq = Infinity;

      const targetBlock = BLOCKS[selectedLocationKey];
      const lineCoords = targetBlock && getRouteCoords(targetBlock.route);
      if (lineCoords && lineCoords.length > 1) {
        for (let i = 0; i < lineCoords.length - 1; i++) {
          const projected = getClosestPointOnSegment(coord, lineCoords[i], lineCoords[i + 1]);
          const distSq = calculateDistanceSq(coord, projected);
          if (distSq < minDistanceSq) {
            minDistanceSq = distSq;
            closestPoint = projected;
          }
        }
      }

      return closestPoint;
    }

    function createArrowElement(bearingAngle) {
      const el = document.createElement('div');
      el.className = 'arrow-marker';
      el.innerHTML = '⬆';
      el.style.transform = `rotate(${bearingAngle}deg)`;
      return el;
    }

    const blockMarkers = {};
    Object.keys(BLOCKS).forEach(key => {
      const block = BLOCKS[key];
      const mainMarker = new maplibregl.Marker({ color: '#e11d48' })
        .setLngLat(block.coords);

      const markerEl = mainMarker.getElement();
      if (markerEl) {
        markerEl.style.cursor = 'pointer';
        markerEl.addEventListener('click', (e) => {
          e.stopPropagation();
          selectLocation(key);
        });
      }

      blockMarkers[key] = mainMarker;
    });

    let activeNearestEntryMarker = null;

    function updateNearestEntryMarker() {
      if (!selectedLocationKey) {
        if (activeNearestEntryMarker) {
          activeNearestEntryMarker.remove();
          activeNearestEntryMarker = null;
        }
        return;
      }

      const targetBlock = BLOCKS[selectedLocationKey];
      if (!targetBlock) return;

      let targetPoint = targetBlock.coords;
      if (targetBlock.entries && targetBlock.entries.length > 0) {
        let nearestEntry = targetBlock.entries[0];
        let minDistanceSq = calculateDistanceSq(currentUserCoords, nearestEntry);

        for (let i = 1; i < targetBlock.entries.length; i++) {
          const distSq = calculateDistanceSq(currentUserCoords, targetBlock.entries[i]);
          if (distSq < minDistanceSq) {
            minDistanceSq = distSq;
            nearestEntry = targetBlock.entries[i];
          }
        }
        targetPoint = nearestEntry;
      }

      const targetBearing = calculateBearing(
        targetPoint[0], targetPoint[1],
        targetBlock.coords[0], targetBlock.coords[1]
      );
      const relativeBearing = targetBearing - map.getBearing();

      if (activeNearestEntryMarker) {
        activeNearestEntryMarker.remove();
      }

      const arrowEl = createArrowElement(relativeBearing);
      activeNearestEntryMarker = new maplibregl.Marker({ element: arrowEl })
        .setLngLat(targetPoint)
        .addTo(map);
    }

    map.on('rotate', updateNearestEntryMarker);

    function checkArrival() {
      if (!selectedLocationKey || hasArrived) return;

      const targetBlock = BLOCKS[selectedLocationKey];
      if (!targetBlock || !targetBlock.entries || targetBlock.entries.length === 0) return;

      let targetPoint = targetBlock.entries[0];
      let minDist = distanceBetweenCoords(currentUserCoords, targetPoint);
      for (let i = 1; i < targetBlock.entries.length; i++) {
        const d = distanceBetweenCoords(currentUserCoords, targetBlock.entries[i]);
        if (d < minDist) { minDist = d; targetPoint = targetBlock.entries[i]; }
      }

      if (minDist <= ARRIVAL_THRESHOLD_M) {
        hasArrived = true;
        arrivalNotification.classList.add('show');
        if (arrivalTimeout) clearTimeout(arrivalTimeout);
        arrivalTimeout = setTimeout(() => {
          arrivalNotification.classList.remove('show');
        }, 3000);
      }
    }

    function updateStraightLine() {
      if (!selectedLocationKey || !map.getSource('straight-line-source')) return;

      const targetBlock = BLOCKS[selectedLocationKey];
      if (!targetBlock) return;

      const nearestNetworkPoint = getNearestNetworkPoint(currentUserCoords);

      // This line is the "get onto the path" hint (user -> nearest route point). Once
      // the user is essentially on the network, it's redundant with the route line, so
      // clear it to reduce visual clutter.
      const distanceToNetwork = Math.hypot(
        nearestNetworkPoint[0] - currentUserCoords[0],
        nearestNetworkPoint[1] - currentUserCoords[1]
      );
      const coordinates = distanceToNetwork <= ON_NETWORK_THRESHOLD
        ? []
        : [currentUserCoords, nearestNetworkPoint];

      map.getSource('straight-line-source').setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: coordinates
        }
      });
    }

    // --- DYNAMIC FADING ROUTE LINE (Trims passed route points) ---
    function updateActiveRouteLine() {
      if (!selectedLocationKey) return;
      const activeRouteSource = map.getSource('active-block-route-source');
      const targetBlock = BLOCKS[selectedLocationKey];

      if (activeRouteSource && targetBlock && targetBlock.route) {
        const fullRoute = getRouteCoords(targetBlock.route);
        if (!fullRoute || fullRoute.length === 0) return;

        let closestSegmentIndex = 0;
        let closestPointOnSegment = fullRoute[0];
        let minDistanceSq = Infinity;

        for (let i = 0; i < fullRoute.length - 1; i++) {
          const projected = getClosestPointOnSegment(currentUserCoords, fullRoute[i], fullRoute[i + 1]);
          const distSq = calculateDistanceSq(currentUserCoords, projected);
          if (distSq < minDistanceSq) {
            minDistanceSq = distSq;
            closestSegmentIndex = i;
            closestPointOnSegment = projected;
          }
        }

        const remainingCoords = [
          closestPointOnSegment,
          ...fullRoute.slice(closestSegmentIndex + 1)
        ];

        activeRouteSource.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: remainingCoords
              }
            }
          ]
        });
      }
    }

    function selectLocation(selectedKey) {
      const targetBlock = BLOCKS[selectedKey];

      if (targetBlock) {
        selectedLocationKey = selectedKey;
        hasArrived = false;

        const searchInput = document.getElementById('search-input');
        searchInput.value = targetBlock.name;

        Object.keys(blockMarkers).forEach(k => {
          blockMarkers[k].remove();
        });

        blockMarkers[selectedKey].addTo(map);

        showBuilding(selectedKey);

        updateActiveRouteLine();
        updateStraightLine();
        updateNearestEntryMarker();
        renderGalleryContent(selectedKey);
        closeGalleryPanel();

        // Interior view takes over whenever the user is inside the selected building.
        updateInteriorView();

        // --- CAMERA INTRO DIVE UPON SELECTION IN FPV MODE ---
        // One-shot cinematic dive into the over-shoulder framing (user foreground,
        // target behind). The framing is held through device/camera orientation changes
        // and only released when the user translates, handing over to normal FPV follow.
        if (isFPVEnabled && !isInteriorView) {
          cameraFocusDiving = true;
          introFrameHeld = false;
          introHoldCoords = null;
          const lockedKey = selectedKey;

          const bearingToTarget = calculateBearing(
            currentUserCoords[0], currentUserCoords[1],
            targetBlock.coords[0], targetBlock.coords[1]
          );

          map.easeTo({
            center: [
              (currentUserCoords[0] + targetBlock.coords[0]) / 2,
              (currentUserCoords[1] + targetBlock.coords[1]) / 2
            ],
            pitch: LOCK_PITCH,
            bearing: bearingToTarget,
            zoom: 19.5,
            duration: 1200
          });

          map.once('moveend', () => {
            if (selectedLocationKey !== lockedKey) return;
            cameraFocusDiving = false;
            if (isFPVEnabled) {
              introFrameHeld = true;
              introHoldCoords = [...currentUserCoords];
            }
          });
        }
      }
    }

    const sidebarToggleBtn = document.getElementById('sidebar-toggle');
    const sidePanel = document.getElementById('side-panel');

    sidebarToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sidePanel.classList.toggle('open');
    });

    document.querySelectorAll('.location-item').forEach(item => {
      item.addEventListener('click', () => {
        const key = item.getAttribute('data-key');
        selectLocation(key);
        sidePanel.classList.remove('open');
      });
    });

    map.on('click', () => sidePanel.classList.remove('open'));

    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');

    function searchLocations(query) {
      const normalizedQuery = query.trim().toLowerCase();
      if (!normalizedQuery) {
        searchResults.style.display = 'none';
        return;
      }

      const matches = Object.keys(BLOCKS).filter(key => {
        const name = BLOCKS[key].name.toLowerCase();
        return name.includes(normalizedQuery) || key.includes(normalizedQuery);
      });

      searchResults.innerHTML = '';

      if (matches.length > 0) {
        matches.forEach(key => {
          const item = document.createElement('div');
          item.className = 'search-result-item';
          item.textContent = `📍 ${BLOCKS[key].name}`;
          item.addEventListener('click', () => {
            selectLocation(key);
            searchResults.style.display = 'none';
          });
          searchResults.appendChild(item);
        });
        searchResults.style.display = 'block';
      } else {
        searchResults.style.display = 'none';
      }
    }

    searchInput.addEventListener('input', (e) => searchLocations(e.target.value));

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const normalizedQuery = searchInput.value.trim().toLowerCase();
        const matchedKey = Object.keys(BLOCKS).find(key => {
          const name = BLOCKS[key].name.toLowerCase();
          return name === normalizedQuery || name.includes(normalizedQuery) || key === normalizedQuery;
        });

        if (matchedKey) {
          selectLocation(matchedKey);
          searchResults.style.display = 'none';
          searchInput.blur();
        }
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-container')) {
        searchResults.style.display = 'none';
      }
    });

    const userContainer = document.createElement('div');
    userContainer.className = 'user-marker-container';

    const visionConeSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    visionConeSvg.setAttribute("class", "vision-cone");
    visionConeSvg.setAttribute("viewBox", "0 0 60 60");
    visionConeSvg.innerHTML = `
      <defs>
        <linearGradient id="coneGrad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stop-color="#1e3a8a" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="#1e3a8a" stop-opacity="0.05"/>
        </linearGradient>
      </defs>
      <path d="M 30 30 L 12 3 A 30 30 0 0 1 48 3 Z" fill="url(#coneGrad)" />
    `;

    const userPulse = document.createElement('div');
    userPulse.className = 'user-pulse';

    const userDot = document.createElement('div');
    userDot.className = 'user-dot';

    userContainer.appendChild(visionConeSvg);
    userContainer.appendChild(userPulse);
    userContainer.appendChild(userDot);

    userContainer.style.display = 'none'; // hidden until first GPS fix

    const userMarker = new maplibregl.Marker({ element: userContainer })
      .setLngLat(currentUserCoords)
      .addTo(map);

    function updateVisionConeOrientation() {
      if (isInteriorView) return;
      const relativeHeading = userHeading - map.getBearing();
      visionConeSvg.style.transform = `rotate(${relativeHeading}deg)`;
    }

    updateVisionConeOrientation();
    map.on('rotate', updateVisionConeOrientation);

    function startGPSWatch() {
      if ('geolocation' in navigator) {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            if (controlMode === 'gps') {
              applyGpsFix(position.coords.longitude, position.coords.latitude, position.coords.heading);
            }
          },
          (error) => {
            if (!gpsSignalLost) {
              gpsSignalLost = true;
              userContainer.classList.add('gps-lost');
            }
            console.warn("GPS watchPosition error or unavailable.", error);
          },
          { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
        );
      }
    }

    startGPSWatch();

    const MOVE_STEP = 0.000015; 
    const KEYBOARD_MOVE_STEP = 0.000008;
    const ROTATE_STEP = 3.0;    

    const activeKeys = {};
    const CONTROL_KEYS = ['a', 'w', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];

    // --- HIDDEN PONG GAME ---
    const pongOverlay = document.createElement('div');
    pongOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(15,23,42,0.95);z-index:9999;display:none;';
    const pongCanvas = document.createElement('canvas');
    pongCanvas.style.cssText = 'display:block;width:100%;height:100%;';
    pongOverlay.appendChild(pongCanvas);
    document.body.appendChild(pongOverlay);

    let pongCtx = pongCanvas.getContext('2d');
    let pongActive = false;
    let p1Y = 0, p2Y = 0, bX = 0, bY = 0, bVX = 0, bVY = 0;
    let s1 = 0, s2 = 0, pFlash1 = 0, pFlash2 = 0;
    let pW = 15, pH = 100;
    let particles = [];
    let goalMsg = { text: '', alpha: 0 };

    class Particle {
      constructor(x, y, color, speed) {
        this.x = x; this.y = y;
        this.vx = (Math.random() - 0.5) * speed;
        this.vy = (Math.random() - 0.5) * speed;
        this.life = 1.0;
        this.color = color;
        this.size = Math.random() * 4 + 2;
      }
      update() {
        this.x += this.vx; this.y += this.vy; this.life -= 0.03;
      }
      draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1.0;
      }
    }

    function createParticles(x, y, color, amount, speed) {
      for(let i=0; i<amount; i++) particles.push(new Particle(x, y, color, speed));
    }

    function resetPongBall() {
      bX = pongCanvas.width / 2; bY = pongCanvas.height / 2;
      bVX = (Math.random() > 0.5 ? 1 : -1) * 7;
      bVY = (Math.random() - 0.5) * 8;
    }

    function togglePong() {
      pongActive = !pongActive;
      if (pongActive) {
        pongOverlay.style.display = 'block';
        pongCanvas.width = window.innerWidth;
        pongCanvas.height = window.innerHeight;
        p1Y = pongCanvas.height / 2 - pH / 2;
        p2Y = pongCanvas.height / 2 - pH / 2;
        s1 = 0; s2 = 0;
        particles = [];
        resetPongBall();
        pongLoop();
      } else {
        pongOverlay.style.display = 'none';
      }
    }

    function pongLoop() {
      if (!pongActive) return;

      pongCtx.clearRect(0, 0, pongCanvas.width, pongCanvas.height);

      if (activeKeys['w']) p1Y -= 8;
      if (activeKeys['s']) p1Y += 8;
      if (activeKeys['arrowup']) p2Y -= 8;
      if (activeKeys['arrowdown']) p2Y += 8;

      p1Y = Math.max(0, Math.min(pongCanvas.height - pH, p1Y));
      p2Y = Math.max(0, Math.min(pongCanvas.height - pH, p2Y));

      bX += bVX; bY += bVY;

      // Wall bounce
      if (bY <= 0 || bY >= pongCanvas.height) {
        bVY = -bVY;
        createParticles(bX, bY, '#94a3b8', 5, 5);
      }

      // Paddle bounce
      if (bX <= 40 + pW && bY >= p1Y && bY <= p1Y + pH && bVX < 0) {
        bVX = -bVX * 1.1; bVY += (bY - (p1Y + pH/2)) * 0.1; pFlash1 = 1;
        createParticles(40 + pW, bY, '#e11d48', 15, 10);
      }
      if (bX >= pongCanvas.width - 40 - pW && bY >= p2Y && bY <= p2Y + pH && bVX > 0) {
        bVX = -bVX * 1.1; bVY += (bY - (p2Y + pH/2)) * 0.1; pFlash2 = 1;
        createParticles(pongCanvas.width - 40 - pW, bY, '#38bdf8', 15, 10);
      }

      // Scoring
      if (bX < 0) {
        s2++; goalMsg = { text: 'P2 GOAL!', alpha: 1 };
        createParticles(0, bY, '#38bdf8', 50, 15);
        resetPongBall();
      } else if (bX > pongCanvas.width) {
        s1++; goalMsg = { text: 'P1 GOAL!', alpha: 1 };
        createParticles(pongCanvas.width, bY, '#e11d48', 50, 15);
        resetPongBall();
      }

      // Draw Paddles
      pongCtx.fillStyle = pFlash1 > 0 ? '#ffffff' : '#e11d48'; pFlash1 -= 0.05;
      pongCtx.fillRect(40, p1Y, pW, pH);
      pongCtx.fillStyle = pFlash2 > 0 ? '#ffffff' : '#38bdf8'; pFlash2 -= 0.05;
      pongCtx.fillRect(pongCanvas.width - 40 - pW, p2Y, pW, pH);

      // Draw Ball
      pongCtx.fillStyle = '#ffffff';
      pongCtx.beginPath(); pongCtx.arc(bX, bY, 8, 0, Math.PI * 2); pongCtx.fill();

      // Draw Scores & Center line
      pongCtx.fillStyle = 'rgba(255,255,255,0.2)';
      for(let i=0; i<pongCanvas.height; i+=40) pongCtx.fillRect(pongCanvas.width/2 - 2, i, 4, 20);
      pongCtx.font = 'bold 64px sans-serif'; pongCtx.textAlign = 'center';
      pongCtx.fillStyle = 'rgba(255,255,255,0.3)';
      pongCtx.fillText(s1, pongCanvas.width/2 - 100, 80);
      pongCtx.fillText(s2, pongCanvas.width/2 + 100, 80);

      // Draw Particles
      for(let i = particles.length - 1; i >= 0; i--) {
        particles[i].update(); particles[i].draw(pongCtx);
        if (particles[i].life <= 0) particles.splice(i, 1);
      }

      // Draw Goal Msg
      if (goalMsg.alpha > 0) {
        pongCtx.globalAlpha = goalMsg.alpha;
        pongCtx.fillStyle = '#ffffff';
        pongCtx.font = '900 80px sans-serif';
        pongCtx.fillText(goalMsg.text, pongCanvas.width/2, pongCanvas.height/2);
        pongCtx.globalAlpha = 1.0;
        goalMsg.alpha -= 0.02;
      }

      requestAnimationFrame(pongLoop);
    }
    window.addEventListener('resize', () => {
      if(pongActive) { pongCanvas.width = window.innerWidth; pongCanvas.height = window.innerHeight; }
    });
    // --- END HIDDEN PONG GAME ---


    window.addEventListener('keydown', (e) => {
      if (document.activeElement === searchInput || imageModal.classList.contains('open') || blockSelectModal.classList.contains('open')) return;
      
      const key = e.key.toLowerCase();

      if (key === 'z') {
        if (!DEBUG_MODE) return;
        e.preventDefault();
        togglePong();
        return;
      }

      if (key === 't') {
        if (!DEBUG_MODE) return;
        e.preventDefault();
        currentUserCoords = [...START_COORDINATE];
        targetCoords = [...currentUserCoords];
        userMarker.setLngLat(currentUserCoords);
        updateVisionConeOrientation();
        updateStraightLine();
        updateNearestEntryMarker();
        updateActiveRouteLine();
        updateInteriorView();
        return;
      }

      if (key === 'p') {
        e.preventDefault();
        toggleControlMode();
        return;
      }

      if (controlMode === 'manual' && DEBUG_MODE && TELEPORT_COORDINATES[key]) {
        e.preventDefault();
        currentUserCoords = [...TELEPORT_COORDINATES[key]];
        targetCoords = [...currentUserCoords];
        userMarker.setLngLat(currentUserCoords);
        updateVisionConeOrientation();
        updateStraightLine();
        updateNearestEntryMarker();
        updateActiveRouteLine();
        updateInteriorView();
        return;
      }

      if (controlMode === 'manual' && CONTROL_KEYS.includes(key)) {
        if(!pongActive) e.preventDefault();
        activeKeys[key] = true;
      } else if (pongActive && CONTROL_KEYS.includes(key)) {
        e.preventDefault();
        activeKeys[key] = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (CONTROL_KEYS.includes(key)) {
        activeKeys[key] = false;
      }
    });

    function handleMovementLoop() {
      // --- COMPASS JOYSTICK (drag to rotate bearing / tilt pitch) ---
      if (compassActive) {
        if (Math.abs(compassVector.x) > 0.1) {
          map.setBearing(map.getBearing() - compassVector.x * COMPASS_ROTATE_STEP);
        }
        if (Math.abs(compassVector.y) > 0.1) {
          const newPitch = map.getPitch() - compassVector.y * COMPASS_PITCH_STEP;
          map.setPitch(Math.min(85, Math.max(0, newPitch)));
        }
      }

      // --- GPS MODE (runs every frame) ---
      // Dead-reckon between fixes; settle gracefully when fixes go stale.
      if (controlMode === 'gps' && gpsInitialized) {
        const now = performance.now();
        if (now - lastGpsFixTime < GPS_STALE_AFTER_MS) {
          // Extrapolate at measured (clamped) velocity; decay once ops slow down.
          if (gpsVelocityX !== 0 || gpsVelocityY !== 0) {
            const recency = Math.max(0, 1 - (now - lastGpsFixTime) / GPS_STALE_AFTER_MS);
            currentUserCoords[0] += gpsVelocityX * recency;
            currentUserCoords[1] += gpsVelocityY * recency;
          }
        } else {
          // Frame-graceful settle: ease velocity to zero like a body coming to rest.
          gpsVelocityX *= GPS_VELOCITY_DECAY;
          gpsVelocityY *= GPS_VELOCITY_DECAY;
          if (Math.abs(gpsVelocityX) > 1e-10 || Math.abs(gpsVelocityY) > 1e-10) {
            currentUserCoords[0] += gpsVelocityX;
            currentUserCoords[1] += gpsVelocityY;
          }
        }

        // Critically-damped spring toward the (attractor-filtered) target fix,
        // so near fixes blend in without rubber-banding against extrapolation.
        const dx = targetCoords[0] - currentUserCoords[0];
        const dy = targetCoords[1] - currentUserCoords[1];
        const dist = Math.hypot(dx, dy);
        if (dist > 1e-9) {
          const spring = Math.min(1, 0.18 + dist * 2000);
          currentUserCoords[0] += dx * spring;
          currentUserCoords[1] += dy * spring;
        }

        userMarker.setLngLat(currentUserCoords);
        updateVisionConeOrientation();
        checkArrival();
      }

      if (controlMode === 'manual' && !pongActive) {
        let moved = false;

        // --- RIGHT JOYSTICK / KEYBOARD ROTATION ---
        let turning = false;
        if (rightJoyActive && Math.abs(rightJoyVector.x) > 0.05) {
          userHeading = (userHeading + rightJoyVector.x * ROTATE_STEP * 0.4 + 360) % 360;
          turning = true;
        }

        if (activeKeys['a'] || activeKeys['arrowleft']) {
          userHeading = (userHeading - ROTATE_STEP + 360) % 360;
          turning = true;
        }

        if (activeKeys['d'] || activeKeys['arrowright']) {
          userHeading = (userHeading + ROTATE_STEP) % 360;
          turning = true;
        }

        if (turning && isFPVEnabled) {
          map.easeTo({
            center: currentUserCoords,
            pitch: DEFAULT_PITCH,
            bearing: userHeading,
            zoom: 19.5,
            duration: 80
          });
        }

        // --- LEFT JOYSTICK MOVEMENT ---
        if (leftJoyActive && (Math.abs(leftJoyVector.x) > 0.1 || Math.abs(leftJoyVector.y) > 0.1)) {
          const inputAngleRad = Math.atan2(leftJoyVector.x, -leftJoyVector.y);

          const moveAngleRad = userHeading * (Math.PI / 180) + inputAngleRad;
          const speedFactor = Math.hypot(leftJoyVector.x, leftJoyVector.y);
          const currentSpeed = (MOVE_STEP * 0.35) * Math.min(1, speedFactor);

          currentUserCoords[0] += Math.sin(moveAngleRad) * currentSpeed;
          currentUserCoords[1] += Math.cos(moveAngleRad) * currentSpeed;
          moved = true;
        }

        // --- KEYBOARD TRANSLATION ---
        let nextLng = currentUserCoords[0];
        let nextLat = currentUserCoords[1];

        if (activeKeys['w'] || activeKeys['arrowup']) {
          const rad = userHeading * (Math.PI / 180);
          const step = isFPVEnabled ? KEYBOARD_MOVE_STEP * 0.35 : KEYBOARD_MOVE_STEP;
          nextLng += Math.sin(rad) * step;
          nextLat += Math.cos(rad) * step;
          moved = true;
        }

        if (activeKeys['s'] || activeKeys['arrowdown']) {
          const rad = userHeading * (Math.PI / 180);
          const step = isFPVEnabled ? KEYBOARD_MOVE_STEP * 0.35 : KEYBOARD_MOVE_STEP;
          nextLng -= Math.sin(rad) * step;
          nextLat -= Math.cos(rad) * step;
          moved = true;
        }

        if (moved) {
          currentUserCoords[0] = leftJoyActive ? currentUserCoords[0] : nextLng;
          currentUserCoords[1] = leftJoyActive ? currentUserCoords[1] : nextLat;

          userMarker.setLngLat(currentUserCoords);
          updateVisionConeOrientation();
          updateStraightLine();
          updateNearestEntryMarker();
          updateActiveRouteLine();
          updateInteriorView();
        }

        checkArrival();
      }

      requestAnimationFrame(handleMovementLoop);
    }

    handleMovementLoop();
