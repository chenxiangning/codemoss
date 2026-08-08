/* v4 共享：状态机 + 模板弹层（可点） + 页内模板管理模态 + 左主幕布 + 流式内容 */
const STREAMS = {
plan: `▍规划输出 · Claude（claude-sonnet-4.6 · thinking: high）

任务理解
  目标：修复侧栏 hydration 后永久「加载中…」，并恢复 Shared Session 可创建。
  约束：不改公共 store 契约；Windows 冷启动不得回归；保持 v1 事件库兼容。

根因假设（按概率排序）
  1. Set 身份复用 —— hydrate 用同一 Set 实例原地 mutate，React 未感知引用变化
  2. 首屏分页竞态 —— loadEarlier 与 hydrate 交错写入导致丢项
  3. 空集合 thrash —— 每次返回 new Set() 触发无限重渲染（#185 同源）

实施步骤
  Step 1  sessionStore.hydrate 构造全新 Set 实例，禁止原地 mutate
          文件：src/features/sessions/stores/sessionStore.ts
  Step 2  首屏固定 5 条；「加载更早」走独立分页游标
          文件：src/features/sessions/hooks/useSessionList.ts
  Step 3  hydrate 幂等守卫：相同 snapshotHash 直接跳过
  Step 4  回归测试：hydrate × loadEarlier 交错、空集合引用稳定

验收标准
  □ 冷启动 3 次，侧栏不出现永久 spinner
  □ React DevTools 无 #185 警告
  □ sessions 相关 vitest 全绿

风险：Set 身份变更可能影响 selection 派生缓存 → 交实现环节验证。
⏎ 等待批准：批准后实现、审查将自动连续执行。`,
impl: `$ apply_patch src/features/sessions/stores/sessionStore.ts
+ hydrate(next) {
+   if (next.snapshotHash === this.snapshotHash) return; // 幂等守卫
+   this.ids = new Set(next.ids);                        // 新实例，不原地 mutate
+   this.snapshotHash = next.snapshotHash;
+ }
✓ patch applied (2 hunks, +9 −3)

$ apply_patch src/features/sessions/hooks/useSessionList.ts
+ const FIRST_PAGE = 5;
+ // loadEarlier 使用独立 cursor，不与 hydrate 共用写路径
✓ patch applied (3 hunks, +21 −6)

$ pnpm vitest run src/features/sessions
 ✓ hydrate 构造新 Set 实例 (12ms)
 ✓ 相同 snapshotHash 跳过写入 (4ms)
 ✓ 首屏仅渲染 5 条 (31ms)
 ✓ loadEarlier 与 hydrate 交错不丢项 (18ms)
 ✓ 空集合引用稳定（#185 回归） (9ms)

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Duration  1.24s

$ 手动验证 selection 派生缓存：切换选中会话 ×20，无脏引用 ✓
▍实现完成 · Codex（gpt-5.3-codex · thinking: medium）`,
review: `▍审查报告 · Grok（grok-4 · thinking: medium）

结论：通过（2 个 nit，不阻断）

✔ 正确性
  · hydrate 幂等守卫覆盖重复 snapshot 场景
  · Set 新实例保证 React 引用比较生效
✔ 回归面
  · #185 用例已固化，空集合 thrash 有测试看护
  · selection 缓存有手动验证记录
⚠ nit-1  sessionStore.ts:88 — snapshotHash 比较建议提取独立函数，便于单测
⚠ nit-2  useSessionList.ts:41 — FIRST_PAGE 建议移入 constants

未覆盖风险
  · Windows 冷启动路径未实机验证（建议合并前冒烟一次）

 verdict: APPROVE → 汇总已写入主对话`
};
const STREAMS2 = {
plan2: `▍二轮规划 · Claude（模板：修复流水线）

追加任务：为首轮修复补回归测试并更新 CHANGELOG。
范围
  1. sessionStore.test.ts —— 交错写用例 ×2
  2. CHANGELOG.md —— 0.8.0 Fixes 追加一条
流程：实现(codex) → 测试加固(claude) → 审查(grok)
本轮无批准点 → 全部自动连续执行。`,
impl2: `$ apply_patch src/features/sessions/stores/sessionStore.test.ts
+ it('hydrate 与 loadEarlier 交错不丢项', ...)
+ it('空集合引用稳定（#185 回归）', ...)
✓ patch applied (2 hunks, +48 −0)

$ apply_patch CHANGELOG.md
+ - 修复侧栏 hydration 后永久「加载中…」
✓ patch applied (1 hunk, +1 −0)

$ pnpm vitest run src/features/sessions
 ✓ 7 passed (7) · Duration 1.31s
▍实现完成 · Codex`,
test2: `▍测试加固 · Claude（claude-sonnet-4.6）

补充边界用例：
 ✓ snapshotHash 为空字符串时按变更处理 (6ms)
 ✓ 10k ids hydrate < 16ms 性能门槛 (11ms)
 ✓ hydrate 期间 selection 不丢失 (8ms)

覆盖率：sessionStore.ts 91% → 96%
建议：无需追加用例，可进审查。`,
review2: `▍二轮审查 · Grok（grok-4）

verdict: APPROVE
✔ 新增用例直接命中首轮根因路径
✔ 性能门槛用例有实际断言值
⚠ nit：CHANGELOG 条目建议补 PR 号

→ 汇总已写入主对话`
};

