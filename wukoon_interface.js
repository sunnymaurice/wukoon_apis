'use strict';
var WukoonInterface = (function () {
  function WukoonInterface (expressApp, mongoDBinstance, options) {
      var self = this;
      this.rtcfg = require('global.__base/config/route_config.json');
      this.wkcfg = require('global.__base/config/wukoon_config.json');
      this.dbcfg = require('global.__base/config/mongodb_config.json');
      this.evdef = require('global.__base/config/event_def.json');
      var events = require('events');
      var MongodbOperation = require('global.__base/db/mongodb.js').MongodbInterface;
      var WukoonAPI = require('global.__base/wukoon_bridge/wukoon_bridge.js').WukoonAPI;
      var ActionResWukoonReq = require('global.__base/route/res_wukoonReq.js').ResWukoonReq;
      this.options = options ? options : {};
      this.eventEmitter = new events.EventEmitter(); // 宣告事件廣播器
      this.eventEmitter.setMaxListeners(20); // 設定最多20個事件(預設10個)

      this.mongodbOperation = new MongodbOperation(mongoDBinstance, this.dbcfg);
      this.wukoonAPI = new WukoonAPI(this.mongodbOperation, this.wkcfg);
      this.actResWukoonReq = new ActionResWukoonReq(this.mongodbOperation, this.rtcfg, this.wkcfg, this.evdef, this.eventEmitter);

      // 設定接受物空平台的接口路由位置
      expressApp.get(this.rtcfg.WK_DEVICE_ENTRY, function (req, res) { self.actResWukoonReq.wukoonEntryGET(req, res); });
      expressApp.post(this.rtcfg.WK_DEVICE_ENTRY, function (req, res) { self.actResWukoonReq.wukoonEntryPOST(req, res); });

  }

  /**
   * 獲取Wukoon基礎接口的 Access token
   * @return {string} returns wukoon access token
   */
  WukoonInterface.prototype.getAccessToken = function () {
    let wkTokenObj = this.wukoonAPI.getWkAccessToken();
      return wkTokenObj.accessToken;
  };

  /**
   * 傳送特定指令給設備
   * @param {string} deviceId
   * @param {object} commandObj, for example : {'command':'getDevDetail', 'params':'', 'params2':''}
   * @return {} returns
   */
  WukoonInterface.prototype.sendCommandToDevice = function (deviceId, commandObj) {
    return this.wuKoonAPI.sendCommandToDevice(deviceId, commandObj);
  };

  WukoonInterface.prototyp.queryDeviceStatus = function(){

  };


  return WukoonInterface;
}());

module.exports = function wukoonInterface(app, db, opts) {
  return new WukoonInterface(app, db, opts);
};
