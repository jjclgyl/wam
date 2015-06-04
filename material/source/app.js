
/**
 * @license almond 0.2.9 Copyright (c) 2011-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice,
        jsSuffixRegExp = /\.js$/;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap, lastIndex,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);
                name = name.split('/');
                lastIndex = name.length - 1;

                // Node .js allowance:
                if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                    name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                }

                name = baseParts.concat(name);

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            callbackType = typeof callback,
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (callbackType === 'undefined' || callbackType === 'function') {
            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback ? callback.apply(defined[name], args) : undefined;

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (config.deps) {
                req(config.deps, config.callback);
            }
            if (!callback) {
                return;
            }

            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        return req(cfg);
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());
define("libs/almond.js", function(){});

/*!
 * routie - a tiny hash router
 * v0.3.2
 * http://projects.jga.me/routie
 * copyright Greg Allen 2013
 * MIT License
*/
(function(n){var e=[],t={},r="routie",o=n[r],i=function(n,e){this.name=e,this.path=n,this.keys=[],this.fns=[],this.params={},this.regex=a(this.path,this.keys,!1,!1)};i.prototype.addHandler=function(n){this.fns.push(n)},i.prototype.removeHandler=function(n){for(var e=0,t=this.fns.length;t>e;e++){var r=this.fns[e];if(n==r)return this.fns.splice(e,1),void 0}},i.prototype.run=function(n){for(var e=0,t=this.fns.length;t>e;e++)this.fns[e].apply(this,n)},i.prototype.match=function(n,e){var t=this.regex.exec(n);if(!t)return!1;for(var r=1,o=t.length;o>r;++r){var i=this.keys[r-1],a="string"==typeof t[r]?decodeURIComponent(t[r]):t[r];i&&(this.params[i.name]=a),e.push(a)}return!0},i.prototype.toURL=function(n){var e=this.path;for(var t in n)e=e.replace("/:"+t,"/"+n[t]);if(e=e.replace(/\/:.*\?/g,"/").replace(/\?/g,""),-1!=e.indexOf(":"))throw Error("missing parameters for url: "+e);return e};var a=function(n,e,t,r){return n instanceof RegExp?n:(n instanceof Array&&(n="("+n.join("|")+")"),n=n.concat(r?"":"/?").replace(/\/\(/g,"(?:/").replace(/\+/g,"__plus__").replace(/(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?/g,function(n,t,r,o,i,a){return e.push({name:o,optional:!!a}),t=t||"",""+(a?"":t)+"(?:"+(a?t:"")+(r||"")+(i||r&&"([^/.]+?)"||"([^/]+?)")+")"+(a||"")}).replace(/([\/.])/g,"\\$1").replace(/__plus__/g,"(.+)").replace(/\*/g,"(.*)"),RegExp("^"+n+"$",t?"":"i"))},s=function(n,r){var o=n.split(" "),a=2==o.length?o[0]:null;n=2==o.length?o[1]:o[0],t[n]||(t[n]=new i(n,a),e.push(t[n])),t[n].addHandler(r)},h=function(n,e){if("function"==typeof e)s(n,e),h.reload();else if("object"==typeof n){for(var t in n)s(t,n[t]);h.reload()}else e===void 0&&h.navigate(n)};h.lookup=function(n,t){for(var r=0,o=e.length;o>r;r++){var i=e[r];if(i.name==n)return i.toURL(t)}},h.remove=function(n,e){var r=t[n];r&&r.removeHandler(e)},h.removeAll=function(){t={},e=[]},h.navigate=function(n,e){e=e||{};var t=e.silent||!1;t&&l(),setTimeout(function(){window.location.hash=n,t&&setTimeout(function(){p()},1)},1)},h.noConflict=function(){return n[r]=o,h};var f=function(){return window.location.hash.substring(1)},c=function(n,e){var t=[];return e.match(n,t)?(e.run(t),!0):!1},u=h.reload=function(){for(var n=f(),t=0,r=e.length;r>t;t++){var o=e[t];if(c(n,o))return}},p=function(){n.addEventListener?n.addEventListener("hashchange",u,!1):n.attachEvent("onhashchange",u)},l=function(){n.removeEventListener?n.removeEventListener("hashchange",u):n.detachEvent("onhashchange",u)};p(),n[r]=h})(window);
define("libs/routie", function(){});

define('libs/core',[
	"libs/routie"
],function(){

	function show(path, config){
		if (config == -1)
			return render_sub_stack(this, path);
		if (this._subs[path])
			return render_sub_stack(this._subs[path], config);
		

		var scope = get_app_scope(this);
		var index = this.index;

		if (typeof path == "string"){
			var index = index;

			//child page
			if (path.indexOf("./") === 0){
				index++;
				path = path.substr(2);
			}

			//route to page
			var parsed = parse_parts(path);
			scope.path = scope.path.slice(0, index).concat(parsed);
		} else {
			//set parameters
			webix.extend(scope.path[index].params, path, true);
		}

		scope.show(url_string(scope.path), -1);
	}

	function get_app_scope(scope){
		while(scope){
			if (scope.app)
				return scope;
			scope = scope.parent;
		}
		return app;
	}

	function url_string(stack){
		var url = [];
		var start = app.config.layout ? 1 : 0;

		for (; start<stack.length; start++){
			url.push("/"+stack[start].page);
			var params = params_string(stack[start].params);
			if (params)
				url.push(":"+params);
		}

		return url.join("");
	}
	function params_string(obj){
		var str = [];
		for (var key in obj){
			if (str.length)
				str.push(":");
			str.push(key+"="+obj[key]);
		}
		
		return str.join("");
	}


	function subui(ui, name, stack){
		if (run_plugins(url_plugins, ui, name, stack, this) === false) return;

		if (name.page != this.name){
			this.name = name.page;
			this.ui = create_temp_ui;
			this.on = create_temp_event;
			this.show = show;
			this.module = ui;
			
			destroy.call(this);

			//collect init and destory handlers
			//set subview container
			this._init = [];
			this._destroy = [];
			this._subs = {};
			this.$layout = false;

			var subview = copy(ui, null, this);
				subview.$scope = this;

			create.call(this, subview);
		
			//prepare layout for view loading
			if (this.$layout){
				this.$layout = {
					root : (this._ui.$$ || webix.$$)(this.name+":subview"),
					sub: 		subui,
					parent: 	this,
					index: 		this.index + 1
				};
			}
		}

		run_plugins(ui_plugins, ui, name, stack, this);

		if (!ui.$onurlchange || ui.$onurlchange.call(ui, name.params, stack, this) !== false)
			return this.$layout;
	}

	function parse_parts(url){
		//split url by "/"
		var chunks = url.split("/");
		
		//use optional default layout page
		if (!chunks[0]){
			if (app.config.layout)
			 	chunks[0] = app.config.layout;
			else
				chunks.shift();
		}

		//for each page in url
		for (var i = 0; i < chunks.length; i++){
			var test = chunks[i];
			var result = [];

			//detect params
			var pos = test.indexOf(":");
			if (pos !== -1){
				var params = test.substr(pos+1).split(":");
				//detect named params
				var objmode = params[0].indexOf("=") !== -1;

				//create hash of named params
				if (objmode){
					result = {};
					for (var j = 0; j < params.length; j++) {
						var dchunk = params[j].split("=");
						result[dchunk[0]] = dchunk[1];
					}
				} else {
					result = params;
				}
			}
			
			//store parsed values
			chunks[i] = { page: (pos > -1 ? test.substr(0, pos) : test), params:result };
		}

		//return array of page objects
		return chunks;
	}

	function copy(obj, target, config){
		if (obj.$oninit)
			config._init.push(obj.$oninit);
		if (obj.$ondestroy)
			config._destroy.push(obj.$ondestroy);
		if (obj.$subview){
			if (typeof obj.$subview == "string"){
				var tname = (config.name + ":subview:"+obj.$subview);
				var tobj = config._subs[obj.$subview] = { 
					parent:this,
					root: tname,
					sub:subui,
					index:0,
					app:true
				};

				obj.id   = tname;
			} else {
				obj = { id: (config.name + ":subview") };
				config.$layout = true;
			}
		}
		if (obj.$ui)
			obj = obj.$ui;
		if (obj.$init){
			return obj;
		}
	
		target = target || (webix.isArray(obj)?[]:{});
		for (var method in obj){
			if(obj[method] && typeof obj[method] == "object" && !webix.isDate(obj[method])){
				target[method] = copy(obj[method], (webix.isArray(obj[method])?[]:{}), config);
			} else {
				target[method] = obj[method];
			}
		}

		return target;
	}

	function render_sub_stack(scope, path){
		if (scope.root)
			scope.root = webix.$$(scope.root);

		var parts = parse_parts(path);
		scope.path = [].concat(parts);
		render_stack(scope, parts);
	}

	function render_stack(layout, stack){
		var line = stack[0];
		if (line){
			var url = line.page;
			var issubpage = url.indexOf(".") === 0;

			if (issubpage)
				url = (layout.fullname||"")+url;
			url = url.replace(/\./g,"/");

			if (run_plugins(require_plugins, url, line, stack, layout) === false) return;

			require(["views/" + url], function(ui){
				stack.shift();

				var next = layout.sub(ui, line, stack);
				if (next){
					next.fullname = (issubpage ? (layout.fullname || "") : "") + line.page;
					render_stack(next, stack);
				} else {
					webix.ui.$freeze = false;
					webix.ui.resize();
				}
			});
		} else {
			webix.ui.$freeze = false;
			webix.ui.resize();
		}
	}

	var ui_plugins = [];
	var url_plugins = [];
	var require_plugins = [];
	function run_plugins(plugins, ui, name, stack, scope){
		for (var i = 0; i < plugins.length; i++)
			if (plugins[i](ui, name, stack, scope) === false) return false;
		return true;
	}

	var app = {
		create:function(config){
			//init config
			app.config = webix.extend({
				name:"App",
				version:"1.0",
				container: document.body,
				start:"/home"
			}, config, true);

			//init self
			app.debug = config.debug;
			app.$layout = {
				sub:subui,
				root: app.config.container,
				index:0,
				add:true
			};
			webix.extend(app, webix.EventSystem);

			//show start page
			setTimeout(function(){
				app.start();
			},1);

			var title = document.getElementsByTagName("title")[0];
			if (title)
				title.innerHTML = app.config.name;

			
			var node = app.config.container;
			webix.html.addCss(node, "webixappstart");
			setTimeout(function(){
				webix.html.removeCss(node, "webixappstart");
				webix.html.addCss(node, "webixapp");
			}, 10);

			return app;
		},

		ui:create_temp_ui,


		//navigation
		router:function(name){
			var parts = parse_parts(name);
			app.path = [].concat(parts);

			webix.ui.$freeze = true;
			render_stack(app.$layout, parts);
		},
		show:function(name, options){
			routie.navigate("!"+name, options);
		},
		start:function(name){
			//init routing
			routie("!*",		app.router);

			if (!window.location.hash)
				app.show(app.config.start);
			 else {
				webix.ui.$freeze = false;
				webix.ui.resize();
 			}
 		},


		//plugins
		use:function(handler, config){
			if (handler.$oninit)
				handler.$oninit(this, (config || {}) );

			if (handler.$onurlchange)
				url_plugins.push(handler.$onurlchange);
			if (handler.$onurl)
				require_plugins.push(handler.$onurl);
			if (handler.$onui)
				ui_plugins.push(handler.$onui);
		},


		//event helpers
		trigger:function(name){
			app.apply(name, [].splice.call(arguments, 1));
		},
		apply:function(name, data){
			app.callEvent(name, data);
		},
		action:function(name){
			return function(){
				app.apply(name, arguments);
			};
		},
		on:function(name, handler){
			this.attachEvent(name, handler);
		},

		_uis:[],
		_handlers:[]
	};

	function create_temp_event(obj, name, code){
		var id = obj.attachEvent(name, code);
		this._handlers.push({ obj:obj, id:id });
		return id;
	}

	function create_temp_ui(module, container){
		var view;
		var temp = { _init:[], _destroy:[] };
		var ui = copy(module, null, temp);
			ui.$scope = this;

		if (ui.id)
			view = $$(ui.id);
			
		if (!view){
			view = webix.ui(ui, container);
			this._uis.push(view);
			run_handlers(temp._init, view, this);
		}

		return view;
	}

	function run_handlers(arr, view, scope){
		if (arr)
			for (var i = 0; i < arr.length; i++)
				arr[i](view, scope);
	}

	function destroy(){
		if (!this._ui) return;

		if (this.$layout)
			destroy.call(this.$layout);

		var handlers = this._handlers;
		for (var i = handlers.length - 1; i >= 0; i--)
			handlers[i].obj.detachEvent( handlers[i].id );
		this._handlers = [];

		var uis = this._uis;
		for (var i = uis.length - 1; i >= 0; i--)
			if (uis[i] && uis[i].destructor) uis[i].destructor();
		this._uis = [];

		run_handlers(this._destroy, this._ui, this);

		if (!this.parent && this._ui)
			this._ui.destructor();
	}


	function delete_ids(view){
		delete webix.ui.views[view.config.id];
		view.config.id = "";
		var childs = view.getChildViews();
		for (var i = childs.length - 1; i >= 0; i--)
			delete_ids(childs[i]);
	}
	function create(subview){
		this._uis=[];
		this._handlers=[];

		//naive solution for id dupplication
		if (this.root && this.root.config)
			delete_ids(this.root);

		this._ui = webix.ui(subview, this.root);
		if (this.parent)
			this.root = this._ui;

		run_handlers(this._init, this._ui, this);
	}

	function invalid_url(err){
		if (app.debug)
			console.log(err.stack);

		if (!err.requireModules) throw(err);
		if (app.debug)
			webix.message({ type:"error", expire:5000, text:"Can't load "+err.requireModules.join(", ") });

		app.show(app.config.start);
	}

	requirejs.onError = invalid_url;
	return app;
});
define('helpers/menu',[], function(){

	function select_menu(menu_id, id){
		var menu = $$(menu_id);
		if (menu.setValue)
			menu.setValue(id);
		else if (menu.select && menu.exists(id))
			menu.select(id);
	}

	function get_menu(scope){
		if (scope.parent)
			return scope.parent.module.$menu || get_menu(scope.parent);
	}

	return {
		$onurlchange:function(ui, name, url, scope){
			//menu handling
			if (ui.$menuid){
				var id = ui.$menuid.call ? ui.$menuid.call(ui, ui, name, url) : ui.$menuid;
				var menu = get_menu(scope);
				if (menu && id)
					select_menu(menu, id);
			}
		},

		$onui:function(ui, name, url, scope){
			//menu handling
			if (ui.$menu && url.length)
				select_menu(ui.$menu, url[0].page);
		}
	}
});
//     (c) 2012 Airbnb, Inc.
//
//     polyglot.js may be freely distributed under the terms of the BSD
//     license. For all licensing information, details, and documention:
//     http://airbnb.github.com/polyglot.js
//
//
// Polyglot.js is an I18n helper library written in JavaScript, made to
// work both in the browser and in Node. It provides a simple solution for
// interpolation and pluralization, based off of Airbnb's
// experience adding I18n functionality to its Backbone.js and Node apps.
//
// Polylglot is agnostic to your translation backend. It doesn't perform any
// translation; it simply gives you a way to manage translated phrases from
// your client- or server-side JavaScript application.
//

!function(root) {
  

  // ### Polyglot class constructor
  function Polyglot(options) {
    options = options || {};
    this.phrases = {};
    this.extend(options.phrases || {});
    this.currentLocale = options.locale || 'en';
    this.allowMissing = !!options.allowMissing;
    this.warn = options.warn || warn;
  }

  // ### Version
  Polyglot.VERSION = '0.4.1';

  // ### polyglot.locale([locale])
  //
  // Get or set locale. Internally, Polyglot only uses locale for pluralization.
  Polyglot.prototype.locale = function(newLocale) {
    if (newLocale) this.currentLocale = newLocale;
    return this.currentLocale;
  };

  // ### polyglot.extend(phrases)
  //
  // Use `extend` to tell Polyglot how to translate a given key.
  //
  //     polyglot.extend({
  //       "hello": "Hello",
  //       "hello_name": "Hello, %{name}"
  //     });
  //
  // The key can be any string.  Feel free to call `extend` multiple times;
  // it will override any phrases with the same key, but leave existing phrases
  // untouched.
  //
  // It is also possible to pass nested phrase objects, which get flattened
  // into an object with the nested keys concatenated using dot notation.
  //
  //     polyglot.extend({
  //       "nav": {
  //         "hello": "Hello",
  //         "hello_name": "Hello, %{name}",
  //         "sidebar": {
  //           "welcome": "Welcome"
  //         }
  //       }
  //     });
  //
  //     console.log(polyglot.phrases);
  //     // {
  //     //   'nav.hello': 'Hello',
  //     //   'nav.hello_name': 'Hello, %{name}',
  //     //   'nav.sidebar.welcome': 'Welcome'
  //     // }
  //
  // `extend` accepts an optional second argument, `prefix`, which can be used
  // to prefix every key in the phrases object with some string, using dot
  // notation.
  //
  //     polyglot.extend({
  //       "hello": "Hello",
  //       "hello_name": "Hello, %{name}"
  //     }, "nav");
  //
  //     console.log(polyglot.phrases);
  //     // {
  //     //   'nav.hello': 'Hello',
  //     //   'nav.hello_name': 'Hello, %{name}'
  //     // }
  //
  // This feature is used internally to support nested phrase objects.
  Polyglot.prototype.extend = function(morePhrases, prefix) {
    var phrase;

    for (var key in morePhrases) {
      if (morePhrases.hasOwnProperty(key)) {
        phrase = morePhrases[key];
        if (prefix) key = prefix + '.' + key;
        if (typeof phrase === 'object') {
          this.extend(phrase, key);
        } else {
          this.phrases[key] = phrase;
        }
      }
    }
  };

  // ### polyglot.clear()
  //
  // Clears all phrases. Useful for special cases, such as freeing
  // up memory if you have lots of phrases but no longer need to
  // perform any translation. Also used internally by `replace`.
  Polyglot.prototype.clear = function() {
    this.phrases = {};
  };

  // ### polyglot.replace(phrases)
  //
  // Completely replace the existing phrases with a new set of phrases.
  // Normally, just use `extend` to add more phrases, but under certain
  // circumstances, you may want to make sure no old phrases are lying around.
  Polyglot.prototype.replace = function(newPhrases) {
    this.clear();
    this.extend(newPhrases);
  };


  // ### polyglot.t(key, options)
  //
  // The most-used method. Provide a key, and `t` will return the
  // phrase.
  //
  //     polyglot.t("hello");
  //     => "Hello"
  //
  // The phrase value is provided first by a call to `polyglot.extend()` or
  // `polyglot.replace()`.
  //
  // Pass in an object as the second argument to perform interpolation.
  //
  //     polyglot.t("hello_name", {name: "Spike"});
  //     => "Hello, Spike"
  //
  // If you like, you can provide a default value in case the phrase is missing.
  // Use the special option key "_" to specify a default.
  //
  //     polyglot.t("i_like_to_write_in_language", {
  //       _: "I like to write in %{language}.",
  //       language: "JavaScript"
  //     });
  //     => "I like to write in JavaScript."
  //
  Polyglot.prototype.t = function(key, options) {
    var result;
    options = options == null ? {} : options;
    // allow number as a pluralization shortcut
    if (typeof options === 'number') {
      options = {smart_count: options};
    }
    var phrase = this.phrases[key] || options._ || (this.allowMissing ? key : '');
    if (phrase === '') {
      this.warn('Missing translation for key: "'+key+'"');
      result = key;
    } else {
      options = clone(options);
      result = choosePluralForm(phrase, this.currentLocale, options.smart_count);
      result = interpolate(result, options);
    }
    return result;
  };


  // #### Pluralization methods
  // The string that separates the different phrase possibilities.
  var delimeter = '||||';

  // Mapping from pluralization group plural logic.
  var pluralTypes = {
    chinese:   function(n) { return 0; },
    german:    function(n) { return n !== 1 ? 1 : 0; },
    french:    function(n) { return n > 1 ? 1 : 0; },
    russian:   function(n) { return n % 10 === 1 && n % 100 !== 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2; },
    czech:     function(n) { return (n === 1) ? 0 : (n >= 2 && n <= 4) ? 1 : 2; },
    polish:    function(n) { return (n === 1 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2); },
    icelandic: function(n) { return (n % 10 !== 1 || n % 100 === 11) ? 1 : 0; }
  };

  // Mapping from pluralization group to individual locales.
  var pluralTypeToLanguages = {
    chinese:   ['fa', 'id', 'ja', 'ko', 'lo', 'ms', 'th', 'tr', 'zh'],
    german:    ['da', 'de', 'en', 'es', 'fi', 'el', 'he', 'hu', 'it', 'nl', 'no', 'pt', 'sv'],
    french:    ['fr', 'tl', 'pt-br'],
    russian:   ['hr', 'ru', 'be'],
    czech:     ['cs'],
    polish:    ['pl'],
    icelandic: ['is']
  };

  function langToTypeMap(mapping) {
    var type, langs, l, ret = {};
    for (type in mapping) {
      if (mapping.hasOwnProperty(type)) {
        langs = mapping[type];
        for (l in langs) {
          ret[langs[l]] = type;
        }
      }
    }
    return ret;
  }

  // Trim a string.
  function trim(str){
    var trimRe = /^\s+|\s+$/g;
    return str.replace(trimRe, '');
  }

  // Based on a phrase text that contains `n` plural forms separated
  // by `delimeter`, a `locale`, and a `count`, choose the correct
  // plural form, or none if `count` is `null`.
  function choosePluralForm(text, locale, count){
    var ret, texts, chosenText;
    if (count != null && text) {
      texts = text.split(delimeter);
      chosenText = texts[pluralTypeIndex(locale, count)] || texts[0];
      ret = trim(chosenText);
    } else {
      ret = text;
    }
    return ret;
  }

  function pluralTypeName(locale) {
    var langToPluralType = langToTypeMap(pluralTypeToLanguages);
    return langToPluralType[locale] || langToPluralType.en;
  }

  function pluralTypeIndex(locale, count) {
    return pluralTypes[pluralTypeName(locale)](count);
  }

  // ### interpolate
  //
  // Does the dirty work. Creates a `RegExp` object for each
  // interpolation placeholder.
  function interpolate(phrase, options) {
    for (var arg in options) {
      if (arg !== '_' && options.hasOwnProperty(arg)) {
        // We create a new `RegExp` each time instead of using a more-efficient
        // string replace so that the same argument can be replaced multiple times
        // in the same phrase.
        phrase = phrase.replace(new RegExp('%\\{'+arg+'\\}', 'g'), options[arg]);
      }
    }
    return phrase;
  }

  // ### warn
  //
  // Provides a warning in the console if a phrase key is missing.
  function warn(message) {
    root.console && root.console.warn && root.console.warn('WARNING: ' + message);
  }

  // ### clone
  //
  // Clone an object.
  function clone(source) {
    var ret = {};
    for (var prop in source) {
      ret[prop] = source[prop];
    }
    return ret;
  }


  // Export for Node, attach to `window` for browser.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Polyglot;
  } else {
    root.Polyglot = Polyglot;
  }

}(this);

define("libs/polyglot", function(){});

define('models/user',[

],function(){

	// if you need not custom methods, just use
	// return webix.remote.users;

	//hardcode user
	webix.remote.$user = { id:1 };

	var current_user = webix.remote.$user || null;
	if (current_user)
		setCurrentUser(current_user);

	function setCurrentUser(value, afterlogin){
		//we need to reload document after login out
		if (!value){
			session.logout().then(function(){
				current_user = null;
				document.location.reload();	
			});
			return;
		}
		//we need to reload document when changing active user
		if (current_user && current_user != value){
			document.location.reload();
			return;
		}

		current_user = value;

		var isvalid = (current_user.settings && typeof current_user.settings == "string");
		current_user.settings = isvalid ? JSON.parse(current_user.settings) : {};

		webix.extend(current_user.settings,{
			language:"en",
			theme:"siberia:webix",
			notifications:0
		});

		require(["helpers/locale", "helpers/theme"], function(locale, theme){
			//if user has different theme after login - we need to reload page
			if (afterlogin){
				if (!locale.isNow(current_user.settings.language) ||
				    !theme.isNow(current_user.settings.theme))
				    	document.location.reload();
			}

			//call save to store values in the local store			
			locale.setLang(current_user.settings.language, afterlogin);
			theme.setTheme(current_user.settings.theme, afterlogin);
		});
	}

	function getCurrentUser(){
		return current_user;
	}

	function saveSetting(key, value, reload){
		if(current_user){
			var id = current_user.id,
				settings = current_user.settings;

			if(!settings[key] || value != settings[key]){
				if (reload)
					document.location.reload();
			}
		}
	}


	return {
		saveSetting:saveSetting,
		getCurrentUser:getCurrentUser,
		setCurrentUser:setCurrentUser,
	};

});
define('helpers/locale',[
	"libs/polyglot",
	"models/user"
], function(polyglot, users){

	var defaultlang = "en";
	var key = "--:app:lang";
	var current_lang = "";

	function _get_lang(){
		if(users.getCurrentUser())
			return users.getCurrentUser().settings.language;

		return webix.storage.local.get(key) || defaultlang;
	}
	function _set_lang(lang, init){
		webix.storage.local.put(key, lang);
		if (users.getCurrentUser())
			users.saveSetting("language", lang, lang != current_lang);
		else
			document.location.reload();
	}

	function create_locale(lang){
		current_lang = lang;
		define("locale", [
			"locales/"+lang
		], function(data){
			var poly = new Polyglot({ phrases:data });
				poly.locale(lang);

			var t = webix.bind(poly.t, poly);
			t.template = function(a){
				return a.replace(/%([a-zA-Z0-9.]+)%/g, function(_, match){
					return poly.t(match);
				});
			};
			return t;
		});
	}

	return {
		$oninit:function(app, config){
			key = (app.config.id || "")+key;

			var lang = _get_lang();
			create_locale(lang);
		},
		setLang: _set_lang,
		getLang: _get_lang,
		isNow:function(val){ return val == current_lang; }
	};
});
define('helpers/theme',[
	"models/user"
], function(users){

	var key = "--:app:theme";
	var current_theme = webix.storage.local.get(key) || "siberia:webix";

	function _get_theme(){
		if(users.getCurrentUser())
			return users.getCurrentUser().settings.theme;

		return current_theme;
	}

	function _set_theme(theme){
		webix.storage.local.put(key, theme);
		if(users.getCurrentUser())
			users.saveSetting("theme", theme, theme != current_theme);
		else
			document.location.reload();

		current_theme = theme;
	}

	return {
		setTheme: _set_theme,
		getTheme: _get_theme,
		isNow:function(val){ return val == current_theme; }
	};
});
define('libs/rollbar',['require','exports','module'],function(require,exports,module){function _isUndefined(a){return"undefined"==typeof a}function computeStackTraceWrapper(a){function b(a){if(!t)return"";try{var b=function(){try{return new window.XMLHttpRequest}catch(a){return new window.ActiveXObject("Microsoft.XMLHTTP")}},c=b();return c.open("GET",a,!1),c.send(""),c.responseText}catch(d){return""}}function c(a){if(!s.hasOwnProperty(a)){var c="";-1!==a.indexOf(document.domain)&&(c=b(a)),s[a]=c?c.split("\n"):[]}return s[a]}function d(a,b){var d,e=/function ([^(]*)\(([^)]*)\)/,f=/['"]?([0-9A-Za-z$_]+)['"]?\s*[:=]\s*(function|eval|new Function)/,g="",h=10,i=c(a);if(!i.length)return UNKNOWN_FUNCTION;for(var j=0;h>j;++j)if(g=i[b-j]+g,!_isUndefined(g)){if(d=f.exec(g))return d[1];if(d=e.exec(g))return d[1]}return UNKNOWN_FUNCTION}function e(a,b){var d=c(a);if(!d.length)return null;var e=[],f=Math.floor(u/2),g=f+u%2,h=Math.max(0,b-f-1),i=Math.min(d.length,b+g-1);b-=1;for(var j=h;i>j;++j)_isUndefined(d[j])||e.push(d[j]);return e.length>0?e:null}function f(a){return a.replace(/[\-\[\]{}()*+?.,\\\^$|#]/g,"\\$&")}function g(a){return f(a).replace("<","(?:<|&lt;)").replace(">","(?:>|&gt;)").replace("&","(?:&|&amp;)").replace('"','(?:"|&quot;)').replace(/\s+/g,"\\s+")}function h(a,b){for(var d,e,f=0,g=b.length;g>f;++f)if((d=c(b[f])).length&&(d=d.join("\n"),e=a.exec(d)))return{url:b[f],line:d.substring(0,e.index).split("\n").length,column:e.index-d.lastIndexOf("\n",e.index)-1};return null}function i(a,b,d){var e,g=c(b),h=new RegExp("\\b"+f(a)+"\\b");return d-=1,g&&g.length>d&&(e=h.exec(g[d]))?e.index:null}function j(a){for(var b,c,d,e,i=[window.location.href],j=document.getElementsByTagName("script"),k=""+a,l=/^function(?:\s+([\w$]+))?\s*\(([\w\s,]*)\)\s*\{\s*(\S[\s\S]*\S)\s*\}\s*$/,m=/^function on([\w$]+)\s*\(event\)\s*\{\s*(\S[\s\S]*\S)\s*\}\s*$/,n=0;n<j.length;++n){var o=j[n];o.src&&i.push(o.src)}if(d=l.exec(k)){var p=d[1]?"\\s+"+d[1]:"",q=d[2].split(",").join("\\s*,\\s*");b=f(d[3]).replace(/;$/,";?"),c=new RegExp("function"+p+"\\s*\\(\\s*"+q+"\\s*\\)\\s*{\\s*"+b+"\\s*}")}else c=new RegExp(f(k).replace(/\s+/g,"\\s+"));if(e=h(c,i))return e;if(d=m.exec(k)){var r=d[1];if(b=g(d[2]),c=new RegExp("on"+r+"=[\\'\"]\\s*"+b+"\\s*[\\'\"]","i"),e=h(c,i[0]))return e;if(c=new RegExp(b),e=h(c,i))return e}return null}function k(a){if(!a.stack)return null;for(var b,c,f=/^\s*at (?:((?:\[object object\])?\S+(?: \[as \S+\])?) )?\(?((?:file|http|https):.*?):(\d+)(?::(\d+))?\)?\s*$/i,g=/^\s*(\S*)(?:\((.*?)\))?@((?:file|http|https).*?):(\d+)(?::(\d+))?\s*$/i,h=a.stack.split("\n"),j=[],k=/^(.*) is undefined$/.exec(a.message),l=0,m=h.length;m>l;++l){if(b=g.exec(h[l]))c={url:b[3],func:b[1]||UNKNOWN_FUNCTION,args:b[2]?b[2].split(","):"",line:+b[4],column:b[5]?+b[5]:null};else{if(!(b=f.exec(h[l])))continue;c={url:b[2],func:b[1]||UNKNOWN_FUNCTION,line:+b[3],column:b[4]?+b[4]:null}}!c.func&&c.line&&(c.func=d(c.url,c.line)),c.line&&(c.context=e(c.url,c.line)),j.push(c)}return j[0]&&j[0].line&&!j[0].column&&k&&(j[0].column=i(k[1],j[0].url,j[0].line)),j.length?{mode:"stack",name:a.name,message:a.message,url:document.location.href,stack:j,useragent:navigator.userAgent}:null}function l(a){for(var b,c=a.stacktrace,f=/ line (\d+), column (\d+) in (?:<anonymous function: ([^>]+)>|([^\)]+))\((.*)\) in (.*):\s*$/i,g=c.split("\n"),h=[],i=0,j=g.length;j>i;i+=2)if(b=f.exec(g[i])){var k={line:+b[1],column:+b[2],func:b[3]||b[4],args:b[5]?b[5].split(","):[],url:b[6]};if(!k.func&&k.line&&(k.func=d(k.url,k.line)),k.line)try{k.context=e(k.url,k.line)}catch(l){}k.context||(k.context=[g[i+1]]),h.push(k)}return h.length?{mode:"stacktrace",name:a.name,message:a.message,url:document.location.href,stack:h,useragent:navigator.userAgent}:null}function m(a){var b=a.message.split("\n");if(b.length<4)return null;var f,i,j,k,l=/^\s*Line (\d+) of linked script ((?:file|http|https)\S+)(?:: in function (\S+))?\s*$/i,m=/^\s*Line (\d+) of inline#(\d+) script in ((?:file|http|https)\S+)(?:: in function (\S+))?\s*$/i,n=/^\s*Line (\d+) of function script\s*$/i,o=[],p=document.getElementsByTagName("script"),q=[];for(i in p)p.hasOwnProperty(i)&&!p[i].src&&q.push(p[i]);for(i=2,j=b.length;j>i;i+=2){var r=null;if(f=l.exec(b[i]))r={url:f[2],func:f[3],line:+f[1]};else if(f=m.exec(b[i])){r={url:f[3],func:f[4]};var s=+f[1],t=q[f[2]-1];if(t&&(k=c(r.url))){k=k.join("\n");var u=k.indexOf(t.innerText);u>=0&&(r.line=s+k.substring(0,u).split("\n").length)}}else if(f=n.exec(b[i])){var v=window.location.href.replace(/#.*$/,""),w=f[1],x=new RegExp(g(b[i+1]));k=h(x,[v]),r={url:v,line:k?k.line:w,func:""}}if(r){r.func||(r.func=d(r.url,r.line));var y=e(r.url,r.line),z=y?y[Math.floor(y.length/2)]:null;r.context=y&&z.replace(/^\s*/,"")===b[i+1].replace(/^\s*/,"")?y:[b[i+1]],o.push(r)}}return o.length?{mode:"multiline",name:a.name,message:b[0],url:document.location.href,stack:o,useragent:navigator.userAgent}:null}function n(a,b,c,f){var g={url:b,line:c};if(g.url&&g.line){a.incomplete=!1,g.func||(g.func=d(g.url,g.line)),g.context||(g.context=e(g.url,g.line));var h=/ '([^']+)' /.exec(f);if(h&&(g.column=i(h[1],g.url,g.line)),a.stack.length>0&&a.stack[0].url===g.url){if(a.stack[0].line===g.line)return!1;if(!a.stack[0].line&&a.stack[0].func===g.func)return a.stack[0].line=g.line,a.stack[0].context=g.context,!1}return a.stack.unshift(g),a.partial=!0,!0}return a.incomplete=!0,!1}function o(a,b){for(var c,e,f,g=/function\s+([_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*)?\s*\(/i,h=[],k={},l=!1,m=o.caller;m&&!l;m=m.caller)if(m!==p&&m!==v){if(e={url:null,func:UNKNOWN_FUNCTION,line:null,column:null},m.name?e.func=m.name:(c=g.exec(m.toString()))&&(e.func=c[1]),f=j(m)){e.url=f.url,e.line=f.line,e.func===UNKNOWN_FUNCTION&&(e.func=d(e.url,e.line));var q=/ '([^']+)' /.exec(a.message||a.description);q&&(e.column=i(q[1],f.url,f.line))}k[""+m]?l=!0:k[""+m]=!0,h.push(e)}b&&h.splice(0,b);var r={mode:"callers",name:a.name,message:a.message,url:document.location.href,stack:h,useragent:navigator.userAgent};return n(r,a.sourceURL||a.fileName,a.line||a.lineNumber,a.message||a.description),r}function p(a,b){var c=null;b=null==b?0:+b;try{if(c=l(a))return c}catch(d){if(r)throw d}try{if(c=k(a))return c}catch(d){if(r)throw d}try{if(c=m(a))return c}catch(d){if(r)throw d}try{if(c=o(a,b+1))return c}catch(d){if(r)throw d}return{mode:"failed"}}function q(a){a=(null==a?0:+a)+1;try{throw new Error}catch(b){return p(b,a+1)}}var r=!1,s={},t=a.remoteFetching,u=a.linesOfContext,v=a.tracekitReport;return p.augmentStackTraceWithInitialElement=n,p.guessFunctionName=d,p.gatherContext=e,p.ofCaller=q,p}function Notifier(a){_topLevelNotifier=_topLevelNotifier||this;var b=window.location.protocol;0!==b.indexOf("http")&&(b="https:");var c=b+"//"+Notifier.DEFAULT_ENDPOINT;this.options={enabled:!0,endpoint:c,environment:"production",scrubFields:Util.copy(Notifier.DEFAULT_SCRUB_FIELDS),checkIgnore:null,logLevel:Notifier.DEFAULT_LOG_LEVEL,reportLevel:Notifier.DEFAULT_REPORT_LEVEL,uncaughtErrorLevel:Notifier.DEFAULT_UNCAUGHT_ERROR_LEVEL,payload:{}},this.lastError=null,this.plugins={},this.parentNotifier=a,this.logger=function(){if(window.console&&"function"==typeof window.console.log){var a=["Rollbar:"].concat(Array.prototype.slice.call(arguments,0));window.console.log(a)}},a&&(a.hasOwnProperty("shimId")?a.notifier=this:(this.logger=a.logger,this.configure(a.options)))}function _wrapNotifierFn(a,b){return function(){var c=b||this;try{return a.apply(c,arguments)}catch(d){c&&c.logger(d)}}}function _guessErrorClass(a){if(!a)return["Unknown error. There was no error message to display.",""];var b=a.match(ERR_CLASS_REGEXP),c="(unknown)";return b&&(c=b[b.length-1],a=a.replace((b[b.length-2]||"")+c+":",""),a=a.replace(/(^[\s]+|[\s]+$)/g,"")),[c,a]}function _payloadProcessorTimer(a){for(var b;b=window._rollbarPayloadQueue.shift();)_processPayload(b.endpointUrl,b.accessToken,b.payload,b.callback);a||(payloadProcessorTimeout=setTimeout(_payloadProcessorTimer,1e3))}function _processPayload(a,b,c,d){d=d||function(){};var e=(new Date).getTime();e-rateLimitStartTime>=6e4&&(rateLimitStartTime=e,rateLimitPerMinCounter=0);var f=window._globalRollbarOptions.maxItems,g=window._globalRollbarOptions.itemsPerMinute,h=function(){return!c.ignoreRateLimit&&f>=1&&rateLimitCounter>=f},i=function(){return!c.ignoreRateLimit&&g>=1&&rateLimitPerMinCounter>=g};return h()?(d(new Error(f+" max items reached")),void 0):i()?(d(new Error(g+" items per minute reached")),void 0):(rateLimitCounter++,rateLimitPerMinCounter++,h()&&_topLevelNotifier._log(_topLevelNotifier.options.uncaughtErrorLevel,"maxItems has been hit. Ignoring errors for the remainder of the current page load.",null,{maxItems:f},null,!1,!0),c.ignoreRateLimit&&delete c.ignoreRateLimit,XHR.post(a,b,c,function(a,b){return a?d(a):d(null,b)}),void 0)}function _rollbarWindowOnError(a,b,c){!c[4]&&window._rollbarWrappedError&&(c[4]=window._rollbarWrappedError,window._rollbarWrappedError=null),globalNotifier.uncaughtError.apply(globalNotifier,c),b&&b.apply(window,c)}function _extendListenerPrototype(a,b){if(b.hasOwnProperty&&b.hasOwnProperty("addEventListener")){var c=b.addEventListener;b.addEventListener=function(b,d,e){c.call(this,b,a.wrap(d),e)};var d=b.removeEventListener;b.removeEventListener=function(a,b,c){d.call(this,a,b._wrapped||b,c)}}}var setupCustomJSON=function(JSON){function f(a){return 10>a?"0"+a:a}function quote(a){return escapable.lastIndex=0,escapable.test(a)?'"'+a.replace(escapable,function(a){var b=meta[a];return"string"==typeof b?b:"\\u"+("0000"+a.charCodeAt(0).toString(16)).slice(-4)})+'"':'"'+a+'"'}function str(a,b){var c,d,e,f,g,h=gap,i=b[a];switch(i&&"object"==typeof i&&"function"==typeof i.toJSON&&(i=i.toJSON(a)),"function"==typeof rep&&(i=rep.call(b,a,i)),typeof i){case"string":return quote(i);case"number":return isFinite(i)?String(i):"null";case"boolean":case"null":return String(i);case"object":if(!i)return"null";if(gap+=indent,g=[],"[object Array]"===Object.prototype.toString.apply(i)){for(f=i.length,c=0;f>c;c+=1)g[c]=str(c,i)||"null";return e=0===g.length?"[]":gap?"[\n"+gap+g.join(",\n"+gap)+"\n"+h+"]":"["+g.join(",")+"]",gap=h,e}if(rep&&"object"==typeof rep)for(f=rep.length,c=0;f>c;c+=1)"string"==typeof rep[c]&&(d=rep[c],e=str(d,i),e&&g.push(quote(d)+(gap?": ":":")+e));else for(d in i)Object.prototype.hasOwnProperty.call(i,d)&&(e=str(d,i),e&&g.push(quote(d)+(gap?": ":":")+e));return e=0===g.length?"{}":gap?"{\n"+gap+g.join(",\n"+gap)+"\n"+h+"}":"{"+g.join(",")+"}",gap=h,e}}"function"!=typeof Date.prototype.toJSON&&(Date.prototype.toJSON=function(){return isFinite(this.valueOf())?this.getUTCFullYear()+"-"+f(this.getUTCMonth()+1)+"-"+f(this.getUTCDate())+"T"+f(this.getUTCHours())+":"+f(this.getUTCMinutes())+":"+f(this.getUTCSeconds())+"Z":null},String.prototype.toJSON=Number.prototype.toJSON=Boolean.prototype.toJSON=function(){return this.valueOf()});var cx=/[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,escapable=/[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,gap,indent,meta={"\b":"\\b","	":"\\t","\n":"\\n","\f":"\\f","\r":"\\r",'"':'\\"',"\\":"\\\\"},rep;"function"!=typeof JSON.stringify&&(JSON.stringify=function(a,b,c){var d;if(gap="",indent="","number"==typeof c)for(d=0;c>d;d+=1)indent+=" ";else"string"==typeof c&&(indent=c);if(rep=b,b&&"function"!=typeof b&&("object"!=typeof b||"number"!=typeof b.length))throw new Error("JSON.stringify");return str("",{"":a})}),"function"!=typeof JSON.parse&&(JSON.parse=function(text,reviver){function walk(a,b){var c,d,e=a[b];if(e&&"object"==typeof e)for(c in e)Object.prototype.hasOwnProperty.call(e,c)&&(d=walk(e,c),void 0!==d?e[c]=d:delete e[c]);return reviver.call(a,b,e)}var j;if(text=String(text),cx.lastIndex=0,cx.test(text)&&(text=text.replace(cx,function(a){return"\\u"+("0000"+a.charCodeAt(0).toString(16)).slice(-4)})),/^[\],:{}\s]*$/.test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g,"@").replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,"]").replace(/(?:^|:|,)(?:\s*\[)+/g,"")))return j=eval("("+text+")"),"function"==typeof reviver?walk({"":j},""):j;throw new SyntaxError("JSON.parse")})},UNKNOWN_FUNCTION="?",Util={merge:function(){var a,b,c,d,e,f,g=arguments[0]||{},h=1,i=arguments.length,j=!0;for("object"!=typeof g&&"function"!=typeof g&&(g={});i>h;h++)if(null!==(a=arguments[h]))for(b in a)a.hasOwnProperty(b)&&(c=g[b],d=a[b],g!==d&&(j&&d&&(d.constructor==Object||(e=d.constructor==Array))?(e?(e=!1,f=[]):f=c&&c.constructor==Object?c:{},g[b]=Util.merge(f,d)):void 0!==d&&(g[b]=d)));return g},copy:function(a){var b;return"object"==typeof a&&(a.constructor==Object?b={}:a.constructor==Array&&(b=[])),Util.merge(b,a),b},parseUriOptions:{strictMode:!1,key:["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],q:{name:"queryKey",parser:/(?:^|&)([^&=]*)=?([^&]*)/g},parser:{strict:/^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,loose:/^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/}},parseUri:function(a){if(!a||"string"!=typeof a&&!(a instanceof String))throw new Error("Util.parseUri() received invalid input");for(var b=Util.parseUriOptions,c=b.parser[b.strictMode?"strict":"loose"].exec(a),d={},e=14;e--;)d[b.key[e]]=c[e]||"";return d[b.q.name]={},d[b.key[12]].replace(b.q.parser,function(a,c,e){c&&(d[b.q.name][c]=e)}),d},sanitizeUrl:function(a){if(!a||"string"!=typeof a&&!(a instanceof String))throw new Error("Util.sanitizeUrl() received invalid input");var b=Util.parseUri(a);return""===b.anchor&&(b.source=b.source.replace("#","")),a=b.source.replace("?"+b.query,"")},traverse:function(a,b){var c,d,e,f="object"==typeof a,g=[];if(f)if(a.constructor===Object)for(c in a)a.hasOwnProperty(c)&&g.push(c);else if(a.constructor===Array)for(e=0;e<a.length;++e)g.push(e);for(e=0;e<g.length;++e)c=g[e],d=a[c],f="object"==typeof d,a[c]=f?null===d?b(c,d):d.constructor===Object?Util.traverse(d,b):d.constructor===Array?Util.traverse(d,b):b(c,d):b(c,d);return a},redact:function(a){return a=String(a),new Array(a.length+1).join("*")},uuid4:function(){var a=(new Date).getTime(),b="xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(b){var c=(a+16*Math.random())%16|0;return a=Math.floor(a/16),("x"==b?c:7&c|8).toString(16)});return b}},RollbarJSON={};setupCustomJSON(RollbarJSON);var XHR={XMLHttpFactories:[function(){return new XMLHttpRequest},function(){return new ActiveXObject("Msxml2.XMLHTTP")},function(){return new ActiveXObject("Msxml3.XMLHTTP")},function(){return new ActiveXObject("Microsoft.XMLHTTP")}],createXMLHTTPObject:function(){var a,b=!1,c=XHR.XMLHttpFactories,d=c.length;for(a=0;d>a;a++)try{b=c[a]();break}catch(e){}return b},post:function(a,b,c,d){if("object"!=typeof c)throw new Error("Expected an object to POST");c=RollbarJSON.stringify(c),d=d||function(){};var e=XHR.createXMLHTTPObject();if(e)try{try{var f=function(){try{f&&4===e.readyState&&(f=void 0,200===e.status?d(null,RollbarJSON.parse(e.responseText)):"number"==typeof e.status&&e.status>=400&&e.status<600?d(new Error(e.status.toString())):d(new Error))}catch(a){var b;b="object"==typeof a&&a.stack?a:new Error(a),d(b)}};e.open("POST",a,!0),e.setRequestHeader&&(e.setRequestHeader("Content-Type","application/json"),e.setRequestHeader("X-Rollbar-Access-Token",b)),e.onreadystatechange=f,e.send(c)}catch(g){if("undefined"!=typeof XDomainRequest){var h=function(){d(new Error)},i=function(){d(new Error)},j=function(){d(null,RollbarJSON.parse(e.responseText))};e=new XDomainRequest,e.onprogress=function(){},e.ontimeout=h,e.onerror=i,e.onload=j,e.open("POST",a,!0),e.send(c)}}}catch(k){d(k)}}};Notifier.NOTIFIER_VERSION="1.1.9",Notifier.DEFAULT_ENDPOINT="api.rollbar.com/api/1/",Notifier.DEFAULT_SCRUB_FIELDS=["passwd","password","secret","confirm_password","password_confirmation"],Notifier.DEFAULT_LOG_LEVEL="debug",Notifier.DEFAULT_REPORT_LEVEL="debug",Notifier.DEFAULT_UNCAUGHT_ERROR_LEVEL="warning",Notifier.DEFAULT_ITEMS_PER_MIN=60,Notifier.DEFAULT_MAX_ITEMS=0,Notifier.LEVELS={debug:0,info:1,warning:2,error:3,critical:4},window._rollbarPayloadQueue=[],window._globalRollbarOptions={startTime:(new Date).getTime(),maxItems:Notifier.DEFAULT_MAX_ITEMS,itemsPerMinute:Notifier.DEFAULT_ITEMS_PER_MIN};var TK=computeStackTraceWrapper({remoteFetching:!1,linesOfContext:3}),_topLevelNotifier;Notifier._generateLogFn=function(a){return _wrapNotifierFn(function(){var b=this._getLogArgs(arguments);return this._log(a||b.level||this.options.logLevel||Notifier.DEFAULT_LOG_LEVEL,b.message,b.err,b.custom,b.callback)})},Notifier.prototype._getLogArgs=function(a){for(var b,c,d,e,f,g,h,i=this.options.logLevel||Notifier.DEFAULT_LOG_LEVEL,j=0;j<a.length;++j)h=a[j],g=typeof h,"string"===g?c=h:"function"===g?f=_wrapNotifierFn(h,this):h&&"object"===g&&("Date"===h.constructor.name?b=h:h instanceof Error||h.prototype===Error.prototype||h.hasOwnProperty("stack")?d=h:e=h);return{level:i,message:c,err:d,custom:e,callback:f}},Notifier.prototype._route=function(a){var b=this.options.endpoint,c=/\/$/.test(b),d=/^\//.test(a);return c&&d?a=a.substring(1):c||d||(a="/"+a),b+a},Notifier.prototype._processShimQueue=function(a){for(var b,c,d,e,f,g,h,i={};c=a.shift();)b=c.shim,d=c.method,e=c.args,f=b.parentShim,h=i[b.shimId],h||(f?(g=i[f.shimId],h=new Notifier(g)):h=this,i[b.shimId]=h),h[d]&&"function"==typeof h[d]&&h[d].apply(h,e)},Notifier.prototype._buildPayload=function(a,b,c,d,e){var f=this.options.accessToken,g=this.options.environment,h=Util.copy(this.options.payload),i=Util.uuid4();if(void 0===Notifier.LEVELS[b])throw new Error("Invalid level");if(!c&&!d&&!e)throw new Error("No message, stack info or custom data");var j={environment:g,endpoint:this.options.endpoint,uuid:i,level:b,platform:"browser",framework:"browser-js",language:"javascript",body:this._buildBody(c,d,e),request:{url:window.location.href,query_string:window.location.search,user_ip:"$remote_ip"},client:{runtime_ms:a.getTime()-window._globalRollbarOptions.startTime,timestamp:Math.round(a.getTime()/1e3),javascript:{browser:window.navigator.userAgent,language:window.navigator.language,cookie_enabled:window.navigator.cookieEnabled,screen:{width:window.screen.width,height:window.screen.height},plugins:this._getBrowserPlugins()}},server:{},notifier:{name:"rollbar-browser-js",version:Notifier.NOTIFIER_VERSION}};h.body&&delete h.body;var k={access_token:f,data:Util.merge(j,h)};return this._scrub(k.data),k},Notifier.prototype._buildBody=function(a,b,c){var d;return d=b&&"failed"!==b.mode?this._buildPayloadBodyTrace(a,b,c):this._buildPayloadBodyMessage(a,c)},Notifier.prototype._buildPayloadBodyMessage=function(a,b){a||(a=b?RollbarJSON.stringify(b):"");var c={body:a};return b&&(c.extra=Util.copy(b)),{message:c}},Notifier.prototype._buildPayloadBodyTrace=function(a,b,c){var d=_guessErrorClass(b.message),e=b.name||d[0],f=d[1],g={exception:{"class":e,message:f}};if(a&&(g.exception.description=a||"uncaught exception"),b.stack){var h,i,j,k,l,m,n,o;for(g.frames=[],n=0;n<b.stack.length;++n)h=b.stack[n],i={filename:h.url?Util.sanitizeUrl(h.url):"(unknown)",lineno:h.line||null,method:h.func&&"?"!==h.func?h.func:"[anonymous]",colno:h.column},j=k=l=null,m=h.context?h.context.length:0,m&&(o=Math.floor(m/2),k=h.context.slice(0,o),j=h.context[o],l=h.context.slice(o)),j&&(i.code=j),(k||l)&&(i.context={},k&&k.length&&(i.context.pre=k),l&&l.length&&(i.context.post=l)),h.args&&(i.args=h.args),g.frames.push(i);return c&&(g.extra=Util.copy(c)),{trace:g}}return this._buildPayloadBodyMessage(e+": "+f,c)},Notifier.prototype._getBrowserPlugins=function(){if(!this._browserPlugins){var a,b,c=window.navigator.plugins||[],d=c.length,e=[];for(b=0;d>b;++b)a=c[b],e.push({name:a.name,description:a.description});this._browserPlugins=e}return this._browserPlugins},Notifier.prototype._scrub=function(a){function b(a,b,c,d,e,f){return b+Util.redact(f)}function c(a){var c;if("string"==typeof a)for(c=0;c<h.length;++c)a=a.replace(h[c],b);return a}function d(a,b){var c;for(c=0;c<g.length;++c)if(g[c].test(a)){b=Util.redact(b);break}return b}function e(a,b){var e=d(a,b);return e===b?c(e):e}var f=this.options.scrubFields,g=this._getScrubFieldRegexs(f),h=this._getScrubQueryParamRegexs(f);return Util.traverse(a,e),a},Notifier.prototype._getScrubFieldRegexs=function(a){for(var b,c=[],d=0;d<a.length;++d)b="\\[?(%5[bB])?"+a[d]+"\\[?(%5[bB])?\\]?(%5[dD])?",c.push(new RegExp(b,"i"));return c},Notifier.prototype._getScrubQueryParamRegexs=function(a){for(var b,c=[],d=0;d<a.length;++d)b="\\[?(%5[bB])?"+a[d]+"\\[?(%5[bB])?\\]?(%5[dD])?",c.push(new RegExp("("+b+"=)([^&\\n]+)","igm"));return c},Notifier.prototype._urlIsWhitelisted=function(a){var b,c,d,e,f,g,h,i,j,k;try{if(b=this.options.hostWhiteList,c=a.data.body.trace,!b||0===b.length)return!0;if(!c)return!0;for(h=b.length,f=c.frames.length,j=0;f>j;j++){if(d=c.frames[j],e=d.filename,"string"!=typeof e)return!0;for(k=0;h>k;k++)if(g=b[k],i=new RegExp(g),i.test(e))return!0}}catch(l){return this.configure({hostWhiteList:null}),this.error("Error while reading your configuration's hostWhiteList option. Removing custom hostWhiteList.",l),!0}return!1},Notifier.prototype._messageIsIgnored=function(a){var b,c,d,e,f,g,h;try{if(f=!1,d=this.options.ignoredMessages,h=a.data.body.trace,!d||0===d.length)return!1;if(!h)return!1;for(b=h.exception.message,e=d.length,c=0;e>c&&(g=new RegExp(d[c],"gi"),!(f=g.test(b)));c++);}catch(i){this.configure({ignoredMessages:null}),this.error("Error while reading your configuration's ignoredMessages option. Removing custom ignoredMessages.")}return f},Notifier.prototype._enqueuePayload=function(a,b,c,d){var e={callback:d,accessToken:this.options.accessToken,endpointUrl:this._route("item/"),payload:a},f=function(){if(d){var a="This item was not sent to Rollbar because it was ignored. This can happen if a custom checkIgnore() function was used or if the item's level was less than the notifier' reportLevel. See https://rollbar.com/docs/notifier/rollbar.js/configuration for more details.";d(null,{err:0,result:{id:null,uuid:null,message:a}})}};if(this._internalCheckIgnore(b,c,a))return f(),void 0;try{if(this.options.checkIgnore&&"function"==typeof this.options.checkIgnore&&this.options.checkIgnore(b,c,a))return f(),void 0}catch(g){this.configure({checkIgnore:null}),this.error("Error while calling custom checkIgnore() function. Removing custom checkIgnore().",g)}if(this._urlIsWhitelisted(a)&&!this._messageIsIgnored(a)){if(this.options.verbose){if(a.data&&a.data.body&&a.data.body.trace){var h=a.data.body.trace,i=h.exception.message;this.logger(i)}this.logger("Sending payload -",e)}"function"==typeof this.options.logFunction&&this.options.logFunction(e);try{"function"==typeof this.options.transform&&this.options.transform(a)}catch(g){this.configure({transform:null}),this.error("Error while calling custom transform() function. Removing custom transform().",g)}this.options.enabled&&window._rollbarPayloadQueue.push(e)}},Notifier.prototype._internalCheckIgnore=function(a,b,c){var d=b[0],e=Notifier.LEVELS[d]||0,f=Notifier.LEVELS[this.options.reportLevel]||0;if(f>e)return!0;var g=this.options?this.options.plugins:{};return g&&g.jquery&&g.jquery.ignoreAjaxErrors&&c.body.message?c.body.messagejquery_ajax_error:!1},Notifier.prototype._log=function(a,b,c,d,e,f,g){var h=null;if(c){if(h=c._tkStackTrace?c._tkStackTrace:TK(c),c===this.lastError)return;this.lastError=c}var i=this._buildPayload(new Date,a,b,h,d);g&&(i.ignoreRateLimit=!0),this._enqueuePayload(i,f?!0:!1,[a,b,c,d],e)},Notifier.prototype.log=Notifier._generateLogFn(),Notifier.prototype.debug=Notifier._generateLogFn("debug"),Notifier.prototype.info=Notifier._generateLogFn("info"),Notifier.prototype.warn=Notifier._generateLogFn("warning"),Notifier.prototype.warning=Notifier._generateLogFn("warning"),Notifier.prototype.error=Notifier._generateLogFn("error"),Notifier.prototype.critical=Notifier._generateLogFn("critical"),Notifier.prototype.uncaughtError=_wrapNotifierFn(function(a,b,c,d,e,f){if(f=f||null,e&&e.stack)return this._log(this.options.uncaughtErrorLevel,a,e,f,null,!0),void 0;if(b&&b.stack)return this._log(this.options.uncaughtErrorLevel,a,b,f,null,!0),void 0;var g={url:b||"",line:c};g.func=TK.guessFunctionName(g.url,g.line),g.context=TK.gatherContext(g.url,g.line);var h={mode:"onerror",message:a||"uncaught exception",url:document.location.href,stack:[g],useragent:navigator.userAgent};e&&(h=e._tkStackTrace||TK(e));var i=this._buildPayload(new Date,this.options.uncaughtErrorLevel,a,h);this._enqueuePayload(i,!0,[this.options.uncaughtErrorLevel,a,b,c,d,e])}),Notifier.prototype.global=_wrapNotifierFn(function(a){a=a||{},Util.merge(window._globalRollbarOptions,a),void 0!==a.maxItems&&(rateLimitCounter=0),void 0!==a.itemsPerMinute&&(rateLimitPerMinCounter=0)}),Notifier.prototype.configure=_wrapNotifierFn(function(a){Util.merge(this.options,a)}),Notifier.prototype.scope=_wrapNotifierFn(function(a){var b=new Notifier(this);return Util.merge(b.options.payload,a),b}),Notifier.prototype.wrap=function(a,b){var c;if(c="function"==typeof b?b:function(){return b||{}},"function"!=typeof a)return a;if(a._isWrap)return a;if(!a._wrapped){a._wrapped=function(){try{a.apply(this,arguments)}catch(b){throw b.stack||(b._tkStackTrace=TK(b)),b._rollbarContext=c(),b._rollbarContext._wrappedSource=a.toString(),window._rollbarWrappedError=b,b}},a._wrapped._isWrap=!0;for(var d in a)a.hasOwnProperty(d)&&(a._wrapped[d]=a[d])}return a._wrapped};var ERR_CLASS_REGEXP=new RegExp("^(([a-zA-Z0-9-_$ ]*): *)?(Uncaught )?([a-zA-Z0-9-_$ ]*): "),payloadProcessorTimeout;Notifier.processPayloads=function(a){(!payloadProcessorTimeout||a)&&_payloadProcessorTimer(a)};var rateLimitStartTime=(new Date).getTime(),rateLimitCounter=0,rateLimitPerMinCounter=0,globalNotifier=new Notifier;window._rollbarWrappedError=null,globalNotifier.init=function(a){if(this.configure(a),a.captureUncaught){var b=window.onerror;window.onerror=function(){var a=Array.prototype.slice.call(arguments,0);_rollbarWindowOnError(globalNotifier,b,a)};var c,d,e=["EventTarget","Window","Node","ApplicationCache","AudioTrackList","ChannelMergerNode","CryptoOperation","EventSource","FileReader","HTMLUnknownElement","IDBDatabase","IDBRequest","IDBTransaction","KeyOperation","MediaController","MessagePort","ModalWindow","Notification","SVGElementInstance","Screen","TextTrack","TextTrackCue","TextTrackList","WebSocket","WebSocketWorker","Worker","XMLHttpRequest","XMLHttpRequestEventTarget","XMLHttpRequestUpload"];for(c=0;c<e.length;++c)d=e[c],window[d]&&window[d].prototype&&_extendListenerPrototype(this,window[d].prototype)}Notifier.processPayloads()},module.exports=globalNotifier});
/*
	App configuration
*/

define('app',[
	"libs/core",
	"helpers/menu",
	"helpers/locale",
	"helpers/theme",
	"libs/rollbar"
], function(core, menu, locale, theme, tracker){


	//webix.codebase = "libs/webix/";
	//CKEditor requires full path
	webix.codebase = document.location.href.split("#")[0].replace("index.html","")+"libs/webix/";

	if(!webix.env.touch && webix.ui.scrollSize && webix.CustomScroll)
		webix.CustomScroll.init();


	if (webix.production)
		tracker.init({
			accessToken: '650b007d5d794bb68d056584451a57a8',
			captureUncaught: true,
			source_map_enabled: true,
			code_version:"0.8.0",
			payload: {
				environment: 'production'
			}
		});

	//configuration
	var app = core.create({
		id:			"admin-demo",
		name:		"Webix Admin",
		version:	"0.1",
		debug:		true,
		start:		"/app/dashboard"		
	});

	app.use(menu);
	app.use(locale);
	app.use(theme);

	return app;
});
define('views/menus/search',[],function(){

return {
	$ui:{
		view: "popup",
		id: "searchPopup",

		width: 300,
		body:{
			rows:[
				{
					view: "search"
				},
				{
					borderless:true, css: "extended_search", template: "<span>Extended search</span>", height: 40
				}
			]

		}
	}
};

});
define('views/menus/mail',[],function(){

return { 
	$ui:{
		view: "popup",
		id: "mailPopup",
		width: 300,
		padding:0,
		css:"list_popup",
		body:{
			type: "clean",
			borderless:true,
			rows:[
				{
					view: "list",
					autoheight: true,
					data: [
						{id: 1, name: "Sofia Lee", text: "Lorem ipsum dolor sit amet.", personId:2},
						{id: 2, name: "Jeremy O'Neal", text: "Morbi eget facilisis risus.", personId:1},
						{id: 3, name: "Paul Jackson", text: "Cras lacinia bibendum arcu.", personId:1}
					],
					type:{
						height: 45,
						template: "<img class='photo' src='assets/imgs/photos/#personId#.png' /><span class='text'>#text#</span><span class='name'>#name#</span>"

					}
				},
				{
					css: "show_all", template: "Show all emails <span class='webix_icon fa-angle-double-right'></span>", height: 40
				}
			]

		}
	}
};

});
define('views/menus/message',[],function(){

return {
	$ui:{
		view: "popup",
		id: "messagePopup",
		width: 300,
		padding:0,
		css:"list_popup",
		body:{
			type: "clean",
			borderless:true,
			rows:[
				{
					view: "list",
					autoheight: true,
					data: [
						{id: 1, name: "Mario Douglas", text: "Lorem ipsum dolor sit amet", personId:1},
						{id: 2, name: "Sofia Lee", text: "Praesent luctus nulla enim, pellentesque condimentum ", personId:2},
						{id: 3, name: "Kim Alley", text: "Lorem ipsum dolor sit amet", personId:2},
						{id: 4, name: "Jeremy O'Neal", text: "Morbi eget facilisis risus", personId:1},
						{id: 5, name: "Paul Jackson", text: "Cras lacinia bibendum arcu", personId:1}
					],
					type:{
						height: 45,
						template: "	<img class='photo' src='assets/imgs/photos/#personId#.png' /><span class='text'>#text#</span><span class='name'>#name#</span>"

					}
				},
				{
					css: "show_all", template: "Show all messages <span class='webix_icon fa-angle-double-right'></span>", height: 40
				}
			]

		}
	}
};

});
define('views/menus/profile',[],function(){

return {
	$ui:{
		view: "submenu",
		id: "profilePopup",
		width: 200,
		padding:0,
		data: [
			{id: 1, icon: "user", value: "My Profile"},
			{id: 2, icon: "cog", value: "My Account"},
			{id: 3, icon: "calendar", value: "My Calendar"},
			{id: 5, icon: "tasks", value: "My Tasks"},
			{ $template:"Separator" },
			{id: 4, icon: "sign-out", value: "Logout"}
		],
		type:{
			template: function(obj){
				if(obj.type)
					return "<div class='separator'></div>";
				return "<span class='webix_icon alerts fa-"+obj.icon+"'></span><span>"+obj.value+"</span>";
			}
		}

	}
};

});
define('views/menus/sidebar',[],function(){
	
	return {
		$ui:{
			width: 200,

			rows:[
				{
					view: "tree",
					id: "app:menu",
					type: "menuTree2",
					css: "menu",
					activeTitle: true,
					select: true,
					tooltip: {
						template: function(obj){
							return obj.$count?"":obj.details;
						}
					},
					on:{
						onBeforeSelect:function(id){
							return !this.getItem(id).$count;
						},
						onAfterSelect:function(id){
							this.$scope.show("./"+id);
							var item = this.getItem(id);
							webix.$$("title").parse({title: item.value, details: item.details});
						}
					},
					data:[
						{id: "main", value: "Main", open: true, data:[
							{ id: "dashboard", value: "Dashboard", icon: "home", $css: "dashboard", details:"reports and statistics"},
							{ id: "orders", value: "Orders", icon: "check-square-o", $css: "orders", details:"order reports and editing"},
							{ id: "products", value: "Products", icon: "cube", $css: "products", details:"all products"},
							{ id: "product_edit", value: "Product Edit", icon: "pencil-square-o", details: "changing product data"}
						]},
						{id: "components", open: true, value:"Components", data:[
							{ id: "datatables", value: "Datatables", icon: "table", details: "datatable examples" },
							{ id: "charts", value: "Charts", icon: "bar-chart-o", details: "charts examples"},
							{ id: "forms", value: "Forms", icon: "list-alt", details: "forms examples"},
              { id: "typography", value: "Typography", icon: "align-left", details: "typography examples"}
						]},
						{id: "uis", value:"UI Examples", open:1, data:[
							{ id: "calendar", value: "My Calendar", icon: "calendar", details: "calendar example" },
							{ id: "files", value: "File Manager", icon: "folder-open-o", details: "file manager example" }

						]}
					]
				}
			]
		}
	};

});

// icon button with count marker
webix.protoUI({
	name:"icon",
	$skin:function(){
		this.defaults.height = webix.skin.$active.inputHeight;
	},
	defaults:{
		template:function(obj){
			var html = "<button style='height:100%;width:100%;line-height:"+obj.aheight+"px' class='webix_icon_button'>";
			html += "<span class='webix_icon fa-"+obj.icon+"'></span>";
			if(obj.value)
				html += "<span class='webix_icon_count'>"+obj.value+"</span>";
			html += "</button>";
			return html;
		},
		width:33
	},
	_set_inner_size:function(){

	}
}, webix.ui.button);
define("views/webix/icon", function(){});

// Type for left menu
webix.type(webix.ui.tree, {
	name:"menuTree",
	height: 40,
	folder:function(obj, common){
		if(obj.icon)
			return "<span class='webix_icon icon fa-"+obj.icon+"'></span>";
		return "";
	}
});
webix.type(webix.ui.tree, {
	name:"menuTree2",
	height: 40,

	icon:function(obj, common){
		var html = "";
		var open = "";
		for (var i=1; i<=obj.$level; i++){
			if (i==obj.$level && obj.$count){
				var dir = obj.open?"down":"right";
				html+="<span class='"+open+" webix_icon fa-angle-"+dir+"'></span>";
		    }
		}
		return html;
	},
	folder:function(obj, common){
		if(obj.icon)
			return "<span class='webix_icon icon fa-"+obj.icon+"'></span>";
		return "";
	}
});
define("views/webix/menutree", function(){});

define('views/app',[
	"views/menus/search",
	"views/menus/mail",
	"views/menus/message",
	"views/menus/profile",
	"views/menus/sidebar",
	"views/webix/icon",
	"views/webix/menutree"
],function(search, mail, message, profile, menu){

	//Top toolbar
	var mainToolbar = {
		view: "toolbar",
    css: "header",
		elements:[
			{view: "template", borderless: true, css: "logo", template: "<a href='http://webix.com'><img class='photo' src='assets/imgs/webix-logotype.svg' height='34' /></a>", width: 200},

			{ height:46, id: "person_template", css: "header_person", borderless:true, width: 180, data: {id:3,name: "Oliver Parr"},
				template: function(obj){
					var html = 	"<div style='height:100%;width:100%;' onclick='webix.$$(\"profilePopup\").show(this)'>";
					html += "<img class='photo' src='assets/imgs/photos/"+obj.id+".png' /><span class='name'>"+obj.name+"</span>";
					html += "<span class='webix_icon fa-angle-down'></span></div>";
					return html;
				}
			},
			{},
			{view: "icon", icon: "search",  width: 45, popup: "searchPopup"},
			{view: "icon", icon: "envelope-o", value: 3, width: 45, popup: "mailPopup"},
			{view: "icon", icon: "comments-o", value: 5, width: 45, popup: "messagePopup"}
		]
	};

	var body = {
		rows:[
			{ height: 49, id: "title", css: "title", template: "<div class='header'>#title#</div><div class='details'>( #details# )</div>", data: {text: "",title: ""}},
			{
				view: "scrollview", scroll:"native-y",
				body:{ cols:[{ $subview:true}] }
			}
		]
	};

	var layout = {
		rows:[
			mainToolbar,
			{
				cols:[
					menu,
					body
				]
			}
		]
	};

	return {
		$ui:layout,
		$menu:"app:menu",
		$oninit:function(view, scope){
			scope.ui(search.$ui);
			scope.ui(mail.$ui);
			scope.ui(message.$ui);
			scope.ui(profile.$ui);
		}
	};
	
});
webix.protoUI({
	name:"dhx-scheduler",
	defaults:{
		tabs:["day", "week", "month"]
	},
	getScheduler:function(){
		return this._scheduler;
	},
	$init:function(config){
		this.$ready.push(function(){
			var tabs = this.config.tabs;

			var html = ["<div class='dhx_cal_container' style='width:100%; height:100%;'><div class='dhx_cal_navline'><div class='dhx_cal_prev_button'>&nbsp;</div><div class='dhx_cal_next_button'>&nbsp;</div><div class='dhx_cal_today_button'></div><div class='dhx_cal_date'></div>"];
			if (tabs)
				for (var i=0; i<tabs.length; i++)
					html.push("<div class='dhx_cal_tab" +
						((i===0)?" dhx_cal_tab_first":"") +
						((i==tabs.length-1)?" dhx_cal_tab_last":"") +
						"' name='"+tabs[i]+"_tab' ></div>");
			html.push("</div><div class='dhx_cal_header'></div><div class='dhx_cal_data'></div></div>");

			this.$view.innerHTML = html.join("");

			//because we are not messing with resize model
			//if setSize will be implemented - below line can be replaced with webix.ready
			webix.delay(webix.bind(this._render_once, this));
		});
	},
	_render_once:function(){
		webix.require("scheduler/dhtmlxscheduler.css");
		webix.require([
			"scheduler/dhtmlxscheduler.js"
		], function(){
			var scheduler = this._scheduler = window.Scheduler ? Scheduler.getSchedulerInstance() : window.scheduler;

			if (this.config.init)
				this.config.init.call(this);

			scheduler.init(this.$view.firstChild, (this.config.date||new Date()), (this.config.mode||"week"));
			if (this.config.ready)
				this.config.ready.call(this);

		}, this);
	}
}, webix.ui.view);
define("views/webix/scheduler", function(){});

define('models/events',[],function(){
	var weekStart = webix.Date.weekStart(new Date());
	var monthStart = webix.Date.monthStart(new Date());
	var day = webix.Date.dayStart(new Date());
	var day2 = webix.Date.add(webix.Date.copy(day),1,"month",true);
	var monthStart1 = webix.Date.add(webix.Date.copy(monthStart),-1,"month",true);
	var monthStart2 = webix.Date.add(webix.Date.copy(monthStart),1,"month",true);
	var weekStart2 = webix.Date.add(webix.Date.copy(weekStart),1,"month",true);
	var weekStart1 = webix.Date.add(webix.Date.copy(weekStart),-1,"month",true);
	var data =[
		{
			id:1,
			start_date: webix.Date.copy(weekStart),
			end_date:   webix.Date.add(webix.Date.copy(weekStart),3,"day",true),
			text:   "Conference",
			calendar: "company"
		},
		{
			id:2,
			start_date: webix.Date.copy(monthStart),
			end_date:   webix.Date.add(webix.Date.copy(monthStart),2,"day",true),
			text:   "Partners meeting",
			calendar: "company"
		},

		{
			id:3,
			start_date: webix.Date.add(webix.Date.copy(monthStart),15,"day",true),
			end_date:   webix.Date.add(webix.Date.copy(monthStart),17,"day",true),
			text:   "Webix project",
			calendar: "company"
		},
		{
			id:4,
			start_date: webix.Date.add(webix.Date.copy(monthStart),18,"day",true),
			end_date:   webix.Date.add(webix.Date.copy(monthStart),22,"day",true),
			text:   "Conference"
		},
		{
			id:5,
			start_date:  webix.Date.add(day,9,"hour",true),
			end_date:   webix.Date.add(day,11,"hour",true),
			text:   "Meeting",
			calendar: "company"
		},
		{
			id:6,
			start_date:  webix.Date.add(weekStart,18,"hour",true),
			end_date:   webix.Date.add(weekStart,23,"hour",true),
			text:   "Birthday party"
		},
		{
			id:7,
			start_date: webix.Date.add(webix.Date.copy(monthStart),-2,"day",true),
			end_date:   webix.Date.add(webix.Date.copy(monthStart),3,"day",true),
			text:   "Football championship"
		},
		{
			id:8,
			start_date:  webix.Date.add(weekStart1,19,"hour",true),
			end_date:   webix.Date.add(weekStart1,23,"hour",true),
			text:   "Birthday party"
		},
		{
			id:9,
			start_date:  webix.Date.add(day2,9,"hour",true),
			end_date:   webix.Date.add(day2,11,"hour",true),
			text:   "Meeting",
			calendar: "company"
		},
		{
			id:10,
			start_date:  webix.Date.add(weekStart2,20,"hour",true),
			end_date:   webix.Date.add(weekStart2,23,"hour",true),
			text:   "Birthday party"
		},
		{
			id:11,
			start_date: webix.Date.add(webix.Date.copy(monthStart2),24,"day",true),
			end_date:   webix.Date.add(webix.Date.copy(monthStart2),28,"day",true),
			text:   "Conference",
			calendar: "company"
		},
		{
			id:12,
			start_date: webix.Date.add(webix.Date.copy(monthStart),26,"day",true),
			end_date:   webix.Date.add(webix.Date.copy(monthStart),28,"day",true),
			text:   "Football championship"
		}
	];

	return {
		data: data
	};

});
define('views/modules/scheduler',["views/webix/scheduler","models/events"], function(sch,events){
var addEvents = function(){
	scheduler.parse(events.data,"json");
};
return {
	$ui:{
		type: "material",
				cols:[
				{
					width: 240,
					rows:[
						{
						view: "calendar", 
						on:{
							onDateSelect: function(date){
								scheduler.updateView(date,"week");
							}
						}},

						{
							view: "form",
							rows:[
								{view: "list", id:"calendarList", borderless: true, css: "calendar_list", autoheight:true, template: "<div><span class='calendar_icon #id#'></span>#name#</div>", data:[
										{id: "my", name: "My Calendar", active: true},
										{id: "company", name: "Webix Project", active: true}
									],
									on:{
										onItemClick: function(calendarId){
											var item = this.getItem(calendarId);
											item.active = !item.active;
											item.$css =  (item.active?"":"disabled");
											this.refresh(calendarId);
											scheduler.updateView();
										}
									}
								},
								{ view: "button", css: "button_primary button_raised", label:"Add new calendar",align:"left"},
								{}
							]
						}

					]
				},
				{
					view: "dhx-scheduler",
					date: new Date(),
					mode:"month",
					tabs:["day","week", "month"],
					init:function(){
						//scheduler.config.month_day_min_height = 50;
						scheduler.config.xml_date="%Y-%m-%d %H:%i";
						scheduler.config.first_hour = 7;
						scheduler.config.last_hour = 24;
						scheduler.config.multi_day = true;
						scheduler.templates.event_class=function(s,e,ev){ return ev.calendar?"other":""; };
						var d = scheduler.date.date_to_str;
						var week1 = d("%d");
						var week2 = d("%d %M %y");
						scheduler.filter_day = scheduler.filter_week = scheduler.filter_month = function(id, event){
							var calendar = event.calendar;
							if(!calendar)
								return $$("calendarList").getItem("my").active;
							else
								return $$("calendarList").getItem(calendar).active;
						};
						scheduler.templates.week_scale_date = d("%D, %W/%j");
						scheduler.templates.week_date = function(d1,d2){
							return week1(d1)+" &ndash; "+ week2(scheduler.date.add(d2,-1,"day"));
						};
					},
					ready:function(){
						if(addEvents){
							addEvents();
							addEvents = null;
						}

					}
				}
		]
	}
};
});
define('views/calendar',[
	"views/modules/scheduler"
], function(calendar){

	var layout = {
		type: "clean",
		cols:[
			calendar
		]
	};

	return { $ui:layout };

});
define('views/modules/dashline',[],function(){

	return {
		$ui:{
			height: 136,
			css: "tiles",
			template: function(data){
				var t = null;
				var items = data.items;
				var html = "<div class='flex_tmp'>";
				for(var i=0; i < items.length; i++){
					t = items[i];
					html += "<div class='item "+t.css+" bg_panel'>";
					html += "<div class='webix_icon icon fa-"+ t.icon+"'></div>";
					html += "<div class='details'><div class='value'>"+t.value+"</div><div class='text'>"+t.text+"</div></div>";
					html +=  "<div class='footer'>View more <span class='webix_icon fa-angle-double-right'></span></div>";
					html += "</div>";
				}
				html += "</div>";
				return html;
			},
			data: {
				items:[
					{id:1, text: "New Orders", value: 250, icon: "check-square-o", css: "orders"},
					{id:2, text: "New Users", value: 300, icon: "user", css: "users"},
					{id:4, text: "New Feedbacks", value: 40, icon: "quote-right", css: "feedbacks"},
					{id:3, text: "Profit", value: "+25%", icon: "line-chart", css:"profit" }
				]
			}
		}
	};

});
define('models/visitors',[],function(){

	var data =[
		{"id": 1, "month": "Jun", "new": 300, "rec": 600},
		{"id": 2, "month": "Jul", "new": 100, "rec":  400},
		{"id": 3, "month": "Aug", "new": 400, "rec": 700},
		{"id": 4, "month": "Sep", "new": 600, "rec": 900},
		{"id": 5, "month": "Oct", "new": 400, "rec": 400}
	];

	return {
		getAll:data
	};

});
define('views/modules/visitors',["models/visitors"],function(visitors){

	return {
		$ui:{
			"type": "clean",
			"rows":[
				{
					"template": "<span class='webix_icon fa-sign-in'></span>Visitor statistics", "css": "sub_title", "height": 30
				},
				{
					"view": "chart", "type": "stackedArea",
					"legend":{
						"layout": "x",

						"align": "right",
						"values": [{"text":"New visitors", "color": "#61b5ee"},{"text": "Recurrent", "color": "#a4b4bf"}]
					},
					"offset":0,
					alpha:0.8,

					"xAxis":{
						"template": "#month#"
					},
					"radius":0,
					"yAxis":{
						"start":0,
						"end": 2000,
						"step": 500
					},
					"series":[
						{ "value": "#rec#", "color": "#a4b4bf"},
						{ "value": "#new#", "color": "#61b5ee"}
					],
					"padding":{
						"top": 25
					},
					"data": visitors.getAll
				}
			]
		}
	};

});
define('views/modules/orders',[],function(){
	return {
		$ui:{
			"type": "clean",
			"rows":[
				{
					"template": "<span class='webix_icon fa-bar-chart'></span>Orders", "css": "sub_title", "height": 30
				},
				{
					"view": "chart", "type": "bar",
					//"alpha": 0.5,
					"xAxis":{
						"template": "#month#"
					},


					"yAxis":{
						"start":0,
						"end": 500,
						"step": 100
					},
					barWidth: 60,
					alpha:0.85,
					radius:0,
					"series":[
						{
							"value": "#number#",
							color: "#9e89eb",

							"item":{
								"borderColor": "#fff",
								"color": "#49cd81",
								"radius": 3
							},
							"line":{
								"color":"#b07be5",
								"width":2
							}
						}
					],
					"padding":{
						"top": 25
					},
					"data":[
						{"id": 1, "month": "Jun", "number": 100},
						{"id": 2, "month": "Jul", "number": 250},
						{"id": 3, "month": "Aug", "number": 200},
						{"id": 4, "month": "Sep", "number": 350},
						{"id": 5, "month": "Oct", "number": 300}
					]
				}
			]
		}
	};
});
define('views/modules/chart_diff',[],function(){

	var dataset = [

		{ sales:4.1, sales2:8.0, year:"08" },
		{ sales:4.3, sales2:9.0, year:"09" },
		{ sales:7.6, sales2:11.0, year:"10" },
		{ sales:7.8, sales2:13.0, year:"11" },
		{ sales:7.2, sales2:10.0, year:"12" },
		{ sales:5.3, sales2:14.0, year:"13" },
		{ sales:4.8, sales2:12.0, year:"14" }
	];
	var chart = {
		view:"chart",
		type: "bar",
		barWidth: 40,
		padding:{
			left:30,
			bottom: 60
		},
		radius:0,
		yAxis:{
		},
		xAxis:{
			lines:true,
			title:"Sales per year<br/>&nbsp;",
			template:"'#id#"
		},
		legend:{
			layout:"y",
			width:100,
			align:"right",
			valign:"middle",
			values:[
				{text:"Asia",color:"#61b5ee"},
				{text:"Europe",color:"#e9df40"},
				{text:"Average", toggle:true,markerType: "item"}
			]
		},
		scheme:{
			$group: {
				by:"year",
				map:{
					salesA:["sales2","any"],
					salesB:["sales","any"],
					salesAverage:["sales",getAverage]
				}
			}
		},
		series:[
			{
				value:"#salesA#",
				color:"#61b5ee",

				gradient: "falling",
				alpha: 0.8
			},
			{
				type:"area",
				alpha:0.4,
				value:"#salesB#",
				color:"#e9df40"
			},
			{
				type:"line",
				value:"#salesAverage#",
				item:{
					radius:2,
					borderColor: "#27ae60"
				},
				line:{
					color:"#27ae60",
					width:2
				}
			}
		],
		data: dataset
	};
	function getAverage(property,data){
		var summ = 0;
		for(var i = 0; i < data.length; i++){
			summ += (parseFloat(data[i].sales)||0);
			summ += (parseFloat(data[i].sales2)||0);
		}
		return data.length?summ/(data.length*2):0;
	}



	return {
		$ui:chart
	};

});
define('views/modules/revenue',[],function(){

	var header = {
		"template": "<span class='webix_icon fa-line-chart'></span>Revenue", "css": "sub_title", "height": 50
	};

	var chart = {
		view: "chart",
		type: "line",
		xAxis:{
			template: "#month#"
		},
		tooltip: {
			template: "#number#M $"
		},
		minHeight:140,
		yAxis:{
			"start":0,
			"end": 450,
			"step": 150
		},
		offset: false,
		series:[
			{
				"value": "#number#",


				"item":{
					"borderColor": "#fff",
					"color": "#61b5ee",
					"radius": 4
				},
				"line":{
					"color":"#61b5ee",
					"width":1
				}
			}
		],
		padding:{
			"top": 25
		},
		data:[
			{"id": 1, "month": "Jun", "number": 90},
			{"id": 2, "month": "Jul", "number": 220},
			{"id": 3, "month": "Aug", "number": 180},
			{"id": 4, "month": "Sep", "number": 405},
			{"id": 5, "month": "Oct", "number": 275}
		]
	};

	var donut1 = {
		view: "chart",
		css:"donut_result",
		type: "donut",
		shadow: false,
		color: "#color#",
		pieInnerText: function(obj){
			return obj.result?"<div class='donut_result'>"+obj.value+"</div>":"";
		},
		padding:{
			left:10,
			right:10,
			top:10,
			bottom:10
		},
		data:[
			{value: 30, color: "#61b5ee",result:1},
			{value: 70, color: "#eee"}
		]
	};

	var donut2 = {
		view: "chart",
		type: "donut",
		shadow: false,
		css:"donut_result",
		color: "#color#",
		padding:{
			left:10,
			right:10,
			top:10,
			bottom:10
		},
		pieInnerText: function(obj){
			return obj.result?"<div class='donut_result'>"+obj.value+"</div>":"";
		},
		data:[
			{value: 25, color: "#61b5ee",result:1},
			{value: 75, color: "#eee"}
		]
	};

	var donut3 = {
		view: "chart",
		type: "donut",
		css:"donut_result",
		shadow: false,
		color: "#color#",
		pieInnerText: function(obj){
			return obj.result?"<div class='donut_result'>"+obj.value+"</div>":"";
		},
		padding:{
			left:10,
			right:10,
			top:10,
			bottom:10
		},
		data:[
			{value: 45, color: "#61b5ee",result:1},
			{value: 55, color: "#eee"}
		]
	};

	var layout = {	
		type: "clean",
    borderless: true,
		rows:[
			chart,
			{
				height: 90,
				type: "clean",
				cols:[
					donut1,
					donut2,
					donut3
				]
			},
			{
				height: 40,
				type: "clean",
				css: "donut_titles",
				cols:[
					{
						template: "Europe"
					},
					{
						template: "Asia"
					},
					{
						template: "Northern America"
					}
				]
			}
		]
	};

	return {
		$ui:layout
	};

});
define('views/modules/taskschart',[],function(){

	var tasks = {
		view:"chart",
		type:"barH",

		value:"#progress#",
		minHeight: 230,
		color:"#color#",
		barWidth:30,
		radius:2,
		tooltip:{
			template:"#sales#"
		},
		yAxis:{
			template:"#name#"
		},
		xAxis:{
			start:0,
			end:100,
			step:10,
			template:function(obj){
				return (obj%20?"":obj);
			}
		},
		padding:{
			left: 120
		},
		data: [
			{ id: "1", name: "Report",progress:55, color: "#49cd81"},
			{ id: "2", name: "Strategy  meeting", progress:20,color: "#a693eb"},
			{ id: "3", name: "Partners meeting",progress:70, color: "#49cd81"},
			{ id: "4", name: "Research analysis",progress:30, color: "#a693eb"},
			{ id: "5", name: "Presentation",progress:60, color: "#f19b60"}
		],
		legend:{
			align:"center",
			layout: "x",
			valign:"bottom",
			template: "#region#",
			values:[
				{text: "Company", color: "#49cd81"},
				{text: "Inner tasks", color: "#f19b60"},
				{text: "Projects", color: "#a693eb"}
			]
		}
	};

	return {
		$ui:tasks
	};

});


define('views/modules/diffchart',[],function(){

	var tasks = {
		gravity: 3,
		"type": "clean",
		"rows":[
			{
				"template": "<span class='webix_icon fa-pie-chart'></span>Pie chart", "css": "sub_title", "height": 30
			},
			{
				"view": "chart",
				"type": "pie3D",
				color: "#color#",
				shadow: false,
				tooltip:{
					template: "#value#%"
				},
				minHeight:200,
				padding:{
					left:15,
					right:15,
					bottom:10,
					top:10
				},
				legend:{
					layout:"y",
					width:100,
					align:"right",
					valign:"middle",
					template: "#region#"
				},
				data:[
					{color: "#61b5ee", region: "Asia",value: 35},
					{color: "#27ae60", region: "Europe",value:30},
					{color: "#9e89eb", region: "USA",value: 25},
					{color: "#f19b60", region: "Australia",value:10}

				]
			}
		]
	};

	return {
		$ui:tasks
	};

});




define('views/charts',[
	"views/modules/dashline",
	"views/modules/visitors",
	"views/modules/orders",
	"views/modules/chart_diff",
	"views/modules/revenue",
	"views/modules/taskschart",
	"views/modules/diffchart"
],function(dashline, visitors, orders, chart_diff, revenue, tasks, diffchart){

	var layout = {
		type: "clean",
		rows:[
			{
				type: "clean", margin:-10,
				rows:[

					{
						type: "material",
						minHeight: 250,
						cols: [
							{
								gravity: 4,
								type: "clean",
								rows:[
									{
										"template": "<span class='webix_icon fa-area-chart'></span>Different charts in one", "css": "sub_title", "height": 30
									},
									chart_diff
								]
							},
							diffchart
						]
					},
					{

						type: "material",
						cols: [
							{

								type: "clean",
								rows:[
									{
										"template": "<span class='webix_icon fa-line-chart'></span>Sales", "css": "sub_title", "height": 30
									},
									revenue
								]
							},
							{
								"type": "clean",
								"rows":[
									{
										"template": "<span class='webix_icon fa-tasks'></span>Tasks", "css": "sub_title", "height": 30
									},
									tasks,
									{template: " "}
								]

							}
						]
					},
					{
						height: 220,
						type: "material",
						cols: [

							orders,
							visitors
						]
					}
				]

			}
		]
	};

	return { $ui:layout };

});

define('views/modules/messages',[],function(){

	var header = {
		"template": "<span class='webix_icon fa-comments-o'></span>Messages", "css": "sub_title", "height": 50
	};

	var list = {
		"view": "list",
		css: "chat_list",
		maxHeight: 300,
		minHeight: 250,
		"type": {
			"height": "auto",
			"template": function(obj){
				var text = "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae. ";
				var html = 	"<img class='photo' src='assets/imgs/photos/"+obj.personId+".png' />";
				html += "<div class='text'><div class='name'>"+obj.name+"<div class='time'>"+obj.time+"</div></div>";
				html += text+"</div>";
				return html;
			}
		},
		"data": [
			{ id: 1,  personId: 1, time:"Just now", name: "Peter Johnson"},
			{ id: 2,  personId: 2, time:"Just now", name: "Vera Liu"},
			{ id: 3, personId: 1, time:"11:40", name: "Peter Johnson"},
			{ id: 4, personId: 2, time:"11:30", name: "Vera Liu"},
			{ id: 5, personId: 1, time:"10:10", name: "Peter Johnson"},
			{ id: 6, personId: 2, time:"9:50", name: "Vera Liu"}
		]
	};

	var form = {
		view: "form",
		css: "show_all",
		paddingX: 10,
		paddingY: 2,

		cols:[
			{
				view: "text", placeholder: "Type a message here",height:36
			},
			{
				view: "icon", icon: "search",height:36
			}
		]
	};


	return {
		$ui:{
			type: "clean",
			rows:[
				header,
				{ rows:[ list, form ] }
			]
		}
	};

});
define('views/modules/tasks',[],function(){

	var tasks = { 
		rows:[
			{
				template: "<span class='webix_icon fa-tasks'></span>Pending Tasks", type:"header", "css": "sub_title", "height": 50
			},
			{
				view: "list",
				css: "tasks_list",
				autoheight: true,
				type: {

					marker: function(obj){
						return "<span class='webix_icon_btn fa-bell-o marker "+obj.type+"' style='max-width:32px;' ></span>";
					},
					check:  webix.template('<span class="webix_icon_btn fa-{obj.$check?check-:}square-o list_icon" style="max-width:32px;"></span>'),
					template: function(obj,type){
						return "<div class='"+(obj.$check?"done":"")+"'>"+type.check(obj,type)+"<span class='list_text'>"+obj.text+"</span><span class='marker "+obj.type+"'>"+(obj.type||"")+"</span></div>";
					}
				},
				data: [
					{ id: "1", text: "Prepare finance report"},
					{ id: "2", text: "Solex project strategy  meeting", type: "projects"},
					{ id: "3", text: "WestEurope partners call"},
					{ id: "4", text: "Prepare presentation for summer conference", type: "company"},
					{ id: "5", text: "Market research analysis"},
					{ id: "6", text: "Check messages"},
					{ id: "7", text: "Discussing new theme for website", type: "company"}
				],
				on: {
					onItemClick:function(id){
						var item = this.getItem(id);
						item.$check = !item.$check;
						this.refresh(id);
					}
				}
			},
			{
				css: "show_all bg", template: "Show all tasks <span class='webix_icon fa-angle-double-right'></span>", height: 40
			}
		]
	};

	return {
		$ui:tasks
	};

});
webix.protoUI({
	name:"google-map",
	$init:function(config){
		this.$view.innerHTML = "<div class='webix_map_content' style='width:100%;height:100%'></div>";
		this._contentobj = this.$view.firstChild;

		this.map = null;
		this.$ready.push(this.render);
	},
	render:function(){
        if(typeof google=="undefined"||typeof google.maps=="undefined"){
            var name = "webix_callback_"+webix.uid();
            window[name] = webix.bind(function(){
                 this._initMap.call(this,true);
            },this);

            var script = document.createElement("script");
            script.type = "text/javascript";
            script.src = "//maps.google.com/maps/api/js?sensor=false&callback="+name;
            document.getElementsByTagName("head")[0].appendChild(script);
        }
        else
            this._initMap();
	},
    _initMap:function(define){
        var c = this.config;

        this.map = new google.maps.Map(this._contentobj, {
            zoom: c.zoom,
            center: new google.maps.LatLng(c.center[0], c.center[1]),
            mapTypeId: google.maps.MapTypeId[c.mapType]
        });
        webix._ldGMap = null;
    },
	center_setter:function(config){
		if(this.map)
            this.map.setCenter(new google.maps.LatLng(config[0], config[1]));
        
		return config;
	},
	mapType_setter:function(config){
		/*ROADMAP,SATELLITE,HYBRID,TERRAIN*/
        if(this.map)
        	this.map.setMapTypeId(google.maps.MapTypeId[config]);

		return config;
	},
	zoom_setter:function(config){
		if(this.map)
			 this.map.setZoom(config);

		return config;
	},
	defaults:{
		zoom: 5,
		center:[ 39.5, -98.5 ],
		mapType: "ROADMAP" 
	},
	$setSize:function(){
		webix.ui.view.prototype.$setSize.apply(this, arguments);
		if(this.map)
            google.maps.event.trigger(this.map, "resize");
	}
}, webix.ui.view);

define("views/webix/googlemap", function(){});

define('views/modules/map',["views/webix/googlemap"], function(){

	var map = {
		rows:[
			{
				template:"<span class='webix_icon fa-map-marker'></span>Events Map" , type:"header", "css": "sub_title", "height": 50
			},
			{
				view:"google-map",
				id:"map",
				zoom:3,
				center:[ 48.724, 8.215 ]
			}
		]
	};

	return { $ui:map };

});
define('views/dashboard',[
	"views/modules/dashline",
	"views/modules/visitors",
	"views/modules/orders",
	"views/modules/messages",
	"views/modules/revenue",
	"views/modules/tasks",
	"views/modules/map"
],function(dashline, visitors, orders, messages, revenue, tasks, map){
	
	var layout = {
		type: "clean",
		rows:[
			dashline,
			{
				margin:-10,
				rows:[
					{
						height: 220,
						type: "material",
						cols: [
							visitors,
							orders
						]
					},
					{
						type: "material",
						cols: [
							messages,
							{
								rows: [
							  		revenue
								]
							}
						]
					},
					{
						type: "material",
						cols: [
							tasks,
							map
						]
					}
				]

			}
		]
	};

	return { $ui:layout };

});
define('models/data_arrays',[],function(){
	
var rating =[
	{"id":1,"code":"NWTB-1","name":"Webix Chai", rating:5, rank:1},
	{"id":2,"code":"NWTCO-3","name":"Webix Syrup", rating:1, rank:2},
	{"id":3,"code":"NWTCO-4","name":"Webix Cajun Seasoning", rating:2, rank:3},
	{"id":4,"code":"NWTO-5","name":"Webix Olive Oil", rating:3, rank:4},
	{"id":5,"code":"NWTJP-6","name":"Webix Boysenberry Spread", rating:1, rank:5}
];
var treetable =[
	{
		id:1, name:"USA", open:1, data:[
			{"id":11,"code":"NWTB-1","name":"Webix Chai", sales: 200000},
			{"id":12,"code":"NWTCO-3","name":"Webix Syrup", sales: 180000},
			{"id":13,"code":"NWTCO-4","name":"Webix Cajun Seasoning", sales: 150000}
		]
	},
	{
		id:2, name:"Europe", data:[
			{"id":21,"code":"NWTB-1","name":"Webix Chai", sales: 230000},
			{"id":22,"code":"NWTCO-3","name":"Webix Syrup", sales: 210000},
			{"id":23,"code":"NWTO-5","name":"Webix Olive Oil", sales: 180000}
		]
	},
	{
		id:3, name:"Asia", open:1, data:[
			{"id":31,"code":"NWTCO-4","name":"Webix Cajun Seasoning", sales: 310000},
			{"id":32,"code":"NWTO-5","name":"Webix Olive Oil", sales: 250000},
			{"id":33,"code":"NWTJP-6","name":"Webix Boysenberry Spread", sales: 210000}
		]
	}
];
var colspans ={
	data:[
		{"id":11,"code":"NWTB-1","name":"Webix Chai", sales: 200000, region:"USA"},
		{"id":12,"code":"NWTCO-3","name":"Webix Syrup", sales: 180000, region:"USA"},
		{"id":13,"code":"NWTCO-4","name":"Webix Cajun Seasoning", sales: 150000, region:"USA"},
		{ id:"sub1", $css:"highlight_row", region:"Top Sales", sales: 200000},
		{"id":21,"code":"NWTB-1","name":"Webix Chai", sales: 230000, region:"Europe"},
		{"id":22,"code":"NWTO-5","name":"Webix Olive Oil", sales: 180000, region:"Europe"},
		{ id:"sub2", $css:"highlight_row", region:"Top Sales", sales: 230000}

	],
	spans:[
		[11, "region", 1, 3],
		[21, "region", 1, 3],
		["sub1", "region", 3, 1, null, "highlight_row"],
		["sub2", "region", 3, 1, "", "highlight_row"]
	]
};
var  progress=[
	{ id: "1", name: "Prepare finance report",progress:0.55, type: "inner"},
	{ id: "2", name: "Solex project strategy  meeting", progress:0.20},
	{ id: "3", name: "WestEurope partners call",progress:0.7},
	{ id: "4", name: "Market research analysis",progress:0.3, type: "inner"},
	{ id: "5", name: "Prepare presentation",progress:0.6, type: "company"}
];
return {
	rating:rating,
	treetable:treetable,
	progress: progress,
	colspans: colspans
};

});
define('views/modules/data_rating',["models/data_arrays"],function(data_arrays){

	var titleRating = {

		view: "toolbar",
		css: "highlighted_header header1",
		paddingX:5,
		paddingY:5,
		height:40,
		cols:[
			{
				"template": "<span class='webix_icon fa-star-o'></span>Rating", "css": "sub_title2", borderless: true
			},
			{view: "button", css: "button_transparent", type: "iconButton", icon:"refresh",width:130, label: "Refresh"}
		]
	};

	var gridRating = {
		view:"datatable",
		columns:[
			{ id:"id", header:"", sort:"int",width: 35},
			{ id:"name",	header:"Procut", fillspace:4,  sort:"string"},
			{ id:"code",	header:"Code", sort:"string",fillspace:2},
			{ id:"rating",	header:"Rating", sort:"int", fillspace:2, minWidth:80,
				template:function(obj){
					var html = "<div class='rating_bar_element star"+obj.rating+"'>";

					for (var i=1; i<6; i++)
						html+="<div title='"+i+"' class='rating_star star"+i+"' style='left:"+(i*16 - 16)+"px'></div>";

					return html+"</div>";
				}
			}
		],
		onClick:{
			rating_star:function(ev, id, html){
				this.getItem(id.row)[id.column] = (ev.target||ev.srcElement).getAttribute("title");
				this.updateItem(id.row);
			}
		},
		autoheight: true,
		scheme:{
			$init:function(obj){ obj.index = this.count(); }
		},
		data:data_arrays.rating
	};


	var layout = {
		type: "clean",
		rows:[
			titleRating,
			gridRating
		]
	};

	return { $ui: layout };

});
define('views/modules/data_treetable',["models/data_arrays"],function(data_arrays){
	var titleTree = {
		view: "toolbar",
		css: "highlighted_header header3",
    borderless: true,
		paddingX:5,
		paddingY:5,
		height:40,
		cols:[
			{
				"template": "<span class='webix_icon fa-folder-o'></span>Treetable", "css": "sub_title2", borderless: true
			},
			{ view: "button", css: "button_transparent", type: "iconButton", icon: "external-link", label: "Export", width: 120}
		]
	};
	var gridTree = {
		view:"treetable",
		columns:[
			{ id:"id",	header:"",  	width:35},
			{ id:"name",	header:"Product",	 fillspace:4,
				template:"{common.treetable()} #name#" },
			{ id:"code",	header:"Code", sort:"int",fillspace:2},
			{ id:"sales",	header:"Sales", sort:"int",fillspace:2}
		],
		select: true,
		data: data_arrays.treetable,
		type: {
			icon:function(obj,common){
				if (obj.$count){
					if (obj.open)
						return "<span class='webix_icon fa-angle-down'></span>";
					else
						return "<div class='webix_icon fa-angle-right'></div>";
				} else
					return "<div class='webix_tree_none'></div>";
			},
			folder:function(obj, common){
				if (obj.$count){
					if (obj.open)
						return "<span class='webix_icon fa-folder-open-o'></span>";
					else
						return "<span class='webix_icon fa-folder-o'></span>";
				}
				return "<div class='webix_icon fa-file-o'></div>";
			}
		},
		onClick:{
			"fa-angle-down":function(e,id){

				this.close(id);
			},
			"fa-angle-right":function(e,id){
				this.open(id);
			}
		},
		on:{
			onAfterLoad:function(){
				this.select(12)
			}
		}
	};

	var layout = {
		type: "clean",
		rows:[
			titleTree,
			gridTree
		]
	};


	return { $ui: layout };

});

define('views/modules/data_progress',["models/data_arrays"],function(data_arrays){

	var titleProgress = {
		view: "toolbar",
		css: "highlighted_header header4",
		paddingX:5,
		paddingY:5,
		height:40,
		cols:[
			{
				"template": "<span class='webix_icon fa-adjust'></span>Progress", "css": "sub_title2", borderless: true
			},
			{ view: "button", css: "button_transparent", type: "iconButton", icon: "sliders", label: "Update", width: 120}
		]
	};
	var gridProgress = {
		view:"datatable",
		columns:[
			{ id:"id",	header:"",  	width:35,sort:"int"},
			{ id:"name",	header:"Task",	 fillspace:4,sort:"string"},
			{ id:"progress",	header:"Progress",  sort:"int",fillspace:2.5,	template:function(obj){
				var html = "<div class='progress_bar_element'>";
				var className = "progress_result "+(obj.type||"");
				html += "<div title='"+(parseInt(obj.progress*100,10)+"%")+"' class='"+className+"' style='width:"+(obj.progress*100+"%")+"'></div>";
				return html+"</div>";
			}},
			{ id:"num",	header:"Num, %", sort:function(a,b){

				a = a.progress;
				b = b.progress;
				return (a>b?1:(a<b?-1:0));
			}, fillspace:1.5, template:function(obj){
				return parseInt(obj.progress*100,10)+"%";
			}}
		],
		autoheight:true,
		data:data_arrays.progress
	};


	var layout = {
		type: "clean",
		rows:[
			titleProgress,
			gridProgress
		]
	};


	return { $ui: layout };

});
define('views/modules/data_spans',["models/data_arrays"],function(data_arrays){

	var titleGroup = {
		view: "toolbar",
		css: "highlighted_header header2",
    borderless: true,
		paddingX:5,
		paddingY:5,
		height:40,
		cols:[
			{
				"template": "<span class='webix_icon fa-arrows-v'></span>Spans", "css": "sub_title2", borderless: true
			},
			{ view: "button", css:"button_transparent", type: "iconButton", icon: "refresh", width: 32}

		]
	};
	var gridGroup = {
		view:"datatable",
		columns:[
			{ id:"region",	header:"Region", fillspace: 1 },
			{ id:"name", 	header:"Product", fillspace: 2},
			{ id:"code",	header:"Code" , fillspace: 1 ,tooltip: "", editor:"text"},
			{ id:"sales",	header:"Sales", fillspace: 1 }
		],
		spans:true,
		autoheight:true,
		select:"cell",
		data:data_arrays.colspans
	};


	var layout = {
		type: "clean",
		rows:[
			titleGroup,
			gridGroup
		]
	};

	return { $ui: layout };

});
define('models/orders',[],function(){
	
var data =[
	{"id":1,"date":"2014-03-20","employee":"Ray M. Parra","customer":"Sabrina N. Hermann","status":"new","fee":12.5,"taxes":23.028,"total":323.378,"shipping_company":"Shipping A","payment_method":"Credit card"},
	{"id":2,"date":"2014-03-20","employee":"Lane E. Dion","customer":"Bradly N. Mauro","status":"new","fee":12,"taxes":6.528,"total":100.128,"shipping_company":"Shipping C","payment_method":"Wire transer"},
	{"id":3,"date":"2014-03-20","employee":"Ray M. Parra","customer":"Stepanie P. Lilley","status":"ready","fee":25,"taxes":54,"total":1429,"shipping_company":"Shipping A","payment_method":"Credit card"},
	{"id":4,"date":"2014-03-20","employee":"Sudie V. Goldsmith","customer":"Jettie P. Whelan","status":"cancelled","fee":10,"taxes":41.25,"total":1082.5,"shipping_company":"Shipping A","payment_method":"Credit card"},
	{"id":5,"date":"2014-03-20","employee":"Romaine B. Alley","customer":"Amee A. Marshall","status":"new","fee":12,"taxes":9.1257,"total":203.6397,"shipping_company":"Shipping A","payment_method":"Wire transer"},
	{"id":6,"date":"2014-03-20","employee":"Jolie P. Sparks","customer":"Roxanna C. Cass","status":"completed","fee":10,"taxes":2.671875,"total":119.546875,"shipping_company":"Shipping B","payment_method":"Wire transer"},
	{"id":7,"date":"2014-03-20","employee":"Sherley D. Berryman","customer":"Ashleigh G. Denham","status":"completed","fee":26,"taxes":149.2638,"total":1419.1288,"shipping_company":"Shipping B","payment_method":"Credit card"},
	{"id":8,"date":"2014-05-15","employee":"Lane E. Dion","customer":"Reba H. Casteel","status":"new","fee":33,"taxes":54.23,"total":1522.63,"shipping_company":"Shipping B","payment_method":"Cash"},
	{"id":9,"date":"2014-05-16","employee":"Ray M. Parra","customer":"Stepanie P. Lilley","status":"ready","fee":56.2,"taxes":22.1,"total":854.3,"shipping_company":"Shipping D","payment_method":"Cash"},
	{"id":10,"date":"2014-05-16","employee":"Sudie V. Goldsmith","customer":"Bradly N. Mauro","status":"new","fee":10,"taxes":12,"total":454,"shipping_company":"Shipping E","payment_method":"Credit Card"},
	{"id":11,"date":"2014-05-16","employee":"Romaine B. Alley","customer":"Sabrina N. Hermann","status":"cancelled","fee":85,"taxes":42,"total":987,"shipping_company":"Shipping A","payment_method":"Wire Transfer"},
	{"id":12,"date":"2014-05-16","employee":"Ray M. Parra","customer":"Roxanna C. Cass","status":"completed","fee":20,"taxes":8,"total":456,"shipping_company":"Shipping G","payment_method":"Credit Card"},
	{"id":13,"date":"2014-08-11","employee":"Jolie P. Sparks","customer":"Bradly N. Mauro","status":"new","fee":13,"taxes":1,"total":255,"shipping_company":"Shipping A","payment_method":"Cash"},
	{"id":14,"date":"2014-08-11","employee":"Sudie V. Goldsmith","customer":"Stephen H. Peachey","status":"new","fee":63,"taxes":12,"total":1522,"shipping_company":"Shipping B","payment_method":"Wire Transfer"},
	{"id":15,"date":"2014-08-11","employee":"Sherley D. Berryman","customer":"Sabrina N. Hermann","status":"ready","fee":78,"taxes":45,"total":1788,"shipping_company":"Shipping A","payment_method":"Wire Transfer"},
	{"id":16,"date":"2014-08-11","employee":"Ray M. Parra","customer":"Regine H.Field","status":"ready","fee":14,"taxes":4,"total":988,"shipping_company":"Shipping A","payment_method":"Cash"},
	{"id":17,"date":"2014-08-11","employee":"Romaine B. Alley","customer":"Stephane A. Chandler","status":"completed","fee":0,"taxes":0,"total":0,"shipping_company":"Shipping C","payment_method":"Credit Card"},
	{"id":18,"date":"2014-08-11","employee":"Jamila N. Mccallister","customer":"Olimpia C. Whelan","status":"new","fee":55,"taxes":13,"total":2100,"shipping_company":"Shipping E","payment_method":"Credit Card"},
	{"id":19,"date":"2014-08-11","employee":"Romaine B. Alley","customer":"Jettie P. Whelan","status":"ready","fee":18,"taxes":8,"total":956,"shipping_company":"Shipping A","payment_method":"Wire Transfer"},
	{"id":20,"date":"2014-08-11","employee":"Lane E. Dion","customer":"Stepanie P. Lilley","status":"completed","fee":133,"taxes":33,"total":754,"shipping_company":"Shipping D", "payment_method":"Cash"},
	{"id":111,"date":"2014-03-20","employee":"Ray M. Parra","customer":"Sabrina N. Hermann","status":"new","fee":12.5,"taxes":23.028,"total":323.378,"shipping_company":"Shipping A","payment_method":"Credit card"},
	{"id":112,"date":"2014-03-20","employee":"Lane E. Dion","customer":"Bradly N. Mauro","status":"new","fee":12,"taxes":6.528,"total":100.128,"shipping_company":"Shipping C","payment_method":"Wire transer"},
	{"id":113,"date":"2014-03-20","employee":"Ray M. Parra","customer":"Stepanie P. Lilley","status":"ready","fee":25,"taxes":54,"total":1429,"shipping_company":"Shipping A","payment_method":"Credit card"},
	{"id":114,"date":"2014-03-20","employee":"Sudie V. Goldsmith","customer":"Jettie P. Whelan","status":"cancelled","fee":10,"taxes":41.25,"total":1082.5,"shipping_company":"Shipping A","payment_method":"Credit card"},
	{"id":115,"date":"2014-03-20","employee":"Romaine B. Alley","customer":"Amee A. Marshall","status":"new","fee":12,"taxes":9.1257,"total":203.6397,"shipping_company":"Shipping A","payment_method":"Wire transer"},
	{"id":116,"date":"2014-03-20","employee":"Jolie P. Sparks","customer":"Roxanna C. Cass","status":"completed","fee":10,"taxes":2.671875,"total":119.546875,"shipping_company":"Shipping B","payment_method":"Wire transer"},
	{"id":117,"date":"2014-03-20","employee":"Sherley D. Berryman","customer":"Ashleigh G. Denham","status":"completed","fee":26,"taxes":149.2638,"total":1419.1288,"shipping_company":"Shipping B","payment_method":"Credit card"},
	{"id":118,"date":"2014-05-15","employee":"Lane E. Dion","customer":"Reba H. Casteel","status":"new","fee":33,"taxes":54.23,"total":1522.63,"shipping_company":"Shipping B","payment_method":"Cash"},
	{"id":119,"date":"2014-05-16","employee":"Ray M. Parra","customer":"Stepanie P. Lilley","status":"ready","fee":56.2,"taxes":22.1,"total":854.3,"shipping_company":"Shipping D","payment_method":"Cash"},
	{"id":1110,"date":"2014-05-16","employee":"Sudie V. Goldsmith","customer":"Bradly N. Mauro","status":"new","fee":10,"taxes":12,"total":454,"shipping_company":"Shipping E","payment_method":"Credit Card"},
	{"id":1111,"date":"2014-05-16","employee":"Romaine B. Alley","customer":"Sabrina N. Hermann","status":"cancelled","fee":85,"taxes":42,"total":987,"shipping_company":"Shipping A","payment_method":"Wire Transfer"},
	{"id":1112,"date":"2014-05-16","employee":"Ray M. Parra","customer":"Roxanna C. Cass","status":"completed","fee":20,"taxes":8,"total":456,"shipping_company":"Shipping G","payment_method":"Credit Card"},
	{"id":1113,"date":"2014-08-11","employee":"Jolie P. Sparks","customer":"Bradly N. Mauro","status":"new","fee":13,"taxes":1,"total":255,"shipping_company":"Shipping A","payment_method":"Cash"},
	{"id":1114,"date":"2014-08-11","employee":"Sudie V. Goldsmith","customer":"Stephen H. Peachey","status":"new","fee":63,"taxes":12,"total":1522,"shipping_company":"Shipping B","payment_method":"Wire Transfer"},
	{"id":1115,"date":"2014-08-11","employee":"Sherley D. Berryman","customer":"Sabrina N. Hermann","status":"ready","fee":78,"taxes":45,"total":1788,"shipping_company":"Shipping A","payment_method":"Wire Transfer"},
	{"id":1116,"date":"2014-08-11","employee":"Ray M. Parra","customer":"Regine H.Field","status":"ready","fee":14,"taxes":4,"total":988,"shipping_company":"Shipping A","payment_method":"Cash"},
	{"id":1117,"date":"2014-08-11","employee":"Romaine B. Alley","customer":"Stephane A. Chandler","status":"completed","fee":0,"taxes":0,"total":0,"shipping_company":"Shipping C","payment_method":"Credit Card"},
	{"id":1118,"date":"2014-08-11","employee":"Jamila N. Mccallister","customer":"Olimpia C. Whelan","status":"new","fee":55,"taxes":13,"total":2100,"shipping_company":"Shipping E","payment_method":"Credit Card"},
	{"id":1119,"date":"2014-08-11","employee":"Romaine B. Alley","customer":"Jettie P. Whelan","status":"ready","fee":18,"taxes":8,"total":956,"shipping_company":"Shipping A","payment_method":"Wire Transfer"},
	{"id":1120,"date":"2014-08-11","employee":"Lane E. Dion","customer":"Stepanie P. Lilley","status":"completed","fee":133,"taxes":33,"total":754,"shipping_company":"Shipping D", "payment_method":"Cash"},
	{"id":127,"date":"2014-03-20","employee":"Sherley D. Berryman","customer":"Ashleigh G. Denham","status":"new","fee":26,"taxes":149.2638,"total":1419.1288,"shipping_company":"Shipping B","payment_method":"Credit card"},
	{"id":128,"date":"2014-05-15","employee":"Lane E. Dion","customer":"Reba H. Casteel","status":"new","fee":33,"taxes":54.23,"total":1522.63,"shipping_company":"Shipping B","payment_method":"Cash"},
	{"id":129,"date":"2014-05-16","employee":"Ray M. Parra","customer":"Stepanie P. Lilley","status":"new","fee":56.2,"taxes":22.1,"total":854.3,"shipping_company":"Shipping D","payment_method":"Cash"},
	{"id":21,"date":"2014-03-21","employee":"Ray M. Parra","customer":"Sabrina N. Hermann","status":"new","fee":12.5,"taxes":23.028,"total":323.378,"shipping_company":"Shipping A","payment_method":"Credit card"},
	{"id":22,"date":"2014-03-21","employee":"Lane E. Dion","customer":"Bradly N. Mauro","status":"new","fee":12,"taxes":6.528,"total":100.128,"shipping_company":"Shipping C","payment_method":"Wire transer"},
	{"id":23,"date":"2014-03-21","employee":"Ray M. Parra","customer":"Stepanie P. Lilley","status":"ready","fee":25,"taxes":54,"total":1429,"shipping_company":"Shipping A","payment_method":"Credit card"},
	{"id":24,"date":"2014-03-21","employee":"Sudie V. Goldsmith","customer":"Jettie P. Whelan","status":"cancelled","fee":10,"taxes":41.25,"total":1082.5,"shipping_company":"Shipping A","payment_method":"Credit card"},
	{"id":25,"date":"2014-03-21","employee":"Romaine B. Alley","customer":"Amee A. Marshall","status":"new","fee":12,"taxes":9.1257,"total":203.6397,"shipping_company":"Shipping A","payment_method":"Wire transer"},
	{"id":26,"date":"2014-03-21","employee":"Jolie P. Sparks","customer":"Roxanna C. Cass","status":"completed","fee":10,"taxes":2.671875,"total":119.546875,"shipping_company":"Shipping B","payment_method":"Wire transer"},
	{"id":27,"date":"2014-03-21","employee":"Sherley D. Berryman","customer":"Ashleigh G. Denham","status":"completed","fee":26,"taxes":149.2638,"total":1419.1288,"shipping_company":"Shipping B","payment_method":"Credit card"},
	{"id":28,"date":"2014-05-22","employee":"Lane E. Dion","customer":"Reba H. Casteel","status":"new","fee":33,"taxes":54.23,"total":1522.63,"shipping_company":"Shipping B","payment_method":"Cash"},
	{"id":29,"date":"2014-05-22","employee":"Ray M. Parra","customer":"Stepanie P. Lilley","status":"ready","fee":56.2,"taxes":22.1,"total":854.3,"shipping_company":"Shipping D","payment_method":"Cash"},
	{"id":30,"date":"2014-05-22","employee":"Sudie V. Goldsmith","customer":"Bradly N. Mauro","status":"new","fee":10,"taxes":12,"total":454,"shipping_company":"Shipping E","payment_method":"Credit Card"},
	{"id":31,"date":"2014-05-22","employee":"Romaine B. Alley","customer":"Sabrina N. Hermann","status":"cancelled","fee":85,"taxes":42,"total":987,"shipping_company":"Shipping A","payment_method":"Wire Transfer"},
	{"id":32,"date":"2014-05-22","employee":"Ray M. Parra","customer":"Roxanna C. Cass","status":"completed","fee":20,"taxes":8,"total":456,"shipping_company":"Shipping G","payment_method":"Credit Card"},
	{"id":33,"date":"2014-08-26","employee":"Jolie P. Sparks","customer":"Bradly N. Mauro","status":"new","fee":13,"taxes":1,"total":255,"shipping_company":"Shipping A","payment_method":"Cash"},
	{"id":34,"date":"2014-08-26","employee":"Sudie V. Goldsmith","customer":"Stephen H. Peachey","status":"new","fee":63,"taxes":12,"total":1522,"shipping_company":"Shipping B","payment_method":"Wire Transfer"},
	{"id":35,"date":"2014-08-26","employee":"Sherley D. Berryman","customer":"Sabrina N. Hermann","status":"ready","fee":78,"taxes":45,"total":1788,"shipping_company":"Shipping A","payment_method":"Wire Transfer"},
	{"id":36,"date":"2014-08-26","employee":"Ray M. Parra","customer":"Regine H.Field","status":"ready","fee":14,"taxes":4,"total":988,"shipping_company":"Shipping A","payment_method":"Cash"},
	{"id":37,"date":"2014-08-26","employee":"Romaine B. Alley","customer":"Stephane A. Chandler","status":"completed","fee":0,"taxes":0,"total":0,"shipping_company":"Shipping C","payment_method":"Credit Card"},
	{"id":38,"date":"2014-08-26","employee":"Jamila N. Mccallister","customer":"Olimpia C. Whelan","status":"new","fee":55,"taxes":13,"total":2100,"shipping_company":"Shipping E","payment_method":"Credit Card"},
	{"id":39,"date":"2014-08-26","employee":"Romaine B. Alley","customer":"Jettie P. Whelan","status":"ready","fee":18,"taxes":8,"total":956,"shipping_company":"Shipping A","payment_method":"Wire Transfer"},
	{"id":40,"date":"2014-08-26","employee":"Lane E. Dion","customer":"Stepanie P. Lilley","status":"completed","fee":133,"taxes":33,"total":754,"shipping_company":"Shipping D", "payment_method":"Cash"},

];

return {
	getAll:data
};

});
define('views/modules/data_pager',["models/orders"],function(orders){

	var titlePager = {
		view: "toolbar",
		css: "highlighted_header header5",
		paddingX:5,
		paddingY:5,
		height:40,
		cols:[
			{
				"template": "<span class='webix_icon fa-file-text-o'></span>Pager", "css": "sub_title2", borderless: true
			},
			{ view: "button", css: "button_transparent", type: "iconButton", icon: "external-link", label: "Export", width: 120},
			{ view: "button", css: "button_transparent", type: "iconButton", icon: "pencil-square-o", label: "Edit", width: 100}
		]
	};
	var gridPager =  {
		margin: 10,
		rows:[
			{
				id:"orderData",
				view:"datatable", select:true,
				columns:[
					{id:"id", header:"#", width:50},
					{id:"employee", header:["Employee", {content:"selectFilter"} ], sort:"string", minWidth:150, fillspace:1},
					{id:"customer", header:["Customer", {content:"selectFilter"} ], sort:"string", minWidth:150, fillspace:1},

					{id:"status", header:"Status", sort:"string", width:90},
					{id:"fee", header:"Fee", width:90, sort:"string", format:webix.i18n.priceFormat},
					{id:"taxes", header:"Taxes", width:90, sort:"string", format:webix.i18n.priceFormat},
					{id:"total", header:"Total", width:90, sort:"string", format:webix.i18n.priceFormat},
					{id:"shipping_company", header:"Shipping Company", sort:"string" },
					{id:"payment_method", header:"Payment method", width:130, sort:"string"},
					{id:"date", header:"Date", sort:"string", width:100},
					{id:"trash", header:"&nbsp;", width:50, template:"<span  style='color:#777777; cursor:pointer;' class='webix_icon fa-trash-o'></span>"}
				],
				export: true,
				on: {
					onAfterLoad: function(){
						this.select(4);
					}
				},
				onClick:{
					webix_icon:function(e,id){
						webix.confirm({
							text:"Are you sure sdfds", ok:"Yes", cancel:"Cancel",
							callback:function(res){
								if(res){
									webix.$$("orderData").remove(id);
								}
							}
						});
					}
				},
				autoheight:true,
				data:orders.getAll,
				pager: "pagerA"
			},
			{
				view:"pager", id:"pagerA",
				size:5,
				height: 35,
				group:5

			}
		]
	};


	var layout = {
		type:"material", rows:[{
			rows:[
				titlePager,
				gridPager
			]
		}]
	};

	return { $ui: layout };

});
define('views/datatables',[
	"views/modules/data_rating",
	"views/modules/data_treetable",
	"views/modules/data_progress",
	"views/modules/data_spans",
	"views/modules/data_pager"
], function(rating,treetable,progress,spans,pager){

var layout = {
	type: "clean",
	rows:[
		{
			cols:[
				{
					type:"material",
					rows:[
						rating,
						treetable
					]
				},
				{
					type:"material",
					gravity: 0.8,
					rows:[
						progress,
						spans
					]
				}

			]
		},
		pager
	]
};


return { $ui:layout };

});
define('models/files',[],function(){
	var folders = [
		{id: "files", value: "Files", open: true, data:[
			{ id: "documents", value: "Documents", open: true, data:[
				{id: "presentations", value: "Presentations"},
				{id: "reports", value: "Reports", open: true, data:[
					{id: "usa", value: "USA"},
					{id: "europe", value: "Europe"},
					{id: "asia", value: "Asia"}
				]}
			]},
			{ id: "images", value: "Images", open: true, data:[
				{id: "thumbnails", value: "Thumbnails"},
				{id: "base", value: "Base images"}
			]},
			{ id: "video", value: "Video"}
		]}
	];
	files = [
		{ id: "documents", value: "Documents", pId: "files"},
		{ id: "presentations", value: "Presentations",pId: "documents"},
		{ id: "reports", value: "Reports",pId: "documents"},
		{ id: "usa", value: "USA",pId: "reports"},
		{ id: "europe", value: "Europe",pId: "reports"},
		{ id: "asia", value: "Asia",pId: "reports"},
		{ id: "images", value: "Images", pId: "files"},
		{ id: "thumbnails", value: "Thumbnails",pId: "images"},
		{ id: "base", value: "Base images",pId: "images"},
		{ id: "video", value: "Video",pId: "files"},
		{id: "video1", value: "New Year 2013.avi", icon: "file-video-o", type:"video",   date: "2014-01-01 16:01", size: "25.83 MB", pId: "video" },
		{id: "video2", value: "Presentation.avi", icon: "file-video-o",type:"video",  date: "2014-10-04 12:05", size: "110.72 MB" , pId: "video"},
		{id: "pres1", value: "October 2014.ppt", icon: "file-powerpoint-o", type:"pp", date: "2014-03-10 16:01", size: "12.83 KB",pId: "presentations"},
		{id: "pres2", value: "June 2014.ppt", icon: "file-powerpoint-o",  type:"pp", date: "2014-03-10 16:03", size: "20.10 KB",pId: "presentations"},
		{id: "pres3", value: "April 2014.ppt", icon: "file-powerpoint-o",  type:"pp", date: "2014-03-10 16:04", size: "15.75 KB",pId: "presentations"},
		{id: "pres4", value: "November 2013.ppt", icon: "file-powerpoint-o",  type:"pp", date: "2014-03-10 16:05", size: "13.13 KB",pId: "presentations"},
		{id: "salesUS", value: "Sales USA.ppt", icon: "file-excel-o",  type:"ex", date: "2014-03-10 16:01", size: "12.83 KB",pId: "usa"},
		{id: "overviewUS", value: "Overview USA.doc", icon: "file-text-o",  type:"doc", date: "2014-03-10 16:01", size: "15.03 KB",pId: "usa"},
		{id: "pricesUS", value: "Prices USA.ppt", icon: "file-excel-o", type:"ex",  date: "2014-03-10 16:01", size: "15.83 KB",pId: "usa"},
		{id: "productsUS", value: "Products USA.ppt", icon: "file-excel-o",  type:"ex", date: "2014-03-10 16:01", size: "20.83 KB",pId: "usa"},
		{id: "salesEurope", value: "Sales Europe.ppt", icon: "file-excel-o",  type:"ex", date: "2014-03-10 16:01", size: "12.83 KB", pId: "europe"},
		{id: "pricesEurope", value: "Prices Europe.ppt", icon: "file-excel-o", type:"ex",  date: "2014-03-10 16:01", size: "15.83 KB", pId: "europe"},
		{id: "productsEurope", value: "Products Europe.ppt", icon: "file-excel-o", type:"ex",  date: "2014-03-10 16:01", size: "20.83 KB", pId: "europe"},
		{id: "overviewEurope", value: "Overview Europe.doc", icon: "file-text-o",  type:"doc", date: "2014-03-10 16:01", size: "15.03 KB",pId: "europe"},
		{id: "salesAsia", value: "Sales Asia.ppt", icon: "file-excel-o", type:"ex",  date: "2014-03-10 16:01", size: "12.83 KB", pId: "asia"},
		{id: "pricesAsia", value: "Prices Asia.ppt", icon: "file-excel-o",  type:"ex", date: "2014-03-10 16:01", size: "15.83 KB", pId: "asia"},
		{id: "overviewAsia", value: "Overview Asia.doc", icon: "file-text-o",  type:"doc", date: "2014-03-10 16:01", size: "15.03 KB",pId: "asia"},
		{id: "productsAsia", value: "Products Asia.ppt", icon: "file-excel-o",  type:"ex", date: "2014-03-10 16:01", size: "20.83 KB", pId: "asia"},
		{id: "thumbnails1", value: "Product 1-th.jpg", icon: "file-image-o", type:"img",  date: "2014-03-10 16:01", size: "34.83 KB", pId: "thumbnails"},
		{id: "thumbnails2", value: "Product 2-th.jpg", icon: "file-image-o",  type:"img",  date: "2014-03-10 16:03", size: "40.10 KB", pId: "thumbnails"},
		{id: "thumbnails3", value: "Product 3-th.jpg", icon: "file-image-o",  type:"img",  date: "2014-03-10 16:04", size: "33.75 KB", pId: "thumbnails"},
		{id: "thumbnails4", value: "Product 4-th.jpg", icon: "file-image-o", type:"img",   date: "2014-03-10 16:05", size: "35.13 KB", pId: "thumbnails"},
		{id: "thumbnails5", value: "Product 5-th.jpg", icon: "file-image-o",  type:"img",  date: "2014-03-10 16:06", size: "34.72  KB", pId: "thumbnails"},
		{id: "thumbnails6", value: "Product 6-th.jpg", icon: "file-image-o", type:"img",   date: "2014-03-10 16:08", size: "37.06  KB", pId: "thumbnails"},
		{id: "base1", value: "Product 1.jpg", icon: "file-image-o", type:"img",   date: "2014-03-10 16:01", size: "74.83 KB", pId: "base"},
		{id: "base2", value: "Product 2.jpg", icon: "file-image-o", type:"img",   date: "2014-03-10 16:03", size: "80.10 KB", pId: "base"},
		{id: "base3", value: "Product 3.jpg", icon: "file-image-o", type:"img",   date: "2014-03-10 16:04", size: "73.75 KB", pId: "base"},
		{id: "base4", value: "Product 4.jpg", icon: "file-image-o", type:"img",   date: "2014-03-10 16:05", size: "75.13 KB", pId: "base"},
		{id: "base5", value: "Product 5.jpg", icon: "file-image-o", type:"img",   date: "2014-03-10 16:06", size: "74.72 KB" , pId: "base"},
		{id: "base6", value: "Product 6.jpg", icon: "file-image-o", type:"img",   date: "2014-03-10 16:08", size: "77.06 KB", pId: "base"},
		{id: "video1", value: "New Year 2013.avi", icon: "file-video-o", type:"video",   date: "2014-01-01 16:01", size: "25.83 MB", pId: "video" },
		{id: "video2", value: "Presentation.avi", icon: "file-video-o",type:"video",  date: "2014-10-04 12:05", size: "110.72 MB" , pId: "video"},
		{id: "video3", value: "Conference.avi", icon: "file-video-o", type:"video", date: "2014-11-03 18:05", size: "312.56 MB", pId: "video" }
	];

	for (var i = 1; i < 100; i++)
		files.push({ pId: "files", value:"backup."+((i<10)?"00":"0")+i+".zip", icon:"file-zip-o", type:"zip", size:"500 MB" })
	
	return {
		folders:folders,
		files:files
	};

});

webix.protoUI({
	name:"edittree"
}, webix.EditAbility, webix.ui.tree);
define("views/webix/editable", function(){});

webix.type(webix.ui.tree, {
	name:"fileTree",
	css: "file",
	height: 40,
	templateCommon:webix.template("{common.icon()} <div class='folder_title'>{common.folder()} #value#</div>"),
	folder:function(obj, common){
		return "<span class='webix_icon icon fa-folder"+(obj.open?"-open":(obj.$level>3?"-o":""))+"'></span>";
	}
});
define("views/webix/filetree", function(){});

define('views/modules/edittree',["models/files","views/webix/editable","views/webix/filetree"], function(files){

	var tree = {
		id: "fileTree",
		view: "edittree",
		editable:true,
		editor:"text",
		editaction: "",
		editValue:"value",
		select: true,
		drag: true,
		data: files.folders,
		type: "fileTree",
		on:{
			onAfterSelect: function(id){
				var value = this.getItem(id).value;
				$$("filesView").filter("#pId#",id);
				var folders = [];
				while(id){
					folders.push(this.getItem(id).value+"/");
					id = this.getParentId(id);
				}
				folders.reverse();
				$$("path").setValue(folders.join(""));
			}
		}
	};


	return {
		$ui:tree
	};


});
webix.type(webix.ui.dataview, {
	name:"fileView",
	css: "files",
	height: 80,
	width: 150,

	template: function(obj){
		var icon = (obj.icon||"folder-o");
		return "<div class='"+(obj.type||"folder")+"'><span class='webix_icon fa-"+icon+"'></span></div>"+obj.value;
	}

});
define("views/webix/fileview", function(){});

define('views/files',["models/files",	"views/modules/edittree","views/webix/fileview"], function(files,tree){
	var layout = {
		type:"clean", margin:-8,
		rows:[
			{ type:"material", rows:[{
				view: "form",
				padding:10,
				cols:[
					{view: "button", type: "icon", icon: "folder-o", label: "New folder", width: 140, click: function(){
						$$("fileTree").add( {value:"New folder"}, 0, $$("fileTree").getSelectedId());
					}},

					{view: "button", type: "icon", icon: "pencil-square-o", label: "Rename", width: 120, click:function(){
						$$("fileTree").edit($$("fileTree").getSelectedId());
					}},
					{view: "button", type: "icon", icon: "refresh", label: "Refresh", width: 125},
					{view: "button", type: "icon", icon: "times", label: "Delete", width: 115},
					{},

					{view: "button", css:"upload_icon", type: "icon", icon: "plus", label: "Upload", width: 120, click: function(){
						$$("fileUploadAPI").fileDialog({});
					}}
				]
			}]},
			{
				type: "material",
				cols:[{
					width: 250, 
					rows:[
						tree,
						{
							view: "form",
							css: "highlighted_header header6",
							paddingX:5,
							paddingY:5,
							height:40,

							elements:[
							  {view: "text", label: "Path:", labelAlign: "right", labelWidth: 60, id: "path"}
							]
						}
					]
				},
				{ view: "resizer"},
				{ 
					rows: [
					{ view: "dataview", edit: true, select: true, id: "filesView", type: "fileView", drag: true,
					  onDblClick: {
						webix_dataview_item: function(e,id){
						  if($$("fileTree").exists(id))
							$$("fileTree").select(id);
						}
					  }
					}
				  ]
				}]
			}
		]
	};

	return {
		$ui: layout,
		$oninit:function(){
			$$("filesView").parse(files.files);
			$$("fileTree").select("files");

			webix.ui({
				id:"fileUploadAPI",
				view:"uploader",
				upload:	"server/upload.php",
				on:{
					onFileUploadError: function(item){
						webix.alert("Error during file upload");
					}
				},
				apiOnly:true
			});


			$$("filesView").attachEvent("onDestruct", function(){
				$$("fileUploadAPI").destructor();
			});

		}
	}
});
define('views/modules/form_user',[],function(){
	var layout = {

		type: "clean",
		rows:[
			{
				view: "toolbar",
				css: "highlighted_header header1",
				paddingX:5,
				paddingY:5,
				height:40,
				cols:[
					{
						"template": "<span class='webix_icon fa-male'></span>User", "css": "sub_title2", borderless:true
					},
					{
						view: "button", css: "button_transparent", label: "Close", width: 80
					}
				]
			},
			{
				view: "form",
				id: "userForm",
				elementsConfig:{
					labelWidth: 120
				},
				elements:[
					{view: "text", placeholder: "Type here...", label: "First Name",name: "name1"},
					{view: "text", placeholder: "Type here...", label: "Last Name", name: "name2"},
					{view: "datepicker", placeholder: "Select here...", label: "Date of Birth", name: "date"},
				
					{view: "text", placeholder: "Type here...", label: "Phone Number"},
					{
						margin: 10,
						paddingX: 2,
						borderless: true,
						cols:[
              {view: "button", css: "button_danger", label: "Delete", type: "form", align: "left"},
							{},
							{view: "button", css: "", label: "Reset",  align: "right"},
              {view: "button", css: "button_primary button_raised", label: "Save", type: "form", align: "right"}
						]
					}

				]

			}
		]
	};

	return { $ui: layout };

});

define('views/modules/form_project',[],function(){
	var layout = {

		"type": "clean",
		"rows":[
			{
				view: "toolbar",
				css: "highlighted_header header2",
				paddingX:5,
				paddingY:5,
				height:40,
				cols:[
					{
						"template": "<span class='webix_icon fa-sliders'></span>Project", "css": "sub_title2", borderless: true
					},
					{
						view: "richselect", value:"Webix", options: ["Webix", "Kanban", "Pivot"], width: 105
					}
				]

			},
			{
				view: "form",
				id: "projectForm",
				elementsConfig:{
					labelWidth: 100
				},
				elements:[

					{ view:"slider", css: "slider3", label:"Task 1", value:"80",step:1, name:"s1", title: webix.template("#value#%")},
					{ view:"slider", css: "slider2", label:"Task 2", value:"20", step:1, name:"s2", title: webix.template("#value#%")},
					{ view:"slider", css: "slider1", label:"Task 3", value:"60", step:1, name:"s3", title: webix.template("#value#%")},
					{
						margin: 10,
						paddingX: 2,
						borderless: true,
						cols:[
							{},
							{view: "button", css: "button_primary button_raised", label: "Next", type: "form", align: "right",width: 80},
              {view: "button", css: "button_success button_raised", label: "Finish", type: "form", align: "right",width: 100}
						]
					}
				]
			}
		]
	};

	return { $ui: layout };

});

define('views/modules/form_event',[],function(){
	var layout = {

		type: "clean",
		rows:[
			{
				view: "toolbar",
				css: "highlighted_header header3",
				paddingX:5,
				paddingY:5,
				height:40,
				cols:[
					{
						"template": "<span class='webix_icon fa-star-o'></span>Event", "css": "sub_title2", borderless:true
					},
					{
						view: "button", css: "button_transparent", label: "Close", width: 80
					}
				]
			},
			{
				view: "form",
				elementsConfig:{
					labelWidth: 100
				},
				elements:[
					{view: "text", placeholder: "Type here...", label: "Event Name"},
					{view: "datepicker", label: "Start Date", value: new Date(), timepicker:true, format: "%H:%i %D, %d %M"},
					{view: "datepicker", label: "End Date", value: webix.Date.add(new Date(),1,"hour"), format: "%H:%i %D, %d %M", timepicker:true},
					{view: "checkbox", label: "All-day"},
					{view: "richselect", label: "Calendar", value:"1", options:[
						{id:1, value: "My Calendar"},
						{id:2, value: "Webix project"},
						{id:3, value: "Other"}
					]},
					{view: "textarea", placeholder: "Type here...", label: "Details", height: 80},
					{
						margin: 10,
						paddingX: 2,
						borderless: true,
						cols:[
              				{view: "button", css: "button_warning button_raised", label: "Warning", type: "form", align: "left"},
							{},
							{view: "button", label: "Reset",  align: "right"},
							{view: "button", css: "button_success button_raised", label: "Save", align: "right"}
						]
					}

				]

			}
		]
	};

	return { $ui: layout };

});

define('views/modules/form_style',[],function(){
	var layout = {
		type: "clean",
		rows:[
			{
				view: "toolbar",
				css: "highlighted_header header4",
				paddingX:5,
				paddingY:5,
				height:40,
				cols:[
					{
						"template": "<span class='webix_icon fa-paint-brush'></span>Style", "css": "sub_title2", borderless:true
					},
					{view: "segmented", options:["Header","Content","Buttons"],width: 210}
				]
			},
			{
				view: "form",
				elementsConfig:{
					labelWidth: 100,
					labelPosition: "top"
				},
				elements:[
					{ view: "combo", label: "Font Family", value: "Arial", options:["Arial", "Tahoma", "Verdana"]},
					{ view:"radio", name:"fontWeigth", label:"Font Weigth", value:"400",  options:["400", "500", "700"] },
					{ view: "colorpicker", label: "Background", value: "#a693eb"},
					{ view: "colorpicker",  label: "Font Color", value: "#a4b4bf"},

					{ view: "text", placeholder: "Type here...", label: "Font Size (px)", value: "14"},
					{
						margin: 10,
						paddingX: 2,
						borderless: true,
						cols:[
							{},
              				{view: "button", type:"iconButton", icon:"angle-left", label: "Back",  align: "right", width: 110},
							{view: "button", css: "button_info", type: "info", label: "Info",  align: "right", width: 90},
							{view: "button", css: "button_primary button_raised", type:"form", label: "Done",  align: "right", width: 90}
						]
					}

				]

			}
		]
	};

	return { $ui: layout };

});

define('views/forms',[
	"views/modules/form_user",
	"views/modules/form_project",
	"views/modules/form_event",
	"views/modules/form_style"
],function(user, project, event, style){

	var layout = {
		
		cols:[
			{type: "material",
				rows: [
					user,
					event
				]
			},
			{type: "material",
				rows: [
					style,
					project
				]
			}
		]

	};

	return { $ui:layout };

});

define('views/forms/order',[],function(){

	return {
		$ui:{
			view:"window", modal:true, id:"order-win", position:"center",
			head:"Add new order",
			body:{
				paddingY:20, paddingX:30, elementsConfig:{labelWidth: 140}, view:"form", id:"order-form", elements:[
					{ view:"combo", name:"customer", label:"Customer", id:"order-customer", options:[{ id:"1", value:"Virgen C. Holcombe"}, { id:"2", value:"Tory H. Ventura"}, { id:"3", value:"Jacquline A. Coats"}, { id:"4", value:"Jamila N. Mccallister"}, { id:"5", value:"Sabrina N. Hermann"}, { id:"6", value:"Bradly N. Mauro"}, { id:"7", value:"Ashleigh G. Denham"}, { id:"8", value:"Stephen H. Peachey"}, { id:"9", value:"Amado T. Cano"}, { id:"10", value:"Olimpia C. Whelan"}, { id:"11", value:"Regine H. Field"}, { id:"12", value:"Roxanna C. Cass"}, { id:"13", value:"Reba H. Casteel"}, { id:"14", value:"Jettie P. Whelan"}, { id:"15", value:"Sherry G. Richards"}, { id:"16", value:"Stephane A. Chandler"}, { id:"17", value:"Amee A. Marshall"}], width:350},
					{ view:"combo", name:"employee", label:"Salesperson", id:"order-sales", options:[{ id:"1", value:"Ray M. Parra"}, { id:"2", value:"Suellen G. Ritter"}, { id:"3", value:"Janelle P. Blunt"}, { id:"4", value:"Cristopher B. Acker"}, { id:"5", value:"Lane E. Dion"}, { id:"6", value:"Rossana M. Mcknight"}, { id:"7", value:"Becki P. Perryman"}, { id:"8", value:"Jolie P. Sparks"}, { id:"9", value:"Shirley M. Mattingly"}, { id:"10", value:"Rosario H. Mccracken"}, { id:"11", value:"Sudie M. Goldsmith"}, { id:"12", value:"Sherley D. Berryman"}, { id:"13", value:"Romaine B. Alley"}, { id:"14", value:"Giovanni B. Weston"}]},
					{ view:"combo", name:"product", label:"Product", id:"order-product", options:[{ id:1, value:"Webix Chai"}, { id:2, value:"Webix Syrup"}, { id:3, value:"Webix Cajun Seasoning"}, { id:4, value:"Webix Olive Oil"}, { id:5, value:"Webix Boysenberry Spread"}, { id:6, value:"Webix Dried Pears"}, { id:7, value:"Webix Curry Sauce"}, { id:8, value:"Webix Walnuts"}, { id:9, value:"Webix Fruit Cocktail"}, { id:10, value:"Webix Chocolate Biscuits Mix"}, { id:11, value:"Webix Marmalade"}, { id:12, value:"Webix Scones"}, { id:13, value:"Webix Beer"}, { id:14, value:"Webix Crab Meat"}, { id:15, value:"Webix Clam Chowder"}, { id:16, value:"Webix Coffee"}, { id:17, value:"Webix Chocolate"}]},
					{ view:"combo", name:"shipment", label:"Shipping Company", id:"shipping_company", options:[ "Shipping A", "Shipping B", "Shipping C", "Shipping D", "Shipping E", "Shipping F", "Shipping G"]},
					{ view:"datepicker", label:"Order Date", value:new Date(), format:"%d  %M %Y" },
					{
						margin:10,
						cols:[
							{},
							{ view:"button", label:"Add", type:"form", align:"center", width:120, click:function(){
								webix.$$("order-win").close();
							}},
							{ view:"button", label:"Cancel",align:"center", width:120, click:function(){
								webix.$$("order-win").close();
							}}
						]
					}

				]
			}
		}
	};

});
define('views/menus/export',[],function(){

return {
	$ui:{
		view: "submenu",
		id: "exportPopup",
		width: 200,
		padding:0,
		data: [
			{id: 1, icon: "file-excel-o", value: "Export To Excel"},
			{id: 2, icon: "file-pdf-o", value: "Export To PDF"}
		],
		on:{
			onItemClick:function(id){
				if(id==1){
					$$("orderData").exportToExcel();
				}
				else if(id==2)
					$$("orderData").exportToPDF();
			}
		}
	}
};
	
});
webix.protoUI({
	name:"ckeditor",
	$init:function(config){
		this.$view.className += " webix_selectable";
	},
	defaults:{
		borderless:true,
		toolbar: [
			[ 'Bold', 'Italic', '-', 'NumberedList', 'BulletedList', '-', 'Link', 'Unlink' ],
			[ 'FontSize', 'TextColor', 'BGColor' ]
		]
	},
	_init_ckeditor_once:function(){
		var tid = this.config.textAreaID = "t"+webix.uid();
		this.$view.innerHTML = "<textarea id='"+tid+"'>"+this.config.value+"</textarea>";

		window.CKEDITOR_BASEPATH = webix.codebase+"ckeditor/";
		var t = {
			toolbar: this.config.toolbar,
			width:this.$width -2,
			height:this.$height - 44
		};
		webix.extend(t,this.config.editor||{});
		webix.require("ckeditor/ckeditor.js", function(){
			this._3rd_editor = CKEDITOR.replace( this.config.textAreaID, t);
		}, this);
	},
	_set_inner_size:function(x, y){
		if (!this._3rd_editor || !this._3rd_editor.container || !this.$width) return;
		this._3rd_editor.resize(x, y);
	},
	$setSize:function(x,y){
		if (webix.ui.view.prototype.$setSize.call(this, x, y)){
			this._init_ckeditor_once();
			this._set_inner_size(x,y);
		}
	},
	setValue:function(value){
		this.config.value = value;
		if (this._3rd_editor)
			this._3rd_editor.setData(value);
		else webix.delay(function(){
			this.setValue(value);
		},this,[],100);
	},
	getValue:function(){
		return this._3rd_editor?this._3rd_editor.getData():this.config.value;
	},
	focus:function(){
		this._focus_await = true;
		if (this._3rd_editor)
			this._3rd_editor.focus();
	},
	getEditor:function(){
		return this._3rd_editor.getData();
	}
}, webix.ui.view);
define("views/webix/ckeditor", function(){});

define('views/modules/editor',["views/webix/ckeditor"], function(){

	var form = {
		view: "form",
		id: "mainView",
		elementsConfig:{

			labelWidth: 130
		},
		scroll: true,
		elements:[
			{view: "text", placeholder: "Type here...", name: "code", label: "Code"},
			{view: "text", placeholder: "Type here...", name: "name", label: "Name"},
			{view: "text", placeholder: "Type here...", name: "price", label: "Price"},
			{view: "richselect", placeholder: "Select here...", name: "category", label:"Category", vertical: true, options:[
				{id:2, value: "Home furniture"},
				{id:3, value: "Office furniture"},
				{id:1, value: "Wood furniture"}
			]},
			{view:"richselect", placeholder: "Select here...", name:"status", value: "all",label: "Status", options:[
				{id:"1", value:"Published"},
				{id:"2", value:"Not published"},
				{id:"0", value:"Deleted"}
			]},
			{view: "checkbox", name: "in_stock", label: "In stock",value: 1},
			{ view: "label", label: "Full description", height:30},
			{ id:'editor', view:"ckeditor", value:"", editor:{language: 'en'}, minHeight: 220},

			{}
		]
	};

	var layout = form;

	return {
		$ui:layout
	};
	

});
define('views/modules/product_meta',[],function(){
	return {
		$ui:{
			view: "form",
			id: "metaView",
			elementsConfig:{
				labelWidth: 130
			},
			elements:[
				{view: "text", placeholder: "Type here...", name: "meta_title", label: "Title"},
				{view: "textarea", placeholder: "Type here...", label: "Meta Keywords",gravity:1,minHeight:80},
				{view: "textarea", placeholder: "Type here...", label: "Meta Description",gravity:1.5,minHeight:80},
				{}
			]
		}
	}
});
define('models/products',[],function(){

	var number = 150;
	var data = [];
	var code = 201;
	for(var i=0; i<number; i++){
		var status = Math.floor(Math.random() * 4);
		var price = Math.floor(Math.random() * (1500-499))+499;
		var quantity = Math.floor(Math.random() * (400-3))+3;
		var inStore = Math.floor(Math.random() * 9);
		var category = (price>1100?1:(price>800?2:3));
		data.push({
			id: i+1,
			code: "WBX"+code,
			name: "Test product "+( i+1),
			category: category,
			categoryName:(category == 1?"Wood furniture":(category == 2?"Home furniture":"Office furniture")),
			price: price,
			statusName:(status>1?"Published":(status==1?"Not published":"Deleted")),
			status: (status>1?"1":(status==1?"2":"0")),
			quantity:quantity,
			in_stock: (inStore>1)
		});
		code++;
	}

	return {
		getAll:data
	};

});
define('views/modules/product_search',["models/products"],function(products){
	return {
		$ui:{
			rows:[
				{
					view: "form",

					paddingX:5,
					paddingY:5,
					margin: 2,
					rows:[
						{view: "label", label: "Find product:"},
						{view: "search", placeholder: "Type here..."}
					]
				},
				{
					view: "list",
					id: "list",
					select: true,
					template: "<div class='marker status#status#'></div>#code# / #name#",
					data: products.getAll
				}
			]
		}
	};
});
define('views/modules/product_upload',[],function(){
	return {
		$ui:{
			id:"imagesView",
			padding: 10,
			margin: 10,
			rows:[
				{
					cols:[
						{},
						{
							view:"button", css: "button_primary button_raised", type:"iconButton", icon: "plus-circle", label: "Add image record", width: 210
						}
					]
				},
				{
					css:"bg_panel_raised",
					view:"datatable",
					editable:true,
					columns:[
						{ id:"photo",	header:"Image",  template:"<span class='product_image webix_icon fa-#icon#'></span>", fillspace:1},
						{ id:"title",  editor:"text",	header:"Title",fillspace:1.7},
						{ id:"usage",  editor:"select",	options:["Main image", "Thumbnail"],	header:"Usage", fillspace:1.2},
						{ id:"upload",	header:"Upload" , template:"<div title='Click to upload' class='product_image_action'><span class='webix_icon fa-download'></span>Upload</div>", fillspace:1},
						{ id:"delete",	header:"Delete" , template:"<div title='Click to delete' class='product_image_action'><span class='webix_icon fa-times'></span>Delete</div>", fillspace:1}
					],
					autoheight:true,
					rowHeight:80,
					data: [
						{ id:1, title:"Product image 1", usage:"Main image", icon: "camera"},
						{ id:2, title:"Product image 2", usage:"Thumbnail", icon: "camera"}
					],
					on:{
						onAfterLoad: function(){
							webix.ui({
								id:"uploadAPI",
								view:"uploader",
								upload:	"server/upload.php",
								on:{
									onFileUploadError: function(item){
										webix.alert("Error during file upload");
									}
								},
								apiOnly:true
							});
						},
						onItemClick:function(id){
							if (id.column == "upload")
								$$("uploadAPI").fileDialog({ rowid : id.row });
						},
						onDestruct: function(){
							$$("uploadAPI").destructor();
						}
					}
				},
				{}
			]

		}
	}
});
define('models/topsales',[],function(){

	var data =[
	{productId:1,value: 15000,selection: "month", name:"Chai"},
	{productId:1,value: 35000,selection: "month3", name:"Chocolate"},
	{productId:1,value: 130000,selection: "year", name:"Chai"},
	{productId:2,value: 20000,selection: "month", name:"Olive Oil"},
	{productId:2,value: 50000,selection: "month3", name:"Olive Oil"},
	{productId:2,value: 140000,selection: "year", name:"Olive Oil"},
	{productId:3,value: 17000,selection: "month", name:"Coffee"},
	{productId:3,value: 40000,selection: "month3", name:"Coffee"},
	{productId:3,value: 120000,selection: "year", name:"Coffee"},
	{productId:4,value: 9000,selection: "month", name:"Syrup"},
	{productId:4,value: 45000,selection: "month3", name:"Marmalade"},
	{productId:4,value: 100500,selection: "year", name:"Syrup"}
];

	return {
		getAll:data
	};

});
define('views/modules/topsales',["models/topsales"],function(topsales){

	var chart = {
		view:"chart",
		borderless: true,
		type: "bar",
		height: 130,
		id: "productsBar",
		barWidth: 60,
		radius:0,
		alpha: 0.9,
		color: function(obj){
			var color = "#a693eb";
			if(obj.productId == 2)
				color = "#63b4ea";
			else if(obj.productId == 3){
				color = "#f19b60";
			}
			else if(obj.productId == 4){
				color = "#49cd81";
			}

			return color;
		},
		yAxis:{
			template: function(value){ return parseInt(value,10); }
		},
		xAxis: {
			template: "#name#"
		},
		on: {
			onAfterLoad: function(){
				$$("topSelling").setValue("month");
			}
		},
		padding:{
			top:0,
			left:50,
			right:10,
			bottom: 20
		},
		data: topsales.getAll
	};

	var form = {
		type: "form",
		cols:[
			{
				view: "radio", id:"topSelling", label: "", labelWidth: 0, vertical: true,on:{
				onChange: function(){
					$$("productsBar").filter(function(obj){ return obj.selection == $$("topSelling").getValue(); });
				}
			},
				options: [
					{id: "month", value:"Last month"},
					{id: "month3", value: "Last 3 months"}
				]
			}
		]
	};

	var layout = {
		rows:[
			{
				view: "toolbar",
				paddingX:5,
				paddingY:5,
				height:40,	css: "highlighted_header header3", elements:[
					{"template": "<span class='webix_icon fa-bar-chart'></span>Top selling products", borderless: true,"css": "sub_title2"}
				]

			},
			form,
			chart		
		]
	};


	return { $ui: layout };

});

define('views/orders',[
	"views/forms/order",
	"views/menus/export",
	"models/orders"
], function(orderform, exports, orders){

	var controls = [
		{ view: "button", css: "button_primary button_raised", type: "iconButton", icon: "plus", label: "Add order", width: 150, click: function(){
			this.$scope.ui(orderform.$ui).show();
		}},
		{ view: "button", css: "button_primary button_raised", type: "iconButton", icon: "external-link", label: "Export", width: 120, popup: exports},
		{},
		{view:"richselect", id:"order_filter", value: "all", maxWidth: 400, minWidth: 250, vertical: true, labelWidth: 100, options:[
			{id:"all", value:"All"},
			{id:"new", value:"Need Invoicing"},
			{id:"ready", value:"Ready to Ship"},
			{id:"completed", value:"Completed"},
			{id:"cancelled", value:"Cancelled"}
		],  label:"Filter orders", on:{
			onChange:function(){
				var val = this.getValue();
				if(val=="all")
					$$("orderData").filter("#status#","");
				else
					$$("orderData").filter("#status#",val);
			}
		}
		}
	];

	var grid = {
		margin:10,
		rows:[
			{
				id:"orderData",
				view:"datatable", select:true,
				columns:[
					{id:"id", header:"#", width:50},
					{id:"employee", header:["Employee", {content:"selectFilter"} ], sort:"string", minWidth:150, fillspace:1},
					{id:"customer", header:["Customer", {content:"selectFilter"} ], sort:"string", minWidth:150, fillspace:1},

					{id:"status", header:"Status", sort:"string", width:90},
					{id:"fee", header:"Fee", width:90, sort:"string", format:webix.i18n.priceFormat},
					{id:"taxes", header:"Taxes", width:90, sort:"string", format:webix.i18n.priceFormat},
					{id:"total", header:"Total", width:90, sort:"string", format:webix.i18n.priceFormat},
					{id:"shipping_company", header:"Shipping Company", sort:"string" },
					{id:"payment_method", header:"Payment method", width:130, sort:"string"},
					{id:"date", header:"Date", sort:"string", width:100},
					{id:"trash", header:"&nbsp;", width:45, template:"<span  style='color:#777777; cursor:pointer;' class='webix_icon fa-trash-o'></span>"}
				],
				export: true,
				on: {
					onAfterLoad: function(){
						this.select(4);
					}
				},
				pager:"pagerA",
				data: orders.getAll,
				onClick:{
					webix_icon:function(e,id,node){
						webix.confirm({
							text:"The order will be deleted.<br/> Are you sure?", ok:"Yes", cancel:"Cancel",
							callback:function(res){
								if(res){
									webix.$$("orderData").remove(id);
								}
							}
						});
					}
				}
			}
		]

	};

	var layout = {
		type: "material",
		rows: [
			{
				height: 40,
				css:"bg_clean",
				cols: controls
			},
			{
				rows:[
					grid,
					{
						view: "toolbar",
						paddingX:5,
						paddingY:5,
						height:40,
						cols:[{
							view:"pager", id:"pagerA",
							template:"{common.pages()}",
							autosize:true,
							height: 35,
							group:5
						}

						]
					}
				]
			}



		]

	};

	return {
		$ui: layout
	};

});
define('views/product_edit',[
	"views/modules/product_search",
	"views/modules/editor",

	"views/modules/product_upload",
	"views/modules/product_meta"
], function(search,editor,upload,meta){

var mainView = {};


var layout = {
			type: "material",
			cols:[
				search,
				{
					gravity: 2.2,
					type: "line",
					rows:[
						{ rows: [{
							view: "tabbar", multiview: true, optionWidth: 100,
							options:[
								{id: "mainView", value: "Main"},
								{id: "imagesView", value: "Images"},
								{id: "metaView", value: "Meta"}
							  ]
							}]
						},
						{
							cells:[
								editor,
								upload,
								meta
							]
						},
						{

							view: "form",
							css: "highlighted_header header6",
							paddingX:5,
							paddingY:5,
							height:40,

							cols:[
								{ view: "button", css: "button_primary button_raised", type: "form", icon: "plus", label: "Save", width: 90},
								{ view: "button", css: "button2", icon: "angle-left", label: "Reset", width: 90},

								{},
								{ view: "button", css: "button_danger button0", icon: "times", label: "Delete", width: 90}
							]
						}
					]
				}
			]
};


return {
	$ui:layout,
	$oninit:function(){

		$$("mainView").bind($$("list"));
	}
};

});
define('views/products',[
	"views/modules/editor",
	"views/modules/topsales",
	"models/products"
], function(editor, topsales, products){


var grid = {
	id:"productsData",
	view:"datatable", select:true, editable:true, editaction:"dblclick",
	columns:[
		{id:"id", header:"#", width:50},


		{id:"code", header:["Code", {content:"textFilter"} ], sort:"string", minWidth:70, fillspace: 1},
		{id:"name", header:["Name", {content:"textFilter"} ], sort:"string", minWidth:120, fillspace: 2, editor:"text"},
		{id:"categoryName", header:["Category", {content:"selectFilter"} ], sort:"string", minWidth:120, fillspace: 2, editor:"select",  template:"<div class='category#category#'>#categoryName#</div>"},
		{id:"price", header:["Price"], sort:"int", minWidth:80, fillspace: 1, format:webix.i18n.priceFormat},
		{id:"quantity", header:["Quantity" ], sort:"int", minWidth:50, fillspace: 1},
		{id:"statusName", header:["Status"], minWidth:110, sort:"string", fillspace: 1, template:"<span class='status status#status#'>#statusName#</span>"},

		{id:"edit", header:"&nbsp;", width:50, template:"<span  style=' cursor:pointer;' class='webix_icon fa-pencil'></span>"},
		{id:"delete", header:"&nbsp;", width:50, template:"<span  style='cursor:pointer;' class='webix_icon fa-trash-o'></span>"}
	],
	pager:"pagerA",
	"export":true,
	data:products.getAll,
	onClick:{
		"fa-trash-o":function(e,id,node){
			webix.confirm({
				text:"The product will be deleted. <br/> Are you sure?", ok:"Yes", cancel:"Cancel",
				callback:function(res){
					if(res){
						var item = webix.$$("productsData").getItem(id);
						item.status = "0";
						item.statusName = "Deleted";
						webix.$$("productsData").refresh(id);
					}
				}
			});
		}
	},
	ready:function(){
		webix.extend(this, webix.ProgressBar);
	}
};


	var layout = {
		type: "material",
		rows:[
			{
				css:"bg_clean",
				height: 40,
				cols: [
					{view: "button", css: "button_primary button_raised", type: "iconButton", icon:"file-excel-o",width:190, label: "Export To Excel", click: function(){$$("productsData").exportToExcel();}},
					{view: "button", css: "button_primary button_raised", type: "iconButton", icon:"refresh",width:130, label: "Refresh", click: function(){
						var grid = $$("productsData");
						grid.clearAll();
						grid.showProgress();
						webix.delay(function(){
							grid.parse(products.getAll);
							grid.hideProgress();
						}, null, null, 300);
					}},
					{},
					{view:"richselect", id:"order_filter", value: "all", maxWidth: 300, minWidth: 250, vertical: true, labelWidth: 110, options:[
						{id:"all", value:"All"},
						{id:"1", value:"Published"},
						{id:"2", value:"Not published"},
						{id:"0", value:"Deleted"}
					],  label:"Filter products", on:{
						onChange:function(){
							var val = this.getValue();
							if(val=="all")
								$$("productsData").filter("#status#","");
							else
								$$("productsData").filter("#status#",val);
						}
					}
					}
				]
			},
			{
				rows:[
					grid,
					{
						view: "toolbar",
						css: "highlighted_header header6",
						paddingX:5,
						paddingY:5,
						height:40,
						cols:[{
							view:"pager", id:"pagerA",
							template:"{common.pages()}",
							autosize:true,
							height: 35,
							group:5
						}

						]
					}
				]
			}


		]

	};

return { $ui:layout };

});
define('views/typography/buttons',[],function(){

var row1 = { type:"clean", rows:[{               
    type:"clean", margin:20, cols:[
      {view: "button", label: "Ordinary", align: "left"},
      {view: "button", label: "Disabled", align: "left", disabled: true},
      {view: "button", label: "Primary", css: "button_primary", align: "left"},
      {view: "button", label: "Info", css: "button_info", align: "left"}
    ]
  },
  {
    type:"clean", cols:[
      {template: "Default", css:"center"},
      {template: "disabled: true", css:"center"},
      {template: 'css: "button_primary"', css:"center"},
      {template: 'css: "button_info"', css:"center"}
    ]
  }
]};

var row2 = { type:"clean", rows:[{               
    type:"clean", margin:20, cols:[
      {view: "button", label: "Success", css: "button_success", align: "left"},
      {view: "button", label: "Warning", css: "button_warning", align: "left"},
      {view: "button", label: "Danger", css: "button_danger", align: "left"},
      {view: "button", label: "Transparent", css: "bg_primary button_transparent", align: "left"}
    ]
  },
  {
    type:"clean", cols:[
      {template: 'css: "button_success"', css:"center"},
      {template: 'css: "button_warning"', css:"center"},
      {template: 'css: "button_danger"', css:"center"},
      {template: 'css: "button_transparent"', css:"center"}
    ]
  }
]};

var ui = {
  height: 300,
  borderless: true,
  rows: [
    {
      view: "template",
      template: "Flat Buttons (default look)",
      type: "header"
    },
    {
      view: "form",
      type:"clean", 
      padding:20,
      rows:[
        row1,
        row2
      ]
    }
  ]
};

return {
  $ui: ui
};

});
define('views/typography/raised',[],function(){

var row1 = { type:"clean", rows:[{               
    type:"clean", margin:20, cols:[
      {view: "button", label: "Ordinary Raised", css: "button_raised", align: "left"},
      {view: "button", label: "Primary Raised", css: "button_primary button_raised", align: "left"},
      {view: "button", label: "Info Raised", css: "button_info button_raised", align: "left"},
      {view: "button", label: "Success Raised", css: "button_success button_raised", align: "right"}
    ]
  },
  {
    type:"clean", cols:[
      {template: 'css: "button_raised"'},
      {template: 'css: "button_primary button_raised"'},
      {template: 'css: "button_info button_raised"'},
      {template: 'css: "button_success button_raised"'}
    ]
  }
]};

var row2 = { type:"clean", rows:[{               
    type:"clean", margin:20, cols:[
      {view: "button", label: "Warning Raised", css: "button_warning button_raised", align: "right"},
      {view: "button", label: "Danger Raised", css: "button_danger button_raised", align: "right"},
      {view: "button", label: "Badged", css: "button_danger button_raised", align: "left", badge:4 },
      {}
    ]
  },
  {
    type:"clean", cols:[
      {template: 'css: "button_warning button_raised"'},
      {template: 'css: "button_danger button_raised"'},
      {template: 'Button with badge'},
      {}
    ]
  }
]};

var ui = {
  height: 300,
  rows: [
    {
      template: "Raised Buttons",
      type: "header"
    },
    {
      view: "form",
      type:"clean",
      padding:20,
      elements: [
        row1,
        row2
      ]
    }
  ]
};

return {
  $ui: ui
};

});
define('views/typography/text',[],function(){

var row1 = {
  cols:[
    {template: 'Default text'},
    {template: 'css: "text_primary"', css: 'text_primary'},
    {template: 'css: "text_info"', css: 'text_info'},
    {template: 'css: "text_success"', css: 'text_success'}
  ]
};

var row2 = {
  cols:[
    {template: 'css: "text_warning"', css: 'text_warning'},
    {template: 'css: "text_danger"', css: 'text_danger'},
    {template: 'css: "text_muted"', css: 'text_muted'},
    {}
  ]
};

var ui = {
  height: 150,
  rows: [
    {type: "line",
      rows: [
        {
          template: "Text Colors",
          type: "header"
        },
        {
          view: "form",
          elementsConfig:{
            labelWidth: 100,
            margin: 10,
            paddingX: 2,
            borderless: true
          },
          elements:[
            row1,
            row2
          ]
        }
      ]
    }
  ]
};

return {
  $ui: ui
};

});
define('views/typography/background',[],function(){

var row1 = {
  cols:[
    {template: 'Default backround'},
    {template: 'css: "bg_primary"', css: 'bg_primary'},
    {template: 'css: "bg_info"', css: 'bg_info'}
  ]
};

var row2 = {
  cols:[
    {template: 'css: "bg_success"', css: 'bg_success'},
    {template: 'css: "bg_warning"', css: 'bg_warning'},
    {template: 'css: "bg_danger"', css: 'bg_danger'}
  ]
};

var ui = {
  height: 200,
  rows: [
    {type: "line",
      rows: [
        {
          template: "Backgrounds",
          type: "header"
        },
        {
          view: "form",
          elementsConfig:{
            labelWidth: 100,
            margin: 10,
            paddingX: 2,
            borderless: true
          },
          elements:[
            row1,
            row2
          ]
        }
      ]
    }
  ]
};

return {
  $ui: ui
};

});
define('views/typography',[
  "views/typography/buttons",
  "views/typography/raised",
  "views/typography/text",
  "views/typography/background"
],function(buttons, raised, text, background){

	var layout = {
    type: "material",

		rows:[
      {
        rows:[
          {
            template: "Main Typography",
            type: "header"
          },
          {
            paddingX:25, paddingY:10, cols:[
              { view:"label", label: 'Default text'},
              { view:"label", label: 'Header Text', type: "header"},
              { view:"label", label: '<a>Link</a>'}
            ]
          }
        ]
      },

      text,
      background,
      buttons,
      raised,

      {
        height:150,
        rows:[
          {
            template: "Icon Styles",
            type: "header"
          },
          {
            paddingX:25, paddingY:10, type:"clean", borderless:true, cols:[
              {css: "solid_icon", template:"<span class='webix_icon fa-plus-circle' style='cursor:pointer;'></span>Add Icon"},
              {css: "action_icon", template:"<span class='webix_icon fa-edit' style='cursor:pointer;'></span>Edit Icon"},
              {css: "danger_icon", template:"<span class='webix_icon fa-times' style='cursor:pointer;'></span>Remove Icon"}
            ]
          },
          {
            paddingX:25, paddingY:10, type:"clean", borderless:true, cols:[
              { template: 'css: "solid_icon"'},
              { template: 'css: "action_icon"'},
              { template: 'css: "danger_icon"'}
            ]
          }
        ]
      },
      {
        height:150,
        rows:[
          {
            template: "Panels",
            type: "header"
          },
          {
            padding:20, margin:20, cols:[
              { view:"template", template: 'css:"bg_clean"', css:"bg_clean"},
              { view:"template", template: 'css:"bg_panel"', css:"bg_panel"},
              { view:"template", template: 'css:"bg_panel_raised"', css:"bg_panel_raised"}
            ]
          }
        ]
      },
    ]
	};

	return { $ui:layout };

});

require(["app"]);
