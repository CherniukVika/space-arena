/**
 * mode:
 *  "fixed"    — rAF + акумулятор (правильний варіант)
 *  "variable" — rAF, один step(dt) з реальним dt (експеримент 3)
 *  "interval" — setInterval замість rAF (експеримент 2)
 */
export function createLoop({
	step,
	render,
	onStats,
	mode = "fixed",
	stepHz = 60,
	maxFrameMs = 250,
}) {
	const dt = 1 / stepHz;
	let running = false;
	let handle = 0;
	let last = 0;
	let acc = 0;

	let steps = 0;
	let frames = 0;
	let sumMs = 0;
	let maxMs = 0;
	let statsStart = 0;

	function record(now, frameMs) {
		frames++;
		sumMs += frameMs;
		if (frameMs > maxMs) maxMs = frameMs;
		const elapsed = now - statsStart;
		if (elapsed >= 1000) {
			onStats?.({
				stepsPerSec: (steps * 1000) / elapsed,
				fps: (frames * 1000) / elapsed,
				avgFrameMs: sumMs / frames,
				maxFrameMs: maxMs,
			});
			steps = frames = sumMs = maxMs = 0;
			statsStart = now;
		}
	}

	function delta(now) {
		const ms = Math.max(0, now - last);
		last = now;
		return ms;
	}

	function rafFrame(now) {
		if (!running) return;
		handle = requestAnimationFrame(rafFrame);
		const frameMs = delta(now);
		const clamped = Math.min(frameMs, maxFrameMs) / 1000; // захист від «спіралі смерті»

		if (mode === "variable") {
			step(clamped);
			steps++;
			render(1);
		} else {
			acc += clamped;
			while (acc >= dt) {
				step(dt);
				acc -= dt;
				steps++;
			}
			render(acc / dt); // alpha ∈ [0,1) для інтерполяції
		}
		record(now, frameMs);
	}

	function intervalTick() {
		const now = performance.now();
		const frameMs = delta(now);
		step(dt);
		steps++;
		render(1);
		record(now, frameMs);
	}

	return {
		start() {
			if (running) return;
			running = true;
			last = statsStart = performance.now();
			acc = 0;
			handle =
				mode === "interval"
					? setInterval(intervalTick, 1000 / stepHz)
					: requestAnimationFrame(rafFrame);
		},
		stop() {
			running = false;
			if (mode === "interval") clearInterval(handle);
			else cancelAnimationFrame(handle);
		},
	};
}
