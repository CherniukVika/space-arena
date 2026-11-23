import { Vector2 } from "../math/vector2.js";

/**
 * Коло-коло колізія (наївна).
 * @param {Vector2} aPos
 * @param {number} aR
 * @param {Vector2} bPos
 * @param {number} bR
 */
export function circleCircle(aPos, aR, bPos, bR) {
	const dx = aPos.x - bPos.x;
	const dy = aPos.y - bPos.y;
	const r = aR + bR;
	return dx * dx + dy * dy <= r * r;
}
