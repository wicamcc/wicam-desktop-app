
var NWWindow = require('nw.gui').Window;
NWWindow.get().showDevTools();
var dgram = require('dgram');



var udpServer = dgram.createSocket('udp4');
var udpClient = dgram.createSocket('udp4');

udpClient.bind(function() {
	udpClient.setBroadcast(true);
});

udpServer.on('error', function(err) {
	console.log("Server error. Request user to restart the app. " + err);
	udpServer.close();
});

udpServer.on('message', function(msg, rinfo) {
	console.log('Wicam discovered: ' + rinfo);
	console.log("Message: " + msg);
	if (msg.length != 69) {
		console.log("Not Wicam Discovery message");
		return;
	}
	var sigStart = msg[0];
	var sigEnd = msg[68];
	if (sigStart != 0xCA || sigEnd != 0x12) {
		console.log("Not the right signature.");
		return;
	}
	var sub = msg.slice(1, 17);
	for (var i = 0; i < 16; i++) {
		if (sub[i] == 0) break;
	}
	var ip = sub.toString('utf8', 0, i);
	sub = msg.slice(17, 17 + 33);
	for (var i = 0; i < 33; i++) {
		if (sub[i] == 0) break;
	}
	var ssid = sub.toString('utf8', 0, i);
	console.log("ssid: " + ssid + " ip: " + ip);
	addNewWicamCard(ssid, ip);
});

udpServer.bind(4277);

var broadcast_msg = new Buffer("WiCam");


function addNewWicamCard(ssid, ip) {
	var el = $( "<div class=\"column\">" +
					"<div class=\"ui fluid card\">" +
						"<div class=\"image\">" +
							"<img class=\"screen-image\" >" +
						"</div>" +
						"<div class=\"content\">" +
							"<div class=\"header\">" + ssid +"</div>" +
							"<div class=\"description\">" + ip + "</div>" +
						"</div>" +	
						"<div class=\"ui three bottom attached buttons\">" +
							"<div class=\"ui button action-connect\">" +
								"<i class=\"video play icon\"></i>" +
								"Connect" +
							"</div>" +
							"<div class=\"ui button disabled action-disconnect\">" +
								"<i class=\"stop icon\"></i>" +
								"Disconnect" +
							"</div>" +
							"<div class=\"ui button action-setting\">" +
								"<i class=\"setting icon\"></i>" +
								"Settings" +
							"</div>" +
						"</div>" +
					"</div>" +
				"</div>");
	var wicam;
	if (!WicamManager[ssid]) {
		wicam = new Wicam(el, ip, ssid, onWicamDisconnected);
		$('.view-wicams').append(el);
		console.log("Wicam name:" + wicam.name);
		wicam.connect_button = el.find('.action-connect');
		wicam.disconnect_button  = el.find('.action-disconnect');
		wicam.setting_button = el.find('.action-setting');
		wicam.header_view = el.find('.header');
		wicam.description_view = el.find('.description');
		wicam.img_screen = el.find('.screen-image');
		wicam.img_screen[0].src = 'screen.png';
		console.log(wicam.connect_button);
		console.log(wicam.disconnect_button);
		wicam.connect_button.on('click', function() {
			console.log("connect btn");
			onActionConnect(wicam);
		});
		wicam.disconnect_button.on('click', function() {
			console.log("disconnect btn");
			onActionDisconnect(wicam);
		});
		wicam.setting_button.on('click', function() {
			onActionSetting(wicam);
		});

		WicamManager[ssid] = wicam;
	} 
	
	
}

function askForPassword(wicam) {
	var default_password = wicam.password;
	if (default_password == undefined) {
		default_password = "wicam.cc";
	}
	var password = prompt("Please enter Password for" + wicam.name, default_password);
	if (password == null) return null;
	while (password.length < 8 || password.length > 12) {
		password = prompt("Please enter Password for" + wicam.name, default_password);
		if (password == null) return null;
	}
	return password;
}

