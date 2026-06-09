import assert from 'node:assert/strict';
import { createInitialState, plcScan, spawnProduct } from '../src/plc.js';

function runScans(state, count) {
  for (let i = 0; i < count; i++) plcScan(state);
}

const state = createInitialState();
state.startPB = true;
plcScan(state);
assert.equal(state.masterRunLatch, true, 'start should latch master run');
assert.ok(state.stations.every(s => s.callForBox), 'idle stations should call for boxes when running');

runScans(state, 520);
assert.ok(state.stations.some(s => s.cycles > 0), 'at least one station should complete a cycle');
assert.ok(state.products.some(p => p.lane === 'bottom' || p.completedStations.length > 0), 'completed box should transfer to bottom conveyor');

const pusherState = createInitialState();
spawnProduct(pusherState);
pusherState.startPB = true;
plcScan(pusherState);
runScans(pusherState, 120);
assert.ok(pusherState.stations.some(s => s.complete || s.outputs.pusher || s.cycles > 0), 'station should reach complete/pusher/cycled state');

const jamState = createInitialState();
jamState.startPB = true;
plcScan(jamState);
jamState.faultInject.jam[0] = true;
runScans(jamState, 70);
assert.equal(jamState.stations[0].fault, true, 'jam injection should fault station 1');
assert.equal(jamState.masterRunLatch, false, 'fault should drop master run latch');

const vacState = createInitialState();
spawnProduct(vacState);
vacState.startPB = true;
vacState.faultInject.vacuumFail[0] = true;
plcScan(vacState);
runScans(vacState, 160);
assert.equal(vacState.stations[0].fault, true, 'vacuum fail should fault station 1');

console.log('Simulation tests passed');
