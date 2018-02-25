const THREE = require('js/three/build/three.js')
window.THREE = THREE

require('js/three/loaders/GLTFLoader.js')
require('js/three/controls/OrbitControls.js')
const Detector = require('js/three/Detector.js')
const Stats = require('js/three/libs/stats.min.js')

const Animal = require('js/animal.js')

var sonarSound = new Audio('sounds/sonar.wav')

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

    // Current fish echo energy (a [0..1] value. Because science!)
    this.intensity = 0

    // Next time a ping will hit a fish
    this.pingTime = undefined

    // Next ping intensity
    this.pingIntensity = undefined
  }
}

var waterSize = 10
var surfResolution = 8 // "11" is nice, too
var surfaceWaterColor = 0x0044ff

const initNumFishes = 15
const echoColor = 0x9fff00

const initPingsAvailable = 15
var pingsLeft = initPingsAvailable

var clock = new THREE.Clock()

var raycaster = new THREE.Raycaster()
var mouse = new THREE.Vector2()

var clickableObjects = []

var boatObjects = []

// HTML UI
var infozone

var won = false
var lost = false

init()
animate()

function init () {
  container = document.createElement('div')
  document.body.appendChild(container)

  infozone = document.getElementById('infozone')

  scene = new THREE.Scene()
  // scene.background = envMap

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.25, 100)
  camera.position.set(-11, 8, 17)
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
        clickableObjects.push(child)
        boatObjects.push(child)
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
  for (let i = 0; i < initNumFishes; i++) {
    const initialPos = pickRandomPosition(domain)
    // console.log('initialPos', initialPos)
    const speed = 0.1 * (1 + Math.random())
    const changeAngleProb = 0.01 * (1 + 2 * Math.random())
    let animal = new Animal(domain, initialPos, speed, changeAngleProb)

    // Note that each fish has a material, so as to represent distinct ping intensities (through opacity)
    var geometry = new THREE.SphereGeometry(0.08, 16, 16)
    var material = new THREE.MeshBasicMaterial({color: echoColor, transparent: true, opacity: 0})
    var sphere = new THREE.Mesh(geometry, material)
    scene.add(sphere)

    clickableObjects.push(sphere)

    animals.push(new AnimalWrapper(animal, sphere))
  }

  renderer = new THREE.WebGLRenderer({ antialias: true /*, alpha: true */ })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.gammaOutput = true
  container.appendChild(renderer.domElement)

  window.addEventListener('resize', onWindowResize, false)

  document.addEventListener('mousedown', onDocumentMouseDown, false)
  document.addEventListener('touchstart', onDocumentTouchStart, false)

  // FPS stats (only locally)
  if (!document.isProduction) {
    stats = new Stats()
    container.appendChild(stats.dom)
  }
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

  if (stats !== undefined) {
    stats.update()
  }

  // Update DOM UI
  if (!won && !lost) {
    infozone.innerHTML = ''
    infozone.innerHTML += 'Fishes Left: ' + animals.length + '<br/>'
    infozone.innerHTML += 'Pings Left: ' + pingsLeft
  }
}

function render () {
  var delta = clock.getDelta()
  var time = clock.getElapsedTime()

  updateWaterSurface(time)
  updateAnimalsPosition(delta)
  processPings(time, delta)

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

    surfGeometry.vertices[i].y = 0.17 * Math.sin(i / 0.5 + (time * 10 + i) / 7) - 0.1
  }
}

