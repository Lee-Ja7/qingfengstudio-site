/* 极简 Markdown 解析器 + 简易代码高亮，零依赖 */
(function () {
  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* 行内语法 */
  function inline(s) {
    s = esc(s);
    const codes = [];
    s = s.replace(/`([^`]+)`/g, function (_, c) {
      codes.push(c);
      return "\u0001" + (codes.length - 1) + "\u0001";
    });
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
    s = s.replace(/==([^=]+)==/g, "<mark>$1</mark>");
    s = s.replace(/\u0001(\d+)\u0001/g, function (_, i) {
      return "<code>" + codes[i] + "</code>";
    });
    return s;
  }

  /* 简易代码高亮 */
  function highlight(code, lang) {
    code = esc(code);
    var commentRe, strRe;
    if (lang === "css") {
      commentRe = /\/\*[\s\S]*?\*\//g;
    } else if (lang === "html" || lang === "xml") {
      commentRe = /&lt;!--[\s\S]*?--&gt;/g;
    } else if (lang === "bash" || lang === "sh" || lang === "shell" || lang === "python" || lang === "py") {
      commentRe = /#[^\n]*/g;
    } else {
      commentRe = /\/\/[^\n]*|\/\*[\s\S]*?\*\//g;
    }
    strRe = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g;

    var toks = [];
    code = code.replace(commentRe, function (m) {
      toks.push(["tok-c", m]); return "\u0002x" + (toks.length - 1) + "\u0002";
    });
    code = code.replace(strRe, function (m) {
      toks.push(["tok-s", m]); return "\u0002x" + (toks.length - 1) + "\u0002";
    });

    var kw = ["const","let","var","function","return","if","else","for","while","class","new","import","export","from","default","true","false","null","undefined","this","async","await","typeof","delete","in","of","try","catch","finally","throw","switch","case","break","continue","do","extends","static","get","set"];
    code = code.replace(new RegExp("\\b(" + kw.join("|") + ")\\b", "g"), '<span class="tok-k">$1</span>');
    code = code.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-n">$1</span>');

    code = code.replace(/\u0002x(\d+)\u0002/g, function (_, i) {
      return '<span class="' + toks[i][0] + '">' + toks[i][1] + "</span>";
    });
    return code;
  }

  /* 表格 */
  function parseTable(rows) {
    var head = rows[0].split("|").map(function (c) { return c.trim(); }).filter(function (c, i, a) { return !(i === 0 && c === "") && !(i === a.length - 1 && c === ""); });
    var body = rows.slice(2).map(function (r) {
      var cells = r.split("|").map(function (c) { return c.trim(); }).filter(function (c, i, a) { return !(i === 0 && c === "") && !(i === a.length - 1 && c === ""); });
      return "<tr>" + cells.map(function (c) { return "<td>" + inline(c) + "</td>"; }).join("") + "</tr>";
    }).join("");
    return "<table><thead><tr>" + head.map(function (c) { return "<th>" + inline(c) + "</th>"; }).join("") + "</tr></thead><tbody>" + body + "</tbody></table>";
  }

  function isTableSep(l) { return /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(l) && l.indexOf("-") > -1; }

  function md(text) {
    var lines = text.replace(/\r\n/g, "\n").split("\n");
    var out = [];
    var i = 0;

    while (i < lines.length) {
      var line = lines[i];

      /* 围栏代码块 ~~~ 或 ``` */
      var fence = line.match(/^\s*(~~~|```)\s*([\w+-]*)\s*$/);
      if (fence) {
        var lang = fence[2] || "";
        var buf = [];
        i++;
        while (i < lines.length && !new RegExp("^\\s*" + fence[1] + "\\s*$").test(lines[i])) {
          buf.push(lines[i]); i++;
        }
        i++; /* 跳过闭合围栏 */
        var code = buf.join("\n");
        out.push('<div class="code-block" data-lang="' + esc(lang || "text") + '">' +
          '<div class="code-head"><span>' + esc(lang || "text") + '</span><button class="copy-btn" type="button">复制</button></div>' +
          "<pre><code>" + highlight(code, lang) + "</code></pre></div>");
        continue;
      }

      /* 标题 */
      var h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) {
        var lv = h[1].length;
        out.push('<h' + lv + ' id="' + slugify(h[2]) + '">' + inline(h[2]) + "</h" + lv + ">");
        i++; continue;
      }

      /* 分隔线 */
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { out.push("<hr>"); i++; continue; }

      /* 表格 */
      if (line.indexOf("|") > -1 && i + 1 < lines.length && isTableSep(lines[i + 1])) {
        var rows = [];
        while (i < lines.length && lines[i].indexOf("|") > -1) { rows.push(lines[i]); i++; }
        out.push(parseTable(rows));
        continue;
      }

      /* 引用 */
      if (/^\s*>\s?/.test(line)) {
        var q = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          q.push(lines[i].replace(/^\s*>\s?/, "")); i++;
        }
        out.push("<blockquote><p>" + q.map(inline).join("<br>") + "</p></blockquote>");
        continue;
      }

      /* 列表 */
      if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
        var ordered = /^\s*\d+\.\s+/.test(line);
        var items = [];
        while (i < lines.length && (ordered ? /^\s*\d+\.\s+/.test(lines[i]) : /^\s*[-*+]\s+/.test(lines[i]))) {
          items.push(lines[i].replace(/^\s*(?:[-*+]|\d+\.)\s+/, "")); i++;
        }
        var tag = ordered ? "ol" : "ul";
        var hasTask = false;
        var liHtml = items.map(function (it) {
          var task = it.match(/^\[([ xX])\]\s*/);
          if (task) {
            hasTask = true;
            var done = task[1].toLowerCase() === "x";
            return '<li class="task' + (done ? " done" : "") + '">' + inline(it.slice(task[0].length)) + "</li>";
          }
          return "<li>" + inline(it) + "</li>";
        }).join("");
        out.push("<" + tag + (hasTask ? ' class="tasks"' : "") + ">" + liHtml + "</" + tag + ">");
        continue;
      }

      /* 空行 */
      if (/^\s*$/.test(line)) { i++; continue; }

      /* 段落（吞并后续普通行直到空行或块级元素） */
      var para = [line]; i++;
      while (i < lines.length && !/^\s*$/.test(lines[i]) &&
        !/^(#{1,4})\s/.test(lines[i]) && !/^\s*(~~~|```)/.test(lines[i]) &&
        !/^\s*>/.test(lines[i]) && !/^\s*[-*+]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i])) {
        para.push(lines[i]); i++;
      }
      out.push("<p>" + para.map(inline).join("<br>") + "</p>");
    }

    return out.join("\n");
  }

  function slugify(s) {
    return s.replace(/[^\w\u4e00-\u9fa5]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "sec";
  }

  window.MD = { render: md, slugify: slugify };
})();
