let moving, keyW, keyS;
export function init() {
    document.onkeydown = function(e) {
        moving = true;
        if (e.key == "w") {
            keyW = true;
        } else {
            keyW = false;
        }
        if (e.key == "s") {
            keyS = true;
        } else {
            keyS = false;
        }
    }
    document.onkeyup = function() {
        moving = false;
    }
}
export { moving, keyS, keyW }