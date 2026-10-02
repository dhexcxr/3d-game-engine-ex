// raycaster

export {raycaster};

import {game, player, memoize} from './main-game-engine.js';
import {_debugOutput, brightness, viewWindow, map, CHAR_CACHE} from './main-io.js';
import {_r, _rh} from './main-renderer.js';

const absSign = (x) => (x === 0 ? 1 : Math.sign(x));	// RENDERER only
const edgeThreshold = 0.05;		// control thickness of border in flat renderer, also holes	// RAYCASTER only

// Constants for 1.5 tile maximum light radius
const MAX_RADIUS_SQ = 6.25; // 1.5 * 1.5
const MAX_FLR_RADIUS_SQ = 2.25; // 1.5 * 1.5
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


function raycaster() {
// for the length of the screenwidth (one frame)
// 	let visitedTiles = map.visitedTiles;
      for(var screenColumn = 0; screenColumn < viewWindow.width; screenColumn++){

        // calculates the ray angle into the world space
        // take the current player angle, subtract half the field of view
        // and then chop it up into equal little bits of the screen width (at the current column)
//         var fRayAngle = (player.ang - fFOV / 1.8) + (screenColumn / viewWindow.width) * fFOV;
        	// TODO calc first ray angle outside of individual ray loop
        		// then calc interval between rays
        		// then just add interval to original angle on each iteration
        		// see https://tech.nextroll.com/blog/dev/2022/02/02/rustenstein.html

	// cameraX is the vector of the current ray being cast with respect to the camera/screen plane
		cameraX = (2 * screenColumn / viewWindow.width) - 1;
		rayDirX = player.viewX + (viewWindow.planeX * cameraX);
		rayDirY = player.viewY + (viewWindow.planeY * cameraX);


        var bBreakLoop = false;

        var fDistanceToWall = 0;
//         let fPrevDistanceToWall = fDistanceToWall;
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
        while(!bBreakLoop && nRayLength < viewWindow.depth * 2){

		  if(side_dist_x < side_dist_y) {
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
          if(map_x < 0 || map_x >= map.width || map_y < 0 || map_y >= map.height) {
//             bHitWall = true; // no wall there, but with this enabled we paint a wall, but can still go through it
			bHitOoB = true;
            fDistanceToWall = viewWindow.depth;
            fDistanceToOoB = hit_NS_wall ? side_dist_x - delta_x : side_dist_y - delta_y;
            bBreakLoop = true;
          }

          // test for objects
          else if(tileType == "o".charCodeAt(0) || tileType == ",".charCodeAt(0)) {	// NOTE we'll need to update this to account for holes next to ceiling...thingies
          	if(!bInObject) {
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
          }

          else if (tileType === 'X'.charCodeAt(0)) {		// exit door
          	bHitWall = true;

            fDistanceToWall = hit_NS_wall ? side_dist_x - delta_x : side_dist_y - delta_y;

			fDistToDoor = fDistanceToWall + Math.abs(0.5 / (hit_NS_wall ? rayDirX : rayDirY));

			let distToDoorX = ~~(player.x + fDistToDoor * rayDirX);
			let distToDoorY = ~~(player.y + fDistToDoor * rayDirY);

			bBreakLoop = map_x === distToDoorX && map_y === distToDoorY;
            sWalltype = tileType;
          }

          // Test for walls	// NOTE why is it not....like, testing /for/ walls...
          else if( tileType != ".".charCodeAt(0) ) {		// NOTE this also matches towers
            bHitWall = true;
            fDistanceToWall = hit_NS_wall ? side_dist_x - delta_x : side_dist_y - delta_y;
            bBreakLoop = true;
            sWalltype = tileType;
          }

	          // save back of object distance as soon as we're out of it
          if(bInObject == true && tileType !== "o".charCodeAt(0) && tileType !== ",".charCodeAt(0)) {
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

		if(hit_NS_wall) {		// NS wall	// sin(RayAng) gives normalized Ray Vector
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
			if(hit_NS_wall) {
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
        viewWindow.depthBuffer[screenColumn] = fDistanceToWall;




/*--------LIGHTS--------*/

		// check if nearby tiles are lights, so we can brighten walls, etc
		closestLightWallDist = Infinity;

		let wallLight = 0;		// NOTE TODO these should go into an object, probably
		let lightFromCeilInColumn = false;		// TODO next, probably put togethet these objects to get lights working how i want them
		let lightFromHoleInColumn = false;
		let ceilLightInTile = false;
		let floorLightInTile = false;

		const invLightRadius = 1 / MAX_RADIUS_SQ;
		const invLightFlRadius = 1 / MAX_FLR_RADIUS_SQ;

		let lightCalcs = new Array(9);

		let xStart = 0;
		let xEnd = 0;
		let yStart = 0;
		let yEnd = 0;

		switch (sWallFaceDirection) {
			case 'N': xStart = -2, xEnd = 2;
						yStart = -1, yEnd = -2;	break;

			case 'S': xStart = -2, xEnd = 2;
						yStart = 1, yEnd = 2; break;

			case 'E': xStart = 1, xEnd = 2;
						yStart = -2, yEnd = 2; break;

			case 'W': xStart = -2, xEnd = -1;
						yStart = -2, yEnd = 2; break;
		}

							// Look at current tile and its immediate neighbors for a light
		for (let sx = xStart; sx <= xEnd; sx++) {
			for (let sy = yStart; sy <= yEnd; sy++) {
				const lightX = Math.min(Math.max(map_x + sx, 0), map.width - 1);
				const lightY = Math.min(Math.max(map_y + sy, 0), map.height - 1);

				const ceilLookupIndex = lightY * map.width + lightX;

				ceilLightInTile = map.tiles[ceilLookupIndex] === ",".charCodeAt(0);
				floorLightInTile = map.tiles[ceilLookupIndex] === "o".charCodeAt(0);

				lightFromCeilInColumn = lightFromCeilInColumn || ceilLightInTile;
				lightFromHoleInColumn = lightFromHoleInColumn || floorLightInTile;


				// if (map.tiles[lightY * map.width + lightX] === ",") {
				if (ceilLightInTile
						|| (floorLightInTile	// creepy glow from floor holes
							&& sx >= Math.sign(xStart) && sx <= Math.sign(xEnd)
							&& sy >= Math.sign(yStart) && sy <= Math.sign(yEnd))) {	// TODO classify all tile types in charLookup or something, so we can do constant things like === WALL_TILE
					const dx = exactHitX - (lightX + 0.5);
					const dy = exactHitY - (lightY + 0.5);	// TODO we might need to calc the yDist from light to wall in here, to better blend ceil vs floor
					const distSq = ceilLightInTile ? dx * dx + dy * dy : 0;
					const distFlSq = floorLightInTile ? dx * dx + dy * dy : 0;

					const lightPreCalc = 1 - (distSq * invLightRadius);
					const lightFlPreCalc = 1 - (distFlSq * invLightFlRadius);

					lightCalcs.push(((currentCeilLightTile, currentFloorLightTile) => {
						return (fSampleY) => {
							let totalLight = 0;
						
							if (currentCeilLightTile) {
								const vertDistSq = fSampleY * fSampleY;

						if (distSq + vertDistSq < MAX_RADIUS_SQ) {
							const lightCalc = lightPreCalc - (vertDistSq * invLightRadius);
									totalLight += lightCalc * lightCalc * 0.8;
								}
							}

							if (currentFloorLightTile) {
								const vertDistSq = (1 - fSampleY) * (1 - fSampleY);
								
								if (distFlSq + vertDistSq < MAX_FLR_RADIUS_SQ) {
									const lightCalc = lightFlPreCalc - (vertDistSq * invLightFlRadius);
									totalLight += lightCalc * lightCalc * 0.8;
					}
		  	}
							return totalLight;
					}})(ceilLightInTile, floorLightInTile));
		}
	}
}
/*-----end-LIGHTS------*/


        // draw the columns one screenheight-pixel at a time
        for(var screenRow = 0; screenRow < viewWindow.height; screenRow++){

          // sky
          if(screenRow < nCeiling) {	// TODO if we are in a thing (wall, tower, light), quick fill from top of thing to bottom without looping and running all conditional checks again, could be complicated if there are more things in front of other things, like the lights are
          	let ceilThings = vHitObjects.filter(obj => obj.objType === ','.charCodeAt(0)
          			&& screenRow > obj.objCeil - obj.objHeight
            		// && screenRow <= obj.objCeil - (5 / obj.distToObj)	// border around light/ceiling
            		&& screenRow <= obj.objCeil
            		&& (sWalltype !== "T".charCodeAt(0) || fDistanceToWall >= obj.distToObj))	// NOTE closer obj always added first
            			/* .sort((ceilOne, ceilTwo) => ceilOne.distToObj - ceilTwo.distToObj) */;	// prob don't need sort

            // case of tower block (the bit that reaches into the ceiling)
            if(sWalltype == "T".charCodeAt(0)
            		&& screenRow > nTowerCeil
            		&& (sObjectType !== ",".charCodeAt(0)
            			|| fDistanceToObject >= fDistanceToWall
            			|| (sObjectType === ",".charCodeAt(0) && nObjectCeiling <= nCeiling && screenRow > nObjectCeiling))) {
            	let fSampleY = ((screenRow - nTowerCeil) / (nCeiling - nTowerCeil));
				const wallLight = lightCalcs.reduce((totalLight, lightCalc) => {
					return totalLight + lightCalc(fSampleY);
				}, 0);
				const clampedLight = Math.min(Math.max(wallLight, 0.0), 0.999);
				const lightBright = ~~(clampedLight * 4);
                viewWindow.buffer[screenRow * viewWindow.width + screenColumn] = _rh.renderWall(fDistanceToWall, sWallFaceDirection, _r.getSamplePixel(textures[CHAR_CACHE[sWalltype]], fSampleX, fSampleY), lightBright);
	    	} else if(ceilThings.length > 0) {
                viewWindow.buffer[screenRow * viewWindow.width + screenColumn] =
                	ceilThings[0].atObjBoundary		// at vertical boundary
                		|| screenRow >= ceilThings[0].objCeil - (5 / ceilThings[0].distToObj)	// at horizontal boundary
                		? brightness[0]		// draw black bar
                		: "1".charCodeAt(0);
            } else {
                viewWindow.buffer[screenRow * viewWindow.width + screenColumn] = brightness[0];
            }		          // solid block
          } else if( screenRow > nCeiling && screenRow <= nFloor && !(screenRow >= nDoorFrameBot && sWalltype == 'X'.charCodeAt(0))) {

            // Door/exit Walltype	// TODO if this is right next to light, render full bright, if one away (e.g., diagonal) render half bright
            if(sWalltype == "X".charCodeAt(0)){
			  if (screenRow > nDoorFrameTop) {
				viewWindow.buffer[screenRow * viewWindow.width + screenColumn] =
					_rh.renderGate(screenRow, fDistToDoor, nDoorFrameTop, nCeiling);
              } else {
                viewWindow.buffer[screenRow * viewWindow.width + screenColumn] = brightness[0];
              }
            } else if(sWalltype != ".".charCodeAt(0) || sWalltype == "T".charCodeAt(0)) {		// Solid Walltype

              var fSampleY = ( (screenRow - nCeiling) / wallHeight );

              /**
               * animation timer example
               */
              // if( game.animationTimer < 5 ){
              //   viewWindow.buffer[screenRow * viewWindow.width + screenColumn] = _r.getSamplePixel(texture, fSampleX, fSampleY);
              // } else if( game.animationTimer >= 5 && game.animationTimer < 10 ) {
              //   viewWindow.buffer[screenRow * viewWindow.width + screenColumn] = _r.getSamplePixel(texture2, fSampleX, fSampleY);
              // } else if( game.animationTimer >= 10 ) {
              //   viewWindow.buffer[screenRow * viewWindow.width + screenColumn] = _r.getSamplePixel(texture3, fSampleX, fSampleY);
              // }

              // Render Texture Directly
              if( viewWindow.nRenderMode == 1 ){
                viewWindow.buffer[screenRow * viewWindow.width + screenColumn] =
                	_r.getSamplePixel(textures[CHAR_CACHE[sWalltype]], fSampleX, fSampleY);
              } else if( viewWindow.nRenderMode == 2 ) {		// Render Texture with Shading
				const wallLight = lightCalcs.reduce((totalLight, lightCalc) => {
					return totalLight + lightCalc(fSampleY);
				}, 0);
				const clampedLight = Math.min(Math.max(wallLight, 0.0), 0.999);
				const lightBright = ~~(clampedLight * 4);
                viewWindow.buffer[screenRow * viewWindow.width + screenColumn] =
                	_rh.renderWall(fDistanceToWall,
                		sWallFaceDirection,
                		_r.getSamplePixel(textures[CHAR_CACHE[sWalltype]], fSampleX, fSampleY), lightBright);
              } else if( viewWindow.nRenderMode == 0 ) {	// old, solid-style shading
                viewWindow.buffer[screenRow * viewWindow.width + screenColumn] =
                	_rh.renderSolidWall(fDistanceToWall, isBoundary);
              }
            } else {		// render whatever char is on the map as walltype
              viewWindow.buffer[screenRow * viewWindow.width + screenColumn] = sWalltype;
            }
          } else {		// floor
          	// calc dist to floor at specific screen row
// 			const currentDist = viewWindow.height / (2.0 * screenRow - viewWindow.height);
// 			const currentDist = (viewWindow.skew) / (2.0 * screenRow - viewWindow.skew);
// 			const currentDist = viewWindow.height / (2 * screenRow  - viewWindow.height - game.nJumptimer * 0.15 - game.fLooktimer * 0.15);
				// this version does very good without skew, light pool looks like its underneath light
// 			const currentDist = 2 * (viewWindow.height - viewWindow.skew) / (screenRow - viewWindow.skew);
				// this version works well with skew, but is too far "below", it is rendered too low on screen
			// const currentDist = 2 * viewWindow.height / (screenRow - viewWindow.skew);
				// ok, i think this is it
			const currentDist = viewWindow.height / (2 * (screenRow - viewWindow.skew));

			// ratio of dist of floor at current screen pixel to total ray length
			const distRatio = currentDist / (bHitOoB ? fDistanceToOoB : fDistanceToWall);

			// calc world coordinates of the floor at this screen pixel
			let floorX = Math.min(Math.max(distRatio * exactHitX + (1.0 - distRatio) * player.x, 0), map.width - 1);
			let floorY = Math.min(Math.max(distRatio * exactHitY + (1.0 - distRatio) * player.y, 0), map.height - 1);

			// true map tile x and y
			const floorMapX = ~~floorX;
			const floorMapY = ~~floorY;
			let floorLight = 0;

			// check if there is a ceiling light near this floor tile
			closestLightFloorDist = Infinity;

		    			// Look at current tile and its immediate neighbors for a light
			for (let sx = -2; sx <= 2; sx++) {
				for (let sy = -2; sy <= 2; sy++) {
					const lightX = Math.min(Math.max(floorMapX + sx, 0), 15);
					const lightY = Math.min(Math.max(floorMapY + sy, 0), 15);

					const ceilLookupIndex = lightY * map.width + lightX;
// TODO NOTE next thing, process map on load, for every tile, build array with x,y of all nearby lights
	// then we won't have to do this searching, looping through sx, sy, and looking at the map.tiles array
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
					// if (map.tiles[lightY * map.width + lightX] === ",") {
					if (map.tiles[ceilLookupIndex] === ",".charCodeAt(0)
							|| (map.tiles[ceilLookupIndex] === "o".charCodeAt(0)	// creepy glow from floor holes
								&& (sx >= -1 || sx <= 1)
								&& (sy >= -1 || sy <= 1))) {	// TODO classify all tile types in charLookup or something, so we can do constant things like === WALL_TILE
						const dx = floorX - (lightX + 0.5);
						const dy = floorY - (lightY + 0.5);
						const distSq = dx * dx + dy * dy;

						if (distSq < MAX_RADIUS_SQ
								&& checkDynamicLOS(floorX, floorY, lightX + 0.5, lightY + 0.5)) {
// 							closestLightFloorDist = distSq;
							const ratio = distSq / MAX_RADIUS_SQ;
							floorLight += (1.0 - ratio) * (1.0 - ratio) * (map.tiles[ceilLookupIndex] === "o".charCodeAt(0)
																				? 0.6
																				: 0.8);	// NOTE consider turning down ceilLight intensity
						}
					}
				}
			}

			const clampedLightFloor = Math.min(Math.max(floorLight, 0.0), 0.999);
			const lightBrightFloor = ~~(clampedLightFloor * 5);

            viewWindow.buffer[screenRow * viewWindow.width + screenColumn] = _rh.renderFloor(screenRow, lightBrightFloor);
          }
        } // end draw column loop

        // Object-Draw (removed overlayscreen)
        for(var y = 0; y < viewWindow.height; y++) {	// loop through vHitObjects
		vHitObjects.filter(obj =>
				obj.objType == "o".charCodeAt(0)
				&& y >= obj.backOfObjFloor
				&& y <= obj.objFloor
		).forEach(floor => {
			viewWindow.buffer[y * viewWindow.width + screenColumn] =
					y <= floor.backOfObjFloor + (4 / floor.distToBackOfObj)	// at horizontal boundary
					? brightness[2]
					: _rh.renderSolidWall(floor.distToObj, floor.atObjBackBoundary)
          	});

          vHitObjects.filter(obj => {
          	return obj.objType == ",".charCodeAt(0) && y >= obj.objCeil && y <= obj.backOfObjCeil
          }).forEach(ceil => {
            viewWindow.buffer[y * viewWindow.width + screenColumn] = brightness[4];		// this is kinda like a ceiling light, carat/^ could be burnt out or flickering light
//             viewWindow.buffer[y * viewWindow.width + screenColumn] = "^".charCodeAt(0);	// @ looks nice here too
          });
        } // end draw column loop		// == nFObjectBackCeil, draw black 'pixel'
      }  // end column loop
//       map.visitedTiles = visitedTiles;
}

function checkDynamicLOS(startX, startY, endX, endY) {
	// Use a fixed number of sample steps proportional to a 1.5 tile maximum distance
	const steps = 4;

	for (let i = 1; i < steps; i++) {
		const t = i / steps;
		// Interpolate a point along the line between pixel and light center
		const checkX = Math.floor(startX + (endX - startX) * t);
		const checkY = Math.floor(startY + (endY - startY) * t);

		// Sample the map
		const tile = map.tiles[checkY * map.width + checkX];	// TODO NOTE make an array of block/wall tiles, so this is just a lookup
		if (tile > 0 && "TX#$CWU".split('').map(char => char.charCodeAt(0)).includes(tile)) {
			return false; // Intersection found, wall blocks light
		}
	}
	return true;
}
