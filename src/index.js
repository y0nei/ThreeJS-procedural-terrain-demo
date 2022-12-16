import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls'
import {ImprovedNoise} from 'three/examples/jsm/math/ImprovedNoise';
import {GUI} from 'dat.gui';
import * as keylogger from './keylogger.js'

// RENDERER
const renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// SCENE
const scene = new THREE.Scene();
scene.background = new THREE.Color( 0xefd1b5 );
scene.fog = new THREE.FogExp2( 0xefd1b5, 0.00 );

// CAMERA
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const cameraOffset = new THREE.Vector3(100, 120, 100);
camera.position.copy(cameraOffset)

// RESIZE HANDLER
window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// CONTROLLER
const controllerObject = new THREE.Mesh(
    new THREE.SphereGeometry(2),
    new THREE.MeshStandardMaterial({ color: "#ffffff" })
);
controllerObject.position.y = 8;
scene.add(controllerObject)

// ORBIT CONTROLS
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.maxPolarAngle = Math.PI / 2 - 0.05 // prevent camera below ground
orbitControls.minPolarAngle = Math.PI / 4        // prevent top down view
orbitControls.enableDamping = true
orbitControls.target.copy(controllerObject.position);
orbitControls.update();

// GLOBAL VALUES
let plane;
let planeArray = [];
let planeParams = {
    baseColor: 0x7f7f7f,
    size: 60,
    subdivs: 20,
    randomColor: false,
    wireframe: false
}
let perlinParams = {
    multiplier: 3,
    amplitude: 10,
}

// CHUNK GENERATION
function createChunk(pos) {
    if (planeParams.randomColor != true) {
        plane = createPlane(planeParams.size, planeParams.baseColor);
    } else {
        plane = createPlane(planeParams.size, Math.random() * planeParams.baseColor + planeParams.baseColor);
    }
    plane.receiveShadow = true;
    setNoise(plane.geometry, new THREE.Vector2(pos.x, pos.z), perlinParams.multiplier, perlinParams.amplitude);
    plane.geometry.rotateX(0.5 * Math.PI);
    plane.position.set(pos.x, 0, pos.z).multiplyScalar(planeParams.size);
    plane.geometry.computeVertexNormals();
    planeArray.push(plane);
    scene.add(plane);
}

// PLANE TEMPLATE
function createPlane(step, color){
    let geometry = new THREE.PlaneGeometry(step, step, planeParams.subdivs, planeParams.subdivs);
    let material = new THREE.MeshStandardMaterial({
        side: THREE.DoubleSide,
        wireframe: planeParams.wireframe,
        color: color
    });
    let mesh = new THREE.Mesh(geometry, material);
    return mesh;
}

// PERLIN NOISE
const perlin = new ImprovedNoise();
function setNoise(g, uvShift, multiplier, amplitude){
    let pos = g.attributes.position;
    let uv = g.attributes.uv;
    let vec2 = new THREE.Vector2();
    for(let i = 0; i < pos.count; i++){
        vec2.fromBufferAttribute(uv, i).add(uvShift).multiplyScalar(multiplier);
        // TODO: Dat-Gui offsets
        pos.setZ(i, perlin.noise(vec2.x, vec2.y, 0) * amplitude );
    }
}

// LIGHTS
const ambientLight = new THREE.AmbientLight(0x888888)
const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
directionalLight.position.set(30, 15 ,0);
directionalLight.intensity = 0.5;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.camera.left= -10;
directionalLight.shadow.camera.right = 10;

scene.add(ambientLight)
scene.add(directionalLight)

// Load keyloader
keylogger.init();

// MODEL MOVEMENT
let direction = 1; // Lets the proceduralGeneration know which direction to generate the terrain in
function modelMovement(speed, element) {
    if (keylogger.moving == true) {
        if (keylogger.keyW == true) {
            camera.position.z += speed;
            element.z += speed;
            direction = 1
        }
        if (keylogger.keyS == true) {
            camera.position.z -= speed;
            element.z -= speed;
            direction = -1
        }
        orbitControls.target.copy(controllerObject.position);
    }
}

