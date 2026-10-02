export {game, player, memoize, gameLoop};

import {_rh} from './main-renderer.js';
import {_debugOutput, _mh, viewWindow} from './main-io.js';
import {raycaster} from './main-raycaster.js';
import {_r} from './main-renderer.js';

/**
 * Some Performance enhancers:
 *  - cache π, and various calculations involving π
 *    https://stackoverflow.com/questions/8885323/speed-of-the-math-object-in-javascript
 *
 *  - replace parseInt, Math.floor with bitwise NOT operator ~~
 *  - replace parseFloat with bitwise + operator
 *    https://stackoverflow.com/questions/38702724/math-floor-vs-math-trunc-javascript
 *
 *  - TODO: Inline more function calls in high-frequency loops
 *  - TODO: Limit Object Access in high-frequency loops
 */


const player = {
	x: 14.0,		// io, raycaster, and renderer
	y: 1.0,	// io, raycaster, and renderer
	ang: 1.5,		// used in io and renderer, probably could replace all of these with the playerX/Y vectors

	bTurnLeft: false,		// probably, these are only used in IO
	bTurnRight: false,
	bStrafeLeft: false,
	bStrafeRight: false,		// NOTE i don't like these being in here
	bMoveForward: false,
	bMoveBackward: false,
	bJumping: false,
	bFalling: false,
	bRunning: false,
	bPaused: false,
	bPlayerMayMoveForward: true,	// this is also used in renderer, when we determin if player is too close to sprite
	// NOTE oh, might should bPlayerMoving be in _mh?
	bPlayerMoving: function() {
		return (this.bTurnLeft || this.bTurnRight || this.bStrafeLeft || this.bStrafeRight
			|| (this.bMoveForward && this.bPlayerMayMoveForward) || this.bMoveBackward
			|| this.bJumping || this.bFalling || this.bRunning) && !this.bPaused
		},		// HERE, should probably move this into io, it's only used to determine if to call the _mh.move() function
							// i think i implemented this as a way to block movement when paused
							// but there's probably a better way to do that /in/ the io movement functions instead of the game loop
	get viewX() { return Math.cos(this.ang) },		// NOTE these are used all over the place for player movement, maybe share
	get viewY() { return Math.sin(this.ang) },	// NOTE this and the planeX/Y should probably be in renderer
};

const game = {
	timer: {},		// here and io, holds setInterval that controls game time/speed
	isRunning: false,
	currentFrame: 0, 	// here in main loop, raycaster, and renderer
	animationTimer: 0,		// here and renderer
	nJumptimer: 0,	// only HERE, but this should probably be moved into io....well is movement io or is it game logic?
	fLooktimer: 0,	// HERE in screen.skew (which should move), also in io and renderer			// eh first put it together in io, then we can decide to split that up
	lastTime: 0,
	physLastTime: 0,

	startRunning: true,		// DEBUG
};

// watchProp(game, 'timer');

const MAX_FPS = 60;
const FRAME_INTERVAL_MS = 1000 / MAX_FPS;

  /**
   * The basic game loop
   * main() called from io._testScreenSizeAndStartTheGame
   */
// let main = function() {

    game.lastTime = performance.now();
    let smoothedDelta = 10; // Initialize assuming ~30 FPS (1000ms / 60)
    let physSmoothedDelta = 10;
	const alpha = 0.9;         // Higher = smoother/slower, Lower = twitchier

	let lastPlayerX = player.x;
	let lastPlayerY = player.y;
	let debug = {
		xSpeed: 0,
		ySpeed: 0
	};


