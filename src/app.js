import { createInitialState, plcScan, spawnProduct } from './plc.js';

const state = createInitialState();
const canvas = document.getElementById('machineCanvas');
const ctx = canvas.getContext('2d');

function byId(...ids) {
  for (const id of ids) {
    const node = document.getElementById(id);
    if (node) return node;
  }
  return null;
}

const el = {
  startBtn: byId('startBtn'),
  stopBtn: byId('stopBtn'),
  resetBtn: byId('resetBtn'),
  spawnBtn: byId('spawnBtn'),
  autoBtn: byId('autoBtn'),
  estopBtn: byId('estopBtn'),
  statusPill: byId('systemStatus', 'statusPill'),
  scanInfo: byId('scanTime', 'scanInfo'),
  inputList: byId('inputList'),
  outputList: byId('outputList'),
  stationList: byId('stationList'),
  logicList: byId('logicList', 'rungs'),
  alarmList: byId('alarmList', 'alarms'),
  ioGrid: byId('ioGrid'),
  jam: [byId('jamStation1', 'jam1'), byId('jamStation2', 'jam2'), byId('jamStation3', 'jam3')],
  vac: [byId('vacFail1', 'vac1'), byId('vacFail2', 'vac2'), byId('vacFail3', 'vac3')]
};

if (el.startBtn) el.startBtn.onclick = () => { state.startPB = true; };
if (el.stopBtn) el.stopBtn.onclick = () => { state.stopPB = true; };
if (el.resetBtn) el.resetBtn.onclick = () => { state.resetPB = true; };
if (el.spawnBtn) el.spawnBtn.onclick = () => spawnProduct(state);
if (el.autoBtn) el.autoBtn.onclick = () => {
  state.autoMode = !state.autoMode;
  el.autoBtn.textContent = `AUTO MODE: ${state.autoMode ? 'ON' : 'OFF'}`;
};
if (el.estopBtn) el.estopBtn.onclick = () => {
  state.estopOK = !state.estopOK;
  el.estopBtn.textContent = state.estopOK ? 'E-STOP OK' : 'E-STOP OPEN';
  el.estopBtn.classList.toggle('tripped', !state.estopOK);
};

function syncFaults() {
  el.jam.forEach((box, i) => { state.faultInject.jam[i] = !!box?.checked; });
  el.vac.forEach((box, i) => { state.faultInject.vacuumFail[i] = !!box?.checked; });
}

function roundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function lamp(x, y, on, label) {
  ctx.beginPath();
  ctx.arc(x, y, 11, 0, Math.PI * 2);
  ctx.fillStyle = on ? '#ffd166' : '#4f5c70';
  ctx.fill();
  ctx.strokeStyle = '#1b2638';
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#a7b4c8';
  ctx.font = '10px Arial';
  ctx.fillText(label, x + 16, y + 4);
}

function bit(v) {
  return `<span class="bit ${v ? 'on' : ''}"></span>`;
}

function valueRow(name, value, cls = 'io-row') {
  const shown = typeof value === 'boolean' ? bit(value) : `<span>${value}</span>`;
  return `<div class="${cls}"><span class="io-tag">${name}</span>${shown}</div>`;
}

function drawBox(p) {
  ctx.textAlign = 'left';
  ctx.fillStyle = p.color || '#d9e6ff';
  ctx.strokeStyle = '#172033';
  ctx.lineWidth = 2;
  ctx.fillRect(p.x - 22, p.y - 16, 44, 32);
  ctx.strokeRect(p.x - 22, p.y - 16, 44, 32);
  ctx.fillStyle = '#172033';
  ctx.font = 'bold 12px Arial';
  ctx.fillText(`#${p.id}`, p.x - 12, p.y + 4);
  if (p.completedStations.length) {
    ctx.font = '10px Arial';
    ctx.fillText(p.completedStations.join(','), p.x - 8, p.y + 15);
  }
}

