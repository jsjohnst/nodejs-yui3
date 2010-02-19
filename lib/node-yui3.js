var sys = require('sys'),
    http = require('http'),
    fs = require('fs'),
    path = require('path'),
    yui_path = path.join(process.cwd(), 'lib'),
    yui_base_file = path.join(yui_path, '/yui3/build/yui/yui-debug'),
    YUI = exports.YUI = require(yui_base_file).YUI;

//if (global.YUI && !YUI) {
  // this kinda sucks.  It'd be better to not use globals.
//  YUI = exports.YUI = global.YUI;
//}

YUI.config.loaderPath = 'loader/loader-debug.js';
YUI.config.base = './yui3/build/';


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
    var end = function(cb, msg, result) {

        Y.log('Get end: ' + cb.onEnd);

        if (Y.Lang.isFunction(cb.onEnd)) {
            cb.onEnd.call(Y, msg, result);
        }
    }, pass = function(cb) {

        Y.log('Get pass: ' + cb.onSuccess);

        if (Y.Lang.isFunction(cb.onSuccess)) {
            cb.onSuccess.call(Y, cb);
        }
        end(cb, 'success', 'success');
    }, fail = function(cb, er) {

        Y.log('Get fail: ' + er);

        if (Y.Lang.isFunction(cb.onFailure)) {
            cb.onFailure.call(Y, er, cb);
        }
        end(cb, er, 'fail');
    };
    Y.Get = function() {};
    Y.Get.script = function(url, cb) {
        if (url.splice) {
            url = url[0];
        }
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
    Y.Get.css = function(s, cb) {
        pass(cb);
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

            sys.puts('GET: ' + parts.pathname + ((parts.search) ? parts.search : ''));

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
getLocalFile = function(Y, f_path, cb) {
    url = f_path.replace(/\.js$/, '');
    //url = path.join(process.cwd(), 'lib', url);
    // doesn't need to be blocking, so don't block.
    require.async(url).addCallback(function (mod) {
        sys.puts('Success');
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
        sys.puts('FAIL: ' + er);
        if (Y.Lang.isFunction(cb.onFailure)) {
            cb.onFailure.call(Y, er, cb);
        }
        if (Y.Lang.isFunction(cb.onComplete)) {
            cb.onComplete.call(Y, cb);
        }
    });
},
resolveFileName = function(path) {
    if (path.splice) {
        path = path[0];
    }
    var parts = require("url").parse(path),
        name = parts.pathname.split('/').pop();
    if (path.indexOf('yui.yahooapis.com') === -1) {
        //Not from YUI's CDN, don't cache it by name, it may be a JSON call
        name += '_' + (new Date()).getTime();
    } else {
        if (name === 'combo') {
            require("assert").notStrictEqual(name, 'combo', 'Requests can not be combo handled yet');
        }
    }
    
    return name;
};