//     game.timer = setInterval(gameLoop, 33);		// default
// 	if (document.pointerLockElement || game.startRunning) {					// NOTE TODO most things rely on the frame rate
// // 		game.timer = setInterval(gameLoop, 33.333);		// (not the right way to do it)
// // 		requestAnimationFrame(gameLoop());
// 		gameLoop();
// 		game.isRunning = true;								// so at higher speed everything happens faster
// 	} else {												// TODO update to rely on time between ticks so we can speed this up
// //     	gameLoop();			// TODO run one of this so that we paint the first screen on startup, then wait for user click
// 	}							// FOLLOWUP - well, maybe not, without the one run is just starts on a blank screen, which is ok

	function gameLoop(){
//       _debugOutput('clear', 'debug2');
// 	  if (!viewWindow.isWindowActive || player.bPaused) return;

		game.timer = requestAnimationFrame((currentTime) => {
			// main requestAnimationFrame() logic stolen from https://www.aleksandrhovhannisyan.com/blog/javascript-game-loop/
	//		const currentTime = performance.now()
	  		const rawDelta = currentTime - game.lastTime;
			game.lastTime = currentTime;

			const physRawDelta = currentTime - game.physLastTime;

			// DEBUG stuff
	  		// Guard against edge cases (e.g., background tab pauses, heavy hitching)
	  		if (rawDelta > 0) {
				smoothedDelta = (smoothedDelta * alpha) + (rawDelta * (1 - alpha));			// Exponential Moving Average (EMA)
	  		}

	  		const smoothedFPS = 1000 / smoothedDelta;
	  		_debugOutput(`FPS: ${Math.round(smoothedFPS)}`, 'fps');
			// ^ debug only, end debug stuff


			game.currentFrame++;	// NOTE this might need to be done in the physics update, in the if() below

			// TODO look at accumulator pattern: https://gemini.google.com/app/d18c682a4a15f318
			if (physRawDelta >= FRAME_INTERVAL_MS) {

				physSmoothedDelta = (physSmoothedDelta * alpha) + (physRawDelta * (1 - alpha));			// Exponential Moving Average (EMA)
				const smoothedPhysFPS = 1000 / physSmoothedDelta;

				debug.xSpeed = Math.max(debug.xSpeed, Math.round((lastPlayerX - player.x) / physSmoothedDelta * 1000000) / 1000);
				debug.ySpeed = Math.max(debug.ySpeed, Math.round((lastPlayerY - player.y) / physSmoothedDelta * 1000000) / 1000);

				_debugOutput(`PhysFPS: ${Math.round(smoothedPhysFPS)}; xSpeed: ${debug.xSpeed}; ySpeed: ${debug.ySpeed};
				physRawDelta: ${Math.round(physRawDelta)}; physSmoothedDelta: ${Math.round(physSmoothedDelta)};`, 'debug');

				// DEBUG only
				lastPlayerX = player.x;
				lastPlayerY = player.y;

				// Synchronize next frame to arrive on time
				game.physLastTime = currentTime - (physRawDelta % FRAME_INTERVAL_MS);

				/**
				* Game-function related
				*/
				
				game.animationTimer++;				// here and renderer, and a commented out section of raycaster
				if(game.animationTimer > 15){
					game.animationTimer = 0;
				}
				// TODO this needs to wait till the map is loaded before continuing on past here
				
				_r.updateSpriteBuffer();		// NOTE also, why do we sort the sprites and then move them?
				//       _r.moveSprites();		// DEBUG don't move sprites while I work on better render logic
				
				
				/**
				* Player-movement related
				*/
				
				if (player.bPlayerMoving()) {
					_mh.move(player.viewX, player.viewY, physRawDelta);
				}
				
				// normalize player angle		// this should probably be in io/movement
				if (player.ang < 0) {	// NOTE at one point i read about a more robust way to do this
					player.ang += +(Math.PI * 2.0);	// that protects against the possibility of the player angle
				}									// being more than 2 times Pi above 2*Pi
				if (player.ang > +(Math.PI * 2.0)) {	// its unlikely but probably good to use that logic
					player.ang -= +(Math.PI * 2.0);
				}
				
				// allows jumping for only a certain amount of time
				if(player.bJumping){
					game.nJumptimer++
				}
				if( game.nJumptimer > 6 ){
					player.bFalling = true;
					player.bJumping = false;
					game.nJumptimer = 6;
				}
				
				// falling back down after jump
				if(player.bFalling){
					game.nJumptimer--;
				}
				if( game.nJumptimer < 1 ){
					player.bFalling = false;
				}

			}	// end of physics update

			/**
			* Drawing related
			*/
			
			
			// 		let doorStartAngle = 0;		// DEBUG only
			// 		let doorStartDist = 0;
			// 		let doorEndAngle = 0;		// DEBUG only
			// 		let doorEndDist = 0;
			// 		let prevTile = '';		// DEBUG only
			
			raycaster();
			
			_r.drawSprites();
			
			_r.fDrawFrame();
			// requestAnimationFrame(gameLoop());
			if (game.isRunning) {
				gameLoop();
			}
		});
	}

