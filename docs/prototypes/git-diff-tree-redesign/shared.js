/* 共享数据 + 渲染 v2：补齐真实面板的全部元素 ——
   section 头动作区（全选/stage all/revert all）+ 行 hover 浮动动作条 + checkbox 常驻 */
(function () {
  var IC_FOLDER = '<svg class="ic ic-folder" viewBox="0 0 16 16" stroke="currentColor" stroke-width="1.1"><path fill="currentColor" fill-opacity=".18" d="M2 3.8a1.2 1.2 0 0 1 1.2-1.2h3.4l1.5 1.9h4.7a1.2 1.2 0 0 1 1.2 1.2v6.5a1.2 1.2 0 0 1-1.2 1.2H3.2A1.2 1.2 0 0 1 2 12.2z"/><path fill="none" d="M2 3.8a1.2 1.2 0 0 1 1.2-1.2h3.4l1.5 1.9h4.7a1.2 1.2 0 0 1 1.2 1.2v6.5a1.2 1.2 0 0 1-1.2 1.2H3.2A1.2 1.2 0 0 1 2 12.2z"/></svg>';
  var IC_FILE = '<svg class="ic ic-file" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M3.8 1.8h5.6l2.8 2.8v9.6H3.8z"/><path d="M9.4 1.8v2.8h2.8"/></svg>';
  var IC_GEAR = '<svg class="ic ic-file" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="8" cy="8" r="2.2"/><path d="M8 1.8v2M8 12.2v2M1.8 8h2M12.2 8h2M3.6 3.6l1.4 1.4M11 11l1.4 1.4M12.4 3.6 11 5M5 11l-1.4 1.4"/></svg>';
  var IC_IMG = '<svg class="ic ic-file" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="2.8" width="12" height="10.4" rx="1.2"/><circle cx="5.6" cy="6.4" r="1.3"/><path d="M2.4 11.6 5.8 8.2l2.4 2.4 2.8-2.8 2.6 2.6"/></svg>';
  var IC_CODE = '<svg class="ic ic-file" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M5.6 4.8 2.4 8l3.2 3.2M10.4 4.8 13.6 8l-3.2 3.2"/></svg>';

  function fileIcon(name) {
    if (/eslint|babel|webpack|vite\.|rollup/.test(name)) return IC_GEAR;
    if (/\.(png|jpg|jpeg|gif|webp)$/i.test(name)) return IC_IMG;
    if (/\.(svg|html|css|js|ts|tsx|jsx)$/i.test(name)) return IC_CODE;
    return IC_FILE;
  }

  var TREE = [
    { t: 'dir', d: 0, name: 'mossx', open: 1 },
    { t: 'dir', d: 1, name: '_temp', open: 1 },
    { t: 'dir', d: 2, name: 'git-diff-tree-redesign', open: 1 },
    { t: 'dir', d: 3, name: 'shots', open: 1, count: 10 },
    { t: 'file', d: 4, name: '01-faithful.png', st: 'U', bin: 1 },
    { t: 'file', d: 4, name: '02-right-stats.png', st: 'U', bin: 1 },
    { t: 'file', d: 4, name: '03-status-names.png', st: 'U', bin: 1 },
    { t: 'file', d: 4, name: '04-colored-icons.png', st: 'U', bin: 1 },
    { t: 'file', d: 4, name: '05-inline-letter.png', st: 'U', bin: 1 },
    { t: 'file', d: 4, name: '06-indent-guides.png', st: 'U', bin: 1 },
    { t: 'file', d: 4, name: '07-selection.png', st: 'U', bin: 1 },
    { t: 'file', d: 4, name: '08-compact.png', st: 'U', bin: 1 },
    { t: 'file', d: 4, name: '09-dark.png', st: 'U', bin: 1 },
    { t: 'file', d: 4, name: '10-hover-meta.png', st: 'U', bin: 1 },
    { t: 'dir', d: 1, name: 'src/features/git', open: 1 },
    { t: 'file', d: 2, name: 'GitDiffPanel.tsx', st: 'M', add: 128, del: 40 },
    { t: 'file', d: 2, name: 'DiffBlock.tsx', st: 'M', add: 12, del: 3 },
    { t: 'file', d: 2, name: 'diff.css', st: 'M', add: 56, del: 18 },
    { t: 'file', d: 1, name: 'package.json', st: 'M', add: 1, del: 1 },
    { t: 'file', d: 1, name: '.eslintignore', st: 'M', add: 3, del: 0 },
    { t: 'file', d: 1, name: 'legacy/old-panel.ts', st: 'D', add: 0, del: 240 }
  ];

  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  /* hover 动作条：diff 对比 / 打开文件 / stage / revert（截图红框同款） */
  var ACTS =
    '<span class="acts">' +
      '<button class="act" title="查看 diff"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M6 2v12M10 2v12M2 6h4M10 10h4" opacity=".9"/><rect x="1.8" y="1.8" width="12.4" height="12.4" rx="1.6"/></svg></button>' +
      '<button class="act" title="打开文件"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M3.8 2.2h5.4l2.8 2.8v8.8H3.8z"/><path d="M9.2 2.2V5h2.8"/></svg></button>' +
      '<button class="act" title="Stage"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 3.2v9.6M3.2 8h9.6"/></svg></button>' +
      '<button class="act" title="还原"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M3 8a5 5 0 1 0 1.4-3.5M3 3.4V6h2.6"/></svg></button>' +
    '</span>';

  function rowHTML(n) {
    var isDir = n.t === 'dir';
    var st = n.st || '';
    var hasStats = !isDir && !n.bin && !!(n.add || n.del);
    var cls = 'row ' + n.t + (isDir ? ' has-changes' : '') + (!isDir && !hasStats ? ' bin' : '');
    var html = '<div class="' + cls + '" style="--d:' + n.d + '"' + (st ? ' data-st="' + st + '"' : '') + (isDir && n.open ? ' data-open="1"' : '') + '>';
    html += '<span class="tw">' + (isDir ? '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 4.5 9.5 8 6 11.5"/></svg>' : '') + '</span>';
    html += '<span class="st">' + st + '</span>';
    html += '<span class="dot"></span>';
    html += isDir ? IC_FOLDER : fileIcon(n.name);
    html += '<span class="nm">' + esc(n.name) + '</span>';
    if (isDir && n.count) html += '<span class="cnt">' + n.count + '</span>';
    if (hasStats) {
      html += '<span class="fstats"><b class="add">+' + n.add + '</b><b class="del">−' + n.del + '</b></span>';
    } else {
      html += '<span class="fstats"></span>';
    }
    var p = hasStats && (n.add + n.del) > 0 ? (n.add / (n.add + n.del)).toFixed(2) : 0;
    var m = hasStats ? Math.min(1, (n.add + n.del) / 400).toFixed(2) : 0;
    html += '<span class="bar" style="--p:' + p + ';--m:' + m + '"></span>';
    html += ACTS;
    html += '<label class="ck"><input type="checkbox"' + (st === 'U' && n.d === 4 ? ' checked' : '') + '></label>';
    html += '</div>';
    return html;
  }

  var rows = TREE.map(rowHTML).join('');

  document.getElementById('app').innerHTML =
    '<div class="panel">' +
      /* section 头：更改 + 全选 / stage all / revert all / 统计 / 数量（截图同款） */
      '<div class="section-head">' +
        '<svg class="chev" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6l4 4 4-4"/></svg>' +
        '<span class="sec-ttl">更改</span>' +
        '<span class="sec-sp"></span>' +
        '<label class="sall" title="全选"><input type="checkbox"></label>' +
        '<button class="sec-btn" title="全部 stage"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 3.2v9.6M3.2 8h9.6"/></svg></button>' +
        '<button class="sec-btn" title="全部还原"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M3 8a5 5 0 1 0 1.4-3.5M3 3.4V6h2.6"/></svg></button>' +
        '<span class="sec-stats"><b class="add">+4724</b><b class="del">−10</b></span>' +
        '<span class="sec-count">84</span>' +
      '</div>' +
      '<div class="tree">' + rows + '</div>' +
      '<div class="composer">' +
        '<div class="input">提交信息…</div>' +
        '<div class="composer-bar">' +
          '<span class="engine"><span class="engine-dot"></span>Claude Code · 中<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" width="11" height="11"><path d="M4 6l4 4 4-4"/></svg></span>' +
          '<span class="cb-sp"></span>' +
          '<button class="commit"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" width="12" height="12"><path d="M3 8.5 6.5 12 13 4.5"/></svg>提交</button>' +
        '</div>' +
      '</div>' +
      '<div class="hint">请先选择要提交的文件</div>' +
    '</div>';

  document.querySelectorAll('.row.dir').forEach(function (el) {
    el.addEventListener('click', function (e) {
      if (e.target.closest('.ck') || e.target.closest('.acts')) return;
      el.dataset.open = el.dataset.open === '1' ? '0' : '1';
    });
  });
})();
