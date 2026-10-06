// Global states for worker thread
let player = {
    x: 0,
    y: 0,
    ang: 0,
    viewX: 0,
    viewY: 0,
    bJumping: false,
    bFalling: false
};
let game = {
    currentFrame: 0,
    animationTimer: 0,
    fLooktimer: 0,
    nJumptimer: 0
};
let map = {
    width: 0,
    height: 0,
    tiles: null,
    visitedTiles: null,
    isCeilLight: null,
    isFloorLight: null,
    JITTER_MASK: 0,
    jitterTableX: null,
    jitterTableY: null
};
let viewWindow = {
    width: 0,
    height: 0,
    halfHeight: 0,
    skew: 0,
    depth: 16.0,
    nRenderMode: 2,
    buffer: null,
    depthBuffer: null
};
// Shading namespaces mapping calls to local functions
const _r = {
    getSamplePixel
};
const _rh = {
    renderWall,
    renderGate,
    renderFloor,
    renderSolidWall
};


// Shared configurations loaded once
let mapWidth = 0;
let mapHeight = 0;
let mapTiles = null;
let isCeilLight = null;
let isFloorLight = null;
let jitterMask = 0;
let jitterTableX = null;
let jitterTableY = null;
let textures = null;
let CHAR_CACHE = null;
let WALL_TILE = null;
let brightness = null;


const absSign = (x) => (x === 0 ? 1 : Math.sign(x));
const edgeThreshold = 0.05;		// control thickness of border in flat renderer, also holes	// RAYCASTER only

// tile max light radius
const MAX_RADIUS_SQ = 6.25; // 2.5 tile radius (2.5 * 2.5)
const MAX_FLR_RADIUS_SQ = 2.25; // 1.5 tile radius (1.5 * 1.5)
let checkTiles = [];	// tiles to check for ceiling light
let closestLightWallDist = Infinity;
let closestLightFloorDist = Infinity;

let midFrameInfoMsg = '';		// DEBUG only
let endDoorInfoMsg = '';		// DEBUG only

let cameraX = null;

let rayDirX = null;
let rayDirY = null;

// TODO await till map is available then calc this
// let visitedTiles = new Uint32Array(map.width * map.height);
// TODO await till map is available then assign this
// let visitedTiles = map.visitedTiles;


// Core shading helpers (copied here to run self-contained within worker scope)
function getSamplePixel(texture, x, y, playerAng, wallFace = 'E') {
    const scaleFactor = texture?.scale || 2;
    const texWidth = texture?.width || 16;
    const texHeight = texture?.height || 16;
    let texpixels = texture.texture;

    if (texpixels instanceof Map) {
        if (wallFace === 'E' || wallFace === 'W') {
            texpixels = (playerAng > 0 && playerAng <= Math.PI) ? texpixels.get('S') : texpixels.get('N');
        } else {
            texpixels = (playerAng > 0.5 * Math.PI && playerAng <= 1.5 * Math.PI) ? texpixels.get('N') : texpixels.get('S');
        }
    }

    x = scaleFactor * x % 1;
    y = scaleFactor * y % 1;
    const sampleX = ~~(texWidth * x);
    const sampleY = ~~(texHeight * y);
    const samplePosition = (texWidth * sampleY) + sampleX;

    if (x < 0 || x > texWidth || y < 0 || y > texHeight) {
        return 43; // "+".charCodeAt(0)
    }
    return texpixels[samplePosition];
}