const TPLS = {
  default: { pill:'⚡ 协作 · 默认三步', flow:'规划 → 实现 → 审查' },
  fix4:    { pill:'⚡ 协作 · 修复流水线', flow:'规划 → 实现 → 测试加固 → 审查' },
  docs2:   { pill:'⚡ 协作 · 文档双人组', flow:'起草 → 润色' }
};

function setState(n){
  n = +n;
  document.body.dataset.state = String(n);
  setRound(n===4 ? 2 : 1);
  document.querySelectorAll('.rndsw span[data-r="2"]').forEach(s=>s.classList.toggle('dis', n<4));
  if (n!==1) document.body.classList.remove('pop-open');
}
function setRound(n){
  n = +n;
  if (n===2 && +document.body.dataset.state<4){ toast('第二轮尚未开始 · 第一轮完成后再次发送即开启'); return; }
  const d=document.querySelector('.deck'); if(d) d.dataset.round=String(n);
  document.querySelectorAll('.rndsw span, .rtabs span').forEach(s=>s.classList.toggle('on', +s.dataset.r===n));
  document.dispatchEvent(new CustomEvent('round',{detail:n}));
}
function setTpl(name){
  document.body.dataset.tpl=name; const t=TPLS[name];
  document.querySelectorAll('.pill.collab').forEach(p=>p.textContent=t.pill);
  document.querySelectorAll('.orch.r1card .tpl').forEach(e=>e.textContent=t.flow);
  document.querySelectorAll('.cp-item').forEach(i=>{
    i.classList.toggle('on', i.dataset.tpl===name);
    const c=i.querySelector('.cur'); if(c) c.textContent = i.dataset.tpl===name ? '✓ 当前' : '';
  });
}
function togglePop(){ document.body.classList.toggle('pop-open'); }
function sendMsg(){
  document.body.classList.remove('pop-open');
  const st=document.body.dataset.state;
  const tpl=document.querySelector('.pill.collab').textContent.replace('⚡ 协作 · ','');
  if (st==='1'){
    setState(2); toast('已发送 · 使用模板「'+tpl+'」启动编排');
    clearTimeout(window._adv);
    window._adv=setTimeout(()=>{ if(document.body.dataset.state==='2'){ setState(3); toast('✓ 第一轮协作完成 · 汇总已写入主对话'); } },6000);
  } else if (st==='3'){
    setState(4); toast('第二轮协作启动 · 复用模板「修复流水线」· 无批准点全自动');
  } else {
    toast('编排进行中…');
  }
}
function toggleHist(el){
  const full=el.closest('.msg').querySelector('.histfull');
  const open=full.classList.toggle('open');
  el.textContent = open ? '收起 ▴' : '展开 ▾';
}
window.selectStage = function(name){
  document.querySelectorAll('[data-stage]').forEach(el=>el.classList.toggle('on', el.dataset.stage===name));
  document.querySelectorAll('[data-stage-tab]').forEach(el=>el.classList.toggle('on', el.dataset.stageTab===name));
};
function toast(msg){ const t=document.getElementById('toast'); if(!t) return;
  t.textContent=msg; t.style.display='block'; clearTimeout(t._h); t._h=setTimeout(()=>t.style.display='none',2200); }

