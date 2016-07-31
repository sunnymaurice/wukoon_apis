/*
 *  Description:
 *  Public Functions:
 *          1. Cache wukoon access token: saveAccessToken, fetchAccessToken
 *          2. Wechat user measurement record:
 *          3. Device history records of those modified operations:
 *          4. Information table of Wukoon registered and Wechat authorized devices:
 *          5.
 *  Author: Maurice Sun
 *  Revision History:
 *          1. First released @ 2016.04.26 by Maurice Sun
 *          2. Modified to support essential db operations for Wukoon APIs and events @ 2016.07.22 by Maurice Sun
 *          3.
 *  Reference: Node.js MongoDB Driver API (http://mongodb.github.io/node-mongodb-native/2.1/api/)
 */
'use strict';
 var MongodbInterface = (function () {

    function MongodbInterface(db_instance, db_config) {
        this.test = require('assert');
        this.dbcfg = db_config;
        this.db = db_instance;
        //Fetch a specific collection (containing the actual collection information)
        this.wkTokenColl = this.db.collection(this.dbcfg.COLL_WKACCESS_TOKEN);
        this.devModRecordColl = this.db.collection(this.dbcfg.COLL_DEV_MODIFY_REC);
        this.noUserDataColl = this.db.collection(this.dbcfg.COLL_CONFLICT_REC);
        this.authDevColl = this.db.collection(this.dbcfg.COLL_AUTH_DEV_LIST);
        console.log('MongodbInterface constructor Done...\n');
    }
    /**
     *  Initial process of setup the connection to MongoDB server
     */
    /*
    MongodbInterface.prototype.connect = function () {
        var _this = this;
        // 若正在初始化或已初始化完成，則直接回調
        if (this.isInitialing || this.isInitialized) {
            return new Promise( (resolve, reject) => { reject('Need initial mongodb'); });
        }
        else {
            this.isInitialing = true;
            return new Promise((resolve) => {
                // MongoDB Connection URL
                var mongodbUrl = 'mongodb://' + _this.dbcfg.DB_USER + ':' + _this.dbcfg.DB_PWD +
                    '@' + _this.dbcfg.DB_HOST + _this.dbcfg.DB_NAME +
                    '?authMechanism=SCRAM-SHA-1&authSource=' + _this.dbcfg.DB_NAME;
                // Use connect method to connect to the server
                _this.mongoClient.connect(mongodbUrl, (error, db_instance) => {
                    _this.assert.equal(null, error); // 連結資料庫失敗執出錯誤，中斷Node
                    _this.db = db_instance;          // 記住資料庫的連結
                    _this.isInitialing = false;
                    _this.isInitialized = true;
                    resolve(_this.db);
                    //resolve('Get DB instance!');
                });
            });
        }
    };
    */
    /**
     *  Close the connection to MongoDB server
     */
    /*
    MongodbInterface.prototype.close = function (){
        console.log('MongodbInterface: close DB\n');
        this.db.close();
    };
    */
    /**
     *  @param  {object} newAccessToken, wechat access token
        {
         "accessToken" : "kqowtzvvqprbcfcrwkfzqdycaayyzycx",
         "expiresIn" : 7200,
         "createdTime" : ISODate("2016-05-13T06:43:11.568Z"),
         "expiredTime" : ISODate("2016-05-13T08:43:11.568Z")
        }
     *  @return {Promise} doc
     */
    MongodbInterface.prototype.saveAccessToken = function (newAccessToken) {
      var self = this;
      console.log('MongodbInterface: saveAccessToken');

      return new Promise( (resolve) => {
        self.wkTokenColl.findOne({}, (err, doc) => {
          if (doc === null) {
            // Insert a new one since there is no document yet.
            self.wkTokenColl.insertOne(newAccessToken, (error, doc) => {
              self.test.equal(null, error); // 寫入資料庫失敗執出錯誤，中斷Node
              self.test.equal(1, doc.insertedCount); // Check if the inserted document is one.
              console.log('Inserted a document into the "' + self.dbcfg.COLL_WKACCESS_TOKEN + '" collection.');
              resolve(doc);
            });
          }
          else {
            // Update the document since the old one is expired.
            // Using an upsert operation, ensuring creation if it does not exist.
            self.wkTokenColl.updateOne({ _id: doc._id }, { $set: newAccessToken }, { upsert: true }, (error, result) => {
              self.test.equal(null, error); // 寫入資料庫失敗執出錯誤，中斷Node
              self.test.equal(1, result.matchedCount);
              console.log('Updated a document into the "' + self.dbcfg.COLL_WKACCESS_TOKEN + '" collection.');
              resolve(result);
            });
          }
      });
    });
  };

    /**
     * 於資料庫中取出Wukoon雲平台API接口的Access Token
     * @return {string} return Access Token field.
     */
    MongodbInterface.prototype.fetchAccessToken = function () {
        var self = this;
        console.log('MongodbInterface: fetchAccessToken');

        return new Promise( (resolve) => {
            //Fetches the field, accessToken, of the document in the collection,
            self.wkTokenColl.findOne({}, {fields:{accessToken:1}}, (error, doc) => {
                self.test.equal(null, error); // 連結資料庫失敗擲出錯誤，中斷Node
                self.test.equal(1, doc.length);
                resolve(doc); // 找到的話回傳該 access token, 找不到會回調null
            });
        });
    };

    /**
     *  將對於設備的修改 2.2 API 修改設備狀態 & 2.5 API 發送命令給設備 的動作記錄於資料庫 collection: [wukoon_dev_modify_record]
     *  @param {object} : modRecord
     *         { action: "modifyStatus"/"sendCommand",
     *           deviceID: deviceID,
     *           status: {"status":  {"DATAPOINT1" : val1, "DATAPOINT2" : val2} }/ {"command": "commName", "params": "arg1", "params2": "arg2"},
     *           modifiedTime: new Date()
     *         }
     *  @return {Promise} doc
     */
    MongodbInterface.prototype.saveDevChangeRecord = function (modRecord) {
        var self = this;
        console.log('MongodbInterface: saveDevChangeRecord');

        return new Promise( (resolve) => {
            // Insert the done of device modification behaviour.
            self.devModRecordColl.insertOne( modRecord, (error, doc) => {
                self.test.equal(null, error); // 寫入資料庫失敗擲出錯誤，中斷Node
                self.test.equal(1, doc.insertedCount); // Check if the inserted document is one.
                console.log('Save a document into the "' + self.dbcfg.COLL_DEV_MODIFY_REC + '" collection.');
                resolve(doc);
            });
        });
    };

    /**
     * 處理悟空註冊/微信授權的設備資料表新增和更新
     * @param {object/string} devObj:
     *  搭配微信授權儲存的Mongodb資料表(Collection): weixin_auth_devices
          {
               product_model: "MTG-315W",
               deviceType: "",
               device_list: [
                 {"dId": "abcd1234", "mac": "112233445564", "regTime": "", "wxAuthed": 1, "authTime": "", "Users": []},
                 {"dId": "abcd1235", "mac": "112233445565", "regTime": "", "wxAuthed": 1, "authTime": "", "Users": []},
                 {"dId": "abcd1236", "mac": "112233445566", "regTime": "", "wxAuthed": 0, "authTime": "", "Users": []}
               ]
          }
     * @param {string} action:
     * @return
     */
    MongodbInterface.prototype.saveAuthDeviceInfo = function (devObj, action) {
        var self = this;
        console.log('MongodbInterface: saveAuthDeviceInfo');

        return new Promise(function (resolve, reject) {
            if(action === 'insertNew') {
                self.authDevColl.findOne({product_model:devObj.product_model}).then(function(doc){
                  if(doc === null) { //First time to add this document for a specific model
                    self.authDevColl.insertOne(devObj, function(error, doc){
                      self.test.equal(null, error); // 寫入資料庫失敗執出錯誤，中斷Node
                      self.test.equal(1, doc.insertedCount); // Check if the inserted document is one.
                      console.log('Inserted a document into the "' + self.dbcfg.COLL_AUTH_DEVICES + '" collection.');
                      resolve(doc);
                    });
                  }
                  else {// Update the newly registered devices to the existing document
                    // Use $each with $push Operator to append multiple device array to the device_list array.
                    self.authDevColl.findOneAndUpdate({'product_model':devObj.product_model},
                    {$push:{device_list:{$each:devObj.device_list}}}, function(error, result){
                      self.test.equal(null, error); // 寫入資料庫失敗執出錯誤，中斷Node
                      console.log(result.value);
                      resolve(result);
                    });
                  }
                });
            }
            else if(action === 'updateStatus') {
              // Update the device_list object array's status remarked as being weixin authorized.
              // In this case, we assume the input 'devObj' is a string represeting a device id.
              self.authDevColl.update({'device_list.dId':devObj},
              {$currentDate:{'device_list.$.authTime':true},$set:{'device_list.$.wxAuthed':1}}, function(error, doc){
                self.test.equal(null, error);
                console.log(doc.result);
                self.test.equal(1, doc.result.n);
                resolve(doc.result);
              });
            }
            else {
              console.error('saveAuthDeviceInfo: unsupported action: '+action);
              reject(new Error('unsupported action'));
            }
        });
    };

    /**
     * 處理微信用戶綁定/解綁設備時的相對應資料表格(collection)處理
     * @param {string} model: model name of the device
     * @param {string} deviceId: unique ID of the device
     *  搭配微信授權儲存的Mongodb資料表(Collection): weixin_auth_devices
          {
               product_model: "MTG-315W",
               deviceType: "",
               device_list: [
                 {"dId": "abcd1234", "mac": "112233445564", "regTime": "2016-07-22 ...", "wxAuthed": 1, "authTime": "2016-07-25 ...", "Users": [{"userId": "gh_a35gadg69daf", "createTime": "2016-07-24"},{}]},
                 {"dId": "abcd1235", "mac": "112233445565", "regTime": "2016-06-21 ...", "wxAuthed": 1, "authTime": "", "Users": []}
              ]
          }
     * @param {string} action:
     * @return {object} res.value: the updated document of the collection
     */
    MongodbInterface.prototype.updateDeviceUserInfo = function (model, deviceId, userInfoObj, action) {
        var self = this;
        console.log('MongodbInterface: updateDeviceUserInfo');

        return new Promise(function(resolve, reject){
          //Reaction for receiving a user "binding device" event
          if(action === 'addUser') {
            console.log('updateDeviceUserInfo: addUser');
            self.authDevColl.findOneAndUpdate({'product_model':model,'device_list.dId':deviceId},{addToSet:{'device_list.$.users':userInfoObj}}, {returnOriginal:false, upsert:true}, function(err, res){
              self.test.equal(null, err);
              resolve(res.value);
            });
          }
          //Reaction for receiving a user "unbinding device" event
          else if(action === 'delUser') {
            console.log('updateDeviceUserInfo: delUser');
            self.authDevColl.update({'product_model':model,'device_list.dId':deviceId},{$pull:{'device_list.$.users':{userId:userInfoObj.userId}}}, function(err, doc){
              self.test.equal(null, err);
              console.log(doc.result);
              self.test.equal(1, doc.result.n);
            });
          }
          else {
            console.error('updateDeviceUserInfo: unsupported action' + action);
            reject(new Error('unsupported action'));
          }
        });
    };
    return MongodbInterface;
}());
module.exports = exports = new MongodbInterface();
