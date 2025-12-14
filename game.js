import * as THREE from 'three';
import { MISSIONS_BODY, MISSIONS_HAND, MISSIONS_GROUP } from './missions.js';

// --- CONFIG ---
const TILE_COUNT = 30; // Longer path
const COLORS = {
    bg: 0x87CEEB,
    tile_normal: 0xFFFFFF,
    tile_start: 0x00FF88,
    tile_goal: 0xFF69B4,
    // New Categories
    tile_body: 0xFF00FF,   // Magenta
    tile_hand: 0x00FFFF,   // Cyan
    tile_group: 0x32CD32,  // Lime Green

    player1: 0xFF4500,
    player2: 0x1E90FF
};

// --- STATE ---
let state = {
    turn: 0, // 0 or 1
    players: [
        { name: "1くみ", color: COLORS.player1, pos: 0, seals: 0, mesh: null },
        { name: "2くみ", color: COLORS.player2, pos: 0, seals: 0, mesh: null }
    ],
    isMoving: false,
    missionActive: false,
    timerInterval: null
};

// --- SCENE SETUP ---
const canvas = document.querySelector('#game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.bg);
scene.fog = new THREE.Fog(COLORS.bg, 30, 90);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 30, 30);
camera.lookAt(0, 0, 0);

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(50, 100, 50);
dirLight.castShadow = true;
scene.add(dirLight);

// --- BOARD GENERATION ---
const tiles = [];
const pathPoints = [];

// "Gunegune" (Winding) Path Logic
let currentPos = new THREE.Vector3(-30, 0, -20);

for (let i = 0; i < TILE_COUNT; i++) {
    let type = 'normal';
    if (i === 0) type = 'start';
    else if (i === TILE_COUNT - 1) type = 'goal';
    else {
        // Randomly pick a mission type or normal
        const r = Math.random();
        if (r > 0.7) type = 'body';
        else if (r > 0.5) type = 'hand';
        else if (r > 0.4) type = 'group';
    }

    // Curvy Logic
    let t = i * 0.5;
    currentPos.x = -30 + (i * 4); // Move Right
    currentPos.z = Math.sin(i * 0.8) * 8; // Wiggle Z

    // Create Tile
    const geo = new THREE.CylinderGeometry(2, 2, 0.5, 32);
    let col = COLORS.tile_normal;
    if (type === 'start') col = COLORS.tile_start;
    if (type === 'goal') col = COLORS.tile_goal;

    if (type === 'body') col = COLORS.tile_body;
    if (type === 'hand') col = COLORS.tile_hand;
    if (type === 'group') col = COLORS.tile_group;

    const mat = new THREE.MeshStandardMaterial({ color: col });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(currentPos);
    mesh.receiveShadow = true;

    scene.add(mesh);
    tiles.push({ mesh, type, vec: currentPos.clone(), index: i });
}

// Create Players (DELAYED)
// We wait for UI selection now

// Create Players (DELAYED)
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

function spawnPlayer(index, type) {
    const p = state.players[index];

    // Check for custom model file
    const inputId = index === 0 ? 'p1-model-input' : 'p2-model-input';
    const fileInput = document.getElementById(inputId);

    if (fileInput && fileInput.files && fileInput.files[0]) {
        // Load custom model
        const file = fileInput.files[0];
        const url = URL.createObjectURL(file);
        const filename = file.name.toLowerCase();

        let loader;
        if (filename.endsWith('.fbx')) loader = new FBXLoader();
        else if (filename.endsWith('.obj')) loader = new OBJLoader();
        else loader = new GLTFLoader(); // Default to GLB/GLTF

        loader.load(url, (loadedData) => {
            // Handle different loader return types
            let model;
            if (filename.endsWith('.glb') || filename.endsWith('.gltf')) {
                model = loadedData.scene;
            } else {
                // FBX and OBJ return the group/mesh directly
                model = loadedData;
            }

            model.castShadow = true;
            model.traverse(c => { if (c.isMesh) c.castShadow = true; });

            // Normalize Scale
            const box = new THREE.Box3().setFromObject(model);
            const size = new THREE.Vector3();
            box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 3.0 / maxDim; // Target size increased from 1.5 to 3.0
            model.scale.setScalar(scale);

            // Center y
            model.position.y = (size.y * scale) / 2;

            // Setup Mesh wrapper similar to createAnimalMesh
            const group = new THREE.Group();
            group.add(model);

            finishSpawn(p, group, index, type);
        }, undefined, (err) => {
            console.error("Model load failed", err);
            // Fallback
            const mesh = createAnimalMesh(p.color, type);
            finishSpawn(p, mesh, index, type);
        });
    } else {
        // Default Animal
        const mesh = createAnimalMesh(p.color, type);
        finishSpawn(p, mesh, index, type);
    }
}