function onActionConnect(wicam) {
	wicam.connect_button.addClass('disabled');
	wicam.disconnect_button.removeClass('disabled');
	wicam.setting_button.addClass('disabled');
	wicam.connect(onWicamConnectedForVideo);
}
function onActionDisconnect(wicam) {
	wicam.disconnect();
	wicam.connect_button.removeClass('disabled');
	wicam.disconnect_button.addClass('disabled');
	wicam.setting_button.removeClass('disabled');
}

function onActionSetting(wicam) {
	wicam.connect(onWicamConnectedForSetting);
	$('.dimmer-settings').dimmer({
		closable: false
	}).dimmer('show');
}


function onScan() {
	console.log('onScan');
	udpClient.send(broadcast_msg, 0, broadcast_msg.length, 4211, "255.255.255.255");
}

function onHotspot() {
	console.log("onHotspot");
	addHotspot();
}


function addHotspot() {
	/*
	var name = $('input[name="wicam-name"]').val();
	var password = $('input[name="wicam-password"]').val();
	console.log("Submitting: " + name + ' ' + password);
	if (!name.startsWith("WiCam-")) {
		alert("Open Wicam's name must start with WiCam-. Capital sensitive.");
		return false;
	}
	if (password.length < 8 || password.length > 12) {
		alert("Open Wicam's password length must be 8-12 letters long.");
		return false;
	}
	*/
	var name = null;
	while (1) {
		name = prompt("Enter WiCam name", "WiCam-");
		if (name == null) return;
		if (name.startsWith("WiCam-") == false) {
			alert("Wicam's name must starts with 'WiCam-'");
			continue;
		}
		if (name.length < 6) {
			alert("Wicam's name must be 7 or more characters long.");
			continue;
		}
		break;
	}
	addNewWicamCard(name, '192.168.240.1');
	return true;
}

function onWicamConnectedForVideo(wicam, succ) {
	if (succ == false) {
		alert("Failed connecting to " + wicam.name + ":" + wicam.password);
		wicam.disconnect();
		wicam.connect_button.removeClass('disabled');
		wicam.disconnect_button.addClass('disabled');
		wicam.setting_button.removeClass('disabled');
		return;
	}
	var password = askForPassword(wicam);
	if (password == null) {
		wicam.disconnect();
		wicam.connect_button.removeClass('disabled');
		wicam.disconnect_button.addClass('disabled');
		wicam.setting_button.removeClass('disabled');
		return;
	}
	wicam.signin(password, onWicamSignedinToVideo);
}

function onWicamConnectedForSetting(wicam, succ) {
	if (succ == false) {
		alert("Failed connecting to " + wicam.name + ":" + wicam.password);
		wicam.disconnect();
		$('.dimmer-settings').dimmer('hide');
		return;
	}
	var password = askForPassword(wicam);
	if (password == null) {
		wicam.disconnect();
		$('.dimmer-settings').dimmer('hide');
		return;
	}
	$('.dimmer-settings').dimmer('hide');
	wicam.signin(password, onWicamSignedinToSetting);
}

function onWicamSignedinToVideo(wicam, succ, config) {
	if (succ == false) {
		wicam.disconnect();
		wicam.connect_button.removeClass('disabled');
		wicam.disconnect_button.addClass('disabled');
		wicam.setting_button.removeClass('disabled');
		alert("Failed signing into " + wicam.name + ". Please make sure your password is correct.");
		return;
	}
	if (config == null) {
		// TODO: Firmware version not match, should disconnect.
		return;
	}
	wicam.name = config.name;
	wicam.password = config.password;
	wicam.home_ssid = config.home_ssid;
	wicam.home_password = config.home_password;
	console.log("Signed in success.");
	wicam.startVideo(onWicamFrame);

}

