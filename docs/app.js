const REPO_RAW = 'https://raw.githubusercontent.com/mehrdadmb2/SmartHome-Hybrid-IoT/main/';

/* ========== تاریخ شمسی ========== */
function gregorianToJalali(gy, gm, gd) {
  let gy2 = (gm > 2) ? gy + 1 : gy;
  let days = 355666 + 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + Math.floor((153 * (gm > 2 ? gm - 3 : gm + 9) + 2) / 5);
  let jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  let jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  let jd = 1 + ((days < 186) ? days % 31 : (days - 186) % 30);
  return { year: jy, month: jm, day: jd };
}

function updateDateTime() {
  const now = new Date();
  const j = gregorianToJalali(now.getFullYear(), now.getMonth()+1, now.getDate());
  const jdate = `${j.year}/${String(j.month).padStart(2,'0')}/${String(j.day).padStart(2,'0')}`;
  const time = now.toLocaleTimeString('fa-IR');
  const miladi = now.toLocaleString('en-US', { year:'numeric', month:'short', day:'numeric' });
  document.getElementById('datetime').innerHTML = `📅 ${jdate} | ${time}  (${miladi})`;
}
setInterval(updateDateTime, 1000);
updateDateTime();

/* ========== CSV خوانی ========== */
async function fetchCSV(board, date) {
  const url = REPO_RAW + 'data/' + board + '_' + date + '.csv';
  try {
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const text = await resp.text();
    const result = Papa.parse(text, { header: true, dynamicTyping: true });
    return result.data.filter(row => row.time);
  } catch (e) {
    return [];
  }
}

async function getDataRange(board, range, endDate) {
  let dates = [];
  const end = new Date(endDate);
  if (range === 'daily') {
    dates.push(end.toISOString().slice(0,10));
  } else if (range === 'hourly') {
    dates.push(end.toISOString().slice(0,10));
  } else {
    const days = range === 'weekly' ? 7 : 30;
    for (let i = days-1; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0,10));
    }
  }

  let allData = [];
  for (const date of dates) {
    const dayData = await fetchCSV(board, date);
    allData = allData.concat(dayData.map(d => ({...d, date})));
  }

  if (range === 'hourly' && allData.length) {
    const last = allData[allData.length-1];
    const lastSec = last.time.split(':').reduce((a,b)=> a*60 + (+b), 0);
    const cutoff = lastSec - 3600;
    allData = allData.filter(d => d.time.split(':').reduce((a,b)=> a*60 + (+b), 0) >= cutoff);
  }
  return allData;
}

/* ========== کارت‌های مقدارهای لحظه‌ای (آخرین رکورد امروز) ========== */
async function updateLatestValues() {
  const today = new Date().toISOString().slice(0,10);
  try {
    const s1 = await fetchCSV('esp32_1', today);
    if (s1.length) {
      document.getElementById('s1-temp').textContent = s1[s1.length-1].temperature.toFixed(1);
      document.getElementById('s1-hum').textContent = s1[s1.length-1].humidity.toFixed(0);
    }
    const s2 = await fetchCSV('esp32_s3', today);
    if (s2.length) {
      document.getElementById('s2-temp').textContent = s2[s2.length-1].temperature.toFixed(1);
      document.getElementById('s2-hum').textContent = s2[s2.length-1].humidity.toFixed(0);
    }
    const door = await fetchCSV('door', today);
    document.getElementById('door-total').textContent = door.length;
  } catch(e) {}
}
setInterval(updateLatestValues, 60000);
updateLatestValues();

/* ========== نمودارها ========== */
const chartInstances = {};

function createOrUpdateChart(canvasId, type, labels, datasets, options = {}) {
  if (chartInstances[canvasId]) chartInstances[canvasId].destroy();
  chartInstances[canvasId] = new Chart(document.getElementById(canvasId), {
    type, data: { labels, datasets }, options
  });
}

// ----- سنسور ۱ -----
async function updateChart1() {
  const board = 'esp32_1';
  const range = document.querySelector('[data-board="esp32_1"].range-select').value;
  const date = document.querySelector('[data-board="esp32_1"].date-picker').value || new Date().toISOString().slice(0,10);
  const data = await getDataRange(board, range, date);
  const labels = data.map(d => d.time);
  const temps = data.map(d => d.temperature);
  const hums = data.map(d => d.humidity);

  createOrUpdateChart('chart1', 'line', labels, [
    { label: 'دما (°C)', data: temps, borderColor: '#ff6ec7', backgroundColor: 'rgba(255,110,199,0.2)', yAxisID: 'y-temp' },
    { label: 'رطوبت (%)', data: hums, borderColor: '#3b8dff', backgroundColor: 'rgba(59,141,255,0.2)', yAxisID: 'y-hum' }
  ], {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      'y-temp': { type: 'linear', position: 'left', title: { display: true, text: 'دما' }, grid: { color: 'rgba(255,255,255,0.05)' } },
      'y-hum': { type: 'linear', position: 'right', title: { display: true, text: 'رطوبت' }, grid: { drawOnChartArea: false } }
    },
    plugins: { legend: { labels: { color: '#e0e0e0' } } }
  });
}

