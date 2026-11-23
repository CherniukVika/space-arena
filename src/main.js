import "./style.css";
import { ARENA, STEP_HZ } from "./config.js";
import { Asteroid } from "./entities/asteroid.js";
import { Ship } from "./entities/ship.js";
import { createInput } from "./input.js";
import { createLoop } from "./loop.js";
import { createRenderer } from "./render.js";
import { World } from "./world.js";

const params = new URLSearchParams(location.search);
const mode = params.get("mode") ?? "fixed";

const canvas = document.querySelector("#game");
const hud = document.querySelector("#hud");

const input = createInput(window);
const renderer = createRenderer(canvas, ARENA);

const world = new World(ARENA);
const player = world.spawn(new Ship(ARENA.width / 2, ARENA.height / 2));

for (let i = 0; i < 6; i++) {
	world.spawnEdgeAsteroid(player);
}

// Демонстрація правильної прив'язки this при разовому пострілі на KeyE:
// Якщо передати `window.addEventListener("keydown", player.fire)` — this буде window (помилка).
// Використовуємо стрілкову функцію або player.fire.bind(player, world).
const onQuickFire = (e) => {
	if (e.code === "KeyE") {
		player.fire(world);
	}
};
window.addEventListener("keydown", onQuickFire);

const loop = createLoop({
	mode,
	stepHz: STEP_HZ,
	step(dt) {
		world.step(dt, { input: input.read(), player });
	},
	render(alpha) {
		renderer.draw(world, player, alpha, input.read().thrust);
	},
	onStats(s) {
		const status = player.isAlive
			? `HP: ${"♥".repeat(player.hp)}`
			: "RESPAWNING...";
		hud.textContent =
			`SCORE: ${player.score} | ${status}\n` +
			`HOMING SHOTS: ${player.homingShots}\n` +
			`ENTITIES: ${world.size}\n` +
			`FPS: ${s.fps.toFixed(0)} | STEP: ${s.stepsPerSec.toFixed(0)} Hz`;
	},
});

loop.start();
