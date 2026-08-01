const REPO = 'https://raw.githubusercontent.com/mehrdadmb2/SmartHome-Hybrid-IoT/main/';
let lang = localStorage.getItem('lang') || 'fa';
let theme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', theme);
document.documentElement.lang = lang;
document.dir = lang === 'fa' ? 'rtl' : 'ltr';

// تاریخ شمسی دقیق
function gregorianToJalali(gy, gm, gd) {
  const gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + Math.floor((153 * (gm > 2 ? (gm - 3) : (gm + 9)) + 2) / 5);
  let jy = -1595 + (33 * Math.floor(days / 12053));
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  return { year: jy, month: jm, day: jd };
}
function updateDateTime() {
  const now = new Date();
  const j = gregorianToJalali(now.getFullYear(), now.getMonth()+1, now.getDate());
  document.getElementById('datetime').textContent = `📅 ${j.year}/${String(j.month).padStart(2,'0')}/${String(j.day).padStart(2,'0')} ${now.toLocaleTimeString('fa-IR')}`;
}
setInterval(updateDateTime, 1000); updateDateTime();

// بقیهٔ کد مانند قبل (ترجمه، تم، fetch CSVها و نمودارها) ...

// CSV helpers
async function fetchCSV(board, date) {
  const url = REPO + 'data/' + board + '_' + date + '.csv';
  try {
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const text = await resp.text();
    const result = Papa.parse(text, { header: true, dynamicTyping: true });
    return result.data.filter(row => row.time);
  } catch(e) { return []; }
}
async function getDataRange(board, range, endDate) {
  let dates = [];
  const end = new Date(endDate);
  if (range === 'daily') dates.push(end.toISOString().slice(0,10));
  else if (range === 'hourly') dates.push(end.toISOString().slice(0,10));
  else {
    const days = range === 'weekly' ? 7 : 30;
    for (let i=days-1; i>=0; i--) {
      const d = new Date(end); d.setDate(d.getDate()-i);
      dates.push(d.toISOString().slice(0,10));
    }
  }
  let all = [];
  for (const d of dates) {
    const dayData = await fetchCSV(board, d);
    all = all.concat(dayData.map(r => ({...r, date:d})));
  }
  if (range === 'hourly' && all.length) {
    const last = all[all.length-1];
    const lastSec = last.time.split(':').reduce((a,b)=>a*60 + +b, 0);
    const cutoff = lastSec - 3600;
    all = all.filter(r => r.time.split(':').reduce((a,b)=>a*60 + +b, 0) >= cutoff);
  }
  return all;
}

// Live values
async function updateLatest() {
  const today = new Date().toISOString().slice(0,10);
  try {
    const s1 = await fetchCSV('esp32_1', today);
    if (s1.length) {
      document.getElementById('t1').textContent = s1[s1.length-1].temperature.toFixed(1);
      document.getElementById('h1').textContent = s1[s1.length-1].humidity.toFixed(0);
    }
    const s2 = await fetchCSV('esp32_s3', today);
    if (s2.length) {
      document.getElementById('t2').textContent = s2[s2.length-1].temperature.toFixed(1);
      document.getElementById('h2').textContent = s2[s2.length-1].humidity.toFixed(0);
    }
    const door = await fetchCSV('door', today);
    document.getElementById('door-total').textContent = door.length;
    const sd = await fetch(REPO + 'sdinfo.json').then(r=>r.json());
    document.getElementById('sd-free').textContent = sd.free_mb;
  } catch(e) {}
}
setInterval(updateLatest, 60000); updateLatest();

// Node status from node_status.json
async function updateNodeStatus() {
  try {
    const resp = await fetch(REPO + 'node_status.json');
    const d = await resp.json();
    setNodeStatus('hub-status', d.hub_online);
    setNodeStatus('s3-status', d.s3_online);
    setNodeStatus('door-status', d.door_online);
  } catch(e) {}
}
function setNodeStatus(id, online) {
  const dot = document.getElementById(id);
  if (dot) {
    dot.style.background = online ? 'var(--green)' : 'var(--red)';
    dot.style.boxShadow = online ? '0 0 10px var(--green)' : '0 0 5px var(--red)';
  }
}
setInterval(updateNodeStatus, 30000); updateNodeStatus();

// Charts
const charts = {};
async function drawChart(board, canvasId, range, refDate) {
  const data = await getDataRange(board, range, refDate || new Date().toISOString().slice(0,10));
  const labels = data.map(d => d.time);
  const temps = data.map(d => d.temperature);
  const hums = data.map(d => d.humidity);
  if (charts[canvasId]) charts[canvasId].destroy();
  charts[canvasId] = new Chart(document.getElementById(canvasId), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'دما', data: temps, borderColor: '#ff6ec7', yAxisID: 'y' },
        { label: 'رطوبت', data: hums, borderColor: '#0ff', yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: { type:'linear', position:'left', title:{display:true, text:'دما'} },
        y1: { type:'linear', position:'right', title:{display:true, text:'رطوبت'}, grid:{drawOnChartArea:false} }
      }
    }
  });
}

document.querySelectorAll('.range-select, .date-picker').forEach(el => {
  el.addEventListener('change', () => {
    const board = el.dataset.board;
    const range = document.querySelector(`.range-select[data-board="${board}"]`).value;
    const date = document.querySelector(`.date-picker[data-board="${board}"]`).value || new Date().toISOString().slice(0,10);
    drawChart(board, board==='esp32_1'?'chart1':'chart2', range, date);
  });
  if (el.classList.contains('range-select')) {
    // initial
    const board = el.dataset.board;
    const date = new Date().toISOString().slice(0,10);
    drawChart(board, board==='esp32_1'?'chart1':'chart2', el.value, date);
  }
});

// Theme/lang (same as local)
