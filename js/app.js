(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var immutable = require('immutabilis');
    var coquoVenenum = require('coquo-venenum');
    var each = require('pro-singulis');
    var utils = require('./Utils');

    /**
     * Description
     *
     * @class
     * @name alchemy.ecs.Administrator
     */
    return coquoVenenum({
        /** @lends alchemy.ecs.Administrator.prototype */

        /**
         * Adds a new component system. Any component system should implement
         * the method "update"
         *
         * @param {Object} newSystem The new component system
         */
        addSystem: function (newSystem) {
            newSystem.entities = this.repo;
            this.systems.push(newSystem);
        },

        /**
         * Sets and overrides the defaults components for a given entity
         * tyle
         *
         * @param {String} key The entity type identifier
         * @param {Object} components The default components for the
         *      entity type
         */
        setEntityDefaults: function (key, components) {
            this.defaults[key] = immutable.fromJS(components);
        },

        /**
         * Initializes the appliction entities
         *
         * @param {Array} list A list of entity configurations or functions
         *      which will create entity configurations based on the current
         *      appliction state
         *
         * @param {Immutatable} state The initial application state
         */
        initEntities: function (list, state) {
            each(list, function (cfg) {
                if (utils.isFunction(cfg)) {
                    this.entitiesFromState.push({
                        fn: cfg,
                    });
                    return;
                }

                this.createEntity(cfg);
            }, this);

            each(this.entitiesFromState, this.updateDynamicEntities, this, [state]);

            this.lastState = state;
        },

        /**
         * Updates all registered systems and existing entities with the current
         * application state
         *
         * @param {Immutatable} state The current application state
         */
        update: function (state) {
            var args = [state];

            if (state !== this.lastState) {
                each(this.entitiesFromState, this.updateDynamicEntities, this, args);
            }

            each(this.systems, this.updateSystem, this, args);

            this.lastState = state;
        },

        //
        //
        // private helper
        //
        //

        /** @private */
        updateSystem: function (system, index, state) {
            system.update(state);
        },

        /** @private */
        updateDynamicEntities: function (cfg, index, state) {
            var currentList = cfg.current || [];
            var newList = this.createEntityMap(cfg.fn(state));
            var toBeRemoved = this.findItemsNotInList(currentList, newList);
            var toBeCreated = this.findItemsNotInList(newList, currentList);

            each(Object.keys(toBeRemoved), this.removeEntity, this);
            each(toBeCreated, this.createEntity, this);

            cfg.current = newList;
        },

        /** @private */
        createEntityMap: function (list) {
            var result = {};

            each(list, function (cfg) {
                result[cfg.id] = cfg;
            });

            return result;
        },

        /** @private */
        findItemsNotInList: function (list1, list2) {
            return each(list1, function (item, key) {
                if (!list2[key]) {
                    return item;
                }
            });
        },

        /** @private */
        createEntity: function (cfg) {
            var defaults = this.defaults[cfg.type];
            if (defaults) {
                cfg = defaults.set(cfg).val();
            }

            if (cfg.children) {
                cfg.children = each(cfg.children, this.createEntity, this);
            }

            return this.repo.createEntity(cfg);
        },

        /** @private */
        removeEntity: function (entity) {
            return this.repo.removeEntity(entity);
        }

    }).whenBrewed(function () {
        /**
         * The entity repository
         *
         * @property repo
         * @type alchemy.ecs.Apothecarius
         * @private
         */
        this.repo = null;

        /**
         * The list of component systems
         *
         * @property systems
         * @type Array
         * @private
         */
        this.systems = [];

        /**
         * A list of functions which defines a set of entities depending
         * on the current application state
         *
         * @property entitiesFromState
         * @type Array
         * @private
         */
        this.entitiesFromState = [];

        /**
         * The last application state
         *
         * @property lastState
         * @type Immutatable
         * @private
         */
        this.lastState = null;

        /**
         * The set of component defaults (map entityType -> default values)
         *
         * @property defaults
         * @type Object
         * @private
         */
        this.defaults = {};

    }).whenDisposed(function () {
        each(this.systems, function (system, index) {
            this.systems[index].entities = null;
            this.systems[index].dispose();
            this.systems[index] = null;
        }, this);
    });
}());

},{"./Utils":10,"coquo-venenum":14,"immutabilis":18,"pro-singulis":22}],2:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var immutable = require('immutabilis');
    var coquoVenenum = require('coquo-venenum');
    var each = require('pro-singulis');
    var utils = require('./Utils');

    /**
     * The primary entity manager (an apothecarius is a storage manager)
     * "One potion to rule them all, one potion to find them,
     * one potion to bring them all and in the darkness bind them"
     *
     * @class
     * @name alchemy.ecs.Apothecarius
     * @extends alchemy.core.MateriaPrima
     */
    return coquoVenenum({
        /** @lends alchemy.ecs.Apothecarius.prototype */

        /**
         * Creates a new entity (a set of components)
         *
         * @param {Object} cfg The entity type or a custom component
         *      configurations
         * @param {String} [cfg.id] Optional. An entity ID. If ommitted a new
         *      one will be created
         *
         * @return {String} The id of the new entity
         */
        createEntity: function (cfg) {
            var entityId = cfg.id || utils.id();
            if (this.contains(entityId)) {
                throw 'The id: "' + entityId + '" is already used';
            }

            this.entities[entityId] = {
                id: entityId,
                components: [],
            };

            // create the components of the new entity
            each(cfg, function (component, key) {
                if (key === 'id' || key === 'type') {
                    return;
                }

                this.setComponent(entityId, key, component);
            }, this);

            return entityId;
        },

        /**
         * Checks if an entity with the given id exists
         * @return Boolean
         */
        contains: function (entityId) {
            return utils.isObject(this.entities[entityId]);
        },

        /**
         * Completely removes all existing entities and their
         * components - The total clean-up - The end of days...
         */
        removeAllEntities: function () {
            each(Object.keys(this.entities), this.removeEntity, this);
        },

        /**
         * Removes an entity and all its components
         *
         * @param {String} entityId The id of entity to remove
         */
        removeEntity: function (entityId) {
            if (!this.contains(entityId)) {
                return;
            }

            var entity = this.entities[entityId];
            var cmps = entity.components;

            while (cmps.length > 0) {
                this.removeComponent(entity, cmps[0]);
            }

            this.entities[entityId] = null;
        },

        /**
         * Removes a single component of an entity; The removed component is disposed
         * if it is a potion
         *
         * @param {String|Object} entity The entity object or its id (It is recommended to use
         *      the ids for public access!!!)
         * @param {String|Number} type The component type to remove or its index (the index
         *      is for private usage!!!)
         */
        removeComponent: function (entityId, type) {
            var entity = utils.isObject(entityId) ? entityId : this.entities[entityId];
            if (!utils.isObject(entity)) {
                throw 'Unknown entity: "' + entityId + '"';
            }

            var index = entity.components.indexOf(type);
            if (index >= 0) {
                entity.components.splice(index, 1);
            }

            var collection = this.components[type];
            if (collection) {
                collection[entity.id] = null;
            }
        },

        /**
         * Returns an array containing all components of a give type
         *
         * @param {String} type The component identifier
         * @return {Object} An entityId-to-component hash map
         */
        getAllComponentsOfType: function (type) {
            return each(this.components[type], filterExisting);
        },

        /**
         * Returns all component values for a given entity
         *
         * @param {String} entityId The entity identifier (returned by "createEntity")
         * @return {Object} A map (component identifier -> component value) containing
         *      all components of the requested entity (The map will be empty if the
         *      entity does not exist)
         *
         */
        getAllComponentsOfEntity: function (entityId) {
            var result = {};
            var entity = this.entities[entityId];
            var componentTypes = entity && entity.components;

            each(componentTypes, function (type) {
                result[type] = this.getComponentData(entityId, type);
            }, this);

            return result;
        },

        /**
         * Returns the immutable component of a given type for the specified
         * entity specific entity of all of that type
         *
         * @param {String} entityId An entity id
         * @param {String} componentKey The component type
         * @return {Immutatable} The immutable data of a single component
         */
        getComponent: function (entityId, componentKey) {
            var collection = this.components[componentKey];
            return collection && collection[entityId];
        },

        /**
         * Returns the raw component data of a given type for the specified
         * entity specific entity of all of that type
         *
         * @param {String} entityId An entity id
         * @param {String} componentKey The component type
         * @return {Object} The raw data for single component
         */
        getComponentData: function (entityId, componentKey) {
            var component = this.getComponent(entityId, componentKey);
            return component && component.val();
        },

        /**
         * Add a component to an entity
         *
         * @param {String} entityId The entity identifier
         * @param {String} key The component identifier
         * @param {Object} cfg The component configuration
         * @return {Object} The added component object
         */
        setComponent: function (entityId, key, cfg) {
            var entity = this.entities[entityId];
            if (!entity) {
                throw 'Unknown entity: "' + entityId + '"';
            }

            var collection = this.components[key];
            if (!collection) {
                // it's the first component of this type
                // -> create a new collection
                collection = {};
                this.components[key] = collection;
            }

            var cmp = collection[entityId];
            if (cmp) {
                // update existing component
                cmp = cmp.set(cfg);

            } else {
                // add new component
                cmp = immutable.fromJS(cfg);
                entity.components.push(key);
            }

            collection[entityId] = cmp;

            return cmp.val();
        },

    }).whenBrewed(function () {
        /**
         * The sets of different components (map component
         * type name -> collection of component instance)
         *
         * @property components
         * @type {Object}
         * @private
         */
        this.components = {};

        /**
         * The collection of registered entities; each entity is an object with
         * an <code>id</code> and an array of strings (<code>components</code>)
         * which refer the entity's components
         *
         * @property entities
         * @type {Object}
         * @private
         */
        this.entities = {};

    }).whenDisposed(function () {
        this.removeAllEntities();
    });


    /** @private */
    function filterExisting(obj) {
        if (obj) {
            return obj.val();
        }
    }
}());

},{"./Utils":10,"coquo-venenum":14,"immutabilis":18,"pro-singulis":22}],3:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var immutable = require('immutabilis');
    var coquoVenenum = require('coquo-venenum');
    var each = require('pro-singulis');
    var utils = require('./Utils');
    var Observari = require('./Observari');

    /**
     * Description
     *
     * @class
     * @name alchemy.web.Applicatus
     * @extends alchemy.core.MateriaPrima
     */
    return coquoVenenum({
        /** @lends alchemy.web.Applicatus.prototype */

        /**
         * <code>true</code> if the app is running
         *
         * @property runs
         * @type Boolean
         * @private
         */
        runs: false,

        /**
         * The global message bus
         *
         * @property messages
         * @type alchemy.core.Observari
         * @protected
         */
        messages: undefined,

        /**
         * The application state
         *
         * @property state
         * @type Immutable
         * @protected
         */
        state: undefined,

        /**
         * Hook-method; called when launching the app
         * @protected
         */
        onLaunch: utils.emptyFn,

        /**
         * Hook-method; called before closing the app
         * @protected
         */
        onShutdown: utils.emptyFn,

        /**
         * Hook-method; called in each loop run to update the application state
         * @protected
         *
         * @param {Object} loopParams The parameter of the current loop iteration
         * @param {Number} loopParams.now The current timestamp
         * @param {Number} loopParams.frame The number of the current iteration
         * @param {Number} loopParams.fps The frames per second
         * @param {State} loopParams.state The current application state
         *
         * @return Object The new application state
         */
        update: utils.emptyFn,

        /**
         * Hook-method; called in each loop run to update the application view
         * @protected
         *
         * @param {Object} loopParams The parameter of the current loop iteration
         * @param {Number} loopParams.now The current timestamp
         * @param {Number} loopParams.frame The number of the current iteration
         * @param {Number} loopParams.fps The frames per second
         * @param {State} loopParams.state The current application state
         */
        draw: utils.emptyFn,

        /**
         * Starts the application loop;
         * This will call the {@link #onLaunch} hook method
         */
        launch: function () {
            if (this.runs) {
                return;
            }

            this.runs = true;
            this.frame = 0;
            this.lastTick = utils.now();
            this.onLaunch();

            /**
             * Fired after application is ready
             * @event
             * @name app:start
             */
            this.messages.trigger('app:start');

            // start the update/draw-loop
            this.boundLoopFn = this.createLoopFunction(this);
            this.boundLoopFn();
        },

        /**
         * stops the application loop;
         * this will call the {@link #finish} method
         */
        shutdown: function () {
            if (!this.runs) {
                return;
            }

            if (this.loopId) {
                var cancelAnimationFrame = this.cancelAnimationFrame;

                cancelAnimationFrame(this.loopId);

                this.boundLoopFn = null;
                this.loopId = null;
            }

            this.onShutdown();

            /**
             * Fired after application is shut down
             * @event
             * @name app:stop
             */
            this.messages.trigger('app:stop');
            this.runs = false;
        },

        /**
         * Returns <code>true</code> if and only if the current application
         * is running (it may or may not be paused though)
         *
         * @return {Boolean}
         */
        isRunning: function () {
            return this.runs;
        },

        /**
         * Connects the message bus events with handler/controller
         *
         * @param Object controller The controller object to handle the message
         *      bus events. A controller object has to provide a messages
         *      property which maps an event to an event handler method. The
         *      handler method is called with the event data and the current
         *      application state. The return value of the handler method will
         *      be the new application state
         *
         * @example
         * var controller = {
         *   messages: {
         *     'app:start': 'onAppStart',
         *     ...
         *   },
         *
         *   onAppStart: function (data, state) {
         *     ... // handle event
         *     return newState;
         *   },
         *
         *   ...
         * };
         */
        wireUp: function (controller) {
            if (!controller) {
                throw 'Invalid input: Empty value';
            }

            if (!controller.messages) {
                throw 'Invalid input: Message map missing';
            }

            each(controller.messages, function (fnName, message) {
                this.messages.on(message, function (data) {
                    var fn = controller[fnName];
                    this.state = fn.call(controller, this.state, data);
                }, this);
            }, this);
        },

        //
        //
        // private helper
        //
        //

        requestAnimationFrame: window.requestAnimationFrame,
        cancelAnimationFrame: window.cancelAnimationFrame,

        /**
         * Creats the application loop method which called every iteration;
         * will call the {@link #update} and the {@link #draw} method
         * @function
         * @private
         */
        createLoopFunction: function (app) {
            // Use an instance of "LoopParameter" instead of a generic object
            // because most javascript interpreter have optimized property
            // access for objects with a "hidden class"
            function LoopParameter() {
                this.frame = 0;
                this.now = 0;
                this.delay = 0;
                this.fps = 0;
                this.state = null;
            }

            var then = utils.now();
            var frame = 0;
            var loopParams = new LoopParameter();
            var fps = 60;
            var delay = 1000 / fps;
            var requestAnimationFrame = this.requestAnimationFrame;

            return function loop(now) {
                now  = now || utils.now();
                delay = 0.95 * delay + 0.05 * (now - then);
                fps = 1000 / delay;
                then = now;
                frame++;

                // update the parameter set for the current iteration
                loopParams.frame = frame;
                loopParams.now = now;
                loopParams.delay = Math.round(delay);
                loopParams.fps = Math.round(fps);
                loopParams.state = app.state;

                var newState = app.update(loopParams);
                if (newState && newState !== app.state) {
                    app.state = newState;
                    loopParams.state = app.state;
                }

                app.draw(loopParams);

                app.loopId = requestAnimationFrame(app.boundLoopFn);
            };
        },

    }).whenBrewed(function () {
        this.messages = Observari.brew();
        this.state = immutable.fromJS();

    }).whenDisposed(function () {
        this.shutdown();
    });

}());

},{"./Observari":7,"./Utils":10,"coquo-venenum":14,"immutabilis":18,"pro-singulis":22}],4:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var coquoVenenum = require('coquo-venenum');
    var each = require('pro-singulis');
    var utils = require('./Utils');

    /**
     * A component system to render static and dynamic CSS
     *
     * @class
     * @name alchemy.ecs.CssRenderSystem
     * @extends alchemy.core.MateriaPrima
     */
    return coquoVenenum({
        /** @lends alchemy.ecs.CssRenderSystem.prototype */

        /**
         * The entity storage
         *
         * @property entities
         * @type alchemy.ecs.Apothecarius
         * @private
         */
        entities: undefined,

        /**
         * The css style helper which does the heavy lifting
         *
         * @property stylus
         * @type alchemy.web.Stylus
         * @private
         */
        stylus: undefined,

        /**
         * The the previous state
         *
         * @property lastStates
         * @type Object
         * @private
         */
        lastStates: undefined,

        /**
         * Updates the component system with the current application state
         */
        update: function () {
            var dynamicCss = this.entities.getAllComponentsOfType('css');
            each(dynamicCss, this.updateDynamicCss, this);
        },

        /** @private */
        updateDynamicCss: function (cfg, entityId) {
            this.processTypeRules(cfg, entityId);
            this.processEntityRules(cfg, entityId);
        },

        /** @private */
        processTypeRules: function (cfg, entityId) {
            if (!cfg.typeRules) {
                return;
            }

            this.setRules(cfg.typeRules);
            this.entities.setComponent(entityId, 'css', {
                typeRules: null,
            });
        },

        /** @private */
        processEntityRules: function (cfg, entityId) {
            if (!utils.isObject(cfg.entityRules)) {
                this.entities.removeComponent(entityId, 'css');
                return;
            }

            var rules = {};

            if (utils.isFunction(cfg.entityRules)) {
                var lastState = this.lastStates[entityId];
                var currentState = this.entities.getComponent(entityId, 'state');

                if (currentState === lastState) {
                    return;
                }

                rules['#' + entityId] = cfg.entityRules.call(null, currentState);

                this.lastStates[entityId] = currentState;
                this.setRules(rules);

                return;
            }

            rules['#' + entityId] = cfg.entityRules;

            this.setRules(rules);
            this.entities.removeComponent(entityId, 'css');
        },

        /** @private */
        setRules: function (rules) {
            this.stylus.setRules(rules);
        },

    }).whenBrewed(function () {
        this.lastStates = {};
    });
}());

},{"./Utils":10,"coquo-venenum":14,"pro-singulis":22}],5:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var coquoVenenum = require('coquo-venenum');
    var each = require('pro-singulis');

    var Delegate = function (key, event, handler, scope) {
        this.key = key;
        this.event = event;
        this.handler = handler;
        this.scope = scope;
    };

    Delegate.prototype.bind = function bind(element) {
        element[getKey(this.event)] = this.key;
    };

        /** @private */
    function getKey(eventname) {
        return '__e__' + eventname;
    }

    /**
     * @class
     * @name alchemy.web.Delegatus
     */
    return coquoVenenum({
        /** @lends alchemy.web.Delegatus.prototype */

        /**
         * The root DOM node that collects the browser events
         *
         * @property root
         * @type DomNode
         * @readonly
         */
        root: undefined,

        /**
         * The set of registered event handlers
         *
         * @property events
         * @type Object
         * @private
         */
        events: undefined,

        createDelegate: function (event, fn, scope) {
            var delegates = this.events[event];

            if (!delegates) {
                // first handler for this event
                var self = this;

                delegates = [];

                this.events[event] = delegates;
                this.root['on' + event] = function (e) {
                    self.handleEvent(event, e);
                };
            }

            for (var i = 0, l = delegates.length; i < l; i++) {
                var d = delegates[i];
                if (d.handler === fn && d.scope === scope) {
                    // event handler was already defined
                    // -> use it
                    return d;
                }
            }

            var newDel = new Delegate(delegates.length, event, fn, scope);

            delegates.push(newDel);

            return newDel;
        },

        //
        //
        // private helper
        //
        //

        /** @private */
        handleEvent: function (eventName, ev) {
            var target = ev && ev.target;

            while (target) {
                this.dispatchEvent(target[getKey(eventName)], eventName, ev);
                target = target.parentNode;
            }
        },

        /** @private */
        dispatchEvent: function (eventKey, eventName, event) {
            if (typeof eventKey === 'undefined') {
                return;
            }

            var handler = this.events[eventName];
            var cfg = handler && handler[eventKey];

            cfg.handler.call(cfg.scope, event);
        },

    }).whenBrewed(function () {
        this.root = this.root || document.body;
        this.events = {};

    }).whenDisposed(function () {
        each(this.events, function (handler, event) {
            while (handler.length > 0) {
                handler.pop();
            }

            this.root['on' + event] = null;
        }, this);
    });
}());

},{"coquo-venenum":14,"pro-singulis":22}],6:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var coquoVenenum = require('coquo-venenum');
    var each = require('pro-singulis');
    var utils = require('./Utils');

    /**
     * A component system to create delegated event handler for dom events
     *
     * @class
     * @name alchemy.ecs.EventSystem
     * @extends alchemy.core.MateriaPrima
     */
    return coquoVenenum({
        /** @lends alchemy.ecs.EventSystem.prototype */

        /**
         * The message bus for the appication messages
         *
         * @property messages
         * @type alchemy.core.Observari
         * @private
         */
        messages: undefined,

        /**
         * The browser event delegator
         *
         * @property delegator
         * @type alchemy.web.Delegatus
         * @private
         */
        delegator: undefined,

        /**
         * The entity storage
         *
         * @property entities
         * @type alchemy.ecs.Apothecarius
         * @private
         */
        entities: undefined,

        /**
         * Adds a new event handler
         *
         * @param {String} key The identifier for the event handler
         * @param {Function} handler The event handler function to be added
         */
        addHandler: function (key, handler) {
            this.handler = this.handler || {};
            this.handler[key] = handler;
        },

        /**
         * Updates the component system with the current application state
         */
        update: function () {
            var events = this.entities.getAllComponentsOfType('events');
            each(events, this.delegateEvents, this);
        },

        /** @private */
        delegateEvents: function (cfg, entityId) {
            each(cfg, this.delegateEvent, this, [entityId]);
            this.entities.removeComponent(entityId, 'events');
        },

        /** @private */
        delegateEvent: function (cfg, rawEventName, entityId) {
            if (utils.isString(cfg) || utils.isFunction(cfg)) {
                cfg = {
                    handler: cfg
                };
            }

            var handler = this.getEventHandler(entityId, cfg);
            var split = rawEventName.split(/\s/);
            var eventName = split.shift();
            var selector = cfg.selector || split.join(' ');
            var delegate = this.delegator.createDelegate(eventName, handler);
            var delegatedEvents = this.entities.getComponentData(entityId, 'delegatedEvents') || [];

            this.entities.setComponent(entityId, 'delegatedEvents', delegatedEvents.concat({
                event: eventName,
                delegate: delegate,
                selector: selector,
            }));
        },

        /** @private */
        getEventHandler: function (entityId, cfg) {
            var handler = cfg.handler;
            var repo = this.entities;
            var messages = this.messages;
            var sendMessage = function (msg, data) {
                messages.trigger(msg, data);
            };

            if (utils.isString(handler)) {
                handler = this.handler && this.handler[cfg.handler];
            }

            return function (event) {
                var state, newState;

                if (utils.isFunction(handler)) {
                    state = repo.getComponent(entityId, 'state');
                    newState = handler(event, state, sendMessage);

                    if (typeof newState !== 'undefined') {
                        repo.setComponent(entityId, 'state', newState);
                    }
                }

                if (cfg.message) {
                    state = repo.getComponentData(entityId, 'state');
                    sendMessage(cfg.message, state);
                }
            };
        },
    });
}());

},{"./Utils":10,"coquo-venenum":14,"pro-singulis":22}],7:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var coquoVenenum = require('coquo-venenum');
    var each = require('pro-singulis');
    var utils = require('./Utils');

    var Observari = {
        /** @lends alchemy.core.Observari.prototype */

        /**
         * The initial set of events;
         * The configuration object has the following form:
         * <pre><code>
         * {
         *      event1: {
         *          fn: {Function} // the handler function
         *          scope: {Object} // the execution scope of the handler
         *      },
         *      event2: {
         *          ...
         *      },
         *      ...
         * }
         * </code></pre>
         *
         * @property events
         * @type Object
         */
        events: undefined,

        /**
         * Triggers an event
         * @function
         *
         * @param {String} eventName The event name/type
         * @param {Object} data The event data (can be anything)
         */
        trigger: (function () {
            var processListener = function (listener, index, data, eventObj) {
                listener.fn.call(listener.scope, data, eventObj);
            };

            return function (eventName, data) {
                var listeners = this.events && utils.mix([], this.events[eventName]);
                var eventObj = getEventObject(this, eventName);
                var args = [data, eventObj];

                // notify listener which are registered for the given event type
                each(listeners, processListener, this, args);

                // notify listener which are registered for all events
                listeners = this.events && this.events['*'];
                each(listeners, processListener, this, args);
            };
        }()),


        /**
         * adds a listener for to an event
         *
         * @param {String} event
         *      the event name
         *
         * @param {Function} handler
         *      the event handler method
         *
         * @param {Object} scope
         *      the execution scope for the event handler
         */
        on: function (event, handler, scope) {
            this.events = this.events || {};
            this.events[event] = this.events[event] || [];
            this.events[event].push({
                fn: handler,
                scope: scope
            });
        },

        /**
         * Adds a one-time listener for to an event; This listener will
         * be removed after the the first execution
         *
         * @param {String} eventName
         *      the event name
         *
         * @param {Function} handler
         *      the event handler method
         *
         * @param {Object} scope
         *      the execution scope for the event handler
         */
        once: function (eventName, handler, scope) {
            var wrapper = function (data, event) {
                this.off(eventName, wrapper, this);
                handler.call(scope, data, event);
            };
            this.on(eventName, wrapper, this);
        },

        /**
         * removes a listener for from an event
         *
         * @param {String} event
         *      the event name
         *
         * @param {Function} handler
         *      the event handler method
         *
         * @param {Object} scope
         *      the execution scope for the event handler
         */
        off: function (event, handler, scope) {
            if (event) {
                cleanlistenerList(this, event, handler, scope);
            } else {
                each(this.events, function (eventListner, eventName) {
                    cleanlistenerList(this, eventName, handler, scope);
                }, this);
            }
        },
    };

    ///////////////////////////////////////////////////////////////////////////
    // private helper
    //
    //

    /**
     * Returns an object with meta data for the given event type
     * @private
     */
    function getEventObject(observable, eventName) {
        observable.eventObj = observable.eventObj || {};
        if (!observable.eventObj[eventName]) {
            observable.eventObj[eventName] = {
                name: eventName,
                  source: observable
            };
        }
        return observable.eventObj[eventName];
    }

    /**
     * Purges the list of event handlers from the given listeners
     * @private
     */
    function cleanlistenerList(observable, event, fn, scope) {
        var oldList = (observable.events && observable.events[event]) || [];
        var newList = [];
        var match; // true if the listener (fn, scope) is registered for the event
        var listener = oldList.pop();

        while (listener) {
            match = (!fn || fn === listener.fn) && (!scope || scope === listener.scope);

            if (!match) {
                newList.push(listener);
            } else {
                listener.fn = null;
                listener.scope = null;
            }
            listener = oldList.pop();
        }

        if (newList.length > 0) {
            observable.events[event] = newList;
        } else {
            delete observable.events[event];
        }
    }

    return coquoVenenum(Observari).whenDisposed(function () {
        // remove all listeners
        this.off();

        // cut circle references form the eventObj
        each(this.eventObj, function (item) {
            item.name = null;
            item.source = null;
        });
        this.eventObj = null;
    });
}());

},{"./Utils":10,"coquo-venenum":14,"pro-singulis":22}],8:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var immutable = require('immutabilis');
    var coquoVenenum = require('coquo-venenum');
    var each = require('pro-singulis');
    var utils = require('./Utils');

    /**
     * TODO: document me
     *
     * @class
     * @name alchemy.ecs.StateSystem
     * @extends alchemy.core.MateriaPrima
     */
    return coquoVenenum({
        /** @lends alchemy.ecs.StateSystem.prototype */

        /**
         * The entity storage
         *
         * @property entities
         * @type alchemy.ecs.Apothecarius
         * @private
         */
        entities: undefined,

        /**
         * The previous application state (there is no need to update all
         * entities if the global application state remained unchanged)
         *
         * @property lastState
         * @type Object
         * @private
         */
        lastStates: undefined,


        /**
         * Updates the component system with the current application state
         *
         * @param Immutable currentAppState The current application state
         */
        update: function (currentAppState) {
            if (currentAppState === this.lastState) {
                return;
            }

            var stateComponents = this.entities.getAllComponentsOfType('globalToLocal');

            each(stateComponents, this.updateEntity, this, [currentAppState]);

            this.lastState = currentAppState;
        },

        /** @private */
        updateEntity: function (globalToLocal, entityId, appState) {
            var newState = this.entities.getComponentData(entityId, 'state') || {};

            if (utils.isFunction(globalToLocal)) {
                newState = globalToLocal(appState, newState);

            } else {
                each(globalToLocal, function (localKey, globalPath) {
                    newState[localKey] = immutable.find(appState, globalPath);
                });
            }

            this.entities.setComponent(entityId, 'state', newState);
        }
    });
}());

},{"./Utils":10,"coquo-venenum":14,"immutabilis":18,"pro-singulis":22}],9:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var coquoVenenum = require('coquo-venenum');
    var each = require('pro-singulis');

    return coquoVenenum({
        /** @lends alchemy.web.Stylus.prototype */

        /**
         * An internal store for rule meta informations
         *
         * @property rules
         * @type Object
         * @private
         */
        rules: undefined,

        /**
         * The CssStyleSheet that stores all css rules
         *
         * @property sheet
         * @type CssStyleSheet
         * @private
         */
        sheet: undefined,

        /**
         * Sets CSS rules
         *
         * @param Object rules A set of rules where the keys are the selectors
         *      and the values the css rule body
         *
         * @example
         * stylus.setRules({
         *   'div#some-id .some-class {
         *     'background': 'url("...") ...',
         *     ...
         *   },
         *
         *   '#some-other-id {
         *     ...
         *   },
         *
         *   ...
         * });
         */
        setRules: function (rules) {
            each(this.prepare(rules, {}, ''), this.setRule, this);
        },


        /** @private */
        prepare: function (raw, result, selector) {
            each(raw, function (value, key) {
                if (value && typeof value === 'object') {
                    this.prepare(value, result, this.combineSelector(selector, key));
                    return;
                }

                result[selector] = result[selector] || {};
                result[selector][key] = value;
            }, this);

            return result;
        },

        /** @private */
        combineSelector: function (parent, child) {
            var result = (parent + ' ' + child).replace(/\s*&/g, '');
            return result;
        },

        /** @private */
        setRule: function (rule, selector) {
            var ruleStr = this.createRuleStr(selector, rule);
            var sheet = this.getStyleSheet();
            var ruleData = this.rules[selector];

            if (ruleData) {
                // update existing rule
                sheet.deleteRule(ruleData.index);
            } else {
                // add new rule
                ruleData = {
                    index: sheet.cssRules.length
                };

                this.rules[selector] = ruleData;
            }

            sheet.insertRule(ruleStr, ruleData.index);
        },

        /** @private */
        createRuleStr: function (selector, rule) {
            var props = '';
            each(rule, function (value, key) {
                props += key + ':' + value + ';';
            });

            return selector + '{' + props + '}';
        },

        /** @private */
        getStyleSheet: function () {
            if (!this.sheet) {
                var styleEl = document.createElement('style');
                document.head.appendChild(styleEl);
                this.sheet = styleEl.sheet;
            }

            return this.sheet;
        },

    }).whenBrewed(function () {
        this.rules = {};

    }).whenDisposed(function () {
        while (this.sheet && this.sheet.cssRules.length > 0) {
            this.sheet.deleteRule(0);
        }
    });
}());

},{"coquo-venenum":14,"pro-singulis":22}],10:[function(require,module,exports){
/*
 *   “Medicine, and Law, and Philosophy -
 *    You've worked your way through every school,
 *    Even, God help you, Theology,
 *    And sweated at it like a fool.
 *    Why labour at it any more?
 *    You're no wiser now than you were before.
 *    You're Master of Arts, and Doctor too,
 *    And for ten years all you've been able to do
 *    Is lead your students a fearful dance
 *    Through a maze of error and ignorance.
 *    And all this misery goes to show
 *    There's nothing we can ever know.
 *    Oh yes you're brighter than all those relics,
 *    Professors and Doctors, scribblers and clerics,
 *    No doubts or scruples to trouble you,
 *    Defying hell, and the Devil too.
 *    But there's no joy in self-delusion;
 *    Your search for truth ends in confusion.
 *    Don't imagine your teaching will ever raise
 *    The minds of men or change their ways.
 *    And as for worldly wealth, you have none -
 *    What honour or glory have you won?
 *    A dog could stand this life no more.
 *    And so I've turned to magic lore;
 *    The spirit message of this art
 *    Some secret knowledge might impart.
 *    No longer shall I sweat to teach
 *    What always lay beyond my reach;
 *    I'll know what makes the world revolve,
 *    Its mysteries resolve,
 *    No more in empty words I'll deal -
 *    Creation's wellsprings I'll reveal!”
 *            ― Johann Wolfgang von Goethe, Faust
 */
(function () {
    'use strict';

    var isBrowser = typeof window !== 'undefined';
    var each = require('pro-singulis');
    var Utils = {};

    /**
     * helper to turn the first letter of a string to upper case
     * @private
     */
    function ucFirst(s) {
        return Utils.isString(s) ? s.charAt(0).toUpperCase() + s.substr(1, s.length) : '';
    }

    if (typeof module !== 'undefined') {
        module.exports = Utils;
    }

    /**
     * the prefix for internal type and method meta properties
     *
     * @property metaPrefix
     * @type String
     */
    Utils.metaPrefix = '_AJS_';

    /**
     * Checks if a given item is an object.
     * Notice that every array is an object but not every object
     * is an array (which is also true for functions).
     *
     * @param {Various} o The item to be checked
     * @return {Boolean} <code>true</code> if the given item is an object
     */
    Utils.isObject = function isObject(o) {
        return o && (typeof o === 'object' || typeof o === 'function');
    };

    /**
     * Checks if a given item is an array
     *
     * @param {Various} a The item to be checked
     * @return {Boolean} <code>true</code> if the given item is an array
     */
    Utils.isArray = function isArray(a) {
        return a instanceof Array;
    };

    /**
     * Checks if a given item is a function
     *
     * @param {Various} f The item to be checked
     * @return {Boolean} <code>true</code> if the given item is a function
     */
    Utils.isFunction = function isFunction(f) {
        return typeof f === 'function';
    };

    /**
     * Checks if a given item is a number
     *
     * @param {Various} n The item to be checked
     * @return {Boolean} <code>true</code> if the given item is a number
     */
    Utils.isNumber = function isNumber(n) {
        return typeof n === 'number' && !isNaN(n);
    };

    /**
     * Checks if a given item is a string
     *
     * @param {Various} s The item to be checked
     * @return {Boolean} <code>true</code> if the given item is a string
     */
    Utils.isString = function isString(s) {
        return typeof s === 'string';
    };

    /**
     * Checks if the given item is a boolean
     *
     * @param {Various} b the value to check
     * @return {Boolean} <code>true</code> if and only if the check is passed
     */
    Utils.isBoolean = function isBoolean(b) {
        return typeof b === 'boolean';
    };

    /**
     * Checks if the given value is defined
     *
     * @param {Various} x the value to check
     * @return {Boolean} <code>true</code> if and only if the check is passed
     */
    Utils.isDefined = function isDefined(x) {
        return Utils.isNumber(x) || Utils.isString(x) || Utils.isObject(x) || Utils.isArray(x) || Utils.isFunction(x) || Utils.isBoolean(x);
    };

    /**
     * Iterates of an iterable object and call the given method for each item
     * For example:
     * <pre><code>
     *      // (a) default use case iterate through an array or an object
     *      Utils.each([1, 2, ..., n], function doStuff(val) { ... });
     *
     *      // (b) map data
     *      Utils.each([1, 2, 3], function double(val) {
     *          return 2 * val;
     *      }); // -> [2, 4, 6]
     *      Utils.each({foo: 1, bar: 2}, function double(val) {
     *          return 2 * val;
     *      }); // -> {foo: 2, bar: 4}
     *
     *      // (c) filter data
     *      Utils.each([1, 2, 3, 4], function (val) {
     *          return (val % 2 === 0) ? val : undefined;
     *      }); // -> [2, 4]
     *      Utils.each({ foo: 1, bar: 2, baz: 3, }, function uneven(val) {
     *          return (val % 2 !== 0) ? val : undefined;
     *      }); // -> { foo: 1, baz: 3 }
     * </code></pre>
     *
     * @deprecated
     *
     * @param {Object/Array} iterable The object to iterate through
     * @param {Function} fn The callback function to be called for each item
     * @param {Object} scope The execution scope for the callback function
     * @param {Array} more Optional; an addional set of arguments which will
     *      be passed to the callback function
     * @return {Object/Array} The aggregated results of each callback (see examples)
     */
    Utils.each = each;

    /**
     * Mixes the given additives to the source object
     * Example usage:
     * <pre><code>
     * // first add defaults values to a new object and then overrides the defaults
     * // with the actual values
     * Utils.mix({}, defaults, values);
     * </code></pre>
     * @function
     *
     * @param {Object} base
     *      the source object (will be modified!)
     *
     * @param {Object} ...overrides
     *      the set of additives
     *
     * @return Object
     *      the modified source object
     */
    Utils.mix = (function () {
        function mixOneItem(value, key, obj) {
            obj[key] = value;
        }

        return function () {
            var args = Array.apply(null, arguments);
            var base = args.shift();
            var next;

            while (args.length) {
                next = args.shift();
                each(next, mixOneItem, null, [base]);
            }
            return base;
        };
    }());

    /**
     * Melts two object deeply together in a new object
     * Example usage:
     *
     * <pre><code>
     *   Utils.melt({ foo: 1 }, { bar: 1 }); // -> { foo: 1, bar: 1 };
     *   Utils.melt({}, someObj); // -> deep clone of someObj
     * </code></pre>
     *
     * NOTICE: Array and none-data-objects (objects with a constructor other
     * than Object) are treated as atomic value and are not merged
     * @function
     *
     * @param {Object} obj1 First source object
     * @param {Object} obj2 The second source object
     * @return Object The deeply melted result
     */
    Utils.melt = (function () {
        var meltValue = each.prepare(function (value, key, result) {
            if (value && (value.constructor === Object)) {
                result[key] = Utils.melt(result[key], value);
            } else {
                result[key] = value;
            }
        }, null);

        return function (obj1, obj2) {
            var result = {};

            meltValue(obj1, [result]);
            meltValue(obj2, [result]);

            return result;
        };
    }());

    /**
     * Allows overriding methods of an given object. If the base object has
     * already a method with the same key this one will be hidden but does not
     * get lost. You can access the overridden method using
     * <code>_super.call(this, ...)</code>
     *
     * For example: <pre><code>
     * var obj = {
     *      foo: function () {
     *          return 'foo';
     *      }
     * };
     *
     * Utils.override(obj, {
     *      foo: Utils.override(function (_super) {
     *          return function () {
     *              return _super.call(this) + ' - bar';
     *          };
     *      })
     * });
     *
     * obj.foo(); // will return 'foo - bar'
     * </code></pre>
     * @function
     *
     * @param {Object} base
     *      The base object to be overridden (will be modified!)
     *
     * @param {Object} overrides
     *      The set of new methods
     *
     * @return {Object}
     *      The modified object
     */
    Utils.override = (function () {
        // helper to decide whether it is a magic meta function that creates the actual object method
        function isMagicMethod(fn) {
            return fn && (fn.hocuspocus === true);
        }

        // helper to identify property descriptors
        function isPropertyDef(obj) {
            return Utils.isObject(obj) && Utils.meta(obj, 'isProperty');
        }

        // helper method to add a single property
        function addProperty(prop, key, obj) {
            if (Utils.isFunction(prop)) {
                if (isMagicMethod(prop)) {
                    // you said the magic words so you will get your reference to the overridden method
                    prop = prop(obj[key]);
                }
            }
            if (isPropertyDef(prop)) {
                Utils.defineProperty(obj, key, prop);
            } else {
                obj[key] = prop;
            }
        }

        return function (base, overrides) {
            if (typeof base === 'function' && typeof overrides === 'undefined') {
                base.hocuspocus = true;
                return base;
            }

            if (overrides && overrides.constructor !== Object.prototype.constructor) {
                addProperty(overrides.constructor, 'constructor', base);
            }

            each(overrides, addProperty, null, [base]);

            return base;
        };
    }());

    /**
     * @function
     */
    Utils.extend = function extend(base, overrides) {
        var extended = Object.create(base);

        if (Utils.isFunction(overrides)) {
            overrides = overrides(base);
        }

        if (overrides) {
            Utils.override(extended, overrides);
        }

        return extended;
    };

    /**
     * Extract values of a specific property from a given set of items
     * For example:
     * <pre><code>
     * Utils.extract([{key: 'foo'}, {key: 'bar'}, ... ], 'key'); // -> ['foo', 'bar', ...]
     * Utils.extract({o1: {key: 'foo'}, o2: {key: 'bar'}, ...}, 'key'); // -> ['foo', 'bar', ...]
     * </code></pre>
     * @function
     *
     * @param {Array/Object} list
     *      The initial set of items
     *
     * @param {String} property
     *      The name of the property to extract
     *
     * @param {Array}
     *      The array of extracted values
     */
    Utils.extract = (function () {
        function extractOne(item, index, key, result) {
            if (Utils.isObject(item)) {
                result.push(item[key]);
            }
        }
        return function (list, property) {
            var result = [];
            each(list, extractOne, null, [property, result]);
            return result;
        };
    }());

    /**
     * Filtes a set (array or hash object) to contain only unique values
     *
     * @param {Array|Object} list The list to be filtered
     * @return {Array|Object} The filtered list
     *
     * @example
     * Utils.unique([1, 3, 4, 1, 3, 5]); // -> [1, 3, 4, 5]
     * Utils.unique({foo: 'foo', bar: 'foo', baz: 'baz'); // -> {foo: 'foo', baz: 'baz'}
     */
    Utils.unique = function unique(list) {
        var used = {};
        return each(list, function (item) {
            if (used[item]) {
                return;
            }

            used[item] = true;
            return item;
        });
    };

    /**
     * Creates a set of unique values from the given input
     * @function
     *
     * @param {Array|Object} ...args The initial data sets
     *
     * @return {Array} An array containing the unique values
     *
     * @example
     * Utils.union([1, 2, 4, 10], [3, 4], [1, 2, 5, 101]); // -> [1, 2, 4, 10, 3, 5, 101]
     * Utils.union({foo: 'foo'}, {bar: 'bar'}, {bar: 'baz'}); // -> ['foo', 'bar', 'baz']
     * Utils.union({foo: 'foo'}, ['foo', 'bar'], {bar: 'baz'}) // -> ['foo', 'bar', 'baz']
     */
    Utils.union = (function () {
        function processOneArgument(array, index, result, seen) {
            each(array, processOneValue, null, [result, seen]);
        }

        function processOneValue(value, index, result, seen) {
            if (!seen[value]) {
                result.push(value);
                seen[value] = true;
            }
        }

        return function () {
            var result = [];
            var seen = {};
            var args = Array.apply(null, arguments);

            each(args, processOneArgument, null, [result, seen]);
            return result;
        };
    }());

    /**
     * Returns the values of a hash object as an array
     * @function
     *
     * @param {Object} hash The key-value-hash-map
     * @return {Array} An array containing the values
     */
    Utils.values = (function () {
        function addValueToResultSet(value, key, resultSet) {
            resultSet.push(value);
        }

        return function values(hash) {
            if (!hash || typeof hash !== 'object') {
                return;
            }

            var result = [];
            each(hash, addValueToResultSet, null, [result]);

            return result;
        };
    }());

    /**
     * Reads and writes the value of a meta attribute from/to
     * a given object
     *
     * @param {Object} obj The object with the meta property
     * @param {String} key The identifier of the attribute
     * @param {Mixed} [value] (Optional) The new value;
     *      If ommitted the value will not be changed
     * @return {Mixed} The current value of the meta attributes
     */
    Utils.meta = function (obj, key, value) {
        key = Utils.metaPrefix + key;
        if (value !== undefined) {
            obj[key] = value;
        }
        return obj[key];
    };

    /**
     * This method works in two different mode:<ul>
     *
     * <li>Mode (A) will work similar to Object.defineProperty (see
     * https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Object/defineProperty)
     * but with a few defaults switched. New properties are by default writable,
     * enumerable and configurable whichh is IMO more natural.
     *
     * <li>Mode (B) let you mark a given object as a property definition which
     * will be evaluated when brewing a prototype or adding the property to
     * one with {@link Utils.override}</li>
     *
     * </ul>
     *
     * @param {Object} obj The object which should get the property (mode A)
     *      or the property definition (mode B)
     *      (NOTICE that either way the given object will be modified)
     * @param {String} [prop] The name of the property (mode A); empty (mode B)
     * @param {Object} [opts] The property definition (mode A); empty (mode B)
     *
     * @return obj The modified object
     */
    Utils.defineProperty = function (obj, prop, opts) {
        if (arguments.length === 1) {
            // Mode B: mark it as a properties so Utils.override will
            // know what to do
            Utils.meta(obj, 'isProperty', true);
            return obj;
        }

        // Mode A: define the new property "prop" for object "obj"

        // switch the defaults to be truthy unless said otherwise
        opts = opts || {};
        opts.writable = (opts.writable !== false);
        opts.enumerable = (opts.enumerable !== false);
        opts.configurable = (opts.configurable !== false);

        if (opts.get) {
            delete opts.writable; // writable/value is not allowed when defining getter/setter
            delete opts.value;

            if (Utils.isBoolean(opts.get)) {
                // "get" was simply set to true -> get the name from the property ("foo" -> "getFoo")
                opts.get = 'get' + ucFirst(prop);
            }
            if (Utils.isString(opts.get)) {
                // "get" was set to the getter's name
                // -> create a function that calls the getter (this way we can
                // later override the method)
                var getterName = opts.get;
                opts.get = function () {
                    return this[getterName]();
                };
            }
        }

        if (opts.set) {
            delete opts.writable; // writable/value is not allowed when defining getter/setter
            delete opts.value;

            if (Utils.isBoolean(opts.set)) {
                // "set" was simply set to true -> get the name from the property ("foo" -> "setFoo")
                opts.set = 'set' + ucFirst(prop);
            }
            if (Utils.isString(opts.set)) {
                var setterName = opts.set;
                opts.set = function (value) {
                    return this[setterName](value);
                };
            }
        }

        return Object.defineProperty(obj, prop, opts);
    };

    /**
     * creates a unique identifier
     * @function
     *
     * @return {String}
     *      the generated identifier
     *
     */
    Utils.id = (function () {
        var counter = 0;
        return function () {
            return 'AJS-' + (counter++);
        };
    }());

    /**
     * Returns a UUID
     * (source http://stackoverflow.com/a/8809472)
     * @function
     *
     * @return {String} the UUID
     */
    Utils.uuid = function () {
        var d = Utils.now();
        var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            /* jshint bitwise: false */
            var r = (d + Math.random() * 16) % 16 | 0;
            d = Math.floor(d / 16);
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            /* jshint bitwise: true */
        });
        return uuid;
    };

    /**
     * an reuseable empty function object
     */
    Utils.emptyFn = function () {};

    /**
     * Returns the number of milliseconds, accurate to a thousandth of a
     * millisecond, from the start of document navigation to the time the
     * now method was called.
     * Shim for window.performance.now(); see http://www.w3.org/TR/animation-timing/
     * @function
     *
     * @return {Number} The time in ms relative to the start of the
     *      document navigation
     */
    Utils.now = (function () {
        if (isBrowser && window.performance && window.performance.now) {
            // use window.perfomance.now (which is the reference) if possible
            return function () {
                return window.performance.now();
            };

        }

        // fallback to Date.now()
        var loadTime = Date.now();
        return function () {
            return Date.now() - loadTime;
        };
    }());
})();

},{"pro-singulis":22}],11:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var h = require('virtual-dom/h');
    var diff = require('virtual-dom/diff');
    var patch = require('virtual-dom/patch');

    var coquoVenenum = require('coquo-venenum');
    var each = require('pro-singulis');

    var utils = require('./Utils');

    /**
     * @class
     * @name RenderContext
     */
    function RenderContext(id, state, props, children) {
        this._entityPlaceholder = null;

        /**
         * @property
         * @name entityId
         * @type String
         * @memberOf RenderContext
         */
        this.entityId = id;

        /**
         * @property
         * @name state
         * @type Immutable
         * @memberOf RenderContext
         */
        this.state = state;

        /**
         * @property
         * @name props
         * @type Object
         * @memberOf RenderContext
         */
        this.props = props;

        /**
         * @property
         * @name children
         * @type Array/Object
         * @memberOf RenderContext
         */
        this.children = children;
    }

    /**
     * The hyperscript function to create virtual dom nodes
     * @function
     */
    RenderContext.prototype.h = h;

    /**
     * Renders a child entity at the current location (it actually creates a
     * placeholder for that very entity)
     *
     * @param {String} entityId The id of the child entity to be rendered
     * @return VDom a virtual dom node representing the child entity
     */
    RenderContext.prototype.placeholder = function placeholder(entityId) {
        this._entityPlaceholder = this._entityPlaceholder || [];
        this._entityPlaceholder.push(entityId);

        return h('div', {id: entityId, key: entityId});
    };


    /**
     * Renders a placeholder for a child entity defined by the given key
     *
     * @param {String} key The key of the child entity to be rendered
     * @return VDom a virtual dom node representing the child entity
     */
    RenderContext.prototype.renderChild = function renderChild(key) {
        return this.placeholder(this.children[key]);
    };

    /**
     * Renderes all available child entites
     *
     * @return array An array of virtual dom nodes
     */
    RenderContext.prototype.renderAllChildren = function renderAllChildren() {
        return each(utils.values(this.children), this.placeholder, this) || [];
    };

    /**
     * An application module to render all view components
     * to the screen
     *
     * @class
     * @name alchemy.ecs.VDomRenderSystem
     */
    return coquoVenenum({
        /** @lends alchemy.ecs.VDomRenderSystem.prototype */

        /**
         * The entity storage
         *
         * @property entities
         * @type alchemy.ecs.Apothecarius
         * @private
         */
        entities: undefined,

        /**
         * Updates the component system (updates dom depending on the current
         * state of the entities)
         */
        update: function () {
            var renderConfigs = this.entities.getAllComponentsOfType('vdom');
            var updates = each(renderConfigs, this.updateEntity, this);

            each(updates, this.draw, this);
        },

        /** @private */
        updateEntity: function (cfg, entityId, placeholder) {
            if (!this.requiresRender(cfg, entityId)) {
                return;
            }

            var renderer = this.findRenderer(cfg, entityId);
            var state = this.entities.getComponent(entityId, 'state');
            var children = this.entities.getComponentData(entityId, 'children');
            var context = new RenderContext(entityId, state, cfg.props, children, {});

            cfg = this.entities.setComponent(entityId, 'vdom', {
                currentTree: renderer(context),
                placeholder: context._entityPlaceholder,
            });

            this.lastStates[entityId] = state;

            return cfg;
        },

        /** @private */
        requiresRender: function (renderCfg, entityId) {
            if (!renderCfg.currentTree) {
                return true;
            }

            var currentState = this.entities.getComponent(entityId, 'state');
            var lastState = this.lastStates[entityId];
            if (currentState !== lastState) {
                return true;
            }

            var currentDelEv = this.entities.getComponent(entityId, 'delegatedEvents');
            var lastDelEv = this.lastDelegates[entityId];
            if (currentDelEv !== lastDelEv) {
                return true;
            }

            return false;
        },

        /** @private */
        findRenderer: function (cfg, entityId) {
            if (typeof cfg.renderer === 'function') {
                return cfg.renderer;
            }

            throw 'Cannot determine renderer for entity "' + entityId + '"!';
        },

        /** @private */
        draw: function (renderCfg, entityId) {
            var root = renderCfg.root || document.getElementById(entityId);
            if (!root) {
                return;
            }

            var patches = diff(renderCfg.lastTree || h(), renderCfg.currentTree);

            root = patch(root, patches);

            renderCfg = this.entities.setComponent(entityId, 'vdom', {
                root: root,
                lastTree: renderCfg.currentTree,
            });

            each(renderCfg.placeholder, this.drawDependentEntities, this);

            var delegatedEvents = this.entities.getComponent(entityId, 'delegatedEvents');
            if (delegatedEvents) {
                each(delegatedEvents.val(), this.bindDelegates, this, [root]);
                this.lastDelegates[entityId] = delegatedEvents;
            }
        },

        /** @private */
        drawDependentEntities: function (entityId) {
            var renderCfg = this.entities.getComponentData(entityId, 'vdom');
            if (!renderCfg) {
                return;
            }

            var childRoot = document.getElementById(entityId);
            if (childRoot && childRoot !== renderCfg.root) {
                this.entities.setComponent(entityId, 'vdom', {
                    root: childRoot,
                    lastTree: h(), // clear cache to force re-draw
                });
                this.draw(renderCfg, entityId);
            }
        },

        /** @private */
        bindDelegates: function (cfg, key, node) {
            if (cfg.selector) {
                node = node.querySelector(cfg.selector);
            }

            cfg.delegate.bind(node);
        },

    }).whenBrewed(function () {
        this.lastStates = {};
        this.lastDelegates = {};
    });
}());

},{"./Utils":10,"coquo-venenum":14,"pro-singulis":22,"virtual-dom/diff":23,"virtual-dom/h":24,"virtual-dom/patch":25}],12:[function(require,module,exports){

},{}],13:[function(require,module,exports){
/*!
 * Cross-Browser Split 1.1.1
 * Copyright 2007-2012 Steven Levithan <stevenlevithan.com>
 * Available under the MIT License
 * ECMAScript compliant, uniform cross-browser split method
 */

/**
 * Splits a string into an array of strings using a regex or string separator. Matches of the
 * separator are not included in the result array. However, if `separator` is a regex that contains
 * capturing groups, backreferences are spliced into the result each time `separator` is matched.
 * Fixes browser bugs compared to the native `String.prototype.split` and can be used reliably
 * cross-browser.
 * @param {String} str String to split.
 * @param {RegExp|String} separator Regex or string to use for separating the string.
 * @param {Number} [limit] Maximum number of items to include in the result array.
 * @returns {Array} Array of substrings.
 * @example
 *
 * // Basic use
 * split('a b c d', ' ');
 * // -> ['a', 'b', 'c', 'd']
 *
 * // With limit
 * split('a b c d', ' ', 2);
 * // -> ['a', 'b']
 *
 * // Backreferences in result array
 * split('..word1 word2..', /([a-z]+)(\d+)/i);
 * // -> ['..', 'word', '1', ' ', 'word', '2', '..']
 */
module.exports = (function split(undef) {

  var nativeSplit = String.prototype.split,
    compliantExecNpcg = /()??/.exec("")[1] === undef,
    // NPCG: nonparticipating capturing group
    self;

  self = function(str, separator, limit) {
    // If `separator` is not a regex, use `nativeSplit`
    if (Object.prototype.toString.call(separator) !== "[object RegExp]") {
      return nativeSplit.call(str, separator, limit);
    }
    var output = [],
      flags = (separator.ignoreCase ? "i" : "") + (separator.multiline ? "m" : "") + (separator.extended ? "x" : "") + // Proposed for ES6
      (separator.sticky ? "y" : ""),
      // Firefox 3+
      lastLastIndex = 0,
      // Make `global` and avoid `lastIndex` issues by working with a copy
      separator = new RegExp(separator.source, flags + "g"),
      separator2, match, lastIndex, lastLength;
    str += ""; // Type-convert
    if (!compliantExecNpcg) {
      // Doesn't need flags gy, but they don't hurt
      separator2 = new RegExp("^" + separator.source + "$(?!\\s)", flags);
    }
    /* Values for `limit`, per the spec:
     * If undefined: 4294967295 // Math.pow(2, 32) - 1
     * If 0, Infinity, or NaN: 0
     * If positive number: limit = Math.floor(limit); if (limit > 4294967295) limit -= 4294967296;
     * If negative number: 4294967296 - Math.floor(Math.abs(limit))
     * If other: Type-convert, then use the above rules
     */
    limit = limit === undef ? -1 >>> 0 : // Math.pow(2, 32) - 1
    limit >>> 0; // ToUint32(limit)
    while (match = separator.exec(str)) {
      // `separator.lastIndex` is not reliable cross-browser
      lastIndex = match.index + match[0].length;
      if (lastIndex > lastLastIndex) {
        output.push(str.slice(lastLastIndex, match.index));
        // Fix browsers whose `exec` methods don't consistently return `undefined` for
        // nonparticipating capturing groups
        if (!compliantExecNpcg && match.length > 1) {
          match[0].replace(separator2, function() {
            for (var i = 1; i < arguments.length - 2; i++) {
              if (arguments[i] === undef) {
                match[i] = undef;
              }
            }
          });
        }
        if (match.length > 1 && match.index < str.length) {
          Array.prototype.push.apply(output, match.slice(1));
        }
        lastLength = match[0].length;
        lastLastIndex = lastIndex;
        if (output.length >= limit) {
          break;
        }
      }
      if (separator.lastIndex === match.index) {
        separator.lastIndex++; // Avoid an infinite loop
      }
    }
    if (lastLastIndex === str.length) {
      if (lastLength || !separator.test("")) {
        output.push("");
      }
    } else {
      output.push(str.slice(lastLastIndex));
    }
    return output.length > limit ? output.slice(0, limit) : output;
  };

  return self;
})();

},{}],14:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var each = require('pro-singulis');
    var delegate = require('deligare');

    /**
     * @class Formula
     */
    var Formula = function (cfg) {
        var orgCtor = cfg.base.constructor;
        var init = delegate(each, [cfg.onBrewScripts, callFn]);

        /**
         * A list of callback functions which should be called
         * when brewing a new potion
         *
         * @name onBrewScripts
         * @memberOf Formula
         * @type Array
         * @property
         * @private
         */
        this.onBrewScripts = cfg.onBrewScripts;

        /**
         * A list of callback functions which should be called
         * when disposing the potion
         *
         * @name onDisposeScripts
         * @memberOf Formula
         * @type Array
         * @property
         * @private
         */
        this.onDisposeScripts = cfg.onDisposeScripts;

        this.Ctor = function (args) {
            orgCtor.apply(this, args);
            init(this);
        };
        this.Ctor.prototype = cfg.base;
    };

    /**
     * Creates a new instance of the formula's prototype
     *
     * @param {Object|Function} [overrides] Optional. A set of properties/overrides
     *      for the new instance
     * @param {Array} [args] Optional. An array with constructor arguments
     * @return {Object} The potion (i.e. the new instance of the formula's prototype)
     */
    Formula.prototype.brew = function brew(overrides, args) {
        var potion = new this.Ctor(args);
        var foreignProps = Object.keys(overrides || {});
        var onDispose = delegate(each, [this.onDisposeScripts, callFn]);

        if (typeof overrides === 'function') {
            overrides = overrides(this.Ctor.prototype);
        }

        potion.dispose = createDisposeFn(foreignProps, onDispose);
        potion = override(potion, overrides);

        return potion;
    };

    /**
     * Adds a callback functions which should be called
     * when brewing a new potion. The function is executed
     * in the context of the new object
     *
     * @param {Object} fn The callback function
     * @return {Formula} The new formula
     */
    Formula.prototype.whenBrewed = function whenBrewed(fn) {
        return new Formula({
            base: this.Ctor.prototype,
            onBrewScripts: this.onBrewScripts.concat(fn),
            onDisposeScripts: this.onDisposeScripts,
        });
    };


    /**
     * Adds a callback functions which should be called
     * when when disposing the potion. The function is
     * executed in the context of the disposed object
     *
     * @param {Object} fn The callback function
     * @return {Formula} The new formula
     */
    Formula.prototype.whenDisposed = function whenDisposed(fn) {
        return new Formula({
            base: this.Ctor.prototype,
            onBrewScripts: this.onBrewScripts,
            onDisposeScripts: this.onDisposeScripts.concat(fn),
        });
    };

    /**
     * Allows overriding methods and properties of an current base object.
     * For example:
     * <pre><code>
     * var newFormula = formula.extend({
     *   foo: function () { ... },
     *   ...
     * });
     * </code></pre>
     * @function
     *
     * @param {Object} overrides The set of new methods and attributes
     * @return {Formula} The new and extended potion formula
     */
    Formula.prototype.extend = function (overrides) {
        if (typeof overrides === 'function') {
            overrides = overrides(this.Ctor.prototype);
        }

        return new Formula({
            base: override(Object.create(this.Ctor.prototype), overrides),
            onBrewScripts: this.onBrewScripts,
            onDisposeScripts: this.onDisposeScripts,
        });
    };

    ///////////////////////////////////////////////////////////////////////////
    // PRIVATE HELPER

    /** @private */
    function override(base, overrides) {
        each(overrides, function (prop, key) {
            base[key] = prop;
        });

        return base;
    }

    /** @private */
    function callFn(fn) {
        /* jshint validthis: true */
        fn.call(this);
        /* jshint validthis: false */
    }

    /** @private */
    function createDisposeFn(foreignProps, onDispose) {
        return function dispose() {
            onDispose(this);

            each(foreignProps, function (prop) {
                this[prop] = null;
            }, this);

            for (var key in this) {
                if (this[key] && typeof this[key] === 'object') {
                    if (typeof this[key].dispose === 'function') {
                        this[key].dispose();
                    }

                    this[key] = null;
                }
            }
        };
    }

    /**
     * Wraps the give value in a potion formula to allow further magic
     *
     * @param {Object} base The original basic prototype
     * @return {Formula} the wrapper formula
     */
    return function coquoVenenum(base) {
        if (base === null || typeof base !== 'object') {
            throw 'Base hast be an object, "' + base + '" given';
        }

        return new Formula({
            base: Object.create(base),
            onBrewScripts: [],
            onDisposeScripts: [],
        });
    };
}());

},{"deligare":15,"pro-singulis":22}],15:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    /**
     * Creates the bound wrapper function
     *
     * @example
     * <pre><code>
     * var add = function (a, b) {
     *     return a + b;
     * };
     *
     * var sub = function (a, b) {
     *     return a - b;
     * };
     *
     * var addOne = deligare(add, [1]);
     * var subTwo = deligare(sub, [undefined, 2]);
     *
     * addOne(5); // -> 6 (equivalent to "add(1, 5)")
     * subTwo(5); // -> 3 (equivalent to "sub(5, 2)")
     * </code></pre>
     *
     * @param {Function} fn Required. The original function
     * @param {Array} delegateValues Required. The list of parameter values which
     *      should be bound to the new function. It is possible to skip parameter
     *      when passing "undefined" (e.g. deligare(fn, [undefined, 'foo'])
     * @param {Object} [scope] Optional. The execution context for the bound wrapper
     *
     * @return {Function} The bound wrapper function
     */
    return function deligare (fn, delegateValues, scope) {
        if (typeof fn !== 'function') {
            throw 'Invalid 1st argument: "' + typeof fn + '", function expected!';
        }

        if (!Array.isArray(delegateValues)) {
            throw 'Invalid 2nd argument: "' + typeof delegateValues + '", array expected!';
        }

        var arity = fn.arity >= 0 ? fn.arity : fn.length;
        var map = [];
        var idx = 0;

        for (var i = 0, l = arity; i < l; i++) {
            var val = delegateValues[i];

            if (val === undefined) {
                map[i] = idx++;
            }
        }

        var wrapper = function delegareWrapper() {
            var args = [];

            for (var i = 0, l = arity; i < l; i++) {
                var val = delegateValues[i];

                if (val === undefined) {
                    args[i] = arguments[map[i]];
                } else {
                    args[i] = val;
                }
            }

            return fn.apply(scope || this, args);
        };

        wrapper.arity = arity;

        return wrapper;
    };
}());

},{}],16:[function(require,module,exports){
'use strict';

var OneVersionConstraint = require('individual/one-version');

var MY_VERSION = '7';
OneVersionConstraint('ev-store', MY_VERSION);

var hashKey = '__EV_STORE_KEY@' + MY_VERSION;

module.exports = EvStore;

function EvStore(elem) {
    var hash = elem[hashKey];

    if (!hash) {
        hash = elem[hashKey] = {};
    }

    return hash;
}

},{"individual/one-version":20}],17:[function(require,module,exports){
(function (global){
var topLevel = typeof global !== 'undefined' ? global :
    typeof window !== 'undefined' ? window : {}
var minDoc = require('min-document');

if (typeof document !== 'undefined') {
    module.exports = document;
} else {
    var doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'];

    if (!doccy) {
        doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'] = minDoc;
    }

    module.exports = doccy;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"min-document":12}],18:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var uuid = '52be5395-a182-46dd-b518-091a1c476a63';
    var each = require('pro-singulis');

    /**
     * Helper to determine if a given object is an immutable
     * @private
     */
    function isImmutable(obj) {
        return obj && (obj.typeId === uuid);
    }

    function isObject(o) {
        return o && (typeof o === 'object');
    }

    function isArray(a) {
        return Array.isArray(a);
    }


    function copyTo (base, next) {
        var keys = Object.keys(next);

        for (var i = 0, l = keys.length; i < l; i++) {
            var key = keys[i];
            base[key] = next[key];
        }

        return base;
    }

    /**
     * Helper to create an immutable data object depending on the type of the input
     * @private
     */
    function createSub(value, computed) {
        if (isArray(value)) {
            return new List(value, computed);
        } else if (isObject(value)) {
            if (isImmutable(value)) {
                return value;
            } else if (value.constructor === Object) {
                return new Struct(value, computed);
            }
            return new Value(value, computed);
        }
        return new Value(value, computed);
    }

    /**
     * The abstract base class for immutable values
     *
     * @class Abstract
     * @private
     */
    function Abstract(value, data, computed) {
        this.value = value;
        this.data = data && each(data, function (item) {
            return createSub(item);
        });
        this.computedProps = computed;
    }

    Abstract.prototype.typeId = uuid;

    Abstract.prototype.val = function (key) {
        if (typeof key !== 'undefined') {
            var sub = this.sub(key);
            if (sub) {
                return sub.val();
            }

            var fn = this.computedProps && this.computedProps[key];
            if (fn) {
                return fn.call(this, this.val());
            }

            return null;
        }

        if (this.value === null) {
            this.value = each(this.data, function (sub) {
                return sub.val();
            });
        }
        return this.value;
    };

    Abstract.prototype.set = undefined; // abstact

    Abstract.prototype.sub = function (key) {
        return (this.data && this.data[key]) || null;
    };

    Abstract.prototype.each = function (fn, scope, more) {
        return this.set(each(this.data, fn, scope, more));
    };

    /** @protected */
    Abstract.prototype.setSubValue = function (val, key) {
        var currVal = this.sub(key);
        if (currVal) {
            // update existing key
            var newVal = currVal.set(val);
            if (newVal !== currVal) {
                return newVal;
            }
        } else {
            // add new key/value
            return createSub(val);
        }
    };

    /**
     * A simple immutable value
     *
     * @class Value
     * @extends Abstract
     * @private
     */
    function Value(val, computed) {
        Abstract.call(this, val, null, computed);
    }
    Value.prototype = new Abstract();

    Value.prototype.set = function _setSimpleValue(val) {
        if (isImmutable(val)) {
            return val;
        }
        if (val === this.value) {
            return this;
        }
        return new Value(val, this.computedProps);
    };

    /**
     * An immutable key-value store
     *
     * @class Struct
     * @extends Abstract
     * @private
     */
    function Struct(data, computed) {
        Abstract.call(this, null, data, computed);
    }
    Struct.prototype = new Abstract();

    Struct.prototype.set = function _setComplexValue(key, val) {
        if (typeof key === 'string' && typeof val !== 'undefined') {
            // called with key and value, e.g. .set('foo', 'bar');
            var newSub = this.setSubValue(val, key);
            if (newSub) {
                var newData = copyTo({}, this.data);
                newData[key] = newSub;
                return new Struct(newData, this.computedProps);
            }
            return this;
        }

        if (isImmutable(key)) {
            return key;
        }

        if (isArray(key)) {
            // called with array, e.g. .set([1, 2, ...]);
            return new List(key, this.computedProps);
        }

        if (isObject(key) && key.constructor === Object) {
            // called with raw js object, e.g. .set({foo: 'bar'});
            var changedSubs = each(key, this.setSubValue, this);
            if (changedSubs && Object.keys(changedSubs).length > 0) {
                return new Struct(copyTo(copyTo({}, this.data), changedSubs), this.computedProps);
            }
            return this;
        }

        if (typeof key !== 'undefined') {
            return new Value(key, this.computedProps);
        }

        return this;
    };

    /**
     * An immutable list/array
     *
     * @class List
     * @extends Abstract
     * @private
     */
    function List(data, computed) {
        Abstract.call(this, null, data, computed);
    }
    List.prototype = new Abstract();

    List.prototype.set = function (index, value) {
        if (typeof index === 'undefined') {
            return this;
        }

        if (typeof value !== 'undefined') {
            // called with key and value, e.g. .set('foo', 'bar');
            if (index >= 0) {
                var newSub = this.setSubValue(value, index);
                if (newSub) {
                    var newData = [].concat(this.data);
                    newData[index] = newSub;
                    return new List(newData);
                }
            }

            return this; // non-numeric index
        }

        // called with single argument
        value = index;

        if (isImmutable(value)) {
            return value;
        }

        if (isArray(value)) {
            return this.updateList(value);
        }

        if (isObject(value) && value.constructor === Object) {
            return new Struct(value, this.computedProps);
        }

        return new Value(value, this.computedProps);
    };


    /** @private */
    List.prototype.updateList = function (newData) {
        var newList = [];
        var changed = newData.length !== this.data.length;

        for (var i = 0, l = newData.length;  i < l; i++) {
            var newSubData = newData[i];
            var newSub = this.setSubValue(newSubData, i);

            if (newSub) {
                changed = true;
                newList.push(newSub);
            } else {
                newList.push(this.data[i]);
            }
        }
        if (changed) {
            return new List(newList, this.computedProps);
        }
        return this;
    };

    /**
     * This is an immutable data object
     */
    return {
        fromJS: function (data, computed) {
            return createSub(data, computed);
        },

        find: function (immutable, selector) {
            if (!immutable) {
                return null;
            }

            if (typeof selector === 'string') {
                var keys = selector.split('.');
                for (var i = 0, l = keys.length; i < l; i++) {
                    immutable = immutable.sub(keys[i]);
                }
            }

            return immutable;
        }
    };
}());

},{"pro-singulis":22}],19:[function(require,module,exports){
(function (global){
'use strict';

/*global window, global*/

var root = typeof window !== 'undefined' ?
    window : typeof global !== 'undefined' ?
    global : {};

module.exports = Individual;

function Individual(key, value) {
    if (key in root) {
        return root[key];
    }

    root[key] = value;

    return value;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],20:[function(require,module,exports){
'use strict';

var Individual = require('./index.js');

module.exports = OneVersion;

function OneVersion(moduleName, version, defaultValue) {
    var key = '__INDIVIDUAL_ONE_VERSION_' + moduleName;
    var enforceKey = key + '_ENFORCE_SINGLETON';

    var versionValue = Individual(enforceKey, version);

    if (versionValue !== version) {
        throw new Error('Can only have one copy of ' +
            moduleName + '.\n' +
            'You already have version ' + versionValue +
            ' installed.\n' +
            'This means you cannot install version ' + version);
    }

    return Individual(key, defaultValue);
}

},{"./index.js":19}],21:[function(require,module,exports){
"use strict";

module.exports = function isObject(x) {
	return typeof x === "object" && x !== null;
};

},{}],22:[function(require,module,exports){
module.exports = function () {
    'use strict';

    /**
     * Iterates of an iterable object and call the given method for each item
     * For example:
     * <pre><code>
     *      // (a) default use case iterate through an array or an object
     *      each([1, 2, ..., n], function doStuff(val) { ... });
     *
     *      // (b) map data
     *      each([1, 2, 3], function double(val) {
     *          return 2 * val;
     *      }); // -> [2, 4, 6]
     *      each({foo: 1, bar: 2}, function double(val) {
     *          return 2 * val;
     *      }); // -> {foo: 2, bar: 4}
     *
     *      // (c) filter data
     *      each([1, 2, 3, 4], function (val) {
     *          return (val % 2 === 0) ? val : undefined;
     *      }); // -> [2, 4]
     *      each({ foo: 1, bar: 2, baz: 3, }, function uneven(val) {
     *          return (val % 2 !== 0) ? val : undefined;
     *      }); // -> { foo: 1, baz: 3 }
     * </code></pre>
     *
     * @param {Object/Array} iterable The object to iterate through
     * @param {Function} fn The callback function to be called for each item
     * @param {Object} scope The execution scope for the callback function
     * @param {Array} more Optional; an addional set of arguments which will
     *      be passed to the callback function
     * @return {Object/Array} The aggregated results of each callback (see examples)
     */
    function each(iterable, fn, scope, more) {
        var args = [null, null];
        var result, resultSet;
        var i, l;

        if (more !== undefined) {
            args = args.concat(more);
        }

        if (Array.isArray(iterable)) {
            resultSet = [];

            for (i = 0, l = iterable.length; i < l; ++i) {
                args[0] = iterable[i];
                args[1] = i;
                result = fn.apply(scope, args);

                if (typeof result !== 'undefined') {
                    resultSet.push(result);
                }
            }

        } else if (iterable && typeof iterable === 'object') {
            var keys = Object.keys(iterable);
            // use Object.keys + for-loop to allow optimizing each for
            // iterating over objects in hash-table-mode

            resultSet = {};

            for (i = 0, l = keys.length; i < l; ++i) {
                var key = keys[i];

                args[0] = iterable[key];
                args[1] = key;
                result = fn.apply(scope, args);

                if (typeof result !== 'undefined') {
                    resultSet[key] = result;
                }
            }
        }

        return resultSet;
    }

    /**
     * Creates a function which is bound to a given callback and scope
     *
     * @param {Function} fn The callback (same as for each itself)
     * @param {Object} scope The execution context for the callback
     * @return Function The new iterator function which expects the
     *      iterable and an array of additional parameter which are
     *      passed to the callback
     */
    each.prepare = function (fn, scope) {
        return function (iterable, more) {
            return each(iterable, fn, scope || this, more);
        };
    };

    return each;
}();

},{}],23:[function(require,module,exports){
var diff = require("./vtree/diff.js")

module.exports = diff

},{"./vtree/diff.js":47}],24:[function(require,module,exports){
var h = require("./virtual-hyperscript/index.js")

module.exports = h

},{"./virtual-hyperscript/index.js":34}],25:[function(require,module,exports){
var patch = require("./vdom/patch.js")

module.exports = patch

},{"./vdom/patch.js":30}],26:[function(require,module,exports){
var isObject = require("is-object")
var isHook = require("../vnode/is-vhook.js")

module.exports = applyProperties

function applyProperties(node, props, previous) {
    for (var propName in props) {
        var propValue = props[propName]

        if (propValue === undefined) {
            removeProperty(node, propName, propValue, previous);
        } else if (isHook(propValue)) {
            removeProperty(node, propName, propValue, previous)
            if (propValue.hook) {
                propValue.hook(node,
                    propName,
                    previous ? previous[propName] : undefined)
            }
        } else {
            if (isObject(propValue)) {
                patchObject(node, props, previous, propName, propValue);
            } else {
                node[propName] = propValue
            }
        }
    }
}

function removeProperty(node, propName, propValue, previous) {
    if (previous) {
        var previousValue = previous[propName]

        if (!isHook(previousValue)) {
            if (propName === "attributes") {
                for (var attrName in previousValue) {
                    node.removeAttribute(attrName)
                }
            } else if (propName === "style") {
                for (var i in previousValue) {
                    node.style[i] = ""
                }
            } else if (typeof previousValue === "string") {
                node[propName] = ""
            } else {
                node[propName] = null
            }
        } else if (previousValue.unhook) {
            previousValue.unhook(node, propName, propValue)
        }
    }
}

function patchObject(node, props, previous, propName, propValue) {
    var previousValue = previous ? previous[propName] : undefined

    // Set attributes
    if (propName === "attributes") {
        for (var attrName in propValue) {
            var attrValue = propValue[attrName]

            if (attrValue === undefined) {
                node.removeAttribute(attrName)
            } else {
                node.setAttribute(attrName, attrValue)
            }
        }

        return
    }

    if(previousValue && isObject(previousValue) &&
        getPrototype(previousValue) !== getPrototype(propValue)) {
        node[propName] = propValue
        return
    }

    if (!isObject(node[propName])) {
        node[propName] = {}
    }

    var replacer = propName === "style" ? "" : undefined

    for (var k in propValue) {
        var value = propValue[k]
        node[propName][k] = (value === undefined) ? replacer : value
    }
}

function getPrototype(value) {
    if (Object.getPrototypeOf) {
        return Object.getPrototypeOf(value)
    } else if (value.__proto__) {
        return value.__proto__
    } else if (value.constructor) {
        return value.constructor.prototype
    }
}

},{"../vnode/is-vhook.js":38,"is-object":21}],27:[function(require,module,exports){
var document = require("global/document")

var applyProperties = require("./apply-properties")

var isVNode = require("../vnode/is-vnode.js")
var isVText = require("../vnode/is-vtext.js")
var isWidget = require("../vnode/is-widget.js")
var handleThunk = require("../vnode/handle-thunk.js")

module.exports = createElement

function createElement(vnode, opts) {
    var doc = opts ? opts.document || document : document
    var warn = opts ? opts.warn : null

    vnode = handleThunk(vnode).a

    if (isWidget(vnode)) {
        return vnode.init()
    } else if (isVText(vnode)) {
        return doc.createTextNode(vnode.text)
    } else if (!isVNode(vnode)) {
        if (warn) {
            warn("Item is not a valid virtual dom node", vnode)
        }
        return null
    }

    var node = (vnode.namespace === null) ?
        doc.createElement(vnode.tagName) :
        doc.createElementNS(vnode.namespace, vnode.tagName)

    var props = vnode.properties
    applyProperties(node, props)

    var children = vnode.children

    for (var i = 0; i < children.length; i++) {
        var childNode = createElement(children[i], opts)
        if (childNode) {
            node.appendChild(childNode)
        }
    }

    return node
}

},{"../vnode/handle-thunk.js":36,"../vnode/is-vnode.js":39,"../vnode/is-vtext.js":40,"../vnode/is-widget.js":41,"./apply-properties":26,"global/document":17}],28:[function(require,module,exports){
// Maps a virtual DOM tree onto a real DOM tree in an efficient manner.
// We don't want to read all of the DOM nodes in the tree so we use
// the in-order tree indexing to eliminate recursion down certain branches.
// We only recurse into a DOM node if we know that it contains a child of
// interest.

var noChild = {}

module.exports = domIndex

function domIndex(rootNode, tree, indices, nodes) {
    if (!indices || indices.length === 0) {
        return {}
    } else {
        indices.sort(ascending)
        return recurse(rootNode, tree, indices, nodes, 0)
    }
}

function recurse(rootNode, tree, indices, nodes, rootIndex) {
    nodes = nodes || {}


    if (rootNode) {
        if (indexInRange(indices, rootIndex, rootIndex)) {
            nodes[rootIndex] = rootNode
        }

        var vChildren = tree.children

        if (vChildren) {

            var childNodes = rootNode.childNodes

            for (var i = 0; i < tree.children.length; i++) {
                rootIndex += 1

                var vChild = vChildren[i] || noChild
                var nextIndex = rootIndex + (vChild.count || 0)

                // skip recursion down the tree if there are no nodes down here
                if (indexInRange(indices, rootIndex, nextIndex)) {
                    recurse(childNodes[i], vChild, indices, nodes, rootIndex)
                }

                rootIndex = nextIndex
            }
        }
    }

    return nodes
}

// Binary search for an index in the interval [left, right]
function indexInRange(indices, left, right) {
    if (indices.length === 0) {
        return false
    }

    var minIndex = 0
    var maxIndex = indices.length - 1
    var currentIndex
    var currentItem

    while (minIndex <= maxIndex) {
        currentIndex = ((maxIndex + minIndex) / 2) >> 0
        currentItem = indices[currentIndex]

        if (minIndex === maxIndex) {
            return currentItem >= left && currentItem <= right
        } else if (currentItem < left) {
            minIndex = currentIndex + 1
        } else  if (currentItem > right) {
            maxIndex = currentIndex - 1
        } else {
            return true
        }
    }

    return false;
}

function ascending(a, b) {
    return a > b ? 1 : -1
}

},{}],29:[function(require,module,exports){
var applyProperties = require("./apply-properties")

var isWidget = require("../vnode/is-widget.js")
var VPatch = require("../vnode/vpatch.js")

var updateWidget = require("./update-widget")

module.exports = applyPatch

function applyPatch(vpatch, domNode, renderOptions) {
    var type = vpatch.type
    var vNode = vpatch.vNode
    var patch = vpatch.patch

    switch (type) {
        case VPatch.REMOVE:
            return removeNode(domNode, vNode)
        case VPatch.INSERT:
            return insertNode(domNode, patch, renderOptions)
        case VPatch.VTEXT:
            return stringPatch(domNode, vNode, patch, renderOptions)
        case VPatch.WIDGET:
            return widgetPatch(domNode, vNode, patch, renderOptions)
        case VPatch.VNODE:
            return vNodePatch(domNode, vNode, patch, renderOptions)
        case VPatch.ORDER:
            reorderChildren(domNode, patch)
            return domNode
        case VPatch.PROPS:
            applyProperties(domNode, patch, vNode.properties)
            return domNode
        case VPatch.THUNK:
            return replaceRoot(domNode,
                renderOptions.patch(domNode, patch, renderOptions))
        default:
            return domNode
    }
}

function removeNode(domNode, vNode) {
    var parentNode = domNode.parentNode

    if (parentNode) {
        parentNode.removeChild(domNode)
    }

    destroyWidget(domNode, vNode);

    return null
}

function insertNode(parentNode, vNode, renderOptions) {
    var newNode = renderOptions.render(vNode, renderOptions)

    if (parentNode) {
        parentNode.appendChild(newNode)
    }

    return parentNode
}

function stringPatch(domNode, leftVNode, vText, renderOptions) {
    var newNode

    if (domNode.nodeType === 3) {
        domNode.replaceData(0, domNode.length, vText.text)
        newNode = domNode
    } else {
        var parentNode = domNode.parentNode
        newNode = renderOptions.render(vText, renderOptions)

        if (parentNode && newNode !== domNode) {
            parentNode.replaceChild(newNode, domNode)
        }
    }

    return newNode
}

function widgetPatch(domNode, leftVNode, widget, renderOptions) {
    var updating = updateWidget(leftVNode, widget)
    var newNode

    if (updating) {
        newNode = widget.update(leftVNode, domNode) || domNode
    } else {
        newNode = renderOptions.render(widget, renderOptions)
    }

    var parentNode = domNode.parentNode

    if (parentNode && newNode !== domNode) {
        parentNode.replaceChild(newNode, domNode)
    }

    if (!updating) {
        destroyWidget(domNode, leftVNode)
    }

    return newNode
}

function vNodePatch(domNode, leftVNode, vNode, renderOptions) {
    var parentNode = domNode.parentNode
    var newNode = renderOptions.render(vNode, renderOptions)

    if (parentNode && newNode !== domNode) {
        parentNode.replaceChild(newNode, domNode)
    }

    return newNode
}

function destroyWidget(domNode, w) {
    if (typeof w.destroy === "function" && isWidget(w)) {
        w.destroy(domNode)
    }
}

function reorderChildren(domNode, moves) {
    var childNodes = domNode.childNodes
    var keyMap = {}
    var node
    var remove
    var insert

    for (var i = 0; i < moves.removes.length; i++) {
        remove = moves.removes[i]
        node = childNodes[remove.from]
        if (remove.key) {
            keyMap[remove.key] = node
        }
        domNode.removeChild(node)
    }

    var length = childNodes.length
    for (var j = 0; j < moves.inserts.length; j++) {
        insert = moves.inserts[j]
        node = keyMap[insert.key]
        // this is the weirdest bug i've ever seen in webkit
        domNode.insertBefore(node, insert.to >= length++ ? null : childNodes[insert.to])
    }
}

function replaceRoot(oldRoot, newRoot) {
    if (oldRoot && newRoot && oldRoot !== newRoot && oldRoot.parentNode) {
        oldRoot.parentNode.replaceChild(newRoot, oldRoot)
    }

    return newRoot;
}

},{"../vnode/is-widget.js":41,"../vnode/vpatch.js":44,"./apply-properties":26,"./update-widget":31}],30:[function(require,module,exports){
var document = require("global/document")
var isArray = require("x-is-array")

var render = require("./create-element")
var domIndex = require("./dom-index")
var patchOp = require("./patch-op")
module.exports = patch

function patch(rootNode, patches, renderOptions) {
    renderOptions = renderOptions || {}
    renderOptions.patch = renderOptions.patch && renderOptions.patch !== patch
        ? renderOptions.patch
        : patchRecursive
    renderOptions.render = renderOptions.render || render

    return renderOptions.patch(rootNode, patches, renderOptions)
}

function patchRecursive(rootNode, patches, renderOptions) {
    var indices = patchIndices(patches)

    if (indices.length === 0) {
        return rootNode
    }

    var index = domIndex(rootNode, patches.a, indices)
    var ownerDocument = rootNode.ownerDocument

    if (!renderOptions.document && ownerDocument !== document) {
        renderOptions.document = ownerDocument
    }

    for (var i = 0; i < indices.length; i++) {
        var nodeIndex = indices[i]
        rootNode = applyPatch(rootNode,
            index[nodeIndex],
            patches[nodeIndex],
            renderOptions)
    }

    return rootNode
}

function applyPatch(rootNode, domNode, patchList, renderOptions) {
    if (!domNode) {
        return rootNode
    }

    var newNode

    if (isArray(patchList)) {
        for (var i = 0; i < patchList.length; i++) {
            newNode = patchOp(patchList[i], domNode, renderOptions)

            if (domNode === rootNode) {
                rootNode = newNode
            }
        }
    } else {
        newNode = patchOp(patchList, domNode, renderOptions)

        if (domNode === rootNode) {
            rootNode = newNode
        }
    }

    return rootNode
}

function patchIndices(patches) {
    var indices = []

    for (var key in patches) {
        if (key !== "a") {
            indices.push(Number(key))
        }
    }

    return indices
}

},{"./create-element":27,"./dom-index":28,"./patch-op":29,"global/document":17,"x-is-array":48}],31:[function(require,module,exports){
var isWidget = require("../vnode/is-widget.js")

module.exports = updateWidget

function updateWidget(a, b) {
    if (isWidget(a) && isWidget(b)) {
        if ("name" in a && "name" in b) {
            return a.id === b.id
        } else {
            return a.init === b.init
        }
    }

    return false
}

},{"../vnode/is-widget.js":41}],32:[function(require,module,exports){
'use strict';

var EvStore = require('ev-store');

module.exports = EvHook;

function EvHook(value) {
    if (!(this instanceof EvHook)) {
        return new EvHook(value);
    }

    this.value = value;
}

EvHook.prototype.hook = function (node, propertyName) {
    var es = EvStore(node);
    var propName = propertyName.substr(3);

    es[propName] = this.value;
};

EvHook.prototype.unhook = function(node, propertyName) {
    var es = EvStore(node);
    var propName = propertyName.substr(3);

    es[propName] = undefined;
};

},{"ev-store":16}],33:[function(require,module,exports){
'use strict';

module.exports = SoftSetHook;

function SoftSetHook(value) {
    if (!(this instanceof SoftSetHook)) {
        return new SoftSetHook(value);
    }

    this.value = value;
}

SoftSetHook.prototype.hook = function (node, propertyName) {
    if (node[propertyName] !== this.value) {
        node[propertyName] = this.value;
    }
};

},{}],34:[function(require,module,exports){
'use strict';

var isArray = require('x-is-array');

var VNode = require('../vnode/vnode.js');
var VText = require('../vnode/vtext.js');
var isVNode = require('../vnode/is-vnode');
var isVText = require('../vnode/is-vtext');
var isWidget = require('../vnode/is-widget');
var isHook = require('../vnode/is-vhook');
var isVThunk = require('../vnode/is-thunk');

var parseTag = require('./parse-tag.js');
var softSetHook = require('./hooks/soft-set-hook.js');
var evHook = require('./hooks/ev-hook.js');

module.exports = h;

function h(tagName, properties, children) {
    var childNodes = [];
    var tag, props, key, namespace;

    if (!children && isChildren(properties)) {
        children = properties;
        props = {};
    }

    props = props || properties || {};
    tag = parseTag(tagName, props);

    // support keys
    if (props.hasOwnProperty('key')) {
        key = props.key;
        props.key = undefined;
    }

    // support namespace
    if (props.hasOwnProperty('namespace')) {
        namespace = props.namespace;
        props.namespace = undefined;
    }

    // fix cursor bug
    if (tag === 'INPUT' &&
        !namespace &&
        props.hasOwnProperty('value') &&
        props.value !== undefined &&
        !isHook(props.value)
    ) {
        props.value = softSetHook(props.value);
    }

    transformProperties(props);

    if (children !== undefined && children !== null) {
        addChild(children, childNodes, tag, props);
    }


    return new VNode(tag, props, childNodes, key, namespace);
}

function addChild(c, childNodes, tag, props) {
    if (typeof c === 'string') {
        childNodes.push(new VText(c));
    } else if (typeof c === 'number') {
        childNodes.push(new VText(String(c)));
    } else if (isChild(c)) {
        childNodes.push(c);
    } else if (isArray(c)) {
        for (var i = 0; i < c.length; i++) {
            addChild(c[i], childNodes, tag, props);
        }
    } else if (c === null || c === undefined) {
        return;
    } else {
        throw UnexpectedVirtualElement({
            foreignObject: c,
            parentVnode: {
                tagName: tag,
                properties: props
            }
        });
    }
}

function transformProperties(props) {
    for (var propName in props) {
        if (props.hasOwnProperty(propName)) {
            var value = props[propName];

            if (isHook(value)) {
                continue;
            }

            if (propName.substr(0, 3) === 'ev-') {
                // add ev-foo support
                props[propName] = evHook(value);
            }
        }
    }
}

function isChild(x) {
    return isVNode(x) || isVText(x) || isWidget(x) || isVThunk(x);
}

function isChildren(x) {
    return typeof x === 'string' || isArray(x) || isChild(x);
}

function UnexpectedVirtualElement(data) {
    var err = new Error();

    err.type = 'virtual-hyperscript.unexpected.virtual-element';
    err.message = 'Unexpected virtual child passed to h().\n' +
        'Expected a VNode / Vthunk / VWidget / string but:\n' +
        'got:\n' +
        errorString(data.foreignObject) +
        '.\n' +
        'The parent vnode is:\n' +
        errorString(data.parentVnode)
        '\n' +
        'Suggested fix: change your `h(..., [ ... ])` callsite.';
    err.foreignObject = data.foreignObject;
    err.parentVnode = data.parentVnode;

    return err;
}

function errorString(obj) {
    try {
        return JSON.stringify(obj, null, '    ');
    } catch (e) {
        return String(obj);
    }
}

},{"../vnode/is-thunk":37,"../vnode/is-vhook":38,"../vnode/is-vnode":39,"../vnode/is-vtext":40,"../vnode/is-widget":41,"../vnode/vnode.js":43,"../vnode/vtext.js":45,"./hooks/ev-hook.js":32,"./hooks/soft-set-hook.js":33,"./parse-tag.js":35,"x-is-array":48}],35:[function(require,module,exports){
'use strict';

var split = require('browser-split');

var classIdSplit = /([\.#]?[a-zA-Z0-9\u007F-\uFFFF_:-]+)/;
var notClassId = /^\.|#/;

module.exports = parseTag;

function parseTag(tag, props) {
    if (!tag) {
        return 'DIV';
    }

    var noId = !(props.hasOwnProperty('id'));

    var tagParts = split(tag, classIdSplit);
    var tagName = null;

    if (notClassId.test(tagParts[1])) {
        tagName = 'DIV';
    }

    var classes, part, type, i;

    for (i = 0; i < tagParts.length; i++) {
        part = tagParts[i];

        if (!part) {
            continue;
        }

        type = part.charAt(0);

        if (!tagName) {
            tagName = part;
        } else if (type === '.') {
            classes = classes || [];
            classes.push(part.substring(1, part.length));
        } else if (type === '#' && noId) {
            props.id = part.substring(1, part.length);
        }
    }

    if (classes) {
        if (props.className) {
            classes.push(props.className);
        }

        props.className = classes.join(' ');
    }

    return props.namespace ? tagName : tagName.toUpperCase();
}

},{"browser-split":13}],36:[function(require,module,exports){
var isVNode = require("./is-vnode")
var isVText = require("./is-vtext")
var isWidget = require("./is-widget")
var isThunk = require("./is-thunk")

module.exports = handleThunk

function handleThunk(a, b) {
    var renderedA = a
    var renderedB = b

    if (isThunk(b)) {
        renderedB = renderThunk(b, a)
    }

    if (isThunk(a)) {
        renderedA = renderThunk(a, null)
    }

    return {
        a: renderedA,
        b: renderedB
    }
}

function renderThunk(thunk, previous) {
    var renderedThunk = thunk.vnode

    if (!renderedThunk) {
        renderedThunk = thunk.vnode = thunk.render(previous)
    }

    if (!(isVNode(renderedThunk) ||
            isVText(renderedThunk) ||
            isWidget(renderedThunk))) {
        throw new Error("thunk did not return a valid node");
    }

    return renderedThunk
}

},{"./is-thunk":37,"./is-vnode":39,"./is-vtext":40,"./is-widget":41}],37:[function(require,module,exports){
module.exports = isThunk

function isThunk(t) {
    return t && t.type === "Thunk"
}

},{}],38:[function(require,module,exports){
module.exports = isHook

function isHook(hook) {
    return hook &&
      (typeof hook.hook === "function" && !hook.hasOwnProperty("hook") ||
       typeof hook.unhook === "function" && !hook.hasOwnProperty("unhook"))
}

},{}],39:[function(require,module,exports){
var version = require("./version")

module.exports = isVirtualNode

function isVirtualNode(x) {
    return x && x.type === "VirtualNode" && x.version === version
}

},{"./version":42}],40:[function(require,module,exports){
var version = require("./version")

module.exports = isVirtualText

function isVirtualText(x) {
    return x && x.type === "VirtualText" && x.version === version
}

},{"./version":42}],41:[function(require,module,exports){
module.exports = isWidget

function isWidget(w) {
    return w && w.type === "Widget"
}

},{}],42:[function(require,module,exports){
module.exports = "2"

},{}],43:[function(require,module,exports){
var version = require("./version")
var isVNode = require("./is-vnode")
var isWidget = require("./is-widget")
var isThunk = require("./is-thunk")
var isVHook = require("./is-vhook")

module.exports = VirtualNode

var noProperties = {}
var noChildren = []

function VirtualNode(tagName, properties, children, key, namespace) {
    this.tagName = tagName
    this.properties = properties || noProperties
    this.children = children || noChildren
    this.key = key != null ? String(key) : undefined
    this.namespace = (typeof namespace === "string") ? namespace : null

    var count = (children && children.length) || 0
    var descendants = 0
    var hasWidgets = false
    var hasThunks = false
    var descendantHooks = false
    var hooks

    for (var propName in properties) {
        if (properties.hasOwnProperty(propName)) {
            var property = properties[propName]
            if (isVHook(property) && property.unhook) {
                if (!hooks) {
                    hooks = {}
                }

                hooks[propName] = property
            }
        }
    }

    for (var i = 0; i < count; i++) {
        var child = children[i]
        if (isVNode(child)) {
            descendants += child.count || 0

            if (!hasWidgets && child.hasWidgets) {
                hasWidgets = true
            }

            if (!hasThunks && child.hasThunks) {
                hasThunks = true
            }

            if (!descendantHooks && (child.hooks || child.descendantHooks)) {
                descendantHooks = true
            }
        } else if (!hasWidgets && isWidget(child)) {
            if (typeof child.destroy === "function") {
                hasWidgets = true
            }
        } else if (!hasThunks && isThunk(child)) {
            hasThunks = true;
        }
    }

    this.count = count + descendants
    this.hasWidgets = hasWidgets
    this.hasThunks = hasThunks
    this.hooks = hooks
    this.descendantHooks = descendantHooks
}

VirtualNode.prototype.version = version
VirtualNode.prototype.type = "VirtualNode"

},{"./is-thunk":37,"./is-vhook":38,"./is-vnode":39,"./is-widget":41,"./version":42}],44:[function(require,module,exports){
var version = require("./version")

VirtualPatch.NONE = 0
VirtualPatch.VTEXT = 1
VirtualPatch.VNODE = 2
VirtualPatch.WIDGET = 3
VirtualPatch.PROPS = 4
VirtualPatch.ORDER = 5
VirtualPatch.INSERT = 6
VirtualPatch.REMOVE = 7
VirtualPatch.THUNK = 8

module.exports = VirtualPatch

function VirtualPatch(type, vNode, patch) {
    this.type = Number(type)
    this.vNode = vNode
    this.patch = patch
}

VirtualPatch.prototype.version = version
VirtualPatch.prototype.type = "VirtualPatch"

},{"./version":42}],45:[function(require,module,exports){
var version = require("./version")

module.exports = VirtualText

function VirtualText(text) {
    this.text = String(text)
}

VirtualText.prototype.version = version
VirtualText.prototype.type = "VirtualText"

},{"./version":42}],46:[function(require,module,exports){
var isObject = require("is-object")
var isHook = require("../vnode/is-vhook")

module.exports = diffProps

function diffProps(a, b) {
    var diff

    for (var aKey in a) {
        if (!(aKey in b)) {
            diff = diff || {}
            diff[aKey] = undefined
        }

        var aValue = a[aKey]
        var bValue = b[aKey]

        if (aValue === bValue) {
            continue
        } else if (isObject(aValue) && isObject(bValue)) {
            if (getPrototype(bValue) !== getPrototype(aValue)) {
                diff = diff || {}
                diff[aKey] = bValue
            } else if (isHook(bValue)) {
                 diff = diff || {}
                 diff[aKey] = bValue
            } else {
                var objectDiff = diffProps(aValue, bValue)
                if (objectDiff) {
                    diff = diff || {}
                    diff[aKey] = objectDiff
                }
            }
        } else {
            diff = diff || {}
            diff[aKey] = bValue
        }
    }

    for (var bKey in b) {
        if (!(bKey in a)) {
            diff = diff || {}
            diff[bKey] = b[bKey]
        }
    }

    return diff
}

function getPrototype(value) {
  if (Object.getPrototypeOf) {
    return Object.getPrototypeOf(value)
  } else if (value.__proto__) {
    return value.__proto__
  } else if (value.constructor) {
    return value.constructor.prototype
  }
}

},{"../vnode/is-vhook":38,"is-object":21}],47:[function(require,module,exports){
var isArray = require("x-is-array")

var VPatch = require("../vnode/vpatch")
var isVNode = require("../vnode/is-vnode")
var isVText = require("../vnode/is-vtext")
var isWidget = require("../vnode/is-widget")
var isThunk = require("../vnode/is-thunk")
var handleThunk = require("../vnode/handle-thunk")

var diffProps = require("./diff-props")

module.exports = diff

function diff(a, b) {
    var patch = { a: a }
    walk(a, b, patch, 0)
    return patch
}

function walk(a, b, patch, index) {
    if (a === b) {
        return
    }

    var apply = patch[index]
    var applyClear = false

    if (isThunk(a) || isThunk(b)) {
        thunks(a, b, patch, index)
    } else if (b == null) {

        // If a is a widget we will add a remove patch for it
        // Otherwise any child widgets/hooks must be destroyed.
        // This prevents adding two remove patches for a widget.
        if (!isWidget(a)) {
            clearState(a, patch, index)
            apply = patch[index]
        }

        apply = appendPatch(apply, new VPatch(VPatch.REMOVE, a, b))
    } else if (isVNode(b)) {
        if (isVNode(a)) {
            if (a.tagName === b.tagName &&
                a.namespace === b.namespace &&
                a.key === b.key) {
                var propsPatch = diffProps(a.properties, b.properties)
                if (propsPatch) {
                    apply = appendPatch(apply,
                        new VPatch(VPatch.PROPS, a, propsPatch))
                }
                apply = diffChildren(a, b, patch, apply, index)
            } else {
                apply = appendPatch(apply, new VPatch(VPatch.VNODE, a, b))
                applyClear = true
            }
        } else {
            apply = appendPatch(apply, new VPatch(VPatch.VNODE, a, b))
            applyClear = true
        }
    } else if (isVText(b)) {
        if (!isVText(a)) {
            apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
            applyClear = true
        } else if (a.text !== b.text) {
            apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
        }
    } else if (isWidget(b)) {
        if (!isWidget(a)) {
            applyClear = true
        }

        apply = appendPatch(apply, new VPatch(VPatch.WIDGET, a, b))
    }

    if (apply) {
        patch[index] = apply
    }

    if (applyClear) {
        clearState(a, patch, index)
    }
}

function diffChildren(a, b, patch, apply, index) {
    var aChildren = a.children
    var orderedSet = reorder(aChildren, b.children)
    var bChildren = orderedSet.children

    var aLen = aChildren.length
    var bLen = bChildren.length
    var len = aLen > bLen ? aLen : bLen

    for (var i = 0; i < len; i++) {
        var leftNode = aChildren[i]
        var rightNode = bChildren[i]
        index += 1

        if (!leftNode) {
            if (rightNode) {
                // Excess nodes in b need to be added
                apply = appendPatch(apply,
                    new VPatch(VPatch.INSERT, null, rightNode))
            }
        } else {
            walk(leftNode, rightNode, patch, index)
        }

        if (isVNode(leftNode) && leftNode.count) {
            index += leftNode.count
        }
    }

    if (orderedSet.moves) {
        // Reorder nodes last
        apply = appendPatch(apply, new VPatch(
            VPatch.ORDER,
            a,
            orderedSet.moves
        ))
    }

    return apply
}

function clearState(vNode, patch, index) {
    // TODO: Make this a single walk, not two
    unhook(vNode, patch, index)
    destroyWidgets(vNode, patch, index)
}

// Patch records for all destroyed widgets must be added because we need
// a DOM node reference for the destroy function
function destroyWidgets(vNode, patch, index) {
    if (isWidget(vNode)) {
        if (typeof vNode.destroy === "function") {
            patch[index] = appendPatch(
                patch[index],
                new VPatch(VPatch.REMOVE, vNode, null)
            )
        }
    } else if (isVNode(vNode) && (vNode.hasWidgets || vNode.hasThunks)) {
        var children = vNode.children
        var len = children.length
        for (var i = 0; i < len; i++) {
            var child = children[i]
            index += 1

            destroyWidgets(child, patch, index)

            if (isVNode(child) && child.count) {
                index += child.count
            }
        }
    } else if (isThunk(vNode)) {
        thunks(vNode, null, patch, index)
    }
}

// Create a sub-patch for thunks
function thunks(a, b, patch, index) {
    var nodes = handleThunk(a, b)
    var thunkPatch = diff(nodes.a, nodes.b)
    if (hasPatches(thunkPatch)) {
        patch[index] = new VPatch(VPatch.THUNK, null, thunkPatch)
    }
}

function hasPatches(patch) {
    for (var index in patch) {
        if (index !== "a") {
            return true
        }
    }

    return false
}

// Execute hooks when two nodes are identical
function unhook(vNode, patch, index) {
    if (isVNode(vNode)) {
        if (vNode.hooks) {
            patch[index] = appendPatch(
                patch[index],
                new VPatch(
                    VPatch.PROPS,
                    vNode,
                    undefinedKeys(vNode.hooks)
                )
            )
        }

        if (vNode.descendantHooks || vNode.hasThunks) {
            var children = vNode.children
            var len = children.length
            for (var i = 0; i < len; i++) {
                var child = children[i]
                index += 1

                unhook(child, patch, index)

                if (isVNode(child) && child.count) {
                    index += child.count
                }
            }
        }
    } else if (isThunk(vNode)) {
        thunks(vNode, null, patch, index)
    }
}

function undefinedKeys(obj) {
    var result = {}

    for (var key in obj) {
        result[key] = undefined
    }

    return result
}

// List diff, naive left to right reordering
function reorder(aChildren, bChildren) {
    // O(M) time, O(M) memory
    var bChildIndex = keyIndex(bChildren)
    var bKeys = bChildIndex.keys
    var bFree = bChildIndex.free

    if (bFree.length === bChildren.length) {
        return {
            children: bChildren,
            moves: null
        }
    }

    // O(N) time, O(N) memory
    var aChildIndex = keyIndex(aChildren)
    var aKeys = aChildIndex.keys
    var aFree = aChildIndex.free

    if (aFree.length === aChildren.length) {
        return {
            children: bChildren,
            moves: null
        }
    }

    // O(MAX(N, M)) memory
    var newChildren = []

    var freeIndex = 0
    var freeCount = bFree.length
    var deletedItems = 0

    // Iterate through a and match a node in b
    // O(N) time,
    for (var i = 0 ; i < aChildren.length; i++) {
        var aItem = aChildren[i]
        var itemIndex

        if (aItem.key) {
            if (bKeys.hasOwnProperty(aItem.key)) {
                // Match up the old keys
                itemIndex = bKeys[aItem.key]
                newChildren.push(bChildren[itemIndex])

            } else {
                // Remove old keyed items
                itemIndex = i - deletedItems++
                newChildren.push(null)
            }
        } else {
            // Match the item in a with the next free item in b
            if (freeIndex < freeCount) {
                itemIndex = bFree[freeIndex++]
                newChildren.push(bChildren[itemIndex])
            } else {
                // There are no free items in b to match with
                // the free items in a, so the extra free nodes
                // are deleted.
                itemIndex = i - deletedItems++
                newChildren.push(null)
            }
        }
    }

    var lastFreeIndex = freeIndex >= bFree.length ?
        bChildren.length :
        bFree[freeIndex]

    // Iterate through b and append any new keys
    // O(M) time
    for (var j = 0; j < bChildren.length; j++) {
        var newItem = bChildren[j]

        if (newItem.key) {
            if (!aKeys.hasOwnProperty(newItem.key)) {
                // Add any new keyed items
                // We are adding new items to the end and then sorting them
                // in place. In future we should insert new items in place.
                newChildren.push(newItem)
            }
        } else if (j >= lastFreeIndex) {
            // Add any leftover non-keyed items
            newChildren.push(newItem)
        }
    }

    var simulate = newChildren.slice()
    var simulateIndex = 0
    var removes = []
    var inserts = []
    var simulateItem

    for (var k = 0; k < bChildren.length;) {
        var wantedItem = bChildren[k]
        simulateItem = simulate[simulateIndex]

        // remove items
        while (simulateItem === null && simulate.length) {
            removes.push(remove(simulate, simulateIndex, null))
            simulateItem = simulate[simulateIndex]
        }

        if (!simulateItem || simulateItem.key !== wantedItem.key) {
            // if we need a key in this position...
            if (wantedItem.key) {
                if (simulateItem && simulateItem.key) {
                    // if an insert doesn't put this key in place, it needs to move
                    if (bKeys[simulateItem.key] !== k + 1) {
                        removes.push(remove(simulate, simulateIndex, simulateItem.key))
                        simulateItem = simulate[simulateIndex]
                        // if the remove didn't put the wanted item in place, we need to insert it
                        if (!simulateItem || simulateItem.key !== wantedItem.key) {
                            inserts.push({key: wantedItem.key, to: k})
                        }
                        // items are matching, so skip ahead
                        else {
                            simulateIndex++
                        }
                    }
                    else {
                        inserts.push({key: wantedItem.key, to: k})
                    }
                }
                else {
                    inserts.push({key: wantedItem.key, to: k})
                }
                k++
            }
            // a key in simulate has no matching wanted key, remove it
            else if (simulateItem && simulateItem.key) {
                removes.push(remove(simulate, simulateIndex, simulateItem.key))
            }
        }
        else {
            simulateIndex++
            k++
        }
    }

    // remove all the remaining nodes from simulate
    while(simulateIndex < simulate.length) {
        simulateItem = simulate[simulateIndex]
        removes.push(remove(simulate, simulateIndex, simulateItem && simulateItem.key))
    }

    // If the only moves we have are deletes then we can just
    // let the delete patch remove these items.
    if (removes.length === deletedItems && !inserts.length) {
        return {
            children: newChildren,
            moves: null
        }
    }

    return {
        children: newChildren,
        moves: {
            removes: removes,
            inserts: inserts
        }
    }
}

function remove(arr, index, key) {
    arr.splice(index, 1)

    return {
        from: index,
        key: key
    }
}

function keyIndex(children) {
    var keys = {}
    var free = []
    var length = children.length

    for (var i = 0; i < length; i++) {
        var child = children[i]

        if (child.key) {
            keys[child.key] = i
        } else {
            free.push(i)
        }
    }

    return {
        keys: keys,     // A hash of key name to index
        free: free      // An array of unkeyed item indices
    }
}

function appendPatch(apply, patch) {
    if (apply) {
        if (isArray(apply)) {
            apply.push(patch)
        } else {
            apply = [apply, patch]
        }

        return apply
    } else {
        return patch
    }
}

},{"../vnode/handle-thunk":36,"../vnode/is-thunk":37,"../vnode/is-vnode":39,"../vnode/is-vtext":40,"../vnode/is-widget":41,"../vnode/vpatch":44,"./diff-props":46,"x-is-array":48}],48:[function(require,module,exports){
var nativeIsArray = Array.isArray
var toString = Object.prototype.toString

module.exports = nativeIsArray || isArray

function isArray(obj) {
    return toString.call(obj) === "[object Array]"
}

},{}],49:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var immutable = require('immutabilis');
    var Applicatus = require('alchemy.js/lib/Applicatus');
    var NavigationController = require('./controller/Navigation');

    /**
     * @class
     * @name core.App
     * @extends alchemy.web.Applicatus
     */
    return Applicatus.extend({
        /** @lends core.App.prototype */

        /** @override */
        onLaunch: function () {
            this.wireUp(NavigationController.brew());
            this.ui.init(this.state);
        },

        /** @override */
        update: function (p) {
            var state = p.state
                .set('windowWidth', window.innerWidth)
                .set('windowHeight', window.innerHeight);

            this.ui.update(state);

            return state;

        },

    }).whenBrewed(function () {
        this.state = immutable.fromJS({
            mode: 'presentation',
            currentIndex: 0,
            numOfSlides: 0,
            email: 'michael.buettner@flyeralarm.com'
        });
    });
}());

},{"./controller/Navigation":51,"alchemy.js/lib/Applicatus":3,"immutabilis":18}],50:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var coquoVenenum = require('coquo-venenum');
    var each = require('pro-singulis');
    var Utils = require('alchemy.js/lib/Utils');
    var Administrator = require('alchemy.js/lib/Administrator');
    var Apothecarius = require('alchemy.js/lib/Apothecarius');
    var Delegatus = require('alchemy.js/lib/Delegatus');
    var Stylus = require('alchemy.js/lib/Stylus');
    var StateSystem = require('alchemy.js/lib/StateSystem');
    var EventSystem = require('alchemy.js/lib/EventSystem');
    var CssRenderSystem = require('alchemy.js/lib/CssRenderSystem');
    var VDomRenderSystem = require('alchemy.js/lib/VDomRenderSystem');
    var Viewport = require('./ui/Viewport');

    return coquoVenenum({

        /** @protected */
        messages: undefined,

        /** @protected */
        admin: undefined,

        /** @protected */
        delegator: undefined,

        init: function (state) {
            this.initSystems();
            this.initEntities(state);
        },

        update: function (state) {
            return this.admin.update(state);
        },

        //
        // private
        //

        /** @private */
        initSystems: function () {
            each([
                StateSystem,
                EventSystem,
                CssRenderSystem,
                VDomRenderSystem,

            ], function (System) {
                this.admin.addSystem(System.brew({
                    delegator: this.delegator,
                    messages: this.messages,
                    stylus: this.stylus,
                }));
            }, this);
        },

        /** @private */
        initEntities: function (state) {
            this.admin.initEntities([Utils.melt(Viewport, {
                id: 'viewport',
                children: this.slides,
            })], state);
        },

    }).whenBrewed(function () {
        this.delegator = Delegatus.brew();
        this.stylus = Stylus.brew();
        this.admin = Administrator.brew({
            repo: Apothecarius.brew()
        });
    });
}());

},{"./ui/Viewport":55,"alchemy.js/lib/Administrator":1,"alchemy.js/lib/Apothecarius":2,"alchemy.js/lib/CssRenderSystem":4,"alchemy.js/lib/Delegatus":5,"alchemy.js/lib/EventSystem":6,"alchemy.js/lib/StateSystem":8,"alchemy.js/lib/Stylus":9,"alchemy.js/lib/Utils":10,"alchemy.js/lib/VDomRenderSystem":11,"coquo-venenum":14,"pro-singulis":22}],51:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var coquoVenenum = require('coquo-venenum');

    /**
     * Description
     *
     * @class
     * @name core.controller.Navigation
     */
    return coquoVenenum({
        /** @lends core.controller.Navigation.prototype */

        messages: {
            'navigation:next': 'onNextSlide',
            'navigation:prev': 'onPrevSlide',
        },

        /** @private */
        onNextSlide: function (state) {
            var current = state.val('currentIndex');
            if (current < state.val('numOfSlides') - 1) {
                return state.set('currentIndex', current + 1);
            }

            return state;
        },

        /** @private */
        onPrevSlide: function (state) {
            var current = state.val('currentIndex');
            if (current > 0) {
                return state.set('currentIndex', current - 1);
            }

            return state;
        },
    });
}());

},{"coquo-venenum":14}],52:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var Utils = require('alchemy.js/lib/Utils');

    return function text(txt, entityCss, more) {
        return Utils.melt({
            state: {
                text: txt
            },

            vdom: {
                renderer: function (ctx) {
                    var s = ctx.state;

                    return ctx.h('div', {
                        className: 'text big ' + (s.val('className') || ''),
                        id: ctx.entityId,
                    }, s.val('text'));
                },
            },

            css: {
                entityRules: entityCss,

                typeRules: {
                    '.text': {
                        padding: '0 40px',
                        margin: '20px 0',
                    },
                },
            },
        }, more);
    };
}());

},{"alchemy.js/lib/Utils":10}],53:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var Utils = require('alchemy.js/lib/Utils');

    return function slide(title, children, more) {
        if (Array.isArray(title)) {
            more = children;
            children = title;
            title = '';
        }

        return Utils.melt({
            globalToLocal: {
                mode: 'mode',
                windowWidth: 'windowWidth',
                windowHeight: 'windowHeight',
                currentIndex: 'currentIndex'
            },

            state: {
                title: title,
                index: 0,
            },

            vdom: {
                renderer: function (ctx) {
                    var h = ctx.h;
                    var s = ctx.state.val();
                    var isActive = s.mode === 'print' || s.currentIndex === s.index;

                    return h('div.slide', {
                        id: ctx.entityId,
                        key: ctx.entityId,
                        className: isActive ? 'active' : 'hidden',
                    }, [
                        h('div.slide-title', ctx.state.val('title')),
                        h('div.slide-inner', ctx.renderAllChildren()),
                    ]);
                },
            },

            css: {
                entityRules: function (state) {
                    if (state.val('mode') === 'print') {
                        return {
                            left: 0,
                        };
                    }

                    var index = state.val('index');
                    var cIndex = state.val('currentIndex');
                    var width = state.val('windowWidth');

                    return {
                        left: (index - cIndex) * width + 'px',
                    };
                },

                typeRules: {
                    '.slide': {
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        display: 'table',
                        'text-align': 'center',

                        '.slide-title': {
                            position: 'absolute',
                            top: '20px',
                            left: '20px',
                        },

                        '.slide-inner': {
                            width: '100%',
                            display: 'table-cell',
                            'vertical-align': 'middle',
                            transition: 'opacity 0.2s ease-in-out',
                        },
                    },

                    '.slide.active': {
                        transition: 'left 0.2s step-start',
                    },

                    '.slide.hidden': {
                        transition: 'left 0.2s linear',
                    },

                    '.slide.hidden .slide-title': {
                        visibility: 'hidden',
                    },

                    '.slide.hidden .slide-inner': {
                        opacity: 0,
                    },

                    '.print .slide': {
                        position: 'relative',
                        width: '420mm', // DIN A3 (ISO 216) landscape
                        height: '297mm',
                    },
                },
            },

            children: children,
        }, more);
    };
}());

},{"alchemy.js/lib/Utils":10}],54:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var Utils = require('alchemy.js/lib/Utils');

    return function text(txt, entityCss, more) {
        return Utils.melt({
            state: {
                text: txt
            },

            vdom: {
                renderer: function (ctx) {
                    var s = ctx.state;

                    return ctx.h('div', {
                        className: 'text ' + (s.val('className') || ''),
                        id: ctx.entityId,
                    }, s.val('text'));
                },
            },

            css: {
                entityRules: entityCss,

                typeRules: {
                    '.text': {
                        padding: '0 40px',
                        margin: '20px 0',
                    },
                },
            },
        }, more);
    };
}());

},{"alchemy.js/lib/Utils":10}],55:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    // var Utils = require('alchemy.js/lib/Utils');
    // var CenterContainer = require('../../core/ui/CenterContainer');

    return {
        /** @lends core.entities.Viewport.prototype */
        globalToLocal: {
            windowWidth: 'windowWidth',
            windowHeight: 'windowHeight',
            mode: 'mode',
            email: 'email',
        },

        vdom: {
            root: document.getElementById('viewport'),

            renderer: function renderVdom(ctx) {
                return ctx.h('button', {
                    id: ctx.entityId,
                    className: 'viewport ' + ctx.state.val('mode'),
                    tabIndex: '1',
                    autofocus: '1',
                }, [
                    ctx.h('span#email', ctx.state.val('email')),
                ].concat(ctx.renderAllChildren()));
            }
        },

        css: {
            entityRules: function (state) {
                if (state.val('mode') === 'print') {
                    return {
                        // width: '100%',
                        height: 'initial',
                    };
                }

                return {
                    width: state.val('windowWidth') + 'px',
                    height: state.val('windowHeight') + 'px',
                };
            },

            typeRules: {
                '.viewport': {
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    color: 'inherit',
                },

                '.viewport:focus': {
                    'box-shadow': 'inset 0 0 10px white',
                },

                '#email': {
                    position: 'absolute',
                    bottom: '20px',
                    right: '20px',
                }
            }
        },

        events: {
            contextmenu: function onContextMenu(event, state, sendMsg) {
                sendMsg('navigation:prev');
                event.preventDefault();
                event.stopPropagation();
            },

            click: function onClick(event, state, sendMsg) {
                sendMsg('navigation:next');
            },

            keydown: function onKeypressed(event, state, sendMsg) {
                var key = event.which || event.keyCode;
                // console.log('onKeypressed', event, key);

                if (key === 37 || key === 27 || key === 33) { // [<], [ESC], [PgUp]
                    sendMsg('navigation:prev');
                    return;
                }

                if (key === 39 || key === 13 || key === 34) { // [>], [RETURN], [PgDown]
                    sendMsg('navigation:next');
                    return;
                }
            },
        },
    };
}());

},{}],56:[function(require,module,exports){
(function () {
    'use strict';

    var each = require('pro-singulis');
    var App = require('./core/App');
    var UI = require('./core/UI');
    var Observari = require('alchemy.js/lib/Observari');
    var messages, ui, app;
    var slides = each([
        require('./slides/Title'),
        require('./slides/rank-10-1'),
        require('./slides/rank-9-1'),
        require('./slides/rank-8-1'),
        require('./slides/rank-7-1'),
        require('./slides/rank-6-1'),
        require('./slides/rank-5-1'),
        require('./slides/rank-4-1'),
        require('./slides/rank-3-1'),
        require('./slides/rank-2-1'),
        require('./slides/rank-1-1'),
        require('./slides/Sources'),
        require('./slides/Questions'),
    ], function (slide, index) {
        slide.state = slide.state || {};
        slide.state.index = index;

        return slide;
    });

    window.onload = function onLoad() {
        messages = Observari.brew();

        ui = UI.brew({
            messages: messages,
            slides: slides
        });

        app = App.brew({
            ui: ui,
            messages: messages,
        });

        app.state = app.state.set({
            numOfSlides: slides.length,
        });

        app.launch();

        window.app = app; // global reference for debugging
    };

    window.onunload = function onUnload() {
        [app, ui, messages].forEach(function (obj) {
            obj.dispose();
        });

        window.app = null;
    };
}());

},{"./core/App":49,"./core/UI":50,"./slides/Questions":57,"./slides/Sources":58,"./slides/Title":59,"./slides/rank-1-1":60,"./slides/rank-10-1":61,"./slides/rank-2-1":62,"./slides/rank-3-1":63,"./slides/rank-4-1":64,"./slides/rank-5-1":65,"./slides/rank-6-1":66,"./slides/rank-7-1":67,"./slides/rank-8-1":68,"./slides/rank-9-1":69,"alchemy.js/lib/Observari":7,"pro-singulis":22}],57:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/Text');

    return slide([
        text('Fragen?', {
            'font-size': '65px',
        })
    ]);
}());

},{"../core/ui/Slide":53,"../core/ui/Text":54}],58:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('Quellen und Links', [
        text('- E. Derby and D. Larsen. Agile Retrospectives, Pragmatic Bookshelf, USA, 2006'),
        text('- C. Baldauf. Retr-O-Mat, http://www.plans-for-retrospectives.com/'),
        text('- M. G. Richard. Fixed Mindset vs. Growth Mindset, http://michaelgr.com/2007/04/15/fixed-mindset-vs-growth-mindset-which-one-are-you/'),
    ]);
}());

},{"../core/ui/BigText":52,"../core/ui/Slide":53}],59:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/Text');

    return slide([
        text('Die 10 wichtigsten Dinge, die man beim Moderieren einer Retrospektive beachten sollte', {
            'font-size': '90px',
        }),

        text('Michael Büttner - 13.01.2016', {
            'font-size': '35px',
        }),
    ]);
}());

},{"../core/ui/Slide":53,"../core/ui/Text":54}],60:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('Platz #1', [
        text('Don\'t Panic', {
            'font-size': '90px'
        })
    ]);
}());

},{"../core/ui/BigText":52,"../core/ui/Slide":53}],61:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('Platz #10', [
        text('Set the Stage - Gather Data - Generate Insights - Decide What To Do - Close The Retro'),
        text('Es sollte kein Teil weggelassen werden')
    ]);
}());

},{"../core/ui/BigText":52,"../core/ui/Slide":53}],62:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('Platz #2', [
        text('Die Lösungen kommen von den Teilnehmern, nicht vom Moderator')
    ]);
}());

},{"../core/ui/BigText":52,"../core/ui/Slide":53}],63:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('Platz #3', [
        text('Auch der Moderator muss sich verbessern')
    ]);
}());

},{"../core/ui/BigText":52,"../core/ui/Slide":53}],64:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('Platz #4', [
        text('Die Teilnehmer müssen auch mal gelobt werden'),
        text('... aber richtig'),
    ]);
}());

},{"../core/ui/BigText":52,"../core/ui/Slide":53}],65:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('Platz #5', [
        text('Der Moderator ist kein Teilnehmer')
    ]);
}());

},{"../core/ui/BigText":52,"../core/ui/Slide":53}],66:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('Platz #6', [
        text('Man muss immer mal was neues machen')
    ]);
}());

},{"../core/ui/BigText":52,"../core/ui/Slide":53}],67:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('Platz #7', [
        text('Vorbereitung. Vorbereitung. Vorbereitung!')
    ]);
}());

},{"../core/ui/BigText":52,"../core/ui/Slide":53}],68:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('Platz #8', [
        text('Ein Moderator braucht im Ärmel einen Plan B'),
        text('... und im Schuh einen Plan C')
    ]);
}());

},{"../core/ui/BigText":52,"../core/ui/Slide":53}],69:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('Platz #9', [
        text('Ein Spiel dauert 90 Minuten'),
        text('... eine Retrospektive dauert länger'),
        text('... oder auch nicht')
    ]);
}());

},{"../core/ui/BigText":52,"../core/ui/Slide":53}]},{},[56])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYWxjaGVteS5qcy9saWIvQWRtaW5pc3RyYXRvci5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL2xpYi9BcG90aGVjYXJpdXMuanMiLCJub2RlX21vZHVsZXMvYWxjaGVteS5qcy9saWIvQXBwbGljYXR1cy5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL2xpYi9Dc3NSZW5kZXJTeXN0ZW0uanMiLCJub2RlX21vZHVsZXMvYWxjaGVteS5qcy9saWIvRGVsZWdhdHVzLmpzIiwibm9kZV9tb2R1bGVzL2FsY2hlbXkuanMvbGliL0V2ZW50U3lzdGVtLmpzIiwibm9kZV9tb2R1bGVzL2FsY2hlbXkuanMvbGliL09ic2VydmFyaS5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL2xpYi9TdGF0ZVN5c3RlbS5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL2xpYi9TdHlsdXMuanMiLCJub2RlX21vZHVsZXMvYWxjaGVteS5qcy9saWIvVXRpbHMuanMiLCJub2RlX21vZHVsZXMvYWxjaGVteS5qcy9saWIvVkRvbVJlbmRlclN5c3RlbS5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyLXJlc29sdmUvZW1wdHkuanMiLCJub2RlX21vZHVsZXMvYnJvd3Nlci1zcGxpdC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9jb3F1by12ZW5lbnVtL3NyYy9jb3F1by12ZW5lbnVtLmpzIiwibm9kZV9tb2R1bGVzL2RlbGlnYXJlL3NyYy9kZWxpZ2FyZS5qcyIsIm5vZGVfbW9kdWxlcy9ldi1zdG9yZS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9nbG9iYWwvZG9jdW1lbnQuanMiLCJub2RlX21vZHVsZXMvaW1tdXRhYmlsaXMvc3JjL2ltbXV0YWJpbGlzLmpzIiwibm9kZV9tb2R1bGVzL2luZGl2aWR1YWwvaW5kZXguanMiLCJub2RlX21vZHVsZXMvaW5kaXZpZHVhbC9vbmUtdmVyc2lvbi5qcyIsIm5vZGVfbW9kdWxlcy9pcy1vYmplY3QvaW5kZXguanMiLCJub2RlX21vZHVsZXMvcHJvLXNpbmd1bGlzL3NyYy9lYWNoLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL2RpZmYuanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vaC5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS9wYXRjaC5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92ZG9tL2FwcGx5LXByb3BlcnRpZXMuanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdmRvbS9jcmVhdGUtZWxlbWVudC5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92ZG9tL2RvbS1pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92ZG9tL3BhdGNoLW9wLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zkb20vcGF0Y2guanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdmRvbS91cGRhdGUtd2lkZ2V0LmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3ZpcnR1YWwtaHlwZXJzY3JpcHQvaG9va3MvZXYtaG9vay5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92aXJ0dWFsLWh5cGVyc2NyaXB0L2hvb2tzL3NvZnQtc2V0LWhvb2suanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdmlydHVhbC1oeXBlcnNjcmlwdC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92aXJ0dWFsLWh5cGVyc2NyaXB0L3BhcnNlLXRhZy5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92bm9kZS9oYW5kbGUtdGh1bmsuanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdm5vZGUvaXMtdGh1bmsuanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdm5vZGUvaXMtdmhvb2suanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdm5vZGUvaXMtdm5vZGUuanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdm5vZGUvaXMtdnRleHQuanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdm5vZGUvaXMtd2lkZ2V0LmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zub2RlL3ZlcnNpb24uanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdm5vZGUvdm5vZGUuanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdm5vZGUvdnBhdGNoLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zub2RlL3Z0ZXh0LmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Z0cmVlL2RpZmYtcHJvcHMuanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdnRyZWUvZGlmZi5qcyIsIm5vZGVfbW9kdWxlcy94LWlzLWFycmF5L2luZGV4LmpzIiwic3JjL2pzL2NvcmUvQXBwLmpzIiwic3JjL2pzL2NvcmUvVUkuanMiLCJzcmMvanMvY29yZS9jb250cm9sbGVyL05hdmlnYXRpb24uanMiLCJzcmMvanMvY29yZS91aS9CaWdUZXh0LmpzIiwic3JjL2pzL2NvcmUvdWkvU2xpZGUuanMiLCJzcmMvanMvY29yZS91aS9UZXh0LmpzIiwic3JjL2pzL2NvcmUvdWkvVmlld3BvcnQuanMiLCJzcmMvanMvaW5pdC5qcyIsInNyYy9qcy9zbGlkZXMvUXVlc3Rpb25zLmpzIiwic3JjL2pzL3NsaWRlcy9Tb3VyY2VzLmpzIiwic3JjL2pzL3NsaWRlcy9UaXRsZS5qcyIsInNyYy9qcy9zbGlkZXMvcmFuay0xLTEuanMiLCJzcmMvanMvc2xpZGVzL3JhbmstMTAtMS5qcyIsInNyYy9qcy9zbGlkZXMvcmFuay0yLTEuanMiLCJzcmMvanMvc2xpZGVzL3JhbmstMy0xLmpzIiwic3JjL2pzL3NsaWRlcy9yYW5rLTQtMS5qcyIsInNyYy9qcy9zbGlkZXMvcmFuay01LTEuanMiLCJzcmMvanMvc2xpZGVzL3JhbmstNi0xLmpzIiwic3JjL2pzL3NsaWRlcy9yYW5rLTctMS5qcyIsInNyYy9qcy9zbGlkZXMvcmFuay04LTEuanMiLCJzcmMvanMvc2xpZGVzL3JhbmstOS0xLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOWxCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JPQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDbkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoR0E7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeklBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3REQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzYUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9HQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIGltbXV0YWJsZSA9IHJlcXVpcmUoJ2ltbXV0YWJpbGlzJyk7XG4gICAgdmFyIGNvcXVvVmVuZW51bSA9IHJlcXVpcmUoJ2NvcXVvLXZlbmVudW0nKTtcbiAgICB2YXIgZWFjaCA9IHJlcXVpcmUoJ3Byby1zaW5ndWxpcycpO1xuICAgIHZhciB1dGlscyA9IHJlcXVpcmUoJy4vVXRpbHMnKTtcblxuICAgIC8qKlxuICAgICAqIERlc2NyaXB0aW9uXG4gICAgICpcbiAgICAgKiBAY2xhc3NcbiAgICAgKiBAbmFtZSBhbGNoZW15LmVjcy5BZG1pbmlzdHJhdG9yXG4gICAgICovXG4gICAgcmV0dXJuIGNvcXVvVmVuZW51bSh7XG4gICAgICAgIC8qKiBAbGVuZHMgYWxjaGVteS5lY3MuQWRtaW5pc3RyYXRvci5wcm90b3R5cGUgKi9cblxuICAgICAgICAvKipcbiAgICAgICAgICogQWRkcyBhIG5ldyBjb21wb25lbnQgc3lzdGVtLiBBbnkgY29tcG9uZW50IHN5c3RlbSBzaG91bGQgaW1wbGVtZW50XG4gICAgICAgICAqIHRoZSBtZXRob2QgXCJ1cGRhdGVcIlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gbmV3U3lzdGVtIFRoZSBuZXcgY29tcG9uZW50IHN5c3RlbVxuICAgICAgICAgKi9cbiAgICAgICAgYWRkU3lzdGVtOiBmdW5jdGlvbiAobmV3U3lzdGVtKSB7XG4gICAgICAgICAgICBuZXdTeXN0ZW0uZW50aXRpZXMgPSB0aGlzLnJlcG87XG4gICAgICAgICAgICB0aGlzLnN5c3RlbXMucHVzaChuZXdTeXN0ZW0pO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTZXRzIGFuZCBvdmVycmlkZXMgdGhlIGRlZmF1bHRzIGNvbXBvbmVudHMgZm9yIGEgZ2l2ZW4gZW50aXR5XG4gICAgICAgICAqIHR5bGVcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IGtleSBUaGUgZW50aXR5IHR5cGUgaWRlbnRpZmllclxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gY29tcG9uZW50cyBUaGUgZGVmYXVsdCBjb21wb25lbnRzIGZvciB0aGVcbiAgICAgICAgICogICAgICBlbnRpdHkgdHlwZVxuICAgICAgICAgKi9cbiAgICAgICAgc2V0RW50aXR5RGVmYXVsdHM6IGZ1bmN0aW9uIChrZXksIGNvbXBvbmVudHMpIHtcbiAgICAgICAgICAgIHRoaXMuZGVmYXVsdHNba2V5XSA9IGltbXV0YWJsZS5mcm9tSlMoY29tcG9uZW50cyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEluaXRpYWxpemVzIHRoZSBhcHBsaWN0aW9uIGVudGl0aWVzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7QXJyYXl9IGxpc3QgQSBsaXN0IG9mIGVudGl0eSBjb25maWd1cmF0aW9ucyBvciBmdW5jdGlvbnNcbiAgICAgICAgICogICAgICB3aGljaCB3aWxsIGNyZWF0ZSBlbnRpdHkgY29uZmlndXJhdGlvbnMgYmFzZWQgb24gdGhlIGN1cnJlbnRcbiAgICAgICAgICogICAgICBhcHBsaWN0aW9uIHN0YXRlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7SW1tdXRhdGFibGV9IHN0YXRlIFRoZSBpbml0aWFsIGFwcGxpY2F0aW9uIHN0YXRlXG4gICAgICAgICAqL1xuICAgICAgICBpbml0RW50aXRpZXM6IGZ1bmN0aW9uIChsaXN0LCBzdGF0ZSkge1xuICAgICAgICAgICAgZWFjaChsaXN0LCBmdW5jdGlvbiAoY2ZnKSB7XG4gICAgICAgICAgICAgICAgaWYgKHV0aWxzLmlzRnVuY3Rpb24oY2ZnKSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmVudGl0aWVzRnJvbVN0YXRlLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgZm46IGNmZyxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLmNyZWF0ZUVudGl0eShjZmcpO1xuICAgICAgICAgICAgfSwgdGhpcyk7XG5cbiAgICAgICAgICAgIGVhY2godGhpcy5lbnRpdGllc0Zyb21TdGF0ZSwgdGhpcy51cGRhdGVEeW5hbWljRW50aXRpZXMsIHRoaXMsIFtzdGF0ZV0pO1xuXG4gICAgICAgICAgICB0aGlzLmxhc3RTdGF0ZSA9IHN0YXRlO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBVcGRhdGVzIGFsbCByZWdpc3RlcmVkIHN5c3RlbXMgYW5kIGV4aXN0aW5nIGVudGl0aWVzIHdpdGggdGhlIGN1cnJlbnRcbiAgICAgICAgICogYXBwbGljYXRpb24gc3RhdGVcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtJbW11dGF0YWJsZX0gc3RhdGUgVGhlIGN1cnJlbnQgYXBwbGljYXRpb24gc3RhdGVcbiAgICAgICAgICovXG4gICAgICAgIHVwZGF0ZTogZnVuY3Rpb24gKHN0YXRlKSB7XG4gICAgICAgICAgICB2YXIgYXJncyA9IFtzdGF0ZV07XG5cbiAgICAgICAgICAgIGlmIChzdGF0ZSAhPT0gdGhpcy5sYXN0U3RhdGUpIHtcbiAgICAgICAgICAgICAgICBlYWNoKHRoaXMuZW50aXRpZXNGcm9tU3RhdGUsIHRoaXMudXBkYXRlRHluYW1pY0VudGl0aWVzLCB0aGlzLCBhcmdzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZWFjaCh0aGlzLnN5c3RlbXMsIHRoaXMudXBkYXRlU3lzdGVtLCB0aGlzLCBhcmdzKTtcblxuICAgICAgICAgICAgdGhpcy5sYXN0U3RhdGUgPSBzdGF0ZTtcbiAgICAgICAgfSxcblxuICAgICAgICAvL1xuICAgICAgICAvL1xuICAgICAgICAvLyBwcml2YXRlIGhlbHBlclxuICAgICAgICAvL1xuICAgICAgICAvL1xuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB1cGRhdGVTeXN0ZW06IGZ1bmN0aW9uIChzeXN0ZW0sIGluZGV4LCBzdGF0ZSkge1xuICAgICAgICAgICAgc3lzdGVtLnVwZGF0ZShzdGF0ZSk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHVwZGF0ZUR5bmFtaWNFbnRpdGllczogZnVuY3Rpb24gKGNmZywgaW5kZXgsIHN0YXRlKSB7XG4gICAgICAgICAgICB2YXIgY3VycmVudExpc3QgPSBjZmcuY3VycmVudCB8fCBbXTtcbiAgICAgICAgICAgIHZhciBuZXdMaXN0ID0gdGhpcy5jcmVhdGVFbnRpdHlNYXAoY2ZnLmZuKHN0YXRlKSk7XG4gICAgICAgICAgICB2YXIgdG9CZVJlbW92ZWQgPSB0aGlzLmZpbmRJdGVtc05vdEluTGlzdChjdXJyZW50TGlzdCwgbmV3TGlzdCk7XG4gICAgICAgICAgICB2YXIgdG9CZUNyZWF0ZWQgPSB0aGlzLmZpbmRJdGVtc05vdEluTGlzdChuZXdMaXN0LCBjdXJyZW50TGlzdCk7XG5cbiAgICAgICAgICAgIGVhY2goT2JqZWN0LmtleXModG9CZVJlbW92ZWQpLCB0aGlzLnJlbW92ZUVudGl0eSwgdGhpcyk7XG4gICAgICAgICAgICBlYWNoKHRvQmVDcmVhdGVkLCB0aGlzLmNyZWF0ZUVudGl0eSwgdGhpcyk7XG5cbiAgICAgICAgICAgIGNmZy5jdXJyZW50ID0gbmV3TGlzdDtcbiAgICAgICAgfSxcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgY3JlYXRlRW50aXR5TWFwOiBmdW5jdGlvbiAobGlzdCkge1xuICAgICAgICAgICAgdmFyIHJlc3VsdCA9IHt9O1xuXG4gICAgICAgICAgICBlYWNoKGxpc3QsIGZ1bmN0aW9uIChjZmcpIHtcbiAgICAgICAgICAgICAgICByZXN1bHRbY2ZnLmlkXSA9IGNmZztcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICBmaW5kSXRlbXNOb3RJbkxpc3Q6IGZ1bmN0aW9uIChsaXN0MSwgbGlzdDIpIHtcbiAgICAgICAgICAgIHJldHVybiBlYWNoKGxpc3QxLCBmdW5jdGlvbiAoaXRlbSwga2V5KSB7XG4gICAgICAgICAgICAgICAgaWYgKCFsaXN0MltrZXldKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBpdGVtO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICBjcmVhdGVFbnRpdHk6IGZ1bmN0aW9uIChjZmcpIHtcbiAgICAgICAgICAgIHZhciBkZWZhdWx0cyA9IHRoaXMuZGVmYXVsdHNbY2ZnLnR5cGVdO1xuICAgICAgICAgICAgaWYgKGRlZmF1bHRzKSB7XG4gICAgICAgICAgICAgICAgY2ZnID0gZGVmYXVsdHMuc2V0KGNmZykudmFsKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChjZmcuY2hpbGRyZW4pIHtcbiAgICAgICAgICAgICAgICBjZmcuY2hpbGRyZW4gPSBlYWNoKGNmZy5jaGlsZHJlbiwgdGhpcy5jcmVhdGVFbnRpdHksIHRoaXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5yZXBvLmNyZWF0ZUVudGl0eShjZmcpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICByZW1vdmVFbnRpdHk6IGZ1bmN0aW9uIChlbnRpdHkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnJlcG8ucmVtb3ZlRW50aXR5KGVudGl0eSk7XG4gICAgICAgIH1cblxuICAgIH0pLndoZW5CcmV3ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGVudGl0eSByZXBvc2l0b3J5XG4gICAgICAgICAqXG4gICAgICAgICAqIEBwcm9wZXJ0eSByZXBvXG4gICAgICAgICAqIEB0eXBlIGFsY2hlbXkuZWNzLkFwb3RoZWNhcml1c1xuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5yZXBvID0gbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGxpc3Qgb2YgY29tcG9uZW50IHN5c3RlbXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHByb3BlcnR5IHN5c3RlbXNcbiAgICAgICAgICogQHR5cGUgQXJyYXlcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuc3lzdGVtcyA9IFtdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBIGxpc3Qgb2YgZnVuY3Rpb25zIHdoaWNoIGRlZmluZXMgYSBzZXQgb2YgZW50aXRpZXMgZGVwZW5kaW5nXG4gICAgICAgICAqIG9uIHRoZSBjdXJyZW50IGFwcGxpY2F0aW9uIHN0YXRlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwcm9wZXJ0eSBlbnRpdGllc0Zyb21TdGF0ZVxuICAgICAgICAgKiBAdHlwZSBBcnJheVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5lbnRpdGllc0Zyb21TdGF0ZSA9IFtdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgbGFzdCBhcHBsaWNhdGlvbiBzdGF0ZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcHJvcGVydHkgbGFzdFN0YXRlXG4gICAgICAgICAqIEB0eXBlIEltbXV0YXRhYmxlXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxhc3RTdGF0ZSA9IG51bGw7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBzZXQgb2YgY29tcG9uZW50IGRlZmF1bHRzIChtYXAgZW50aXR5VHlwZSAtPiBkZWZhdWx0IHZhbHVlcylcbiAgICAgICAgICpcbiAgICAgICAgICogQHByb3BlcnR5IGRlZmF1bHRzXG4gICAgICAgICAqIEB0eXBlIE9iamVjdFxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5kZWZhdWx0cyA9IHt9O1xuXG4gICAgfSkud2hlbkRpc3Bvc2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZWFjaCh0aGlzLnN5c3RlbXMsIGZ1bmN0aW9uIChzeXN0ZW0sIGluZGV4KSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbXNbaW5kZXhdLmVudGl0aWVzID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtc1tpbmRleF0uZGlzcG9zZSgpO1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW1zW2luZGV4XSA9IG51bGw7XG4gICAgICAgIH0sIHRoaXMpO1xuICAgIH0pO1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgaW1tdXRhYmxlID0gcmVxdWlyZSgnaW1tdXRhYmlsaXMnKTtcbiAgICB2YXIgY29xdW9WZW5lbnVtID0gcmVxdWlyZSgnY29xdW8tdmVuZW51bScpO1xuICAgIHZhciBlYWNoID0gcmVxdWlyZSgncHJvLXNpbmd1bGlzJyk7XG4gICAgdmFyIHV0aWxzID0gcmVxdWlyZSgnLi9VdGlscycpO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHByaW1hcnkgZW50aXR5IG1hbmFnZXIgKGFuIGFwb3RoZWNhcml1cyBpcyBhIHN0b3JhZ2UgbWFuYWdlcilcbiAgICAgKiBcIk9uZSBwb3Rpb24gdG8gcnVsZSB0aGVtIGFsbCwgb25lIHBvdGlvbiB0byBmaW5kIHRoZW0sXG4gICAgICogb25lIHBvdGlvbiB0byBicmluZyB0aGVtIGFsbCBhbmQgaW4gdGhlIGRhcmtuZXNzIGJpbmQgdGhlbVwiXG4gICAgICpcbiAgICAgKiBAY2xhc3NcbiAgICAgKiBAbmFtZSBhbGNoZW15LmVjcy5BcG90aGVjYXJpdXNcbiAgICAgKiBAZXh0ZW5kcyBhbGNoZW15LmNvcmUuTWF0ZXJpYVByaW1hXG4gICAgICovXG4gICAgcmV0dXJuIGNvcXVvVmVuZW51bSh7XG4gICAgICAgIC8qKiBAbGVuZHMgYWxjaGVteS5lY3MuQXBvdGhlY2FyaXVzLnByb3RvdHlwZSAqL1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDcmVhdGVzIGEgbmV3IGVudGl0eSAoYSBzZXQgb2YgY29tcG9uZW50cylcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IGNmZyBUaGUgZW50aXR5IHR5cGUgb3IgYSBjdXN0b20gY29tcG9uZW50XG4gICAgICAgICAqICAgICAgY29uZmlndXJhdGlvbnNcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IFtjZmcuaWRdIE9wdGlvbmFsLiBBbiBlbnRpdHkgSUQuIElmIG9tbWl0dGVkIGEgbmV3XG4gICAgICAgICAqICAgICAgb25lIHdpbGwgYmUgY3JlYXRlZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJuIHtTdHJpbmd9IFRoZSBpZCBvZiB0aGUgbmV3IGVudGl0eVxuICAgICAgICAgKi9cbiAgICAgICAgY3JlYXRlRW50aXR5OiBmdW5jdGlvbiAoY2ZnKSB7XG4gICAgICAgICAgICB2YXIgZW50aXR5SWQgPSBjZmcuaWQgfHwgdXRpbHMuaWQoKTtcbiAgICAgICAgICAgIGlmICh0aGlzLmNvbnRhaW5zKGVudGl0eUlkKSkge1xuICAgICAgICAgICAgICAgIHRocm93ICdUaGUgaWQ6IFwiJyArIGVudGl0eUlkICsgJ1wiIGlzIGFscmVhZHkgdXNlZCc7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuZW50aXRpZXNbZW50aXR5SWRdID0ge1xuICAgICAgICAgICAgICAgIGlkOiBlbnRpdHlJZCxcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzOiBbXSxcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vIGNyZWF0ZSB0aGUgY29tcG9uZW50cyBvZiB0aGUgbmV3IGVudGl0eVxuICAgICAgICAgICAgZWFjaChjZmcsIGZ1bmN0aW9uIChjb21wb25lbnQsIGtleSkge1xuICAgICAgICAgICAgICAgIGlmIChrZXkgPT09ICdpZCcgfHwga2V5ID09PSAndHlwZScpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuc2V0Q29tcG9uZW50KGVudGl0eUlkLCBrZXksIGNvbXBvbmVudCk7XG4gICAgICAgICAgICB9LCB0aGlzKTtcblxuICAgICAgICAgICAgcmV0dXJuIGVudGl0eUlkO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDaGVja3MgaWYgYW4gZW50aXR5IHdpdGggdGhlIGdpdmVuIGlkIGV4aXN0c1xuICAgICAgICAgKiBAcmV0dXJuIEJvb2xlYW5cbiAgICAgICAgICovXG4gICAgICAgIGNvbnRhaW5zOiBmdW5jdGlvbiAoZW50aXR5SWQpIHtcbiAgICAgICAgICAgIHJldHVybiB1dGlscy5pc09iamVjdCh0aGlzLmVudGl0aWVzW2VudGl0eUlkXSk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENvbXBsZXRlbHkgcmVtb3ZlcyBhbGwgZXhpc3RpbmcgZW50aXRpZXMgYW5kIHRoZWlyXG4gICAgICAgICAqIGNvbXBvbmVudHMgLSBUaGUgdG90YWwgY2xlYW4tdXAgLSBUaGUgZW5kIG9mIGRheXMuLi5cbiAgICAgICAgICovXG4gICAgICAgIHJlbW92ZUFsbEVudGl0aWVzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBlYWNoKE9iamVjdC5rZXlzKHRoaXMuZW50aXRpZXMpLCB0aGlzLnJlbW92ZUVudGl0eSwgdGhpcyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlbW92ZXMgYW4gZW50aXR5IGFuZCBhbGwgaXRzIGNvbXBvbmVudHNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IGVudGl0eUlkIFRoZSBpZCBvZiBlbnRpdHkgdG8gcmVtb3ZlXG4gICAgICAgICAqL1xuICAgICAgICByZW1vdmVFbnRpdHk6IGZ1bmN0aW9uIChlbnRpdHlJZCkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmNvbnRhaW5zKGVudGl0eUlkKSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGVudGl0eSA9IHRoaXMuZW50aXRpZXNbZW50aXR5SWRdO1xuICAgICAgICAgICAgdmFyIGNtcHMgPSBlbnRpdHkuY29tcG9uZW50cztcblxuICAgICAgICAgICAgd2hpbGUgKGNtcHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVtb3ZlQ29tcG9uZW50KGVudGl0eSwgY21wc1swXSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuZW50aXRpZXNbZW50aXR5SWRdID0gbnVsbDtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVtb3ZlcyBhIHNpbmdsZSBjb21wb25lbnQgb2YgYW4gZW50aXR5OyBUaGUgcmVtb3ZlZCBjb21wb25lbnQgaXMgZGlzcG9zZWRcbiAgICAgICAgICogaWYgaXQgaXMgYSBwb3Rpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd8T2JqZWN0fSBlbnRpdHkgVGhlIGVudGl0eSBvYmplY3Qgb3IgaXRzIGlkIChJdCBpcyByZWNvbW1lbmRlZCB0byB1c2VcbiAgICAgICAgICogICAgICB0aGUgaWRzIGZvciBwdWJsaWMgYWNjZXNzISEhKVxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ3xOdW1iZXJ9IHR5cGUgVGhlIGNvbXBvbmVudCB0eXBlIHRvIHJlbW92ZSBvciBpdHMgaW5kZXggKHRoZSBpbmRleFxuICAgICAgICAgKiAgICAgIGlzIGZvciBwcml2YXRlIHVzYWdlISEhKVxuICAgICAgICAgKi9cbiAgICAgICAgcmVtb3ZlQ29tcG9uZW50OiBmdW5jdGlvbiAoZW50aXR5SWQsIHR5cGUpIHtcbiAgICAgICAgICAgIHZhciBlbnRpdHkgPSB1dGlscy5pc09iamVjdChlbnRpdHlJZCkgPyBlbnRpdHlJZCA6IHRoaXMuZW50aXRpZXNbZW50aXR5SWRdO1xuICAgICAgICAgICAgaWYgKCF1dGlscy5pc09iamVjdChlbnRpdHkpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgJ1Vua25vd24gZW50aXR5OiBcIicgKyBlbnRpdHlJZCArICdcIic7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBpbmRleCA9IGVudGl0eS5jb21wb25lbnRzLmluZGV4T2YodHlwZSk7XG4gICAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgICAgIGVudGl0eS5jb21wb25lbnRzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uID0gdGhpcy5jb21wb25lbnRzW3R5cGVdO1xuICAgICAgICAgICAgaWYgKGNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICBjb2xsZWN0aW9uW2VudGl0eS5pZF0gPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXR1cm5zIGFuIGFycmF5IGNvbnRhaW5pbmcgYWxsIGNvbXBvbmVudHMgb2YgYSBnaXZlIHR5cGVcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IHR5cGUgVGhlIGNvbXBvbmVudCBpZGVudGlmaWVyXG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH0gQW4gZW50aXR5SWQtdG8tY29tcG9uZW50IGhhc2ggbWFwXG4gICAgICAgICAqL1xuICAgICAgICBnZXRBbGxDb21wb25lbnRzT2ZUeXBlOiBmdW5jdGlvbiAodHlwZSkge1xuICAgICAgICAgICAgcmV0dXJuIGVhY2godGhpcy5jb21wb25lbnRzW3R5cGVdLCBmaWx0ZXJFeGlzdGluZyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJldHVybnMgYWxsIGNvbXBvbmVudCB2YWx1ZXMgZm9yIGEgZ2l2ZW4gZW50aXR5XG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBlbnRpdHlJZCBUaGUgZW50aXR5IGlkZW50aWZpZXIgKHJldHVybmVkIGJ5IFwiY3JlYXRlRW50aXR5XCIpXG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH0gQSBtYXAgKGNvbXBvbmVudCBpZGVudGlmaWVyIC0+IGNvbXBvbmVudCB2YWx1ZSkgY29udGFpbmluZ1xuICAgICAgICAgKiAgICAgIGFsbCBjb21wb25lbnRzIG9mIHRoZSByZXF1ZXN0ZWQgZW50aXR5IChUaGUgbWFwIHdpbGwgYmUgZW1wdHkgaWYgdGhlXG4gICAgICAgICAqICAgICAgZW50aXR5IGRvZXMgbm90IGV4aXN0KVxuICAgICAgICAgKlxuICAgICAgICAgKi9cbiAgICAgICAgZ2V0QWxsQ29tcG9uZW50c09mRW50aXR5OiBmdW5jdGlvbiAoZW50aXR5SWQpIHtcbiAgICAgICAgICAgIHZhciByZXN1bHQgPSB7fTtcbiAgICAgICAgICAgIHZhciBlbnRpdHkgPSB0aGlzLmVudGl0aWVzW2VudGl0eUlkXTtcbiAgICAgICAgICAgIHZhciBjb21wb25lbnRUeXBlcyA9IGVudGl0eSAmJiBlbnRpdHkuY29tcG9uZW50cztcblxuICAgICAgICAgICAgZWFjaChjb21wb25lbnRUeXBlcywgZnVuY3Rpb24gKHR5cGUpIHtcbiAgICAgICAgICAgICAgICByZXN1bHRbdHlwZV0gPSB0aGlzLmdldENvbXBvbmVudERhdGEoZW50aXR5SWQsIHR5cGUpO1xuICAgICAgICAgICAgfSwgdGhpcyk7XG5cbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJldHVybnMgdGhlIGltbXV0YWJsZSBjb21wb25lbnQgb2YgYSBnaXZlbiB0eXBlIGZvciB0aGUgc3BlY2lmaWVkXG4gICAgICAgICAqIGVudGl0eSBzcGVjaWZpYyBlbnRpdHkgb2YgYWxsIG9mIHRoYXQgdHlwZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gZW50aXR5SWQgQW4gZW50aXR5IGlkXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBjb21wb25lbnRLZXkgVGhlIGNvbXBvbmVudCB0eXBlXG4gICAgICAgICAqIEByZXR1cm4ge0ltbXV0YXRhYmxlfSBUaGUgaW1tdXRhYmxlIGRhdGEgb2YgYSBzaW5nbGUgY29tcG9uZW50XG4gICAgICAgICAqL1xuICAgICAgICBnZXRDb21wb25lbnQ6IGZ1bmN0aW9uIChlbnRpdHlJZCwgY29tcG9uZW50S2V5KSB7XG4gICAgICAgICAgICB2YXIgY29sbGVjdGlvbiA9IHRoaXMuY29tcG9uZW50c1tjb21wb25lbnRLZXldO1xuICAgICAgICAgICAgcmV0dXJuIGNvbGxlY3Rpb24gJiYgY29sbGVjdGlvbltlbnRpdHlJZF07XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJldHVybnMgdGhlIHJhdyBjb21wb25lbnQgZGF0YSBvZiBhIGdpdmVuIHR5cGUgZm9yIHRoZSBzcGVjaWZpZWRcbiAgICAgICAgICogZW50aXR5IHNwZWNpZmljIGVudGl0eSBvZiBhbGwgb2YgdGhhdCB0eXBlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBlbnRpdHlJZCBBbiBlbnRpdHkgaWRcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IGNvbXBvbmVudEtleSBUaGUgY29tcG9uZW50IHR5cGVcbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fSBUaGUgcmF3IGRhdGEgZm9yIHNpbmdsZSBjb21wb25lbnRcbiAgICAgICAgICovXG4gICAgICAgIGdldENvbXBvbmVudERhdGE6IGZ1bmN0aW9uIChlbnRpdHlJZCwgY29tcG9uZW50S2V5KSB7XG4gICAgICAgICAgICB2YXIgY29tcG9uZW50ID0gdGhpcy5nZXRDb21wb25lbnQoZW50aXR5SWQsIGNvbXBvbmVudEtleSk7XG4gICAgICAgICAgICByZXR1cm4gY29tcG9uZW50ICYmIGNvbXBvbmVudC52YWwoKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQWRkIGEgY29tcG9uZW50IHRvIGFuIGVudGl0eVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gZW50aXR5SWQgVGhlIGVudGl0eSBpZGVudGlmaWVyXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBrZXkgVGhlIGNvbXBvbmVudCBpZGVudGlmaWVyXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBjZmcgVGhlIGNvbXBvbmVudCBjb25maWd1cmF0aW9uXG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH0gVGhlIGFkZGVkIGNvbXBvbmVudCBvYmplY3RcbiAgICAgICAgICovXG4gICAgICAgIHNldENvbXBvbmVudDogZnVuY3Rpb24gKGVudGl0eUlkLCBrZXksIGNmZykge1xuICAgICAgICAgICAgdmFyIGVudGl0eSA9IHRoaXMuZW50aXRpZXNbZW50aXR5SWRdO1xuICAgICAgICAgICAgaWYgKCFlbnRpdHkpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyAnVW5rbm93biBlbnRpdHk6IFwiJyArIGVudGl0eUlkICsgJ1wiJztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb24gPSB0aGlzLmNvbXBvbmVudHNba2V5XTtcbiAgICAgICAgICAgIGlmICghY29sbGVjdGlvbikge1xuICAgICAgICAgICAgICAgIC8vIGl0J3MgdGhlIGZpcnN0IGNvbXBvbmVudCBvZiB0aGlzIHR5cGVcbiAgICAgICAgICAgICAgICAvLyAtPiBjcmVhdGUgYSBuZXcgY29sbGVjdGlvblxuICAgICAgICAgICAgICAgIGNvbGxlY3Rpb24gPSB7fTtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbXBvbmVudHNba2V5XSA9IGNvbGxlY3Rpb247XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBjbXAgPSBjb2xsZWN0aW9uW2VudGl0eUlkXTtcbiAgICAgICAgICAgIGlmIChjbXApIHtcbiAgICAgICAgICAgICAgICAvLyB1cGRhdGUgZXhpc3RpbmcgY29tcG9uZW50XG4gICAgICAgICAgICAgICAgY21wID0gY21wLnNldChjZmcpO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIGFkZCBuZXcgY29tcG9uZW50XG4gICAgICAgICAgICAgICAgY21wID0gaW1tdXRhYmxlLmZyb21KUyhjZmcpO1xuICAgICAgICAgICAgICAgIGVudGl0eS5jb21wb25lbnRzLnB1c2goa2V5KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29sbGVjdGlvbltlbnRpdHlJZF0gPSBjbXA7XG5cbiAgICAgICAgICAgIHJldHVybiBjbXAudmFsKCk7XG4gICAgICAgIH0sXG5cbiAgICB9KS53aGVuQnJld2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBzZXRzIG9mIGRpZmZlcmVudCBjb21wb25lbnRzIChtYXAgY29tcG9uZW50XG4gICAgICAgICAqIHR5cGUgbmFtZSAtPiBjb2xsZWN0aW9uIG9mIGNvbXBvbmVudCBpbnN0YW5jZSlcbiAgICAgICAgICpcbiAgICAgICAgICogQHByb3BlcnR5IGNvbXBvbmVudHNcbiAgICAgICAgICogQHR5cGUge09iamVjdH1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuY29tcG9uZW50cyA9IHt9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgY29sbGVjdGlvbiBvZiByZWdpc3RlcmVkIGVudGl0aWVzOyBlYWNoIGVudGl0eSBpcyBhbiBvYmplY3Qgd2l0aFxuICAgICAgICAgKiBhbiA8Y29kZT5pZDwvY29kZT4gYW5kIGFuIGFycmF5IG9mIHN0cmluZ3MgKDxjb2RlPmNvbXBvbmVudHM8L2NvZGU+KVxuICAgICAgICAgKiB3aGljaCByZWZlciB0aGUgZW50aXR5J3MgY29tcG9uZW50c1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcHJvcGVydHkgZW50aXRpZXNcbiAgICAgICAgICogQHR5cGUge09iamVjdH1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuZW50aXRpZXMgPSB7fTtcblxuICAgIH0pLndoZW5EaXNwb3NlZChmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMucmVtb3ZlQWxsRW50aXRpZXMoKTtcbiAgICB9KTtcblxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgZnVuY3Rpb24gZmlsdGVyRXhpc3Rpbmcob2JqKSB7XG4gICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICAgIHJldHVybiBvYmoudmFsKCk7XG4gICAgICAgIH1cbiAgICB9XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBpbW11dGFibGUgPSByZXF1aXJlKCdpbW11dGFiaWxpcycpO1xuICAgIHZhciBjb3F1b1ZlbmVudW0gPSByZXF1aXJlKCdjb3F1by12ZW5lbnVtJyk7XG4gICAgdmFyIGVhY2ggPSByZXF1aXJlKCdwcm8tc2luZ3VsaXMnKTtcbiAgICB2YXIgdXRpbHMgPSByZXF1aXJlKCcuL1V0aWxzJyk7XG4gICAgdmFyIE9ic2VydmFyaSA9IHJlcXVpcmUoJy4vT2JzZXJ2YXJpJyk7XG5cbiAgICAvKipcbiAgICAgKiBEZXNjcmlwdGlvblxuICAgICAqXG4gICAgICogQGNsYXNzXG4gICAgICogQG5hbWUgYWxjaGVteS53ZWIuQXBwbGljYXR1c1xuICAgICAqIEBleHRlbmRzIGFsY2hlbXkuY29yZS5NYXRlcmlhUHJpbWFcbiAgICAgKi9cbiAgICByZXR1cm4gY29xdW9WZW5lbnVtKHtcbiAgICAgICAgLyoqIEBsZW5kcyBhbGNoZW15LndlYi5BcHBsaWNhdHVzLnByb3RvdHlwZSAqL1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiA8Y29kZT50cnVlPC9jb2RlPiBpZiB0aGUgYXBwIGlzIHJ1bm5pbmdcbiAgICAgICAgICpcbiAgICAgICAgICogQHByb3BlcnR5IHJ1bnNcbiAgICAgICAgICogQHR5cGUgQm9vbGVhblxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgcnVuczogZmFsc2UsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBnbG9iYWwgbWVzc2FnZSBidXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHByb3BlcnR5IG1lc3NhZ2VzXG4gICAgICAgICAqIEB0eXBlIGFsY2hlbXkuY29yZS5PYnNlcnZhcmlcbiAgICAgICAgICogQHByb3RlY3RlZFxuICAgICAgICAgKi9cbiAgICAgICAgbWVzc2FnZXM6IHVuZGVmaW5lZCxcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGFwcGxpY2F0aW9uIHN0YXRlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwcm9wZXJ0eSBzdGF0ZVxuICAgICAgICAgKiBAdHlwZSBJbW11dGFibGVcbiAgICAgICAgICogQHByb3RlY3RlZFxuICAgICAgICAgKi9cbiAgICAgICAgc3RhdGU6IHVuZGVmaW5lZCxcblxuICAgICAgICAvKipcbiAgICAgICAgICogSG9vay1tZXRob2Q7IGNhbGxlZCB3aGVuIGxhdW5jaGluZyB0aGUgYXBwXG4gICAgICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgICAgICovXG4gICAgICAgIG9uTGF1bmNoOiB1dGlscy5lbXB0eUZuLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBIb29rLW1ldGhvZDsgY2FsbGVkIGJlZm9yZSBjbG9zaW5nIHRoZSBhcHBcbiAgICAgICAgICogQHByb3RlY3RlZFxuICAgICAgICAgKi9cbiAgICAgICAgb25TaHV0ZG93bjogdXRpbHMuZW1wdHlGbixcblxuICAgICAgICAvKipcbiAgICAgICAgICogSG9vay1tZXRob2Q7IGNhbGxlZCBpbiBlYWNoIGxvb3AgcnVuIHRvIHVwZGF0ZSB0aGUgYXBwbGljYXRpb24gc3RhdGVcbiAgICAgICAgICogQHByb3RlY3RlZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gbG9vcFBhcmFtcyBUaGUgcGFyYW1ldGVyIG9mIHRoZSBjdXJyZW50IGxvb3AgaXRlcmF0aW9uXG4gICAgICAgICAqIEBwYXJhbSB7TnVtYmVyfSBsb29wUGFyYW1zLm5vdyBUaGUgY3VycmVudCB0aW1lc3RhbXBcbiAgICAgICAgICogQHBhcmFtIHtOdW1iZXJ9IGxvb3BQYXJhbXMuZnJhbWUgVGhlIG51bWJlciBvZiB0aGUgY3VycmVudCBpdGVyYXRpb25cbiAgICAgICAgICogQHBhcmFtIHtOdW1iZXJ9IGxvb3BQYXJhbXMuZnBzIFRoZSBmcmFtZXMgcGVyIHNlY29uZFxuICAgICAgICAgKiBAcGFyYW0ge1N0YXRlfSBsb29wUGFyYW1zLnN0YXRlIFRoZSBjdXJyZW50IGFwcGxpY2F0aW9uIHN0YXRlXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm4gT2JqZWN0IFRoZSBuZXcgYXBwbGljYXRpb24gc3RhdGVcbiAgICAgICAgICovXG4gICAgICAgIHVwZGF0ZTogdXRpbHMuZW1wdHlGbixcblxuICAgICAgICAvKipcbiAgICAgICAgICogSG9vay1tZXRob2Q7IGNhbGxlZCBpbiBlYWNoIGxvb3AgcnVuIHRvIHVwZGF0ZSB0aGUgYXBwbGljYXRpb24gdmlld1xuICAgICAgICAgKiBAcHJvdGVjdGVkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBsb29wUGFyYW1zIFRoZSBwYXJhbWV0ZXIgb2YgdGhlIGN1cnJlbnQgbG9vcCBpdGVyYXRpb25cbiAgICAgICAgICogQHBhcmFtIHtOdW1iZXJ9IGxvb3BQYXJhbXMubm93IFRoZSBjdXJyZW50IHRpbWVzdGFtcFxuICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gbG9vcFBhcmFtcy5mcmFtZSBUaGUgbnVtYmVyIG9mIHRoZSBjdXJyZW50IGl0ZXJhdGlvblxuICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gbG9vcFBhcmFtcy5mcHMgVGhlIGZyYW1lcyBwZXIgc2Vjb25kXG4gICAgICAgICAqIEBwYXJhbSB7U3RhdGV9IGxvb3BQYXJhbXMuc3RhdGUgVGhlIGN1cnJlbnQgYXBwbGljYXRpb24gc3RhdGVcbiAgICAgICAgICovXG4gICAgICAgIGRyYXc6IHV0aWxzLmVtcHR5Rm4sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFN0YXJ0cyB0aGUgYXBwbGljYXRpb24gbG9vcDtcbiAgICAgICAgICogVGhpcyB3aWxsIGNhbGwgdGhlIHtAbGluayAjb25MYXVuY2h9IGhvb2sgbWV0aG9kXG4gICAgICAgICAqL1xuICAgICAgICBsYXVuY2g6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnJ1bnMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMucnVucyA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmZyYW1lID0gMDtcbiAgICAgICAgICAgIHRoaXMubGFzdFRpY2sgPSB1dGlscy5ub3coKTtcbiAgICAgICAgICAgIHRoaXMub25MYXVuY2goKTtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBGaXJlZCBhZnRlciBhcHBsaWNhdGlvbiBpcyByZWFkeVxuICAgICAgICAgICAgICogQGV2ZW50XG4gICAgICAgICAgICAgKiBAbmFtZSBhcHA6c3RhcnRcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5tZXNzYWdlcy50cmlnZ2VyKCdhcHA6c3RhcnQnKTtcblxuICAgICAgICAgICAgLy8gc3RhcnQgdGhlIHVwZGF0ZS9kcmF3LWxvb3BcbiAgICAgICAgICAgIHRoaXMuYm91bmRMb29wRm4gPSB0aGlzLmNyZWF0ZUxvb3BGdW5jdGlvbih0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuYm91bmRMb29wRm4oKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogc3RvcHMgdGhlIGFwcGxpY2F0aW9uIGxvb3A7XG4gICAgICAgICAqIHRoaXMgd2lsbCBjYWxsIHRoZSB7QGxpbmsgI2ZpbmlzaH0gbWV0aG9kXG4gICAgICAgICAqL1xuICAgICAgICBzaHV0ZG93bjogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLnJ1bnMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmxvb3BJZCkge1xuICAgICAgICAgICAgICAgIHZhciBjYW5jZWxBbmltYXRpb25GcmFtZSA9IHRoaXMuY2FuY2VsQW5pbWF0aW9uRnJhbWU7XG5cbiAgICAgICAgICAgICAgICBjYW5jZWxBbmltYXRpb25GcmFtZSh0aGlzLmxvb3BJZCk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLmJvdW5kTG9vcEZuID0gbnVsbDtcbiAgICAgICAgICAgICAgICB0aGlzLmxvb3BJZCA9IG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMub25TaHV0ZG93bigpO1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIEZpcmVkIGFmdGVyIGFwcGxpY2F0aW9uIGlzIHNodXQgZG93blxuICAgICAgICAgICAgICogQGV2ZW50XG4gICAgICAgICAgICAgKiBAbmFtZSBhcHA6c3RvcFxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLm1lc3NhZ2VzLnRyaWdnZXIoJ2FwcDpzdG9wJyk7XG4gICAgICAgICAgICB0aGlzLnJ1bnMgPSBmYWxzZTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmV0dXJucyA8Y29kZT50cnVlPC9jb2RlPiBpZiBhbmQgb25seSBpZiB0aGUgY3VycmVudCBhcHBsaWNhdGlvblxuICAgICAgICAgKiBpcyBydW5uaW5nIChpdCBtYXkgb3IgbWF5IG5vdCBiZSBwYXVzZWQgdGhvdWdoKVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJuIHtCb29sZWFufVxuICAgICAgICAgKi9cbiAgICAgICAgaXNSdW5uaW5nOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5ydW5zO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDb25uZWN0cyB0aGUgbWVzc2FnZSBidXMgZXZlbnRzIHdpdGggaGFuZGxlci9jb250cm9sbGVyXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSBPYmplY3QgY29udHJvbGxlciBUaGUgY29udHJvbGxlciBvYmplY3QgdG8gaGFuZGxlIHRoZSBtZXNzYWdlXG4gICAgICAgICAqICAgICAgYnVzIGV2ZW50cy4gQSBjb250cm9sbGVyIG9iamVjdCBoYXMgdG8gcHJvdmlkZSBhIG1lc3NhZ2VzXG4gICAgICAgICAqICAgICAgcHJvcGVydHkgd2hpY2ggbWFwcyBhbiBldmVudCB0byBhbiBldmVudCBoYW5kbGVyIG1ldGhvZC4gVGhlXG4gICAgICAgICAqICAgICAgaGFuZGxlciBtZXRob2QgaXMgY2FsbGVkIHdpdGggdGhlIGV2ZW50IGRhdGEgYW5kIHRoZSBjdXJyZW50XG4gICAgICAgICAqICAgICAgYXBwbGljYXRpb24gc3RhdGUuIFRoZSByZXR1cm4gdmFsdWUgb2YgdGhlIGhhbmRsZXIgbWV0aG9kIHdpbGxcbiAgICAgICAgICogICAgICBiZSB0aGUgbmV3IGFwcGxpY2F0aW9uIHN0YXRlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIHZhciBjb250cm9sbGVyID0ge1xuICAgICAgICAgKiAgIG1lc3NhZ2VzOiB7XG4gICAgICAgICAqICAgICAnYXBwOnN0YXJ0JzogJ29uQXBwU3RhcnQnLFxuICAgICAgICAgKiAgICAgLi4uXG4gICAgICAgICAqICAgfSxcbiAgICAgICAgICpcbiAgICAgICAgICogICBvbkFwcFN0YXJ0OiBmdW5jdGlvbiAoZGF0YSwgc3RhdGUpIHtcbiAgICAgICAgICogICAgIC4uLiAvLyBoYW5kbGUgZXZlbnRcbiAgICAgICAgICogICAgIHJldHVybiBuZXdTdGF0ZTtcbiAgICAgICAgICogICB9LFxuICAgICAgICAgKlxuICAgICAgICAgKiAgIC4uLlxuICAgICAgICAgKiB9O1xuICAgICAgICAgKi9cbiAgICAgICAgd2lyZVVwOiBmdW5jdGlvbiAoY29udHJvbGxlcikge1xuICAgICAgICAgICAgaWYgKCFjb250cm9sbGVyKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgJ0ludmFsaWQgaW5wdXQ6IEVtcHR5IHZhbHVlJztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFjb250cm9sbGVyLm1lc3NhZ2VzKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgJ0ludmFsaWQgaW5wdXQ6IE1lc3NhZ2UgbWFwIG1pc3NpbmcnO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBlYWNoKGNvbnRyb2xsZXIubWVzc2FnZXMsIGZ1bmN0aW9uIChmbk5hbWUsIG1lc3NhZ2UpIHtcbiAgICAgICAgICAgICAgICB0aGlzLm1lc3NhZ2VzLm9uKG1lc3NhZ2UsIGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBmbiA9IGNvbnRyb2xsZXJbZm5OYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IGZuLmNhbGwoY29udHJvbGxlciwgdGhpcy5zdGF0ZSwgZGF0YSk7XG4gICAgICAgICAgICAgICAgfSwgdGhpcyk7XG4gICAgICAgICAgICB9LCB0aGlzKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvL1xuICAgICAgICAvL1xuICAgICAgICAvLyBwcml2YXRlIGhlbHBlclxuICAgICAgICAvL1xuICAgICAgICAvL1xuXG4gICAgICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZTogd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSxcbiAgICAgICAgY2FuY2VsQW5pbWF0aW9uRnJhbWU6IHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ3JlYXRzIHRoZSBhcHBsaWNhdGlvbiBsb29wIG1ldGhvZCB3aGljaCBjYWxsZWQgZXZlcnkgaXRlcmF0aW9uO1xuICAgICAgICAgKiB3aWxsIGNhbGwgdGhlIHtAbGluayAjdXBkYXRlfSBhbmQgdGhlIHtAbGluayAjZHJhd30gbWV0aG9kXG4gICAgICAgICAqIEBmdW5jdGlvblxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgY3JlYXRlTG9vcEZ1bmN0aW9uOiBmdW5jdGlvbiAoYXBwKSB7XG4gICAgICAgICAgICAvLyBVc2UgYW4gaW5zdGFuY2Ugb2YgXCJMb29wUGFyYW1ldGVyXCIgaW5zdGVhZCBvZiBhIGdlbmVyaWMgb2JqZWN0XG4gICAgICAgICAgICAvLyBiZWNhdXNlIG1vc3QgamF2YXNjcmlwdCBpbnRlcnByZXRlciBoYXZlIG9wdGltaXplZCBwcm9wZXJ0eVxuICAgICAgICAgICAgLy8gYWNjZXNzIGZvciBvYmplY3RzIHdpdGggYSBcImhpZGRlbiBjbGFzc1wiXG4gICAgICAgICAgICBmdW5jdGlvbiBMb29wUGFyYW1ldGVyKCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZnJhbWUgPSAwO1xuICAgICAgICAgICAgICAgIHRoaXMubm93ID0gMDtcbiAgICAgICAgICAgICAgICB0aGlzLmRlbGF5ID0gMDtcbiAgICAgICAgICAgICAgICB0aGlzLmZwcyA9IDA7XG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciB0aGVuID0gdXRpbHMubm93KCk7XG4gICAgICAgICAgICB2YXIgZnJhbWUgPSAwO1xuICAgICAgICAgICAgdmFyIGxvb3BQYXJhbXMgPSBuZXcgTG9vcFBhcmFtZXRlcigpO1xuICAgICAgICAgICAgdmFyIGZwcyA9IDYwO1xuICAgICAgICAgICAgdmFyIGRlbGF5ID0gMTAwMCAvIGZwcztcbiAgICAgICAgICAgIHZhciByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSB0aGlzLnJlcXVlc3RBbmltYXRpb25GcmFtZTtcblxuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIGxvb3Aobm93KSB7XG4gICAgICAgICAgICAgICAgbm93ICA9IG5vdyB8fCB1dGlscy5ub3coKTtcbiAgICAgICAgICAgICAgICBkZWxheSA9IDAuOTUgKiBkZWxheSArIDAuMDUgKiAobm93IC0gdGhlbik7XG4gICAgICAgICAgICAgICAgZnBzID0gMTAwMCAvIGRlbGF5O1xuICAgICAgICAgICAgICAgIHRoZW4gPSBub3c7XG4gICAgICAgICAgICAgICAgZnJhbWUrKztcblxuICAgICAgICAgICAgICAgIC8vIHVwZGF0ZSB0aGUgcGFyYW1ldGVyIHNldCBmb3IgdGhlIGN1cnJlbnQgaXRlcmF0aW9uXG4gICAgICAgICAgICAgICAgbG9vcFBhcmFtcy5mcmFtZSA9IGZyYW1lO1xuICAgICAgICAgICAgICAgIGxvb3BQYXJhbXMubm93ID0gbm93O1xuICAgICAgICAgICAgICAgIGxvb3BQYXJhbXMuZGVsYXkgPSBNYXRoLnJvdW5kKGRlbGF5KTtcbiAgICAgICAgICAgICAgICBsb29wUGFyYW1zLmZwcyA9IE1hdGgucm91bmQoZnBzKTtcbiAgICAgICAgICAgICAgICBsb29wUGFyYW1zLnN0YXRlID0gYXBwLnN0YXRlO1xuXG4gICAgICAgICAgICAgICAgdmFyIG5ld1N0YXRlID0gYXBwLnVwZGF0ZShsb29wUGFyYW1zKTtcbiAgICAgICAgICAgICAgICBpZiAobmV3U3RhdGUgJiYgbmV3U3RhdGUgIT09IGFwcC5zdGF0ZSkge1xuICAgICAgICAgICAgICAgICAgICBhcHAuc3RhdGUgPSBuZXdTdGF0ZTtcbiAgICAgICAgICAgICAgICAgICAgbG9vcFBhcmFtcy5zdGF0ZSA9IGFwcC5zdGF0ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBhcHAuZHJhdyhsb29wUGFyYW1zKTtcblxuICAgICAgICAgICAgICAgIGFwcC5sb29wSWQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoYXBwLmJvdW5kTG9vcEZuKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0sXG5cbiAgICB9KS53aGVuQnJld2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5tZXNzYWdlcyA9IE9ic2VydmFyaS5icmV3KCk7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBpbW11dGFibGUuZnJvbUpTKCk7XG5cbiAgICB9KS53aGVuRGlzcG9zZWQoZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnNodXRkb3duKCk7XG4gICAgfSk7XG5cbn0oKSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIGNvcXVvVmVuZW51bSA9IHJlcXVpcmUoJ2NvcXVvLXZlbmVudW0nKTtcbiAgICB2YXIgZWFjaCA9IHJlcXVpcmUoJ3Byby1zaW5ndWxpcycpO1xuICAgIHZhciB1dGlscyA9IHJlcXVpcmUoJy4vVXRpbHMnKTtcblxuICAgIC8qKlxuICAgICAqIEEgY29tcG9uZW50IHN5c3RlbSB0byByZW5kZXIgc3RhdGljIGFuZCBkeW5hbWljIENTU1xuICAgICAqXG4gICAgICogQGNsYXNzXG4gICAgICogQG5hbWUgYWxjaGVteS5lY3MuQ3NzUmVuZGVyU3lzdGVtXG4gICAgICogQGV4dGVuZHMgYWxjaGVteS5jb3JlLk1hdGVyaWFQcmltYVxuICAgICAqL1xuICAgIHJldHVybiBjb3F1b1ZlbmVudW0oe1xuICAgICAgICAvKiogQGxlbmRzIGFsY2hlbXkuZWNzLkNzc1JlbmRlclN5c3RlbS5wcm90b3R5cGUgKi9cblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGVudGl0eSBzdG9yYWdlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwcm9wZXJ0eSBlbnRpdGllc1xuICAgICAgICAgKiBAdHlwZSBhbGNoZW15LmVjcy5BcG90aGVjYXJpdXNcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIGVudGl0aWVzOiB1bmRlZmluZWQsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBjc3Mgc3R5bGUgaGVscGVyIHdoaWNoIGRvZXMgdGhlIGhlYXZ5IGxpZnRpbmdcbiAgICAgICAgICpcbiAgICAgICAgICogQHByb3BlcnR5IHN0eWx1c1xuICAgICAgICAgKiBAdHlwZSBhbGNoZW15LndlYi5TdHlsdXNcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHN0eWx1czogdW5kZWZpbmVkLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgdGhlIHByZXZpb3VzIHN0YXRlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwcm9wZXJ0eSBsYXN0U3RhdGVzXG4gICAgICAgICAqIEB0eXBlIE9iamVjdFxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgbGFzdFN0YXRlczogdW5kZWZpbmVkLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBVcGRhdGVzIHRoZSBjb21wb25lbnQgc3lzdGVtIHdpdGggdGhlIGN1cnJlbnQgYXBwbGljYXRpb24gc3RhdGVcbiAgICAgICAgICovXG4gICAgICAgIHVwZGF0ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGR5bmFtaWNDc3MgPSB0aGlzLmVudGl0aWVzLmdldEFsbENvbXBvbmVudHNPZlR5cGUoJ2NzcycpO1xuICAgICAgICAgICAgZWFjaChkeW5hbWljQ3NzLCB0aGlzLnVwZGF0ZUR5bmFtaWNDc3MsIHRoaXMpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB1cGRhdGVEeW5hbWljQ3NzOiBmdW5jdGlvbiAoY2ZnLCBlbnRpdHlJZCkge1xuICAgICAgICAgICAgdGhpcy5wcm9jZXNzVHlwZVJ1bGVzKGNmZywgZW50aXR5SWQpO1xuICAgICAgICAgICAgdGhpcy5wcm9jZXNzRW50aXR5UnVsZXMoY2ZnLCBlbnRpdHlJZCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHByb2Nlc3NUeXBlUnVsZXM6IGZ1bmN0aW9uIChjZmcsIGVudGl0eUlkKSB7XG4gICAgICAgICAgICBpZiAoIWNmZy50eXBlUnVsZXMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuc2V0UnVsZXMoY2ZnLnR5cGVSdWxlcyk7XG4gICAgICAgICAgICB0aGlzLmVudGl0aWVzLnNldENvbXBvbmVudChlbnRpdHlJZCwgJ2NzcycsIHtcbiAgICAgICAgICAgICAgICB0eXBlUnVsZXM6IG51bGwsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgcHJvY2Vzc0VudGl0eVJ1bGVzOiBmdW5jdGlvbiAoY2ZnLCBlbnRpdHlJZCkge1xuICAgICAgICAgICAgaWYgKCF1dGlscy5pc09iamVjdChjZmcuZW50aXR5UnVsZXMpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5lbnRpdGllcy5yZW1vdmVDb21wb25lbnQoZW50aXR5SWQsICdjc3MnKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBydWxlcyA9IHt9O1xuXG4gICAgICAgICAgICBpZiAodXRpbHMuaXNGdW5jdGlvbihjZmcuZW50aXR5UnVsZXMpKSB7XG4gICAgICAgICAgICAgICAgdmFyIGxhc3RTdGF0ZSA9IHRoaXMubGFzdFN0YXRlc1tlbnRpdHlJZF07XG4gICAgICAgICAgICAgICAgdmFyIGN1cnJlbnRTdGF0ZSA9IHRoaXMuZW50aXRpZXMuZ2V0Q29tcG9uZW50KGVudGl0eUlkLCAnc3RhdGUnKTtcblxuICAgICAgICAgICAgICAgIGlmIChjdXJyZW50U3RhdGUgPT09IGxhc3RTdGF0ZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcnVsZXNbJyMnICsgZW50aXR5SWRdID0gY2ZnLmVudGl0eVJ1bGVzLmNhbGwobnVsbCwgY3VycmVudFN0YXRlKTtcblxuICAgICAgICAgICAgICAgIHRoaXMubGFzdFN0YXRlc1tlbnRpdHlJZF0gPSBjdXJyZW50U3RhdGU7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRSdWxlcyhydWxlcyk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJ1bGVzWycjJyArIGVudGl0eUlkXSA9IGNmZy5lbnRpdHlSdWxlcztcblxuICAgICAgICAgICAgdGhpcy5zZXRSdWxlcyhydWxlcyk7XG4gICAgICAgICAgICB0aGlzLmVudGl0aWVzLnJlbW92ZUNvbXBvbmVudChlbnRpdHlJZCwgJ2NzcycpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICBzZXRSdWxlczogZnVuY3Rpb24gKHJ1bGVzKSB7XG4gICAgICAgICAgICB0aGlzLnN0eWx1cy5zZXRSdWxlcyhydWxlcyk7XG4gICAgICAgIH0sXG5cbiAgICB9KS53aGVuQnJld2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5sYXN0U3RhdGVzID0ge307XG4gICAgfSk7XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBjb3F1b1ZlbmVudW0gPSByZXF1aXJlKCdjb3F1by12ZW5lbnVtJyk7XG4gICAgdmFyIGVhY2ggPSByZXF1aXJlKCdwcm8tc2luZ3VsaXMnKTtcblxuICAgIHZhciBEZWxlZ2F0ZSA9IGZ1bmN0aW9uIChrZXksIGV2ZW50LCBoYW5kbGVyLCBzY29wZSkge1xuICAgICAgICB0aGlzLmtleSA9IGtleTtcbiAgICAgICAgdGhpcy5ldmVudCA9IGV2ZW50O1xuICAgICAgICB0aGlzLmhhbmRsZXIgPSBoYW5kbGVyO1xuICAgICAgICB0aGlzLnNjb3BlID0gc2NvcGU7XG4gICAgfTtcblxuICAgIERlbGVnYXRlLnByb3RvdHlwZS5iaW5kID0gZnVuY3Rpb24gYmluZChlbGVtZW50KSB7XG4gICAgICAgIGVsZW1lbnRbZ2V0S2V5KHRoaXMuZXZlbnQpXSA9IHRoaXMua2V5O1xuICAgIH07XG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgZnVuY3Rpb24gZ2V0S2V5KGV2ZW50bmFtZSkge1xuICAgICAgICByZXR1cm4gJ19fZV9fJyArIGV2ZW50bmFtZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAY2xhc3NcbiAgICAgKiBAbmFtZSBhbGNoZW15LndlYi5EZWxlZ2F0dXNcbiAgICAgKi9cbiAgICByZXR1cm4gY29xdW9WZW5lbnVtKHtcbiAgICAgICAgLyoqIEBsZW5kcyBhbGNoZW15LndlYi5EZWxlZ2F0dXMucHJvdG90eXBlICovXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSByb290IERPTSBub2RlIHRoYXQgY29sbGVjdHMgdGhlIGJyb3dzZXIgZXZlbnRzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwcm9wZXJ0eSByb290XG4gICAgICAgICAqIEB0eXBlIERvbU5vZGVcbiAgICAgICAgICogQHJlYWRvbmx5XG4gICAgICAgICAqL1xuICAgICAgICByb290OiB1bmRlZmluZWQsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBzZXQgb2YgcmVnaXN0ZXJlZCBldmVudCBoYW5kbGVyc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcHJvcGVydHkgZXZlbnRzXG4gICAgICAgICAqIEB0eXBlIE9iamVjdFxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgZXZlbnRzOiB1bmRlZmluZWQsXG5cbiAgICAgICAgY3JlYXRlRGVsZWdhdGU6IGZ1bmN0aW9uIChldmVudCwgZm4sIHNjb3BlKSB7XG4gICAgICAgICAgICB2YXIgZGVsZWdhdGVzID0gdGhpcy5ldmVudHNbZXZlbnRdO1xuXG4gICAgICAgICAgICBpZiAoIWRlbGVnYXRlcykge1xuICAgICAgICAgICAgICAgIC8vIGZpcnN0IGhhbmRsZXIgZm9yIHRoaXMgZXZlbnRcbiAgICAgICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgICAgICAgICBkZWxlZ2F0ZXMgPSBbXTtcblxuICAgICAgICAgICAgICAgIHRoaXMuZXZlbnRzW2V2ZW50XSA9IGRlbGVnYXRlcztcbiAgICAgICAgICAgICAgICB0aGlzLnJvb3RbJ29uJyArIGV2ZW50XSA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuaGFuZGxlRXZlbnQoZXZlbnQsIGUpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gZGVsZWdhdGVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBkID0gZGVsZWdhdGVzW2ldO1xuICAgICAgICAgICAgICAgIGlmIChkLmhhbmRsZXIgPT09IGZuICYmIGQuc2NvcGUgPT09IHNjb3BlKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGV2ZW50IGhhbmRsZXIgd2FzIGFscmVhZHkgZGVmaW5lZFxuICAgICAgICAgICAgICAgICAgICAvLyAtPiB1c2UgaXRcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgbmV3RGVsID0gbmV3IERlbGVnYXRlKGRlbGVnYXRlcy5sZW5ndGgsIGV2ZW50LCBmbiwgc2NvcGUpO1xuXG4gICAgICAgICAgICBkZWxlZ2F0ZXMucHVzaChuZXdEZWwpO1xuXG4gICAgICAgICAgICByZXR1cm4gbmV3RGVsO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8vXG4gICAgICAgIC8vXG4gICAgICAgIC8vIHByaXZhdGUgaGVscGVyXG4gICAgICAgIC8vXG4gICAgICAgIC8vXG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIGhhbmRsZUV2ZW50OiBmdW5jdGlvbiAoZXZlbnROYW1lLCBldikge1xuICAgICAgICAgICAgdmFyIHRhcmdldCA9IGV2ICYmIGV2LnRhcmdldDtcblxuICAgICAgICAgICAgd2hpbGUgKHRhcmdldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudCh0YXJnZXRbZ2V0S2V5KGV2ZW50TmFtZSldLCBldmVudE5hbWUsIGV2KTtcbiAgICAgICAgICAgICAgICB0YXJnZXQgPSB0YXJnZXQucGFyZW50Tm9kZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgZGlzcGF0Y2hFdmVudDogZnVuY3Rpb24gKGV2ZW50S2V5LCBldmVudE5hbWUsIGV2ZW50KSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGV2ZW50S2V5ID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGhhbmRsZXIgPSB0aGlzLmV2ZW50c1tldmVudE5hbWVdO1xuICAgICAgICAgICAgdmFyIGNmZyA9IGhhbmRsZXIgJiYgaGFuZGxlcltldmVudEtleV07XG5cbiAgICAgICAgICAgIGNmZy5oYW5kbGVyLmNhbGwoY2ZnLnNjb3BlLCBldmVudCk7XG4gICAgICAgIH0sXG5cbiAgICB9KS53aGVuQnJld2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5yb290ID0gdGhpcy5yb290IHx8IGRvY3VtZW50LmJvZHk7XG4gICAgICAgIHRoaXMuZXZlbnRzID0ge307XG5cbiAgICB9KS53aGVuRGlzcG9zZWQoZnVuY3Rpb24gKCkge1xuICAgICAgICBlYWNoKHRoaXMuZXZlbnRzLCBmdW5jdGlvbiAoaGFuZGxlciwgZXZlbnQpIHtcbiAgICAgICAgICAgIHdoaWxlIChoYW5kbGVyLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBoYW5kbGVyLnBvcCgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnJvb3RbJ29uJyArIGV2ZW50XSA9IG51bGw7XG4gICAgICAgIH0sIHRoaXMpO1xuICAgIH0pO1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgY29xdW9WZW5lbnVtID0gcmVxdWlyZSgnY29xdW8tdmVuZW51bScpO1xuICAgIHZhciBlYWNoID0gcmVxdWlyZSgncHJvLXNpbmd1bGlzJyk7XG4gICAgdmFyIHV0aWxzID0gcmVxdWlyZSgnLi9VdGlscycpO1xuXG4gICAgLyoqXG4gICAgICogQSBjb21wb25lbnQgc3lzdGVtIHRvIGNyZWF0ZSBkZWxlZ2F0ZWQgZXZlbnQgaGFuZGxlciBmb3IgZG9tIGV2ZW50c1xuICAgICAqXG4gICAgICogQGNsYXNzXG4gICAgICogQG5hbWUgYWxjaGVteS5lY3MuRXZlbnRTeXN0ZW1cbiAgICAgKiBAZXh0ZW5kcyBhbGNoZW15LmNvcmUuTWF0ZXJpYVByaW1hXG4gICAgICovXG4gICAgcmV0dXJuIGNvcXVvVmVuZW51bSh7XG4gICAgICAgIC8qKiBAbGVuZHMgYWxjaGVteS5lY3MuRXZlbnRTeXN0ZW0ucHJvdG90eXBlICovXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBtZXNzYWdlIGJ1cyBmb3IgdGhlIGFwcGljYXRpb24gbWVzc2FnZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHByb3BlcnR5IG1lc3NhZ2VzXG4gICAgICAgICAqIEB0eXBlIGFsY2hlbXkuY29yZS5PYnNlcnZhcmlcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIG1lc3NhZ2VzOiB1bmRlZmluZWQsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBicm93c2VyIGV2ZW50IGRlbGVnYXRvclxuICAgICAgICAgKlxuICAgICAgICAgKiBAcHJvcGVydHkgZGVsZWdhdG9yXG4gICAgICAgICAqIEB0eXBlIGFsY2hlbXkud2ViLkRlbGVnYXR1c1xuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgZGVsZWdhdG9yOiB1bmRlZmluZWQsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBlbnRpdHkgc3RvcmFnZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcHJvcGVydHkgZW50aXRpZXNcbiAgICAgICAgICogQHR5cGUgYWxjaGVteS5lY3MuQXBvdGhlY2FyaXVzXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBlbnRpdGllczogdW5kZWZpbmVkLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBZGRzIGEgbmV3IGV2ZW50IGhhbmRsZXJcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IGtleSBUaGUgaWRlbnRpZmllciBmb3IgdGhlIGV2ZW50IGhhbmRsZXJcbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gaGFuZGxlciBUaGUgZXZlbnQgaGFuZGxlciBmdW5jdGlvbiB0byBiZSBhZGRlZFxuICAgICAgICAgKi9cbiAgICAgICAgYWRkSGFuZGxlcjogZnVuY3Rpb24gKGtleSwgaGFuZGxlcikge1xuICAgICAgICAgICAgdGhpcy5oYW5kbGVyID0gdGhpcy5oYW5kbGVyIHx8IHt9O1xuICAgICAgICAgICAgdGhpcy5oYW5kbGVyW2tleV0gPSBoYW5kbGVyO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBVcGRhdGVzIHRoZSBjb21wb25lbnQgc3lzdGVtIHdpdGggdGhlIGN1cnJlbnQgYXBwbGljYXRpb24gc3RhdGVcbiAgICAgICAgICovXG4gICAgICAgIHVwZGF0ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGV2ZW50cyA9IHRoaXMuZW50aXRpZXMuZ2V0QWxsQ29tcG9uZW50c09mVHlwZSgnZXZlbnRzJyk7XG4gICAgICAgICAgICBlYWNoKGV2ZW50cywgdGhpcy5kZWxlZ2F0ZUV2ZW50cywgdGhpcyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIGRlbGVnYXRlRXZlbnRzOiBmdW5jdGlvbiAoY2ZnLCBlbnRpdHlJZCkge1xuICAgICAgICAgICAgZWFjaChjZmcsIHRoaXMuZGVsZWdhdGVFdmVudCwgdGhpcywgW2VudGl0eUlkXSk7XG4gICAgICAgICAgICB0aGlzLmVudGl0aWVzLnJlbW92ZUNvbXBvbmVudChlbnRpdHlJZCwgJ2V2ZW50cycpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICBkZWxlZ2F0ZUV2ZW50OiBmdW5jdGlvbiAoY2ZnLCByYXdFdmVudE5hbWUsIGVudGl0eUlkKSB7XG4gICAgICAgICAgICBpZiAodXRpbHMuaXNTdHJpbmcoY2ZnKSB8fCB1dGlscy5pc0Z1bmN0aW9uKGNmZykpIHtcbiAgICAgICAgICAgICAgICBjZmcgPSB7XG4gICAgICAgICAgICAgICAgICAgIGhhbmRsZXI6IGNmZ1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBoYW5kbGVyID0gdGhpcy5nZXRFdmVudEhhbmRsZXIoZW50aXR5SWQsIGNmZyk7XG4gICAgICAgICAgICB2YXIgc3BsaXQgPSByYXdFdmVudE5hbWUuc3BsaXQoL1xccy8pO1xuICAgICAgICAgICAgdmFyIGV2ZW50TmFtZSA9IHNwbGl0LnNoaWZ0KCk7XG4gICAgICAgICAgICB2YXIgc2VsZWN0b3IgPSBjZmcuc2VsZWN0b3IgfHwgc3BsaXQuam9pbignICcpO1xuICAgICAgICAgICAgdmFyIGRlbGVnYXRlID0gdGhpcy5kZWxlZ2F0b3IuY3JlYXRlRGVsZWdhdGUoZXZlbnROYW1lLCBoYW5kbGVyKTtcbiAgICAgICAgICAgIHZhciBkZWxlZ2F0ZWRFdmVudHMgPSB0aGlzLmVudGl0aWVzLmdldENvbXBvbmVudERhdGEoZW50aXR5SWQsICdkZWxlZ2F0ZWRFdmVudHMnKSB8fCBbXTtcblxuICAgICAgICAgICAgdGhpcy5lbnRpdGllcy5zZXRDb21wb25lbnQoZW50aXR5SWQsICdkZWxlZ2F0ZWRFdmVudHMnLCBkZWxlZ2F0ZWRFdmVudHMuY29uY2F0KHtcbiAgICAgICAgICAgICAgICBldmVudDogZXZlbnROYW1lLFxuICAgICAgICAgICAgICAgIGRlbGVnYXRlOiBkZWxlZ2F0ZSxcbiAgICAgICAgICAgICAgICBzZWxlY3Rvcjogc2VsZWN0b3IsXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIGdldEV2ZW50SGFuZGxlcjogZnVuY3Rpb24gKGVudGl0eUlkLCBjZmcpIHtcbiAgICAgICAgICAgIHZhciBoYW5kbGVyID0gY2ZnLmhhbmRsZXI7XG4gICAgICAgICAgICB2YXIgcmVwbyA9IHRoaXMuZW50aXRpZXM7XG4gICAgICAgICAgICB2YXIgbWVzc2FnZXMgPSB0aGlzLm1lc3NhZ2VzO1xuICAgICAgICAgICAgdmFyIHNlbmRNZXNzYWdlID0gZnVuY3Rpb24gKG1zZywgZGF0YSkge1xuICAgICAgICAgICAgICAgIG1lc3NhZ2VzLnRyaWdnZXIobXNnLCBkYXRhKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGlmICh1dGlscy5pc1N0cmluZyhoYW5kbGVyKSkge1xuICAgICAgICAgICAgICAgIGhhbmRsZXIgPSB0aGlzLmhhbmRsZXIgJiYgdGhpcy5oYW5kbGVyW2NmZy5oYW5kbGVyXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgICAgICAgICAgIHZhciBzdGF0ZSwgbmV3U3RhdGU7XG5cbiAgICAgICAgICAgICAgICBpZiAodXRpbHMuaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgICAgICAgICAgICAgICAgICBzdGF0ZSA9IHJlcG8uZ2V0Q29tcG9uZW50KGVudGl0eUlkLCAnc3RhdGUnKTtcbiAgICAgICAgICAgICAgICAgICAgbmV3U3RhdGUgPSBoYW5kbGVyKGV2ZW50LCBzdGF0ZSwgc2VuZE1lc3NhZ2UpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgbmV3U3RhdGUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXBvLnNldENvbXBvbmVudChlbnRpdHlJZCwgJ3N0YXRlJywgbmV3U3RhdGUpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGNmZy5tZXNzYWdlKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXRlID0gcmVwby5nZXRDb21wb25lbnREYXRhKGVudGl0eUlkLCAnc3RhdGUnKTtcbiAgICAgICAgICAgICAgICAgICAgc2VuZE1lc3NhZ2UoY2ZnLm1lc3NhZ2UsIHN0YXRlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9LFxuICAgIH0pO1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgY29xdW9WZW5lbnVtID0gcmVxdWlyZSgnY29xdW8tdmVuZW51bScpO1xuICAgIHZhciBlYWNoID0gcmVxdWlyZSgncHJvLXNpbmd1bGlzJyk7XG4gICAgdmFyIHV0aWxzID0gcmVxdWlyZSgnLi9VdGlscycpO1xuXG4gICAgdmFyIE9ic2VydmFyaSA9IHtcbiAgICAgICAgLyoqIEBsZW5kcyBhbGNoZW15LmNvcmUuT2JzZXJ2YXJpLnByb3RvdHlwZSAqL1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgaW5pdGlhbCBzZXQgb2YgZXZlbnRzO1xuICAgICAgICAgKiBUaGUgY29uZmlndXJhdGlvbiBvYmplY3QgaGFzIHRoZSBmb2xsb3dpbmcgZm9ybTpcbiAgICAgICAgICogPHByZT48Y29kZT5cbiAgICAgICAgICoge1xuICAgICAgICAgKiAgICAgIGV2ZW50MToge1xuICAgICAgICAgKiAgICAgICAgICBmbjoge0Z1bmN0aW9ufSAvLyB0aGUgaGFuZGxlciBmdW5jdGlvblxuICAgICAgICAgKiAgICAgICAgICBzY29wZToge09iamVjdH0gLy8gdGhlIGV4ZWN1dGlvbiBzY29wZSBvZiB0aGUgaGFuZGxlclxuICAgICAgICAgKiAgICAgIH0sXG4gICAgICAgICAqICAgICAgZXZlbnQyOiB7XG4gICAgICAgICAqICAgICAgICAgIC4uLlxuICAgICAgICAgKiAgICAgIH0sXG4gICAgICAgICAqICAgICAgLi4uXG4gICAgICAgICAqIH1cbiAgICAgICAgICogPC9jb2RlPjwvcHJlPlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcHJvcGVydHkgZXZlbnRzXG4gICAgICAgICAqIEB0eXBlIE9iamVjdFxuICAgICAgICAgKi9cbiAgICAgICAgZXZlbnRzOiB1bmRlZmluZWQsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRyaWdnZXJzIGFuIGV2ZW50XG4gICAgICAgICAqIEBmdW5jdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnROYW1lIFRoZSBldmVudCBuYW1lL3R5cGVcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IGRhdGEgVGhlIGV2ZW50IGRhdGEgKGNhbiBiZSBhbnl0aGluZylcbiAgICAgICAgICovXG4gICAgICAgIHRyaWdnZXI6IChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgcHJvY2Vzc0xpc3RlbmVyID0gZnVuY3Rpb24gKGxpc3RlbmVyLCBpbmRleCwgZGF0YSwgZXZlbnRPYmopIHtcbiAgICAgICAgICAgICAgICBsaXN0ZW5lci5mbi5jYWxsKGxpc3RlbmVyLnNjb3BlLCBkYXRhLCBldmVudE9iaik7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGV2ZW50TmFtZSwgZGF0YSkge1xuICAgICAgICAgICAgICAgIHZhciBsaXN0ZW5lcnMgPSB0aGlzLmV2ZW50cyAmJiB1dGlscy5taXgoW10sIHRoaXMuZXZlbnRzW2V2ZW50TmFtZV0pO1xuICAgICAgICAgICAgICAgIHZhciBldmVudE9iaiA9IGdldEV2ZW50T2JqZWN0KHRoaXMsIGV2ZW50TmFtZSk7XG4gICAgICAgICAgICAgICAgdmFyIGFyZ3MgPSBbZGF0YSwgZXZlbnRPYmpdO1xuXG4gICAgICAgICAgICAgICAgLy8gbm90aWZ5IGxpc3RlbmVyIHdoaWNoIGFyZSByZWdpc3RlcmVkIGZvciB0aGUgZ2l2ZW4gZXZlbnQgdHlwZVxuICAgICAgICAgICAgICAgIGVhY2gobGlzdGVuZXJzLCBwcm9jZXNzTGlzdGVuZXIsIHRoaXMsIGFyZ3MpO1xuXG4gICAgICAgICAgICAgICAgLy8gbm90aWZ5IGxpc3RlbmVyIHdoaWNoIGFyZSByZWdpc3RlcmVkIGZvciBhbGwgZXZlbnRzXG4gICAgICAgICAgICAgICAgbGlzdGVuZXJzID0gdGhpcy5ldmVudHMgJiYgdGhpcy5ldmVudHNbJyonXTtcbiAgICAgICAgICAgICAgICBlYWNoKGxpc3RlbmVycywgcHJvY2Vzc0xpc3RlbmVyLCB0aGlzLCBhcmdzKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0oKSksXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogYWRkcyBhIGxpc3RlbmVyIGZvciB0byBhbiBldmVudFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcbiAgICAgICAgICogICAgICB0aGUgZXZlbnQgbmFtZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBoYW5kbGVyXG4gICAgICAgICAqICAgICAgdGhlIGV2ZW50IGhhbmRsZXIgbWV0aG9kXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBzY29wZVxuICAgICAgICAgKiAgICAgIHRoZSBleGVjdXRpb24gc2NvcGUgZm9yIHRoZSBldmVudCBoYW5kbGVyXG4gICAgICAgICAqL1xuICAgICAgICBvbjogZnVuY3Rpb24gKGV2ZW50LCBoYW5kbGVyLCBzY29wZSkge1xuICAgICAgICAgICAgdGhpcy5ldmVudHMgPSB0aGlzLmV2ZW50cyB8fCB7fTtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRzW2V2ZW50XSA9IHRoaXMuZXZlbnRzW2V2ZW50XSB8fCBbXTtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRzW2V2ZW50XS5wdXNoKHtcbiAgICAgICAgICAgICAgICBmbjogaGFuZGxlcixcbiAgICAgICAgICAgICAgICBzY29wZTogc2NvcGVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBZGRzIGEgb25lLXRpbWUgbGlzdGVuZXIgZm9yIHRvIGFuIGV2ZW50OyBUaGlzIGxpc3RlbmVyIHdpbGxcbiAgICAgICAgICogYmUgcmVtb3ZlZCBhZnRlciB0aGUgdGhlIGZpcnN0IGV4ZWN1dGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnROYW1lXG4gICAgICAgICAqICAgICAgdGhlIGV2ZW50IG5hbWVcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gaGFuZGxlclxuICAgICAgICAgKiAgICAgIHRoZSBldmVudCBoYW5kbGVyIG1ldGhvZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gc2NvcGVcbiAgICAgICAgICogICAgICB0aGUgZXhlY3V0aW9uIHNjb3BlIGZvciB0aGUgZXZlbnQgaGFuZGxlclxuICAgICAgICAgKi9cbiAgICAgICAgb25jZTogZnVuY3Rpb24gKGV2ZW50TmFtZSwgaGFuZGxlciwgc2NvcGUpIHtcbiAgICAgICAgICAgIHZhciB3cmFwcGVyID0gZnVuY3Rpb24gKGRhdGEsIGV2ZW50KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5vZmYoZXZlbnROYW1lLCB3cmFwcGVyLCB0aGlzKTtcbiAgICAgICAgICAgICAgICBoYW5kbGVyLmNhbGwoc2NvcGUsIGRhdGEsIGV2ZW50KTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0aGlzLm9uKGV2ZW50TmFtZSwgd3JhcHBlciwgdGhpcyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHJlbW92ZXMgYSBsaXN0ZW5lciBmb3IgZnJvbSBhbiBldmVudFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcbiAgICAgICAgICogICAgICB0aGUgZXZlbnQgbmFtZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBoYW5kbGVyXG4gICAgICAgICAqICAgICAgdGhlIGV2ZW50IGhhbmRsZXIgbWV0aG9kXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBzY29wZVxuICAgICAgICAgKiAgICAgIHRoZSBleGVjdXRpb24gc2NvcGUgZm9yIHRoZSBldmVudCBoYW5kbGVyXG4gICAgICAgICAqL1xuICAgICAgICBvZmY6IGZ1bmN0aW9uIChldmVudCwgaGFuZGxlciwgc2NvcGUpIHtcbiAgICAgICAgICAgIGlmIChldmVudCkge1xuICAgICAgICAgICAgICAgIGNsZWFubGlzdGVuZXJMaXN0KHRoaXMsIGV2ZW50LCBoYW5kbGVyLCBzY29wZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGVhY2godGhpcy5ldmVudHMsIGZ1bmN0aW9uIChldmVudExpc3RuZXIsIGV2ZW50TmFtZSkge1xuICAgICAgICAgICAgICAgICAgICBjbGVhbmxpc3RlbmVyTGlzdCh0aGlzLCBldmVudE5hbWUsIGhhbmRsZXIsIHNjb3BlKTtcbiAgICAgICAgICAgICAgICB9LCB0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICB9O1xuXG4gICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gICAgLy8gcHJpdmF0ZSBoZWxwZXJcbiAgICAvL1xuICAgIC8vXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGFuIG9iamVjdCB3aXRoIG1ldGEgZGF0YSBmb3IgdGhlIGdpdmVuIGV2ZW50IHR5cGVcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGdldEV2ZW50T2JqZWN0KG9ic2VydmFibGUsIGV2ZW50TmFtZSkge1xuICAgICAgICBvYnNlcnZhYmxlLmV2ZW50T2JqID0gb2JzZXJ2YWJsZS5ldmVudE9iaiB8fCB7fTtcbiAgICAgICAgaWYgKCFvYnNlcnZhYmxlLmV2ZW50T2JqW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgICAgIG9ic2VydmFibGUuZXZlbnRPYmpbZXZlbnROYW1lXSA9IHtcbiAgICAgICAgICAgICAgICBuYW1lOiBldmVudE5hbWUsXG4gICAgICAgICAgICAgICAgICBzb3VyY2U6IG9ic2VydmFibGVcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG9ic2VydmFibGUuZXZlbnRPYmpbZXZlbnROYW1lXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQdXJnZXMgdGhlIGxpc3Qgb2YgZXZlbnQgaGFuZGxlcnMgZnJvbSB0aGUgZ2l2ZW4gbGlzdGVuZXJzXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBjbGVhbmxpc3RlbmVyTGlzdChvYnNlcnZhYmxlLCBldmVudCwgZm4sIHNjb3BlKSB7XG4gICAgICAgIHZhciBvbGRMaXN0ID0gKG9ic2VydmFibGUuZXZlbnRzICYmIG9ic2VydmFibGUuZXZlbnRzW2V2ZW50XSkgfHwgW107XG4gICAgICAgIHZhciBuZXdMaXN0ID0gW107XG4gICAgICAgIHZhciBtYXRjaDsgLy8gdHJ1ZSBpZiB0aGUgbGlzdGVuZXIgKGZuLCBzY29wZSkgaXMgcmVnaXN0ZXJlZCBmb3IgdGhlIGV2ZW50XG4gICAgICAgIHZhciBsaXN0ZW5lciA9IG9sZExpc3QucG9wKCk7XG5cbiAgICAgICAgd2hpbGUgKGxpc3RlbmVyKSB7XG4gICAgICAgICAgICBtYXRjaCA9ICghZm4gfHwgZm4gPT09IGxpc3RlbmVyLmZuKSAmJiAoIXNjb3BlIHx8IHNjb3BlID09PSBsaXN0ZW5lci5zY29wZSk7XG5cbiAgICAgICAgICAgIGlmICghbWF0Y2gpIHtcbiAgICAgICAgICAgICAgICBuZXdMaXN0LnB1c2gobGlzdGVuZXIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsaXN0ZW5lci5mbiA9IG51bGw7XG4gICAgICAgICAgICAgICAgbGlzdGVuZXIuc2NvcGUgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGlzdGVuZXIgPSBvbGRMaXN0LnBvcCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5ld0xpc3QubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgb2JzZXJ2YWJsZS5ldmVudHNbZXZlbnRdID0gbmV3TGlzdDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRlbGV0ZSBvYnNlcnZhYmxlLmV2ZW50c1tldmVudF07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gY29xdW9WZW5lbnVtKE9ic2VydmFyaSkud2hlbkRpc3Bvc2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy8gcmVtb3ZlIGFsbCBsaXN0ZW5lcnNcbiAgICAgICAgdGhpcy5vZmYoKTtcblxuICAgICAgICAvLyBjdXQgY2lyY2xlIHJlZmVyZW5jZXMgZm9ybSB0aGUgZXZlbnRPYmpcbiAgICAgICAgZWFjaCh0aGlzLmV2ZW50T2JqLCBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgICAgICAgaXRlbS5uYW1lID0gbnVsbDtcbiAgICAgICAgICAgIGl0ZW0uc291cmNlID0gbnVsbDtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuZXZlbnRPYmogPSBudWxsO1xuICAgIH0pO1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgaW1tdXRhYmxlID0gcmVxdWlyZSgnaW1tdXRhYmlsaXMnKTtcbiAgICB2YXIgY29xdW9WZW5lbnVtID0gcmVxdWlyZSgnY29xdW8tdmVuZW51bScpO1xuICAgIHZhciBlYWNoID0gcmVxdWlyZSgncHJvLXNpbmd1bGlzJyk7XG4gICAgdmFyIHV0aWxzID0gcmVxdWlyZSgnLi9VdGlscycpO1xuXG4gICAgLyoqXG4gICAgICogVE9ETzogZG9jdW1lbnQgbWVcbiAgICAgKlxuICAgICAqIEBjbGFzc1xuICAgICAqIEBuYW1lIGFsY2hlbXkuZWNzLlN0YXRlU3lzdGVtXG4gICAgICogQGV4dGVuZHMgYWxjaGVteS5jb3JlLk1hdGVyaWFQcmltYVxuICAgICAqL1xuICAgIHJldHVybiBjb3F1b1ZlbmVudW0oe1xuICAgICAgICAvKiogQGxlbmRzIGFsY2hlbXkuZWNzLlN0YXRlU3lzdGVtLnByb3RvdHlwZSAqL1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgZW50aXR5IHN0b3JhZ2VcbiAgICAgICAgICpcbiAgICAgICAgICogQHByb3BlcnR5IGVudGl0aWVzXG4gICAgICAgICAqIEB0eXBlIGFsY2hlbXkuZWNzLkFwb3RoZWNhcml1c1xuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgZW50aXRpZXM6IHVuZGVmaW5lZCxcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHByZXZpb3VzIGFwcGxpY2F0aW9uIHN0YXRlICh0aGVyZSBpcyBubyBuZWVkIHRvIHVwZGF0ZSBhbGxcbiAgICAgICAgICogZW50aXRpZXMgaWYgdGhlIGdsb2JhbCBhcHBsaWNhdGlvbiBzdGF0ZSByZW1haW5lZCB1bmNoYW5nZWQpXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwcm9wZXJ0eSBsYXN0U3RhdGVcbiAgICAgICAgICogQHR5cGUgT2JqZWN0XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBsYXN0U3RhdGVzOiB1bmRlZmluZWQsXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogVXBkYXRlcyB0aGUgY29tcG9uZW50IHN5c3RlbSB3aXRoIHRoZSBjdXJyZW50IGFwcGxpY2F0aW9uIHN0YXRlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSBJbW11dGFibGUgY3VycmVudEFwcFN0YXRlIFRoZSBjdXJyZW50IGFwcGxpY2F0aW9uIHN0YXRlXG4gICAgICAgICAqL1xuICAgICAgICB1cGRhdGU6IGZ1bmN0aW9uIChjdXJyZW50QXBwU3RhdGUpIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50QXBwU3RhdGUgPT09IHRoaXMubGFzdFN0YXRlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgc3RhdGVDb21wb25lbnRzID0gdGhpcy5lbnRpdGllcy5nZXRBbGxDb21wb25lbnRzT2ZUeXBlKCdnbG9iYWxUb0xvY2FsJyk7XG5cbiAgICAgICAgICAgIGVhY2goc3RhdGVDb21wb25lbnRzLCB0aGlzLnVwZGF0ZUVudGl0eSwgdGhpcywgW2N1cnJlbnRBcHBTdGF0ZV0pO1xuXG4gICAgICAgICAgICB0aGlzLmxhc3RTdGF0ZSA9IGN1cnJlbnRBcHBTdGF0ZTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgdXBkYXRlRW50aXR5OiBmdW5jdGlvbiAoZ2xvYmFsVG9Mb2NhbCwgZW50aXR5SWQsIGFwcFN0YXRlKSB7XG4gICAgICAgICAgICB2YXIgbmV3U3RhdGUgPSB0aGlzLmVudGl0aWVzLmdldENvbXBvbmVudERhdGEoZW50aXR5SWQsICdzdGF0ZScpIHx8IHt9O1xuXG4gICAgICAgICAgICBpZiAodXRpbHMuaXNGdW5jdGlvbihnbG9iYWxUb0xvY2FsKSkge1xuICAgICAgICAgICAgICAgIG5ld1N0YXRlID0gZ2xvYmFsVG9Mb2NhbChhcHBTdGF0ZSwgbmV3U3RhdGUpO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGVhY2goZ2xvYmFsVG9Mb2NhbCwgZnVuY3Rpb24gKGxvY2FsS2V5LCBnbG9iYWxQYXRoKSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld1N0YXRlW2xvY2FsS2V5XSA9IGltbXV0YWJsZS5maW5kKGFwcFN0YXRlLCBnbG9iYWxQYXRoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5lbnRpdGllcy5zZXRDb21wb25lbnQoZW50aXR5SWQsICdzdGF0ZScsIG5ld1N0YXRlKTtcbiAgICAgICAgfVxuICAgIH0pO1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgY29xdW9WZW5lbnVtID0gcmVxdWlyZSgnY29xdW8tdmVuZW51bScpO1xuICAgIHZhciBlYWNoID0gcmVxdWlyZSgncHJvLXNpbmd1bGlzJyk7XG5cbiAgICByZXR1cm4gY29xdW9WZW5lbnVtKHtcbiAgICAgICAgLyoqIEBsZW5kcyBhbGNoZW15LndlYi5TdHlsdXMucHJvdG90eXBlICovXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFuIGludGVybmFsIHN0b3JlIGZvciBydWxlIG1ldGEgaW5mb3JtYXRpb25zXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwcm9wZXJ0eSBydWxlc1xuICAgICAgICAgKiBAdHlwZSBPYmplY3RcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHJ1bGVzOiB1bmRlZmluZWQsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBDc3NTdHlsZVNoZWV0IHRoYXQgc3RvcmVzIGFsbCBjc3MgcnVsZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHByb3BlcnR5IHNoZWV0XG4gICAgICAgICAqIEB0eXBlIENzc1N0eWxlU2hlZXRcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHNoZWV0OiB1bmRlZmluZWQsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNldHMgQ1NTIHJ1bGVzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSBPYmplY3QgcnVsZXMgQSBzZXQgb2YgcnVsZXMgd2hlcmUgdGhlIGtleXMgYXJlIHRoZSBzZWxlY3RvcnNcbiAgICAgICAgICogICAgICBhbmQgdGhlIHZhbHVlcyB0aGUgY3NzIHJ1bGUgYm9keVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiBzdHlsdXMuc2V0UnVsZXMoe1xuICAgICAgICAgKiAgICdkaXYjc29tZS1pZCAuc29tZS1jbGFzcyB7XG4gICAgICAgICAqICAgICAnYmFja2dyb3VuZCc6ICd1cmwoXCIuLi5cIikgLi4uJyxcbiAgICAgICAgICogICAgIC4uLlxuICAgICAgICAgKiAgIH0sXG4gICAgICAgICAqXG4gICAgICAgICAqICAgJyNzb21lLW90aGVyLWlkIHtcbiAgICAgICAgICogICAgIC4uLlxuICAgICAgICAgKiAgIH0sXG4gICAgICAgICAqXG4gICAgICAgICAqICAgLi4uXG4gICAgICAgICAqIH0pO1xuICAgICAgICAgKi9cbiAgICAgICAgc2V0UnVsZXM6IGZ1bmN0aW9uIChydWxlcykge1xuICAgICAgICAgICAgZWFjaCh0aGlzLnByZXBhcmUocnVsZXMsIHt9LCAnJyksIHRoaXMuc2V0UnVsZSwgdGhpcyk7XG4gICAgICAgIH0sXG5cblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgcHJlcGFyZTogZnVuY3Rpb24gKHJhdywgcmVzdWx0LCBzZWxlY3Rvcikge1xuICAgICAgICAgICAgZWFjaChyYXcsIGZ1bmN0aW9uICh2YWx1ZSwga2V5KSB7XG4gICAgICAgICAgICAgICAgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wcmVwYXJlKHZhbHVlLCByZXN1bHQsIHRoaXMuY29tYmluZVNlbGVjdG9yKHNlbGVjdG9yLCBrZXkpKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJlc3VsdFtzZWxlY3Rvcl0gPSByZXN1bHRbc2VsZWN0b3JdIHx8IHt9O1xuICAgICAgICAgICAgICAgIHJlc3VsdFtzZWxlY3Rvcl1ba2V5XSA9IHZhbHVlO1xuICAgICAgICAgICAgfSwgdGhpcyk7XG5cbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIGNvbWJpbmVTZWxlY3RvcjogZnVuY3Rpb24gKHBhcmVudCwgY2hpbGQpIHtcbiAgICAgICAgICAgIHZhciByZXN1bHQgPSAocGFyZW50ICsgJyAnICsgY2hpbGQpLnJlcGxhY2UoL1xccyomL2csICcnKTtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHNldFJ1bGU6IGZ1bmN0aW9uIChydWxlLCBzZWxlY3Rvcikge1xuICAgICAgICAgICAgdmFyIHJ1bGVTdHIgPSB0aGlzLmNyZWF0ZVJ1bGVTdHIoc2VsZWN0b3IsIHJ1bGUpO1xuICAgICAgICAgICAgdmFyIHNoZWV0ID0gdGhpcy5nZXRTdHlsZVNoZWV0KCk7XG4gICAgICAgICAgICB2YXIgcnVsZURhdGEgPSB0aGlzLnJ1bGVzW3NlbGVjdG9yXTtcblxuICAgICAgICAgICAgaWYgKHJ1bGVEYXRhKSB7XG4gICAgICAgICAgICAgICAgLy8gdXBkYXRlIGV4aXN0aW5nIHJ1bGVcbiAgICAgICAgICAgICAgICBzaGVldC5kZWxldGVSdWxlKHJ1bGVEYXRhLmluZGV4KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gYWRkIG5ldyBydWxlXG4gICAgICAgICAgICAgICAgcnVsZURhdGEgPSB7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4OiBzaGVldC5jc3NSdWxlcy5sZW5ndGhcbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgdGhpcy5ydWxlc1tzZWxlY3Rvcl0gPSBydWxlRGF0YTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc2hlZXQuaW5zZXJ0UnVsZShydWxlU3RyLCBydWxlRGF0YS5pbmRleCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIGNyZWF0ZVJ1bGVTdHI6IGZ1bmN0aW9uIChzZWxlY3RvciwgcnVsZSkge1xuICAgICAgICAgICAgdmFyIHByb3BzID0gJyc7XG4gICAgICAgICAgICBlYWNoKHJ1bGUsIGZ1bmN0aW9uICh2YWx1ZSwga2V5KSB7XG4gICAgICAgICAgICAgICAgcHJvcHMgKz0ga2V5ICsgJzonICsgdmFsdWUgKyAnOyc7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIHNlbGVjdG9yICsgJ3snICsgcHJvcHMgKyAnfSc7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIGdldFN0eWxlU2hlZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5zaGVldCkge1xuICAgICAgICAgICAgICAgIHZhciBzdHlsZUVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKHN0eWxlRWwpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2hlZXQgPSBzdHlsZUVsLnNoZWV0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5zaGVldDtcbiAgICAgICAgfSxcblxuICAgIH0pLndoZW5CcmV3ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnJ1bGVzID0ge307XG5cbiAgICB9KS53aGVuRGlzcG9zZWQoZnVuY3Rpb24gKCkge1xuICAgICAgICB3aGlsZSAodGhpcy5zaGVldCAmJiB0aGlzLnNoZWV0LmNzc1J1bGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHRoaXMuc2hlZXQuZGVsZXRlUnVsZSgwKTtcbiAgICAgICAgfVxuICAgIH0pO1xufSgpKTtcbiIsIi8qXG4gKiAgIOKAnE1lZGljaW5lLCBhbmQgTGF3LCBhbmQgUGhpbG9zb3BoeSAtXG4gKiAgICBZb3UndmUgd29ya2VkIHlvdXIgd2F5IHRocm91Z2ggZXZlcnkgc2Nob29sLFxuICogICAgRXZlbiwgR29kIGhlbHAgeW91LCBUaGVvbG9neSxcbiAqICAgIEFuZCBzd2VhdGVkIGF0IGl0IGxpa2UgYSBmb29sLlxuICogICAgV2h5IGxhYm91ciBhdCBpdCBhbnkgbW9yZT9cbiAqICAgIFlvdSdyZSBubyB3aXNlciBub3cgdGhhbiB5b3Ugd2VyZSBiZWZvcmUuXG4gKiAgICBZb3UncmUgTWFzdGVyIG9mIEFydHMsIGFuZCBEb2N0b3IgdG9vLFxuICogICAgQW5kIGZvciB0ZW4geWVhcnMgYWxsIHlvdSd2ZSBiZWVuIGFibGUgdG8gZG9cbiAqICAgIElzIGxlYWQgeW91ciBzdHVkZW50cyBhIGZlYXJmdWwgZGFuY2VcbiAqICAgIFRocm91Z2ggYSBtYXplIG9mIGVycm9yIGFuZCBpZ25vcmFuY2UuXG4gKiAgICBBbmQgYWxsIHRoaXMgbWlzZXJ5IGdvZXMgdG8gc2hvd1xuICogICAgVGhlcmUncyBub3RoaW5nIHdlIGNhbiBldmVyIGtub3cuXG4gKiAgICBPaCB5ZXMgeW91J3JlIGJyaWdodGVyIHRoYW4gYWxsIHRob3NlIHJlbGljcyxcbiAqICAgIFByb2Zlc3NvcnMgYW5kIERvY3RvcnMsIHNjcmliYmxlcnMgYW5kIGNsZXJpY3MsXG4gKiAgICBObyBkb3VidHMgb3Igc2NydXBsZXMgdG8gdHJvdWJsZSB5b3UsXG4gKiAgICBEZWZ5aW5nIGhlbGwsIGFuZCB0aGUgRGV2aWwgdG9vLlxuICogICAgQnV0IHRoZXJlJ3Mgbm8gam95IGluIHNlbGYtZGVsdXNpb247XG4gKiAgICBZb3VyIHNlYXJjaCBmb3IgdHJ1dGggZW5kcyBpbiBjb25mdXNpb24uXG4gKiAgICBEb24ndCBpbWFnaW5lIHlvdXIgdGVhY2hpbmcgd2lsbCBldmVyIHJhaXNlXG4gKiAgICBUaGUgbWluZHMgb2YgbWVuIG9yIGNoYW5nZSB0aGVpciB3YXlzLlxuICogICAgQW5kIGFzIGZvciB3b3JsZGx5IHdlYWx0aCwgeW91IGhhdmUgbm9uZSAtXG4gKiAgICBXaGF0IGhvbm91ciBvciBnbG9yeSBoYXZlIHlvdSB3b24/XG4gKiAgICBBIGRvZyBjb3VsZCBzdGFuZCB0aGlzIGxpZmUgbm8gbW9yZS5cbiAqICAgIEFuZCBzbyBJJ3ZlIHR1cm5lZCB0byBtYWdpYyBsb3JlO1xuICogICAgVGhlIHNwaXJpdCBtZXNzYWdlIG9mIHRoaXMgYXJ0XG4gKiAgICBTb21lIHNlY3JldCBrbm93bGVkZ2UgbWlnaHQgaW1wYXJ0LlxuICogICAgTm8gbG9uZ2VyIHNoYWxsIEkgc3dlYXQgdG8gdGVhY2hcbiAqICAgIFdoYXQgYWx3YXlzIGxheSBiZXlvbmQgbXkgcmVhY2g7XG4gKiAgICBJJ2xsIGtub3cgd2hhdCBtYWtlcyB0aGUgd29ybGQgcmV2b2x2ZSxcbiAqICAgIEl0cyBteXN0ZXJpZXMgcmVzb2x2ZSxcbiAqICAgIE5vIG1vcmUgaW4gZW1wdHkgd29yZHMgSSdsbCBkZWFsIC1cbiAqICAgIENyZWF0aW9uJ3Mgd2VsbHNwcmluZ3MgSSdsbCByZXZlYWwh4oCdXG4gKiAgICAgICAgICAgIOKAlSBKb2hhbm4gV29sZmdhbmcgdm9uIEdvZXRoZSwgRmF1c3RcbiAqL1xuKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgaXNCcm93c2VyID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCc7XG4gICAgdmFyIGVhY2ggPSByZXF1aXJlKCdwcm8tc2luZ3VsaXMnKTtcbiAgICB2YXIgVXRpbHMgPSB7fTtcblxuICAgIC8qKlxuICAgICAqIGhlbHBlciB0byB0dXJuIHRoZSBmaXJzdCBsZXR0ZXIgb2YgYSBzdHJpbmcgdG8gdXBwZXIgY2FzZVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgZnVuY3Rpb24gdWNGaXJzdChzKSB7XG4gICAgICAgIHJldHVybiBVdGlscy5pc1N0cmluZyhzKSA/IHMuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBzLnN1YnN0cigxLCBzLmxlbmd0aCkgOiAnJztcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBVdGlscztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiB0aGUgcHJlZml4IGZvciBpbnRlcm5hbCB0eXBlIGFuZCBtZXRob2QgbWV0YSBwcm9wZXJ0aWVzXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgbWV0YVByZWZpeFxuICAgICAqIEB0eXBlIFN0cmluZ1xuICAgICAqL1xuICAgIFV0aWxzLm1ldGFQcmVmaXggPSAnX0FKU18nO1xuXG4gICAgLyoqXG4gICAgICogQ2hlY2tzIGlmIGEgZ2l2ZW4gaXRlbSBpcyBhbiBvYmplY3QuXG4gICAgICogTm90aWNlIHRoYXQgZXZlcnkgYXJyYXkgaXMgYW4gb2JqZWN0IGJ1dCBub3QgZXZlcnkgb2JqZWN0XG4gICAgICogaXMgYW4gYXJyYXkgKHdoaWNoIGlzIGFsc28gdHJ1ZSBmb3IgZnVuY3Rpb25zKS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmFyaW91c30gbyBUaGUgaXRlbSB0byBiZSBjaGVja2VkXG4gICAgICogQHJldHVybiB7Qm9vbGVhbn0gPGNvZGU+dHJ1ZTwvY29kZT4gaWYgdGhlIGdpdmVuIGl0ZW0gaXMgYW4gb2JqZWN0XG4gICAgICovXG4gICAgVXRpbHMuaXNPYmplY3QgPSBmdW5jdGlvbiBpc09iamVjdChvKSB7XG4gICAgICAgIHJldHVybiBvICYmICh0eXBlb2YgbyA9PT0gJ29iamVjdCcgfHwgdHlwZW9mIG8gPT09ICdmdW5jdGlvbicpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBDaGVja3MgaWYgYSBnaXZlbiBpdGVtIGlzIGFuIGFycmF5XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZhcmlvdXN9IGEgVGhlIGl0ZW0gdG8gYmUgY2hlY2tlZFxuICAgICAqIEByZXR1cm4ge0Jvb2xlYW59IDxjb2RlPnRydWU8L2NvZGU+IGlmIHRoZSBnaXZlbiBpdGVtIGlzIGFuIGFycmF5XG4gICAgICovXG4gICAgVXRpbHMuaXNBcnJheSA9IGZ1bmN0aW9uIGlzQXJyYXkoYSkge1xuICAgICAgICByZXR1cm4gYSBpbnN0YW5jZW9mIEFycmF5O1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBDaGVja3MgaWYgYSBnaXZlbiBpdGVtIGlzIGEgZnVuY3Rpb25cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmFyaW91c30gZiBUaGUgaXRlbSB0byBiZSBjaGVja2VkXG4gICAgICogQHJldHVybiB7Qm9vbGVhbn0gPGNvZGU+dHJ1ZTwvY29kZT4gaWYgdGhlIGdpdmVuIGl0ZW0gaXMgYSBmdW5jdGlvblxuICAgICAqL1xuICAgIFV0aWxzLmlzRnVuY3Rpb24gPSBmdW5jdGlvbiBpc0Z1bmN0aW9uKGYpIHtcbiAgICAgICAgcmV0dXJuIHR5cGVvZiBmID09PSAnZnVuY3Rpb24nO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBDaGVja3MgaWYgYSBnaXZlbiBpdGVtIGlzIGEgbnVtYmVyXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZhcmlvdXN9IG4gVGhlIGl0ZW0gdG8gYmUgY2hlY2tlZFxuICAgICAqIEByZXR1cm4ge0Jvb2xlYW59IDxjb2RlPnRydWU8L2NvZGU+IGlmIHRoZSBnaXZlbiBpdGVtIGlzIGEgbnVtYmVyXG4gICAgICovXG4gICAgVXRpbHMuaXNOdW1iZXIgPSBmdW5jdGlvbiBpc051bWJlcihuKSB7XG4gICAgICAgIHJldHVybiB0eXBlb2YgbiA9PT0gJ251bWJlcicgJiYgIWlzTmFOKG4pO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBDaGVja3MgaWYgYSBnaXZlbiBpdGVtIGlzIGEgc3RyaW5nXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZhcmlvdXN9IHMgVGhlIGl0ZW0gdG8gYmUgY2hlY2tlZFxuICAgICAqIEByZXR1cm4ge0Jvb2xlYW59IDxjb2RlPnRydWU8L2NvZGU+IGlmIHRoZSBnaXZlbiBpdGVtIGlzIGEgc3RyaW5nXG4gICAgICovXG4gICAgVXRpbHMuaXNTdHJpbmcgPSBmdW5jdGlvbiBpc1N0cmluZyhzKSB7XG4gICAgICAgIHJldHVybiB0eXBlb2YgcyA9PT0gJ3N0cmluZyc7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIENoZWNrcyBpZiB0aGUgZ2l2ZW4gaXRlbSBpcyBhIGJvb2xlYW5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmFyaW91c30gYiB0aGUgdmFsdWUgdG8gY2hlY2tcbiAgICAgKiBAcmV0dXJuIHtCb29sZWFufSA8Y29kZT50cnVlPC9jb2RlPiBpZiBhbmQgb25seSBpZiB0aGUgY2hlY2sgaXMgcGFzc2VkXG4gICAgICovXG4gICAgVXRpbHMuaXNCb29sZWFuID0gZnVuY3Rpb24gaXNCb29sZWFuKGIpIHtcbiAgICAgICAgcmV0dXJuIHR5cGVvZiBiID09PSAnYm9vbGVhbic7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIENoZWNrcyBpZiB0aGUgZ2l2ZW4gdmFsdWUgaXMgZGVmaW5lZFxuICAgICAqXG4gICAgICogQHBhcmFtIHtWYXJpb3VzfSB4IHRoZSB2YWx1ZSB0byBjaGVja1xuICAgICAqIEByZXR1cm4ge0Jvb2xlYW59IDxjb2RlPnRydWU8L2NvZGU+IGlmIGFuZCBvbmx5IGlmIHRoZSBjaGVjayBpcyBwYXNzZWRcbiAgICAgKi9cbiAgICBVdGlscy5pc0RlZmluZWQgPSBmdW5jdGlvbiBpc0RlZmluZWQoeCkge1xuICAgICAgICByZXR1cm4gVXRpbHMuaXNOdW1iZXIoeCkgfHwgVXRpbHMuaXNTdHJpbmcoeCkgfHwgVXRpbHMuaXNPYmplY3QoeCkgfHwgVXRpbHMuaXNBcnJheSh4KSB8fCBVdGlscy5pc0Z1bmN0aW9uKHgpIHx8IFV0aWxzLmlzQm9vbGVhbih4KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogSXRlcmF0ZXMgb2YgYW4gaXRlcmFibGUgb2JqZWN0IGFuZCBjYWxsIHRoZSBnaXZlbiBtZXRob2QgZm9yIGVhY2ggaXRlbVxuICAgICAqIEZvciBleGFtcGxlOlxuICAgICAqIDxwcmU+PGNvZGU+XG4gICAgICogICAgICAvLyAoYSkgZGVmYXVsdCB1c2UgY2FzZSBpdGVyYXRlIHRocm91Z2ggYW4gYXJyYXkgb3IgYW4gb2JqZWN0XG4gICAgICogICAgICBVdGlscy5lYWNoKFsxLCAyLCAuLi4sIG5dLCBmdW5jdGlvbiBkb1N0dWZmKHZhbCkgeyAuLi4gfSk7XG4gICAgICpcbiAgICAgKiAgICAgIC8vIChiKSBtYXAgZGF0YVxuICAgICAqICAgICAgVXRpbHMuZWFjaChbMSwgMiwgM10sIGZ1bmN0aW9uIGRvdWJsZSh2YWwpIHtcbiAgICAgKiAgICAgICAgICByZXR1cm4gMiAqIHZhbDtcbiAgICAgKiAgICAgIH0pOyAvLyAtPiBbMiwgNCwgNl1cbiAgICAgKiAgICAgIFV0aWxzLmVhY2goe2ZvbzogMSwgYmFyOiAyfSwgZnVuY3Rpb24gZG91YmxlKHZhbCkge1xuICAgICAqICAgICAgICAgIHJldHVybiAyICogdmFsO1xuICAgICAqICAgICAgfSk7IC8vIC0+IHtmb286IDIsIGJhcjogNH1cbiAgICAgKlxuICAgICAqICAgICAgLy8gKGMpIGZpbHRlciBkYXRhXG4gICAgICogICAgICBVdGlscy5lYWNoKFsxLCAyLCAzLCA0XSwgZnVuY3Rpb24gKHZhbCkge1xuICAgICAqICAgICAgICAgIHJldHVybiAodmFsICUgMiA9PT0gMCkgPyB2YWwgOiB1bmRlZmluZWQ7XG4gICAgICogICAgICB9KTsgLy8gLT4gWzIsIDRdXG4gICAgICogICAgICBVdGlscy5lYWNoKHsgZm9vOiAxLCBiYXI6IDIsIGJhejogMywgfSwgZnVuY3Rpb24gdW5ldmVuKHZhbCkge1xuICAgICAqICAgICAgICAgIHJldHVybiAodmFsICUgMiAhPT0gMCkgPyB2YWwgOiB1bmRlZmluZWQ7XG4gICAgICogICAgICB9KTsgLy8gLT4geyBmb286IDEsIGJhejogMyB9XG4gICAgICogPC9jb2RlPjwvcHJlPlxuICAgICAqXG4gICAgICogQGRlcHJlY2F0ZWRcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0L0FycmF5fSBpdGVyYWJsZSBUaGUgb2JqZWN0IHRvIGl0ZXJhdGUgdGhyb3VnaFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGZuIFRoZSBjYWxsYmFjayBmdW5jdGlvbiB0byBiZSBjYWxsZWQgZm9yIGVhY2ggaXRlbVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBzY29wZSBUaGUgZXhlY3V0aW9uIHNjb3BlIGZvciB0aGUgY2FsbGJhY2sgZnVuY3Rpb25cbiAgICAgKiBAcGFyYW0ge0FycmF5fSBtb3JlIE9wdGlvbmFsOyBhbiBhZGRpb25hbCBzZXQgb2YgYXJndW1lbnRzIHdoaWNoIHdpbGxcbiAgICAgKiAgICAgIGJlIHBhc3NlZCB0byB0aGUgY2FsbGJhY2sgZnVuY3Rpb25cbiAgICAgKiBAcmV0dXJuIHtPYmplY3QvQXJyYXl9IFRoZSBhZ2dyZWdhdGVkIHJlc3VsdHMgb2YgZWFjaCBjYWxsYmFjayAoc2VlIGV4YW1wbGVzKVxuICAgICAqL1xuICAgIFV0aWxzLmVhY2ggPSBlYWNoO1xuXG4gICAgLyoqXG4gICAgICogTWl4ZXMgdGhlIGdpdmVuIGFkZGl0aXZlcyB0byB0aGUgc291cmNlIG9iamVjdFxuICAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgICogPHByZT48Y29kZT5cbiAgICAgKiAvLyBmaXJzdCBhZGQgZGVmYXVsdHMgdmFsdWVzIHRvIGEgbmV3IG9iamVjdCBhbmQgdGhlbiBvdmVycmlkZXMgdGhlIGRlZmF1bHRzXG4gICAgICogLy8gd2l0aCB0aGUgYWN0dWFsIHZhbHVlc1xuICAgICAqIFV0aWxzLm1peCh7fSwgZGVmYXVsdHMsIHZhbHVlcyk7XG4gICAgICogPC9jb2RlPjwvcHJlPlxuICAgICAqIEBmdW5jdGlvblxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGJhc2VcbiAgICAgKiAgICAgIHRoZSBzb3VyY2Ugb2JqZWN0ICh3aWxsIGJlIG1vZGlmaWVkISlcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSAuLi5vdmVycmlkZXNcbiAgICAgKiAgICAgIHRoZSBzZXQgb2YgYWRkaXRpdmVzXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIE9iamVjdFxuICAgICAqICAgICAgdGhlIG1vZGlmaWVkIHNvdXJjZSBvYmplY3RcbiAgICAgKi9cbiAgICBVdGlscy5taXggPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICBmdW5jdGlvbiBtaXhPbmVJdGVtKHZhbHVlLCBrZXksIG9iaikge1xuICAgICAgICAgICAgb2JqW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICB2YXIgYmFzZSA9IGFyZ3Muc2hpZnQoKTtcbiAgICAgICAgICAgIHZhciBuZXh0O1xuXG4gICAgICAgICAgICB3aGlsZSAoYXJncy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBuZXh0ID0gYXJncy5zaGlmdCgpO1xuICAgICAgICAgICAgICAgIGVhY2gobmV4dCwgbWl4T25lSXRlbSwgbnVsbCwgW2Jhc2VdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBiYXNlO1xuICAgICAgICB9O1xuICAgIH0oKSk7XG5cbiAgICAvKipcbiAgICAgKiBNZWx0cyB0d28gb2JqZWN0IGRlZXBseSB0b2dldGhlciBpbiBhIG5ldyBvYmplY3RcbiAgICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICAqXG4gICAgICogPHByZT48Y29kZT5cbiAgICAgKiAgIFV0aWxzLm1lbHQoeyBmb286IDEgfSwgeyBiYXI6IDEgfSk7IC8vIC0+IHsgZm9vOiAxLCBiYXI6IDEgfTtcbiAgICAgKiAgIFV0aWxzLm1lbHQoe30sIHNvbWVPYmopOyAvLyAtPiBkZWVwIGNsb25lIG9mIHNvbWVPYmpcbiAgICAgKiA8L2NvZGU+PC9wcmU+XG4gICAgICpcbiAgICAgKiBOT1RJQ0U6IEFycmF5IGFuZCBub25lLWRhdGEtb2JqZWN0cyAob2JqZWN0cyB3aXRoIGEgY29uc3RydWN0b3Igb3RoZXJcbiAgICAgKiB0aGFuIE9iamVjdCkgYXJlIHRyZWF0ZWQgYXMgYXRvbWljIHZhbHVlIGFuZCBhcmUgbm90IG1lcmdlZFxuICAgICAqIEBmdW5jdGlvblxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9iajEgRmlyc3Qgc291cmNlIG9iamVjdFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmoyIFRoZSBzZWNvbmQgc291cmNlIG9iamVjdFxuICAgICAqIEByZXR1cm4gT2JqZWN0IFRoZSBkZWVwbHkgbWVsdGVkIHJlc3VsdFxuICAgICAqL1xuICAgIFV0aWxzLm1lbHQgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgbWVsdFZhbHVlID0gZWFjaC5wcmVwYXJlKGZ1bmN0aW9uICh2YWx1ZSwga2V5LCByZXN1bHQpIHtcbiAgICAgICAgICAgIGlmICh2YWx1ZSAmJiAodmFsdWUuY29uc3RydWN0b3IgPT09IE9iamVjdCkpIHtcbiAgICAgICAgICAgICAgICByZXN1bHRba2V5XSA9IFV0aWxzLm1lbHQocmVzdWx0W2tleV0sIHZhbHVlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0W2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgbnVsbCk7XG5cbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChvYmoxLCBvYmoyKSB7XG4gICAgICAgICAgICB2YXIgcmVzdWx0ID0ge307XG5cbiAgICAgICAgICAgIG1lbHRWYWx1ZShvYmoxLCBbcmVzdWx0XSk7XG4gICAgICAgICAgICBtZWx0VmFsdWUob2JqMiwgW3Jlc3VsdF0pO1xuXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9O1xuICAgIH0oKSk7XG5cbiAgICAvKipcbiAgICAgKiBBbGxvd3Mgb3ZlcnJpZGluZyBtZXRob2RzIG9mIGFuIGdpdmVuIG9iamVjdC4gSWYgdGhlIGJhc2Ugb2JqZWN0IGhhc1xuICAgICAqIGFscmVhZHkgYSBtZXRob2Qgd2l0aCB0aGUgc2FtZSBrZXkgdGhpcyBvbmUgd2lsbCBiZSBoaWRkZW4gYnV0IGRvZXMgbm90XG4gICAgICogZ2V0IGxvc3QuIFlvdSBjYW4gYWNjZXNzIHRoZSBvdmVycmlkZGVuIG1ldGhvZCB1c2luZ1xuICAgICAqIDxjb2RlPl9zdXBlci5jYWxsKHRoaXMsIC4uLik8L2NvZGU+XG4gICAgICpcbiAgICAgKiBGb3IgZXhhbXBsZTogPHByZT48Y29kZT5cbiAgICAgKiB2YXIgb2JqID0ge1xuICAgICAqICAgICAgZm9vOiBmdW5jdGlvbiAoKSB7XG4gICAgICogICAgICAgICAgcmV0dXJuICdmb28nO1xuICAgICAqICAgICAgfVxuICAgICAqIH07XG4gICAgICpcbiAgICAgKiBVdGlscy5vdmVycmlkZShvYmosIHtcbiAgICAgKiAgICAgIGZvbzogVXRpbHMub3ZlcnJpZGUoZnVuY3Rpb24gKF9zdXBlcikge1xuICAgICAqICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICogICAgICAgICAgICAgIHJldHVybiBfc3VwZXIuY2FsbCh0aGlzKSArICcgLSBiYXInO1xuICAgICAqICAgICAgICAgIH07XG4gICAgICogICAgICB9KVxuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogb2JqLmZvbygpOyAvLyB3aWxsIHJldHVybiAnZm9vIC0gYmFyJ1xuICAgICAqIDwvY29kZT48L3ByZT5cbiAgICAgKiBAZnVuY3Rpb25cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBiYXNlXG4gICAgICogICAgICBUaGUgYmFzZSBvYmplY3QgdG8gYmUgb3ZlcnJpZGRlbiAod2lsbCBiZSBtb2RpZmllZCEpXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb3ZlcnJpZGVzXG4gICAgICogICAgICBUaGUgc2V0IG9mIG5ldyBtZXRob2RzXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICogICAgICBUaGUgbW9kaWZpZWQgb2JqZWN0XG4gICAgICovXG4gICAgVXRpbHMub3ZlcnJpZGUgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyBoZWxwZXIgdG8gZGVjaWRlIHdoZXRoZXIgaXQgaXMgYSBtYWdpYyBtZXRhIGZ1bmN0aW9uIHRoYXQgY3JlYXRlcyB0aGUgYWN0dWFsIG9iamVjdCBtZXRob2RcbiAgICAgICAgZnVuY3Rpb24gaXNNYWdpY01ldGhvZChmbikge1xuICAgICAgICAgICAgcmV0dXJuIGZuICYmIChmbi5ob2N1c3BvY3VzID09PSB0cnVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGhlbHBlciB0byBpZGVudGlmeSBwcm9wZXJ0eSBkZXNjcmlwdG9yc1xuICAgICAgICBmdW5jdGlvbiBpc1Byb3BlcnR5RGVmKG9iaikge1xuICAgICAgICAgICAgcmV0dXJuIFV0aWxzLmlzT2JqZWN0KG9iaikgJiYgVXRpbHMubWV0YShvYmosICdpc1Byb3BlcnR5Jyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBoZWxwZXIgbWV0aG9kIHRvIGFkZCBhIHNpbmdsZSBwcm9wZXJ0eVxuICAgICAgICBmdW5jdGlvbiBhZGRQcm9wZXJ0eShwcm9wLCBrZXksIG9iaikge1xuICAgICAgICAgICAgaWYgKFV0aWxzLmlzRnVuY3Rpb24ocHJvcCkpIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNNYWdpY01ldGhvZChwcm9wKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyB5b3Ugc2FpZCB0aGUgbWFnaWMgd29yZHMgc28geW91IHdpbGwgZ2V0IHlvdXIgcmVmZXJlbmNlIHRvIHRoZSBvdmVycmlkZGVuIG1ldGhvZFxuICAgICAgICAgICAgICAgICAgICBwcm9wID0gcHJvcChvYmpba2V5XSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGlzUHJvcGVydHlEZWYocHJvcCkpIHtcbiAgICAgICAgICAgICAgICBVdGlscy5kZWZpbmVQcm9wZXJ0eShvYmosIGtleSwgcHJvcCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG9ialtrZXldID0gcHJvcDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoYmFzZSwgb3ZlcnJpZGVzKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGJhc2UgPT09ICdmdW5jdGlvbicgJiYgdHlwZW9mIG92ZXJyaWRlcyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICBiYXNlLmhvY3VzcG9jdXMgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHJldHVybiBiYXNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob3ZlcnJpZGVzICYmIG92ZXJyaWRlcy5jb25zdHJ1Y3RvciAhPT0gT2JqZWN0LnByb3RvdHlwZS5jb25zdHJ1Y3Rvcikge1xuICAgICAgICAgICAgICAgIGFkZFByb3BlcnR5KG92ZXJyaWRlcy5jb25zdHJ1Y3RvciwgJ2NvbnN0cnVjdG9yJywgYmFzZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGVhY2gob3ZlcnJpZGVzLCBhZGRQcm9wZXJ0eSwgbnVsbCwgW2Jhc2VdKTtcblxuICAgICAgICAgICAgcmV0dXJuIGJhc2U7XG4gICAgICAgIH07XG4gICAgfSgpKTtcblxuICAgIC8qKlxuICAgICAqIEBmdW5jdGlvblxuICAgICAqL1xuICAgIFV0aWxzLmV4dGVuZCA9IGZ1bmN0aW9uIGV4dGVuZChiYXNlLCBvdmVycmlkZXMpIHtcbiAgICAgICAgdmFyIGV4dGVuZGVkID0gT2JqZWN0LmNyZWF0ZShiYXNlKTtcblxuICAgICAgICBpZiAoVXRpbHMuaXNGdW5jdGlvbihvdmVycmlkZXMpKSB7XG4gICAgICAgICAgICBvdmVycmlkZXMgPSBvdmVycmlkZXMoYmFzZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3ZlcnJpZGVzKSB7XG4gICAgICAgICAgICBVdGlscy5vdmVycmlkZShleHRlbmRlZCwgb3ZlcnJpZGVzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBleHRlbmRlZDtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogRXh0cmFjdCB2YWx1ZXMgb2YgYSBzcGVjaWZpYyBwcm9wZXJ0eSBmcm9tIGEgZ2l2ZW4gc2V0IG9mIGl0ZW1zXG4gICAgICogRm9yIGV4YW1wbGU6XG4gICAgICogPHByZT48Y29kZT5cbiAgICAgKiBVdGlscy5leHRyYWN0KFt7a2V5OiAnZm9vJ30sIHtrZXk6ICdiYXInfSwgLi4uIF0sICdrZXknKTsgLy8gLT4gWydmb28nLCAnYmFyJywgLi4uXVxuICAgICAqIFV0aWxzLmV4dHJhY3Qoe28xOiB7a2V5OiAnZm9vJ30sIG8yOiB7a2V5OiAnYmFyJ30sIC4uLn0sICdrZXknKTsgLy8gLT4gWydmb28nLCAnYmFyJywgLi4uXVxuICAgICAqIDwvY29kZT48L3ByZT5cbiAgICAgKiBAZnVuY3Rpb25cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXJyYXkvT2JqZWN0fSBsaXN0XG4gICAgICogICAgICBUaGUgaW5pdGlhbCBzZXQgb2YgaXRlbXNcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBwcm9wZXJ0eVxuICAgICAqICAgICAgVGhlIG5hbWUgb2YgdGhlIHByb3BlcnR5IHRvIGV4dHJhY3RcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXJyYXl9XG4gICAgICogICAgICBUaGUgYXJyYXkgb2YgZXh0cmFjdGVkIHZhbHVlc1xuICAgICAqL1xuICAgIFV0aWxzLmV4dHJhY3QgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICBmdW5jdGlvbiBleHRyYWN0T25lKGl0ZW0sIGluZGV4LCBrZXksIHJlc3VsdCkge1xuICAgICAgICAgICAgaWYgKFV0aWxzLmlzT2JqZWN0KGl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnB1c2goaXRlbVtrZXldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGxpc3QsIHByb3BlcnR5KSB7XG4gICAgICAgICAgICB2YXIgcmVzdWx0ID0gW107XG4gICAgICAgICAgICBlYWNoKGxpc3QsIGV4dHJhY3RPbmUsIG51bGwsIFtwcm9wZXJ0eSwgcmVzdWx0XSk7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9O1xuICAgIH0oKSk7XG5cbiAgICAvKipcbiAgICAgKiBGaWx0ZXMgYSBzZXQgKGFycmF5IG9yIGhhc2ggb2JqZWN0KSB0byBjb250YWluIG9ubHkgdW5pcXVlIHZhbHVlc1xuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheXxPYmplY3R9IGxpc3QgVGhlIGxpc3QgdG8gYmUgZmlsdGVyZWRcbiAgICAgKiBAcmV0dXJuIHtBcnJheXxPYmplY3R9IFRoZSBmaWx0ZXJlZCBsaXN0XG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIFV0aWxzLnVuaXF1ZShbMSwgMywgNCwgMSwgMywgNV0pOyAvLyAtPiBbMSwgMywgNCwgNV1cbiAgICAgKiBVdGlscy51bmlxdWUoe2ZvbzogJ2ZvbycsIGJhcjogJ2ZvbycsIGJhejogJ2JheicpOyAvLyAtPiB7Zm9vOiAnZm9vJywgYmF6OiAnYmF6J31cbiAgICAgKi9cbiAgICBVdGlscy51bmlxdWUgPSBmdW5jdGlvbiB1bmlxdWUobGlzdCkge1xuICAgICAgICB2YXIgdXNlZCA9IHt9O1xuICAgICAgICByZXR1cm4gZWFjaChsaXN0LCBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgICAgICAgaWYgKHVzZWRbaXRlbV0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHVzZWRbaXRlbV0gPSB0cnVlO1xuICAgICAgICAgICAgcmV0dXJuIGl0ZW07XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgc2V0IG9mIHVuaXF1ZSB2YWx1ZXMgZnJvbSB0aGUgZ2l2ZW4gaW5wdXRcbiAgICAgKiBAZnVuY3Rpb25cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fSAuLi5hcmdzIFRoZSBpbml0aWFsIGRhdGEgc2V0c1xuICAgICAqXG4gICAgICogQHJldHVybiB7QXJyYXl9IEFuIGFycmF5IGNvbnRhaW5pbmcgdGhlIHVuaXF1ZSB2YWx1ZXNcbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogVXRpbHMudW5pb24oWzEsIDIsIDQsIDEwXSwgWzMsIDRdLCBbMSwgMiwgNSwgMTAxXSk7IC8vIC0+IFsxLCAyLCA0LCAxMCwgMywgNSwgMTAxXVxuICAgICAqIFV0aWxzLnVuaW9uKHtmb286ICdmb28nfSwge2JhcjogJ2Jhcid9LCB7YmFyOiAnYmF6J30pOyAvLyAtPiBbJ2ZvbycsICdiYXInLCAnYmF6J11cbiAgICAgKiBVdGlscy51bmlvbih7Zm9vOiAnZm9vJ30sIFsnZm9vJywgJ2JhciddLCB7YmFyOiAnYmF6J30pIC8vIC0+IFsnZm9vJywgJ2JhcicsICdiYXonXVxuICAgICAqL1xuICAgIFV0aWxzLnVuaW9uID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZnVuY3Rpb24gcHJvY2Vzc09uZUFyZ3VtZW50KGFycmF5LCBpbmRleCwgcmVzdWx0LCBzZWVuKSB7XG4gICAgICAgICAgICBlYWNoKGFycmF5LCBwcm9jZXNzT25lVmFsdWUsIG51bGwsIFtyZXN1bHQsIHNlZW5dKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHByb2Nlc3NPbmVWYWx1ZSh2YWx1ZSwgaW5kZXgsIHJlc3VsdCwgc2Vlbikge1xuICAgICAgICAgICAgaWYgKCFzZWVuW3ZhbHVlXSkge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKHZhbHVlKTtcbiAgICAgICAgICAgICAgICBzZWVuW3ZhbHVlXSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIHJlc3VsdCA9IFtdO1xuICAgICAgICAgICAgdmFyIHNlZW4gPSB7fTtcbiAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkuYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcblxuICAgICAgICAgICAgZWFjaChhcmdzLCBwcm9jZXNzT25lQXJndW1lbnQsIG51bGwsIFtyZXN1bHQsIHNlZW5dKTtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH07XG4gICAgfSgpKTtcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIHZhbHVlcyBvZiBhIGhhc2ggb2JqZWN0IGFzIGFuIGFycmF5XG4gICAgICogQGZ1bmN0aW9uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gaGFzaCBUaGUga2V5LXZhbHVlLWhhc2gtbWFwXG4gICAgICogQHJldHVybiB7QXJyYXl9IEFuIGFycmF5IGNvbnRhaW5pbmcgdGhlIHZhbHVlc1xuICAgICAqL1xuICAgIFV0aWxzLnZhbHVlcyA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZ1bmN0aW9uIGFkZFZhbHVlVG9SZXN1bHRTZXQodmFsdWUsIGtleSwgcmVzdWx0U2V0KSB7XG4gICAgICAgICAgICByZXN1bHRTZXQucHVzaCh2YWx1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gdmFsdWVzKGhhc2gpIHtcbiAgICAgICAgICAgIGlmICghaGFzaCB8fCB0eXBlb2YgaGFzaCAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICAgICAgICAgIGVhY2goaGFzaCwgYWRkVmFsdWVUb1Jlc3VsdFNldCwgbnVsbCwgW3Jlc3VsdF0pO1xuXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9O1xuICAgIH0oKSk7XG5cbiAgICAvKipcbiAgICAgKiBSZWFkcyBhbmQgd3JpdGVzIHRoZSB2YWx1ZSBvZiBhIG1ldGEgYXR0cmlidXRlIGZyb20vdG9cbiAgICAgKiBhIGdpdmVuIG9iamVjdFxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9iaiBUaGUgb2JqZWN0IHdpdGggdGhlIG1ldGEgcHJvcGVydHlcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30ga2V5IFRoZSBpZGVudGlmaWVyIG9mIHRoZSBhdHRyaWJ1dGVcbiAgICAgKiBAcGFyYW0ge01peGVkfSBbdmFsdWVdIChPcHRpb25hbCkgVGhlIG5ldyB2YWx1ZTtcbiAgICAgKiAgICAgIElmIG9tbWl0dGVkIHRoZSB2YWx1ZSB3aWxsIG5vdCBiZSBjaGFuZ2VkXG4gICAgICogQHJldHVybiB7TWl4ZWR9IFRoZSBjdXJyZW50IHZhbHVlIG9mIHRoZSBtZXRhIGF0dHJpYnV0ZXNcbiAgICAgKi9cbiAgICBVdGlscy5tZXRhID0gZnVuY3Rpb24gKG9iaiwga2V5LCB2YWx1ZSkge1xuICAgICAgICBrZXkgPSBVdGlscy5tZXRhUHJlZml4ICsga2V5O1xuICAgICAgICBpZiAodmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgb2JqW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb2JqW2tleV07XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFRoaXMgbWV0aG9kIHdvcmtzIGluIHR3byBkaWZmZXJlbnQgbW9kZTo8dWw+XG4gICAgICpcbiAgICAgKiA8bGk+TW9kZSAoQSkgd2lsbCB3b3JrIHNpbWlsYXIgdG8gT2JqZWN0LmRlZmluZVByb3BlcnR5IChzZWVcbiAgICAgKiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9PYmplY3QvZGVmaW5lUHJvcGVydHkpXG4gICAgICogYnV0IHdpdGggYSBmZXcgZGVmYXVsdHMgc3dpdGNoZWQuIE5ldyBwcm9wZXJ0aWVzIGFyZSBieSBkZWZhdWx0IHdyaXRhYmxlLFxuICAgICAqIGVudW1lcmFibGUgYW5kIGNvbmZpZ3VyYWJsZSB3aGljaGggaXMgSU1PIG1vcmUgbmF0dXJhbC5cbiAgICAgKlxuICAgICAqIDxsaT5Nb2RlIChCKSBsZXQgeW91IG1hcmsgYSBnaXZlbiBvYmplY3QgYXMgYSBwcm9wZXJ0eSBkZWZpbml0aW9uIHdoaWNoXG4gICAgICogd2lsbCBiZSBldmFsdWF0ZWQgd2hlbiBicmV3aW5nIGEgcHJvdG90eXBlIG9yIGFkZGluZyB0aGUgcHJvcGVydHkgdG9cbiAgICAgKiBvbmUgd2l0aCB7QGxpbmsgVXRpbHMub3ZlcnJpZGV9PC9saT5cbiAgICAgKlxuICAgICAqIDwvdWw+XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqIFRoZSBvYmplY3Qgd2hpY2ggc2hvdWxkIGdldCB0aGUgcHJvcGVydHkgKG1vZGUgQSlcbiAgICAgKiAgICAgIG9yIHRoZSBwcm9wZXJ0eSBkZWZpbml0aW9uIChtb2RlIEIpXG4gICAgICogICAgICAoTk9USUNFIHRoYXQgZWl0aGVyIHdheSB0aGUgZ2l2ZW4gb2JqZWN0IHdpbGwgYmUgbW9kaWZpZWQpXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IFtwcm9wXSBUaGUgbmFtZSBvZiB0aGUgcHJvcGVydHkgKG1vZGUgQSk7IGVtcHR5IChtb2RlIEIpXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRzXSBUaGUgcHJvcGVydHkgZGVmaW5pdGlvbiAobW9kZSBBKTsgZW1wdHkgKG1vZGUgQilcbiAgICAgKlxuICAgICAqIEByZXR1cm4gb2JqIFRoZSBtb2RpZmllZCBvYmplY3RcbiAgICAgKi9cbiAgICBVdGlscy5kZWZpbmVQcm9wZXJ0eSA9IGZ1bmN0aW9uIChvYmosIHByb3AsIG9wdHMpIHtcbiAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgIC8vIE1vZGUgQjogbWFyayBpdCBhcyBhIHByb3BlcnRpZXMgc28gVXRpbHMub3ZlcnJpZGUgd2lsbFxuICAgICAgICAgICAgLy8ga25vdyB3aGF0IHRvIGRvXG4gICAgICAgICAgICBVdGlscy5tZXRhKG9iaiwgJ2lzUHJvcGVydHknLCB0cnVlKTtcbiAgICAgICAgICAgIHJldHVybiBvYmo7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBNb2RlIEE6IGRlZmluZSB0aGUgbmV3IHByb3BlcnR5IFwicHJvcFwiIGZvciBvYmplY3QgXCJvYmpcIlxuXG4gICAgICAgIC8vIHN3aXRjaCB0aGUgZGVmYXVsdHMgdG8gYmUgdHJ1dGh5IHVubGVzcyBzYWlkIG90aGVyd2lzZVxuICAgICAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICAgICAgb3B0cy53cml0YWJsZSA9IChvcHRzLndyaXRhYmxlICE9PSBmYWxzZSk7XG4gICAgICAgIG9wdHMuZW51bWVyYWJsZSA9IChvcHRzLmVudW1lcmFibGUgIT09IGZhbHNlKTtcbiAgICAgICAgb3B0cy5jb25maWd1cmFibGUgPSAob3B0cy5jb25maWd1cmFibGUgIT09IGZhbHNlKTtcblxuICAgICAgICBpZiAob3B0cy5nZXQpIHtcbiAgICAgICAgICAgIGRlbGV0ZSBvcHRzLndyaXRhYmxlOyAvLyB3cml0YWJsZS92YWx1ZSBpcyBub3QgYWxsb3dlZCB3aGVuIGRlZmluaW5nIGdldHRlci9zZXR0ZXJcbiAgICAgICAgICAgIGRlbGV0ZSBvcHRzLnZhbHVlO1xuXG4gICAgICAgICAgICBpZiAoVXRpbHMuaXNCb29sZWFuKG9wdHMuZ2V0KSkge1xuICAgICAgICAgICAgICAgIC8vIFwiZ2V0XCIgd2FzIHNpbXBseSBzZXQgdG8gdHJ1ZSAtPiBnZXQgdGhlIG5hbWUgZnJvbSB0aGUgcHJvcGVydHkgKFwiZm9vXCIgLT4gXCJnZXRGb29cIilcbiAgICAgICAgICAgICAgICBvcHRzLmdldCA9ICdnZXQnICsgdWNGaXJzdChwcm9wKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChVdGlscy5pc1N0cmluZyhvcHRzLmdldCkpIHtcbiAgICAgICAgICAgICAgICAvLyBcImdldFwiIHdhcyBzZXQgdG8gdGhlIGdldHRlcidzIG5hbWVcbiAgICAgICAgICAgICAgICAvLyAtPiBjcmVhdGUgYSBmdW5jdGlvbiB0aGF0IGNhbGxzIHRoZSBnZXR0ZXIgKHRoaXMgd2F5IHdlIGNhblxuICAgICAgICAgICAgICAgIC8vIGxhdGVyIG92ZXJyaWRlIHRoZSBtZXRob2QpXG4gICAgICAgICAgICAgICAgdmFyIGdldHRlck5hbWUgPSBvcHRzLmdldDtcbiAgICAgICAgICAgICAgICBvcHRzLmdldCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXNbZ2V0dGVyTmFtZV0oKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdHMuc2V0KSB7XG4gICAgICAgICAgICBkZWxldGUgb3B0cy53cml0YWJsZTsgLy8gd3JpdGFibGUvdmFsdWUgaXMgbm90IGFsbG93ZWQgd2hlbiBkZWZpbmluZyBnZXR0ZXIvc2V0dGVyXG4gICAgICAgICAgICBkZWxldGUgb3B0cy52YWx1ZTtcblxuICAgICAgICAgICAgaWYgKFV0aWxzLmlzQm9vbGVhbihvcHRzLnNldCkpIHtcbiAgICAgICAgICAgICAgICAvLyBcInNldFwiIHdhcyBzaW1wbHkgc2V0IHRvIHRydWUgLT4gZ2V0IHRoZSBuYW1lIGZyb20gdGhlIHByb3BlcnR5IChcImZvb1wiIC0+IFwic2V0Rm9vXCIpXG4gICAgICAgICAgICAgICAgb3B0cy5zZXQgPSAnc2V0JyArIHVjRmlyc3QocHJvcCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoVXRpbHMuaXNTdHJpbmcob3B0cy5zZXQpKSB7XG4gICAgICAgICAgICAgICAgdmFyIHNldHRlck5hbWUgPSBvcHRzLnNldDtcbiAgICAgICAgICAgICAgICBvcHRzLnNldCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpc1tzZXR0ZXJOYW1lXSh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCBwcm9wLCBvcHRzKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogY3JlYXRlcyBhIHVuaXF1ZSBpZGVudGlmaWVyXG4gICAgICogQGZ1bmN0aW9uXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd9XG4gICAgICogICAgICB0aGUgZ2VuZXJhdGVkIGlkZW50aWZpZXJcbiAgICAgKlxuICAgICAqL1xuICAgIFV0aWxzLmlkID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGNvdW50ZXIgPSAwO1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICdBSlMtJyArIChjb3VudGVyKyspO1xuICAgICAgICB9O1xuICAgIH0oKSk7XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgVVVJRFxuICAgICAqIChzb3VyY2UgaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvODgwOTQ3MilcbiAgICAgKiBAZnVuY3Rpb25cbiAgICAgKlxuICAgICAqIEByZXR1cm4ge1N0cmluZ30gdGhlIFVVSURcbiAgICAgKi9cbiAgICBVdGlscy51dWlkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgZCA9IFV0aWxzLm5vdygpO1xuICAgICAgICB2YXIgdXVpZCA9ICd4eHh4eHh4eC14eHh4LTR4eHgteXh4eC14eHh4eHh4eHh4eHgnLnJlcGxhY2UoL1t4eV0vZywgZnVuY3Rpb24gKGMpIHtcbiAgICAgICAgICAgIC8qIGpzaGludCBiaXR3aXNlOiBmYWxzZSAqL1xuICAgICAgICAgICAgdmFyIHIgPSAoZCArIE1hdGgucmFuZG9tKCkgKiAxNikgJSAxNiB8IDA7XG4gICAgICAgICAgICBkID0gTWF0aC5mbG9vcihkIC8gMTYpO1xuICAgICAgICAgICAgcmV0dXJuIChjID09PSAneCcgPyByIDogKHIgJiAweDMgfCAweDgpKS50b1N0cmluZygxNik7XG4gICAgICAgICAgICAvKiBqc2hpbnQgYml0d2lzZTogdHJ1ZSAqL1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHV1aWQ7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIGFuIHJldXNlYWJsZSBlbXB0eSBmdW5jdGlvbiBvYmplY3RcbiAgICAgKi9cbiAgICBVdGlscy5lbXB0eUZuID0gZnVuY3Rpb24gKCkge307XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBudW1iZXIgb2YgbWlsbGlzZWNvbmRzLCBhY2N1cmF0ZSB0byBhIHRob3VzYW5kdGggb2YgYVxuICAgICAqIG1pbGxpc2Vjb25kLCBmcm9tIHRoZSBzdGFydCBvZiBkb2N1bWVudCBuYXZpZ2F0aW9uIHRvIHRoZSB0aW1lIHRoZVxuICAgICAqIG5vdyBtZXRob2Qgd2FzIGNhbGxlZC5cbiAgICAgKiBTaGltIGZvciB3aW5kb3cucGVyZm9ybWFuY2Uubm93KCk7IHNlZSBodHRwOi8vd3d3LnczLm9yZy9UUi9hbmltYXRpb24tdGltaW5nL1xuICAgICAqIEBmdW5jdGlvblxuICAgICAqXG4gICAgICogQHJldHVybiB7TnVtYmVyfSBUaGUgdGltZSBpbiBtcyByZWxhdGl2ZSB0byB0aGUgc3RhcnQgb2YgdGhlXG4gICAgICogICAgICBkb2N1bWVudCBuYXZpZ2F0aW9uXG4gICAgICovXG4gICAgVXRpbHMubm93ID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKGlzQnJvd3NlciAmJiB3aW5kb3cucGVyZm9ybWFuY2UgJiYgd2luZG93LnBlcmZvcm1hbmNlLm5vdykge1xuICAgICAgICAgICAgLy8gdXNlIHdpbmRvdy5wZXJmb21hbmNlLm5vdyAod2hpY2ggaXMgdGhlIHJlZmVyZW5jZSkgaWYgcG9zc2libGVcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHdpbmRvdy5wZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGZhbGxiYWNrIHRvIERhdGUubm93KClcbiAgICAgICAgdmFyIGxvYWRUaW1lID0gRGF0ZS5ub3coKTtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBEYXRlLm5vdygpIC0gbG9hZFRpbWU7XG4gICAgICAgIH07XG4gICAgfSgpKTtcbn0pKCk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIGggPSByZXF1aXJlKCd2aXJ0dWFsLWRvbS9oJyk7XG4gICAgdmFyIGRpZmYgPSByZXF1aXJlKCd2aXJ0dWFsLWRvbS9kaWZmJyk7XG4gICAgdmFyIHBhdGNoID0gcmVxdWlyZSgndmlydHVhbC1kb20vcGF0Y2gnKTtcblxuICAgIHZhciBjb3F1b1ZlbmVudW0gPSByZXF1aXJlKCdjb3F1by12ZW5lbnVtJyk7XG4gICAgdmFyIGVhY2ggPSByZXF1aXJlKCdwcm8tc2luZ3VsaXMnKTtcblxuICAgIHZhciB1dGlscyA9IHJlcXVpcmUoJy4vVXRpbHMnKTtcblxuICAgIC8qKlxuICAgICAqIEBjbGFzc1xuICAgICAqIEBuYW1lIFJlbmRlckNvbnRleHRcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBSZW5kZXJDb250ZXh0KGlkLCBzdGF0ZSwgcHJvcHMsIGNoaWxkcmVuKSB7XG4gICAgICAgIHRoaXMuX2VudGl0eVBsYWNlaG9sZGVyID0gbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHByb3BlcnR5XG4gICAgICAgICAqIEBuYW1lIGVudGl0eUlkXG4gICAgICAgICAqIEB0eXBlIFN0cmluZ1xuICAgICAgICAgKiBAbWVtYmVyT2YgUmVuZGVyQ29udGV4dFxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5lbnRpdHlJZCA9IGlkO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcHJvcGVydHlcbiAgICAgICAgICogQG5hbWUgc3RhdGVcbiAgICAgICAgICogQHR5cGUgSW1tdXRhYmxlXG4gICAgICAgICAqIEBtZW1iZXJPZiBSZW5kZXJDb250ZXh0XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnN0YXRlID0gc3RhdGU7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBwcm9wZXJ0eVxuICAgICAgICAgKiBAbmFtZSBwcm9wc1xuICAgICAgICAgKiBAdHlwZSBPYmplY3RcbiAgICAgICAgICogQG1lbWJlck9mIFJlbmRlckNvbnRleHRcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucHJvcHMgPSBwcm9wcztcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHByb3BlcnR5XG4gICAgICAgICAqIEBuYW1lIGNoaWxkcmVuXG4gICAgICAgICAqIEB0eXBlIEFycmF5L09iamVjdFxuICAgICAgICAgKiBAbWVtYmVyT2YgUmVuZGVyQ29udGV4dFxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5jaGlsZHJlbiA9IGNoaWxkcmVuO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBoeXBlcnNjcmlwdCBmdW5jdGlvbiB0byBjcmVhdGUgdmlydHVhbCBkb20gbm9kZXNcbiAgICAgKiBAZnVuY3Rpb25cbiAgICAgKi9cbiAgICBSZW5kZXJDb250ZXh0LnByb3RvdHlwZS5oID0gaDtcblxuICAgIC8qKlxuICAgICAqIFJlbmRlcnMgYSBjaGlsZCBlbnRpdHkgYXQgdGhlIGN1cnJlbnQgbG9jYXRpb24gKGl0IGFjdHVhbGx5IGNyZWF0ZXMgYVxuICAgICAqIHBsYWNlaG9sZGVyIGZvciB0aGF0IHZlcnkgZW50aXR5KVxuICAgICAqXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGVudGl0eUlkIFRoZSBpZCBvZiB0aGUgY2hpbGQgZW50aXR5IHRvIGJlIHJlbmRlcmVkXG4gICAgICogQHJldHVybiBWRG9tIGEgdmlydHVhbCBkb20gbm9kZSByZXByZXNlbnRpbmcgdGhlIGNoaWxkIGVudGl0eVxuICAgICAqL1xuICAgIFJlbmRlckNvbnRleHQucHJvdG90eXBlLnBsYWNlaG9sZGVyID0gZnVuY3Rpb24gcGxhY2Vob2xkZXIoZW50aXR5SWQpIHtcbiAgICAgICAgdGhpcy5fZW50aXR5UGxhY2Vob2xkZXIgPSB0aGlzLl9lbnRpdHlQbGFjZWhvbGRlciB8fCBbXTtcbiAgICAgICAgdGhpcy5fZW50aXR5UGxhY2Vob2xkZXIucHVzaChlbnRpdHlJZCk7XG5cbiAgICAgICAgcmV0dXJuIGgoJ2RpdicsIHtpZDogZW50aXR5SWQsIGtleTogZW50aXR5SWR9KTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBSZW5kZXJzIGEgcGxhY2Vob2xkZXIgZm9yIGEgY2hpbGQgZW50aXR5IGRlZmluZWQgYnkgdGhlIGdpdmVuIGtleVxuICAgICAqXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGtleSBUaGUga2V5IG9mIHRoZSBjaGlsZCBlbnRpdHkgdG8gYmUgcmVuZGVyZWRcbiAgICAgKiBAcmV0dXJuIFZEb20gYSB2aXJ0dWFsIGRvbSBub2RlIHJlcHJlc2VudGluZyB0aGUgY2hpbGQgZW50aXR5XG4gICAgICovXG4gICAgUmVuZGVyQ29udGV4dC5wcm90b3R5cGUucmVuZGVyQ2hpbGQgPSBmdW5jdGlvbiByZW5kZXJDaGlsZChrZXkpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGxhY2Vob2xkZXIodGhpcy5jaGlsZHJlbltrZXldKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogUmVuZGVyZXMgYWxsIGF2YWlsYWJsZSBjaGlsZCBlbnRpdGVzXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIGFycmF5IEFuIGFycmF5IG9mIHZpcnR1YWwgZG9tIG5vZGVzXG4gICAgICovXG4gICAgUmVuZGVyQ29udGV4dC5wcm90b3R5cGUucmVuZGVyQWxsQ2hpbGRyZW4gPSBmdW5jdGlvbiByZW5kZXJBbGxDaGlsZHJlbigpIHtcbiAgICAgICAgcmV0dXJuIGVhY2godXRpbHMudmFsdWVzKHRoaXMuY2hpbGRyZW4pLCB0aGlzLnBsYWNlaG9sZGVyLCB0aGlzKSB8fCBbXTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQW4gYXBwbGljYXRpb24gbW9kdWxlIHRvIHJlbmRlciBhbGwgdmlldyBjb21wb25lbnRzXG4gICAgICogdG8gdGhlIHNjcmVlblxuICAgICAqXG4gICAgICogQGNsYXNzXG4gICAgICogQG5hbWUgYWxjaGVteS5lY3MuVkRvbVJlbmRlclN5c3RlbVxuICAgICAqL1xuICAgIHJldHVybiBjb3F1b1ZlbmVudW0oe1xuICAgICAgICAvKiogQGxlbmRzIGFsY2hlbXkuZWNzLlZEb21SZW5kZXJTeXN0ZW0ucHJvdG90eXBlICovXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBlbnRpdHkgc3RvcmFnZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcHJvcGVydHkgZW50aXRpZXNcbiAgICAgICAgICogQHR5cGUgYWxjaGVteS5lY3MuQXBvdGhlY2FyaXVzXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBlbnRpdGllczogdW5kZWZpbmVkLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBVcGRhdGVzIHRoZSBjb21wb25lbnQgc3lzdGVtICh1cGRhdGVzIGRvbSBkZXBlbmRpbmcgb24gdGhlIGN1cnJlbnRcbiAgICAgICAgICogc3RhdGUgb2YgdGhlIGVudGl0aWVzKVxuICAgICAgICAgKi9cbiAgICAgICAgdXBkYXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgcmVuZGVyQ29uZmlncyA9IHRoaXMuZW50aXRpZXMuZ2V0QWxsQ29tcG9uZW50c09mVHlwZSgndmRvbScpO1xuICAgICAgICAgICAgdmFyIHVwZGF0ZXMgPSBlYWNoKHJlbmRlckNvbmZpZ3MsIHRoaXMudXBkYXRlRW50aXR5LCB0aGlzKTtcblxuICAgICAgICAgICAgZWFjaCh1cGRhdGVzLCB0aGlzLmRyYXcsIHRoaXMpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB1cGRhdGVFbnRpdHk6IGZ1bmN0aW9uIChjZmcsIGVudGl0eUlkLCBwbGFjZWhvbGRlcikge1xuICAgICAgICAgICAgaWYgKCF0aGlzLnJlcXVpcmVzUmVuZGVyKGNmZywgZW50aXR5SWQpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgcmVuZGVyZXIgPSB0aGlzLmZpbmRSZW5kZXJlcihjZmcsIGVudGl0eUlkKTtcbiAgICAgICAgICAgIHZhciBzdGF0ZSA9IHRoaXMuZW50aXRpZXMuZ2V0Q29tcG9uZW50KGVudGl0eUlkLCAnc3RhdGUnKTtcbiAgICAgICAgICAgIHZhciBjaGlsZHJlbiA9IHRoaXMuZW50aXRpZXMuZ2V0Q29tcG9uZW50RGF0YShlbnRpdHlJZCwgJ2NoaWxkcmVuJyk7XG4gICAgICAgICAgICB2YXIgY29udGV4dCA9IG5ldyBSZW5kZXJDb250ZXh0KGVudGl0eUlkLCBzdGF0ZSwgY2ZnLnByb3BzLCBjaGlsZHJlbiwge30pO1xuXG4gICAgICAgICAgICBjZmcgPSB0aGlzLmVudGl0aWVzLnNldENvbXBvbmVudChlbnRpdHlJZCwgJ3Zkb20nLCB7XG4gICAgICAgICAgICAgICAgY3VycmVudFRyZWU6IHJlbmRlcmVyKGNvbnRleHQpLFxuICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyOiBjb250ZXh0Ll9lbnRpdHlQbGFjZWhvbGRlcixcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0aGlzLmxhc3RTdGF0ZXNbZW50aXR5SWRdID0gc3RhdGU7XG5cbiAgICAgICAgICAgIHJldHVybiBjZmc7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHJlcXVpcmVzUmVuZGVyOiBmdW5jdGlvbiAocmVuZGVyQ2ZnLCBlbnRpdHlJZCkge1xuICAgICAgICAgICAgaWYgKCFyZW5kZXJDZmcuY3VycmVudFRyZWUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGN1cnJlbnRTdGF0ZSA9IHRoaXMuZW50aXRpZXMuZ2V0Q29tcG9uZW50KGVudGl0eUlkLCAnc3RhdGUnKTtcbiAgICAgICAgICAgIHZhciBsYXN0U3RhdGUgPSB0aGlzLmxhc3RTdGF0ZXNbZW50aXR5SWRdO1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRTdGF0ZSAhPT0gbGFzdFN0YXRlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBjdXJyZW50RGVsRXYgPSB0aGlzLmVudGl0aWVzLmdldENvbXBvbmVudChlbnRpdHlJZCwgJ2RlbGVnYXRlZEV2ZW50cycpO1xuICAgICAgICAgICAgdmFyIGxhc3REZWxFdiA9IHRoaXMubGFzdERlbGVnYXRlc1tlbnRpdHlJZF07XG4gICAgICAgICAgICBpZiAoY3VycmVudERlbEV2ICE9PSBsYXN0RGVsRXYpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICBmaW5kUmVuZGVyZXI6IGZ1bmN0aW9uIChjZmcsIGVudGl0eUlkKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGNmZy5yZW5kZXJlciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBjZmcucmVuZGVyZXI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRocm93ICdDYW5ub3QgZGV0ZXJtaW5lIHJlbmRlcmVyIGZvciBlbnRpdHkgXCInICsgZW50aXR5SWQgKyAnXCIhJztcbiAgICAgICAgfSxcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgZHJhdzogZnVuY3Rpb24gKHJlbmRlckNmZywgZW50aXR5SWQpIHtcbiAgICAgICAgICAgIHZhciByb290ID0gcmVuZGVyQ2ZnLnJvb3QgfHwgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoZW50aXR5SWQpO1xuICAgICAgICAgICAgaWYgKCFyb290KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgcGF0Y2hlcyA9IGRpZmYocmVuZGVyQ2ZnLmxhc3RUcmVlIHx8IGgoKSwgcmVuZGVyQ2ZnLmN1cnJlbnRUcmVlKTtcblxuICAgICAgICAgICAgcm9vdCA9IHBhdGNoKHJvb3QsIHBhdGNoZXMpO1xuXG4gICAgICAgICAgICByZW5kZXJDZmcgPSB0aGlzLmVudGl0aWVzLnNldENvbXBvbmVudChlbnRpdHlJZCwgJ3Zkb20nLCB7XG4gICAgICAgICAgICAgICAgcm9vdDogcm9vdCxcbiAgICAgICAgICAgICAgICBsYXN0VHJlZTogcmVuZGVyQ2ZnLmN1cnJlbnRUcmVlLFxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGVhY2gocmVuZGVyQ2ZnLnBsYWNlaG9sZGVyLCB0aGlzLmRyYXdEZXBlbmRlbnRFbnRpdGllcywgdGhpcyk7XG5cbiAgICAgICAgICAgIHZhciBkZWxlZ2F0ZWRFdmVudHMgPSB0aGlzLmVudGl0aWVzLmdldENvbXBvbmVudChlbnRpdHlJZCwgJ2RlbGVnYXRlZEV2ZW50cycpO1xuICAgICAgICAgICAgaWYgKGRlbGVnYXRlZEV2ZW50cykge1xuICAgICAgICAgICAgICAgIGVhY2goZGVsZWdhdGVkRXZlbnRzLnZhbCgpLCB0aGlzLmJpbmREZWxlZ2F0ZXMsIHRoaXMsIFtyb290XSk7XG4gICAgICAgICAgICAgICAgdGhpcy5sYXN0RGVsZWdhdGVzW2VudGl0eUlkXSA9IGRlbGVnYXRlZEV2ZW50cztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgZHJhd0RlcGVuZGVudEVudGl0aWVzOiBmdW5jdGlvbiAoZW50aXR5SWQpIHtcbiAgICAgICAgICAgIHZhciByZW5kZXJDZmcgPSB0aGlzLmVudGl0aWVzLmdldENvbXBvbmVudERhdGEoZW50aXR5SWQsICd2ZG9tJyk7XG4gICAgICAgICAgICBpZiAoIXJlbmRlckNmZykge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGNoaWxkUm9vdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGVudGl0eUlkKTtcbiAgICAgICAgICAgIGlmIChjaGlsZFJvb3QgJiYgY2hpbGRSb290ICE9PSByZW5kZXJDZmcucm9vdCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZW50aXRpZXMuc2V0Q29tcG9uZW50KGVudGl0eUlkLCAndmRvbScsIHtcbiAgICAgICAgICAgICAgICAgICAgcm9vdDogY2hpbGRSb290LFxuICAgICAgICAgICAgICAgICAgICBsYXN0VHJlZTogaCgpLCAvLyBjbGVhciBjYWNoZSB0byBmb3JjZSByZS1kcmF3XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgdGhpcy5kcmF3KHJlbmRlckNmZywgZW50aXR5SWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICBiaW5kRGVsZWdhdGVzOiBmdW5jdGlvbiAoY2ZnLCBrZXksIG5vZGUpIHtcbiAgICAgICAgICAgIGlmIChjZmcuc2VsZWN0b3IpIHtcbiAgICAgICAgICAgICAgICBub2RlID0gbm9kZS5xdWVyeVNlbGVjdG9yKGNmZy5zZWxlY3Rvcik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNmZy5kZWxlZ2F0ZS5iaW5kKG5vZGUpO1xuICAgICAgICB9LFxuXG4gICAgfSkud2hlbkJyZXdlZChmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMubGFzdFN0YXRlcyA9IHt9O1xuICAgICAgICB0aGlzLmxhc3REZWxlZ2F0ZXMgPSB7fTtcbiAgICB9KTtcbn0oKSk7XG4iLG51bGwsIi8qIVxuICogQ3Jvc3MtQnJvd3NlciBTcGxpdCAxLjEuMVxuICogQ29weXJpZ2h0IDIwMDctMjAxMiBTdGV2ZW4gTGV2aXRoYW4gPHN0ZXZlbmxldml0aGFuLmNvbT5cbiAqIEF2YWlsYWJsZSB1bmRlciB0aGUgTUlUIExpY2Vuc2VcbiAqIEVDTUFTY3JpcHQgY29tcGxpYW50LCB1bmlmb3JtIGNyb3NzLWJyb3dzZXIgc3BsaXQgbWV0aG9kXG4gKi9cblxuLyoqXG4gKiBTcGxpdHMgYSBzdHJpbmcgaW50byBhbiBhcnJheSBvZiBzdHJpbmdzIHVzaW5nIGEgcmVnZXggb3Igc3RyaW5nIHNlcGFyYXRvci4gTWF0Y2hlcyBvZiB0aGVcbiAqIHNlcGFyYXRvciBhcmUgbm90IGluY2x1ZGVkIGluIHRoZSByZXN1bHQgYXJyYXkuIEhvd2V2ZXIsIGlmIGBzZXBhcmF0b3JgIGlzIGEgcmVnZXggdGhhdCBjb250YWluc1xuICogY2FwdHVyaW5nIGdyb3VwcywgYmFja3JlZmVyZW5jZXMgYXJlIHNwbGljZWQgaW50byB0aGUgcmVzdWx0IGVhY2ggdGltZSBgc2VwYXJhdG9yYCBpcyBtYXRjaGVkLlxuICogRml4ZXMgYnJvd3NlciBidWdzIGNvbXBhcmVkIHRvIHRoZSBuYXRpdmUgYFN0cmluZy5wcm90b3R5cGUuc3BsaXRgIGFuZCBjYW4gYmUgdXNlZCByZWxpYWJseVxuICogY3Jvc3MtYnJvd3Nlci5cbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgU3RyaW5nIHRvIHNwbGl0LlxuICogQHBhcmFtIHtSZWdFeHB8U3RyaW5nfSBzZXBhcmF0b3IgUmVnZXggb3Igc3RyaW5nIHRvIHVzZSBmb3Igc2VwYXJhdGluZyB0aGUgc3RyaW5nLlxuICogQHBhcmFtIHtOdW1iZXJ9IFtsaW1pdF0gTWF4aW11bSBudW1iZXIgb2YgaXRlbXMgdG8gaW5jbHVkZSBpbiB0aGUgcmVzdWx0IGFycmF5LlxuICogQHJldHVybnMge0FycmF5fSBBcnJheSBvZiBzdWJzdHJpbmdzLlxuICogQGV4YW1wbGVcbiAqXG4gKiAvLyBCYXNpYyB1c2VcbiAqIHNwbGl0KCdhIGIgYyBkJywgJyAnKTtcbiAqIC8vIC0+IFsnYScsICdiJywgJ2MnLCAnZCddXG4gKlxuICogLy8gV2l0aCBsaW1pdFxuICogc3BsaXQoJ2EgYiBjIGQnLCAnICcsIDIpO1xuICogLy8gLT4gWydhJywgJ2InXVxuICpcbiAqIC8vIEJhY2tyZWZlcmVuY2VzIGluIHJlc3VsdCBhcnJheVxuICogc3BsaXQoJy4ud29yZDEgd29yZDIuLicsIC8oW2Etel0rKShcXGQrKS9pKTtcbiAqIC8vIC0+IFsnLi4nLCAnd29yZCcsICcxJywgJyAnLCAnd29yZCcsICcyJywgJy4uJ11cbiAqL1xubW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gc3BsaXQodW5kZWYpIHtcblxuICB2YXIgbmF0aXZlU3BsaXQgPSBTdHJpbmcucHJvdG90eXBlLnNwbGl0LFxuICAgIGNvbXBsaWFudEV4ZWNOcGNnID0gLygpPz8vLmV4ZWMoXCJcIilbMV0gPT09IHVuZGVmLFxuICAgIC8vIE5QQ0c6IG5vbnBhcnRpY2lwYXRpbmcgY2FwdHVyaW5nIGdyb3VwXG4gICAgc2VsZjtcblxuICBzZWxmID0gZnVuY3Rpb24oc3RyLCBzZXBhcmF0b3IsIGxpbWl0KSB7XG4gICAgLy8gSWYgYHNlcGFyYXRvcmAgaXMgbm90IGEgcmVnZXgsIHVzZSBgbmF0aXZlU3BsaXRgXG4gICAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChzZXBhcmF0b3IpICE9PSBcIltvYmplY3QgUmVnRXhwXVwiKSB7XG4gICAgICByZXR1cm4gbmF0aXZlU3BsaXQuY2FsbChzdHIsIHNlcGFyYXRvciwgbGltaXQpO1xuICAgIH1cbiAgICB2YXIgb3V0cHV0ID0gW10sXG4gICAgICBmbGFncyA9IChzZXBhcmF0b3IuaWdub3JlQ2FzZSA/IFwiaVwiIDogXCJcIikgKyAoc2VwYXJhdG9yLm11bHRpbGluZSA/IFwibVwiIDogXCJcIikgKyAoc2VwYXJhdG9yLmV4dGVuZGVkID8gXCJ4XCIgOiBcIlwiKSArIC8vIFByb3Bvc2VkIGZvciBFUzZcbiAgICAgIChzZXBhcmF0b3Iuc3RpY2t5ID8gXCJ5XCIgOiBcIlwiKSxcbiAgICAgIC8vIEZpcmVmb3ggMytcbiAgICAgIGxhc3RMYXN0SW5kZXggPSAwLFxuICAgICAgLy8gTWFrZSBgZ2xvYmFsYCBhbmQgYXZvaWQgYGxhc3RJbmRleGAgaXNzdWVzIGJ5IHdvcmtpbmcgd2l0aCBhIGNvcHlcbiAgICAgIHNlcGFyYXRvciA9IG5ldyBSZWdFeHAoc2VwYXJhdG9yLnNvdXJjZSwgZmxhZ3MgKyBcImdcIiksXG4gICAgICBzZXBhcmF0b3IyLCBtYXRjaCwgbGFzdEluZGV4LCBsYXN0TGVuZ3RoO1xuICAgIHN0ciArPSBcIlwiOyAvLyBUeXBlLWNvbnZlcnRcbiAgICBpZiAoIWNvbXBsaWFudEV4ZWNOcGNnKSB7XG4gICAgICAvLyBEb2Vzbid0IG5lZWQgZmxhZ3MgZ3ksIGJ1dCB0aGV5IGRvbid0IGh1cnRcbiAgICAgIHNlcGFyYXRvcjIgPSBuZXcgUmVnRXhwKFwiXlwiICsgc2VwYXJhdG9yLnNvdXJjZSArIFwiJCg/IVxcXFxzKVwiLCBmbGFncyk7XG4gICAgfVxuICAgIC8qIFZhbHVlcyBmb3IgYGxpbWl0YCwgcGVyIHRoZSBzcGVjOlxuICAgICAqIElmIHVuZGVmaW5lZDogNDI5NDk2NzI5NSAvLyBNYXRoLnBvdygyLCAzMikgLSAxXG4gICAgICogSWYgMCwgSW5maW5pdHksIG9yIE5hTjogMFxuICAgICAqIElmIHBvc2l0aXZlIG51bWJlcjogbGltaXQgPSBNYXRoLmZsb29yKGxpbWl0KTsgaWYgKGxpbWl0ID4gNDI5NDk2NzI5NSkgbGltaXQgLT0gNDI5NDk2NzI5NjtcbiAgICAgKiBJZiBuZWdhdGl2ZSBudW1iZXI6IDQyOTQ5NjcyOTYgLSBNYXRoLmZsb29yKE1hdGguYWJzKGxpbWl0KSlcbiAgICAgKiBJZiBvdGhlcjogVHlwZS1jb252ZXJ0LCB0aGVuIHVzZSB0aGUgYWJvdmUgcnVsZXNcbiAgICAgKi9cbiAgICBsaW1pdCA9IGxpbWl0ID09PSB1bmRlZiA/IC0xID4+PiAwIDogLy8gTWF0aC5wb3coMiwgMzIpIC0gMVxuICAgIGxpbWl0ID4+PiAwOyAvLyBUb1VpbnQzMihsaW1pdClcbiAgICB3aGlsZSAobWF0Y2ggPSBzZXBhcmF0b3IuZXhlYyhzdHIpKSB7XG4gICAgICAvLyBgc2VwYXJhdG9yLmxhc3RJbmRleGAgaXMgbm90IHJlbGlhYmxlIGNyb3NzLWJyb3dzZXJcbiAgICAgIGxhc3RJbmRleCA9IG1hdGNoLmluZGV4ICsgbWF0Y2hbMF0ubGVuZ3RoO1xuICAgICAgaWYgKGxhc3RJbmRleCA+IGxhc3RMYXN0SW5kZXgpIHtcbiAgICAgICAgb3V0cHV0LnB1c2goc3RyLnNsaWNlKGxhc3RMYXN0SW5kZXgsIG1hdGNoLmluZGV4KSk7XG4gICAgICAgIC8vIEZpeCBicm93c2VycyB3aG9zZSBgZXhlY2AgbWV0aG9kcyBkb24ndCBjb25zaXN0ZW50bHkgcmV0dXJuIGB1bmRlZmluZWRgIGZvclxuICAgICAgICAvLyBub25wYXJ0aWNpcGF0aW5nIGNhcHR1cmluZyBncm91cHNcbiAgICAgICAgaWYgKCFjb21wbGlhbnRFeGVjTnBjZyAmJiBtYXRjaC5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgbWF0Y2hbMF0ucmVwbGFjZShzZXBhcmF0b3IyLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aCAtIDI7IGkrKykge1xuICAgICAgICAgICAgICBpZiAoYXJndW1lbnRzW2ldID09PSB1bmRlZikge1xuICAgICAgICAgICAgICAgIG1hdGNoW2ldID0gdW5kZWY7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWF0Y2gubGVuZ3RoID4gMSAmJiBtYXRjaC5pbmRleCA8IHN0ci5sZW5ndGgpIHtcbiAgICAgICAgICBBcnJheS5wcm90b3R5cGUucHVzaC5hcHBseShvdXRwdXQsIG1hdGNoLnNsaWNlKDEpKTtcbiAgICAgICAgfVxuICAgICAgICBsYXN0TGVuZ3RoID0gbWF0Y2hbMF0ubGVuZ3RoO1xuICAgICAgICBsYXN0TGFzdEluZGV4ID0gbGFzdEluZGV4O1xuICAgICAgICBpZiAob3V0cHV0Lmxlbmd0aCA+PSBsaW1pdCkge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoc2VwYXJhdG9yLmxhc3RJbmRleCA9PT0gbWF0Y2guaW5kZXgpIHtcbiAgICAgICAgc2VwYXJhdG9yLmxhc3RJbmRleCsrOyAvLyBBdm9pZCBhbiBpbmZpbml0ZSBsb29wXG4gICAgICB9XG4gICAgfVxuICAgIGlmIChsYXN0TGFzdEluZGV4ID09PSBzdHIubGVuZ3RoKSB7XG4gICAgICBpZiAobGFzdExlbmd0aCB8fCAhc2VwYXJhdG9yLnRlc3QoXCJcIikpIHtcbiAgICAgICAgb3V0cHV0LnB1c2goXCJcIik7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIG91dHB1dC5wdXNoKHN0ci5zbGljZShsYXN0TGFzdEluZGV4KSk7XG4gICAgfVxuICAgIHJldHVybiBvdXRwdXQubGVuZ3RoID4gbGltaXQgPyBvdXRwdXQuc2xpY2UoMCwgbGltaXQpIDogb3V0cHV0O1xuICB9O1xuXG4gIHJldHVybiBzZWxmO1xufSkoKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgZWFjaCA9IHJlcXVpcmUoJ3Byby1zaW5ndWxpcycpO1xuICAgIHZhciBkZWxlZ2F0ZSA9IHJlcXVpcmUoJ2RlbGlnYXJlJyk7XG5cbiAgICAvKipcbiAgICAgKiBAY2xhc3MgRm9ybXVsYVxuICAgICAqL1xuICAgIHZhciBGb3JtdWxhID0gZnVuY3Rpb24gKGNmZykge1xuICAgICAgICB2YXIgb3JnQ3RvciA9IGNmZy5iYXNlLmNvbnN0cnVjdG9yO1xuICAgICAgICB2YXIgaW5pdCA9IGRlbGVnYXRlKGVhY2gsIFtjZmcub25CcmV3U2NyaXB0cywgY2FsbEZuXSk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEEgbGlzdCBvZiBjYWxsYmFjayBmdW5jdGlvbnMgd2hpY2ggc2hvdWxkIGJlIGNhbGxlZFxuICAgICAgICAgKiB3aGVuIGJyZXdpbmcgYSBuZXcgcG90aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEBuYW1lIG9uQnJld1NjcmlwdHNcbiAgICAgICAgICogQG1lbWJlck9mIEZvcm11bGFcbiAgICAgICAgICogQHR5cGUgQXJyYXlcbiAgICAgICAgICogQHByb3BlcnR5XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm9uQnJld1NjcmlwdHMgPSBjZmcub25CcmV3U2NyaXB0cztcblxuICAgICAgICAvKipcbiAgICAgICAgICogQSBsaXN0IG9mIGNhbGxiYWNrIGZ1bmN0aW9ucyB3aGljaCBzaG91bGQgYmUgY2FsbGVkXG4gICAgICAgICAqIHdoZW4gZGlzcG9zaW5nIHRoZSBwb3Rpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQG5hbWUgb25EaXNwb3NlU2NyaXB0c1xuICAgICAgICAgKiBAbWVtYmVyT2YgRm9ybXVsYVxuICAgICAgICAgKiBAdHlwZSBBcnJheVxuICAgICAgICAgKiBAcHJvcGVydHlcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMub25EaXNwb3NlU2NyaXB0cyA9IGNmZy5vbkRpc3Bvc2VTY3JpcHRzO1xuXG4gICAgICAgIHRoaXMuQ3RvciA9IGZ1bmN0aW9uIChhcmdzKSB7XG4gICAgICAgICAgICBvcmdDdG9yLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICAgICAgaW5pdCh0aGlzKTtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5DdG9yLnByb3RvdHlwZSA9IGNmZy5iYXNlO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgbmV3IGluc3RhbmNlIG9mIHRoZSBmb3JtdWxhJ3MgcHJvdG90eXBlXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdHxGdW5jdGlvbn0gW292ZXJyaWRlc10gT3B0aW9uYWwuIEEgc2V0IG9mIHByb3BlcnRpZXMvb3ZlcnJpZGVzXG4gICAgICogICAgICBmb3IgdGhlIG5ldyBpbnN0YW5jZVxuICAgICAqIEBwYXJhbSB7QXJyYXl9IFthcmdzXSBPcHRpb25hbC4gQW4gYXJyYXkgd2l0aCBjb25zdHJ1Y3RvciBhcmd1bWVudHNcbiAgICAgKiBAcmV0dXJuIHtPYmplY3R9IFRoZSBwb3Rpb24gKGkuZS4gdGhlIG5ldyBpbnN0YW5jZSBvZiB0aGUgZm9ybXVsYSdzIHByb3RvdHlwZSlcbiAgICAgKi9cbiAgICBGb3JtdWxhLnByb3RvdHlwZS5icmV3ID0gZnVuY3Rpb24gYnJldyhvdmVycmlkZXMsIGFyZ3MpIHtcbiAgICAgICAgdmFyIHBvdGlvbiA9IG5ldyB0aGlzLkN0b3IoYXJncyk7XG4gICAgICAgIHZhciBmb3JlaWduUHJvcHMgPSBPYmplY3Qua2V5cyhvdmVycmlkZXMgfHwge30pO1xuICAgICAgICB2YXIgb25EaXNwb3NlID0gZGVsZWdhdGUoZWFjaCwgW3RoaXMub25EaXNwb3NlU2NyaXB0cywgY2FsbEZuXSk7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBvdmVycmlkZXMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIG92ZXJyaWRlcyA9IG92ZXJyaWRlcyh0aGlzLkN0b3IucHJvdG90eXBlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHBvdGlvbi5kaXNwb3NlID0gY3JlYXRlRGlzcG9zZUZuKGZvcmVpZ25Qcm9wcywgb25EaXNwb3NlKTtcbiAgICAgICAgcG90aW9uID0gb3ZlcnJpZGUocG90aW9uLCBvdmVycmlkZXMpO1xuXG4gICAgICAgIHJldHVybiBwb3Rpb247XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEFkZHMgYSBjYWxsYmFjayBmdW5jdGlvbnMgd2hpY2ggc2hvdWxkIGJlIGNhbGxlZFxuICAgICAqIHdoZW4gYnJld2luZyBhIG5ldyBwb3Rpb24uIFRoZSBmdW5jdGlvbiBpcyBleGVjdXRlZFxuICAgICAqIGluIHRoZSBjb250ZXh0IG9mIHRoZSBuZXcgb2JqZWN0XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gZm4gVGhlIGNhbGxiYWNrIGZ1bmN0aW9uXG4gICAgICogQHJldHVybiB7Rm9ybXVsYX0gVGhlIG5ldyBmb3JtdWxhXG4gICAgICovXG4gICAgRm9ybXVsYS5wcm90b3R5cGUud2hlbkJyZXdlZCA9IGZ1bmN0aW9uIHdoZW5CcmV3ZWQoZm4pIHtcbiAgICAgICAgcmV0dXJuIG5ldyBGb3JtdWxhKHtcbiAgICAgICAgICAgIGJhc2U6IHRoaXMuQ3Rvci5wcm90b3R5cGUsXG4gICAgICAgICAgICBvbkJyZXdTY3JpcHRzOiB0aGlzLm9uQnJld1NjcmlwdHMuY29uY2F0KGZuKSxcbiAgICAgICAgICAgIG9uRGlzcG9zZVNjcmlwdHM6IHRoaXMub25EaXNwb3NlU2NyaXB0cyxcbiAgICAgICAgfSk7XG4gICAgfTtcblxuXG4gICAgLyoqXG4gICAgICogQWRkcyBhIGNhbGxiYWNrIGZ1bmN0aW9ucyB3aGljaCBzaG91bGQgYmUgY2FsbGVkXG4gICAgICogd2hlbiB3aGVuIGRpc3Bvc2luZyB0aGUgcG90aW9uLiBUaGUgZnVuY3Rpb24gaXNcbiAgICAgKiBleGVjdXRlZCBpbiB0aGUgY29udGV4dCBvZiB0aGUgZGlzcG9zZWQgb2JqZWN0XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gZm4gVGhlIGNhbGxiYWNrIGZ1bmN0aW9uXG4gICAgICogQHJldHVybiB7Rm9ybXVsYX0gVGhlIG5ldyBmb3JtdWxhXG4gICAgICovXG4gICAgRm9ybXVsYS5wcm90b3R5cGUud2hlbkRpc3Bvc2VkID0gZnVuY3Rpb24gd2hlbkRpc3Bvc2VkKGZuKSB7XG4gICAgICAgIHJldHVybiBuZXcgRm9ybXVsYSh7XG4gICAgICAgICAgICBiYXNlOiB0aGlzLkN0b3IucHJvdG90eXBlLFxuICAgICAgICAgICAgb25CcmV3U2NyaXB0czogdGhpcy5vbkJyZXdTY3JpcHRzLFxuICAgICAgICAgICAgb25EaXNwb3NlU2NyaXB0czogdGhpcy5vbkRpc3Bvc2VTY3JpcHRzLmNvbmNhdChmbiksXG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBBbGxvd3Mgb3ZlcnJpZGluZyBtZXRob2RzIGFuZCBwcm9wZXJ0aWVzIG9mIGFuIGN1cnJlbnQgYmFzZSBvYmplY3QuXG4gICAgICogRm9yIGV4YW1wbGU6XG4gICAgICogPHByZT48Y29kZT5cbiAgICAgKiB2YXIgbmV3Rm9ybXVsYSA9IGZvcm11bGEuZXh0ZW5kKHtcbiAgICAgKiAgIGZvbzogZnVuY3Rpb24gKCkgeyAuLi4gfSxcbiAgICAgKiAgIC4uLlxuICAgICAqIH0pO1xuICAgICAqIDwvY29kZT48L3ByZT5cbiAgICAgKiBAZnVuY3Rpb25cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvdmVycmlkZXMgVGhlIHNldCBvZiBuZXcgbWV0aG9kcyBhbmQgYXR0cmlidXRlc1xuICAgICAqIEByZXR1cm4ge0Zvcm11bGF9IFRoZSBuZXcgYW5kIGV4dGVuZGVkIHBvdGlvbiBmb3JtdWxhXG4gICAgICovXG4gICAgRm9ybXVsYS5wcm90b3R5cGUuZXh0ZW5kID0gZnVuY3Rpb24gKG92ZXJyaWRlcykge1xuICAgICAgICBpZiAodHlwZW9mIG92ZXJyaWRlcyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgb3ZlcnJpZGVzID0gb3ZlcnJpZGVzKHRoaXMuQ3Rvci5wcm90b3R5cGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5ldyBGb3JtdWxhKHtcbiAgICAgICAgICAgIGJhc2U6IG92ZXJyaWRlKE9iamVjdC5jcmVhdGUodGhpcy5DdG9yLnByb3RvdHlwZSksIG92ZXJyaWRlcyksXG4gICAgICAgICAgICBvbkJyZXdTY3JpcHRzOiB0aGlzLm9uQnJld1NjcmlwdHMsXG4gICAgICAgICAgICBvbkRpc3Bvc2VTY3JpcHRzOiB0aGlzLm9uRGlzcG9zZVNjcmlwdHMsXG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAgICAvLyBQUklWQVRFIEhFTFBFUlxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgZnVuY3Rpb24gb3ZlcnJpZGUoYmFzZSwgb3ZlcnJpZGVzKSB7XG4gICAgICAgIGVhY2gob3ZlcnJpZGVzLCBmdW5jdGlvbiAocHJvcCwga2V5KSB7XG4gICAgICAgICAgICBiYXNlW2tleV0gPSBwcm9wO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gYmFzZTtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBmdW5jdGlvbiBjYWxsRm4oZm4pIHtcbiAgICAgICAgLyoganNoaW50IHZhbGlkdGhpczogdHJ1ZSAqL1xuICAgICAgICBmbi5jYWxsKHRoaXMpO1xuICAgICAgICAvKiBqc2hpbnQgdmFsaWR0aGlzOiBmYWxzZSAqL1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIGZ1bmN0aW9uIGNyZWF0ZURpc3Bvc2VGbihmb3JlaWduUHJvcHMsIG9uRGlzcG9zZSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gZGlzcG9zZSgpIHtcbiAgICAgICAgICAgIG9uRGlzcG9zZSh0aGlzKTtcblxuICAgICAgICAgICAgZWFjaChmb3JlaWduUHJvcHMsIGZ1bmN0aW9uIChwcm9wKSB7XG4gICAgICAgICAgICAgICAgdGhpc1twcm9wXSA9IG51bGw7XG4gICAgICAgICAgICB9LCB0aGlzKTtcblxuICAgICAgICAgICAgZm9yICh2YXIga2V5IGluIHRoaXMpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpc1trZXldICYmIHR5cGVvZiB0aGlzW2tleV0gPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpc1trZXldLmRpc3Bvc2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXNba2V5XS5kaXNwb3NlKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB0aGlzW2tleV0gPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBXcmFwcyB0aGUgZ2l2ZSB2YWx1ZSBpbiBhIHBvdGlvbiBmb3JtdWxhIHRvIGFsbG93IGZ1cnRoZXIgbWFnaWNcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBiYXNlIFRoZSBvcmlnaW5hbCBiYXNpYyBwcm90b3R5cGVcbiAgICAgKiBAcmV0dXJuIHtGb3JtdWxhfSB0aGUgd3JhcHBlciBmb3JtdWxhXG4gICAgICovXG4gICAgcmV0dXJuIGZ1bmN0aW9uIGNvcXVvVmVuZW51bShiYXNlKSB7XG4gICAgICAgIGlmIChiYXNlID09PSBudWxsIHx8IHR5cGVvZiBiYXNlICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgdGhyb3cgJ0Jhc2UgaGFzdCBiZSBhbiBvYmplY3QsIFwiJyArIGJhc2UgKyAnXCIgZ2l2ZW4nO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5ldyBGb3JtdWxhKHtcbiAgICAgICAgICAgIGJhc2U6IE9iamVjdC5jcmVhdGUoYmFzZSksXG4gICAgICAgICAgICBvbkJyZXdTY3JpcHRzOiBbXSxcbiAgICAgICAgICAgIG9uRGlzcG9zZVNjcmlwdHM6IFtdLFxuICAgICAgICB9KTtcbiAgICB9O1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIHRoZSBib3VuZCB3cmFwcGVyIGZ1bmN0aW9uXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIDxwcmU+PGNvZGU+XG4gICAgICogdmFyIGFkZCA9IGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICogICAgIHJldHVybiBhICsgYjtcbiAgICAgKiB9O1xuICAgICAqXG4gICAgICogdmFyIHN1YiA9IGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICogICAgIHJldHVybiBhIC0gYjtcbiAgICAgKiB9O1xuICAgICAqXG4gICAgICogdmFyIGFkZE9uZSA9IGRlbGlnYXJlKGFkZCwgWzFdKTtcbiAgICAgKiB2YXIgc3ViVHdvID0gZGVsaWdhcmUoc3ViLCBbdW5kZWZpbmVkLCAyXSk7XG4gICAgICpcbiAgICAgKiBhZGRPbmUoNSk7IC8vIC0+IDYgKGVxdWl2YWxlbnQgdG8gXCJhZGQoMSwgNSlcIilcbiAgICAgKiBzdWJUd28oNSk7IC8vIC0+IDMgKGVxdWl2YWxlbnQgdG8gXCJzdWIoNSwgMilcIilcbiAgICAgKiA8L2NvZGU+PC9wcmU+XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmbiBSZXF1aXJlZC4gVGhlIG9yaWdpbmFsIGZ1bmN0aW9uXG4gICAgICogQHBhcmFtIHtBcnJheX0gZGVsZWdhdGVWYWx1ZXMgUmVxdWlyZWQuIFRoZSBsaXN0IG9mIHBhcmFtZXRlciB2YWx1ZXMgd2hpY2hcbiAgICAgKiAgICAgIHNob3VsZCBiZSBib3VuZCB0byB0aGUgbmV3IGZ1bmN0aW9uLiBJdCBpcyBwb3NzaWJsZSB0byBza2lwIHBhcmFtZXRlclxuICAgICAqICAgICAgd2hlbiBwYXNzaW5nIFwidW5kZWZpbmVkXCIgKGUuZy4gZGVsaWdhcmUoZm4sIFt1bmRlZmluZWQsICdmb28nXSlcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW3Njb3BlXSBPcHRpb25hbC4gVGhlIGV4ZWN1dGlvbiBjb250ZXh0IGZvciB0aGUgYm91bmQgd3JhcHBlclxuICAgICAqXG4gICAgICogQHJldHVybiB7RnVuY3Rpb259IFRoZSBib3VuZCB3cmFwcGVyIGZ1bmN0aW9uXG4gICAgICovXG4gICAgcmV0dXJuIGZ1bmN0aW9uIGRlbGlnYXJlIChmbiwgZGVsZWdhdGVWYWx1ZXMsIHNjb3BlKSB7XG4gICAgICAgIGlmICh0eXBlb2YgZm4gIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHRocm93ICdJbnZhbGlkIDFzdCBhcmd1bWVudDogXCInICsgdHlwZW9mIGZuICsgJ1wiLCBmdW5jdGlvbiBleHBlY3RlZCEnO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KGRlbGVnYXRlVmFsdWVzKSkge1xuICAgICAgICAgICAgdGhyb3cgJ0ludmFsaWQgMm5kIGFyZ3VtZW50OiBcIicgKyB0eXBlb2YgZGVsZWdhdGVWYWx1ZXMgKyAnXCIsIGFycmF5IGV4cGVjdGVkISc7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgYXJpdHkgPSBmbi5hcml0eSA+PSAwID8gZm4uYXJpdHkgOiBmbi5sZW5ndGg7XG4gICAgICAgIHZhciBtYXAgPSBbXTtcbiAgICAgICAgdmFyIGlkeCA9IDA7XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBhcml0eTsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgdmFyIHZhbCA9IGRlbGVnYXRlVmFsdWVzW2ldO1xuXG4gICAgICAgICAgICBpZiAodmFsID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBtYXBbaV0gPSBpZHgrKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHZhciB3cmFwcGVyID0gZnVuY3Rpb24gZGVsZWdhcmVXcmFwcGVyKCkge1xuICAgICAgICAgICAgdmFyIGFyZ3MgPSBbXTtcblxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBhcml0eTsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciB2YWwgPSBkZWxlZ2F0ZVZhbHVlc1tpXTtcblxuICAgICAgICAgICAgICAgIGlmICh2YWwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBhcmdzW2ldID0gYXJndW1lbnRzW21hcFtpXV07XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgYXJnc1tpXSA9IHZhbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBmbi5hcHBseShzY29wZSB8fCB0aGlzLCBhcmdzKTtcbiAgICAgICAgfTtcblxuICAgICAgICB3cmFwcGVyLmFyaXR5ID0gYXJpdHk7XG5cbiAgICAgICAgcmV0dXJuIHdyYXBwZXI7XG4gICAgfTtcbn0oKSk7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBPbmVWZXJzaW9uQ29uc3RyYWludCA9IHJlcXVpcmUoJ2luZGl2aWR1YWwvb25lLXZlcnNpb24nKTtcblxudmFyIE1ZX1ZFUlNJT04gPSAnNyc7XG5PbmVWZXJzaW9uQ29uc3RyYWludCgnZXYtc3RvcmUnLCBNWV9WRVJTSU9OKTtcblxudmFyIGhhc2hLZXkgPSAnX19FVl9TVE9SRV9LRVlAJyArIE1ZX1ZFUlNJT047XG5cbm1vZHVsZS5leHBvcnRzID0gRXZTdG9yZTtcblxuZnVuY3Rpb24gRXZTdG9yZShlbGVtKSB7XG4gICAgdmFyIGhhc2ggPSBlbGVtW2hhc2hLZXldO1xuXG4gICAgaWYgKCFoYXNoKSB7XG4gICAgICAgIGhhc2ggPSBlbGVtW2hhc2hLZXldID0ge307XG4gICAgfVxuXG4gICAgcmV0dXJuIGhhc2g7XG59XG4iLCJ2YXIgdG9wTGV2ZWwgPSB0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJyA/IGdsb2JhbCA6XG4gICAgdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cgOiB7fVxudmFyIG1pbkRvYyA9IHJlcXVpcmUoJ21pbi1kb2N1bWVudCcpO1xuXG5pZiAodHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJykge1xuICAgIG1vZHVsZS5leHBvcnRzID0gZG9jdW1lbnQ7XG59IGVsc2Uge1xuICAgIHZhciBkb2NjeSA9IHRvcExldmVsWydfX0dMT0JBTF9ET0NVTUVOVF9DQUNIRUA0J107XG5cbiAgICBpZiAoIWRvY2N5KSB7XG4gICAgICAgIGRvY2N5ID0gdG9wTGV2ZWxbJ19fR0xPQkFMX0RPQ1VNRU5UX0NBQ0hFQDQnXSA9IG1pbkRvYztcbiAgICB9XG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGRvY2N5O1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciB1dWlkID0gJzUyYmU1Mzk1LWExODItNDZkZC1iNTE4LTA5MWExYzQ3NmE2Myc7XG4gICAgdmFyIGVhY2ggPSByZXF1aXJlKCdwcm8tc2luZ3VsaXMnKTtcblxuICAgIC8qKlxuICAgICAqIEhlbHBlciB0byBkZXRlcm1pbmUgaWYgYSBnaXZlbiBvYmplY3QgaXMgYW4gaW1tdXRhYmxlXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBpc0ltbXV0YWJsZShvYmopIHtcbiAgICAgICAgcmV0dXJuIG9iaiAmJiAob2JqLnR5cGVJZCA9PT0gdXVpZCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNPYmplY3Qobykge1xuICAgICAgICByZXR1cm4gbyAmJiAodHlwZW9mIG8gPT09ICdvYmplY3QnKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpc0FycmF5KGEpIHtcbiAgICAgICAgcmV0dXJuIEFycmF5LmlzQXJyYXkoYSk7XG4gICAgfVxuXG5cbiAgICBmdW5jdGlvbiBjb3B5VG8gKGJhc2UsIG5leHQpIHtcbiAgICAgICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhuZXh0KTtcblxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGtleXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIga2V5ID0ga2V5c1tpXTtcbiAgICAgICAgICAgIGJhc2Vba2V5XSA9IG5leHRba2V5XTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBiYXNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEhlbHBlciB0byBjcmVhdGUgYW4gaW1tdXRhYmxlIGRhdGEgb2JqZWN0IGRlcGVuZGluZyBvbiB0aGUgdHlwZSBvZiB0aGUgaW5wdXRcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGNyZWF0ZVN1Yih2YWx1ZSwgY29tcHV0ZWQpIHtcbiAgICAgICAgaWYgKGlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IExpc3QodmFsdWUsIGNvbXB1dGVkKTtcbiAgICAgICAgfSBlbHNlIGlmIChpc09iamVjdCh2YWx1ZSkpIHtcbiAgICAgICAgICAgIGlmIChpc0ltbXV0YWJsZSh2YWx1ZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHZhbHVlLmNvbnN0cnVjdG9yID09PSBPYmplY3QpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFN0cnVjdCh2YWx1ZSwgY29tcHV0ZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG5ldyBWYWx1ZSh2YWx1ZSwgY29tcHV0ZWQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXcgVmFsdWUodmFsdWUsIGNvbXB1dGVkKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYWJzdHJhY3QgYmFzZSBjbGFzcyBmb3IgaW1tdXRhYmxlIHZhbHVlc1xuICAgICAqXG4gICAgICogQGNsYXNzIEFic3RyYWN0XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBBYnN0cmFjdCh2YWx1ZSwgZGF0YSwgY29tcHV0ZWQpIHtcbiAgICAgICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICAgICAgICB0aGlzLmRhdGEgPSBkYXRhICYmIGVhY2goZGF0YSwgZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgICAgICAgIHJldHVybiBjcmVhdGVTdWIoaXRlbSk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLmNvbXB1dGVkUHJvcHMgPSBjb21wdXRlZDtcbiAgICB9XG5cbiAgICBBYnN0cmFjdC5wcm90b3R5cGUudHlwZUlkID0gdXVpZDtcblxuICAgIEFic3RyYWN0LnByb3RvdHlwZS52YWwgPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgIGlmICh0eXBlb2Yga2V5ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgdmFyIHN1YiA9IHRoaXMuc3ViKGtleSk7XG4gICAgICAgICAgICBpZiAoc3ViKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1Yi52YWwoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGZuID0gdGhpcy5jb21wdXRlZFByb3BzICYmIHRoaXMuY29tcHV0ZWRQcm9wc1trZXldO1xuICAgICAgICAgICAgaWYgKGZuKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZuLmNhbGwodGhpcywgdGhpcy52YWwoKSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMudmFsdWUgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMudmFsdWUgPSBlYWNoKHRoaXMuZGF0YSwgZnVuY3Rpb24gKHN1Yikge1xuICAgICAgICAgICAgICAgIHJldHVybiBzdWIudmFsKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy52YWx1ZTtcbiAgICB9O1xuXG4gICAgQWJzdHJhY3QucHJvdG90eXBlLnNldCA9IHVuZGVmaW5lZDsgLy8gYWJzdGFjdFxuXG4gICAgQWJzdHJhY3QucHJvdG90eXBlLnN1YiA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgcmV0dXJuICh0aGlzLmRhdGEgJiYgdGhpcy5kYXRhW2tleV0pIHx8IG51bGw7XG4gICAgfTtcblxuICAgIEFic3RyYWN0LnByb3RvdHlwZS5lYWNoID0gZnVuY3Rpb24gKGZuLCBzY29wZSwgbW9yZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5zZXQoZWFjaCh0aGlzLmRhdGEsIGZuLCBzY29wZSwgbW9yZSkpO1xuICAgIH07XG5cbiAgICAvKiogQHByb3RlY3RlZCAqL1xuICAgIEFic3RyYWN0LnByb3RvdHlwZS5zZXRTdWJWYWx1ZSA9IGZ1bmN0aW9uICh2YWwsIGtleSkge1xuICAgICAgICB2YXIgY3VyclZhbCA9IHRoaXMuc3ViKGtleSk7XG4gICAgICAgIGlmIChjdXJyVmFsKSB7XG4gICAgICAgICAgICAvLyB1cGRhdGUgZXhpc3Rpbmcga2V5XG4gICAgICAgICAgICB2YXIgbmV3VmFsID0gY3VyclZhbC5zZXQodmFsKTtcbiAgICAgICAgICAgIGlmIChuZXdWYWwgIT09IGN1cnJWYWwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3VmFsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gYWRkIG5ldyBrZXkvdmFsdWVcbiAgICAgICAgICAgIHJldHVybiBjcmVhdGVTdWIodmFsKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBBIHNpbXBsZSBpbW11dGFibGUgdmFsdWVcbiAgICAgKlxuICAgICAqIEBjbGFzcyBWYWx1ZVxuICAgICAqIEBleHRlbmRzIEFic3RyYWN0XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBWYWx1ZSh2YWwsIGNvbXB1dGVkKSB7XG4gICAgICAgIEFic3RyYWN0LmNhbGwodGhpcywgdmFsLCBudWxsLCBjb21wdXRlZCk7XG4gICAgfVxuICAgIFZhbHVlLnByb3RvdHlwZSA9IG5ldyBBYnN0cmFjdCgpO1xuXG4gICAgVmFsdWUucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uIF9zZXRTaW1wbGVWYWx1ZSh2YWwpIHtcbiAgICAgICAgaWYgKGlzSW1tdXRhYmxlKHZhbCkpIHtcbiAgICAgICAgICAgIHJldHVybiB2YWw7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHZhbCA9PT0gdGhpcy52YWx1ZSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ldyBWYWx1ZSh2YWwsIHRoaXMuY29tcHV0ZWRQcm9wcyk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEFuIGltbXV0YWJsZSBrZXktdmFsdWUgc3RvcmVcbiAgICAgKlxuICAgICAqIEBjbGFzcyBTdHJ1Y3RcbiAgICAgKiBAZXh0ZW5kcyBBYnN0cmFjdFxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgZnVuY3Rpb24gU3RydWN0KGRhdGEsIGNvbXB1dGVkKSB7XG4gICAgICAgIEFic3RyYWN0LmNhbGwodGhpcywgbnVsbCwgZGF0YSwgY29tcHV0ZWQpO1xuICAgIH1cbiAgICBTdHJ1Y3QucHJvdG90eXBlID0gbmV3IEFic3RyYWN0KCk7XG5cbiAgICBTdHJ1Y3QucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uIF9zZXRDb21wbGV4VmFsdWUoa2V5LCB2YWwpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBrZXkgPT09ICdzdHJpbmcnICYmIHR5cGVvZiB2YWwgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAvLyBjYWxsZWQgd2l0aCBrZXkgYW5kIHZhbHVlLCBlLmcuIC5zZXQoJ2ZvbycsICdiYXInKTtcbiAgICAgICAgICAgIHZhciBuZXdTdWIgPSB0aGlzLnNldFN1YlZhbHVlKHZhbCwga2V5KTtcbiAgICAgICAgICAgIGlmIChuZXdTdWIpIHtcbiAgICAgICAgICAgICAgICB2YXIgbmV3RGF0YSA9IGNvcHlUbyh7fSwgdGhpcy5kYXRhKTtcbiAgICAgICAgICAgICAgICBuZXdEYXRhW2tleV0gPSBuZXdTdWI7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBTdHJ1Y3QobmV3RGF0YSwgdGhpcy5jb21wdXRlZFByb3BzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzSW1tdXRhYmxlKGtleSkpIHtcbiAgICAgICAgICAgIHJldHVybiBrZXk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNBcnJheShrZXkpKSB7XG4gICAgICAgICAgICAvLyBjYWxsZWQgd2l0aCBhcnJheSwgZS5nLiAuc2V0KFsxLCAyLCAuLi5dKTtcbiAgICAgICAgICAgIHJldHVybiBuZXcgTGlzdChrZXksIHRoaXMuY29tcHV0ZWRQcm9wcyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNPYmplY3Qoa2V5KSAmJiBrZXkuY29uc3RydWN0b3IgPT09IE9iamVjdCkge1xuICAgICAgICAgICAgLy8gY2FsbGVkIHdpdGggcmF3IGpzIG9iamVjdCwgZS5nLiAuc2V0KHtmb286ICdiYXInfSk7XG4gICAgICAgICAgICB2YXIgY2hhbmdlZFN1YnMgPSBlYWNoKGtleSwgdGhpcy5zZXRTdWJWYWx1ZSwgdGhpcyk7XG4gICAgICAgICAgICBpZiAoY2hhbmdlZFN1YnMgJiYgT2JqZWN0LmtleXMoY2hhbmdlZFN1YnMpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFN0cnVjdChjb3B5VG8oY29weVRvKHt9LCB0aGlzLmRhdGEpLCBjaGFuZ2VkU3VicyksIHRoaXMuY29tcHV0ZWRQcm9wcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlb2Yga2V5ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBWYWx1ZShrZXksIHRoaXMuY29tcHV0ZWRQcm9wcyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQW4gaW1tdXRhYmxlIGxpc3QvYXJyYXlcbiAgICAgKlxuICAgICAqIEBjbGFzcyBMaXN0XG4gICAgICogQGV4dGVuZHMgQWJzdHJhY3RcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIExpc3QoZGF0YSwgY29tcHV0ZWQpIHtcbiAgICAgICAgQWJzdHJhY3QuY2FsbCh0aGlzLCBudWxsLCBkYXRhLCBjb21wdXRlZCk7XG4gICAgfVxuICAgIExpc3QucHJvdG90eXBlID0gbmV3IEFic3RyYWN0KCk7XG5cbiAgICBMaXN0LnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiAoaW5kZXgsIHZhbHVlKSB7XG4gICAgICAgIGlmICh0eXBlb2YgaW5kZXggPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAvLyBjYWxsZWQgd2l0aCBrZXkgYW5kIHZhbHVlLCBlLmcuIC5zZXQoJ2ZvbycsICdiYXInKTtcbiAgICAgICAgICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICAgICAgICAgICAgdmFyIG5ld1N1YiA9IHRoaXMuc2V0U3ViVmFsdWUodmFsdWUsIGluZGV4KTtcbiAgICAgICAgICAgICAgICBpZiAobmV3U3ViKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBuZXdEYXRhID0gW10uY29uY2F0KHRoaXMuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIG5ld0RhdGFbaW5kZXhdID0gbmV3U3ViO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3IExpc3QobmV3RGF0YSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdGhpczsgLy8gbm9uLW51bWVyaWMgaW5kZXhcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNhbGxlZCB3aXRoIHNpbmdsZSBhcmd1bWVudFxuICAgICAgICB2YWx1ZSA9IGluZGV4O1xuXG4gICAgICAgIGlmIChpc0ltbXV0YWJsZSh2YWx1ZSkpIHtcbiAgICAgICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpc0FycmF5KHZhbHVlKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMudXBkYXRlTGlzdCh2YWx1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNPYmplY3QodmFsdWUpICYmIHZhbHVlLmNvbnN0cnVjdG9yID09PSBPYmplY3QpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgU3RydWN0KHZhbHVlLCB0aGlzLmNvbXB1dGVkUHJvcHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5ldyBWYWx1ZSh2YWx1ZSwgdGhpcy5jb21wdXRlZFByb3BzKTtcbiAgICB9O1xuXG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBMaXN0LnByb3RvdHlwZS51cGRhdGVMaXN0ID0gZnVuY3Rpb24gKG5ld0RhdGEpIHtcbiAgICAgICAgdmFyIG5ld0xpc3QgPSBbXTtcbiAgICAgICAgdmFyIGNoYW5nZWQgPSBuZXdEYXRhLmxlbmd0aCAhPT0gdGhpcy5kYXRhLmxlbmd0aDtcblxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IG5ld0RhdGEubGVuZ3RoOyAgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgdmFyIG5ld1N1YkRhdGEgPSBuZXdEYXRhW2ldO1xuICAgICAgICAgICAgdmFyIG5ld1N1YiA9IHRoaXMuc2V0U3ViVmFsdWUobmV3U3ViRGF0YSwgaSk7XG5cbiAgICAgICAgICAgIGlmIChuZXdTdWIpIHtcbiAgICAgICAgICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBuZXdMaXN0LnB1c2gobmV3U3ViKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbmV3TGlzdC5wdXNoKHRoaXMuZGF0YVtpXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoYW5nZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgTGlzdChuZXdMaXN0LCB0aGlzLmNvbXB1dGVkUHJvcHMpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBUaGlzIGlzIGFuIGltbXV0YWJsZSBkYXRhIG9iamVjdFxuICAgICAqL1xuICAgIHJldHVybiB7XG4gICAgICAgIGZyb21KUzogZnVuY3Rpb24gKGRhdGEsIGNvbXB1dGVkKSB7XG4gICAgICAgICAgICByZXR1cm4gY3JlYXRlU3ViKGRhdGEsIGNvbXB1dGVkKTtcbiAgICAgICAgfSxcblxuICAgICAgICBmaW5kOiBmdW5jdGlvbiAoaW1tdXRhYmxlLCBzZWxlY3Rvcikge1xuICAgICAgICAgICAgaWYgKCFpbW11dGFibGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHR5cGVvZiBzZWxlY3RvciA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICB2YXIga2V5cyA9IHNlbGVjdG9yLnNwbGl0KCcuJyk7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBrZXlzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBpbW11dGFibGUgPSBpbW11dGFibGUuc3ViKGtleXNbaV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGltbXV0YWJsZTtcbiAgICAgICAgfVxuICAgIH07XG59KCkpO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKmdsb2JhbCB3aW5kb3csIGdsb2JhbCovXG5cbnZhciByb290ID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgP1xuICAgIHdpbmRvdyA6IHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnID9cbiAgICBnbG9iYWwgOiB7fTtcblxubW9kdWxlLmV4cG9ydHMgPSBJbmRpdmlkdWFsO1xuXG5mdW5jdGlvbiBJbmRpdmlkdWFsKGtleSwgdmFsdWUpIHtcbiAgICBpZiAoa2V5IGluIHJvb3QpIHtcbiAgICAgICAgcmV0dXJuIHJvb3Rba2V5XTtcbiAgICB9XG5cbiAgICByb290W2tleV0gPSB2YWx1ZTtcblxuICAgIHJldHVybiB2YWx1ZTtcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIEluZGl2aWR1YWwgPSByZXF1aXJlKCcuL2luZGV4LmpzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gT25lVmVyc2lvbjtcblxuZnVuY3Rpb24gT25lVmVyc2lvbihtb2R1bGVOYW1lLCB2ZXJzaW9uLCBkZWZhdWx0VmFsdWUpIHtcbiAgICB2YXIga2V5ID0gJ19fSU5ESVZJRFVBTF9PTkVfVkVSU0lPTl8nICsgbW9kdWxlTmFtZTtcbiAgICB2YXIgZW5mb3JjZUtleSA9IGtleSArICdfRU5GT1JDRV9TSU5HTEVUT04nO1xuXG4gICAgdmFyIHZlcnNpb25WYWx1ZSA9IEluZGl2aWR1YWwoZW5mb3JjZUtleSwgdmVyc2lvbik7XG5cbiAgICBpZiAodmVyc2lvblZhbHVlICE9PSB2ZXJzaW9uKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignQ2FuIG9ubHkgaGF2ZSBvbmUgY29weSBvZiAnICtcbiAgICAgICAgICAgIG1vZHVsZU5hbWUgKyAnLlxcbicgK1xuICAgICAgICAgICAgJ1lvdSBhbHJlYWR5IGhhdmUgdmVyc2lvbiAnICsgdmVyc2lvblZhbHVlICtcbiAgICAgICAgICAgICcgaW5zdGFsbGVkLlxcbicgK1xuICAgICAgICAgICAgJ1RoaXMgbWVhbnMgeW91IGNhbm5vdCBpbnN0YWxsIHZlcnNpb24gJyArIHZlcnNpb24pO1xuICAgIH1cblxuICAgIHJldHVybiBJbmRpdmlkdWFsKGtleSwgZGVmYXVsdFZhbHVlKTtcbn1cbiIsIlwidXNlIHN0cmljdFwiO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGlzT2JqZWN0KHgpIHtcblx0cmV0dXJuIHR5cGVvZiB4ID09PSBcIm9iamVjdFwiICYmIHggIT09IG51bGw7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgLyoqXG4gICAgICogSXRlcmF0ZXMgb2YgYW4gaXRlcmFibGUgb2JqZWN0IGFuZCBjYWxsIHRoZSBnaXZlbiBtZXRob2QgZm9yIGVhY2ggaXRlbVxuICAgICAqIEZvciBleGFtcGxlOlxuICAgICAqIDxwcmU+PGNvZGU+XG4gICAgICogICAgICAvLyAoYSkgZGVmYXVsdCB1c2UgY2FzZSBpdGVyYXRlIHRocm91Z2ggYW4gYXJyYXkgb3IgYW4gb2JqZWN0XG4gICAgICogICAgICBlYWNoKFsxLCAyLCAuLi4sIG5dLCBmdW5jdGlvbiBkb1N0dWZmKHZhbCkgeyAuLi4gfSk7XG4gICAgICpcbiAgICAgKiAgICAgIC8vIChiKSBtYXAgZGF0YVxuICAgICAqICAgICAgZWFjaChbMSwgMiwgM10sIGZ1bmN0aW9uIGRvdWJsZSh2YWwpIHtcbiAgICAgKiAgICAgICAgICByZXR1cm4gMiAqIHZhbDtcbiAgICAgKiAgICAgIH0pOyAvLyAtPiBbMiwgNCwgNl1cbiAgICAgKiAgICAgIGVhY2goe2ZvbzogMSwgYmFyOiAyfSwgZnVuY3Rpb24gZG91YmxlKHZhbCkge1xuICAgICAqICAgICAgICAgIHJldHVybiAyICogdmFsO1xuICAgICAqICAgICAgfSk7IC8vIC0+IHtmb286IDIsIGJhcjogNH1cbiAgICAgKlxuICAgICAqICAgICAgLy8gKGMpIGZpbHRlciBkYXRhXG4gICAgICogICAgICBlYWNoKFsxLCAyLCAzLCA0XSwgZnVuY3Rpb24gKHZhbCkge1xuICAgICAqICAgICAgICAgIHJldHVybiAodmFsICUgMiA9PT0gMCkgPyB2YWwgOiB1bmRlZmluZWQ7XG4gICAgICogICAgICB9KTsgLy8gLT4gWzIsIDRdXG4gICAgICogICAgICBlYWNoKHsgZm9vOiAxLCBiYXI6IDIsIGJhejogMywgfSwgZnVuY3Rpb24gdW5ldmVuKHZhbCkge1xuICAgICAqICAgICAgICAgIHJldHVybiAodmFsICUgMiAhPT0gMCkgPyB2YWwgOiB1bmRlZmluZWQ7XG4gICAgICogICAgICB9KTsgLy8gLT4geyBmb286IDEsIGJhejogMyB9XG4gICAgICogPC9jb2RlPjwvcHJlPlxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3QvQXJyYXl9IGl0ZXJhYmxlIFRoZSBvYmplY3QgdG8gaXRlcmF0ZSB0aHJvdWdoXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gZm4gVGhlIGNhbGxiYWNrIGZ1bmN0aW9uIHRvIGJlIGNhbGxlZCBmb3IgZWFjaCBpdGVtXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHNjb3BlIFRoZSBleGVjdXRpb24gc2NvcGUgZm9yIHRoZSBjYWxsYmFjayBmdW5jdGlvblxuICAgICAqIEBwYXJhbSB7QXJyYXl9IG1vcmUgT3B0aW9uYWw7IGFuIGFkZGlvbmFsIHNldCBvZiBhcmd1bWVudHMgd2hpY2ggd2lsbFxuICAgICAqICAgICAgYmUgcGFzc2VkIHRvIHRoZSBjYWxsYmFjayBmdW5jdGlvblxuICAgICAqIEByZXR1cm4ge09iamVjdC9BcnJheX0gVGhlIGFnZ3JlZ2F0ZWQgcmVzdWx0cyBvZiBlYWNoIGNhbGxiYWNrIChzZWUgZXhhbXBsZXMpXG4gICAgICovXG4gICAgZnVuY3Rpb24gZWFjaChpdGVyYWJsZSwgZm4sIHNjb3BlLCBtb3JlKSB7XG4gICAgICAgIHZhciBhcmdzID0gW251bGwsIG51bGxdO1xuICAgICAgICB2YXIgcmVzdWx0LCByZXN1bHRTZXQ7XG4gICAgICAgIHZhciBpLCBsO1xuXG4gICAgICAgIGlmIChtb3JlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGFyZ3MgPSBhcmdzLmNvbmNhdChtb3JlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KGl0ZXJhYmxlKSkge1xuICAgICAgICAgICAgcmVzdWx0U2V0ID0gW107XG5cbiAgICAgICAgICAgIGZvciAoaSA9IDAsIGwgPSBpdGVyYWJsZS5sZW5ndGg7IGkgPCBsOyArK2kpIHtcbiAgICAgICAgICAgICAgICBhcmdzWzBdID0gaXRlcmFibGVbaV07XG4gICAgICAgICAgICAgICAgYXJnc1sxXSA9IGk7XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gZm4uYXBwbHkoc2NvcGUsIGFyZ3MpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiByZXN1bHQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdFNldC5wdXNoKHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSBpZiAoaXRlcmFibGUgJiYgdHlwZW9mIGl0ZXJhYmxlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhpdGVyYWJsZSk7XG4gICAgICAgICAgICAvLyB1c2UgT2JqZWN0LmtleXMgKyBmb3ItbG9vcCB0byBhbGxvdyBvcHRpbWl6aW5nIGVhY2ggZm9yXG4gICAgICAgICAgICAvLyBpdGVyYXRpbmcgb3ZlciBvYmplY3RzIGluIGhhc2gtdGFibGUtbW9kZVxuXG4gICAgICAgICAgICByZXN1bHRTZXQgPSB7fTtcblxuICAgICAgICAgICAgZm9yIChpID0gMCwgbCA9IGtleXMubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgICAgICAgICAgICAgdmFyIGtleSA9IGtleXNbaV07XG5cbiAgICAgICAgICAgICAgICBhcmdzWzBdID0gaXRlcmFibGVba2V5XTtcbiAgICAgICAgICAgICAgICBhcmdzWzFdID0ga2V5O1xuICAgICAgICAgICAgICAgIHJlc3VsdCA9IGZuLmFwcGx5KHNjb3BlLCBhcmdzKTtcblxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgcmVzdWx0ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRTZXRba2V5XSA9IHJlc3VsdDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0U2V0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBmdW5jdGlvbiB3aGljaCBpcyBib3VuZCB0byBhIGdpdmVuIGNhbGxiYWNrIGFuZCBzY29wZVxuICAgICAqXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gZm4gVGhlIGNhbGxiYWNrIChzYW1lIGFzIGZvciBlYWNoIGl0c2VsZilcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gc2NvcGUgVGhlIGV4ZWN1dGlvbiBjb250ZXh0IGZvciB0aGUgY2FsbGJhY2tcbiAgICAgKiBAcmV0dXJuIEZ1bmN0aW9uIFRoZSBuZXcgaXRlcmF0b3IgZnVuY3Rpb24gd2hpY2ggZXhwZWN0cyB0aGVcbiAgICAgKiAgICAgIGl0ZXJhYmxlIGFuZCBhbiBhcnJheSBvZiBhZGRpdGlvbmFsIHBhcmFtZXRlciB3aGljaCBhcmVcbiAgICAgKiAgICAgIHBhc3NlZCB0byB0aGUgY2FsbGJhY2tcbiAgICAgKi9cbiAgICBlYWNoLnByZXBhcmUgPSBmdW5jdGlvbiAoZm4sIHNjb3BlKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoaXRlcmFibGUsIG1vcmUpIHtcbiAgICAgICAgICAgIHJldHVybiBlYWNoKGl0ZXJhYmxlLCBmbiwgc2NvcGUgfHwgdGhpcywgbW9yZSk7XG4gICAgICAgIH07XG4gICAgfTtcblxuICAgIHJldHVybiBlYWNoO1xufSgpO1xuIiwidmFyIGRpZmYgPSByZXF1aXJlKFwiLi92dHJlZS9kaWZmLmpzXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gZGlmZlxuIiwidmFyIGggPSByZXF1aXJlKFwiLi92aXJ0dWFsLWh5cGVyc2NyaXB0L2luZGV4LmpzXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gaFxuIiwidmFyIHBhdGNoID0gcmVxdWlyZShcIi4vdmRvbS9wYXRjaC5qc1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IHBhdGNoXG4iLCJ2YXIgaXNPYmplY3QgPSByZXF1aXJlKFwiaXMtb2JqZWN0XCIpXG52YXIgaXNIb29rID0gcmVxdWlyZShcIi4uL3Zub2RlL2lzLXZob29rLmpzXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gYXBwbHlQcm9wZXJ0aWVzXG5cbmZ1bmN0aW9uIGFwcGx5UHJvcGVydGllcyhub2RlLCBwcm9wcywgcHJldmlvdXMpIHtcbiAgICBmb3IgKHZhciBwcm9wTmFtZSBpbiBwcm9wcykge1xuICAgICAgICB2YXIgcHJvcFZhbHVlID0gcHJvcHNbcHJvcE5hbWVdXG5cbiAgICAgICAgaWYgKHByb3BWYWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZW1vdmVQcm9wZXJ0eShub2RlLCBwcm9wTmFtZSwgcHJvcFZhbHVlLCBwcmV2aW91cyk7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNIb29rKHByb3BWYWx1ZSkpIHtcbiAgICAgICAgICAgIHJlbW92ZVByb3BlcnR5KG5vZGUsIHByb3BOYW1lLCBwcm9wVmFsdWUsIHByZXZpb3VzKVxuICAgICAgICAgICAgaWYgKHByb3BWYWx1ZS5ob29rKSB7XG4gICAgICAgICAgICAgICAgcHJvcFZhbHVlLmhvb2sobm9kZSxcbiAgICAgICAgICAgICAgICAgICAgcHJvcE5hbWUsXG4gICAgICAgICAgICAgICAgICAgIHByZXZpb3VzID8gcHJldmlvdXNbcHJvcE5hbWVdIDogdW5kZWZpbmVkKVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKGlzT2JqZWN0KHByb3BWYWx1ZSkpIHtcbiAgICAgICAgICAgICAgICBwYXRjaE9iamVjdChub2RlLCBwcm9wcywgcHJldmlvdXMsIHByb3BOYW1lLCBwcm9wVmFsdWUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBub2RlW3Byb3BOYW1lXSA9IHByb3BWYWx1ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiByZW1vdmVQcm9wZXJ0eShub2RlLCBwcm9wTmFtZSwgcHJvcFZhbHVlLCBwcmV2aW91cykge1xuICAgIGlmIChwcmV2aW91cykge1xuICAgICAgICB2YXIgcHJldmlvdXNWYWx1ZSA9IHByZXZpb3VzW3Byb3BOYW1lXVxuXG4gICAgICAgIGlmICghaXNIb29rKHByZXZpb3VzVmFsdWUpKSB7XG4gICAgICAgICAgICBpZiAocHJvcE5hbWUgPT09IFwiYXR0cmlidXRlc1wiKSB7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgYXR0ck5hbWUgaW4gcHJldmlvdXNWYWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICBub2RlLnJlbW92ZUF0dHJpYnV0ZShhdHRyTmFtZSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHByb3BOYW1lID09PSBcInN0eWxlXCIpIHtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpIGluIHByZXZpb3VzVmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZS5zdHlsZVtpXSA9IFwiXCJcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBwcmV2aW91c1ZhbHVlID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgICAgICAgbm9kZVtwcm9wTmFtZV0gPSBcIlwiXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5vZGVbcHJvcE5hbWVdID0gbnVsbFxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHByZXZpb3VzVmFsdWUudW5ob29rKSB7XG4gICAgICAgICAgICBwcmV2aW91c1ZhbHVlLnVuaG9vayhub2RlLCBwcm9wTmFtZSwgcHJvcFZhbHVlKVxuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiBwYXRjaE9iamVjdChub2RlLCBwcm9wcywgcHJldmlvdXMsIHByb3BOYW1lLCBwcm9wVmFsdWUpIHtcbiAgICB2YXIgcHJldmlvdXNWYWx1ZSA9IHByZXZpb3VzID8gcHJldmlvdXNbcHJvcE5hbWVdIDogdW5kZWZpbmVkXG5cbiAgICAvLyBTZXQgYXR0cmlidXRlc1xuICAgIGlmIChwcm9wTmFtZSA9PT0gXCJhdHRyaWJ1dGVzXCIpIHtcbiAgICAgICAgZm9yICh2YXIgYXR0ck5hbWUgaW4gcHJvcFZhbHVlKSB7XG4gICAgICAgICAgICB2YXIgYXR0clZhbHVlID0gcHJvcFZhbHVlW2F0dHJOYW1lXVxuXG4gICAgICAgICAgICBpZiAoYXR0clZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBub2RlLnJlbW92ZUF0dHJpYnV0ZShhdHRyTmFtZSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbm9kZS5zZXRBdHRyaWJ1dGUoYXR0ck5hbWUsIGF0dHJWYWx1ZSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGlmKHByZXZpb3VzVmFsdWUgJiYgaXNPYmplY3QocHJldmlvdXNWYWx1ZSkgJiZcbiAgICAgICAgZ2V0UHJvdG90eXBlKHByZXZpb3VzVmFsdWUpICE9PSBnZXRQcm90b3R5cGUocHJvcFZhbHVlKSkge1xuICAgICAgICBub2RlW3Byb3BOYW1lXSA9IHByb3BWYWx1ZVxuICAgICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBpZiAoIWlzT2JqZWN0KG5vZGVbcHJvcE5hbWVdKSkge1xuICAgICAgICBub2RlW3Byb3BOYW1lXSA9IHt9XG4gICAgfVxuXG4gICAgdmFyIHJlcGxhY2VyID0gcHJvcE5hbWUgPT09IFwic3R5bGVcIiA/IFwiXCIgOiB1bmRlZmluZWRcblxuICAgIGZvciAodmFyIGsgaW4gcHJvcFZhbHVlKSB7XG4gICAgICAgIHZhciB2YWx1ZSA9IHByb3BWYWx1ZVtrXVxuICAgICAgICBub2RlW3Byb3BOYW1lXVtrXSA9ICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSA/IHJlcGxhY2VyIDogdmFsdWVcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGdldFByb3RvdHlwZSh2YWx1ZSkge1xuICAgIGlmIChPYmplY3QuZ2V0UHJvdG90eXBlT2YpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5nZXRQcm90b3R5cGVPZih2YWx1ZSlcbiAgICB9IGVsc2UgaWYgKHZhbHVlLl9fcHJvdG9fXykge1xuICAgICAgICByZXR1cm4gdmFsdWUuX19wcm90b19fXG4gICAgfSBlbHNlIGlmICh2YWx1ZS5jb25zdHJ1Y3Rvcikge1xuICAgICAgICByZXR1cm4gdmFsdWUuY29uc3RydWN0b3IucHJvdG90eXBlXG4gICAgfVxufVxuIiwidmFyIGRvY3VtZW50ID0gcmVxdWlyZShcImdsb2JhbC9kb2N1bWVudFwiKVxuXG52YXIgYXBwbHlQcm9wZXJ0aWVzID0gcmVxdWlyZShcIi4vYXBwbHktcHJvcGVydGllc1wiKVxuXG52YXIgaXNWTm9kZSA9IHJlcXVpcmUoXCIuLi92bm9kZS9pcy12bm9kZS5qc1wiKVxudmFyIGlzVlRleHQgPSByZXF1aXJlKFwiLi4vdm5vZGUvaXMtdnRleHQuanNcIilcbnZhciBpc1dpZGdldCA9IHJlcXVpcmUoXCIuLi92bm9kZS9pcy13aWRnZXQuanNcIilcbnZhciBoYW5kbGVUaHVuayA9IHJlcXVpcmUoXCIuLi92bm9kZS9oYW5kbGUtdGh1bmsuanNcIilcblxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVFbGVtZW50XG5cbmZ1bmN0aW9uIGNyZWF0ZUVsZW1lbnQodm5vZGUsIG9wdHMpIHtcbiAgICB2YXIgZG9jID0gb3B0cyA/IG9wdHMuZG9jdW1lbnQgfHwgZG9jdW1lbnQgOiBkb2N1bWVudFxuICAgIHZhciB3YXJuID0gb3B0cyA/IG9wdHMud2FybiA6IG51bGxcblxuICAgIHZub2RlID0gaGFuZGxlVGh1bmsodm5vZGUpLmFcblxuICAgIGlmIChpc1dpZGdldCh2bm9kZSkpIHtcbiAgICAgICAgcmV0dXJuIHZub2RlLmluaXQoKVxuICAgIH0gZWxzZSBpZiAoaXNWVGV4dCh2bm9kZSkpIHtcbiAgICAgICAgcmV0dXJuIGRvYy5jcmVhdGVUZXh0Tm9kZSh2bm9kZS50ZXh0KVxuICAgIH0gZWxzZSBpZiAoIWlzVk5vZGUodm5vZGUpKSB7XG4gICAgICAgIGlmICh3YXJuKSB7XG4gICAgICAgICAgICB3YXJuKFwiSXRlbSBpcyBub3QgYSB2YWxpZCB2aXJ0dWFsIGRvbSBub2RlXCIsIHZub2RlKVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsXG4gICAgfVxuXG4gICAgdmFyIG5vZGUgPSAodm5vZGUubmFtZXNwYWNlID09PSBudWxsKSA/XG4gICAgICAgIGRvYy5jcmVhdGVFbGVtZW50KHZub2RlLnRhZ05hbWUpIDpcbiAgICAgICAgZG9jLmNyZWF0ZUVsZW1lbnROUyh2bm9kZS5uYW1lc3BhY2UsIHZub2RlLnRhZ05hbWUpXG5cbiAgICB2YXIgcHJvcHMgPSB2bm9kZS5wcm9wZXJ0aWVzXG4gICAgYXBwbHlQcm9wZXJ0aWVzKG5vZGUsIHByb3BzKVxuXG4gICAgdmFyIGNoaWxkcmVuID0gdm5vZGUuY2hpbGRyZW5cblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGNoaWxkTm9kZSA9IGNyZWF0ZUVsZW1lbnQoY2hpbGRyZW5baV0sIG9wdHMpXG4gICAgICAgIGlmIChjaGlsZE5vZGUpIHtcbiAgICAgICAgICAgIG5vZGUuYXBwZW5kQ2hpbGQoY2hpbGROb2RlKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG5vZGVcbn1cbiIsIi8vIE1hcHMgYSB2aXJ0dWFsIERPTSB0cmVlIG9udG8gYSByZWFsIERPTSB0cmVlIGluIGFuIGVmZmljaWVudCBtYW5uZXIuXG4vLyBXZSBkb24ndCB3YW50IHRvIHJlYWQgYWxsIG9mIHRoZSBET00gbm9kZXMgaW4gdGhlIHRyZWUgc28gd2UgdXNlXG4vLyB0aGUgaW4tb3JkZXIgdHJlZSBpbmRleGluZyB0byBlbGltaW5hdGUgcmVjdXJzaW9uIGRvd24gY2VydGFpbiBicmFuY2hlcy5cbi8vIFdlIG9ubHkgcmVjdXJzZSBpbnRvIGEgRE9NIG5vZGUgaWYgd2Uga25vdyB0aGF0IGl0IGNvbnRhaW5zIGEgY2hpbGQgb2Zcbi8vIGludGVyZXN0LlxuXG52YXIgbm9DaGlsZCA9IHt9XG5cbm1vZHVsZS5leHBvcnRzID0gZG9tSW5kZXhcblxuZnVuY3Rpb24gZG9tSW5kZXgocm9vdE5vZGUsIHRyZWUsIGluZGljZXMsIG5vZGVzKSB7XG4gICAgaWYgKCFpbmRpY2VzIHx8IGluZGljZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiB7fVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGluZGljZXMuc29ydChhc2NlbmRpbmcpXG4gICAgICAgIHJldHVybiByZWN1cnNlKHJvb3ROb2RlLCB0cmVlLCBpbmRpY2VzLCBub2RlcywgMClcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlY3Vyc2Uocm9vdE5vZGUsIHRyZWUsIGluZGljZXMsIG5vZGVzLCByb290SW5kZXgpIHtcbiAgICBub2RlcyA9IG5vZGVzIHx8IHt9XG5cblxuICAgIGlmIChyb290Tm9kZSkge1xuICAgICAgICBpZiAoaW5kZXhJblJhbmdlKGluZGljZXMsIHJvb3RJbmRleCwgcm9vdEluZGV4KSkge1xuICAgICAgICAgICAgbm9kZXNbcm9vdEluZGV4XSA9IHJvb3ROb2RlXG4gICAgICAgIH1cblxuICAgICAgICB2YXIgdkNoaWxkcmVuID0gdHJlZS5jaGlsZHJlblxuXG4gICAgICAgIGlmICh2Q2hpbGRyZW4pIHtcblxuICAgICAgICAgICAgdmFyIGNoaWxkTm9kZXMgPSByb290Tm9kZS5jaGlsZE5vZGVzXG5cbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdHJlZS5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHJvb3RJbmRleCArPSAxXG5cbiAgICAgICAgICAgICAgICB2YXIgdkNoaWxkID0gdkNoaWxkcmVuW2ldIHx8IG5vQ2hpbGRcbiAgICAgICAgICAgICAgICB2YXIgbmV4dEluZGV4ID0gcm9vdEluZGV4ICsgKHZDaGlsZC5jb3VudCB8fCAwKVxuXG4gICAgICAgICAgICAgICAgLy8gc2tpcCByZWN1cnNpb24gZG93biB0aGUgdHJlZSBpZiB0aGVyZSBhcmUgbm8gbm9kZXMgZG93biBoZXJlXG4gICAgICAgICAgICAgICAgaWYgKGluZGV4SW5SYW5nZShpbmRpY2VzLCByb290SW5kZXgsIG5leHRJbmRleCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVjdXJzZShjaGlsZE5vZGVzW2ldLCB2Q2hpbGQsIGluZGljZXMsIG5vZGVzLCByb290SW5kZXgpXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcm9vdEluZGV4ID0gbmV4dEluZGV4XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbm9kZXNcbn1cblxuLy8gQmluYXJ5IHNlYXJjaCBmb3IgYW4gaW5kZXggaW4gdGhlIGludGVydmFsIFtsZWZ0LCByaWdodF1cbmZ1bmN0aW9uIGluZGV4SW5SYW5nZShpbmRpY2VzLCBsZWZ0LCByaWdodCkge1xuICAgIGlmIChpbmRpY2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG5cbiAgICB2YXIgbWluSW5kZXggPSAwXG4gICAgdmFyIG1heEluZGV4ID0gaW5kaWNlcy5sZW5ndGggLSAxXG4gICAgdmFyIGN1cnJlbnRJbmRleFxuICAgIHZhciBjdXJyZW50SXRlbVxuXG4gICAgd2hpbGUgKG1pbkluZGV4IDw9IG1heEluZGV4KSB7XG4gICAgICAgIGN1cnJlbnRJbmRleCA9ICgobWF4SW5kZXggKyBtaW5JbmRleCkgLyAyKSA+PiAwXG4gICAgICAgIGN1cnJlbnRJdGVtID0gaW5kaWNlc1tjdXJyZW50SW5kZXhdXG5cbiAgICAgICAgaWYgKG1pbkluZGV4ID09PSBtYXhJbmRleCkge1xuICAgICAgICAgICAgcmV0dXJuIGN1cnJlbnRJdGVtID49IGxlZnQgJiYgY3VycmVudEl0ZW0gPD0gcmlnaHRcbiAgICAgICAgfSBlbHNlIGlmIChjdXJyZW50SXRlbSA8IGxlZnQpIHtcbiAgICAgICAgICAgIG1pbkluZGV4ID0gY3VycmVudEluZGV4ICsgMVxuICAgICAgICB9IGVsc2UgIGlmIChjdXJyZW50SXRlbSA+IHJpZ2h0KSB7XG4gICAgICAgICAgICBtYXhJbmRleCA9IGN1cnJlbnRJbmRleCAtIDFcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIGFzY2VuZGluZyhhLCBiKSB7XG4gICAgcmV0dXJuIGEgPiBiID8gMSA6IC0xXG59XG4iLCJ2YXIgYXBwbHlQcm9wZXJ0aWVzID0gcmVxdWlyZShcIi4vYXBwbHktcHJvcGVydGllc1wiKVxuXG52YXIgaXNXaWRnZXQgPSByZXF1aXJlKFwiLi4vdm5vZGUvaXMtd2lkZ2V0LmpzXCIpXG52YXIgVlBhdGNoID0gcmVxdWlyZShcIi4uL3Zub2RlL3ZwYXRjaC5qc1wiKVxuXG52YXIgdXBkYXRlV2lkZ2V0ID0gcmVxdWlyZShcIi4vdXBkYXRlLXdpZGdldFwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGFwcGx5UGF0Y2hcblxuZnVuY3Rpb24gYXBwbHlQYXRjaCh2cGF0Y2gsIGRvbU5vZGUsIHJlbmRlck9wdGlvbnMpIHtcbiAgICB2YXIgdHlwZSA9IHZwYXRjaC50eXBlXG4gICAgdmFyIHZOb2RlID0gdnBhdGNoLnZOb2RlXG4gICAgdmFyIHBhdGNoID0gdnBhdGNoLnBhdGNoXG5cbiAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgY2FzZSBWUGF0Y2guUkVNT1ZFOlxuICAgICAgICAgICAgcmV0dXJuIHJlbW92ZU5vZGUoZG9tTm9kZSwgdk5vZGUpXG4gICAgICAgIGNhc2UgVlBhdGNoLklOU0VSVDpcbiAgICAgICAgICAgIHJldHVybiBpbnNlcnROb2RlKGRvbU5vZGUsIHBhdGNoLCByZW5kZXJPcHRpb25zKVxuICAgICAgICBjYXNlIFZQYXRjaC5WVEVYVDpcbiAgICAgICAgICAgIHJldHVybiBzdHJpbmdQYXRjaChkb21Ob2RlLCB2Tm9kZSwgcGF0Y2gsIHJlbmRlck9wdGlvbnMpXG4gICAgICAgIGNhc2UgVlBhdGNoLldJREdFVDpcbiAgICAgICAgICAgIHJldHVybiB3aWRnZXRQYXRjaChkb21Ob2RlLCB2Tm9kZSwgcGF0Y2gsIHJlbmRlck9wdGlvbnMpXG4gICAgICAgIGNhc2UgVlBhdGNoLlZOT0RFOlxuICAgICAgICAgICAgcmV0dXJuIHZOb2RlUGF0Y2goZG9tTm9kZSwgdk5vZGUsIHBhdGNoLCByZW5kZXJPcHRpb25zKVxuICAgICAgICBjYXNlIFZQYXRjaC5PUkRFUjpcbiAgICAgICAgICAgIHJlb3JkZXJDaGlsZHJlbihkb21Ob2RlLCBwYXRjaClcbiAgICAgICAgICAgIHJldHVybiBkb21Ob2RlXG4gICAgICAgIGNhc2UgVlBhdGNoLlBST1BTOlxuICAgICAgICAgICAgYXBwbHlQcm9wZXJ0aWVzKGRvbU5vZGUsIHBhdGNoLCB2Tm9kZS5wcm9wZXJ0aWVzKVxuICAgICAgICAgICAgcmV0dXJuIGRvbU5vZGVcbiAgICAgICAgY2FzZSBWUGF0Y2guVEhVTks6XG4gICAgICAgICAgICByZXR1cm4gcmVwbGFjZVJvb3QoZG9tTm9kZSxcbiAgICAgICAgICAgICAgICByZW5kZXJPcHRpb25zLnBhdGNoKGRvbU5vZGUsIHBhdGNoLCByZW5kZXJPcHRpb25zKSlcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiBkb21Ob2RlXG4gICAgfVxufVxuXG5mdW5jdGlvbiByZW1vdmVOb2RlKGRvbU5vZGUsIHZOb2RlKSB7XG4gICAgdmFyIHBhcmVudE5vZGUgPSBkb21Ob2RlLnBhcmVudE5vZGVcblxuICAgIGlmIChwYXJlbnROb2RlKSB7XG4gICAgICAgIHBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoZG9tTm9kZSlcbiAgICB9XG5cbiAgICBkZXN0cm95V2lkZ2V0KGRvbU5vZGUsIHZOb2RlKTtcblxuICAgIHJldHVybiBudWxsXG59XG5cbmZ1bmN0aW9uIGluc2VydE5vZGUocGFyZW50Tm9kZSwgdk5vZGUsIHJlbmRlck9wdGlvbnMpIHtcbiAgICB2YXIgbmV3Tm9kZSA9IHJlbmRlck9wdGlvbnMucmVuZGVyKHZOb2RlLCByZW5kZXJPcHRpb25zKVxuXG4gICAgaWYgKHBhcmVudE5vZGUpIHtcbiAgICAgICAgcGFyZW50Tm9kZS5hcHBlbmRDaGlsZChuZXdOb2RlKVxuICAgIH1cblxuICAgIHJldHVybiBwYXJlbnROb2RlXG59XG5cbmZ1bmN0aW9uIHN0cmluZ1BhdGNoKGRvbU5vZGUsIGxlZnRWTm9kZSwgdlRleHQsIHJlbmRlck9wdGlvbnMpIHtcbiAgICB2YXIgbmV3Tm9kZVxuXG4gICAgaWYgKGRvbU5vZGUubm9kZVR5cGUgPT09IDMpIHtcbiAgICAgICAgZG9tTm9kZS5yZXBsYWNlRGF0YSgwLCBkb21Ob2RlLmxlbmd0aCwgdlRleHQudGV4dClcbiAgICAgICAgbmV3Tm9kZSA9IGRvbU5vZGVcbiAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgcGFyZW50Tm9kZSA9IGRvbU5vZGUucGFyZW50Tm9kZVxuICAgICAgICBuZXdOb2RlID0gcmVuZGVyT3B0aW9ucy5yZW5kZXIodlRleHQsIHJlbmRlck9wdGlvbnMpXG5cbiAgICAgICAgaWYgKHBhcmVudE5vZGUgJiYgbmV3Tm9kZSAhPT0gZG9tTm9kZSkge1xuICAgICAgICAgICAgcGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQobmV3Tm9kZSwgZG9tTm9kZSlcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBuZXdOb2RlXG59XG5cbmZ1bmN0aW9uIHdpZGdldFBhdGNoKGRvbU5vZGUsIGxlZnRWTm9kZSwgd2lkZ2V0LCByZW5kZXJPcHRpb25zKSB7XG4gICAgdmFyIHVwZGF0aW5nID0gdXBkYXRlV2lkZ2V0KGxlZnRWTm9kZSwgd2lkZ2V0KVxuICAgIHZhciBuZXdOb2RlXG5cbiAgICBpZiAodXBkYXRpbmcpIHtcbiAgICAgICAgbmV3Tm9kZSA9IHdpZGdldC51cGRhdGUobGVmdFZOb2RlLCBkb21Ob2RlKSB8fCBkb21Ob2RlXG4gICAgfSBlbHNlIHtcbiAgICAgICAgbmV3Tm9kZSA9IHJlbmRlck9wdGlvbnMucmVuZGVyKHdpZGdldCwgcmVuZGVyT3B0aW9ucylcbiAgICB9XG5cbiAgICB2YXIgcGFyZW50Tm9kZSA9IGRvbU5vZGUucGFyZW50Tm9kZVxuXG4gICAgaWYgKHBhcmVudE5vZGUgJiYgbmV3Tm9kZSAhPT0gZG9tTm9kZSkge1xuICAgICAgICBwYXJlbnROb2RlLnJlcGxhY2VDaGlsZChuZXdOb2RlLCBkb21Ob2RlKVxuICAgIH1cblxuICAgIGlmICghdXBkYXRpbmcpIHtcbiAgICAgICAgZGVzdHJveVdpZGdldChkb21Ob2RlLCBsZWZ0Vk5vZGUpXG4gICAgfVxuXG4gICAgcmV0dXJuIG5ld05vZGVcbn1cblxuZnVuY3Rpb24gdk5vZGVQYXRjaChkb21Ob2RlLCBsZWZ0Vk5vZGUsIHZOb2RlLCByZW5kZXJPcHRpb25zKSB7XG4gICAgdmFyIHBhcmVudE5vZGUgPSBkb21Ob2RlLnBhcmVudE5vZGVcbiAgICB2YXIgbmV3Tm9kZSA9IHJlbmRlck9wdGlvbnMucmVuZGVyKHZOb2RlLCByZW5kZXJPcHRpb25zKVxuXG4gICAgaWYgKHBhcmVudE5vZGUgJiYgbmV3Tm9kZSAhPT0gZG9tTm9kZSkge1xuICAgICAgICBwYXJlbnROb2RlLnJlcGxhY2VDaGlsZChuZXdOb2RlLCBkb21Ob2RlKVxuICAgIH1cblxuICAgIHJldHVybiBuZXdOb2RlXG59XG5cbmZ1bmN0aW9uIGRlc3Ryb3lXaWRnZXQoZG9tTm9kZSwgdykge1xuICAgIGlmICh0eXBlb2Ygdy5kZXN0cm95ID09PSBcImZ1bmN0aW9uXCIgJiYgaXNXaWRnZXQodykpIHtcbiAgICAgICAgdy5kZXN0cm95KGRvbU5vZGUpXG4gICAgfVxufVxuXG5mdW5jdGlvbiByZW9yZGVyQ2hpbGRyZW4oZG9tTm9kZSwgbW92ZXMpIHtcbiAgICB2YXIgY2hpbGROb2RlcyA9IGRvbU5vZGUuY2hpbGROb2Rlc1xuICAgIHZhciBrZXlNYXAgPSB7fVxuICAgIHZhciBub2RlXG4gICAgdmFyIHJlbW92ZVxuICAgIHZhciBpbnNlcnRcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbW92ZXMucmVtb3Zlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICByZW1vdmUgPSBtb3Zlcy5yZW1vdmVzW2ldXG4gICAgICAgIG5vZGUgPSBjaGlsZE5vZGVzW3JlbW92ZS5mcm9tXVxuICAgICAgICBpZiAocmVtb3ZlLmtleSkge1xuICAgICAgICAgICAga2V5TWFwW3JlbW92ZS5rZXldID0gbm9kZVxuICAgICAgICB9XG4gICAgICAgIGRvbU5vZGUucmVtb3ZlQ2hpbGQobm9kZSlcbiAgICB9XG5cbiAgICB2YXIgbGVuZ3RoID0gY2hpbGROb2Rlcy5sZW5ndGhcbiAgICBmb3IgKHZhciBqID0gMDsgaiA8IG1vdmVzLmluc2VydHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgaW5zZXJ0ID0gbW92ZXMuaW5zZXJ0c1tqXVxuICAgICAgICBub2RlID0ga2V5TWFwW2luc2VydC5rZXldXG4gICAgICAgIC8vIHRoaXMgaXMgdGhlIHdlaXJkZXN0IGJ1ZyBpJ3ZlIGV2ZXIgc2VlbiBpbiB3ZWJraXRcbiAgICAgICAgZG9tTm9kZS5pbnNlcnRCZWZvcmUobm9kZSwgaW5zZXJ0LnRvID49IGxlbmd0aCsrID8gbnVsbCA6IGNoaWxkTm9kZXNbaW5zZXJ0LnRvXSlcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlcGxhY2VSb290KG9sZFJvb3QsIG5ld1Jvb3QpIHtcbiAgICBpZiAob2xkUm9vdCAmJiBuZXdSb290ICYmIG9sZFJvb3QgIT09IG5ld1Jvb3QgJiYgb2xkUm9vdC5wYXJlbnROb2RlKSB7XG4gICAgICAgIG9sZFJvb3QucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQobmV3Um9vdCwgb2xkUm9vdClcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3Um9vdDtcbn1cbiIsInZhciBkb2N1bWVudCA9IHJlcXVpcmUoXCJnbG9iYWwvZG9jdW1lbnRcIilcbnZhciBpc0FycmF5ID0gcmVxdWlyZShcIngtaXMtYXJyYXlcIilcblxudmFyIHJlbmRlciA9IHJlcXVpcmUoXCIuL2NyZWF0ZS1lbGVtZW50XCIpXG52YXIgZG9tSW5kZXggPSByZXF1aXJlKFwiLi9kb20taW5kZXhcIilcbnZhciBwYXRjaE9wID0gcmVxdWlyZShcIi4vcGF0Y2gtb3BcIilcbm1vZHVsZS5leHBvcnRzID0gcGF0Y2hcblxuZnVuY3Rpb24gcGF0Y2gocm9vdE5vZGUsIHBhdGNoZXMsIHJlbmRlck9wdGlvbnMpIHtcbiAgICByZW5kZXJPcHRpb25zID0gcmVuZGVyT3B0aW9ucyB8fCB7fVxuICAgIHJlbmRlck9wdGlvbnMucGF0Y2ggPSByZW5kZXJPcHRpb25zLnBhdGNoICYmIHJlbmRlck9wdGlvbnMucGF0Y2ggIT09IHBhdGNoXG4gICAgICAgID8gcmVuZGVyT3B0aW9ucy5wYXRjaFxuICAgICAgICA6IHBhdGNoUmVjdXJzaXZlXG4gICAgcmVuZGVyT3B0aW9ucy5yZW5kZXIgPSByZW5kZXJPcHRpb25zLnJlbmRlciB8fCByZW5kZXJcblxuICAgIHJldHVybiByZW5kZXJPcHRpb25zLnBhdGNoKHJvb3ROb2RlLCBwYXRjaGVzLCByZW5kZXJPcHRpb25zKVxufVxuXG5mdW5jdGlvbiBwYXRjaFJlY3Vyc2l2ZShyb290Tm9kZSwgcGF0Y2hlcywgcmVuZGVyT3B0aW9ucykge1xuICAgIHZhciBpbmRpY2VzID0gcGF0Y2hJbmRpY2VzKHBhdGNoZXMpXG5cbiAgICBpZiAoaW5kaWNlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIHJvb3ROb2RlXG4gICAgfVxuXG4gICAgdmFyIGluZGV4ID0gZG9tSW5kZXgocm9vdE5vZGUsIHBhdGNoZXMuYSwgaW5kaWNlcylcbiAgICB2YXIgb3duZXJEb2N1bWVudCA9IHJvb3ROb2RlLm93bmVyRG9jdW1lbnRcblxuICAgIGlmICghcmVuZGVyT3B0aW9ucy5kb2N1bWVudCAmJiBvd25lckRvY3VtZW50ICE9PSBkb2N1bWVudCkge1xuICAgICAgICByZW5kZXJPcHRpb25zLmRvY3VtZW50ID0gb3duZXJEb2N1bWVudFxuICAgIH1cblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaW5kaWNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgbm9kZUluZGV4ID0gaW5kaWNlc1tpXVxuICAgICAgICByb290Tm9kZSA9IGFwcGx5UGF0Y2gocm9vdE5vZGUsXG4gICAgICAgICAgICBpbmRleFtub2RlSW5kZXhdLFxuICAgICAgICAgICAgcGF0Y2hlc1tub2RlSW5kZXhdLFxuICAgICAgICAgICAgcmVuZGVyT3B0aW9ucylcbiAgICB9XG5cbiAgICByZXR1cm4gcm9vdE5vZGVcbn1cblxuZnVuY3Rpb24gYXBwbHlQYXRjaChyb290Tm9kZSwgZG9tTm9kZSwgcGF0Y2hMaXN0LCByZW5kZXJPcHRpb25zKSB7XG4gICAgaWYgKCFkb21Ob2RlKSB7XG4gICAgICAgIHJldHVybiByb290Tm9kZVxuICAgIH1cblxuICAgIHZhciBuZXdOb2RlXG5cbiAgICBpZiAoaXNBcnJheShwYXRjaExpc3QpKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcGF0Y2hMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBuZXdOb2RlID0gcGF0Y2hPcChwYXRjaExpc3RbaV0sIGRvbU5vZGUsIHJlbmRlck9wdGlvbnMpXG5cbiAgICAgICAgICAgIGlmIChkb21Ob2RlID09PSByb290Tm9kZSkge1xuICAgICAgICAgICAgICAgIHJvb3ROb2RlID0gbmV3Tm9kZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbmV3Tm9kZSA9IHBhdGNoT3AocGF0Y2hMaXN0LCBkb21Ob2RlLCByZW5kZXJPcHRpb25zKVxuXG4gICAgICAgIGlmIChkb21Ob2RlID09PSByb290Tm9kZSkge1xuICAgICAgICAgICAgcm9vdE5vZGUgPSBuZXdOb2RlXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcm9vdE5vZGVcbn1cblxuZnVuY3Rpb24gcGF0Y2hJbmRpY2VzKHBhdGNoZXMpIHtcbiAgICB2YXIgaW5kaWNlcyA9IFtdXG5cbiAgICBmb3IgKHZhciBrZXkgaW4gcGF0Y2hlcykge1xuICAgICAgICBpZiAoa2V5ICE9PSBcImFcIikge1xuICAgICAgICAgICAgaW5kaWNlcy5wdXNoKE51bWJlcihrZXkpKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGluZGljZXNcbn1cbiIsInZhciBpc1dpZGdldCA9IHJlcXVpcmUoXCIuLi92bm9kZS9pcy13aWRnZXQuanNcIilcblxubW9kdWxlLmV4cG9ydHMgPSB1cGRhdGVXaWRnZXRcblxuZnVuY3Rpb24gdXBkYXRlV2lkZ2V0KGEsIGIpIHtcbiAgICBpZiAoaXNXaWRnZXQoYSkgJiYgaXNXaWRnZXQoYikpIHtcbiAgICAgICAgaWYgKFwibmFtZVwiIGluIGEgJiYgXCJuYW1lXCIgaW4gYikge1xuICAgICAgICAgICAgcmV0dXJuIGEuaWQgPT09IGIuaWRcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBhLmluaXQgPT09IGIuaW5pdFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlXG59XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBFdlN0b3JlID0gcmVxdWlyZSgnZXYtc3RvcmUnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBFdkhvb2s7XG5cbmZ1bmN0aW9uIEV2SG9vayh2YWx1ZSkge1xuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBFdkhvb2spKSB7XG4gICAgICAgIHJldHVybiBuZXcgRXZIb29rKHZhbHVlKTtcbiAgICB9XG5cbiAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG59XG5cbkV2SG9vay5wcm90b3R5cGUuaG9vayA9IGZ1bmN0aW9uIChub2RlLCBwcm9wZXJ0eU5hbWUpIHtcbiAgICB2YXIgZXMgPSBFdlN0b3JlKG5vZGUpO1xuICAgIHZhciBwcm9wTmFtZSA9IHByb3BlcnR5TmFtZS5zdWJzdHIoMyk7XG5cbiAgICBlc1twcm9wTmFtZV0gPSB0aGlzLnZhbHVlO1xufTtcblxuRXZIb29rLnByb3RvdHlwZS51bmhvb2sgPSBmdW5jdGlvbihub2RlLCBwcm9wZXJ0eU5hbWUpIHtcbiAgICB2YXIgZXMgPSBFdlN0b3JlKG5vZGUpO1xuICAgIHZhciBwcm9wTmFtZSA9IHByb3BlcnR5TmFtZS5zdWJzdHIoMyk7XG5cbiAgICBlc1twcm9wTmFtZV0gPSB1bmRlZmluZWQ7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNvZnRTZXRIb29rO1xuXG5mdW5jdGlvbiBTb2Z0U2V0SG9vayh2YWx1ZSkge1xuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBTb2Z0U2V0SG9vaykpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBTb2Z0U2V0SG9vayh2YWx1ZSk7XG4gICAgfVxuXG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xufVxuXG5Tb2Z0U2V0SG9vay5wcm90b3R5cGUuaG9vayA9IGZ1bmN0aW9uIChub2RlLCBwcm9wZXJ0eU5hbWUpIHtcbiAgICBpZiAobm9kZVtwcm9wZXJ0eU5hbWVdICE9PSB0aGlzLnZhbHVlKSB7XG4gICAgICAgIG5vZGVbcHJvcGVydHlOYW1lXSA9IHRoaXMudmFsdWU7XG4gICAgfVxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGlzQXJyYXkgPSByZXF1aXJlKCd4LWlzLWFycmF5Jyk7XG5cbnZhciBWTm9kZSA9IHJlcXVpcmUoJy4uL3Zub2RlL3Zub2RlLmpzJyk7XG52YXIgVlRleHQgPSByZXF1aXJlKCcuLi92bm9kZS92dGV4dC5qcycpO1xudmFyIGlzVk5vZGUgPSByZXF1aXJlKCcuLi92bm9kZS9pcy12bm9kZScpO1xudmFyIGlzVlRleHQgPSByZXF1aXJlKCcuLi92bm9kZS9pcy12dGV4dCcpO1xudmFyIGlzV2lkZ2V0ID0gcmVxdWlyZSgnLi4vdm5vZGUvaXMtd2lkZ2V0Jyk7XG52YXIgaXNIb29rID0gcmVxdWlyZSgnLi4vdm5vZGUvaXMtdmhvb2snKTtcbnZhciBpc1ZUaHVuayA9IHJlcXVpcmUoJy4uL3Zub2RlL2lzLXRodW5rJyk7XG5cbnZhciBwYXJzZVRhZyA9IHJlcXVpcmUoJy4vcGFyc2UtdGFnLmpzJyk7XG52YXIgc29mdFNldEhvb2sgPSByZXF1aXJlKCcuL2hvb2tzL3NvZnQtc2V0LWhvb2suanMnKTtcbnZhciBldkhvb2sgPSByZXF1aXJlKCcuL2hvb2tzL2V2LWhvb2suanMnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBoO1xuXG5mdW5jdGlvbiBoKHRhZ05hbWUsIHByb3BlcnRpZXMsIGNoaWxkcmVuKSB7XG4gICAgdmFyIGNoaWxkTm9kZXMgPSBbXTtcbiAgICB2YXIgdGFnLCBwcm9wcywga2V5LCBuYW1lc3BhY2U7XG5cbiAgICBpZiAoIWNoaWxkcmVuICYmIGlzQ2hpbGRyZW4ocHJvcGVydGllcykpIHtcbiAgICAgICAgY2hpbGRyZW4gPSBwcm9wZXJ0aWVzO1xuICAgICAgICBwcm9wcyA9IHt9O1xuICAgIH1cblxuICAgIHByb3BzID0gcHJvcHMgfHwgcHJvcGVydGllcyB8fCB7fTtcbiAgICB0YWcgPSBwYXJzZVRhZyh0YWdOYW1lLCBwcm9wcyk7XG5cbiAgICAvLyBzdXBwb3J0IGtleXNcbiAgICBpZiAocHJvcHMuaGFzT3duUHJvcGVydHkoJ2tleScpKSB7XG4gICAgICAgIGtleSA9IHByb3BzLmtleTtcbiAgICAgICAgcHJvcHMua2V5ID0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIC8vIHN1cHBvcnQgbmFtZXNwYWNlXG4gICAgaWYgKHByb3BzLmhhc093blByb3BlcnR5KCduYW1lc3BhY2UnKSkge1xuICAgICAgICBuYW1lc3BhY2UgPSBwcm9wcy5uYW1lc3BhY2U7XG4gICAgICAgIHByb3BzLm5hbWVzcGFjZSA9IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICAvLyBmaXggY3Vyc29yIGJ1Z1xuICAgIGlmICh0YWcgPT09ICdJTlBVVCcgJiZcbiAgICAgICAgIW5hbWVzcGFjZSAmJlxuICAgICAgICBwcm9wcy5oYXNPd25Qcm9wZXJ0eSgndmFsdWUnKSAmJlxuICAgICAgICBwcm9wcy52YWx1ZSAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAgICFpc0hvb2socHJvcHMudmFsdWUpXG4gICAgKSB7XG4gICAgICAgIHByb3BzLnZhbHVlID0gc29mdFNldEhvb2socHJvcHMudmFsdWUpO1xuICAgIH1cblxuICAgIHRyYW5zZm9ybVByb3BlcnRpZXMocHJvcHMpO1xuXG4gICAgaWYgKGNoaWxkcmVuICE9PSB1bmRlZmluZWQgJiYgY2hpbGRyZW4gIT09IG51bGwpIHtcbiAgICAgICAgYWRkQ2hpbGQoY2hpbGRyZW4sIGNoaWxkTm9kZXMsIHRhZywgcHJvcHMpO1xuICAgIH1cblxuXG4gICAgcmV0dXJuIG5ldyBWTm9kZSh0YWcsIHByb3BzLCBjaGlsZE5vZGVzLCBrZXksIG5hbWVzcGFjZSk7XG59XG5cbmZ1bmN0aW9uIGFkZENoaWxkKGMsIGNoaWxkTm9kZXMsIHRhZywgcHJvcHMpIHtcbiAgICBpZiAodHlwZW9mIGMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGNoaWxkTm9kZXMucHVzaChuZXcgVlRleHQoYykpO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGMgPT09ICdudW1iZXInKSB7XG4gICAgICAgIGNoaWxkTm9kZXMucHVzaChuZXcgVlRleHQoU3RyaW5nKGMpKSk7XG4gICAgfSBlbHNlIGlmIChpc0NoaWxkKGMpKSB7XG4gICAgICAgIGNoaWxkTm9kZXMucHVzaChjKTtcbiAgICB9IGVsc2UgaWYgKGlzQXJyYXkoYykpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhZGRDaGlsZChjW2ldLCBjaGlsZE5vZGVzLCB0YWcsIHByb3BzKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoYyA9PT0gbnVsbCB8fCBjID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IFVuZXhwZWN0ZWRWaXJ0dWFsRWxlbWVudCh7XG4gICAgICAgICAgICBmb3JlaWduT2JqZWN0OiBjLFxuICAgICAgICAgICAgcGFyZW50Vm5vZGU6IHtcbiAgICAgICAgICAgICAgICB0YWdOYW1lOiB0YWcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczogcHJvcHNcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB0cmFuc2Zvcm1Qcm9wZXJ0aWVzKHByb3BzKSB7XG4gICAgZm9yICh2YXIgcHJvcE5hbWUgaW4gcHJvcHMpIHtcbiAgICAgICAgaWYgKHByb3BzLmhhc093blByb3BlcnR5KHByb3BOYW1lKSkge1xuICAgICAgICAgICAgdmFyIHZhbHVlID0gcHJvcHNbcHJvcE5hbWVdO1xuXG4gICAgICAgICAgICBpZiAoaXNIb29rKHZhbHVlKSkge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAocHJvcE5hbWUuc3Vic3RyKDAsIDMpID09PSAnZXYtJykge1xuICAgICAgICAgICAgICAgIC8vIGFkZCBldi1mb28gc3VwcG9ydFxuICAgICAgICAgICAgICAgIHByb3BzW3Byb3BOYW1lXSA9IGV2SG9vayh2YWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIGlzQ2hpbGQoeCkge1xuICAgIHJldHVybiBpc1ZOb2RlKHgpIHx8IGlzVlRleHQoeCkgfHwgaXNXaWRnZXQoeCkgfHwgaXNWVGh1bmsoeCk7XG59XG5cbmZ1bmN0aW9uIGlzQ2hpbGRyZW4oeCkge1xuICAgIHJldHVybiB0eXBlb2YgeCA9PT0gJ3N0cmluZycgfHwgaXNBcnJheSh4KSB8fCBpc0NoaWxkKHgpO1xufVxuXG5mdW5jdGlvbiBVbmV4cGVjdGVkVmlydHVhbEVsZW1lbnQoZGF0YSkge1xuICAgIHZhciBlcnIgPSBuZXcgRXJyb3IoKTtcblxuICAgIGVyci50eXBlID0gJ3ZpcnR1YWwtaHlwZXJzY3JpcHQudW5leHBlY3RlZC52aXJ0dWFsLWVsZW1lbnQnO1xuICAgIGVyci5tZXNzYWdlID0gJ1VuZXhwZWN0ZWQgdmlydHVhbCBjaGlsZCBwYXNzZWQgdG8gaCgpLlxcbicgK1xuICAgICAgICAnRXhwZWN0ZWQgYSBWTm9kZSAvIFZ0aHVuayAvIFZXaWRnZXQgLyBzdHJpbmcgYnV0OlxcbicgK1xuICAgICAgICAnZ290OlxcbicgK1xuICAgICAgICBlcnJvclN0cmluZyhkYXRhLmZvcmVpZ25PYmplY3QpICtcbiAgICAgICAgJy5cXG4nICtcbiAgICAgICAgJ1RoZSBwYXJlbnQgdm5vZGUgaXM6XFxuJyArXG4gICAgICAgIGVycm9yU3RyaW5nKGRhdGEucGFyZW50Vm5vZGUpXG4gICAgICAgICdcXG4nICtcbiAgICAgICAgJ1N1Z2dlc3RlZCBmaXg6IGNoYW5nZSB5b3VyIGBoKC4uLiwgWyAuLi4gXSlgIGNhbGxzaXRlLic7XG4gICAgZXJyLmZvcmVpZ25PYmplY3QgPSBkYXRhLmZvcmVpZ25PYmplY3Q7XG4gICAgZXJyLnBhcmVudFZub2RlID0gZGF0YS5wYXJlbnRWbm9kZTtcblxuICAgIHJldHVybiBlcnI7XG59XG5cbmZ1bmN0aW9uIGVycm9yU3RyaW5nKG9iaikge1xuICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShvYmosIG51bGwsICcgICAgJyk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZXR1cm4gU3RyaW5nKG9iaik7XG4gICAgfVxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgc3BsaXQgPSByZXF1aXJlKCdicm93c2VyLXNwbGl0Jyk7XG5cbnZhciBjbGFzc0lkU3BsaXQgPSAvKFtcXC4jXT9bYS16QS1aMC05XFx1MDA3Ri1cXHVGRkZGXzotXSspLztcbnZhciBub3RDbGFzc0lkID0gL15cXC58Iy87XG5cbm1vZHVsZS5leHBvcnRzID0gcGFyc2VUYWc7XG5cbmZ1bmN0aW9uIHBhcnNlVGFnKHRhZywgcHJvcHMpIHtcbiAgICBpZiAoIXRhZykge1xuICAgICAgICByZXR1cm4gJ0RJVic7XG4gICAgfVxuXG4gICAgdmFyIG5vSWQgPSAhKHByb3BzLmhhc093blByb3BlcnR5KCdpZCcpKTtcblxuICAgIHZhciB0YWdQYXJ0cyA9IHNwbGl0KHRhZywgY2xhc3NJZFNwbGl0KTtcbiAgICB2YXIgdGFnTmFtZSA9IG51bGw7XG5cbiAgICBpZiAobm90Q2xhc3NJZC50ZXN0KHRhZ1BhcnRzWzFdKSkge1xuICAgICAgICB0YWdOYW1lID0gJ0RJVic7XG4gICAgfVxuXG4gICAgdmFyIGNsYXNzZXMsIHBhcnQsIHR5cGUsIGk7XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgdGFnUGFydHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgcGFydCA9IHRhZ1BhcnRzW2ldO1xuXG4gICAgICAgIGlmICghcGFydCkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICB0eXBlID0gcGFydC5jaGFyQXQoMCk7XG5cbiAgICAgICAgaWYgKCF0YWdOYW1lKSB7XG4gICAgICAgICAgICB0YWdOYW1lID0gcGFydDtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAnLicpIHtcbiAgICAgICAgICAgIGNsYXNzZXMgPSBjbGFzc2VzIHx8IFtdO1xuICAgICAgICAgICAgY2xhc3Nlcy5wdXNoKHBhcnQuc3Vic3RyaW5nKDEsIHBhcnQubGVuZ3RoKSk7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJyMnICYmIG5vSWQpIHtcbiAgICAgICAgICAgIHByb3BzLmlkID0gcGFydC5zdWJzdHJpbmcoMSwgcGFydC5sZW5ndGgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGNsYXNzZXMpIHtcbiAgICAgICAgaWYgKHByb3BzLmNsYXNzTmFtZSkge1xuICAgICAgICAgICAgY2xhc3Nlcy5wdXNoKHByb3BzLmNsYXNzTmFtZSk7XG4gICAgICAgIH1cblxuICAgICAgICBwcm9wcy5jbGFzc05hbWUgPSBjbGFzc2VzLmpvaW4oJyAnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcHJvcHMubmFtZXNwYWNlID8gdGFnTmFtZSA6IHRhZ05hbWUudG9VcHBlckNhc2UoKTtcbn1cbiIsInZhciBpc1ZOb2RlID0gcmVxdWlyZShcIi4vaXMtdm5vZGVcIilcbnZhciBpc1ZUZXh0ID0gcmVxdWlyZShcIi4vaXMtdnRleHRcIilcbnZhciBpc1dpZGdldCA9IHJlcXVpcmUoXCIuL2lzLXdpZGdldFwiKVxudmFyIGlzVGh1bmsgPSByZXF1aXJlKFwiLi9pcy10aHVua1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGhhbmRsZVRodW5rXG5cbmZ1bmN0aW9uIGhhbmRsZVRodW5rKGEsIGIpIHtcbiAgICB2YXIgcmVuZGVyZWRBID0gYVxuICAgIHZhciByZW5kZXJlZEIgPSBiXG5cbiAgICBpZiAoaXNUaHVuayhiKSkge1xuICAgICAgICByZW5kZXJlZEIgPSByZW5kZXJUaHVuayhiLCBhKVxuICAgIH1cblxuICAgIGlmIChpc1RodW5rKGEpKSB7XG4gICAgICAgIHJlbmRlcmVkQSA9IHJlbmRlclRodW5rKGEsIG51bGwpXG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgYTogcmVuZGVyZWRBLFxuICAgICAgICBiOiByZW5kZXJlZEJcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlbmRlclRodW5rKHRodW5rLCBwcmV2aW91cykge1xuICAgIHZhciByZW5kZXJlZFRodW5rID0gdGh1bmsudm5vZGVcblxuICAgIGlmICghcmVuZGVyZWRUaHVuaykge1xuICAgICAgICByZW5kZXJlZFRodW5rID0gdGh1bmsudm5vZGUgPSB0aHVuay5yZW5kZXIocHJldmlvdXMpXG4gICAgfVxuXG4gICAgaWYgKCEoaXNWTm9kZShyZW5kZXJlZFRodW5rKSB8fFxuICAgICAgICAgICAgaXNWVGV4dChyZW5kZXJlZFRodW5rKSB8fFxuICAgICAgICAgICAgaXNXaWRnZXQocmVuZGVyZWRUaHVuaykpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcInRodW5rIGRpZCBub3QgcmV0dXJuIGEgdmFsaWQgbm9kZVwiKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVuZGVyZWRUaHVua1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBpc1RodW5rXHJcblxyXG5mdW5jdGlvbiBpc1RodW5rKHQpIHtcclxuICAgIHJldHVybiB0ICYmIHQudHlwZSA9PT0gXCJUaHVua1wiXHJcbn1cclxuIiwibW9kdWxlLmV4cG9ydHMgPSBpc0hvb2tcblxuZnVuY3Rpb24gaXNIb29rKGhvb2spIHtcbiAgICByZXR1cm4gaG9vayAmJlxuICAgICAgKHR5cGVvZiBob29rLmhvb2sgPT09IFwiZnVuY3Rpb25cIiAmJiAhaG9vay5oYXNPd25Qcm9wZXJ0eShcImhvb2tcIikgfHxcbiAgICAgICB0eXBlb2YgaG9vay51bmhvb2sgPT09IFwiZnVuY3Rpb25cIiAmJiAhaG9vay5oYXNPd25Qcm9wZXJ0eShcInVuaG9va1wiKSlcbn1cbiIsInZhciB2ZXJzaW9uID0gcmVxdWlyZShcIi4vdmVyc2lvblwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzVmlydHVhbE5vZGVcblxuZnVuY3Rpb24gaXNWaXJ0dWFsTm9kZSh4KSB7XG4gICAgcmV0dXJuIHggJiYgeC50eXBlID09PSBcIlZpcnR1YWxOb2RlXCIgJiYgeC52ZXJzaW9uID09PSB2ZXJzaW9uXG59XG4iLCJ2YXIgdmVyc2lvbiA9IHJlcXVpcmUoXCIuL3ZlcnNpb25cIilcblxubW9kdWxlLmV4cG9ydHMgPSBpc1ZpcnR1YWxUZXh0XG5cbmZ1bmN0aW9uIGlzVmlydHVhbFRleHQoeCkge1xuICAgIHJldHVybiB4ICYmIHgudHlwZSA9PT0gXCJWaXJ0dWFsVGV4dFwiICYmIHgudmVyc2lvbiA9PT0gdmVyc2lvblxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBpc1dpZGdldFxuXG5mdW5jdGlvbiBpc1dpZGdldCh3KSB7XG4gICAgcmV0dXJuIHcgJiYgdy50eXBlID09PSBcIldpZGdldFwiXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IFwiMlwiXG4iLCJ2YXIgdmVyc2lvbiA9IHJlcXVpcmUoXCIuL3ZlcnNpb25cIilcbnZhciBpc1ZOb2RlID0gcmVxdWlyZShcIi4vaXMtdm5vZGVcIilcbnZhciBpc1dpZGdldCA9IHJlcXVpcmUoXCIuL2lzLXdpZGdldFwiKVxudmFyIGlzVGh1bmsgPSByZXF1aXJlKFwiLi9pcy10aHVua1wiKVxudmFyIGlzVkhvb2sgPSByZXF1aXJlKFwiLi9pcy12aG9va1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IFZpcnR1YWxOb2RlXG5cbnZhciBub1Byb3BlcnRpZXMgPSB7fVxudmFyIG5vQ2hpbGRyZW4gPSBbXVxuXG5mdW5jdGlvbiBWaXJ0dWFsTm9kZSh0YWdOYW1lLCBwcm9wZXJ0aWVzLCBjaGlsZHJlbiwga2V5LCBuYW1lc3BhY2UpIHtcbiAgICB0aGlzLnRhZ05hbWUgPSB0YWdOYW1lXG4gICAgdGhpcy5wcm9wZXJ0aWVzID0gcHJvcGVydGllcyB8fCBub1Byb3BlcnRpZXNcbiAgICB0aGlzLmNoaWxkcmVuID0gY2hpbGRyZW4gfHwgbm9DaGlsZHJlblxuICAgIHRoaXMua2V5ID0ga2V5ICE9IG51bGwgPyBTdHJpbmcoa2V5KSA6IHVuZGVmaW5lZFxuICAgIHRoaXMubmFtZXNwYWNlID0gKHR5cGVvZiBuYW1lc3BhY2UgPT09IFwic3RyaW5nXCIpID8gbmFtZXNwYWNlIDogbnVsbFxuXG4gICAgdmFyIGNvdW50ID0gKGNoaWxkcmVuICYmIGNoaWxkcmVuLmxlbmd0aCkgfHwgMFxuICAgIHZhciBkZXNjZW5kYW50cyA9IDBcbiAgICB2YXIgaGFzV2lkZ2V0cyA9IGZhbHNlXG4gICAgdmFyIGhhc1RodW5rcyA9IGZhbHNlXG4gICAgdmFyIGRlc2NlbmRhbnRIb29rcyA9IGZhbHNlXG4gICAgdmFyIGhvb2tzXG5cbiAgICBmb3IgKHZhciBwcm9wTmFtZSBpbiBwcm9wZXJ0aWVzKSB7XG4gICAgICAgIGlmIChwcm9wZXJ0aWVzLmhhc093blByb3BlcnR5KHByb3BOYW1lKSkge1xuICAgICAgICAgICAgdmFyIHByb3BlcnR5ID0gcHJvcGVydGllc1twcm9wTmFtZV1cbiAgICAgICAgICAgIGlmIChpc1ZIb29rKHByb3BlcnR5KSAmJiBwcm9wZXJ0eS51bmhvb2spIHtcbiAgICAgICAgICAgICAgICBpZiAoIWhvb2tzKSB7XG4gICAgICAgICAgICAgICAgICAgIGhvb2tzID0ge31cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBob29rc1twcm9wTmFtZV0gPSBwcm9wZXJ0eVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG4gICAgICAgIHZhciBjaGlsZCA9IGNoaWxkcmVuW2ldXG4gICAgICAgIGlmIChpc1ZOb2RlKGNoaWxkKSkge1xuICAgICAgICAgICAgZGVzY2VuZGFudHMgKz0gY2hpbGQuY291bnQgfHwgMFxuXG4gICAgICAgICAgICBpZiAoIWhhc1dpZGdldHMgJiYgY2hpbGQuaGFzV2lkZ2V0cykge1xuICAgICAgICAgICAgICAgIGhhc1dpZGdldHMgPSB0cnVlXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghaGFzVGh1bmtzICYmIGNoaWxkLmhhc1RodW5rcykge1xuICAgICAgICAgICAgICAgIGhhc1RodW5rcyA9IHRydWVcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFkZXNjZW5kYW50SG9va3MgJiYgKGNoaWxkLmhvb2tzIHx8IGNoaWxkLmRlc2NlbmRhbnRIb29rcykpIHtcbiAgICAgICAgICAgICAgICBkZXNjZW5kYW50SG9va3MgPSB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoIWhhc1dpZGdldHMgJiYgaXNXaWRnZXQoY2hpbGQpKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGNoaWxkLmRlc3Ryb3kgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgIGhhc1dpZGdldHMgPSB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoIWhhc1RodW5rcyAmJiBpc1RodW5rKGNoaWxkKSkge1xuICAgICAgICAgICAgaGFzVGh1bmtzID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuY291bnQgPSBjb3VudCArIGRlc2NlbmRhbnRzXG4gICAgdGhpcy5oYXNXaWRnZXRzID0gaGFzV2lkZ2V0c1xuICAgIHRoaXMuaGFzVGh1bmtzID0gaGFzVGh1bmtzXG4gICAgdGhpcy5ob29rcyA9IGhvb2tzXG4gICAgdGhpcy5kZXNjZW5kYW50SG9va3MgPSBkZXNjZW5kYW50SG9va3Ncbn1cblxuVmlydHVhbE5vZGUucHJvdG90eXBlLnZlcnNpb24gPSB2ZXJzaW9uXG5WaXJ0dWFsTm9kZS5wcm90b3R5cGUudHlwZSA9IFwiVmlydHVhbE5vZGVcIlxuIiwidmFyIHZlcnNpb24gPSByZXF1aXJlKFwiLi92ZXJzaW9uXCIpXG5cblZpcnR1YWxQYXRjaC5OT05FID0gMFxuVmlydHVhbFBhdGNoLlZURVhUID0gMVxuVmlydHVhbFBhdGNoLlZOT0RFID0gMlxuVmlydHVhbFBhdGNoLldJREdFVCA9IDNcblZpcnR1YWxQYXRjaC5QUk9QUyA9IDRcblZpcnR1YWxQYXRjaC5PUkRFUiA9IDVcblZpcnR1YWxQYXRjaC5JTlNFUlQgPSA2XG5WaXJ0dWFsUGF0Y2guUkVNT1ZFID0gN1xuVmlydHVhbFBhdGNoLlRIVU5LID0gOFxuXG5tb2R1bGUuZXhwb3J0cyA9IFZpcnR1YWxQYXRjaFxuXG5mdW5jdGlvbiBWaXJ0dWFsUGF0Y2godHlwZSwgdk5vZGUsIHBhdGNoKSB7XG4gICAgdGhpcy50eXBlID0gTnVtYmVyKHR5cGUpXG4gICAgdGhpcy52Tm9kZSA9IHZOb2RlXG4gICAgdGhpcy5wYXRjaCA9IHBhdGNoXG59XG5cblZpcnR1YWxQYXRjaC5wcm90b3R5cGUudmVyc2lvbiA9IHZlcnNpb25cblZpcnR1YWxQYXRjaC5wcm90b3R5cGUudHlwZSA9IFwiVmlydHVhbFBhdGNoXCJcbiIsInZhciB2ZXJzaW9uID0gcmVxdWlyZShcIi4vdmVyc2lvblwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IFZpcnR1YWxUZXh0XG5cbmZ1bmN0aW9uIFZpcnR1YWxUZXh0KHRleHQpIHtcbiAgICB0aGlzLnRleHQgPSBTdHJpbmcodGV4dClcbn1cblxuVmlydHVhbFRleHQucHJvdG90eXBlLnZlcnNpb24gPSB2ZXJzaW9uXG5WaXJ0dWFsVGV4dC5wcm90b3R5cGUudHlwZSA9IFwiVmlydHVhbFRleHRcIlxuIiwidmFyIGlzT2JqZWN0ID0gcmVxdWlyZShcImlzLW9iamVjdFwiKVxudmFyIGlzSG9vayA9IHJlcXVpcmUoXCIuLi92bm9kZS9pcy12aG9va1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGRpZmZQcm9wc1xuXG5mdW5jdGlvbiBkaWZmUHJvcHMoYSwgYikge1xuICAgIHZhciBkaWZmXG5cbiAgICBmb3IgKHZhciBhS2V5IGluIGEpIHtcbiAgICAgICAgaWYgKCEoYUtleSBpbiBiKSkge1xuICAgICAgICAgICAgZGlmZiA9IGRpZmYgfHwge31cbiAgICAgICAgICAgIGRpZmZbYUtleV0gPSB1bmRlZmluZWRcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBhVmFsdWUgPSBhW2FLZXldXG4gICAgICAgIHZhciBiVmFsdWUgPSBiW2FLZXldXG5cbiAgICAgICAgaWYgKGFWYWx1ZSA9PT0gYlZhbHVlKSB7XG4gICAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9IGVsc2UgaWYgKGlzT2JqZWN0KGFWYWx1ZSkgJiYgaXNPYmplY3QoYlZhbHVlKSkge1xuICAgICAgICAgICAgaWYgKGdldFByb3RvdHlwZShiVmFsdWUpICE9PSBnZXRQcm90b3R5cGUoYVZhbHVlKSkge1xuICAgICAgICAgICAgICAgIGRpZmYgPSBkaWZmIHx8IHt9XG4gICAgICAgICAgICAgICAgZGlmZlthS2V5XSA9IGJWYWx1ZVxuICAgICAgICAgICAgfSBlbHNlIGlmIChpc0hvb2soYlZhbHVlKSkge1xuICAgICAgICAgICAgICAgICBkaWZmID0gZGlmZiB8fCB7fVxuICAgICAgICAgICAgICAgICBkaWZmW2FLZXldID0gYlZhbHVlXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhciBvYmplY3REaWZmID0gZGlmZlByb3BzKGFWYWx1ZSwgYlZhbHVlKVxuICAgICAgICAgICAgICAgIGlmIChvYmplY3REaWZmKSB7XG4gICAgICAgICAgICAgICAgICAgIGRpZmYgPSBkaWZmIHx8IHt9XG4gICAgICAgICAgICAgICAgICAgIGRpZmZbYUtleV0gPSBvYmplY3REaWZmXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGlmZiA9IGRpZmYgfHwge31cbiAgICAgICAgICAgIGRpZmZbYUtleV0gPSBiVmFsdWVcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZvciAodmFyIGJLZXkgaW4gYikge1xuICAgICAgICBpZiAoIShiS2V5IGluIGEpKSB7XG4gICAgICAgICAgICBkaWZmID0gZGlmZiB8fCB7fVxuICAgICAgICAgICAgZGlmZltiS2V5XSA9IGJbYktleV1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBkaWZmXG59XG5cbmZ1bmN0aW9uIGdldFByb3RvdHlwZSh2YWx1ZSkge1xuICBpZiAoT2JqZWN0LmdldFByb3RvdHlwZU9mKSB7XG4gICAgcmV0dXJuIE9iamVjdC5nZXRQcm90b3R5cGVPZih2YWx1ZSlcbiAgfSBlbHNlIGlmICh2YWx1ZS5fX3Byb3RvX18pIHtcbiAgICByZXR1cm4gdmFsdWUuX19wcm90b19fXG4gIH0gZWxzZSBpZiAodmFsdWUuY29uc3RydWN0b3IpIHtcbiAgICByZXR1cm4gdmFsdWUuY29uc3RydWN0b3IucHJvdG90eXBlXG4gIH1cbn1cbiIsInZhciBpc0FycmF5ID0gcmVxdWlyZShcIngtaXMtYXJyYXlcIilcblxudmFyIFZQYXRjaCA9IHJlcXVpcmUoXCIuLi92bm9kZS92cGF0Y2hcIilcbnZhciBpc1ZOb2RlID0gcmVxdWlyZShcIi4uL3Zub2RlL2lzLXZub2RlXCIpXG52YXIgaXNWVGV4dCA9IHJlcXVpcmUoXCIuLi92bm9kZS9pcy12dGV4dFwiKVxudmFyIGlzV2lkZ2V0ID0gcmVxdWlyZShcIi4uL3Zub2RlL2lzLXdpZGdldFwiKVxudmFyIGlzVGh1bmsgPSByZXF1aXJlKFwiLi4vdm5vZGUvaXMtdGh1bmtcIilcbnZhciBoYW5kbGVUaHVuayA9IHJlcXVpcmUoXCIuLi92bm9kZS9oYW5kbGUtdGh1bmtcIilcblxudmFyIGRpZmZQcm9wcyA9IHJlcXVpcmUoXCIuL2RpZmYtcHJvcHNcIilcblxubW9kdWxlLmV4cG9ydHMgPSBkaWZmXG5cbmZ1bmN0aW9uIGRpZmYoYSwgYikge1xuICAgIHZhciBwYXRjaCA9IHsgYTogYSB9XG4gICAgd2FsayhhLCBiLCBwYXRjaCwgMClcbiAgICByZXR1cm4gcGF0Y2hcbn1cblxuZnVuY3Rpb24gd2FsayhhLCBiLCBwYXRjaCwgaW5kZXgpIHtcbiAgICBpZiAoYSA9PT0gYikge1xuICAgICAgICByZXR1cm5cbiAgICB9XG5cbiAgICB2YXIgYXBwbHkgPSBwYXRjaFtpbmRleF1cbiAgICB2YXIgYXBwbHlDbGVhciA9IGZhbHNlXG5cbiAgICBpZiAoaXNUaHVuayhhKSB8fCBpc1RodW5rKGIpKSB7XG4gICAgICAgIHRodW5rcyhhLCBiLCBwYXRjaCwgaW5kZXgpXG4gICAgfSBlbHNlIGlmIChiID09IG51bGwpIHtcblxuICAgICAgICAvLyBJZiBhIGlzIGEgd2lkZ2V0IHdlIHdpbGwgYWRkIGEgcmVtb3ZlIHBhdGNoIGZvciBpdFxuICAgICAgICAvLyBPdGhlcndpc2UgYW55IGNoaWxkIHdpZGdldHMvaG9va3MgbXVzdCBiZSBkZXN0cm95ZWQuXG4gICAgICAgIC8vIFRoaXMgcHJldmVudHMgYWRkaW5nIHR3byByZW1vdmUgcGF0Y2hlcyBmb3IgYSB3aWRnZXQuXG4gICAgICAgIGlmICghaXNXaWRnZXQoYSkpIHtcbiAgICAgICAgICAgIGNsZWFyU3RhdGUoYSwgcGF0Y2gsIGluZGV4KVxuICAgICAgICAgICAgYXBwbHkgPSBwYXRjaFtpbmRleF1cbiAgICAgICAgfVxuXG4gICAgICAgIGFwcGx5ID0gYXBwZW5kUGF0Y2goYXBwbHksIG5ldyBWUGF0Y2goVlBhdGNoLlJFTU9WRSwgYSwgYikpXG4gICAgfSBlbHNlIGlmIChpc1ZOb2RlKGIpKSB7XG4gICAgICAgIGlmIChpc1ZOb2RlKGEpKSB7XG4gICAgICAgICAgICBpZiAoYS50YWdOYW1lID09PSBiLnRhZ05hbWUgJiZcbiAgICAgICAgICAgICAgICBhLm5hbWVzcGFjZSA9PT0gYi5uYW1lc3BhY2UgJiZcbiAgICAgICAgICAgICAgICBhLmtleSA9PT0gYi5rZXkpIHtcbiAgICAgICAgICAgICAgICB2YXIgcHJvcHNQYXRjaCA9IGRpZmZQcm9wcyhhLnByb3BlcnRpZXMsIGIucHJvcGVydGllcylcbiAgICAgICAgICAgICAgICBpZiAocHJvcHNQYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICBhcHBseSA9IGFwcGVuZFBhdGNoKGFwcGx5LFxuICAgICAgICAgICAgICAgICAgICAgICAgbmV3IFZQYXRjaChWUGF0Y2guUFJPUFMsIGEsIHByb3BzUGF0Y2gpKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBhcHBseSA9IGRpZmZDaGlsZHJlbihhLCBiLCBwYXRjaCwgYXBwbHksIGluZGV4KVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBhcHBseSA9IGFwcGVuZFBhdGNoKGFwcGx5LCBuZXcgVlBhdGNoKFZQYXRjaC5WTk9ERSwgYSwgYikpXG4gICAgICAgICAgICAgICAgYXBwbHlDbGVhciA9IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFwcGx5ID0gYXBwZW5kUGF0Y2goYXBwbHksIG5ldyBWUGF0Y2goVlBhdGNoLlZOT0RFLCBhLCBiKSlcbiAgICAgICAgICAgIGFwcGx5Q2xlYXIgPSB0cnVlXG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGlzVlRleHQoYikpIHtcbiAgICAgICAgaWYgKCFpc1ZUZXh0KGEpKSB7XG4gICAgICAgICAgICBhcHBseSA9IGFwcGVuZFBhdGNoKGFwcGx5LCBuZXcgVlBhdGNoKFZQYXRjaC5WVEVYVCwgYSwgYikpXG4gICAgICAgICAgICBhcHBseUNsZWFyID0gdHJ1ZVxuICAgICAgICB9IGVsc2UgaWYgKGEudGV4dCAhPT0gYi50ZXh0KSB7XG4gICAgICAgICAgICBhcHBseSA9IGFwcGVuZFBhdGNoKGFwcGx5LCBuZXcgVlBhdGNoKFZQYXRjaC5WVEVYVCwgYSwgYikpXG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGlzV2lkZ2V0KGIpKSB7XG4gICAgICAgIGlmICghaXNXaWRnZXQoYSkpIHtcbiAgICAgICAgICAgIGFwcGx5Q2xlYXIgPSB0cnVlXG4gICAgICAgIH1cblxuICAgICAgICBhcHBseSA9IGFwcGVuZFBhdGNoKGFwcGx5LCBuZXcgVlBhdGNoKFZQYXRjaC5XSURHRVQsIGEsIGIpKVxuICAgIH1cblxuICAgIGlmIChhcHBseSkge1xuICAgICAgICBwYXRjaFtpbmRleF0gPSBhcHBseVxuICAgIH1cblxuICAgIGlmIChhcHBseUNsZWFyKSB7XG4gICAgICAgIGNsZWFyU3RhdGUoYSwgcGF0Y2gsIGluZGV4KVxuICAgIH1cbn1cblxuZnVuY3Rpb24gZGlmZkNoaWxkcmVuKGEsIGIsIHBhdGNoLCBhcHBseSwgaW5kZXgpIHtcbiAgICB2YXIgYUNoaWxkcmVuID0gYS5jaGlsZHJlblxuICAgIHZhciBvcmRlcmVkU2V0ID0gcmVvcmRlcihhQ2hpbGRyZW4sIGIuY2hpbGRyZW4pXG4gICAgdmFyIGJDaGlsZHJlbiA9IG9yZGVyZWRTZXQuY2hpbGRyZW5cblxuICAgIHZhciBhTGVuID0gYUNoaWxkcmVuLmxlbmd0aFxuICAgIHZhciBiTGVuID0gYkNoaWxkcmVuLmxlbmd0aFxuICAgIHZhciBsZW4gPSBhTGVuID4gYkxlbiA/IGFMZW4gOiBiTGVuXG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIHZhciBsZWZ0Tm9kZSA9IGFDaGlsZHJlbltpXVxuICAgICAgICB2YXIgcmlnaHROb2RlID0gYkNoaWxkcmVuW2ldXG4gICAgICAgIGluZGV4ICs9IDFcblxuICAgICAgICBpZiAoIWxlZnROb2RlKSB7XG4gICAgICAgICAgICBpZiAocmlnaHROb2RlKSB7XG4gICAgICAgICAgICAgICAgLy8gRXhjZXNzIG5vZGVzIGluIGIgbmVlZCB0byBiZSBhZGRlZFxuICAgICAgICAgICAgICAgIGFwcGx5ID0gYXBwZW5kUGF0Y2goYXBwbHksXG4gICAgICAgICAgICAgICAgICAgIG5ldyBWUGF0Y2goVlBhdGNoLklOU0VSVCwgbnVsbCwgcmlnaHROb2RlKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHdhbGsobGVmdE5vZGUsIHJpZ2h0Tm9kZSwgcGF0Y2gsIGluZGV4KVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzVk5vZGUobGVmdE5vZGUpICYmIGxlZnROb2RlLmNvdW50KSB7XG4gICAgICAgICAgICBpbmRleCArPSBsZWZ0Tm9kZS5jb3VudFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKG9yZGVyZWRTZXQubW92ZXMpIHtcbiAgICAgICAgLy8gUmVvcmRlciBub2RlcyBsYXN0XG4gICAgICAgIGFwcGx5ID0gYXBwZW5kUGF0Y2goYXBwbHksIG5ldyBWUGF0Y2goXG4gICAgICAgICAgICBWUGF0Y2guT1JERVIsXG4gICAgICAgICAgICBhLFxuICAgICAgICAgICAgb3JkZXJlZFNldC5tb3Zlc1xuICAgICAgICApKVxuICAgIH1cblxuICAgIHJldHVybiBhcHBseVxufVxuXG5mdW5jdGlvbiBjbGVhclN0YXRlKHZOb2RlLCBwYXRjaCwgaW5kZXgpIHtcbiAgICAvLyBUT0RPOiBNYWtlIHRoaXMgYSBzaW5nbGUgd2Fsaywgbm90IHR3b1xuICAgIHVuaG9vayh2Tm9kZSwgcGF0Y2gsIGluZGV4KVxuICAgIGRlc3Ryb3lXaWRnZXRzKHZOb2RlLCBwYXRjaCwgaW5kZXgpXG59XG5cbi8vIFBhdGNoIHJlY29yZHMgZm9yIGFsbCBkZXN0cm95ZWQgd2lkZ2V0cyBtdXN0IGJlIGFkZGVkIGJlY2F1c2Ugd2UgbmVlZFxuLy8gYSBET00gbm9kZSByZWZlcmVuY2UgZm9yIHRoZSBkZXN0cm95IGZ1bmN0aW9uXG5mdW5jdGlvbiBkZXN0cm95V2lkZ2V0cyh2Tm9kZSwgcGF0Y2gsIGluZGV4KSB7XG4gICAgaWYgKGlzV2lkZ2V0KHZOb2RlKSkge1xuICAgICAgICBpZiAodHlwZW9mIHZOb2RlLmRlc3Ryb3kgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgcGF0Y2hbaW5kZXhdID0gYXBwZW5kUGF0Y2goXG4gICAgICAgICAgICAgICAgcGF0Y2hbaW5kZXhdLFxuICAgICAgICAgICAgICAgIG5ldyBWUGF0Y2goVlBhdGNoLlJFTU9WRSwgdk5vZGUsIG51bGwpXG4gICAgICAgICAgICApXG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGlzVk5vZGUodk5vZGUpICYmICh2Tm9kZS5oYXNXaWRnZXRzIHx8IHZOb2RlLmhhc1RodW5rcykpIHtcbiAgICAgICAgdmFyIGNoaWxkcmVuID0gdk5vZGUuY2hpbGRyZW5cbiAgICAgICAgdmFyIGxlbiA9IGNoaWxkcmVuLmxlbmd0aFxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgY2hpbGQgPSBjaGlsZHJlbltpXVxuICAgICAgICAgICAgaW5kZXggKz0gMVxuXG4gICAgICAgICAgICBkZXN0cm95V2lkZ2V0cyhjaGlsZCwgcGF0Y2gsIGluZGV4KVxuXG4gICAgICAgICAgICBpZiAoaXNWTm9kZShjaGlsZCkgJiYgY2hpbGQuY291bnQpIHtcbiAgICAgICAgICAgICAgICBpbmRleCArPSBjaGlsZC5jb3VudFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChpc1RodW5rKHZOb2RlKSkge1xuICAgICAgICB0aHVua3Modk5vZGUsIG51bGwsIHBhdGNoLCBpbmRleClcbiAgICB9XG59XG5cbi8vIENyZWF0ZSBhIHN1Yi1wYXRjaCBmb3IgdGh1bmtzXG5mdW5jdGlvbiB0aHVua3MoYSwgYiwgcGF0Y2gsIGluZGV4KSB7XG4gICAgdmFyIG5vZGVzID0gaGFuZGxlVGh1bmsoYSwgYilcbiAgICB2YXIgdGh1bmtQYXRjaCA9IGRpZmYobm9kZXMuYSwgbm9kZXMuYilcbiAgICBpZiAoaGFzUGF0Y2hlcyh0aHVua1BhdGNoKSkge1xuICAgICAgICBwYXRjaFtpbmRleF0gPSBuZXcgVlBhdGNoKFZQYXRjaC5USFVOSywgbnVsbCwgdGh1bmtQYXRjaClcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGhhc1BhdGNoZXMocGF0Y2gpIHtcbiAgICBmb3IgKHZhciBpbmRleCBpbiBwYXRjaCkge1xuICAgICAgICBpZiAoaW5kZXggIT09IFwiYVwiKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlXG59XG5cbi8vIEV4ZWN1dGUgaG9va3Mgd2hlbiB0d28gbm9kZXMgYXJlIGlkZW50aWNhbFxuZnVuY3Rpb24gdW5ob29rKHZOb2RlLCBwYXRjaCwgaW5kZXgpIHtcbiAgICBpZiAoaXNWTm9kZSh2Tm9kZSkpIHtcbiAgICAgICAgaWYgKHZOb2RlLmhvb2tzKSB7XG4gICAgICAgICAgICBwYXRjaFtpbmRleF0gPSBhcHBlbmRQYXRjaChcbiAgICAgICAgICAgICAgICBwYXRjaFtpbmRleF0sXG4gICAgICAgICAgICAgICAgbmV3IFZQYXRjaChcbiAgICAgICAgICAgICAgICAgICAgVlBhdGNoLlBST1BTLFxuICAgICAgICAgICAgICAgICAgICB2Tm9kZSxcbiAgICAgICAgICAgICAgICAgICAgdW5kZWZpbmVkS2V5cyh2Tm9kZS5ob29rcylcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICApXG4gICAgICAgIH1cblxuICAgICAgICBpZiAodk5vZGUuZGVzY2VuZGFudEhvb2tzIHx8IHZOb2RlLmhhc1RodW5rcykge1xuICAgICAgICAgICAgdmFyIGNoaWxkcmVuID0gdk5vZGUuY2hpbGRyZW5cbiAgICAgICAgICAgIHZhciBsZW4gPSBjaGlsZHJlbi5sZW5ndGhcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgY2hpbGQgPSBjaGlsZHJlbltpXVxuICAgICAgICAgICAgICAgIGluZGV4ICs9IDFcblxuICAgICAgICAgICAgICAgIHVuaG9vayhjaGlsZCwgcGF0Y2gsIGluZGV4KVxuXG4gICAgICAgICAgICAgICAgaWYgKGlzVk5vZGUoY2hpbGQpICYmIGNoaWxkLmNvdW50KSB7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4ICs9IGNoaWxkLmNvdW50XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChpc1RodW5rKHZOb2RlKSkge1xuICAgICAgICB0aHVua3Modk5vZGUsIG51bGwsIHBhdGNoLCBpbmRleClcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHVuZGVmaW5lZEtleXMob2JqKSB7XG4gICAgdmFyIHJlc3VsdCA9IHt9XG5cbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSB7XG4gICAgICAgIHJlc3VsdFtrZXldID0gdW5kZWZpbmVkXG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdFxufVxuXG4vLyBMaXN0IGRpZmYsIG5haXZlIGxlZnQgdG8gcmlnaHQgcmVvcmRlcmluZ1xuZnVuY3Rpb24gcmVvcmRlcihhQ2hpbGRyZW4sIGJDaGlsZHJlbikge1xuICAgIC8vIE8oTSkgdGltZSwgTyhNKSBtZW1vcnlcbiAgICB2YXIgYkNoaWxkSW5kZXggPSBrZXlJbmRleChiQ2hpbGRyZW4pXG4gICAgdmFyIGJLZXlzID0gYkNoaWxkSW5kZXgua2V5c1xuICAgIHZhciBiRnJlZSA9IGJDaGlsZEluZGV4LmZyZWVcblxuICAgIGlmIChiRnJlZS5sZW5ndGggPT09IGJDaGlsZHJlbi5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGNoaWxkcmVuOiBiQ2hpbGRyZW4sXG4gICAgICAgICAgICBtb3ZlczogbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gTyhOKSB0aW1lLCBPKE4pIG1lbW9yeVxuICAgIHZhciBhQ2hpbGRJbmRleCA9IGtleUluZGV4KGFDaGlsZHJlbilcbiAgICB2YXIgYUtleXMgPSBhQ2hpbGRJbmRleC5rZXlzXG4gICAgdmFyIGFGcmVlID0gYUNoaWxkSW5kZXguZnJlZVxuXG4gICAgaWYgKGFGcmVlLmxlbmd0aCA9PT0gYUNoaWxkcmVuLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY2hpbGRyZW46IGJDaGlsZHJlbixcbiAgICAgICAgICAgIG1vdmVzOiBudWxsXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBPKE1BWChOLCBNKSkgbWVtb3J5XG4gICAgdmFyIG5ld0NoaWxkcmVuID0gW11cblxuICAgIHZhciBmcmVlSW5kZXggPSAwXG4gICAgdmFyIGZyZWVDb3VudCA9IGJGcmVlLmxlbmd0aFxuICAgIHZhciBkZWxldGVkSXRlbXMgPSAwXG5cbiAgICAvLyBJdGVyYXRlIHRocm91Z2ggYSBhbmQgbWF0Y2ggYSBub2RlIGluIGJcbiAgICAvLyBPKE4pIHRpbWUsXG4gICAgZm9yICh2YXIgaSA9IDAgOyBpIDwgYUNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBhSXRlbSA9IGFDaGlsZHJlbltpXVxuICAgICAgICB2YXIgaXRlbUluZGV4XG5cbiAgICAgICAgaWYgKGFJdGVtLmtleSkge1xuICAgICAgICAgICAgaWYgKGJLZXlzLmhhc093blByb3BlcnR5KGFJdGVtLmtleSkpIHtcbiAgICAgICAgICAgICAgICAvLyBNYXRjaCB1cCB0aGUgb2xkIGtleXNcbiAgICAgICAgICAgICAgICBpdGVtSW5kZXggPSBiS2V5c1thSXRlbS5rZXldXG4gICAgICAgICAgICAgICAgbmV3Q2hpbGRyZW4ucHVzaChiQ2hpbGRyZW5baXRlbUluZGV4XSlcblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBSZW1vdmUgb2xkIGtleWVkIGl0ZW1zXG4gICAgICAgICAgICAgICAgaXRlbUluZGV4ID0gaSAtIGRlbGV0ZWRJdGVtcysrXG4gICAgICAgICAgICAgICAgbmV3Q2hpbGRyZW4ucHVzaChudWxsKVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gTWF0Y2ggdGhlIGl0ZW0gaW4gYSB3aXRoIHRoZSBuZXh0IGZyZWUgaXRlbSBpbiBiXG4gICAgICAgICAgICBpZiAoZnJlZUluZGV4IDwgZnJlZUNvdW50KSB7XG4gICAgICAgICAgICAgICAgaXRlbUluZGV4ID0gYkZyZWVbZnJlZUluZGV4KytdXG4gICAgICAgICAgICAgICAgbmV3Q2hpbGRyZW4ucHVzaChiQ2hpbGRyZW5baXRlbUluZGV4XSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gVGhlcmUgYXJlIG5vIGZyZWUgaXRlbXMgaW4gYiB0byBtYXRjaCB3aXRoXG4gICAgICAgICAgICAgICAgLy8gdGhlIGZyZWUgaXRlbXMgaW4gYSwgc28gdGhlIGV4dHJhIGZyZWUgbm9kZXNcbiAgICAgICAgICAgICAgICAvLyBhcmUgZGVsZXRlZC5cbiAgICAgICAgICAgICAgICBpdGVtSW5kZXggPSBpIC0gZGVsZXRlZEl0ZW1zKytcbiAgICAgICAgICAgICAgICBuZXdDaGlsZHJlbi5wdXNoKG51bGwpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgbGFzdEZyZWVJbmRleCA9IGZyZWVJbmRleCA+PSBiRnJlZS5sZW5ndGggP1xuICAgICAgICBiQ2hpbGRyZW4ubGVuZ3RoIDpcbiAgICAgICAgYkZyZWVbZnJlZUluZGV4XVxuXG4gICAgLy8gSXRlcmF0ZSB0aHJvdWdoIGIgYW5kIGFwcGVuZCBhbnkgbmV3IGtleXNcbiAgICAvLyBPKE0pIHRpbWVcbiAgICBmb3IgKHZhciBqID0gMDsgaiA8IGJDaGlsZHJlbi5sZW5ndGg7IGorKykge1xuICAgICAgICB2YXIgbmV3SXRlbSA9IGJDaGlsZHJlbltqXVxuXG4gICAgICAgIGlmIChuZXdJdGVtLmtleSkge1xuICAgICAgICAgICAgaWYgKCFhS2V5cy5oYXNPd25Qcm9wZXJ0eShuZXdJdGVtLmtleSkpIHtcbiAgICAgICAgICAgICAgICAvLyBBZGQgYW55IG5ldyBrZXllZCBpdGVtc1xuICAgICAgICAgICAgICAgIC8vIFdlIGFyZSBhZGRpbmcgbmV3IGl0ZW1zIHRvIHRoZSBlbmQgYW5kIHRoZW4gc29ydGluZyB0aGVtXG4gICAgICAgICAgICAgICAgLy8gaW4gcGxhY2UuIEluIGZ1dHVyZSB3ZSBzaG91bGQgaW5zZXJ0IG5ldyBpdGVtcyBpbiBwbGFjZS5cbiAgICAgICAgICAgICAgICBuZXdDaGlsZHJlbi5wdXNoKG5ld0l0ZW0pXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoaiA+PSBsYXN0RnJlZUluZGV4KSB7XG4gICAgICAgICAgICAvLyBBZGQgYW55IGxlZnRvdmVyIG5vbi1rZXllZCBpdGVtc1xuICAgICAgICAgICAgbmV3Q2hpbGRyZW4ucHVzaChuZXdJdGVtKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgdmFyIHNpbXVsYXRlID0gbmV3Q2hpbGRyZW4uc2xpY2UoKVxuICAgIHZhciBzaW11bGF0ZUluZGV4ID0gMFxuICAgIHZhciByZW1vdmVzID0gW11cbiAgICB2YXIgaW5zZXJ0cyA9IFtdXG4gICAgdmFyIHNpbXVsYXRlSXRlbVxuXG4gICAgZm9yICh2YXIgayA9IDA7IGsgPCBiQ2hpbGRyZW4ubGVuZ3RoOykge1xuICAgICAgICB2YXIgd2FudGVkSXRlbSA9IGJDaGlsZHJlbltrXVxuICAgICAgICBzaW11bGF0ZUl0ZW0gPSBzaW11bGF0ZVtzaW11bGF0ZUluZGV4XVxuXG4gICAgICAgIC8vIHJlbW92ZSBpdGVtc1xuICAgICAgICB3aGlsZSAoc2ltdWxhdGVJdGVtID09PSBudWxsICYmIHNpbXVsYXRlLmxlbmd0aCkge1xuICAgICAgICAgICAgcmVtb3Zlcy5wdXNoKHJlbW92ZShzaW11bGF0ZSwgc2ltdWxhdGVJbmRleCwgbnVsbCkpXG4gICAgICAgICAgICBzaW11bGF0ZUl0ZW0gPSBzaW11bGF0ZVtzaW11bGF0ZUluZGV4XVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFzaW11bGF0ZUl0ZW0gfHwgc2ltdWxhdGVJdGVtLmtleSAhPT0gd2FudGVkSXRlbS5rZXkpIHtcbiAgICAgICAgICAgIC8vIGlmIHdlIG5lZWQgYSBrZXkgaW4gdGhpcyBwb3NpdGlvbi4uLlxuICAgICAgICAgICAgaWYgKHdhbnRlZEl0ZW0ua2V5KSB7XG4gICAgICAgICAgICAgICAgaWYgKHNpbXVsYXRlSXRlbSAmJiBzaW11bGF0ZUl0ZW0ua2V5KSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGlmIGFuIGluc2VydCBkb2Vzbid0IHB1dCB0aGlzIGtleSBpbiBwbGFjZSwgaXQgbmVlZHMgdG8gbW92ZVxuICAgICAgICAgICAgICAgICAgICBpZiAoYktleXNbc2ltdWxhdGVJdGVtLmtleV0gIT09IGsgKyAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVzLnB1c2gocmVtb3ZlKHNpbXVsYXRlLCBzaW11bGF0ZUluZGV4LCBzaW11bGF0ZUl0ZW0ua2V5KSlcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpbXVsYXRlSXRlbSA9IHNpbXVsYXRlW3NpbXVsYXRlSW5kZXhdXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBpZiB0aGUgcmVtb3ZlIGRpZG4ndCBwdXQgdGhlIHdhbnRlZCBpdGVtIGluIHBsYWNlLCB3ZSBuZWVkIHRvIGluc2VydCBpdFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFzaW11bGF0ZUl0ZW0gfHwgc2ltdWxhdGVJdGVtLmtleSAhPT0gd2FudGVkSXRlbS5rZXkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbnNlcnRzLnB1c2goe2tleTogd2FudGVkSXRlbS5rZXksIHRvOiBrfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGl0ZW1zIGFyZSBtYXRjaGluZywgc28gc2tpcCBhaGVhZFxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2ltdWxhdGVJbmRleCsrXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnNlcnRzLnB1c2goe2tleTogd2FudGVkSXRlbS5rZXksIHRvOiBrfSlcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaW5zZXJ0cy5wdXNoKHtrZXk6IHdhbnRlZEl0ZW0ua2V5LCB0bzoga30pXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGsrK1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gYSBrZXkgaW4gc2ltdWxhdGUgaGFzIG5vIG1hdGNoaW5nIHdhbnRlZCBrZXksIHJlbW92ZSBpdFxuICAgICAgICAgICAgZWxzZSBpZiAoc2ltdWxhdGVJdGVtICYmIHNpbXVsYXRlSXRlbS5rZXkpIHtcbiAgICAgICAgICAgICAgICByZW1vdmVzLnB1c2gocmVtb3ZlKHNpbXVsYXRlLCBzaW11bGF0ZUluZGV4LCBzaW11bGF0ZUl0ZW0ua2V5KSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHNpbXVsYXRlSW5kZXgrK1xuICAgICAgICAgICAgaysrXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyByZW1vdmUgYWxsIHRoZSByZW1haW5pbmcgbm9kZXMgZnJvbSBzaW11bGF0ZVxuICAgIHdoaWxlKHNpbXVsYXRlSW5kZXggPCBzaW11bGF0ZS5sZW5ndGgpIHtcbiAgICAgICAgc2ltdWxhdGVJdGVtID0gc2ltdWxhdGVbc2ltdWxhdGVJbmRleF1cbiAgICAgICAgcmVtb3Zlcy5wdXNoKHJlbW92ZShzaW11bGF0ZSwgc2ltdWxhdGVJbmRleCwgc2ltdWxhdGVJdGVtICYmIHNpbXVsYXRlSXRlbS5rZXkpKVxuICAgIH1cblxuICAgIC8vIElmIHRoZSBvbmx5IG1vdmVzIHdlIGhhdmUgYXJlIGRlbGV0ZXMgdGhlbiB3ZSBjYW4ganVzdFxuICAgIC8vIGxldCB0aGUgZGVsZXRlIHBhdGNoIHJlbW92ZSB0aGVzZSBpdGVtcy5cbiAgICBpZiAocmVtb3Zlcy5sZW5ndGggPT09IGRlbGV0ZWRJdGVtcyAmJiAhaW5zZXJ0cy5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGNoaWxkcmVuOiBuZXdDaGlsZHJlbixcbiAgICAgICAgICAgIG1vdmVzOiBudWxsXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBjaGlsZHJlbjogbmV3Q2hpbGRyZW4sXG4gICAgICAgIG1vdmVzOiB7XG4gICAgICAgICAgICByZW1vdmVzOiByZW1vdmVzLFxuICAgICAgICAgICAgaW5zZXJ0czogaW5zZXJ0c1xuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiByZW1vdmUoYXJyLCBpbmRleCwga2V5KSB7XG4gICAgYXJyLnNwbGljZShpbmRleCwgMSlcblxuICAgIHJldHVybiB7XG4gICAgICAgIGZyb206IGluZGV4LFxuICAgICAgICBrZXk6IGtleVxuICAgIH1cbn1cblxuZnVuY3Rpb24ga2V5SW5kZXgoY2hpbGRyZW4pIHtcbiAgICB2YXIga2V5cyA9IHt9XG4gICAgdmFyIGZyZWUgPSBbXVxuICAgIHZhciBsZW5ndGggPSBjaGlsZHJlbi5sZW5ndGhcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGNoaWxkID0gY2hpbGRyZW5baV1cblxuICAgICAgICBpZiAoY2hpbGQua2V5KSB7XG4gICAgICAgICAgICBrZXlzW2NoaWxkLmtleV0gPSBpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmcmVlLnB1c2goaSlcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIGtleXM6IGtleXMsICAgICAvLyBBIGhhc2ggb2Yga2V5IG5hbWUgdG8gaW5kZXhcbiAgICAgICAgZnJlZTogZnJlZSAgICAgIC8vIEFuIGFycmF5IG9mIHVua2V5ZWQgaXRlbSBpbmRpY2VzXG4gICAgfVxufVxuXG5mdW5jdGlvbiBhcHBlbmRQYXRjaChhcHBseSwgcGF0Y2gpIHtcbiAgICBpZiAoYXBwbHkpIHtcbiAgICAgICAgaWYgKGlzQXJyYXkoYXBwbHkpKSB7XG4gICAgICAgICAgICBhcHBseS5wdXNoKHBhdGNoKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXBwbHkgPSBbYXBwbHksIHBhdGNoXVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGFwcGx5XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHBhdGNoXG4gICAgfVxufVxuIiwidmFyIG5hdGl2ZUlzQXJyYXkgPSBBcnJheS5pc0FycmF5XG52YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nXG5cbm1vZHVsZS5leHBvcnRzID0gbmF0aXZlSXNBcnJheSB8fCBpc0FycmF5XG5cbmZ1bmN0aW9uIGlzQXJyYXkob2JqKSB7XG4gICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwob2JqKSA9PT0gXCJbb2JqZWN0IEFycmF5XVwiXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIGltbXV0YWJsZSA9IHJlcXVpcmUoJ2ltbXV0YWJpbGlzJyk7XG4gICAgdmFyIEFwcGxpY2F0dXMgPSByZXF1aXJlKCdhbGNoZW15LmpzL2xpYi9BcHBsaWNhdHVzJyk7XG4gICAgdmFyIE5hdmlnYXRpb25Db250cm9sbGVyID0gcmVxdWlyZSgnLi9jb250cm9sbGVyL05hdmlnYXRpb24nKTtcblxuICAgIC8qKlxuICAgICAqIEBjbGFzc1xuICAgICAqIEBuYW1lIGNvcmUuQXBwXG4gICAgICogQGV4dGVuZHMgYWxjaGVteS53ZWIuQXBwbGljYXR1c1xuICAgICAqL1xuICAgIHJldHVybiBBcHBsaWNhdHVzLmV4dGVuZCh7XG4gICAgICAgIC8qKiBAbGVuZHMgY29yZS5BcHAucHJvdG90eXBlICovXG5cbiAgICAgICAgLyoqIEBvdmVycmlkZSAqL1xuICAgICAgICBvbkxhdW5jaDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy53aXJlVXAoTmF2aWdhdGlvbkNvbnRyb2xsZXIuYnJldygpKTtcbiAgICAgICAgICAgIHRoaXMudWkuaW5pdCh0aGlzLnN0YXRlKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKiogQG92ZXJyaWRlICovXG4gICAgICAgIHVwZGF0ZTogZnVuY3Rpb24gKHApIHtcbiAgICAgICAgICAgIHZhciBzdGF0ZSA9IHAuc3RhdGVcbiAgICAgICAgICAgICAgICAuc2V0KCd3aW5kb3dXaWR0aCcsIHdpbmRvdy5pbm5lcldpZHRoKVxuICAgICAgICAgICAgICAgIC5zZXQoJ3dpbmRvd0hlaWdodCcsIHdpbmRvdy5pbm5lckhlaWdodCk7XG5cbiAgICAgICAgICAgIHRoaXMudWkudXBkYXRlKHN0YXRlKTtcblxuICAgICAgICAgICAgcmV0dXJuIHN0YXRlO1xuXG4gICAgICAgIH0sXG5cbiAgICB9KS53aGVuQnJld2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IGltbXV0YWJsZS5mcm9tSlMoe1xuICAgICAgICAgICAgbW9kZTogJ3ByZXNlbnRhdGlvbicsXG4gICAgICAgICAgICBjdXJyZW50SW5kZXg6IDAsXG4gICAgICAgICAgICBudW1PZlNsaWRlczogMCxcbiAgICAgICAgICAgIGVtYWlsOiAnbWljaGFlbC5idWV0dG5lckBmbHllcmFsYXJtLmNvbSdcbiAgICAgICAgfSk7XG4gICAgfSk7XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBjb3F1b1ZlbmVudW0gPSByZXF1aXJlKCdjb3F1by12ZW5lbnVtJyk7XG4gICAgdmFyIGVhY2ggPSByZXF1aXJlKCdwcm8tc2luZ3VsaXMnKTtcbiAgICB2YXIgVXRpbHMgPSByZXF1aXJlKCdhbGNoZW15LmpzL2xpYi9VdGlscycpO1xuICAgIHZhciBBZG1pbmlzdHJhdG9yID0gcmVxdWlyZSgnYWxjaGVteS5qcy9saWIvQWRtaW5pc3RyYXRvcicpO1xuICAgIHZhciBBcG90aGVjYXJpdXMgPSByZXF1aXJlKCdhbGNoZW15LmpzL2xpYi9BcG90aGVjYXJpdXMnKTtcbiAgICB2YXIgRGVsZWdhdHVzID0gcmVxdWlyZSgnYWxjaGVteS5qcy9saWIvRGVsZWdhdHVzJyk7XG4gICAgdmFyIFN0eWx1cyA9IHJlcXVpcmUoJ2FsY2hlbXkuanMvbGliL1N0eWx1cycpO1xuICAgIHZhciBTdGF0ZVN5c3RlbSA9IHJlcXVpcmUoJ2FsY2hlbXkuanMvbGliL1N0YXRlU3lzdGVtJyk7XG4gICAgdmFyIEV2ZW50U3lzdGVtID0gcmVxdWlyZSgnYWxjaGVteS5qcy9saWIvRXZlbnRTeXN0ZW0nKTtcbiAgICB2YXIgQ3NzUmVuZGVyU3lzdGVtID0gcmVxdWlyZSgnYWxjaGVteS5qcy9saWIvQ3NzUmVuZGVyU3lzdGVtJyk7XG4gICAgdmFyIFZEb21SZW5kZXJTeXN0ZW0gPSByZXF1aXJlKCdhbGNoZW15LmpzL2xpYi9WRG9tUmVuZGVyU3lzdGVtJyk7XG4gICAgdmFyIFZpZXdwb3J0ID0gcmVxdWlyZSgnLi91aS9WaWV3cG9ydCcpO1xuXG4gICAgcmV0dXJuIGNvcXVvVmVuZW51bSh7XG5cbiAgICAgICAgLyoqIEBwcm90ZWN0ZWQgKi9cbiAgICAgICAgbWVzc2FnZXM6IHVuZGVmaW5lZCxcblxuICAgICAgICAvKiogQHByb3RlY3RlZCAqL1xuICAgICAgICBhZG1pbjogdW5kZWZpbmVkLFxuXG4gICAgICAgIC8qKiBAcHJvdGVjdGVkICovXG4gICAgICAgIGRlbGVnYXRvcjogdW5kZWZpbmVkLFxuXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uIChzdGF0ZSkge1xuICAgICAgICAgICAgdGhpcy5pbml0U3lzdGVtcygpO1xuICAgICAgICAgICAgdGhpcy5pbml0RW50aXRpZXMoc3RhdGUpO1xuICAgICAgICB9LFxuXG4gICAgICAgIHVwZGF0ZTogZnVuY3Rpb24gKHN0YXRlKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5hZG1pbi51cGRhdGUoc3RhdGUpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8vXG4gICAgICAgIC8vIHByaXZhdGVcbiAgICAgICAgLy9cblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgaW5pdFN5c3RlbXM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGVhY2goW1xuICAgICAgICAgICAgICAgIFN0YXRlU3lzdGVtLFxuICAgICAgICAgICAgICAgIEV2ZW50U3lzdGVtLFxuICAgICAgICAgICAgICAgIENzc1JlbmRlclN5c3RlbSxcbiAgICAgICAgICAgICAgICBWRG9tUmVuZGVyU3lzdGVtLFxuXG4gICAgICAgICAgICBdLCBmdW5jdGlvbiAoU3lzdGVtKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hZG1pbi5hZGRTeXN0ZW0oU3lzdGVtLmJyZXcoe1xuICAgICAgICAgICAgICAgICAgICBkZWxlZ2F0b3I6IHRoaXMuZGVsZWdhdG9yLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlczogdGhpcy5tZXNzYWdlcyxcbiAgICAgICAgICAgICAgICAgICAgc3R5bHVzOiB0aGlzLnN0eWx1cyxcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9LCB0aGlzKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgaW5pdEVudGl0aWVzOiBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgICAgICAgICAgIHRoaXMuYWRtaW4uaW5pdEVudGl0aWVzKFtVdGlscy5tZWx0KFZpZXdwb3J0LCB7XG4gICAgICAgICAgICAgICAgaWQ6ICd2aWV3cG9ydCcsXG4gICAgICAgICAgICAgICAgY2hpbGRyZW46IHRoaXMuc2xpZGVzLFxuICAgICAgICAgICAgfSldLCBzdGF0ZSk7XG4gICAgICAgIH0sXG5cbiAgICB9KS53aGVuQnJld2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5kZWxlZ2F0b3IgPSBEZWxlZ2F0dXMuYnJldygpO1xuICAgICAgICB0aGlzLnN0eWx1cyA9IFN0eWx1cy5icmV3KCk7XG4gICAgICAgIHRoaXMuYWRtaW4gPSBBZG1pbmlzdHJhdG9yLmJyZXcoe1xuICAgICAgICAgICAgcmVwbzogQXBvdGhlY2FyaXVzLmJyZXcoKVxuICAgICAgICB9KTtcbiAgICB9KTtcbn0oKSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIGNvcXVvVmVuZW51bSA9IHJlcXVpcmUoJ2NvcXVvLXZlbmVudW0nKTtcblxuICAgIC8qKlxuICAgICAqIERlc2NyaXB0aW9uXG4gICAgICpcbiAgICAgKiBAY2xhc3NcbiAgICAgKiBAbmFtZSBjb3JlLmNvbnRyb2xsZXIuTmF2aWdhdGlvblxuICAgICAqL1xuICAgIHJldHVybiBjb3F1b1ZlbmVudW0oe1xuICAgICAgICAvKiogQGxlbmRzIGNvcmUuY29udHJvbGxlci5OYXZpZ2F0aW9uLnByb3RvdHlwZSAqL1xuXG4gICAgICAgIG1lc3NhZ2VzOiB7XG4gICAgICAgICAgICAnbmF2aWdhdGlvbjpuZXh0JzogJ29uTmV4dFNsaWRlJyxcbiAgICAgICAgICAgICduYXZpZ2F0aW9uOnByZXYnOiAnb25QcmV2U2xpZGUnLFxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICBvbk5leHRTbGlkZTogZnVuY3Rpb24gKHN0YXRlKSB7XG4gICAgICAgICAgICB2YXIgY3VycmVudCA9IHN0YXRlLnZhbCgnY3VycmVudEluZGV4Jyk7XG4gICAgICAgICAgICBpZiAoY3VycmVudCA8IHN0YXRlLnZhbCgnbnVtT2ZTbGlkZXMnKSAtIDEpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3RhdGUuc2V0KCdjdXJyZW50SW5kZXgnLCBjdXJyZW50ICsgMSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBzdGF0ZTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgb25QcmV2U2xpZGU6IGZ1bmN0aW9uIChzdGF0ZSkge1xuICAgICAgICAgICAgdmFyIGN1cnJlbnQgPSBzdGF0ZS52YWwoJ2N1cnJlbnRJbmRleCcpO1xuICAgICAgICAgICAgaWYgKGN1cnJlbnQgPiAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN0YXRlLnNldCgnY3VycmVudEluZGV4JywgY3VycmVudCAtIDEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gc3RhdGU7XG4gICAgICAgIH0sXG4gICAgfSk7XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBVdGlscyA9IHJlcXVpcmUoJ2FsY2hlbXkuanMvbGliL1V0aWxzJyk7XG5cbiAgICByZXR1cm4gZnVuY3Rpb24gdGV4dCh0eHQsIGVudGl0eUNzcywgbW9yZSkge1xuICAgICAgICByZXR1cm4gVXRpbHMubWVsdCh7XG4gICAgICAgICAgICBzdGF0ZToge1xuICAgICAgICAgICAgICAgIHRleHQ6IHR4dFxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgdmRvbToge1xuICAgICAgICAgICAgICAgIHJlbmRlcmVyOiBmdW5jdGlvbiAoY3R4KSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzID0gY3R4LnN0YXRlO1xuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjdHguaCgnZGl2Jywge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lOiAndGV4dCBiaWcgJyArIChzLnZhbCgnY2xhc3NOYW1lJykgfHwgJycpLFxuICAgICAgICAgICAgICAgICAgICAgICAgaWQ6IGN0eC5lbnRpdHlJZCxcbiAgICAgICAgICAgICAgICAgICAgfSwgcy52YWwoJ3RleHQnKSk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGNzczoge1xuICAgICAgICAgICAgICAgIGVudGl0eVJ1bGVzOiBlbnRpdHlDc3MsXG5cbiAgICAgICAgICAgICAgICB0eXBlUnVsZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgJy50ZXh0Jzoge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGFkZGluZzogJzAgNDBweCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXJnaW46ICcyMHB4IDAnLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICB9LCBtb3JlKTtcbiAgICB9O1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgVXRpbHMgPSByZXF1aXJlKCdhbGNoZW15LmpzL2xpYi9VdGlscycpO1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uIHNsaWRlKHRpdGxlLCBjaGlsZHJlbiwgbW9yZSkge1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh0aXRsZSkpIHtcbiAgICAgICAgICAgIG1vcmUgPSBjaGlsZHJlbjtcbiAgICAgICAgICAgIGNoaWxkcmVuID0gdGl0bGU7XG4gICAgICAgICAgICB0aXRsZSA9ICcnO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIFV0aWxzLm1lbHQoe1xuICAgICAgICAgICAgZ2xvYmFsVG9Mb2NhbDoge1xuICAgICAgICAgICAgICAgIG1vZGU6ICdtb2RlJyxcbiAgICAgICAgICAgICAgICB3aW5kb3dXaWR0aDogJ3dpbmRvd1dpZHRoJyxcbiAgICAgICAgICAgICAgICB3aW5kb3dIZWlnaHQ6ICd3aW5kb3dIZWlnaHQnLFxuICAgICAgICAgICAgICAgIGN1cnJlbnRJbmRleDogJ2N1cnJlbnRJbmRleCdcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHN0YXRlOiB7XG4gICAgICAgICAgICAgICAgdGl0bGU6IHRpdGxlLFxuICAgICAgICAgICAgICAgIGluZGV4OiAwLFxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgdmRvbToge1xuICAgICAgICAgICAgICAgIHJlbmRlcmVyOiBmdW5jdGlvbiAoY3R4KSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBoID0gY3R4Lmg7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzID0gY3R4LnN0YXRlLnZhbCgpO1xuICAgICAgICAgICAgICAgICAgICB2YXIgaXNBY3RpdmUgPSBzLm1vZGUgPT09ICdwcmludCcgfHwgcy5jdXJyZW50SW5kZXggPT09IHMuaW5kZXg7XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGgoJ2Rpdi5zbGlkZScsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkOiBjdHguZW50aXR5SWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBrZXk6IGN0eC5lbnRpdHlJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZTogaXNBY3RpdmUgPyAnYWN0aXZlJyA6ICdoaWRkZW4nLFxuICAgICAgICAgICAgICAgICAgICB9LCBbXG4gICAgICAgICAgICAgICAgICAgICAgICBoKCdkaXYuc2xpZGUtdGl0bGUnLCBjdHguc3RhdGUudmFsKCd0aXRsZScpKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGgoJ2Rpdi5zbGlkZS1pbm5lcicsIGN0eC5yZW5kZXJBbGxDaGlsZHJlbigpKSxcbiAgICAgICAgICAgICAgICAgICAgXSk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGNzczoge1xuICAgICAgICAgICAgICAgIGVudGl0eVJ1bGVzOiBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN0YXRlLnZhbCgnbW9kZScpID09PSAncHJpbnQnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxlZnQ6IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIGluZGV4ID0gc3RhdGUudmFsKCdpbmRleCcpO1xuICAgICAgICAgICAgICAgICAgICB2YXIgY0luZGV4ID0gc3RhdGUudmFsKCdjdXJyZW50SW5kZXgnKTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHdpZHRoID0gc3RhdGUudmFsKCd3aW5kb3dXaWR0aCcpO1xuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZWZ0OiAoaW5kZXggLSBjSW5kZXgpICogd2lkdGggKyAncHgnLFxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICB0eXBlUnVsZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgJy5zbGlkZSc6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uOiAnYWJzb2x1dGUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgdG9wOiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgbGVmdDogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHdpZHRoOiAnMTAwJScsXG4gICAgICAgICAgICAgICAgICAgICAgICBoZWlnaHQ6ICcxMDAlJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRpc3BsYXk6ICd0YWJsZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAndGV4dC1hbGlnbic6ICdjZW50ZXInLFxuXG4gICAgICAgICAgICAgICAgICAgICAgICAnLnNsaWRlLXRpdGxlJzoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uOiAnYWJzb2x1dGUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvcDogJzIwcHgnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxlZnQ6ICcyMHB4JyxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICcuc2xpZGUtaW5uZXInOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2lkdGg6ICcxMDAlJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkaXNwbGF5OiAndGFibGUtY2VsbCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3ZlcnRpY2FsLWFsaWduJzogJ21pZGRsZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNpdGlvbjogJ29wYWNpdHkgMC4ycyBlYXNlLWluLW91dCcsXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgICAgICAgICcuc2xpZGUuYWN0aXZlJzoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNpdGlvbjogJ2xlZnQgMC4ycyBzdGVwLXN0YXJ0JyxcbiAgICAgICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgICAgICAnLnNsaWRlLmhpZGRlbic6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyYW5zaXRpb246ICdsZWZ0IDAuMnMgbGluZWFyJyxcbiAgICAgICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgICAgICAnLnNsaWRlLmhpZGRlbiAuc2xpZGUtdGl0bGUnOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2aXNpYmlsaXR5OiAnaGlkZGVuJyxcbiAgICAgICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgICAgICAnLnNsaWRlLmhpZGRlbiAuc2xpZGUtaW5uZXInOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcGFjaXR5OiAwLFxuICAgICAgICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgICAgICAgICcucHJpbnQgLnNsaWRlJzoge1xuICAgICAgICAgICAgICAgICAgICAgICAgcG9zaXRpb246ICdyZWxhdGl2ZScsXG4gICAgICAgICAgICAgICAgICAgICAgICB3aWR0aDogJzQyMG1tJywgLy8gRElOIEEzIChJU08gMjE2KSBsYW5kc2NhcGVcbiAgICAgICAgICAgICAgICAgICAgICAgIGhlaWdodDogJzI5N21tJyxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgY2hpbGRyZW46IGNoaWxkcmVuLFxuICAgICAgICB9LCBtb3JlKTtcbiAgICB9O1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgVXRpbHMgPSByZXF1aXJlKCdhbGNoZW15LmpzL2xpYi9VdGlscycpO1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uIHRleHQodHh0LCBlbnRpdHlDc3MsIG1vcmUpIHtcbiAgICAgICAgcmV0dXJuIFV0aWxzLm1lbHQoe1xuICAgICAgICAgICAgc3RhdGU6IHtcbiAgICAgICAgICAgICAgICB0ZXh0OiB0eHRcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHZkb206IHtcbiAgICAgICAgICAgICAgICByZW5kZXJlcjogZnVuY3Rpb24gKGN0eCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcyA9IGN0eC5zdGF0ZTtcblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY3R4LmgoJ2RpdicsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZTogJ3RleHQgJyArIChzLnZhbCgnY2xhc3NOYW1lJykgfHwgJycpLFxuICAgICAgICAgICAgICAgICAgICAgICAgaWQ6IGN0eC5lbnRpdHlJZCxcbiAgICAgICAgICAgICAgICAgICAgfSwgcy52YWwoJ3RleHQnKSk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGNzczoge1xuICAgICAgICAgICAgICAgIGVudGl0eVJ1bGVzOiBlbnRpdHlDc3MsXG5cbiAgICAgICAgICAgICAgICB0eXBlUnVsZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgJy50ZXh0Jzoge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGFkZGluZzogJzAgNDBweCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXJnaW46ICcyMHB4IDAnLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICB9LCBtb3JlKTtcbiAgICB9O1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICAvLyB2YXIgVXRpbHMgPSByZXF1aXJlKCdhbGNoZW15LmpzL2xpYi9VdGlscycpO1xuICAgIC8vIHZhciBDZW50ZXJDb250YWluZXIgPSByZXF1aXJlKCcuLi8uLi9jb3JlL3VpL0NlbnRlckNvbnRhaW5lcicpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgLyoqIEBsZW5kcyBjb3JlLmVudGl0aWVzLlZpZXdwb3J0LnByb3RvdHlwZSAqL1xuICAgICAgICBnbG9iYWxUb0xvY2FsOiB7XG4gICAgICAgICAgICB3aW5kb3dXaWR0aDogJ3dpbmRvd1dpZHRoJyxcbiAgICAgICAgICAgIHdpbmRvd0hlaWdodDogJ3dpbmRvd0hlaWdodCcsXG4gICAgICAgICAgICBtb2RlOiAnbW9kZScsXG4gICAgICAgICAgICBlbWFpbDogJ2VtYWlsJyxcbiAgICAgICAgfSxcblxuICAgICAgICB2ZG9tOiB7XG4gICAgICAgICAgICByb290OiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndmlld3BvcnQnKSxcblxuICAgICAgICAgICAgcmVuZGVyZXI6IGZ1bmN0aW9uIHJlbmRlclZkb20oY3R4KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGN0eC5oKCdidXR0b24nLCB7XG4gICAgICAgICAgICAgICAgICAgIGlkOiBjdHguZW50aXR5SWQsXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZTogJ3ZpZXdwb3J0ICcgKyBjdHguc3RhdGUudmFsKCdtb2RlJyksXG4gICAgICAgICAgICAgICAgICAgIHRhYkluZGV4OiAnMScsXG4gICAgICAgICAgICAgICAgICAgIGF1dG9mb2N1czogJzEnLFxuICAgICAgICAgICAgICAgIH0sIFtcbiAgICAgICAgICAgICAgICAgICAgY3R4LmgoJ3NwYW4jZW1haWwnLCBjdHguc3RhdGUudmFsKCdlbWFpbCcpKSxcbiAgICAgICAgICAgICAgICBdLmNvbmNhdChjdHgucmVuZGVyQWxsQ2hpbGRyZW4oKSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIGNzczoge1xuICAgICAgICAgICAgZW50aXR5UnVsZXM6IGZ1bmN0aW9uIChzdGF0ZSkge1xuICAgICAgICAgICAgICAgIGlmIChzdGF0ZS52YWwoJ21vZGUnKSA9PT0gJ3ByaW50Jykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gd2lkdGg6ICcxMDAlJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGhlaWdodDogJ2luaXRpYWwnLFxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHdpZHRoOiBzdGF0ZS52YWwoJ3dpbmRvd1dpZHRoJykgKyAncHgnLFxuICAgICAgICAgICAgICAgICAgICBoZWlnaHQ6IHN0YXRlLnZhbCgnd2luZG93SGVpZ2h0JykgKyAncHgnLFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICB0eXBlUnVsZXM6IHtcbiAgICAgICAgICAgICAgICAnLnZpZXdwb3J0Jzoge1xuICAgICAgICAgICAgICAgICAgICBwYWRkaW5nOiAwLFxuICAgICAgICAgICAgICAgICAgICBib3JkZXI6ICdub25lJyxcbiAgICAgICAgICAgICAgICAgICAgYmFja2dyb3VuZDogJ3RyYW5zcGFyZW50JyxcbiAgICAgICAgICAgICAgICAgICAgY29sb3I6ICdpbmhlcml0JyxcbiAgICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgICAgJy52aWV3cG9ydDpmb2N1cyc6IHtcbiAgICAgICAgICAgICAgICAgICAgJ2JveC1zaGFkb3cnOiAnaW5zZXQgMCAwIDEwcHggd2hpdGUnLFxuICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAnI2VtYWlsJzoge1xuICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbjogJ2Fic29sdXRlJyxcbiAgICAgICAgICAgICAgICAgICAgYm90dG9tOiAnMjBweCcsXG4gICAgICAgICAgICAgICAgICAgIHJpZ2h0OiAnMjBweCcsXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIGV2ZW50czoge1xuICAgICAgICAgICAgY29udGV4dG1lbnU6IGZ1bmN0aW9uIG9uQ29udGV4dE1lbnUoZXZlbnQsIHN0YXRlLCBzZW5kTXNnKSB7XG4gICAgICAgICAgICAgICAgc2VuZE1zZygnbmF2aWdhdGlvbjpwcmV2Jyk7XG4gICAgICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGNsaWNrOiBmdW5jdGlvbiBvbkNsaWNrKGV2ZW50LCBzdGF0ZSwgc2VuZE1zZykge1xuICAgICAgICAgICAgICAgIHNlbmRNc2coJ25hdmlnYXRpb246bmV4dCcpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAga2V5ZG93bjogZnVuY3Rpb24gb25LZXlwcmVzc2VkKGV2ZW50LCBzdGF0ZSwgc2VuZE1zZykge1xuICAgICAgICAgICAgICAgIHZhciBrZXkgPSBldmVudC53aGljaCB8fCBldmVudC5rZXlDb2RlO1xuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKCdvbktleXByZXNzZWQnLCBldmVudCwga2V5KTtcblxuICAgICAgICAgICAgICAgIGlmIChrZXkgPT09IDM3IHx8IGtleSA9PT0gMjcgfHwga2V5ID09PSAzMykgeyAvLyBbPF0sIFtFU0NdLCBbUGdVcF1cbiAgICAgICAgICAgICAgICAgICAgc2VuZE1zZygnbmF2aWdhdGlvbjpwcmV2Jyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoa2V5ID09PSAzOSB8fCBrZXkgPT09IDEzIHx8IGtleSA9PT0gMzQpIHsgLy8gWz5dLCBbUkVUVVJOXSwgW1BnRG93bl1cbiAgICAgICAgICAgICAgICAgICAgc2VuZE1zZygnbmF2aWdhdGlvbjpuZXh0Jyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgIH07XG59KCkpO1xuIiwiKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgZWFjaCA9IHJlcXVpcmUoJ3Byby1zaW5ndWxpcycpO1xuICAgIHZhciBBcHAgPSByZXF1aXJlKCcuL2NvcmUvQXBwJyk7XG4gICAgdmFyIFVJID0gcmVxdWlyZSgnLi9jb3JlL1VJJyk7XG4gICAgdmFyIE9ic2VydmFyaSA9IHJlcXVpcmUoJ2FsY2hlbXkuanMvbGliL09ic2VydmFyaScpO1xuICAgIHZhciBtZXNzYWdlcywgdWksIGFwcDtcbiAgICB2YXIgc2xpZGVzID0gZWFjaChbXG4gICAgICAgIHJlcXVpcmUoJy4vc2xpZGVzL1RpdGxlJyksXG4gICAgICAgIHJlcXVpcmUoJy4vc2xpZGVzL3JhbmstMTAtMScpLFxuICAgICAgICByZXF1aXJlKCcuL3NsaWRlcy9yYW5rLTktMScpLFxuICAgICAgICByZXF1aXJlKCcuL3NsaWRlcy9yYW5rLTgtMScpLFxuICAgICAgICByZXF1aXJlKCcuL3NsaWRlcy9yYW5rLTctMScpLFxuICAgICAgICByZXF1aXJlKCcuL3NsaWRlcy9yYW5rLTYtMScpLFxuICAgICAgICByZXF1aXJlKCcuL3NsaWRlcy9yYW5rLTUtMScpLFxuICAgICAgICByZXF1aXJlKCcuL3NsaWRlcy9yYW5rLTQtMScpLFxuICAgICAgICByZXF1aXJlKCcuL3NsaWRlcy9yYW5rLTMtMScpLFxuICAgICAgICByZXF1aXJlKCcuL3NsaWRlcy9yYW5rLTItMScpLFxuICAgICAgICByZXF1aXJlKCcuL3NsaWRlcy9yYW5rLTEtMScpLFxuICAgICAgICByZXF1aXJlKCcuL3NsaWRlcy9Tb3VyY2VzJyksXG4gICAgICAgIHJlcXVpcmUoJy4vc2xpZGVzL1F1ZXN0aW9ucycpLFxuICAgIF0sIGZ1bmN0aW9uIChzbGlkZSwgaW5kZXgpIHtcbiAgICAgICAgc2xpZGUuc3RhdGUgPSBzbGlkZS5zdGF0ZSB8fCB7fTtcbiAgICAgICAgc2xpZGUuc3RhdGUuaW5kZXggPSBpbmRleDtcblxuICAgICAgICByZXR1cm4gc2xpZGU7XG4gICAgfSk7XG5cbiAgICB3aW5kb3cub25sb2FkID0gZnVuY3Rpb24gb25Mb2FkKCkge1xuICAgICAgICBtZXNzYWdlcyA9IE9ic2VydmFyaS5icmV3KCk7XG5cbiAgICAgICAgdWkgPSBVSS5icmV3KHtcbiAgICAgICAgICAgIG1lc3NhZ2VzOiBtZXNzYWdlcyxcbiAgICAgICAgICAgIHNsaWRlczogc2xpZGVzXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGFwcCA9IEFwcC5icmV3KHtcbiAgICAgICAgICAgIHVpOiB1aSxcbiAgICAgICAgICAgIG1lc3NhZ2VzOiBtZXNzYWdlcyxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgYXBwLnN0YXRlID0gYXBwLnN0YXRlLnNldCh7XG4gICAgICAgICAgICBudW1PZlNsaWRlczogc2xpZGVzLmxlbmd0aCxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgYXBwLmxhdW5jaCgpO1xuXG4gICAgICAgIHdpbmRvdy5hcHAgPSBhcHA7IC8vIGdsb2JhbCByZWZlcmVuY2UgZm9yIGRlYnVnZ2luZ1xuICAgIH07XG5cbiAgICB3aW5kb3cub251bmxvYWQgPSBmdW5jdGlvbiBvblVubG9hZCgpIHtcbiAgICAgICAgW2FwcCwgdWksIG1lc3NhZ2VzXS5mb3JFYWNoKGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgICAgIG9iai5kaXNwb3NlKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHdpbmRvdy5hcHAgPSBudWxsO1xuICAgIH07XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBzbGlkZSA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvU2xpZGUnKTtcbiAgICB2YXIgdGV4dCA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvVGV4dCcpO1xuXG4gICAgcmV0dXJuIHNsaWRlKFtcbiAgICAgICAgdGV4dCgnRnJhZ2VuPycsIHtcbiAgICAgICAgICAgICdmb250LXNpemUnOiAnNjVweCcsXG4gICAgICAgIH0pXG4gICAgXSk7XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBzbGlkZSA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvU2xpZGUnKTtcbiAgICB2YXIgdGV4dCA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvQmlnVGV4dCcpO1xuXG4gICAgcmV0dXJuIHNsaWRlKCdRdWVsbGVuIHVuZCBMaW5rcycsIFtcbiAgICAgICAgdGV4dCgnLSBFLiBEZXJieSBhbmQgRC4gTGFyc2VuLiBBZ2lsZSBSZXRyb3NwZWN0aXZlcywgUHJhZ21hdGljIEJvb2tzaGVsZiwgVVNBLCAyMDA2JyksXG4gICAgICAgIHRleHQoJy0gQy4gQmFsZGF1Zi4gUmV0ci1PLU1hdCwgaHR0cDovL3d3dy5wbGFucy1mb3ItcmV0cm9zcGVjdGl2ZXMuY29tLycpLFxuICAgICAgICB0ZXh0KCctIE0uIEcuIFJpY2hhcmQuIEZpeGVkIE1pbmRzZXQgdnMuIEdyb3d0aCBNaW5kc2V0LCBodHRwOi8vbWljaGFlbGdyLmNvbS8yMDA3LzA0LzE1L2ZpeGVkLW1pbmRzZXQtdnMtZ3Jvd3RoLW1pbmRzZXQtd2hpY2gtb25lLWFyZS15b3UvJyksXG4gICAgXSk7XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBzbGlkZSA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvU2xpZGUnKTtcbiAgICB2YXIgdGV4dCA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvVGV4dCcpO1xuXG4gICAgcmV0dXJuIHNsaWRlKFtcbiAgICAgICAgdGV4dCgnRGllIDEwIHdpY2h0aWdzdGVuIERpbmdlLCBkaWUgbWFuIGJlaW0gTW9kZXJpZXJlbiBlaW5lciBSZXRyb3NwZWt0aXZlIGJlYWNodGVuIHNvbGx0ZScsIHtcbiAgICAgICAgICAgICdmb250LXNpemUnOiAnOTBweCcsXG4gICAgICAgIH0pLFxuXG4gICAgICAgIHRleHQoJ01pY2hhZWwgQsO8dHRuZXIgLSAxMy4wMS4yMDE2Jywge1xuICAgICAgICAgICAgJ2ZvbnQtc2l6ZSc6ICczNXB4JyxcbiAgICAgICAgfSksXG4gICAgXSk7XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBzbGlkZSA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvU2xpZGUnKTtcbiAgICB2YXIgdGV4dCA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvQmlnVGV4dCcpO1xuXG4gICAgcmV0dXJuIHNsaWRlKCdQbGF0eiAjMScsIFtcbiAgICAgICAgdGV4dCgnRG9uXFwndCBQYW5pYycsIHtcbiAgICAgICAgICAgICdmb250LXNpemUnOiAnOTBweCdcbiAgICAgICAgfSlcbiAgICBdKTtcbn0oKSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIHNsaWRlID0gcmVxdWlyZSgnLi4vY29yZS91aS9TbGlkZScpO1xuICAgIHZhciB0ZXh0ID0gcmVxdWlyZSgnLi4vY29yZS91aS9CaWdUZXh0Jyk7XG5cbiAgICByZXR1cm4gc2xpZGUoJ1BsYXR6ICMxMCcsIFtcbiAgICAgICAgdGV4dCgnU2V0IHRoZSBTdGFnZSAtIEdhdGhlciBEYXRhIC0gR2VuZXJhdGUgSW5zaWdodHMgLSBEZWNpZGUgV2hhdCBUbyBEbyAtIENsb3NlIFRoZSBSZXRybycpLFxuICAgICAgICB0ZXh0KCdFcyBzb2xsdGUga2VpbiBUZWlsIHdlZ2dlbGFzc2VuIHdlcmRlbicpXG4gICAgXSk7XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBzbGlkZSA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvU2xpZGUnKTtcbiAgICB2YXIgdGV4dCA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvQmlnVGV4dCcpO1xuXG4gICAgcmV0dXJuIHNsaWRlKCdQbGF0eiAjMicsIFtcbiAgICAgICAgdGV4dCgnRGllIEzDtnN1bmdlbiBrb21tZW4gdm9uIGRlbiBUZWlsbmVobWVybiwgbmljaHQgdm9tIE1vZGVyYXRvcicpXG4gICAgXSk7XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBzbGlkZSA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvU2xpZGUnKTtcbiAgICB2YXIgdGV4dCA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvQmlnVGV4dCcpO1xuXG4gICAgcmV0dXJuIHNsaWRlKCdQbGF0eiAjMycsIFtcbiAgICAgICAgdGV4dCgnQXVjaCBkZXIgTW9kZXJhdG9yIG11c3Mgc2ljaCB2ZXJiZXNzZXJuJylcbiAgICBdKTtcbn0oKSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIHNsaWRlID0gcmVxdWlyZSgnLi4vY29yZS91aS9TbGlkZScpO1xuICAgIHZhciB0ZXh0ID0gcmVxdWlyZSgnLi4vY29yZS91aS9CaWdUZXh0Jyk7XG5cbiAgICByZXR1cm4gc2xpZGUoJ1BsYXR6ICM0JywgW1xuICAgICAgICB0ZXh0KCdEaWUgVGVpbG5laG1lciBtw7xzc2VuIGF1Y2ggbWFsIGdlbG9idCB3ZXJkZW4nKSxcbiAgICAgICAgdGV4dCgnLi4uIGFiZXIgcmljaHRpZycpLFxuICAgIF0pO1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgc2xpZGUgPSByZXF1aXJlKCcuLi9jb3JlL3VpL1NsaWRlJyk7XG4gICAgdmFyIHRleHQgPSByZXF1aXJlKCcuLi9jb3JlL3VpL0JpZ1RleHQnKTtcblxuICAgIHJldHVybiBzbGlkZSgnUGxhdHogIzUnLCBbXG4gICAgICAgIHRleHQoJ0RlciBNb2RlcmF0b3IgaXN0IGtlaW4gVGVpbG5laG1lcicpXG4gICAgXSk7XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBzbGlkZSA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvU2xpZGUnKTtcbiAgICB2YXIgdGV4dCA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvQmlnVGV4dCcpO1xuXG4gICAgcmV0dXJuIHNsaWRlKCdQbGF0eiAjNicsIFtcbiAgICAgICAgdGV4dCgnTWFuIG11c3MgaW1tZXIgbWFsIHdhcyBuZXVlcyBtYWNoZW4nKVxuICAgIF0pO1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgc2xpZGUgPSByZXF1aXJlKCcuLi9jb3JlL3VpL1NsaWRlJyk7XG4gICAgdmFyIHRleHQgPSByZXF1aXJlKCcuLi9jb3JlL3VpL0JpZ1RleHQnKTtcblxuICAgIHJldHVybiBzbGlkZSgnUGxhdHogIzcnLCBbXG4gICAgICAgIHRleHQoJ1ZvcmJlcmVpdHVuZy4gVm9yYmVyZWl0dW5nLiBWb3JiZXJlaXR1bmchJylcbiAgICBdKTtcbn0oKSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIHNsaWRlID0gcmVxdWlyZSgnLi4vY29yZS91aS9TbGlkZScpO1xuICAgIHZhciB0ZXh0ID0gcmVxdWlyZSgnLi4vY29yZS91aS9CaWdUZXh0Jyk7XG5cbiAgICByZXR1cm4gc2xpZGUoJ1BsYXR6ICM4JywgW1xuICAgICAgICB0ZXh0KCdFaW4gTW9kZXJhdG9yIGJyYXVjaHQgaW0gw4RybWVsIGVpbmVuIFBsYW4gQicpLFxuICAgICAgICB0ZXh0KCcuLi4gdW5kIGltIFNjaHVoIGVpbmVuIFBsYW4gQycpXG4gICAgXSk7XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBzbGlkZSA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvU2xpZGUnKTtcbiAgICB2YXIgdGV4dCA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvQmlnVGV4dCcpO1xuXG4gICAgcmV0dXJuIHNsaWRlKCdQbGF0eiAjOScsIFtcbiAgICAgICAgdGV4dCgnRWluIFNwaWVsIGRhdWVydCA5MCBNaW51dGVuJyksXG4gICAgICAgIHRleHQoJy4uLiBlaW5lIFJldHJvc3Bla3RpdmUgZGF1ZXJ0IGzDpG5nZXInKSxcbiAgICAgICAgdGV4dCgnLi4uIG9kZXIgYXVjaCBuaWNodCcpXG4gICAgXSk7XG59KCkpO1xuIl19
