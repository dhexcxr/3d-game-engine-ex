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
  let rayObs = new Array();		// debug object to hold details of rays
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

  var _randomIntFromInterval = function(min, max) { // min and max included
    return ~~(Math.random() * (max - min + 1) + min);
  };

  let starPicker =() => _randomIntFromInterval(1, 100) === 1;


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
  var _generateRandomSprites = function( nNumberOfSprites ){
    nNumberOfSprites = nNumberOfSprites || Math.round( nMapWidth * nMapWidth / 15 );
    // generates random Pogels or Obetrls! :oooo
    var oRandomLevelSprites = {};	// NOTE this is an object.....
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
    }
    return oRandomLevelSprites;
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


// 	oLevelSprites = '';		// DEBUG uncomment to disable sprites
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


  /**
   * Function will get the pixel to be sampled from the sprite
   *
   * @param  {array} texture -     The texture to be sampled
   * @param  {float} x -           The x coordinate of the sample (how much across)
   * @param  {float} y -           The y coordinate of the sample
   * @param  {float} scaleFactor - scales the texture.
   *                               Example: 2 will render twice the resolution
   *                               (texture tiled 4x across one block)
   * @return {string}
   */
  var _getSamplePixel = function(texture, x, y){

    var scaleFactor = texture.scale  || defaultTexScale;
    var texWidth    = texture.width  || defaultTexWidth;
    var texHeight   = texture.height || defaultTexHeight;

    var texpixels = texture.texture;

    if( texture.texture == "DIRECTIONAL" ){
      // Different Texture based on viewport
      if( fPlayerA > 0 && fPlayerA < PI___ ){
        texpixels = texture.S;
      } else {
        texpixels = texture.N;
      }
    }

    scaleFactor = scaleFactor || 2;

    x = scaleFactor * x%1;
    y = scaleFactor * y%1;

    var sampleX = ~~(texWidth * x);
    var sampleY = ~~(texHeight * y);

    var samplePosition = (texWidth * (sampleY)) + sampleX;

    if( x < 0 || x > texWidth || y < 0 || y > texHeight ){
      return "+";
    } else {
      let retVal = texpixels[samplePosition];
      if(retVal === 'undefined')		// DEBUG
      	console.log(retVal);
      return texpixels[samplePosition];
    }
  };


  /**
   * Retrieve a fixed number of elements from an array, evenly distributed but
   * always including the first and last elements.
   *
   * source https://stackoverflow.com/questions/32439437/retrieve-an-evenly-distributed-number-of-elements-from-an-array
   * wow!!!!
   *
   * @param   {Array} items - The array to operate on.
   * @param   {number} n -    The number of elements to extract.
   * @returns {Array}
   */
  // helper function
  function _toConsumableArray(arr) {
  	return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread();
  }

  function _evenlyPickItemsFromArray(allItems, neededCount) {
    if (neededCount >= allItems.length) {
      return _toConsumableArray(allItems);
    }

    var result = [];
    var totalItems = allItems.length;
    var interval = totalItems / neededCount;

    for (var i = 0; i < neededCount; i++) {
      var evenIndex = ~~(i * interval + interval / 2);
      result.push(allItems[evenIndex]);
    }

    return result;
  }


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

  function printPlayerLoc() {
	   _debugOutput(`Ang: ${fPlayerA}; x: ${fPlayerX}; y: ${fPlayerY}
	   Look: ${fLooktimer}; Tile: ${map[~~fPlayerY * nMapWidth + ~~fPlayerX]}`, 'debug');
  }


  // returns true every a-th interation of b
  var _everyAofB = function(a, b){
    return ( a && (a % b === 0));
  }


  // lookup-table “for fine-control” or “for perfomance”
  // …(but really because I couldn"t figure out the logic [apparently] )
  var _skipEveryXrow = function(input){
    input = Math.round(input);
    switch( Number(input) ) {
      case 0: return 0; break;
      case 1: return 8; break;
      case 2: return 6; break;
      case 3: return 4; break;
      case 4: return 3; break;
      case 5: return 2; break;
      case 6: return 2; break;
      case 7: return 2; break;
      case 8: return 1; break;

      case -1: return 8; break;
      case -2: return 8; break;
      case -3: return 7; break;
      case -4: return 7; break;
      case -5: return 6; break;
      case -6: return 6; break;
      case -7: return 5; break;
      case -8: return 5; break;
      case -9: return 4; break;
      case -10: return 4; break;
      case -11: return 3; break;
      case -12: return 3; break;
      case -13: return 3; break;
      case -14: return 2; break;
      case -15: return 2; break;
      case -16: return 2; break;

      default:
        return 0;
    }
  };


  /**
   * Determines with Pixels to use, sInput
   * @param  {string} oInput    Main Pixel
   * @param  {string} sOverlay  Overlay Pixel
   * @param  {int} nIndex       Index
   * @return {[string]}         Final Pixel
   */
  var _printCompositPixel = function(sInput, sOverlay, nIndex){
    var sOutput = "";
    // if sOverlay !0, appends it to the output instead
    if( sOverlay && sOverlay[nIndex] != 0){
      sOutput += sOverlay[nIndex];
    } else {
      sOutput += sInput[nIndex];
    }
    return sOutput;
  };


  /**
   * Creates a new array of pixels taking looking up and down into account
   * It returns an array to be rendered later.
   * the aim is to remove the first and last 30 pixels of very row,
   * to obscure the skewing
   */
  var _fPrepareFrame = function(oInput, oOverlay, eTarget){
    var oOverlay = oOverlay || false;
    var eTarget  = eTarget || eScreen;
    var sOutput = [];

// NOTE TODO i think this is where the skewing can be improved

    // this is the maximum of variation created by the lookup timer, aka the final lookmodifier value
    var neverMoreThan = Math.round(nScreenHeight / _skipEveryXrow(fLooktimer) - 1);

    // used to skew the image
    var globalPrintIndex = 0;
    var fLookModifier = 0;

    // if looking up, the starting point is the max number of pixesl to indent,
    // which will be decremented, otherwise it remains 0, which will be incremented
    if( fLooktimer > 0 && isFinite(neverMoreThan) ){
      fLookModifier = neverMoreThan;
    }

    // interate each row at a time
    for(var row = 0; row < nScreenHeight; row++){

      // increment the fLookModifier every time it needs to grow (grows per row)
      if ( _everyAofB(row, _skipEveryXrow(fLooktimer)) ) {
						// looking up
          fLooktimer > 0 ? fLookModifier-- : fLookModifier++;
      }

      // print filler pixels
      for(var i=0; i<fLookModifier; i++){
        sOutput.push( "." );
      }

      var toBeRemoved = (2 * fLookModifier);
      var removeFrom = [];

      //  make a new array that contains the indices of the elements to print
      // (removes X amount of elements from array)
      var items = [];
      for (var i=0; i<= nScreenWidth; i++) {
        items.push(i);
      }

      // list to be removed from each row:
      // [1,2,3,4,5,6,7,8]
      // [1,2, ,4,5, ,7,8]
      //   [1,2,4,5,7,8]
      removeFrom = _evenlyPickItemsFromArray(items, toBeRemoved);

      // loops through each rows of pixels
      for(var rpix = 0; rpix < nScreenWidth; rpix++){

        // print only if the pixel is in the list of pixels to print
        if( removeFrom.includes(rpix) ){
          // don"t print
        } else {
          // print
          sOutput.push( _printCompositPixel(oInput, oOverlay, globalPrintIndex) );
        }

        globalPrintIndex++;
      } // end for(rpix

      // print filler pixels
      for(var i=0; i<fLookModifier; i++){
        sOutput.push( "." );
      }

    } // end for(row

    return sOutput;
  };


  var _fDrawFrame = function(screen, overlayscreen, target){
    var frame = _fPrepareFrame(screen, overlayscreen);
// 	var frame = screen;		// DEBUG uncomment to remove skew from look up/down rendering
    var target = target || eScreen;

    var sOutput = "";

    // interates over each row again, and omits the first and last 30 pixels, to disguise the skewing!
    var printIndex = 0;
    var removePixels = nScreenHeight / 2;
    for(var row = 0; row < nScreenHeight; row++){
      for(var pix = 0; pix < nScreenWidth; pix++){

        // H-blank based on screen-width
        if(printIndex % (nScreenWidth) == 0){
          sOutput += "<br>";
        }

        if( pix < removePixels ){
          sOutput += "";
        } else if( pix > nScreenWidth - removePixels ) {
          sOutput += "";
        } else {
          sOutput += frame[printIndex];
        }

        printIndex++;
      }
    }
    target.innerHTML = sOutput;
  };


  // various shaders for walls, ceilings, objects
  // _renderHelpers
  //
  // each texture has 4 values: 3 hues plus black
  // each value can be rendered with 5 shades (4 plus black)
  var _rh = {

    renderWall: function(fDistanceToWall, sWallDirection, pixel){

      var fill = "";

      if( sWallDirection === "N" || sWallDirection === "S" ){

        if(fDistanceToWall < fDepth / 5.5 ){

          if( pixel === "#" ){
            fill = brightness[4];
          } else if( pixel === "7" ) {
            fill = brightness[3];
          } else if( pixel === "*" || pixel === "o") {
            fill = brightness[2];
          } else {
            fill = brightness[1];
          }

        } else if(fDistanceToWall < fDepth / 3.66 ) {

          if( pixel === "#" ){
            fill = brightness[3];
          } else if( pixel === "7" ) {
            fill = brightness[2];
          } else if( pixel === "*" || pixel === "o") {
            fill = brightness[1];
          } else {
            fill = brightness[0];
          }

        } else if(fDistanceToWall < fDepth / 2.33 ) {

          if( pixel === "#" ){
            fill = brightness[2];
          } else if( pixel === "7" ) {
            fill = brightness[1];
          } else if( pixel === "*" || pixel === "o") {
            fill = brightness[1];
          } else {
            fill = brightness[0];
          }

        } else if(fDistanceToWall < fDepth / 1 ) {

          if( pixel === "#" ){
            fill = brightness[1];
          } else if( pixel === "7" ) {
            fill = brightness[1];
          } else if( pixel === "*" || pixel === "o") {
            fill = brightness[1];
          } else {
            fill = brightness[0];
          }

        } else {
          fill = brightness[0];
        }
      }

      // walldirection W/E
      else{

        if(fDistanceToWall < fDepth / 5.5 ){

          if( pixel === "#" ){
            fill = brightness[3];
          } else if( pixel === "7" ) {
            fill = brightness[2];
          } else if( pixel === "*" || pixel === "o") {
            fill = brightness[1];
          } else {
            fill = brightness[0];
          }

        } else if(fDistanceToWall < fDepth / 3.66 ) {

          if( pixel === "#" ){
            fill = brightness[2];
          } else if( pixel === "7" ) {
            fill = brightness[2];
          } else if( pixel === "*" || pixel === "o") {
            fill = brightness[1];
          } else {
            fill = brightness[0];
          }

        } else if(fDistanceToWall < fDepth / 2.33 ) {

          if( pixel === "#" ){
            fill = brightness[2];
          } else if( pixel === "7" ) {
            fill = brightness[1];
          } else if( pixel === "*" || pixel === "o") {
            fill = brightness[1];
          } else {
            fill = brightness[0];
          }

        } else if(fDistanceToWall < fDepth / 1 ) {

          if( pixel === "#" ){
            fill = brightness[1];
          } else if( pixel === "7" ) {
            fill = brightness[1];
          } else if( pixel === "*" || pixel === "o") {
            fill = brightness[0];
          } else {
            fill = brightness[0];
          }

        } else {
          fill = brightness[0];
        }
      }

      return fill;
    },

    // figures out shading for given section
    renderSolidWall: function(fDistanceToWall, isBoundary){
      var fill = brightness[1];

      if(fDistanceToWall < fDepth / 6.5 ){
        fill = brightness[4];
      } else if(fDistanceToWall < fDepth / 4.66 ) {
        fill = brightness[3];
      } else if(fDistanceToWall < fDepth / 3.33 ) {
        fill = brightness[2];
      } else if(fDistanceToWall < fDepth / 1 ) {
        fill = brightness[1];
      } else {
        fill = brightness[0];
      }

      if( isBoundary ){
        if(fDistanceToWall < fDepth / 6.5 ){
          fill = brightness[1];
        } else if(fDistanceToWall < fDepth / 4.66 ) {
          fill = brightness[1];
        } else if(fDistanceToWall < fDepth / 3.33 ) {
          fill = brightness[0];
        } else if(fDistanceToWall < fDepth / 1 ) {
          fill = brightness[0];
        } else {
          fill = brightness[0];
        }
      }

      return fill;
    },

    // shading and sectionals for gate
    renderGate: function(screenRow, fDistanceToWall, nDoorFrameTop, nCeiling) {
      var fill = "X";

      if( screenRow < nDoorFrameTop) {
        if(fDistanceToWall < fDepth / 4) {
          fill = "&boxH;";
        } else {
          fill = "=";
        }
      } else {
        if(fDistanceToWall < fDepth / 4) {
          fill = "&boxV;";
        } else {
          fill = "|";
        }
      }
      return fill;
    },

    renderFloor: function(j){
      var fill = "`";

      // draw floor, in different shades
      b = 1 - (j -nScreenHeight / 2) / (nScreenHeight / 2);
      b = 1 - (j -nScreenHeight / (2- fLooktimer * 0.15)) / (nScreenHeight / (2 - fLooktimer * 0.15));

      if(b < 0.25){
        fill = "x";
      } else if(b < 0.5) {
        fill = "=";
      } else if(b < 0.75) {
        fill = "-";
      } else if(b < 0.9) {
        fill = "`";
      } else {
        fill = brightness[0];
      }

      return fill;
    },

    renderCeiling: function(j){
      var fill = "`";

      // draw ceiling, in different shades
      b = 1 - (j -nScreenHeight / 2) / (nScreenHeight / 2);
      if(b < 0.25){
        fill = "`";
      } else if(b < 0.5) {
        fill = "-";
      } else if(b < 0.75) {
        fill = "=";
      } else if(b < 0.9) {
        fill = "x";
      } else {
        fill = "#";
      }

      return fill;
    },
  };


  // keyboard and mouse
  var _moveHelpers = {		// TODO make this into a class

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
      if(LockLook) return;		// DEBUG
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
        _moveHelpers.yMoveUpdate( ( e.movementY || e.mozMovementY || e.webkitMovementY || 0), 0.05 );

        printPlayerLoc();		// DEBUG only
      }
    },

    // mouse
    mouseinit: function(){
      touchinputlook.onclick = _moveHelpers.mouseLook;
      touchinputmove.onclick = _moveHelpers.mouseLook;
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
        var oDifferences = _moveHelpers.touchCalculate( _moveHelpers.oTouch.look, e);

        // makes sure no crazy
        if( oDifferences.x < 10 && oDifferences.x > -10 ){
          _moveHelpers.oTouch.look.bFirstTouch = false;
        }

        if( !_moveHelpers.oTouch.look.bFirstTouch ){

          // left and right
          fPlayerA += oDifferences.x * 0.005;

          // up and down
          _moveHelpers.yMoveUpdate(oDifferences.y, 0.1);
        }
      });

      // reset look
      eTouchLook.addEventListener("touchend", function(){
        _moveHelpers.oTouch.look.x = 0;
        _moveHelpers.oTouch.look.y = 0;
        _moveHelpers.oTouch.look.bFirstTouch = true;
      });

      // move (right hand of screen)
      eTouchMove.addEventListener("touchmove", function(e){
        // Ignore the event if the window is not currently active or is paused
  		if (!isWindowActive || bPaused) return;

        var oDifferences = _moveHelpers.touchCalculate( _moveHelpers.oTouch.move, e);

        // makes sure no crazy
        if( oDifferences.x < 10 && oDifferences.x > -10 ){
          _moveHelpers.oTouch.move.bFirstTouch = false;
        }

        // first touch will be a huge difference, that"s why we only move after the first touch
        if( !_moveHelpers.oTouch.move.bFirstTouch ){

          // walk		// TODO rewrite these touch funcs without all the trig
          fPlayerX -= ( Math.sin(fPlayerA) + 5.0 * 0.0051 ) * oDifferences.x * 0.05;
          fPlayerY += ( Math.cos(fPlayerA) + 5.0 * 0.0051 ) * oDifferences.x * 0.05;

          // converts coordinates into integer space and check if it is a wall (!.), if so, reverse
          if(map[~~(fPlayerY) * nMapWidth + ~~(fPlayerX)] != "."){
            _moveHelpers.checkExit();
            fPlayerX += ( Math.sin(fPlayerA) + 5.0 * 0.0051 ) * oDifferences.x * 0.05;
            fPlayerY -= ( Math.cos(fPlayerA) + 5.0 * 0.0051 ) * oDifferences.x * 0.05;
          }

          // strafe
          fPlayerX += ( Math.cos(fPlayerA) + 5.0 * 0.0051 ) * -oDifferences.y * 0.05;
          fPlayerY += ( Math.sin(fPlayerA) + 5.0 * 0.0051 ) * -oDifferences.y * 0.05;

          // converts coordinates into integer space and check if it is a wall (!.), if so, reverse
          if(map[~~(fPlayerY) * nMapWidth + ~~(fPlayerX)] != "."){
            _moveHelpers.checkExit();
            fPlayerX -= ( Math.cos(fPlayerA) + 5.0 * 0.0051 ) * -oDifferences.y * 0.05;
            fPlayerY -= ( Math.sin(fPlayerA) + 5.0 * 0.0051 ) * -oDifferences.y * 0.05;
          }
        }
      });

      // reset move
      eTouchMove.addEventListener("touchend", function(){
        _moveHelpers.oTouch.move.x = 0;
        _moveHelpers.oTouch.move.y = 0;
        _moveHelpers.oTouch.move.bFirstTouch = true;
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


  /**
   * Function that handles movement of all sprites
   */
  var _moveSprites = function(){

    // for each sprite object
	for (const sprite of Object.values(oLevelSprites)) {
      // if the sprite"s move flag is set
      if( sprite.move ){
        // var fMovementSpeed = 0.01;
        var fMovementSpeed = sprite.speed || 0.03;

        // move the sprite along it's radiant line
        sprite.x = +(sprite.x) + +(Math.cos(sprite.r)) * fMovementSpeed;
        sprite.y = +(sprite.y) + +(Math.sin(sprite.r)) * fMovementSpeed;
        				// NOTE TODO i don't /think/ all these unary plus operators are necessary

        // collision coordinates (attempting to center sprite)
        var fCollideY = +(sprite.y) - 0.65; // 0.5
        var fCollideX = +(sprite.x) + 0.125; // 0.25

        var fCollideY2 = +(sprite.y) + 0.425; // 0.25
        var fCollideX2 = +(sprite.x) - 0.65; //0.5

        if( map[ ~~(fCollideY) * nMapWidth + ~~(fCollideX)] != "." || map[ ~~(fCollideY2) * nMapWidth + ~~(fCollideX2)] != "." ){

          sprite.stuckcounter++;

          // // reverse last movement
          sprite.x = +(sprite.x) - +(Math.cos(sprite.r)) * fMovementSpeed * 2;	// TODO rewrite this to check before moving sprite, like player movement
          sprite.y = +(sprite.y) - +(Math.sin(sprite.r)) * fMovementSpeed * 2;


          // // repeat may help unstuck sprites
          // sprite.x = +(sprite.x) - +(Math.cos(sprite.r)) * fMovementSpeed;
          // sprite.y = +(sprite.y) - +(Math.sin(sprite.r)) * fMovementSpeed;
          // sprite.x = +(sprite.x) - +(Math.cos(sprite.r)) * fMovementSpeed;
          // sprite.y = +(sprite.y) - +(Math.sin(sprite.r)) * fMovementSpeed;


          // change the angle and visible angle
          sprite.r = (+(sprite.r) + PIx1_5 ) % PIx2; // TODO: sometimes buggy

          // if sprite keeps getting stuck, shove it outta there
          if( sprite.stuckcounter > 10 ){
            sprite.stuckcounter = 0;
            sprite.r = 0.5
            sprite.x = +(sprite.x) - +(Math.cos(sprite.r)) * 0.5;
            sprite.y = +(sprite.y) - +(Math.sin(sprite.r)) * 0.5;

            // sprite.move  = false;
            // sprite.x  = 0;
            // sprite.7  = 0;

          }
        }

        // if sprite is close to the player, and facing the player, turn around
        if( sprite.z < 1 && sprite.a !== "B" ){
          sprite.r = (+(sprite.r) + PIx1_5 ) % PIx2;
        }
    // remove this for now 'cause it's frustrating
        // // if player hits sprite, prevent moving
//         if( sprite.z < 0.75 ){
//           bPlayerMayMoveForward = false;
//         } else {
//           bPlayerMayMoveForward = true;
//         }

        // TODO: sprites hitting each other
        // for(var sj=0; sj < Object.keys(oLevelSprites).length; sj++ ){
        //   var jsprite = oLevelSprites[Object.keys(oLevelSprites)[sj]];
        //   if( jsprite.z - sprite.z > 2 ){
        //     jsprite.r = (+(sprite.r) + PIx1_5 ) % PIx2;
        //   }
        // }

      } // end if sprite move
    }
  };


  /**
   * Sorts List
   */
  function _sortSpriteList( b, a ) {
    if ( a.z < b.z ){
      return -1;
    } else if ( a.z > b.z ){
      return 1;
    }
    return 0;
  }


  /**
   * Sorts the Sprite list based on distance from the player
   */
   var _updateSpriteBuffer = function(){

    	// converts object of objects to list
    oLevelSprites = {
    	...(Object.values(oLevelSprites).map(sprite => {
    		    // calculates the distance to the player
    		sprite.z = Math.sqrt((sprite.x - fPlayerX) ** 2 + (sprite.y - fPlayerY) ** 2);
    		return sprite;
    	}).sort(_sortSpriteList))    // sorts the list
    };		    // make object from array again
  };


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

      _updateSpriteBuffer();
//       _moveSprites();		// DEBUG don't move sprites while I work on better render logic


      /**
       * Player-movement related
       */

	  if (bPlayerMoving()) {
	    _moveHelpers.move(viewX, viewY);
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



      // for the length of the screenwidth (one frame)
      for(var screenColumn = 1; screenColumn <= nScreenWidth; screenColumn++) {

        // calculates the ray angle into the world space
        // take the current player angle, subtract half the field of view
        // and then chop it up into equal little bits of the screen width (at the current column)
//         var fRayAngle = (fPlayerA - fFOV / 1.8) + (screenColumn / nScreenWidth) * fFOV;
        	// TODO calc first ray angle outside of individual ray loop
        		// then calc interval between rays
        		// then just add interval to original angle on each iteration
        		// see https://tech.nextroll.com/blog/dev/2022/02/02/rustenstein.html

		let cameraX = (2 * screenColumn / nScreenWidth) - 1;
		let rayDirX = viewX + (planeX * cameraX);
		let rayDirY = viewY + (planeY * cameraX);


        var bBreakLoop = false;

        var fDistanceToWall = 0;
	let fDistToDoor = 0;
	let addlDoorDist = 0;		// DEBUG only

        var fDistanceToObject = 0;
        var fDistanceToInverseObject = 0;

        var bHitWall = false;

        var bHitObject = false;
        var bHitBackObject = false;

        var sWalltype = "#";
        var sObjectType = "0";
        let isBoundary = false;

//         var fEyeX = Math.cos(fRayAngle); // I think this determines the line the testing travels along
//         var fEyeY = Math.sin(fRayAngle);

        var fSampleX = 0.0;
        var sWallDirection = "N";

        var nRayLength = 0.0;

        // var nGrainControl = 0.1;
//         var nGrainControl = 0.05;

        var map_x = ~~(fPlayerX);	// the player's current map xy coordinates
		var map_y = ~~(fPlayerY);	// TODO get all this stuff that is constant out of this loop, actually this needs to be reset every ray

		visitedTiles[map_y * nMapWidth + map_x] = currentFrame;	// TODO maybe just check the player XY instead of setting this for sprites

      	let tileType = map[map_y * nMapWidth + map_x];	// NOTE this could be only inside loop, I want it right now so we can debug what the ray is hitting by saving into rayOb	// ACTUALLY i think I might have meant outside the loop, it doesn't change with the rays cast

      	var delta_x = Math.abs(1 / rayDirX);	// the dist the ray must travel to reach the border of the next tile
      	var delta_y = Math.abs(1 / rayDirY);

      	var hit_side = side_dist_x < side_dist_y ? 0 : 1;

      	var step_x = absSign(rayDirX);
      	var step_y = absSign(rayDirY);

      		// calculate distance to initial tile boundary
      	var side_dist_x = delta_x * (step_x === 1 ? (map_x + 1 - fPlayerX) : (fPlayerX - map_x));
      	var side_dist_y = delta_y * (step_y === 1 ? (map_y + 1 - fPlayerY) : (fPlayerY - map_y));

      	// check if player is on door tile, so we can properly render it
      	let playerInsideDoorTile = map[~~fPlayerY * nMapWidth + ~~fPlayerX] === 'X';

		if (playerInsideDoorTile) {	// NOTE this is not working, just comment out for now
// 			bHitWall = true;

			fDistanceToWall = hit_side === 0 ? side_dist_x - delta_x : side_dist_y - delta_y;

			fDistToDoor = fDistanceToWall + Math.abs(0.5 / (hit_side === 0 ? rayDirX : rayDirY));

			let distToDoorX = ~~(fPlayerX + fDistToDoor * rayDirX);
			let distToDoorY = ~~(fPlayerY + fDistToDoor * rayDirY);

			bBreakLoop = map_x === distToDoorX && map_y === distToDoorY && fDistToDoor >= 0;
            sWalltype = tileType;
		}

        /**
         * Ray Casting Loop
         */
        while(!bBreakLoop && nRayLength < fDepth * 2){

		  if(side_dist_x < side_dist_y) {
			side_dist_x += delta_x;
			map_x += step_x;
			hit_side = 0;
		  } else {
			side_dist_y += delta_y;
			map_y += step_y;
			hit_side = 1;
		  }

          visitedTiles[map_y * nMapWidth + map_x] = currentFrame;
		  tileType = map[map_y * nMapWidth + map_x];

          // test if ray hits out of bounds
          if(map_x < 0 || map_x >= nMapWidth || map_y < 0 || map_y >= nMapHeight){
//             bHitWall = true; // didn't actually, just no wall there, with this enabled we paint a wall, but we can still go through it
            fDistanceToWall = fDepth;
            bBreakLoop = true;
          }

          // test for objects		// NOTE TODO holes in the floor are not rendering at all
          else if(tileType == "o" || tileType == ","){
          	if(!bHitObject) fDistanceToObject = hit_side === 0 ? side_dist_x - delta_x : side_dist_y - delta_y;
            bHitObject = true;
            sObjectType = tileType;
          } // else if(bHitObject == true && tileType !== "o"){
//           	if(!bHitBackObject) fDistanceToInverseObject = hit_side === 0 ? side_dist_x - delta_x : side_dist_y - delta_y;
//             bHitBackObject = true;
//           }

          else if (tileType === 'X') {		// exit door
          	bHitWall = true;

            fDistanceToWall = hit_side === 0 ? side_dist_x - delta_x : side_dist_y - delta_y;

			fDistToDoor = fDistanceToWall + Math.abs(0.5 / (hit_side === 0 ? rayDirX : rayDirY));

			let distToDoorX = ~~(fPlayerX + fDistToDoor * rayDirX);
			let distToDoorY = ~~(fPlayerY + fDistToDoor * rayDirY);

			bBreakLoop = map_x === distToDoorX && map_y === distToDoorY;
            sWalltype = tileType;
//             isBoundary = true;
          }

          // Test for walls	// NOTE why is it not....like, testing /for/ walls...
          else if( tileType != "." ) {
            bHitWall = true;
            fDistanceToWall = hit_side === 0 ? side_dist_x - delta_x : side_dist_y - delta_y;
            bBreakLoop = true;

            sWalltype = tileType;

			// var isBoundary = true;		// NOTE i only guessed that this needs to be true, it seemed like it was set when they nieve raytraced rays were found to be close to tile boundary
// 			isBoundary = true;
          }

	          // save back of object distance as soon as we're out of it
          if(bHitObject == true && tileType !== "o") {	// if we get multiple objects we'll eventually need to make an array of them or something and loop through them to check when we leave a specific one
          		// well, if we don't have them overlapping in a single screen column....
          		// TODO test how this might work with two separate holes, we'll need to paint hole, then floor, then hole
          	if(!bHitBackObject) fDistanceToInverseObject = hit_side === 0 ? side_dist_x - delta_x : side_dist_y - delta_y;
            bHitBackObject = true;
          }

        } // end ray casting loop



// 		nRayLength = hit_side === 0 ? side_dist_x - delta_x : side_dist_y - delta_y;

		if(hit_side === 0) {		// NS wall	// sin(RayAng) gives normalized Ray Vector
			fSampleX = fPlayerY + fDistanceToWall * rayDirY;
			sWallDirection = step_x === 1 ? "W" : "E";
		} else {
			fSampleX = fPlayerX + fDistanceToWall * rayDirX;
			sWallDirection = step_y === 1 ? "N" : "S";
		}

		// used to place texture exactly where ray hit wall
		fSampleX -= ~~(fSampleX);

			// NOTE i think tracking objects and...whatever a backObject is this way
				// only allows a ray to "hit" one, the last one
				// we might need to make some way to track what object is hit
				// and the distance to that specific object
// 		if( bHitObject ) fDistanceToObject = nRayLength;
// 		if( bHitBackObject ) fDistanceToInverseObject = nRayLength;
// 		if( bHitWall ) fDistanceToWall = nRayLength;
			// TODO i feel like these could be bumped up into the above tile checks
				// but the first time I did it the renderer completely broke
				/// FOLLWUP, so the original incremented each of these fDistance... vars
					// inside the ray cast loop, while the <things> were NOT hit
					// thus stopping updating them when they were hit
				// I feel like I could keep them out, but I might need an hit_side
					// var for each object maybe
				// at the very least I need to record the ray length whenever a thing is hit
					// and not update it afterwards

			// NOTE isBoundary is only used for the solid wall rendering
				// it also effects the holes

		if (fSampleX <= edgeThreshold || fSampleX >= 1.0 - edgeThreshold) {
			if(hit_NS_wall) {
				tileCheckLocDif = sWallFaceDirection === 'W' ? -1 : 1;
				isBoundary = sWalltype !== map[map_y * nMapWidth + map_x + tileCheckLocDif];
			} else {
				tileCheckLocDif = sWallFaceDirection === 'S' ? -1 : 1;
				isBoundary = sWalltype !== map[(map_y + tileCheckLocDif) * nMapWidth + map_x];
			}
		}



        // at the end of ray casting, we should have the lengths of the rays
        // set to their last value, representing their distances
        // based on the distance to wall, determine how much floor and ceiling to show per column,
        // Adding in the recalc for looking (fLookTimer) and jumping (nJumptimer)
        var wallHeight = Math.round(nScreenHeight / fDistanceToWall);
        var nCeiling = screenSkew - wallHeight / 2;
	var nFloor   = screenSkew + wallHeight / 2;


        // similar for towers and gates
        let nTower = screenSkew - wallHeight / 2 - wallHeight;

			// technique from original wolf3d code (I think), and also this guy: https://github.com/permadi-com/ray-cast/blob/master/demo/1/sample1.js
			// TODO put all these types of calcs in each "hit object" code so it doesn't run all the time
		let nDoorHeight = Math.round(nScreenHeight / fDistToDoor)	// TODO change the gate render, make the blockV on the left and right edges
        let nDoorFrameTop = screenSkew - nDoorHeight / 2;			//  (maybe in the center, like striped), and blockH in the center
        let nDoorFrameBot = screenSkew + nDoorHeight / 2;			// Second, try to actually give it an upper door jamb
				        										// ALSO, standardize Door vs Gate in var and func names

        // similar operation for objects		// TODO calc these like we did for walls and doors probably
        var nObjectCeiling = screenSkew - nScreenHeight / fDistanceToObject / 2;
        var nObjectFloor = screenSkew + nScreenHeight / fDistanceToObject / 2;
        var nFObjectBackwall = screenSkew + (nScreenHeight / (fDistanceToInverseObject + 0) /2 ); // 0 makes the object flat, higher the number, the higher the object :)


        // the spot where the wall was hit
        fDepthBuffer[screenColumn] = fDistanceToWall;

// DEBUG ONLY print out details on the Tower block, and see why we're painting shader in the sky
//_debugOutput(`SprDist: ${fSpriteDist}; SprH: ${fSpriteHeight}; SprCeil: ${fSpriteCeiling}; SprFlr: ${fSpriteFloor}`, 'debug2');

        // draw the columns one screenheight-pixel at a time
        for(var screenRow = 0; screenRow < nScreenHeight; screenRow++){

          // sky
          if( screenRow < nCeiling){

            // case of tower block (the bit that reaches into the ceiling)
            if(sWalltype == "T"){
              if( screenRow > nTower ) {

                var fSampleY = ( (screenRow - nTower) / (nCeiling - nTower) );

                screen[screenRow * nScreenWidth + screenColumn] = _rh.renderWall(fDistanceToWall, sWallDirection, _getSamplePixel(textures[sWalltype], fSampleX, fSampleY));
              } else {
                screen[screenRow * nScreenWidth + screenColumn] = starPicker() ? '.' : brightness[0];
              }
            } else {		// draw ceiling/sky
              if(sWalltype == ",") {
                screen[screenRow * nScreenWidth + screenColumn] = "1";
              } else {
                screen[screenRow * nScreenWidth + screenColumn] = starPicker() ? '.' : brightness[0];
              }
            }		          // solid block
          } else if( screenRow > nCeiling && screenRow <= nFloor && !(screenRow >= nDoorFrameBot && sWalltype == 'X') ) {

            // Door/exit Walltype
            if(sWalltype == "X"){
			  if (screenRow > nDoorFrameTop) {
				screen[screenRow * nScreenWidth + screenColumn] = _rh.renderGate(screenRow, fDistToDoor, nDoorFrameTop, nCeiling);
              } else {
                screen[screenRow * nScreenWidth + screenColumn] = starPicker() ? '.' : brightness[0];
              }
            }  else if(sWalltype != "." || sWalltype == "T") {		// Solid Walltype

              var fSampleY = ( (screenRow - nCeiling) / (nFloor - nCeiling) );

              /**
               * animation timer example
               */
              // if( animationTimer < 5 ){
              //   screen[screenRow * nScreenWidth + screenColumn] = _getSamplePixel(texture, fSampleX, fSampleY);
              // } else if( animationTimer >= 5 && animationTimer < 10 ) {
              //   screen[screenRow * nScreenWidth + screenColumn] = _getSamplePixel(texture2, fSampleX, fSampleY);
              // } else if( animationTimer >= 10 ) {
              //   screen[screenRow * nScreenWidth + screenColumn] = _getSamplePixel(texture3, fSampleX, fSampleY);
              // }


              // Render Texture Directly
              if( nRenderMode == 1 ){
                screen[screenRow * nScreenWidth + screenColumn] = _getSamplePixel(textures[sWalltype], fSampleX, fSampleY);
              } else if( nRenderMode == 2 ) {		// Render Texture with Shading
                screen[screenRow * nScreenWidth + screenColumn] = _rh.renderWall(fDistanceToWall, sWallDirection, _getSamplePixel(textures[sWalltype], fSampleX, fSampleY));
              } else if( nRenderMode == 0 ) {	// old, solid-style shading
                screen[screenRow * nScreenWidth + screenColumn] = _rh.renderSolidWall(fDistanceToWall, isBoundary);
              }
            } else {		// render whatever char is on the map as walltype
              screen[screenRow * nScreenWidth + screenColumn] = sWalltype;
            }
          } else {		// floor
            screen[screenRow * nScreenWidth + screenColumn] = _rh.renderFloor(screenRow);
          }
        } // end draw column loop


    	if(screenColumn === nScreenWidth / 2 && (sWalltype == '#' || sWalltype == 'X')) {
/*
			midFrameInfoMsg = `
			fDistToDoor: ${fDistToDoor.toFixed(3)}; nDoorHeight: ${nDoorHeight.toFixed(3)};
			nDoorFrameTop: ${nDoorFrameTop.toFixed(3)}; nDoorFrameBot: ${nDoorFrameBot.toFixed(3)};<br>
			fDistanceToWall: ${fDistanceToWall.toFixed(3)}; wallHeight: ${wallHeight.toFixed(3)};
			nCeiling: ${nCeiling.toFixed(3)}; nFloor: ${nFloor.toFixed(3)};
			`;
 */
 			midFrameInfoMsg = `
			fDistanceToObject: ${fDistanceToObject};
			nObjectCeiling: ${nObjectCeiling.toFixed(3)};
			nObjectFloor: ${nObjectFloor.toFixed(3)};
			fDistanceToInverseObject: ${fDistanceToInverseObject};
			nFObjectBackwall: ${nFObjectBackwall.toFixed(3)};
			fDistanceToWall: ${fDistanceToWall};
			nFloor: ${nFloor}
			`;
    	}

		if(midFrameInfoMsg !== '' || endDoorInfoMsg !== '') {
			_debugOutput(`${midFrameInfoMsg}<br>${endDoorInfoMsg}`, 'debug2');
		}


        // Object-Draw (removed overlayscreen)
        for(var y = 0; y < nScreenHeight; y++){
          if( y > nObjectCeiling && y <= nObjectFloor ){
            if(sObjectType == "o"){
              if( y >=  nFObjectBackwall ){
                screen[y * nScreenWidth + screenColumn] = _rh.renderSolidWall(fDistanceToObject, isBoundary);
              }
            }
          }
        } // end draw column loop
      }  // end column loop


      // draw sprites	// TODO change this to an array of objects probably
	  for (const sprite of Object.values(oLevelSprites)) {

		let spriteTileIndex = ~~sprite.y * nMapWidth + ~~sprite.x;

// 		let spriteTileAdjacentCardinals = [spriteTileIndex, spriteTileIndex + 1, spriteTileIndex - 1,
// 											spriteTileIndex + nMapWidth, spriteTileIndex + nMapWidth + 1, spriteTileIndex + nMapWidth - 1,
// 											spriteTileIndex - nMapWidth, spriteTileIndex - nMapWidth + 1, spriteTileIndex - nMapWidth - 1];
		let spriteTileAdjacentCardinals = [spriteTileIndex];

		let spriteTileNotVisited = spriteTileAdjacentCardinals.some(tileIndex => visitedTiles[tileIndex] !== currentFrame);

		if(spriteTileNotVisited) {
// 			_debugOutput(`STV: ${!spriteTileNotVisited}`, 'debug2');
			continue;
		}

		// reference to the global-side sprite
        var currentSpriteObject = allSprites[sprite.name];

		// Translate sprite position relative to the player
        let playerToSpriteX = sprite.x - fPlayerX;
        let playerToSpriteY = sprite.y - fPlayerY;

        // Rotate sprite into player's local space using your view angles
	    let invDet = 1.0 / (planeX * viewY - viewX * planeY);
	    	// Transform sprite position into camera space using the inverse matrix
		// spriteViewX is the lateral (left/right) offset on the screen plane
		// fSpriteDist is the depth
		let spriteViewX = invDet * (viewY * playerToSpriteX - viewX * playerToSpriteY);
		let fSpriteDist = invDet * (-planeY * playerToSpriteX + planeX * playerToSpriteY);

	    if (fSpriteDist < MIN_DIST) {
//	     	_debugOutput(`STV: ${!spriteTileNotVisited}; STC: ${fSpriteDist < MIN_DIST}`, 'debug2');
        	continue; // Sprite is directly behind or on top of the player
        }

	        // project onto screen
        let spriteScreenX = (nScreenWidth / 2) * (1 + spriteViewX / fSpriteDist);

        	// TODO add constant for wall height, 16
        let fSpriteHeight = nScreenHeight / fSpriteDist;

        let bInPlayerView = true;		// NOTE this should be removed at some point, we'll only have visible sprites at this point


        // only proceed if sprite is visible
        if( bInPlayerView && fSpriteDist >= 0.5 ) {

          // very similar operation to background floor and ceiling.
          // Sprite height is default 1, but we can adjust with the factor passed in the sprite object/
	      var fSpriteCeiling = screenSkew - fSpriteHeight / 2 * currentSpriteObject.hghtFctr;
		  var fSpriteFloor = fSpriteCeiling - fSpriteHeight;

// 		  _debugOutput(`SprDist: ${fSpriteDist}; SprH: ${fSpriteHeight}; SprCeil: ${fSpriteCeiling}; SprFlr: ${fSpriteFloor}`, 'debug2');

				// NOTE does this need rounding? try without sometime, or ~~
          var fSpriteCeiling = Math.round(fSpriteCeiling);
          var fSpriteFloor = Math.round(fSpriteFloor);

          var fSpriteAspectRatio = +(currentSpriteObject.height) / +(currentSpriteObject.width * currentSpriteObject.aspctRt);
          var fSpriteWidth = fSpriteHeight / fSpriteAspectRatio;
          var fMiddleOfSprite = spriteScreenX;

          // The angle the sprite is facing relative to the player
          var fSpriteBeautyAngle = fPlayerA - sprite.r + PIdiv4;
          // normalize
          if (fSpriteBeautyAngle < 0){
            fSpriteBeautyAngle += PIx2;
          }
          if (fSpriteBeautyAngle > PIx2){
            fSpriteBeautyAngle -= PIx2;
          }

          // loops through the sprite pixels
          for(var sx = 0; sx < fSpriteWidth; sx++ ) {
            for(var sy = 0; sy < fSpriteHeight; sy++) {

              // sample sprite
              var fSampleX = sx / fSpriteWidth;
              var fSampleY = sy / fSpriteHeight;

              var sSamplePixel = "";

              // var sSpAngle = false;
              var sAnimationFrame = false;

              // animation-cycle available, determine the current cycle
              // TODO: randomize cycle position
              if( sprite.move && "walkframes" in currentSpriteObject ){
                if( animationTimer < 5 ){
                  sAnimationFrame = "W1";
                } else if( animationTimer >= 5 && animationTimer < 10 ) {
                  sAnimationFrame = "W2";
                } else if( animationTimer >= 10 ) {
                  sAnimationFrame = false;
                }
              }

              // sample-angled glyph is available
              if( "angles" in currentSpriteObject ){

                if( fSpriteBeautyAngle >= PI_0 && fSpriteBeautyAngle < PIx05 ){
                  sprite.a = "B";
                } else if( +(fSpriteBeautyAngle) >= +(PIx05) && +(fSpriteBeautyAngle) < +(PIx1) ) {
                  sprite.a = "L";
                } else if( +(fSpriteBeautyAngle) >= +(PIx1) && +(fSpriteBeautyAngle) < +(PIx1_5) ) {
                  sprite.a = "F";
                } else if( +(fSpriteBeautyAngle) >= +(PIx1_5) && +(fSpriteBeautyAngle) < +(PIx2) ) {
                  sprite.a = "R";
                }
              }


              // check if object has both, angles, or animations
              if( sprite.a && sAnimationFrame ) {
                sSamplePixel = _getSamplePixel(currentSpriteObject.angles[sprite.a][sAnimationFrame], fSampleX, fSampleY);
              } else if( sprite.a ) {
                sSamplePixel = _getSamplePixel(currentSpriteObject.angles[sprite.a], fSampleX, fSampleY);
              } else if( sAnimationFrame ) {
                sSamplePixel = _getSamplePixel(currentSpriteObject[sAnimationFrame], fSampleX, fSampleY);
              } else {
                // if not, use basic sprite
                sSamplePixel = _getSamplePixel(currentSpriteObject, fSampleX, fSampleY);
              }


              // assign based on render mode
              if( nRenderMode == 2 || nRenderMode == 0 ){
                sSpriteGlyph = _rh.renderWall( fSpriteDist, "W", sSamplePixel );
              } else {
                sSpriteGlyph = sSamplePixel;
              }


              var nSpriteColumn = ~~((fMiddleOfSprite + sx - (fSpriteWidth / 2)));

              if (nSpriteColumn >= 0 && nSpriteColumn < nScreenWidth){
                // only render the sprite pixel if it is not a . or a space, and if the sprite is far enough from the player
                if (sSpriteGlyph != "." && sSpriteGlyph != brightness[0] && fDepthBuffer[nSpriteColumn] >= fSpriteDist ) {

                  // render pixels to screen
                  var yccord = fSpriteCeiling + sy;
                  var xccord = nSpriteColumn;
                  screen[ yccord * nScreenWidth + xccord ] = sSpriteGlyph;
                  fDepthBuffer[nSpriteColumn] = fSpriteDist;
                }
              }
            }
          }
        } else {	// player was hit
          // clearInterval(gameRun);
        }

      }

      _fDrawFrame(screen, false);

    }
  };


  // for every row make a nScreenWidth amount of pixels
  var _createTestScreen = function(){
    var sOutput = "";
    for(var screnCol = 0; screnCol < nScreenHeight; screnCol++){
      for(var screenRow = 0; screenRow < nScreenWidth; screenRow++){
        sOutput += brightness[0];
      }
      sOutput += "<br>";
    }
    eScreen.innerHTML = sOutput;
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
  var _testScreenSizeAndStartTheGame = function(){

    // render a static test screen
    _createTestScreen();

    var widthOfDisplay   = eScreen.offsetWidth;
    var widthOfViewport  = _getWidth();
    var heightOfViewPort = _getHeight();
    var viewPortAspect   = heightOfViewPort / widthOfViewport;

    // check if the amount of pixels to be rendered fit, if not, repeat
    if(widthOfDisplay > widthOfViewport + 120){
      nScreenWidth = nScreenWidth - 1;
      // nScreenHeight = nScreenWidth * 0.22


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
      _debugOutput(fAdjustedAspectRatio, 'debug');

      if( fAdjustedAspectRatio < 0.266 ){
        fAdjustedAspectRatio = 0.266;
      }

      nScreenHeight = nScreenWidth * fAdjustedAspectRatio;
      main();
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

    _moveHelpers.keylisten();
    _moveHelpers.mouseinit();
    _moveHelpers.touchinit();

    // TODO: move to in-game menu
    document.getElementById("solid").addEventListener("click", function(){ nRenderMode = 0 });
    document.getElementById("texture").addEventListener("click", function(){ nRenderMode = 1 });
    document.getElementById("shader").addEventListener("click", function(){ nRenderMode = 2 });

    // initial gameload
    _loadLevel("levelfile1.map");
  };


  return{
    init: init,
  }
})();
