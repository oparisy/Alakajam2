// require('../css/main.css')
const Game = require('./game.js')

const canvas = document.getElementById('gamecanvas')
const game = new Game(canvas)

game.configure()
game.start()

// Debugging / prototyping purpose
window.game = game
