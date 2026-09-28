import {_rh} from './main-renderer.js';
import {_loadLevel, _debugOutput, _mh} from './main-io.js';
import {raycaster} from './main-raycaster.js';

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

var gameEngineJS = (function(){

  let isWindowActive = document.visibilityState === 'visible' && document.hasFocus();

  // Update status when the user switches tabs or minimizes the window
  document.addEventListener('visibilitychange', () => {
    isWindowActive = document.visibilityState === 'visible' && document.hasFocus();
  });

  // Update status when the window gains or loses OS focus
  window.addEventListener('focus', () => {
    isWindowActive = document.visibilityState === 'visible' && document.hasFocus();
  });

  window.addEventListener('blur', () => {
    isWindowActive = false;
  });

  // constants
  const PI___    = +(Math.PI);
  const PI_0     = 0.0;
  const PIx0_25  = +(PI___ * 0.25);
  const PIx05    = +(PI___ * 0.5);
  const PIx0_75  = +(PI___ * 0.75);
  const PIx1     = PI___;
  const PIx1_5   = +(PI___ * 1.5);
  const PIx2     = +(PI___ * 2.0);
  const I80divPI = (180/PI___)
  const PIdiv4   = PI___ / 4.0

  // setup variables
  var eScreen;
  var eDebugOut;

  var nScreenWidth = 320;
  var nScreenHeight = 80;
  let nScreenCenter = nScreenWidth / 2;

  var fFOV = PI___ / 2.25; // (PI___ / 4.0 originally)

//   const screenProjection = (nScreenWidth / 2) / Math.tan(fFOV / 2);

  var fDepth = 16.0; // viewport depth
  var nLookLimit = 8;

  var bTurnLeft;
  var bTurnRight;
  var bStrafeLeft;
  var bStrafeRight;
  var bMoveForward;
  var bMoveBackward;
  var bJumping;
  var bFalling;
  var bRunning;
  var bPaused;
  var bPlayerMayMoveForward = true;

  let bPlayerMoving = () => (bTurnLeft || bTurnRight || bStrafeLeft || bStrafeRight
  							|| (bMoveForward && bPlayerMayMoveForward) || bMoveBackward
  							|| bJumping || bFalling || bRunning) && !bPaused;

  var nJumptimer = 0;
  var fLooktimer = 0;

  var fDepthBuffer = [];

  // defaults
  var fPlayerX = 14.0;
  var fPlayerY = 1.0;
  var fPlayerA = 1.5;
//   var nDegrees = 0;
  var nRenderMode = 2;

  var nMapHeight = 16;
  var nMapWidth = 16;
  var map = "";
  var sLevelstring = "";


  let hitSideCheck = 0;		// DEBUG only


  // keep track of map tiles visited by the rays, help cull sprites without trig
  let visitedTiles = new Uint32Array(nMapWidth * nMapHeight);
  let currentFrame = 0;

  var gameRun;
  var animationTimer = 0;

  const edgeThreshold = 0.01;		// control thickness of border in flat renderer, also holes

  const MIN_DIST = 0.1; // Prevent division by zero if standing exactly on a sprite

  const PLAYER_RADIUS = 0.2;		// keep the player a bit away from the walls

  const absSign = (x) => (x === 0 ? 1 : Math.sign(x));

  let LockLook = false;
  let printedScreenRays = false;
  let rayObs = new Array();		// DEBUG ONLY object to hold details of rays
  							// column, ray angle, height of wall
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


  // █
  // ▓
  // ▒
  // ░
  const brightness = ["&nbsp;", "&#9617;", "&#9618;", "&#9619;", "&#9608;"];



  function printPlayerLoc() {
	   _debugOutput(`Ang: ${fPlayerA}; x: ${fPlayerX}; y: ${fPlayerY}
	   Look: ${fLooktimer}; Tile: ${map[~~fPlayerY * nMapWidth + ~~fPlayerX]}`, 'debug');
  }







  /**
   * The basic game loop
   */
  var main = function(){
    gameRun = setInterval(gameLoop, 33);
    function gameLoop(){
//       _debugOutput('clear', 'debug2');

	  currentFrame++;

	  let viewX = Math.cos(fPlayerA);		// NOTE these are used all over the place for player movement, maybe share
	  let viewY = Math.sin(fPlayerA);

	  // camera plane
	  let planeX = -viewY * 0.66;		// initially 0.8391, based on tan(FOV/2), TODO make constant
	  let planeY = viewX * 0.66;		// smaller will be more wider

      /**
       * Game-function related
       */

      animationTimer++;
      if(animationTimer > 15){
        animationTimer = 0;
      }

      _rh.updateSpriteBuffer();		// NOTE also, why do we sort the sprites and then move them?
//       _rh.moveSprites();		// DEBUG don't move sprites while I work on better render logic


      /**
       * Player-movement related
       */

	  if (bPlayerMoving()) {
	    _mh.move(viewX, viewY);
	  }

      // normalize player angle
      if (fPlayerA < 0){
        fPlayerA += PIx2;
      }
      if (fPlayerA > PIx2){
        fPlayerA -= PIx2;
      }

      // allows jumping for only a certain amount of time
      if(bJumping){
        nJumptimer++
      }
      if( nJumptimer > 6 ){
        bFalling = true;
        bJumping = false;
        nJumptimer = 6;
      }

      // falling back down after jump
      if(bFalling){
        nJumptimer--;
      }
      if( nJumptimer < 1 ){
        bFalling = false;
      }

      let screenSkew = nScreenHeight / (2 - nJumptimer * 0.15 - fLooktimer * 0.15);


      /**
       * Drawing related
       */


      // holds the frames we're going to send to the renderer
      var screen = [];
      var spritescreen = [];
      var overlayscreen = [];


		let doorStartAngle = 0;		// DEBUG only
		let doorStartDist = 0;
		let doorEndAngle = 0;		// DEBUG only
		let doorEndDist = 0;
		let prevTile = '';		// DEBUG only

		let midFrameInfoMsg = '';		// DEBUG only
		let endDoorInfoMsg = '';		// DEBUG only


     // Converts player turn position into degrees (used for texturing)
//       nDegrees = ~~( fPlayerA * I80divPI) % 360;
// 	  _debugOutput(`nDegrees: ${nDegrees}`, 'debug2');


      raycaster();

	  _rh.drawSprites();

      _rh.fDrawFrame(screen, false);

    }
  };



  var init = function( input )
  {
    // prep document
    eScreen = document.getElementById("display");
    eScreen2 = document.getElementById("seconddisplay");
//     eDebugOut = document.getElementById("debug");
    eTouchLook = document.getElementById("touchinputlook");
    eTouchMove = document.getElementById("touchinputmove");

    _mh.keylisten();
    _mh.mouseinit();
    _mh.touchinit();

    // TODO: move to in-game menu
    document.getElementById("solid").addEventListener("click", function(){ nRenderMode = 0 });
    document.getElementById("texture").addEventListener("click", function(){ nRenderMode = 1 });
    document.getElementById("shader").addEventListener("click", function(){ nRenderMode = 2 });

    // initial gameload
    _loadLevel("mylevelfile1.map");
  };


  return{
    init: init,
  }
})();