function drawConveyor(y, label) {
  ctx.fillStyle = '#263247';
  ctx.fillRect(70, y, 980, 34);
  ctx.strokeStyle = '#42536f';
  ctx.strokeRect(70, y, 980, 34);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#a7b4c8';
  ctx.font = '12px Arial';
  ctx.fillText(label, 70, y - 8);
  for (let x = 90; x < 1040; x += 42) {
    ctx.beginPath();
    ctx.arc(x, y + 17, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#6e7d92';
    ctx.fill();
    ctx.strokeStyle = '#b6c3d8';
    ctx.stroke();
  }
}

function drawStation(s) {
  const x = s.x;
  ctx.fillStyle = '#25334b';
  ctx.strokeStyle = '#5b6c8d';
  ctx.lineWidth = 3;
  roundedRect(x - 70, 70, 140, 108, 10);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ecf2ff';
  ctx.font = 'bold 18px Arial';
  ctx.fillText(s.name, x, 98);
  ctx.font = '12px monospace';
  ctx.fillStyle = '#a7b4c8';
  ctx.fillText(s.state, x, 122);
  ctx.fillText(`${s.cycles} cycles`, x, 145);

  ctx.strokeStyle = '#5b6c8d';
  ctx.beginPath();
  ctx.moveTo(x, 178);
  ctx.lineTo(x, 246);
  ctx.stroke();

  lamp(x - 44, 246, s.peBlocked, `PE ${s.index + 1}`);

  ctx.fillStyle = s.callForBox ? '#63a4ff' : '#4f5c70';
  ctx.fillRect(x - 48, 46, 24, 14);
  ctx.fillStyle = s.complete ? '#3bd179' : '#4f5c70';
  ctx.fillRect(x - 12, 46, 24, 14);
  ctx.fillStyle = s.outputs.pusher ? '#ffd166' : '#4f5c70';
  ctx.fillRect(x + 24, 46, 24, 14);

  if (s.outputs.pusher) {
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(x - 8, 178, 16, 92);
  }
}

function drawMachine() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawConveyor(160, 'TOP INFEED / CVP CONVEYOR');
  drawConveyor(270, 'BOTTOM TAKEAWAY CONVEYOR');
  lamp(75, 140, state.inputs['I:1/0 Infeed PE'], 'INFEED PE');
  lamp(1010, 250, state.inputs['I:1/4 Bottom Outfeed PE'], 'BOTTOM OUTFEED PE');
  state.stations.forEach(drawStation);
  state.products.forEach(drawBox);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#a7b4c8';
  ctx.font = '12px Arial';
  ctx.fillText('Blue=call for box   Green=complete   Yellow=pusher out / transfer to lower conveyor', 80, 340);
}

function renderIO() {
  const stationData = {};
  state.stations.forEach((s) => {
    stationData[s.name] = `${s.state} | call=${s.callForBox} complete=${s.complete} pusher=${s.outputs.pusher}`;
  });

  if (el.inputList) el.inputList.innerHTML = Object.entries(state.inputs).map(([k, v]) => valueRow(k, v)).join('');
  if (el.outputList) el.outputList.innerHTML = Object.entries(state.outputs).map(([k, v]) => valueRow(k, v)).join('');
  if (el.stationList) el.stationList.innerHTML = Object.entries(stationData).map(([k, v]) => valueRow(k, v)).join('');

  if (el.ioGrid) {
    const groups = [
      ['Inputs', state.inputs],
      ['Outputs', state.outputs],
      ['Stations', stationData]
    ];
    el.ioGrid.innerHTML = groups.map(([title, obj]) => {
      const tags = Object.entries(obj).map(([k, v]) => valueRow(k, v, 'tag')).join('');
      return `<div><h3>${title}</h3>${tags}</div>`;
    }).join('');
  }
}

function renderRungs() {
  const rows = [
    ['Master Run Latch', state.masterRunLatch],
    ['Permissive: E-stop OK', state.estopOK],
    ['Permissive: Auto Mode', state.autoMode],
    ['No Faults', !state.faults.any]
  ];
  state.stations.forEach((s, i) => {
    rows.push([`CVP ${i + 1} call for box`, s.callForBox]);
    rows.push([`CVP ${i + 1} cycle complete`, s.complete]);
    rows.push([`CVP ${i + 1} pusher extend`, s.outputs.pusher]);
  });
  if (el.logicList) {
    el.logicList.innerHTML = rows.map(([name, v]) => `<div class="logic-row"><span class="logic-tag">${name}</span>${bit(v)}</div>`).join('');
  }
}

function renderAlarms() {
  if (!el.alarmList) return;
  el.alarmList.innerHTML = state.alarms.length
    ? state.alarms.map(a => `<div class="alarm-row fault">${a.time}s — ${a.text}</div>`).join('')
    : '<div class="alarm-row info">No active alarm history</div>';
}

function renderStatus() {
  if (el.statusPill) {
    el.statusPill.textContent = state.faults.any ? 'FAULTED' : state.masterRunLatch ? 'RUNNING' : 'STOPPED';
    el.statusPill.classList.remove('running', 'faulted', 'stopped');
    el.statusPill.classList.add(state.faults.any ? 'faulted' : state.masterRunLatch ? 'running' : 'stopped');
  }
  if (el.scanInfo) el.scanInfo.textContent = `PLC Scan: ${state.scanMs} ms | Products: ${state.products.length}`;
}

function drawError(error) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffb4b4';
  ctx.font = '16px monospace';
  ctx.fillText('Simulator render error:', 30, 50);
  ctx.fillText(error.message || String(error), 30, 78);
}

function tick() {
  syncFaults();
  plcScan(state);
  drawMachine();
  renderIO();
  renderRungs();
  renderAlarms();
  renderStatus();
}

function safeTick() {
  try {
    tick();
  } catch (error) {
    console.error(error);
    drawError(error);
  }
}

spawnProduct(state);
spawnProduct(state);
setInterval(safeTick, state.scanMs);
safeTick();
