const API = window.location.origin;

// تاریخ و ساعت
setInterval(async () => {
  const r = await fetch(API + '/api/datetime');
  const d = await r.json();
  document.getElementById('datetime').innerHTML = 
    `📅 ${d.shamsi} (میلادی: ${d.gregorian})`;
}, 1000);

// وضعیت سنسورها
async function updateStatus() {
  const r = await fetch(API + '/api/current');
  const d = await r.json();
  document.getElementById('t1').textContent = d.esp32_1_temp.toFixed(1);
  document.getElementById('h1').textContent = d.esp32_1_hum.toFixed(0);
  document.getElementById('t2').textContent = d.esp32_s3_temp.toFixed(1);
  document.getElementById('h2').textContent = d.esp32_s3_hum.toFixed(0);
}
setInterval(updateStatus, 5000); updateStatus();

// اطلاعات SD
async function updateSD() {
  const r = await fetch(API + '/api/sdinfo');
  const d = await r.json();
  document.getElementById('sd-total').textContent = d.total_mb;
  document.getElementById('sd-used').textContent = d.used_mb;
  document.getElementById('sd-free').textContent = d.free_mb;
}
setInterval(updateSD, 10000); updateSD();

// آمار درب
async function updateDoorStats() {
  const r = await fetch(API + '/api/stats/door');
  const s = await r.json();
  document.getElementById('door-total').textContent = s.total;
  const tbody = document.querySelector('#door-table tbody');
  tbody.innerHTML = '';
  s.tags.forEach(tag => {
    tbody.innerHTML += `<tr><td>${tag.tag}</td><td>${tag.count}</td></tr>`;
  });
}
setInterval(updateDoorStats, 10000); updateDoorStats();

// مدیریت نمودارها
const charts = {};
async function drawChart(board, canvasId) {
  const range = document.querySelector(`[data-board="${board}"]`).value;
  const data = await (await fetch(`${API}/api/data?board=${board}&range=${range}`)).json();
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
        { label: 'دما (°C)', data: temps, borderColor: '#f85149', yAxisID: 'y-temp' },
        { label: 'رطوبت (%)', data: hums, borderColor: '#58a6ff', yAxisID: 'y-hum' }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index' },
      scales: {
        'y-temp': { type: 'linear', position: 'left', title: { display: true, text: 'دما' } },
        'y-hum': { type: 'linear', position: 'right', title: { display: true, text: 'رطوبت' }, grid: { drawOnChartArea: false } }
      }
    }
  });
}

document.querySelectorAll('.range-select').forEach(sel => {
  sel.addEventListener('change', () => drawChart(sel.dataset.board, sel.dataset.board === 'esp32_1' ? 'chart1' : 'chart2'));
  drawChart(sel.dataset.board, sel.dataset.board === 'esp32_1' ? 'chart1' : 'chart2');
});

document.getElementById('open-door-btn').addEventListener('click', async () => {
  await fetch(API + '/open');
  alert('دستور باز شدن درب ارسال شد');
});