function finishSpawn(player, mesh, index, type) {
    mesh.castShadow = true;

    // Offset
    const offset = index === 0 ? -1 : 1;
    mesh.position.copy(tiles[0].vec);
    mesh.position.x += offset;
    // Adjust Y based on size roughly equivalent to scale 3.0
    // Default animals are roughly height 2.2 -> scaled 1.5 -> ~3.3 height?
    // Let's set base Y to 0 so they stand on tile, but we need to know the offset.
    // finishSpawn is called after centering, so position.y is base. 
    // Actually in jumpTo we force Y usually.
    mesh.position.y = 0; // Let the model's internal offset handle it, or adjust here.
    // The default animals have y=0.5 for body.


    scene.add(mesh);
    player.mesh = mesh;
    player.type = type; // store type
}

function createAnimalMesh(color, type) {
    const group = new THREE.Group();

    // Override color based on type for variety?
    // Actually keep class color (Orange/Blue) but maybe tint or just use shape
    // Let's stick to Class Color for body, but add features

    // Frog: Greenish tint if desired? No keep class color for clarity

    // Body
    const bodyGeo = new THREE.SphereGeometry(0.7, 16, 16);
    const mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.3 });
    const body = new THREE.Mesh(bodyGeo, mat);
    body.position.y = 0.5;
    group.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.5, 16, 16);
    const head = new THREE.Mesh(headGeo, mat);
    head.position.y = 1.4;
    group.add(head);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);

    if (type === 'frog') {
        eyeL.position.set(-0.25, 1.8, 0.2); // Top of head
        eyeR.position.set(0.25, 1.8, 0.2);
    } else {
        eyeL.position.set(-0.2, 1.5, 0.4);
        eyeR.position.set(0.2, 1.5, 0.4);
    }
    group.add(eyeL);
    group.add(eyeR);

    // Features
    if (type === 'rabbit') {
        const earGeo = new THREE.CapsuleGeometry(0.15, 0.8, 4, 8);
        const earL = new THREE.Mesh(earGeo, mat);
        earL.position.set(-0.3, 2.1, 0);
        const earR = new THREE.Mesh(earGeo, mat);
        earR.position.set(0.3, 2.1, 0);
        group.add(earL);
        group.add(earR);
    } else if (type === 'bear') {
        const earGeo = new THREE.SphereGeometry(0.25, 8, 8);
        const earL = new THREE.Mesh(earGeo, mat);
        earL.position.set(-0.4, 1.8, 0);
        const earR = new THREE.Mesh(earGeo, mat);
        earR.position.set(0.4, 1.8, 0);
        group.add(earL);
        group.add(earR);
        const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.25), new THREE.MeshStandardMaterial({ color: 0xFFDDAA }));
        muzzle.position.set(0, 1.35, 0.45);
        group.add(muzzle);
    } else if (type === 'cat') {
        const earGeo = new THREE.ConeGeometry(0.2, 0.4, 4);
        const earL = new THREE.Mesh(earGeo, mat);
        earL.position.set(-0.35, 1.85, 0);
        earL.rotation.z = 0.5;
        earL.rotation.y = -0.2;
        const earR = new THREE.Mesh(earGeo, mat);
        earR.position.set(0.35, 1.85, 0);
        earR.rotation.z = -0.5;
        earR.rotation.y = 0.2;
        group.add(earL);
        group.add(earR);
        // Whiskers? (Lines - maybe too thin)
    } else if (type === 'frog') {
        // Frog legs?
        const legGeo = new THREE.CapsuleGeometry(0.15, 0.6, 4, 8);
        const legL = new THREE.Mesh(legGeo, mat);
        legL.position.set(-0.6, 0.3, 0);
        legL.rotation.z = 1.0;
        const legR = new THREE.Mesh(legGeo, mat);
        legR.position.set(0.6, 0.3, 0);
        legR.rotation.z = -1.0;
        group.add(legL);
        group.add(legR);
    }

    // Scale up the entire group for default animals
    group.scale.setScalar(1.5); // 1.5x larger than before
    return group;
}


