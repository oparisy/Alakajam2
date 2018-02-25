/* jshint node: true */
/* jslint node: true */
/* jshint strict:false */
/* jslint browser: true */
/* jslint asi: true */
'use strict'

// import {
// Mesh,
//  MeshStandardMaterial,
//  PointLight,
//  PerspectiveCamera,
//  Scene,
//  WebGLRenderer
// } from 'three'

const THREE = require('./three/build/three.js')
window.THREE = THREE
// import * as GLTFLoader from 'three-gltf2-loader'
// GLTF2Loader(THREE)
require('./three/examples/js/loaders/GLTFLoader.js')

const WIDTH = 640
const LIGHT_COLOR = 0xFFFFFF
const LIGHT_INTENSITY = 50
const ROTATION_SPEED = 0.01
const CAMERA_Z_POSITION = 5
const LIGHT_DISTANCE = 10
const FOV = 75
const NEAR_PLANE = 0.1
const FAR_PLANE = 1000
const MODEL_PATH = 'models/boat.glb'
const BACKGROUND_COLOR = 0xA9A9A9

class Game {
  constructor (canvas) {
    this.canvas = canvas
    this.render = this.render.bind(this)
  }

  configure () {
    this.scene = this.createScene()
    this.light = this.createLight()
    this.camera = this.createCamera()
    this.renderer = this.createRenderer()

    this.scene.add(this.light)

    this.loadModel(MODEL_PATH).then((gltf) => {
      window.model = gltf
      this.boatMesh = gltf.scene.children[0]

      // Only add the mesh (not the lights nor camera)
      this.scene.add(this.boatMesh)
      gltf.animations // Array<THREE.AnimationClip>
      gltf.scene // THREE.Scene
      gltf.scenes // Array<THREE.Scene>
      gltf.cameras // Array<THREE.Camera>
    })
  }

  start () {
    this.render()
  }

  createScene () {
    return new THREE.Scene()
  }

  createLight () {
    const light = new THREE.PointLight(LIGHT_COLOR, LIGHT_INTENSITY)
    light.position.set(-LIGHT_DISTANCE, LIGHT_DISTANCE, LIGHT_DISTANCE)
    return light
  }

  createCamera () {
    const camera = new THREE.PerspectiveCamera(FOV, WIDTH / WIDTH, NEAR_PLANE, FAR_PLANE)
    camera.position.z = CAMERA_Z_POSITION
    return camera
  }

  createRenderer () {
    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas })
    renderer.setSize(WIDTH, WIDTH)
    renderer.setClearColor(BACKGROUND_COLOR)
    return renderer
  }

  loadModel (path) {
    path = path + '?cacheBust=' + Date.now()
    const loader = new THREE.GLTFLoader()

    return new Promise((resolve, reject) => {
      loader.load(path,
        (geometry) => resolve(geometry),
        () => { },
        (error) => reject(error))
    })
  }

  render () {
    requestAnimationFrame(this.render)
    if (!this.boatMesh) { return }
    this.boatMesh.rotation.y += ROTATION_SPEED
    this.renderer.render(this.scene, this.camera)
  }
}

module.exports = Game
