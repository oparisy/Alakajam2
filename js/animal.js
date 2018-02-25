/* jshint node: true */
/* jslint node: true */
/* jshint strict:false */
/* jslint browser: true */
/* jslint asi: true */
'use strict'

const THREE = require('js/three/build/three.js')

class Animal {
  /** "domain" is a THREE.Box3 delimiting valid world-space coordinates for this animal
   * "initialPos" is a THREE.Vector3 representing the initial position
   * "speed" is a number measuring the random walk speed
   * "changeAngleProb" is the probability (in [0..1]) of changing direction at each step
   */
  constructor (domain, initialPos, speed, changeAngleProb) {
    this.domain = domain
    this.position = initialPos
    this.speed = speed
    this.changeAngleProb = changeAngleProb
    this.direction = new THREE.Vector3()
    this.setToRandomUnitVector(this.direction)

    if (!domain.containsPoint(this.position)) {
      // Should not happen
      throw new Error('Invalid initial position')
    }
  }

    /** Move the animal, ensuring it stays in its assigned domain */
  animate (dt) {
    if (this.changeAngleProb > Math.random()) {
      // Random walk: pick a new direction vector
      this.setToRandomUnitVector(this.direction)
    }

    // Compute new position
    var travelled = new THREE.Vector3()
    travelled.copy(this.direction)
    travelled.multiplyScalar(dt * this.speed)

    var newPos = new THREE.Vector3()
    newPos.copy(this.position)
    newPos.add(travelled)

    if (this.domain.containsPoint(newPos)) {
      // Only set to this new position if it is valid
      this.position.copy(newPos)
    } else {
      // Otherwise we may as well pick a new direction immediately
      this.setToRandomUnitVector(this.direction)
    }
  }

  setToRandomUnitVector (v) {
    // The loop avoids degenerate cases (we don't want to divide by too small a number)
    var length
    do {
      v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
      length = v.lengthSq()
    } while (length < 0.001)

    // v.divideScalar(Math.sqrt(length))
    v.normalize()
  }
}

module.exports = Animal