// Target marker styling
const targetMat = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });

// --- PARTICLE SYSTEM ---
class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.geometry = new THREE.PlaneGeometry(0.3, 0.3);
        this.material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true });
    }

    emit(position, count = 10, color = 0xFFD700, type = 'burst') {
        const pColor = new THREE.Color(color);
        for (let i = 0; i < count; i++) {
            const mesh = new THREE.Mesh(this.geometry, this.material.clone());
            mesh.material.color = pColor;

            // Random offset
            const offset = new THREE.Vector3(
                (Math.random() - 0.5) * 1.5,
                (Math.random() - 0.5) * 1.5,
                (Math.random() - 0.5) * 1.5
            );
            mesh.position.copy(position).add(offset);

            // Random rotation
            mesh.rotation.x = Math.random() * Math.PI;
            mesh.rotation.y = Math.random() * Math.PI;

            // Velocity
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.5,
                (Math.random() * 0.5) + 0.2, // Upward bias
                (Math.random() - 0.5) * 0.5
            );

            if (type === 'fountain') {
                velocity.y = 0.8 + Math.random() * 0.5;
                velocity.x *= 2;
                velocity.z *= 2;
            }

            this.scene.add(mesh);
            this.particles.push({
                mesh,
                velocity,
                life: 1.0,
                decay: 0.01 + Math.random() * 0.02
            });
        }
    }

    update() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= p.decay;

            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                this.particles.splice(i, 1);
                continue;
            }

            // Physics
            p.velocity.y -= 0.02; // Gravity
            p.mesh.position.add(p.velocity);
            p.mesh.rotation.x += 0.1;
            p.mesh.rotation.y += 0.1;
            p.mesh.material.opacity = p.life;
            p.mesh.scale.setScalar(p.life);
        }
    }
}

const particleSystem = new ParticleSystem(scene);

// --- GAME LOGIC ---

// UI Refs
const diceButtons = document.querySelectorAll('.dice-num-btn');
const txtCurrentPlayer = document.getElementById('current-player-name');
const p1Seals = document.getElementById('p1-seals');
const p2Seals = document.getElementById('p2-seals');

const overlayMission = document.getElementById('mission-overlay');
const txtMission = document.getElementById('mission-text');
const txtTimer = document.getElementById('timer');
const btnMissionStart = document.getElementById('mission-start-btn');
const divMissionActions = document.getElementById('mission-action-buttons');
const btnSeal = document.getElementById('mission-seal-btn');
const btnSkip = document.getElementById('mission-skip-btn');

const overlayWin = document.getElementById('win-overlay');
const txtWinner = document.getElementById('winner-name');
const btnRestart = document.getElementById('restart-btn');

const overlaySetup = document.getElementById('setup-overlay');
const txtSetup = document.getElementById('setup-title');
let setupStep = 0; // 0=P1, 1=P2

