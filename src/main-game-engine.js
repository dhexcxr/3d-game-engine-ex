export {game, brightness, main, player};

import {_rh} from './main-renderer.js';
import {_debugOutput, _mh, screen} from './main-io.js';
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


  // █
  // ▓
  // ▒
  // ░
  const brightness = ["&nbsp;", "&#9617;", "&#9618;", "&#9619;", "&#9608;"];

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
		(this.bTurnLeft || this.bTurnRight || this.bStrafeLeft || this.bStrafeRight
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
	currentFrame: 0, 	// here in main loop, raycaster, and renderer
	animationTimer: 0,		// here and renderer
	nJumptimer: 0,	// only HERE, but this should probably be moved into io....well is movement io or is it game logic?
	fLooktimer: 0,	// HERE in screen.skew (which should move), also in io and renderer			// eh first put it together in io, then we can decide to split that up
	nRenderMode: 2,	// used in renderer and raycaster, but the raycaster stuff should probably be moved into renderer

};



  /**
   * The basic game loop
   * main() called from io._testScreenSizeAndStartTheGame
   */
  let main = function(){
    game.timer = setInterval(gameLoop, 33);
    function gameLoop(){
//       _debugOutput('clear', 'debug2');

	  game.currentFrame++;

      /**
       * Game-function related
       */

      game.animationTimer++;				// here and renderer, and a commented out section of raycaster
      if(game.animationTimer > 15){
        game.animationTimer = 0;
      }

      _r.updateSpriteBuffer();		// NOTE also, why do we sort the sprites and then move them?
//       _r.moveSprites();		// DEBUG don't move sprites while I work on better render logic


      /**
       * Player-movement related
       */

	  if (player.bPlayerMoving()) {
	    player.move(player.viewX, player.viewY);
	  }

      // normalize player angle		// this should probably be in io/movement
      if (player.ang < 0){
        player.ang += +(Math.PI * 2.0);
      }
      if (player.ang > +(Math.PI * 2.0)){
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


      /**
       * Drawing related
       */


      // holds the frames we're going to send to the renderer
      var screenBuf = [];
      var spritescreen = [];
      var overlayscreen = [];


		let doorStartAngle = 0;		// DEBUG only
		let doorStartDist = 0;
		let doorEndAngle = 0;		// DEBUG only
		let doorEndDist = 0;
		let prevTile = '';		// DEBUG only


     // Converts player turn position into degrees (used for texturing)
//       nDegrees = ~~( player.ang * (180/Math.PI)) % 360;
// 	  _debugOutput(`nDegrees: ${nDegrees}`, 'debug2');


      raycaster();

	  _r.drawSprites();

      _r.fDrawFrame(screen, false);

    }
  };

var gameEngineJS = function(){


  // setup variables


//   var fFOV = Math.PI / 2.25; // (Math.PI / 4.0 originally)	// not used

//   const screenProjection = (screen.width / 2) / Math.tan(fFOV / 2);

  // defaults
//   var nDegrees = 0;


//   var nMapHeight = 16;	// here, raycaster, and io
//   var nMapWidth = 16;
  var map = "";		// io, raycaster, and renderer



//   let printedScreenRays = false;	// NOT used
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

  return // {
//     init: init,
//   }
}();		// NOTE why does this need to be an immediate or whatever this is called?
