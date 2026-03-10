(function () {
  // --- Tuneable Constants ---
  var MODEL_SCALE       = 0.1;
  var LERP_SPEED        = 0.05;
  var CURSOR_OFFSET_Z   = 1;
  var MAX_ROLL_ANGLE    = 85 * (Math.PI / 180);
  var ROLL_LERP_SPEED   = 0.08;
  var ROLL_SENSITIVITY  = 0.15;
  var PROPELLER_SPEED   = 15;
  var OFFSCREEN_MARGIN  = 3;
  var FRUSTUM_SIZE      = 10;
  var MIN_VIEWPORT      = 768;
  var LS_KEY            = 'portfolio-plane';
  var IFRAME_BUFFER     = 50;
  var IFRAME_BUFFER_TOP = 65;
  var WING_OFFSET       = 0.2;
  var WING_Z_OFFSET     = 0.3;   // world units behind plane center (positive = further back)
  var PROJECTILE_SPEED  = 8.0;
  var TAIL_SPEED_RATIO  = 0.7;
  var FIRE_INTERVAL     = 0.12;  // seconds between rapid-fire bursts (hold click)

  // --- Viewport gate ---
  if (window.innerWidth <= MIN_VIEWPORT) return;

  // --- State ---
  var enabled = sessionStorage.getItem(LS_KEY) === 'on'; // default: off
  var initialized = false;
  var running = false;
  var animationFrameId = null;

  var scene, camera, renderer, clock;
  var aspect;
  var planeModel = null;
  var planeGroup = null;
  var frontPropeller = null;
  var topPropeller = null;

  var mouseScreenX = 0;
  var mouseScreenY = 0;
  var prevMouseScreenX = 0;
  var mouseOnScreen = false;
  var hasReceivedMouseMove = false;
  var currentRoll = 0;
  var targetRoll = 0;
  var targetPosition = null; // THREE.Vector3, created after scripts load
  var lastMouseMoveTime = 0;
  var MOUSE_STALE_MS = 100;
  var projectiles = [];
  var fireIntervalId = null;

  // --- Iframe avoidance ---
  var cachedIframeRects = [];
  var iframeRectsStale = true;

  function refreshIframeRects() {
    var iframes = document.querySelectorAll('iframe');
    cachedIframeRects = [];
    for (var i = 0; i < iframes.length; i++) {
      cachedIframeRects.push(iframes[i].getBoundingClientRect());
    }
    iframeRectsStale = false;
  }

  function markIframeRectsStale() {
    iframeRectsStale = true;
  }

  function getAvoidanceTarget(sx, sy) {
    if (iframeRectsStale) refreshIframeRects();
    for (var i = 0; i < cachedIframeRects.length; i++) {
      var r = cachedIframeRects[i];
      var bLeft = r.left - IFRAME_BUFFER;
      var bRight = r.right + IFRAME_BUFFER;
      var bTop = r.top - IFRAME_BUFFER_TOP;
      var bBottom = r.bottom + IFRAME_BUFFER;
      if (sx >= bLeft && sx <= bRight && sy >= bTop && sy <= bBottom) {
        // cursor is inside buffered rect — find closest edge
        var dLeft = sx - bLeft;
        var dRight = bRight - sx;
        var dTop = sy - bTop;
        var dBottom = bBottom - sy;
        var minD = Math.min(dLeft, dRight, dTop, dBottom);
        var outX = sx;
        var outY = sy;
        if (minD === dLeft) {
          outX = bLeft - 1;
        } else if (minD === dRight) {
          outX = bRight + 1;
        } else if (minD === dTop) {
          outY = bTop - 1;
        } else {
          outY = bBottom + 1;
        }
        return { x: outX, y: outY };
      }
    }
    return null;
  }

  var canvasContainer = document.getElementById('plane-canvas');
  var toggleBtn = null;

  // --- Toggle Button ---
  function createToggleButton() {
    toggleBtn = document.createElement('button');
    toggleBtn.className = 'plane-toggle';
    updateButtonLabel();
    toggleBtn.addEventListener('click', toggle);
    document.body.appendChild(toggleBtn);

    // Attractor bounce — once per session
    if (!sessionStorage.getItem('plane-attractor-seen')) {
      var attractorTl;
      setTimeout(function() {
        toggleBtn.classList.add('attractor');
        attractorTl = gsap.timeline({ repeat: -1, repeatDelay: 0.6 });
        attractorTl.to(toggleBtn, {
          duration: 0.4,
          scale: 1.3,
          ease: 'power1.out',
          force3D: true
        });
        attractorTl.to(toggleBtn, {
          duration: 0.7,
          scale: 1,
          ease: 'elastic.out(1.7, 0.45)',
          force3D: true
        });
      }, 1500);

      toggleBtn.addEventListener('mouseenter', function() {
        if (attractorTl) attractorTl.kill();
        gsap.set(toggleBtn, { scale: 1 });
        toggleBtn.classList.remove('attractor');
        sessionStorage.setItem('plane-attractor-seen', '1');
      }, { once: true });
    }
  }

  function updateButtonLabel() {
    if (toggleBtn) toggleBtn.textContent = enabled ? 'Plane On' : 'Plane Off';
  }

  function toggle() {
    enabled = !enabled;
    sessionStorage.setItem(LS_KEY, enabled ? 'on' : 'off');
    updateButtonLabel();

    if (enabled) {
      document.documentElement.classList.add('plane-active');
      if (!initialized) {
        init();
      } else {
        start();
      }
      if (window.TextDestruction) TextDestruction.init();
    } else {
      document.documentElement.classList.remove('plane-active');
      stop();
      if (window.TextDestruction) TextDestruction.destroy();
    }
  }

  function start() {
    if (running) return;
    running = true;
    if (canvasContainer) canvasContainer.style.display = '';
    clock.getDelta(); // flush stale delta
    animationFrameId = requestAnimationFrame(animate);
  }

  function stop() {
    running = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    stopFiring();
    for (var i = 0; i < projectiles.length; i++) {
      scene.remove(projectiles[i].line);
      projectiles[i].line.geometry.dispose();
      projectiles[i].line.material.dispose();
    }
    projectiles.length = 0;
    if (canvasContainer) canvasContainer.style.display = 'none';
    document.documentElement.classList.remove('plane-active');
  }

  // --- Dynamic Script Loading ---
  function loadScripts() {
    return new Promise(function (resolve, reject) {
      if (window.THREE && window.THREE.GLTFLoader) {
        resolve();
        return;
      }
      if (window.THREE) {
        loadGLTFLoader(resolve, reject);
        return;
      }
      var s1 = document.createElement('script');
      s1.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
      s1.onload = function () { loadGLTFLoader(resolve, reject); };
      s1.onerror = reject;
      document.head.appendChild(s1);
    });
  }

  function loadGLTFLoader(resolve, reject) {
    var s2 = document.createElement('script');
    s2.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';
    s2.onload = resolve;
    s2.onerror = reject;
    document.head.appendChild(s2);
  }

  // --- Mouse-to-world conversion ---
  function screenToWorld(sx, sy) {
    var wx = (sx / window.innerWidth - 0.5) * FRUSTUM_SIZE * aspect;
    var wz = (sy / window.innerHeight - 0.5) * FRUSTUM_SIZE;
    return { x: wx, z: wz };
  }

  function worldToScreen(wx, wz) {
    var sx = (wx / (FRUSTUM_SIZE * aspect) + 0.5) * window.innerWidth;
    var sy = (wz / FRUSTUM_SIZE + 0.5) * window.innerHeight;
    return { x: sx, y: sy };
  }
  window._planeWorldToScreen = worldToScreen;

  // --- Mouse Events ---
  function onMouseMove(e) {
    prevMouseScreenX = mouseScreenX;
    mouseScreenX = e.clientX;
    mouseScreenY = e.clientY;
    mouseOnScreen = true;
    lastMouseMoveTime = performance.now();

    if (!hasReceivedMouseMove && planeGroup) {
      hasReceivedMouseMove = true;
      planeGroup.visible = true;
      var world = screenToWorld(mouseScreenX, mouseScreenY);
      planeGroup.position.set(world.x, 0, world.z + CURSOR_OFFSET_Z);
      targetPosition.set(world.x, 0, world.z + CURSOR_OFFSET_Z);
    }
  }

  function onMouseLeave(e) {
    // When the cursor enters an iframe, the document fires mouseleave
    // even though the cursor is still visually on the page. Detect this
    // by checking if the leave coordinates fall inside an iframe.
    if (iframeRectsStale) refreshIframeRects();
    for (var i = 0; i < cachedIframeRects.length; i++) {
      var r = cachedIframeRects[i];
      if (e.clientX >= r.left && e.clientX <= r.right &&
          e.clientY >= r.top && e.clientY <= r.bottom) {
        // Cursor entered an iframe — keep mouseOnScreen true,
        // snap coords to the iframe edge so avoidance works.
        mouseScreenX = e.clientX;
        mouseScreenY = e.clientY;
        mouseOnScreen = true;
        return;
      }
    }
    mouseOnScreen = false;
  }

  function onMouseEnter(e) {
    mouseOnScreen = true;
    prevMouseScreenX = e.clientX;
    mouseScreenX = e.clientX;
    mouseScreenY = e.clientY;
  }

  // When mousemove stops but mouseOnScreen is still true, the cursor
  // is likely trapped inside an iframe. Snap mouse coords to the nearest
  // edge of the containing iframe so the avoidance logic stays accurate.
  function snapMouseIfTrappedInIframe() {
    if (!mouseOnScreen) return;
    if (performance.now() - lastMouseMoveTime < MOUSE_STALE_MS) return;
    if (iframeRectsStale) refreshIframeRects();
    for (var i = 0; i < cachedIframeRects.length; i++) {
      var r = cachedIframeRects[i];
      // Use a small margin since the last known position may be just outside
      var m = 5;
      if (mouseScreenX >= r.left - m && mouseScreenX <= r.right + m &&
          mouseScreenY >= r.top - m && mouseScreenY <= r.bottom + m) {
        var dLeft = mouseScreenX - r.left;
        var dRight = r.right - mouseScreenX;
        var dTop = mouseScreenY - r.top;
        var dBottom = r.bottom - mouseScreenY;
        var minD = Math.min(dLeft, dRight, dTop, dBottom);
        if (minD === dLeft) {
          mouseScreenX = r.left;
        } else if (minD === dRight) {
          mouseScreenX = r.right;
        } else if (minD === dTop) {
          mouseScreenY = r.top;
        } else {
          mouseScreenY = r.bottom;
        }
        return;
      }
    }
  }

  // --- Projectile helpers ---
  function getAccentColor() {
    var hex = getComputedStyle(document.documentElement)
      .getPropertyValue('--accent').trim();
    return new THREE.Color(hex);
  }

  function fireProjectiles() {
    var color = getAccentColor();
    var px = planeGroup.position.x;
    var pz = planeGroup.position.z;
    var endX = px;
    var endZ = pz - CURSOR_OFFSET_Z;
    var offsets = [-WING_OFFSET, WING_OFFSET];

    for (var i = 0; i < offsets.length; i++) {
      var wingX = px + offsets[i] * Math.cos(currentRoll);
      var wingZ = pz + WING_Z_OFFSET;
      var positions = new Float32Array(6);
      positions[0] = wingX;  positions[1] = 0; positions[2] = wingZ;
      positions[3] = wingX;  positions[4] = 0; positions[5] = wingZ;

      var geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      var material = new THREE.LineBasicMaterial({ color: color });
      var line = new THREE.Line(geometry, material);
      scene.add(line);

      projectiles.push({
        line: line,
        startX: wingX,
        startZ: wingZ,
        endX: endX,
        endZ: endZ,
        progress: 0
      });
    }
  }

  function onMouseDown(e) {
    if (!running || !planeGroup || !planeGroup.visible) return;
    if (e.button !== 0) return;
    if (e.target.closest('.plane-toggle, nav, .theme-switcher')) return;
    fireProjectiles();
    clearInterval(fireIntervalId);
    fireIntervalId = setInterval(fireProjectiles, FIRE_INTERVAL * 1000);
  }

  function stopFiring() {
    clearInterval(fireIntervalId);
    fireIntervalId = null;
  }

  // --- Animation Loop ---
  function animate() {
    if (!running) return;
    animationFrameId = requestAnimationFrame(animate);
    var delta = clock.getDelta();

    if (planeGroup && planeGroup.visible) {
      // Propeller spin
      if (frontPropeller) frontPropeller.rotation.x += PROPELLER_SPEED * delta;
      if (topPropeller) topPropeller.rotation.y -= PROPELLER_SPEED * delta;

      // Compute target position
      snapMouseIfTrappedInIframe();
      if (mouseOnScreen) {
        // The plane sits below the cursor by CURSOR_OFFSET_Z world units.
        // Check the plane's effective screen position against iframe rects.
        var offsetPx = CURSOR_OFFSET_Z / FRUSTUM_SIZE * window.innerHeight;
        var planeScreenY = mouseScreenY + offsetPx;
        var avoidPoint = getAvoidanceTarget(mouseScreenX, planeScreenY);
        var world;
        if (avoidPoint) {
          // avoidPoint is where the plane should be on screen — no extra offset
          world = screenToWorld(avoidPoint.x, avoidPoint.y);
          targetPosition.x = world.x;
          targetPosition.z = world.z;
        } else {
          world = screenToWorld(mouseScreenX, mouseScreenY);
          targetPosition.x = world.x;
          targetPosition.z = world.z + CURSOR_OFFSET_Z;
        }
      } else {
        var halfWidth = FRUSTUM_SIZE * aspect / 2;
        if (planeGroup.position.x >= 0) {
          targetPosition.x = halfWidth + OFFSCREEN_MARGIN;
        } else {
          targetPosition.x = -halfWidth - OFFSCREEN_MARGIN;
        }
      }
      targetPosition.y = 0;

      // Lerp position
      planeGroup.position.lerp(targetPosition, LERP_SPEED);

      // Roll
      var dx = mouseScreenX - prevMouseScreenX;
      if (mouseOnScreen && dx !== 0) {
        targetRoll = THREE.MathUtils.clamp(-dx * ROLL_SENSITIVITY, -MAX_ROLL_ANGLE, MAX_ROLL_ANGLE);
      }
      targetRoll = THREE.MathUtils.lerp(targetRoll, 0, 0.03);
      currentRoll = THREE.MathUtils.lerp(currentRoll, targetRoll, ROLL_LERP_SPEED);
      planeGroup.rotation.z = currentRoll;

      prevMouseScreenX = mouseScreenX;
    }

    // Update projectiles
    for (var p = projectiles.length - 1; p >= 0; p--) {
      var proj = projectiles[p];
      proj.progress += PROJECTILE_SPEED * delta;
      var headT = Math.min(proj.progress, 1.0);
      var tailT = Math.min(proj.progress * TAIL_SPEED_RATIO, 1.0);

      var pos = proj.line.geometry.attributes.position.array;
      pos[0] = proj.startX + (proj.endX - proj.startX) * headT;
      pos[1] = 0;
      pos[2] = proj.startZ + (proj.endZ - proj.startZ) * headT;
      pos[3] = proj.startX + (proj.endX - proj.startX) * tailT;
      pos[4] = 0;
      pos[5] = proj.startZ + (proj.endZ - proj.startZ) * tailT;
      proj.line.geometry.attributes.position.needsUpdate = true;

      // Text destruction: shatter at impact point only
      if (window.TextDestruction && headT >= 1.0 && !proj.impacted) {
        proj.impacted = true;
        var screenPos = window._planeWorldToScreen(proj.endX, proj.endZ);
        TextDestruction.onProjectileAt(screenPos.x, screenPos.y);
      }

      if (tailT >= 1.0) {
        scene.remove(proj.line);
        proj.line.geometry.dispose();
        proj.line.material.dispose();
        projectiles.splice(p, 1);
      }
    }

    renderer.render(scene, camera);
  }

  // --- Resize ---
  function onResize() {
    if (!renderer) return;
    aspect = window.innerWidth / window.innerHeight;
    camera.left   = -FRUSTUM_SIZE * aspect / 2;
    camera.right  =  FRUSTUM_SIZE * aspect / 2;
    camera.top    =  FRUSTUM_SIZE / 2;
    camera.bottom = -FRUSTUM_SIZE / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // --- Init ---
  function init() {
    if (initialized) { start(); return; }

    loadScripts().then(function () {
      // Scene
      scene = new THREE.Scene();

      // Camera
      aspect = window.innerWidth / window.innerHeight;
      camera = new THREE.OrthographicCamera(
        -FRUSTUM_SIZE * aspect / 2,
         FRUSTUM_SIZE * aspect / 2,
         FRUSTUM_SIZE / 2,
        -FRUSTUM_SIZE / 2,
        0.1,
        100
      );
      camera.position.set(0, 20, 0);
      camera.lookAt(0, 0, 0);

      // Renderer
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputEncoding = THREE.sRGBEncoding;
      if (canvasContainer) canvasContainer.appendChild(renderer.domElement);

      // Lighting
      var ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
      scene.add(ambientLight);
      var dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
      dirLight.position.set(0, 10, 5);
      scene.add(dirLight);

      // State
      targetPosition = new THREE.Vector3(0, 0, 0);
      clock = new THREE.Clock();

      // Load model
      var loader = new THREE.GLTFLoader();
      loader.load(
        'assets/plane.glb',
        function (gltf) {
          planeModel = gltf.scene;

          planeModel.traverse(function (child) {
            if (child.name === 'FrontPropeller') frontPropeller = child;
            if (child.name === 'TopPropeller') topPropeller = child;
          });

          planeModel.rotation.y = -Math.PI / 2;
          planeModel.scale.setScalar(MODEL_SCALE);

          planeGroup = new THREE.Group();
          planeGroup.add(planeModel);
          planeGroup.visible = false;
          scene.add(planeGroup);
        },
        undefined,
        function (error) {
          console.warn('Plane GLB failed to load:', error);
        }
      );

      // Events
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseleave', onMouseLeave);
      document.addEventListener('mouseenter', onMouseEnter);
      document.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mouseup', stopFiring);
      window.addEventListener('mouseleave', stopFiring);
      window.addEventListener('resize', onResize);
      window.addEventListener('resize', markIframeRectsStale);
      window.addEventListener('scroll', markIframeRectsStale, { passive: true });

      initialized = true;
      running = true;
      document.documentElement.classList.add('plane-active');
      animationFrameId = requestAnimationFrame(animate);
      if (window.TextDestruction) TextDestruction.init();
    }).catch(function (err) {
      console.warn('Three.js scripts failed to load:', err);
    });
  }

  // --- Bootstrap ---
  createToggleButton();
  if (enabled) init();
})();
