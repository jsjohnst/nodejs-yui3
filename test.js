var sys = require('sys');

var YUI = require("./lib/node-yui3").YUI;

// TODO: This should pass, but currently doesn't.
// yui-core.js creates a global YUI unnecessarily.
// Rather than testing exports and assigning the global to the exports object,
// it should sniff for exports, and if not found, set it to the global object,
// and then do exports.YUI = YUI; in either case, thus putting YUI where it
// belongs for the environment in question.
// Replying on global leakage is ill-advised if not absolutely necessary.

// require("assert").equal( global.YUI, undefined, "global yui created");

//Now use non-DOM related YUI utilities
YUI({
    filter: 'debug',
    debug: true,
    modules: {
        'gallery-yql': {
            fullpath: 'http://yui.yahooapis.com/gallery-2010.01.27-20/build/gallery-yql/gallery-yql-min.js',
            requires: ['get','event-custom'],
            optional: [],
            supersedes: []
      }
 
    }
}).use('io-xdr', 'json', 'base', 'gallery-yql', function(Y) {
    
    //Y.log(Y.config);
    //sys.puts('Inside: ' + sys.inspect(process.memoryUsage()));
    //Logger outputs with sys.puts
    Y.log('This is a test');
    //Lang is available
    Y.log('Test: ' + Y.Lang.isBoolean(true), 'debug', 'myapp');
    
    var q1 = new Y.yql('select * from github.user.info where (id = "davglass")');
    q1.on('query', function(r) {
        //Y.log(r, 'debug', 'yql');
        //Do something here.
    });
    q1.on('error', function(r) {
        //Do something here.
        //Y.log(r, 'error', 'yql');
    });
    Y.log('After YQL', 'info', 'myapp');

    //Creating a simple class
    var One = function() {
        One.superclass.constructor.apply(this, arguments);
    };
    //Extending it with Y.Base so we have Custom Events and a lifecycle
    Y.extend(One, Y.Base, {
        test: function() {
            this.publish('foo', {
                emitFacade: true
            });
            this.fire('foo');
        }
    }, {
        NAME: 'one'
    });

    //Create a new instance of our new class
    var o = new One();
    o.on('foo', function(o) {
        Y.log('Foo Fired', 'debug', 'myapp');
        //Y.log(o, 'debug');
    });
    o.test(); //Should fire the one:foo Event.
    
    /*
    Y.on('io:complete', function() {
        //Y.log(arguments, 'debug', 'io');
    }, this, ['lorem', 'ipsum']);

    Y.io('http:/'+'/yuilibrary.com/gallery/api/popular', {
        xdr: {
            use: 'flash',
        },
        data: 'foo',
        timeout: 1000,
        on: {
            complete: function(id, e) {
                Y.log(Y.JSON.parse(e), 'debug', 'io');
            }
        }
    });
    */
    
});

