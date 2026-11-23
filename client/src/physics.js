export const SHIP = { turnSpeed: 3.5, thrust: 220, drag: 0.6 };

export function createShip(x, y) {
	return { x, y, vx: 0, vy: 0, angle: 0, prevX: x, prevY: y, prevAngle: 0 };
}

const wrap = (v, max) => ((v % max) + max) % max;

/**
 * Чиста функція: не змінює аргументи, не читає DOM/час.
 * angle = 0 — ніс вгору; вісь Y напрямлена вниз.
 */
export function integrate(ship, input, dt, arena) {
	const turn = (input.right ? 1 : 0) - (input.left ? 1 : 0);
	const angle = ship.angle + turn * SHIP.turnSpeed * dt;

	const a = input.thrust ? SHIP.thrust : 0;
	let vx = ship.vx + Math.sin(angle) * a * dt;
	let vy = ship.vy - Math.cos(angle) * a * dt;

	const k = Math.exp(-SHIP.drag * dt); // опір, незалежний від dt
	vx *= k;
	vy *= k;

	return {
		x: wrap(ship.x + vx * dt, arena.width),
		y: wrap(ship.y + vy * dt, arena.height),
		vx,
		vy,
		angle,
		prevX: ship.x,
		prevY: ship.y,
		prevAngle: ship.angle,
	};
}
