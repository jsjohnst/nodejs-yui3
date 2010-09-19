var sys = require('sys'),
    http = require('http'),
    fs = require('fs'),
    path = require('path'),
    url = require('url'),
    //Is gallery installed?
    gallery = false,
    //Is the 2in3 project installed?
    twoIn3 = false,
    // Extract meaning from stack traces
    STACK_FRAME_RE = /.* \(?(.+:\d+:\d+)\)?$/;

try {
    //Try to load the YUI3-core module
    var yui3 = require('yui3-core');
    var YUI = yui3.YUI;
} catch (e) {
    console.log('YUI3 Core package was not found; npm install yui3-core');
    process.exit();
}

//Does the terminal have color? (for Y.log)
var hasColor = false;
try {
    var stdio = require("stdio");
    hasColor = stdio.isStderrATTY();
} catch (ex) {
    hasColor = true
}

try {
    //Load Gallery
    gallery = require('yui3-gallery').path();
} catch (e) {}

try {
    //Load 2in3
    twoIn3 = require('yui3-2in3').path();
} catch (e) {}


//Colorize the string
var color = function(str, num) {
    if (!hasColor) {
        return str;
    }
    if (!num) {
        num = '32';
    }
    return "\033[" + num +"m" + str + "\033[0m"
};


var YUI_config = {
    groups: {},
    loaderPath: 'loader/loader-debug.js',
    domBase: YUI.config.base,
    base: yui3.path() + '/build/',
    injected: true,
    modules: {
        'express': {
            after: ['yui-base'],
            fullpath: __dirname + '/express.js'
        },
        'nodejs-dom': {
            fullpath: __dirname + '/dom.js',
            condition: {
                trigger: 'dom',
                test: function() {
                    return true;
                }
            }
        },
        'nodejs-node': {
            fullpath: __dirname + '/node.js',
            after: ['node'],
            condition: {
                trigger: 'node',
                test: function() {
                    return true;
                }
            }
        },
        'io-nodejs': {
            fullpath: __dirname + '/io.js',
            requires: ['io', 'io-xdr', 'nodejs-dom'],
            after: ['io-xdr'],
            condition: {
                trigger: 'io',
                test: function() {
                    return true;
                }
            }
        }
    },
    logFn: function(str, t, m) {
        var id = '';
        if (this.id) {
            id = '[' + this.id + ']:';
        }
        t = t || 'info';
        m = (m) ? color(' (' +  m.toLowerCase() + '):', 35) : '';
        
        if (str instanceof Object || str instanceof Array) {
            //Should we use this?
            if (str.tagName || str._yuid || str._query) {
                str = str.toString();
            } else {
                str = sys.inspect(str);
            }
        }

        var lvl = '37;40', mLvl = ((str) ? '' : 31);

        switch (t.toLowerCase()) {
            case 'error':
                lvl = mLvl = 31;
                break;
            case 'warn':
                lvl = 33;
                break;
            case 'debug':
                lvl = 34;
                break;
        }

        if (str && str.indexOf("\n") !== -1) {
            str = "\n" + str;
        }

        // output log messages to stderr
        sys.error(color(t.toLowerCase() + ':', lvl) + m + ' ' + color(str, mLvl));
    }
};

if (gallery) {
    YUI_config.groups.gallery = {
        combine: false,
        base: gallery + '/build/',
        ext: false,
        patterns:  {
            'gallery-': { },
            'gallerycss-': { type: 'css' }
        }
    }
}

if (twoIn3) {
    var YUI2_VERSION = '2.8.1';
    
    YUI_config.groups.yui2 = {
        combine: false,
        ext: false,
        base: twoIn3 + '/dist/' + YUI2_VERSION + '/build/',
        update: function(tnt, yui2) {
            this.base = twoIn3 + '/dist/' + yui2 + '/build/';
        },
        patterns:  { 
            'yui2-': {
                configFn: function(me) {
                    if(/-skin|reset|fonts|grids|base/.test(me.name)) {
                        me.type = 'css';
                        me.path = me.path.replace(/\.js/, '.css');
                        // this makes skins in builds earlier than 2.6.0 work as long as combine is false
                        me.path = me.path.replace(/\/yui2-skin/, '/assets/skins/sam/yui2-skin');
                    }
                }
            } 
        }
    }
}

/**
* This is a pass-thru method that is used inside a YUI module to include "node" modules.
* This can be modified later to use other "require" methods too.
* @static
* @method YUI.require
*/
YUI.require = function(str) {
    return require(str);
};

