// main i/o

export {_debugOutput, _mh, init, viewWindow, map, charLookup};

import {game, brightness, main, player} from './main-game-engine.js';

let gameResumeGuardOn = false;

const secondDisplay = document.querySelector('#seconddisplay')	// used for overlay/menus
let enableOverlay = false;
let enableBackgroundRun = true

const charLookup = new Map;
// Update status when the user switches tabs or minimizes the window
document.addEventListener('visibilitychange', () => {		// NOTE TODO i can get what I think is a race condition 
	if(gameResumeGuardOn || player.bPaused || enableBackgroundRun) {
		return;
	} else {
		gameResumeGuardOn = true;
		let iwa = viewWindow.isWindowActive();
		if(iwa && !game.isRunning) {
			resumeGameClock();
		} else if(!iwa && game.isRunning) {
			pauseGameClock();
		}
		gameResumeGuardOn = false;
	}
});

// Update status when the window gains or loses OS focus
window.addEventListener('focus', () => {		// TODO make one callback then pass it to all 3 of these listeners
	if(gameResumeGuardOn || player.bPaused || enableBackgroundRun) {
		return;
	} else {
		gameResumeGuardOn = true;
		let iwa = viewWindow.isWindowActive();
		if(iwa && !game.isRunning) {
			resumeGameClock();
		} else if(!iwa && game.isRunning) {
			pauseGameClock();
		}
		gameResumeGuardOn = false;
	}
});

window.addEventListener('blur', () => {
	if(gameResumeGuardOn || player.bPaused || enableBackgroundRun) {
		return;
	} else {
		gameResumeGuardOn = true;
		let iwa = viewWindow.isWindowActive();
		if(iwa && !game.isRunning) {
			resumeGameClock();
		} else if(!iwa && game.isRunning) {
			pauseGameClock();
		}
		gameResumeGuardOn = false;
	}
});

// TODO organize this module more....probably after the cleanup
document.addEventListener("pointerlockchange", (event) => {
	if (game.isRunning && enableBackgroundRun) return;
	// TODO check if pointer is locked
	if (document.pointerLockElement) {
		if (player.bPaused) {
			secondDisplay.innerHTML = 'paused';
		} else {
			secondDisplay.style.setProperty('opacity', '0%')
			secondDisplay.innerHTML = '';
			if(!game.isRunning && !gameResumeGuardOn) {
				gameResumeGuardOn = true;
				resumeGameClock();
				gameResumeGuardOn = false;
			}
		}
	} else {
		secondDisplay.style.setProperty('opacity', (enableOverlay ? '70%' : '0%'))
		secondDisplay.innerHTML = 'click to resume'
		if (game.isRunning && !player.bPaused) {
			pauseGameClock();
		}
	}
		// if yes, allow mousemove, remove message
		// if not, ignore mouse move, put "click to start" or something message on screen
});


// function focusPause() {		// TODO if I ever find out why the above conditionals are opposite, or can make them not opposite
// 									// put all that in this with the guard
// }

function pauseGameClock() {		// TODO NOTE i think the ultimate guard agains't multiple interval timers (at least until I swap to
	clearInterval(game.timer);		// getAnimationFrame) is til clear this var and only start the timer if it is null
	game.isRunning = false;			// then, i don't think I'd need as many guards strewn about the code
// 	player.bPaused = true;
	_debugOutput(`isWindowActive: ${viewWindow.isWindowActive()}; bPaused: ${player.bPaused}`, 'debug2');
}

function resumeGameClock() {
	_testScreenSizeAndStartTheGame();
// 	player.bPaused = false;
	_debugOutput(`isWindowActive: ${viewWindow.isWindowActive()}; bPaused: ${player.bPaused}`, 'debug2');
}




const nLookLimit = 8;
let LockLook = false;		// IO only, DEBUG only
let hitSideCheck = 0;		// DEBUG only, only in [io

let hiRes = true;
let resModifier = 2;


