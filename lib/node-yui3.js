var sys = require('sys'),
    http = require('http'),
    YUI = exports.YUI = require('./yui3/build/yui/yui-debug').YUI;

if (global.YUI && !YUI) {
  // this kinda sucks.  It'd be better to not use globals.
  YUI = exports.YUI = global.YUI;
}

YUI.config.loaderPath = 'loader/loader-debug.js';
YUI.config.base = './yui3/build/';





YUI.add('io-base', function(Y) {
    Y.io = function(url, config) {
        var parts = require("url").parse(url),
        meth = ((config && config.method) ? config.method : 'GET');
        Y.log(parts);
        
        var client = http.createClient(((parts.protocol == 'https:') ? 443 : 80), parts.hostname);
        
        var request = client.request(meth, parts.pathname, {
            'client': 'XMLHttpRequest'
        });
        request.addListener('response', function (response) {
          sys.puts("STATUS: " + response.statusCode);
          sys.puts("HEADERS: " + JSON.stringify(response.headers));
        });
        //request.close();
        
    };
});

YUI.add('yui-log', function(Y) {
    Y.log = function(str, t, m) {
        //Needs to support what Y.log does with the excludeLog and includeLog
        if (Y.config.debug) {
            t = t || 'info';
            m = (m) ? '(' +  m+ ') ' : '';
            var o = false;
            if (Y.Lang.isObject(str) || Y.Lang.isArray(str)) {
                //Should we use this?
                str = sys.inspect(str);
            }
            // output log messages to stderr
            sys.error('[' + t.toUpperCase() + ']: ' + m + str);
        }
    };
});


YUI.add('get', function(Y) {
    Y.Get = function() {};
    Y.Get.script = function(s, cb) {
        url = s.replace(/\.js$/, '');
        Y.log('URL: ' + url, 'info', 'get');
        // doesn't need to be blocking, so don't block.
        require.async(url).addCallback(function (mod) {
            process.mixin(Y, mod);
            if (Y.Lang.isFunction(cb.onEnd)) {
                cb.onEnd.call(Y, cb.data);
            }
            if (Y.Lang.isFunction(cb.onSuccess)) {
                cb.onSuccess.call(Y, cb);
            }
            if (Y.Lang.isFunction(cb.onComplete)) {
                cb.onComplete.call(Y, cb);
            }
        }).addErrback(function (er) {
            if (Y.Lang.isFunction(cb.onFailure)) {
                cb.onFailure.call(Y, er, cb);
            }
            if (Y.Lang.isFunction(cb.onComplete)) {
                cb.onComplete.call(Y, cb);
            }
        });
    };
});

