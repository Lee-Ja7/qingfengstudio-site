/* 全站脚本：主题 / 渲染 / 筛选 / TOC / 进度 / 复制 */
(function () {
  var S = window.SITE;
  var P = window.POSTS || [];

  /* ---------- 动效能力探测 ---------- */
  var mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  function motionOK() { return !mqReduce.matches; }
  /* 跨文档视图过渡需 http(s) 同源；file:// 直开一律走入场/离场兜底 */
  var vtOK = location.protocol !== "file:" && "startViewTransition" in document;
  if (!vtOK) document.documentElement.classList.add("no-vt");

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }
  function readingTime(md) {
    var n = md.replace(/[`*#>\-|\[\]()~]/g, "").length;
    return Math.max(1, Math.round(n / 350));
  }

  /* ---------- 主题 ---------- */
  function initTheme() {
    var btn = document.getElementById("theme-toggle");
    var order = ["system", "light", "dark"];
    var saved = localStorage.getItem("theme") || S.theme || "dark";
    var idx = Math.max(0, order.indexOf(saved));
    var icon = ["◐", "☀", "☾"];
    var animTimer = 0;

    function apply(animate) {
      var mode = order[idx];
      var dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      if (animate && motionOK()) {
        var root = document.documentElement;
        root.classList.add("theme-anim");
        clearTimeout(animTimer);
        animTimer = setTimeout(function () { root.classList.remove("theme-anim"); }, 320);
      }
      document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
      if (btn) {
        btn.textContent = icon[idx];
        btn.setAttribute("data-mode", mode);
        btn.title = "主题：" + ({ system: "跟随系统", light: "浅色", dark: "深色" })[mode];
      }
      localStorage.setItem("theme", mode);
      document.dispatchEvent(new CustomEvent("fx:theme"));
    }
    apply(false);
    if (btn) {
      btn.addEventListener("click", function () {
        idx = (idx + 1) % order.length;
        apply(true);
      });
    }
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
      if (order[idx] === "system") apply(true);
    });
  }

  /* ---------- 页头 / 页脚 ---------- */
  function curFile() {
    var p = location.pathname.split("/").pop() || "index.html";
    return p;
  }
  function renderHeader() {
    var host = document.getElementById("site-header");
    if (!host) return;
    var nav = S.nav.map(function (n) {
      var active = n.href === curFile() ? " active" : "";
      return '<a href="' + n.href + '" class="' + active.trim() + '">' + n.label + "</a>";
    }).join("");
    host.innerHTML =
      '<div class="header-inner">' +
      '<a class="brand" href="index.html"><span class="brand-name">' + esc(S.en.toUpperCase()) + '</span>' +
      '<span class="brand-slash">/</span><span class="brand-sub">' + esc(S.name) + "</span></a>" +
      '<nav class="site-nav">' + nav + "</nav>" +
      '<button class="theme-toggle" id="theme-toggle" type="button" title="切换主题">◐</button>' +
      "</div>";
    initTheme();
  }
  function renderFooter() {
    var host = document.getElementById("site-footer");
    if (!host) return;
    var year = new Date().getFullYear();
    host.innerHTML =
      '<div>© ' + S.since + "–" + year + " " + esc(S.author) + " · " + esc(S.motto) + "</div>" +
      '<div><a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener">' + esc(S.icp) + "</a>" +
      '<span class="sep">|</span><a href="feed.xml">RSS</a>' +
      '<span class="sep">|</span>用 HTML 手写，无构建' + "</div>";
  }

  /* ---------- 入场动画 ---------- */
  function initReveal() {
    var els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      els.forEach(function (e) { e.classList.add("in-view"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in-view"); io.unobserve(en.target); }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -8% 0px" });
    els.forEach(function (e, i) {
      e.style.transitionDelay = (i % 8) * 40 + "ms";
      io.observe(e);
    });
    /* 兜底：视口内的元素若因时序没被点亮，1.2s 后强制显示，避免正文大段空白 */
    setTimeout(function () {
      var vh = window.innerHeight;
      els.forEach(function (e) {
        if (e.classList.contains("in-view")) return;
        var r = e.getBoundingClientRect();
        if (r.top < vh && r.bottom > 0) e.classList.add("in-view");
      });
    }, 1200);
  }

  /* Hero 逐字浮现（文章页标题用；首页大标题走 .hero-title--fx 的聚光渐变） */
  function initHeroType() {
    var list = document.querySelectorAll(".hero-title:not(.hero-title--fx)");
    if (!list.length) return;
    if (!motionOK()) {
      list.forEach(function (h) { h.classList.add("played"); });
      return;
    }
    list.forEach(function (h) {
      if (h.dataset.typed) return;
      h.dataset.typed = "1";
      var text = h.textContent;
      h.textContent = "";
      text.split("").forEach(function (ch, i) {
        var sp = document.createElement("span");
        sp.className = "char";
        sp.textContent = ch === " " ? "\u00A0" : ch;
        sp.style.transitionDelay = Math.min(i, 24) * 26 + "ms";
        h.appendChild(sp);
      });
      /* 先落一帧初始态，再挂 played，避免后台标签页里 rAF 不触发导致标题不显示 */
      void h.offsetWidth;
      h.classList.add("played");
      requestAnimationFrame(function () { h.classList.add("played"); });
      setTimeout(function () { h.classList.add("played"); }, 80);
    });
  }

  /* ---------- 通用：列表逐条淡入 ---------- */
  function animateList(el) {
    if (!el) return;
    el.classList.remove("list-enter");
    void el.offsetWidth;
    el.classList.add("list-enter");
  }

  /* ---------- 通用：文章卡片 ---------- */
  /* 外层用 article + 拉伸链接，避免卡片里再嵌标签链接（<a> 不能嵌套） */
  function postCard(p, idx) {
    var num = String(idx + 1).padStart(2, "0");
    var tags = p.tags.map(function (t) {
      return '<a class="tag" href="posts.html?tag=' + encodeURIComponent(t) + '">#' + esc(t) + "</a>";
    }).join("");
    var cat = S.categories.find(function (c) { return c.slug === p.category; });
    return '<article class="card post-card">' +
      '<div class="date">' + num + " · " + p.date + (cat ? " · " + cat.name : "") + "</div>" +
      '<h3 class="title"><a class="stretch" href="post.html?slug=' + encodeURIComponent(p.slug) + '">' + esc(p.title) + "</a></h3>" +
      '<p class="summary">' + esc(p.summary) + "</p>" +
      '<div class="card-meta">' + tags + "</div></article>";
  }

  /* ---------- 首页 ---------- */
  function renderHome() {
    var sorted = P.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var featured = document.getElementById("featured");
    var list = document.getElementById("post-list");

    if (featured) {
      var lead = sorted[0];
      var side = sorted.slice(1, 3);
      var html = "";

      if (lead) {
        html += '<article class="card post-card b-lg">' +
          '<div>' +
          '<div class="kicker">featured</div>' +
          '<div class="date" style="margin-top:.55rem">' + lead.date + catName(lead) + "</div>" +
          '<h3 class="title"><a class="stretch" href="post.html?slug=' + encodeURIComponent(lead.slug) + '">' + esc(lead.title) + "</a></h3>" +
          '<p class="summary">' + esc(lead.summary) + "</p>" +
          "</div>" +
          '<div class="card-foot">' +
          lead.tags.map(function (t) {
            return '<a class="tag" href="posts.html?tag=' + encodeURIComponent(t) + '">#' + esc(t) + "</a>";
          }).join("") +
          '<span class="read-more">阅读全文 →</span>' +
          "</div></article>";
      }

      side.forEach(function (p) {
        html += '<article class="card post-card b-sm">' +
          '<div class="kicker">' + p.date.slice(5).replace("-", ".") + "</div>" +
          '<h3 class="title"><a class="stretch" href="post.html?slug=' + encodeURIComponent(p.slug) + '">' + esc(p.title) + "</a></h3>" +
          '<div class="date" style="margin-top:.5rem">' + catName(p, true) + "</div>" +
          "</article>";
      });

      html += '<a class="card b-sm b-link" href="about.html">' +
        '<div class="kicker">about</div>' +
        '<div class="title">关于这个站</div>' +
        '<div class="summary">前端开发 · 动效与静态架构</div></a>';

      html += '<a class="card b-sm b-link" href="contact.html">' +
        '<div class="kicker">contact</div>' +
        '<div class="title">说点什么</div>' +
        '<div class="summary">' + esc(S.email) + "</div></a>";

      featured.innerHTML = html;
      animateList(featured);
    }

    if (list) {
      list.innerHTML = sorted.map(function (p, i) { return postCard(p, i); }).join("");
      animateList(list);
    }
    var count = document.getElementById("post-count");
    if (count) count.textContent = P.length;
    var year = document.getElementById("hero-year");
    if (year) year.textContent = new Date().getFullYear();

    /* HUD 状态行 */
    var sp = document.getElementById("stat-posts");
    if (sp) sp.textContent = String(P.length).padStart(2, "0");
    var st = document.getElementById("stat-tags");
    if (st) {
      var tagSet = {};
      P.forEach(function (p) { p.tags.forEach(function (t) { tagSet[t] = 1; }); });
      st.textContent = String(Object.keys(tagSet).length).padStart(2, "0");
    }
    var ss = document.getElementById("stat-since");
    if (ss) ss.textContent = S.since;
  }

  function catName(p, plain) {
    var c = S.categories.find(function (x) { return x.slug === p.category; });
    if (!c) return "";
    return plain ? c.name : " · " + c.name;
  }

  /* ---------- 列表页 ---------- */
  function renderList() {
    var tag = qs("tag"), cat = qs("cat"), q = qs("q");
    var input = document.getElementById("search-input");
    var list = document.getElementById("post-list");
    var count = document.getElementById("result-count");
    var tagCloud = document.getElementById("tag-cloud");
    var catBar = document.getElementById("cat-bar");

    if (tagCloud) {
      var counts = {};
      P.forEach(function (p) { p.tags.forEach(function (t) { counts[t] = (counts[t] || 0) + 1; }); });
      tagCloud.innerHTML = S.tags.filter(function (t) { return counts[t]; }).map(function (t) {
        return '<a class="tag' + (t === tag ? "" : " muted") + '" href="posts.html?tag=' + encodeURIComponent(t) + '">' + t + " · " + (counts[t] || 0) + "</a>";
      }).join("");
    }
    if (catBar) {
      catBar.innerHTML = '<a class="tag' + (!cat ? "" : " muted") + '" href="posts.html">全部</a>' +
        S.categories.map(function (c) {
          return '<a class="tag' + (c.slug === cat ? "" : " muted") + '" href="posts.html?cat=' + c.slug + '">' + c.name + "</a>";
        }).join("");
    }
    if (input && q) input.value = q;

    function filter() {
      var kw = (input ? input.value : q || "").trim().toLowerCase();
      var rows = P.filter(function (p) {
        if (cat && p.category !== cat) return false;
        if (tag && p.tags.indexOf(tag) === -1) return false;
        if (kw) {
          var hay = (p.title + p.summary + p.tags.join(" ")).toLowerCase();
          if (hay.indexOf(kw) === -1) return false;
        }
        return true;
      }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });

      if (rows.length) {
        list.innerHTML = rows.map(function (p, i) { return postCard(p, i); }).join("");
      } else {
        list.innerHTML = '<div class="empty">没有匹配的文章</div>';
      }
      animateList(list);
      if (count) count.textContent = rows.length;
      if (input) {
        var u = new URL(location.href);
        if (kw) u.searchParams.set("q", kw); else u.searchParams.delete("q");
        history.replaceState(null, "", u);
      }
    }
    if (input) {
      var t = 0;
      input.addEventListener("input", function () {
        clearTimeout(t);
        t = setTimeout(filter, 90);
      });
    }
    filter();
  }

  /* ---------- 详情页 ---------- */
  function renderPost() {
    var slug = qs("slug");
    var p = P.find(function (x) { return x.slug === slug; }) || P[0];
    if (!p) { document.getElementById("post-body").innerHTML = '<div class="empty">文章不存在</div>'; return; }

    document.title = p.title + " · " + S.name;
    var cat = S.categories.find(function (c) { return c.slug === p.category; });

    var head = document.getElementById("post-head");
    if (head) {
      head.innerHTML =
        '<div class="meta-line">' +
        '<span class="index-chip">' + String(P.indexOf(p) + 1).padStart(2, "0") + "</span>" +
        "<span>" + p.date + "</span>" +
        (cat ? '<a class="tag" href="posts.html?cat=' + cat.slug + '">' + cat.name + "</a>" : "") +
        "<span>" + readingTime(p.body) + " 分钟</span>" +
        "</div>" +
        '<h1 class="hero-title" id="post-title">' + esc(p.title) + "</h1>" +
        '<p class="hero-intro reveal">' + esc(p.summary) + "</p>";
    }
    var tags = document.getElementById("post-tags");
    if (tags) {
      tags.innerHTML = p.tags.map(function (t) {
        return '<a class="tag" href="posts.html?tag=' + encodeURIComponent(t) + '">#' + esc(t) + "</a>";
      }).join("");
    }

    var body = document.getElementById("post-body");
    body.innerHTML = MD.render(p.body);
    body.className = "article-body";

    buildToc();
    initCopy();
    buildPager(p);
    initProgress();
  }

  function buildToc() {
    var toc = document.getElementById("toc");
    var body = document.getElementById("post-body");
    if (!toc || !body) return;
    var hs = body.querySelectorAll("h2, h3");
    if (hs.length < 2) { toc.style.display = "none"; return; }
    var items = [];
    hs.forEach(function (h, i) {
      h.id = h.id || ("s" + i);
      items.push('<a href="#' + h.id + '" class="lvl-' + h.tagName.toLowerCase().replace("h", "") + '" data-target="' + h.id + '">' + esc(h.textContent) + "</a>");
    });
    toc.innerHTML = '<div class="toc-title">目录</div>' + items.join("");

    var links = toc.querySelectorAll("a");
    var map = {};
    hs.forEach(function (h, i) { map[h.id] = links[i]; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          links.forEach(function (l) { l.classList.remove("active"); });
          if (map[en.target.id]) map[en.target.id].classList.add("active");
        }
      });
    }, { rootMargin: "-20% 0px -70% 0px" });
    hs.forEach(function (h) { io.observe(h); });
  }

  function initCopy() {
    document.querySelectorAll(".code-block").forEach(function (block) {
      var btn = block.querySelector(".copy-btn");
      var code = block.querySelector("code");
      if (!btn || !code) return;
      btn.addEventListener("click", function () {
        var t = code.textContent;
        var done = function () {
          btn.textContent = "已复制";
          btn.classList.add("copied");
          setTimeout(function () { btn.textContent = "复制"; btn.classList.remove("copied"); }, 1200);
        };
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(t).then(done).catch(function () { fallback(); });
        } else { fallback(); }
        function fallback() {
          var ta = document.createElement("textarea");
          ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
          document.body.appendChild(ta); ta.select();
          try { document.execCommand("copy"); done(); } catch (e) {}
          document.body.removeChild(ta);
        }
      });
    });
  }

  function buildPager(p) {
    var host = document.getElementById("pager");
    if (!host) return;
    var sorted = P.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var i = sorted.findIndex(function (x) { return x.slug === p.slug; });
    var prev = sorted[i + 1], next = sorted[i - 1];
    host.innerHTML =
      (prev ? '<a href="post.html?slug=' + prev.slug + '"><span class="dir">← 上一篇</span>' + esc(prev.title) + "</a>" : "<span></span>") +
      (next ? '<a class="next" href="post.html?slug=' + next.slug + '"><span class="dir">下一篇 →</span>' + esc(next.title) + "</a>" : "<span></span>");
  }

  function initProgress() {
    var bar = document.getElementById("read-progress");
    if (!bar) return;
    var onScroll = function () {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      var r = max > 0 ? h.scrollTop / max : 0;
      bar.style.width = (r * 100).toFixed(2) + "%";
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- 关于页 ---------- */
  function renderAbout() {
    var intro = document.getElementById("intro-list");
    if (intro) {
      intro.innerHTML = S.intro.map(function (s) { return "<p>" + esc(s) + "</p>"; }).join("");
    }
    var catHost = document.getElementById("category-list");
    if (catHost) {
      catHost.innerHTML = S.categories.map(function (c) {
        return '<a class="card post-card reveal" href="posts.html?cat=' + c.slug + '">' +
          '<div class="title">' + esc(c.name) + "</div>" +
          '<div class="summary">' + esc(c.desc) + "</div></a>";
      }).join("");
    }
  }

  /* ---------- 友链页 ---------- */
  function renderLinks() {
    var host = document.getElementById("link-list");
    if (!host) return;
    host.innerHTML = S.links.map(function (l, i) {
      var ch = (l.name || "链").charAt(0);
      return '<div class="card link-card reveal"><span class="link-dot">' + esc(ch) + "</span>" +
        '<div><a href="' + l.url + '" target="_blank" rel="noopener">' + esc(l.name) + "</a>" +
        '<div class="summary" style="color:var(--muted);font-size:0.88rem">' + esc(l.desc) + "</div></div></div>";
    }).join("");
  }

  /* ---------- 联系页 ---------- */
  function renderContact() {
    var host = document.getElementById("contact-list");
    if (!host) return;
    host.innerHTML =
      '<div class="contact-item"><span class="k">邮箱</span><span><a href="mailto:' + esc(S.email) + '">' + esc(S.email) + "</a></span></div>" +
      '<div class="contact-item"><span class="k">GitHub</span><span><a href="' + esc(S.github) + '" target="_blank" rel="noopener">' + esc(S.github) + "</a></span></div>" +
      '<div class="contact-item"><span class="k">回复</span><span>通常 1–3 天</span></div>';
  }

  /* ---------- 搜索页 ---------- */
  function renderSearch() {
    var input = document.getElementById("search-input");
    var list = document.getElementById("post-list");
    if (input && list) {
      function run() {
        var kw = input.value.trim().toLowerCase();
        if (!kw) {
          list.innerHTML = '<div class="empty">输入关键词开始搜索</div>';
          animateList(list);
          return;
        }
        var rows = P.filter(function (p) {
          return (p.title + p.summary + p.tags.join(" ") + p.body).toLowerCase().indexOf(kw) > -1;
        });
        list.innerHTML = rows.length
          ? rows.map(function (p, i) { return postCard(p, i); }).join("")
          : '<div class="empty">没有匹配的文章</div>';
        animateList(list);
      }
      var t = 0;
      input.addEventListener("input", function () {
        clearTimeout(t);
        t = setTimeout(run, 90);
      });
      run();
    }
  }

  /* ---------- 滚动反馈：顶栏阴影 + 回到顶部 ---------- */
  function initScrollUI() {
    var header = document.querySelector(".site-header");
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "to-top";
    btn.textContent = "↑";
    btn.title = "回到顶部";
    btn.setAttribute("aria-label", "回到顶部");
    document.body.appendChild(btn);

    var ticking = false;
    function update() {
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      if (header) header.classList.toggle("scrolled", y > 6);
      btn.classList.toggle("show", y > 520);
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();

    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: motionOK() ? "smooth" : "auto" });
    });
  }

  /* ---------- 离场过渡：无视图过渡能力时手动接管站内跳转 ---------- */
  function initPageLeave() {
    if (vtOK || !motionOK()) return;
    var leaving = false;
    document.addEventListener("click", function (e) {
      if (leaving || e.defaultPrevented) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest ? e.target.closest("a[href]") : null;
      if (!a) return;
      if (a.target && a.target !== "_self") return;
      if (a.hasAttribute("download") || a.getAttribute("href").charAt(0) === "#") return;
      var url;
      try { url = new URL(a.href, location.href); } catch (err) { return; }
      if (url.protocol !== location.protocol) return;
      /* http(s) 下再校验同源；file:// 的 origin 恒为 null，比路径即可 */
      if ((url.protocol === "http:" || url.protocol === "https:") && url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      leaving = true;
      document.documentElement.classList.add("page-leave");
      setTimeout(function () { location.href = url.href; }, 150);
    });
    window.addEventListener("pageshow", function (ev) {
      if (ev.persisted) { leaving = false; document.documentElement.classList.remove("page-leave"); }
    });
  }

  /* ---------- 启动 ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    renderHeader();
    renderFooter();
    var page = document.body.getAttribute("data-page");
    if (page === "home") { renderHome(); initHeroType(); }
    else if (page === "posts") renderList();
    else if (page === "post") renderPost();
    else if (page === "about") renderAbout();
    else if (page === "links") renderLinks();
    else if (page === "contact") renderContact();
    else if (page === "search") renderSearch();
    else if (page === "404") initHeroType();
    initReveal();
    initScrollUI();
    initPageLeave();
  });
})();
