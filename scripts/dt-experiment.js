import { createShip, integrate } from "../src/physics.js";

const BIG = { width: 1e9, height: 1e9 }; // без загортання
const hold = { left: false, right: false, thrust: true };

function start() {
	return { ...createShip(0, 0), angle: Math.PI / 2 }; // летимо вправо
}

function runFixed(dt, seconds = 3) {
	let s = start();
	const n = Math.round(seconds / dt);
	for (let i = 0; i < n; i++) s = integrate(s, hold, dt, BIG);
	return s;
}

function runJitter(seconds = 3) {
	let s = start();
	let t = 0;
	while (t < seconds) {
		const dt = Math.min(
			1 / 144 + Math.random() * (1 / 30 - 1 / 144),
			seconds - t,
		);
		s = integrate(s, hold, dt, BIG);
		t += dt;
	}
	return s;
}

for (const hz of [30, 60, 144, 240]) {
	const s = runFixed(1 / hz);
	console.log(
		`fixed ${String(hz).padStart(3)} Hz: x=${s.x.toFixed(3)}  vx=${s.vx.toFixed(3)}`,
	);
}
for (let i = 0; i < 3; i++) {
	const s = runJitter();
	console.log(
		`variable (random dt) #${i + 1}: x=${s.x.toFixed(3)}  vx=${s.vx.toFixed(3)}`,
	);
}
