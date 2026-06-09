import { createInitialState, plcScan, spawnProduct } from './plc.js';

const state = createInitialState();
const canvas = document.getElementById('machineCanvas');
const ctx = canvas.getContext('2d');

const el = {
  startBtn: document.getElementById('startBtn'),
  stopBtn: document.getElementById('stopBtn'),
  resetBtn: document.getElementById('resetBtn'),
  spawnBtn: document.getElementById('spawnBtn'),
  autoBtn: document.getElementById('autoBtn'),
  estopBtn: document.getElementById('estopBtn'),
  inputList: document.getElementById('inputList'),
  outputList: document.getElementById('outputList'),
  stationList: document.getElementById('stationList'),
  logicList: document.getElementById('logicList'),
  alarmList: document.getElementById('alarmList'),
  systemStatus: document.getElementById('systemStatus'),
  scanTime: document.getElementById('scanTime'),
  jamStation1: document.getElementById('jamStation1'),
  jamStation2: document.getElementById('jamStation2'),
  jamStation3: document.getElementById('jamStation3'),
  vacFail1: document.getElementById('vacFail1'),
  vacFail2: document.getElementById('vacFail2'),
  vacFail3: document.getElementById('vacFail3')
};

el.startBtn.addEventListener('click', () => { state.startPB = true; });
el.stopBtn.addEventListener('click', () => { state.stopPB = true; });
el.resetBtn.addEventListener('click', () => { state.resetPB = true; });
el.spawnBtn.addEventListener('click', () => spawnProduct(state));
el.autoBtn.addEventListener('click', () => {
  state.autoMode = !state.autoMode;
  if (!state.autoMode) state.masterRunLatch = false;
});
el.estopBtn.addEventListener('click', () => {
  state.estopOK = !state.estopOK;
  if (!state.estopOK) state.masterRunLatch = false;
});

for (const key of Object.keys(state.forcedFaults)) {
  el[key].addEventListener('change', event => {
    state.forcedFaults[key] = event.target.checked;
  });
}

function drawConveyor() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#0b111d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#2e384b';
  ctx.fillRect(70, 180, 980, 54);
  ctx.fillStyle = '#111722';
  ctx.fillRect(85, 194, 950, 24);

  for (let x = 90; x < 1040; x += 42) {
    ctx.beginPath();
    ctx.arc(x, 207, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#56657c';
    ctx.fill();
    ctx.strokeStyle = '#8290a5';
    ctx.stroke();
  }

  drawLabel(75, 155, 'INFEED PE', state.sensors.peInfeed);
  drawLabel(1005, 155, 'OUTFEED PE', state.sensors.peOutfeed);

  for (const station of state.stations) drawStation(station);
  for (const product of state.products) drawProduct(product);

  drawTowerLight(35, 35);
  drawLegend();
}

function drawStation(station) {
  const x = station.x;
  const y = 90;
  const active = station.state !== 'IDLE' && station.state !== 'FAULT';
  const fault = station.state === 'FAULT';

  ctx.fillStyle = fault ? '#7d1720' : active ? '#214f8a' : '#243149';
  ctx.strokeStyle = fault ? '#ff5e66' : active ? '#63a4ff' : '#46556d';
  ctx.lineWidth = 3;
  roundedRect(x - 70, y, 140, 110, 12, true, true);

  ctx.fillStyle = '#ecf2ff';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(station.name, x, y + 27);

  ctx.font = '13px Consolas';
  ctx.fillStyle = fault ? '#ffb3b7' : '#a7b4c8';
  ctx.fillText(station.state, x, y + 53);
  ctx.fillText(`Cycles: ${station.cycles}`, x, y + 76);
  if (station.timer > 0) ctx.fillText(`${station.timer.toFixed(1)}s`, x, y + 96);

  // Photoeye beam
  ctx.strokeStyle = station.peBlocked ? '#3bd179' : '#4f5c70';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, 165);
  ctx.lineTo(x, 245);
  ctx.stroke();

  drawLabel(x - 45, 255, `PE ${station.index + 1}`, station.peBlocked);
}

function drawProduct(product) {
  const y = 184;
  ctx.fillStyle = product.heldBy !== null ? '#ffd166' : '#d8e4f8';
  ctx.strokeStyle = '#111722';
  ctx.lineWidth = 2;
  roundedRect(product.x - product.width / 2, y, product.width, 46, 8, true, true);

  ctx.fillStyle = '#111722';
  ctx.font = 'bold 13px Consolas';
  ctx.textAlign = 'center';
  ctx.fillText(`#${product.id}`, product.x, y + 19);
  ctx.font = '11px Consolas';
  ctx.fillText(product.doneStations.map(i => i + 1).join('') || '-', product.x, y + 36);
}

