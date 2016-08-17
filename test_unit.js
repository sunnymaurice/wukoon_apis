'use strict';
var path = require('path');
var async = require('async');
global.__base = path.resolve(path.join(__dirname, './'));
//console.log('__dirname:'+ __dirname);
//console.log('The project root path: ' + global.__base);
/*
var WeixinPageServer = (function(){
    function WeixinPageServer(serverPort, serverHost) {
      let express =  require('express');
      let bodyParser = require('body-parser');
      this.wxHttp =require('https');
      thsi.wxApp = express();
    }

    return WeixinPageServer;
}());
*/
var WukoonRouteServer = (function() {
    function WukoonRouteServer(serverPort, serverHost) {
        let express = require('express');
        let bodyParser = require('body-parser');
        //this.https = require('https');
        this.http = require('http');
        this.app = express();
        // for parsing application/x-www-form-urlencoded
        this.app.use(bodyParser.urlencoded({ extended: true }));
        // for parsing application/json
        this.app.use(bodyParser.json());
        // Run this http server on serverHost if it is defined or locathost.
        this.app.set('host', serverHost || '0.0.0.0');
        this.app.set('port', serverPort || 80);
    }
    /**
     * 根據路由的設定，啟動httpServer
     */
    WukoonRouteServer.prototype.start = function () {
      //Binds and listens for connections on the specified host and port. This method is identical to Node’s http.Server.listen().
      /*
      this.app.listen(this.app.get('port'), this.app.get('host'), function(){
        console.log('WukoonRouteServer listening on ' + this.app.get('host') + ':' + this.app.get('port'));
      });
      */
      var self = this;
      return new Promise(function(resolve) {
        var httpSrv = self.http.createServer(self.app);
        httpSrv.listen(self.app.get('port'), self.app.get('host'), function () {
            console.log('WukoonRouteServer listening on ' + self.app.get('host') + ':' + self.app.get('port'));
            resolve(httpSrv);
        });
      });
    };
    return WukoonRouteServer;
}());

var handleWeightInfo = function handleWeightInfo(cb){
  console.log('Start to find who is the owner of this weight measurement!\n');
  var retVal = 'test1';
  cb(null, retVal);
}

var writebackWukoonDB = function writebackWukoonDB(cb){
  console.log('writebackWukoonDB\n');
  var retVal = 'test2';
  cb(null, retVal);
}
/*
 *  Main service: major core flow to provide OserioCN application via using Weixin Public module and Wukoon Module
 */

var dbClient = require('mongodb').MongoClient;
var dbUrl = 'mongodb://oseriocn:Oserio2016@localhost:41262/wukoon_device?authMechanism=SCRAM-SHA-1&authSource=wukoon_device';
//Connect to MongoDB using a url as documented at
//docs.mongodb.org/manual/reference/connection-string/
dbClient.connect(dbUrl, function(err, db) {
  var test = require('assert');
  //var eventDef = require('./config/event_def.json');
  test.equal(null, err); // 連結資料庫失敗擲出錯誤，中斷Node

  console.log('MongoDB connected.');

  var httpWkServer = new WukoonRouteServer(8080);
  //var httpWebServer = new WeixinPageServer(443);

  //TODO: Call open APIs implemented in wukoon-interfiace.js
  var wukoonInterface = require('wukoon_apis');
  var wkInterface = wukoonInterface(httpWkServer.app, db);

  httpWkServer.start().then(function(){
    console.log('OserioCN Server is Ready.');
  });

  function weightInfoListener(data){
    console.log('weight measurement notification:\n');
    console.log(data);

    async.series({
      one: handleWeightInfo,
      two: writebackWukoonDB
    }, function(err, res){
      console.log(res);
    });
  };
  // 獲取Wukoon雲基礎接口的存取權杖
  //wkInterface.getAccessToken();

  /**
   *  收到“重量通知訊息”事件
   * @param {object} data :
   {
    deviceId: "",
    msgId: "671",
    model: "MTG-315W",
    weight: "67.3"
    createTime:
    }
  * @return {}
  */
  wkInterface.eventEmitter.on('wukoon.weight.notify', weightInfoListener);

  /**
   *  收到“無電量”警告
   * @param {object} data :
   {
    deviceId: "",
    msgId: "671",
    model: "",
    battAlert: 1
    createTime:
    }
  * @return {}
  */
  wkInterface.eventEmitter.on('wukoon.battery.alert', function(data){
    console.log('battery alert notification: ' + JSON.stringify(data));
    //TODO: do send battery alert message template to all the bound users of the device.

  });
  /**
   *  收到“秤子過載”警告
   * @param {object} data :
   {
    deviceId: "",
    msgId: "671",
    model: "",
    battAlert: 1
    createTime:
    }
  * @return {}
  */
  wkInterface.eventEmitter.on('wukoon_overload.alert', function(data){
    console.log('scale overload alert notification: ' + JSON.stringify(data));
    //TODO: save this alert in the device log collection for our analysis later.
  });
  /**
   *  回覆
   * @param {object} data :
   {
    deviceId: ,
    msgId: ,
    model: ,
    battVol: ,
    fwVer: ,
    swVer: ,
    createTime:
    }
  * @return {}
  */
  wkInterface.eventEmitter.on('wukoon.detail.notify', function(data){
    console.log('getDevDetail status notification: '+ JSON.stringify(data));
    //TODO: save this alert in the device log collection for our analysis later.
  });

  wkInterface.eventEmitter.on('wukoon.status.unknown', function(data){
    console.error('unknown device status notfication: '+ JSON.stringify(data));
  });

  wkInterface.eventEmitter.on('wukoon.dev.online', function(data){
    console.log('device online event: ' + data);
  });

  wkInterface.eventEmitter.on('wukoon.dev.offline', function(data){
    console.log('device offline event: ' + JSON.stringify(data));
  });

  wkInterface.eventEmitter.on('wukoon.dev.alert', function(data){
    console.log('EVENT_DEV_ALERT: '+ JSON.stringify(data));
  });

  wkInterface.eventEmitter.on('wukoon.event.unknown', function(data){
    console.error('EVENT_DEV_UNKNOWN_EVENT: '+ JSON.stringify(data));
  });

  wkInterface.eventEmitter.on('wukoon.weixin.auth', function(data){
    //TODO: send weixin authorziation request
    console.log('EVENT_DEV_APPLY_AUTH: '+ JSON.stringify(data));
    //Step 1: Get Device list
    //Step 2: Get Weixin Access Token
    //Step 3: Send HTTP post: https://api.weixin.qq.com/device/authorize_device?access_token=access_token

  });

  wkInterface.eventEmitter.on('wukoon.info.unknown', function(data){
    console.log('EVENT_DEV_UNKNOWN_INFO: '+ JSON.stringify(data));
  });
});
