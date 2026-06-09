# Triple CVP Conveyor Controls Program

A browser-based repo for a Triple CVP conveyor controls system with a working simulation, HMI-style controls, PLC-style scan logic, live I/O, station sequencing, and fault injection.

This project is written in plain HTML, CSS, and JavaScript so it can run on GitHub Pages without a backend or build step.

## What it simulates

- Infeed conveyor moving products through three CVP stations
- CVP 1 / CVP 2 / CVP 3 station sequence
- Start, stop, reset, and E-stop behavior
- Auto mode permissive
- Conveyor motor output
- Tower light outputs
- Photoeye inputs
- Station clamps, vacuum, and release outputs
- Jam faults
- Vacuum-not-made faults
- Alarm history
- PLC-style rung monitor

## Run locally

Open index.html directly, or run npm install and npm start, then open the local URL shown in the terminal.

## Test simulation logic

Run npm test.

The tests run the PLC scan loop and verify that start latches the system run bit, a product can complete a CVP station cycle, a forced photoeye jam creates a station fault, and a fault drops the master run latch.

## File layout

- index.html
- package.json
- README.md
- src/app.js: Browser UI, canvas drawing, and HMI events
- src/plc.js: PLC-style scan logic and machine simulation
- src/styles.css: HMI styling
- tests/sim.test.mjs: Node tests for core simulation behavior

## Control philosophy

The simulator uses a simple PLC-style scan: read inputs, process permissives, update outputs, scan each station sequencer, move product positions, recalculate sensors, and render the browser HMI.

The station logic is intentionally readable so the project can be used as a teaching example for ladder logic, function block, or structured text discussions.
