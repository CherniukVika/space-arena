const MAP = {
	ArrowLeft: "left",
	KeyA: "left",
	ArrowRight: "right",
	KeyD: "right",
	ArrowUp: "thrust",
	KeyW: "thrust",
	Space: "fire",
	KeyF: "fire",
};

export function createInput(target = window) {
	const down = new Set();

	const onKeyDown = (e) => {
		const action = MAP[e.code];
		if (!action) return;
		e.preventDefault();
		down.add(action);
	};
	const onKeyUp = (e) => {
		const action = MAP[e.code];
		if (action) down.delete(action);
	};
	const onBlur = () => down.clear();

	target.addEventListener("keydown", onKeyDown);
	target.addEventListener("keyup", onKeyUp);
	window.addEventListener("blur", onBlur);

	return {
		read: () => ({
			left: down.has("left"),
			right: down.has("right"),
			thrust: down.has("thrust"),
			fire: down.has("fire"),
		}),
		dispose() {
			target.removeEventListener("keydown", onKeyDown);
			target.removeEventListener("keyup", onKeyUp);
			window.removeEventListener("blur", onBlur);
		},
	};
}
