'use strict';
const m = module.exports = {};

const http = require('http');
const lt = require('localtunnel');

m.createWebhook = (subdomain, route, localPort, callback) => {
	http.createServer((req, res) => {
		if (req.url !== route) {
			return;
		}
	    callback(null, (err, success) => {
	    	if (err) {
	    		res.writeHead(500, {'Content-Type': 'application/json'});
	    		res.write(JSON.stringify({success: false}));
	    	} else {
	    		res.writeHead(200, {'Content-Type': 'application/json'});
	    		res.write(JSON.stringify({success: true}));
	    	}
	    	res.end();
	    })
	}).listen(localPort);
	/*console.log({subdomain, route, localPort, callback});
	const tunnel = lt(localPort, subdomain, function(err, tunnel) {
	    if (err) {
	    	callback('Failed to open tunnel: ' + err, null)
	    }
	    console.log(tunnel);
	});
	 
	tunnel.on('close', function() {
	    callback('Tunnel closed');
	});*/
}