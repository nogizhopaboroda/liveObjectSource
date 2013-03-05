var $LO = function (object, events) {
	var liveObject = function (obj) {

        this._id = 0;
        this.__evolvent = [];

        this._buildingMode = true;
        var self = this;

        this._buildLiveObject = function (object, parent) {
            if(typeof object == "object") {
                for(var part in object) {
                    var _type =  this._getType(object[part]);
                    this.factories[ (this.factories[_type]) ? _type : "default" ](object[part], parent, part, this);
                }
            } else {
                throw new Error("must be an object");
            }
        };

		this._getType = function (variable) {
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
                return "funtion";
            }
            return typeof variable;
		};

        this.pushToEvolvent = function (data, type, handlers) { //протаскивать handlers

            self.__evolvent[self._id] = {};
            self.__evolvent[self._id].value = data;
            self.__evolvent[self._id].type  = type;
            if(handlers) self.__evolvent[self._id].handlers  = handlers;

            self._id++;

            return this.getCurrentEvolventIndex();
        };

        this.getCurrentEvolventIndex = function () {
            return (function (id) {
                return id - 1;
            })(self._id);
        };

        this.factories = {
            "default": function (objectPart, parent, partName) {

                var id = self.pushToEvolvent(objectPart, self._getType(objectPart));
                Object.defineProperty(parent, partName, {
                    set: function (newValue) {

                        if(self.__evolvent[id].handlers && self.__evolvent[id].handlers['onSet']) {
                            for(var i = 0; i < self.__evolvent[id].handlers['onSet'].length; i++) {
                                self.__evolvent[id].handlers['onSet'][i].call(parent, newValue, parent, "set", self.__evolvent[id]);
                            }
                        } else if (self.__commonHandlers && self.__commonHandlers['onSet']) {
                            self.__commonHandlers['onSet'].call(parent, newValue, parent, "set", self.__evolvent[id]);
                        }

                        self.__evolvent[id].value = newValue;
                    },
                    get: function () {

                        if(self.__evolvent[id].handlers && self.__evolvent[id].handlers['onGet']) {
                            for(var i = 0; i < self.__evolvent[id].handlers['onGet'].length; i++) {
                                self.__evolvent[id].handlers['onGet'][i].call(parent, self.__evolvent[id].value, "get", self.__evolvent[id]);
                            }
                        } else if (self.__commonHandlers && self.__commonHandlers['onGet']) {
                            self.__commonHandlers['onGet'].call(parent, self.__evolvent[id].value, "get", self.__evolvent[id]);
                        }

                        var _value = new Object(self.__evolvent[id].value);
                        self.decorate.defaultGetter(_value, id, parent, partName);
                        if(self.decorate[self._getType(self.__evolvent[id].value)]) {
                            self.decorate[self._getType(self.__evolvent[id].value)](_value, id, parent, partName, self);
                        }

                        for(var dec in $LO.core.defaultGetterDecorators) {
                            var types = $LO.core.defaultGetterDecorators[dec].types || "all";
                            //console.log(self._getType(self.__evolvent[id].value));
                            if(types == "all" || types.indexOf(self._getType(self.__evolvent[id].value)) != -1) {
                                Object.defineProperty(_value, dec, {
                                    value: $LO.core.defaultGetterDecorators[dec].decorate,
                                    "configurable": $LO.core.defaultGetterDecorators[dec].configurable || true
                                });
                            }
                        }

                        return _value;
                    },
                    "configurable": true
                });
                return parent[partName];
            },
            "array": function (objectPart, parent, partName) {
                parent[partName] = objectPart;
                self._buildLiveObject(objectPart, parent[partName]);
                self.decorate['array'](parent[partName]);
                return parent[partName];
            },
            "object": function (objectPart, parent, partName) {
                parent[partName] = objectPart;
                self._buildLiveObject(objectPart, parent[partName]);
                self.decorate['object'](parent[partName], parent);
                return parent[partName];
            }
        };

        this.decorate = {
            "object": function (object, parent) {
                object.extends = function (obj) {

                    if (self.__commonHandlers && self.__commonHandlers['onExtends']) {
                        self.__commonHandlers['onExtends'].call(object, obj, "extends");
                    }

                    self._buildLiveObject(obj, object);
                };

                object.parent = function () {
                    return parent;
                };

                Object.defineProperty(object, "extends", { enumerable: false });
                Object.defineProperty(object, "parent", { enumerable: false });

            },
            "array": function (array) {

                array.push = function (value) {

                    if(self.__evolvent[array.__id].handlers && self.__evolvent[array.__id].handlers['onPush']) {
                        for(var i = 0; i < self.__evolvent[array.__id].handlers['onPush'].length; i++) {
                            self.__evolvent[array.__id].handlers['onPush'][i].call(array, value, "push");
                        }
                    } else if (self.__commonHandlers && self.__commonHandlers['onPush']) {
                        self.__commonHandlers['onPush'].call(array, value, "push");
                    }

                    var _type =  self._getType(value);
                    self.factories[ (self.factories[_type]) ? _type : "default" ](value, array, (array.length), self._id);

                };

                array.delete = function (index) {

                    var _fieldIndex = array[index].__id;

                    if(self.__evolvent[array.__id].handlers && self.__evolvent[array.__id].handlers['onDelete']) {
                        for(var i = 0; i < self.__evolvent[array.__id].handlers['onDelete'].length; i++) {
                            self.__evolvent[array.__id].handlers['onDelete'][i].call(array, index, "delete", (self.__evolvent[ _fieldIndex ] ? self.__evolvent[ _fieldIndex ] : undefined));
                        }
                    } else if (self.__commonHandlers && self.__commonHandlers['onDelete']) {
                        self.__commonHandlers['onDelete'].call(array, index, "delete", (self.__evolvent[ _fieldIndex ] ? self.__evolvent[ _fieldIndex ] : undefined) );
                    }

                    array.splice(index, 1);

                    self.__evolvent[ _fieldIndex ] = null;
                    /* or
                    *  delete that[index];
                    *  that.length--;
                    *  if need should redefine splice();
                    * */
                };

                array.addEventListener = function (eventType, handler) {
                    //сделать проверку что handler есть и он функция
                    if(!array.__id) {
                        var _handlers = {};
                            _handlers[eventType] = [handler];
                        var id = self.pushToEvolvent(null, "eventsHandlers", _handlers);
                        Object.defineProperty(array, "__id", { value: id, enumerable: false });
                    } else {
                        if(!self.__evolvent[array.__id].handlers[eventType]) {
                            self.__evolvent[array.__id].handlers[eventType] = [];
                        }
                        self.__evolvent[array.__id].handlers[eventType].push(handler);
                    }
                };

                Object.defineProperty(array, "push", { enumerable: false });
                Object.defineProperty(array, "delete", { enumerable: false });
            },
            "defaultGetter": function (value, id, parent, ptN) {
                Object.defineProperty(value, "__id", { value: id, "configurable": true});
                Object.defineProperty(value, "parent", { value: function () { return parent; }, "configurable": true });
                Object.defineProperty(value, "addEventListener", {
                    value: function (eventType, handler) {
                        if(!self.__evolvent[id].handlers) self.__evolvent[id].handlers = {};
                        if(!self.__evolvent[id].handlers[eventType]) self.__evolvent[id].handlers[eventType] = [];
                        self.__evolvent[id].handlers[eventType].push(handler);
                    },
                    "configurable": true
                });
                Object.defineProperty(value, "remove", {
                    value: function () {
                        //+ eventHandling
                        self.__evolvent[id] = null;
                        delete parent[ptN];
                    },
                    "configurable": true
                });
            }
        };

        for(var factory in $LO.core.factories) {
            this.factories[factory] = $LO.core.factories[factory];
        }
        for(var decorator in $LO.core.decorators) {
            this.decorate[decorator] = $LO.core.decorators[decorator];
        }

        this._buildLiveObject(obj, this);
        this._buildingMode = false;
	};

    var __lo = new liveObject(object);

    if(events !== undefined) {
        __lo.__commonHandlers = events;
    }

	return __lo;
};

