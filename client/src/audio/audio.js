export class AudioSystem {
	/**
	 * @param {AudioContext} ctx
	 * @param {Record<string, AudioBuffer>} buffers
	 * @param {import('../events/bus.js').GameBus} bus
	 */
	constructor(ctx, buffers, bus) {
		this.ctx = ctx;
		this.buffers = buffers;
		this.muted = false;

		bus.addEventListener("fired", () => this.play("fired", 0.35));
		bus.addEventListener("hit", () => this.play("hit", 0.5));
		bus.addEventListener("exploded", () => this.play("exploded", 0.65));
	}

	async unlock() {
		if (this.ctx.state === "suspended") {
			await this.ctx.resume();
		}
	}

	play(name, volume = 0.5) {
		if (this.muted) return;
		const buffer = this.buffers[name];
		if (!buffer) return;

		if (this.ctx.state === "suspended") {
			this.ctx.resume().catch(() => {});
		}

		const source = this.ctx.createBufferSource();
		source.buffer = buffer;

		const gain = this.ctx.createGain();
		gain.gain.value = volume;

		source.connect(gain);
		gain.connect(this.ctx.destination);
		source.start(0);
	}
}
