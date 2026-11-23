import { EventEmitter } from "node:events";
import { WebSocket } from "ws";
import { MatchLogger } from "./logger.js";

export class Room extends EventEmitter {
	constructor({ id, name, maxPlayers = 8, arena, logsDir, maxBufferedBytes = 65536 }) {
		super();
		this.id = id;
		this.name = name;
		this.maxPlayers = maxPlayers;
		this.arena = arena ?? { width: 900, height: 620, asteroidCount: 6 };
		this.maxBufferedBytes = maxBufferedBytes;
		/** @type {Map<WebSocket, { id: string, name: string }>} */
		this.clients = new Map();
		this.logger = new MatchLogger(logsDir, id);

		// Захист від падіння процесу при події "error" без слухача
		this.on("error", (err) => {
			console.error(`[Room:${this.id}] error:`, err.message);
		});
	}

	get playerCount() {
		return this.clients.size;
	}

	toJSON() {
		return {
			id: this.id,
			name: this.name,
			players: this.clients.size,
			maxPlayers: this.maxPlayers,
			arena: this.arena,
		};
	}

	addClient(ws, player) {
		if (this.clients.size >= this.maxPlayers) {
			return false;
		}
		this.clients.set(ws, player);
		this.logger.log({ type: "join", roomId: this.id, player });

		this.broadcast({
			type: "system",
			text: `${player.name} приєднався до кімнати`,
			players: [...this.clients.values()],
		});
		return true;
	}

	removeClient(ws) {
		const player = this.clients.get(ws);
		if (!player) return;

		this.clients.delete(ws);
		this.logger.log({ type: "leave", roomId: this.id, player });

		if (this.clients.size === 0) {
			this.emit("empty", this);
		} else {
			this.broadcast({
				type: "system",
				text: `${player.name} вийшов із кімнати`,
				players: [...this.clients.values()],
			});
		}
	}

	sendChat(ws, text) {
		const player = this.clients.get(ws);
		if (!player) return;
		const cleanText = text.trim().slice(0, 300);
		if (!cleanText) return;

		const payload = {
			type: "chat",
			from: player.name,
			playerId: player.id,
			text: cleanText,
			ts: Date.now(),
		};
		this.logger.log({ ...payload, roomId: this.id });
		this.broadcast(payload);
	}

	broadcast(message) {
		const raw = JSON.stringify(message);
		for (const [ws, player] of this.clients) {
			if (ws.readyState !== WebSocket.OPEN) continue;

			// Backpressure на WS: якщо у клієнта росте bufferedAmount — не перевантажуємо його
			if (ws.bufferedAmount > this.maxBufferedBytes) {
				console.warn(
					`[Room:${this.id}] dropping frame for slow client ${player.name} (bufferedAmount=${ws.bufferedAmount})`,
				);
				continue;
			}
			ws.send(raw);
		}
	}

	async destroy() {
		await this.logger.close();
	}
}