$LO.core = {};
$LO.core.factories = {};
$LO.core.decorators = {};
$LO.core.defaultGetterDecorators = {};


$LO.computed = function (f) {
    f.type = "computed";
    return f;
};

$LO.core.factories["computed"] = function (objectPart, parent, partName, self) {

    var id = self.pushToEvolvent(objectPart, "computed");

    Object.defineProperty(parent, partName, {
        set: function (newValue) {
            self.__evolvent[id].value = newValue;
        },
        get: function () {
            return self.__evolvent[id].value.call(parent, self, self.__evolvent[id]);
        }
    });
};

$LO.eventable = function (value, handlers) {
    var _eventable = function () {};
        _eventable.type = "eventable";
        _eventable.value = value;
        _eventable.handlers = handlers;
    return _eventable;
};

$LO.core.factories["eventable"] = function (objectPart, parent, partName, self) {
    var _type =  self._getType(objectPart.value);
    self.factories[ (self.factories[_type]) ? _type : "default" ](objectPart.value, parent, partName, self);
    var id = self.getCurrentEvolventIndex();
    self.__evolvent[id].handlers = {};
    for(var type in objectPart.handlers) {
        self.__evolvent[id].handlers[type] = [];
        if(typeof objectPart.handlers[type] === "function") {
            self.__evolvent[id].handlers[type][0] = objectPart.handlers[type];
        } else {
            for(var i = 0; i < objectPart.handlers[type].length; i++) {
                self.__evolvent[id].handlers[type][i] = objectPart.handlers[type][i];
            }
        }
    }
};

/* 1) Добавить фабрику и декораторы для date */
/* 2) Определять get'er только один раз. Чтобы избежать configurable: true в декораторе */
/* 3) добавить parent() для массивов */
/* 4) реализовать листенеры для массивов */
