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

  // --- Viewport gate ---
  if (window.innerWidth <= MIN_VIEWPORT) return;

  // --- State ---
  var enabled = localStorage.getItem(LS_KEY) === 'on'; // default: off
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

    // Attractor glow — once per session
    if (!sessionStorage.getItem('plane-attractor-seen')) {
      setTimeout(function() {
        toggleBtn.classList.add('attractor');
      }, 1500);

      toggleBtn.addEventListener('mouseenter', function() {
        toggleBtn.classList.remove('attractor');
        sessionStorage.setItem('plane-attractor-seen', '1');
      }, { once: true });
    }
  }

  function updateButtonLabel() {
    if (toggleBtn) toggleBtn.textContent = enabled ? 'Plane Off' : 'Plane On';
  }

  function toggle() {
    enabled = !enabled;
    localStorage.setItem(LS_KEY, enabled ? 'on' : 'off');
    updateButtonLabel();

    if (enabled) {
      if (!initialized) {
        init();
      } else {
        start();
      }
    } else {
      stop();
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
    if (canvasContainer) canvasContainer.style.display = 'none';
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
      window.addEventListener('resize', onResize);
      window.addEventListener('resize', markIframeRectsStale);
      window.addEventListener('scroll', markIframeRectsStale, { passive: true });

      initialized = true;
      running = true;
      animationFrameId = requestAnimationFrame(animate);
    }).catch(function (err) {
      console.warn('Three.js scripts failed to load:', err);
    });
  }

  // --- Bootstrap ---
  createToggleButton();
  if (enabled) init();
})();
