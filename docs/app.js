const REPO_RAW = 'https://raw.githubusercontent.com/mehrdadmb2/SmartHome-Hybrid-IoT/main/data/';

function getTodayStr() {
  const d = new Date();
  return d.toISOString().slice(0,10);
}

async function fetchCSV(board, date) {
  const url = REPO_RAW + board + '_' + date + '.csv';
  try {
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const text = await resp.text();
    const result = Papa.parse(text, { header: true, dynamicTyping: true });
    return result.data.filter(row => row.time);
  } catch {
    return [];
  }
}

async function drawChart() {
  const board = document.getElementById('board-select').value;
  const date = document.getElementById('date-picker').value || getTodayStr();
  const data = await fetchCSV(board, date);
  
  const labels = data.map(d => d.time);
  const temps = data.map(d => d.temperature);
  const hums = data.map(d => d.humidity);

  const ctx = document.getElementById('chart').getContext('2d');
  if (window.myChart) window.myChart.destroy();
  window.myChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'دما (°C)',
          data: temps,
          borderColor: '#f85149',
          yAxisID: 'y-temp',
        },
        {
          label: 'رطوبت (%)',
          data: hums,
          borderColor: '#58a6ff',
          yAxisID: 'y-hum',
        }
      ]
    },
    options: {
      responsive: true,
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

async function loadDoorStats() {
  const date = getTodayStr();
  const data = await fetchCSV('door', date);
  const tagCounts = {};
  let total = 0;
  data.forEach(row => {
    if (row.event === 'open') {
      total++;
      const tag = row.tag;
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  });
  document.getElementById('door-total').innerText = total;
  const tbody = document.querySelector('#door-table tbody');
  tbody.innerHTML = '';
  Object.entries(tagCounts).forEach(([tag, count]) => {
    tbody.innerHTML += `<tr><td>${tag}</td><td>${count}</td></tr>`;
  });
}

document.getElementById('board-select').addEventListener('change', drawChart);
document.getElementById('date-picker').addEventListener('change', drawChart);

// مقداردهی اولیه
document.getElementById('date-picker').value = getTodayStr();
drawChart();
loadDoorStats();
