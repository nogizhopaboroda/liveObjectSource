(function() {

	var global = this;

	/*
	 *	Object.create polyfill from MDN
	 *  https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/create#Polyfill
	 */
	if (!Object.create) {
		Object.create = function (o) {
			if (arguments.length > 1) {
				throw new Error('Object.create implementation only accepts the first parameter.');
			}
			function F() {}
			F.prototype = o;
			return new F();
		};
	}

	/*
	* нужен polyfill для indexOf
	* */

	var _copy = function(object){
		return Object.create(object);
	};

	global.$LO = function(object) {
		var clonedObject = _copy(object);
		clonedObject.__id__ = 0;
		clonedObject.__evolvent__ = [];

		clonedObject.__getType__ = function (variable) {
			if(typeof variable === "object") {
				if(variable == null) return "null";
				if(variable instanceof Array) return "array";
				if(variable instanceof Date) return "date";
				return typeof variable;
			}
			if(typeof variable === "number") {
				if(variable.toString().indexOf('.') != -1) return "float";
				else return "integer";
			}
			if(typeof variable === "boolean") return "bool";
			if(typeof variable === "function") {
				if(variable.type) return variable.type;
				return "function";
			}
			return typeof variable;
		};

		clonedObject.__pushToEvolvent__ = function (data, handlers) { //протаскивать handlers

			clonedObject.__evolvent__[clonedObject.__id__] = {};
			clonedObject.__evolvent__[clonedObject.__id__].value = data;
			clonedObject.__evolvent__[clonedObject.__id__].type  = this.__getType__(data); //переделать на функцию?
			if(handlers) clonedObject.__evolvent__[clonedObject.__id__].handlers  = handlers;
			clonedObject.__id__++;

			return clonedObject.__getCurrentEvolventIndex__();
		};

		clonedObject.__getCurrentEvolventIndex__ = function () {
			return (function (id) {
				return id - 1;
			})(clonedObject.__id__);
		};

		clonedObject.__buildLiveObject__ = function (object) {

			object = object || this;

			if(typeof object === "object") {
				for(var part in object) {

					if(!part.match(/__.*__/)) {
						var type =  this.__getType__(object[part]);
						global.$LO.factories[ (global.$LO.factories[type]) ? type : "default" ].call(this, object, part); //
					}

				}
			} else {
				//Object.defineProperty(window)
			}
		};

		clonedObject.__buildLiveObject__();

		return clonedObject;
	};

	global.$LO.factories = {
		"default": function (object, part) {

			var self = this;
			var id = self.__pushToEvolvent__(object[part]);

			Object.defineProperty(object, part, {
				set: function (newValue) {
					//console.log("setter");

					var event = {
						"type": "set",
						"target": object,
						"property": part,
						"newValue": newValue,
						"oldValue": self.__evolvent__[id].value,
						"id": id
					};

					if(self.__evolvent__[id].handlers && self.__evolvent__[id].handlers['onSet']) {
						for(var i = 0; i < self.__evolvent__[id].handlers['onSet'].length; i++) {
							self.__evolvent__[id].handlers['onSet'][i].call(object, event, newValue);  //подумать над параметрами и их порядком следования
						}
					}

					self.__evolvent__[id].value = newValue;

				},
				get: function () {
					//console.log("getter");

					var event = {
						"type": "get",
						"target": object,
						"property": part,
						"value": self.__evolvent__[id].value,
						"id": id
					};

					if(self.__evolvent__[id].handlers && self.__evolvent__[id].handlers['onGet']) {
						for(var i = 0; i < self.__evolvent__[id].handlers['onGet'].length; i++) {
							self.__evolvent__[id].handlers['onGet'][i].call(object, event); //подумать над параметрами и их порядком следования
						}
					}

					var value = new Object(self.__evolvent__[id].value);
					for(var i = 0; i < global.$LO.decorators.length; i++){
						if(global.$LO.decorators[i]["types"].indexOf(self.__evolvent__[id].type) !== -1 || global.$LO.decorators[i]["types"].indexOf("all") !== -1){
							Object.defineProperty(value, global.$LO.decorators[i]["property"], {
								value: global.$LO.decorators[i]["valueGenerator"].call(self, object, part, self.__evolvent__[id], id, value),
								configurable: global.$LO.decorators[i]["configurable"] || true
							});
						}
					}
					return value;

				},
				"configurable": true
			});

			return object[part];
		},
		"array": function (object, part) {
			object[part] = _copy(object[part]);
			this.__buildLiveObject__(object[part]);
			//self.decorate['array'](parent[partName]);
			return object[part];
		},
		"object": function (object, part) {
			object[part] = _copy(object[part]);
			this.__buildLiveObject__(object[part]);
			//this.decorate['object'](parent[partName], parent);
			return object[part];
		}
	};

	global.$LO.decorators = [
		{
			"types": ["all"], //["integer", "string", ...]
			"property": "__id__",
			"valueGenerator": function(object, part, evolventContainer, id, value){
				return id;
			}
		},
		{
			"types": ["all"], //["integer", "string", ...]
			"property": "parent",
			"valueGenerator": function(object, part, evolventContainer, id, value){
				return object;
			}
		},
		{
			"types": ["all"],
			"property": "addEventListener",
			"valueGenerator": function(object, part, evolventContainer, id, value){
				return function (eventType, handler) {
					if(!evolventContainer.handlers) evolventContainer.handlers = {};
					if(!evolventContainer.handlers[eventType]) evolventContainer.handlers[eventType] = [];
					evolventContainer.handlers[eventType].push(handler);
				}
			}
		}
	];

}).call(this);


