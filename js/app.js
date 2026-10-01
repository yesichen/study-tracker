import { supabase } from './supabase.js';

// 页面元素
const loginContainer = document.getElementById('login-container');
const dashboardContainer = document.getElementById('dashboard-container');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const recordForm = document.getElementById('record-form');
const recordsList = document.getElementById('records-list');

// 初始化
document.getElementById('record-date').valueAsDate = new Date();

// 检查登录状态
async function checkAuth() {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    showDashboard(user);
  } else {
    loginContainer.classList.remove('hidden');
    dashboardContainer.classList.add('hidden');
  }
}

// 登录
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

// 退出
logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  location.reload();
});

// 显示主面板
async function showDashboard(user) {
  loginContainer.classList.add('hidden');
  dashboardContainer.classList.remove('hidden');
  await loadRecords();
}

// 加载数据并渲染
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

// 渲染统计
function renderStats(records) {
  const completedRecords = records.filter(r => r.is_completed);
  const uniqueDays = [...new Set(completedRecords.map(r => r.study_date))];
  
  document.getElementById('total-days').textContent = uniqueDays.length;
  document.getElementById('total-notes').textContent = records.length;

  const streak = calcStreak(records);
  document.getElementById('current-streak').textContent = streak.current;
  document.getElementById('max-streak').textContent = streak.max;
}

// 连续打卡计算
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

// 渲染热力图
function renderHeatmap(records) {
  const DAY = 86400000;
  const WEEKS = 53;
  const today = new Date();
  let start = new Date(today.getTime() - (WEEKS * 7 - 1) * DAY);
  start = new Date(start.getTime() - start.getDay() * DAY);

  const countMap = {};
  records.filter(r => r.is_completed).forEach(r => {
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
    cell.dataset.date = dateStr;
    cell.title = `${dateStr}：${count} 条记录`;
    if (d > today) cell.style.visibility = 'hidden';
    grid.appendChild(cell);
  }
}

// 渲染记录列表
function renderRecordsList(records) {
  if (records.length === 0) {
    recordsList.innerHTML = '<p style="color:#666;">暂无记录</p>';
    return;
  }
  recordsList.innerHTML = records.map(r => `
    <div class="record-item">
      <div class="record-header">
        <span class="record-date">${r.study_date}</span>
        <span class="record-status ${r.is_completed ? 'completed' : ''}">
          ${r.is_completed ? '✅ 已完成' : '⏳ 未完成'}
        </span>
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

// 添加记录
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

// 启动
checkAuth();