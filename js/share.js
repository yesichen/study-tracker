import { supabase } from './supabase.js';

// ==========================================
// 1. 工具函数：获取本地日期字符串（解决时区错位）
// ==========================================
function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ==========================================
// 2. 加载分享数据（不需要登录，只读已完成记录）
// ==========================================
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

// ==========================================
// 3. 统计与连续打卡（修复连续打卡日期计算）
// ==========================================
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
  
  const today = formatLocalDate(new Date());
  const yesterday = formatLocalDate(new Date(Date.now() - DAY));

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

// ==========================================
// 4. 渲染热力图（同步主页逻辑，动态生成日期范围）
// ==========================================
function renderHeatmap(records) {
  const DAY = 86400000;
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  
  const dayOfWeek = todayMidnight.getDay(); 
  const endOfWeek = new Date(todayMidnight.getTime() + (6 - dayOfWeek) * DAY);
  const start = new Date(endOfWeek.getTime() - (52 * 7 + 6) * DAY);

  const countMap = {};
  records.forEach(r => {
    countMap[r.study_date] = (countMap[r.study_date] || 0) + 1;
  });

  const grid = document.getElementById('heatmap-grid');
  grid.innerHTML = '';

  let current = new Date(start);
  while (current <= endOfWeek) {
    const dateStr = formatLocalDate(current);
    const count = countMap[dateStr] || 0;
    const level = count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 10 ? 3 : 4;

    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';
    cell.dataset.level = level;
    cell.dataset.date = dateStr;
    cell.title = `${dateStr}：${count} 条记录`;
    if (current > todayMidnight) cell.style.visibility = 'hidden';
    grid.appendChild(cell);

    current = new Date(current.getTime() + DAY);
  }
}

// ==========================================
// 5. 渲染公开笔记（支持 Markdown 和图片点击放大）
// ==========================================
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
          ? r.images.map(url => `<img src="${url}" alt="学习图片" class="lightbox-trigger" style="cursor:zoom-in; max-width:100%; border-radius:6px; margin-top:8px;">`).join('') 
          : ''}
      </div>
    </div>
  `).join('');
}

// 绑定图片点击放大
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('lightbox-trigger')) {
    const src = e.target.src;
    const lightbox = document.createElement('div');
    lightbox.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); display:flex; justify-content:center; align-items:center; z-index:9999; cursor:zoom-out;';
    lightbox.innerHTML = `<img src="${src}" style="max-width:90%; max-height:90%; border-radius:8px;">`;
    lightbox.addEventListener('click', () => lightbox.remove());
    document.body.appendChild(lightbox);
  }
});

// 启动
loadSharedData();
