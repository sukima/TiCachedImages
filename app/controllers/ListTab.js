var FileLoader      = require("file_loader");
var photos          = require("asset_list");
var use_promises    = true;
var use_file_loader = true;

function refreshTableData() {
  function makeRowFor(photo) {
    return Alloy.createController("PhotoRow", {
      photo:           photo,
      use_promises:    use_promises,
      use_file_loader: use_file_loader
    }).getView();
  }

  var photo_index = 0, i, row, rows = [];
  for (i = 0; i < 100; i++) {
    rows.push(makeRowFor(photos[photo_index]));
    photo_index++;
    photo_index = (photo_index >= photos.length) ? 0 : photo_index;
  }

  $.tableList.setData(rows);
}

function promptForSettigns() {
  var choice = Ti.UI.createOptionDialog({
    title:   "API Interface",
    cancel:  3,
    options: [
      (use_file_loader ? "Disable FileLoader" : "Enable FileLoader"),
      "Use Promises" + (use_promises ? " *" : ""),
      "Use Callbacks" + (use_promises ? "" : " *"),
      "Cancel"
    ]
  });
  choice.addEventListener("click", function(e) {
    switch (e.index) {
      case 0:
        use_file_loader = !use_file_loader;
        Alloy.Globals.toast("FileLoader " + (use_file_loader ? "enabled" : "disabled"));
        break;
      case 1:
        use_promises = true;
        Alloy.Globals.toast("Using Promises");
        break;
      case 2:
        use_promises = false;
        Alloy.Globals.toast("Using Callbacks");
        break;
    }
  });
  choice.show();
}

function promptForActions() {
  var choice = Ti.UI.createOptionDialog({
    title:       "Action",
    destructive: 1,
    cancel:      2,
    options:     ["Refresh Table", "Clear Cache", "Cancel"]
  });
  choice.addEventListener("click", function(e) {
    switch (e.index) {
      case 0:
        refreshTableData();
        Alloy.Globals.toast("Table refreshed");
        break;
      case 1:
        FileLoader.gc(true);
        Alloy.Globals.toast("Cache expunged, refresh to see result");
        break;
    }
  });
  choice.show();
}

$.settingsButton.addEventListener("click", promptForSettigns);
$.clearCacheBtn.addEventListener("click", promptForActions);

refreshTableData();
/* vim:set ts=2 sw=2 et fdm=marker: */
