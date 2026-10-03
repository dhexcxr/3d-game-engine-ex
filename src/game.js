export {game};

const game = {
	timer: {},		// here and io, holds setInterval that controls game time/speed
	isRunning: false,
	currentFrame: 0, 	// here in main loop, raycaster, and renderer
	animationTimer: 0,		// here and renderer
	nJumptimer: 0,	// only HERE, but this should probably be moved into io....well is movement io or is it game logic?
	fLooktimer: 0,	// HERE in screen.skew (which should move), also in io and renderer			// eh first put it together in io, then we can decide to split that up
	lastTime: 0,
	physLastTime: 0,
	physAccumulator: 0,
	
	startRunning: true,		// DEBUG

};