/**
* This is a HACK to apply the "global" YUI_config before applying the  
* users supplied config. Since YUI_config is not truly global in Node
*/
YUI.prototype.__setup = YUI.prototype._setup;
YUI.prototype._setup = function() {
    var self = this;
    this.applyConfig(YUI_config);
    this.__setup.call(self);
    
    /**
    * This is a HACK and should be fixed.. This removes CSS files
    * From the global _loaded hash, so they can be "reloaded" in other instances.
    */
    for (var i in YUI.Env._loaded[this.version]) {
        if (i.indexOf('skin') > -1 || i.indexOf('css') > -1) {
            delete YUI.Env._loaded[this.version][i];
        }
    }
};

YUI.prototype.fetch = function(url, cb) {
    if (!url) { return; }
    
    var self = this;

    self.use('node', 'io', function() {
        self.io(url, {
            xdr: {
                use: 'nodejs'
            },  
            on: {
                success: function(id, o) {
                    self.one('doc').set('innerHTML', o.responseText);
                    if (cb) {
                        cb(o.responseText);
                    }
                }   
            }   
        }); 
    });

};

exports.YUI = YUI;


/**
* Attempts to normalize the port number from a given url, defaulting to 80
* @static
* @mrthod YUI.urlInfoPort
*/
YUI.urlInfoPort = function(urlInfo) {
    return urlInfo.port ? urlInfo.port :
        urlInfo.protocol === 'http:' ? 80 : 443;
};

