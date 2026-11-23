import { fetchJson } from "../assets/loader.js";

export class Lobby extends EventTarget {
	#timerId = null;
	#inFlightController = null;
	#active = false;

	constructor({
		roomsUrl = "/api/rooms.json",
		pollIntervalMs = 3000,
		timeoutMs = 2500,
	} = {}) {
		super();
		this.roomsUrl = roomsUrl;
		this.pollIntervalMs = pollIntervalMs;
		this.timeoutMs = timeoutMs;
		this.rooms = [];
	}

	start() {
		if (this.#active) return;
		this.#active = true;
		this.refresh();
		this.#timerId = setInterval(() => this.refresh(), this.pollIntervalMs);
	}

	stop() {
		this.#active = false;
		if (this.#timerId !== null) {
			clearInterval(this.#timerId);
			this.#timerId = null;
		}
		if (this.#inFlightController) {
			this.#inFlightController.abort("Player left lobby");
			this.#inFlightController = null;
		}
	}

	async refresh() {
		if (!this.#active) return;

		if (this.#inFlightController) {
			this.#inFlightController.abort("Superseded by newer poll");
		}
		const controller = new AbortController();
		this.#inFlightController = controller;

		try {
			const rooms = await fetchJson(this.roomsUrl, {
				signal: controller.signal,
				timeoutMs: this.timeoutMs,
			});
			if (!this.#active) return;
			this.rooms = rooms;
			this.dispatchEvent(new CustomEvent("rooms", { detail: { rooms } }));
		} catch (err) {
			if (err?.name === "AbortError") return;
			this.dispatchEvent(new CustomEvent("error", { detail: { error: err } }));
		} finally {
			if (this.#inFlightController === controller) {
				this.#inFlightController = null;
			}
		}
	}

	join(playerName, roomId) {
		const room = this.rooms.find((r) => r.id === roomId) ?? this.rooms[0];
		this.stop();
		this.dispatchEvent(
			new CustomEvent("joined", {
				detail: {
					playerName: playerName.trim() || "Commander",
					room,
				},
			}),
		);
	}
}
