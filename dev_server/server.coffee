Q                   = require("q")
fs                  = require("fs")
{exec}              = require("child_process")
express             = require("express")
assets              = require("../app/lib/asset_list")
asset_dir           = "#{__dirname}/assets"
downloads_dir       = "#{asset_dir}/downloads"
root_url            = "http://photos.tritarget.org/photos/washington2012"
pending_downloads   = []

spawn_server = ->
  app = express()

  app.use "/", express.static(asset_dir)

  console.log "Server started at http://localhost:3000/"
  console.log "Press CTRL-C to exit."

  app.listen 3000

download_asset = (asset) ->
  Q.nfcall(exec, "curl -o #{downloads_dir}/#{asset} #{root_url}/#{asset}")
    .then -> console.log "Downloaded #{asset} to #{downloads_dir}"

# Load assets locally when needed
fs.mkdirSync(downloads_dir) unless fs.existsSync(downloads_dir)

for asset in assets
  unless fs.existsSync("#{downloads_dir}/#{asset}")
    pending_downloads.push download_asset(asset)

exports.promise = Q.all(pending_downloads).then(spawn_server)
