express = require("express")
app = express()

app.use "/", express.static(__dirname + "/assets")

app.listen 3000

console.log "Server started at http://localhost:3000/"
