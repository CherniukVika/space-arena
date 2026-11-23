export class SocketClient extends EventTarget {
	#url;
	#ws = null;
	#queue = [];
	#attempt = 0;
	#closedByUser = false;
	#reconnectTimer = null;
	#lastJoinPayload = null;

	constructor(url) {
		super();
		this.#url = url;
	}

	connect() {
		this.#closedByUser = false;
		this.#openSocket();
	}

	#openSocket() {
		if (this.#closedByUser) return;
		const ws = new WebSocket(this.#url);
		this.#ws = ws;

		ws.addEventListener("open", () => {
			this.#attempt = 0;
			this.dispatchEvent(new CustomEvent("open"));

			// Якщо це перепідключення — автоматично перезаходимо в ту саму кімнату
			if (this.#lastJoinPayload) {
				ws.send(JSON.stringify(this.#lastJoinPayload));
			}

			// Відправляємо накопичену чергу повідомлень
			while (this.#queue.length > 0 && ws.readyState === WebSocket.OPEN) {
				ws.send(this.#queue.shift());
			}
		});

		ws.addEventListener("message", (e) => {
			try {
				const msg = JSON.parse(e.data);
				this.dispatchEvent(new CustomEvent("message", { detail: msg }));
			} catch {
				// ігноруємо невалідний JSON
			}
		});

		ws.addEventListener("close", (e) => {
			this.dispatchEvent(
				new CustomEvent("close", { detail: { code: e.code, reason: e.reason } }),
			);
			if (!this.#closedByUser) {
				this.#scheduleReconnect();
			}
		});

		ws.addEventListener("error", () => {
			// close спрацює слідом і запустить reconnect
		});
	}

	#scheduleReconnect() {
		const delay = Math.min(10000, 500 * 2 ** this.#attempt + Math.random() * 300);
		this.#attempt++;
		this.dispatchEvent(
			new CustomEvent("reconnecting", { detail: { attempt: this.#attempt, delayMs: delay } }),
		);
		this.#reconnectTimer = setTimeout(() => this.#openSocket(), delay);
	}

	send(obj) {
		if (obj.type === "join") {
			this.#lastJoinPayload = obj;
		}
		const raw = JSON.stringify(obj);
		if (this.#ws && this.#ws.readyState === WebSocket.OPEN) {
			this.#ws.send(raw);
		} else {
			this.#queue.push(raw);
		}
	}

	close() {
		this.#closedByUser = true;
		if (this.#reconnectTimer) {
			clearTimeout(this.#reconnectTimer);
			this.#reconnectTimer = null;
		}
		this.#ws?.close(1000, "Client closed");
	}
}