export function createLobbyView(container, lobby) {
	const panel = document.createElement("div");
	panel.id = "lobby-overlay";
	panel.style.cssText = `
		position: fixed; inset: 0; display: none; align-items: center; justify-content: center;
		background: rgba(4, 6, 18, 0.88); font-family: monospace; color: #e2e8f0; z-index: 20;
	`;

	panel.innerHTML = `
		<div style="background:#0f172a; border:1px solid #334155; padding:24px; border-radius:8px; width:420px; max-width:92vw;">
			<h2 style="margin:0 0 14px; color:#38bdf8;">SPACE ARENA — LOBBY</h2>
			<label style="display:block; margin-bottom:12px;">
				<div style="margin-bottom:4px; color:#94a3b8;">Pilot Name:</div>
				<input id="lobby-name" type="text" value="Vika" maxlength="18"
					style="width:100%; box-sizing:border-box; padding:8px; background:#020617; color:#f8fafc; border:1px solid #475569; border-radius:4px;" />
			</label>
			<div style="margin-bottom:6px; color:#94a3b8;">Select Room:</div>
			<div id="lobby-rooms" style="display:flex; flex-direction:column; gap:8px; margin-bottom:14px;"></div>
			<div id="lobby-status" style="font-size:12px; color:#94a3b8; margin-bottom:14px;">Loading rooms...</div>
			<button id="lobby-join" type="button"
				style="width:100%; padding:10px; background:#0284c7; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">
				JOIN ARENA
			</button>
		</div>
	`;

	container.appendChild(panel);

	const nameInput = panel.querySelector("#lobby-name");
	const roomsBox = panel.querySelector("#lobby-rooms");
	const statusBox = panel.querySelector("#lobby-status");
	const joinBtn = panel.querySelector("#lobby-join");

	let selectedRoomId = null;

	lobby.addEventListener("rooms", (e) => {
		const { rooms } = e.detail;
		if (!selectedRoomId && rooms.length > 0) {
			selectedRoomId = rooms[0].id;
		}
		roomsBox.innerHTML = "";
		for (const r of rooms) {
			const label = document.createElement("label");
			label.style.cssText =
				"display:flex; justify-content:space-between; align-items:center; padding:8px; border:1px solid #334155; border-radius:4px; cursor:pointer; background:#020617;";
			label.innerHTML = `
				<span>
					<input type="radio" name="room" value="${r.id}" ${r.id === selectedRoomId ? "checked" : ""} />
					<strong>${r.name}</strong>
				</span>
				<span style="color:#38bdf8;">${r.players}/${r.maxPlayers}</span>
			`;
			label.querySelector("input").addEventListener("change", () => {
				selectedRoomId = r.id;
			});
			roomsBox.appendChild(label);
		}
		statusBox.textContent = `Updated at ${new Date().toLocaleTimeString()} (auto-refresh 3s)`;
		statusBox.style.color = "#4ade80";
	});

	lobby.addEventListener("error", (e) => {
		statusBox.textContent = `Room fetch failed: ${e.detail.error.message}`;
		statusBox.style.color = "#f87171";
	});

	joinBtn.addEventListener("click", () => {
		lobby.join(nameInput.value, selectedRoomId);
	});

	return {
		show() {
			panel.style.display = "flex";
		},
		hide() {
			panel.style.display = "none";
		},
	};
}
