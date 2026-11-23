import "./style.css";
import { ARENA, STEP_HZ } from "./config.js";
import { createInput } from "./input.js";
import { createLoop } from "./loop.js";
import { createShip, integrate } from "./physics.js";
import { createRenderer } from "./render.js";

// ?mode=fixed|variable|interval  &block=<мс> (штучне навантаження в render)
const params = new URLSearchParams(location.search);
const mode = params.get("mode") ?? "fixed";
const blockMs = Number(params.get("block") ?? 0);

const canvas = document.querySelector("#game");
const hud = document.querySelector("#hud");

const input = createInput(window);
const renderer = createRenderer(canvas, ARENA);
let ship = createShip(ARENA.width / 2, ARENA.height / 2);

function busyWait(ms) {
	const end = performance.now() + ms;
	while (performance.now() < end) {
		/* блокуємо головний потік навмисно */
	}
}

const loop = createLoop({
	mode,
	stepHz: STEP_HZ,
	step(dt) {
		ship = integrate(ship, input.read(), dt, ARENA);
	},
	render(alpha) {
		if (blockMs) busyWait(blockMs);
		renderer.draw(ship, alpha, input.read().thrust);
	},
	onStats(s) {
		hud.textContent =
			`mode: ${mode}${blockMs ? ` (block ${blockMs}ms)` : ""}\n` +
			`steps/s: ${s.stepsPerSec.toFixed(1)}\n` +
			`frames/s: ${s.fps.toFixed(1)}\n` +
			`frame: ${s.avgFrameMs.toFixed(1)} ms (max ${s.maxFrameMs.toFixed(1)})`;
	},
});

loop.start();