document.querySelectorAll('.char-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const type = e.target.dataset.type;
        handleSelection(type);
    });
});

function handleSelection(type) {
    if (setupStep === 0) {
        spawnPlayer(0, type); // P1
        setupStep = 1;
        txtSetup.innerText = "2くみ の キャラクターをえらんでね！";
    } else if (setupStep === 1) {
        spawnPlayer(1, type); // P2
        setupStep = 2;

        // Check for File Input (Background)
        const fileInput = document.getElementById('bg-file-input');
        if (fileInput && fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            const objectUrl = URL.createObjectURL(file);

            const loader = new THREE.TextureLoader();
            loader.load(objectUrl, (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace;
                scene.background = texture;
            });
        }

        // Check for BGM Input
        const bgmInput = document.getElementById('bgm-file-input');
        if (bgmInput && bgmInput.files && bgmInput.files[0]) {
            const file = bgmInput.files[0];
            const audioUrl = URL.createObjectURL(file);
            const audio = new Audio(audioUrl);
            audio.loop = true;
            audio.volume = 0.5;
            audio.play().catch(e => console.log("Audio play failed (maybe interaction needed):", e));
        }

        overlaySetup.classList.add('hidden'); // Start Game
    }
}

// Setup Buttons
diceButtons.forEach(btn => {
    btn.onclick = () => {
        const val = parseInt(btn.dataset.value);
        if (!isNaN(val)) {
            handleManualInput(val);
        }
    };
});
btnMissionStart.onclick = onMissionStartClick;
btnSeal.onclick = () => endMission(true);
btnSkip.onclick = () => endMission(false);
btnRestart.onclick = () => location.reload();

function updateTurnUI() {
    const p = state.players[state.turn];
    txtCurrentPlayer.innerText = p.name;
    txtCurrentPlayer.className = state.turn === 0 ? 'p1' : 'p2'; // color

    // Enable buttons
    toggleDiceButtons(true);
}

function toggleDiceButtons(enabled) {
    diceButtons.forEach(btn => btn.disabled = !enabled);
}

function handleManualInput(steps) {
    if (state.isMoving || state.missionActive) return;
    toggleDiceButtons(false);
    startMove(steps);
}

async function startMove(steps) {
    state.isMoving = true;
    const player = state.players[state.turn];

    for (let i = 0; i < steps; i++) {
        if (player.pos >= tiles.length - 1) break;

        player.pos++;
        await jumpTo(player, tiles[player.pos].vec);
    }

    // Tile Event
    const currentTile = tiles[player.pos];
    if (currentTile.type === 'goal') {
        winGame();
    } else if (['body', 'hand', 'group'].includes(currentTile.type)) {
        startMission(currentTile.type);
    } else {
        nextTurn();
    }
}

function jumpTo(playerObj, targetVec) {
    return new Promise(resolve => {
        const startPos = playerObj.mesh.position.clone();
        // Maintain the X offset for 2 players
        const offset = state.turn === 0 ? -1.5 : 1.5; // Wider offset for bigger chars
        const endPos = targetVec.clone();
        // Keep existing Y or reset? Custom models were centered with Y up.
        // Default animals were waiting at Y=1.5 previously.
        // Let's assume the character's definition of "0" puts it on the ground.
        // But we need to make sure we don't sink them.
        // Let's preserve the current Y roughly or use a safe hover.
        endPos.y = playerObj.mesh.position.y; // Keep current Y (ground level)
        endPos.x += offset;

        let progress = 0;

        function animateJump() {
            progress += 0.05;
            if (progress >= 1) {
                playerObj.mesh.position.copy(endPos);

                // Landing Effect
                particleSystem.emit(endPos, 15, COLORS.tile_start); // Green splash
                particleSystem.emit(endPos, 15, 0xFFFFFF); // White splash

                resolve();
                return;
            }

            playerObj.mesh.position.lerpVectors(startPos, endPos, progress);
            // Jump arc height adjusted for larger characters
            playerObj.mesh.position.y = Math.max(startPos.y, endPos.y) + Math.sin(progress * Math.PI) * 5;

            playerObj.mesh.rotation.x += 0.2;

            // Trail Effect
            if (Math.random() > 0.7) {
                particleSystem.emit(playerObj.mesh.position, 1, playerObj.color, 'trail');
            }

            requestAnimationFrame(animateJump);
            renderer.render(scene, camera);
        }
        animateJump();
    });
}

