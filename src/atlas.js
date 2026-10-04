import { charLookup } from "./main-io.js";

export {PALETTE_32BIT, atlasCanvas, pixelW, pixelH, charToAtlasIndex, buildGlyphAtlas, softBlitter}
// currently just grayscale, for lighting
const PALETTE = [
	"#000000",
	"#181818",
	"#282828",
	"#383838",
	"#474747",
	"#565656",
	"#646464",
	"#717171",
	"#7e7e7e",
	"#8c8c8c",
	"#9b9b9b",
	"#ababab",
	"#bdbdbd",
	"#d1d1d1",
	"#e7e7e7",
	"#ffffff"
];

const PALETTE_32BIT = PALETTE.map((hex) => {
	const r = parseInt(hex.substring(1, 3), 16);
	const g = parseInt(hex.substring(3, 5), 16);
	const b = parseInt(hex.substring(5, 7), 16);
	const a = 255; // Solid opacity
	return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
});

let atlasCanvas = null;
const softBlitter = true;		// global option
let pixelW = 6;		// TODO get this auto measured, as seen....somewhere
let pixelH = 12;
const charToAtlasIndex = new Uint16Array(65536);	// get atlas char index via char unicode

function buildGlyphAtlas(viewWindow) {

    pixelW = viewWindow.canvasFontWidth;
    pixelH = viewWindow.canvasFontHeight;

   // pixel dimensions for character atlas canvas
   	const physicalCharW = Math.round(pixelW * viewWindow.dpr);
   	const physicalCharH = Math.round(pixelH * viewWindow.dpr);

	viewWindow.physicalCharW = physicalCharW;	// TODO define these on viewWindow object
	viewWindow.physicalCharH = physicalCharH;
    
    // map disjoint character codes to sequential column index
	const uniqueChars = Array.from(charLookup.keys()).sort((a, b) => a - b);
    uniqueChars.forEach((ch, index) => {
        charToAtlasIndex[ch] = index;
    });

    // create off-screen atlas canvas
    const atlas = document.createElement("canvas");
    	// NOTE i think we need to do something to make the chars on this canvas higher res
    atlas.width = uniqueChars.length * physicalCharW;
    atlas.height = PALETTE.length * physicalCharH;

	document.body.appendChild(atlas);		// NOTE debug only

	
    const actx = atlas.getContext("2d", { alpha: false });
    actx.imageSmoothingEnabled = false;

	actx.scale(viewWindow.dpr, viewWindow.dpr);
    
	// clear canvas
    actx.fillStyle = "#000000";
    actx.fillRect(0, 0, atlas.width, atlas.height);
    
	// canvas Font render settings
    // actx.font = `700 ${fontPx}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
	actx.font = viewWindow.canvasFont;
    actx.textAlign = "center";
    actx.textBaseline = "middle";
    const ox = pixelW / 2;
    const oy = pixelH / 2 + pixelH * 0.05;

    // render characters column-by-column (chars) and row-by-row (shading palette)
    for (let ci = 0; ci < PALETTE.length; ci++) {
        actx.fillStyle = PALETTE[ci];
        uniqueChars.forEach((ch, index) => {
            const charStr = String.fromCharCode(ch);
            actx.fillText(charStr, index * pixelW + ox, ci * pixelH + oy);
        });
    }
    atlasCanvas = atlas;
    
    viewWindow.atlasCols = uniqueChars.length;
    viewWindow.atlasRows = PALETTE.length;

	// setup soft blitter buffers
	if (softBlitter) {
		viewWindow.atlasImageData = actx.getImageData(0, 0, atlas.width, atlas.height);
		viewWindow.atlasBuf32 = new Uint32Array(viewWindow.atlasImageData.data.buffer);
	}
}