function updateAnimalsPosition (time) {
  for (let i = 0; i < animals.length; i++) {
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

// Detect scene object clicked. See the "canvas_interactive_cubes.html" sample
function onDocumentMouseDown (event) {
  event.preventDefault()

  mouse.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1
  mouse.y = -(event.clientY / renderer.domElement.clientHeight) * 2 + 1

  raycaster.setFromCamera(mouse, camera)

  var intersects = raycaster.intersectObjects(clickableObjects)
  if (intersects.length > 0) {
    let clicked = intersects[ 0 ].object
    // console.log('Clicked on', clicked)
    if (boatObjects.indexOf(clicked) !== -1) {
      onBoatClicked()
    } else {
      onFishClicked(clicked)
    }
  }
}

// Some touch support (not sure the fixed camera/scene is up to it, though)
function onDocumentTouchStart (event) {
  event.preventDefault()

  event.clientX = event.touches[0].clientX
  event.clientY = event.touches[0].clientY
  onDocumentMouseDown(event)
}

function onBoatClicked () {
  console.log('Boat clicked')
  if (pingsLeft <= 0) {
    // Does not mean we've lost, we'll let the last echoes vanish first
    return
  }

  sonarSound.play()

  var time = clock.getElapsedTime()

  // Okay, let's compute what the sonar will detect
  // (this is an approximation, but fishes do not move fast)
  const boatPosition = new THREE.Vector3(0, 0, 0)
  for (let i = 0; i < animals.length; i++) {
    const fishPosition = animals[i].animal.position
    const distanceSq = fishPosition.distanceToSquared(boatPosition)
    const energy = 1 / Math.max(distanceSq, 0.01)

    // Those are arbitrary but work fine for this scene
    const echoIntensity = Math.min(energy * 10, 1)
    const echoDelay = Math.sqrt(distanceSq) / 4
    // console.log('Fish echo intensity', echoIntensity)
    // console.log('Fish echo delay', echoDelay)

    // Take note of when the ping will reach the fish, and what its intensity will be
    animals[i].pingTime = time + echoDelay
    animals[i].pingIntensity = echoIntensity
  }

  // Disable orbit rotations (we wan to click on fishes, not move the camera!)
  controls.enableRotate = false

  pingsLeft--
}

function processPings (time, delta) {
  let anyEchoLeft = false
  for (let i = 0; i < animals.length; i++) {
    let animal = animals[i]

    // Was a new ping received?
    if (animal.pingTime <= time) {
      console.log('Fish received a ping')
      animal.intensity = Math.max(1, animal.intensity + animal.pingIntensity)
      animal.pingTime = undefined
      animal.pingIntensity = undefined
      animal.object3D.visible = true
    }

    // Some future echoes will have to be processed, even if not visible yet
    anyEchoLeft |= animal.pingTime !== undefined

    if (animal.intensity > 0) {
      // An echo was definitely visible
      anyEchoLeft = true

      // Decrease echo intensity since last draw
      animal.intensity -= 0.5 * delta

      // Update the material opacity to simulate ping intensity
      animal.object3D.material.opacity = animal.intensity
    } else {
      // Avoid the exploitation of a transparency behaviour
      // where near-surface fishes appear black when fully transparent
      animal.object3D.visible = false
    }
  }

  // Enable back camera rotations if there are no fishes to click on
  if (!anyEchoLeft) {
    // console.log('No echoes left pending')
    controls.enableRotate = true

    if (pingsLeft === 0 && !lost) {
      onLost()
    }
  }
}

function onFishClicked (fish) {
  console.log('Fish clicked', fish)

  // See https://stackoverflow.com/a/5767357/38096
  const fishWrapper = animals.find(function (element) { return element.object3D === fish })
  const fishIndex = animals.indexOf(fishWrapper)
  animals.splice(fishIndex, 1)

  // Ensure the echo will not stay visible
  // fish.object3D.visible = false
  scene.remove(fish)

  // Ensure we will not react to clicks anymore
  const clickIndex = clickableObjects.indexOf(fish)
  clickableObjects.splice(clickIndex, 1)

  if (animals.length === 0) {
    onWon()
  }
}

function onLost () {
  console.log('Lost the game')
  lost = true
  infozone.innerHTML = 'Sorry, you lost</br>Reload to retry!'
}

function onWon () {
  console.log('Won the game')
  won = true
  infozone.innerHTML = 'Congratulations! You won!'
}
