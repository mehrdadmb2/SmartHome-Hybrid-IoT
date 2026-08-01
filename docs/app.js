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

/* ========== CSV ========== */
async function fetchCSV(board, date) {
  const url = REPO_RAW + 'data/' + board + '_' + date + '.csv';
  try {
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const text = await resp.text();
    const result = Papa.parse(text, { header: true, dynamicTyping: true });
    return result.data.filter(row => row.time);
  } catch (e) { return []; }
}

/* ========== وضعیت نودها ========== */
async function updateNodeStatus() {
  try {
    const resp = await fetch(REPO_RAW + 'node_status.json');
    const data = await resp.json();
    // هاب
    document.getElementById('status-hub').style.color = data.hub_online ? '#0f0' : '#f00';
    document.getElementById('status-hub').textContent = data.hub_online ? '● آنلاین' : '● آفلاین';
    document.getElementById('time-hub').textContent = data.hub_last_push ? 'آخرین پوش: ' + new Date(data.hub_last_push).toLocaleTimeString('fa-IR') : '';
    // S3
    document.getElementById('status-s3').style.color = data.s3_online ? '#0f0' : '#f00';
    document.getElementById('status-s3').textContent = data.s3_online ? '● آنلاین' : '● آفلاین';
    document.getElementById('time-s3').textContent = data.sensor_s3_last_data !== 'never' ? 'آخرین داده: ' + new Date(data.sensor_s3_last_data).toLocaleTimeString('fa-IR') : 'بدون داده';
    // درب
    document.getElementById('status-door').style.color = data.door_online ? '#0f0' : '#f00';
    document.getElementById('status-door').textContent = data.door_online ? '● آنلاین' : '● آفلاین';
    document.getElementById('time-door').textContent = data.door_last_event !== 'never' ? 'آخرین رویداد: ' + new Date(data.door_last_event).toLocaleTimeString('fa-IR') : 'بدون رویداد';
  } catch(e) { console.log('Node status fetch failed'); }
}
setInterval(updateNodeStatus, 60000);
updateNodeStatus();

/* ========== مقدارهای لحظه‌ای ========== */
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
function createChart(id, type, labels, datasets, options) {
  if (chartInstances[id]) chartInstances[id].destroy();
  chartInstances[id] = new Chart(document.getElementById(id), { type, data: { labels, datasets }, options });
}

async function updateSensorChart(board, canvasId) {
  const range = document.querySelector(`[data-board="${board}"].range-select`).value;
  const date = document.querySelector(`[data-board="${board}"].date-picker`).value || new Date().toISOString().slice(0,10);
  const data = await getDataRange(board, range, date);
  const labels = data.map(d => d.time);
  createChart(canvasId, 'line', labels, [
    { label: 'دما (°C)', data: data.map(d => d.temperature), borderColor: '#ff6ec7', backgroundColor: 'rgba(255,110,199,0.2)', yAxisID: 'y-temp' },
    { label: 'رطوبت (%)', data: data.map(d => d.humidity), borderColor: '#3b8dff', backgroundColor: 'rgba(59,141,255,0.2)', yAxisID: 'y-hum' }
  ], {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      'y-temp': { type: 'linear', position: 'left', title: { display: true, text: 'دما' }, grid: { color: 'rgba(0,255,255,0.1)' } },
      'y-hum': { type: 'linear', position: 'right', title: { display: true, text: 'رطوبت' }, grid: { drawOnChartArea: false } }
    },
    plugins: { legend: { labels: { color: '#0ff' } } }
  });
}

// ... (بقیهٔ توابع نمودار درب و SD مشابه قبل، با رنگ‌های سایبری)
