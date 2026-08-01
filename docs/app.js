const REPO_RAW = 'https://raw.githubusercontent.com/mehrdadmb2/SmartHome-Hybrid-IoT/main/';

// تاریخ شمسی با کتابخانهٔ ساده (یا می‌توان از moment-jalaali استفاده کرد)
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

setInterval(() => {
  const now = new Date();
  const j = gregorianToJalali(now.getFullYear(), now.getMonth()+1, now.getDate());
  document.getElementById('datetime').textContent =
    `📅 ${j.year}/${String(j.month).padStart(2,'0')}/${String(j.day).padStart(2,'0')} ${now.toLocaleTimeString('fa-IR')} (میلادی: ${now.toLocaleString('en-US')})`;
}, 1000);

// اطلاعات SD از فایل sdinfo.json
async function updateSD() {
  try {
    const r = await fetch(REPO_RAW + 'sdinfo.json');
    const d = await r.json();
    document.getElementById('sd-total').textContent = d.total_mb;
    document.getElementById('sd-used').textContent = d.used_mb;
    document.getElementById('sd-free').textContent = d.free_mb;
  } catch(e) {}
}
setInterval(updateSD, 60000); updateSD();

// توابع CSV
async function fetchCSV(board, date) {
  const url = REPO_RAW + 'data/' + board + '_' + date + '.csv';
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const text = await r.text();
    const result = Papa.parse(text, { header: true, dynamicTyping: true });
    return result.data.filter(row => row.time);
  } catch { return []; }
}

async function getDataRange(board, range, endDate) {
  let dates = [];
  const end = new Date(endDate);
  if (range === 'daily') {
    dates.push(end.toISOString().slice(0,10));
  } else if (range === 'hourly') {
    dates.push(end.toISOString().slice(0,10)); // بعداً فیلتر می‌کنیم
  } else {
    const days = range === 'weekly' ? 7 : 30;
    for (let i = days-1; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0,10));
    }
  }

  let allData = [];
  for (let date of dates) {
    const dayData = await fetchCSV(board, date);
    allData = allData.concat(dayData.map(d => ({...d, date})));
  }

  if (range === 'hourly' && allData.length) {
    // آخرین زمان
    const last = allData[allData.length-1];
    const lastSec = last.time.split(':').reduce((a,b)=> a*60 + (+b), 0);
    const cutoff = lastSec - 3600;
    allData = allData.filter(d => d.time.split(':').reduce((a,b)=> a*60 + (+b), 0) >= cutoff);
  }
  return allData;
}

// نمودارها
const charts = {};
async function drawChart(board, canvasId) {
  const range = document.querySelector(`[data-board="${board}"]`).value;
  const datePicker = document.querySelector(`.date-picker[data-board="${board}"]`);
  const refDate = datePicker ? datePicker.value : new Date().toISOString().slice(0,10);
  const data = await getDataRange(board, range, refDate);
  const labels = data.map(d => d.time);
  const temps = data.map(d => d.temperature);
  const hums = data.map(d => d.humidity);

  if (charts[canvasId]) charts[canvasId].destroy();
  charts[canvasId] = new Chart(document.getElementById(canvasId), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'دما (°C)', data: temps, borderColor: '#f85149', yAxisID: 'y-temp' },
        { label: 'رطوبت (%)', data: hums, borderColor: '#58a6ff', yAxisID: 'y-hum' }
      ]
    },
    options: {
      responsive: true,
      scales: {
        'y-temp': { type: 'linear', position: 'left', title: { display: true, text: 'دما' } },
        'y-hum': { type: 'linear', position: 'right', title: { display: true, text: 'رطوبت' }, grid: { drawOnChartArea: false } }
      }
    }
  });
}

// رویدادها
document.querySelectorAll('.range-select').forEach(sel => {
  sel.addEventListener('change', () => drawChart(sel.dataset.board, sel.dataset.board === 'esp32_1' ? 'chart1' : 'chart2'));
});
document.querySelectorAll('.date-picker').forEach(dp => {
  dp.value = new Date().toISOString().slice(0,10);
  dp.addEventListener('change', () => drawChart(dp.dataset.board, dp.dataset.board === 'esp32_1' ? 'chart1' : 'chart2'));
});

// آمار درب
async function updateDoorStats() {
  const today = new Date().toISOString().slice(0,10);
  const data = await fetchCSV('door', today);
  const tagCount = {};
  data.forEach(row => {
    if (row.event === 'open') tagCount[row.tag] = (tagCount[row.tag] || 0) + 1;
  });
  document.getElementById('door-total') && (document.getElementById('door-total').textContent = data.length);
  // جدول تگ‌ها (اختیاری، می‌توانید اضافه کنید)
}

// فراخوانی اولیه
drawChart('esp32_1', 'chart1');
drawChart('esp32_s3', 'chart2');
setInterval(updateDoorStats, 30000); updateDoorStats();
