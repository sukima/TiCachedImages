var mockti = require("mockti");

global.Ti = global.Titanium = mockti();

// Force maximums to a low number for testing.
Ti.App.cache_requests      = 2;
Ti.App.cache_max_redirects = 5;
