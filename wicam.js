//var WebSocket = require('ws');
var WICAM_STATE_NULL = 0;
var WICAM_STATE_DISCONNECTED = 1;
var WICAM_STATE_CONNECTED = 2;
var WICAM_STATE_SIGNEDIN = 3;
var WICAM_STATE_VIDEO_MODE = 4;
var WICAM_STATE_PICTURE_MODE = 5;
var WICAM_FIRMWARE_VERSION = 2;



function blobToConfig(data, onCompleted) {
	var fileReader = new FileReader();
	fileReader.readAsArrayBuffer(data);
	fileReader.addEventListener('loadend', function() {
		var conf = {};
		var arrayBuffer = fileReader.result;
		var int8Array = new Int8Array(arrayBuffer);
		var fw_version = int8Array[0];

		if (fw_version != WICAM_FIRMWARE_VERSION) {
			onCompleted(null);
		}
		var sub = new Int8Array(arrayBuffer.slice(4, 4 + 33));
		for (var i = 0; i < 33; i++) {
			if (sub[i] == 0) break;
		}
		conf.name = String.fromCharCode.apply(null, sub.slice(0, i));
		sub = new Int8Array(arrayBuffer.slice(37, 37 + 13));
		for (var i = 0; i < 13; i++) {
			if (sub[i] == 0) break;
		}
		conf.password = String.fromCharCode.apply(null, sub.slice(0, i));;
		sub = new Int8Array(arrayBuffer.slice(50, 50 + 33));
		for (var i = 0; i < 33; i++) {
			if (sub[i] == 0) break;
		}
		conf.home_ssid = String.fromCharCode.apply(null, sub.slice(0, i));
		sub = new Int8Array(arrayBuffer.slice(83, 83 + 13));
		for (var i = 0; i < 13; i++) {
			if (sub[i] == 0) break;
		}
		conf.home_password = String.fromCharCode.apply(null, sub.slice(0, i));
		console.log("blobToConfig: ");
		console.log(conf);
		onCompleted(conf);
	});

}


function Wicam (dom, ip, name, onDisconnect) {
	this.dom = dom;
	this.ip = ip;
	this.name = name;
	this.password = "";
	this.home_ssid = "";
	this.home_password = "";
	this.state = WICAM_STATE_NULL;
	this.onConnectCallback = function() {};
	this.onSignedinCallback = function() {};
	this.onDisconnectCallback = onDisconnect;
	this.onFrameCallback = function() {};
}
Wicam.prototype.connect = function (onConnected) {
	var thiz = this;
	this.onConnectCallback = onConnected;
	if (this.ws) {
		this.ws.send("close");
		this.ws.close();
		
		this.ws = null;
	}
	var ws = new WebSocket('ws://' + this.ip);
	ws.binaryType = "blob";
	console.log("Connecting to: " + 'ws://' + this.ip);
	this.connectTimeoutID = setTimeout(function() {
		if (thiz.state < WICAM_STATE_CONNECTED) {
			console.log(thiz.name + " connection failed.");
			thiz.onConnectCallback(thiz, false);
		}
	}, 5000);
	ws.onopen = function () {
		console.log(thiz.name + " connection success.");
		thiz.onConnectCallback(thiz, true)
		thiz.state = WICAM_STATE_CONNECTED;
		clearTimeout(thiz.connectTimeoutID);
	  	
	};

	ws.onmessage = function(evt) {
	  var data = evt.data;
	  if (data instanceof Blob) {
	  	if (data.size == 129) {
	  		thiz.state = WICAM_STATE_SIGNEDIN;
	  		clearTimeout(thiz.signinTimeoutID);
	  		blobToConfig(data, function(conf) {
	  			thiz.onSignedinCallback(thiz, true, conf);
	  		});
	  		
	  	} else if (thiz.state == WICAM_STATE_VIDEO_MODE) {
		  	thiz.onFrameCallback(thiz, data);
		}
	  } else {
	  	// TODO: Text message
	  }
	  // flags.masked will be set if the data was masked.
	};
	ws.onclose = function() {
		console.log("onclose");
		thiz.state = WICAM_STATE_DISCONNECTED;
		thiz.onDisconnectCallback(thiz);
	};
	this.ws = ws;
};

Wicam.prototype.signin = function (password, onSignedin) {
	this.password = password;
	this.onSignedinCallback = onSignedin;
	this.ws.send('pwd:' + this.name + this.password);
	this.signinTimeoutID = setTimeout(function() {
		if (this.state < WICAM_STATE_SIGNEDIN) {
			console.log(thiz.name + " signedin failed.");
			this.onSignedinCallback(thiz, false, {});
		}
	}, 5000);
};

Wicam.prototype.disconnect = function () {
	if (this.ws) {
		this.ws.send("close");
		this.ws.close();
		this.ws = null;
		console.log("done disconnect");
		return;
	}
		
};

Wicam.prototype.startVideo = function(onFrame) {
	if (this.state >= WICAM_STATE_SIGNEDIN) {
		this.state = WICAM_STATE_VIDEO_MODE;
		this.onFrameCallback = onFrame;
		this.ws.send("video");
	}
};

function unicodeStringToTypedArray(s) {
    var escstr = encodeURIComponent(s);
    var binstr = escstr.replace(/%([0-9A-F]{2})/g, function(match, p1) {
        return String.fromCharCode('0x' + p1);
    });
    var ua = new Uint8Array(binstr.length);
    Array.prototype.forEach.call(binstr, function (ch, i) {
        ua[i] = ch.charCodeAt(0);
    });
    return ua;
}

Wicam.prototype.saveSetting = function(onSavedSuccess, onFailedOrClosed) {
	var a1 = new Uint8Array(4).fill(0);
	a1[0] = WICAM_FIRMWARE_VERSION;
	var a2 = new Uint8Array(33).fill(0);
	a2.set(unicodeStringToTypedArray(this.name));
	var a3 = new Uint8Array(13).fill(0);
	a3.set(unicodeStringToTypedArray(this.password));
	var a4 = new Uint8Array(33).fill(0);
	a4.set(unicodeStringToTypedArray(this.home_ssid));
	var a5 = new Uint8Array(13).fill(0);
	a5.set(unicodeStringToTypedArray(this.home_password));

	var data = [a1, 
				a2,
				a3,
				a4,
				a5,
				new Uint8Array(1).fill(2),
				new Uint8Array(32).fill(0)];
	this.onDisconnectCallback = onFailedOrClosed;
	this.onSignedinCallback = onSavedSuccess;
	console.log("saving new config");
	var new_config = new Blob(data);
	console.log("New config size:" + new_config.size);
	this.ws.send(new_config);
};


var WicamManager = {
	wicams: {}
};
