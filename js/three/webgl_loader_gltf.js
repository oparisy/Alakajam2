const THREE = require('./build/three.js')
window.THREE = THREE

require('./loaders/GLTFLoader.js')
require('./controls/OrbitControls.js')
const Detector = require('./Detector.js')
const Stats = require('./libs/stats.min.js')

if (!Detector.webgl) Detector.addGetWebGLMessage()

var container, stats, controls
var camera, scene, renderer, light

init()
animate()

function init() {
  container = document.createElement('div')
  document.body.appendChild(container)

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.25, 20)
  camera.position.set(-1.8, 0.9, 2.7)

  controls = new THREE.OrbitControls(camera)
  controls.target.set(0, -0.2, -0.2)
  controls.update()

  // envmap
  var path = 'textures/cube/skyboxsun25deg/'
  var format = '.jpg'
  var envMap = new THREE.CubeTextureLoader().load([
    path + 'px' + format, path + 'nx' + format,
    path + 'py' + format, path + 'ny' + format,
    path + 'pz' + format, path + 'nz' + format
  ])

  scene = new THREE.Scene()
  scene.background = envMap

  light = new THREE.HemisphereLight(0xbbbbff, 0x444422)
  light.position.set(0, 1, 0)
  scene.add(light)

  light = new THREE.DirectionalLight(0xffffff)
  light.position.set(-10, 6, -10)
  scene.add(light)

  // model
  var loader = new THREE.GLTFLoader()
  loader.load('models/boat.glb', function (gltf) {
    gltf.scene.traverse(function (child) {
      if (child.isMesh) {
        child.material.envMap = envMap
      }
    })

    scene.add(gltf.scene)
  })

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.gammaOutput = true
  container.appendChild(renderer.domElement)

  window.addEventListener('resize', onWindowResize, false)

  // stats
  stats = new Stats()
  container.appendChild(stats.dom)
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()

  renderer.setSize(window.innerWidth, window.innerHeight)
}

//

function animate() {
  requestAnimationFrame(animate)

  renderer.render(scene, camera)

  stats.update()
}
