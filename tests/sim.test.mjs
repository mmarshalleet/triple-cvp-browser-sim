import assert from 'node:assert/strict';
import { createInitialState, plcScan, spawnProduct } from '../src/plc.js';

function runScans(state, count) {
  for (let i = 0; i < count; i++) plcScan(state);
}

const state = createInitialState();
spawnProduct(state);
state.startPB = true;
plcScan(state);
assert.equal(state.masterRunLatch, true, 'start should latch master run');
runScans(state, 300);
assert.ok(state.stations.some(s => s.cycles > 0), 'at least one station should complete a cycle');

const faultState = createInitialState();
faultState.forcedFaults.jamStation1 = true;
faultState.startPB = true;
plcScan(faultState);
runScans(faultState, 170);
assert.equal(faultState.stations[0].fault, true, 'forced PE should create jam fault');
assert.equal(faultState.masterRunLatch, false, 'fault should drop run latch');

console.log('Simulation tests passed');
