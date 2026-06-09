export const STATION_NAMES = ['CVP 1', 'CVP 2', 'CVP 3'];

const TOP_Y = 184;
const BOTTOM_Y = 304;
const TOP_SPEED = 82;
const BOTTOM_SPEED = 115;
const MAX_PRODUCTS = 22;

export function createStation(index, x) {
  return {
    index,
    name: STATION_NAMES[index],
    x,
    state: 'IDLE',
    timer: 0,
    cycleTime: 0,
    productId: null,
    cycles: 0,
    fault: false,
    faultText: '',
    jamTimer: 0,
    peBlocked: false,
    callForBox: false,
    callSince: null,
    reservedProductId: null,
    complete: false,
    pusherExtended: false,
    outputs: { clamp: false, vacuum: false, release: false, pusher: false }
  };
}

export function createInitialState() {
  return {
    scanMs: 50,
    time: 0,
    nextProductId: 1,
    masterRunLatch: false,
    autoMode: true,
    estopOK: true,
    startPB: false,
    stopPB: false,
    resetPB: false,
    products: [],
    alarms: [],
    faults: { any: false },
    faultInject: { jam: [false, false, false], vacuumFail: [false, false, false] },
    inputs: {},
    outputs: {},
    stations: [createStation(0, 300), createStation(1, 560), createStation(2, 820)]
  };
}

export function spawnProduct(state) {
  if (state.products.length >= MAX_PRODUCTS) return null;
  const p = {
    id: state.nextProductId++,
    x: 50,
    y: TOP_Y,
    lane: 'top',
    assignedStation: null,
    heldBy: null,
    completedStations: [],
    color: '#d9e6ff'
  };
  state.products.push(p);
  return p;
}

function alarm(state, text) {
  if (!state.alarms.length || state.alarms[0].text !== text) {
    state.alarms.unshift({ time: (state.time / 1000).toFixed(1), text });
    state.alarms = state.alarms.slice(0, 12);
  }
}

function clearStation(station) {
  station.state = 'IDLE';
  station.timer = 0;
  station.productId = null;
  station.complete = false;
  station.pusherExtended = false;
  station.reservedProductId = null;
  station.outputs = { clamp: false, vacuum: false, release: false, pusher: false };
}

function stationProduct(state, station) {
  return state.products.find(p => p.id === station.productId);
}

function updateStationCalls(state) {
  for (const s of state.stations) {
    const wasCalling = s.callForBox;
    const canCall = state.masterRunLatch && !s.fault && s.state === 'IDLE';
    s.callForBox = canCall;

    if (s.callForBox && !wasCalling) s.callSince = state.time;
    if (!s.callForBox) {
      s.callSince = null;
      s.reservedProductId = null;
    }

    if (s.reservedProductId !== null) {
      const reservedBox = state.products.find(p => p.id === s.reservedProductId);
      const reservationStillValid = reservedBox && reservedBox.lane === 'top' && reservedBox.assignedStation === s.index;
      if (!reservationStillValid) s.reservedProductId = null;
    }
  }
}

function selectStationForProduct(state, product) {
  return state.stations
    .filter(s =>
      s.callForBox &&
      s.callSince !== null &&
      s.reservedProductId === null &&
      product.x < s.x - 18
    )
    .sort((a, b) => {
      if (a.callSince !== b.callSince) return a.callSince - b.callSince;
      return a.index - b.index;
    })[0] || null;
}

function assignCalls(state) {
  updateStationCalls(state);

  const availableProducts = state.products
    .filter(p => p.lane === 'top' && !p.heldBy && p.assignedStation === null)
    .sort((a, b) => b.x - a.x);

  for (const p of availableProducts) {
    const station = selectStationForProduct(state, p);
    if (!station) continue;
    p.assignedStation = station.index;
    station.reservedProductId = p.id;
  }
}