/**
* Static method to load a YUI module into a specific YUI instance. Since all YUI modules start with YUI.add
* YUI needs to be present when that code is eval'd. This method will fetch the file (local or remote) and
* then do some fancy stepping to get the module to compile into the local scope of the YUI instance, still
* allowing access to the exported YUI global object so the module can be attached.
* @static
* @method YUI.include
*
*/
YUI.include = function(file, cb) {
    var loaderFn = function(err, data) {
        if (err) {
            cb(err);
        } else {
            try {
                /*
                * This is the fancy stepping required to get the module to eval into the local scope
                */
                var mod = "(function(YUI) { " + data + " return YUI; })",
                    fn = process.compile(mod, file);

                YUI = fn(YUI);
                cb(null, YUI);
            } catch(err) {
                cb(err);
            }
        }
    };
    //If the file is remote, fetch it..
    if (file.match(/^https?:\/\//)) {

        var urlInfo = url.parse(file, parseQueryString=false),
            req_url = urlInfo.pathname,
            host = http.createClient(YUI.urlInfoPort(urlInfo), urlInfo.hostname);

        if (urlInfo.search) {
            req_url += urlInfo.search;
        }
        var request = host.request('GET', req_url, { host: urlInfo.hostname });

        request.addListener('response', function (response) {
            var data = '';
            response.addListener('data', function (chunk) {
                data += chunk;
            });
            response.addListener("end", function() {
                loaderFn(null, data);
            });
        });
        if (request.end) {
            request.end();
        } else {
            request.close();
        }
        
    } else {
        //Load the file locally
        fs.readFile(file, encoding='utf8', loaderFn);
    }
};

/**
* Support method for the delayed insertion of CSS elements into a document. Since the document may not exist at the time Get tries to insert it.
* Called from inside the nodejs-dom module when the document is loaded.
* @method processCSS
*/

YUI.prototype.processCSS = function() {
    var self = this,
        urls = [];

    if (this.config._cssLoad) {
        var newURL = this.Env.meta.base + this.Env.meta.root;
        var reURL = this.config.base;
        this.config._cssLoad.reverse();
        this.config._cssLoad.forEach(function(v, k) {
            urls.push(v.replace(reURL, newURL));
        });
        self.Get.css(urls);
    }
};

//Hack for loadtime Event module.
YUI.config.doc = { documentElement: {} };
YUI.Env._ready = YUI.Env.DOMReady = YUI.Env.windowLoaded = true;


/**
* NodeJS specific Get module used to load remote resources. It contains the same signature as the default Get module so there is no code change needed.
* Note: There is an added method called Get.domScript, which is the same as Get.script in a browser, it simply loads the script into the dom tree
* so that you can call outerHTML on the document to print it to the screen.
* @module get
*/
YUI.add('get', function(Y) {
    
    var end = function(cb, msg, result) {
        //Y.log('Get end: ' + cb.onEnd);
        if (Y.Lang.isFunction(cb.onEnd)) {
            cb.onEnd.call(Y, msg, result);
        }
    }, pass = function(cb) {
        //Y.log('Get pass: ' + cb.onSuccess);
        if (Y.Lang.isFunction(cb.onSuccess)) {
            cb.onSuccess.call(Y, cb);
        }
        end(cb, 'success', 'success');
    }, fail = function(cb, er) {
        //Y.log('Get fail: ' + er);
        if (Y.Lang.isFunction(cb.onFailure)) {
            cb.onFailure.call(Y, er, cb);
        }
        end(cb, er, 'fail');
    };

    Y.Get = function() {};

    /**
    * Override for Get.script for loading local or remote YUI modules.
    */
    Y.Get.script = function(s, cb) {
        var A = Y.Array,
            urls = A(s), url, i, l = urls.length;
        for (i=0; i<l; i++) {
            url = urls[i];
            if (!urls[i].match(/^https?:\/\//)) {
                if (url.substr(0, 12) === './yui3/build') {
                    //If it's a YUI loaded file, get it from this directory, else use the default path
                    url = path.join(__dirname, url);
                }
            }
            Y.log('URL: ' + url, 'info', 'get');
            // doesn't need to be blocking, so don't block.
            YUI.include(url, function(err) {
                Y.log('Loaded: ' + url, 'info', 'get');
                if (err) {
                    Y.log('----------------------------------------------------------', 'error', 'nodejsYUI3');
                    if (err.stack) {
                        A.each(err.stack.split('\n'), function(frame) {
                            Y.log(frame, 'error', 'nodejsYUI3');
                        });
                    } else {
                        Y.log(getErrorMessage(err), 'error', 'nodejsYUI3');
                        Y.log('In file: ' + getErrorFilename(err), 'error', 'nodejsYUI3');
                        Y.log('On line: ' + getErrorLine(err), 'error', 'nodejsYUI3');
                    }
                    Y.log('----------------------------------------------------------', 'error', 'nodejsYUI3');
                } else {
                    pass(cb);
                }
            });
        }
    };

    /**
    * Additional method for adding script tags to a document for printing.
    */
    Y.Get.domScript = function(s, cb) {
        var A = Y.Array,
            urls = A(s), url, i, l = urls.length,
            body = Y.get('body');

        for (i=0; i<l; i++) {
            url = urls[i];
            body.append('<script src="' + url + '"></script>');
            if (cb) {
                pass(cb);
            }
        }
    };

    /**
    * Adds the link tag to the document, if it exists, if it doesn't, the files are added to the _cssLoad hash and loaded from processCSS
    */
    Y.Get.css = function(s, cb) {
        Y.log('Get.css', 'debug', 'get');
        if (!Y.Lang.isArray(s)) {
            s = [s];
        }
        if (!Y.config.win) {
            if (!Y.config._cssLoad) {
                Y.config._cssLoad = [];
            }
            s.forEach(function(v) {
                Y.config._cssLoad.push(v);
                Y.log('Defer Loading CSS: ' + v, 'debug', 'get');
            });
        } else {
            Y.log('Real CSS loading', 'debug', 'get');
            var head = Y.config.doc.getElementsByTagName('head')[0];

            s.forEach(function(link) {
                link = link.replace(Y.config.base, Y.config.domBase);
                var l = Y.config.doc.createElement('link');
                l.setAttribute('rel', 'stylesheet');
                l.setAttribute('type', 'text/css');
                l.setAttribute('href', link);
                head.appendChild(l);
            });
        }
        if (cb) {
            pass(cb);
        }
    };
});



//Helper methods

//Get the Error Message from the stack
var getErrorMessage = function(e) {
    try {
        return e.message || e.stack.split('\n')[0].trim();
    } catch (e) {
        return 'YUI: failed to get error message';
    }
};

// Get the filename for a given exception
var getErrorFilename = function(e) {
    try {
        var m = e.stack.split('\n')[1].match(STACK_FRAME_RE);
        return m[1].substring(
            0,
            m[1].lastIndexOf(':', m[1].lastIndexOf(':') - 1)
        );
    } catch (e) {
        return 'YUI: failed to get error filename';
    }
};

// Get the line number for a given exception
var getErrorLine = function(e) {
    try {
        var m = e.stack.split('\n')[1].match(STACK_FRAME_RE);
        var parts = m[1].split(':');
        return parseInt(parts[parts.length - 2]);
    } catch (e) {
        return -1;
    }
};