// *Terrain Generation
// Relative car position to chunk
function calculateControllerPos() {
    return Math.floor((controllerObject.position.z + planeParams.size/2) / planeParams.size )
}

// Terrain generation function
function genTerrain() {
    createChunk(new THREE.Vector3( 0, 0, calculateControllerPos() + direction));
    createChunk(new THREE.Vector3( 1, 0, calculateControllerPos() + direction));
    createChunk(new THREE.Vector3( -1, 0, calculateControllerPos() + direction));
}
// Generate starting plane
for(let i = 0; i < 3; i++) {
    createChunk(new THREE.Vector3(0, 0 , i -1));
    createChunk(new THREE.Vector3(1, 0 , i -1));
    createChunk(new THREE.Vector3(-1, 0 , i -1));
}

// Terrain generation event
let lastChunk = 0;
let generating = true;
const viewRange = {one:1.5, two:2}
function proceduralGeneration() {
    if (generating) {
        let chunk = calculateControllerPos()
        if (lastChunk != chunk) {
            genTerrain();
            let list = planeArray.filter(p => {
                return Math.abs(p.position.z - controllerObject.position.z) >= planeParams.size * viewRange.one
            })
            for (let i = 0; i < list.length; i++) {
                scene.remove(list[i])
            }
            planeArray = planeArray.filter(p => {
                return !list.includes(p)
            })
            lastChunk = chunk
        }
    }
}

function regenerateTerrain() {
    // Remove planes from scene and array
    for (plane in planeArray) {
        scene.remove(planeArray[plane])
    }
    planeArray = [];
    // Generate new terrain around the controler
    let pos = calculateControllerPos()
    for(let i = 0; i < 3; i++) {
        createChunk(new THREE.Vector3(i -1, 0 , pos));
        createChunk(new THREE.Vector3(i -1, 0 , pos -1));
        createChunk(new THREE.Vector3(i -1, 0 , pos +1));
    }
}

// *Dat-Gui
const gui = new GUI();

const sceneFolder = gui.addFolder('Scene');
sceneFolder.open();
sceneFolder.add(scene.fog, 'density', 0.00, 0.02).step(0.0001).name('Fog')

const meshFolder = gui.addFolder('Mesh Params');
meshFolder.open();
meshFolder.add(planeParams, 'size', 30, 100).name('Chunk Size')
    .onChange(_ => { generating = false; })
    .onFinishChange(_ => {
        regenerateTerrain();
        generating = true;
    })
meshFolder.add(planeParams, 'subdivs', 1, 50).name('Subdivisions')
    .onChange(_ => { generating = false; })
    .onFinishChange(_ => {
        regenerateTerrain();
        generating = true;
    })
meshFolder.addColor(planeParams, 'baseColor').name('Base Color')
    .onChange((value) => {
        for(plane in planeArray) {
            planeArray[plane].material.color.set(value);
        }
    })
// Toggles
meshFolder.add(planeParams, 'randomColor').name('Random Color')
    .onChange(_ => {
        if (planeParams.randomColor == true) {
            for(plane in planeArray) {
                planeArray[plane].material.color.set(Math.random() * planeParams.baseColor + planeParams.baseColor)
            }
        } else {
            for(plane in planeArray) {
                planeArray[plane].material.color.set(planeParams.baseColor)
            }
        }
    })
meshFolder.add(planeParams, 'wireframe').name('Wireframe')
    .onChange((value) => {
        for(plane in planeArray) {
            planeArray[plane].material.wireframe = value
        }
    })
const perlinFolder = meshFolder.addFolder('Perlin Params');
perlinFolder.open();
perlinFolder.add(perlinParams, 'multiplier', 0, 10).name('Multiplier').onFinishChange(_ => { regenerateTerrain(); })
perlinFolder.add(perlinParams, 'amplitude', 0, 50).name('Amplitude').onFinishChange(_ => { regenerateTerrain(); })

// Animation Loop
function animate() {
    requestAnimationFrame(animate);
    proceduralGeneration();
    modelMovement(0.3, controllerObject.position);
    orbitControls.update();
	renderer.render( scene, camera );
}
animate();