/* ===== 模板管理模态（页内） ===== */
const CLIS=['claude','codex','gemini','grok','opencode'];
const MODELS={claude:['claude-sonnet-4.6','claude-opus-4.8'],codex:['gpt-5.3-codex','gpt-5.3'],gemini:['gemini-3-pro'],grok:['grok-4'],opencode:['opencode-default']};
const TPLDATA={
 default:{name:'默认三步',desc:'通用修复 / 实现流程：先规划并批准，再实现，最后审查。',steps:[
  {name:'规划',cli:'claude',model:'claude-sonnet-4.6',effort:'high',approve:true,prompt:'你是规划者。只做根因分析与实施计划，不改代码。输出：任务理解 / 根因假设 / 步骤 / 验收标准。完成后等待人工批准。'},
  {name:'实现',cli:'codex',model:'gpt-5.3-codex',effort:'medium',approve:false,prompt:'按已批准的规划实施。允许 apply_patch 与跑测试；失败先自纠一次再上报。'},
  {name:'审查',cli:'grok',model:'grok-4',effort:'medium',approve:false,prompt:'审查 diff 与测试结果。输出 verdict: APPROVE / REQUEST_CHANGES + nit 清单。'}]},
 fix4:{name:'修复流水线',desc:'bug 修复专用：实现后加一道测试加固。',steps:[
  {name:'规划',cli:'claude',model:'claude-sonnet-4.6',effort:'high',approve:true,prompt:'同默认三步规划。'},
  {name:'实现',cli:'codex',model:'gpt-5.3-codex',effort:'medium',approve:false,prompt:'同默认三步实现。'},
  {name:'测试加固',cli:'claude',model:'claude-sonnet-4.6',effort:'medium',approve:false,prompt:'针对实现 diff 补充边界与回归用例，给出覆盖率变化。'},
  {name:'审查',cli:'grok',model:'grok-4',effort:'medium',approve:false,prompt:'同默认三步审查。'}]},
 docs2:{name:'文档双人组',desc:'起草 + 润色，适合文档与文案。',steps:[
  {name:'起草',cli:'gemini',model:'gemini-3-pro',effort:'medium',approve:false,prompt:'根据主题快速起草结构化初稿。'},
  {name:'润色',cli:'claude',model:'claude-sonnet-4.6',effort:'high',approve:false,prompt:'润色初稿：统一术语、压缩冗余、修正事实。'}]}
};
let curTplKey='default';
function openTplModal(key){ document.body.classList.add('tpl-open'); if(key&&TPLDATA[key]) curTplKey=key;
  document.querySelectorAll('.titem').forEach(x=>x.classList.toggle('on', x.dataset.t===curTplKey));
  renderTplEditor(); }
function closeTplModal(){ document.body.classList.remove('tpl-open'); }
function _opts(list,sel){ return list.map(v=>`<option ${v===sel?'selected':''}>${v}</option>`).join(''); }
function renderTplEditor(){
  const t=TPLDATA[curTplKey];
  document.getElementById('tplEditor').innerHTML=`
   <div class="row1"><input class="name" value="${t.name}">
     <label class="mkdef"><span class="tgl ${curTplKey==='default'?'on':''}" onclick="this.classList.toggle('on')"></span>设为默认</label></div>
   <input class="desc" value="${t.desc}" placeholder="模板描述（什么时候用它）">
   ${t.steps.map((s)=>`
   <div class="step-ed"><div class="top">
     <span class="drag">≡</span>
     <input class="sname" value="${s.name}">
     <select>${_opts(CLIS,s.cli)}</select>
     <select>${_opts(MODELS[s.cli],s.model)}</select>
     <span class="seg">${['low','medium','high'].map(e=>`<span class="${e===s.effort?'on':''}" onclick="segPick(this)">${e}</span>`).join('')}</span>
     <label class="appr"><span class="tgl ${s.approve?'on':''}" onclick="this.classList.toggle('on')"></span>需批准</label>
     <span class="del" onclick="this.closest('.step-ed').remove()">🗑</span></div>
     <textarea>${s.prompt}</textarea></div>`).join('')}
   <button class="addstep" onclick="addTplStep()">＋ 添加环节</button>
   <div class="efoot">
     ${curTplKey==='default'?'':'<button class="danger" onclick="toast(\'已删除模板\');closeTplModal()">删除模板</button>'}
     <button class="ghost" onclick="toast('已另存为新模板');closeTplModal()">另存为…</button>
     <button class="primary" onclick="saveTpl()">保存模板</button>
   </div>`;
}
function segPick(el){ el.parentNode.querySelectorAll('span').forEach(x=>x.classList.remove('on')); el.classList.add('on'); }
function pickTpl(k,el){ curTplKey=k; document.querySelectorAll('.titem').forEach(x=>x.classList.remove('on')); el.classList.add('on'); renderTplEditor(); }
function newTpl(){ TPLDATA._new={name:'未命名模板',desc:'',steps:[{name:'环节 1',cli:'claude',model:'claude-sonnet-4.6',effort:'medium',approve:false,prompt:''}]};
  curTplKey='_new'; document.querySelectorAll('.titem').forEach(x=>x.classList.remove('on')); renderTplEditor(); }
