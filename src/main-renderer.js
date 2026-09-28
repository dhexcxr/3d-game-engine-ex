export {_rh};

  // various shaders for walls, ceilings, objects
  // _renderHelpers
  //
  // each texture has 4 values: 3 hues plus black
  // each value can be rendered with 5 shades (4 plus black)
  var _rh = {		// TODO this should probably be a class, then it can hold all its "global" variables as well

    renderWall: function(fDistanceToWall, sWallFaceDirection, pixel){

      var fill = "";

      if( sWallFaceDirection === "N" || sWallFaceDirection === "S" ){

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
		  if(retVal === 'undefined')
			console.log(retVal);
		  return texpixels[samplePosition];
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
    var sOutput = "";
    // if sOverlay !0, appends it to the output instead
    if( sOverlay && sOverlay[nIndex] != 0){
      sOutput += sOverlay[nIndex];
    } else {
      sOutput += sInput[nIndex];
    }
    return sOutput;
  },



  /**
   * Creates a new array of pixels taking looking up and down into account
   * It returns an array to be rendered later.
   * the aim is to remove the first and last 30 pixels of very row,
   * to obscure the skewing
   */
  fPrepareFrame: function(oInput, oOverlay, eTarget){
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
  },


  fDrawFrame = function(screen, overlayscreen, target){
    var frame = _rh.fPrepareFrame(screen, overlayscreen);
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
  },


  /**
   * Function that handles movement of all sprites
   */
  var moveSprites = function(){

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
  },


  /**
   * Sorts the Sprite list based on distance from the player
   */
   updateSpriteBuffer = function(){

    	// converts object of objects to list
    oLevelSprites = {
    	...(Object.values(oLevelSprites).map(sprite => {
    		    // calculates the distance to the player
    		sprite.z = Math.sqrt((sprite.x - fPlayerX) ** 2 + (sprite.y - fPlayerY) ** 2);
    		return sprite;
    	}).sort(_sortSpriteList))    // sorts the list
    };		    // make object from array again
  };

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