$LO.computed = function (f) {
	f.type = "computed";
	return f;
};

$LO.factories["computed"] = function (object, part) {

	var self = this;
	var id = self.__pushToEvolvent__(object[part], "computed");

	Object.defineProperty(object, part, {
		set: function (newValue) {
			self.__evolvent__[id].value = newValue;
		},
		get: function () {
			return self.__evolvent__[id].value.call(object, self, self.__evolvent__[id]);
		}
	});
};

$LO.eventable = function (value, handlers) {
	var _eventable = function (){};
	_eventable.type = "eventable";
	_eventable.value = value;
	_eventable.handlers = handlers;
	return _eventable;
};

$LO.factories["eventable"] = function (object, part) {
	var self = this;
	var value = object[part].value,
		handlers = object[part].handlers;
	object[part] = value;
	var _type =  self.__getType__(object[part].value);
	$LO.factories[ $LO.factories[_type] ? _type : "default" ].call(self, object, part);
	var id = self.__getCurrentEvolventIndex__();
	self.__evolvent__[id].handlers = {};
	for(var type in handlers) {
		self.__evolvent__[id].handlers[type] = [];
		if(typeof handlers[type] === "function") {
			self.__evolvent__[id].handlers[type][0] = handlers[type];
		} else {
			for(var i = 0; i < object[part].handlers[type].length; i++) {
				self.__evolvent__[id].handlers[type][i] = handlers[type][i];
			}
		}
	}
};


//console.log(b);

/*console.log('lets testing');
var timeT = function(callback){
	var start = new Date();
	callback();
	var stop = new Date();
	alert((stop - start) / 1000);
};

console.log('generating object...');

var aa = {};
var bb = {};
var iterations = 1000;
for(var i = 0; i < iterations; i++){
	aa["a" + i] = { "test": "test" };
}
bb = $LO(aa);

console.log('object generated');

console.log('native object time:');
timeT(function(){
	for(var k = 0; k < iterations; k++){
		console.log(aa["a" + k]);
	}
});

console.log('live object time:');
timeT(function(){
	for(var k = 0; k < iterations; k++){
		console.log(bb["a" + k]);
	}
});*/
