(() => {
  const KEY = 'orange-diary-v1';
  const THEME_KEY = 'orange-theme';
  const $ = id => document.getElementById(id);
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const REPEAT = { none: '', daily: '매일', weekly: '매주', monthly: '매월', yearly: '매년' };

  // items: [{id, kind:'todo'|'event', text, date, time, end, repeat, done:{dateKey:true}, skip:[dateKey]}]
  let data = { items: [], memos: {} };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    data.memos = raw.memos || {};
    data.items = raw.items || [];
    // migrate v1 todos (date -> list)
    if (raw.todos) {
      Object.entries(raw.todos).forEach(([date, list]) => list.forEach(t =>
        data.items.push({ id: t.id, kind: 'todo', text: t.text, date, time: '', end: '', repeat: 'none', done: t.done ? { [date]: true } : {}, skip: [] })));
    }
  } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function occursOn(it, key) {
    if (key < it.date || (it.skip || []).includes(key)) return false;
    if (it.repeat === 'none') return key === it.date;
    const s = parse(it.date), d = parse(key);
    switch (it.repeat) {
      case 'daily': return true;
      case 'weekly': return s.getDay() === d.getDay();
      case 'monthly': return s.getDate() === d.getDate();
      case 'yearly': return s.getDate() === d.getDate() && s.getMonth() === d.getMonth();
    }
    return false;
  }
  const byTime = (a, b) => (a.time || '99:99').localeCompare(b.time || '99:99');
  const itemsOn = (key, kind) => data.items.filter(i => i.kind === kind && occursOn(i, key)).sort(byTime);
  const memos = k => data.memos[k] || (data.memos[k] = []);

  function fmtTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${pad(m)}`;
  }

  const now = new Date();
  let view = new Date(now.getFullYear(), now.getMonth(), 1);
  let selected = fmt(now);
  let editingMemo = null;

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
      const hasT = data.items.some(x => x.kind === 'todo' && occursOn(x, k));
      const hasE = data.items.some(x => x.kind === 'event' && occursOn(x, k));
      const hasM = (data.memos[k] || []).length;
      b.innerHTML = `<span>${d.getDate()}</span><span class="dots">${hasT ? '<i class="dot d-todo"></i>' : ''}${hasE ? '<i class="dot d-event"></i>' : ''}${hasM ? '<i class="dot d-memo"></i>' : ''}</span>`;
      b.onclick = () => {
        selected = k;
        if (d.getMonth() !== view.getMonth()) view = new Date(d.getFullYear(), d.getMonth(), 1);
        cancelMemoEdit();
        render();
      };
      grid.appendChild(b);
    }
  }

  function removeItem(it) {
    if (it.repeat !== 'none') {
      if (confirm('이 날짜의 항목만 삭제할까요?\n(취소를 누르면 반복 전체 삭제 여부를 묻습니다)')) {
        (it.skip = it.skip || []).push(selected);
      } else if (confirm('반복되는 모든 항목을 삭제할까요?')) {
        data.items = data.items.filter(i => i.id !== it.id);
      } else return;
    } else {
      data.items = data.items.filter(i => i.id !== it.id);
    }
    save(); render();
  }

  function renderItems(kind, ul, emptyEl) {
    const list = itemsOn(selected, kind);
    ul.innerHTML = '';
    list.forEach(t => {
      const done = !!(t.done || {})[selected];
      const li = document.createElement('li');
      li.className = `item ${kind}` + (done ? ' done' : '');
      if (kind === 'todo') {
        const c = document.createElement('button');
        c.className = 'check'; c.textContent = done ? '✓' : ''; c.setAttribute('aria-label', '완료');
        c.onclick = () => { t.done = t.done || {}; if (done) delete t.done[selected]; else t.done[selected] = true; save(); render(); };
        li.appendChild(c);
      }
      const box = document.createElement('div');
      box.className = 'txt';
      const title = document.createElement('div'); title.textContent = t.text; box.appendChild(title);
      const sub = document.createElement('span'); sub.className = 'sub';
      if (t.time) {
        const b = document.createElement('span'); b.className = 'badge';
        b.textContent = fmtTime(t.time) + (t.end ? ` – ${fmtTime(t.end)}` : ''); sub.appendChild(b);
      }
      if (t.repeat !== 'none') {
        const b = document.createElement('span'); b.className = 'badge rep'; b.textContent = '↻ ' + REPEAT[t.repeat]; sub.appendChild(b);
      }
      if (sub.childNodes.length) box.appendChild(sub);
      const x = document.createElement('button');
      x.className = 'x'; x.textContent = '×'; x.setAttribute('aria-label', '삭제');
      x.onclick = () => removeItem(t);
      li.append(box, x);
      ul.appendChild(li);
    });
    emptyEl.classList.toggle('hidden', list.length > 0);
    return list;
  }

  function renderSide() {
    const date = parse(selected);
    $('sideDate').textContent = `${date.getMonth() + 1}월 ${date.getDate()}일 ${WD[date.getDay()]}요일`;
    const todos = renderItems('todo', $('todoList'), $('todoEmpty'));
    const events = renderItems('event', $('eventList'), $('eventEmpty'));
    const ms = memos(selected);
    const done = todos.filter(t => (t.done || {})[selected]).length;
    $('sideSub').textContent = `할 일 ${done}/${todos.length} · 일정 ${events.length} · 메모 ${ms.length}`;
    const p = todos.length ? Math.round(done / todos.length * 100) : 0;
    $('ring').style.setProperty('--p', p);
    $('ringText').textContent = p + '%';

    const ml = $('memoList');
    ml.innerHTML = '';
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
    ['todo', 'event', 'memo'].forEach(n => $('panel-' + n).classList.toggle('hidden', t.dataset.tab !== n));
  });

  $('todoForm').onsubmit = e => {
    e.preventDefault();
    const text = $('todoInput').value.trim();
    if (!text) return;
    data.items.push({ id: uid(), kind: 'todo', text, date: selected, time: $('todoTime').value, end: '', repeat: $('todoRepeat').value, done: {}, skip: [] });
    $('todoInput').value = ''; $('todoTime').value = ''; $('todoRepeat').value = 'none';
    save(); render();
  };

  $('eventForm').onsubmit = e => {
    e.preventDefault();
    const text = $('eventInput').value.trim();
    if (!text) return;
    const time = $('eventStart').value, end = $('eventEnd').value;
    if (time && end && end < time) { alert('종료 시간이 시작 시간보다 빠릅니다.'); return; }
    data.items.push({ id: uid(), kind: 'event', text, date: selected, time, end, repeat: $('eventRepeat').value, done: {}, skip: [] });
    $('eventInput').value = ''; $('eventStart').value = ''; $('eventEnd').value = ''; $('eventRepeat').value = 'none';
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

  // theme
  const root = document.documentElement;
  const applyTheme = t => {
    root.dataset.theme = t;
    $('theme').textContent = t === 'dark' ? '☀' : '☾';
    const m = document.querySelector('meta[name=theme-color]');
    if (m) m.content = t === 'dark' ? '#1B1410' : '#E8702A';
  };
  applyTheme(root.dataset.theme === 'dark' ? 'dark' : 'light');
  $('theme').onclick = () => {
    const t = root.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  };

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  render();
})();
