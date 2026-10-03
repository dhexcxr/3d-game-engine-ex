export {ioDebug, memoize, _randomIntFromInterval, watchProp, _debugOutput};




// util functions - could probably be a new module

const ioDebug = {
	randomLightSwitch: false
};

// cheap/easy memoize from Google AI
	// it's own key resolver must be defined unless there is only one arg

/**
 * A fast, capped memoization function for game loops.
 * 
 * @param {Function} fn - The function to memoize
 * @param {number} maxCacheSize - Max number of unique arguments to cache (LRU-like eviction)
 * @param {Function} resolver - Optional function to generate a strict cache key from arguments
 * @returns {Function} - The memoized function
 */
function memoize(fn, maxCacheSize = 100, resolver = null) {
    const cache = new Map();
    
    // Using a separate array to track keys allows us to implement 
    // a lightweight eviction policy without heavy memory overhead.
    const keys = [];

    return function(...args) {
        // Generate a cache key. If a resolver is provided, use it.
        // Otherwise, assume the first argument is a primitive/key to avoid serialization.
        const key = resolver ? resolver(...args) : args[0];

        if (cache.has(key)) {
            return cache.get(key);
        }

        const result = fn(...args);

        if (cache.size >= maxCacheSize) {
            // Evict the oldest entry (FIFO) to keep memory footprint predictable
            const oldestKey = keys.shift();
            cache.delete(oldestKey);
        }

        keys.push(key);
        cache.set(key, result);

        return result;
    };
}
var _randomIntFromInterval = function(min, max) { // min and max included
	return ~~(Math.random() * (max - min + 1) + min);
};


/**
 *
 * watch for changes in a property, can help add breakpoint whenever value changes
 *
 * @param {Object} obj - the object containing the property to watch
 * @param {String} prop - the name of the object property to watch, in string form
 *
 */
function watchProp(obj, prop) {
  let val = obj[prop];
  Object.defineProperty(obj, prop, {
    get: function() {
    	console.trace(`${prop} get, val: ${val}
trace:`)
    	return val;
    },
    set: function(newVal) {
      val = newVal;
//       console.log(`${prop} changed to:`, newVal);
//       debugger; // DevTools will break right here!
	  console.trace(`${prop} changed to: ${newVal}
trace:`);
    },
    configurable: true
  });
}


  // leaving the console for errors, logging seems to kill performance
var _debugOutput = function(input, elementId, append = false) {
  	let debugEl = document.getElementById(elementId)
  	
  	if(input === 'clear') {
		debugEl.textContent = '';
  	} else {
		if (append) {
			debugEl.insertAdjacentHTML("beforeend", `; ${input}`);
		} else {
			debugEl.innerHTML = input;
		}
	}
};