function drawLabel(x, y, text, on) {
  ctx.fillStyle = on ? '#3bd179' : '#4f5c70';
  ctx.beginPath();
  ctx.arc(x, y + 4, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#a7b4c8';
  ctx.font = '12px Consolas';
  ctx.textAlign = 'left';
  ctx.fillText(text, x + 12, y + 8);
}

function drawTowerLight(x, y) {
  const lights = [
    ['RED', state.outputs.towerRed, '#ff5e66'],
    ['AMBER', state.outputs.towerAmber, '#ffd166'],
    ['GREEN', state.outputs.towerGreen, '#3bd179']
  ];
  ctx.fillStyle = '#202c40';
  roundedRect(x - 15, y - 10, 76, 118, 10, true, false);
  lights.forEach(([label, on, color], index) => {
    ctx.beginPath();
    ctx.arc(x + 20, y + 18 + index * 34, 12, 0, Math.PI * 2);
    ctx.fillStyle = on ? color : '#3b4659';
    ctx.fill();
    ctx.strokeStyle = '#0b111d';
    ctx.stroke();
    ctx.fillStyle = '#a7b4c8';
    ctx.font = '10px Consolas';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 38, y + 22 + index * 34);
  });
}

function drawLegend() {
  ctx.fillStyle = '#a7b4c8';
  ctx.font = '12px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('Product box shows completed station numbers. Yellow = held in station cycle.', 75, 325);
}

function roundedRect(x, y, w, h, r, fill, stroke) {
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
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function bitRow(tag, value, options = {}) {
  const cls = value ? options.fault ? 'bit fault' : options.warn ? 'bit warn' : 'bit on' : 'bit';
  return `<div class="io-row"><span class="io-tag">${tag}</span><span class="${cls}"></span></div>`;
}

function renderList() {
  el.inputList.innerHTML = [
    bitRow('I:0/0 Start PB', state.startPB),
    bitRow('I:0/1 Stop PB', state.stopPB),
    bitRow('I:0/2 Reset PB', state.resetPB),
    bitRow('I:0/3 E-Stop OK', state.estopOK),
    bitRow('I:0/4 Auto Mode', state.autoMode),
    bitRow('I:1/0 PE Infeed', state.sensors.peInfeed),
    bitRow('I:1/1 PE CVP1', state.sensors.peCVP1),
    bitRow('I:1/2 PE CVP2', state.sensors.peCVP2),
    bitRow('I:1/3 PE CVP3', state.sensors.peCVP3),
    bitRow('I:1/4 PE Outfeed', state.sensors.peOutfeed)
  ].join('');

  el.outputList.innerHTML = Object.entries(state.outputs)
    .map(([key, value]) => bitRow(`O:${key}`, value, { fault: key === 'towerRed' || key === 'horn' }))
    .join('');

  el.stationList.innerHTML = state.stations.map(station => {
    const value = station.state !== 'IDLE';
    return `<div class="io-row"><span class="io-tag">${station.name}</span><span>${station.state} | ${station.cycles} cycles</span><span class="${value ? station.fault ? 'bit fault' : 'bit on' : 'bit'}"></span></div>`;
  }).join('');

  el.logicList.innerHTML = state.logic.map(row => {
    const cls = row.value ? row.fault ? 'bit fault' : row.warn ? 'bit warn' : 'bit on' : 'bit';
    return `<div class="logic-row"><span class="logic-tag">${row.tag}</span><span class="${cls}"></span></div>`;
  }).join('');

  el.alarmList.innerHTML = state.alarmHistory.map(text => {
    const cls = text.startsWith('FAULT') ? 'alarm-row fault' : 'alarm-row info';
    return `<div class="${cls}">${text}</div>`;
  }).join('');
}

function renderStatus() {
  const fault = !state.estopOK || state.stations.some(s => s.fault);
  const running = state.outputs.conveyorMotor;
  const status = fault ? 'FAULTED' : running ? 'RUNNING' : 'STOPPED';
  el.systemStatus.textContent = status;
  el.systemStatus.className = `status-pill ${status.toLowerCase()}`;
  el.autoBtn.textContent = `AUTO MODE: ${state.autoMode ? 'ON' : 'OFF'}`;
  el.estopBtn.textContent = state.estopOK ? 'E-STOP OK' : 'E-STOP TRIPPED';
  el.estopBtn.classList.toggle('tripped', !state.estopOK);
  el.scanTime.textContent = `PLC Scan: ${state.scanMs} ms | Products: ${state.products.length}`;
}

function tick() {
  plcScan(state);
  drawConveyor();
  renderList();
  renderStatus();
}

spawnProduct(state);
spawnProduct(state);
setInterval(tick, state.scanMs);
requestAnimationFrame(drawConveyor);
