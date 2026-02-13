import * as THREE from 'three';

let scene, camera, renderer;

export function initScene(container) {
    // Scene
    scene = new THREE.Scene();
    // Lighter fog with a neon blue tint — not too dark
    scene.fog = new THREE.FogExp2(0x061828, 0.008);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // Camera
    camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 500);
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
}

export function getScene() { return scene; }
export function getCamera() { return camera; }
export function getRenderer() { return renderer; }
