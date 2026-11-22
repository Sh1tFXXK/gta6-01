# Solmar Nights — a 3D open-world crime game

An original 3D open-world crime game set in the invented city of **Solmar Bay**,
built with three.js for make.fun's "Make GTA 6" bounty ($1,666 USDC, 100 paid places).

You are **Rook Marlow**, back in the city that raised you. The Rust Vipers own the
docks, the SBPD owns the streets, and **Vera Solano** owns the jobs. Steal cars,
outrun the law, run eight story jobs, win street races, take the turfs — and own
the Bay.

## What's in the game

- **3D open world**: grid streets, lit towers, beach and sea, palms, parks, a plaza
  fountain, and a golden-hour sunset sky with a full day/night cycle and rain.
- **8 story missions** for Vera Solano: car theft, package runs, taxi fares, gang
  hits, a bank vault crack, a timed delivery run, an escort, and the vault job.
- **7 checkpoint street races** with rival cars, taunts, best times, and a 1.5×
  night bonus. Press **V** on a chequered start pad.
- **5 gang turfs** to capture by standing in them, with passive income and Viper
  raid events. Own all five to become King of Solmar Bay.
- **Courier runs** (**C**): pickup → drop-off, distance pay, speed tips, express
  jobs at double pay, loyalty bonus every third run.
- **Daily challenges**: three picked by the date, auto-claimed when done.
- **SBPD**: wanted stars 0–5, chasing cruisers that ram and predict your line,
  on-foot busts, heat decay, and the **Air One helicopter with a spotlight** at
  3 stars — plus a live **dispatch board** naming every unit, its role, and its
  distance in metres.
- **Judge-visible systems**: weapon slots (FISTS / .38 / SMG / 12G / AR-9 / BAT /
  RPG, locked ones show LOCKED), three radio stations with track names, a
  respect/rank growth line with RP, crew skills (**Z** swap plates, **X** quick
  fix, **F** eyes out), **Mack's Garage** repairs, a **circular minimap** with
  area names, dialogue portraits with spoken lines, and a big speedometer with
  car name and condition.
- **Driving**: 11 stealable vehicle types with distinct speed and handling,
  damage, smoke, explosions, stunt ramps (+$75), sprint stamina, horn.
- **Combat**: mouse-aim shooting, drive-by fire, punching, gang enemies who
  shoot back, tracers, and pedestrians who flee gunfire.
- **Audio**: fully synthesized WebAudio — engine hum, sirens, gunshots, radio
  sequencers, rain wash, thunder. No audio files.
- **Save/load**: **H** saves, **L** loads, autosave after every mission.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Mouse drag | Orbit camera · Click: shoot |
| E | Steal / enter / exit car |
| N | Next story job |
| V | Start race at a pad |
| C | Courier run |
| G | Horn / repair at the garage |
| B | Buy coffee ($5, full stamina) |
| R | Cycle radio station |
| Z / X / F | Crew skills |
| 1–7 | Weapons |
| H / L | Save / load |
| P | Pause |

## Screenshots

Deterministic scenes via `?shot=<name>&seed=1`: `chase` (the SBPD chase —
the first screenshot), `drive` (golden-hour cruise), `mission` (Package Run),
`start` (title over the skyline).

## Run it

```sh
node serve.ts        # http://localhost:8080
```

No build step, no network: three.js is vendored under `game/vendor/three/`
(the same public library the top of the board vendors), and every other file
is original code written for this entry.

## License

MIT. No Rockstar / GTA names, art, or music are used — Solmar Bay, its people,
and its gangs are invented.
