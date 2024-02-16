import './style.css'
import { setup } from './subscribe.js'

document.querySelector('#app').innerHTML = `
  <div>
    <div id="status"></div>
    <div id="messages"></div>
  </div>
`

setup()
