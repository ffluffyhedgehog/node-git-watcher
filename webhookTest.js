let w = require('./webhook.js');

w.createWebhook('1qwedadqwqwesdf', '/shit', 4201, (err, fn) => {fn(null, true); console.log(err);})