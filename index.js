//var path = require('path');
//console.log('__dirname:'+ __dirname);
//global.__base = path.resolve(path.join(__dirname, '../'));
global.__base = __dirname;
//console.log('The project root path: ' + global.__base);
var appRoute = require(global.__base + '/route/route.js');
var wkapi = require(global.__base + '/wukoon_bridge/wukoon.js');
var dbapi = require(global.__base + '/db/mongodb.js');

//appRoute.start();
function handleError() {
	// TODO: 
}

/* Test wukoon.js APIs via which we can send http requests to wukoon platform. */
function wukoonApiTest(apiNum) {

	dbapi.connect().then(function(){
		/*
		wkapi.getWkAccessToken().then(function(token){
			console.log('accessToken: '+ JSON.stringify(token) +'\n');
		});
		*/
		switch (apiNum)
		{
			case 1:
				wkapi.getWkAccessToken().then(function(token){
					console.log('accessToken: '+ JSON.stringify(token) +'\n');
				}, function(err){
					if(err.code === 'ENETUNREACH')
					{	
						//TODO: this is somehow might happen frequently in the real network world. Shall come out a fix sooner!
						console.log('cannot reach to address: ' + err.address + '\n');
					} else {
						console.log(err);
					}
					//TODO: do some err event handling later to sustain the reliablitiy of wechat fucntions.
				}).then(done());
				break;
			case 2:
				var dID = '57298f73fdfc98e319ab9c37';
				var targetStatus = { weight: 84.1};

				wkapi.modifyDeviceStatus(dID, targetStatus).then(function(result){
					console.log('modifyDeviceStatus result: '+ JSON.stringify(result) +'\n');
				}, function(err){
					console.log(err);
				}).then(done());
				break;
			case 3:
				var dID = '57298f73fdfc98e319ab9c37';
				wkapi.getDeviceStatus(dID, null).then(function(result){
					console.log('getDeviceStatus result: '+ JSON.stringify(result) +'\n');
				}, function(err){
					console.log(err);
				});
				break;
			case 4:
				var dID = '57298f73fdfc98e319ab9c37';
				var dpStr = 'bodyWater';
				wkapi.getDeviceStatus(dID, dpStr).then(function(result){
					console.log('getDeviceStatus result: '+ JSON.stringify(result) +'\n');
				}, function(err){
					console.log(err);
				});
				break;
			case 5:
				var dID = '57298f73fdfc98e319ab9c37';
				var cmdObj = {
					command: 'getFwVer',
					params: 'test',
					params2: ''
				};
				wkapi.sendCommandToDevice(dID, cmdObj).then(function(result){
					console.log('sendCommandToDevice result: '+ JSON.stringify(result) +'\n');
				}, function(err){
					console.log(err);
				});
				break;
			default:
				console.log('unsupported wukoon api index!!!\n');
				break;
		}
	});
}

wukoonApiTest(5);

/* Test mongodb.js basic operations here */
/*
var token = {"accessToken":"wficbhzkezmtexdkvpvfrpcfdgffidbc","expireIn":7200};

token.createTime = new Date();

dbapi.connect().then(console.log).then(function(fulfill, reject){
	dbapi.saveAccessToken(token).then(function(result){
		dbapi.fetchAccessToken().then(console.log);
		//console.log(result);
	});
	
	fulfill('Done Test 1');
});	
*/





