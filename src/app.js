import { createInitialState, plcScan, spawnProduct } from './plc.js';

const state = createInitialState();
const canvas = document.getElementById('machineCanvas');
const ctx = canvas.getContext('2d');

const el = {
  startBtn: document.getElementById('startBtn'), stopBtn: document.getElementById('stopBtn'),
  resetBtn: document.getElementById('resetBtn'), spawnBtn: document.getElementById('spawnBtn'),
  autoBtn: document.getElementById('autoBtn'), estopBtn: document.getElementById('estopBtn'),
  statusPill: document.getElementById('statusPill'), scanInfo: document.getElementById('scanInfo'),
  ioGrid: document.getElementById('ioGrid'), rungs: document.getElementById('rungs'), alarms: document.getElementById('alarms'),
  jam: [document.getElementById('jam1'), document.getElementById('jam2'), document.getElementById('jam3')],
  vac: [document.getElementById('vac1'), document.getElementById('vac2'), document.getElementById('vac3')]
};

el.startBtn.onclick = () => { state.startPB = true; };
el.stopBtn.onclick = () => { state.stopPB = true; };
el.resetBtn.onclick = () => { state.resetPB = true; };
el.spawnBtn.onclick = () => spawnProduct(state);
el.autoBtn.onclick = () => { state.autoMode = !state.autoMode; el.autoBtn.textContent = `AUTO MODE: ${state.autoMode ? 'ON' : 'OFF'}`; };
el.estopBtn.onclick = () => { state.estopOK = !state.estopOK; el.estopBtn.textContent = state.estopOK ? 'E-STOP OK' : 'E-STOP OPEN'; el.estopBtn.className = state.estopOK ? 'safe' : 'stop'; };

function syncFaults() {
  el.jam.forEach((box, i) => state.faultInject.jam[i] = box.checked);
  el.vac.forEach((box, i) => state.faultInject.vacuumFail[i] = box.checked);
}