function renderWall(fDistanceToWall, sWallFaceDirection, pixel, lightBright = 0) {
						// TODO try making lightBright -1, and clamping the bottom too
      var fill = "";
      let pixelBright;
      let startBright = -1;

      pixel = CHAR_CACHE[pixel] ?? pixel;

      if (sWallFaceDirection === "N" || sWallFaceDirection === "S") {

        if (fDistanceToWall < viewWindow.depth / 5.5) {

          if (pixel === "#") {
            pixelBright = 4;
          } else if (pixel === "7") {
            pixelBright = 3;
          } else if (pixel === "*" || pixel === "o") {
            pixelBright = 2;
          } else {
            pixelBright = 1;
          }

        } else if (fDistanceToWall < viewWindow.depth / 3.66) {

          if (pixel === "#") {
            pixelBright = 3;
          } else if (pixel === "7") {
            pixelBright = 2;
          } else if (pixel === "*" || pixel === "o") {
            pixelBright = 1;
          } else {
            pixelBright = 0;
          }

        } else if (fDistanceToWall < viewWindow.depth / 2.33) {

          if (pixel === "#") {
            pixelBright = 2;
          } else if (pixel === "7") {
            pixelBright = 1;
          } else if (pixel === "*" || pixel === "o") {
            pixelBright = 1;
          } else {
            pixelBright = 0;
          }

        } else if (fDistanceToWall < viewWindow.depth / 1) {

          if (pixel === "#") {
            pixelBright = 1;
          } else if (pixel === "7") {
            pixelBright = 1;
          } else if (pixel === "*" || pixel === "o") {
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

        if (fDistanceToWall < viewWindow.depth / 5.5) {

          if ( pixel === "#") {
            pixelBright = 3;
          } else if (pixel === "7") {
            pixelBright = 2;
          } else if (pixel === "*" || pixel === "o") {
            pixelBright = 1;
          } else {
            pixelBright = 0;
          }

        } else if (fDistanceToWall < viewWindow.depth / 3.66) {

          if (pixel === "#") {
            pixelBright = 2;
          } else if (pixel === "7") {
            pixelBright = 2;
          } else if (pixel === "*" || pixel === "o") {
            pixelBright = 1;
          } else {
            pixelBright = 0;
          }

        } else if (fDistanceToWall < viewWindow.depth / 2.33) {

          if (pixel === "#") {
            pixelBright = 2;
          } else if (pixel === "7") {
            pixelBright = 1;
          } else if (pixel === "*" || pixel === "o") {
            pixelBright = 1;
          } else {
            pixelBright = 0;
          }

        } else if (fDistanceToWall < viewWindow.depth / 1) {

          if (pixel === "#") {
            pixelBright = 1;
          } else if (pixel === "7") {
            pixelBright = 1;
          } else if (pixel === "*" || pixel === "o") {
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
}

function renderSolidWall(fDistanceToWall, isBoundary) {
      var fill = brightness[1];

      if (fDistanceToWall < viewWindow.depth / 6.5) {
        fill = brightness[4];
      } else if (fDistanceToWall < viewWindow.depth / 4.66) {
        fill = brightness[3];
      } else if (fDistanceToWall < viewWindow.depth / 3.33) {
        fill = brightness[2];
      } else if (fDistanceToWall < viewWindow.depth / 1) {
        fill = brightness[1];
      } else {
        fill = brightness[0];
      }

      if (isBoundary) {
        if (fDistanceToWall < viewWindow.depth / 6.5) {
          fill = brightness[1];
        } else if (fDistanceToWall < viewWindow.depth / 4.66) {
          fill = brightness[1];
        } else if (fDistanceToWall < viewWindow.depth / 3.33) {
          fill = brightness[0];
        } else if (fDistanceToWall < viewWindow.depth / 1) {
          fill = brightness[0];
        } else {
          fill = brightness[0];
        }
      }

      return fill;
}

function renderGate(screenRow, fDistanceToWall, nDoorFrameTop, nCeiling) {
      var fill = "X".charCodeAt(0);
      
      if (screenRow < nDoorFrameTop) {
        if (fDistanceToWall < viewWindow.depth / 4) {
          fill = "═".charCodeAt(0);	// 9552;		// &boxH;
        } else {
          fill = "=".charCodeAt(0);
        }
      } else {
        if (fDistanceToWall < viewWindow.depth / 4) {
          fill = "║".charCodeAt(0);	// 9553;		// &boxV;
        } else {
          fill = "|".charCodeAt(0);
        }
      }
      return fill;
}

function renderFloor(screenRow, lightBright = 0, screenLook) {
      var fill = "`".charCodeAt(0);

	  if (lightBright != 0) {
	  
	    let pixelBright = 0;
        let startBright = 0;
	  
	  	fill = brightness[Math.min(Math.max(startBright + pixelBright + lightBright, 0), 4)];
	  
	  } else {
		let b = ((0.15 * screenLook - 2) * screenRow) / viewWindow.height + 2;

		if (b < 0.25) {
			fill = "x".charCodeAt(0);
		} else if (b < 0.5) {
			fill = "=".charCodeAt(0);
		} else if (b < 0.75) {
			fill = "-".charCodeAt(0);
		} else if (b < 0.9) {
			fill = "`".charCodeAt(0);
		} else {
			fill = brightness[0];
		}
	  
	  }

      return fill;
}

// Raycasting math entrypoint
function runRaycasterSlice(params) {
    const {
        startColumn,
        endColumn,
        buffer,
        depthBuffer,
        visitedTiles,
        playerX,
        playerY,
        playerAng,
        playerViewX,
        playerViewY,
        playerBJumping,
        playerBFalling,
        currentFrame,
        animationTimer,
        fLooktimer,
        nJumptimer,
        viewHeight,
        viewSkew,
        viewHalfHeight,
        viewPlaneX,
        viewPlaneY,
        viewNRenderMode
    } = params;

    const sliceWidth = endColumn - startColumn;
    const floorDistLut = new Float32Array(Math.ceil(viewHeight));
    for (let r = 0; r < viewHeight; r++) {
        const rowOffset = r - viewSkew;
        floorDistLut[r] = rowOffset !== 0 ? viewHalfHeight / rowOffset : 0;
    }

    for (let screenColumn = startColumn; screenColumn < endColumn; screenColumn++) {
        const localColumn = screenColumn - startColumn;

        const cameraX = (2 * screenColumn / (sliceWidth * 4)) - 1; // Reconstruct viewPort width
        const rayDirX = playerViewX + (viewPlaneX * cameraX);
        const rayDirY = playerViewY + (viewPlaneY * cameraX);

        // ... Copy the DDA raycasting logic from main-raycaster_partMultiObj.js ...
        // Ensure writes use localColumn instead of screenColumn for depthBuffer:
        // depthBuffer[localColumn] = fDistanceToWall;
        // And use (screenRow * sliceWidth + localColumn) for buffer indexing:
        // buffer[screenRow * sliceWidth + localColumn] = ...
        
		var bBreakLoop = false;

		var fDistanceToWall = 0;
//		 let fPrevDistanceToWall = fDistanceToWall;
		let fDistToDoor = 0;
		let addlDoorDist = 0;		// DEBUG only
		
		var fDistanceToObject = 0;
		var fDistanceToInverseObject = 0;

		var bHitWall = false;
		
		let bHitOoB = false;
		let fDistanceToOoB = 0;

		var bInObject = false;

		var sWalltype = "#".charCodeAt(0);
		var sObjectType = "0".charCodeAt(0);
		let isBoundary = false;
		let isObjBoundary = false;
		let isInvObjBoundary = false;
		
		let vHitObjects = new Array()


		var fSampleX = 0.0;
		var sWallFaceDirection = "N";

		var nRayLength = 0.0;

		
		var map_x = ~~(player.x);	// the player's current map xy coordinates
		var map_y = ~~(player.y);	// TODO get all this crap that is constant out of this loop, actually this needs to be reset every ray
		
		let currentMapTileIndex = map_y * map.width + map_x;
		
		map.visitedTiles[currentMapTileIndex] = game.currentFrame;	// TODO maybe just check the player XY instead of setting this for sprites
// 	visitedTiles[currentMapTileIndex] = game.currentFrame >>> 0;	// TODO maybe just check the player XY instead of setting this for sprites

		let tileType = map.tiles[currentMapTileIndex];	// NOTE this could be only inside loop, I want it right now so we can debug what the ray is hitting by saving into rayOb	// ACTUALLY i think I might have meant outside the loop, it doesn't change with the rays cast

		var delta_x = Math.abs(1 / rayDirX);	// the dist the ray must travel to reach the border of the next tile
		var delta_y = Math.abs(1 / rayDirY);
		
		var hit_NS_wall = side_dist_x < side_dist_y ? 0 : 1;
		
		var step_x = absSign(rayDirX);
		var step_y = absSign(rayDirY);

			// calculate distance to initial tile boundary
		var side_dist_x = delta_x * (step_x === 1 ? (map_x + 1 - player.x) : (player.x - map_x));
		var side_dist_y = delta_y * (step_y === 1 ? (map_y + 1 - player.y) : (player.y - map_y));
		
		// check if player is on door tile, so we can properly render it
		let playerInsideDoorTile = map.tiles[~~player.y * map.width + ~~player.x] === 'X'.charCodeAt(0);

		if (playerInsideDoorTile) {	// NOTE this is not working, just comment out for now
			
			fDistanceToWall = hit_NS_wall ? side_dist_x - delta_x : side_dist_y - delta_y;
			
			fDistToDoor = fDistanceToWall + Math.abs(0.5 / (hit_NS_wall ? rayDirX : rayDirY));
			
			let distToDoorX = ~~(player.x + fDistToDoor * rayDirX);
			let distToDoorY = ~~(player.y + fDistToDoor * rayDirY);
			
			bBreakLoop = map_x === distToDoorX && map_y === distToDoorY && fDistToDoor >= 0;
			sWalltype = tileType;
		}

		/**
		 * Ray Casting Loop
		 */
		while(!bBreakLoop && nRayLength < viewWindow.depth * 2) {
		
			if (side_dist_x < side_dist_y) {
				side_dist_x += delta_x;
				map_x += step_x;
				hit_NS_wall = true;
			} else {
				side_dist_y += delta_y;
				map_y += step_y;
				hit_NS_wall = false;
			}
	
			currentMapTileIndex = map_y * map.width + map_x;
	
			map.visitedTiles[currentMapTileIndex] = game.currentFrame;
			tileType = map.tiles[currentMapTileIndex];
	
			// test if ray hits out of bounds
			if (map_x < 0 || map_x >= map.width || map_y < 0 || map_y >= map.height) {
	//			 bHitWall = true; // no wall there, but with this enabled we paint a wall, but can still go through it
				bHitOoB = true;
				fDistanceToWall = viewWindow.depth;
				fDistanceToOoB = hit_NS_wall ? side_dist_x - delta_x : side_dist_y - delta_y;
				bBreakLoop = true;
			} else if (tileType == "o".charCodeAt(0) || tileType == ",".charCodeAt(0)) {		// test for objects
				if (!bInObject) {		// NOTE we'll need to update this to account for holes next to ceiling...thingies
					fDistanceToObject = hit_NS_wall ? side_dist_x - delta_x : side_dist_y - delta_y;
					let fObjSampleX = hit_NS_wall ? player.y + fDistanceToObject * rayDirY : player.x + fDistanceToObject * rayDirX;
					
					// used to place texture exactly where ray hit wall
					fObjSampleX -= ~~(fObjSampleX);
			
					// draw lines between wall blocks in no texture mode
					isObjBoundary = (fObjSampleX <= edgeThreshold || fObjSampleX >= 1.0 - edgeThreshold);
					
										// similar operation for objects		// TODO calc these like we did for walls and doors probably
					// TODO move this where its used and loop through vHitObjects
					let nObjectHeight = viewWindow.height / fDistanceToObject;
					var nObjectCeiling = viewWindow.skew - nObjectHeight / (tileType == ",".charCodeAt(0) ? 1.25 : 2);
					var nObjectFloor = viewWindow.skew + nObjectHeight / 2;
					
					vHitObjects.push({objX: map_x, objY: map_y, objMapTileIndex: currentMapTileIndex, objType: tileType, distToObj: fDistanceToObject, atObjBoundary: isObjBoundary, objHeight: nObjectHeight, objCeil: nObjectCeiling, objFloor: nObjectFloor});
				}
				bInObject = true;
				sObjectType = tileType;
			} else if (tileType === 'X'.charCodeAt(0)) {		// exit door
				bHitWall = true;
				
				fDistanceToWall = hit_NS_wall ? side_dist_x - delta_x : side_dist_y - delta_y;
				
				fDistToDoor = fDistanceToWall + Math.abs(0.5 / (hit_NS_wall ? rayDirX : rayDirY));
				
				let distToDoorX = ~~(player.x + fDistToDoor * rayDirX);
				let distToDoorY = ~~(player.y + fDistToDoor * rayDirY);
				
				bBreakLoop = map_x === distToDoorX && map_y === distToDoorY;
				sWalltype = tileType;
			} else if ( tileType != ".".charCodeAt(0)) {		// NOTE this also matches towers
				bHitWall = true;			// Test for walls	// NOTE why is it not....like, testing /for/ walls...
				fDistanceToWall = hit_NS_wall ? side_dist_x - delta_x : side_dist_y - delta_y;
				bBreakLoop = true;
	
				sWalltype = tileType;
			}
		
				// save back of object distance as soon as we're out of it
			if (bInObject == true && tileType !== "o".charCodeAt(0) && tileType !== ",".charCodeAt(0)) {
					fDistanceToInverseObject = hit_NS_wall ? side_dist_x - delta_x : side_dist_y - delta_y;
					let fInvObjSampleX = hit_NS_wall ? player.y + fDistanceToInverseObject * rayDirY : player.x + fDistanceToInverseObject * rayDirX;
					
					// used to place texture exactly where ray hit wall
					fInvObjSampleX -= ~~(fInvObjSampleX);
			
					// draw lines between wall blocks in no texture mode
					isInvObjBoundary = (fInvObjSampleX <= edgeThreshold || fInvObjSampleX >= 1.0 - edgeThreshold);
				bInObject = false;
				
								// TODO move this where its used and loop through vHitObjects
				var nFObjectBackwall = viewWindow.skew + (viewWindow.height / (fDistanceToInverseObject + 0) /2 ); // 0 makes the object flat, higher the number, the higher the object :)
				var nFObjectBackCeil = viewWindow.skew - (viewWindow.height / (fDistanceToInverseObject + 0) / (vHitObjects.at(-1).objType == ",".charCodeAt(0) ? 1.25 : 2) );	// the 1.5 pushes the ceil light up higher
				
				Object.assign(vHitObjects.at(-1), {distToBackOfObj: fDistanceToInverseObject, atObjBackBoundary: isInvObjBoundary, backOfObjFloor: nFObjectBackwall, backOfObjCeil: nFObjectBackCeil});
			}
		
		} // end ray casting loop
		
		let exactHitX = 0;
		let exactHitY = 0;
		
		if (hit_NS_wall) {		// NS wall	// sin(RayAng) gives normalized Ray Vector
			fSampleX = player.y + (bHitOoB ? fDistanceToOoB : fDistanceToWall) * rayDirY;
			sWallFaceDirection = step_x === 1 ? "W" : "E";
			
			exactHitX = map_x + (sWallFaceDirection === 'W' ? 0 : 1);
			exactHitY = fSampleX;
		} else {
			fSampleX = player.x + (bHitOoB ? fDistanceToOoB : fDistanceToWall) * rayDirX;
			sWallFaceDirection = step_y === 1 ? "N" : "S";
			
			exactHitX = fSampleX;
			exactHitY = map_y + (sWallFaceDirection === 'N' ? 0 : 1);
		}	// exactHitOth is hacked on from a Google Search AI convo I had about adding distance based ceiling lighting
		
		// used to place texture exactly where ray hit wall
		fSampleX -= ~~(fSampleX);

		// draw lines between wall blocks in no texture mode
		if (fSampleX <= edgeThreshold || fSampleX >= 1.0 - edgeThreshold) {
			if (hit_NS_wall) {
				let tileCheckLocDif = sWallFaceDirection === 'W' ? -1 : 1;
				isBoundary = sWalltype !== map.tiles[(map_y + tileCheckLocDif) * map.width + map_x];
			} else {
				let tileCheckLocDif = sWallFaceDirection === 'S' ? -1 : 1;
				isBoundary = sWalltype !== map.tiles[map_y * map.width + map_x + tileCheckLocDif];
			}
		}


		// calc top and bottom of wall, the top being the ceiling
		var wallHeight = Math.round(viewWindow.height / fDistanceToWall);
		var nCeiling = viewWindow.skew - wallHeight / 2;
		var nFloor   = viewWindow.skew + wallHeight / 2;
		
		// calc top of tower, which is higher than ceiling
		let nTowerCeil = viewWindow.skew - wallHeight / 2 - wallHeight;
		let nTowerHeight = nFloor - nTowerCeil;

			// technique from original wolf3d code (I think), and also this guy: https://github.com/permadi-com/ray-cast/blob/master/demo/1/sample1.js
			// TODO put all these types of calcs in each "hit object" code so it doesn't run all the time
		let nDoorHeight = Math.round(viewWindow.height / fDistToDoor)	// TODO change the gate render, make the blockV on the left and right edges
		let nDoorFrameTop = viewWindow.skew - nDoorHeight / 2;			//  (maybe in the center, like striped), and blockH in the center
		let nDoorFrameBot = viewWindow.skew + nDoorHeight / 2;			// Second, try to actually give it an upper door jamb								
																// ALSO, standardize Door vs Gate in var and func names
		


		// the spot where the wall was hit
		viewWindow.depthBuffer[localColumn] = fDistanceToWall;


		
		
/*--------wall LIGHTS--------*/
		
		// check if nearby tiles are lights, so we can brighten walls, etc
		closestLightWallDist = Infinity;
		
		let wallLight = 0;		// NOTE TODO these should go into an object, probably
		let ceilLightInTile = false;			// TODO next, probably put togethet these objects to get lights working how i want them
		let floorLightInTile = false;
		
		const invLightRadius = 1 / MAX_RADIUS_SQ;
		const invLightFlRadius = 1 / MAX_FLR_RADIUS_SQ;
		
		let lightCalcs = new Array(9);		
		
		let xDeltaStart = 0;
		let xDeltaEnd = 0;
		let yDeltaStart = 0;
		let yDeltaEnd = 0;
		
		switch (sWallFaceDirection) {
			case 'N': xDeltaStart = -2, xDeltaEnd = 2;
						yDeltaStart = -2, yDeltaEnd = -1;	break;
			
			case 'S': xDeltaStart = -2, xDeltaEnd = 2;
						yDeltaStart = 1, yDeltaEnd = 2; break;
			
			case 'E': xDeltaStart = 1, xDeltaEnd = 2;
						yDeltaStart = -2, yDeltaEnd = 2; break;
			
			case 'W': xDeltaStart = -2, xDeltaEnd = -1;
						yDeltaStart = -2, yDeltaEnd = 2; break;
		}
		
		
		const lightLookUpStartX = Math.min(Math.max(map_x + xDeltaStart, 0), map.width - 1);
		const lightLookUpEndX = Math.min(Math.max(map_x + xDeltaEnd, 0), map.width - 1);
		const lightLookUpStartY = Math.min(Math.max(map_y + yDeltaStart, 0), map.width - 1);
		const lightLookUpEndY = Math.min(Math.max(map_y + yDeltaEnd, 0), map.width - 1);
		
		// NOTE - TO FIX, if 2 holes are next to wall, parallel to wall, light glow does not work
			// glow on wall is centered on middle of holes, not "equal" light glowing from each hole
							// Look at current tile and its immediate neighbors for a light
			// FU - i think the way this is working is correct and normal for the current logic
				// might change to let hole lightes travel 2 tiles
		for (let lightX = lightLookUpStartX; lightX <= lightLookUpEndX; lightX++) {
			for (let lightY = lightLookUpStartY; lightY <= lightLookUpEndY; lightY++) {
				
				const lightTileLookupIndex = lightY * map.width + lightX;
				
				ceilLightInTile = map.isCeilLight[lightTileLookupIndex];
				floorLightInTile = map.isFloorLight[lightTileLookupIndex];

// IDEAS for floor lights
	// give them standard 2 tile x/y dist, like ceil lights
	// change to larger radius
	// and smaller adjustment ratio
		// 2.75 radius and 0.4 adj is pretty good

				if (ceilLightInTile
						|| (floorLightInTile	// creepy glow from floor holes
							&& lightX >= map_x - 1 && lightX <= map_x + 1
							&& lightY >= map_y - 1 && lightY <= map_y + 1)) {	// TODO classify all tile types in charLookup or something, so we can do constant things like === WALL_TILE
					
					const dx = exactHitX - (lightX + 0.5);
					const dy = exactHitY - (lightY + 0.5);	// TODO we might need to calc the yDist from light to wall in here, to better blend ceil vs floor
					
					const distSq = ceilLightInTile ? dx * dx + dy * dy : 0;
					const distFlSq = floorLightInTile ? dx * dx + dy * dy : 0;
					
					const lightPreCalc = 1 - (distSq * invLightRadius);
					const lightFlPreCalc = 1 - (distFlSq * invLightFlRadius);
					
					const xContribution = ~~(fSampleX * 100) * 57;
					const jitterMask = map.JITTER_MASK;
					
					lightCalcs.push(((currentCeilLightTile, currentFloorLightTile) => {
						return (fSampleY) => {
							let totalLight = 0;
							
							const lookupIndex = (xContribution + ~~(fSampleY * 100)) & jitterMask;
							const noiseX = map.jitterTableX[lookupIndex];
							const noiseY = map.jitterTableY[lookupIndex];
						
							if (currentCeilLightTile) {
								const vertDistSq = (fSampleY + noiseX) * (fSampleY + noiseY);
								
								if (distSq + vertDistSq < MAX_RADIUS_SQ) {
									const lightCalc = lightPreCalc - (vertDistSq * invLightRadius);
									totalLight += lightCalc * lightCalc * 0.8;
								}
							}
							
							if (currentFloorLightTile) {
								const vertDistSq = (1 - fSampleY + noiseX) * (1 - fSampleY + noiseY);
								
								if (distFlSq + vertDistSq < MAX_FLR_RADIUS_SQ) {
									const lightCalc = lightFlPreCalc - (vertDistSq * invLightFlRadius);
									totalLight += lightCalc * lightCalc * 0.8;
								}
							}

							return totalLight;
						}
					})(ceilLightInTile, floorLightInTile));
				}
			}
		}

/*-----end- wall LIGHTS------*/

/*-----floor lights precalcs-*/


		// draw the columns one screenheight-pixel at a time
		for (var screenRow = 0; screenRow < viewWindow.height; screenRow++) {

			// sky
			if (screenRow < nCeiling) {	// TODO if we are in a thing (wall, tower, light), quick fill from top of thing to bottom without looping and running all conditional checks again, could be complicated if there are more things in front of other things, like the lights are
				let ceilThings = vHitObjects.filter(obj => {
					return obj.objType === ','.charCodeAt(0)
						&& screenRow > obj.objCeil - obj.objHeight
						// && screenRow <= obj.objCeil - (5 / obj.distToObj)	// border around light/ceiling
						&& screenRow <= obj.objCeil
						&& (sWalltype !== "T".charCodeAt(0) || fDistanceToWall >= obj.distToObj)
				});

				if (sWalltype == "T".charCodeAt(0)	// case of tower block (the bit that reaches into the ceiling)
						&& screenRow > nTowerCeil
						&& (sObjectType !== ",".charCodeAt(0)
							|| fDistanceToObject >= fDistanceToWall
							|| (sObjectType === ",".charCodeAt(0) && nObjectCeiling <= nCeiling && screenRow > nObjectCeiling))) {
				
					let fSampleY = ((screenRow - nTowerCeil) / (nCeiling - nTowerCeil));
				
					const wallLight = lightCalcs.reduce((totalLight, lightCalc) => {	// lights on upper part of tower
						return totalLight + lightCalc((1 - fSampleY) * 2);	// 1- to flip/mirror the light calc'd for normal wall part
// 						return totalLight + lightCalc(1 - fSampleY * 0.5);	// NOTE this version is interesting too
					}, 0);													// *2 to make the effect smaller because this is above the light

					const clampedLight = Math.min(Math.max(wallLight, 0.0), 0.999);
					const lightBright = ~~(clampedLight * 4);
  
					viewWindow.buffer[screenRow * viewWindow.width + localColumn] = _rh.renderWall(fDistanceToWall, sWallFaceDirection, _r.getSamplePixel(textures[CHAR_CACHE[sWalltype]], fSampleX, fSampleY, player.ang, sWallFaceDirection), lightBright);

				} else if (ceilThings.length > 0) {		// things in the ceiling, currently just lights
					viewWindow.buffer[screenRow * viewWindow.width + localColumn] =
						ceilThings[0].atObjBoundary		// if at vertical boundary
								|| screenRow >= ceilThings[0].objCeil - (5 / ceilThings[0].distToObj)	// or at horizontal boundary
							? brightness[0]		// draw black bar
							: "1".charCodeAt(0);
				} else {
					viewWindow.buffer[screenRow * viewWindow.width + localColumn] = brightness[0];
				}			
			} else if (screenRow > nCeiling		// solid block/walls/doors/etc
					&& screenRow <= nFloor
					&& !(screenRow >= nDoorFrameBot
						&& sWalltype == 'X'.charCodeAt(0))) {

				if (sWalltype == "X".charCodeAt(0)) {		// Door/exit Walltype
					if (screenRow > nDoorFrameTop) {
						viewWindow.buffer[screenRow * viewWindow.width + localColumn] =
							_rh.renderGate(screenRow, fDistToDoor, nDoorFrameTop, nCeiling);
					} else {
						viewWindow.buffer[screenRow * viewWindow.width + localColumn] = brightness[0];
					}
				} else if (sWalltype != ".".charCodeAt(0) || sWalltype == "T".charCodeAt(0)) {		// Solid Walltype

					var fSampleY = (screenRow - nCeiling) / wallHeight;

					/**
					* animation timer example
					*/
					// if ( game.animationTimer < 5) {
					//   viewWindow.buffer[screenRow * viewWindow.width + localColumn] = _r.getSamplePixel(texture, fSampleX, fSampleY);
					// } else if ( game.animationTimer >= 5 && game.animationTimer < 10) {
					//   viewWindow.buffer[screenRow * viewWindow.width + localColumn] = _r.getSamplePixel(texture2, fSampleX, fSampleY);
					// } else if ( game.animationTimer >= 10) {
					//   viewWindow.buffer[screenRow * viewWindow.width + localColumn] = _r.getSamplePixel(texture3, fSampleX, fSampleY);
					// }


					// Render Texture Directly
					if (viewWindow.nRenderMode == 1) {
						viewWindow.buffer[screenRow * viewWindow.width + localColumn] =
							_r.getSamplePixel(textures[CHAR_CACHE[sWalltype]], fSampleX, fSampleY, player.ang, sWallFaceDirection);
					} else if (viewWindow.nRenderMode == 2) {		// Render Texture with Shading
						const wallLight = lightCalcs.reduce((totalLight, lightCalc) => {
							return totalLight + lightCalc(fSampleY);
						}, 0);
					
						const clampedLight = Math.min(Math.max(wallLight, 0.0), 0.999);
						const lightBright = ~~(clampedLight * 4);
						
						viewWindow.buffer[screenRow * viewWindow.width + localColumn] =
							_rh.renderWall(fDistanceToWall,
								sWallFaceDirection,
								_r.getSamplePixel(textures[CHAR_CACHE[sWalltype]], fSampleX, fSampleY, player.ang, sWallFaceDirection), lightBright);
					} else if (viewWindow.nRenderMode == 0) {	// old, solid-style shading
						viewWindow.buffer[screenRow * viewWindow.width + localColumn] =
							_rh.renderSolidWall(fDistanceToWall, isBoundary);
					}
				} else {		// render whatever char is on the map as walltype
					viewWindow.buffer[screenRow * viewWindow.width + localColumn] = sWalltype;
				}
			} else {		// floor painting loop
			
          	// calc dist to floor at specific screen row
						// ANOTHER THING TO DO
					// refactor this light calc, like we did with the early one for walls,
						// so that as much as possible is calculated /outside/ of this loop
						// with a small, quick callback processed in the loop
			// FIRST - lights cast on the floor
					// get perspective distance to this specific floor row
				let floorLight = 0;
				
				closestLightFloorDist = Infinity;
					
					
				const currentDist = floorDistLut[screenRow];
					// ratio of distance to this pixel to full distance to this wall
				const distRatio = currentDist / (bHitOoB ? fDistanceToOoB : fDistanceToWall);
					// not needing separate currentDist value, might be nice to eventually use it
						// then render can be simpler, by pre-baking in light based on distance here
						// instead of a bunch of conditionals in renderer
				
				// calc world coordinates of the floor at this screen pixel
				let floorX = distRatio * exactHitX + (1.0 - distRatio) * player.x;
 				let floorY = distRatio * exactHitY + (1.0 - distRatio) * player.y;
				
				// true map tile x and y
				const floorMapX = ~~floorX;
				const floorMapY = ~~floorY;
				
				if (map.tiles[floorMapY * map.width + floorMapX] !== "o".charCodeAt(0)) {
					
							
					
					const lightLookUpStartX = floorMapX - 2 < 0 ? 0 : floorMapX - 2;
					const lightLookUpEndX = floorMapX + 2 > map.width - 1 ? map.width - 1 : floorMapX + 2;
					const lightLookUpStartY = floorMapY - 2 < 0 ? 0 : floorMapY - 2;
					const lightLookUpEndY = floorMapY + 2 > map.width - 1 ? map.width - 1 : floorMapY + 2;
					
								// Look at current tile and its immediate neighbors for a light
					for (let lightX = lightLookUpStartX; lightX <= lightLookUpEndX; lightX++) {
						for (let lightY = lightLookUpStartY; lightY <= lightLookUpEndY; lightY++) {
							
							const lightTileLookupIndex = lightY * map.width + lightX;
		// TODO NOTE next thing, process map on load, for every tile, build array with x,y of all nearby lights
			// then we won't have to do this searching, looping through lightX, lightY, and looking at the map.tiles array
			// it will just be: get list of lights in range for this tile
				// calculate dx, dy for this pixel to this light
				// continue
			// oh yea, this should account for walls too
				// so we don't have to do the dynamic thing for every floor and wall pixel....maybe
			// FURTHER IDEAS
				// create a second buffer for screen light map
				// use that to set color of text
					// though in DOM that will be like, a div per horizontal color or something
					// and with Canvas that'll be lots of setting canvas settings I think
						// or maybe it was text settings, something like that
					// and I doubt either one of those is "cheap" in processing time
				// OOOoo!, I could use strokeText() to draw outlines
					// so it'll be darker!
					// that's an extra 4 shade of darkness already
				// ok, first test, it seems to make some things brighter
					// will need some fiddling with to figure out how to use it right
					
							const ceilLight = map.isCeilLight[lightTileLookupIndex] === 1;
							const floorHole = map.isFloorLight[lightTileLookupIndex] === 1;
							
							if (ceilLight
									|| (floorHole	// creepy glow from floor holes
										&& (lightX >= floorMapX - 1 || lightX <= floorMapX + 1)
										&& (lightY >= floorMapY - 1 || lightY <= floorMapY + 1))) {	// TODO classify all tile types in charLookup or something, so we can do constant things like === WALL_TILE
		
		// fancy lights
								const lightCentX = lightX + 0.5;
								const lightCentY = lightY + 0.5;
		
							// hash map coordinates to calc jitter lookup (see spacial hashing)
								const lookupIndex = (~~(floorX * 100) + ~~(floorY * 100) * 57) & map.JITTER_MASK;
								
								const noiseX = map.jitterTableX[lookupIndex];
								const noiseY = map.jitterTableY[lookupIndex];
								
								const offset = 0.5;		// NOTE original was 0.25
								const lightPoints = [
										{ x: lightCentX + noiseX,		  y: lightCentY + noiseY },		  // Center
										{ x: lightCentX - offset + noiseX, y: lightCentY - offset + noiseY }, // Top-Left
										{ x: lightCentX + offset + noiseX, y: lightCentY - offset + noiseY }, // Top-Right
										{ x: lightCentX - offset + noiseX, y: lightCentY + offset + noiseY }, // Bottom-Left
										{ x: lightCentX + offset + noiseX, y: lightCentY + offset + noiseY }  // Bottom-Right
									];
								
								
								let visiblePoints = 0;
								let accumulatedFalloff = 0;
								
							// calc dist from each of 5 points in light source
								for (let p = 0; p < lightPoints.length; p++) {
									const pt = lightPoints[p];
								
									const dx = floorX - pt.x;
									const dy = floorY - pt.y;
									const distSq = dx * dx + dy * dy;
									
								if (distSq < MAX_RADIUS_SQ	// sum falloff for all visible points
											&& checkDynamicLOS(floorX, floorY, pt.x, pt.y)) {
										visiblePoints++;
										const ratio = distSq / MAX_RADIUS_SQ;
									accumulatedFalloff += (1.0 - ratio) * (1.0 - ratio);
									}
								}
								
							if (visiblePoints > 0) {	// calc actual amount of light
									  const visibilityFactor = visiblePoints / lightPoints.length;
									  const averageFalloff = accumulatedFalloff / visiblePoints;
									  
									  floorLight += averageFalloff * visibilityFactor * (floorHole ? 0.8 : 0.8);
								}
							}
						}
					}
					
				}
				
			const clampedLightFloor = Math.min(Math.max(floorLight, 0.0), 0.999);
			const lightBrightFloor = ~~(clampedLightFloor * 5);

				viewWindow.buffer[screenRow * viewWindow.width + localColumn] = _rh.renderFloor(screenRow, lightBrightFloor, game.fLooktimer);
			}
		} // end draw column loop
		

        // Object-Draw (removed overlayscreen)
        for(var y = 0; y < viewWindow.height; y++) {	// loop through vHitObjects
			vHitObjects.filter(obj => 
// 				(obj.objType == "o" || obj.objType == ",")
				obj.objType == "o".charCodeAt(0)
					&& y >= obj.backOfObjFloor
					&& y <= obj.objFloor
			).forEach(floor => {
				viewWindow.buffer[y * viewWindow.width + localColumn] =
					y <= floor.backOfObjFloor + (4 / floor.distToBackOfObj)	// at horizontal boundary
					? brightness[2]
					: _rh.renderSolidWall(floor.distToObj, floor.atObjBackBoundary)
		  });
		  
		  vHitObjects.filter(obj => {
		  	return obj.objType == ",".charCodeAt(0) && y >= obj.objCeil && y <= obj.backOfObjCeil
		  }).forEach(ceil => {
			viewWindow.buffer[y * viewWindow.width + localColumn] = brightness[4];		// this is kinda like a ceiling light, carat/^ could be burnt out or flickering light
//			 viewWindow.buffer[y * viewWindow.width + localColumn] = "^".charCodeAt(0);	// @ looks nice here too
		  });
		  
		} // end draw column loop		// == nFObjectBackCeil, draw black 'pixel'
	}  // end column loop
}


function checkDynamicLOS(startX, startY, endX, endY) {
	// Use a fixed number of sample steps proportional to a 1.5 tile maximum distance
	const steps = 4; 
	
	for (let i = 1; i < steps; i++) {
		const t = i / steps;
		// Interpolate a point along the line between pixel and light center
		const checkX = ~~(startX + (endX - startX) * t);
		const checkY = ~~(startY + (endY - startY) * t);
		
		// Sample the map
		const tile = map.tiles[checkY * map.width + checkX];	// TODO NOTE make an array of block/wall tiles, so this is just a lookup
// 		if (tile > 0 && WALL_TILE[tile] /* "TX#$CWU".split('').map(char => char.charCodeAt(0)).includes(tile) */) {
// 			return false; // Intersection found, wall blocks light
// 		}
		return !(tile > 0 && WALL_TILE[tile])
	}
	return true;
}


// self.onmessage = function (event) {
//     const data = event.data;
//
//     if (data.type === 'INIT_MAP') {
//         mapWidth = data.mapWidth;
//         mapHeight = data.mapHeight;
//         mapTiles = data.mapTiles;
//         isCeilLight = data.isCeilLight;
//         isFloorLight = data.isFloorLight;
//         jitterMask = data.jitterMask;
//         jitterTableX = data.jitterTableX;
//         jitterTableY = data.jitterTableY;
//         textures = data.textures;
//         CHAR_CACHE = data.CHAR_CACHE;
//         WALL_TILE = data.WALL_TILE;
//         brightness = data.brightness;
//     }
//     else if (data.type === 'RENDER_SLICE') {
//         const visitedTiles = new Uint32Array(mapWidth * mapHeight);
//
//         runRaycasterSlice({ ...data, visitedTiles });
//
//         // Transfer computed ArrayBuffers back with zero copy
//         self.postMessage({
//             buffer: data.buffer,
//             depthBuffer: data.depthBuffer,
//             visitedTiles
//         }, [data.buffer.buffer, data.depthBuffer.buffer]);
//     }
// };

self.onmessage = function (event) {
    const data = event.data;
    if (data.type === 'INIT_MAP') {
        map.width = data.mapWidth;
        map.height = data.mapHeight;
        map.tiles = data.mapTiles;
        map.isCeilLight = data.isCeilLight;
        map.isFloorLight = data.isFloorLight;
        map.JITTER_MASK = data.jitterMask;
        map.jitterTableX = data.jitterTableX;
        map.jitterTableY = data.jitterTableY;

        textures = data.textures;
        CHAR_CACHE = data.CHAR_CACHE;
        WALL_TILE = data.WALL_TILE;
        brightness = data.brightness;
    }
    else if (data.type === 'RENDER_SLICE') {
        const {
            startColumn,
            endColumn,
            buffer,
            depthBuffer,
            playerX,
            playerY,
            playerAng,
            playerViewX,
            playerViewY,
            playerBJumping,
            playerBFalling,
            currentFrame,
            animationTimer,
            fLooktimer,
            nJumptimer,
            viewHeight,
            viewSkew,
            viewHalfHeight,
            viewPlaneX,
            viewPlaneY,
            viewNRenderMode
        } = data;
        // Populate worker-global states
        player.x = playerX;
        player.y = playerY;
        player.ang = playerAng;
        player.viewX = playerViewX;
        player.viewY = playerViewY;
        player.bJumping = playerBJumping;
        player.bFalling = playerBFalling;
        game.currentFrame = currentFrame;
        game.animationTimer = animationTimer;
        game.fLooktimer = fLooktimer;
        game.nJumptimer = nJumptimer;
        viewWindow.width = endColumn - startColumn; // local slice width
        viewWindow.height = viewHeight;
        viewWindow.halfHeight = viewHalfHeight;
        viewWindow.skew = viewSkew;
        viewWindow.nRenderMode = viewNRenderMode;
        viewWindow.buffer = buffer;
        viewWindow.depthBuffer = depthBuffer;
        // Reset visited tiles array for this frame
        map.visitedTiles = new Uint32Array(map.width * map.height);
        // Run the rendering algorithm
        runRaycasterSlice({ ...data, visitedTiles: map.visitedTiles });
        // Transfer computed ArrayBuffers back with zero copy
        self.postMessage({
            buffer,
            depthBuffer,
            visitedTiles: map.visitedTiles
        }, [buffer.buffer, depthBuffer.buffer]);
    }
};
