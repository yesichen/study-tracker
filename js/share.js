import { supabase } from './supabase.js';

// 共享页面专用逻辑（无需登录）
async function loadSharedData() {
  const { data: records, error } = await supabase
    .from('study_records')
    .select('study_date, is_completed, content, images')
    .eq('is_completed', true)
    .order('study_date', { ascending: false });

  if (error) {
    console.error('加载失败：', error);
    return;
  }

  renderStats(records);
  renderHeatmap(records);
  renderSharedList(records);
}

function renderStats(records) {
  const uniqueDays = [...new Set(records.map(r => r.study_date))];
  document.getElementById('total-days').textContent = uniqueDays.length;
  
  const streak = calcStreak(records);
  document.getElementById('current-streak').textContent = streak.current;
  document.getElementById('max-streak').textContent = streak.max;
}

function calcStreak(records) {
  const dates = [...new Set(
    records.filter(r => r.is_completed).map(r => r.study_date)
  )].sort().reverse();

  if (dates.length === 0) return { current: 0, max: 0 };

  const DAY = 86400000;
  let current = 1, max = 1, temp = 1;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - DAY).toISOString().slice(0, 10);

  if (dates[0] !== today && dates[0] !== yesterday) current = 0;

  for (let i = 1; i < dates.length; i++) {
    const diff = (new Date(dates[i-1]) - new Date(dates[i])) / DAY;
    if (diff === 1) {
      temp++;
      if (current > 0 && i < dates.length) current = temp;
    } else {
      temp = 1;
    }
    max = Math.max(max, temp);
  }
  return { current, max };
}

function renderHeatmap(records) {
  const DAY = 86400000;
  const WEEKS = 53;
  const today = new Date();
  let start = new Date(today.getTime() - (WEEKS * 7 - 1) * DAY);
  start = new Date(start.getTime() - start.getDay() * DAY);

  const countMap = {};
  records.forEach(r => {
    countMap[r.study_date] = (countMap[r.study_date] || 0) + 1;
  });

  const grid = document.getElementById('heatmap-grid');
  grid.innerHTML = '';

  for (let i = 0; i < WEEKS * 7; i++) {
    const d = new Date(start.getTime() + i * DAY);
    const dateStr = d.toISOString().slice(0, 10);
    const count = countMap[dateStr] || 0;
    const level = count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 10 ? 3 : 4;

    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';
    cell.dataset.level = level;
    cell.title = `${dateStr}：${count} 条记录`;
    if (d > today) cell.style.visibility = 'hidden';
    grid.appendChild(cell);
  }
}

function renderSharedList(records) {
  const container = document.getElementById('share-records-list');
  if (records.length === 0) {
    container.innerHTML = '<p style="color:#666;">暂无公开记录</p>';
    return;
  }
  container.innerHTML = records.map(r => `
    <div class="record-item">
      <div class="record-header">
        <span class="record-date">${r.study_date}</span>
        <span class="record-status completed">✅ 已完成</span>
      </div>
      <div class="record-content">
        ${r.content ? marked.parse(r.content) : ''}
        ${r.images && r.images.length > 0 
          ? r.images.map(url => `<img src="${url}" alt="学习图片">`).join('') 
          : ''}
      </div>
    </div>
  `).join('');
}

loadSharedData();