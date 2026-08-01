const API = window.location.origin;
let lang = localStorage.getItem('lang') || 'fa';
let theme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', theme);
document.documentElement.lang = lang;
document.dir = lang === 'fa' ? 'rtl' : 'ltr';

const translations = {
  fa: { title: '🏠 خانه هوشمند', room1: 'اتاق ۱', room2: 'اتاق ۲ (S3)', door: 'درب', doorOpen: 'امروز:', openDoor: 'باز کردن درب', sd: 'حافظه SD', chart1: 'نمودار اتاق ۱', chart2: 'نمودار اتاق ۲', doorTags: 'تگ‌های امروز' },
  en: { title: '🏠 Smart Home', room1: 'Room 1', room2: 'Room 2 (S3)', door: 'Door', doorOpen: 'Opened today:', openDoor: 'Open Door', sd: 'Storage', chart1: 'Room 1 Chart', chart2: 'Room 2 Chart', doorTags: "Today's Tags" }
};

function applyLang() {
  document.querySelectorAll('[data-lang]').forEach(el => {
    const key = el.dataset.lang;
    if (translations[lang][key]) el.textContent = translations[lang][key];
  });
}
applyLang();

// Date/time
setInterval(async () => {
  try {
    const r = await fetch(API+'/api/datetime');
    const d = await r.json();
    document.getElementById('datetime').innerHTML = `📅 ${d.shamsi} | ${d.gregorian}`;
  } catch(e) {}
}, 1000);

// Sensors
async function updateSensors() {
  try {
    const r = await fetch(API+'/api/current');
    const d = await r.json();
    document.getElementById('t1').textContent = d.esp32_1_temp.toFixed(1);
    document.getElementById('h1').textContent = d.esp32_1_hum.toFixed(0);
    document.getElementById('t2').textContent = d.esp32_s3_temp.toFixed(1);
    document.getElementById('h2').textContent = d.esp32_s3_hum.toFixed(0);
  } catch(e) {}
}
setInterval(updateSensors, 5000); updateSensors();

// SD
async function updateSD() {
  try {
    const r = await fetch(API+'/api/sdinfo');
    const d = await r.json();
    document.getElementById('sd-total').textContent = d.total_mb;
    document.getElementById('sd-free').textContent = d.free_mb;
  } catch(e) {}
}
setInterval(updateSD, 10000); updateSD();

// Door
async function updateDoor() {
  try {
    const r = await fetch(API+'/api/stats/door');
    const s = await r.json();
    document.getElementById('door-total').textContent = s.total;
    const tbody = document.querySelector('#door-tags-table tbody');
    tbody.innerHTML = '';
    s.tags.forEach(tag => tbody.innerHTML += `<tr><td>${tag.tag}</td><td>${tag.count}</td></tr>`);
  } catch(e) {}
}
setInterval(updateDoor, 10000); updateDoor();

// Nodes
async function updateNodes() {
  try {
    const r = await fetch(API+'/api/nodestatus');
    const d = await r.json();
    setNode('hub-status', d.hub_online);
    setNode('s3-status', d.s3_online);
    setNode('door-status', d.door_online);
  } catch(e) {}
}
function setNode(id, online) {
  const dot = document.getElementById(id);
  if (dot) {
    dot.style.background = online ? 'var(--green)' : 'var(--red)';
    dot.style.boxShadow = online ? '0 0 10px var(--green)' : '0 0 5px var(--red)';
  }
}
setInterval(updateNodes, 5000); updateNodes();

// ======================= CHARTS =======================
const charts = {};
async function drawChart(board, canvasId, range) {
  try {
    const r = await fetch(`${API}/api/data?board=${board}&range=${range}`);
    const data = await r.json();
    if (!data || !Array.isArray(data)) return;
    const labels = data.map(d => d.time);
    const temps = data.map(d => d.temp);
    const hums = data.map(d => d.humidity);
    if (charts[canvasId]) charts[canvasId].destroy();
    charts[canvasId] = new Chart(document.getElementById(canvasId), {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'دما (°C)', data: temps, borderColor: '#ff6ec7', backgroundColor: 'rgba(255,110,199,0.2)', yAxisID: 'y' },
          { label: 'رطوبت (%)', data: hums, borderColor: '#0ff', backgroundColor: 'rgba(0,255,255,0.2)', yAxisID: 'y1' }
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
  } catch(e) { console.error('Chart error:', e); }
}

document.querySelectorAll('.range-select').forEach(sel => {
  sel.addEventListener('change', () => {
    const board = sel.dataset.board;
    drawChart(board, board==='esp32_1'?'chart1':'chart2', sel.value);
  });
  // draw immediately
  const board = sel.dataset.board;
  drawChart(board, board==='esp32_1'?'chart1':'chart2', sel.value);
});

// Open door
document.getElementById('open-door').addEventListener('click', async () => {
  await fetch(API+'/open');
  alert(lang==='fa'?'دستور باز شدن درب ارسال شد':'Door opening command sent');
});

// Theme & language
document.getElementById('theme-toggle').addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
});
document.getElementById('lang-toggle').addEventListener('click', () => {
  lang = lang === 'fa' ? 'en' : 'fa';
  document.documentElement.lang = lang;
  document.dir = lang === 'fa' ? 'rtl' : 'ltr';
  localStorage.setItem('lang', lang);
  applyLang();
});

// ======================= FILE MANAGER =======================
const fileTableBody = document.querySelector('#file-table tbody');
async function loadFileList() {
  try {
    const res = await fetch(API + '/api/files');
    const files = await res.json();
    fileTableBody.innerHTML = '';
    if (files.length === 0) {
      fileTableBody.innerHTML = '<tr><td colspan="3">هیچ فایلی یافت نشد</td></tr>';
      return;
    }
    files.forEach(file => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${file.name}</td>
        <td>${(file.size/1024).toFixed(1)}</td>
        <td>
          <button class="file-action-btn download-btn" data-path="${file.path}">⬇️</button>
          <button class="file-action-btn delete-btn" data-path="${file.path}">🗑️</button>
        </td>`;
      fileTableBody.appendChild(row);
    });
    document.querySelectorAll('.download-btn').forEach(btn => {
      btn.onclick = () => window.open(API + '/api/download?path=' + encodeURIComponent(btn.dataset.path));
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.onclick = async () => {
        if (confirm('حذف شود؟')) {
          await fetch(API + '/api/delete?path=' + encodeURIComponent(btn.dataset.path));
          loadFileList();
        }
      };
    });
  } catch(e) {}
}
document.getElementById('refresh-files').onclick = loadFileList;
document.getElementById('download-all').onclick = async () => {
  const res = await fetch(API + '/api/files');
  const files = await res.json();
  files.forEach((f, i) => {
    setTimeout(() => {
      const a = document.createElement('a');
      a.href = API + '/api/download?path=' + encodeURIComponent(f.path);
      a.download = f.name;
      a.click();
    }, i * 300);
  });
};
document.getElementById('upload-input').onchange = async (e) => {
  for (const file of e.target.files) {
    const fd = new FormData();
    fd.append('file', file);
    await fetch(API + '/api/upload?dir=' + encodeURIComponent(document.getElementById('upload-dir').value || '/www/'), { method:'POST', body:fd });
  }
  loadFileList();
};
loadFileList();
