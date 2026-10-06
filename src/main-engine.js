export {gameLoop};

import {_r, _rh} from './main-renderer.js';
import {player, move} from './player.js';
// import {raycaster} from './main-raycaster.js';		// single-threaded
import {raycaster} from './raycast.js';			// web worker raycasters
import {game} from './game.js';

import {_debugOutput} from './util.js';
import {registerOnResume} from './main-io.js'

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



// watchProp(game, 'timer');

const MAX_PHYS_FPS = 60;
const PHYSICS_STEP = 1 / MAX_PHYS_FPS; // Fixed step in seconds (~0.01667s)
const PHYSICS_STEP_MS = 1000 / MAX_PHYS_FPS; // Step in milliseconds (~16.67ms)
const MAX_ACCUMULATED_TIME = 250; // Safety cap (prevents "spiral of death" during long tab freezes)
// const FRAME_INTERVAL_MS = 1000 / MAX_PHYS_FPS;

registerOnResume(gameLoop);
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
		playerXDelta: 0,
		playerYDelta: 0,
		notMoving: 0
	};



	function gameLoop(){
//       _debugOutput('clear', 'debug2');
// 	  if (!viewWindow.isWindowActive || player.bPaused) return;

		game.timer = requestAnimationFrame(async (currentTime) => {
			// main requestAnimationFrame() logic stolen from https://www.aleksandrhovhannisyan.com/blog/javascript-game-loop/
			let rawDelta = currentTime - game.lastTime;
			game.lastTime = currentTime;

			if (rawDelta > MAX_ACCUMULATED_TIME) {
				rawDelta = MAX_ACCUMULATED_TIME;
			}

			const physRawDelta = currentTime - game.physLastTime;
			game.physAccumulator += rawDelta;

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
				// BUT NEXT - do flickering lights, https://share.google/aimode/uo1ZrZFtdbPwDjhI7
			// Consume time in fixed increments
			while (game.physAccumulator >= PHYSICS_STEP_MS) {

				physSmoothedDelta = (physSmoothedDelta * alpha) + (physRawDelta * (1 - alpha));			// Exponential Moving Average (EMA)
				const smoothedPhysFPS = 1000 / physSmoothedDelta;

				if (lastPlayerX - player.x === 0 && lastPlayerY - player.y === 0) {
					debug.notMoving += rawDelta;
					if (debug.notMoving >= 1000 * 1) {
						debug.playerXDelta = 0;
						debug.playerYDelta = 0;
						debug.notMoving = 0;
					}
				} else {
					debug.notMoving = 0;
				}
 
				debug.playerXDelta = [debug.playerXDelta, Math.round((lastPlayerX - player.x) / physSmoothedDelta * 1000000) / 1000].reduce((max, current) => Math.abs(current) > Math.abs(max) ? current : max);;
				debug.playerYDelta = [debug.playerYDelta, Math.round((lastPlayerY - player.y) / physSmoothedDelta * 1000000) / 1000].reduce((max, current) => Math.abs(current) > Math.abs(max) ? current : max);;

				_debugOutput(`PhysFPS: ${Math.round(smoothedPhysFPS)}; playerXDelta: ${debug.playerXDelta}; playerYDelta: ${debug.playerYDelta};
				physRawDelta: ${physRawDelta.toFixed(2)}; physSmoothedDelta: ${physSmoothedDelta.toFixed(2)};
				notMoving: ${Math.round(debug.notMoving)}; notMovCond: ${debug.notMoving >= 1000 * 3}`, 'debug');

				// DEBUG only
				lastPlayerX = player.x;
				lastPlayerY = player.y;

				// Synchronize next frame to arrive on time
				game.physLastTime = currentTime - (physRawDelta % PHYSICS_STEP);

				/**
				* Game-function related
				*/
				
				game.animationTimer++;				// here and renderer, and a commented out section of raycaster
				if (game.animationTimer > 60) {	// NOTE we can probably replace this with some kind of frame counter
					game.animationTimer = 0;
				}
				// TODO this needs to wait till the map is loaded before continuing on past here
				
				_r.updateSpriteBuffer(player.x, player.y);		// NOTE also, why do we sort the sprites and then move them?
				//       _r.moveSprites();		// DEBUG don't move sprites while I work on better render logic
				
				
				/**
				* Player-movement related
				*/
				
				if (player.bPlayerMoving()) {
					move(PHYSICS_STEP_MS);		// Always pass constant step
				}
				
				// normalize player angle		// this should probably be in io/movement
				if (player.ang < 0) {	// NOTE at one point i read about a more robust way to do this
					player.ang += +(Math.PI * 2.0);	// that protects against the possibility of the player angle
				}									// being more than 2 times Pi above 2*Pi
				if (player.ang > +(Math.PI * 2.0)) {	// its unlikely but probably good to use that logic
					player.ang -= +(Math.PI * 2.0);
				}
				
				// allows jumping for only a certain amount of time
				if(player.bJumping) {
					game.nJumptimer++
				}
				if(game.nJumptimer > 6) {
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

				game.physAccumulator -= PHYSICS_STEP_MS;
			}	// end of physics update

			/**
			* Drawing related
			*/
			
			// NOW NEXT, look into position interpolation
			await raycaster(game, player);
			
			_r.drawSprites(player, game.currentFrame, game.animationTimer);
			
			_r.fDrawFrame('', '', game.fLooktimer);
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


