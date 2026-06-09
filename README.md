# Triple CVP Conveyor Controls Program

A browser-based repo for a Triple CVP conveyor controls system with a working simulation, HMI-style controls, PLC-style scan logic, live I/O, station sequencing, and fault injection.

This is intentionally written in plain HTML/CSS/JavaScript so it can run on GitHub Pages without a backend, build step, or PLC software license.

## What it simulates

- Infeed conveyor moving products through three CVP stations
- CVP 1 / CVP 2 / CVP 3 station sequence
  - Product detected
  - Clamp
  - Vacuum cycle
  - Release
  - Product continues downstream
- Start / stop / reset / E-stop behavior
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

Option 1: open directly:

```bash
open index.html
```

Option 2: use a simple local server:

```bash
npm install
npm start
```

Then open the local URL shown in the terminal.

## Test simulation logic

```bash
npm test
```

The tests run the PLC scan loop and verify that:

- Start latches the system run bit
- A product can complete a CVP station cycle
- A forced photoeye jam creates a station fault
- A fault drops the master run latch

## GitHub Pages setup

1. Create a new GitHub repo.
2. Push these files.
3. Go to **Settings → Pages**.
4. Source: **Deploy from branch**.
5. Branch: `main` and folder `/root`.
6. Open the Pages URL GitHub gives you.

## Suggested repo name

```text
triple-cvp-browser-sim
```

## File layout

```text
triple-cvp-browser-sim/
├── index.html
├── package.json
├── README.md
├── src/
│   ├── app.js        # Browser UI, canvas drawing, HMI events
│   ├── plc.js        # PLC-style scan logic and machine simulation
│   └── styles.css    # HMI styling
└── tests/
    └── sim.test.mjs  # Node tests for core simulation behavior
```

## Controls map

| Simulated Device | Example Tag |
|---|---|
| Start PB | `I:0/0` |
| Stop PB | `I:0/1` |
| Reset PB | `I:0/2` |
| E-stop OK | `I:0/3` |
| Auto Mode | `I:0/4` |
| Infeed PE | `I:1/0` |
| CVP 1 PE | `I:1/1` |
| CVP 2 PE | `I:1/2` |
| CVP 3 PE | `I:1/3` |
| Outfeed PE | `I:1/4` |
| Conveyor Motor | `O:conveyorMotor` |
| Tower Red | `O:towerRed` |
| Tower Amber | `O:towerAmber` |
| Tower Green | `O:towerGreen` |
| CVP Clamp/Vacuum/Release | `O:cvp#Clamp`, `O:cvp#Vacuum`, `O:cvp#Release` |

## Control philosophy

The simulator uses a simple PLC-style scan:

1. Read inputs and calculated photoeyes
2. Process reset, start, stop, E-stop, and fault permissives
3. Update conveyor and station outputs
4. Scan each CVP station sequencer
5. Move simulated product positions
6. Recalculate sensors
7. Render the browser HMI

The station logic is intentionally readable so the project can be used as a teaching example for ladder logic, function block, or structured text discussions.

## Next improvements

- Add manual jog controls
- Add per-station bypass bits
- Add downstream blocked logic
- Export tag values as JSON
- Add Modbus/TCP or MQTT bridge for real controls training
- Add FactoryTalk-style display screens
- Add SLC/MicroLogix tag naming profile

## Safety note

This is a training simulator only. It is not safety-rated software and should not be used to control real equipment.