function addTplStep(){ TPLDATA[curTplKey].steps.push({name:'环节 '+(TPLDATA[curTplKey].steps.length+1),cli:'claude',model:'claude-sonnet-4.6',effort:'medium',approve:false,prompt:''}); renderTplEditor(); }
function saveTpl(){ const nm=document.querySelector('#tplEditor .name').value;
  closeTplModal(); toast('✓ 已保存「'+nm+'」· composer 弹层已同步'); }

const TPL_MODAL_HTML = `
<div class="tpl-overlay" onclick="if(event.target===this)closeTplModal()">
  <div class="modal">
    <header><span class="t">⚡ 协作模板管理</span><span class="sub">模板 = 环节序列 ×（CLI · 模型 · 思考强度 · 提示词 · 批准点），保存后出现在 composer 弹层</span><button class="x" onclick="closeTplModal()">✕ 关闭</button></header>
    <div class="tpl-body">
      <div class="tlist">
        <input class="search" placeholder="搜索模板…">
        <div class="grp">内置</div>
        <div class="titem on" data-t="default" onclick="pickTpl('default',this)"><div class="nm">默认三步 <span class="def">默认</span></div><div class="meta">规划 → 实现 → 审查 · 批准点×1</div></div>
        <div class="grp">我的模板</div>
        <div class="titem" data-t="fix4" onclick="pickTpl('fix4',this)"><div class="nm">修复流水线</div><div class="meta">规划 → 实现 → 测试加固 → 审查 · 批准点×1</div></div>
        <div class="titem" data-t="docs2" onclick="pickTpl('docs2',this)"><div class="nm">文档双人组</div><div class="meta">起草 → 润色 · 无批准点</div></div>
        <button class="tnew" onclick="newTpl()">＋ 新建自定义模板</button>
      </div>
      <div class="editor" id="tplEditor"></div>
    </div>
  </div>
</div>
<div class="toast" id="toast"></div>`;

const POPOVER = `
<div class="collab-pop">
  <div class="cp-head">选择协作模板 <span class="cp-manage" onclick="openTplModal(document.body.dataset.tpl)">⚙ 管理模板</span></div>
  <div class="cp-item on" data-tpl="default" onclick="setTpl('default')">
    <div class="cp-nm">默认三步<span class="cp-tag">内置</span><span class="cur">✓ 当前</span></div>
    <div class="cp-sub">规划 claude·high → 实现 codex·medium → 审查 grok·medium · 批准点：规划后</div>
  </div>
  <div class="cp-item" data-tpl="fix4" onclick="setTpl('fix4')">
    <div class="cp-nm">修复流水线<span class="cp-tag mine">我的模板</span><span class="cur"></span></div>
    <div class="cp-sub">规划 claude·high → 实现 codex → 测试加固 claude → 审查 grok · 批准点：规划后</div>
  </div>
  <div class="cp-item" data-tpl="docs2" onclick="setTpl('docs2')">
    <div class="cp-nm">文档双人组<span class="cp-tag mine">我的模板</span><span class="cur"></span></div>
    <div class="cp-sub">起草 gemini·medium → 润色 claude·high · 无批准点</div>
  </div>
  <button class="cp-new" onclick="openTplModal();newTpl()">＋ 新建自定义模板（步骤名 / CLI / 模型 / 思考强度 / 提示词 / 是否需要批准）</button>
</div>`;

