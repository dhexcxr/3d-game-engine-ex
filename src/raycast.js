// src/raycaster.js
import { brightness, viewWindow, CHAR_CACHE, WALL_TILE } from './main-io.js';
import { map } from './map.js';

export { raycaster };

const numWorkers = 4;
let workers = null;
let lastMapRef = null;

function initWorkers() {
	if (workers) return;
	workers = [];
	for (let i = 0; i < numWorkers; i++) {
		workers.push(new Worker('src/raycast-worker.js'));
	}
}

function sendMapToWorkers() {
	initWorkers();
	for (let i = 0; i < numWorkers; i++) {
		workers[i].postMessage({
			type: 'INIT_MAP',
			mapWidth: map.width,
			mapHeight: map.height,
			mapTiles: map.tiles,
			isCeilLight: map.isCeilLight,
			isFloorLight: map.isFloorLight,
			jitterMask: map.JITTER_MASK,
			jitterTableX: map.jitterTableX,
			jitterTableY: map.jitterTableY,
			textures: window.textures, // Shared global assets
			CHAR_CACHE,
			WALL_TILE,
			brightness
		});
	}
}

function raycaster(game, player) {
	initWorkers();

	// Automatically detect map/level changes and hot-sync workers
	if (lastMapRef !== map) {
		lastMapRef = map;
		sendMapToWorkers();
	}

	const totalWidth = viewWindow.width;
	const sliceWidth = Math.floor(totalWidth / numWorkers);
	const sliceHeight = Math.ceil(viewWindow.height);

	const promises = workers.map((worker, i) => {
		return new Promise((resolve) => {
			const startCol = i * sliceWidth;
			const endCol = (i === numWorkers - 1) ? totalWidth : (i + 1) * sliceWidth;
			const wWidth = endCol - startCol;

			// Allocate and transfer fresh buffers to the worker
			const sliceBuffer = new Uint16Array(sliceHeight * wWidth);
			const sliceDepthBuffer = new Float32Array(wWidth);

			worker.onmessage = (event) => {
				const { buffer, depthBuffer, visitedTiles } = event.data;

// TODO - replace this with a shared array so it doesn't need to copy things

				// 1. Copy computed sliced pixels into the main viewWindow.buffer
				for (let y = 0; y < sliceHeight; y++) {
					const srcRow = buffer.subarray(y * wWidth, (y + 1) * wWidth);
					viewWindow.buffer.set(srcRow, y * totalWidth + startCol);
				}

				// 2. Copy slice depths
					// regular array does not have this kind of set()
						// should we switch to TypedArray for this?
// 				viewWindow.depthBuffer.set(depthBuffer, startCol);
				viewWindow.depthBuffer.splice(startCol, depthBuffer.length, ...depthBuffer);

				// 3. Aggregate worker-specific visited tiles back into the map
				for (let j = 0; j < map.visitedTiles.length; j++) {
					if (visitedTiles[j] === game.currentFrame) {
						map.visitedTiles[j] = game.currentFrame;
					}
				}

				resolve();
			};

			worker.postMessage({
				type: 'RENDER_SLICE',
				startColumn: startCol,
				endColumn: endCol,
				buffer: sliceBuffer,
				depthBuffer: sliceDepthBuffer,
				playerX: player.x,
				playerY: player.y,
				playerAng: player.ang,
				playerViewX: player.viewX,
				playerViewY: player.viewY,
				playerBJumping: player.bJumping,
				playerBFalling: player.bFalling,
				currentFrame: game.currentFrame,
				animationTimer: game.animationTimer,
				fLooktimer: game.fLooktimer,
				nJumptimer: game.nJumptimer,
				viewHeight: viewWindow.height,
				viewSkew: viewWindow.skew,
				viewHalfHeight: viewWindow.halfHeight,
				viewPlaneX: viewWindow.planeX,
				viewPlaneY: viewWindow.planeY,
				viewNRenderMode: viewWindow.nRenderMode
			}, [sliceBuffer.buffer, sliceDepthBuffer.buffer]); // Transfer buffer ownership
		});
	});

	// Return a combined Promise that resolves when all 4 workers finish calculations
	return Promise.all(promises);
}
