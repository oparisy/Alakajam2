const THREE = require('js/three/build/three.js')
window.THREE = THREE

require('js/three/loaders/GLTFLoader.js')
require('js/three/controls/OrbitControls.js')
const Detector = require('js/three/Detector.js')
const Stats = require('js/three/libs/stats.min.js')

const Animal = require('js/animal.js')

if (!Detector.webgl) Detector.addGetWebGLMessage()

var container, stats, controls
var camera, scene, renderer, light

var surfMesh, surfGeometry, surfMaterial

// An array of AnimalWrapper objects
var animals

class AnimalWrapper {
  constructor (animal, object3D) {
    this.animal = animal
    this.object3D = object3D
  }
}

var waterSize = 10
var surfResolution = 8 // "11" is nice, too
var surfaceWaterColor = 0x0044ff

const numFishes = 15

var clock = new THREE.Clock()

init()
animate()

function init () {
  container = document.createElement('div')
  document.body.appendChild(container)

  scene = new THREE.Scene()
  // scene.background = envMap

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.25, 100)
  camera.position.set(-11, 6.5, 17)
  scene.translateY(6)

  controls = new THREE.OrbitControls(camera)
  controls.target.set(0, 0, 0)

  // Constrain camera movements
  // See https://stackoverflow.com/questions/27410219/orbitcontrols-can-i-enable-disable-zooming-dynamically
  // See https://stackoverflow.com/questions/15827074/how-do-i-put-limits-on-orbitcontrol-three-js
  controls.enablePan = false
  controls.enableZoom = false
  controls.maxPolarAngle = Math.PI / 2
  controls.update()

  // envmap
  var path = 'textures/cube/skyboxsun25deg/'
  var format = '.jpg'
  var envMap = new THREE.CubeTextureLoader().load([
    path + 'px' + format, path + 'nx' + format,
    path + 'py' + format, path + 'ny' + format,
    path + 'pz' + format, path + 'nz' + format
  ])

  // Will only apply to fish particles
  // scene.fog = new THREE.Fog(0x21323c, 5, 10)

  light = new THREE.HemisphereLight(0xbbbbff, 0x444422)
  light.position.set(0, 1, 0)
  scene.add(light)

  light = new THREE.DirectionalLight(0xffffff)
  light.position.set(-20, 12, -20)
  light.intensity = 0.75
  scene.add(light)

  // Water surface
  surfGeometry = new THREE.PlaneGeometry(waterSize, waterSize, surfResolution - 1, surfResolution - 1)
  surfGeometry.rotateX(-Math.PI / 2)
  surfGeometry.translate(0, -0.1, 0)
  window.surfGeometry = surfGeometry

  updateWaterSurface(0)

  surfMaterial = new THREE.MeshPhongMaterial({ color: surfaceWaterColor, transparent: true, opacity: 0.75/*, wireframe: true */ })
  // surfMaterial = new THREE.MeshNormalMaterial({})
  // surfMaterial = new THREE.MeshStandardMaterial({ color: 0x0044ff, roughness: 0.5, metalness: 0.5 })
  surfMaterial.side = THREE.DoubleSide

  surfMesh = new THREE.Mesh(surfGeometry, surfMaterial)
  scene.add(surfMesh)

  // The second material is transparent (see https://stackoverflow.com/a/12084429/38096)
  var waterVolumeMaterial = new THREE.MeshPhongMaterial({ color: surfaceWaterColor, transparent: true, opacity: 0.4/*, wireframe: true */ })
  // waterVolumeMaterial.side = THREE.DoubleSide
  var materials = [waterVolumeMaterial, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })]

  var waterVolumeGeometry = new THREE.BoxGeometry(waterSize, waterSize, waterSize)
  waterVolumeGeometry.translate(0, -0.1 - waterSize / 2, 0)

  // Hide top faces
  console.log(waterVolumeGeometry.faces)
  // waterVolumeGeometry.faces[0].materialIndex = 1
  // waterVolumeGeometry.faces[1].materialIndex = 1
  for (let i = 0; i < 12; i++) {
    waterVolumeGeometry.faces[i].materialIndex = (i === 4 || i === 5) ? 1 : 0
  }
  waterVolumeGeometry.sortFacesByMaterialIndex() // optional, to reduce draw calls

  var waterVolumeMesh = new THREE.Mesh(waterVolumeGeometry, materials)
  scene.add(waterVolumeMesh)

  // Boat model
  var loader = new THREE.GLTFLoader()
  loader.load('models/boat.glb', function (gltf) {
    gltf.scene.traverse(function (child) {
      if (child.isMesh) {
        child.material.envMap = envMap
        // How does THREE.Vector3D work?
        child.scale.x = child.scale.y = child.scale.z = 0.1
      }
    })

    scene.add(gltf.scene)
  })

  // See waterVolumeGeometry above
  // (smaller domain to avoid intersections between borders and animals during random walk)
  let domain = new THREE.Box3(new THREE.Vector3(0.1, 0.1, 0.1), new THREE.Vector3(waterSize - 0.1, waterSize - 0.1, waterSize - 0.1))
  domain.translate(new THREE.Vector3(-waterSize / 2, -waterSize - 0.2, -waterSize / 2))
  console.log('domain', domain)

  // Some fishes
  animals = []
  for (let i = 0; i < numFishes; i++) {
    const initialPos = pickRandomPosition(domain)
    console.log('initialPos', initialPos)
    const speed = 0.1 * (1 + Math.random())
    const changeAngleProb = 0.01 * (1 + 2 * Math.random())
    let animal = new Animal(domain, initialPos, speed, changeAngleProb)

    var geometry = new THREE.SphereGeometry(0.08, 16, 16)
    var material = new THREE.MeshBasicMaterial({color: 0x9fff00})
    var sphere = new THREE.Mesh(geometry, material)
    scene.add(sphere)

    animals.push(new AnimalWrapper(animal, sphere))
  }

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

function onWindowResize () {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()

  renderer.setSize(window.innerWidth, window.innerHeight)
}

// Main loop loop
function animate () {
  requestAnimationFrame(animate)

  render()
  stats.update()
}

function render () {
  var delta = clock.getDelta()
  var time = clock.getElapsedTime() * 10

  updateWaterSurface(time)
  updateAnimalsPosition(delta)

  surfMesh.geometry.verticesNeedUpdate = true
  surfMesh.geometry.normalsNeedUpdate = true
  surfMesh.geometry.computeFlatVertexNormals()

  renderer.render(scene, camera)
}

function updateWaterSurface (time) {
  for (var i = 0, l = surfGeometry.vertices.length; i < l; i++) {
    var posx = i % surfResolution
    var posy = (i - posx) / surfResolution
    if (posx === 0 || posx === surfResolution - 1 || posy === 0 || posy === surfResolution - 1) {
      // We leave "border" vertices unmoved to ensure continuity with vertical "water walls"
      continue
    }

    surfGeometry.vertices[i].y = 0.17 * Math.sin(i / 0.5 + (time + i) / 7) - 0.1
  }
}

function updateAnimalsPosition (time) {
  for (let i = 0; i < numFishes; i++) {
    const current = animals[i]
    current.animal.animate(time)
    current.object3D.position.copy(current.animal.position)
  }
}

function pickRandomPosition (box) {
  let x = box.min.x + (box.max.x - box.min.x) * Math.random()
  let y = box.min.y + (box.max.y - box.min.y) * Math.random()
  let z = box.min.z + (box.max.z - box.min.z) * Math.random()
  return new THREE.Vector3(x, y, z)
}