// ----- سنسور ۲ -----
async function updateChart2() {
  const board = 'esp32_s3';
  const range = document.querySelector('[data-board="esp32_s3"].range-select').value;
  const date = document.querySelector('[data-board="esp32_s3"].date-picker').value || new Date().toISOString().slice(0,10);
  const data = await getDataRange(board, range, date);
  const labels = data.map(d => d.time);
  const temps = data.map(d => d.temperature);
  const hums = data.map(d => d.humidity);

  createOrUpdateChart('chart2', 'line', labels, [
    { label: 'دما (°C)', data: temps, borderColor: '#ff6ec7', yAxisID: 'y-temp' },
    { label: 'رطوبت (%)', data: hums, borderColor: '#3b8dff', yAxisID: 'y-hum' }
  ], {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      'y-temp': { type: 'linear', position: 'left', title: { display: true, text: 'دما' } },
      'y-hum': { type: 'linear', position: 'right', title: { display: true, text: 'رطوبت' }, grid: { drawOnChartArea: false } }
    }
  });
}

// ----- درب (نمودار میله‌ای تعداد بازشدن هر تگ) -----
async function updateDoorChart() {
  const date = document.getElementById('door-date-picker').value || new Date().toISOString().slice(0,10);
  const data = await fetchCSV('door', date);
  const tagCounts = {};
  data.forEach(row => {
    if (row.event === 'open') tagCounts[row.tag] = (tagCounts[row.tag] || 0) + 1;
  });
  const labels = Object.keys(tagCounts);
  const counts = Object.values(tagCounts);

  // به‌روزرسانی جدول
  const tbody = document.getElementById('door-table-body');
  tbody.innerHTML = '';
  labels.forEach((tag, i) => {
    tbody.innerHTML += `<tr><td>${tag}</td><td>${counts[i]}</td></tr>`;
  });

  createOrUpdateChart('chart3', 'bar', labels, [
    { label: 'دفعات باز شدن', data: counts, backgroundColor: '#ffb86c', borderColor: '#ffb86c', borderWidth: 1 }
  ], {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' } }
    },
    plugins: { legend: { display: false } }
  });
}

// ----- SD (دایره‌ای) -----
async function updateSDChart() {
  try {
    const resp = await fetch(REPO_RAW + 'sdinfo.json');
    const d = await resp.json();
    document.getElementById('sd-total').textContent = d.total_mb;
    document.getElementById('sd-free').textContent = d.free_mb;
    const used = d.used_mb || (d.total_mb - d.free_mb);
    createOrUpdateChart('chart4', 'doughnut', ['استفاده‌شده (MB)', 'آزاد (MB)'], [used, d.free_mb], [{
      backgroundColor: ['#ff5555', '#50fa7b'],
      borderColor: 'transparent'
    }], {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#e0e0e0' } } }
    });
  } catch(e) {
    console.log('SD info not available');
  }
}

/* ========== اتصال رویدادها ========== */
document.querySelectorAll('.range-select, .date-picker').forEach(el => {
  el.addEventListener('change', () => {
    const board = el.dataset.board;
    if (board === 'esp32_1') updateChart1();
    else if (board === 'esp32_s3') updateChart2();
  });
});
document.getElementById('door-date-picker').addEventListener('change', updateDoorChart);

// مقداردهی اولیه Date Picker ها
document.querySelectorAll('.date-picker').forEach(dp => {
  if (dp.id !== 'door-date-picker') dp.value = new Date().toISOString().slice(0,10);
});
document.getElementById('door-date-picker').value = new Date().toISOString().slice(0,10);

// فراخوانی اولیه
updateChart1();
updateChart2();
updateDoorChart();
updateSDChart();

// به‌روزرسانی دوره‌ای (هر ۵ دقیقه)
setInterval(() => {
  updateChart1();
  updateChart2();
  updateDoorChart();
  updateSDChart();
}, 300000);
