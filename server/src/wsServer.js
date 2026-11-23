import crypto from "node:crypto";
import { WebSocketServer } from "ws";

const ALLOWED_TYPES = new Set(["join", "chat"]);

export function attachWebSocketServer(httpServer, rooms, config) {
	const wss = new WebSocketServer({
		server: httpServer,
		path: "/ws",
		maxPayload: config.maxPayloadBytes,
	});

	// Ping раз на 15 с; якщо пропущено >= 2 pong — розриваємо з'єднання
	const heartbeatTimer = setInterval(() => {
		for (const ws of wss.clients) {
			if (ws.missedPongs >= config.maxMissedPongs) {
				ws.terminate();
				continue;
			}
			ws.missedPongs = (ws.missedPongs ?? 0) + 1;
			ws.ping();
		}
	}, config.pingIntervalMs);

	wss.on("connection", (ws) => {
		ws.missedPongs = 0;
		ws.joinedRoom = null;
		ws.msgWindowStart = Date.now();
		ws.msgCountInWindow = 0;

		// Таймаут 5 с на надсилання першого повідомлення "join"
		const joinTimer = setTimeout(() => {
			if (!ws.joinedRoom) {
				ws.close(4001, "Join timeout (5s)");
			}
		}, config.joinTimeoutMs);

		ws.on("pong", () => {
			ws.missedPongs = 0;
		});

		ws.on("message", (data, isBinary) => {
			if (isBinary) {
				ws.close(1003, "Binary messages not supported");
				return;
			}

			// Перевірка розміру
			const byteLen = Buffer.byteLength(data);
			if (byteLen > config.maxPayloadBytes) {
				ws.close(1009, "Message too big");
				return;
			}

			// Rate limit: максимум N повідомлень за секунду
			const now = Date.now();
			if (now - ws.msgWindowStart >= 1000) {
				ws.msgWindowStart = now;
				ws.msgCountInWindow = 0;
			}
			ws.msgCountInWindow++;
			if (ws.msgCountInWindow > config.maxMsgPerSec) {
				ws.close(4008, "Rate limit exceeded");
				return;
			}

			// Валідація JSON та структури
			let msg;
			try {
				msg = JSON.parse(data.toString("utf8"));
			} catch {
				ws.close(1007, "Malformed JSON");
				return;
			}

			if (!msg || typeof msg !== "object" || typeof msg.type !== "string") {
				ws.close(1007, "Invalid message shape");
				return;
			}

			if (!ALLOWED_TYPES.has(msg.type)) {
				ws.close(4003, `Unknown message type: ${msg.type}`);
				return;
			}

			if (msg.type === "join") {
				if (ws.joinedRoom) {
					ws.close(4002, "Already joined");
					return;
				}
				if (typeof msg.roomId !== "string" || typeof msg.name !== "string") {
					ws.close(1007, "Invalid join payload");
					return;
				}
				const room = rooms.get(msg.roomId);
				if (!room) {
					ws.close(4004, "Room not found");
					return;
				}

				const player = {
					id: crypto.randomUUID().slice(0, 8),
					name: msg.name.trim().slice(0, 18) || "Pilot",
				};

				if (!room.addClient(ws, player)) {
					ws.close(4005, "Room is full");
					return;
				}

				clearTimeout(joinTimer);
				ws.joinedRoom = room;
				ws.send(
					JSON.stringify({
						type: "joined",
						player,
						room: room.toJSON(),
						players: [...room.clients.values()],
					}),
				);
				return;
			}

			if (msg.type === "chat") {
				if (!ws.joinedRoom) {
					ws.close(4001, "Must join before chat");
					return;
				}
				if (typeof msg.text !== "string") {
					ws.close(1007, "Invalid chat payload");
					return;
				}
				ws.joinedRoom.sendChat(ws, msg.text);
			}
		});

		ws.on("close", () => {
			clearTimeout(joinTimer);
			if (ws.joinedRoom) {
				ws.joinedRoom.removeClient(ws);
				ws.joinedRoom = null;
			}
		});

		ws.on("error", (err) => {
			console.error("[WS client] error:", err.message);
		});
	});

	wss.on("close", () => {
		clearInterval(heartbeatTimer);
	});

	return wss;
}