import { charLookup } from "./main-io.js";

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

export let atlasCanvas = null;
export let pixelW = 6;		// TODO make this auto measured as seen....somewhere
export let pixelH = 12;
export const charToAtlasIndex = new Uint16Array(65536);		// to hold CharCode values -> Atlas index


export function buildGlyphAtlas(viewWindow) {

    pixelW = viewWindow.canvasFontHeight;
    pixelH = viewWindow.canvasFontWidth;

    // Gather all unique character codes used in the game and sort them
    const uniqueChars = Array.from(charLookup.keys()).sort((a, b) => a - b);
    
    // Map each disjoint unique character code to a continuous sequential column index
    uniqueChars.forEach((ch, index) => {
        charToAtlasIndex[ch] = index;
    });

    // Create the off-screen atlas canvas
    const atlas = document.createElement("canvas");

	document.body.appendChild(atlas);		// NOTE debug only

	
    const actx = atlas.getContext("2d", { alpha: false });
    actx.imageSmoothingEnabled = false;

	// NOTE i think we need to do something to make the chars on this canvas higher res
    atlas.width = uniqueChars.length * pixelW * viewWindow.dpr;
    atlas.height = PALETTE.length * pixelH * viewWindow.dpr;
	actx.scale(viewWindow.dpr, viewWindow.dpr);
    
	// clear canvas
    actx.fillStyle = "#000000";
    actx.fillRect(0, 0, atlas.width, atlas.height);
    
	// canvas Font render settings
    const fontPx = Math.floor(pixelH * 0.84);
    // actx.font = `700 ${fontPx}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
	actx.font = viewWindow.canvasFont;
    actx.textAlign = "center";
    actx.textBaseline = "middle";
    const ox = pixelW / 2;
    const oy = pixelH / 2 + pixelH * 0.05; // Perfect vertical alignment offset

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

}
