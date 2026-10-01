// raycaster

export {raycaster};

import {game, brightness, player, memoize} from './main-game-engine.js';
import {_debugOutput, viewWindow, map} from './main-io.js';
import {_r, _rh} from './main-renderer.js';

const absSign = (x) => (x === 0 ? 1 : Math.sign(x));	// RENDERER only
const edgeThreshold = 0.05;		// control thickness of border in flat renderer, also holes	// RAYCASTER only

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

        var bInObject = false;

        var sWalltype = "#";
        var sObjectType = "0";
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
      	let playerInsideDoorTile = map.tiles[~~player.y * map.width + ~~player.x] === 'X';

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
          if(map_x < 0 || map_x >= map.width || map_y < 0 || map_y >= map.height){
//             bHitWall = true; // no wall there, but with this enabled we paint a wall, but can still go through it
            fDistanceToWall = viewWindow.depth;
            bBreakLoop = true;
          }

          // test for objects
          else if(tileType == "o" || tileType == ",") {	// NOTE we'll need to update this to account for holes next to ceiling...thingies
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
				var nObjectCeiling = viewWindow.skew - nObjectHeight / (tileType == "," ? 1.5 : 2);
				var nObjectFloor = viewWindow.skew + nObjectHeight / 2;
					
				vHitObjects.push({objMapTileIndex: currentMapTileIndex, objType: tileType, distToObj: fDistanceToObject, atObjBoundary: isObjBoundary, objHeight: nObjectHeight, objCeil: nObjectCeiling, objFloor: nObjectFloor});
            }
            bInObject = true;
            sObjectType = tileType;
          }

          else if (tileType === 'X') {		// exit door
          	bHitWall = true;

            fDistanceToWall = hit_NS_wall ? side_dist_x - delta_x : side_dist_y - delta_y;

			fDistToDoor = fDistanceToWall + Math.abs(0.5 / (hit_NS_wall ? rayDirX : rayDirY));

			let distToDoorX = ~~(player.x + fDistToDoor * rayDirX);
			let distToDoorY = ~~(player.y + fDistToDoor * rayDirY);

			bBreakLoop = map_x === distToDoorX && map_y === distToDoorY;
            sWalltype = tileType;
          }

          // Test for walls	// NOTE why is it not....like, testing /for/ walls...
          else if( tileType != "." ){
            bHitWall = true;
            fDistanceToWall = hit_NS_wall ? side_dist_x - delta_x : side_dist_y - delta_y;
            bBreakLoop = true;
            sWalltype = tileType;
          }

	          // save back of object distance as soon as we're out of it
          if(bInObject == true && tileType !== "o" && tileType !== ",") {	// if we get multiple objects we'll eventually need to make an array of them or something and loop through them to check when we leave a specific one
          		// well, if we don't have them overlapping in a single screen column....
          		// TODO test how this might work with two separate holes, we'll need to paint hole, then floor, then hole
          		fDistanceToInverseObject = hit_NS_wall ? side_dist_x - delta_x : side_dist_y - delta_y;
				let fInvObjSampleX = hit_NS_wall ? player.y + fDistanceToInverseObject * rayDirY : player.x + fDistanceToInverseObject * rayDirX;
				
				// used to place texture exactly where ray hit wall
				fInvObjSampleX -= ~~(fInvObjSampleX);
		
				// draw lines between wall blocks in no texture mode
				isInvObjBoundary = (fInvObjSampleX <= edgeThreshold || fInvObjSampleX >= 1.0 - edgeThreshold);
				bInObject = false;
			  		        // TODO move this where its used and loop through vHitObjects
				var nFObjectBackwall = viewWindow.skew + (viewWindow.height / (fDistanceToInverseObject + 0) /2 ); // 0 makes the object flat, higher the number, the higher the object :)
				var nFObjectBackCeil = viewWindow.skew - (viewWindow.height / (fDistanceToInverseObject + 0) / (vHitObjects.at(-1) ? 1.5 : 2) );

				Object.assign(vHitObjects.at(-1), {distToBackOfObj: fDistanceToInverseObject, atObjBackBoundary: isInvObjBoundary, backOfObjFloor: nFObjectBackwall, backOfObjCeil: nFObjectBackCeil});
          }

        } // end ray casting loop

		if(hit_NS_wall) {		// NS wall	// sin(RayAng) gives normalized Ray Vector
			fSampleX = player.y + fDistanceToWall * rayDirY;
			sWallFaceDirection = step_x === 1 ? "W" : "E";
		} else {
			fSampleX = player.x + fDistanceToWall * rayDirX;
			sWallFaceDirection = step_y === 1 ? "N" : "S";
		}

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

        // at the end of ray casting, we should have the lengths of the rays
        // set to their last value, representing their distances
        // based on the distance to wall, determine how much floor and ceiling to show per column,
        // Adding in the recalc for looking (game.fLookTimer) and jumping (game.nJumptimer)
        var wallHeight = Math.round(viewWindow.height / fDistanceToWall);
        var nCeiling = viewWindow.skew - wallHeight / 2;
		var nFloor   = viewWindow.skew + wallHeight / 2;


        // similar for towers and gates
        let nTower = viewWindow.skew - wallHeight / 2 - wallHeight;

			// technique from original wolf3d code (I think), and also this guy: https://github.com/permadi-com/ray-cast/blob/master/demo/1/sample1.js
			// TODO put all these types of calcs in each "hit object" code so it doesn't run all the time
		let nDoorHeight = Math.round(viewWindow.height / fDistToDoor)	// TODO change the gate render, make the blockV on the left and right edges
        let nDoorFrameTop = viewWindow.skew - nDoorHeight / 2;			//  (maybe in the center, like striped), and blockH in the center
        let nDoorFrameBot = viewWindow.skew + nDoorHeight / 2;			// Second, try to actually give it an upper door jamb
				        										// ALSO, standardize Door vs Gate in var and func names


        // the spot where the wall was hit
        viewWindow.depthBuffer[screenColumn] = fDistanceToWall;


        // draw the columns one screenheight-pixel at a time
        for(var screenRow = 0; screenRow < viewWindow.height; screenRow++){

          // sky
          if( screenRow < nCeiling){
          	let ceilThings = vHitObjects.filter(obj => obj.objType === ','
          			&& screenRow > obj.objCeil - obj.objHeight
            		&& screenRow <= obj.objCeil - (5 / obj.distToObj)	// border around light/ceiling
            		&& (sWalltype !== "T" || fDistanceToWall >= obj.distToObj));

            // case of tower block (the bit that reaches into the ceiling)
            // TODO loop through ceiling vHitObjects
            if(sWalltype == "T"
            		&& screenRow > nTower
            		&& (sObjectType !== ","
            			|| fDistanceToObject >= fDistanceToWall
            			|| (sObjectType === "," && nObjectCeiling <= nCeiling && screenRow > nObjectCeiling))) {
            	let fSampleY = ((screenRow - nTower) / (nCeiling - nTower));
                viewWindow.buffer[screenRow * viewWindow.width + screenColumn] = _rh.renderWall(fDistanceToWall, sWallFaceDirection, _r.getSamplePixel(textures[sWalltype], fSampleX, fSampleY));
			// draw ceiling/sky		// TOOO loop through ceiling vHitObjects
	    	} else if(ceilThings.length > 0) {
                viewWindow.buffer[screenRow * viewWindow.width + screenColumn] = ceilThings[0].atObjBoundary ? brightness[0] : "1".charCodeAt(0);
            } else {
                viewWindow.buffer[screenRow * viewWindow.width + screenColumn] = brightness[0];
            }		          // solid block
          } else if( screenRow > nCeiling && screenRow <= nFloor && !(screenRow >= nDoorFrameBot && sWalltype == 'X') ) {

            // Door/exit Walltype
            if(sWalltype == "X"){
			  if (screenRow > nDoorFrameTop) {
				viewWindow.buffer[screenRow * viewWindow.width + screenColumn] = _rh.renderGate(screenRow, fDistToDoor, nDoorFrameTop, nCeiling);
              } else {
                viewWindow.buffer[screenRow * viewWindow.width + screenColumn] = brightness[0];
              }
            } else if(sWalltype != "." || sWalltype == "T") {		// Solid Walltype

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
                viewWindow.buffer[screenRow * viewWindow.width + screenColumn] = _r.getSamplePixel(textures[sWalltype], fSampleX, fSampleY);
              } else if( viewWindow.nRenderMode == 2 ) {		// Render Texture with Shading
                viewWindow.buffer[screenRow * viewWindow.width + screenColumn] = _rh.renderWall(fDistanceToWall, sWallFaceDirection, _r.getSamplePixel(textures[sWalltype], fSampleX, fSampleY));
              } else if( viewWindow.nRenderMode == 0 ) {	// old, solid-style shading
                viewWindow.buffer[screenRow * viewWindow.width + screenColumn] = _rh.renderSolidWall(fDistanceToWall, isBoundary);
              }
            } else {		// render whatever char is on the map as walltype
              viewWindow.buffer[screenRow * viewWindow.width + screenColumn] = sWalltype;
            }
          } else {		// floor
            viewWindow.buffer[screenRow * viewWindow.width + screenColumn] = _rh.renderFloor(screenRow);
          }
        } // end draw column loop

        // Object-Draw (removed overlayscreen)
        for(var y = 0; y < viewWindow.height; y++) {	// TODO loop through vHitObjects
          vHitObjects.filter(obj => {
          	return obj.objType == "o" && y >= obj.backOfObjFloor && y <= obj.objFloor
          }).forEach(hole => {
            viewWindow.buffer[y * viewWindow.width + screenColumn] = _rh.renderSolidWall(hole.distToObj, hole.atObjBackBoundary)
          });
          
          vHitObjects.filter(obj => {
          	return obj.objType == "," && y >= obj.objCeil && y <= obj.backOfObjCeil
          }).forEach(ceil => {
            viewWindow.buffer[y * viewWindow.width + screenColumn] = _rh.renderSolidWall(ceil.distToObj)		// this is kinda like a ceiling light
//             viewWindow.buffer[y * viewWindow.width + screenColumn] = "^".charCodeAt(0);	// @ looks nice here too
          });
        } // end draw column loop		// == nFObjectBackCeil, draw black 'pixel'
      }  // end column loop
//       map.visitedTiles = visitedTiles;
}
