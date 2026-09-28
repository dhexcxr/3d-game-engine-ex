// main i/o

export {_loadLevel, _debugOutput, _mh};


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
   */
  var _loadLevel = function(level){

    clearInterval(gameRun);

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

    levelLoaded.then(function(){
      // updates the level map and dimensions
      map = window[sLevelstring].map;
      nMapHeight = window[sLevelstring].nMapHeight;
      nMapWidth = window[sLevelstring].nMapWidth;

      // places the player at the map starting point
      fPlayerX = window[sLevelstring].fPlayerX;
      fPlayerY = window[sLevelstring].fPlayerY;
      fPlayerA = window[sLevelstring].fPlayerA;

      // load sprites
      oLevelSprites = window[sLevelstring].sprites;


// 	oLevelSprites = '';		// DEBUG uncomment to disable
      if( oLevelSprites == "autogen" ){
        oLevelSprites = _generateRandomSprites();
      }

      document.querySelector("body").style.color = window[sLevelstring].color;
      document.querySelector("body").style.background = window[sLevelstring].background;
    });


    // pauses, then starts the game loop
    _testScreenSizeAndStartTheGame();
    window.addEventListener("resize", function(){
      clearInterval(gameRun);
      _testScreenSizeAndStartTheGame();
    });
  };




  // keyboard and mouse
  var _mh = {		// TODO make this into a class

    // keystroke listening engine
    keylisten: function(){

      window.onkeydown = function(e) {
      	// Ignore the event if the window is not currently active
  		if (!isWindowActive) return;


        console.log(e.which);		// DEBUG ONLY
		if (e.which === 192) {		// `, print ray details to console
			printRayObs();
		}


        if (e.which == 80) { // p
          if( bPaused ){		// TODO do not respond to mouselook when paused
            _testScreenSizeAndStartTheGame();
            bPaused = false;
          } else {
            clearInterval(gameRun);
            bPaused = true;
          }
        }

        if (bPaused) return;

        // movement based conditions

        // DEBUG movement
		if (e.which === 49) {		// 1, lock lookup/down to center
			LockLook = !LockLook;
			fLooktimer = 0;
		}
		if (e.which === 50) {		// 2, go to cardinal direction N
			fPlayerA = PIx05;
			hitSideCheck = 1;
		}
		if (e.which === 51) {		// 3, go to cardinal direction E
			fPlayerA = PI___;
			hitSideCheck = 0;
		}
		if (e.which === 52) {		// 4, go to cardinal direction S
			fPlayerA = PIx1_5;
			hitSideCheck = 1;
		}
		if (e.which === 53) {		// 5, go to cardinal direction W
			fPlayerA = PIx2;
			hitSideCheck = 0;
		}

        // normal movement
        if (e.which == 16) { // shift
          bRunning = true;
        }
        if (e.which == 32) { // space
          bJumping = true;
        }
        if (e.which == 65) { // a
          bStrafeLeft = true;
        }
        if (e.which == 68) { // d
          bStrafeRight = true;
        }
        if (e.which == 81 || e.which == 37) { // q or left
          bTurnLeft = true;
        }
        if (e.which == 69 || e.which == 39) { // e or right
          bTurnRight = true;
        }
        if (e.which == 87 || e.which == 38) { // w or up
          bMoveForward = true;
        }
        if (e.which == 83 || e.which == 40) { // s or down
          bMoveBackward = true;
        }

        printPlayerLoc();		// DEBUG only
      };

      window.onkeyup = function(e) {

        if (e.which == 16) { // shift
          bRunning = false;
        }
        if (e.which == 32) { // space
          bJumping = false;
          bFalling = true;
        }
        if (e.which == 65) { // a
          bStrafeLeft = false;
        }
        if (e.which == 68) { // d
          bStrafeRight = false;
        }
        if (e.which == 81 || e.which == 37) { // q or left
          bTurnLeft = false;
        }
        if (e.which == 69 || e.which == 39) { // e or right
          bTurnRight = false;
        }
        if (e.which == 87 || e.which == 38) { // w or up
          bMoveForward = false;
        }
        if (e.which == 83 || e.which == 40) { // s or down
          bMoveBackward = false;
        }

        printPlayerLoc();		// DEBUG only
      };
    },

    //
    //
    /**
     * Y-Movement
     * @param  {float}  fMoveInput   the movement from touch or mouse-input
     * @param  {float}  fMoveFactor  factor by which to multiply the recieved input
     *
     * Ultimately modifies the `fLooktimer` variable, which is global :)
     */
    yMoveUpdate: function(fMoveInput, fMoveFactor ){

      // look up/down (with bounds)
      if(LockLook) return;		// my debug
      var fYMoveBy = fMoveInput * fMoveFactor;

      // if the looktimer is negative (looking down), increase the speed
      if( fLooktimer < 0 ){
        fYMoveBy = fYMoveBy * 4;
      }

      // the reason for the increased speed is that looking “down” becomes expotentially less,
      // so we are artificially increasing the down-factor. it's a hack, but it works okay!
      fLooktimer -= fYMoveBy;
      if( fLooktimer > nLookLimit * 0.7 || fLooktimer < -nLookLimit * 2 ){
        fLooktimer += fYMoveBy;
      }
    },

    mouseLook: function(){
      var fMouseLookFactor = 0.002;

// TODO add listener for pointerlockchange so mouse doesn't move viewport when not "locked"
	// see https://developer.mozilla.org/en-US/docs/Web/API/Document/pointerlockchange_event
      document.body.requestPointerLock();
      document.onmousemove = function (e) {
		// Ignore the event if the window is not currently active or paused
  		if (!isWindowActive || bPaused) return;

        // look left/right
        fPlayerA   += ( (e.movementX * fMouseLookFactor) || (e.mozMovementX * fMouseLookFactor) || (e.webkitMovementX * fMouseLookFactor) || 0);

        // look up and down
        _mh.yMoveUpdate( ( e.movementY || e.mozMovementY || e.webkitMovementY || 0), 0.05 );

        printPlayerLoc();		// DEBUG only
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

      // look (left hand of screen)
      eTouchLook.addEventListener("touchmove", function(e){
		// Ignore the event if the window is not currently active or is paused
  		if (!isWindowActive || bPaused) return;

        // fetches differences from input
        var oDifferences = _mh.touchCalculate( _mh.oTouch.look, e);

        // makes sure no crazy
        if( oDifferences.x < 10 && oDifferences.x > -10 ){
          _mh.oTouch.look.bFirstTouch = false;
        }

        if( !_mh.oTouch.look.bFirstTouch ){

          // left and right
          fPlayerA += oDifferences.x * 0.005;

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

      // move (right hand of screen)
      eTouchMove.addEventListener("touchmove", function(e){
        // Ignore the event if the window is not currently active or is paused
  		if (!isWindowActive || bPaused) return;

        var oDifferences = _mh.touchCalculate( _mh.oTouch.move, e);

        // makes sure no crazy
        if( oDifferences.x < 10 && oDifferences.x > -10 ){
          _mh.oTouch.move.bFirstTouch = false;
        }

        // first touch will be a huge difference, that"s why we only move after the first touch
        if( !_mh.oTouch.move.bFirstTouch ){

          // walk		// TODO rewrite these touch funcs without all the trig
          fPlayerX -= ( Math.sin(fPlayerA) + 5.0 * 0.0051 ) * oDifferences.x * 0.05;
          fPlayerY += ( Math.cos(fPlayerA) + 5.0 * 0.0051 ) * oDifferences.x * 0.05;

          // converts coordinates into integer space and check if it is a wall (!.), if so, reverse
          if(map[~~(fPlayerY) * nMapWidth + ~~(fPlayerX)] != "."){
            _mh.checkExit();
            fPlayerX += ( Math.sin(fPlayerA) + 5.0 * 0.0051 ) * oDifferences.x * 0.05;
            fPlayerY -= ( Math.cos(fPlayerA) + 5.0 * 0.0051 ) * oDifferences.x * 0.05;
          }

          // strafe
          fPlayerX += ( Math.cos(fPlayerA) + 5.0 * 0.0051 ) * -oDifferences.y * 0.05;
          fPlayerY += ( Math.sin(fPlayerA) + 5.0 * 0.0051 ) * -oDifferences.y * 0.05;

          // converts coordinates into integer space and check if it is a wall (!.), if so, reverse
          if(map[~~(fPlayerY) * nMapWidth + ~~(fPlayerX)] != "."){
            _mh.checkExit();
            fPlayerX -= ( Math.cos(fPlayerA) + 5.0 * 0.0051 ) * -oDifferences.y * 0.05;
            fPlayerY -= ( Math.sin(fPlayerA) + 5.0 * 0.0051 ) * -oDifferences.y * 0.05;
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
      if(map[~~(fPlayerY) * nMapWidth + ~~(fPlayerX)] == "X"){
        _loadLevel( window[sLevelstring].exitsto );
      }
    },

    // called once per frame, handles movement computation
    move: function(viewX, viewY){

      if(bTurnLeft){
        fPlayerA -= 0.05;
      }

      if(bTurnRight){
        fPlayerA += 0.05;
      }

//       var fMoveFactor = 0.1;
//       if(bRunning){
//         fMoveFactor = 0.2;
//       }

      let fMoveFactor = bRunning ? 0.2 : 0.1;


      let deltaXDir = 0;
      let deltaYDir = 0;
      let deltaX = ( viewX + 5.0 * 0.0051 ) * fMoveFactor;
      let deltaY = ( viewY + 5.0 * 0.0051 ) * fMoveFactor;
      let totalX = 0;
      let totalY = 0;


      if(bStrafeLeft ^ bStrafeRight) {		// TODO continue optimizing this
      	let [straifDeltaX, straifDeltaY] = [deltaY, deltaX];
      	if(bStrafeLeft) {
      		deltaXDir = 1;
        	deltaYDir = -1;
      	} else {
      		deltaXDir = -1;
        	deltaYDir = 1;

      	}

        totalX += straifDeltaX * deltaXDir;
        totalY += straifDeltaY * deltaYDir;
      }


      if((bMoveForward && bPlayerMayMoveForward) ^ bMoveBackward) {
        if(bMoveForward) {
      	  deltaXDir = 1;
          deltaYDir = 1;
      	} else {
      	  deltaXDir = -1;
          deltaYDir = -1;
      	}

        totalX += deltaX * deltaXDir;
        totalY += deltaY * deltaYDir;
      }

      let newX = fPlayerX + totalX;
      let newY = fPlayerY + totalY;


      // TODO i think i need the direction the door faces, if the player stays on that side of the door then all movement should be allowed
      	// that will fix the issue with only being allowed to move normal to the door
      let checkX = (totalX > 0) ? (newX + PLAYER_RADIUS) : (newX - PLAYER_RADIUS);

      if (map[~~fPlayerY * nMapWidth + ~~checkX] === '.') {
      	fPlayerX = newX;
	  } else if (map[~~fPlayerY * nMapWidth + ~~checkX] === 'X'		// check for door tiles so we can go half way into the tile
	  		&& ((Math.sign(totalX) <= 0 && checkX - ~~checkX > 0.5) || (Math.sign(totalX) >= 0 && checkX - ~~checkX < 0.5))) {
	  	fPlayerX = newX;
	  }

      let checkY = (totalY > 0) ? (newY + PLAYER_RADIUS) : (newY - PLAYER_RADIUS);

      if (map[~~checkY * nMapWidth + ~~fPlayerX] === '.') {
      	fPlayerY = newY;
	  } else if (map[~~checkY * nMapWidth + ~~fPlayerX] === 'X'
	  		&& ((Math.sign(totalY) >= 0 && checkY - ~~checkY < 0.5) || (Math.sign(totalY) <= 0 && checkY - ~~checkY > 0.5))) {
	  	fPlayerY = newY;
	  }



//       _debugOutput(`dX: ${deltaX}; dDirX: ${deltaXDir}; totX: ${totalX}; dY: ${deltaY}; dDirY: ${deltaYDir}; totY: ${totalY}`, 'debug2');
	  },
  };




// "private" helper functions only used here

  var _randomIntFromInterval = function(min, max) { // min and max included
    return ~~(Math.random() * (max - min + 1) + min);
  };

  	// NOTE oh wait, the naive way I initially thought of doing this just creates a "static-y" sky, I need a real skybox
  let starPicker =() => _randomIntFromInterval(1, 100) === 1;		// NOTE this should probably go into the renderer when the skybox is implemented


  // generates only pogels that can be placed
  var _generateRandomCoordinates = function(){

    var x = +(_randomIntFromInterval(0, nMapWidth)) + 0;
    var y = +(_randomIntFromInterval(0, nMapHeight)) - 0;

    while( map[ ~~(y) * nMapWidth + ~~(x)] != "." ){
      x = +(_randomIntFromInterval(0, nMapWidth)) + 1;
      y = +(_randomIntFromInterval(0, nMapHeight)) - 1;
    }

    var oCoordinates = {
      "x": x,
      "y": y
    };

    return oCoordinates;
  };


  // generate random Sprites
  var _generateRandomSprites = function( nNumberOfSprites ){		// NOTE this (along with generateRandomCoordinates and randomIntFromInterval) should go somewhere else, it is currently only called by _loadLevel, when picking random places to put sprites, but that (and this) should be in a "build world" or main engine module probably, it doesn't really interact with the "real world"
    nNumberOfSprites = nNumberOfSprites || Math.round( nMapWidth * nMapWidth / 15 );
    // generates random Pogels or Obetrls! :oooo
    var oRandomLevelSprites = {};	// NOTE so this is an object.....
    for( var m = 0; m < nNumberOfSprites; m++){
      var randAngle = _randomIntFromInterval(0, PIx2);
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