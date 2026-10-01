import { supabase } from './supabase.js';

// ==========================================
// 1. 页面元素与初始化
// ==========================================
const loginContainer = document.getElementById('login-container');
const dashboardContainer = document.getElementById('dashboard-container');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const recordForm = document.getElementById('record-form');
const recordsList = document.getElementById('records-list');

document.getElementById('record-date').valueAsDate = new Date();

// === 新增工具函数：获取本地日期字符串，避免 UTC 时区导致日期错位 ===
function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ==========================================
// 2. 登录与鉴权逻辑
// ==========================================
async function checkAuth() {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    showDashboard(user);
  } else {
    loginContainer.classList.remove('hidden');
    dashboardContainer.classList.add('hidden');
  }
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    alert('登录失败：' + error.message);
  } else {
    showDashboard(data.user);
  }
});

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  location.reload();
});

async function showDashboard(user) {
  loginContainer.classList.add('hidden');
  dashboardContainer.classList.remove('hidden');
  await loadRecords();
}

// ==========================================
// 3. 数据加载与渲染逻辑
// ==========================================
async function loadRecords() {
  const { data: records, error } = await supabase
    .from('study_records')
    .select('*')
    .order('study_date', { ascending: false });

  if (error) { alert('加载数据失败：' + error.message); return; }

  renderStats(records);
  renderHeatmap(records);
  renderRecordsList(records);
}

function renderStats(records) {
  const completedRecords = records.filter(r => r.is_completed);
  const uniqueDays = [...new Set(completedRecords.map(r => r.study_date))];
  
  document.getElementById('total-days').textContent = uniqueDays.length;
  document.getElementById('total-notes').textContent = records.length;

  const streak = calcStreak(records);
  document.getElementById('current-streak').textContent = streak.current;
  document.getElementById('max-streak').textContent = streak.max;
}

// === 修复连续打卡计算（使用本地日期比较） ===
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

// === 修复热力图生成逻辑（动态计算日期范围，不再写死 53 周） ===
function renderHeatmap(records) {
  const DAY = 86400000;
  const today = new Date();
  // 将今天的时间部分归零，只保留日期，避免时间干扰
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  
  // 找到本周的星期六（作为网格的结束日期）
  const dayOfWeek = todayMidnight.getDay(); // 0 是星期天，6 是星期六
  const endOfWeek = new Date(todayMidnight.getTime() + (6 - dayOfWeek) * DAY);
  
  // 找到网格的开始日期（往前推 52 周 + 本周的星期天，确保刚好覆盖一年）
  const start = new Date(endOfWeek.getTime() - (52 * 7 + 6) * DAY);

  const countMap = {};
  records.filter(r => r.is_completed).forEach(r => {
    countMap[r.study_date] = (countMap[r.study_date] || 0) + 1;
  });

  const grid = document.getElementById('heatmap-grid');
  grid.innerHTML = '';

  // 动态循环生成每一天的格子
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
    // 未来的日期隐藏
    if (current > todayMidnight) cell.style.visibility = 'hidden';
    grid.appendChild(cell);

    current = new Date(current.getTime() + DAY);
  }
}

// === 修复记录列表：增加删除按钮和图片点击放大 ===
function renderRecordsList(records) {
  if (records.length === 0) {
    recordsList.innerHTML = '<p style="color:#666;">暂无记录</p>';
    return;
  }
  recordsList.innerHTML = records.map(r => `
    <div class="record-item" data-id="${r.id}">
      <div class="record-header">
        <span class="record-date">${r.study_date}</span>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span class="record-status ${r.is_completed ? 'completed' : ''}">
            ${r.is_completed ? '✅ 已完成' : '⏳ 未完成'}
          </span>
          <button class="delete-btn" data-id="${r.id}" style="background:#ef4444; color:white; border:none; border-radius:4px; padding:2px 8px; cursor:pointer; font-size:12px;">删除</button>
        </div>
      </div>
      <div class="record-content">
        ${r.content ? marked.parse(r.content) : ''}
        ${r.images && r.images.length > 0 
          ? r.images.map(url => `<img src="${url}" alt="学习图片" class="lightbox-trigger" style="cursor:zoom-in; max-width:100%; border-radius:6px; margin-top:8px;">`).join('') 
          : ''}
      </div>
    </div>
  `).join('');

  // 绑定删除事件
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (!confirm('确定要删除这条记录吗？')) return;
      const id = e.target.dataset.id;
      const { error } = await supabase.from('study_records').delete().eq('id', id);
      if (error) {
        alert('删除失败：' + error.message);
      } else {
        await loadRecords();
      }
    });
  });
}

// ==========================================
// 4. 表单提交逻辑
// ==========================================
recordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const date = document.getElementById('record-date').value;
  const isCompleted = document.getElementById('record-completed').checked;
  const content = document.getElementById('record-content').value;
  const imageFiles = document.getElementById('record-images').files;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const imageUrls = [];
  for (const file of imageFiles) {
    const filePath = `${user.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('study-images')
      .upload(filePath, file);
    if (!uploadError) {
      const { data } = supabase.storage
        .from('study-images')
        .getPublicUrl(filePath);
      imageUrls.push(data.publicUrl);
    }
  }

  const { error } = await supabase.from('study_records').insert({
    user_id: user.id,
    study_date: date,
    is_completed: isCompleted,
    content: content,
    images: imageUrls
  });

  if (error) {
    alert('保存失败：' + error.message);
  } else {
    recordForm.reset();
    document.getElementById('record-date').valueAsDate = new Date();
    await loadRecords();
    alert('记录已保存！');
  }
});

// === 图片点击放大（Lightbox 弹窗） ===
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
checkAuth();
