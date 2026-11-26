# langit-nusantara

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Cenzer0/flight-game-26nov/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Cenzer0/flight-game-26nov/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Langit Nusantara — Kurir Langit is an original 2D chase-view flight game over an Indonesian archipelago. You fly a small prop courier plane from Pulau Bunga's runway, thread golden rings over a volcano island, terraced fields and reef islets, watch your fuel, and bring the mail home with a smooth landing.

Three sorties: **Surat untuk Pulau Bunga** (4 rings, gentle), **Penumpang Terakhir** (6 rings, tight fuel), and **Senja di Selat** (5 rings at dusk, crosswind). Rings pay up to 600 points, a smooth landing pays a bonus for soft touchdown, low speed and fuel left over.

## Run it

```sh
python3 -m http.server --directory game 8080
```

Then open http://localhost:8080 in desktop Chrome. Arrow keys pitch and bank, W/S work the throttle, hold the mouse button to steer with the pointer, P pauses, M mutes, R restarts. No build step, no network requests — every file the game loads lives under `game/`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=7gqwf76w&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