function onWicamSignedinToSetting(wicam, succ, config) {
	if (succ == false) {
		wicam.disconnect();
		alert("Failed signing into " + wicam.name + ". Please make sure your password is correct.");
		return;
	}
	if (config == null) {
		// TODO: Firmware version not match, should disconnect.
		return;
	}
	console.log("Signed in success.");

	wicam.name = config.name;
	wicam.password = config.password;
	wicam.home_ssid = config.home_ssid;
	wicam.home_password = config.home_password;
	// TODO: load modal to ask for new setting changes.
	
	$('.modal-settings').find('input[name=wicam-name]').val(wicam.name);
	$('.modal-settings').find('input[name=wicam-password]').val(wicam.password);
	$('.modal-settings').find('input[name=wicam-home-ssid]').val(wicam.home_ssid);
	$('.modal-settings').find('input[name=wicam-home-password]').val(wicam.home_password);
	$('.modal-settings').modal({
		closable: false,
		blurring: true,
		onDeny: function () {
			wicam.disconnect();
			return true;
		},
		onApprove: function() {
			var _name = $('.modal-settings').find('input[name=wicam-name]').val();
			var _password = $('.modal-settings').find('input[name=wicam-password]').val();
			var _home_ssid = $('.modal-settings').find('input[name=wicam-home-ssid]').val();
			var _home_password = $('.modal-settings').find('input[name=wicam-home-password]').val();
			if (!_name.startsWith('WiCam-')) {
				alert("Wicam name must start with WiCam-");
				console.log(_name);
				$('.modal-settings').find('input[name=wicam-name]').val(wicam.name);
				return false;
			} else if (_name.length < 6) {
				alert("Wicam name must be longer than 6 letters.");
				return false;
			} else if (_name.length > 32) {
				alert("Wicam name must be less than 32 letters.");
				return false;
			} else if (_password.length < 8 || _password.length > 12) {
				alert("Wicam password must be between 8-12 letters.");
				return false;
			} else if (_home_ssid.length > 0 && _home_ssid.length > 32) {
				alert("Home WiFi SSID must be between 1-32 letters.");
				return false;
			} else if (_home_password.length > 0 && (_home_password.length< 8 || _home_password.length > 12)) {
				alert("Home WiFi password must be between 8-12 letters.");
				return false;
			}
			wicam.name = _name;
			wicam.password = _password;
			wicam.home_ssid = _home_ssid;
			console.log("new Home SSID: " + wicam.home_ssid);
			wicam.home_password = _home_password;
			console.log("new Home password: " + wicam.home_password);
			wicam.saveSetting(onWicamSaveSuccess, onWicamSaveFailedOrClosed);
			
		}
	}).modal('show');
}

function onWicamSaveSuccess(wicam) {
	wicam.connect_button.removeClass('disabled');
	wicam.disconnect_button.addClass('disabled');
	wicam.setting_button.removeClass('disabled');
	WicamManager[wicam.name] = undefined;
	wicam.dom.remove();
	setTimeout(function() {
		onScan();
	}, 9000);
}

function onWicamSaveFailedOrClosed(wicam) {
	wicam.connect_button.removeClass('disabled');
	wicam.disconnect_button.addClass('disabled');
	wicam.setting_button.removeClass('disabled');
	WicamManager[wicam.name] = undefined;
	wicam.dom.remove();
	setTimeout(function() {
		onScan();
	}, 9000);
}

function onWicamDisconnected(wicam) {
	wicam.connect_button.removeClass('disabled');
	wicam.disconnect_button.addClass('disabled');
	wicam.setting_button.removeClass('disabled');
}

function onWicamFrame(wicam, data) {
	var blob = new Blob([data], { type: "image/jpeg" });
	wicam.img_screen[0].src = URL.createObjectURL(blob);
}

function onWicamPicture(wicam) {

}


$(function () {
	//alert("Ready");
	console.log("test");
	$('.action-scan').on('click', onScan);
	$('.action-hotspot').on('click', onHotspot);
	


});




