export function createChatView(container, socketClient) {
	const box = document.createElement("div");
	box.style.cssText = `
		position: fixed; right: 16px; bottom: 16px; width: 300px;
		background: rgba(15, 23, 42, 0.85); border: 1px solid #334155;
		border-radius: 8px; padding: 10px; font-family: monospace;
		color: #e2e8f0; z-index: 15; display: flex; flex-direction: column; gap: 8px;
	`;

	box.innerHTML = `
		<div style="display:flex; justify-content:space-between; font-size:12px; color:#38bdf8;">
			<span id="chat-room-title">ROOM CHAT</span>
			<span id="chat-conn-status" style="color:#fbbf24;">connecting...</span>
		</div>
		<div id="chat-players" style="font-size:11px; color:#94a3b8;">Players: -</div>
		<div id="chat-log" style="height:140px; overflow-y:auto; font-size:12px; background:#020617; padding:6px; border-radius:4px; display:flex; flex-direction:column; gap:4px;"></div>
		<form id="chat-form" style="display:flex; gap:6px;">
			<input id="chat-input" type="text" placeholder="Message..." maxlength="200"
				style="flex:1; padding:6px; background:#020617; color:#f8fafc; border:1px solid #475569; border-radius:4px; font-family:monospace; font-size:12px;" />
			<button type="submit" style="padding:6px 10px; background:#0284c7; color:#fff; border:none; border-radius:4px; cursor:pointer;">Send</button>
		</form>
	`;

	container.appendChild(box);

	const titleEl = box.querySelector("#chat-room-title");
	const statusEl = box.querySelector("#chat-conn-status");
	const playersEl = box.querySelector("#chat-players");
	const logEl = box.querySelector("#chat-log");
	const formEl = box.querySelector("#chat-form");
	const inputEl = box.querySelector("#chat-input");

	function appendLine(text, color = "#e2e8f0") {
		const row = document.createElement("div");
		row.style.color = color;
		row.textContent = text;
		logEl.appendChild(row);
		logEl.scrollTop = logEl.scrollHeight;
	}

	function updatePlayers(players = []) {
		playersEl.textContent = `Players (${players.length}): ${players.map((p) => p.name).join(", ")}`;
	}

	// Зупиняємо спливання подій клавіатури з інпуту чату, щоб корабель не стріляв на Space
	inputEl.addEventListener("keydown", (e) => e.stopPropagation());
	inputEl.addEventListener("keyup", (e) => e.stopPropagation());

	formEl.addEventListener("submit", (e) => {
		e.preventDefault();
		const text = inputEl.value.trim();
		if (!text) return;
		socketClient.send({ type: "chat", text });
		inputEl.value = "";
	});

	socketClient.addEventListener("open", () => {
		statusEl.textContent = "online";
		statusEl.style.color = "#4ade80";
	});

	socketClient.addEventListener("reconnecting", (e) => {
		statusEl.textContent = `reconnecting (#${e.detail.attempt})...`;
		statusEl.style.color = "#fbbf24";
	});

	socketClient.addEventListener("close", (e) => {
		statusEl.textContent = `closed (${e.detail.code})`;
		statusEl.style.color = "#f87171";
	});

	socketClient.addEventListener("message", (e) => {
		const msg = e.detail;
		if (msg.type === "joined") {
			titleEl.textContent = msg.room.name;
			updatePlayers(msg.players);
			appendLine(`Ви увійшли в кімнату "${msg.room.name}"`, "#38bdf8");
		} else if (msg.type === "system") {
			if (msg.players) updatePlayers(msg.players);
			appendLine(`* ${msg.text}`, "#94a3b8");
		} else if (msg.type === "chat") {
			appendLine(`[${msg.from}]: ${msg.text}`, "#f8fafc");
		}
	});
}