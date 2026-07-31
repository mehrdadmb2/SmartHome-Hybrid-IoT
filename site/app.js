const API = window.location.origin;

async function fetchCurrent() {
  let r = await fetch(API + '/api/current');
  return await r.json();
}

async function fetchData(board, range) {
  let date = new Date().toISOString().split('T')[0];
  let url = API + `/api/data?board=${board}&range=${range}&date=${date}`;
  let r = await fetch(url);
  return await r.json();
}

async function fetchDoorStats() {
  let r = await fetch(API + '/api/stats/door');
  return await r.json();
}

function updateCurrent(data) {
  document.getElementById('t1').innerText = data.esp32_1_temp.toFixed(1);
  document.getElementById('h1').innerText = data.esp32_1_hum.toFixed(0);
  document.getElementById('t2').innerText = data.esp32_s3_temp.toFixed(1);
  document.getElementById('h2').innerText = data.esp32_s3_hum.toFixed(0);
}

function updateDoorStats(stats) {
  document.getElementById('door-total').innerText = stats.total;
  const tbody = document.querySelector('#door-table tbody');
  tbody.innerHTML = '';
  stats.tags.forEach(tag => {
    tbody.innerHTML += `<tr><td>${tag.tag}</td><td>${tag.count}</td></tr>`;
  });
}

let chart;
async function drawChart() {
  const board = document.getElementById('board-select').value;
  const range = document.getElementById('range-select').value;
  const data = await fetchData(board, range);
  const labels = data.map(d => d.time);
  const temps = data.map(d => d.temp);
  const hums = data.map(d => d.humidity);

  const ctx = document.getElementById('chart').getContext('2d');
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'دما (°C)',
          data: temps,
          borderColor: '#f85149',
          backgroundColor: 'rgba(248,81,73,0.1)',
          yAxisID: 'y-temp',
        },
        {
          label: 'رطوبت (%)',
          data: hums,
          borderColor: '#58a6ff',
          backgroundColor: 'rgba(88,166,255,0.1)',
          yAxisID: 'y-hum',
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      scales: {
        'y-temp': {
          type: 'linear',
          position: 'left',
          title: { display: true, text: 'دما (°C)' }
        },
        'y-hum': {
          type: 'linear',
          position: 'right',
          title: { display: true, text: 'رطوبت (%)' },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
}

// رویدادها
document.getElementById('board-select').addEventListener('change', drawChart);
document.getElementById('range-select').addEventListener('change', drawChart);
document.getElementById('open-door-btn').addEventListener('click', async () => {
  await fetch(API + '/open');
  alert('دستور باز شدن درب ارسال شد');
});

// بارگذاری اولیه و به‌روزرسانی دوره‌ای
(async function init() {
  const cur = await fetchCurrent();
  updateCurrent(cur);
  const stats = await fetchDoorStats();
  updateDoorStats(stats);
  drawChart();
})();

setInterval(async () => {
  const cur = await fetchCurrent();
  updateCurrent(cur);
  const stats = await fetchDoorStats();
  updateDoorStats(stats);
}, 10000);  // هر ۱۰ ثانیه
