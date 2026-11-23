export function drawLoadingScreen(canvas, state) {
	const ctx = canvas.getContext("2d");
	const dpr = window.devicePixelRatio || 1;
	const w = canvas.clientWidth || 900;
	const h = canvas.clientHeight || 620;

	if (
		canvas.width !== Math.round(w * dpr) ||
		canvas.height !== Math.round(h * dpr)
	) {
		canvas.width = Math.round(w * dpr);
		canvas.height = Math.round(h * dpr);
	}

	ctx.save();
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

	ctx.fillStyle = "#060818";
	ctx.fillRect(0, 0, w, h);

	ctx.fillStyle = "#e2e8f0";
	ctx.font = "bold 24px monospace";
	ctx.textAlign = "center";
	ctx.fillText("SPACE ARENA — LOADING ASSETS", w / 2, h * 0.25);

	const barW = Math.min(480, w * 0.75);
	const barH = 22;
	const barX = (w - barW) / 2;
	const barY = h * 0.34;

	ctx.strokeStyle = "#475569";
	ctx.lineWidth = 2;
	ctx.strokeRect(barX, barY, barW, barH);

	const ratio = Math.max(0, Math.min(1, state.ratio ?? 0));
	ctx.fillStyle = state.error ? "#ef4444" : "#38bdf8";
	ctx.fillRect(barX + 2, barY + 2, (barW - 4) * ratio, barH - 4);

	ctx.fillStyle = "#94a3b8";
	ctx.font = "14px monospace";
	ctx.fillText(
		state.error
			? `Error: ${state.error}`
			: `Loaded ${state.done ?? 0} / ${state.total ?? 0} files (${Math.round(ratio * 100)}%)`,
		w / 2,
		barY + 46,
	);

	// Список прогресу по кожному файлу
	const items = state.items ?? [];
	ctx.textAlign = "left";
	ctx.font = "13px monospace";
	items.forEach((item, idx) => {
		const y = barY + 86 + idx * 24;
		const icon =
			item.status === "done"
				? "[OK]"
				: item.status === "loading"
					? "[..]"
					: "[  ]";
		ctx.fillStyle = item.status === "done" ? "#4ade80" : "#cbd5e1";
		ctx.fillText(`${icon} ${item.key} (${item.url})`, barX, y);
	});

	ctx.restore();
}
