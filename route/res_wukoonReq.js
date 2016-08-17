'use strict';
/*  Description: Fulfillment of receiving a series of Wukoon defined HTTP POST APIs
 *               and emit their correspondent events to the core service.
 *  Public APIs:
 *          1. Device Status Notification
 *          2. Device Events Notification (online/offline/alert)
 *          3. Device Registration Notification
 *          4. Support Wukoon's request security certification(signature).
 *  Author: Maurice Sun
 *  Revision History:
 *          1. First released @ 2016.07.22 by Maurice Sun
 *          2.
 *  Reference: Wukoon API document v1.20
 */
var ResWukoonReq = (function () {

	/**
	 *  constructor
	 *  @param {instance of db} dbapi the instance of MongodbInterface module
	 *  @param {object} routecfg Route configuration in json format
	 *  @param {object} wkcfg Wukoon configuration in json format
	 *  @param {object} evdef Event definition in json format
	 *  @param {object} eventemitter An eventEmitter object
	 */
	function ResWukoonReq(dbapi, routecfg, wkcfg, evdef, eventemitter) {
		//this.sha1 = require('sha1');
		this.dbApi = dbapi;
		this.routeCfg = routecfg;
		this.wkCfg = wkcfg;
		this.evDef = evdef;
		this.evEmitter = eventemitter;	//event emitter's instance
	}
	/* ----------- Functions below are local functions. ----------- */
	/**
	 * 以json回應要求
   * @param {any} res remote response to client
   * @param {Object} json 欲發送的json / 'Bad request'
   */
	function responseJSON(res, json) {
		if(json !== null) {
			res.setHeader('Access-Control-Allow-Origin', '*');
			res.setHeader('Content-Type', 'application/json');
			res.status(200).send(JSON.stringify(json));
		}
		else {
			res.status(400).send();
		}
  }
	/**
	 *  Local function for handleXXXRequest to judge if the request body is valid
	 *  @param req from wukoon to our wukoon service
	 *  @return {Object} Non-empty object means valid, null represets invalid instead.
	 */
	function checkReqContent(req, route)
	{
		var tempResJson = {};
		// Check content of the request is valid, otherwise, response 'Bad request'.
		if(req.body.msgType && req.body.msgId && req.body.deviceType && req.body.model && req.body.createTime) {
			// The initial content of tempResJson obj is suitable for the req whose msgType is 'INFO'.
			tempResJson = {
				msgType: req.body.msgType,
				msgId: req.body.msgId,
				createTime: req.body.createTime
			};

			if(req.body.msgType === route.MSG_TYPE_STATUS)
			{
				tempResJson.deviceId = req.body.deviceId;
			}
			else if(req.body.msgType === route.MSG_TYPE_EVENT){
				tempResJson.deviceId = req.body.deviceId;
				tempResJson.event = req.body.event;
			}
			else {
				if(req.body.msgType !== route.MSG_TYPE_INFO)
				{
					console.error('**** unexpected msgType in this reqest!!! ****');
					return null;
				}
			}
			return tempResJson;
		}
		else {
			console.error('**** unacceptable request content!!! ****');
			return null;
		}
	}
  /**
	 *  Emit the following events: (1) weight-only status (2) battery alert (3) overload alert (4) device detail
	 *  when we receive device status notification.
	 *  @param
	 *  @param
	 *  @return event with the supplied argument, 'retInfo', for the listeners defined in core service server.
	 */
	function handleDevStatusNotification(req, res, event, eventDef) {
		let retInfo = {
			deviceId: req.body.deviceId,	// 'deviceId' will be the key to know the group of users boudn to this device.
			msgId: req.body.msgId,
			model: req.body.model,				// Include model for future use to distinguish device type to adopt its own rule.
			createTime: req.body.createTime
		};
		let contentObj;
		//Do base64 decode of reg.body.content to string
		let contentStr = new Buffer(req.body.content, 'base64').toString('utf8');

		console.log('ResWukoonReq::handleDevStatusNotification\n');
		// The content should not be empty
		if(contentStr.length === 0)
		{
			console.error('Device Status with empty content!!!');
			responseJSON(res, null);
			return;
		}
		//TODO: call the inteded module code according to our product classificatons. Do it later.
		/*
		switch (req.body.model) {
			case 'MTG-315W':

				break;
			case 'xxxx':

				break;
			default:

		}
		*/
		console.log('Device Status with content: '+contentStr);
		contentObj = JSON.parse(contentStr);

		// Weight measurement notification.
		if(typeof contentObj.weight !== 'undefined' && contentObj.weight)
		{
			retInfo.weight = contentObj.weight;
			console.log('receive weight data and ret info: ' + JSON.stringify(retInfo));
			event.emit(eventDef.EVENT_DEV_WEIGHT_NOTIFY, retInfo);
		}
		// Device battery alert.
		else if(typeof contentObj.battAlert !== 'undefined' && contentObj.battAlert)
		{
			retInfo.battAlert = 1;
			console.log('receive battery alert and ret info: ' + JSON.stringify(retInfo));
			//TODO: call Mongodb function API to save this type of alert in the collection: xxx
			event.emit(eventDef.EVENT_DEV_BATT_ALERT, retInfo);
		}
		// Device overload alert
		else if(typeof contentObj.overload !== 'undefined' && contentObj.overload)
		{
			retInfo.overload =1;
			console.log('receive overload aleert and ret info: ' + JSON.stringify(retInfo));
			//TODO: call Mongodb function API to save this type of alert in the collection: xxx
			event.emit(eventDef.EVENT_DEV_OVERLOAD_ALERT, retInfo);
		}
		// TODO: Device publish data faliure
		// Device detail notification after receive getDevDetail command
		// TODO: Do we need to get this info from Device or just via Wukoon?
		else if(contentObj.battVol && contentObj.fwVer && contentObj.swVer)
		{
			retInfo.battVol = parseInt(contentObj.battVol);
			retInfo.fwVer = contentObj.fwVer;
			retInfo.swVer = contentObj.swVer;
			console.log('receive device detail info: ' + JSON.stringify(retInfo));
			event.emit(eventDef.EVENT_DEV_DETAIL_NOTIFY, retInfo);
		}
		else { 	// Should not happened.
			console.warn('**** Wukoon send unsupported conetent request!!! ****\n');
			event.emit(eventDef.EVENT_DEV_UNKNOWN_STATUS, {msg: contentStr});
		}
	}
	/*
	 *  Emit the following events: (1) device get online (2) device get offline
	 *  when we receive device event notification. Meanwhile, we keep the device online/offline event in the DB system.
	 *  TODO: Haven't define any alert event at this stage.
	 *  @return event
	 */
	function handleDevEventNotification(req, res, event, eventDef, routeCfg) {
		let retInfo = {
			deviceId: req.body.deviceId, 	// 'deviceId' will be the key to know the group of users boudn to this device.
			msgId: req.body.msgId,
			model: req.body.model,				// Include model for future use to distinguish device type to adopt its own rule.
			event: req.body.event,
			createTime: req.body.createTime
		};
		let contentStr = new Buffer(req.body.content, 'base64').toString('utf8');

		console.log('ResWukoonReq::handleDevEventNotification\n');
		// The content should not be empty. Although, we haven't adopt this scheme so far.
		if(req.body.event === routeCfg.EVENT_ALERT && contentStr.length === 0)
		{
			responseJSON(res, null);
			return;
		}
		// Emit event to the core service accordingly.
		if(req.body.event === routeCfg.EVENT_ONLINE) {
			console.log('receive device event: online');
			//TODO: call Mongodb function API to save this event in the collection: xxx
			event.emit(eventDef.EVENT_DEV_ONLINE, retInfo);
		}
		else if(req.body.event === routeCfg.EVENT_OFFLINE) {
			console.log('receive device event: offline');
			//TODO: call Mongodb function API to save this event in the collection: yyy
			event.emit(eventDef.EVENT_DEV_OFFLINE, retInfo);
		}
		else if(req.body.event === routeCfg.EVENT_ALERT) {
			console.log('receive device event: alert');
			retInfo.alertMsg = contentStr;
			event.emit(eventDef.EVENT_DEV_ALERT, retInfo);
		}
		else { 	// Should not happened.
			console.warn('**** Wukoon send unsupported conetent request!!! ****\n');
			event.emit(teventDef.EVENT_DEV_UNKNOWN_EVENT, retInfo);
		}
	}
	/**
	 * 接收來自Wukoon的設備信息消息，發出事件通知給監聽的主程式並且回傳微信授權相關的json物件
	 * @param  {Object} req.body.content: [{"did": "xxxx", "mac": "yyyy"}, {"did": "aaaa", "mac": "bbbb"}]
	 * @return {Object}:
   * {
	 		product_model: "MTG-315W",
	 		device_type: "",
	 		device_list: [
		 		{"dId": "abcd1234", "mac": "112233445564", "regTime": "xyz", "wxAuthed": 0, "authTime": "N/A"},
		 		{"dId": "abcd1235", "mac": "112233445565", "regTime": "xyz", "wxAuthed": 0, "authTime": "N/A"},
		 		{"dId": "abcd1236", "mac": "112233445566", "regTime": "xyz", "wxAuthed": 0, "authTime": "N/A"}
	 		]
   * }
	 */
	function handleDevInfoNotification(req, res, event, eventDef, db) {
		let devNum = req.body.content.length;
		let action = '';
		//The device number should not be empty or greater than 5 at a time.
		if(devNum === 0 || devNum > 5)
		{
			console.error('handleDevInfoNotification: number of device is out of range or empty...');
			responseJSON(res, null);
			return;
		}

		let retInfo = {
			product_model: req.body.model,
			deviceType: req.body.deviceType		//Should we store device_type from weixin's authorize_device API response?
		};

		let dList = req.body.content;

		for(let i = 0; i < dList.length; i++) {
			dList[i].regTime = req.body.createTime;
			dList[i].wxAuthed = 0;
			dList[i].authTime = 'N/A';
		}
		retInfo.device_list = dList;
		action = 'insertNew';
		//TODO: call Mongod DB function to keep information in DB.
		db.saveAuthDeviceInfo(retInfo, action);
		event.emit(eventDef.EVENT_DEV_APPLY_AUTH, retInfo);
	}

	/**
	 使用Wukoon設定的Token字串，檢查Wukoon傳送過來的簽名是否正確
	 @param {any} param 微信傳送過來的簽名JSON
	 */
	/*
	function checkWukoonSignature(param) {
			// 按照字典排序
			let array = [this.wkcfg.WK_AUTHTOKEN, param.timestamp, param.nonce].sort();
			// 連接字串並比對簽名
			if (this.sha1(array.join('')) === param.signature) {
					return true;
			}
			else {
					return false;
			}
	}
	*/
	/* ----------- Functions above are local functions. ----------- */

	/**
	 * 處理 Wukoon平台的GET請求
	 * @param {any} req remote request from wukoon
	 * @param {any} res remote response to wukoon
	 */
	ResWukoonReq.prototype.wukoonEntryGET = function (req, res) {
			console.log('Recived wukoon GET Request');
			console.log(req.query);
			// 驗證 Wukoon 簽名
			if (req.query && req.query.signature && checkWukoonSignature(req.query)) {
					// 簽名驗證成功
					if (req.query.echostr) {
							// 如果帶有echostr，直接回應echostr(Wukoon平台驗證)
							res.status(200).send(req.query.echostr);
					}
					else {
							// TODO: shall this happen?
					}
			}
			else {
					res.status(200).send('signature failed');
			}
	};

	/**
	 * 處理 Wukoon 平台的POST請求
	 * @param {any} req remote request from wukoon
	 * @param {any} res remote response to wukoon
	 */
	ResWukoonReq.prototype.wukoonEntryPOST = function (req, res) {
		console.log('++++ Receive wukoon POST request! ++++\n');
		//console.log(req.query);
		console.log("wukoonEntryPOST: request contetn: "+ JSON.stringify(req.body));
		//var self = this;
		var resJson = {};
		resJson = checkReqContent(req, this.routeCfg);
		// 1. Response Reqeust first.
		responseJSON(res, resJson);
		// 2. Reaction to notify core service a variant kind of events according to msgType and its content.
		switch (req.body.msgType) {
			/*
			 *  設備狀態消息的 content 內容有以下的情況：
			 *  	(1). 一般量測資料消息內容：{"weihgt": 59.3, "battVol": 2, "fwVer": "xxxx", "swVer": "yyyy"}
			 *    (2). 電量不足消息內容： {"battAlert": 1}
			 *    (3). 回應用戶指令 getDevDetail 內容：{"battVol": 3, "fwVer": "xxxx", "swVer": "yyyy"}
			 */
			case this.routeCfg.MSG_TYPE_STATUS:
				handleDevStatusNotification(req, res, this.evEmitter, this.evDef);
				break;
			case this.routeCfg.MSG_TYPE_EVENT:
				handleDevEventNotification(req, res, this.evEmitter, this.evDef, this.routeCfg);
				break;
			/*
			 * 設備信息消息： 接收來自wukoon 產品介面上推送已經註冊的設備信息，並且替這些設備做[微信授權]
			 *
			 */
			case this.routeCfg.MSG_TYPE_INFO:
				handleDevInfoNotification(req, res, this.evEmitter, this.evDef, this.dbApi);
				break;
			default:
				console.error('wukoonEntryPOST: receive unsupported message type:' + req.body.msgType);
				break;
		}
	};

	return ResWukoonReq;
} ());
exports.ResWukoonReq = ResWukoonReq;
