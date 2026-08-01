const API = window.location.origin;

// تاریخ شمسی
function updateDateTime() {
  fetch(API + '/api/datetime')
    .then(r => r.json())
    .then(d => {
      document.getElementById('datetime').textContent = '📅 ' + d.shamsi + ' | ' + d.gregorian;
    })
    .catch(() => {
      document.getElementById('datetime').textContent = 'ساعت در دسترس نیست';
    });
}
setInterval(updateDateTime, 1000);
updateDateTime();

// وضعیت نودها
async function updateNodeStatus() {
  try {
    const r = await fetch(API + '/api/nodestatus');
    const d = await r.json();
    const setStatus = (id, online) => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = online ? '● آنلاین' : '○ آفلاین';
        el.style.color = online ? '#0f0' : '#f00';
      }
    };
    setStatus('status-hub', d.hub_online);
    setStatus('status-s3', d.s3_online);
    setStatus('status-door', d.door_online);
  } catch(e) {}
}
setInterval(updateNodeStatus, 5000);
updateNodeStatus();

// وضعیت سنسورها
async function updateSensors() {
  try {
    const r = await fetch(API + '/api/current');
    const d = await r.json();
    document.getElementById('t1').textContent = d.esp32_1_temp.toFixed(1);
    document.getElementById('h1').textContent = d.esp32_1_hum.toFixed(0);
    document.getElementById('t2').textContent = d.esp32_s3_temp.toFixed(1);
    document.getElementById('h2').textContent = d.esp32_s3_hum.toFixed(0);
  } catch(e) {}
}
setInterval(updateSensors, 5000);
updateSensors();

// SD info
async function updateSD() {
  try {
    const r = await fetch(API + '/api/sdinfo');
    const d = await r.json();
    document.getElementById('sd-total').textContent = d.total_mb;
    document.getElementById('sd-free').textContent = d.free_mb;
  } catch(e) {}
}
setInterval(updateSD, 10000);
updateSD();

// درب
async function updateDoorStats() {
  try {
    const r = await fetch(API + '/api/stats/door');
    const s = await r.json();
    document.getElementById('door-total').textContent = s.total;
    const tbody = document.querySelector('#door-table tbody');
    tbody.innerHTML = '';
    s.tags.forEach(tag => {
      tbody.innerHTML += `<tr><td>${tag.tag}</td><td>${tag.count}</td></tr>`;
    });
  } catch(e) {}
}
setInterval(updateDoorStats, 10000);
updateDoorStats();

// باز کردن درب
async function openDoor() {
  await fetch(API + '/open');
  alert('دستور باز شدن درب ارسال شد');
}

// نمودارها
const charts = {};
async function drawChart(board, canvasId, rangeId) {
  const range = document.getElementById(rangeId).value;
  try {
    const r = await fetch(API + `/api/data?board=${board}&range=${range}`);
    const data = await r.json();
    const labels = data.map(d => d.time);
    const temps = data.map(d => d.temp);
    const hums = data.map(d => d.humidity);

    if (charts[canvasId]) charts[canvasId].destroy();
    const ctx = document.getElementById(canvasId).getContext('2d');
    charts[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'دما (°C)', data: temps, borderColor: '#ff6ec7', yAxisID: 'y-temp' },
          { label: 'رطوبت (%)', data: hums, borderColor: '#3b8dff', yAxisID: 'y-hum' }
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
  } catch(e) {
    console.error('Chart error:', e);
  }
}

// بارگذاری اولیه
drawChart('esp32_1', 'chart1', 'range1');
drawChart('esp32_s3', 'chart2', 'range2');
