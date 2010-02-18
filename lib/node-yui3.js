var sys = require('sys'),
    http = require('http'),
    fs = require('fs'),
    path = require('path'),
    YUI = exports.YUI = require('./yui3/build/yui/yui-debug').YUI;

if (global.YUI && !YUI) {
  // this kinda sucks.  It'd be better to not use globals.
  YUI = exports.YUI = global.YUI;
}

YUI.config.loaderPath = 'loader/loader-debug.js';
YUI.config.base = './yui3/build/';

YUI.add('io-xdr', function(Y) {

    Y.io._transport = {
        flash: function() {}
    };
    Y.io.xdr = function() {
    };
    /*
    Y.io = function(url, config) {
        var meth = ((config && config.method) ? config.method : 'GET');
        Y.log('url: ' + url, 'debug', 'io');
        Y.log('method: ' + meth, 'debug', 'io');
        getRemoteFile(url, meth, function(data) {
            //Y.log(data);
            if (data.data) {
		        Y.fire('io:complete', 0, {
                    responseText: data.data,
                    headers: data.headers
                }, config.arguments);
                if (config.on && config.on.complete) {
                    _tE('complete', config);
                }
            }
        });
    };

   	var _tE = function(e, c) {
   		var eT = new Y.EventTarget().publish('transaction:' + e),
   			a = c.arguments,
   			cT = c.context || Y;

		a ? eT.on(c.on[e], cT, a) : eT.on(c.on[e], cT);
		
        return eT;
   	};
    */

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
    Y.Get.script = function(url, cb) {
        Y.log('URL: ' + url, 'info', 'get');
        //Check for it..
        var name = resolveFileName(url),
            f_path = path.join('/tmp', name);

        if (url.indexOf('http') === 0) {
            path.exists(f_path, function(exists) {
                if (exists) {
                    Y.log('Remote file exists locally, skipping', 'debug', 'get');
                    getLocalFile(Y, f_path, cb);
                } else {
                    Y.log('Fetch Remote File: ' + url, 'debug', 'get');
                    getRemoteFile(url, 'GET', function(r) {
                        if (r && r.data) {
                            //There is a callback in the URL, eval it and not save the file.
                            if (r.callback) {
                                //Not sure I like this, but not much I can do about it - @davglass
                                eval(r.data);
                            } else {
                                Y.log('Writing file to disk', 'info', 'get');
                                fs.writeFile(f_path, r.data).addCallback(function() {
                                    getLocalFile(Y, f_path, cb);
                                });
                            }
                        }
                    });
                }
            });
        } else {
            getLocalFile(Y, url, cb);
        }
    };
});


var getRemoteFile = function(url, meth, cb) {
        var parts = require("url").parse(url, true),
            port = ((parts.protocol == 'https:') ? 443 : 80),
            client = http.createClient(port, parts.hostname),
            callback = null;

            if (parts.query && parts.query.callback) {
                callback = parts.query.callback;
            }

        var req = client.request(meth, parts.pathname + ((parts.search) ? parts.search : ''), {
            'User-Agent': 'nodejs-yui3',
            'Host': parts.hostname
        }).addListener('response', function (response) {
            var data = '',
                code = response.statusCode,
                headers = response.headers;

            response.addListener('data', function(chunk) {
                data += chunk;
            });
            response.addListener('end', function() {
                cb({
                    status: code,
                    headers: headers,
                    data: data,
                    callback: callback
                });
            });
        });
        req.close();
},
getLocalFile = function(Y, path, cb) {
    url = path.replace(/\.js$/, '');
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
},
resolveFileName = function(path) {
    var name = require("url").parse(path).pathname.split('/').pop();
    if (path.indexOf('yui.yahooapis.com') === -1) {
        //Not from YUI's CDN, don't cache it by name, it may be a JSON call
        name += '_' + (new Date()).getTime();
    }
    
    return name;
};
