export {map};

import {_randomIntFromInterval} from './util.js';

const map = {

	width: 16,
	height: 16,

	tiles: new Uint16Array(),
	exitsto: '',
	
	playerStartX: 0,
	playerStartY: 0,
	playerStartA: 0,

	
	visitedTiles: new Uint32Array(),
	isCeilLight: new Uint8Array(),
	isFloorLight: new Uint8Array(),
	
	JITTER_MASK: 0,

	jitterTableX: new Float32Array(),
	jitterTableY: new Float32Array(),
	
	sprites: {},	// NOTE we should turn this into an array at some point
	
	color: '',
	background: '',



	// TODO make a better name than this
	prep: function(map) {
		// 		let map = window[sLevelstring];
		
		// updates the level map and dimensions
		
		this.width = map.width;
		this.height = map.height;
		
		this.tiles = map.tiles;		// TODO change this to map.tileCodes or something
		
		// keep track of map tiles visited by the rays, help cull sprites without trig
		this.visitedTiles = new Uint32Array(map.width * map.height);	// renderer and raycaster
		
		this.exitsto = map.exitsto;
		this.playerStartX = map.playerStartX;
		this.playerStartY = map.playerStartY;
		this.playerStartA = map.playerStartA;
		
		// light rendering helpers
		this.isCeilLight = new Uint8Array(map.tiles.split('').map(tileChar => tileChar === ","));
		this.isFloorLight = new Uint8Array(map.tiles.split('').map(tileChar => tileChar === "o"));
		
		// light tile jitter
		const JITTER_SIZE = map.width * map.height * 100;
		this.JITTER_MASK = JITTER_SIZE - 1;
		
		this.jitterTableX = new Float32Array(JITTER_SIZE);
		this.jitterTableY = new Float32Array(JITTER_SIZE);
		
		for (let i = 0; i < JITTER_SIZE; i++) {
			// Pre-bake the exact -0.2 to +0.2 range using Math.random()
			this.jitterTableX[i] = (Math.random() * 0.4) - 0.2;
			this.jitterTableY[i] = (Math.random() * 0.4) - 0.2;
		}
		
		// light tile truth maps	// NOTE these were originally just a part of io.js
// 		CEIL_TILE_MAP = Uint8Array.from(map.tiles, tileCharCode => tileCharCode === ",".charCodeAt(0));
// 		HOLE_TILE_MAP = Uint8Array.from(map.tiles, tileCharCode => tileCharCode === "o".charCodeAt(0));
	
		
		// load sprites		// NOTE does this need to be defined? i don't think so
		//		 oLevelSprites = map.sprites;
		
		// 	map.sprites = '';		// DEBUG uncomment to disable
		if( map.sprites == "autogen" ){
			this.sprites = _generateRandomSprites();
		} else if (map.sprites) {
		 this.sprites = map.sprites;
		}
		
		this.color = map.color;
		this.background = map.background;


		// NOTE moved back to io		
// 			// places the player at the map starting point
// 		player.x = map.playerStartX;
// 		player.y = map.playerStartY;
// 		player.ang = map.playerStartA;
// 		
// 		document.querySelector("body").style.color = map.color;
// 		document.querySelector("body").style.background = map.background;
		
	}

};

// generate random Sprites
var _generateRandomSprites = function(nNumberOfSprites) {
	nNumberOfSprites = nNumberOfSprites || Math.round( map.width * map.width / 15 );
	// generates random Pogels or Obetrls! :oooo
	var oRandomLevelSprites = {};	// NOTE so this is an object.....
	for (var m = 0; m < nNumberOfSprites; m++) {
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


// generates only pogels that can be placed
var _generateRandomCoordinates = function() {

	var x = +(_randomIntFromInterval(0, map.width)) + 0;
	var y = +(_randomIntFromInterval(0, map.height)) - 0;

	while (map.tiles[ ~~(y) * map.width + ~~(x)] != ".") {
		x = +(_randomIntFromInterval(0, map.width)) + 1;
		y = +(_randomIntFromInterval(0, map.height)) - 1;
	}

	var oCoordinates = {
		"x": x,
		"y": y
	};

	return oCoordinates;
};

