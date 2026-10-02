export {_r, _rh};

import {game, player} from './main-game-engine.js';
import {_debugOutput, brightness, viewWindow, map, charLookup, codePointLookup, CHAR_CACHE} from './main-io.js';

/*
	original top level funcs:
		_getSamplePixel
		_printCompositPixel
		_fPrepareFrame
		_fDrawFrame
		_moveSprites
		_updateSpriteBuffer

	original _rh funcs:
		renderWall
		renderSolidWall
		renderGate
		renderFloor
		renderCeiling

	originally in gameLoop()
		drawSprites
*/


/*
	functions in _r:
		getSamplePixel|printCompositPixel|fPrepareFrame|fDrawFrame|moveSprites|updateSpriteBuffer|drawSprites

*/

const MIN_DIST = 0.1; // Prevent division by zero if standing exactly on a sprite	// RENDERER only

const pfOutput = new Array(viewWindow.width * Math.round(viewWindow.height));
const dfOutput = new Array(viewWindow.width * Math.round(viewWindow.height));
let removeFrom = [];		// TODO change to Unit8Array


let _r = {

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
	  getSamplePixel: function(texture, x, y){

		var scaleFactor = texture?.scale  || defaultTexScale;
		var texWidth    = texture?.width  || defaultTexWidth;
		var texHeight   = texture?.height || defaultTexHeight;

		var texpixels = texture.texture;

		if( texpixels instanceof Map ){
		  // Different Texture based on viewport
		  if( player.ang > 0 && player.ang < Math.PI ){
			texpixels = texpixels.get('S');
		  } else {
			texpixels = texpixels.get('N');
		  }
		}

		scaleFactor = scaleFactor || 2;

		x = scaleFactor * x%1;
		y = scaleFactor * y%1;

		var sampleX = ~~(texWidth * x);
		var sampleY = ~~(texHeight * y);

		var samplePosition = (texWidth * (sampleY)) + sampleX;

		if( x < 0 || x > texWidth || y < 0 || y > texHeight ){
		  return "+".charCodeAt(0);	// HACK, swap for real code
		} else {
		  let retVal = texpixels[samplePosition];
		  if(retVal === 'undefined')
			console.log(retVal);
		  return retVal;
		}
	  },

	    /**
   * Determines with Pixels to use, sInput
   * @param  {string} oInput    Main Pixel
   * @param  {string} sOverlay  Overlay Pixel
   * @param  {int} nIndex       Index
   * @return {[string]}         Final Pixel
   */
  printCompositPixel: function(sInput, sOverlay, nIndex){
    // if sOverlay !0, appends it to the output instead
    if( sOverlay && sOverlay[nIndex] != 0){
	return sOverlay[nIndex];
    } else {
		return CHAR_CACHE[sInput[nIndex]];
    }
    return '';
  },



  /**
   * Creates a new array of pixels taking looking up and down into account
   * It returns an array to be rendered later.
   * the aim is to remove the first and last 30 pixels of very row,
   * to obscure the skewing
   */		// NOTE TODO i think this is where the skewing can be improved
  fPrepareFrame: function(oInput, oOverlay, eTarget){
    var oOverlay = oOverlay || false;
    var eTarget  = eTarget || viewWindow.outputEl;
    pfOutput.length = 0;


    // this is the maximum of variation created by the lookup timer, aka the final lookmodifier value
    var neverMoreThan = Math.round(viewWindow.height / _skipEveryXrow(game.fLooktimer) - 1);

    // used to skew the image
    var globalPrintIndex = 0;
    var fLookModifier = 0;

    // if looking up, the starting point is the max number of pixesl to indent,
    // which will be decremented, otherwise it remains 0, which will be incremented
    if( game.fLooktimer > 0 && isFinite(neverMoreThan) ){
      fLookModifier = neverMoreThan;
    }


    // interate each row at a time
    for(var row = 0; row < viewWindow.height; row++){

      // increment the fLookModifier every time it needs to grow (grows per row)
      if ( _everyAofB(row, _skipEveryXrow(game.fLooktimer)) ) {
						// looking up
          game.fLooktimer > 0 ? fLookModifier-- : fLookModifier++;
      }

      // print filler pixels
      for(var i=0; i<fLookModifier; i++){
        pfOutput.push( "." );
      }

      var toBeRemoved = (2 * fLookModifier);

      // list to be removed from each row:
      // [1,2,3,4,5,6,7,8]
      // [1,2, ,4,5, ,7,8]
      //   [1,2,4,5,7,8]
      removeFrom = _evenlyPickItemsFromArray(viewWindow.width, toBeRemoved);

// TODO change this to an array.from() line, using the mapFn parameter, see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from
      for(var rpix = 0; rpix < viewWindow.width; rpix++) {      // loops through each rows of pixels
      // TODO change removeFrom to a dense array with the "removed" elements as undefined
			  // then we can just perform a regular array lookup (instead of includes)
			  // whcih should be faster
        if (!removeFrom.includes(rpix)) {        // print only if the pixel is in the list of pixels to print
          pfOutput.push(CHAR_CACHE[oInput[globalPrintIndex]] );
        }

        globalPrintIndex++;
      } // end for(rpix)
      for(var i=0; i<fLookModifier; i++){
        pfOutput.push( "." );		      // print filler pixels
      }

    } // end for(row)

    return pfOutput;
  },


		// this might be better in io, named drawToScreen
  fDrawFrame: function(overlayscreen, target) {

    var frame = _r.fPrepareFrame(viewWindow.buffer, overlayscreen);
// 	var frame = screen;		// DEBUG uncomment to remove skew from look up/down rendering
    var target = target || viewWindow.outputEl;

	dfOutput.length = 0;
	viewWindow.clearCanvas();
	let fontHeight = viewWindow.canvasFontHeight;
	let lineheight = fontHeight * 1.75;

    // interates over each row again, and omits the first and last 30 pixels, to disguise the skewing!
    var printIndex = 0;		// w/ original 80 height, removePixels was 40 (despite quote of 30 above)
    var removePixels = viewWindow.height / 2;			// TODO to be able to calculate this and actually have nice look up/down skewing
    for(var row = 0; row < viewWindow.height; row++){	// determine the allowed up/down angle, calc how much that would transform a 90deg
														// implement the skew in a continuous way (a greater number of more granular steps)
															// add logic to expand the visuals that are being skewed instead of just adding
																// extra dots '.' (which is done in fPrepareFrame() function)

      dfOutput.push(...frame.slice(row * viewWindow.width + ~~removePixels, (row + 1) * viewWindow.width - ~~removePixels));
      //       dfOutput.push("<br>");	// innerHTML version		// line, build that calc into the skipEveryX() function
      dfOutput.push("\n");	// textContent or canvas version
	  viewWindow.canvasText(frame.slice(row * viewWindow.width + ~~removePixels, (row + 1) * viewWindow.width - ~~removePixels).join(''), 0, lineheight * row + lineheight);		// corrected/trimmed screen
    }
    target.textContent = dfOutput.join('');
  },


  /**
   * Function that handles movement of all sprites
   */
  moveSprites: function() {		// NOTE TODO this could probably be in some kind of game logic module
									// maybe physics because it has to do with the movement of in game objects

    // for each sprite object
	for (const sprite of Object.values(map.sprites)) {
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

        if( map.tiles[ ~~(fCollideY) * map.width + ~~(fCollideX)] != ".".charCodeAt(0) || map.tiles[ ~~(fCollideY2) * map.width + ~~(fCollideX2)] != ".".charCodeAt(0) ){

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
          sprite.r = (+(sprite.r) + +(Math.PI * 1.5) ) % +(Math.PI * 2.0); // TODO: sometimes buggy

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
          sprite.r = (+(sprite.r) + +(Math.PI * 1.5) ) % +(Math.PI * 2.0);
        }
    // remove this for now 'cause it's frustrating
        // // if player hits sprite, prevent moving
//         if( sprite.z < 0.75 ){
//           bPlayerMayMoveForward = false;
//         } else {
//           bPlayerMayMoveForward = true;
//         }

        // TODO: sprites hitting each other
        // for(var sj=0; sj < Object.keys(map.sprites).length; sj++ ){
        //   var jsprite = map.sprites[Object.keys(map.sprites)[sj]];
        //   if( jsprite.z - sprite.z > 2 ){
        //     jsprite.r = (+(sprite.r) + +(Math.PI * 1.5) ) % +(Math.PI * 2.0);
        //   }
        // }

      } // end if sprite move
    }
  },


  /**
   * Sorts the Sprite list based on distance from the player
   */
   updateSpriteBuffer: function() {

    	// converts object of objects to list
    map.sprites = {
    	...(Object.values(map?.sprites).map(sprite => {
    		    // calculates the distance to the player
    		sprite.z = Math.sqrt((sprite.x - player.x) ** 2 + (sprite.y - player.y) ** 2);
    		return sprite;
    	}).sort(_sortSpriteList))    // sorts the list
    };		    // make object from array again
  },


  drawSprites: function() {
      // draw sprites	// TODO change this to an array of objects probably
	  for (const sprite of Object.values(map.sprites)) {

		let spriteTileIndex = ~~sprite.y * map.width + ~~sprite.x;

// 		let spriteTileAdjacentCardinals = [spriteTileIndex, spriteTileIndex + 1, spriteTileIndex - 1,
// 											spriteTileIndex + map.width, spriteTileIndex + map.width + 1, spriteTileIndex + map.width - 1,
// 											spriteTileIndex - map.width, spriteTileIndex - map.width + 1, spriteTileIndex - map.width - 1];
		let spriteTileAdjacentCardinals = [spriteTileIndex];

		let spriteTileNotVisited = spriteTileAdjacentCardinals.some(tileIndex => map.visitedTiles[tileIndex] !== game.currentFrame);

		if(spriteTileNotVisited) {
// 			_debugOutput(`STV: ${!spriteTileNotVisited}`, 'debug2');
			continue;
		}

		// reference to the global-side sprite
        var currentSpriteObject = allSprites[sprite.name];

		// Translate sprite position relative to the player
        let playerToSpriteX = sprite.x - player.x;
        let playerToSpriteY = sprite.y - player.y;

        // Rotate sprite into player's local space using your view angles
	    let invDet = 1.0 / (viewWindow.planeX * player.viewY - player.viewX * viewWindow.planeY);
	    // Transform sprite position into camera space using the inverse matrix
			// spriteViewX is the lateral (left/right) offset on the screen plane
			// fSpriteDist is the depth
		let spriteViewX = invDet * (player.viewY * playerToSpriteX - player.viewX * playerToSpriteY);
		let fSpriteDist = invDet * (-viewWindow.planeY * playerToSpriteX + viewWindow.planeX * playerToSpriteY);

        if (fSpriteDist < MIN_DIST) {
//         	_debugOutput(`STV: ${!spriteTileNotVisited}; STC: ${fSpriteDist < MIN_DIST}`, 'debug2');
            continue; // Sprite is directly behind or on top of the player
        }

        // project onto screen
        let spriteScreenX = (viewWindow.width / 2) * (1 + spriteViewX / fSpriteDist);

        		// TODO add constant for wall height, 16
        let fSpriteHeight = viewWindow.height / fSpriteDist;

        let bInPlayerView = true;		// NOTE this should be removed at some point, we'll only have visible sprites at this point


        // only proceed if sprite is visible
        if( bInPlayerView && fSpriteDist >= 0.5 ){

          // very similar operation to background floor and ceiling.
          // Sprite height is default 1, but we can adjust with the factor passed in the sprite object/
//           var fSpriteCeiling = +(viewWindow.height / ((2 - game.nJumptimer * 0.15) - game.fLooktimer * 0.15)) - viewWindow.height / (+(fSpriteDist) ) * currentSpriteObject.hghtFctr;
//           var fSpriteFloor = +(viewWindow.skew) + viewWindow.height / (+(fSpriteDist) );

          var fSpriteCeiling = viewWindow.skew - fSpriteHeight / 2 * currentSpriteObject.hghtFctr;	// NOTE TODO why did I add viewWindow.skew to this?
		  var fSpriteFloor = fSpriteCeiling - fSpriteHeight;

// 		  _debugOutput(`SprDist: ${fSpriteDist}; SprH: ${fSpriteHeight}; SprCeil: ${fSpriteCeiling}; SprFlr: ${fSpriteFloor}`, 'debug2');

// 		  var fSpriteFloor = nFloor;
//           var fSpriteCeiling = nFloor + fSpriteHeight;

				// NOTE does this need rounding? try without sometime, or ~~
          var fSpriteCeiling = Math.round(fSpriteCeiling);
          var fSpriteFloor = Math.round(fSpriteFloor);

//           var fSpriteHeight = fSpriteFloor - fSpriteCeiling;
          var fSpriteAspectRatio = +(currentSpriteObject.height) / +(currentSpriteObject.width * currentSpriteObject.aspctRt);
          var fSpriteWidth = fSpriteHeight / fSpriteAspectRatio;
          var fMiddleOfSprite = spriteScreenX;

          // The angle the sprite is facing relative to the player
          var fSpriteBeautyAngle = player.ang - sprite.r + Math.PI / 4.0;
          // normalize
          if (fSpriteBeautyAngle < 0){
            fSpriteBeautyAngle += +(Math.PI * 2.0);
          }
          if (fSpriteBeautyAngle > +(Math.PI * 2.0)){
            fSpriteBeautyAngle -= +(Math.PI * 2.0);
          }

          // loops through the sprite pixels
          for(var sx = 0; sx < fSpriteWidth; sx++ ){
            for(var sy = 0; sy < fSpriteHeight; sy++){

              // sample sprite
              var fSampleX = sx / fSpriteWidth;
              var fSampleY = sy / fSpriteHeight;

              var sSamplePixel = "";

              // var sSpAngle = false;
              var sAnimationFrame = false;

              // animation-cycle available, determine the current cycle
              // TODO: randomize cycle position
              if( sprite.move && "walkframes" in currentSpriteObject ){
                if( game.animationTimer < 5 ){
                  sAnimationFrame = "W1";
                } else if( game.animationTimer >= 5 && game.animationTimer < 10 ) {
                  sAnimationFrame = "W2";
                } else if( game.animationTimer >= 10 ) {
                  sAnimationFrame = false;
                }
              }

              // sample-angled glyph is available
              if( "angles" in currentSpriteObject ){

                if( fSpriteBeautyAngle >= 0.0 && fSpriteBeautyAngle < +(Math.PI * 0.5) ){
                  sprite.a = "B";
                } else if( +(fSpriteBeautyAngle) >= +(+(Math.PI * 0.5)) && +(fSpriteBeautyAngle) < +(Math.PI) ) {
                  sprite.a = "L";
                } else if( +(fSpriteBeautyAngle) >= +(Math.PI) && +(fSpriteBeautyAngle) < +(+(Math.PI * 1.5)) ) {
                  sprite.a = "F";
                } else if( +(fSpriteBeautyAngle) >= +(+(Math.PI * 1.5)) && +(fSpriteBeautyAngle) < +(+(Math.PI * 2.0)) ) {
                  sprite.a = "R";
                }
              }


              // check if object has both, angles, or animations
              if( sprite.a && sAnimationFrame ) {
                sSamplePixel = _r.getSamplePixel(currentSpriteObject.angles[sprite.a][sAnimationFrame], fSampleX, fSampleY);
              } else if( sprite.a ) {
                sSamplePixel = _r.getSamplePixel(currentSpriteObject.angles[sprite.a], fSampleX, fSampleY);
              } else if( sAnimationFrame ) {
                sSamplePixel = _r.getSamplePixel(currentSpriteObject[sAnimationFrame], fSampleX, fSampleY);
              } else {
                // if not, use basic sprite
                sSamplePixel = _r.getSamplePixel(currentSpriteObject, fSampleX, fSampleY);
              }


              // assign based on render mode
              let sSpriteGlyph = (viewWindow.nRenderMode == 2 || viewWindow.nRenderMode == 0)
              						? _rh.renderWall( fSpriteDist, "W", sSamplePixel )
              						: sSamplePixel;


              var nSpriteColumn = ~~((fMiddleOfSprite + sx - (fSpriteWidth / 2)));

              if (nSpriteColumn >= 0 && nSpriteColumn < viewWindow.width){
                // only render the sprite pixel if it is not a . or a space, and if the sprite is far enough from the player
                if (sSpriteGlyph != "." && sSpriteGlyph != brightness[0] && viewWindow.depthBuffer[nSpriteColumn] >= fSpriteDist ){

                  // render pixels to screen
                  var yccord = fSpriteCeiling + sy;
                  var xccord = nSpriteColumn;
                  viewWindow.buffer[yccord * viewWindow.width + xccord] = sSpriteGlyph;
                  viewWindow.depthBuffer[nSpriteColumn] = fSpriteDist;
                }
              }
            }
          }
        } // end if

        // player was hit
        else{
          // clearInterval(game.timer);
        }

      }
    }

}

