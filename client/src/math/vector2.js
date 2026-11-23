/**
 * Незмінний (immutable) 2D-вектор.
 * Методи не мутують ні this, ні аргументи — повертають новий Vector2.
 */
export class Vector2 {
	constructor(x = 0, y = 0) {
		this.x = x;
		this.y = y;
	}

	/** @returns {Vector2} */
	add(v) {
		return new Vector2(this.x + v.x, this.y + v.y);
	}

	/** @returns {Vector2} */
	sub(v) {
		return new Vector2(this.x - v.x, this.y - v.y);
	}

	/** @returns {Vector2} */
	scale(s) {
		return new Vector2(this.x * s, this.y * s);
	}

	/** @returns {number} */
	length() {
		return Math.hypot(this.x, this.y);
	}

	/** @returns {Vector2} */
	normalize() {
		const len = this.length();
		if (len < 1e-8) return new Vector2(0, 0);
		return this.scale(1 / len);
	}

	/** Відстань до іншого вектора (не мутує). */
	distanceTo(v) {
		return this.sub(v).length();
	}

	/**
	 * Вектор з кута (0 = вгору, як у Lab 1) і довжини.
	 * @param {number} angle — радіани
	 * @param {number} [length=1]
	 */
	static fromAngle(angle, length = 1) {
		return new Vector2(Math.sin(angle) * length, -Math.cos(angle) * length);
	}

	clone() {
		return new Vector2(this.x, this.y);
	}
}
