export {player, move};

import {map} from './map.js';

import {_debugOutput, ioDebug} from './util.js';


const PLAYER_RADIUS = 0.2;		// keep the player a bit away from the walls	// IO only

// NOTE TODO the player object could really go in here, and it would be simple and good, and make things better
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
		return (this.bTurnLeft || this.bTurnRight || this.bStrafeLeft || this.bStrafeRight
			|| (this.bMoveForward && this.bPlayerMayMoveForward) || this.bMoveBackward
			|| this.bJumping || this.bFalling || this.bRunning) && !this.bPaused
		},		// HERE, should probably move this into io, it's only used to determine if to call the _mh.move() function
							// i think i implemented this as a way to block movement when paused
							// but there's probably a better way to do that /in/ the io movement functions instead of the game loop
	get viewX() { return Math.cos(this.ang) },		// NOTE these are used all over the place for player movement, maybe share
	get viewY() { return Math.sin(this.ang) },	// NOTE this and the planeX/Y should probably be in renderer
};

	// called once per frame, handles movement computation
// 	function move(viewX, viewY, deltaTime, player) {
	function move(deltaTime) {

		if(player.bTurnLeft){
			player.ang -= 0.05;
		}

		if(player.bTurnRight){
			player.ang += 0.05;
		}

		let playerSpeed = player.bRunning ? 0.006 : 0.003;	// ~3 unit/sec @ 60 physics fps
		

		let deltaXDir = 0;
		let deltaYDir = 0;
		let deltaX = player.viewX * playerSpeed * deltaTime;
		let deltaY = player.viewY * playerSpeed * deltaTime;
		let totalMoveVectorX = 0;
		let totalMoveVectorY = 0;		


		if(player.bStrafeLeft ^ player.bStrafeRight) {		// TODO continue optimizing this
			let [straifDeltaX, straifDeltaY] = [deltaY, deltaX];
			if(player.bStrafeLeft) {
				deltaXDir = 1;
			deltaYDir = -1;
			} else {
				deltaXDir = -1;
			deltaYDir = 1;
			
			}
			
		totalMoveVectorX += straifDeltaX * deltaXDir;
		totalMoveVectorY += straifDeltaY * deltaYDir;
		}


		if((player.bMoveForward && player.bPlayerMayMoveForward) ^ player.bMoveBackward) {
			if(player.bMoveForward) {
				deltaXDir = 1;
			deltaYDir = 1;
			} else {
				deltaXDir = -1;
			deltaYDir = -1;
			}
			
		totalMoveVectorX += deltaX * deltaXDir;
		totalMoveVectorY += deltaY * deltaYDir;
		}
		
		_debugOutput(`deltaX: ${deltaX}; deltaY: ${deltaY}; randomLightSwitch: ${ioDebug.randomLightSwitch}`, 'debug2');
		
		let newX = player.x + totalMoveVectorX;
		let newY = player.y + totalMoveVectorY;
		
		
		// TODO i think i need the direction the door faces, if the player stays on that side of the door then all movement should be allowed
			// that will fix the issue with only being allowed to move normal to the door
		let checkX = (totalMoveVectorX > 0) ? (newX + PLAYER_RADIUS) : (newX - PLAYER_RADIUS);
		
		if (map.tiles[~~player.y * map.width + ~~checkX] === '.'.charCodeAt(0)
				|| map.tiles[~~player.y * map.width + ~~checkX] === ','.charCodeAt(0)) {
			player.x = newX;
		} else if (map.tiles[~~player.y * map.width + ~~checkX] === 'X'		// check for door tiles so we can go half way into the tile
				&& ((Math.sign(totalMoveVectorX) <= 0 && checkX - ~~checkX > 0.5) || (Math.sign(totalMoveVectorX) >= 0 && checkX - ~~checkX < 0.5))) {
			player.x = newX;		
		}
		
		let checkY = (totalMoveVectorY > 0) ? (newY + PLAYER_RADIUS) : (newY - PLAYER_RADIUS);
		
		if (map.tiles[~~checkY * map.width + ~~player.x]  === '.'.charCodeAt(0)
				|| map.tiles[~~checkY * map.width + ~~player.x] === ','.charCodeAt(0)) {
			player.y = newY;
		} else if (map.tiles[~~checkY * map.width + ~~player.x] === 'X'.charCodeAt(0)
				&& ((Math.sign(totalMoveVectorY) >= 0 && checkY - ~~checkY < 0.5) || (Math.sign(totalMoveVectorY) <= 0 && checkY - ~~checkY > 0.5))) {
			player.y = newY;		
		}

//		 _debugOutput(`dX: ${deltaX}; dDirX: ${deltaXDir}; totX: ${totalMoveVectorX}; dY: ${deltaY}; dDirY: ${deltaYDir}; totY: ${totalMoveVectorY}`, 'debug2');
		}
