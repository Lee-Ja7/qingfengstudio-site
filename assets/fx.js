/* ============================================================
   深空终端 · 交互层
   ① 鼠标驱动的网格错位（canvas，只重绘鼠标附近）
   ② 聚光跟随（transform 合成层 + 标题渐变扫过）
   ③ 卡片弹性倾斜（变量驱动，离开时 spring 回弹）
   ④ 点击卡片空间转场（点亮 → 整页推入 → 跳转）
   零依赖；移动端与 reduced-motion 自动降级
   ============================================================ */
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var coarse = window.matchMedia("(pointer: coarse)");
  var CELL = 56;      /* 必须与 .fx-grid 的 background-size 一致 */
  var RADIUS = 200;

  function motionOK() { return !reduce.matches; }
  function isTouch() { return coarse.matches; }

  /* ---------------- 背景层注入 ---------------- */
  function buildBg() {
    if (document.querySelector(".fx-bg")) return null;
    var bg = document.createElement("div");
    bg.className = "fx-bg";
    bg.setAttribute("aria-hidden", "true");
    bg.innerHTML =
      '<div class="fx-aurora"></div>' +
      '<div class="fx-aurora fx-aurora--b"></div>' +
      '<div class="fx-core"></div>' +
      '<div class="fx-grid"></div>' +
      '<canvas id="fx-mesh"></canvas>' +
      '<div class="fx-spot"></div>' +
      '<div class="fx-scan"></div>';
    document.body.insertBefore(bg, document.body.firstChild);
    return bg;
  }

  /* ---------------- 网格错位 ---------------- */
  function initMesh(bg) {
    var canvas = bg.querySelector("#fx-mesh");
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = 0, h = 0;
    var mx = -9999, my = -9999;
    var lastMove = 0;
    var raf = 0;
    var lineColor = "rgba(79,227,193,";
    var active = false;

    function readColor() {
      var probe = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
      if (!probe) return;
      var m = probe.match(/^#?([0-9a-f]{6})$/i);
      if (m) {
        var n = parseInt(m[1], 16);
        lineColor = "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + ",";
      }
    }

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      if (mx < -1000 || !active) return;
      var c0 = Math.max(0, Math.floor((mx - RADIUS) / CELL));
      var c1 = Math.min(Math.ceil(w / CELL), Math.ceil((mx + RADIUS) / CELL));
      var r0 = Math.max(0, Math.floor((my - RADIUS) / CELL));
      var r1 = Math.min(Math.ceil(h / CELL), Math.ceil((my + RADIUS) / CELL));
      ctx.lineWidth = 1;
      for (var cx = c0; cx <= c1; cx++) {
        for (var cy = r0; cy <= r1; cy++) {
          var x = cx * CELL;
          var y = cy * CELL;
          var dx = x - mx;
          var dy = y - my;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d > RADIUS) continue;
          var k = 1 - d / RADIUS;
          var push = k * k * 20;
          var ox = d > 0.001 ? (dx / d) * push : 0;
          var oy = d > 0.001 ? (dy / d) * push : 0;
          var a = k * 0.55;
          ctx.strokeStyle = lineColor + a.toFixed(3) + ")";
          ctx.strokeRect(x + ox + 0.5, y + oy + 0.5, CELL, CELL);
        }
      }
    }

    function loop() {
      draw();
      var t = performance.now();
      if (t - lastMove < 140) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = 0;
      }
    }

    function kick() {
      lastMove = performance.now();
      if (!raf) raf = requestAnimationFrame(loop);
    }

    window.addEventListener("mousemove", function (e) {
      mx = e.clientX;
      my = e.clientY;
      active = true;
      kick();
    }, { passive: true });

    window.addEventListener("mouseout", function (e) {
      if (!e.relatedTarget) {
        mx = my = -9999;
        active = false;
        ctx.clearRect(0, 0, w, h);
      }
    });

    window.addEventListener("resize", resize, { passive: true });
    readColor();
    resize();
    document.addEventListener("fx:theme", readColor);
  }

  /* ---------------- 聚光跟随 ---------------- */
  function initSpot(bg) {
    var spot = bg.querySelector(".fx-spot");
    var title = document.querySelector(".hero-title--fx");
    if (!spot) return;
    var tx = window.innerWidth / 2;
    var ty = window.innerHeight * 0.3;
    var cx = tx, cy = ty;
    var raf = 0;

    function step() {
      cx += (tx - cx) * 0.14;
      cy += (ty - cy) * 0.14;
      spot.style.transform = "translate3d(" + cx.toFixed(1) + "px," + cy.toFixed(1) + "px,0)";
      if (title) {
        var p = Math.max(0, Math.min(1, cx / window.innerWidth));
        title.style.setProperty("--gx", (18 + p * 64).toFixed(1) + "%");
      }
      if (Math.abs(tx - cx) > 0.4 || Math.abs(ty - cy) > 0.4) {
        raf = requestAnimationFrame(step);
      } else {
        raf = 0;
      }
    }
    function kick() { if (!raf) raf = requestAnimationFrame(step); }

    window.addEventListener("mousemove", function (e) {
      tx = e.clientX;
      ty = e.clientY;
      document.documentElement.classList.add("fx-on");
      kick();
    }, { passive: true });

    /* 首屏先亮一次，别等用户动鼠标 */
    document.documentElement.classList.add("fx-on");
    kick();
  }

  /* ---------------- 卡片弹性倾斜 ---------------- */
  function initTilt() {
    if (isTouch() || !motionOK()) return;
    var cards = document.querySelectorAll(".bento .card, #post-list .post-card, .link-card, #category-list .card");
    Array.prototype.forEach.call(cards, function (card) {
      var raf = 0, lastX = 0, lastY = 0;

      function apply() {
        var r = card.getBoundingClientRect();
        var nx = (lastX - r.left) / r.width - 0.5;
        var ny = (lastY - r.top) / r.height - 0.5;
        nx = Math.max(-0.5, Math.min(0.5, nx));
        ny = Math.max(-0.5, Math.min(0.5, ny));
        card.style.setProperty("--ry", (nx * 7).toFixed(2) + "deg");
        card.style.setProperty("--rx", (-ny * 7).toFixed(2) + "deg");
        card.style.setProperty("--sc", "1.012");
        /* 卡内聚光跟着指针走 */
        card.style.setProperty("--cx", ((nx + 0.5) * 100).toFixed(1) + "%");
        card.style.setProperty("--cy", ((ny + 0.5) * 100).toFixed(1) + "%");
        raf = 0;
      }

      card.addEventListener("mousemove", function (e) {
        lastX = e.clientX;
        lastY = e.clientY;
        card.classList.add("is-tilting");
        if (!raf) raf = requestAnimationFrame(apply);
      }, { passive: true });

      card.addEventListener("mouseleave", function () {
        card.classList.remove("is-tilting");
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
        card.style.setProperty("--sc", "1");
        card.style.setProperty("--cx", "50%");
        card.style.setProperty("--cy", "-30%");
      });
    });
  }

  /* ---------------- 点击卡片：空间转场 ---------------- */
  function initSpatial() {
    if (!motionOK()) return;
    var mask = document.createElement("div");
    mask.className = "fx-mask";
    mask.setAttribute("aria-hidden", "true");
    document.body.appendChild(mask);

    document.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      /* 卡片内的标签链接单独跳转，不算整卡点击 */
      var inner = e.target.closest ? e.target.closest("a[href]") : null;
      if (inner && (inner.classList.contains("tag") || inner.closest(".card-meta"))) return;
      var card = e.target.closest ? e.target.closest(".bento .card, .post-card") : null;
      if (!card) return;
      var link = card.tagName === "A" ? card : card.querySelector("a.stretch, a[href]");
      if (!link) return;
      var href = link.getAttribute("href");
      if (!href || href.charAt(0) === "#" || link.target === "_blank") return;

      e.preventDefault();
      card.classList.add("is-launch");
      var lead = isTouch() ? 40 : 70;
      var push = isTouch() ? 170 : 330;
      setTimeout(function () {
        document.documentElement.classList.remove("fx-enter");
        document.documentElement.classList.add("fx-push");
        setTimeout(function () { location.href = link.href; }, push);
      }, lead);
    }, true);
  }

  /* ---------------- 页面进入 ---------------- */
  function initEnter() {
    if (!motionOK()) return;
    document.documentElement.classList.add("fx-enter");
    setTimeout(function () {
      document.documentElement.classList.remove("fx-enter");
    }, 700);
  }

  /* ---------------- 内页水印：QINGFENG + 签名 ---------------- */
  var BRAND_SVG =
    '<svg class="hero-mark" viewBox="0 0 620 130" preserveAspectRatio="xMaxYMid meet" focusable="false">' +
    '<text x="620" y="104" text-anchor="end" fill="none" stroke="currentColor" stroke-width="1.2"' +
    ' textLength="612" lengthAdjust="spacingAndGlyphs"' +
    ' font-family="ui-monospace, \'SF Mono\', Consolas, monospace" font-size="120" font-weight="700">QINGFENG</text></svg>';

  function initPageBrand() {
    if (document.querySelector(".page-brand")) return;
    if (document.body.getAttribute("data-page") === "home") return;
    var el = document.createElement("div");
    el.className = "page-brand";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = BRAND_SVG +
      '<img class="hero-sign" src="assets/signature.png" alt="" width="600" height="281">';
    document.body.appendChild(el);
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    var bg = buildBg();
    /* 触摸设备没有 mousemove：网格 canvas 与聚光都不必启动，省一层合成 */
    if (bg && motionOK() && !isTouch()) {
      initMesh(bg);
      initSpot(bg);
    }
    initPageBrand();
    initTilt();
    initSpatial();
    initEnter();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
