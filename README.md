# wukoon_apis
## Introduction
  This is the middle software to handle all APIs provided by Wukoon cloud platform so that the OserioCN's weixin server can connect to the end devices to retrieve data from them or send requests to them.
  
## Prerequisite
  + Node.js
  + Git
  + Mongodb dameon
  + Express

## How to use this module in a application 
> git clone http://github.com/sunnymaurice/wukoon_apis.git
>
> npm install /path/to/wukoon_apis

  This module haven't been published to npm repository. Therefore, you have to clone this module to a dir and use npm tool to install this to your application's node_modules directory.
  
## Code to include this module
Take a look at **test_unit.js** as an example to see how you can use this module for your application.
```node
var wukoonInterface = require('wukoon_apis');
var wkInterface = wukoonInterface(httpWkServer.app, db);
```

## The APIs ...
  To be added later.
