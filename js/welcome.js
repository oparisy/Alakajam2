
// A stupid little vanilla loader
// Uses async to avoid a browser warning
var xmlhttp = new XMLHttpRequest()
xmlhttp.onreadystatechange = function () {
  if (this.readyState === 4 && this.status === 200) {
    onLoaded(this.responseText)
  }
}
xmlhttp.open('GET', 'welcome.html', true)
xmlhttp.send()

function onLoaded (text) {
  // Remove the "loading..." text
  document.getElementById('loader').remove()

  // Show loaded HTML
  var welcome = document.getElementById('welcome')
  welcome.innerHTML = text

  var playButton = document.getElementById('play')
  playButton.addEventListener('click', onPlayClicked)

  function onPlayClicked () {
  // Hide this page
    welcome.remove()

  // Launch the game
    require('js/entry.js')
  }
}
