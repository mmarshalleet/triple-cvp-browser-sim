export const STATION_NAMES = ['CVP 1', 'CVP 2', 'CVP 3'];

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
    lastState: 'IDLE'
  };
}

export function createInitialState() {
  return {
    scanMs: 50,
    simTime: 0,
    autoMode: true,
    startPB: false,
    stopPB: false,
    resetPB: false,
    estopOK: true,
    masterRunLatch: false,
    conveyorRun: false,
    alarmHistory: ['INFO: Simulator loaded'],
    products: [],
    nextProductId: 1,
    forcedFaults: {
      jamStation1: false,
      jamStation2: false,
      jamStation3: false,
      vacFail1: false,
      vacFail2: false,
      vacFail3: false
    },
    stations: [
      createStation(0, 310),
      createStation(1, 570),
      createStation(2, 830)
    ],
    sensors: {
      peInfeed: false,
      peCVP1: false,
      peCVP2: false,
      peCVP3: false,
      peOutfeed: false
    },
    outputs: {
      conveyorMotor: false,
      towerGreen: false,
      towerAmber: false,
      towerRed: false,
      horn: false,
      cvp1Clamp: false,
      cvp1Vacuum: false,
      cvp1Release: false,
      cvp2Clamp: false,
      cvp2Vacuum: false,
      cvp2Release: false,
      cvp3Clamp: false,
      cvp3Vacuum: false,
      cvp3Release: false
    },
    logic: []
  };
}

export function spawnProduct(state) {
  if (state.products.length > 18) return;
  state.products.push({
    id: state.nextProductId++,
    x: 35,
    width: 44,
    heldBy: null,
    doneStations: [],
    colorSeed: Math.random()
  });
}

function addAlarm(state, text, type = 'FAULT') {
  const line = `${type}: ${text}`;
  if (state.alarmHistory[0] !== line) {
    state.alarmHistory.unshift(line);
    state.alarmHistory = state.alarmHistory.slice(0, 12);
  }
}

function clearStationFaults(state) {
  for (const station of state.stations) {
    station.fault = false;
    station.faultText = '';
    station.jamTimer = 0;
    if (station.state === 'FAULT') {
      station.state = 'IDLE';
      station.productId = null;
      station.timer = 0;
      station.cycleTime = 0;
    }
  }
}

function productAtSensor(product, x) {
  return Math.abs(product.x - x) < 32;
}

function calculateSensors(state) {
  state.sensors.peInfeed = state.products.some(p => productAtSensor(p, 110));
  state.sensors.peCVP1 = state.products.some(p => productAtSensor(p, state.stations[0].x));
  state.sensors.peCVP2 = state.products.some(p => productAtSensor(p, state.stations[1].x));
  state.sensors.peCVP3 = state.products.some(p => productAtSensor(p, state.stations[2].x));
  state.sensors.peOutfeed = state.products.some(p => productAtSensor(p, 1030));

  if (state.forcedFaults.jamStation1) state.sensors.peCVP1 = true;
  if (state.forcedFaults.jamStation2) state.sensors.peCVP2 = true;
  if (state.forcedFaults.jamStation3) state.sensors.peCVP3 = true;

  for (const station of state.stations) {
    station.peBlocked = state.sensors[`peCVP${station.index + 1}`];
  }
}

function hasAnyFault(state) {
  return !state.estopOK || state.stations.some(s => s.fault);
}

function setStationOutputs(state) {
  for (const station of state.stations) {
    const prefix = `cvp${station.index + 1}`;
    state.outputs[`${prefix}Clamp`] = station.state === 'CLAMPING' || station.state === 'VACUUM';
    state.outputs[`${prefix}Vacuum`] = station.state === 'VACUUM';
    state.outputs[`${prefix}Release`] = station.state === 'RELEASING';
  }
}

function stationProduct(state, station) {
  return state.products.find(p => p.id === station.productId);
}

function findProductReadyForStation(state, station) {
  return state.products.find(product => {
    if (product.heldBy !== null) return false;
    if (product.doneStations.includes(station.index)) return false;
    return Math.abs(product.x - station.x) < 26;
  });
}

