express = require("express")
app = express()

app.use "/", express.static(__dirname + "/assets")

console.log "Server started at http://localhost:3000/"
console.log "Press CTRL-C to exit."

module.exports = app.listen 3000
