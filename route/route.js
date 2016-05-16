/*
 *
 *
 */
var wkServiceRoute = (function () {
    function wkServiceRoute() {
        this.express = require('express');
        this.app = this.express();
        this.bodyParser = require('body-parser');
        this.path = require('path');
        this.rtcfg = require(global.__base + '/config/route_config.json');
                
        // load for parsing application/json
        this.app.use(this.bodyParser.json());
        // load for parsing application/x-www-form-urlencoded
        this.app.use(this.bodyParser.urlencoded({ extended: true }));
        // Run this http server on localhost
        this.app.set('host', process.env.HOST || 'localhost');	
        // Listen to Oserio Weixin Request on 8080 port	
        this.app.set('port', process.env.PORT || 8080);				
        
        /* 
        	TODO: The block to accept defined functional HTTP requests from 
        		1. our weixin service server
        		2. Wukoon Cloud server
        		3. Oserio backed server

        */
        // 1.設定接受微信公眾平台 HTTP Request的接口路由位置
        this.app.get('/get_wkreq', (req, res) => {
        	console.log(req);
        	console.log(res);
        	res.send('Logged the request and response');
        });
        // 2.設定接受Wukoon雲平台 HTTP Request 的接口路由位置
        this.app.post('/post_wkreq', (req, res) => {
        	console.log(req.body);
        	res.send('Get POST request...');
        });


        // 設定接受oserio weixin server 的接口路由位置
        //this.app.get(this.rtcfg.WX_PREFIX + this.rtcfg.WX_DEVICE_ENTRY, function (req, res) { _this.actionWxPlatform.weixinDeviceEntryGET(req, res); });
        //this.app.post(this.rtcfg.WX_PREFIX + this.rtcfg.WX_DEVICE_ENTRY, function (req, res) { _this.actionWxPlatform.weixinDeviceEntryPOST(req, res); });
        console.log('Finish the init constructor of wkServiceRoute');
    }

    /**
     根據路由的設定，啟動httpServer
     @return {Promise} 非同步工作的承諾；啟動httpServer後,返回httpServer物件
     */
    wkServiceRoute.prototype.start = function () {
    	//console.log('host: '+ this.app.get('host') + ' ; port: '+ this.app.get('port'));

    	console.log('App server listening on ' + this.app.get('host') + ':' + this.app.get('port'));
        
        this.app.listen(this.app.get('port'), this.app.get('host'));  
    };

    return wkServiceRoute;
}());
module.exports = exports = new wkServiceRoute();