function scanStation(state, station, dt) {
  const vacuumFail = state.forcedFaults[`vacFail${station.index + 1}`];

  if (station.peBlocked && station.state === 'IDLE' && state.conveyorRun) {
    station.jamTimer += dt;
  } else if (station.state !== 'IDLE') {
    station.jamTimer = 0;
  } else {
    station.jamTimer = Math.max(0, station.jamTimer - dt * 2);
  }

  if (station.jamTimer > 8) {
    station.fault = true;
    station.faultText = `${station.name} photoeye blocked / jam timeout`;
    station.state = 'FAULT';
    addAlarm(state, station.faultText);
    return;
  }

  switch (station.state) {
    case 'IDLE': {
      const product = findProductReadyForStation(state, station);
      if (state.autoMode && state.masterRunLatch && product) {
        product.heldBy = station.index;
        product.x = station.x;
        station.productId = product.id;
        station.state = 'CLAMPING';
        station.timer = 0.55;
        station.cycleTime = 0;
      }
      break;
    }
    case 'CLAMPING': {
      station.timer -= dt;
      station.cycleTime += dt;
      const product = stationProduct(state, station);
      if (product) product.x = station.x;
      if (station.timer <= 0) {
        station.state = 'VACUUM';
        station.timer = 2.1;
      }
      break;
    }
    case 'VACUUM': {
      station.timer -= dt;
      station.cycleTime += dt;
      const product = stationProduct(state, station);
      if (product) product.x = station.x;
      if (vacuumFail && station.cycleTime > 1.4) {
        station.fault = true;
        station.faultText = `${station.name} vacuum not made`;
        station.state = 'FAULT';
        addAlarm(state, station.faultText);
        return;
      }
      if (station.timer <= 0) {
        station.state = 'RELEASING';
        station.timer = 0.45;
      }
      break;
    }
    case 'RELEASING': {
      station.timer -= dt;
      station.cycleTime += dt;
      const product = stationProduct(state, station);
      if (product) product.x = station.x;
      if (station.timer <= 0) {
        if (product) {
          product.doneStations.push(station.index);
          product.heldBy = null;
          product.x += 8;
        }
        station.cycles += 1;
        station.productId = null;
        station.state = 'IDLE';
        station.timer = 0;
        station.cycleTime = 0;
      }
      break;
    }
    case 'FAULT': {
      const product = stationProduct(state, station);
      if (product) product.x = station.x;
      break;
    }
  }
}

function moveProducts(state, dt) {
  if (!state.conveyorRun) return;

  const speed = 82;
  state.products.sort((a, b) => a.x - b.x);

  for (let i = 0; i < state.products.length; i++) {
    const product = state.products[i];
    if (product.heldBy !== null) continue;

    const next = state.products[i + 1];
    const proposed = product.x + speed * dt;
    const minGap = 55;

    if (next && next.x - proposed < minGap) {
      product.x = next.x - minGap;
    } else {
      product.x = proposed;
    }
  }

  state.products = state.products.filter(p => p.x < 1160);
}

function updateOutputs(state) {
  const fault = hasAnyFault(state);
  state.outputs.conveyorMotor = state.masterRunLatch && state.autoMode && !fault;
  state.outputs.towerGreen = state.outputs.conveyorMotor;
  state.outputs.towerAmber = state.masterRunLatch && !state.outputs.conveyorMotor && !fault;
  state.outputs.towerRed = fault;
  state.outputs.horn = fault;
  setStationOutputs(state);
}

function updateLogicMonitor(state) {
  const fault = hasAnyFault(state);
  state.logic = [
    { tag: 'Rung 000: EStop OK + Auto + Start seals MasterRunLatch', value: state.estopOK && state.autoMode && state.masterRunLatch },
    { tag: 'Rung 001: Stop PB or Fault unlatches MasterRunLatch', value: state.stopPB || fault, warn: fault },
    { tag: 'Rung 002: ConveyorMotor = MasterRunLatch AND Auto AND NoFault', value: state.outputs.conveyorMotor },
    { tag: 'Rung 003: CVP1 Sequence Active', value: state.stations[0].state !== 'IDLE' && state.stations[0].state !== 'FAULT' },
    { tag: 'Rung 004: CVP2 Sequence Active', value: state.stations[1].state !== 'IDLE' && state.stations[1].state !== 'FAULT' },
    { tag: 'Rung 005: CVP3 Sequence Active', value: state.stations[2].state !== 'IDLE' && state.stations[2].state !== 'FAULT' },
    { tag: 'Rung 006: Tower Red / Horn = Any Fault', value: fault, fault },
    { tag: 'Rung 007: Reset clears station faults when safe', value: state.resetPB && state.estopOK }
  ];
}

export function plcScan(state) {
  const dt = state.scanMs / 1000;
  state.simTime += dt;

  calculateSensors(state);

  const preFault = hasAnyFault(state);

  if (state.resetPB && state.estopOK) {
    clearStationFaults(state);
    addAlarm(state, 'Fault reset requested', 'INFO');
  }

  if (state.startPB && state.autoMode && state.estopOK && !preFault) {
    state.masterRunLatch = true;
  }

  if (state.stopPB || !state.estopOK || hasAnyFault(state)) {
    state.masterRunLatch = false;
  }

  updateOutputs(state);
  state.conveyorRun = state.outputs.conveyorMotor;

  for (const station of state.stations) scanStation(state, station, dt);

  if (hasAnyFault(state)) state.masterRunLatch = false;
  updateOutputs(state);
  state.conveyorRun = state.outputs.conveyorMotor;

  moveProducts(state, dt);
  calculateSensors(state);
  updateLogicMonitor(state);

  state.startPB = false;
  state.stopPB = false;
  state.resetPB = false;
}