var gameEngineJS = function() {

  // setup variables
  let rayObs = new Array();		// DEBUG ONLY object to hold details of rays
  							// column, ray angle, height of wall	// RAYCASTER only
  class RayOb {
  	column = 0;
  	angle = 0;
  	wallDistance = 0;
  	wallHeight = 0;
  	ceilHeight = 0;
  	floorHeight = 0;
  	lookSkew = 0;
  	tileType = '';


  	constructor (column, angle, wallDistance, wallHeight, ceilRow, floorRow, lookSkew, tileType) {
  		this.column = column;
  		this.angle = angle;
  		this.wallDistance = wallDistance;
  		this.wallHeight = wallHeight;
  		this.ceilRow = ceilRow;
  		this.floorRow = floorRow;
  		this.lookSkew = lookSkew;
  		this.tileType = tileType;
  }

  	toString() {
  		return `Col: ${this.column}; RayAng: ${this.angle}; WallDist: ${this.wallDistance};
  		WallH: ${this.wallHeight}; CeilH: ${this.ceilRow}; FloorH: ${this.floorRow}
  		Skew: ${this.lookSkew}; Tile: ${this.tileType}`;
  	}
  }

  function printRayObs () {
  	rayObs.forEach(rayOb => console.log(rayOb.toString()));
  }

  return
}();		// NOTE why does this need to be an immediate or whatever this is called?
// util functions - could probably be a new module

// cheap/easy memoize from Google AI
	// it's own key resolver must be defined unless there is only one arg

/**
 * A fast, capped memoization function for game loops.
 *
 * @param {Function} fn - The function to memoize
 * @param {number} maxCacheSize - Max number of unique arguments to cache (LRU-like eviction)
 * @param {Function} resolver - Optional function to generate a strict cache key from arguments
 * @returns {Function} - The memoized function
 */
function memoize(fn, maxCacheSize = 100, resolver = null) {
    const cache = new Map();

    // Using a separate array to track keys allows us to implement
    // a lightweight eviction policy without heavy memory overhead.
    const keys = [];

  return function (...args) {
        // Generate a cache key. If a resolver is provided, use it.
        // Otherwise, assume the first argument is a primitive/key to avoid serialization.
        const key = resolver ? resolver(...args) : args[0];

    if (cache.has(key)) {
      return cache.get(key);
        }

        const result = fn(...args);

        if (cache.size >= maxCacheSize) {
            // Evict the oldest entry (FIFO) to keep memory footprint predictable
            const oldestKey = keys.shift();
            cache.delete(oldestKey);
        }

        keys.push(key);
      cache.set(key, result);
      return result;
  };
}

/**
 *
 * watch for changes in a property, can help add breakpoint whenever value changes
 *
 * @param {Object} obj - the object containing the property to watch
 * @param {String} prop - the name of the object property to watch, in string form
 *
 */
function watchProp(obj, prop) {
  let val = obj[prop];
  Object.defineProperty(obj, prop, {
    get: function() {
    	console.trace(`${prop} get, val: ${val}
    	trace:`)
    	return val;
    },
    set: function(newVal) {
      val = newVal;
//       console.log(`${prop} changed to:`, newVal);
//       debugger; // DevTools will break right here!
	  console.trace(`${prop} changed to: ${newVal}
	  trace:`);
    },
    configurable: true
  });
}