const CANVAS_HTML = `
<div class="cv-body">
  <div class="hint-empty s1">✍ 已在 composer 起草任务 —— 点「⚡ 协作」弹层选模板，再点发送触发编排</div>

  <div class="msg s234"><div class="who">你 · 19:42</div>
    <div class="bubble-user">侧栏一直「加载中…」，新建 Shared CLI 也报错。查一下根因并修掉，走协作模式，规划完让我看一眼再继续。</div>
  </div>

  <div class="msg s23"><div class="who">协作编排 · mossx</div>
    <div class="bubble-ai">
      <div class="meta-line">collab · shared session #1335 · round 1</div>
      <div class="orch r1card">
        <div class="orch-head"><span class="t">⚡ 协作编排 · 第一轮</span><span class="tpl">规划 → 实现 → 审查</span>
          <span class="st"><span class="s2" style="color:var(--blue)">进行中 · 实现</span><span class="s3" style="color:var(--green)">已完成</span></span></div>
        <div class="prog"><i></i></div>
        <div class="stage-row d f"><i class="dot plan"></i><span class="nm">规划</span><span class="tg">claude · claude-sonnet-4.6 · high</span><span class="st-txt s2">✓ 已批准 1m12s</span><span class="st-txt s3">✓ 1m12s</span></div>
        <div class="stage-row d f running"><i class="dot impl"></i><span class="nm">实现</span><span class="tg">codex · gpt-5.3-codex · medium</span><span class="st-txt s2">● 流式中…</span><span class="st-txt s3">✓ 2m03s</span></div>
        <div class="stage-row f"><i class="dot"></i><span class="nm">测试加固</span><span class="tg">claude · claude-sonnet-4.6 · medium</span><span class="st-txt s2">排队</span><span class="st-txt s3">✓ 36s</span></div>
        <div class="stage-row d f"><i class="dot review"></i><span class="nm">审查</span><span class="tg">grok · grok-4 · medium</span><span class="st-txt s2">排队</span><span class="st-txt s3">✓ 48s</span></div>
        <div class="stage-row o"><i class="dot plan"></i><span class="nm">起草</span><span class="tg">gemini · gemini-3-pro · medium</span><span class="st-txt s2">✓ 58s</span><span class="st-txt s3">✓ 58s</span></div>
        <div class="stage-row o running"><i class="dot impl"></i><span class="nm">润色</span><span class="tg">claude · claude-sonnet-4.6 · high</span><span class="st-txt s2">● 流式中…</span><span class="st-txt s3">✓ 1m02s</span></div>
      </div>
      <div class="s2" style="color:var(--muted);font-size:12px">规划已批准 ✓ — 各环节流式输出见右侧面板；主幕布保持对话可读。</div>
      <div class="s3 summary-card"><div class="t">✓ 第一轮协作完成 · 汇总</div>
        根因为 hydrate 复用 Set 实例导致 React 未感知变更。已修复并通过回归测试；审查通过（2 nit 不阻断）。详细输出见右侧各环节。</div>
    </div>
  </div>

  <div class="msg s4"><div class="who">协作编排 · mossx</div>
    <div class="hist"><span class="ck">✓</span><div>第一轮协作 · 修复侧栏 hydration<div class="meta">默认三步 · 3/3 完成 · 4m03s</div></div><span class="open" onclick="toggleHist(this)">展开 ▾</span></div>
    <div class="histfull">
      <div class="orch" style="margin:10px 0 8px">
        <div class="orch-head"><span class="t">⚡ 协作编排 · 第一轮</span><span class="tpl">规划 → 实现 → 审查</span><span class="st" style="color:var(--green)">已完成</span></div>
        <div class="prog"><i style="width:100%;background:var(--green)"></i></div>
        <div class="stage-row r2row"><i class="dot done"></i><span class="nm">规划</span><span class="tg">claude · claude-sonnet-4.6 · high</span><span class="st-txt">✓ 1m12s</span></div>
        <div class="stage-row r2row"><i class="dot done"></i><span class="nm">实现</span><span class="tg">codex · gpt-5.3-codex · medium</span><span class="st-txt">✓ 2m03s</span></div>
        <div class="stage-row r2row"><i class="dot done"></i><span class="nm">审查</span><span class="tg">grok · grok-4 · medium</span><span class="st-txt">✓ 48s</span></div>
      </div>
      <span class="lk" onclick="setRound(1)">在右侧查看第一轮完整输出 →</span>
    </div>
  </div>
  <div class="msg s4"><div class="who">你 · 20:07</div>
    <div class="bubble-user">很好。再补两个回归测试，CHANGELOG 也加上，这次用我存的「修复流水线」模板，不用等我批准。</div>
  </div>
  <div class="msg s4"><div class="who">协作编排 · mossx</div>
    <div class="bubble-ai">
      <div class="meta-line">collab · shared session #1335 · round 2 · 模板：修复流水线（我的模板）</div>
      <div class="orch">
        <div class="orch-head"><span class="t">⚡ 协作编排 · 第二轮</span><span class="tpl">规划 → 实现 → 测试加固 → 审查</span>
          <span class="st" style="color:var(--blue)">进行中 · 实现</span></div>
        <div class="prog"><i style="width:38%"></i></div>
        <div class="stage-row r2row"><i class="dot done"></i><span class="nm">规划</span><span class="tg">claude · high · 无批准点</span><span class="st-txt">✓ 34s</span></div>
        <div class="stage-row r2row running"><i class="dot live"></i><span class="nm">实现</span><span class="tg">codex · medium</span><span class="st-txt">● 流式中…</span></div>
        <div class="stage-row r2row"><i class="dot"></i><span class="nm">测试加固</span><span class="tg">claude · medium</span><span class="st-txt">排队</span></div>
        <div class="stage-row r2row"><i class="dot"></i><span class="nm">审查</span><span class="tg">grok · medium</span><span class="st-txt">排队</span></div>
      </div>
      <div style="color:var(--muted);font-size:12px">复用模板直接启动，规划无批准点 → 全自动。<span class="lk" onclick="setRound(2)">第二轮输出见右侧</span> · <span class="lk" onclick="setRound(1)">切回第一轮</span></div>
    </div>
  </div>
</div>
<div class="composer"><div class="wrap">
  ${POPOVER}
  <div class="box">
    <div class="ph"><span class="s1" style="color:var(--txt)">侧栏一直「加载中…」，新建 Shared CLI 也报错。查根因并修掉，走协作模式，规划完让我看一眼再继续。</span><span class="s2">编排进行中… 可随时追加消息</span><span class="s3">继续协作：再发一条即开启第二轮（可复用模板）</span><span class="s4">第二轮进行中…</span></div>
    <div class="bar"><span class="pill model">claude-sonnet-4.6</span><span class="pill collab" onclick="togglePop()">⚡ 协作 · 默认三步</span><button class="send" onclick="sendMsg()">↑</button></div>
  </div>
</div></div>`;