/*
	functions in _rh:
		renderWall|renderSolidWall|renderGate|renderFloor|renderCeiling
*/

  // various shaders for walls, ceilings, objects
  // _renderHelpers
  //
  // each texture has 4 values: 3 hues plus black
  // each value can be rendered with 5 shades (4 plus black)
  var _rh = {		// TODO this should probably be a class, then it can hold all its "global" variables as well

    renderWall: function(fDistanceToWall, sWallFaceDirection, pixel, lightBright = 0) {
						// TODO try making lightBright -1, and clamping the bottom too
      var fill = "";
      let pixelBright;
      let startBright = -1;

      pixel = CHAR_CACHE[pixel];		// Unit16Array functionality
      if( sWallFaceDirection === "N" || sWallFaceDirection === "S" ){

        if(fDistanceToWall < viewWindow.depth / 5.5 ){

          if( pixel === "#" ){
            pixelBright = 4;
          } else if( pixel === "7" ) {
            pixelBright = 3;
          } else if( pixel === "*" || pixel === "o") {
            pixelBright = 2;
          } else {
            pixelBright = 1;
          }

        } else if(fDistanceToWall < viewWindow.depth / 3.66 ) {

          if( pixel === "#" ){
            pixelBright = 3;
          } else if( pixel === "7" ) {
            pixelBright = 2;
          } else if( pixel === "*" || pixel === "o") {
            pixelBright = 1;
          } else {
            pixelBright = 0;
          }

        } else if(fDistanceToWall < viewWindow.depth / 2.33 ) {

          if( pixel === "#" ){
            pixelBright = 2;
          } else if( pixel === "7" ) {
            pixelBright = 1;
          } else if( pixel === "*" || pixel === "o") {
            pixelBright = 1;
          } else {
            pixelBright = 0;
          }

        } else if(fDistanceToWall < viewWindow.depth / 1 ) {

          if( pixel === "#" ){
            pixelBright = 1;
          } else if( pixel === "7" ) {
            pixelBright = 1;
          } else if( pixel === "*" || pixel === "o") {
            pixelBright = 1;
          } else {
            pixelBright = 0;
          }

        } else {
          pixelBright = 0;
        }
      }

      // walldirection W/E
      else{

        if(fDistanceToWall < viewWindow.depth / 5.5 ){

          if( pixel === "#" ){
            pixelBright = 3;
          } else if( pixel === "7" ) {
            pixelBright = 2;
          } else if( pixel === "*" || pixel === "o") {
            pixelBright = 1;
          } else {
            pixelBright = 0;
          }

        } else if(fDistanceToWall < viewWindow.depth / 3.66 ) {

          if( pixel === "#" ){
            pixelBright = 2;
          } else if( pixel === "7" ) {
            pixelBright = 2;
          } else if( pixel === "*" || pixel === "o") {
            pixelBright = 1;
          } else {
            pixelBright = 0;
          }

        } else if(fDistanceToWall < viewWindow.depth / 2.33 ) {

          if( pixel === "#" ){
            pixelBright = 2;
          } else if( pixel === "7" ) {
            pixelBright = 1;
          } else if( pixel === "*" || pixel === "o") {
            pixelBright = 1;
          } else {
            pixelBright = 0;
          }

        } else if(fDistanceToWall < viewWindow.depth / 1 ) {

          if( pixel === "#" ){
            pixelBright = 1;
          } else if( pixel === "7" ) {
            pixelBright = 1;
          } else if( pixel === "*" || pixel === "o") {
            pixelBright = 0;
          } else {
            pixelBright = 0;
          }

        } else {
          pixelBright = 0;
        }
      }
      fill = brightness[Math.min(Math.max(startBright + pixelBright + lightBright, 0), 4)];

      return fill;
    },

    // figures out shading for given section
    renderSolidWall: function(fDistanceToWall, isBoundary) {
      var fill = brightness[1];

      if(fDistanceToWall < viewWindow.depth / 6.5 ){
        fill = brightness[4];
      } else if(fDistanceToWall < viewWindow.depth / 4.66 ) {
        fill = brightness[3];
      } else if(fDistanceToWall < viewWindow.depth / 3.33 ) {
        fill = brightness[2];
      } else if(fDistanceToWall < viewWindow.depth / 1 ) {
        fill = brightness[1];
      } else {
        fill = brightness[0];
      }

      if( isBoundary ){
        if(fDistanceToWall < viewWindow.depth / 6.5 ){
          fill = brightness[1];
        } else if(fDistanceToWall < viewWindow.depth / 4.66 ) {
          fill = brightness[1];
        } else if(fDistanceToWall < viewWindow.depth / 3.33 ) {
          fill = brightness[0];
        } else if(fDistanceToWall < viewWindow.depth / 1 ) {
          fill = brightness[0];
        } else {
          fill = brightness[0];
        }
      }

      return fill;
    },

    // shading and sectionals for gate
    renderGate: function(screenRow, fDistanceToWall, nDoorFrameTop, nCeiling) {
      var fill = "X".charCodeAt(0);

      if( screenRow < nDoorFrameTop) {
        if(fDistanceToWall < viewWindow.depth / 4) {
          fill = "═".charCodeAt(0);	// 9552;		// &boxH;
        } else {
          fill = "=".charCodeAt(0);
        }
      } else {
        if(fDistanceToWall < viewWindow.depth / 4) {
          fill = "║".charCodeAt(0);	// 9553;		// &boxV;
        } else {
          fill = "|".charCodeAt(0);
        }
      }
      return fill;
    },

    renderFloor: function(screenRow, lightBright = 0) {
      var fill = "`".charCodeAt(0);

	  // TODO do something better with this
      // draw floor, in different shades
	  if (lightBright != 0) {

	    let pixelBright = 0;
        let startBright = 0;

	  	fill = brightness[Math.min(Math.max(startBright + pixelBright + lightBright, 0), 4)];

	  } else {
		let b = ((0.15 * game.fLooktimer - 2) * screenRow) / viewWindow.height + 2;

	  	if(b < 0.25 ) {
          fill = "x".charCodeAt(0);
        } else if(b < 0.5) {
          fill = "=".charCodeAt(0);
        } else if(b < 0.75) {
          fill = "-".charCodeAt(0);
        } else if(b < 0.9) {
          fill = "`".charCodeAt(0);
        } else {
          fill = brightness[0];
	    }
      }
      return fill;
    },

    renderCeiling: function(screenRow) {
      var fill = "`".charCodeAt(0);

      // draw ceiling, in different shades
      b = 1 - (screenRow -viewWindow.height / 2) / (viewWindow.height / 2);
      if(b < 0.25){
        fill = "`".charCodeAt(0);
      } else if(b < 0.5) {
        fill = "-".charCodeAt(0);
      } else if(b < 0.75) {
        fill = "=".charCodeAt(0);
      } else if(b < 0.9) {
        fill = "x".charCodeAt(0);
      } else {
        fill = "#".charCodeAt(0);
      }

      return fill;
    }

};


// "private" helper functions for the renderer

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

  function _evenlyPickItemsFromArray(numOfValues, neededCount) {
	let returnValues = Math.min(neededCount, numOfValues);		// NOTE is there ever a condition where neededCount > numOfValues?
	var interval = numOfValues / returnValues;
	return Uint16Array.from({ length: returnValues }, (_, index) => ~~(index * interval + interval / 2));
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