function startMission(type) {
    state.missionActive = true;
    state.isMoving = false;

    let pool = [];
    let title = "チャレンジ！";

    if (type === 'body') {
        pool = MISSIONS_BODY;
        title = "からだを おおきく うごかそう！";
        txtMission.style.color = "#FF00FF";
    } else if (type === 'hand') {
        pool = MISSIONS_HAND;
        title = "てを つかおう！";
        txtMission.style.color = "#00AAAA";
    } else if (type === 'group') {
        pool = MISSIONS_GROUP;
        title = "みんなで やってみよう！";
        txtMission.style.color = "#32CD32";
    }

    const m = pool[Math.floor(Math.random() * pool.length)];
    // Update Title in overlay if we had one, or just prepend to text?
    // Let's prepend title or simple logic
    txtMission.innerHTML = `<span style="font-size: 2rem;">${title}</span><br>${m.text}`;
    txtTimer.innerText = m.time;

    // Reset UI for "Ready" state
    btnMissionStart.classList.remove('hidden');
    divMissionActions.classList.add('hidden');

    // Hide buttons initially? No, let them be visible
    overlayMission.classList.remove('hidden');

    // Store time for the start button handler
    state.missionTime = m.time;
}

function onMissionStartClick() {
    btnMissionStart.classList.add('hidden');
    divMissionActions.classList.remove('hidden');

    let timeLeft = state.missionTime;
    txtTimer.innerText = timeLeft;

    state.timerInterval = setInterval(() => {
        timeLeft--;
        txtTimer.innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(state.timerInterval);
            txtTimer.innerText = "タイムアップ！";
        }
    }, 1000);
}

function endMission(success) {
    clearInterval(state.timerInterval);
    overlayMission.classList.add('hidden');
    state.missionActive = false;

    if (success) {
        state.players[state.turn].seals++;
        // Update Seal UI
        if (state.turn === 0) p1Seals.innerText = state.players[0].seals;
        else p2Seals.innerText = state.players[1].seals;
    }

    nextTurn();
}

function nextTurn() {
    state.isMoving = false;
    state.turn = state.turn === 0 ? 1 : 0;
    updateTurnUI();
}

function winGame() {
    const winner = state.players[state.turn];
    txtWinner.innerText = winner.name;
    // Maybe show seals too?
    overlayWin.classList.remove('hidden');

    // Celebration Loop
    setInterval(() => {
        const x = (Math.random() - 0.5) * 20;
        const z = (Math.random() - 0.5) * 20;
        particleSystem.emit(new THREE.Vector3(x, 0, z), 20, 0xFFD700, 'fountain'); // Gold
        particleSystem.emit(new THREE.Vector3(x, 0, z), 20, 0xFF69B4, 'fountain'); // Pink
        particleSystem.emit(new THREE.Vector3(x, 0, z), 20, 0x00FFFF, 'fountain'); // Cyan
    }, 200);
}

// --- MAIN LOOP ---
function animate() {
    requestAnimationFrame(animate);

    // Camera average
    const p1 = state.players[0].mesh.position;
    const p2 = state.players[1].mesh.position;
    const center = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

    const targetCamPos = center.clone().add(new THREE.Vector3(0, 25, 20));
    camera.position.lerp(targetCamPos, 0.05);
    camera.lookAt(center);

    renderer.render(scene, camera);
    particleSystem.update();
}

// Init
updateTurnUI();
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