document.addEventListener('DOMContentLoaded', ()=>{
  const cv = document.getElementById('canvas');
  if (cv) cv.innerHTML = CANVAS_HTML;
  document.body.insertAdjacentHTML('beforeend', TPL_MODAL_HTML);
  // 左右分栏拖拽拉手
  const app=document.querySelector('.app'), deck=document.querySelector('.deck');
  if (app && deck){
    const g=document.createElement('div'); g.className='gutter'; g.title='拖拽调整右栏宽度';
    app.insertBefore(g, deck);
    g.addEventListener('pointerdown', e=>{
      e.preventDefault(); g.classList.add('on');
      const move=ev=>{ deck.style.width=Math.min(780,Math.max(320,window.innerWidth-ev.clientX))+'px'; };
      const up=()=>{ g.classList.remove('on'); window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); };
      window.addEventListener('pointermove',move); window.addEventListener('pointerup',up);
    });
  }
  const ALL = Object.assign({}, STREAMS, STREAMS2);
  document.querySelectorAll('[data-stream]').forEach(el=>{ el.textContent = ALL[el.dataset.stream]||''; });
  setTpl(document.body.dataset.tpl||'default');
  const m=location.hash.match(/s([1-4])/);
  setState(m?m[1]:(document.body.dataset.state||'1'));
});