//   var eScreen;	// HERE and io._createTestScreen & io._testScreenSizeAndStartTheGame
  let eTouchLook;
  let eTouchMove;

  let sLevelstring = "";	// only here IO

  let viewWindow = {
    isWindowActive: () => document.visibilityState === 'visible' && document.hasFocus(),
  	width: 320,		// HERE to calc viewWindow.skew, but thats only used in raycaster (but should probably be in renderer)
  	height: 80,			// also used in io, raycaster, and renderer
//   	height: 92,			// allow for more square "pixels"

	depth: 16.0, // viewport depth, max ray/draw dist		// raycaster and renderer
	depthBuffer: [],		// raycaster and renderer	// TODO double check what this is used for, is it necessary?

	output: '',

	buffer: [],

	nRenderMode: 2,	// used in renderer and raycaster, but the raycaster stuff should probably be moved into renderer

	get skew() { return this.height / (2 - game.nJumptimer * 0.15 - game.fLooktimer * 0.15) },	// mostly used in raycaster, but I think that might should be in rendere instead

	// camera plane
	get planeX() { return -player.viewY * 0.66 },		// initially 0.8391, based on tan(FOV/2), TODO make constant
	get planeY() { return player.viewX * 0.66 },		// smaller will be more wider
  };

  let map = {};

