import { Vector2 } from "../math/vector2.js";

/**
 * Поведінка «наведення» — НЕ клас-нащадок Entity.
 * Прикріплюється до кулі (або астероїда) як компонент.
 */
export class Homing {
	/**
	 * @param {object} opts
	 * @param {number} [opts.turnRate=3] — наскільки швидко повертає (рад/с)
	 * @param {number} [opts.maxSpeed=400]
	 * @param {string} [opts.targetKind='asteroid']
	 */
	constructor({ turnRate = 3, maxSpeed = 400, targetKind = "asteroid" } = {}) {
		this.turnRate = turnRate;
		this.maxSpeed = maxSpeed;
		this.targetKind = targetKind;
	}

	/**
	 * Змінює vel сутності в бік найближчої цілі.
	 * @param {import('../entities/entity.js').Entity} entity
	 * @param {import('../world.js').World} world
	 * @param {number} dt
	 */
	apply(entity, world, dt) {
		let nearest = null;
		let bestDist = Infinity;

		for (const t of world.ofKind(this.targetKind)) {
			if (t.dead) continue;
			const d = entity.pos.distanceTo(t.pos);
			if (d < bestDist) {
				bestDist = d;
				nearest = t;
			}
		}
		if (!nearest) return;

		const desired = nearest.pos
			.sub(entity.pos)
			.normalize()
			.scale(this.maxSpeed);
		const current = entity.vel;
		const diff = desired.sub(current);
		const maxChange = this.turnRate * this.maxSpeed * dt;
		const change =
			diff.length() > maxChange ? diff.normalize().scale(maxChange) : diff;

		entity.vel = current.add(change);
		// обмеження швидкості
		if (entity.vel.length() > this.maxSpeed) {
			entity.vel = entity.vel.normalize().scale(this.maxSpeed);
		}
	}
}
