import * as THREE from 'three';

let scene, camera, renderer;

export function initScene(container) {
    // Scene
    scene = new THREE.Scene();
    // Lighter fog with a neon blue tint — not too dark
    scene.fog = new THREE.FogExp2(0x061828, 0.008);

    // Renderer — balanced quality: antialias on, pixel ratio capped at 2
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // Camera — reduced far plane (fog hides anything beyond ~150 anyway)
    camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 6, 10);
    camera.lookAt(0, 0, 0);

    // Brighter lighting with neon green/blue tones
    const ambientLight = new THREE.AmbientLight(0x446688, 1.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xccffee, 1.2);
    dirLight.position.set(5, 15, 10);
    scene.add(dirLight);

    // Hemisphere: neon green sky, blue ground
    const hemiLight = new THREE.HemisphereLight(0x44ffaa, 0x2244aa, 0.6);
    scene.add(hemiLight);

    // Handle resize
    window.addEventListener('resize', onResize);

    return { scene, camera, renderer };
}

function onResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

// Pre-compile all shader programs so the first gameplay frame doesn't stall.
// The temp meshes sit off-screen with frustum culling disabled — culled meshes
// are never submitted, and an unsubmitted material never gets its program built,
// which is what let the ghost-mode swap stall on the first hit.
export function warmUpGPU(materials) {
    const tempGeo = new THREE.PlaneGeometry(1, 1);
    const tempMeshes = [];

    for (const mat of materials) {
        if (!mat) continue;
        const m = new THREE.Mesh(tempGeo, mat);
        m.position.set(0, -100, 0);
        m.frustumCulled = false;
        scene.add(m);
        tempMeshes.push(m);
    }

    // compile() builds every program up front; the render pass forces the
    // driver to finish linking and upload the geometry before gameplay starts.
    renderer.compile(scene, camera);
    renderer.render(scene, camera);

    for (const m of tempMeshes) scene.remove(m);
    tempGeo.dispose();
}

export function getScene() { return scene; }
export function getCamera() { return camera; }
export function getRenderer() { return renderer; }
