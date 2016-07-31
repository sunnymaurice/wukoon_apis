/*
 *  Description: Fulfillment of Wukoon defined APIs used for send request to Wukoon platform
 *  Public APIs:
 *          1. Retrieve 'Access Token'
 *          2. Modify device status
 *          3. Get device entire status
 *          4. Get device status via 'Data Point'
 *          5. Send commands to the device
 *          6. Query a specific interval of a device's history data
 *          7. Write Open ID back to the last measued data.
 *          8. SQL query a specific interval of data in Wukoon DB.
 *          9.
 *  Author: Maurice Sun
 *  Revision History:
 *          1. First released @ 2016.05.13 by Maurice Sun
 *          2. Modify 2.2 & add support of 2.6 and 2.7 API @ 2016.06.27 by Mauric Sun
 *          3. Add suport of 2.8 API @ 2016.07.22 by Maurice Sun
 *  Reference: Wukoon API document v1.20
 */
'use strict';
var WukoonAPI = (function () {

    function WukoonAPI(mongodb, wkcfg) {
        this.request = require('request');  // to make HTTP requests
        this.crypto = require('crypto');
        this.mongoDB = mongodb;
        this.wkcfg = wkcfg;
        this.wkToken = null;
        /**
         *  Local functio to check if the cache of wukoon access token in DB is about expried
         * @param {object} cachedToken: {}
         * @return {boolean}
         */
        this.isExpired = function (cachedToken) {
            //console.log('WukoonAPI: isExpired')
            //console.log('cached token: ' + JSON.stringify(cachedToken) + '\n');
            if (!cachedToken) {
                //console.log('no cacheToken\n');
                return true;
            }
            else {
                let currTimeStamp = new Date().getTime();
                console.log('current time: ' +currTimeStamp+ 'expired time: ' +cachedToken.expiredTime.getTime()+ '\n');
                // get to know if the cachedToken is expired
                return currTimeStamp > cachedToken.expiredTime.getTime();
            }
        };
        //console.log('WukoonAPI constructor Done...\n');
    }

    /**
     * 2.1 API: 獲取 Access Token
     * 取得Wukoon雲接口必須使用的AccessToken (Send HTTP GET Request to Wukoon Cloud Server)
     * @return {Promise} 非同步工作的承諾；取得Wukoon雲接口的AccessToken後, 回覆request response 結果如下：
     An example:
     {
         "accessToken" : "kqowtzvvqprbcfcrwkfzqdycaayyzycx",
         "expiresIn"   : 7200,
         "createdTime" : ISODate("2016-05-13T06:43:11.568Z"),
         "expiredTime" : ISODate("2016-05-13T08:43:11.568Z")
     }
     */
    WukoonAPI.prototype.getWkAccessToken = function () {
        console.log('WukoonAPI: getWkAccessToken\n');
        var self = this;

        return new Promise(function (resolve, reject) {
            /**
             *  send http get request to Wukoon to inquire an access_token
             */
            var getAccessToken = function () {
                //console.log('getWkAccessToken: call getAccessToken()!\n');

                let options = {
                    method: 'GET',
                    url: self.wkcfg.WK_BASE_URL + self.wkcfg.WK_TOKEN_QUERY +
                        self.wkcfg.WK_TYPE_NAME + '=' + self.wkcfg.WK_TYPE_TOKEN + '&' +
                        self.wkcfg.WK_APPID_NAME + '=' + self.wkcfg.WK_APPID + '&' +
                        self.wkcfg.WK_APPSECRECT_NAME +'=' + self.wkcfg.WK_APPSECRET
                };
                //console.log(JSON.stringify(options));
                // Request URL: http://120.24.216.153:8000/token?type=ACCESS_TOKEN&appId=APPID&appSecret=APPSECRET
                self.request(options, function (error, response, body) {

                    if(error) {
                        console.error('\n##### getAccessToken Request Error. #####\n');
                        reject(error);
                    }
                    else {
                        if(response.statusCode === 200) {
                            body = JSON.parse(body);

                            // "errcode": 0 & "errmsg":"ok"
                            if(body.errcode === 0) {
                                //TODO: check body.accessToken should be non-empty string
                                if(typeof body.accessToken !== 'string' || typeof body.expireIn !== 'number')
                                {
                                  console.error('getAccessToken: response data type invalid!!!');
                                  reject(body);
                                }
                                // TODO: 時間顯示是否該用 GMT+8 的時間
                                let currTime = new Date();
                                let expireTime = currTime.getTime() + (body.expireIn - 60)*1000;
                                self.wkToken.accessToken = body.accessToken;
                                self.wkToken.expiresIn = body.expiresIn;
                                self.wkToken.createdTime = currTime;
                                self.wkToken.expiredTime = new Date(expireTime);

                                // 將access_token 存至 database collection: 'wukoon_access_token'
                                self.mongoDB.saveAccessToken(self.wkToken).then(function () {
                                    console.log('Refresh Wukoon Access Token.');
                                    resolve(self.wkToken);
                                });
                            }
                            else {
                              console.error('\n##### getAccessToken - http response errcode: %d and msg: %s\n', body.errcode, body.errmsg);
                              reject(body);
                            }
                        }
                        else { //response.statusCode != 200
                            console.error('getAccessToken Request get status code: ' + response.statusCode);
                            reject(body);
                        }
                    }
                });
            };//end of local function: getAccessToken

            // There is no cached access_token in this module.
            if (!self.wkToken) {
                // 從資料庫中取出暫存access_token
                self.mongoDB.fetchAccessToken().then( function (token) {

                    if (token === null) {
                        console.log('no cached access token in module yet ...\n');
                        getAccessToken(); // 資料庫尚無access_token，向wukoon要求access_token
                    }
                    else
                    {
                        self.wkToken = token;

                        if (self.isExpired(self.wkToken)) {
                            console.log('The token stored in DB needs to be updated with a new one from wukoon\n');
                            getAccessToken(); // 如果過期則發出要求給微信更新access_token
                        }
                        else {
                            console.log('return cached token ...\n');
                            // 回傳尚未過期的access_token
                            resolve(self.wkToken);
                        }
                    }
                }, function (error) {
                    reject(error);
                });
            }
            else {  // There is already an cached access_token in this module.
                if (self.isExpired(self.wkToken)) {
                    console.log('The cached token needs to be updated with a new one from wukoon\n');
                    getAccessToken(); // 如果過期則發出要求給微信更新access_token
                }
                else {
                    console.log('Use the cached token!\n');
                    // 回傳尚未過期的access_token
                    resolve(self.wkToken);
                }
            }
        });
    };

    /**
     *  2.2 API: 修改設備狀態
     *  @param {deviceID: string; mac of the target deive, targetObj: string; eg. { DATAPOINT1 : val1, DATAPOINT2 : val2} }
     *  @return `http response body` or `error`
     */
    WukoonAPI.prototype.modifyDeviceStatus = function (deviceID, targetObj) {
        console.log('WukoonAPI: modifyDeviceStatus\n');
        var self = this;

        if(!deviceID || !targetObj)
        {
            return new Promise( function(reject) {
                reject(new Error('modifyDeviceStatus: params error'));
            });
        }
        else
        {
            return new Promise( function(resolve, reject) {
                // Send http post request after getting access token
                self.getWkAccessToken().then( function (token) {
                    var reqJson = targetObj;
                    //console.log(JSON.stringify(reqJson));
                    //contents of request in body
                    /*
                            {
                                "DATAPOINT1": val1,
                                "DATAPOINT2": val2
                            }
                    */
                    var options = {
                        method: 'POST',
                        url: self.wkcfg.WK_BASE_URL + self.wkcfg.WK_DEV_ENTRY_URL + deviceID +
                             self.wkcfg.WK_DEV_STATUS_QUERY + self.wkcfg.WK_ACCESS_TOKEN_NAME + '=' + token.accessToken,
                        //qs: { accessToken: token.accessToken },
                        headers: { 'content-type': 'application/json'},
                        body: reqJson,
                        json: true
                    };

                    self.request( options, function (error, response, body) {

                        if(error) {
                            console.error('\n##### modifyDeviceStatus Request Error. #####\n');
                            reject(error);
                        }
                        else {
                            if(response.statusCode === 200) {

                                if(body.errcode === 0) {
                                    // Fields to be kept in DB whenever there is a successful modification of device status.
                                    self.devModRecord = {
                                        action: 'modifyStatus',
                                        deviceID: deviceID,
                                        status: targetObj,
                                        modifiedTime: new Date()
                                    };

                                    //console.log('Going to do saveDevChangeRecord with record: '+JSON.stringify(self.devModRecord)+'\n');
                                    // TODO: Should we keep this record in our server or let Wukoon Cloud do this?
                                    // Save the history record of updating the device's Data Point
                                    self.mongoDB.saveDevChangeRecord(self.devModRecord).then( function () {
                                        console.log('Save the modification of device status record.');
                                        //resolve(self.devModRecord);
                                        resolve(body);
                                    }, function (error) {
                                        reject(error);
                                    }); // end of self.mongoDB.saveDevChangeRecord(self.devModRecord).then()
                                }
                                else {
                                    console.error('\n##### modifyDeviceStatus - wukoon http response errcode: %d\n', body.errcode);
                                    reject(body);
                                }
                            }
                            else {
                                console.error('modifyDeviceStatus Request get status code: ' + response.statusCode);
                                reject(body);
                            }
                        }
                    }); //end of self.request.post()
                }, function (error) {
                  //This is equivalent to use catch(fucntion(error){}) method after calling then() method
                  reject(error);
                }); //end of self.getWkAccessToken().then()
            }); //end of return new Promise()
        }
    };

    /**
     *  2.3 & 2.4 API: 查詢設備狀態(完整查詢/按數據點查詢)
     *  @param {string} deviceID
     *  @param {string} dataPointStr, specific data point that the system querys, otherwise, it means to query the full set of data pointes defined in Wukoon platform
     *  @return a last full DP set json / a specific `dataPoint` json
     *      1.full DP set json : {"deviceId": "57298f73fdfc98e319ab9c37", "weight": {"value": 65.1, "unit": "kg", "timeStamp": 1462960392993}, "battVol": {...}, ... : {...}}
     *      2.a specific `weight` json: {"deviceId": "57298f73fdfc98e319ab9c37", "value": 120.8, "unit": "lb", "timeStamp": 1462960393002}
     */
    WukoonAPI.prototype.getDeviceStatus = function (deviceID, dataPointStr) {
        console.log('WukoonAPI: getDeviceStatus\n');
        var self = this;

        if(!deviceID)
        {
            return new Promise( function(reject) {
                reject(new Error('getDeviceStatus: params error! deviceID is NULL.'));
            });
        } else {
            return new Promise( function(resolve, reject) {

                // Send http get request after getting access token
                self.getWkAccessToken().then( function (token) {
                    //完整查詢
                    if(!dataPointStr)
                    {
                        // Request URL: http://120.24.216.153:8000/device/deviceID/status?accessToken=token
                        let fullOptions = {
                            method: 'GET',
                            url: self.wkcfg.WK_BASE_URL + self.wkcfg.WK_DEV_ENTRY_URL + deviceID +
                                 self.wkcfg.WK_DEV_STATUS_QUERY + self.wkcfg.WK_ACCESS_TOKEN_NAME + '=' + token.accessToken
                            //qs: { accessToken: token.accessToken }
                        };

                        self.request(fullOptions, function (error, response, body) {

                            if(error) {
                                console.error('\n##### getDeviceStatus Full Request Error. #####\n');
                                reject(error);
                            }
                            else {
                                if(response.statusCode === 200){
                                    body = JSON.parse(body);

                                    if(body.errcode === 0) {
                                        //TODO: Parse the body content and return a [full DP set] json
                                        let statusRet = {dId: body.deviceId, connected: body.connected, satus: body.status};
                                        console.log('getDeviceStatus(full), ret: ' +statusRet);
                                        resolve(statusRet);
                                    }
                                    else {
                                      console.error('getDeviceStatus(full) - wukoon http response errcode: ' + body.errcode);
                                      reject(body);
                                    }
                                }
                                else {
                                    console.error;('getDeviceStatus Full Request get status code: ' + response.statusCode);
                                    reject(body);
                                }
                            }
                        });
                    }
                    else { // 按數據點查詢
                        // Request URL: http://120.24.216.153:8000/device/deviceID/status/dataPoint?accessToken=token
                        var dpOptions = {
                            method: 'GET',
                            url: self.wkcfg.WK_BASE_URL + self.wkcfg.WK_DEV_ENTRY_URL + deviceID + self.wkcfg.WK_DEV_DP_STATUS_URL +
                                 dataPointStr + '?' + self.wkcfg.WK_ACCESS_TOKEN_NAME + '=' + token.accessToken
                            //qs: { accessToken: token.accessToken }
                        };

                        self.request( dpOptions, function (error, response, body) {
                            if(error) {
                                console.error('\n##### getDeviceStatus DP: '+ dataPointStr +' Request Error. #####\n');
                                reject(new Error(error));
                            } else {
                                if(response.statusCode === 200)
                                {
                                    body = JSON.parse(body);

                                    if(body.errcode === 0) {
                                        // Notice: body.data = { "t": 1462445576744, "fwVer": "1.0.10.A.WK"}
                                        let dpRet = {dId: body.deviceId, connected: body.connected, data: body.data};
                                        console.log('getDeviceStatus ('+ dataPointStr +'):\n' + JSON.stringify(body) + '\n');
                                        resolve(dpRet);
                                    }
                                    else {
                                      console.error('getDeviceStatus - wukoon http response errcode: ' + body.errcode);
                                      reject(body);
                                    }
                                }
                                else {
                                    console.warn('getDeviceStatus DP: '+ dataPointStr +' Request get status code: ' + response.statusCode);
                                    reject(body);
                                }
                            }
                        });
                    }
                },
                function(error) {
                    reject(error);
                });
            });
        }
    };

    /**
     *  2.5 API: 發送命令給設備
     *  @param {deviceID: string, cmdSet: obj, { command: 'getFwVer', params: 'args', params2: ''}}
     *  @return
     */
    WukoonAPI.prototype.sendCommandToDevice = function (deviceID, cmdSet) {
        console.log('WukoonAPI: sendCommandToDevice\n');
        var self = this;

        if(!deviceID || !cmdSet) {
            return new Promise( function(reject) {
                reject(new Error('sendCommandToDevice: params error'));
            });
        }
        else {
            return new Promise( function(resolve, reject) {

                // TODO: Check if the cmdSetObj.command is a legal cmd beforehand.

                // Send http post request after getting access token
                self.getWkAccessToken().then( function (token) {
                     var options = {
                        method: 'POST',
                        url: self.wkcfg.WK_BASE_URL + self.wkcfg.WK_DEV_ENTRY_URL + deviceID +
                             self.wkcfg.WK_COMMAND_QUERY + self.wkcfg.WK_ACCESS_TOKEN_NAME + '=' + token.accessToken,
                        //qs: { accessToken: token.accessToken },
                        headers: { 'content-type': 'application/json'},
                        body: cmdSet,
                        json: true
                    };
                    console.log(JSON.stringify(options));

                    self.request( options, function (error, response, body) {
                        if(error) {
                            console.log('\n##### sendCommandToDevice Request Error. #####\n');
                            reject(error);
                        }
                        else {
                            if(response.statusCode === 200) {
                                if(body.errcode) {
                                    console.log('\n##### sendCommandToDevice - wukoon http response errcode: %d\n', body.errcode);
                                    reject(body);
                                    // TODO: should I handle errcode = 20013 (token has expired) here?
                                }
                                if(body.errcode === 0){
                                    //console.log('sendCommandToDevice get resp body:\n' + JSON.stringify(body) + '\n');
                                    //TODO: save this record via call saveDevChangeRecord() in mongodb.js
                                    // Fields to be kept in DB whenever there is a successful command send to the device.
                                    self.devModRecord = {
                                        action: 'sendCommand',
                                        deviceID: deviceID,
                                        status: cmdSet,
                                        modifiedTime: new Date()
                                    };

                                    //console.log('Going to do saveDevChangeRecord with record: '+JSON.stringify(self.devModRecord)+'\n');
                                    // TODO: Should we keep this record in our server or let Wukoon Cloud do this?
                                    // Save the history record of updating the device's Data Point
                                    self.mongoDB.saveDevChangeRecord(self.devModRecord).then( function () {
                                        console.log('Save the command sent to the device in the collection');
                                        //resolve(self.devModRecord);
                                        resolve(body);
                                    }, function (error) {
                                        reject(error);
                                    });
                                }
                            }
                            else {
                                console.log('sendCommandToDevice Request get status code: ' + response.statusCode);
                                reject(body);
                            }
                        }
                    });
                },
                function(error){
                    reject(error);
                });
            });
        }
    };

    /**
     *  2.6 API: 查詢設備歷史狀態
     *  @param {deviceID: string, startT: string (Format: 'YYYY-MM-DD HH:mm:ss'), endT: String (Format: 'YYYY-MM-DD HH:mm:ss')}
     *  @return  `http response body` which including the array of device status or `error`
     */
    WukoonAPI.prototype.queryDeviceHistoryRecord = function (deviceID, startT, endT) {
        console.log('WukoonAPI: queryDeviceHistoryRecord\n');
        var _this = this;

        if(!deviceID || !startT || !endT)
        {
          return new Promise( function(reject) {
              reject(new Error('queryDeviceHistoryRecord: params error'));
          });
        }
        else
        {
          //TODO: Check if the three input params are valid and legal here.

          return new Promise( function(resolve, reject) {
            // Send http put request after getting access token
            _this.getWkAccessToken().then(function (token) {

              var options = {
                method: 'GET',
                url: _this.wkcfg.WK_BASE_URL + _this.wkcfg.WK_DEV_ENTRY_URL + deviceID + _this.wkcfg.WK_DEV_HISTORY_URL +
                      '?' + _this.wkcfg.WK_ACCESS_TOKEN_NAME + '=' + token.accessToken + '&' +
                      _this.wkcfg.WK_DEV_START_NAME + '=' + startT + '&' +
                      _this.wkcfg.WK_DEV_END_NAME + '=' + endT
                //qs: { accessToken: token.accessToken },
              };

              console.log(JSON.stringify(options));
              // Request URL: http://120.24.216.153:8000/device/{deviceId}/history/?accessToken=ACCESS_TOKEN&start=xxxx&end=yyyy
              _this.request( options, function (error, response, body) {
                if(error) {
                    console.error('\n##### queryDeviceHistoryRecord Request Error. #####\n');
                    reject(error);
                }else {
                  if(response.statusCode === 200)
                  {
                    body = JSON.parse(body);

                    if(body.errcode === 0){
                      //TODO: We might need to handle the device history record later for a certain service in the future.
                      console.log(body.status);
                      resolve(body.status);
                    } else {
                      console.error('\n##### queryDeviceHistoryRecord - wukoon http response errcode: %d\n', body.errcode);
                      reject(body);
                    }

                  } else
                  {
                    console.warn('queryDeviceHistoryRecord: Request get unexpecte status code: ' + response.statusCode);
                    reject(body);
                  }
                }
              });
            }, function (error) {
              //onRejected callback func
              reject(error);
            });
          });

        }
    };

    /**
     *  2.7 API: 設備數據回填
     *  @param {deviceId: string, timeStamp: string(要修改的數據點的時間戳), key: string (要回填的數據欄位), value: String/Int/...（回填欄位的值）}
     *  @return errcode: (1). 0: ok, (2). others: error
     */
    WukoonAPI.prototype.writeBackDevKeyValue = function (deviceID, timeStamp, key, value) {
        console.log('WukoonAPI: writeBackDevKeyValue\n');
        var _this = this;

        if(!deviceID || !key || !timeStamp || !value)
        {
            return new Promise( function(reject) {
                reject(new Error('writeBackDevKeyValue: params error'));
            });
        }
        else {
            return new Promise( function(resolve, reject) {
                var dataObj = {
                    data: {
                        t: timeStamp,
                        key: value
                    }
                };
                //TODO: The core service should do this check before calling this API.
                /*
                var timeGap = ( new Date().getTime() - timeStamp.getTime() ) / 1000;
                console.log('the temp data has been there for ' + timeGap + ' seconds.\n');

                if(timeGap > 3600)
                {
                    reject(new Error('writeBackDevKeyValue: timeout to writeback'));
                }
                */
                // Send http PUT request after getting access token
                _this.getWkAccessToken().then(function (token) {
                    // Request URL: /device/{deviceId}/history/writeback?accessToken=xxxxxxxxx
                    var options = {
                      method: 'PUT',
                      url: _this.wkcfg.WK_BASE_URL + _this.wkcfg.WK_DEV_ENTRY_URL + deviceID + _this.wkcfg.WK_DEV_HISTORY_URL +
                            _this.wkcfg.WK_DEV_WB_PUT + _this.wkcfg.WK_ACCESS_TOKEN_NAME + '=' + token.accessToken,
                      //qs: { accessToken: token.accessToken },
                      headers: {
                        'cache-control': 'no-cache',
                        'content-type': 'application/json'
                      },
                      body: dataObj,
                      json: true
                    };
                    console.log(JSON.stringify(options));

                    _this.request(options, function (error, response, body) {
                        if(error) {
                            console.error('\n##### writeBackDevKeyValue Request Error. #####\n');
                            reject(error);
                        }else {
                            if(response.statusCode === 200) {
                                if(body.errcode === 0) {
                                    console.log('writeBackDevKeyValue get resp body:\n' + JSON.stringify(body) + '\n');

                                    //TODO: remove this temporay record in [unknown_user_data] collection.

                                    resolve(body);
                                } else {
                                    console.error('\n##### writeBackDevKeyValue - wukoon http response errcode: %d\n', body.errcode);

                                    //TODO: Need to define how we handle
                                    /*
                                    if(body.errcode === 20003) {
                                      console.warn('invalid parameter');
                                    }
                                    else if(body.errcode === 20005) {
                                      console.warn('unknown device');
                                    }
                                    else if(body.errcode === 20011) {
                                      console.warn('no content');
                                    }
                                    else if(body.errcode === 20018) {
                                      console.warn('cannot update cold data');
                                    }
                                    else {

                                    }
                                    */
                                    reject(body);
                                }
                            } else {
                                console.warn('writeBackDevKeyValue: Request get status code: ' + response.statusCode);
                                reject(body);
                            }
                        }
                    });
                },
                function(error){
                    reject(error);
                });
            });
        }
    };

    /**
     *  2.8 API: 按用戶指定的條件查詢設備數據
     *  @param {sqlObj, startT, endT}
     *  @return {} errcode:
     */
    WukoonAPI.prototype.queryHistoryData = function (sqlObj, startT, endT) {
      console.log('WukoonAPI: queryHistoryData\n');
      var _this = this;

      if(!sqlObj)
      {
        return new Promise( function(reject) {
            reject(new Error('queryHistoryData: params error'));
        });
      }
      else
      {
        return new Promise(function(resolve, reject){
          //Send http GET request after getting access token
          _this.getWkAccessToken().then(function(token){
            let reqURL =
                  _this.wkcfg.WK_BASE_URL + _this.wkcfg.WK_DEV_ENTRY_URL + _this.wkcfg.WK_DEV_HISTORY_URL +'?' +
                  _this.wkcfg.WK_ACCESS_TOKEN_NAME + '=' + token.accessToken + '&' +
                  _this.wkcfg.WK_QUERY_SQL_NAME + '=' + sqlObj;

            if(!startT){
              reqURL += '&' + _this.wkcfg.WK_DEV_START_NAME + '=' + startT;
            }

            if(!endT){
              reqURL += '&' + _this.wkcfg.WK_DEV_END_NAME + '=' + startT;
            }

            let options = {
              method: 'GET',
              url: reqURL
            };

            _this.request(options, function(error, response, body){
              if(error) {
                  console.log('\n##### queryHistoryData Request Error. #####\n');
                  reject(error);
              } else {
                if(response.statusCode === 200)
                {
                  body = JSON.parse(body);

                  if(body.errcode === 0){
                    //TODO: Need to confirm whether the content of the return record is correct.
                    console.log(body.rec);
                    resolve(body.rec);
                  } else {
                    console.error('\n##### queryHistoryData - wukoon http response errcode: %d\n', body.errcode);
                    reject(body);
                  }
                } else
                {
                  console.warn('queryHistoryData: Request get unexpecte status code: ' + response.statusCode);
                  reject(body);
                }
              }
            });
          },
          function(error){
            reject(error);
          });
        });//end of return Promise
      }
    };

    return WukoonAPI;
}());
module.exports = exports = new WukoonAPI();