const PLAYER_RADIUS = 0.2;		// keep the player a bit away from the walls	// IO only

  // leaving the console for errors, logging seems to kill performance
  var _debugOutput = function(input, elementId, append = false){
  	let debugEl = document.getElementById(elementId)

  	if(input === 'clear') {
  	  debugEl.textContent = '';
  	} else {
	  if(append) {
  		debugEl.insertAdjacentHTML("beforeend", `; ${input}`);
  	  } else {
  		debugEl.innerHTML = input;
  	  }
  	}
  };

  /**
   * Loads
   * @param  {[string]} level The Level file
   * @return {[type]}       [description]
   *
   * _loadLevel() called from init()
   */
  var _loadLevel = function(level){

    clearInterval(game.timer);
    game.isRunning = false;

    sLevelstring = level.replace(".map", ""); // sets global string

    var loadScriptAsync = function(uri, sLevelstring) {
      return new Promise(function (resolve, reject) {
        var tag = document.createElement("script");
        tag.src = "assets/" + uri;
        tag.id = sLevelstring;
        tag.async = true;

        tag.onload = function () {
          resolve();
        };

        document.getElementById("map").src = "assets/" + level;
        var firstScriptTag = document.getElementsByTagName("script")[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      });
    };

    var levelLoaded = loadScriptAsync(level, sLevelstring);

    levelLoaded.then(function(){		// NOTE TODO this module should just interact with the real world
    										// this func for example, just load the map/level data
    										// then a system module will take that data and set the player X/Y/Ang
    										// generate the proper sprites coordinates, etc
      // updates the level map and dimensions
      map = window[sLevelstring];
	  // keep track of map tiles visited by the rays, help cull sprites without trig
      map.visitedTiles = new Uint32Array(map.width * map.height);	// renderer and raycaster

      // places the player at the map starting point
      player.x = map.playerStartX;
      player.y = map.playerStartY;
      player.ang = map.playerStartA;

// 	map.sprites = '';		// DEBUG uncomment to disable
      if( map.sprites == "autogen" ){
        map.sprites = _generateRandomSprites();
      }

      document.querySelector("body").style.color = map.color;
      document.querySelector("body").style.background = map.background;
    });

	// NOTE TODO i think this is where the oSprite thing should be called, because at this point the level has been loaded
		// and we should have the oSprites....i think

//     // pauses, then starts the game loop
//     _testScreenSizeAndStartTheGame();
//     window.addEventListener("resize", function(){
//       clearInterval(game.timer);
//       game.isRunning = false;
//       _testScreenSizeAndStartTheGame();
//     });
  };




  // keyboard and mouse
  var _mh = {		// TODO make this into a class

    // keystroke listening engine
    keylisten: function(){

      window.onkeydown = function(e) {		// TODO change to addEventListener, keydown & keyup
      	// Ignore the event if the window is not currently active
  		if (!viewWindow.isWindowActive() || !document.pointerLockElement) return;

        console.log(e.which);		// DEBUG ONLY
		if (e.which === 192) {		// `, print ray details to console
			printRayObs();
		}

        if (e.which == 80) { // p
          if( player.bPaused ){		// TODO do not respond to mouselook when paused
            _testScreenSizeAndStartTheGame();
            player.bPaused = false;
			secondDisplay.style.setProperty('opacity', '0%')
			secondDisplay.innerHTML = '';
          } else {
            clearInterval(game.timer);		// NOTE TODO i think something about my module design is making this
            game.isRunning = false;
            player.bPaused = true;				// clearInterval() not work, it isn't pausing as fully as the non-module version
			secondDisplay.style.setProperty('opacity', (enableOverlay ? '70%' : '0%'))
			secondDisplay.innerHTML = 'paused';
          }										// try hack with checking for paused or viewWindow.isWindowActive() in main loop for now
        }

        if (player.bPaused) return;

        // movement based conditions
        // DEBUG movement
		if (e.which === 49) {		// 1, lock lookup/down to center
			LockLook = !LockLook;
			game.fLooktimer = 0;
		}
		if (e.which === 50) {		// 2, go to cardinal direction N
			player.ang = +(Math.PI * 0.5);
			hitSideCheck = 1;
		}
		if (e.which === 51) {		// 3, go to cardinal direction E
			player.ang = Math.PI;
			hitSideCheck = 0;
		}
		if (e.which === 52) {		// 4, go to cardinal direction S
			player.ang = +(Math.PI * 1.5);
			hitSideCheck = 1;
		}
		if (e.which === 53) {		// 5, go to cardinal direction W
			player.ang = +(Math.PI * 2.0);
			hitSideCheck = 0;
		}

        // normal movement
        if (e.which == 16) { // shift
          player.bRunning = true;
        }
        if (e.which == 32) { // space
          player.bJumping = true;
        }
        if (e.which == 65) { // a
          player.bStrafeLeft = true;
        }
        if (e.which == 68) { // d
          player.bStrafeRight = true;
        }
        if (e.which == 81 || e.which == 37) { // q or left
          player.bTurnLeft = true;
        }
        if (e.which == 69 || e.which == 39) { // e or right
          player.bTurnRight = true;
        }
        if (e.which == 87 || e.which == 38) { // w or up
          player.bMoveForward = true;
        }
        if (e.which == 83 || e.which == 40) { // s or down
          player.bMoveBackward = true;
        }
      };

      window.onkeyup = function(e) {

        if (e.which == 16) { // shift
          player.bRunning = false;
        }
        if (e.which == 32) { // space
          player.bJumping = false;
          player.bFalling = true;
        }
        if (e.which == 65) { // a
          player.bStrafeLeft = false;
        }
        if (e.which == 68) { // d
          player.bStrafeRight = false;
        }
        if (e.which == 81 || e.which == 37) { // q or left
          player.bTurnLeft = false;
        }
        if (e.which == 69 || e.which == 39) { // e or right
          player.bTurnRight = false;
        }
        if (e.which == 87 || e.which == 38) { // w or up
          player.bMoveForward = false;
        }
        if (e.which == 83 || e.which == 40) { // s or down
          player.bMoveBackward = false;
        }
      };
    },

    //
    //
    /**
     * Y-Movement
     * @param  {float}  fMoveInput   the movement from touch or mouse-input
     * @param  {float}  fMoveFactor  factor by which to multiply the recieved input
     *
     * Ultimately modifies the `game.fLooktimer` variable, which is global :) -- NOT ANYMORE
     */
    yMoveUpdate: function(fMoveInput, fMoveFactor ){

      // look up/down (with bounds)
      if(LockLook) return;		// my debug
      var fYMoveBy = fMoveInput * fMoveFactor;

      // if the looktimer is negative (looking down), increase the speed
      if( game.fLooktimer < 0 ){
        fYMoveBy = fYMoveBy * 4;
      }

      // the reason for the increased speed is that looking down becomes expotentially less,
      // so we are artificially increasing the down-factor. it's a hack, but it works okay!
      game.fLooktimer -= fYMoveBy;
      if( game.fLooktimer > nLookLimit * 0.7 || game.fLooktimer < -nLookLimit * 2 ){
        game.fLooktimer += fYMoveBy;
      }
    },

    mouseLook: function(){
      var fMouseLookFactor = 0.002;

// TODO add listener for pointerlockchange so mouse doesn't move viewport when not "locked"
	// see https://developer.mozilla.org/en-US/docs/Web/API/Document/pointerlockchange_event
      document.body.requestPointerLock();
      document.onmousemove = function (e) {
		// Ignore the event if the window is not currently active or paused
  		if (!viewWindow.isWindowActive() || player.bPaused || !document.pointerLockElement) return;

        // look left/right
        player.ang   += ( (e.movementX * fMouseLookFactor) || (e.mozMovementX * fMouseLookFactor) || (e.webkitMovementX * fMouseLookFactor) || 0);

        // look up and down
        _mh.yMoveUpdate( ( e.movementY || e.mozMovementY || e.webkitMovementY || 0), 0.05 );
      }
    },

    // mouse
    mouseinit: function(){
      touchinputlook.onclick = _mh.mouseLook;
      touchinputmove.onclick = _mh.mouseLook;
    },

    // holds and tracks touch-inputs
    oTouch: {
      move: {
        x: 0,
        y: 0,
        bFirstTouch: true,
      },
      look: {
        x: 0,
        y: 0,
        bFirstTouch: true,
      },
    },

    /**
     * Calculates the difference between touch events fired
     * @param  {object} prev  information about the state
     * @param  {event}  e     the event
     * @return {object}       x and y coordinates
     */
    touchCalculate: function(prev, e){
      var oDifference = {};

      // fetch and compare touch-points
      // always [0] because no multitouch
      var fInputX = e.changedTouches[0].clientX;
      var fInputY = e.changedTouches[0].clientY;

      var differenceX = fInputX - prev.x;
      var differenceY = fInputY - prev.y;

      prev.x = fInputX;
      prev.y = fInputY;

      oDifference = {
        x: differenceX,
        y: differenceY,
      };

      return oDifference;
    },

    // initialize the touch listeners for walk and move areas
    touchinit: function(){

      // look (left hand of viewWindow)
      eTouchLook.addEventListener("touchmove", function(e){
		// Ignore the event if the window is not currently active or is paused
  		if (!viewWindow.isWindowActive() || player.bPaused) return;

        // fetches differences from input
        var oDifferences = _mh.touchCalculate( _mh.oTouch.look, e);

        // makes sure no crazy
        if( oDifferences.x < 10 && oDifferences.x > -10 ){
          _mh.oTouch.look.bFirstTouch = false;
        }

        if( !_mh.oTouch.look.bFirstTouch ){

          // left and right
          player.ang += oDifferences.x * 0.005;

          // up and down
          _mh.yMoveUpdate(oDifferences.y, 0.1);
        }
      });

      // reset look
      eTouchLook.addEventListener("touchend", function(){
        _mh.oTouch.look.x = 0;
        _mh.oTouch.look.y = 0;
        _mh.oTouch.look.bFirstTouch = true;
      });

      // move (right hand of viewWindow)
      eTouchMove.addEventListener("touchmove", function(e){
        // Ignore the event if the window is not currently active or is paused
  		if (!viewWindow.isWindowActive() || player.bPaused) return;

        var oDifferences = _mh.touchCalculate( _mh.oTouch.move, e);

        // makes sure no crazy
        if( oDifferences.x < 10 && oDifferences.x > -10 ){
          _mh.oTouch.move.bFirstTouch = false;
        }

        // first touch will be a huge difference, that"s why we only move after the first touch
        if( !_mh.oTouch.move.bFirstTouch ){

          // walk		// TODO rewrite these touch funcs without all the trig
          player.x -= ( Math.sin(player.ang) + 5.0 * 0.0051 ) * oDifferences.x * 0.05;
          player.y += ( Math.cos(player.ang) + 5.0 * 0.0051 ) * oDifferences.x * 0.05;

          // converts coordinates into integer space and check if it is a wall (!.), if so, reverse
          if(map.tiles[~~(player.y) * map.width + ~~(g)] != "."){
            _mh.checkExit();
            player.x += ( Math.sin(player.ang) + 5.0 * 0.0051 ) * oDifferences.x * 0.05;
            player.y -= ( Math.cos(player.ang) + 5.0 * 0.0051 ) * oDifferences.x * 0.05;
          }

          // strafe
          player.x += ( Math.cos(player.ang) + 5.0 * 0.0051 ) * -oDifferences.y * 0.05;
          player.y += ( Math.sin(player.ang) + 5.0 * 0.0051 ) * -oDifferences.y * 0.05;

          // converts coordinates into integer space and check if it is a wall (!.), if so, reverse
          if(map.tiles[~~(player.y) * map.width + ~~(player.x)] != "."){
            _mh.checkExit();
            player.x -= ( Math.cos(player.ang) + 5.0 * 0.0051 ) * -oDifferences.y * 0.05;
            player.y -= ( Math.sin(player.ang) + 5.0 * 0.0051 ) * -oDifferences.y * 0.05;
          }
        }
      });

      // reset move
      eTouchMove.addEventListener("touchend", function(){
        _mh.oTouch.move.x = 0;
        _mh.oTouch.move.y = 0;
        _mh.oTouch.move.bFirstTouch = true;
      });

    },

    checkExit: function(){
      // if we hit an exit
      if(map.tiles[~~(player.y) * map.width + ~~(player.x)] == "X") {		// TODO this should compare to codePoint
        _loadLevel( map.exitsto );
      }
    },

    // called once per frame, handles movement computation
    move: function(viewX, viewY){

      if(player.bTurnLeft){
        player.ang -= 0.05;
      }

      if(player.bTurnRight){
        player.ang += 0.05;
      }

      let fMoveFactor = player.bRunning ? 0.2 : 0.1;


      let deltaXDir = 0;
      let deltaYDir = 0;
      let deltaX = ( viewX + 5.0 * 0.0051 ) * fMoveFactor;
      let deltaY = ( viewY + 5.0 * 0.0051 ) * fMoveFactor;
      let totalX = 0;
      let totalY = 0;


      if(player.bStrafeLeft ^ player.bStrafeRight) {		// TODO continue optimizing this
      	let [straifDeltaX, straifDeltaY] = [deltaY, deltaX];
      	if(player.bStrafeLeft) {
      		deltaXDir = 1;
        	deltaYDir = -1;
      	} else {
      		deltaXDir = -1;
        	deltaYDir = 1;

      	}

        totalX += straifDeltaX * deltaXDir;
        totalY += straifDeltaY * deltaYDir;
      }


      if((player.bMoveForward && player.bPlayerMayMoveForward) ^ player.bMoveBackward) {
        if(player.bMoveForward) {
      	  deltaXDir = 1;
          deltaYDir = 1;
      	} else {
      	  deltaXDir = -1;
          deltaYDir = -1;
      	}

        totalX += deltaX * deltaXDir;
        totalY += deltaY * deltaYDir;
      }

      let newX = player.x + totalX;
      let newY = player.y + totalY;


      // TODO i think i need the direction the door faces, if the player stays on that side of the door then all movement should be allowed
      	// that will fix the issue with only being allowed to move normal to the door
      let checkX = (totalX > 0) ? (newX + PLAYER_RADIUS) : (newX - PLAYER_RADIUS);

      if (map.tiles[~~player.y * map.width + ~~checkX] === '.') {
      	player.x = newX;
	  } else if (map.tiles[~~player.y * map.width + ~~checkX] === 'X'		// check for door tiles so we can go half way into the tile
	  		&& ((Math.sign(totalX) <= 0 && checkX - ~~checkX > 0.5) || (Math.sign(totalX) >= 0 && checkX - ~~checkX < 0.5))) {
	  	player.x = newX;
	  }

      let checkY = (totalY > 0) ? (newY + PLAYER_RADIUS) : (newY - PLAYER_RADIUS);

      if (map.tiles[~~checkY * map.width + ~~player.x] === '.') {
      	player.y = newY;
	  } else if (map.tiles[~~checkY * map.width + ~~player.x] === 'X'
	  		&& ((Math.sign(totalY) >= 0 && checkY - ~~checkY < 0.5) || (Math.sign(totalY) <= 0 && checkY - ~~checkY > 0.5))) {
	  	player.y = newY;
	  }

	  },

  };

  function setupCanvas() {

	const canvas = document.getElementById("canvDisp");
	const canvasContext = canvas.getContext("2d", { alpha: false });

	// correct canvas size for HiDPI
	// Get the DPR and size of the canvas
// 	const dpr = window.devicePixelRatio;
	// Force a higher internal scale factor
	const dpr = Math.max(window.devicePixelRatio || 1, 2) * 2;

	const rect = canvas.getBoundingClientRect();

	let canvasFontSize = hiRes ? 3 : 6;

	canvasContext.font = `${canvasFontSize}px "Consolas", Courier, monospace`;

	// Measure a string containing full height typography extensions
	const textMetrics = canvasContext.measureText('M');

	// Calculate total height using font bounding metrics
	const fontHeight = Math.ceil(textMetrics.actualBoundingBoxAscent + textMetrics.actualBoundingBoxDescent);
	const fontWidth = Math.ceil(textMetrics.width);

	// Set the "actual" size of the canvas
	canvas.width = rect.width * dpr;
	canvas.height = rect.height * dpr;		// the 1.168 compensates for the
// 	canvas.width = Math.round(rect.width * dpr / fontWidth) * fontWidth;////<-
// 	canvas.height = Math.round(rect.height * dpr / 1.168 / fontHeight) * fontHeight;////<-		// the 1.168 compensates for the original line-height in the display element
			// NEXT TODO remove the skipPixels stuff and transform the canvas to do lookup/down

	// Scale the context to ensure correct drawing operations
	canvasContext.scale(dpr, dpr);

	// Set the "drawn" size of the canvas
	canvas.style.width = `${rect.width}px`;
	canvas.style.height = `${rect.height}px`;////<-
// 	canvas.style.width = `${Math.round(rect.width / 1.168 / canvasFontSize) * canvasFontSize}px`;
// 	canvas.style.height = `${Math.round(rect.height / 1.168 / canvasFontSize) * canvasFontSize}px`;
// 	canvas.style.width = `${Math.round(rect.width / fontWidth) * fontWidth}px`;////<-
// 	canvas.style.height = `${Math.round(rect.height / 1.168 / fontHeight) * fontHeight}px`;
// 	canvas.style.width = `${canvas.width / 2}px`;
// 	canvas.style.height = `${canvas.height / 2}px`;

	// set some nice/required options
	canvasContext.fillStyle = 'white';
	canvasContext.strokeStyle = 'white';
	canvasContext.textRendering = "geometricPrecision";
// 	canvasContext.textAlign = "center";
	canvasContext.imageSmoothingEnabled = true;
	canvasContext.imageSmoothingQuality = "high";
	canvasContext.font = `${canvasFontSize}px "Consolas", Courier, monospace`;
	canvasContext.letterSpacing = `${1/canvasFontSize}px`;
	// canvasContext.globalCompositeOperation = "xor";


	viewWindow.canvas = canvas;
	viewWindow.canvasContext = canvasContext;
  	viewWindow.clearCanvas = () => canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  	viewWindow.canvasText = (text, x, y, maxWidth) => canvasContext.fillText(text, x, y, maxWidth);
  	viewWindow.canvasFontSize = canvasFontSize;
  	viewWindow.canvasFontHeight = fontHeight;
  	viewWindow.canvasFontWidth = fontWidth;
  }
  // init() called from HTML
    var init = function( input ) {
    // prep document
    viewWindow.outputEl = document.getElementById("display");
    eTouchLook = document.getElementById("touchinputlook");
    eTouchMove = document.getElementById("touchinputmove");

     if (hiRes) {	// TODO turn into switchable option in game
  		viewWindow.width = viewWindow.width * resModifier;
  		viewWindow.height = viewWindow.height * resModifier;
  		let currentFontSize = parseFloat(window.getComputedStyle(viewWindow.outputEl).getPropertyValue('font-size'));
  		viewWindow.outputEl.style.fontSize = `${currentFontSize / resModifier}px`;
  		viewWindow.outputEl.style.lineHeight = 1.168;		// no weird horizontal line artifacts

  	}

    _mh.keylisten();
    _mh.mouseinit();
    _mh.touchinit();

    // TODO: move to in-game menu
    document.getElementById("solid").addEventListener("click", () => viewWindow.nRenderMode = 0);
    document.getElementById("texture").addEventListener("click", () => viewWindow.nRenderMode = 1);
    document.getElementById("shader").addEventListener("click", () => viewWindow.nRenderMode = 2);

    // initial gameload
    _loadLevel("mainlevelfile1.map");


	// convert characters to unicode
	_convertAssetsToUnicode(brightness);		// TODO make brightness not const, so I can reassign it just like texture
	for (const texObj of Object.values(textures)) {
		texObj.texture = _convertAssetsToUnicode(texObj.texture);
	}
	// hack to add gate chars into charLookup
		// need to get it somewhere standardized
	_convertAssetsToUnicode(["═", "=", "║", "|"])
	// hack for floor and ceiling, # is ceiling only, there is also a '=' but that is already in gate chars
	_convertAssetsToUnicode(["`", "-", "x", "#"])
	// pauses, then starts the game loop
    _testScreenSizeAndStartTheGame();		// NOTE moving this func call here from _loadLevel might break changing levels....maybe
    window.addEventListener("resize", function(){		// to FIX we might need to call main() from here, instead of end of _testScreenSizeAndStartTheGame()
      clearInterval(game.timer);
      game.isRunning = false;
      _testScreenSizeAndStartTheGame();
    });
    // NOTE must be called after _testScreenSizeAndStartTheGame, because that sets up final screen height
	viewWindow.buffer = new Uint16Array(viewWindow.width * Math.ceil(viewWindow.height));
	setupCanvas();
  };

  function _convertAssetsToUnicode(asset) {
//   	let rawChar;
  	let rawCodePoint;
  	if(Array.isArray(asset)) {
  		for (let i = 0; i < asset.length; i++) {
  			rawCodePoint = asset[i].charCodeAt(0);
  			charLookup.set(rawCodePoint, asset[i]);
  			asset[i] = rawCodePoint;
  		}
  	} else if (typeof asset === 'string' || asset instanceof String) {
  		return [...asset].map(char => {
  			rawCodePoint = char.charCodeAt(0)
			charLookup.set(rawCodePoint, char);
  			return rawCodePoint;
  		});
  	} else if(asset instanceof Map) {
  		asset.forEach((subAsset, subAssetKey, assetMap) => {
  			assetMap.set(subAssetKey, _convertAssetsToUnicode(subAsset));
  		})
  		return asset;
  	}
  };


// "private" helper functions only used here
  function printPlayerLoc() {		// DEBUG only
    _debugOutput(`Ang: ${player.ang}; x: ${player.x}; y: ${player.y}
	Look: ${game.fLooktimer}; Tile: ${map.tiles[~~player.y * map.width + ~~player.x]}`, 'debug');
  }

  var _randomIntFromInterval = function(min, max) { // min and max included
    return ~~(Math.random() * (max - min + 1) + min);
  };

  	// NOTE oh wait, the naive way I initially thought of doing this just creates a "static-y" sky, I need a real skybox
  let starPicker =() => _randomIntFromInterval(1, 100) === 1;		// NOTE this should probably go into the renderer when the skybox is implemented


  // generates only pogels that can be placed
  var _generateRandomCoordinates = function(){

    var x = +(_randomIntFromInterval(0, map.width)) + 0;
    var y = +(_randomIntFromInterval(0, map.height)) - 0;

    while( map.tiles[ ~~(y) * map.width + ~~(x)] != "." ){
      x = +(_randomIntFromInterval(0, map.width)) + 1;
      y = +(_randomIntFromInterval(0, map.height)) - 1;
    }

    var oCoordinates = {
      "x": x,
      "y": y
    };

    return oCoordinates;
  };


  // generate random Sprites
  var _generateRandomSprites = function( nNumberOfSprites ){		// NOTE this (along with generateRandomCoordinates and randomIntFromInterval) should go somewhere else, it is currently only called by _loadLevel, when picking random places to put sprites, but that (and this) should be in a "build world" or main engine module probably, it doesn't really interact with the "real world"
    nNumberOfSprites = nNumberOfSprites || Math.round( map.width * map.width / 15 );
    // generates random Pogels or Obetrls! :oooo
    var oRandomLevelSprites = {};	// NOTE so this is an object.....
    for( var m = 0; m < nNumberOfSprites; m++){
      var randAngle = _randomIntFromInterval(0, +(Math.PI * 2.0));
      var nSpriteRand = _randomIntFromInterval(0,3);
      var randomCoordinates = _generateRandomCoordinates();
      var oRandomSprite = {
          "x": randomCoordinates.x,
          "y": randomCoordinates.y,
          "r": randAngle,
          "name": (nSpriteRand === 1) ? "O" : "P",
          "move": true,
          "speed": _randomIntFromInterval(0, 5) * 0.01,
          "stuckcounter": 0,
      }
      oRandomLevelSprites[m] = oRandomSprite ;	// and it holds more objects that are referenced by an integer
    }												// TODO we should probably change to an array of some type
    return oRandomLevelSprites;
  };


  // for every row make a viewWindow.width amount of pixels
  var _createTestScreen = function(){
    var sOutput = new Array(viewWindow.buffer.length);
    for(var screnCol = 0; screnCol < viewWindow.height; screnCol++){
      for(var viewWindowRow = 0; viewWindowRow < viewWindow.width; viewWindowRow++){
        sOutput.push(charLookup.get(brightness[0]));		// TODO is this after charLookup creation? swap to it if so
      }
      sOutput.push("<br>");
    }
    viewWindow.outputEl.innerHTML = sOutput.join('');
  };


  var _getWidth = function() {
    if (self.innerWidth) {
      return self.innerWidth;
    }
    if (document.documentElement && document.documentElement.clientWidth) {
      return document.documentElement.clientWidth;
    }
    if (document.body) {
      return document.body.clientWidth;
    }
  };


  var _getHeight = function() {
    return Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
  };


  var nTrymax = 512;
  // _testScreenSizeAndStartTheGame() called from _loadLevel()
  var _testScreenSizeAndStartTheGame = function(){

    // render a static test screen
    _createTestScreen();

    var widthOfDisplay   = viewWindow.outputEl.offsetWidth;
    var widthOfViewport  = _getWidth();
    var heightOfViewPort = _getHeight();
    var viewPortAspect   = heightOfViewPort / widthOfViewport;

    // check if the amount of pixels to be rendered fit, if not, repeat
    if(widthOfDisplay > widthOfViewport + 120){
      viewWindow.width = viewWindow.width - 1;
      // viewWindow.height = viewWindow.width * 0.22

      // try no more than nTrymax times (in case of some error)
      if( nTrymax > 0 ){
        nTrymax--;
        _testScreenSizeAndStartTheGame();
      } else {
        _debugOutput("Trymax exceeded", 'debug');
      }

    }
    // if it does, set aspect-ratio-based height
    // and start the game
    else{
      var fAdjustedAspectRatio = viewPortAspect / 2.82;		// TODO figure out what all these magic number are
// 		var fAdjustedAspectRatio = viewPortAspect / 2.4522;		// default resolution * 1.15

      if( fAdjustedAspectRatio < 0.266 ){	// this is ~3.7594 (e.g., 1/0.266), for default ~85.12 row resolution
        fAdjustedAspectRatio = 0.266;
//       if( fAdjustedAspectRatio < 0.3059 ){		// default row res * 1.15 (which allows for more square font) = 97.888
//         fAdjustedAspectRatio = 0.3059;			// aspect ratio is 3.269, which is 0.3059
      }
			// NOTE TODO this version (with Unit16Array) is rendering one row shorter than old, combined version
				// when looking up/down a small partial line is being rendered on the very bottom
				// there is likely somewhere where this is generating a count of rows starting at 0 and <= viewWindow.height
					// the old version that used standard arrays would simply expand the array
					// this version cannot
					// a weird side-effect of the limits in counting causes the lookup index in renderer.printCompositPixel to
						// look past end of Unit16Array and therefore return undefined values
					// that can be fixed by adding a Math.round() around this calculation
						// but that introduces a rendering artifact at the lower borders of wall where they meet the floor
						// and it's still 1 row too short
							// adding a + 1 to the Math.round()ed calc create an artifact in faraway rendering
				// THING TO DO
					// find where the funny compare is and fix it probably
				// FOLLOWUP
					// this version is good, the old version is rendering an extra line
						// FOLLOWUP to my FOLLOWUP
							// actually, additional testing shows the artifact still there with the ceil to even numbers
				// try odd numbers
				// nope, try just floor
				// nope, event floor
					// More Investigation
						// i think the artifact is happening because the wall texture is not aligned correctly
						// it is too high and the top is wrapping around to the bottom again
					// so I fixed this by adding the Math.round() when creating the array
						// no rendering artifact
						// and the array is big enough so that we don't get the weird extra half line when looking up/down
						// add'l info
							// I think the rendering artifacts are due to the height of the wall not being the right size
							// and the height is different because the window size is different
								// and its just the little bit of decimal that is screwing these calcs up
								// which makes me think the aspect ratio
									// and "magic numbers" above has something to do with the texture sizes
      viewWindow.height = viewWindow.width * fAdjustedAspectRatio;
//       viewWindow.height = Math.round(viewWindow.width * fAdjustedAspectRatio);
//       viewWindow.height = Math.ceil(viewWindow.width * fAdjustedAspectRatio / 2) * 2;
// 	  viewWindow.height = Math.ceil((viewWindow.width * fAdjustedAspectRatio - 1) / 2) * 2 + 1;
// 	viewWindow.height = Math.floor(viewWindow.width * fAdjustedAspectRatio / 2) * 2;
// 	viewWindow.height = 85;
      main();
    }
  };