function scanStation(state, s, dt) {
  const pe = s.peBlocked || state.faultInject.jam[s.index];
  if (state.faultInject.jam[s.index] && state.masterRunLatch) s.jamTimer += dt;
  else s.jamTimer = 0;
  if (s.jamTimer > 2500) {
    s.fault = true;
    s.faultText = `${s.name} photoeye jam`; 
    alarm(state, s.faultText);
  }

  s.outputs.clamp = false;
  s.outputs.vacuum = false;
  s.outputs.release = false;
  s.outputs.pusher = false;

  if (!state.masterRunLatch || s.fault) return;

  const p = stationProduct(state, s);
  s.timer += dt;

  switch (s.state) {
    case 'IDLE':
      s.complete = false;
      s.pusherExtended = false;
      if (pe) {
        const box = state.products.find(pr => pr.lane === 'top' && pr.assignedStation === s.index && Math.abs(pr.x - s.x) < 28);
        if (box) {
          s.productId = box.id;
          s.reservedProductId = null;
          box.heldBy = s.index;
          box.x = s.x;
          s.state = 'CLAMPING';
          s.timer = 0;
        }
      }
      break;
    case 'CLAMPING':
      s.outputs.clamp = true;
      if (s.timer > 600) { s.state = 'VACUUM'; s.timer = 0; }
      break;
    case 'VACUUM':
      s.outputs.clamp = true;
      s.outputs.vacuum = true;
      if (state.faultInject.vacuumFail[s.index] && s.timer > 1400) {
        s.fault = true;
        s.faultText = `${s.name} vacuum not made`;
        alarm(state, s.faultText);
      } else if (s.timer > 1800) {
        s.state = 'COMPLETE';
        s.complete = true;
        s.cycleTime = state.time;
        s.timer = 0;
      }
      break;
    case 'COMPLETE':
      s.outputs.clamp = true;
      s.outputs.vacuum = true;
      if (s.timer > 500) { s.state = 'PUSHER_OUT'; s.timer = 0; }
      break;
    case 'PUSHER_OUT':
      s.outputs.pusher = true;
      s.pusherExtended = true;
      if (p) { p.x = s.x; p.y = TOP_Y + Math.min(120, s.timer * 0.13); }
      if (s.timer > 950) {
        if (p) {
          p.lane = 'bottom';
          p.y = BOTTOM_Y;
          p.heldBy = null;
          p.assignedStation = null;
          p.completedStations.push(s.index + 1);
          p.color = '#ffd166';
        }
        s.cycles++;
        s.state = 'RELEASING';
        s.timer = 0;
      }
      break;
    case 'RELEASING':
      s.outputs.release = true;
      if (s.timer > 650) clearStation(s);
      break;
  }
}

function moveProducts(state, dt) {
  const sec = dt / 1000;
  for (const p of state.products) {
    if (p.heldBy !== null) continue;
    if (!state.masterRunLatch) continue;
    if (p.lane === 'top') {
      const target = typeof p.assignedStation === 'number' ? state.stations[p.assignedStation].x : null;
      if (target && p.x >= target - 4) { p.x = target; continue; }
      p.x += TOP_SPEED * sec;
    } else {
      p.x += BOTTOM_SPEED * sec;
    }
  }
  state.products = state.products.filter(p => p.x < 1110);
  if (state.masterRunLatch && state.products.filter(p => p.lane === 'top').length < 2) spawnProduct(state);
}

function calcIO(state) {
  const near = (x, lane = 'top') => state.products.some(p => p.lane === lane && Math.abs(p.x - x) < 18);
  state.inputs = {
    'I:0/0 Start PB': state.startPB,
    'I:0/1 Stop PB': state.stopPB,
    'I:0/2 Reset PB': state.resetPB,
    'I:0/3 E-stop OK': state.estopOK,
    'I:0/4 Auto Mode': state.autoMode,
    'I:1/0 Infeed PE': near(75),
    'I:1/1 CVP 1 PE': near(300) || state.faultInject.jam[0],
    'I:1/2 CVP 2 PE': near(560) || state.faultInject.jam[1],
    'I:1/3 CVP 3 PE': near(820) || state.faultInject.jam[2],
    'I:1/4 Bottom Outfeed PE': near(1010, 'bottom')
  };
  state.stations.forEach((s, i) => s.peBlocked = state.inputs[`I:1/${i + 1} CVP ${i + 1} PE`]);
  state.outputs = {
    'O:Conveyor Motor': state.masterRunLatch,
    'O:Bottom Conveyor Motor': state.masterRunLatch,
    'O:Tower Green': state.masterRunLatch && !state.faults.any,
    'O:Tower Amber': !state.masterRunLatch && !state.faults.any,
    'O:Tower Red': state.faults.any
  };
  state.stations.forEach((s, i) => {
    const n = i + 1;
    state.outputs[`O:CVP${n} Call For Box`] = s.callForBox;
    state.outputs[`O:CVP${n} Complete`] = s.complete;
    state.outputs[`O:CVP${n} Clamp`] = s.outputs.clamp;
    state.outputs[`O:CVP${n} Vacuum`] = s.outputs.vacuum;
    state.outputs[`O:CVP${n} Pusher`] = s.outputs.pusher;
    state.outputs[`O:CVP${n} Release`] = s.outputs.release;
  });
}

export function plcScan(state) {
  const dt = state.scanMs;
  state.time += dt;

  if (state.resetPB) {
    for (const s of state.stations) {
      s.fault = false;
      s.faultText = '';
      s.jamTimer = 0;
      clearStation(s);
      s.callForBox = false;
      s.callSince = null;
    }
    state.alarms = [];
  }

  state.faults.any = state.stations.some(s => s.fault) || !state.estopOK;
  if (state.startPB && state.estopOK && state.autoMode && !state.faults.any) state.masterRunLatch = true;
  if (state.stopPB || !state.estopOK || state.faults.any) state.masterRunLatch = false;

  assignCalls(state);
  calcIO(state);
  for (const s of state.stations) scanStation(state, s, dt);
  moveProducts(state, dt);
  assignCalls(state);
  calcIO(state);

  state.startPB = false;
  state.stopPB = false;
  state.resetPB = false;
}
