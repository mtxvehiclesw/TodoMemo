(() => {
  const KEY = 'orange-diary-v1';
  const $ = id => document.getElementById(id);
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const WD = ['일', '월', '화', '수', '목', '금', '토'];

  let data = { todos: {}, memos: {} };
  try { data = { ...data, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const now = new Date();
  let view = new Date(now.getFullYear(), now.getMonth(), 1);
  let selected = fmt(now);
  let editingMemo = null;

  const todos = k => data.todos[k] || (data.todos[k] = []);
  const memos = k => data.memos[k] || (data.memos[k] = []);

  function renderCalendar() {
    $('year').textContent = view.getFullYear();
    $('month').textContent = `${view.getMonth() + 1}월`;
    const grid = $('grid');
    grid.innerHTML = '';
    const start = new Date(view.getFullYear(), view.getMonth(), 1 - view.getDay());
    const todayKey = fmt(now);
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      if (i >= 35 && d.getMonth() !== view.getMonth()) break;
      const k = fmt(d);
      const b = document.createElement('button');
      b.className = 'day';
      if (d.getMonth() !== view.getMonth()) b.classList.add('out');
      if (d.getDay() === 0) b.classList.add('sun-d');
      if (d.getDay() === 6) b.classList.add('sat-d');
      if (k === todayKey) b.classList.add('today');
      if (k === selected) b.classList.add('selected');
      const hasT = (data.todos[k] || []).length, hasM = (data.memos[k] || []).length;
      b.innerHTML = `<span>${d.getDate()}</span><span class="dots">${hasT ? '<i class="dot d-todo"></i>' : ''}${hasM ? '<i class="dot d-memo"></i>' : ''}</span>`;
      b.onclick = () => {
        selected = k;
        if (d.getMonth() !== view.getMonth()) view = new Date(d.getFullYear(), d.getMonth(), 1);
        cancelMemoEdit();
        render();
      };
      grid.appendChild(b);
    }
  }

  function renderSide() {
    const [y, m, d] = selected.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    $('sideDate').textContent = `${m}월 ${d}일 ${WD[date.getDay()]}요일`;
    const list = todos(selected);
    const done = list.filter(t => t.done).length;
    $('sideSub').textContent = `할 일 ${done}/${list.length} 완료 · 메모 ${memos(selected).length}개`;
    const p = list.length ? Math.round(done / list.length * 100) : 0;
    $('ring').style.setProperty('--p', p);
    $('ringText').textContent = p + '%';

    const tl = $('todoList');
    tl.innerHTML = '';
    list.forEach(t => {
      const li = document.createElement('li');
      li.className = 'item' + (t.done ? ' done' : '');
      const c = document.createElement('button');
      c.className = 'check'; c.textContent = t.done ? '✓' : '';
      c.onclick = () => { t.done = !t.done; save(); render(); };
      const s = document.createElement('span');
      s.className = 'txt'; s.textContent = t.text;
      const x = document.createElement('button');
      x.className = 'x'; x.textContent = '×'; x.setAttribute('aria-label', '삭제');
      x.onclick = () => { data.todos[selected] = list.filter(i => i.id !== t.id); save(); render(); };
      li.append(c, s, x);
      tl.appendChild(li);
    });
    $('todoEmpty').classList.toggle('hidden', list.length > 0);

    const ml = $('memoList');
    ml.innerHTML = '';
    const ms = memos(selected);
    ms.forEach(n => {
      const li = document.createElement('li');
      li.className = 'memo';
      if (n.title) { const h = document.createElement('h4'); h.textContent = n.title; li.appendChild(h); }
      const p = document.createElement('p'); p.textContent = n.body; li.appendChild(p);
      const meta = document.createElement('div'); meta.className = 'meta';
      const t = document.createElement('span'); t.textContent = new Date(n.ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      const acts = document.createElement('span');
      const e = document.createElement('button'); e.className = 'x'; e.textContent = '✎'; e.setAttribute('aria-label', '수정');
      e.onclick = () => { editingMemo = n.id; $('memoTitle').value = n.title; $('memoBody').value = n.body; $('memoCancel').classList.remove('hidden'); $('memoSave').textContent = '수정'; $('memoBody').focus(); };
      const x = document.createElement('button'); x.className = 'x'; x.textContent = '×'; x.setAttribute('aria-label', '삭제');
      x.onclick = () => { data.memos[selected] = ms.filter(i => i.id !== n.id); if (editingMemo === n.id) cancelMemoEdit(); save(); render(); };
      acts.append(e, x); meta.append(t, acts); li.appendChild(meta);
      ml.appendChild(li);
    });
    $('memoEmpty').classList.toggle('hidden', ms.length > 0);
  }

  function render() { renderCalendar(); renderSide(); }

  function cancelMemoEdit() {
    editingMemo = null;
    $('memoTitle').value = ''; $('memoBody').value = '';
    $('memoCancel').classList.add('hidden'); $('memoSave').textContent = '저장';
  }

  $('prev').onclick = () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); renderCalendar(); };
  $('next').onclick = () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); renderCalendar(); };
  $('today').onclick = () => { view = new Date(now.getFullYear(), now.getMonth(), 1); selected = fmt(now); cancelMemoEdit(); render(); };

  document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
    document.querySelectorAll('.tab').forEach(o => o.classList.toggle('active', o === t));
    $('panel-todo').classList.toggle('hidden', t.dataset.tab !== 'todo');
    $('panel-memo').classList.toggle('hidden', t.dataset.tab !== 'memo');
  });

  $('todoForm').onsubmit = e => {
    e.preventDefault();
    const text = $('todoInput').value.trim();
    if (!text) return;
    todos(selected).push({ id: uid(), text, done: false });
    $('todoInput').value = '';
    save(); render();
  };

  $('memoForm').onsubmit = e => {
    e.preventDefault();
    const title = $('memoTitle').value.trim(), body = $('memoBody').value.trim();
    if (!body && !title) return;
    if (editingMemo) {
      const n = memos(selected).find(i => i.id === editingMemo);
      if (n) { n.title = title; n.body = body; }
    } else {
      memos(selected).unshift({ id: uid(), title, body, ts: Date.now() });
    }
    cancelMemoEdit(); save(); render();
  };
  $('memoCancel').onclick = cancelMemoEdit;

  render();
})();