function lamp(x, y, on, label) {
  ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fillStyle = on ? '#ffd166' : '#4f5c70'; ctx.fill();
  ctx.fillStyle = '#a7b4c8'; ctx.font = '10px Arial'; ctx.fillText(label, x + 16, y + 4);
}
function bit(v) { return `<span class="bit ${v ? 'on' : ''}"></span>`; }
function drawBox(p) {
  ctx.fillStyle = p.color || '#d9e6ff'; ctx.strokeStyle = '#172033'; ctx.lineWidth = 2;
  ctx.fillRect(p.x - 22, p.y - 16, 44, 32); ctx.strokeRect(p.x - 22, p.y - 16, 44, 32);
  ctx.fillStyle = '#172033'; ctx.font = 'bold 12px Arial'; ctx.fillText(`#${p.id}`, p.x - 11, p.y + 4);
  if (p.completedStations.length) { ctx.font = '10px Arial'; ctx.fillText(p.completedStations.join(','), p.x - 8, p.y + 15); }
}
function drawConveyor(y, label) {
  ctx.fillStyle = '#263247'; ctx.fillRect(70, y, 980, 34); ctx.strokeStyle = '#42536f'; ctx.strokeRect(70, y, 980, 34);
  ctx.fillStyle = '#a7b4c8'; ctx.font = '12px Arial'; ctx.fillText(label, 70, y - 8);
  for (let x = 90; x < 1040; x += 42) { ctx.beginPath(); ctx.arc(x, y + 17, 10, 0, Math.PI * 2); ctx.fillStyle = '#6e7d92'; ctx.fill(); ctx.strokeStyle = '#b6c3d8'; ctx.stroke(); }
}
function drawStation(s) {
  const x = s.x;
  ctx.fillStyle = '#25334b'; ctx.strokeStyle = '#5b6c8d'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(x - 70, 88, 140, 108, 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ecf2ff'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center'; ctx.fillText(s.name, x, 116);
  ctx.font = '12px monospace'; ctx.fillStyle = '#a7b4c8'; ctx.fillText(s.state, x, 140); ctx.fillText(`${s.cycles} cycles`, x, 163);
  ctx.strokeStyle = '#5b6c8d'; ctx.beginPath(); ctx.moveTo(x, 196); ctx.lineTo(x, 250); ctx.stroke();
  lamp(x - 44, 250, s.peBlocked, `PE ${s.index + 1}`);
  ctx.fillStyle = s.callForBox ? '#63a4ff' : '#4f5c70'; ctx.fillRect(x - 48, 64, 24, 14);
  ctx.fillStyle = s.complete ? '#3bd179' : '#4f5c70'; ctx.fillRect(x - 12, 64, 24, 14);
  ctx.fillStyle = s.outputs.pusher ? '#ffd166' : '#4f5c70'; ctx.fillRect(x + 24, 64, 24, 14);
  if (s.outputs.pusher) { ctx.fillStyle = '#ffd166'; ctx.fillRect(x - 8, 195, 16, 88); }
}
function drawMachine() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawConveyor(175, 'TOP INFEED / CVP CONVEYOR'); drawConveyor(295, 'BOTTOM TAKEAWAY CONVEYOR');
  lamp(75, 154, state.inputs['I:1/0 Infeed PE'], 'INFEED PE'); lamp(1010, 274, state.inputs['I:1/4 Bottom Outfeed PE'], 'BOTTOM OUTFEED PE');
  state.stations.forEach(drawStation); state.products.forEach(drawBox);
  ctx.textAlign = 'left'; ctx.fillStyle = '#a7b4c8'; ctx.font = '12px Arial';
  ctx.fillText('Blue=call for box   Green=complete   Yellow=pusher out / transfer to lower conveyor', 80, 390);
}
function renderIO() {
  const groups = [['Inputs', state.inputs], ['Outputs', state.outputs], ['Stations', Object.fromEntries(state.stations.map(s => [s.name, `${s.state} | call=${s.callForBox} complete=${s.complete} pusher=${s.outputs.pusher}`]))]];
  el.ioGrid.innerHTML = groups.map(([title, obj]) => `<div><h3>${title}</h3>${Object.entries(obj).map(([k, v]) => `<div class="tag"><span>${k}</span>${typeof v === 'boolean' ? bit(v) : `<span>${v}</span>`}</div>`).join('')}</div>`).join('');
}
function renderRungs() {
  const rows = [
    ['Master Run Latch', state.masterRunLatch], ['Permissive: E-stop OK', state.estopOK], ['Permissive: Auto Mode', state.autoMode], ['No Faults', !state.faults.any],
    ...state.stations.flatMap((s, i) => [[`CVP ${i + 1} call for box`, s.callForBox], [`CVP ${i + 1} cycle complete`, s.complete], [`CVP ${i + 1} pusher extend`, s.outputs.pusher]])
  ];
  el.rungs.innerHTML = rows.map(([name, v]) => `<div class="rung"><span>${name}</span>${bit(v)}</div>`).join('');
}
function renderAlarms() { el.alarms.innerHTML = state.alarms.length ? state.alarms.map(a => `<div>${a.time}s — ${a.text}</div>`).join('') : '<div>No active alarm history</div>'; }
function renderStatus() {
  el.statusPill.textContent = state.faults.any ? 'FAULTED' : state.masterRunLatch ? 'RUNNING' : 'STOPPED';
  el.statusPill.className = `pill ${state.faults.any ? 'faulted' : state.masterRunLatch ? 'running' : 'stopped'}`;
  el.scanInfo.textContent = `PLC Scan: ${state.scanMs} ms | Products: ${state.products.length}`;
}
function tick() { syncFaults(); plcScan(state); drawMachine(); renderIO(); renderRungs(); renderAlarms(); renderStatus(); }

spawnProduct(state); spawnProduct(state); setInterval(tick, state.scanMs); tick();
