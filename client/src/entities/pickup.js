import { Entity } from "./entity.js";

/**
 * Pickup — стоїть на місці, колізиться, дає бонус.
 * Не є кораблем і не наслідує Ship — чиста композиція/окрема сутність.
 */
export class Pickup extends Entity {
	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {'score' | 'homing' | 'heal'} [type='score']
	 */
	constructor(x, y, type = "score") {
		super({ x, y, vx: 0, vy: 0, radius: 12, kind: "pickup" });
		this.pickupType = type;
		this.bobPhase = Math.random() * Math.PI * 2;
	}

	update(dt) {
		this.prevPos = this.pos.clone();
		this.bobPhase += dt * 3;
		// легкий «поплавок» по Y для краси (візуально в render)
	}
}
