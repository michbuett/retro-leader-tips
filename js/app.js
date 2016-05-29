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

},{"./Utils":10,"coquo-venenum":45,"immutabilis":47,"pro-singulis":48}],2:[function(require,module,exports){
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

},{"./Utils":10,"coquo-venenum":45,"immutabilis":47,"pro-singulis":48}],3:[function(require,module,exports){
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

},{"./Observari":7,"./Utils":10,"coquo-venenum":45,"immutabilis":47,"pro-singulis":48}],4:[function(require,module,exports){
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

},{"./Utils":10,"coquo-venenum":45,"pro-singulis":48}],5:[function(require,module,exports){
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

},{"coquo-venenum":45,"pro-singulis":48}],6:[function(require,module,exports){
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

},{"./Utils":10,"coquo-venenum":45,"pro-singulis":48}],7:[function(require,module,exports){
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

},{"./Utils":10,"coquo-venenum":45,"pro-singulis":48}],8:[function(require,module,exports){
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

},{"./Utils":10,"coquo-venenum":45,"immutabilis":47,"pro-singulis":48}],9:[function(require,module,exports){
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

},{"coquo-venenum":45,"pro-singulis":48}],10:[function(require,module,exports){
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

},{"pro-singulis":48}],11:[function(require,module,exports){
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

},{"./Utils":10,"coquo-venenum":45,"pro-singulis":48,"virtual-dom/diff":12,"virtual-dom/h":13,"virtual-dom/patch":21}],12:[function(require,module,exports){
var diff = require("./vtree/diff.js")

module.exports = diff

},{"./vtree/diff.js":43}],13:[function(require,module,exports){
var h = require("./virtual-hyperscript/index.js")

module.exports = h

},{"./virtual-hyperscript/index.js":30}],14:[function(require,module,exports){
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

},{}],15:[function(require,module,exports){
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

},{"individual/one-version":17}],16:[function(require,module,exports){
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

},{}],17:[function(require,module,exports){
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

},{"./index.js":16}],18:[function(require,module,exports){
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

},{"min-document":46}],19:[function(require,module,exports){
"use strict";

module.exports = function isObject(x) {
	return typeof x === "object" && x !== null;
};

},{}],20:[function(require,module,exports){
var nativeIsArray = Array.isArray
var toString = Object.prototype.toString

module.exports = nativeIsArray || isArray

function isArray(obj) {
    return toString.call(obj) === "[object Array]"
}

},{}],21:[function(require,module,exports){
var patch = require("./vdom/patch.js")

module.exports = patch

},{"./vdom/patch.js":26}],22:[function(require,module,exports){
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

},{"../vnode/is-vhook.js":34,"is-object":19}],23:[function(require,module,exports){
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

},{"../vnode/handle-thunk.js":32,"../vnode/is-vnode.js":35,"../vnode/is-vtext.js":36,"../vnode/is-widget.js":37,"./apply-properties":22,"global/document":18}],24:[function(require,module,exports){
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

},{}],25:[function(require,module,exports){
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

},{"../vnode/is-widget.js":37,"../vnode/vpatch.js":40,"./apply-properties":22,"./update-widget":27}],26:[function(require,module,exports){
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

},{"./create-element":23,"./dom-index":24,"./patch-op":25,"global/document":18,"x-is-array":20}],27:[function(require,module,exports){
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

},{"../vnode/is-widget.js":37}],28:[function(require,module,exports){
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

},{"ev-store":15}],29:[function(require,module,exports){
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

},{}],30:[function(require,module,exports){
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

},{"../vnode/is-thunk":33,"../vnode/is-vhook":34,"../vnode/is-vnode":35,"../vnode/is-vtext":36,"../vnode/is-widget":37,"../vnode/vnode.js":39,"../vnode/vtext.js":41,"./hooks/ev-hook.js":28,"./hooks/soft-set-hook.js":29,"./parse-tag.js":31,"x-is-array":20}],31:[function(require,module,exports){
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

},{"browser-split":14}],32:[function(require,module,exports){
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

},{"./is-thunk":33,"./is-vnode":35,"./is-vtext":36,"./is-widget":37}],33:[function(require,module,exports){
module.exports = isThunk

function isThunk(t) {
    return t && t.type === "Thunk"
}

},{}],34:[function(require,module,exports){
module.exports = isHook

function isHook(hook) {
    return hook &&
      (typeof hook.hook === "function" && !hook.hasOwnProperty("hook") ||
       typeof hook.unhook === "function" && !hook.hasOwnProperty("unhook"))
}

},{}],35:[function(require,module,exports){
var version = require("./version")

module.exports = isVirtualNode

function isVirtualNode(x) {
    return x && x.type === "VirtualNode" && x.version === version
}

},{"./version":38}],36:[function(require,module,exports){
var version = require("./version")

module.exports = isVirtualText

function isVirtualText(x) {
    return x && x.type === "VirtualText" && x.version === version
}

},{"./version":38}],37:[function(require,module,exports){
module.exports = isWidget

function isWidget(w) {
    return w && w.type === "Widget"
}

},{}],38:[function(require,module,exports){
module.exports = "2"

},{}],39:[function(require,module,exports){
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

},{"./is-thunk":33,"./is-vhook":34,"./is-vnode":35,"./is-widget":37,"./version":38}],40:[function(require,module,exports){
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

},{"./version":38}],41:[function(require,module,exports){
var version = require("./version")

module.exports = VirtualText

function VirtualText(text) {
    this.text = String(text)
}

VirtualText.prototype.version = version
VirtualText.prototype.type = "VirtualText"

},{"./version":38}],42:[function(require,module,exports){
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

},{"../vnode/is-vhook":34,"is-object":19}],43:[function(require,module,exports){
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

},{"../vnode/handle-thunk":32,"../vnode/is-thunk":33,"../vnode/is-vnode":35,"../vnode/is-vtext":36,"../vnode/is-widget":37,"../vnode/vpatch":40,"./diff-props":42,"x-is-array":20}],44:[function(require,module,exports){
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

},{}],45:[function(require,module,exports){
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

},{"deligare":44,"pro-singulis":48}],46:[function(require,module,exports){

},{}],47:[function(require,module,exports){
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

},{"pro-singulis":48}],48:[function(require,module,exports){
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

},{"./controller/Navigation":51,"alchemy.js/lib/Applicatus":3,"immutabilis":47}],50:[function(require,module,exports){
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

},{"./ui/Viewport":56,"alchemy.js/lib/Administrator":1,"alchemy.js/lib/Apothecarius":2,"alchemy.js/lib/CssRenderSystem":4,"alchemy.js/lib/Delegatus":5,"alchemy.js/lib/EventSystem":6,"alchemy.js/lib/StateSystem":8,"alchemy.js/lib/Stylus":9,"alchemy.js/lib/Utils":10,"alchemy.js/lib/VDomRenderSystem":11,"coquo-venenum":45,"pro-singulis":48}],51:[function(require,module,exports){
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

},{"coquo-venenum":45}],52:[function(require,module,exports){
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

    return function html(render, entityCss) {
        return {
            vdom: {
                renderer: function (ctx) {
                    return render(ctx.h, ctx.state);
                },
            },

            css: {
                entityRules: entityCss,
            },
        };
    };
}());


},{}],54:[function(require,module,exports){
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
                email: 'email',
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
                        dataset: {
                            index: s.index,
                        },
                    }, [
                        h('div.slide-title', ctx.state.val('title')),
                        h('div.slide-inner', ctx.renderAllChildren()),
                        h('span.email', ctx.state.val('email')),
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

},{"alchemy.js/lib/Utils":10}],55:[function(require,module,exports){
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

},{"alchemy.js/lib/Utils":10}],56:[function(require,module,exports){
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
                }, ctx.renderAllChildren());
            }
        },

        css: {
            entityRules: function (state) {
                if (state.val('mode') === 'print') {
                    return {
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

},{}],57:[function(require,module,exports){
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
        require('./slides/rank-10-2'),
        require('./slides/rank-09-1'),
        require('./slides/rank-09-2'),
        require('./slides/rank-08-1'),
        require('./slides/rank-08-2'),
        require('./slides/rank-07-1'),
        require('./slides/rank-07-2'),
        require('./slides/rank-06-1'),
        require('./slides/rank-05-1'),
        require('./slides/rank-05-2'),
        require('./slides/rank-04-1'),
        require('./slides/rank-04-2'),
        require('./slides/rank-03-1'),
        require('./slides/rank-02-1'),
        require('./slides/rank-01-1'),
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

},{"./core/App":49,"./core/UI":50,"./slides/Questions":58,"./slides/Sources":59,"./slides/Title":60,"./slides/rank-01-1":61,"./slides/rank-02-1":62,"./slides/rank-03-1":63,"./slides/rank-04-1":64,"./slides/rank-04-2":65,"./slides/rank-05-1":66,"./slides/rank-05-2":67,"./slides/rank-06-1":68,"./slides/rank-07-1":69,"./slides/rank-07-2":70,"./slides/rank-08-1":71,"./slides/rank-08-2":72,"./slides/rank-09-1":73,"./slides/rank-09-2":74,"./slides/rank-10-1":75,"./slides/rank-10-2":76,"alchemy.js/lib/Observari":7,"pro-singulis":48}],58:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/Text');

    return slide([
        text('Fragen?')
    ]);
}());

},{"../core/ui/Slide":54,"../core/ui/Text":55}],59:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('Quellen und Links', [
        text('- E. Derby and D. Larsen. Agile Retrospectives, Pragmatic Bookshelf, USA, 2006'),
        text('- C. Baldauf. Retr-O-Mat, http://www.plans-for-retrospectives.com/'),
        text('- http://michbuett.github.io/retro-leader-tips/'),
    ]);
}());

},{"../core/ui/BigText":52,"../core/ui/Slide":54}],60:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var html = require('../core/ui/Html');

    return slide('', [
        html(function (h) {
            return h('div.title-block', [
                h('div.speaker', 'Michael Büttner | Flyeralarm'),
                h('div.title', 'Die 10 wichtigsten Dinge, die man beim Moderieren einer Retrospektive beachten sollte'),
            ]);
        })
    ]);
}());

},{"../core/ui/Html":53,"../core/ui/Slide":54}],61:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('', [
        text('#1'),
        text('Habe Spaß!'),
    ]);
}());

},{"../core/ui/BigText":52,"../core/ui/Slide":54}],62:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('', [
        text('#2'),
        text('Keine Panik!')
    ]);
}());

},{"../core/ui/BigText":52,"../core/ui/Slide":54}],63:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('', [
        text('#3'),
        text('Gehe offen in die Retrospektive!'),
    ]);
}());

},{"../core/ui/BigText":52,"../core/ui/Slide":54}],64:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('', [
        text('#4'),
        text('Arbeite an Deinen Fähigkeiten!'),
    ]);
}());

},{"../core/ui/BigText":52,"../core/ui/Slide":54}],65:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('#4: Arbeite an Deinen Fähigkeiten!', [
        text('- Arbeiten am Flip-Chart'),
        text('- Umgang mit Aktivitäten'),
        text('- Hilfe bei der Entscheidungsfindung'),
        text('- Verstehen und Beeinflussen der Gruppendynamik'),
        text('- Verbesserung der Selbstwahrnehmung'),
    ]);
}());

},{"../core/ui/BigText":52,"../core/ui/Slide":54}],66:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('', [
        text('#5'),
        text('Gehe behutsam mit Lob um!'),
    ]);
}());

},{"../core/ui/BigText":52,"../core/ui/Slide":54}],67:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('#5: Gehe behutsam mit Lob um!', [
        text('- Das rechte Lob zur rechten Zeit ist Gold wert'),
        text('- Meine es ehrlich oder lasse es'),
        text('- Lobe Anstrengung, nicht Intelligenz'),
    ]);
}());

},{"../core/ui/BigText":52,"../core/ui/Slide":54}],68:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('', [
        text('#6'),
        text('Der Moderator ist kein Teilnehmer!'),
    ]);
}());

},{"../core/ui/BigText":52,"../core/ui/Slide":54}],69:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('', [
        text('#7'),
        text('Vorbereitung. Vorbereitung. Vorbereitung!'),
    ]);
}());

},{"../core/ui/BigText":52,"../core/ui/Slide":54}],70:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('#7: Vorbereitung. Vorbereitung. Vorbereitung!', [
        text('- Wieviel Zeit muss eingeplant werden?'),
        text('- Welche Aktivitäten sind sinnvoll?'),
        text('- Wie tickt das Team?'), // Manager zur Seite nehmen
        text('- Gibt es einen Plan B?'),
        text('- Gibt es einen Plan C?'),
    ]);
}());

},{"../core/ui/BigText":52,"../core/ui/Slide":54}],71:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('', [
        text('#8'),
        text('Nimm Dir ausreichend Zeit!'),
    ]);
}());

},{"../core/ui/BigText":52,"../core/ui/Slide":54}],72:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var html = require('../core/ui/Html');

    return slide('#8: Nimm Dir ausreichend Zeit!', [
        html(function (h) {
            return h('div.block', ['Faustregel: 3h pro Monat, aber beachte:', h('br'), h('ul', [
                h('li', 'Größe und Zusammensetzung der Gruppe'),
                h('li', 'Konfliktpotenzial'),
                h('li', 'Komplexität'),
                h('li', 'Pausen'),
                h('li', 'Im Zweifel mehr Zeit einplanen'),
            ])]);
        })
    ]);
}());

},{"../core/ui/Html":53,"../core/ui/Slide":54}],73:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('', [
        text('#9'),
        text('Sorge für Abwechslung!'),
    ]);
}());

},{"../core/ui/BigText":52,"../core/ui/Slide":54}],74:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('#9: Sorge für Abwechslung!', [
        text('Speedboat - Mad Sad Glad - Starfish'),
        text('Story Oscars - Lean Coffee'),
        text('Five Whys - Unlikely Superheroes'),
        text('Timeline - Park Bench'),
        text('...'),
    ]);
}());

},{"../core/ui/BigText":52,"../core/ui/Slide":54}],75:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('', [
        text('#10'),
        text('Lasse die Struktur der Retrospektive unverändert!'),
    ]);
}());

},{"../core/ui/BigText":52,"../core/ui/Slide":54}],76:[function(require,module,exports){
module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    // var html = require('../core/ui/Html');
    var text = require('../core/ui/BigText');

    return slide('#10: Lasse die Struktur der Retrospektive unverändert!', [
        // html(function (h) {
        //     return h('ol.block', [
        //         h('li', 'Set the Stage'),
        //         h('li', 'Gather Data'),
        //         h('li', 'Generate Insights'),
        //         h('li', 'Decide What To Do'),
        //         h('li', 'Close The Retro'),
        //     ]);
        // })

        text('1. Set the Stage'),
        text('2. Gather Data'),
        text('3. Generate Insights'),
        text('4. Decide What to Do'),
        text('5. Close the Retro'),
    ]);
}());

},{"../core/ui/BigText":52,"../core/ui/Slide":54}]},{},[57])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYWxjaGVteS5qcy9saWIvQWRtaW5pc3RyYXRvci5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL2xpYi9BcG90aGVjYXJpdXMuanMiLCJub2RlX21vZHVsZXMvYWxjaGVteS5qcy9saWIvQXBwbGljYXR1cy5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL2xpYi9Dc3NSZW5kZXJTeXN0ZW0uanMiLCJub2RlX21vZHVsZXMvYWxjaGVteS5qcy9saWIvRGVsZWdhdHVzLmpzIiwibm9kZV9tb2R1bGVzL2FsY2hlbXkuanMvbGliL0V2ZW50U3lzdGVtLmpzIiwibm9kZV9tb2R1bGVzL2FsY2hlbXkuanMvbGliL09ic2VydmFyaS5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL2xpYi9TdGF0ZVN5c3RlbS5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL2xpYi9TdHlsdXMuanMiLCJub2RlX21vZHVsZXMvYWxjaGVteS5qcy9saWIvVXRpbHMuanMiLCJub2RlX21vZHVsZXMvYWxjaGVteS5qcy9saWIvVkRvbVJlbmRlclN5c3RlbS5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL25vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS9kaWZmLmpzIiwibm9kZV9tb2R1bGVzL2FsY2hlbXkuanMvbm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL2guanMiLCJub2RlX21vZHVsZXMvYWxjaGVteS5qcy9ub2RlX21vZHVsZXMvdmlydHVhbC1kb20vbm9kZV9tb2R1bGVzL2Jyb3dzZXItc3BsaXQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvYWxjaGVteS5qcy9ub2RlX21vZHVsZXMvdmlydHVhbC1kb20vbm9kZV9tb2R1bGVzL2V2LXN0b3JlL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2FsY2hlbXkuanMvbm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL25vZGVfbW9kdWxlcy9ldi1zdG9yZS9ub2RlX21vZHVsZXMvaW5kaXZpZHVhbC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL25vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS9ub2RlX21vZHVsZXMvZXYtc3RvcmUvbm9kZV9tb2R1bGVzL2luZGl2aWR1YWwvb25lLXZlcnNpb24uanMiLCJub2RlX21vZHVsZXMvYWxjaGVteS5qcy9ub2RlX21vZHVsZXMvdmlydHVhbC1kb20vbm9kZV9tb2R1bGVzL2dsb2JhbC9kb2N1bWVudC5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL25vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS9ub2RlX21vZHVsZXMvaXMtb2JqZWN0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2FsY2hlbXkuanMvbm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL25vZGVfbW9kdWxlcy94LWlzLWFycmF5L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2FsY2hlbXkuanMvbm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3BhdGNoLmpzIiwibm9kZV9tb2R1bGVzL2FsY2hlbXkuanMvbm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zkb20vYXBwbHktcHJvcGVydGllcy5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL25vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92ZG9tL2NyZWF0ZS1lbGVtZW50LmpzIiwibm9kZV9tb2R1bGVzL2FsY2hlbXkuanMvbm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zkb20vZG9tLWluZGV4LmpzIiwibm9kZV9tb2R1bGVzL2FsY2hlbXkuanMvbm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zkb20vcGF0Y2gtb3AuanMiLCJub2RlX21vZHVsZXMvYWxjaGVteS5qcy9ub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdmRvbS9wYXRjaC5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL25vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92ZG9tL3VwZGF0ZS13aWRnZXQuanMiLCJub2RlX21vZHVsZXMvYWxjaGVteS5qcy9ub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdmlydHVhbC1oeXBlcnNjcmlwdC9ob29rcy9ldi1ob29rLmpzIiwibm9kZV9tb2R1bGVzL2FsY2hlbXkuanMvbm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3ZpcnR1YWwtaHlwZXJzY3JpcHQvaG9va3Mvc29mdC1zZXQtaG9vay5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL25vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92aXJ0dWFsLWh5cGVyc2NyaXB0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2FsY2hlbXkuanMvbm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3ZpcnR1YWwtaHlwZXJzY3JpcHQvcGFyc2UtdGFnLmpzIiwibm9kZV9tb2R1bGVzL2FsY2hlbXkuanMvbm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zub2RlL2hhbmRsZS10aHVuay5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL25vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92bm9kZS9pcy10aHVuay5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL25vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92bm9kZS9pcy12aG9vay5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL25vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92bm9kZS9pcy12bm9kZS5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL25vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92bm9kZS9pcy12dGV4dC5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL25vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92bm9kZS9pcy13aWRnZXQuanMiLCJub2RlX21vZHVsZXMvYWxjaGVteS5qcy9ub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdm5vZGUvdmVyc2lvbi5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL25vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92bm9kZS92bm9kZS5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL25vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92bm9kZS92cGF0Y2guanMiLCJub2RlX21vZHVsZXMvYWxjaGVteS5qcy9ub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdm5vZGUvdnRleHQuanMiLCJub2RlX21vZHVsZXMvYWxjaGVteS5qcy9ub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdnRyZWUvZGlmZi1wcm9wcy5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL25vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92dHJlZS9kaWZmLmpzIiwibm9kZV9tb2R1bGVzL2NvcXVvLXZlbmVudW0vbm9kZV9tb2R1bGVzL2RlbGlnYXJlL3NyYy9kZWxpZ2FyZS5qcyIsIm5vZGVfbW9kdWxlcy9jb3F1by12ZW5lbnVtL3NyYy9jb3F1by12ZW5lbnVtLmpzIiwibm9kZV9tb2R1bGVzL2dydW50LWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcmVzb2x2ZS9lbXB0eS5qcyIsIm5vZGVfbW9kdWxlcy9pbW11dGFiaWxpcy9zcmMvaW1tdXRhYmlsaXMuanMiLCJub2RlX21vZHVsZXMvcHJvLXNpbmd1bGlzL3NyYy9lYWNoLmpzIiwic3JjL2pzL2NvcmUvQXBwLmpzIiwic3JjL2pzL2NvcmUvVUkuanMiLCJzcmMvanMvY29yZS9jb250cm9sbGVyL05hdmlnYXRpb24uanMiLCJzcmMvanMvY29yZS91aS9CaWdUZXh0LmpzIiwic3JjL2pzL2NvcmUvdWkvSHRtbC5qcyIsInNyYy9qcy9jb3JlL3VpL1NsaWRlLmpzIiwic3JjL2pzL2NvcmUvdWkvVGV4dC5qcyIsInNyYy9qcy9jb3JlL3VpL1ZpZXdwb3J0LmpzIiwic3JjL2pzL2luaXQuanMiLCJzcmMvanMvc2xpZGVzL1F1ZXN0aW9ucy5qcyIsInNyYy9qcy9zbGlkZXMvU291cmNlcy5qcyIsInNyYy9qcy9zbGlkZXMvVGl0bGUuanMiLCJzcmMvanMvc2xpZGVzL3JhbmstMDEtMS5qcyIsInNyYy9qcy9zbGlkZXMvcmFuay0wMi0xLmpzIiwic3JjL2pzL3NsaWRlcy9yYW5rLTAzLTEuanMiLCJzcmMvanMvc2xpZGVzL3JhbmstMDQtMS5qcyIsInNyYy9qcy9zbGlkZXMvcmFuay0wNC0yLmpzIiwic3JjL2pzL3NsaWRlcy9yYW5rLTA1LTEuanMiLCJzcmMvanMvc2xpZGVzL3JhbmstMDUtMi5qcyIsInNyYy9qcy9zbGlkZXMvcmFuay0wNi0xLmpzIiwic3JjL2pzL3NsaWRlcy9yYW5rLTA3LTEuanMiLCJzcmMvanMvc2xpZGVzL3JhbmstMDctMi5qcyIsInNyYy9qcy9zbGlkZXMvcmFuay0wOC0xLmpzIiwic3JjL2pzL3NsaWRlcy9yYW5rLTA4LTIuanMiLCJzcmMvanMvc2xpZGVzL3JhbmstMDktMS5qcyIsInNyYy9qcy9zbGlkZXMvcmFuay0wOS0yLmpzIiwic3JjL2pzL3NsaWRlcy9yYW5rLTEwLTEuanMiLCJzcmMvanMvc2xpZGVzL3JhbmstMTAtMi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMU1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcFBBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwUUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyT0E7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUN0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1JBO0FBQ0E7QUFDQTtBQUNBOztBQ0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM2FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeExBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgaW1tdXRhYmxlID0gcmVxdWlyZSgnaW1tdXRhYmlsaXMnKTtcbiAgICB2YXIgY29xdW9WZW5lbnVtID0gcmVxdWlyZSgnY29xdW8tdmVuZW51bScpO1xuICAgIHZhciBlYWNoID0gcmVxdWlyZSgncHJvLXNpbmd1bGlzJyk7XG4gICAgdmFyIHV0aWxzID0gcmVxdWlyZSgnLi9VdGlscycpO1xuXG4gICAgLyoqXG4gICAgICogRGVzY3JpcHRpb25cbiAgICAgKlxuICAgICAqIEBjbGFzc1xuICAgICAqIEBuYW1lIGFsY2hlbXkuZWNzLkFkbWluaXN0cmF0b3JcbiAgICAgKi9cbiAgICByZXR1cm4gY29xdW9WZW5lbnVtKHtcbiAgICAgICAgLyoqIEBsZW5kcyBhbGNoZW15LmVjcy5BZG1pbmlzdHJhdG9yLnByb3RvdHlwZSAqL1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBZGRzIGEgbmV3IGNvbXBvbmVudCBzeXN0ZW0uIEFueSBjb21wb25lbnQgc3lzdGVtIHNob3VsZCBpbXBsZW1lbnRcbiAgICAgICAgICogdGhlIG1ldGhvZCBcInVwZGF0ZVwiXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBuZXdTeXN0ZW0gVGhlIG5ldyBjb21wb25lbnQgc3lzdGVtXG4gICAgICAgICAqL1xuICAgICAgICBhZGRTeXN0ZW06IGZ1bmN0aW9uIChuZXdTeXN0ZW0pIHtcbiAgICAgICAgICAgIG5ld1N5c3RlbS5lbnRpdGllcyA9IHRoaXMucmVwbztcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtcy5wdXNoKG5ld1N5c3RlbSk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNldHMgYW5kIG92ZXJyaWRlcyB0aGUgZGVmYXVsdHMgY29tcG9uZW50cyBmb3IgYSBnaXZlbiBlbnRpdHlcbiAgICAgICAgICogdHlsZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30ga2V5IFRoZSBlbnRpdHkgdHlwZSBpZGVudGlmaWVyXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBjb21wb25lbnRzIFRoZSBkZWZhdWx0IGNvbXBvbmVudHMgZm9yIHRoZVxuICAgICAgICAgKiAgICAgIGVudGl0eSB0eXBlXG4gICAgICAgICAqL1xuICAgICAgICBzZXRFbnRpdHlEZWZhdWx0czogZnVuY3Rpb24gKGtleSwgY29tcG9uZW50cykge1xuICAgICAgICAgICAgdGhpcy5kZWZhdWx0c1trZXldID0gaW1tdXRhYmxlLmZyb21KUyhjb21wb25lbnRzKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogSW5pdGlhbGl6ZXMgdGhlIGFwcGxpY3Rpb24gZW50aXRpZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtBcnJheX0gbGlzdCBBIGxpc3Qgb2YgZW50aXR5IGNvbmZpZ3VyYXRpb25zIG9yIGZ1bmN0aW9uc1xuICAgICAgICAgKiAgICAgIHdoaWNoIHdpbGwgY3JlYXRlIGVudGl0eSBjb25maWd1cmF0aW9ucyBiYXNlZCBvbiB0aGUgY3VycmVudFxuICAgICAgICAgKiAgICAgIGFwcGxpY3Rpb24gc3RhdGVcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtJbW11dGF0YWJsZX0gc3RhdGUgVGhlIGluaXRpYWwgYXBwbGljYXRpb24gc3RhdGVcbiAgICAgICAgICovXG4gICAgICAgIGluaXRFbnRpdGllczogZnVuY3Rpb24gKGxpc3QsIHN0YXRlKSB7XG4gICAgICAgICAgICBlYWNoKGxpc3QsIGZ1bmN0aW9uIChjZmcpIHtcbiAgICAgICAgICAgICAgICBpZiAodXRpbHMuaXNGdW5jdGlvbihjZmcpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW50aXRpZXNGcm9tU3RhdGUucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBmbjogY2ZnLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuY3JlYXRlRW50aXR5KGNmZyk7XG4gICAgICAgICAgICB9LCB0aGlzKTtcblxuICAgICAgICAgICAgZWFjaCh0aGlzLmVudGl0aWVzRnJvbVN0YXRlLCB0aGlzLnVwZGF0ZUR5bmFtaWNFbnRpdGllcywgdGhpcywgW3N0YXRlXSk7XG5cbiAgICAgICAgICAgIHRoaXMubGFzdFN0YXRlID0gc3RhdGU7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFVwZGF0ZXMgYWxsIHJlZ2lzdGVyZWQgc3lzdGVtcyBhbmQgZXhpc3RpbmcgZW50aXRpZXMgd2l0aCB0aGUgY3VycmVudFxuICAgICAgICAgKiBhcHBsaWNhdGlvbiBzdGF0ZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge0ltbXV0YXRhYmxlfSBzdGF0ZSBUaGUgY3VycmVudCBhcHBsaWNhdGlvbiBzdGF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdXBkYXRlOiBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgICAgICAgICAgIHZhciBhcmdzID0gW3N0YXRlXTtcblxuICAgICAgICAgICAgaWYgKHN0YXRlICE9PSB0aGlzLmxhc3RTdGF0ZSkge1xuICAgICAgICAgICAgICAgIGVhY2godGhpcy5lbnRpdGllc0Zyb21TdGF0ZSwgdGhpcy51cGRhdGVEeW5hbWljRW50aXRpZXMsIHRoaXMsIGFyZ3MpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBlYWNoKHRoaXMuc3lzdGVtcywgdGhpcy51cGRhdGVTeXN0ZW0sIHRoaXMsIGFyZ3MpO1xuXG4gICAgICAgICAgICB0aGlzLmxhc3RTdGF0ZSA9IHN0YXRlO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8vXG4gICAgICAgIC8vXG4gICAgICAgIC8vIHByaXZhdGUgaGVscGVyXG4gICAgICAgIC8vXG4gICAgICAgIC8vXG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHVwZGF0ZVN5c3RlbTogZnVuY3Rpb24gKHN5c3RlbSwgaW5kZXgsIHN0YXRlKSB7XG4gICAgICAgICAgICBzeXN0ZW0udXBkYXRlKHN0YXRlKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgdXBkYXRlRHluYW1pY0VudGl0aWVzOiBmdW5jdGlvbiAoY2ZnLCBpbmRleCwgc3RhdGUpIHtcbiAgICAgICAgICAgIHZhciBjdXJyZW50TGlzdCA9IGNmZy5jdXJyZW50IHx8IFtdO1xuICAgICAgICAgICAgdmFyIG5ld0xpc3QgPSB0aGlzLmNyZWF0ZUVudGl0eU1hcChjZmcuZm4oc3RhdGUpKTtcbiAgICAgICAgICAgIHZhciB0b0JlUmVtb3ZlZCA9IHRoaXMuZmluZEl0ZW1zTm90SW5MaXN0KGN1cnJlbnRMaXN0LCBuZXdMaXN0KTtcbiAgICAgICAgICAgIHZhciB0b0JlQ3JlYXRlZCA9IHRoaXMuZmluZEl0ZW1zTm90SW5MaXN0KG5ld0xpc3QsIGN1cnJlbnRMaXN0KTtcblxuICAgICAgICAgICAgZWFjaChPYmplY3Qua2V5cyh0b0JlUmVtb3ZlZCksIHRoaXMucmVtb3ZlRW50aXR5LCB0aGlzKTtcbiAgICAgICAgICAgIGVhY2godG9CZUNyZWF0ZWQsIHRoaXMuY3JlYXRlRW50aXR5LCB0aGlzKTtcblxuICAgICAgICAgICAgY2ZnLmN1cnJlbnQgPSBuZXdMaXN0O1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICBjcmVhdGVFbnRpdHlNYXA6IGZ1bmN0aW9uIChsaXN0KSB7XG4gICAgICAgICAgICB2YXIgcmVzdWx0ID0ge307XG5cbiAgICAgICAgICAgIGVhY2gobGlzdCwgZnVuY3Rpb24gKGNmZykge1xuICAgICAgICAgICAgICAgIHJlc3VsdFtjZmcuaWRdID0gY2ZnO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIGZpbmRJdGVtc05vdEluTGlzdDogZnVuY3Rpb24gKGxpc3QxLCBsaXN0Mikge1xuICAgICAgICAgICAgcmV0dXJuIGVhY2gobGlzdDEsIGZ1bmN0aW9uIChpdGVtLCBrZXkpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWxpc3QyW2tleV0pIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGl0ZW07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIGNyZWF0ZUVudGl0eTogZnVuY3Rpb24gKGNmZykge1xuICAgICAgICAgICAgdmFyIGRlZmF1bHRzID0gdGhpcy5kZWZhdWx0c1tjZmcudHlwZV07XG4gICAgICAgICAgICBpZiAoZGVmYXVsdHMpIHtcbiAgICAgICAgICAgICAgICBjZmcgPSBkZWZhdWx0cy5zZXQoY2ZnKS52YWwoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGNmZy5jaGlsZHJlbikge1xuICAgICAgICAgICAgICAgIGNmZy5jaGlsZHJlbiA9IGVhY2goY2ZnLmNoaWxkcmVuLCB0aGlzLmNyZWF0ZUVudGl0eSwgdGhpcyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB0aGlzLnJlcG8uY3JlYXRlRW50aXR5KGNmZyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHJlbW92ZUVudGl0eTogZnVuY3Rpb24gKGVudGl0eSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVwby5yZW1vdmVFbnRpdHkoZW50aXR5KTtcbiAgICAgICAgfVxuXG4gICAgfSkud2hlbkJyZXdlZChmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgZW50aXR5IHJlcG9zaXRvcnlcbiAgICAgICAgICpcbiAgICAgICAgICogQHByb3BlcnR5IHJlcG9cbiAgICAgICAgICogQHR5cGUgYWxjaGVteS5lY3MuQXBvdGhlY2FyaXVzXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnJlcG8gPSBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgbGlzdCBvZiBjb21wb25lbnQgc3lzdGVtc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcHJvcGVydHkgc3lzdGVtc1xuICAgICAgICAgKiBAdHlwZSBBcnJheVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5zeXN0ZW1zID0gW107XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEEgbGlzdCBvZiBmdW5jdGlvbnMgd2hpY2ggZGVmaW5lcyBhIHNldCBvZiBlbnRpdGllcyBkZXBlbmRpbmdcbiAgICAgICAgICogb24gdGhlIGN1cnJlbnQgYXBwbGljYXRpb24gc3RhdGVcbiAgICAgICAgICpcbiAgICAgICAgICogQHByb3BlcnR5IGVudGl0aWVzRnJvbVN0YXRlXG4gICAgICAgICAqIEB0eXBlIEFycmF5XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmVudGl0aWVzRnJvbVN0YXRlID0gW107XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBsYXN0IGFwcGxpY2F0aW9uIHN0YXRlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwcm9wZXJ0eSBsYXN0U3RhdGVcbiAgICAgICAgICogQHR5cGUgSW1tdXRhdGFibGVcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubGFzdFN0YXRlID0gbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHNldCBvZiBjb21wb25lbnQgZGVmYXVsdHMgKG1hcCBlbnRpdHlUeXBlIC0+IGRlZmF1bHQgdmFsdWVzKVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcHJvcGVydHkgZGVmYXVsdHNcbiAgICAgICAgICogQHR5cGUgT2JqZWN0XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmRlZmF1bHRzID0ge307XG5cbiAgICB9KS53aGVuRGlzcG9zZWQoZnVuY3Rpb24gKCkge1xuICAgICAgICBlYWNoKHRoaXMuc3lzdGVtcywgZnVuY3Rpb24gKHN5c3RlbSwgaW5kZXgpIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtc1tpbmRleF0uZW50aXRpZXMgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW1zW2luZGV4XS5kaXNwb3NlKCk7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbXNbaW5kZXhdID0gbnVsbDtcbiAgICAgICAgfSwgdGhpcyk7XG4gICAgfSk7XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBpbW11dGFibGUgPSByZXF1aXJlKCdpbW11dGFiaWxpcycpO1xuICAgIHZhciBjb3F1b1ZlbmVudW0gPSByZXF1aXJlKCdjb3F1by12ZW5lbnVtJyk7XG4gICAgdmFyIGVhY2ggPSByZXF1aXJlKCdwcm8tc2luZ3VsaXMnKTtcbiAgICB2YXIgdXRpbHMgPSByZXF1aXJlKCcuL1V0aWxzJyk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcHJpbWFyeSBlbnRpdHkgbWFuYWdlciAoYW4gYXBvdGhlY2FyaXVzIGlzIGEgc3RvcmFnZSBtYW5hZ2VyKVxuICAgICAqIFwiT25lIHBvdGlvbiB0byBydWxlIHRoZW0gYWxsLCBvbmUgcG90aW9uIHRvIGZpbmQgdGhlbSxcbiAgICAgKiBvbmUgcG90aW9uIHRvIGJyaW5nIHRoZW0gYWxsIGFuZCBpbiB0aGUgZGFya25lc3MgYmluZCB0aGVtXCJcbiAgICAgKlxuICAgICAqIEBjbGFzc1xuICAgICAqIEBuYW1lIGFsY2hlbXkuZWNzLkFwb3RoZWNhcml1c1xuICAgICAqIEBleHRlbmRzIGFsY2hlbXkuY29yZS5NYXRlcmlhUHJpbWFcbiAgICAgKi9cbiAgICByZXR1cm4gY29xdW9WZW5lbnVtKHtcbiAgICAgICAgLyoqIEBsZW5kcyBhbGNoZW15LmVjcy5BcG90aGVjYXJpdXMucHJvdG90eXBlICovXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENyZWF0ZXMgYSBuZXcgZW50aXR5IChhIHNldCBvZiBjb21wb25lbnRzKVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gY2ZnIFRoZSBlbnRpdHkgdHlwZSBvciBhIGN1c3RvbSBjb21wb25lbnRcbiAgICAgICAgICogICAgICBjb25maWd1cmF0aW9uc1xuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gW2NmZy5pZF0gT3B0aW9uYWwuIEFuIGVudGl0eSBJRC4gSWYgb21taXR0ZWQgYSBuZXdcbiAgICAgICAgICogICAgICBvbmUgd2lsbCBiZSBjcmVhdGVkXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm4ge1N0cmluZ30gVGhlIGlkIG9mIHRoZSBuZXcgZW50aXR5XG4gICAgICAgICAqL1xuICAgICAgICBjcmVhdGVFbnRpdHk6IGZ1bmN0aW9uIChjZmcpIHtcbiAgICAgICAgICAgIHZhciBlbnRpdHlJZCA9IGNmZy5pZCB8fCB1dGlscy5pZCgpO1xuICAgICAgICAgICAgaWYgKHRoaXMuY29udGFpbnMoZW50aXR5SWQpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgJ1RoZSBpZDogXCInICsgZW50aXR5SWQgKyAnXCIgaXMgYWxyZWFkeSB1c2VkJztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5lbnRpdGllc1tlbnRpdHlJZF0gPSB7XG4gICAgICAgICAgICAgICAgaWQ6IGVudGl0eUlkLFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IFtdLFxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgLy8gY3JlYXRlIHRoZSBjb21wb25lbnRzIG9mIHRoZSBuZXcgZW50aXR5XG4gICAgICAgICAgICBlYWNoKGNmZywgZnVuY3Rpb24gKGNvbXBvbmVudCwga2V5KSB7XG4gICAgICAgICAgICAgICAgaWYgKGtleSA9PT0gJ2lkJyB8fCBrZXkgPT09ICd0eXBlJykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5zZXRDb21wb25lbnQoZW50aXR5SWQsIGtleSwgY29tcG9uZW50KTtcbiAgICAgICAgICAgIH0sIHRoaXMpO1xuXG4gICAgICAgICAgICByZXR1cm4gZW50aXR5SWQ7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENoZWNrcyBpZiBhbiBlbnRpdHkgd2l0aCB0aGUgZ2l2ZW4gaWQgZXhpc3RzXG4gICAgICAgICAqIEByZXR1cm4gQm9vbGVhblxuICAgICAgICAgKi9cbiAgICAgICAgY29udGFpbnM6IGZ1bmN0aW9uIChlbnRpdHlJZCkge1xuICAgICAgICAgICAgcmV0dXJuIHV0aWxzLmlzT2JqZWN0KHRoaXMuZW50aXRpZXNbZW50aXR5SWRdKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ29tcGxldGVseSByZW1vdmVzIGFsbCBleGlzdGluZyBlbnRpdGllcyBhbmQgdGhlaXJcbiAgICAgICAgICogY29tcG9uZW50cyAtIFRoZSB0b3RhbCBjbGVhbi11cCAtIFRoZSBlbmQgb2YgZGF5cy4uLlxuICAgICAgICAgKi9cbiAgICAgICAgcmVtb3ZlQWxsRW50aXRpZXM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGVhY2goT2JqZWN0LmtleXModGhpcy5lbnRpdGllcyksIHRoaXMucmVtb3ZlRW50aXR5LCB0aGlzKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVtb3ZlcyBhbiBlbnRpdHkgYW5kIGFsbCBpdHMgY29tcG9uZW50c1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gZW50aXR5SWQgVGhlIGlkIG9mIGVudGl0eSB0byByZW1vdmVcbiAgICAgICAgICovXG4gICAgICAgIHJlbW92ZUVudGl0eTogZnVuY3Rpb24gKGVudGl0eUlkKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuY29udGFpbnMoZW50aXR5SWQpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgZW50aXR5ID0gdGhpcy5lbnRpdGllc1tlbnRpdHlJZF07XG4gICAgICAgICAgICB2YXIgY21wcyA9IGVudGl0eS5jb21wb25lbnRzO1xuXG4gICAgICAgICAgICB3aGlsZSAoY21wcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW1vdmVDb21wb25lbnQoZW50aXR5LCBjbXBzWzBdKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5lbnRpdGllc1tlbnRpdHlJZF0gPSBudWxsO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZW1vdmVzIGEgc2luZ2xlIGNvbXBvbmVudCBvZiBhbiBlbnRpdHk7IFRoZSByZW1vdmVkIGNvbXBvbmVudCBpcyBkaXNwb3NlZFxuICAgICAgICAgKiBpZiBpdCBpcyBhIHBvdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ3xPYmplY3R9IGVudGl0eSBUaGUgZW50aXR5IG9iamVjdCBvciBpdHMgaWQgKEl0IGlzIHJlY29tbWVuZGVkIHRvIHVzZVxuICAgICAgICAgKiAgICAgIHRoZSBpZHMgZm9yIHB1YmxpYyBhY2Nlc3MhISEpXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfE51bWJlcn0gdHlwZSBUaGUgY29tcG9uZW50IHR5cGUgdG8gcmVtb3ZlIG9yIGl0cyBpbmRleCAodGhlIGluZGV4XG4gICAgICAgICAqICAgICAgaXMgZm9yIHByaXZhdGUgdXNhZ2UhISEpXG4gICAgICAgICAqL1xuICAgICAgICByZW1vdmVDb21wb25lbnQ6IGZ1bmN0aW9uIChlbnRpdHlJZCwgdHlwZSkge1xuICAgICAgICAgICAgdmFyIGVudGl0eSA9IHV0aWxzLmlzT2JqZWN0KGVudGl0eUlkKSA/IGVudGl0eUlkIDogdGhpcy5lbnRpdGllc1tlbnRpdHlJZF07XG4gICAgICAgICAgICBpZiAoIXV0aWxzLmlzT2JqZWN0KGVudGl0eSkpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyAnVW5rbm93biBlbnRpdHk6IFwiJyArIGVudGl0eUlkICsgJ1wiJztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGluZGV4ID0gZW50aXR5LmNvbXBvbmVudHMuaW5kZXhPZih0eXBlKTtcbiAgICAgICAgICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICAgICAgICAgICAgZW50aXR5LmNvbXBvbmVudHMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb24gPSB0aGlzLmNvbXBvbmVudHNbdHlwZV07XG4gICAgICAgICAgICBpZiAoY29sbGVjdGlvbikge1xuICAgICAgICAgICAgICAgIGNvbGxlY3Rpb25bZW50aXR5LmlkXSA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJldHVybnMgYW4gYXJyYXkgY29udGFpbmluZyBhbGwgY29tcG9uZW50cyBvZiBhIGdpdmUgdHlwZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gdHlwZSBUaGUgY29tcG9uZW50IGlkZW50aWZpZXJcbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fSBBbiBlbnRpdHlJZC10by1jb21wb25lbnQgaGFzaCBtYXBcbiAgICAgICAgICovXG4gICAgICAgIGdldEFsbENvbXBvbmVudHNPZlR5cGU6IGZ1bmN0aW9uICh0eXBlKSB7XG4gICAgICAgICAgICByZXR1cm4gZWFjaCh0aGlzLmNvbXBvbmVudHNbdHlwZV0sIGZpbHRlckV4aXN0aW5nKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmV0dXJucyBhbGwgY29tcG9uZW50IHZhbHVlcyBmb3IgYSBnaXZlbiBlbnRpdHlcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IGVudGl0eUlkIFRoZSBlbnRpdHkgaWRlbnRpZmllciAocmV0dXJuZWQgYnkgXCJjcmVhdGVFbnRpdHlcIilcbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fSBBIG1hcCAoY29tcG9uZW50IGlkZW50aWZpZXIgLT4gY29tcG9uZW50IHZhbHVlKSBjb250YWluaW5nXG4gICAgICAgICAqICAgICAgYWxsIGNvbXBvbmVudHMgb2YgdGhlIHJlcXVlc3RlZCBlbnRpdHkgKFRoZSBtYXAgd2lsbCBiZSBlbXB0eSBpZiB0aGVcbiAgICAgICAgICogICAgICBlbnRpdHkgZG9lcyBub3QgZXhpc3QpXG4gICAgICAgICAqXG4gICAgICAgICAqL1xuICAgICAgICBnZXRBbGxDb21wb25lbnRzT2ZFbnRpdHk6IGZ1bmN0aW9uIChlbnRpdHlJZCkge1xuICAgICAgICAgICAgdmFyIHJlc3VsdCA9IHt9O1xuICAgICAgICAgICAgdmFyIGVudGl0eSA9IHRoaXMuZW50aXRpZXNbZW50aXR5SWRdO1xuICAgICAgICAgICAgdmFyIGNvbXBvbmVudFR5cGVzID0gZW50aXR5ICYmIGVudGl0eS5jb21wb25lbnRzO1xuXG4gICAgICAgICAgICBlYWNoKGNvbXBvbmVudFR5cGVzLCBmdW5jdGlvbiAodHlwZSkge1xuICAgICAgICAgICAgICAgIHJlc3VsdFt0eXBlXSA9IHRoaXMuZ2V0Q29tcG9uZW50RGF0YShlbnRpdHlJZCwgdHlwZSk7XG4gICAgICAgICAgICB9LCB0aGlzKTtcblxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmV0dXJucyB0aGUgaW1tdXRhYmxlIGNvbXBvbmVudCBvZiBhIGdpdmVuIHR5cGUgZm9yIHRoZSBzcGVjaWZpZWRcbiAgICAgICAgICogZW50aXR5IHNwZWNpZmljIGVudGl0eSBvZiBhbGwgb2YgdGhhdCB0eXBlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBlbnRpdHlJZCBBbiBlbnRpdHkgaWRcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IGNvbXBvbmVudEtleSBUaGUgY29tcG9uZW50IHR5cGVcbiAgICAgICAgICogQHJldHVybiB7SW1tdXRhdGFibGV9IFRoZSBpbW11dGFibGUgZGF0YSBvZiBhIHNpbmdsZSBjb21wb25lbnRcbiAgICAgICAgICovXG4gICAgICAgIGdldENvbXBvbmVudDogZnVuY3Rpb24gKGVudGl0eUlkLCBjb21wb25lbnRLZXkpIHtcbiAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uID0gdGhpcy5jb21wb25lbnRzW2NvbXBvbmVudEtleV07XG4gICAgICAgICAgICByZXR1cm4gY29sbGVjdGlvbiAmJiBjb2xsZWN0aW9uW2VudGl0eUlkXTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmV0dXJucyB0aGUgcmF3IGNvbXBvbmVudCBkYXRhIG9mIGEgZ2l2ZW4gdHlwZSBmb3IgdGhlIHNwZWNpZmllZFxuICAgICAgICAgKiBlbnRpdHkgc3BlY2lmaWMgZW50aXR5IG9mIGFsbCBvZiB0aGF0IHR5cGVcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IGVudGl0eUlkIEFuIGVudGl0eSBpZFxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gY29tcG9uZW50S2V5IFRoZSBjb21wb25lbnQgdHlwZVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9IFRoZSByYXcgZGF0YSBmb3Igc2luZ2xlIGNvbXBvbmVudFxuICAgICAgICAgKi9cbiAgICAgICAgZ2V0Q29tcG9uZW50RGF0YTogZnVuY3Rpb24gKGVudGl0eUlkLCBjb21wb25lbnRLZXkpIHtcbiAgICAgICAgICAgIHZhciBjb21wb25lbnQgPSB0aGlzLmdldENvbXBvbmVudChlbnRpdHlJZCwgY29tcG9uZW50S2V5KTtcbiAgICAgICAgICAgIHJldHVybiBjb21wb25lbnQgJiYgY29tcG9uZW50LnZhbCgpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBZGQgYSBjb21wb25lbnQgdG8gYW4gZW50aXR5XG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBlbnRpdHlJZCBUaGUgZW50aXR5IGlkZW50aWZpZXJcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IGtleSBUaGUgY29tcG9uZW50IGlkZW50aWZpZXJcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IGNmZyBUaGUgY29tcG9uZW50IGNvbmZpZ3VyYXRpb25cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fSBUaGUgYWRkZWQgY29tcG9uZW50IG9iamVjdFxuICAgICAgICAgKi9cbiAgICAgICAgc2V0Q29tcG9uZW50OiBmdW5jdGlvbiAoZW50aXR5SWQsIGtleSwgY2ZnKSB7XG4gICAgICAgICAgICB2YXIgZW50aXR5ID0gdGhpcy5lbnRpdGllc1tlbnRpdHlJZF07XG4gICAgICAgICAgICBpZiAoIWVudGl0eSkge1xuICAgICAgICAgICAgICAgIHRocm93ICdVbmtub3duIGVudGl0eTogXCInICsgZW50aXR5SWQgKyAnXCInO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgY29sbGVjdGlvbiA9IHRoaXMuY29tcG9uZW50c1trZXldO1xuICAgICAgICAgICAgaWYgKCFjb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgLy8gaXQncyB0aGUgZmlyc3QgY29tcG9uZW50IG9mIHRoaXMgdHlwZVxuICAgICAgICAgICAgICAgIC8vIC0+IGNyZWF0ZSBhIG5ldyBjb2xsZWN0aW9uXG4gICAgICAgICAgICAgICAgY29sbGVjdGlvbiA9IHt9O1xuICAgICAgICAgICAgICAgIHRoaXMuY29tcG9uZW50c1trZXldID0gY29sbGVjdGlvbjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGNtcCA9IGNvbGxlY3Rpb25bZW50aXR5SWRdO1xuICAgICAgICAgICAgaWYgKGNtcCkge1xuICAgICAgICAgICAgICAgIC8vIHVwZGF0ZSBleGlzdGluZyBjb21wb25lbnRcbiAgICAgICAgICAgICAgICBjbXAgPSBjbXAuc2V0KGNmZyk7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gYWRkIG5ldyBjb21wb25lbnRcbiAgICAgICAgICAgICAgICBjbXAgPSBpbW11dGFibGUuZnJvbUpTKGNmZyk7XG4gICAgICAgICAgICAgICAgZW50aXR5LmNvbXBvbmVudHMucHVzaChrZXkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb2xsZWN0aW9uW2VudGl0eUlkXSA9IGNtcDtcblxuICAgICAgICAgICAgcmV0dXJuIGNtcC52YWwoKTtcbiAgICAgICAgfSxcblxuICAgIH0pLndoZW5CcmV3ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHNldHMgb2YgZGlmZmVyZW50IGNvbXBvbmVudHMgKG1hcCBjb21wb25lbnRcbiAgICAgICAgICogdHlwZSBuYW1lIC0+IGNvbGxlY3Rpb24gb2YgY29tcG9uZW50IGluc3RhbmNlKVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcHJvcGVydHkgY29tcG9uZW50c1xuICAgICAgICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5jb21wb25lbnRzID0ge307XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBjb2xsZWN0aW9uIG9mIHJlZ2lzdGVyZWQgZW50aXRpZXM7IGVhY2ggZW50aXR5IGlzIGFuIG9iamVjdCB3aXRoXG4gICAgICAgICAqIGFuIDxjb2RlPmlkPC9jb2RlPiBhbmQgYW4gYXJyYXkgb2Ygc3RyaW5ncyAoPGNvZGU+Y29tcG9uZW50czwvY29kZT4pXG4gICAgICAgICAqIHdoaWNoIHJlZmVyIHRoZSBlbnRpdHkncyBjb21wb25lbnRzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwcm9wZXJ0eSBlbnRpdGllc1xuICAgICAgICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5lbnRpdGllcyA9IHt9O1xuXG4gICAgfSkud2hlbkRpc3Bvc2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5yZW1vdmVBbGxFbnRpdGllcygpO1xuICAgIH0pO1xuXG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBmdW5jdGlvbiBmaWx0ZXJFeGlzdGluZyhvYmopIHtcbiAgICAgICAgaWYgKG9iaikge1xuICAgICAgICAgICAgcmV0dXJuIG9iai52YWwoKTtcbiAgICAgICAgfVxuICAgIH1cbn0oKSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIGltbXV0YWJsZSA9IHJlcXVpcmUoJ2ltbXV0YWJpbGlzJyk7XG4gICAgdmFyIGNvcXVvVmVuZW51bSA9IHJlcXVpcmUoJ2NvcXVvLXZlbmVudW0nKTtcbiAgICB2YXIgZWFjaCA9IHJlcXVpcmUoJ3Byby1zaW5ndWxpcycpO1xuICAgIHZhciB1dGlscyA9IHJlcXVpcmUoJy4vVXRpbHMnKTtcbiAgICB2YXIgT2JzZXJ2YXJpID0gcmVxdWlyZSgnLi9PYnNlcnZhcmknKTtcblxuICAgIC8qKlxuICAgICAqIERlc2NyaXB0aW9uXG4gICAgICpcbiAgICAgKiBAY2xhc3NcbiAgICAgKiBAbmFtZSBhbGNoZW15LndlYi5BcHBsaWNhdHVzXG4gICAgICogQGV4dGVuZHMgYWxjaGVteS5jb3JlLk1hdGVyaWFQcmltYVxuICAgICAqL1xuICAgIHJldHVybiBjb3F1b1ZlbmVudW0oe1xuICAgICAgICAvKiogQGxlbmRzIGFsY2hlbXkud2ViLkFwcGxpY2F0dXMucHJvdG90eXBlICovXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIDxjb2RlPnRydWU8L2NvZGU+IGlmIHRoZSBhcHAgaXMgcnVubmluZ1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcHJvcGVydHkgcnVuc1xuICAgICAgICAgKiBAdHlwZSBCb29sZWFuXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBydW5zOiBmYWxzZSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGdsb2JhbCBtZXNzYWdlIGJ1c1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcHJvcGVydHkgbWVzc2FnZXNcbiAgICAgICAgICogQHR5cGUgYWxjaGVteS5jb3JlLk9ic2VydmFyaVxuICAgICAgICAgKiBAcHJvdGVjdGVkXG4gICAgICAgICAqL1xuICAgICAgICBtZXNzYWdlczogdW5kZWZpbmVkLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgYXBwbGljYXRpb24gc3RhdGVcbiAgICAgICAgICpcbiAgICAgICAgICogQHByb3BlcnR5IHN0YXRlXG4gICAgICAgICAqIEB0eXBlIEltbXV0YWJsZVxuICAgICAgICAgKiBAcHJvdGVjdGVkXG4gICAgICAgICAqL1xuICAgICAgICBzdGF0ZTogdW5kZWZpbmVkLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBIb29rLW1ldGhvZDsgY2FsbGVkIHdoZW4gbGF1bmNoaW5nIHRoZSBhcHBcbiAgICAgICAgICogQHByb3RlY3RlZFxuICAgICAgICAgKi9cbiAgICAgICAgb25MYXVuY2g6IHV0aWxzLmVtcHR5Rm4sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEhvb2stbWV0aG9kOyBjYWxsZWQgYmVmb3JlIGNsb3NpbmcgdGhlIGFwcFxuICAgICAgICAgKiBAcHJvdGVjdGVkXG4gICAgICAgICAqL1xuICAgICAgICBvblNodXRkb3duOiB1dGlscy5lbXB0eUZuLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBIb29rLW1ldGhvZDsgY2FsbGVkIGluIGVhY2ggbG9vcCBydW4gdG8gdXBkYXRlIHRoZSBhcHBsaWNhdGlvbiBzdGF0ZVxuICAgICAgICAgKiBAcHJvdGVjdGVkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBsb29wUGFyYW1zIFRoZSBwYXJhbWV0ZXIgb2YgdGhlIGN1cnJlbnQgbG9vcCBpdGVyYXRpb25cbiAgICAgICAgICogQHBhcmFtIHtOdW1iZXJ9IGxvb3BQYXJhbXMubm93IFRoZSBjdXJyZW50IHRpbWVzdGFtcFxuICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gbG9vcFBhcmFtcy5mcmFtZSBUaGUgbnVtYmVyIG9mIHRoZSBjdXJyZW50IGl0ZXJhdGlvblxuICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gbG9vcFBhcmFtcy5mcHMgVGhlIGZyYW1lcyBwZXIgc2Vjb25kXG4gICAgICAgICAqIEBwYXJhbSB7U3RhdGV9IGxvb3BQYXJhbXMuc3RhdGUgVGhlIGN1cnJlbnQgYXBwbGljYXRpb24gc3RhdGVcbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybiBPYmplY3QgVGhlIG5ldyBhcHBsaWNhdGlvbiBzdGF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdXBkYXRlOiB1dGlscy5lbXB0eUZuLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBIb29rLW1ldGhvZDsgY2FsbGVkIGluIGVhY2ggbG9vcCBydW4gdG8gdXBkYXRlIHRoZSBhcHBsaWNhdGlvbiB2aWV3XG4gICAgICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IGxvb3BQYXJhbXMgVGhlIHBhcmFtZXRlciBvZiB0aGUgY3VycmVudCBsb29wIGl0ZXJhdGlvblxuICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gbG9vcFBhcmFtcy5ub3cgVGhlIGN1cnJlbnQgdGltZXN0YW1wXG4gICAgICAgICAqIEBwYXJhbSB7TnVtYmVyfSBsb29wUGFyYW1zLmZyYW1lIFRoZSBudW1iZXIgb2YgdGhlIGN1cnJlbnQgaXRlcmF0aW9uXG4gICAgICAgICAqIEBwYXJhbSB7TnVtYmVyfSBsb29wUGFyYW1zLmZwcyBUaGUgZnJhbWVzIHBlciBzZWNvbmRcbiAgICAgICAgICogQHBhcmFtIHtTdGF0ZX0gbG9vcFBhcmFtcy5zdGF0ZSBUaGUgY3VycmVudCBhcHBsaWNhdGlvbiBzdGF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgZHJhdzogdXRpbHMuZW1wdHlGbixcblxuICAgICAgICAvKipcbiAgICAgICAgICogU3RhcnRzIHRoZSBhcHBsaWNhdGlvbiBsb29wO1xuICAgICAgICAgKiBUaGlzIHdpbGwgY2FsbCB0aGUge0BsaW5rICNvbkxhdW5jaH0gaG9vayBtZXRob2RcbiAgICAgICAgICovXG4gICAgICAgIGxhdW5jaDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKHRoaXMucnVucykge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5ydW5zID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuZnJhbWUgPSAwO1xuICAgICAgICAgICAgdGhpcy5sYXN0VGljayA9IHV0aWxzLm5vdygpO1xuICAgICAgICAgICAgdGhpcy5vbkxhdW5jaCgpO1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIEZpcmVkIGFmdGVyIGFwcGxpY2F0aW9uIGlzIHJlYWR5XG4gICAgICAgICAgICAgKiBAZXZlbnRcbiAgICAgICAgICAgICAqIEBuYW1lIGFwcDpzdGFydFxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLm1lc3NhZ2VzLnRyaWdnZXIoJ2FwcDpzdGFydCcpO1xuXG4gICAgICAgICAgICAvLyBzdGFydCB0aGUgdXBkYXRlL2RyYXctbG9vcFxuICAgICAgICAgICAgdGhpcy5ib3VuZExvb3BGbiA9IHRoaXMuY3JlYXRlTG9vcEZ1bmN0aW9uKHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5ib3VuZExvb3BGbigpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBzdG9wcyB0aGUgYXBwbGljYXRpb24gbG9vcDtcbiAgICAgICAgICogdGhpcyB3aWxsIGNhbGwgdGhlIHtAbGluayAjZmluaXNofSBtZXRob2RcbiAgICAgICAgICovXG4gICAgICAgIHNodXRkb3duOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMucnVucykge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMubG9vcElkKSB7XG4gICAgICAgICAgICAgICAgdmFyIGNhbmNlbEFuaW1hdGlvbkZyYW1lID0gdGhpcy5jYW5jZWxBbmltYXRpb25GcmFtZTtcblxuICAgICAgICAgICAgICAgIGNhbmNlbEFuaW1hdGlvbkZyYW1lKHRoaXMubG9vcElkKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuYm91bmRMb29wRm4gPSBudWxsO1xuICAgICAgICAgICAgICAgIHRoaXMubG9vcElkID0gbnVsbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5vblNodXRkb3duKCk7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogRmlyZWQgYWZ0ZXIgYXBwbGljYXRpb24gaXMgc2h1dCBkb3duXG4gICAgICAgICAgICAgKiBAZXZlbnRcbiAgICAgICAgICAgICAqIEBuYW1lIGFwcDpzdG9wXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMubWVzc2FnZXMudHJpZ2dlcignYXBwOnN0b3AnKTtcbiAgICAgICAgICAgIHRoaXMucnVucyA9IGZhbHNlO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXR1cm5zIDxjb2RlPnRydWU8L2NvZGU+IGlmIGFuZCBvbmx5IGlmIHRoZSBjdXJyZW50IGFwcGxpY2F0aW9uXG4gICAgICAgICAqIGlzIHJ1bm5pbmcgKGl0IG1heSBvciBtYXkgbm90IGJlIHBhdXNlZCB0aG91Z2gpXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm4ge0Jvb2xlYW59XG4gICAgICAgICAqL1xuICAgICAgICBpc1J1bm5pbmc6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnJ1bnM7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENvbm5lY3RzIHRoZSBtZXNzYWdlIGJ1cyBldmVudHMgd2l0aCBoYW5kbGVyL2NvbnRyb2xsZXJcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIE9iamVjdCBjb250cm9sbGVyIFRoZSBjb250cm9sbGVyIG9iamVjdCB0byBoYW5kbGUgdGhlIG1lc3NhZ2VcbiAgICAgICAgICogICAgICBidXMgZXZlbnRzLiBBIGNvbnRyb2xsZXIgb2JqZWN0IGhhcyB0byBwcm92aWRlIGEgbWVzc2FnZXNcbiAgICAgICAgICogICAgICBwcm9wZXJ0eSB3aGljaCBtYXBzIGFuIGV2ZW50IHRvIGFuIGV2ZW50IGhhbmRsZXIgbWV0aG9kLiBUaGVcbiAgICAgICAgICogICAgICBoYW5kbGVyIG1ldGhvZCBpcyBjYWxsZWQgd2l0aCB0aGUgZXZlbnQgZGF0YSBhbmQgdGhlIGN1cnJlbnRcbiAgICAgICAgICogICAgICBhcHBsaWNhdGlvbiBzdGF0ZS4gVGhlIHJldHVybiB2YWx1ZSBvZiB0aGUgaGFuZGxlciBtZXRob2Qgd2lsbFxuICAgICAgICAgKiAgICAgIGJlIHRoZSBuZXcgYXBwbGljYXRpb24gc3RhdGVcbiAgICAgICAgICpcbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogdmFyIGNvbnRyb2xsZXIgPSB7XG4gICAgICAgICAqICAgbWVzc2FnZXM6IHtcbiAgICAgICAgICogICAgICdhcHA6c3RhcnQnOiAnb25BcHBTdGFydCcsXG4gICAgICAgICAqICAgICAuLi5cbiAgICAgICAgICogICB9LFxuICAgICAgICAgKlxuICAgICAgICAgKiAgIG9uQXBwU3RhcnQ6IGZ1bmN0aW9uIChkYXRhLCBzdGF0ZSkge1xuICAgICAgICAgKiAgICAgLi4uIC8vIGhhbmRsZSBldmVudFxuICAgICAgICAgKiAgICAgcmV0dXJuIG5ld1N0YXRlO1xuICAgICAgICAgKiAgIH0sXG4gICAgICAgICAqXG4gICAgICAgICAqICAgLi4uXG4gICAgICAgICAqIH07XG4gICAgICAgICAqL1xuICAgICAgICB3aXJlVXA6IGZ1bmN0aW9uIChjb250cm9sbGVyKSB7XG4gICAgICAgICAgICBpZiAoIWNvbnRyb2xsZXIpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyAnSW52YWxpZCBpbnB1dDogRW1wdHkgdmFsdWUnO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIWNvbnRyb2xsZXIubWVzc2FnZXMpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyAnSW52YWxpZCBpbnB1dDogTWVzc2FnZSBtYXAgbWlzc2luZyc7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGVhY2goY29udHJvbGxlci5tZXNzYWdlcywgZnVuY3Rpb24gKGZuTmFtZSwgbWVzc2FnZSkge1xuICAgICAgICAgICAgICAgIHRoaXMubWVzc2FnZXMub24obWVzc2FnZSwgZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZuID0gY29udHJvbGxlcltmbk5hbWVdO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gZm4uY2FsbChjb250cm9sbGVyLCB0aGlzLnN0YXRlLCBkYXRhKTtcbiAgICAgICAgICAgICAgICB9LCB0aGlzKTtcbiAgICAgICAgICAgIH0sIHRoaXMpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8vXG4gICAgICAgIC8vXG4gICAgICAgIC8vIHByaXZhdGUgaGVscGVyXG4gICAgICAgIC8vXG4gICAgICAgIC8vXG5cbiAgICAgICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lOiB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lLFxuICAgICAgICBjYW5jZWxBbmltYXRpb25GcmFtZTogd2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDcmVhdHMgdGhlIGFwcGxpY2F0aW9uIGxvb3AgbWV0aG9kIHdoaWNoIGNhbGxlZCBldmVyeSBpdGVyYXRpb247XG4gICAgICAgICAqIHdpbGwgY2FsbCB0aGUge0BsaW5rICN1cGRhdGV9IGFuZCB0aGUge0BsaW5rICNkcmF3fSBtZXRob2RcbiAgICAgICAgICogQGZ1bmN0aW9uXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBjcmVhdGVMb29wRnVuY3Rpb246IGZ1bmN0aW9uIChhcHApIHtcbiAgICAgICAgICAgIC8vIFVzZSBhbiBpbnN0YW5jZSBvZiBcIkxvb3BQYXJhbWV0ZXJcIiBpbnN0ZWFkIG9mIGEgZ2VuZXJpYyBvYmplY3RcbiAgICAgICAgICAgIC8vIGJlY2F1c2UgbW9zdCBqYXZhc2NyaXB0IGludGVycHJldGVyIGhhdmUgb3B0aW1pemVkIHByb3BlcnR5XG4gICAgICAgICAgICAvLyBhY2Nlc3MgZm9yIG9iamVjdHMgd2l0aCBhIFwiaGlkZGVuIGNsYXNzXCJcbiAgICAgICAgICAgIGZ1bmN0aW9uIExvb3BQYXJhbWV0ZXIoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5mcmFtZSA9IDA7XG4gICAgICAgICAgICAgICAgdGhpcy5ub3cgPSAwO1xuICAgICAgICAgICAgICAgIHRoaXMuZGVsYXkgPSAwO1xuICAgICAgICAgICAgICAgIHRoaXMuZnBzID0gMDtcbiAgICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gbnVsbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHRoZW4gPSB1dGlscy5ub3coKTtcbiAgICAgICAgICAgIHZhciBmcmFtZSA9IDA7XG4gICAgICAgICAgICB2YXIgbG9vcFBhcmFtcyA9IG5ldyBMb29wUGFyYW1ldGVyKCk7XG4gICAgICAgICAgICB2YXIgZnBzID0gNjA7XG4gICAgICAgICAgICB2YXIgZGVsYXkgPSAxMDAwIC8gZnBzO1xuICAgICAgICAgICAgdmFyIHJlcXVlc3RBbmltYXRpb25GcmFtZSA9IHRoaXMucmVxdWVzdEFuaW1hdGlvbkZyYW1lO1xuXG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gbG9vcChub3cpIHtcbiAgICAgICAgICAgICAgICBub3cgID0gbm93IHx8IHV0aWxzLm5vdygpO1xuICAgICAgICAgICAgICAgIGRlbGF5ID0gMC45NSAqIGRlbGF5ICsgMC4wNSAqIChub3cgLSB0aGVuKTtcbiAgICAgICAgICAgICAgICBmcHMgPSAxMDAwIC8gZGVsYXk7XG4gICAgICAgICAgICAgICAgdGhlbiA9IG5vdztcbiAgICAgICAgICAgICAgICBmcmFtZSsrO1xuXG4gICAgICAgICAgICAgICAgLy8gdXBkYXRlIHRoZSBwYXJhbWV0ZXIgc2V0IGZvciB0aGUgY3VycmVudCBpdGVyYXRpb25cbiAgICAgICAgICAgICAgICBsb29wUGFyYW1zLmZyYW1lID0gZnJhbWU7XG4gICAgICAgICAgICAgICAgbG9vcFBhcmFtcy5ub3cgPSBub3c7XG4gICAgICAgICAgICAgICAgbG9vcFBhcmFtcy5kZWxheSA9IE1hdGgucm91bmQoZGVsYXkpO1xuICAgICAgICAgICAgICAgIGxvb3BQYXJhbXMuZnBzID0gTWF0aC5yb3VuZChmcHMpO1xuICAgICAgICAgICAgICAgIGxvb3BQYXJhbXMuc3RhdGUgPSBhcHAuc3RhdGU7XG5cbiAgICAgICAgICAgICAgICB2YXIgbmV3U3RhdGUgPSBhcHAudXBkYXRlKGxvb3BQYXJhbXMpO1xuICAgICAgICAgICAgICAgIGlmIChuZXdTdGF0ZSAmJiBuZXdTdGF0ZSAhPT0gYXBwLnN0YXRlKSB7XG4gICAgICAgICAgICAgICAgICAgIGFwcC5zdGF0ZSA9IG5ld1N0YXRlO1xuICAgICAgICAgICAgICAgICAgICBsb29wUGFyYW1zLnN0YXRlID0gYXBwLnN0YXRlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGFwcC5kcmF3KGxvb3BQYXJhbXMpO1xuXG4gICAgICAgICAgICAgICAgYXBwLmxvb3BJZCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZShhcHAuYm91bmRMb29wRm4pO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfSxcblxuICAgIH0pLndoZW5CcmV3ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLm1lc3NhZ2VzID0gT2JzZXJ2YXJpLmJyZXcoKTtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IGltbXV0YWJsZS5mcm9tSlMoKTtcblxuICAgIH0pLndoZW5EaXNwb3NlZChmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuc2h1dGRvd24oKTtcbiAgICB9KTtcblxufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgY29xdW9WZW5lbnVtID0gcmVxdWlyZSgnY29xdW8tdmVuZW51bScpO1xuICAgIHZhciBlYWNoID0gcmVxdWlyZSgncHJvLXNpbmd1bGlzJyk7XG4gICAgdmFyIHV0aWxzID0gcmVxdWlyZSgnLi9VdGlscycpO1xuXG4gICAgLyoqXG4gICAgICogQSBjb21wb25lbnQgc3lzdGVtIHRvIHJlbmRlciBzdGF0aWMgYW5kIGR5bmFtaWMgQ1NTXG4gICAgICpcbiAgICAgKiBAY2xhc3NcbiAgICAgKiBAbmFtZSBhbGNoZW15LmVjcy5Dc3NSZW5kZXJTeXN0ZW1cbiAgICAgKiBAZXh0ZW5kcyBhbGNoZW15LmNvcmUuTWF0ZXJpYVByaW1hXG4gICAgICovXG4gICAgcmV0dXJuIGNvcXVvVmVuZW51bSh7XG4gICAgICAgIC8qKiBAbGVuZHMgYWxjaGVteS5lY3MuQ3NzUmVuZGVyU3lzdGVtLnByb3RvdHlwZSAqL1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgZW50aXR5IHN0b3JhZ2VcbiAgICAgICAgICpcbiAgICAgICAgICogQHByb3BlcnR5IGVudGl0aWVzXG4gICAgICAgICAqIEB0eXBlIGFsY2hlbXkuZWNzLkFwb3RoZWNhcml1c1xuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgZW50aXRpZXM6IHVuZGVmaW5lZCxcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGNzcyBzdHlsZSBoZWxwZXIgd2hpY2ggZG9lcyB0aGUgaGVhdnkgbGlmdGluZ1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcHJvcGVydHkgc3R5bHVzXG4gICAgICAgICAqIEB0eXBlIGFsY2hlbXkud2ViLlN0eWx1c1xuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgc3R5bHVzOiB1bmRlZmluZWQsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSB0aGUgcHJldmlvdXMgc3RhdGVcbiAgICAgICAgICpcbiAgICAgICAgICogQHByb3BlcnR5IGxhc3RTdGF0ZXNcbiAgICAgICAgICogQHR5cGUgT2JqZWN0XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBsYXN0U3RhdGVzOiB1bmRlZmluZWQsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFVwZGF0ZXMgdGhlIGNvbXBvbmVudCBzeXN0ZW0gd2l0aCB0aGUgY3VycmVudCBhcHBsaWNhdGlvbiBzdGF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdXBkYXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgZHluYW1pY0NzcyA9IHRoaXMuZW50aXRpZXMuZ2V0QWxsQ29tcG9uZW50c09mVHlwZSgnY3NzJyk7XG4gICAgICAgICAgICBlYWNoKGR5bmFtaWNDc3MsIHRoaXMudXBkYXRlRHluYW1pY0NzcywgdGhpcyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHVwZGF0ZUR5bmFtaWNDc3M6IGZ1bmN0aW9uIChjZmcsIGVudGl0eUlkKSB7XG4gICAgICAgICAgICB0aGlzLnByb2Nlc3NUeXBlUnVsZXMoY2ZnLCBlbnRpdHlJZCk7XG4gICAgICAgICAgICB0aGlzLnByb2Nlc3NFbnRpdHlSdWxlcyhjZmcsIGVudGl0eUlkKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgcHJvY2Vzc1R5cGVSdWxlczogZnVuY3Rpb24gKGNmZywgZW50aXR5SWQpIHtcbiAgICAgICAgICAgIGlmICghY2ZnLnR5cGVSdWxlcykge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5zZXRSdWxlcyhjZmcudHlwZVJ1bGVzKTtcbiAgICAgICAgICAgIHRoaXMuZW50aXRpZXMuc2V0Q29tcG9uZW50KGVudGl0eUlkLCAnY3NzJywge1xuICAgICAgICAgICAgICAgIHR5cGVSdWxlczogbnVsbCxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICBwcm9jZXNzRW50aXR5UnVsZXM6IGZ1bmN0aW9uIChjZmcsIGVudGl0eUlkKSB7XG4gICAgICAgICAgICBpZiAoIXV0aWxzLmlzT2JqZWN0KGNmZy5lbnRpdHlSdWxlcykpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmVudGl0aWVzLnJlbW92ZUNvbXBvbmVudChlbnRpdHlJZCwgJ2NzcycpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHJ1bGVzID0ge307XG5cbiAgICAgICAgICAgIGlmICh1dGlscy5pc0Z1bmN0aW9uKGNmZy5lbnRpdHlSdWxlcykpIHtcbiAgICAgICAgICAgICAgICB2YXIgbGFzdFN0YXRlID0gdGhpcy5sYXN0U3RhdGVzW2VudGl0eUlkXTtcbiAgICAgICAgICAgICAgICB2YXIgY3VycmVudFN0YXRlID0gdGhpcy5lbnRpdGllcy5nZXRDb21wb25lbnQoZW50aXR5SWQsICdzdGF0ZScpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGN1cnJlbnRTdGF0ZSA9PT0gbGFzdFN0YXRlKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBydWxlc1snIycgKyBlbnRpdHlJZF0gPSBjZmcuZW50aXR5UnVsZXMuY2FsbChudWxsLCBjdXJyZW50U3RhdGUpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5sYXN0U3RhdGVzW2VudGl0eUlkXSA9IGN1cnJlbnRTdGF0ZTtcbiAgICAgICAgICAgICAgICB0aGlzLnNldFJ1bGVzKHJ1bGVzKTtcblxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcnVsZXNbJyMnICsgZW50aXR5SWRdID0gY2ZnLmVudGl0eVJ1bGVzO1xuXG4gICAgICAgICAgICB0aGlzLnNldFJ1bGVzKHJ1bGVzKTtcbiAgICAgICAgICAgIHRoaXMuZW50aXRpZXMucmVtb3ZlQ29tcG9uZW50KGVudGl0eUlkLCAnY3NzJyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHNldFJ1bGVzOiBmdW5jdGlvbiAocnVsZXMpIHtcbiAgICAgICAgICAgIHRoaXMuc3R5bHVzLnNldFJ1bGVzKHJ1bGVzKTtcbiAgICAgICAgfSxcblxuICAgIH0pLndoZW5CcmV3ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLmxhc3RTdGF0ZXMgPSB7fTtcbiAgICB9KTtcbn0oKSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIGNvcXVvVmVuZW51bSA9IHJlcXVpcmUoJ2NvcXVvLXZlbmVudW0nKTtcbiAgICB2YXIgZWFjaCA9IHJlcXVpcmUoJ3Byby1zaW5ndWxpcycpO1xuXG4gICAgdmFyIERlbGVnYXRlID0gZnVuY3Rpb24gKGtleSwgZXZlbnQsIGhhbmRsZXIsIHNjb3BlKSB7XG4gICAgICAgIHRoaXMua2V5ID0ga2V5O1xuICAgICAgICB0aGlzLmV2ZW50ID0gZXZlbnQ7XG4gICAgICAgIHRoaXMuaGFuZGxlciA9IGhhbmRsZXI7XG4gICAgICAgIHRoaXMuc2NvcGUgPSBzY29wZTtcbiAgICB9O1xuXG4gICAgRGVsZWdhdGUucHJvdG90eXBlLmJpbmQgPSBmdW5jdGlvbiBiaW5kKGVsZW1lbnQpIHtcbiAgICAgICAgZWxlbWVudFtnZXRLZXkodGhpcy5ldmVudCldID0gdGhpcy5rZXk7XG4gICAgfTtcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICBmdW5jdGlvbiBnZXRLZXkoZXZlbnRuYW1lKSB7XG4gICAgICAgIHJldHVybiAnX19lX18nICsgZXZlbnRuYW1lO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBjbGFzc1xuICAgICAqIEBuYW1lIGFsY2hlbXkud2ViLkRlbGVnYXR1c1xuICAgICAqL1xuICAgIHJldHVybiBjb3F1b1ZlbmVudW0oe1xuICAgICAgICAvKiogQGxlbmRzIGFsY2hlbXkud2ViLkRlbGVnYXR1cy5wcm90b3R5cGUgKi9cblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHJvb3QgRE9NIG5vZGUgdGhhdCBjb2xsZWN0cyB0aGUgYnJvd3NlciBldmVudHNcbiAgICAgICAgICpcbiAgICAgICAgICogQHByb3BlcnR5IHJvb3RcbiAgICAgICAgICogQHR5cGUgRG9tTm9kZVxuICAgICAgICAgKiBAcmVhZG9ubHlcbiAgICAgICAgICovXG4gICAgICAgIHJvb3Q6IHVuZGVmaW5lZCxcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHNldCBvZiByZWdpc3RlcmVkIGV2ZW50IGhhbmRsZXJzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwcm9wZXJ0eSBldmVudHNcbiAgICAgICAgICogQHR5cGUgT2JqZWN0XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBldmVudHM6IHVuZGVmaW5lZCxcblxuICAgICAgICBjcmVhdGVEZWxlZ2F0ZTogZnVuY3Rpb24gKGV2ZW50LCBmbiwgc2NvcGUpIHtcbiAgICAgICAgICAgIHZhciBkZWxlZ2F0ZXMgPSB0aGlzLmV2ZW50c1tldmVudF07XG5cbiAgICAgICAgICAgIGlmICghZGVsZWdhdGVzKSB7XG4gICAgICAgICAgICAgICAgLy8gZmlyc3QgaGFuZGxlciBmb3IgdGhpcyBldmVudFxuICAgICAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICAgICAgICAgIGRlbGVnYXRlcyA9IFtdO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5ldmVudHNbZXZlbnRdID0gZGVsZWdhdGVzO1xuICAgICAgICAgICAgICAgIHRoaXMucm9vdFsnb24nICsgZXZlbnRdID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5oYW5kbGVFdmVudChldmVudCwgZSk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBkZWxlZ2F0ZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIGQgPSBkZWxlZ2F0ZXNbaV07XG4gICAgICAgICAgICAgICAgaWYgKGQuaGFuZGxlciA9PT0gZm4gJiYgZC5zY29wZSA9PT0gc2NvcGUpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gZXZlbnQgaGFuZGxlciB3YXMgYWxyZWFkeSBkZWZpbmVkXG4gICAgICAgICAgICAgICAgICAgIC8vIC0+IHVzZSBpdFxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBuZXdEZWwgPSBuZXcgRGVsZWdhdGUoZGVsZWdhdGVzLmxlbmd0aCwgZXZlbnQsIGZuLCBzY29wZSk7XG5cbiAgICAgICAgICAgIGRlbGVnYXRlcy5wdXNoKG5ld0RlbCk7XG5cbiAgICAgICAgICAgIHJldHVybiBuZXdEZWw7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLy9cbiAgICAgICAgLy9cbiAgICAgICAgLy8gcHJpdmF0ZSBoZWxwZXJcbiAgICAgICAgLy9cbiAgICAgICAgLy9cblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgaGFuZGxlRXZlbnQ6IGZ1bmN0aW9uIChldmVudE5hbWUsIGV2KSB7XG4gICAgICAgICAgICB2YXIgdGFyZ2V0ID0gZXYgJiYgZXYudGFyZ2V0O1xuXG4gICAgICAgICAgICB3aGlsZSAodGFyZ2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KHRhcmdldFtnZXRLZXkoZXZlbnROYW1lKV0sIGV2ZW50TmFtZSwgZXYpO1xuICAgICAgICAgICAgICAgIHRhcmdldCA9IHRhcmdldC5wYXJlbnROb2RlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICBkaXNwYXRjaEV2ZW50OiBmdW5jdGlvbiAoZXZlbnRLZXksIGV2ZW50TmFtZSwgZXZlbnQpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZXZlbnRLZXkgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgaGFuZGxlciA9IHRoaXMuZXZlbnRzW2V2ZW50TmFtZV07XG4gICAgICAgICAgICB2YXIgY2ZnID0gaGFuZGxlciAmJiBoYW5kbGVyW2V2ZW50S2V5XTtcblxuICAgICAgICAgICAgY2ZnLmhhbmRsZXIuY2FsbChjZmcuc2NvcGUsIGV2ZW50KTtcbiAgICAgICAgfSxcblxuICAgIH0pLndoZW5CcmV3ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnJvb3QgPSB0aGlzLnJvb3QgfHwgZG9jdW1lbnQuYm9keTtcbiAgICAgICAgdGhpcy5ldmVudHMgPSB7fTtcblxuICAgIH0pLndoZW5EaXNwb3NlZChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGVhY2godGhpcy5ldmVudHMsIGZ1bmN0aW9uIChoYW5kbGVyLCBldmVudCkge1xuICAgICAgICAgICAgd2hpbGUgKGhhbmRsZXIubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGhhbmRsZXIucG9wKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMucm9vdFsnb24nICsgZXZlbnRdID0gbnVsbDtcbiAgICAgICAgfSwgdGhpcyk7XG4gICAgfSk7XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBjb3F1b1ZlbmVudW0gPSByZXF1aXJlKCdjb3F1by12ZW5lbnVtJyk7XG4gICAgdmFyIGVhY2ggPSByZXF1aXJlKCdwcm8tc2luZ3VsaXMnKTtcbiAgICB2YXIgdXRpbHMgPSByZXF1aXJlKCcuL1V0aWxzJyk7XG5cbiAgICAvKipcbiAgICAgKiBBIGNvbXBvbmVudCBzeXN0ZW0gdG8gY3JlYXRlIGRlbGVnYXRlZCBldmVudCBoYW5kbGVyIGZvciBkb20gZXZlbnRzXG4gICAgICpcbiAgICAgKiBAY2xhc3NcbiAgICAgKiBAbmFtZSBhbGNoZW15LmVjcy5FdmVudFN5c3RlbVxuICAgICAqIEBleHRlbmRzIGFsY2hlbXkuY29yZS5NYXRlcmlhUHJpbWFcbiAgICAgKi9cbiAgICByZXR1cm4gY29xdW9WZW5lbnVtKHtcbiAgICAgICAgLyoqIEBsZW5kcyBhbGNoZW15LmVjcy5FdmVudFN5c3RlbS5wcm90b3R5cGUgKi9cblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIG1lc3NhZ2UgYnVzIGZvciB0aGUgYXBwaWNhdGlvbiBtZXNzYWdlc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcHJvcGVydHkgbWVzc2FnZXNcbiAgICAgICAgICogQHR5cGUgYWxjaGVteS5jb3JlLk9ic2VydmFyaVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgbWVzc2FnZXM6IHVuZGVmaW5lZCxcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGJyb3dzZXIgZXZlbnQgZGVsZWdhdG9yXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwcm9wZXJ0eSBkZWxlZ2F0b3JcbiAgICAgICAgICogQHR5cGUgYWxjaGVteS53ZWIuRGVsZWdhdHVzXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBkZWxlZ2F0b3I6IHVuZGVmaW5lZCxcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGVudGl0eSBzdG9yYWdlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwcm9wZXJ0eSBlbnRpdGllc1xuICAgICAgICAgKiBAdHlwZSBhbGNoZW15LmVjcy5BcG90aGVjYXJpdXNcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIGVudGl0aWVzOiB1bmRlZmluZWQsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFkZHMgYSBuZXcgZXZlbnQgaGFuZGxlclxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30ga2V5IFRoZSBpZGVudGlmaWVyIGZvciB0aGUgZXZlbnQgaGFuZGxlclxuICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBoYW5kbGVyIFRoZSBldmVudCBoYW5kbGVyIGZ1bmN0aW9uIHRvIGJlIGFkZGVkXG4gICAgICAgICAqL1xuICAgICAgICBhZGRIYW5kbGVyOiBmdW5jdGlvbiAoa2V5LCBoYW5kbGVyKSB7XG4gICAgICAgICAgICB0aGlzLmhhbmRsZXIgPSB0aGlzLmhhbmRsZXIgfHwge307XG4gICAgICAgICAgICB0aGlzLmhhbmRsZXJba2V5XSA9IGhhbmRsZXI7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFVwZGF0ZXMgdGhlIGNvbXBvbmVudCBzeXN0ZW0gd2l0aCB0aGUgY3VycmVudCBhcHBsaWNhdGlvbiBzdGF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdXBkYXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgZXZlbnRzID0gdGhpcy5lbnRpdGllcy5nZXRBbGxDb21wb25lbnRzT2ZUeXBlKCdldmVudHMnKTtcbiAgICAgICAgICAgIGVhY2goZXZlbnRzLCB0aGlzLmRlbGVnYXRlRXZlbnRzLCB0aGlzKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgZGVsZWdhdGVFdmVudHM6IGZ1bmN0aW9uIChjZmcsIGVudGl0eUlkKSB7XG4gICAgICAgICAgICBlYWNoKGNmZywgdGhpcy5kZWxlZ2F0ZUV2ZW50LCB0aGlzLCBbZW50aXR5SWRdKTtcbiAgICAgICAgICAgIHRoaXMuZW50aXRpZXMucmVtb3ZlQ29tcG9uZW50KGVudGl0eUlkLCAnZXZlbnRzJyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIGRlbGVnYXRlRXZlbnQ6IGZ1bmN0aW9uIChjZmcsIHJhd0V2ZW50TmFtZSwgZW50aXR5SWQpIHtcbiAgICAgICAgICAgIGlmICh1dGlscy5pc1N0cmluZyhjZmcpIHx8IHV0aWxzLmlzRnVuY3Rpb24oY2ZnKSkge1xuICAgICAgICAgICAgICAgIGNmZyA9IHtcbiAgICAgICAgICAgICAgICAgICAgaGFuZGxlcjogY2ZnXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGhhbmRsZXIgPSB0aGlzLmdldEV2ZW50SGFuZGxlcihlbnRpdHlJZCwgY2ZnKTtcbiAgICAgICAgICAgIHZhciBzcGxpdCA9IHJhd0V2ZW50TmFtZS5zcGxpdCgvXFxzLyk7XG4gICAgICAgICAgICB2YXIgZXZlbnROYW1lID0gc3BsaXQuc2hpZnQoKTtcbiAgICAgICAgICAgIHZhciBzZWxlY3RvciA9IGNmZy5zZWxlY3RvciB8fCBzcGxpdC5qb2luKCcgJyk7XG4gICAgICAgICAgICB2YXIgZGVsZWdhdGUgPSB0aGlzLmRlbGVnYXRvci5jcmVhdGVEZWxlZ2F0ZShldmVudE5hbWUsIGhhbmRsZXIpO1xuICAgICAgICAgICAgdmFyIGRlbGVnYXRlZEV2ZW50cyA9IHRoaXMuZW50aXRpZXMuZ2V0Q29tcG9uZW50RGF0YShlbnRpdHlJZCwgJ2RlbGVnYXRlZEV2ZW50cycpIHx8IFtdO1xuXG4gICAgICAgICAgICB0aGlzLmVudGl0aWVzLnNldENvbXBvbmVudChlbnRpdHlJZCwgJ2RlbGVnYXRlZEV2ZW50cycsIGRlbGVnYXRlZEV2ZW50cy5jb25jYXQoe1xuICAgICAgICAgICAgICAgIGV2ZW50OiBldmVudE5hbWUsXG4gICAgICAgICAgICAgICAgZGVsZWdhdGU6IGRlbGVnYXRlLFxuICAgICAgICAgICAgICAgIHNlbGVjdG9yOiBzZWxlY3RvcixcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgZ2V0RXZlbnRIYW5kbGVyOiBmdW5jdGlvbiAoZW50aXR5SWQsIGNmZykge1xuICAgICAgICAgICAgdmFyIGhhbmRsZXIgPSBjZmcuaGFuZGxlcjtcbiAgICAgICAgICAgIHZhciByZXBvID0gdGhpcy5lbnRpdGllcztcbiAgICAgICAgICAgIHZhciBtZXNzYWdlcyA9IHRoaXMubWVzc2FnZXM7XG4gICAgICAgICAgICB2YXIgc2VuZE1lc3NhZ2UgPSBmdW5jdGlvbiAobXNnLCBkYXRhKSB7XG4gICAgICAgICAgICAgICAgbWVzc2FnZXMudHJpZ2dlcihtc2csIGRhdGEpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgaWYgKHV0aWxzLmlzU3RyaW5nKGhhbmRsZXIpKSB7XG4gICAgICAgICAgICAgICAgaGFuZGxlciA9IHRoaXMuaGFuZGxlciAmJiB0aGlzLmhhbmRsZXJbY2ZnLmhhbmRsZXJdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgICAgICAgICAgdmFyIHN0YXRlLCBuZXdTdGF0ZTtcblxuICAgICAgICAgICAgICAgIGlmICh1dGlscy5pc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXRlID0gcmVwby5nZXRDb21wb25lbnQoZW50aXR5SWQsICdzdGF0ZScpO1xuICAgICAgICAgICAgICAgICAgICBuZXdTdGF0ZSA9IGhhbmRsZXIoZXZlbnQsIHN0YXRlLCBzZW5kTWVzc2FnZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBuZXdTdGF0ZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcG8uc2V0Q29tcG9uZW50KGVudGl0eUlkLCAnc3RhdGUnLCBuZXdTdGF0ZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoY2ZnLm1lc3NhZ2UpIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdGUgPSByZXBvLmdldENvbXBvbmVudERhdGEoZW50aXR5SWQsICdzdGF0ZScpO1xuICAgICAgICAgICAgICAgICAgICBzZW5kTWVzc2FnZShjZmcubWVzc2FnZSwgc3RhdGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH0sXG4gICAgfSk7XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBjb3F1b1ZlbmVudW0gPSByZXF1aXJlKCdjb3F1by12ZW5lbnVtJyk7XG4gICAgdmFyIGVhY2ggPSByZXF1aXJlKCdwcm8tc2luZ3VsaXMnKTtcbiAgICB2YXIgdXRpbHMgPSByZXF1aXJlKCcuL1V0aWxzJyk7XG5cbiAgICB2YXIgT2JzZXJ2YXJpID0ge1xuICAgICAgICAvKiogQGxlbmRzIGFsY2hlbXkuY29yZS5PYnNlcnZhcmkucHJvdG90eXBlICovXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBpbml0aWFsIHNldCBvZiBldmVudHM7XG4gICAgICAgICAqIFRoZSBjb25maWd1cmF0aW9uIG9iamVjdCBoYXMgdGhlIGZvbGxvd2luZyBmb3JtOlxuICAgICAgICAgKiA8cHJlPjxjb2RlPlxuICAgICAgICAgKiB7XG4gICAgICAgICAqICAgICAgZXZlbnQxOiB7XG4gICAgICAgICAqICAgICAgICAgIGZuOiB7RnVuY3Rpb259IC8vIHRoZSBoYW5kbGVyIGZ1bmN0aW9uXG4gICAgICAgICAqICAgICAgICAgIHNjb3BlOiB7T2JqZWN0fSAvLyB0aGUgZXhlY3V0aW9uIHNjb3BlIG9mIHRoZSBoYW5kbGVyXG4gICAgICAgICAqICAgICAgfSxcbiAgICAgICAgICogICAgICBldmVudDI6IHtcbiAgICAgICAgICogICAgICAgICAgLi4uXG4gICAgICAgICAqICAgICAgfSxcbiAgICAgICAgICogICAgICAuLi5cbiAgICAgICAgICogfVxuICAgICAgICAgKiA8L2NvZGU+PC9wcmU+XG4gICAgICAgICAqXG4gICAgICAgICAqIEBwcm9wZXJ0eSBldmVudHNcbiAgICAgICAgICogQHR5cGUgT2JqZWN0XG4gICAgICAgICAqL1xuICAgICAgICBldmVudHM6IHVuZGVmaW5lZCxcblxuICAgICAgICAvKipcbiAgICAgICAgICogVHJpZ2dlcnMgYW4gZXZlbnRcbiAgICAgICAgICogQGZ1bmN0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudE5hbWUgVGhlIGV2ZW50IG5hbWUvdHlwZVxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gZGF0YSBUaGUgZXZlbnQgZGF0YSAoY2FuIGJlIGFueXRoaW5nKVxuICAgICAgICAgKi9cbiAgICAgICAgdHJpZ2dlcjogKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBwcm9jZXNzTGlzdGVuZXIgPSBmdW5jdGlvbiAobGlzdGVuZXIsIGluZGV4LCBkYXRhLCBldmVudE9iaikge1xuICAgICAgICAgICAgICAgIGxpc3RlbmVyLmZuLmNhbGwobGlzdGVuZXIuc2NvcGUsIGRhdGEsIGV2ZW50T2JqKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAoZXZlbnROYW1lLCBkYXRhKSB7XG4gICAgICAgICAgICAgICAgdmFyIGxpc3RlbmVycyA9IHRoaXMuZXZlbnRzICYmIHV0aWxzLm1peChbXSwgdGhpcy5ldmVudHNbZXZlbnROYW1lXSk7XG4gICAgICAgICAgICAgICAgdmFyIGV2ZW50T2JqID0gZ2V0RXZlbnRPYmplY3QodGhpcywgZXZlbnROYW1lKTtcbiAgICAgICAgICAgICAgICB2YXIgYXJncyA9IFtkYXRhLCBldmVudE9ial07XG5cbiAgICAgICAgICAgICAgICAvLyBub3RpZnkgbGlzdGVuZXIgd2hpY2ggYXJlIHJlZ2lzdGVyZWQgZm9yIHRoZSBnaXZlbiBldmVudCB0eXBlXG4gICAgICAgICAgICAgICAgZWFjaChsaXN0ZW5lcnMsIHByb2Nlc3NMaXN0ZW5lciwgdGhpcywgYXJncyk7XG5cbiAgICAgICAgICAgICAgICAvLyBub3RpZnkgbGlzdGVuZXIgd2hpY2ggYXJlIHJlZ2lzdGVyZWQgZm9yIGFsbCBldmVudHNcbiAgICAgICAgICAgICAgICBsaXN0ZW5lcnMgPSB0aGlzLmV2ZW50cyAmJiB0aGlzLmV2ZW50c1snKiddO1xuICAgICAgICAgICAgICAgIGVhY2gobGlzdGVuZXJzLCBwcm9jZXNzTGlzdGVuZXIsIHRoaXMsIGFyZ3MpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfSgpKSxcblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBhZGRzIGEgbGlzdGVuZXIgZm9yIHRvIGFuIGV2ZW50XG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxuICAgICAgICAgKiAgICAgIHRoZSBldmVudCBuYW1lXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGhhbmRsZXJcbiAgICAgICAgICogICAgICB0aGUgZXZlbnQgaGFuZGxlciBtZXRob2RcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHNjb3BlXG4gICAgICAgICAqICAgICAgdGhlIGV4ZWN1dGlvbiBzY29wZSBmb3IgdGhlIGV2ZW50IGhhbmRsZXJcbiAgICAgICAgICovXG4gICAgICAgIG9uOiBmdW5jdGlvbiAoZXZlbnQsIGhhbmRsZXIsIHNjb3BlKSB7XG4gICAgICAgICAgICB0aGlzLmV2ZW50cyA9IHRoaXMuZXZlbnRzIHx8IHt9O1xuICAgICAgICAgICAgdGhpcy5ldmVudHNbZXZlbnRdID0gdGhpcy5ldmVudHNbZXZlbnRdIHx8IFtdO1xuICAgICAgICAgICAgdGhpcy5ldmVudHNbZXZlbnRdLnB1c2goe1xuICAgICAgICAgICAgICAgIGZuOiBoYW5kbGVyLFxuICAgICAgICAgICAgICAgIHNjb3BlOiBzY29wZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFkZHMgYSBvbmUtdGltZSBsaXN0ZW5lciBmb3IgdG8gYW4gZXZlbnQ7IFRoaXMgbGlzdGVuZXIgd2lsbFxuICAgICAgICAgKiBiZSByZW1vdmVkIGFmdGVyIHRoZSB0aGUgZmlyc3QgZXhlY3V0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudE5hbWVcbiAgICAgICAgICogICAgICB0aGUgZXZlbnQgbmFtZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBoYW5kbGVyXG4gICAgICAgICAqICAgICAgdGhlIGV2ZW50IGhhbmRsZXIgbWV0aG9kXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBzY29wZVxuICAgICAgICAgKiAgICAgIHRoZSBleGVjdXRpb24gc2NvcGUgZm9yIHRoZSBldmVudCBoYW5kbGVyXG4gICAgICAgICAqL1xuICAgICAgICBvbmNlOiBmdW5jdGlvbiAoZXZlbnROYW1lLCBoYW5kbGVyLCBzY29wZSkge1xuICAgICAgICAgICAgdmFyIHdyYXBwZXIgPSBmdW5jdGlvbiAoZGF0YSwgZXZlbnQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLm9mZihldmVudE5hbWUsIHdyYXBwZXIsIHRoaXMpO1xuICAgICAgICAgICAgICAgIGhhbmRsZXIuY2FsbChzY29wZSwgZGF0YSwgZXZlbnQpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHRoaXMub24oZXZlbnROYW1lLCB3cmFwcGVyLCB0aGlzKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogcmVtb3ZlcyBhIGxpc3RlbmVyIGZvciBmcm9tIGFuIGV2ZW50XG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxuICAgICAgICAgKiAgICAgIHRoZSBldmVudCBuYW1lXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGhhbmRsZXJcbiAgICAgICAgICogICAgICB0aGUgZXZlbnQgaGFuZGxlciBtZXRob2RcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHNjb3BlXG4gICAgICAgICAqICAgICAgdGhlIGV4ZWN1dGlvbiBzY29wZSBmb3IgdGhlIGV2ZW50IGhhbmRsZXJcbiAgICAgICAgICovXG4gICAgICAgIG9mZjogZnVuY3Rpb24gKGV2ZW50LCBoYW5kbGVyLCBzY29wZSkge1xuICAgICAgICAgICAgaWYgKGV2ZW50KSB7XG4gICAgICAgICAgICAgICAgY2xlYW5saXN0ZW5lckxpc3QodGhpcywgZXZlbnQsIGhhbmRsZXIsIHNjb3BlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZWFjaCh0aGlzLmV2ZW50cywgZnVuY3Rpb24gKGV2ZW50TGlzdG5lciwgZXZlbnROYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIGNsZWFubGlzdGVuZXJMaXN0KHRoaXMsIGV2ZW50TmFtZSwgaGFuZGxlciwgc2NvcGUpO1xuICAgICAgICAgICAgICAgIH0sIHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgIH07XG5cbiAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAgICAvLyBwcml2YXRlIGhlbHBlclxuICAgIC8vXG4gICAgLy9cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYW4gb2JqZWN0IHdpdGggbWV0YSBkYXRhIGZvciB0aGUgZ2l2ZW4gZXZlbnQgdHlwZVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgZnVuY3Rpb24gZ2V0RXZlbnRPYmplY3Qob2JzZXJ2YWJsZSwgZXZlbnROYW1lKSB7XG4gICAgICAgIG9ic2VydmFibGUuZXZlbnRPYmogPSBvYnNlcnZhYmxlLmV2ZW50T2JqIHx8IHt9O1xuICAgICAgICBpZiAoIW9ic2VydmFibGUuZXZlbnRPYmpbZXZlbnROYW1lXSkge1xuICAgICAgICAgICAgb2JzZXJ2YWJsZS5ldmVudE9ialtldmVudE5hbWVdID0ge1xuICAgICAgICAgICAgICAgIG5hbWU6IGV2ZW50TmFtZSxcbiAgICAgICAgICAgICAgICAgIHNvdXJjZTogb2JzZXJ2YWJsZVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb2JzZXJ2YWJsZS5ldmVudE9ialtldmVudE5hbWVdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFB1cmdlcyB0aGUgbGlzdCBvZiBldmVudCBoYW5kbGVycyBmcm9tIHRoZSBnaXZlbiBsaXN0ZW5lcnNcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGNsZWFubGlzdGVuZXJMaXN0KG9ic2VydmFibGUsIGV2ZW50LCBmbiwgc2NvcGUpIHtcbiAgICAgICAgdmFyIG9sZExpc3QgPSAob2JzZXJ2YWJsZS5ldmVudHMgJiYgb2JzZXJ2YWJsZS5ldmVudHNbZXZlbnRdKSB8fCBbXTtcbiAgICAgICAgdmFyIG5ld0xpc3QgPSBbXTtcbiAgICAgICAgdmFyIG1hdGNoOyAvLyB0cnVlIGlmIHRoZSBsaXN0ZW5lciAoZm4sIHNjb3BlKSBpcyByZWdpc3RlcmVkIGZvciB0aGUgZXZlbnRcbiAgICAgICAgdmFyIGxpc3RlbmVyID0gb2xkTGlzdC5wb3AoKTtcblxuICAgICAgICB3aGlsZSAobGlzdGVuZXIpIHtcbiAgICAgICAgICAgIG1hdGNoID0gKCFmbiB8fCBmbiA9PT0gbGlzdGVuZXIuZm4pICYmICghc2NvcGUgfHwgc2NvcGUgPT09IGxpc3RlbmVyLnNjb3BlKTtcblxuICAgICAgICAgICAgaWYgKCFtYXRjaCkge1xuICAgICAgICAgICAgICAgIG5ld0xpc3QucHVzaChsaXN0ZW5lcik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxpc3RlbmVyLmZuID0gbnVsbDtcbiAgICAgICAgICAgICAgICBsaXN0ZW5lci5zY29wZSA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsaXN0ZW5lciA9IG9sZExpc3QucG9wKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobmV3TGlzdC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBvYnNlcnZhYmxlLmV2ZW50c1tldmVudF0gPSBuZXdMaXN0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGVsZXRlIG9ic2VydmFibGUuZXZlbnRzW2V2ZW50XTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBjb3F1b1ZlbmVudW0oT2JzZXJ2YXJpKS53aGVuRGlzcG9zZWQoZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyByZW1vdmUgYWxsIGxpc3RlbmVyc1xuICAgICAgICB0aGlzLm9mZigpO1xuXG4gICAgICAgIC8vIGN1dCBjaXJjbGUgcmVmZXJlbmNlcyBmb3JtIHRoZSBldmVudE9ialxuICAgICAgICBlYWNoKHRoaXMuZXZlbnRPYmosIGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgICAgICBpdGVtLm5hbWUgPSBudWxsO1xuICAgICAgICAgICAgaXRlbS5zb3VyY2UgPSBudWxsO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5ldmVudE9iaiA9IG51bGw7XG4gICAgfSk7XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBpbW11dGFibGUgPSByZXF1aXJlKCdpbW11dGFiaWxpcycpO1xuICAgIHZhciBjb3F1b1ZlbmVudW0gPSByZXF1aXJlKCdjb3F1by12ZW5lbnVtJyk7XG4gICAgdmFyIGVhY2ggPSByZXF1aXJlKCdwcm8tc2luZ3VsaXMnKTtcbiAgICB2YXIgdXRpbHMgPSByZXF1aXJlKCcuL1V0aWxzJyk7XG5cbiAgICAvKipcbiAgICAgKiBUT0RPOiBkb2N1bWVudCBtZVxuICAgICAqXG4gICAgICogQGNsYXNzXG4gICAgICogQG5hbWUgYWxjaGVteS5lY3MuU3RhdGVTeXN0ZW1cbiAgICAgKiBAZXh0ZW5kcyBhbGNoZW15LmNvcmUuTWF0ZXJpYVByaW1hXG4gICAgICovXG4gICAgcmV0dXJuIGNvcXVvVmVuZW51bSh7XG4gICAgICAgIC8qKiBAbGVuZHMgYWxjaGVteS5lY3MuU3RhdGVTeXN0ZW0ucHJvdG90eXBlICovXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBlbnRpdHkgc3RvcmFnZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcHJvcGVydHkgZW50aXRpZXNcbiAgICAgICAgICogQHR5cGUgYWxjaGVteS5lY3MuQXBvdGhlY2FyaXVzXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBlbnRpdGllczogdW5kZWZpbmVkLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgcHJldmlvdXMgYXBwbGljYXRpb24gc3RhdGUgKHRoZXJlIGlzIG5vIG5lZWQgdG8gdXBkYXRlIGFsbFxuICAgICAgICAgKiBlbnRpdGllcyBpZiB0aGUgZ2xvYmFsIGFwcGxpY2F0aW9uIHN0YXRlIHJlbWFpbmVkIHVuY2hhbmdlZClcbiAgICAgICAgICpcbiAgICAgICAgICogQHByb3BlcnR5IGxhc3RTdGF0ZVxuICAgICAgICAgKiBAdHlwZSBPYmplY3RcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIGxhc3RTdGF0ZXM6IHVuZGVmaW5lZCxcblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBVcGRhdGVzIHRoZSBjb21wb25lbnQgc3lzdGVtIHdpdGggdGhlIGN1cnJlbnQgYXBwbGljYXRpb24gc3RhdGVcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIEltbXV0YWJsZSBjdXJyZW50QXBwU3RhdGUgVGhlIGN1cnJlbnQgYXBwbGljYXRpb24gc3RhdGVcbiAgICAgICAgICovXG4gICAgICAgIHVwZGF0ZTogZnVuY3Rpb24gKGN1cnJlbnRBcHBTdGF0ZSkge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRBcHBTdGF0ZSA9PT0gdGhpcy5sYXN0U3RhdGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBzdGF0ZUNvbXBvbmVudHMgPSB0aGlzLmVudGl0aWVzLmdldEFsbENvbXBvbmVudHNPZlR5cGUoJ2dsb2JhbFRvTG9jYWwnKTtcblxuICAgICAgICAgICAgZWFjaChzdGF0ZUNvbXBvbmVudHMsIHRoaXMudXBkYXRlRW50aXR5LCB0aGlzLCBbY3VycmVudEFwcFN0YXRlXSk7XG5cbiAgICAgICAgICAgIHRoaXMubGFzdFN0YXRlID0gY3VycmVudEFwcFN0YXRlO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB1cGRhdGVFbnRpdHk6IGZ1bmN0aW9uIChnbG9iYWxUb0xvY2FsLCBlbnRpdHlJZCwgYXBwU3RhdGUpIHtcbiAgICAgICAgICAgIHZhciBuZXdTdGF0ZSA9IHRoaXMuZW50aXRpZXMuZ2V0Q29tcG9uZW50RGF0YShlbnRpdHlJZCwgJ3N0YXRlJykgfHwge307XG5cbiAgICAgICAgICAgIGlmICh1dGlscy5pc0Z1bmN0aW9uKGdsb2JhbFRvTG9jYWwpKSB7XG4gICAgICAgICAgICAgICAgbmV3U3RhdGUgPSBnbG9iYWxUb0xvY2FsKGFwcFN0YXRlLCBuZXdTdGF0ZSk7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZWFjaChnbG9iYWxUb0xvY2FsLCBmdW5jdGlvbiAobG9jYWxLZXksIGdsb2JhbFBhdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgbmV3U3RhdGVbbG9jYWxLZXldID0gaW1tdXRhYmxlLmZpbmQoYXBwU3RhdGUsIGdsb2JhbFBhdGgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmVudGl0aWVzLnNldENvbXBvbmVudChlbnRpdHlJZCwgJ3N0YXRlJywgbmV3U3RhdGUpO1xuICAgICAgICB9XG4gICAgfSk7XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBjb3F1b1ZlbmVudW0gPSByZXF1aXJlKCdjb3F1by12ZW5lbnVtJyk7XG4gICAgdmFyIGVhY2ggPSByZXF1aXJlKCdwcm8tc2luZ3VsaXMnKTtcblxuICAgIHJldHVybiBjb3F1b1ZlbmVudW0oe1xuICAgICAgICAvKiogQGxlbmRzIGFsY2hlbXkud2ViLlN0eWx1cy5wcm90b3R5cGUgKi9cblxuICAgICAgICAvKipcbiAgICAgICAgICogQW4gaW50ZXJuYWwgc3RvcmUgZm9yIHJ1bGUgbWV0YSBpbmZvcm1hdGlvbnNcbiAgICAgICAgICpcbiAgICAgICAgICogQHByb3BlcnR5IHJ1bGVzXG4gICAgICAgICAqIEB0eXBlIE9iamVjdFxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgcnVsZXM6IHVuZGVmaW5lZCxcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIENzc1N0eWxlU2hlZXQgdGhhdCBzdG9yZXMgYWxsIGNzcyBydWxlc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcHJvcGVydHkgc2hlZXRcbiAgICAgICAgICogQHR5cGUgQ3NzU3R5bGVTaGVldFxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgc2hlZXQ6IHVuZGVmaW5lZCxcblxuICAgICAgICAvKipcbiAgICAgICAgICogU2V0cyBDU1MgcnVsZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIE9iamVjdCBydWxlcyBBIHNldCBvZiBydWxlcyB3aGVyZSB0aGUga2V5cyBhcmUgdGhlIHNlbGVjdG9yc1xuICAgICAgICAgKiAgICAgIGFuZCB0aGUgdmFsdWVzIHRoZSBjc3MgcnVsZSBib2R5XG4gICAgICAgICAqXG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIHN0eWx1cy5zZXRSdWxlcyh7XG4gICAgICAgICAqICAgJ2RpdiNzb21lLWlkIC5zb21lLWNsYXNzIHtcbiAgICAgICAgICogICAgICdiYWNrZ3JvdW5kJzogJ3VybChcIi4uLlwiKSAuLi4nLFxuICAgICAgICAgKiAgICAgLi4uXG4gICAgICAgICAqICAgfSxcbiAgICAgICAgICpcbiAgICAgICAgICogICAnI3NvbWUtb3RoZXItaWQge1xuICAgICAgICAgKiAgICAgLi4uXG4gICAgICAgICAqICAgfSxcbiAgICAgICAgICpcbiAgICAgICAgICogICAuLi5cbiAgICAgICAgICogfSk7XG4gICAgICAgICAqL1xuICAgICAgICBzZXRSdWxlczogZnVuY3Rpb24gKHJ1bGVzKSB7XG4gICAgICAgICAgICBlYWNoKHRoaXMucHJlcGFyZShydWxlcywge30sICcnKSwgdGhpcy5zZXRSdWxlLCB0aGlzKTtcbiAgICAgICAgfSxcblxuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICBwcmVwYXJlOiBmdW5jdGlvbiAocmF3LCByZXN1bHQsIHNlbGVjdG9yKSB7XG4gICAgICAgICAgICBlYWNoKHJhdywgZnVuY3Rpb24gKHZhbHVlLCBrZXkpIHtcbiAgICAgICAgICAgICAgICBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnByZXBhcmUodmFsdWUsIHJlc3VsdCwgdGhpcy5jb21iaW5lU2VsZWN0b3Ioc2VsZWN0b3IsIGtleSkpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmVzdWx0W3NlbGVjdG9yXSA9IHJlc3VsdFtzZWxlY3Rvcl0gfHwge307XG4gICAgICAgICAgICAgICAgcmVzdWx0W3NlbGVjdG9yXVtrZXldID0gdmFsdWU7XG4gICAgICAgICAgICB9LCB0aGlzKTtcblxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfSxcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgY29tYmluZVNlbGVjdG9yOiBmdW5jdGlvbiAocGFyZW50LCBjaGlsZCkge1xuICAgICAgICAgICAgdmFyIHJlc3VsdCA9IChwYXJlbnQgKyAnICcgKyBjaGlsZCkucmVwbGFjZSgvXFxzKiYvZywgJycpO1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfSxcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgc2V0UnVsZTogZnVuY3Rpb24gKHJ1bGUsIHNlbGVjdG9yKSB7XG4gICAgICAgICAgICB2YXIgcnVsZVN0ciA9IHRoaXMuY3JlYXRlUnVsZVN0cihzZWxlY3RvciwgcnVsZSk7XG4gICAgICAgICAgICB2YXIgc2hlZXQgPSB0aGlzLmdldFN0eWxlU2hlZXQoKTtcbiAgICAgICAgICAgIHZhciBydWxlRGF0YSA9IHRoaXMucnVsZXNbc2VsZWN0b3JdO1xuXG4gICAgICAgICAgICBpZiAocnVsZURhdGEpIHtcbiAgICAgICAgICAgICAgICAvLyB1cGRhdGUgZXhpc3RpbmcgcnVsZVxuICAgICAgICAgICAgICAgIHNoZWV0LmRlbGV0ZVJ1bGUocnVsZURhdGEuaW5kZXgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBhZGQgbmV3IHJ1bGVcbiAgICAgICAgICAgICAgICBydWxlRGF0YSA9IHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXg6IHNoZWV0LmNzc1J1bGVzLmxlbmd0aFxuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICB0aGlzLnJ1bGVzW3NlbGVjdG9yXSA9IHJ1bGVEYXRhO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzaGVldC5pbnNlcnRSdWxlKHJ1bGVTdHIsIHJ1bGVEYXRhLmluZGV4KTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgY3JlYXRlUnVsZVN0cjogZnVuY3Rpb24gKHNlbGVjdG9yLCBydWxlKSB7XG4gICAgICAgICAgICB2YXIgcHJvcHMgPSAnJztcbiAgICAgICAgICAgIGVhY2gocnVsZSwgZnVuY3Rpb24gKHZhbHVlLCBrZXkpIHtcbiAgICAgICAgICAgICAgICBwcm9wcyArPSBrZXkgKyAnOicgKyB2YWx1ZSArICc7JztcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gc2VsZWN0b3IgKyAneycgKyBwcm9wcyArICd9JztcbiAgICAgICAgfSxcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgZ2V0U3R5bGVTaGVldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLnNoZWV0KSB7XG4gICAgICAgICAgICAgICAgdmFyIHN0eWxlRWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoc3R5bGVFbCk7XG4gICAgICAgICAgICAgICAgdGhpcy5zaGVldCA9IHN0eWxlRWwuc2hlZXQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB0aGlzLnNoZWV0O1xuICAgICAgICB9LFxuXG4gICAgfSkud2hlbkJyZXdlZChmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMucnVsZXMgPSB7fTtcblxuICAgIH0pLndoZW5EaXNwb3NlZChmdW5jdGlvbiAoKSB7XG4gICAgICAgIHdoaWxlICh0aGlzLnNoZWV0ICYmIHRoaXMuc2hlZXQuY3NzUnVsZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgdGhpcy5zaGVldC5kZWxldGVSdWxlKDApO1xuICAgICAgICB9XG4gICAgfSk7XG59KCkpO1xuIiwiLypcbiAqICAg4oCcTWVkaWNpbmUsIGFuZCBMYXcsIGFuZCBQaGlsb3NvcGh5IC1cbiAqICAgIFlvdSd2ZSB3b3JrZWQgeW91ciB3YXkgdGhyb3VnaCBldmVyeSBzY2hvb2wsXG4gKiAgICBFdmVuLCBHb2QgaGVscCB5b3UsIFRoZW9sb2d5LFxuICogICAgQW5kIHN3ZWF0ZWQgYXQgaXQgbGlrZSBhIGZvb2wuXG4gKiAgICBXaHkgbGFib3VyIGF0IGl0IGFueSBtb3JlP1xuICogICAgWW91J3JlIG5vIHdpc2VyIG5vdyB0aGFuIHlvdSB3ZXJlIGJlZm9yZS5cbiAqICAgIFlvdSdyZSBNYXN0ZXIgb2YgQXJ0cywgYW5kIERvY3RvciB0b28sXG4gKiAgICBBbmQgZm9yIHRlbiB5ZWFycyBhbGwgeW91J3ZlIGJlZW4gYWJsZSB0byBkb1xuICogICAgSXMgbGVhZCB5b3VyIHN0dWRlbnRzIGEgZmVhcmZ1bCBkYW5jZVxuICogICAgVGhyb3VnaCBhIG1hemUgb2YgZXJyb3IgYW5kIGlnbm9yYW5jZS5cbiAqICAgIEFuZCBhbGwgdGhpcyBtaXNlcnkgZ29lcyB0byBzaG93XG4gKiAgICBUaGVyZSdzIG5vdGhpbmcgd2UgY2FuIGV2ZXIga25vdy5cbiAqICAgIE9oIHllcyB5b3UncmUgYnJpZ2h0ZXIgdGhhbiBhbGwgdGhvc2UgcmVsaWNzLFxuICogICAgUHJvZmVzc29ycyBhbmQgRG9jdG9ycywgc2NyaWJibGVycyBhbmQgY2xlcmljcyxcbiAqICAgIE5vIGRvdWJ0cyBvciBzY3J1cGxlcyB0byB0cm91YmxlIHlvdSxcbiAqICAgIERlZnlpbmcgaGVsbCwgYW5kIHRoZSBEZXZpbCB0b28uXG4gKiAgICBCdXQgdGhlcmUncyBubyBqb3kgaW4gc2VsZi1kZWx1c2lvbjtcbiAqICAgIFlvdXIgc2VhcmNoIGZvciB0cnV0aCBlbmRzIGluIGNvbmZ1c2lvbi5cbiAqICAgIERvbid0IGltYWdpbmUgeW91ciB0ZWFjaGluZyB3aWxsIGV2ZXIgcmFpc2VcbiAqICAgIFRoZSBtaW5kcyBvZiBtZW4gb3IgY2hhbmdlIHRoZWlyIHdheXMuXG4gKiAgICBBbmQgYXMgZm9yIHdvcmxkbHkgd2VhbHRoLCB5b3UgaGF2ZSBub25lIC1cbiAqICAgIFdoYXQgaG9ub3VyIG9yIGdsb3J5IGhhdmUgeW91IHdvbj9cbiAqICAgIEEgZG9nIGNvdWxkIHN0YW5kIHRoaXMgbGlmZSBubyBtb3JlLlxuICogICAgQW5kIHNvIEkndmUgdHVybmVkIHRvIG1hZ2ljIGxvcmU7XG4gKiAgICBUaGUgc3Bpcml0IG1lc3NhZ2Ugb2YgdGhpcyBhcnRcbiAqICAgIFNvbWUgc2VjcmV0IGtub3dsZWRnZSBtaWdodCBpbXBhcnQuXG4gKiAgICBObyBsb25nZXIgc2hhbGwgSSBzd2VhdCB0byB0ZWFjaFxuICogICAgV2hhdCBhbHdheXMgbGF5IGJleW9uZCBteSByZWFjaDtcbiAqICAgIEknbGwga25vdyB3aGF0IG1ha2VzIHRoZSB3b3JsZCByZXZvbHZlLFxuICogICAgSXRzIG15c3RlcmllcyByZXNvbHZlLFxuICogICAgTm8gbW9yZSBpbiBlbXB0eSB3b3JkcyBJJ2xsIGRlYWwgLVxuICogICAgQ3JlYXRpb24ncyB3ZWxsc3ByaW5ncyBJJ2xsIHJldmVhbCHigJ1cbiAqICAgICAgICAgICAg4oCVIEpvaGFubiBXb2xmZ2FuZyB2b24gR29ldGhlLCBGYXVzdFxuICovXG4oZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBpc0Jyb3dzZXIgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJztcbiAgICB2YXIgZWFjaCA9IHJlcXVpcmUoJ3Byby1zaW5ndWxpcycpO1xuICAgIHZhciBVdGlscyA9IHt9O1xuXG4gICAgLyoqXG4gICAgICogaGVscGVyIHRvIHR1cm4gdGhlIGZpcnN0IGxldHRlciBvZiBhIHN0cmluZyB0byB1cHBlciBjYXNlXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBmdW5jdGlvbiB1Y0ZpcnN0KHMpIHtcbiAgICAgICAgcmV0dXJuIFV0aWxzLmlzU3RyaW5nKHMpID8gcy5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHMuc3Vic3RyKDEsIHMubGVuZ3RoKSA6ICcnO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IFV0aWxzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHRoZSBwcmVmaXggZm9yIGludGVybmFsIHR5cGUgYW5kIG1ldGhvZCBtZXRhIHByb3BlcnRpZXNcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBtZXRhUHJlZml4XG4gICAgICogQHR5cGUgU3RyaW5nXG4gICAgICovXG4gICAgVXRpbHMubWV0YVByZWZpeCA9ICdfQUpTXyc7XG5cbiAgICAvKipcbiAgICAgKiBDaGVja3MgaWYgYSBnaXZlbiBpdGVtIGlzIGFuIG9iamVjdC5cbiAgICAgKiBOb3RpY2UgdGhhdCBldmVyeSBhcnJheSBpcyBhbiBvYmplY3QgYnV0IG5vdCBldmVyeSBvYmplY3RcbiAgICAgKiBpcyBhbiBhcnJheSAod2hpY2ggaXMgYWxzbyB0cnVlIGZvciBmdW5jdGlvbnMpLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWYXJpb3VzfSBvIFRoZSBpdGVtIHRvIGJlIGNoZWNrZWRcbiAgICAgKiBAcmV0dXJuIHtCb29sZWFufSA8Y29kZT50cnVlPC9jb2RlPiBpZiB0aGUgZ2l2ZW4gaXRlbSBpcyBhbiBvYmplY3RcbiAgICAgKi9cbiAgICBVdGlscy5pc09iamVjdCA9IGZ1bmN0aW9uIGlzT2JqZWN0KG8pIHtcbiAgICAgICAgcmV0dXJuIG8gJiYgKHR5cGVvZiBvID09PSAnb2JqZWN0JyB8fCB0eXBlb2YgbyA9PT0gJ2Z1bmN0aW9uJyk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIENoZWNrcyBpZiBhIGdpdmVuIGl0ZW0gaXMgYW4gYXJyYXlcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmFyaW91c30gYSBUaGUgaXRlbSB0byBiZSBjaGVja2VkXG4gICAgICogQHJldHVybiB7Qm9vbGVhbn0gPGNvZGU+dHJ1ZTwvY29kZT4gaWYgdGhlIGdpdmVuIGl0ZW0gaXMgYW4gYXJyYXlcbiAgICAgKi9cbiAgICBVdGlscy5pc0FycmF5ID0gZnVuY3Rpb24gaXNBcnJheShhKSB7XG4gICAgICAgIHJldHVybiBhIGluc3RhbmNlb2YgQXJyYXk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIENoZWNrcyBpZiBhIGdpdmVuIGl0ZW0gaXMgYSBmdW5jdGlvblxuICAgICAqXG4gICAgICogQHBhcmFtIHtWYXJpb3VzfSBmIFRoZSBpdGVtIHRvIGJlIGNoZWNrZWRcbiAgICAgKiBAcmV0dXJuIHtCb29sZWFufSA8Y29kZT50cnVlPC9jb2RlPiBpZiB0aGUgZ2l2ZW4gaXRlbSBpcyBhIGZ1bmN0aW9uXG4gICAgICovXG4gICAgVXRpbHMuaXNGdW5jdGlvbiA9IGZ1bmN0aW9uIGlzRnVuY3Rpb24oZikge1xuICAgICAgICByZXR1cm4gdHlwZW9mIGYgPT09ICdmdW5jdGlvbic7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIENoZWNrcyBpZiBhIGdpdmVuIGl0ZW0gaXMgYSBudW1iZXJcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmFyaW91c30gbiBUaGUgaXRlbSB0byBiZSBjaGVja2VkXG4gICAgICogQHJldHVybiB7Qm9vbGVhbn0gPGNvZGU+dHJ1ZTwvY29kZT4gaWYgdGhlIGdpdmVuIGl0ZW0gaXMgYSBudW1iZXJcbiAgICAgKi9cbiAgICBVdGlscy5pc051bWJlciA9IGZ1bmN0aW9uIGlzTnVtYmVyKG4pIHtcbiAgICAgICAgcmV0dXJuIHR5cGVvZiBuID09PSAnbnVtYmVyJyAmJiAhaXNOYU4obik7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIENoZWNrcyBpZiBhIGdpdmVuIGl0ZW0gaXMgYSBzdHJpbmdcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmFyaW91c30gcyBUaGUgaXRlbSB0byBiZSBjaGVja2VkXG4gICAgICogQHJldHVybiB7Qm9vbGVhbn0gPGNvZGU+dHJ1ZTwvY29kZT4gaWYgdGhlIGdpdmVuIGl0ZW0gaXMgYSBzdHJpbmdcbiAgICAgKi9cbiAgICBVdGlscy5pc1N0cmluZyA9IGZ1bmN0aW9uIGlzU3RyaW5nKHMpIHtcbiAgICAgICAgcmV0dXJuIHR5cGVvZiBzID09PSAnc3RyaW5nJztcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQ2hlY2tzIGlmIHRoZSBnaXZlbiBpdGVtIGlzIGEgYm9vbGVhblxuICAgICAqXG4gICAgICogQHBhcmFtIHtWYXJpb3VzfSBiIHRoZSB2YWx1ZSB0byBjaGVja1xuICAgICAqIEByZXR1cm4ge0Jvb2xlYW59IDxjb2RlPnRydWU8L2NvZGU+IGlmIGFuZCBvbmx5IGlmIHRoZSBjaGVjayBpcyBwYXNzZWRcbiAgICAgKi9cbiAgICBVdGlscy5pc0Jvb2xlYW4gPSBmdW5jdGlvbiBpc0Jvb2xlYW4oYikge1xuICAgICAgICByZXR1cm4gdHlwZW9mIGIgPT09ICdib29sZWFuJztcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQ2hlY2tzIGlmIHRoZSBnaXZlbiB2YWx1ZSBpcyBkZWZpbmVkXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZhcmlvdXN9IHggdGhlIHZhbHVlIHRvIGNoZWNrXG4gICAgICogQHJldHVybiB7Qm9vbGVhbn0gPGNvZGU+dHJ1ZTwvY29kZT4gaWYgYW5kIG9ubHkgaWYgdGhlIGNoZWNrIGlzIHBhc3NlZFxuICAgICAqL1xuICAgIFV0aWxzLmlzRGVmaW5lZCA9IGZ1bmN0aW9uIGlzRGVmaW5lZCh4KSB7XG4gICAgICAgIHJldHVybiBVdGlscy5pc051bWJlcih4KSB8fCBVdGlscy5pc1N0cmluZyh4KSB8fCBVdGlscy5pc09iamVjdCh4KSB8fCBVdGlscy5pc0FycmF5KHgpIHx8IFV0aWxzLmlzRnVuY3Rpb24oeCkgfHwgVXRpbHMuaXNCb29sZWFuKHgpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBJdGVyYXRlcyBvZiBhbiBpdGVyYWJsZSBvYmplY3QgYW5kIGNhbGwgdGhlIGdpdmVuIG1ldGhvZCBmb3IgZWFjaCBpdGVtXG4gICAgICogRm9yIGV4YW1wbGU6XG4gICAgICogPHByZT48Y29kZT5cbiAgICAgKiAgICAgIC8vIChhKSBkZWZhdWx0IHVzZSBjYXNlIGl0ZXJhdGUgdGhyb3VnaCBhbiBhcnJheSBvciBhbiBvYmplY3RcbiAgICAgKiAgICAgIFV0aWxzLmVhY2goWzEsIDIsIC4uLiwgbl0sIGZ1bmN0aW9uIGRvU3R1ZmYodmFsKSB7IC4uLiB9KTtcbiAgICAgKlxuICAgICAqICAgICAgLy8gKGIpIG1hcCBkYXRhXG4gICAgICogICAgICBVdGlscy5lYWNoKFsxLCAyLCAzXSwgZnVuY3Rpb24gZG91YmxlKHZhbCkge1xuICAgICAqICAgICAgICAgIHJldHVybiAyICogdmFsO1xuICAgICAqICAgICAgfSk7IC8vIC0+IFsyLCA0LCA2XVxuICAgICAqICAgICAgVXRpbHMuZWFjaCh7Zm9vOiAxLCBiYXI6IDJ9LCBmdW5jdGlvbiBkb3VibGUodmFsKSB7XG4gICAgICogICAgICAgICAgcmV0dXJuIDIgKiB2YWw7XG4gICAgICogICAgICB9KTsgLy8gLT4ge2ZvbzogMiwgYmFyOiA0fVxuICAgICAqXG4gICAgICogICAgICAvLyAoYykgZmlsdGVyIGRhdGFcbiAgICAgKiAgICAgIFV0aWxzLmVhY2goWzEsIDIsIDMsIDRdLCBmdW5jdGlvbiAodmFsKSB7XG4gICAgICogICAgICAgICAgcmV0dXJuICh2YWwgJSAyID09PSAwKSA/IHZhbCA6IHVuZGVmaW5lZDtcbiAgICAgKiAgICAgIH0pOyAvLyAtPiBbMiwgNF1cbiAgICAgKiAgICAgIFV0aWxzLmVhY2goeyBmb286IDEsIGJhcjogMiwgYmF6OiAzLCB9LCBmdW5jdGlvbiB1bmV2ZW4odmFsKSB7XG4gICAgICogICAgICAgICAgcmV0dXJuICh2YWwgJSAyICE9PSAwKSA/IHZhbCA6IHVuZGVmaW5lZDtcbiAgICAgKiAgICAgIH0pOyAvLyAtPiB7IGZvbzogMSwgYmF6OiAzIH1cbiAgICAgKiA8L2NvZGU+PC9wcmU+XG4gICAgICpcbiAgICAgKiBAZGVwcmVjYXRlZFxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3QvQXJyYXl9IGl0ZXJhYmxlIFRoZSBvYmplY3QgdG8gaXRlcmF0ZSB0aHJvdWdoXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gZm4gVGhlIGNhbGxiYWNrIGZ1bmN0aW9uIHRvIGJlIGNhbGxlZCBmb3IgZWFjaCBpdGVtXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHNjb3BlIFRoZSBleGVjdXRpb24gc2NvcGUgZm9yIHRoZSBjYWxsYmFjayBmdW5jdGlvblxuICAgICAqIEBwYXJhbSB7QXJyYXl9IG1vcmUgT3B0aW9uYWw7IGFuIGFkZGlvbmFsIHNldCBvZiBhcmd1bWVudHMgd2hpY2ggd2lsbFxuICAgICAqICAgICAgYmUgcGFzc2VkIHRvIHRoZSBjYWxsYmFjayBmdW5jdGlvblxuICAgICAqIEByZXR1cm4ge09iamVjdC9BcnJheX0gVGhlIGFnZ3JlZ2F0ZWQgcmVzdWx0cyBvZiBlYWNoIGNhbGxiYWNrIChzZWUgZXhhbXBsZXMpXG4gICAgICovXG4gICAgVXRpbHMuZWFjaCA9IGVhY2g7XG5cbiAgICAvKipcbiAgICAgKiBNaXhlcyB0aGUgZ2l2ZW4gYWRkaXRpdmVzIHRvIHRoZSBzb3VyY2Ugb2JqZWN0XG4gICAgICogRXhhbXBsZSB1c2FnZTpcbiAgICAgKiA8cHJlPjxjb2RlPlxuICAgICAqIC8vIGZpcnN0IGFkZCBkZWZhdWx0cyB2YWx1ZXMgdG8gYSBuZXcgb2JqZWN0IGFuZCB0aGVuIG92ZXJyaWRlcyB0aGUgZGVmYXVsdHNcbiAgICAgKiAvLyB3aXRoIHRoZSBhY3R1YWwgdmFsdWVzXG4gICAgICogVXRpbHMubWl4KHt9LCBkZWZhdWx0cywgdmFsdWVzKTtcbiAgICAgKiA8L2NvZGU+PC9wcmU+XG4gICAgICogQGZ1bmN0aW9uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gYmFzZVxuICAgICAqICAgICAgdGhlIHNvdXJjZSBvYmplY3QgKHdpbGwgYmUgbW9kaWZpZWQhKVxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9IC4uLm92ZXJyaWRlc1xuICAgICAqICAgICAgdGhlIHNldCBvZiBhZGRpdGl2ZXNcbiAgICAgKlxuICAgICAqIEByZXR1cm4gT2JqZWN0XG4gICAgICogICAgICB0aGUgbW9kaWZpZWQgc291cmNlIG9iamVjdFxuICAgICAqL1xuICAgIFV0aWxzLm1peCA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZ1bmN0aW9uIG1peE9uZUl0ZW0odmFsdWUsIGtleSwgb2JqKSB7XG4gICAgICAgICAgICBvYmpba2V5XSA9IHZhbHVlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkuYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgICAgICAgICAgIHZhciBiYXNlID0gYXJncy5zaGlmdCgpO1xuICAgICAgICAgICAgdmFyIG5leHQ7XG5cbiAgICAgICAgICAgIHdoaWxlIChhcmdzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIG5leHQgPSBhcmdzLnNoaWZ0KCk7XG4gICAgICAgICAgICAgICAgZWFjaChuZXh0LCBtaXhPbmVJdGVtLCBudWxsLCBbYmFzZV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGJhc2U7XG4gICAgICAgIH07XG4gICAgfSgpKTtcblxuICAgIC8qKlxuICAgICAqIE1lbHRzIHR3byBvYmplY3QgZGVlcGx5IHRvZ2V0aGVyIGluIGEgbmV3IG9iamVjdFxuICAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgICpcbiAgICAgKiA8cHJlPjxjb2RlPlxuICAgICAqICAgVXRpbHMubWVsdCh7IGZvbzogMSB9LCB7IGJhcjogMSB9KTsgLy8gLT4geyBmb286IDEsIGJhcjogMSB9O1xuICAgICAqICAgVXRpbHMubWVsdCh7fSwgc29tZU9iaik7IC8vIC0+IGRlZXAgY2xvbmUgb2Ygc29tZU9ialxuICAgICAqIDwvY29kZT48L3ByZT5cbiAgICAgKlxuICAgICAqIE5PVElDRTogQXJyYXkgYW5kIG5vbmUtZGF0YS1vYmplY3RzIChvYmplY3RzIHdpdGggYSBjb25zdHJ1Y3RvciBvdGhlclxuICAgICAqIHRoYW4gT2JqZWN0KSBhcmUgdHJlYXRlZCBhcyBhdG9taWMgdmFsdWUgYW5kIGFyZSBub3QgbWVyZ2VkXG4gICAgICogQGZ1bmN0aW9uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqMSBGaXJzdCBzb3VyY2Ugb2JqZWN0XG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9iajIgVGhlIHNlY29uZCBzb3VyY2Ugb2JqZWN0XG4gICAgICogQHJldHVybiBPYmplY3QgVGhlIGRlZXBseSBtZWx0ZWQgcmVzdWx0XG4gICAgICovXG4gICAgVXRpbHMubWVsdCA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBtZWx0VmFsdWUgPSBlYWNoLnByZXBhcmUoZnVuY3Rpb24gKHZhbHVlLCBrZXksIHJlc3VsdCkge1xuICAgICAgICAgICAgaWYgKHZhbHVlICYmICh2YWx1ZS5jb25zdHJ1Y3RvciA9PT0gT2JqZWN0KSkge1xuICAgICAgICAgICAgICAgIHJlc3VsdFtrZXldID0gVXRpbHMubWVsdChyZXN1bHRba2V5XSwgdmFsdWUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXN1bHRba2V5XSA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LCBudWxsKTtcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKG9iajEsIG9iajIpIHtcbiAgICAgICAgICAgIHZhciByZXN1bHQgPSB7fTtcblxuICAgICAgICAgICAgbWVsdFZhbHVlKG9iajEsIFtyZXN1bHRdKTtcbiAgICAgICAgICAgIG1lbHRWYWx1ZShvYmoyLCBbcmVzdWx0XSk7XG5cbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH07XG4gICAgfSgpKTtcblxuICAgIC8qKlxuICAgICAqIEFsbG93cyBvdmVycmlkaW5nIG1ldGhvZHMgb2YgYW4gZ2l2ZW4gb2JqZWN0LiBJZiB0aGUgYmFzZSBvYmplY3QgaGFzXG4gICAgICogYWxyZWFkeSBhIG1ldGhvZCB3aXRoIHRoZSBzYW1lIGtleSB0aGlzIG9uZSB3aWxsIGJlIGhpZGRlbiBidXQgZG9lcyBub3RcbiAgICAgKiBnZXQgbG9zdC4gWW91IGNhbiBhY2Nlc3MgdGhlIG92ZXJyaWRkZW4gbWV0aG9kIHVzaW5nXG4gICAgICogPGNvZGU+X3N1cGVyLmNhbGwodGhpcywgLi4uKTwvY29kZT5cbiAgICAgKlxuICAgICAqIEZvciBleGFtcGxlOiA8cHJlPjxjb2RlPlxuICAgICAqIHZhciBvYmogPSB7XG4gICAgICogICAgICBmb286IGZ1bmN0aW9uICgpIHtcbiAgICAgKiAgICAgICAgICByZXR1cm4gJ2Zvbyc7XG4gICAgICogICAgICB9XG4gICAgICogfTtcbiAgICAgKlxuICAgICAqIFV0aWxzLm92ZXJyaWRlKG9iaiwge1xuICAgICAqICAgICAgZm9vOiBVdGlscy5vdmVycmlkZShmdW5jdGlvbiAoX3N1cGVyKSB7XG4gICAgICogICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgKiAgICAgICAgICAgICAgcmV0dXJuIF9zdXBlci5jYWxsKHRoaXMpICsgJyAtIGJhcic7XG4gICAgICogICAgICAgICAgfTtcbiAgICAgKiAgICAgIH0pXG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiBvYmouZm9vKCk7IC8vIHdpbGwgcmV0dXJuICdmb28gLSBiYXInXG4gICAgICogPC9jb2RlPjwvcHJlPlxuICAgICAqIEBmdW5jdGlvblxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGJhc2VcbiAgICAgKiAgICAgIFRoZSBiYXNlIG9iamVjdCB0byBiZSBvdmVycmlkZGVuICh3aWxsIGJlIG1vZGlmaWVkISlcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvdmVycmlkZXNcbiAgICAgKiAgICAgIFRoZSBzZXQgb2YgbmV3IG1ldGhvZHNcbiAgICAgKlxuICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgKiAgICAgIFRoZSBtb2RpZmllZCBvYmplY3RcbiAgICAgKi9cbiAgICBVdGlscy5vdmVycmlkZSA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vIGhlbHBlciB0byBkZWNpZGUgd2hldGhlciBpdCBpcyBhIG1hZ2ljIG1ldGEgZnVuY3Rpb24gdGhhdCBjcmVhdGVzIHRoZSBhY3R1YWwgb2JqZWN0IG1ldGhvZFxuICAgICAgICBmdW5jdGlvbiBpc01hZ2ljTWV0aG9kKGZuKSB7XG4gICAgICAgICAgICByZXR1cm4gZm4gJiYgKGZuLmhvY3VzcG9jdXMgPT09IHRydWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaGVscGVyIHRvIGlkZW50aWZ5IHByb3BlcnR5IGRlc2NyaXB0b3JzXG4gICAgICAgIGZ1bmN0aW9uIGlzUHJvcGVydHlEZWYob2JqKSB7XG4gICAgICAgICAgICByZXR1cm4gVXRpbHMuaXNPYmplY3Qob2JqKSAmJiBVdGlscy5tZXRhKG9iaiwgJ2lzUHJvcGVydHknKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGhlbHBlciBtZXRob2QgdG8gYWRkIGEgc2luZ2xlIHByb3BlcnR5XG4gICAgICAgIGZ1bmN0aW9uIGFkZFByb3BlcnR5KHByb3AsIGtleSwgb2JqKSB7XG4gICAgICAgICAgICBpZiAoVXRpbHMuaXNGdW5jdGlvbihwcm9wKSkge1xuICAgICAgICAgICAgICAgIGlmIChpc01hZ2ljTWV0aG9kKHByb3ApKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHlvdSBzYWlkIHRoZSBtYWdpYyB3b3JkcyBzbyB5b3Ugd2lsbCBnZXQgeW91ciByZWZlcmVuY2UgdG8gdGhlIG92ZXJyaWRkZW4gbWV0aG9kXG4gICAgICAgICAgICAgICAgICAgIHByb3AgPSBwcm9wKG9ialtrZXldKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoaXNQcm9wZXJ0eURlZihwcm9wKSkge1xuICAgICAgICAgICAgICAgIFV0aWxzLmRlZmluZVByb3BlcnR5KG9iaiwga2V5LCBwcm9wKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgb2JqW2tleV0gPSBwcm9wO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChiYXNlLCBvdmVycmlkZXMpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgYmFzZSA9PT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2Ygb3ZlcnJpZGVzID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIGJhc2UuaG9jdXNwb2N1cyA9IHRydWU7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGJhc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvdmVycmlkZXMgJiYgb3ZlcnJpZGVzLmNvbnN0cnVjdG9yICE9PSBPYmplY3QucHJvdG90eXBlLmNvbnN0cnVjdG9yKSB7XG4gICAgICAgICAgICAgICAgYWRkUHJvcGVydHkob3ZlcnJpZGVzLmNvbnN0cnVjdG9yLCAnY29uc3RydWN0b3InLCBiYXNlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZWFjaChvdmVycmlkZXMsIGFkZFByb3BlcnR5LCBudWxsLCBbYmFzZV0pO1xuXG4gICAgICAgICAgICByZXR1cm4gYmFzZTtcbiAgICAgICAgfTtcbiAgICB9KCkpO1xuXG4gICAgLyoqXG4gICAgICogQGZ1bmN0aW9uXG4gICAgICovXG4gICAgVXRpbHMuZXh0ZW5kID0gZnVuY3Rpb24gZXh0ZW5kKGJhc2UsIG92ZXJyaWRlcykge1xuICAgICAgICB2YXIgZXh0ZW5kZWQgPSBPYmplY3QuY3JlYXRlKGJhc2UpO1xuXG4gICAgICAgIGlmIChVdGlscy5pc0Z1bmN0aW9uKG92ZXJyaWRlcykpIHtcbiAgICAgICAgICAgIG92ZXJyaWRlcyA9IG92ZXJyaWRlcyhiYXNlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvdmVycmlkZXMpIHtcbiAgICAgICAgICAgIFV0aWxzLm92ZXJyaWRlKGV4dGVuZGVkLCBvdmVycmlkZXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGV4dGVuZGVkO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBFeHRyYWN0IHZhbHVlcyBvZiBhIHNwZWNpZmljIHByb3BlcnR5IGZyb20gYSBnaXZlbiBzZXQgb2YgaXRlbXNcbiAgICAgKiBGb3IgZXhhbXBsZTpcbiAgICAgKiA8cHJlPjxjb2RlPlxuICAgICAqIFV0aWxzLmV4dHJhY3QoW3trZXk6ICdmb28nfSwge2tleTogJ2Jhcid9LCAuLi4gXSwgJ2tleScpOyAvLyAtPiBbJ2ZvbycsICdiYXInLCAuLi5dXG4gICAgICogVXRpbHMuZXh0cmFjdCh7bzE6IHtrZXk6ICdmb28nfSwgbzI6IHtrZXk6ICdiYXInfSwgLi4ufSwgJ2tleScpOyAvLyAtPiBbJ2ZvbycsICdiYXInLCAuLi5dXG4gICAgICogPC9jb2RlPjwvcHJlPlxuICAgICAqIEBmdW5jdGlvblxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheS9PYmplY3R9IGxpc3RcbiAgICAgKiAgICAgIFRoZSBpbml0aWFsIHNldCBvZiBpdGVtc1xuICAgICAqXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHByb3BlcnR5XG4gICAgICogICAgICBUaGUgbmFtZSBvZiB0aGUgcHJvcGVydHkgdG8gZXh0cmFjdFxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheX1cbiAgICAgKiAgICAgIFRoZSBhcnJheSBvZiBleHRyYWN0ZWQgdmFsdWVzXG4gICAgICovXG4gICAgVXRpbHMuZXh0cmFjdCA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZ1bmN0aW9uIGV4dHJhY3RPbmUoaXRlbSwgaW5kZXgsIGtleSwgcmVzdWx0KSB7XG4gICAgICAgICAgICBpZiAoVXRpbHMuaXNPYmplY3QoaXRlbSkpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQucHVzaChpdGVtW2tleV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAobGlzdCwgcHJvcGVydHkpIHtcbiAgICAgICAgICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICAgICAgICAgIGVhY2gobGlzdCwgZXh0cmFjdE9uZSwgbnVsbCwgW3Byb3BlcnR5LCByZXN1bHRdKTtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH07XG4gICAgfSgpKTtcblxuICAgIC8qKlxuICAgICAqIEZpbHRlcyBhIHNldCAoYXJyYXkgb3IgaGFzaCBvYmplY3QpIHRvIGNvbnRhaW4gb25seSB1bmlxdWUgdmFsdWVzXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdH0gbGlzdCBUaGUgbGlzdCB0byBiZSBmaWx0ZXJlZFxuICAgICAqIEByZXR1cm4ge0FycmF5fE9iamVjdH0gVGhlIGZpbHRlcmVkIGxpc3RcbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogVXRpbHMudW5pcXVlKFsxLCAzLCA0LCAxLCAzLCA1XSk7IC8vIC0+IFsxLCAzLCA0LCA1XVxuICAgICAqIFV0aWxzLnVuaXF1ZSh7Zm9vOiAnZm9vJywgYmFyOiAnZm9vJywgYmF6OiAnYmF6Jyk7IC8vIC0+IHtmb286ICdmb28nLCBiYXo6ICdiYXonfVxuICAgICAqL1xuICAgIFV0aWxzLnVuaXF1ZSA9IGZ1bmN0aW9uIHVuaXF1ZShsaXN0KSB7XG4gICAgICAgIHZhciB1c2VkID0ge307XG4gICAgICAgIHJldHVybiBlYWNoKGxpc3QsIGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgICAgICBpZiAodXNlZFtpdGVtXSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdXNlZFtpdGVtXSA9IHRydWU7XG4gICAgICAgICAgICByZXR1cm4gaXRlbTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBzZXQgb2YgdW5pcXVlIHZhbHVlcyBmcm9tIHRoZSBnaXZlbiBpbnB1dFxuICAgICAqIEBmdW5jdGlvblxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheXxPYmplY3R9IC4uLmFyZ3MgVGhlIGluaXRpYWwgZGF0YSBzZXRzXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtBcnJheX0gQW4gYXJyYXkgY29udGFpbmluZyB0aGUgdW5pcXVlIHZhbHVlc1xuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBVdGlscy51bmlvbihbMSwgMiwgNCwgMTBdLCBbMywgNF0sIFsxLCAyLCA1LCAxMDFdKTsgLy8gLT4gWzEsIDIsIDQsIDEwLCAzLCA1LCAxMDFdXG4gICAgICogVXRpbHMudW5pb24oe2ZvbzogJ2Zvbyd9LCB7YmFyOiAnYmFyJ30sIHtiYXI6ICdiYXonfSk7IC8vIC0+IFsnZm9vJywgJ2JhcicsICdiYXonXVxuICAgICAqIFV0aWxzLnVuaW9uKHtmb286ICdmb28nfSwgWydmb28nLCAnYmFyJ10sIHtiYXI6ICdiYXonfSkgLy8gLT4gWydmb28nLCAnYmFyJywgJ2JheiddXG4gICAgICovXG4gICAgVXRpbHMudW5pb24gPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICBmdW5jdGlvbiBwcm9jZXNzT25lQXJndW1lbnQoYXJyYXksIGluZGV4LCByZXN1bHQsIHNlZW4pIHtcbiAgICAgICAgICAgIGVhY2goYXJyYXksIHByb2Nlc3NPbmVWYWx1ZSwgbnVsbCwgW3Jlc3VsdCwgc2Vlbl0pO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gcHJvY2Vzc09uZVZhbHVlKHZhbHVlLCBpbmRleCwgcmVzdWx0LCBzZWVuKSB7XG4gICAgICAgICAgICBpZiAoIXNlZW5bdmFsdWVdKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnB1c2godmFsdWUpO1xuICAgICAgICAgICAgICAgIHNlZW5bdmFsdWVdID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgcmVzdWx0ID0gW107XG4gICAgICAgICAgICB2YXIgc2VlbiA9IHt9O1xuICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5hcHBseShudWxsLCBhcmd1bWVudHMpO1xuXG4gICAgICAgICAgICBlYWNoKGFyZ3MsIHByb2Nlc3NPbmVBcmd1bWVudCwgbnVsbCwgW3Jlc3VsdCwgc2Vlbl0pO1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfTtcbiAgICB9KCkpO1xuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgdmFsdWVzIG9mIGEgaGFzaCBvYmplY3QgYXMgYW4gYXJyYXlcbiAgICAgKiBAZnVuY3Rpb25cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBoYXNoIFRoZSBrZXktdmFsdWUtaGFzaC1tYXBcbiAgICAgKiBAcmV0dXJuIHtBcnJheX0gQW4gYXJyYXkgY29udGFpbmluZyB0aGUgdmFsdWVzXG4gICAgICovXG4gICAgVXRpbHMudmFsdWVzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZnVuY3Rpb24gYWRkVmFsdWVUb1Jlc3VsdFNldCh2YWx1ZSwga2V5LCByZXN1bHRTZXQpIHtcbiAgICAgICAgICAgIHJlc3VsdFNldC5wdXNoKHZhbHVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiB2YWx1ZXMoaGFzaCkge1xuICAgICAgICAgICAgaWYgKCFoYXNoIHx8IHR5cGVvZiBoYXNoICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHJlc3VsdCA9IFtdO1xuICAgICAgICAgICAgZWFjaChoYXNoLCBhZGRWYWx1ZVRvUmVzdWx0U2V0LCBudWxsLCBbcmVzdWx0XSk7XG5cbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH07XG4gICAgfSgpKTtcblxuICAgIC8qKlxuICAgICAqIFJlYWRzIGFuZCB3cml0ZXMgdGhlIHZhbHVlIG9mIGEgbWV0YSBhdHRyaWJ1dGUgZnJvbS90b1xuICAgICAqIGEgZ2l2ZW4gb2JqZWN0XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqIFRoZSBvYmplY3Qgd2l0aCB0aGUgbWV0YSBwcm9wZXJ0eVxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBrZXkgVGhlIGlkZW50aWZpZXIgb2YgdGhlIGF0dHJpYnV0ZVxuICAgICAqIEBwYXJhbSB7TWl4ZWR9IFt2YWx1ZV0gKE9wdGlvbmFsKSBUaGUgbmV3IHZhbHVlO1xuICAgICAqICAgICAgSWYgb21taXR0ZWQgdGhlIHZhbHVlIHdpbGwgbm90IGJlIGNoYW5nZWRcbiAgICAgKiBAcmV0dXJuIHtNaXhlZH0gVGhlIGN1cnJlbnQgdmFsdWUgb2YgdGhlIG1ldGEgYXR0cmlidXRlc1xuICAgICAqL1xuICAgIFV0aWxzLm1ldGEgPSBmdW5jdGlvbiAob2JqLCBrZXksIHZhbHVlKSB7XG4gICAgICAgIGtleSA9IFV0aWxzLm1ldGFQcmVmaXggKyBrZXk7XG4gICAgICAgIGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBvYmpba2V5XSA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvYmpba2V5XTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogVGhpcyBtZXRob2Qgd29ya3MgaW4gdHdvIGRpZmZlcmVudCBtb2RlOjx1bD5cbiAgICAgKlxuICAgICAqIDxsaT5Nb2RlIChBKSB3aWxsIHdvcmsgc2ltaWxhciB0byBPYmplY3QuZGVmaW5lUHJvcGVydHkgKHNlZVxuICAgICAqIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL09iamVjdC9kZWZpbmVQcm9wZXJ0eSlcbiAgICAgKiBidXQgd2l0aCBhIGZldyBkZWZhdWx0cyBzd2l0Y2hlZC4gTmV3IHByb3BlcnRpZXMgYXJlIGJ5IGRlZmF1bHQgd3JpdGFibGUsXG4gICAgICogZW51bWVyYWJsZSBhbmQgY29uZmlndXJhYmxlIHdoaWNoaCBpcyBJTU8gbW9yZSBuYXR1cmFsLlxuICAgICAqXG4gICAgICogPGxpPk1vZGUgKEIpIGxldCB5b3UgbWFyayBhIGdpdmVuIG9iamVjdCBhcyBhIHByb3BlcnR5IGRlZmluaXRpb24gd2hpY2hcbiAgICAgKiB3aWxsIGJlIGV2YWx1YXRlZCB3aGVuIGJyZXdpbmcgYSBwcm90b3R5cGUgb3IgYWRkaW5nIHRoZSBwcm9wZXJ0eSB0b1xuICAgICAqIG9uZSB3aXRoIHtAbGluayBVdGlscy5vdmVycmlkZX08L2xpPlxuICAgICAqXG4gICAgICogPC91bD5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmogVGhlIG9iamVjdCB3aGljaCBzaG91bGQgZ2V0IHRoZSBwcm9wZXJ0eSAobW9kZSBBKVxuICAgICAqICAgICAgb3IgdGhlIHByb3BlcnR5IGRlZmluaXRpb24gKG1vZGUgQilcbiAgICAgKiAgICAgIChOT1RJQ0UgdGhhdCBlaXRoZXIgd2F5IHRoZSBnaXZlbiBvYmplY3Qgd2lsbCBiZSBtb2RpZmllZClcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gW3Byb3BdIFRoZSBuYW1lIG9mIHRoZSBwcm9wZXJ0eSAobW9kZSBBKTsgZW1wdHkgKG1vZGUgQilcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW29wdHNdIFRoZSBwcm9wZXJ0eSBkZWZpbml0aW9uIChtb2RlIEEpOyBlbXB0eSAobW9kZSBCKVxuICAgICAqXG4gICAgICogQHJldHVybiBvYmogVGhlIG1vZGlmaWVkIG9iamVjdFxuICAgICAqL1xuICAgIFV0aWxzLmRlZmluZVByb3BlcnR5ID0gZnVuY3Rpb24gKG9iaiwgcHJvcCwgb3B0cykge1xuICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgLy8gTW9kZSBCOiBtYXJrIGl0IGFzIGEgcHJvcGVydGllcyBzbyBVdGlscy5vdmVycmlkZSB3aWxsXG4gICAgICAgICAgICAvLyBrbm93IHdoYXQgdG8gZG9cbiAgICAgICAgICAgIFV0aWxzLm1ldGEob2JqLCAnaXNQcm9wZXJ0eScsIHRydWUpO1xuICAgICAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIE1vZGUgQTogZGVmaW5lIHRoZSBuZXcgcHJvcGVydHkgXCJwcm9wXCIgZm9yIG9iamVjdCBcIm9ialwiXG5cbiAgICAgICAgLy8gc3dpdGNoIHRoZSBkZWZhdWx0cyB0byBiZSB0cnV0aHkgdW5sZXNzIHNhaWQgb3RoZXJ3aXNlXG4gICAgICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgICAgICBvcHRzLndyaXRhYmxlID0gKG9wdHMud3JpdGFibGUgIT09IGZhbHNlKTtcbiAgICAgICAgb3B0cy5lbnVtZXJhYmxlID0gKG9wdHMuZW51bWVyYWJsZSAhPT0gZmFsc2UpO1xuICAgICAgICBvcHRzLmNvbmZpZ3VyYWJsZSA9IChvcHRzLmNvbmZpZ3VyYWJsZSAhPT0gZmFsc2UpO1xuXG4gICAgICAgIGlmIChvcHRzLmdldCkge1xuICAgICAgICAgICAgZGVsZXRlIG9wdHMud3JpdGFibGU7IC8vIHdyaXRhYmxlL3ZhbHVlIGlzIG5vdCBhbGxvd2VkIHdoZW4gZGVmaW5pbmcgZ2V0dGVyL3NldHRlclxuICAgICAgICAgICAgZGVsZXRlIG9wdHMudmFsdWU7XG5cbiAgICAgICAgICAgIGlmIChVdGlscy5pc0Jvb2xlYW4ob3B0cy5nZXQpKSB7XG4gICAgICAgICAgICAgICAgLy8gXCJnZXRcIiB3YXMgc2ltcGx5IHNldCB0byB0cnVlIC0+IGdldCB0aGUgbmFtZSBmcm9tIHRoZSBwcm9wZXJ0eSAoXCJmb29cIiAtPiBcImdldEZvb1wiKVxuICAgICAgICAgICAgICAgIG9wdHMuZ2V0ID0gJ2dldCcgKyB1Y0ZpcnN0KHByb3ApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKFV0aWxzLmlzU3RyaW5nKG9wdHMuZ2V0KSkge1xuICAgICAgICAgICAgICAgIC8vIFwiZ2V0XCIgd2FzIHNldCB0byB0aGUgZ2V0dGVyJ3MgbmFtZVxuICAgICAgICAgICAgICAgIC8vIC0+IGNyZWF0ZSBhIGZ1bmN0aW9uIHRoYXQgY2FsbHMgdGhlIGdldHRlciAodGhpcyB3YXkgd2UgY2FuXG4gICAgICAgICAgICAgICAgLy8gbGF0ZXIgb3ZlcnJpZGUgdGhlIG1ldGhvZClcbiAgICAgICAgICAgICAgICB2YXIgZ2V0dGVyTmFtZSA9IG9wdHMuZ2V0O1xuICAgICAgICAgICAgICAgIG9wdHMuZ2V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpc1tnZXR0ZXJOYW1lXSgpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0cy5zZXQpIHtcbiAgICAgICAgICAgIGRlbGV0ZSBvcHRzLndyaXRhYmxlOyAvLyB3cml0YWJsZS92YWx1ZSBpcyBub3QgYWxsb3dlZCB3aGVuIGRlZmluaW5nIGdldHRlci9zZXR0ZXJcbiAgICAgICAgICAgIGRlbGV0ZSBvcHRzLnZhbHVlO1xuXG4gICAgICAgICAgICBpZiAoVXRpbHMuaXNCb29sZWFuKG9wdHMuc2V0KSkge1xuICAgICAgICAgICAgICAgIC8vIFwic2V0XCIgd2FzIHNpbXBseSBzZXQgdG8gdHJ1ZSAtPiBnZXQgdGhlIG5hbWUgZnJvbSB0aGUgcHJvcGVydHkgKFwiZm9vXCIgLT4gXCJzZXRGb29cIilcbiAgICAgICAgICAgICAgICBvcHRzLnNldCA9ICdzZXQnICsgdWNGaXJzdChwcm9wKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChVdGlscy5pc1N0cmluZyhvcHRzLnNldCkpIHtcbiAgICAgICAgICAgICAgICB2YXIgc2V0dGVyTmFtZSA9IG9wdHMuc2V0O1xuICAgICAgICAgICAgICAgIG9wdHMuc2V0ID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzW3NldHRlck5hbWVdKHZhbHVlKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIHByb3AsIG9wdHMpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBjcmVhdGVzIGEgdW5pcXVlIGlkZW50aWZpZXJcbiAgICAgKiBAZnVuY3Rpb25cbiAgICAgKlxuICAgICAqIEByZXR1cm4ge1N0cmluZ31cbiAgICAgKiAgICAgIHRoZSBnZW5lcmF0ZWQgaWRlbnRpZmllclxuICAgICAqXG4gICAgICovXG4gICAgVXRpbHMuaWQgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgY291bnRlciA9IDA7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gJ0FKUy0nICsgKGNvdW50ZXIrKyk7XG4gICAgICAgIH07XG4gICAgfSgpKTtcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBVVUlEXG4gICAgICogKHNvdXJjZSBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS84ODA5NDcyKVxuICAgICAqIEBmdW5jdGlvblxuICAgICAqXG4gICAgICogQHJldHVybiB7U3RyaW5nfSB0aGUgVVVJRFxuICAgICAqL1xuICAgIFV0aWxzLnV1aWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBkID0gVXRpbHMubm93KCk7XG4gICAgICAgIHZhciB1dWlkID0gJ3h4eHh4eHh4LXh4eHgtNHh4eC15eHh4LXh4eHh4eHh4eHh4eCcucmVwbGFjZSgvW3h5XS9nLCBmdW5jdGlvbiAoYykge1xuICAgICAgICAgICAgLyoganNoaW50IGJpdHdpc2U6IGZhbHNlICovXG4gICAgICAgICAgICB2YXIgciA9IChkICsgTWF0aC5yYW5kb20oKSAqIDE2KSAlIDE2IHwgMDtcbiAgICAgICAgICAgIGQgPSBNYXRoLmZsb29yKGQgLyAxNik7XG4gICAgICAgICAgICByZXR1cm4gKGMgPT09ICd4JyA/IHIgOiAociAmIDB4MyB8IDB4OCkpLnRvU3RyaW5nKDE2KTtcbiAgICAgICAgICAgIC8qIGpzaGludCBiaXR3aXNlOiB0cnVlICovXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdXVpZDtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogYW4gcmV1c2VhYmxlIGVtcHR5IGZ1bmN0aW9uIG9iamVjdFxuICAgICAqL1xuICAgIFV0aWxzLmVtcHR5Rm4gPSBmdW5jdGlvbiAoKSB7fTtcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIG51bWJlciBvZiBtaWxsaXNlY29uZHMsIGFjY3VyYXRlIHRvIGEgdGhvdXNhbmR0aCBvZiBhXG4gICAgICogbWlsbGlzZWNvbmQsIGZyb20gdGhlIHN0YXJ0IG9mIGRvY3VtZW50IG5hdmlnYXRpb24gdG8gdGhlIHRpbWUgdGhlXG4gICAgICogbm93IG1ldGhvZCB3YXMgY2FsbGVkLlxuICAgICAqIFNoaW0gZm9yIHdpbmRvdy5wZXJmb3JtYW5jZS5ub3coKTsgc2VlIGh0dHA6Ly93d3cudzMub3JnL1RSL2FuaW1hdGlvbi10aW1pbmcvXG4gICAgICogQGZ1bmN0aW9uXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtOdW1iZXJ9IFRoZSB0aW1lIGluIG1zIHJlbGF0aXZlIHRvIHRoZSBzdGFydCBvZiB0aGVcbiAgICAgKiAgICAgIGRvY3VtZW50IG5hdmlnYXRpb25cbiAgICAgKi9cbiAgICBVdGlscy5ub3cgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoaXNCcm93c2VyICYmIHdpbmRvdy5wZXJmb3JtYW5jZSAmJiB3aW5kb3cucGVyZm9ybWFuY2Uubm93KSB7XG4gICAgICAgICAgICAvLyB1c2Ugd2luZG93LnBlcmZvbWFuY2Uubm93ICh3aGljaCBpcyB0aGUgcmVmZXJlbmNlKSBpZiBwb3NzaWJsZVxuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gd2luZG93LnBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLy8gZmFsbGJhY2sgdG8gRGF0ZS5ub3coKVxuICAgICAgICB2YXIgbG9hZFRpbWUgPSBEYXRlLm5vdygpO1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIERhdGUubm93KCkgLSBsb2FkVGltZTtcbiAgICAgICAgfTtcbiAgICB9KCkpO1xufSkoKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgaCA9IHJlcXVpcmUoJ3ZpcnR1YWwtZG9tL2gnKTtcbiAgICB2YXIgZGlmZiA9IHJlcXVpcmUoJ3ZpcnR1YWwtZG9tL2RpZmYnKTtcbiAgICB2YXIgcGF0Y2ggPSByZXF1aXJlKCd2aXJ0dWFsLWRvbS9wYXRjaCcpO1xuXG4gICAgdmFyIGNvcXVvVmVuZW51bSA9IHJlcXVpcmUoJ2NvcXVvLXZlbmVudW0nKTtcbiAgICB2YXIgZWFjaCA9IHJlcXVpcmUoJ3Byby1zaW5ndWxpcycpO1xuXG4gICAgdmFyIHV0aWxzID0gcmVxdWlyZSgnLi9VdGlscycpO1xuXG4gICAgLyoqXG4gICAgICogQGNsYXNzXG4gICAgICogQG5hbWUgUmVuZGVyQ29udGV4dFxuICAgICAqL1xuICAgIGZ1bmN0aW9uIFJlbmRlckNvbnRleHQoaWQsIHN0YXRlLCBwcm9wcywgY2hpbGRyZW4pIHtcbiAgICAgICAgdGhpcy5fZW50aXR5UGxhY2Vob2xkZXIgPSBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcHJvcGVydHlcbiAgICAgICAgICogQG5hbWUgZW50aXR5SWRcbiAgICAgICAgICogQHR5cGUgU3RyaW5nXG4gICAgICAgICAqIEBtZW1iZXJPZiBSZW5kZXJDb250ZXh0XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmVudGl0eUlkID0gaWQ7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBwcm9wZXJ0eVxuICAgICAgICAgKiBAbmFtZSBzdGF0ZVxuICAgICAgICAgKiBAdHlwZSBJbW11dGFibGVcbiAgICAgICAgICogQG1lbWJlck9mIFJlbmRlckNvbnRleHRcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuc3RhdGUgPSBzdGF0ZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHByb3BlcnR5XG4gICAgICAgICAqIEBuYW1lIHByb3BzXG4gICAgICAgICAqIEB0eXBlIE9iamVjdFxuICAgICAgICAgKiBAbWVtYmVyT2YgUmVuZGVyQ29udGV4dFxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5wcm9wcyA9IHByb3BzO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcHJvcGVydHlcbiAgICAgICAgICogQG5hbWUgY2hpbGRyZW5cbiAgICAgICAgICogQHR5cGUgQXJyYXkvT2JqZWN0XG4gICAgICAgICAqIEBtZW1iZXJPZiBSZW5kZXJDb250ZXh0XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmNoaWxkcmVuID0gY2hpbGRyZW47XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGh5cGVyc2NyaXB0IGZ1bmN0aW9uIHRvIGNyZWF0ZSB2aXJ0dWFsIGRvbSBub2Rlc1xuICAgICAqIEBmdW5jdGlvblxuICAgICAqL1xuICAgIFJlbmRlckNvbnRleHQucHJvdG90eXBlLmggPSBoO1xuXG4gICAgLyoqXG4gICAgICogUmVuZGVycyBhIGNoaWxkIGVudGl0eSBhdCB0aGUgY3VycmVudCBsb2NhdGlvbiAoaXQgYWN0dWFsbHkgY3JlYXRlcyBhXG4gICAgICogcGxhY2Vob2xkZXIgZm9yIHRoYXQgdmVyeSBlbnRpdHkpXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gZW50aXR5SWQgVGhlIGlkIG9mIHRoZSBjaGlsZCBlbnRpdHkgdG8gYmUgcmVuZGVyZWRcbiAgICAgKiBAcmV0dXJuIFZEb20gYSB2aXJ0dWFsIGRvbSBub2RlIHJlcHJlc2VudGluZyB0aGUgY2hpbGQgZW50aXR5XG4gICAgICovXG4gICAgUmVuZGVyQ29udGV4dC5wcm90b3R5cGUucGxhY2Vob2xkZXIgPSBmdW5jdGlvbiBwbGFjZWhvbGRlcihlbnRpdHlJZCkge1xuICAgICAgICB0aGlzLl9lbnRpdHlQbGFjZWhvbGRlciA9IHRoaXMuX2VudGl0eVBsYWNlaG9sZGVyIHx8IFtdO1xuICAgICAgICB0aGlzLl9lbnRpdHlQbGFjZWhvbGRlci5wdXNoKGVudGl0eUlkKTtcblxuICAgICAgICByZXR1cm4gaCgnZGl2Jywge2lkOiBlbnRpdHlJZCwga2V5OiBlbnRpdHlJZH0pO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIFJlbmRlcnMgYSBwbGFjZWhvbGRlciBmb3IgYSBjaGlsZCBlbnRpdHkgZGVmaW5lZCBieSB0aGUgZ2l2ZW4ga2V5XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30ga2V5IFRoZSBrZXkgb2YgdGhlIGNoaWxkIGVudGl0eSB0byBiZSByZW5kZXJlZFxuICAgICAqIEByZXR1cm4gVkRvbSBhIHZpcnR1YWwgZG9tIG5vZGUgcmVwcmVzZW50aW5nIHRoZSBjaGlsZCBlbnRpdHlcbiAgICAgKi9cbiAgICBSZW5kZXJDb250ZXh0LnByb3RvdHlwZS5yZW5kZXJDaGlsZCA9IGZ1bmN0aW9uIHJlbmRlckNoaWxkKGtleSkge1xuICAgICAgICByZXR1cm4gdGhpcy5wbGFjZWhvbGRlcih0aGlzLmNoaWxkcmVuW2tleV0pO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBSZW5kZXJlcyBhbGwgYXZhaWxhYmxlIGNoaWxkIGVudGl0ZXNcbiAgICAgKlxuICAgICAqIEByZXR1cm4gYXJyYXkgQW4gYXJyYXkgb2YgdmlydHVhbCBkb20gbm9kZXNcbiAgICAgKi9cbiAgICBSZW5kZXJDb250ZXh0LnByb3RvdHlwZS5yZW5kZXJBbGxDaGlsZHJlbiA9IGZ1bmN0aW9uIHJlbmRlckFsbENoaWxkcmVuKCkge1xuICAgICAgICByZXR1cm4gZWFjaCh1dGlscy52YWx1ZXModGhpcy5jaGlsZHJlbiksIHRoaXMucGxhY2Vob2xkZXIsIHRoaXMpIHx8IFtdO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcHBsaWNhdGlvbiBtb2R1bGUgdG8gcmVuZGVyIGFsbCB2aWV3IGNvbXBvbmVudHNcbiAgICAgKiB0byB0aGUgc2NyZWVuXG4gICAgICpcbiAgICAgKiBAY2xhc3NcbiAgICAgKiBAbmFtZSBhbGNoZW15LmVjcy5WRG9tUmVuZGVyU3lzdGVtXG4gICAgICovXG4gICAgcmV0dXJuIGNvcXVvVmVuZW51bSh7XG4gICAgICAgIC8qKiBAbGVuZHMgYWxjaGVteS5lY3MuVkRvbVJlbmRlclN5c3RlbS5wcm90b3R5cGUgKi9cblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGVudGl0eSBzdG9yYWdlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwcm9wZXJ0eSBlbnRpdGllc1xuICAgICAgICAgKiBAdHlwZSBhbGNoZW15LmVjcy5BcG90aGVjYXJpdXNcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIGVudGl0aWVzOiB1bmRlZmluZWQsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFVwZGF0ZXMgdGhlIGNvbXBvbmVudCBzeXN0ZW0gKHVwZGF0ZXMgZG9tIGRlcGVuZGluZyBvbiB0aGUgY3VycmVudFxuICAgICAgICAgKiBzdGF0ZSBvZiB0aGUgZW50aXRpZXMpXG4gICAgICAgICAqL1xuICAgICAgICB1cGRhdGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciByZW5kZXJDb25maWdzID0gdGhpcy5lbnRpdGllcy5nZXRBbGxDb21wb25lbnRzT2ZUeXBlKCd2ZG9tJyk7XG4gICAgICAgICAgICB2YXIgdXBkYXRlcyA9IGVhY2gocmVuZGVyQ29uZmlncywgdGhpcy51cGRhdGVFbnRpdHksIHRoaXMpO1xuXG4gICAgICAgICAgICBlYWNoKHVwZGF0ZXMsIHRoaXMuZHJhdywgdGhpcyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHVwZGF0ZUVudGl0eTogZnVuY3Rpb24gKGNmZywgZW50aXR5SWQsIHBsYWNlaG9sZGVyKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMucmVxdWlyZXNSZW5kZXIoY2ZnLCBlbnRpdHlJZCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciByZW5kZXJlciA9IHRoaXMuZmluZFJlbmRlcmVyKGNmZywgZW50aXR5SWQpO1xuICAgICAgICAgICAgdmFyIHN0YXRlID0gdGhpcy5lbnRpdGllcy5nZXRDb21wb25lbnQoZW50aXR5SWQsICdzdGF0ZScpO1xuICAgICAgICAgICAgdmFyIGNoaWxkcmVuID0gdGhpcy5lbnRpdGllcy5nZXRDb21wb25lbnREYXRhKGVudGl0eUlkLCAnY2hpbGRyZW4nKTtcbiAgICAgICAgICAgIHZhciBjb250ZXh0ID0gbmV3IFJlbmRlckNvbnRleHQoZW50aXR5SWQsIHN0YXRlLCBjZmcucHJvcHMsIGNoaWxkcmVuLCB7fSk7XG5cbiAgICAgICAgICAgIGNmZyA9IHRoaXMuZW50aXRpZXMuc2V0Q29tcG9uZW50KGVudGl0eUlkLCAndmRvbScsIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50VHJlZTogcmVuZGVyZXIoY29udGV4dCksXG4gICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI6IGNvbnRleHQuX2VudGl0eVBsYWNlaG9sZGVyLFxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRoaXMubGFzdFN0YXRlc1tlbnRpdHlJZF0gPSBzdGF0ZTtcblxuICAgICAgICAgICAgcmV0dXJuIGNmZztcbiAgICAgICAgfSxcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgcmVxdWlyZXNSZW5kZXI6IGZ1bmN0aW9uIChyZW5kZXJDZmcsIGVudGl0eUlkKSB7XG4gICAgICAgICAgICBpZiAoIXJlbmRlckNmZy5jdXJyZW50VHJlZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgY3VycmVudFN0YXRlID0gdGhpcy5lbnRpdGllcy5nZXRDb21wb25lbnQoZW50aXR5SWQsICdzdGF0ZScpO1xuICAgICAgICAgICAgdmFyIGxhc3RTdGF0ZSA9IHRoaXMubGFzdFN0YXRlc1tlbnRpdHlJZF07XG4gICAgICAgICAgICBpZiAoY3VycmVudFN0YXRlICE9PSBsYXN0U3RhdGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGN1cnJlbnREZWxFdiA9IHRoaXMuZW50aXRpZXMuZ2V0Q29tcG9uZW50KGVudGl0eUlkLCAnZGVsZWdhdGVkRXZlbnRzJyk7XG4gICAgICAgICAgICB2YXIgbGFzdERlbEV2ID0gdGhpcy5sYXN0RGVsZWdhdGVzW2VudGl0eUlkXTtcbiAgICAgICAgICAgIGlmIChjdXJyZW50RGVsRXYgIT09IGxhc3REZWxFdikge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIGZpbmRSZW5kZXJlcjogZnVuY3Rpb24gKGNmZywgZW50aXR5SWQpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgY2ZnLnJlbmRlcmVyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNmZy5yZW5kZXJlcjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhyb3cgJ0Nhbm5vdCBkZXRlcm1pbmUgcmVuZGVyZXIgZm9yIGVudGl0eSBcIicgKyBlbnRpdHlJZCArICdcIiEnO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICBkcmF3OiBmdW5jdGlvbiAocmVuZGVyQ2ZnLCBlbnRpdHlJZCkge1xuICAgICAgICAgICAgdmFyIHJvb3QgPSByZW5kZXJDZmcucm9vdCB8fCBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChlbnRpdHlJZCk7XG4gICAgICAgICAgICBpZiAoIXJvb3QpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBwYXRjaGVzID0gZGlmZihyZW5kZXJDZmcubGFzdFRyZWUgfHwgaCgpLCByZW5kZXJDZmcuY3VycmVudFRyZWUpO1xuXG4gICAgICAgICAgICByb290ID0gcGF0Y2gocm9vdCwgcGF0Y2hlcyk7XG5cbiAgICAgICAgICAgIHJlbmRlckNmZyA9IHRoaXMuZW50aXRpZXMuc2V0Q29tcG9uZW50KGVudGl0eUlkLCAndmRvbScsIHtcbiAgICAgICAgICAgICAgICByb290OiByb290LFxuICAgICAgICAgICAgICAgIGxhc3RUcmVlOiByZW5kZXJDZmcuY3VycmVudFRyZWUsXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZWFjaChyZW5kZXJDZmcucGxhY2Vob2xkZXIsIHRoaXMuZHJhd0RlcGVuZGVudEVudGl0aWVzLCB0aGlzKTtcblxuICAgICAgICAgICAgdmFyIGRlbGVnYXRlZEV2ZW50cyA9IHRoaXMuZW50aXRpZXMuZ2V0Q29tcG9uZW50KGVudGl0eUlkLCAnZGVsZWdhdGVkRXZlbnRzJyk7XG4gICAgICAgICAgICBpZiAoZGVsZWdhdGVkRXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgZWFjaChkZWxlZ2F0ZWRFdmVudHMudmFsKCksIHRoaXMuYmluZERlbGVnYXRlcywgdGhpcywgW3Jvb3RdKTtcbiAgICAgICAgICAgICAgICB0aGlzLmxhc3REZWxlZ2F0ZXNbZW50aXR5SWRdID0gZGVsZWdhdGVkRXZlbnRzO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICBkcmF3RGVwZW5kZW50RW50aXRpZXM6IGZ1bmN0aW9uIChlbnRpdHlJZCkge1xuICAgICAgICAgICAgdmFyIHJlbmRlckNmZyA9IHRoaXMuZW50aXRpZXMuZ2V0Q29tcG9uZW50RGF0YShlbnRpdHlJZCwgJ3Zkb20nKTtcbiAgICAgICAgICAgIGlmICghcmVuZGVyQ2ZnKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgY2hpbGRSb290ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoZW50aXR5SWQpO1xuICAgICAgICAgICAgaWYgKGNoaWxkUm9vdCAmJiBjaGlsZFJvb3QgIT09IHJlbmRlckNmZy5yb290KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5lbnRpdGllcy5zZXRDb21wb25lbnQoZW50aXR5SWQsICd2ZG9tJywge1xuICAgICAgICAgICAgICAgICAgICByb290OiBjaGlsZFJvb3QsXG4gICAgICAgICAgICAgICAgICAgIGxhc3RUcmVlOiBoKCksIC8vIGNsZWFyIGNhY2hlIHRvIGZvcmNlIHJlLWRyYXdcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB0aGlzLmRyYXcocmVuZGVyQ2ZnLCBlbnRpdHlJZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIGJpbmREZWxlZ2F0ZXM6IGZ1bmN0aW9uIChjZmcsIGtleSwgbm9kZSkge1xuICAgICAgICAgICAgaWYgKGNmZy5zZWxlY3Rvcikge1xuICAgICAgICAgICAgICAgIG5vZGUgPSBub2RlLnF1ZXJ5U2VsZWN0b3IoY2ZnLnNlbGVjdG9yKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY2ZnLmRlbGVnYXRlLmJpbmQobm9kZSk7XG4gICAgICAgIH0sXG5cbiAgICB9KS53aGVuQnJld2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5sYXN0U3RhdGVzID0ge307XG4gICAgICAgIHRoaXMubGFzdERlbGVnYXRlcyA9IHt9O1xuICAgIH0pO1xufSgpKTtcbiIsInZhciBkaWZmID0gcmVxdWlyZShcIi4vdnRyZWUvZGlmZi5qc1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGRpZmZcbiIsInZhciBoID0gcmVxdWlyZShcIi4vdmlydHVhbC1oeXBlcnNjcmlwdC9pbmRleC5qc1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGhcbiIsIi8qIVxuICogQ3Jvc3MtQnJvd3NlciBTcGxpdCAxLjEuMVxuICogQ29weXJpZ2h0IDIwMDctMjAxMiBTdGV2ZW4gTGV2aXRoYW4gPHN0ZXZlbmxldml0aGFuLmNvbT5cbiAqIEF2YWlsYWJsZSB1bmRlciB0aGUgTUlUIExpY2Vuc2VcbiAqIEVDTUFTY3JpcHQgY29tcGxpYW50LCB1bmlmb3JtIGNyb3NzLWJyb3dzZXIgc3BsaXQgbWV0aG9kXG4gKi9cblxuLyoqXG4gKiBTcGxpdHMgYSBzdHJpbmcgaW50byBhbiBhcnJheSBvZiBzdHJpbmdzIHVzaW5nIGEgcmVnZXggb3Igc3RyaW5nIHNlcGFyYXRvci4gTWF0Y2hlcyBvZiB0aGVcbiAqIHNlcGFyYXRvciBhcmUgbm90IGluY2x1ZGVkIGluIHRoZSByZXN1bHQgYXJyYXkuIEhvd2V2ZXIsIGlmIGBzZXBhcmF0b3JgIGlzIGEgcmVnZXggdGhhdCBjb250YWluc1xuICogY2FwdHVyaW5nIGdyb3VwcywgYmFja3JlZmVyZW5jZXMgYXJlIHNwbGljZWQgaW50byB0aGUgcmVzdWx0IGVhY2ggdGltZSBgc2VwYXJhdG9yYCBpcyBtYXRjaGVkLlxuICogRml4ZXMgYnJvd3NlciBidWdzIGNvbXBhcmVkIHRvIHRoZSBuYXRpdmUgYFN0cmluZy5wcm90b3R5cGUuc3BsaXRgIGFuZCBjYW4gYmUgdXNlZCByZWxpYWJseVxuICogY3Jvc3MtYnJvd3Nlci5cbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgU3RyaW5nIHRvIHNwbGl0LlxuICogQHBhcmFtIHtSZWdFeHB8U3RyaW5nfSBzZXBhcmF0b3IgUmVnZXggb3Igc3RyaW5nIHRvIHVzZSBmb3Igc2VwYXJhdGluZyB0aGUgc3RyaW5nLlxuICogQHBhcmFtIHtOdW1iZXJ9IFtsaW1pdF0gTWF4aW11bSBudW1iZXIgb2YgaXRlbXMgdG8gaW5jbHVkZSBpbiB0aGUgcmVzdWx0IGFycmF5LlxuICogQHJldHVybnMge0FycmF5fSBBcnJheSBvZiBzdWJzdHJpbmdzLlxuICogQGV4YW1wbGVcbiAqXG4gKiAvLyBCYXNpYyB1c2VcbiAqIHNwbGl0KCdhIGIgYyBkJywgJyAnKTtcbiAqIC8vIC0+IFsnYScsICdiJywgJ2MnLCAnZCddXG4gKlxuICogLy8gV2l0aCBsaW1pdFxuICogc3BsaXQoJ2EgYiBjIGQnLCAnICcsIDIpO1xuICogLy8gLT4gWydhJywgJ2InXVxuICpcbiAqIC8vIEJhY2tyZWZlcmVuY2VzIGluIHJlc3VsdCBhcnJheVxuICogc3BsaXQoJy4ud29yZDEgd29yZDIuLicsIC8oW2Etel0rKShcXGQrKS9pKTtcbiAqIC8vIC0+IFsnLi4nLCAnd29yZCcsICcxJywgJyAnLCAnd29yZCcsICcyJywgJy4uJ11cbiAqL1xubW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gc3BsaXQodW5kZWYpIHtcblxuICB2YXIgbmF0aXZlU3BsaXQgPSBTdHJpbmcucHJvdG90eXBlLnNwbGl0LFxuICAgIGNvbXBsaWFudEV4ZWNOcGNnID0gLygpPz8vLmV4ZWMoXCJcIilbMV0gPT09IHVuZGVmLFxuICAgIC8vIE5QQ0c6IG5vbnBhcnRpY2lwYXRpbmcgY2FwdHVyaW5nIGdyb3VwXG4gICAgc2VsZjtcblxuICBzZWxmID0gZnVuY3Rpb24oc3RyLCBzZXBhcmF0b3IsIGxpbWl0KSB7XG4gICAgLy8gSWYgYHNlcGFyYXRvcmAgaXMgbm90IGEgcmVnZXgsIHVzZSBgbmF0aXZlU3BsaXRgXG4gICAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChzZXBhcmF0b3IpICE9PSBcIltvYmplY3QgUmVnRXhwXVwiKSB7XG4gICAgICByZXR1cm4gbmF0aXZlU3BsaXQuY2FsbChzdHIsIHNlcGFyYXRvciwgbGltaXQpO1xuICAgIH1cbiAgICB2YXIgb3V0cHV0ID0gW10sXG4gICAgICBmbGFncyA9IChzZXBhcmF0b3IuaWdub3JlQ2FzZSA/IFwiaVwiIDogXCJcIikgKyAoc2VwYXJhdG9yLm11bHRpbGluZSA/IFwibVwiIDogXCJcIikgKyAoc2VwYXJhdG9yLmV4dGVuZGVkID8gXCJ4XCIgOiBcIlwiKSArIC8vIFByb3Bvc2VkIGZvciBFUzZcbiAgICAgIChzZXBhcmF0b3Iuc3RpY2t5ID8gXCJ5XCIgOiBcIlwiKSxcbiAgICAgIC8vIEZpcmVmb3ggMytcbiAgICAgIGxhc3RMYXN0SW5kZXggPSAwLFxuICAgICAgLy8gTWFrZSBgZ2xvYmFsYCBhbmQgYXZvaWQgYGxhc3RJbmRleGAgaXNzdWVzIGJ5IHdvcmtpbmcgd2l0aCBhIGNvcHlcbiAgICAgIHNlcGFyYXRvciA9IG5ldyBSZWdFeHAoc2VwYXJhdG9yLnNvdXJjZSwgZmxhZ3MgKyBcImdcIiksXG4gICAgICBzZXBhcmF0b3IyLCBtYXRjaCwgbGFzdEluZGV4LCBsYXN0TGVuZ3RoO1xuICAgIHN0ciArPSBcIlwiOyAvLyBUeXBlLWNvbnZlcnRcbiAgICBpZiAoIWNvbXBsaWFudEV4ZWNOcGNnKSB7XG4gICAgICAvLyBEb2Vzbid0IG5lZWQgZmxhZ3MgZ3ksIGJ1dCB0aGV5IGRvbid0IGh1cnRcbiAgICAgIHNlcGFyYXRvcjIgPSBuZXcgUmVnRXhwKFwiXlwiICsgc2VwYXJhdG9yLnNvdXJjZSArIFwiJCg/IVxcXFxzKVwiLCBmbGFncyk7XG4gICAgfVxuICAgIC8qIFZhbHVlcyBmb3IgYGxpbWl0YCwgcGVyIHRoZSBzcGVjOlxuICAgICAqIElmIHVuZGVmaW5lZDogNDI5NDk2NzI5NSAvLyBNYXRoLnBvdygyLCAzMikgLSAxXG4gICAgICogSWYgMCwgSW5maW5pdHksIG9yIE5hTjogMFxuICAgICAqIElmIHBvc2l0aXZlIG51bWJlcjogbGltaXQgPSBNYXRoLmZsb29yKGxpbWl0KTsgaWYgKGxpbWl0ID4gNDI5NDk2NzI5NSkgbGltaXQgLT0gNDI5NDk2NzI5NjtcbiAgICAgKiBJZiBuZWdhdGl2ZSBudW1iZXI6IDQyOTQ5NjcyOTYgLSBNYXRoLmZsb29yKE1hdGguYWJzKGxpbWl0KSlcbiAgICAgKiBJZiBvdGhlcjogVHlwZS1jb252ZXJ0LCB0aGVuIHVzZSB0aGUgYWJvdmUgcnVsZXNcbiAgICAgKi9cbiAgICBsaW1pdCA9IGxpbWl0ID09PSB1bmRlZiA/IC0xID4+PiAwIDogLy8gTWF0aC5wb3coMiwgMzIpIC0gMVxuICAgIGxpbWl0ID4+PiAwOyAvLyBUb1VpbnQzMihsaW1pdClcbiAgICB3aGlsZSAobWF0Y2ggPSBzZXBhcmF0b3IuZXhlYyhzdHIpKSB7XG4gICAgICAvLyBgc2VwYXJhdG9yLmxhc3RJbmRleGAgaXMgbm90IHJlbGlhYmxlIGNyb3NzLWJyb3dzZXJcbiAgICAgIGxhc3RJbmRleCA9IG1hdGNoLmluZGV4ICsgbWF0Y2hbMF0ubGVuZ3RoO1xuICAgICAgaWYgKGxhc3RJbmRleCA+IGxhc3RMYXN0SW5kZXgpIHtcbiAgICAgICAgb3V0cHV0LnB1c2goc3RyLnNsaWNlKGxhc3RMYXN0SW5kZXgsIG1hdGNoLmluZGV4KSk7XG4gICAgICAgIC8vIEZpeCBicm93c2VycyB3aG9zZSBgZXhlY2AgbWV0aG9kcyBkb24ndCBjb25zaXN0ZW50bHkgcmV0dXJuIGB1bmRlZmluZWRgIGZvclxuICAgICAgICAvLyBub25wYXJ0aWNpcGF0aW5nIGNhcHR1cmluZyBncm91cHNcbiAgICAgICAgaWYgKCFjb21wbGlhbnRFeGVjTnBjZyAmJiBtYXRjaC5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgbWF0Y2hbMF0ucmVwbGFjZShzZXBhcmF0b3IyLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aCAtIDI7IGkrKykge1xuICAgICAgICAgICAgICBpZiAoYXJndW1lbnRzW2ldID09PSB1bmRlZikge1xuICAgICAgICAgICAgICAgIG1hdGNoW2ldID0gdW5kZWY7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWF0Y2gubGVuZ3RoID4gMSAmJiBtYXRjaC5pbmRleCA8IHN0ci5sZW5ndGgpIHtcbiAgICAgICAgICBBcnJheS5wcm90b3R5cGUucHVzaC5hcHBseShvdXRwdXQsIG1hdGNoLnNsaWNlKDEpKTtcbiAgICAgICAgfVxuICAgICAgICBsYXN0TGVuZ3RoID0gbWF0Y2hbMF0ubGVuZ3RoO1xuICAgICAgICBsYXN0TGFzdEluZGV4ID0gbGFzdEluZGV4O1xuICAgICAgICBpZiAob3V0cHV0Lmxlbmd0aCA+PSBsaW1pdCkge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoc2VwYXJhdG9yLmxhc3RJbmRleCA9PT0gbWF0Y2guaW5kZXgpIHtcbiAgICAgICAgc2VwYXJhdG9yLmxhc3RJbmRleCsrOyAvLyBBdm9pZCBhbiBpbmZpbml0ZSBsb29wXG4gICAgICB9XG4gICAgfVxuICAgIGlmIChsYXN0TGFzdEluZGV4ID09PSBzdHIubGVuZ3RoKSB7XG4gICAgICBpZiAobGFzdExlbmd0aCB8fCAhc2VwYXJhdG9yLnRlc3QoXCJcIikpIHtcbiAgICAgICAgb3V0cHV0LnB1c2goXCJcIik7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIG91dHB1dC5wdXNoKHN0ci5zbGljZShsYXN0TGFzdEluZGV4KSk7XG4gICAgfVxuICAgIHJldHVybiBvdXRwdXQubGVuZ3RoID4gbGltaXQgPyBvdXRwdXQuc2xpY2UoMCwgbGltaXQpIDogb3V0cHV0O1xuICB9O1xuXG4gIHJldHVybiBzZWxmO1xufSkoKTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIE9uZVZlcnNpb25Db25zdHJhaW50ID0gcmVxdWlyZSgnaW5kaXZpZHVhbC9vbmUtdmVyc2lvbicpO1xuXG52YXIgTVlfVkVSU0lPTiA9ICc3Jztcbk9uZVZlcnNpb25Db25zdHJhaW50KCdldi1zdG9yZScsIE1ZX1ZFUlNJT04pO1xuXG52YXIgaGFzaEtleSA9ICdfX0VWX1NUT1JFX0tFWUAnICsgTVlfVkVSU0lPTjtcblxubW9kdWxlLmV4cG9ydHMgPSBFdlN0b3JlO1xuXG5mdW5jdGlvbiBFdlN0b3JlKGVsZW0pIHtcbiAgICB2YXIgaGFzaCA9IGVsZW1baGFzaEtleV07XG5cbiAgICBpZiAoIWhhc2gpIHtcbiAgICAgICAgaGFzaCA9IGVsZW1baGFzaEtleV0gPSB7fTtcbiAgICB9XG5cbiAgICByZXR1cm4gaGFzaDtcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuLypnbG9iYWwgd2luZG93LCBnbG9iYWwqL1xuXG52YXIgcm9vdCA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID9cbiAgICB3aW5kb3cgOiB0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJyA/XG4gICAgZ2xvYmFsIDoge307XG5cbm1vZHVsZS5leHBvcnRzID0gSW5kaXZpZHVhbDtcblxuZnVuY3Rpb24gSW5kaXZpZHVhbChrZXksIHZhbHVlKSB7XG4gICAgaWYgKGtleSBpbiByb290KSB7XG4gICAgICAgIHJldHVybiByb290W2tleV07XG4gICAgfVxuXG4gICAgcm9vdFtrZXldID0gdmFsdWU7XG5cbiAgICByZXR1cm4gdmFsdWU7XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBJbmRpdmlkdWFsID0gcmVxdWlyZSgnLi9pbmRleC5qcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE9uZVZlcnNpb247XG5cbmZ1bmN0aW9uIE9uZVZlcnNpb24obW9kdWxlTmFtZSwgdmVyc2lvbiwgZGVmYXVsdFZhbHVlKSB7XG4gICAgdmFyIGtleSA9ICdfX0lORElWSURVQUxfT05FX1ZFUlNJT05fJyArIG1vZHVsZU5hbWU7XG4gICAgdmFyIGVuZm9yY2VLZXkgPSBrZXkgKyAnX0VORk9SQ0VfU0lOR0xFVE9OJztcblxuICAgIHZhciB2ZXJzaW9uVmFsdWUgPSBJbmRpdmlkdWFsKGVuZm9yY2VLZXksIHZlcnNpb24pO1xuXG4gICAgaWYgKHZlcnNpb25WYWx1ZSAhPT0gdmVyc2lvbikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhbiBvbmx5IGhhdmUgb25lIGNvcHkgb2YgJyArXG4gICAgICAgICAgICBtb2R1bGVOYW1lICsgJy5cXG4nICtcbiAgICAgICAgICAgICdZb3UgYWxyZWFkeSBoYXZlIHZlcnNpb24gJyArIHZlcnNpb25WYWx1ZSArXG4gICAgICAgICAgICAnIGluc3RhbGxlZC5cXG4nICtcbiAgICAgICAgICAgICdUaGlzIG1lYW5zIHlvdSBjYW5ub3QgaW5zdGFsbCB2ZXJzaW9uICcgKyB2ZXJzaW9uKTtcbiAgICB9XG5cbiAgICByZXR1cm4gSW5kaXZpZHVhbChrZXksIGRlZmF1bHRWYWx1ZSk7XG59XG4iLCJ2YXIgdG9wTGV2ZWwgPSB0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJyA/IGdsb2JhbCA6XG4gICAgdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cgOiB7fVxudmFyIG1pbkRvYyA9IHJlcXVpcmUoJ21pbi1kb2N1bWVudCcpO1xuXG5pZiAodHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJykge1xuICAgIG1vZHVsZS5leHBvcnRzID0gZG9jdW1lbnQ7XG59IGVsc2Uge1xuICAgIHZhciBkb2NjeSA9IHRvcExldmVsWydfX0dMT0JBTF9ET0NVTUVOVF9DQUNIRUA0J107XG5cbiAgICBpZiAoIWRvY2N5KSB7XG4gICAgICAgIGRvY2N5ID0gdG9wTGV2ZWxbJ19fR0xPQkFMX0RPQ1VNRU5UX0NBQ0hFQDQnXSA9IG1pbkRvYztcbiAgICB9XG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGRvY2N5O1xufVxuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaXNPYmplY3QoeCkge1xuXHRyZXR1cm4gdHlwZW9mIHggPT09IFwib2JqZWN0XCIgJiYgeCAhPT0gbnVsbDtcbn07XG4iLCJ2YXIgbmF0aXZlSXNBcnJheSA9IEFycmF5LmlzQXJyYXlcbnZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmdcblxubW9kdWxlLmV4cG9ydHMgPSBuYXRpdmVJc0FycmF5IHx8IGlzQXJyYXlcblxuZnVuY3Rpb24gaXNBcnJheShvYmopIHtcbiAgICByZXR1cm4gdG9TdHJpbmcuY2FsbChvYmopID09PSBcIltvYmplY3QgQXJyYXldXCJcbn1cbiIsInZhciBwYXRjaCA9IHJlcXVpcmUoXCIuL3Zkb20vcGF0Y2guanNcIilcblxubW9kdWxlLmV4cG9ydHMgPSBwYXRjaFxuIiwidmFyIGlzT2JqZWN0ID0gcmVxdWlyZShcImlzLW9iamVjdFwiKVxudmFyIGlzSG9vayA9IHJlcXVpcmUoXCIuLi92bm9kZS9pcy12aG9vay5qc1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGFwcGx5UHJvcGVydGllc1xuXG5mdW5jdGlvbiBhcHBseVByb3BlcnRpZXMobm9kZSwgcHJvcHMsIHByZXZpb3VzKSB7XG4gICAgZm9yICh2YXIgcHJvcE5hbWUgaW4gcHJvcHMpIHtcbiAgICAgICAgdmFyIHByb3BWYWx1ZSA9IHByb3BzW3Byb3BOYW1lXVxuXG4gICAgICAgIGlmIChwcm9wVmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmVtb3ZlUHJvcGVydHkobm9kZSwgcHJvcE5hbWUsIHByb3BWYWx1ZSwgcHJldmlvdXMpO1xuICAgICAgICB9IGVsc2UgaWYgKGlzSG9vayhwcm9wVmFsdWUpKSB7XG4gICAgICAgICAgICByZW1vdmVQcm9wZXJ0eShub2RlLCBwcm9wTmFtZSwgcHJvcFZhbHVlLCBwcmV2aW91cylcbiAgICAgICAgICAgIGlmIChwcm9wVmFsdWUuaG9vaykge1xuICAgICAgICAgICAgICAgIHByb3BWYWx1ZS5ob29rKG5vZGUsXG4gICAgICAgICAgICAgICAgICAgIHByb3BOYW1lLFxuICAgICAgICAgICAgICAgICAgICBwcmV2aW91cyA/IHByZXZpb3VzW3Byb3BOYW1lXSA6IHVuZGVmaW5lZClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChpc09iamVjdChwcm9wVmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgcGF0Y2hPYmplY3Qobm9kZSwgcHJvcHMsIHByZXZpb3VzLCBwcm9wTmFtZSwgcHJvcFZhbHVlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbm9kZVtwcm9wTmFtZV0gPSBwcm9wVmFsdWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gcmVtb3ZlUHJvcGVydHkobm9kZSwgcHJvcE5hbWUsIHByb3BWYWx1ZSwgcHJldmlvdXMpIHtcbiAgICBpZiAocHJldmlvdXMpIHtcbiAgICAgICAgdmFyIHByZXZpb3VzVmFsdWUgPSBwcmV2aW91c1twcm9wTmFtZV1cblxuICAgICAgICBpZiAoIWlzSG9vayhwcmV2aW91c1ZhbHVlKSkge1xuICAgICAgICAgICAgaWYgKHByb3BOYW1lID09PSBcImF0dHJpYnV0ZXNcIikge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGF0dHJOYW1lIGluIHByZXZpb3VzVmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZS5yZW1vdmVBdHRyaWJ1dGUoYXR0ck5hbWUpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChwcm9wTmFtZSA9PT0gXCJzdHlsZVwiKSB7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSBpbiBwcmV2aW91c1ZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGUuc3R5bGVbaV0gPSBcIlwiXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgcHJldmlvdXNWYWx1ZSA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgICAgICAgIG5vZGVbcHJvcE5hbWVdID0gXCJcIlxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBub2RlW3Byb3BOYW1lXSA9IG51bGxcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChwcmV2aW91c1ZhbHVlLnVuaG9vaykge1xuICAgICAgICAgICAgcHJldmlvdXNWYWx1ZS51bmhvb2sobm9kZSwgcHJvcE5hbWUsIHByb3BWYWx1ZSlcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gcGF0Y2hPYmplY3Qobm9kZSwgcHJvcHMsIHByZXZpb3VzLCBwcm9wTmFtZSwgcHJvcFZhbHVlKSB7XG4gICAgdmFyIHByZXZpb3VzVmFsdWUgPSBwcmV2aW91cyA/IHByZXZpb3VzW3Byb3BOYW1lXSA6IHVuZGVmaW5lZFxuXG4gICAgLy8gU2V0IGF0dHJpYnV0ZXNcbiAgICBpZiAocHJvcE5hbWUgPT09IFwiYXR0cmlidXRlc1wiKSB7XG4gICAgICAgIGZvciAodmFyIGF0dHJOYW1lIGluIHByb3BWYWx1ZSkge1xuICAgICAgICAgICAgdmFyIGF0dHJWYWx1ZSA9IHByb3BWYWx1ZVthdHRyTmFtZV1cblxuICAgICAgICAgICAgaWYgKGF0dHJWYWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgbm9kZS5yZW1vdmVBdHRyaWJ1dGUoYXR0ck5hbWUpXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5vZGUuc2V0QXR0cmlidXRlKGF0dHJOYW1lLCBhdHRyVmFsdWUpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBpZihwcmV2aW91c1ZhbHVlICYmIGlzT2JqZWN0KHByZXZpb3VzVmFsdWUpICYmXG4gICAgICAgIGdldFByb3RvdHlwZShwcmV2aW91c1ZhbHVlKSAhPT0gZ2V0UHJvdG90eXBlKHByb3BWYWx1ZSkpIHtcbiAgICAgICAgbm9kZVtwcm9wTmFtZV0gPSBwcm9wVmFsdWVcbiAgICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgaWYgKCFpc09iamVjdChub2RlW3Byb3BOYW1lXSkpIHtcbiAgICAgICAgbm9kZVtwcm9wTmFtZV0gPSB7fVxuICAgIH1cblxuICAgIHZhciByZXBsYWNlciA9IHByb3BOYW1lID09PSBcInN0eWxlXCIgPyBcIlwiIDogdW5kZWZpbmVkXG5cbiAgICBmb3IgKHZhciBrIGluIHByb3BWYWx1ZSkge1xuICAgICAgICB2YXIgdmFsdWUgPSBwcm9wVmFsdWVba11cbiAgICAgICAgbm9kZVtwcm9wTmFtZV1ba10gPSAodmFsdWUgPT09IHVuZGVmaW5lZCkgPyByZXBsYWNlciA6IHZhbHVlXG4gICAgfVxufVxuXG5mdW5jdGlvbiBnZXRQcm90b3R5cGUodmFsdWUpIHtcbiAgICBpZiAoT2JqZWN0LmdldFByb3RvdHlwZU9mKSB7XG4gICAgICAgIHJldHVybiBPYmplY3QuZ2V0UHJvdG90eXBlT2YodmFsdWUpXG4gICAgfSBlbHNlIGlmICh2YWx1ZS5fX3Byb3RvX18pIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlLl9fcHJvdG9fX1xuICAgIH0gZWxzZSBpZiAodmFsdWUuY29uc3RydWN0b3IpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlLmNvbnN0cnVjdG9yLnByb3RvdHlwZVxuICAgIH1cbn1cbiIsInZhciBkb2N1bWVudCA9IHJlcXVpcmUoXCJnbG9iYWwvZG9jdW1lbnRcIilcblxudmFyIGFwcGx5UHJvcGVydGllcyA9IHJlcXVpcmUoXCIuL2FwcGx5LXByb3BlcnRpZXNcIilcblxudmFyIGlzVk5vZGUgPSByZXF1aXJlKFwiLi4vdm5vZGUvaXMtdm5vZGUuanNcIilcbnZhciBpc1ZUZXh0ID0gcmVxdWlyZShcIi4uL3Zub2RlL2lzLXZ0ZXh0LmpzXCIpXG52YXIgaXNXaWRnZXQgPSByZXF1aXJlKFwiLi4vdm5vZGUvaXMtd2lkZ2V0LmpzXCIpXG52YXIgaGFuZGxlVGh1bmsgPSByZXF1aXJlKFwiLi4vdm5vZGUvaGFuZGxlLXRodW5rLmpzXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gY3JlYXRlRWxlbWVudFxuXG5mdW5jdGlvbiBjcmVhdGVFbGVtZW50KHZub2RlLCBvcHRzKSB7XG4gICAgdmFyIGRvYyA9IG9wdHMgPyBvcHRzLmRvY3VtZW50IHx8IGRvY3VtZW50IDogZG9jdW1lbnRcbiAgICB2YXIgd2FybiA9IG9wdHMgPyBvcHRzLndhcm4gOiBudWxsXG5cbiAgICB2bm9kZSA9IGhhbmRsZVRodW5rKHZub2RlKS5hXG5cbiAgICBpZiAoaXNXaWRnZXQodm5vZGUpKSB7XG4gICAgICAgIHJldHVybiB2bm9kZS5pbml0KClcbiAgICB9IGVsc2UgaWYgKGlzVlRleHQodm5vZGUpKSB7XG4gICAgICAgIHJldHVybiBkb2MuY3JlYXRlVGV4dE5vZGUodm5vZGUudGV4dClcbiAgICB9IGVsc2UgaWYgKCFpc1ZOb2RlKHZub2RlKSkge1xuICAgICAgICBpZiAod2Fybikge1xuICAgICAgICAgICAgd2FybihcIkl0ZW0gaXMgbm90IGEgdmFsaWQgdmlydHVhbCBkb20gbm9kZVwiLCB2bm9kZSlcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbFxuICAgIH1cblxuICAgIHZhciBub2RlID0gKHZub2RlLm5hbWVzcGFjZSA9PT0gbnVsbCkgP1xuICAgICAgICBkb2MuY3JlYXRlRWxlbWVudCh2bm9kZS50YWdOYW1lKSA6XG4gICAgICAgIGRvYy5jcmVhdGVFbGVtZW50TlModm5vZGUubmFtZXNwYWNlLCB2bm9kZS50YWdOYW1lKVxuXG4gICAgdmFyIHByb3BzID0gdm5vZGUucHJvcGVydGllc1xuICAgIGFwcGx5UHJvcGVydGllcyhub2RlLCBwcm9wcylcblxuICAgIHZhciBjaGlsZHJlbiA9IHZub2RlLmNoaWxkcmVuXG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBjaGlsZE5vZGUgPSBjcmVhdGVFbGVtZW50KGNoaWxkcmVuW2ldLCBvcHRzKVxuICAgICAgICBpZiAoY2hpbGROb2RlKSB7XG4gICAgICAgICAgICBub2RlLmFwcGVuZENoaWxkKGNoaWxkTm9kZSlcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBub2RlXG59XG4iLCIvLyBNYXBzIGEgdmlydHVhbCBET00gdHJlZSBvbnRvIGEgcmVhbCBET00gdHJlZSBpbiBhbiBlZmZpY2llbnQgbWFubmVyLlxuLy8gV2UgZG9uJ3Qgd2FudCB0byByZWFkIGFsbCBvZiB0aGUgRE9NIG5vZGVzIGluIHRoZSB0cmVlIHNvIHdlIHVzZVxuLy8gdGhlIGluLW9yZGVyIHRyZWUgaW5kZXhpbmcgdG8gZWxpbWluYXRlIHJlY3Vyc2lvbiBkb3duIGNlcnRhaW4gYnJhbmNoZXMuXG4vLyBXZSBvbmx5IHJlY3Vyc2UgaW50byBhIERPTSBub2RlIGlmIHdlIGtub3cgdGhhdCBpdCBjb250YWlucyBhIGNoaWxkIG9mXG4vLyBpbnRlcmVzdC5cblxudmFyIG5vQ2hpbGQgPSB7fVxuXG5tb2R1bGUuZXhwb3J0cyA9IGRvbUluZGV4XG5cbmZ1bmN0aW9uIGRvbUluZGV4KHJvb3ROb2RlLCB0cmVlLCBpbmRpY2VzLCBub2Rlcykge1xuICAgIGlmICghaW5kaWNlcyB8fCBpbmRpY2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4ge31cbiAgICB9IGVsc2Uge1xuICAgICAgICBpbmRpY2VzLnNvcnQoYXNjZW5kaW5nKVxuICAgICAgICByZXR1cm4gcmVjdXJzZShyb290Tm9kZSwgdHJlZSwgaW5kaWNlcywgbm9kZXMsIDApXG4gICAgfVxufVxuXG5mdW5jdGlvbiByZWN1cnNlKHJvb3ROb2RlLCB0cmVlLCBpbmRpY2VzLCBub2Rlcywgcm9vdEluZGV4KSB7XG4gICAgbm9kZXMgPSBub2RlcyB8fCB7fVxuXG5cbiAgICBpZiAocm9vdE5vZGUpIHtcbiAgICAgICAgaWYgKGluZGV4SW5SYW5nZShpbmRpY2VzLCByb290SW5kZXgsIHJvb3RJbmRleCkpIHtcbiAgICAgICAgICAgIG5vZGVzW3Jvb3RJbmRleF0gPSByb290Tm9kZVxuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHZDaGlsZHJlbiA9IHRyZWUuY2hpbGRyZW5cblxuICAgICAgICBpZiAodkNoaWxkcmVuKSB7XG5cbiAgICAgICAgICAgIHZhciBjaGlsZE5vZGVzID0gcm9vdE5vZGUuY2hpbGROb2Rlc1xuXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRyZWUuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICByb290SW5kZXggKz0gMVxuXG4gICAgICAgICAgICAgICAgdmFyIHZDaGlsZCA9IHZDaGlsZHJlbltpXSB8fCBub0NoaWxkXG4gICAgICAgICAgICAgICAgdmFyIG5leHRJbmRleCA9IHJvb3RJbmRleCArICh2Q2hpbGQuY291bnQgfHwgMClcblxuICAgICAgICAgICAgICAgIC8vIHNraXAgcmVjdXJzaW9uIGRvd24gdGhlIHRyZWUgaWYgdGhlcmUgYXJlIG5vIG5vZGVzIGRvd24gaGVyZVxuICAgICAgICAgICAgICAgIGlmIChpbmRleEluUmFuZ2UoaW5kaWNlcywgcm9vdEluZGV4LCBuZXh0SW5kZXgpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlY3Vyc2UoY2hpbGROb2Rlc1tpXSwgdkNoaWxkLCBpbmRpY2VzLCBub2Rlcywgcm9vdEluZGV4KVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJvb3RJbmRleCA9IG5leHRJbmRleFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG5vZGVzXG59XG5cbi8vIEJpbmFyeSBzZWFyY2ggZm9yIGFuIGluZGV4IGluIHRoZSBpbnRlcnZhbCBbbGVmdCwgcmlnaHRdXG5mdW5jdGlvbiBpbmRleEluUmFuZ2UoaW5kaWNlcywgbGVmdCwgcmlnaHQpIHtcbiAgICBpZiAoaW5kaWNlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuXG4gICAgdmFyIG1pbkluZGV4ID0gMFxuICAgIHZhciBtYXhJbmRleCA9IGluZGljZXMubGVuZ3RoIC0gMVxuICAgIHZhciBjdXJyZW50SW5kZXhcbiAgICB2YXIgY3VycmVudEl0ZW1cblxuICAgIHdoaWxlIChtaW5JbmRleCA8PSBtYXhJbmRleCkge1xuICAgICAgICBjdXJyZW50SW5kZXggPSAoKG1heEluZGV4ICsgbWluSW5kZXgpIC8gMikgPj4gMFxuICAgICAgICBjdXJyZW50SXRlbSA9IGluZGljZXNbY3VycmVudEluZGV4XVxuXG4gICAgICAgIGlmIChtaW5JbmRleCA9PT0gbWF4SW5kZXgpIHtcbiAgICAgICAgICAgIHJldHVybiBjdXJyZW50SXRlbSA+PSBsZWZ0ICYmIGN1cnJlbnRJdGVtIDw9IHJpZ2h0XG4gICAgICAgIH0gZWxzZSBpZiAoY3VycmVudEl0ZW0gPCBsZWZ0KSB7XG4gICAgICAgICAgICBtaW5JbmRleCA9IGN1cnJlbnRJbmRleCArIDFcbiAgICAgICAgfSBlbHNlICBpZiAoY3VycmVudEl0ZW0gPiByaWdodCkge1xuICAgICAgICAgICAgbWF4SW5kZXggPSBjdXJyZW50SW5kZXggLSAxXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBhc2NlbmRpbmcoYSwgYikge1xuICAgIHJldHVybiBhID4gYiA/IDEgOiAtMVxufVxuIiwidmFyIGFwcGx5UHJvcGVydGllcyA9IHJlcXVpcmUoXCIuL2FwcGx5LXByb3BlcnRpZXNcIilcblxudmFyIGlzV2lkZ2V0ID0gcmVxdWlyZShcIi4uL3Zub2RlL2lzLXdpZGdldC5qc1wiKVxudmFyIFZQYXRjaCA9IHJlcXVpcmUoXCIuLi92bm9kZS92cGF0Y2guanNcIilcblxudmFyIHVwZGF0ZVdpZGdldCA9IHJlcXVpcmUoXCIuL3VwZGF0ZS13aWRnZXRcIilcblxubW9kdWxlLmV4cG9ydHMgPSBhcHBseVBhdGNoXG5cbmZ1bmN0aW9uIGFwcGx5UGF0Y2godnBhdGNoLCBkb21Ob2RlLCByZW5kZXJPcHRpb25zKSB7XG4gICAgdmFyIHR5cGUgPSB2cGF0Y2gudHlwZVxuICAgIHZhciB2Tm9kZSA9IHZwYXRjaC52Tm9kZVxuICAgIHZhciBwYXRjaCA9IHZwYXRjaC5wYXRjaFxuXG4gICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgIGNhc2UgVlBhdGNoLlJFTU9WRTpcbiAgICAgICAgICAgIHJldHVybiByZW1vdmVOb2RlKGRvbU5vZGUsIHZOb2RlKVxuICAgICAgICBjYXNlIFZQYXRjaC5JTlNFUlQ6XG4gICAgICAgICAgICByZXR1cm4gaW5zZXJ0Tm9kZShkb21Ob2RlLCBwYXRjaCwgcmVuZGVyT3B0aW9ucylcbiAgICAgICAgY2FzZSBWUGF0Y2guVlRFWFQ6XG4gICAgICAgICAgICByZXR1cm4gc3RyaW5nUGF0Y2goZG9tTm9kZSwgdk5vZGUsIHBhdGNoLCByZW5kZXJPcHRpb25zKVxuICAgICAgICBjYXNlIFZQYXRjaC5XSURHRVQ6XG4gICAgICAgICAgICByZXR1cm4gd2lkZ2V0UGF0Y2goZG9tTm9kZSwgdk5vZGUsIHBhdGNoLCByZW5kZXJPcHRpb25zKVxuICAgICAgICBjYXNlIFZQYXRjaC5WTk9ERTpcbiAgICAgICAgICAgIHJldHVybiB2Tm9kZVBhdGNoKGRvbU5vZGUsIHZOb2RlLCBwYXRjaCwgcmVuZGVyT3B0aW9ucylcbiAgICAgICAgY2FzZSBWUGF0Y2guT1JERVI6XG4gICAgICAgICAgICByZW9yZGVyQ2hpbGRyZW4oZG9tTm9kZSwgcGF0Y2gpXG4gICAgICAgICAgICByZXR1cm4gZG9tTm9kZVxuICAgICAgICBjYXNlIFZQYXRjaC5QUk9QUzpcbiAgICAgICAgICAgIGFwcGx5UHJvcGVydGllcyhkb21Ob2RlLCBwYXRjaCwgdk5vZGUucHJvcGVydGllcylcbiAgICAgICAgICAgIHJldHVybiBkb21Ob2RlXG4gICAgICAgIGNhc2UgVlBhdGNoLlRIVU5LOlxuICAgICAgICAgICAgcmV0dXJuIHJlcGxhY2VSb290KGRvbU5vZGUsXG4gICAgICAgICAgICAgICAgcmVuZGVyT3B0aW9ucy5wYXRjaChkb21Ob2RlLCBwYXRjaCwgcmVuZGVyT3B0aW9ucykpXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICByZXR1cm4gZG9tTm9kZVxuICAgIH1cbn1cblxuZnVuY3Rpb24gcmVtb3ZlTm9kZShkb21Ob2RlLCB2Tm9kZSkge1xuICAgIHZhciBwYXJlbnROb2RlID0gZG9tTm9kZS5wYXJlbnROb2RlXG5cbiAgICBpZiAocGFyZW50Tm9kZSkge1xuICAgICAgICBwYXJlbnROb2RlLnJlbW92ZUNoaWxkKGRvbU5vZGUpXG4gICAgfVxuXG4gICAgZGVzdHJveVdpZGdldChkb21Ob2RlLCB2Tm9kZSk7XG5cbiAgICByZXR1cm4gbnVsbFxufVxuXG5mdW5jdGlvbiBpbnNlcnROb2RlKHBhcmVudE5vZGUsIHZOb2RlLCByZW5kZXJPcHRpb25zKSB7XG4gICAgdmFyIG5ld05vZGUgPSByZW5kZXJPcHRpb25zLnJlbmRlcih2Tm9kZSwgcmVuZGVyT3B0aW9ucylcblxuICAgIGlmIChwYXJlbnROb2RlKSB7XG4gICAgICAgIHBhcmVudE5vZGUuYXBwZW5kQ2hpbGQobmV3Tm9kZSlcbiAgICB9XG5cbiAgICByZXR1cm4gcGFyZW50Tm9kZVxufVxuXG5mdW5jdGlvbiBzdHJpbmdQYXRjaChkb21Ob2RlLCBsZWZ0Vk5vZGUsIHZUZXh0LCByZW5kZXJPcHRpb25zKSB7XG4gICAgdmFyIG5ld05vZGVcblxuICAgIGlmIChkb21Ob2RlLm5vZGVUeXBlID09PSAzKSB7XG4gICAgICAgIGRvbU5vZGUucmVwbGFjZURhdGEoMCwgZG9tTm9kZS5sZW5ndGgsIHZUZXh0LnRleHQpXG4gICAgICAgIG5ld05vZGUgPSBkb21Ob2RlXG4gICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIHBhcmVudE5vZGUgPSBkb21Ob2RlLnBhcmVudE5vZGVcbiAgICAgICAgbmV3Tm9kZSA9IHJlbmRlck9wdGlvbnMucmVuZGVyKHZUZXh0LCByZW5kZXJPcHRpb25zKVxuXG4gICAgICAgIGlmIChwYXJlbnROb2RlICYmIG5ld05vZGUgIT09IGRvbU5vZGUpIHtcbiAgICAgICAgICAgIHBhcmVudE5vZGUucmVwbGFjZUNoaWxkKG5ld05vZGUsIGRvbU5vZGUpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbmV3Tm9kZVxufVxuXG5mdW5jdGlvbiB3aWRnZXRQYXRjaChkb21Ob2RlLCBsZWZ0Vk5vZGUsIHdpZGdldCwgcmVuZGVyT3B0aW9ucykge1xuICAgIHZhciB1cGRhdGluZyA9IHVwZGF0ZVdpZGdldChsZWZ0Vk5vZGUsIHdpZGdldClcbiAgICB2YXIgbmV3Tm9kZVxuXG4gICAgaWYgKHVwZGF0aW5nKSB7XG4gICAgICAgIG5ld05vZGUgPSB3aWRnZXQudXBkYXRlKGxlZnRWTm9kZSwgZG9tTm9kZSkgfHwgZG9tTm9kZVxuICAgIH0gZWxzZSB7XG4gICAgICAgIG5ld05vZGUgPSByZW5kZXJPcHRpb25zLnJlbmRlcih3aWRnZXQsIHJlbmRlck9wdGlvbnMpXG4gICAgfVxuXG4gICAgdmFyIHBhcmVudE5vZGUgPSBkb21Ob2RlLnBhcmVudE5vZGVcblxuICAgIGlmIChwYXJlbnROb2RlICYmIG5ld05vZGUgIT09IGRvbU5vZGUpIHtcbiAgICAgICAgcGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQobmV3Tm9kZSwgZG9tTm9kZSlcbiAgICB9XG5cbiAgICBpZiAoIXVwZGF0aW5nKSB7XG4gICAgICAgIGRlc3Ryb3lXaWRnZXQoZG9tTm9kZSwgbGVmdFZOb2RlKVxuICAgIH1cblxuICAgIHJldHVybiBuZXdOb2RlXG59XG5cbmZ1bmN0aW9uIHZOb2RlUGF0Y2goZG9tTm9kZSwgbGVmdFZOb2RlLCB2Tm9kZSwgcmVuZGVyT3B0aW9ucykge1xuICAgIHZhciBwYXJlbnROb2RlID0gZG9tTm9kZS5wYXJlbnROb2RlXG4gICAgdmFyIG5ld05vZGUgPSByZW5kZXJPcHRpb25zLnJlbmRlcih2Tm9kZSwgcmVuZGVyT3B0aW9ucylcblxuICAgIGlmIChwYXJlbnROb2RlICYmIG5ld05vZGUgIT09IGRvbU5vZGUpIHtcbiAgICAgICAgcGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQobmV3Tm9kZSwgZG9tTm9kZSlcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3Tm9kZVxufVxuXG5mdW5jdGlvbiBkZXN0cm95V2lkZ2V0KGRvbU5vZGUsIHcpIHtcbiAgICBpZiAodHlwZW9mIHcuZGVzdHJveSA9PT0gXCJmdW5jdGlvblwiICYmIGlzV2lkZ2V0KHcpKSB7XG4gICAgICAgIHcuZGVzdHJveShkb21Ob2RlKVxuICAgIH1cbn1cblxuZnVuY3Rpb24gcmVvcmRlckNoaWxkcmVuKGRvbU5vZGUsIG1vdmVzKSB7XG4gICAgdmFyIGNoaWxkTm9kZXMgPSBkb21Ob2RlLmNoaWxkTm9kZXNcbiAgICB2YXIga2V5TWFwID0ge31cbiAgICB2YXIgbm9kZVxuICAgIHZhciByZW1vdmVcbiAgICB2YXIgaW5zZXJ0XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG1vdmVzLnJlbW92ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgcmVtb3ZlID0gbW92ZXMucmVtb3Zlc1tpXVxuICAgICAgICBub2RlID0gY2hpbGROb2Rlc1tyZW1vdmUuZnJvbV1cbiAgICAgICAgaWYgKHJlbW92ZS5rZXkpIHtcbiAgICAgICAgICAgIGtleU1hcFtyZW1vdmUua2V5XSA9IG5vZGVcbiAgICAgICAgfVxuICAgICAgICBkb21Ob2RlLnJlbW92ZUNoaWxkKG5vZGUpXG4gICAgfVxuXG4gICAgdmFyIGxlbmd0aCA9IGNoaWxkTm9kZXMubGVuZ3RoXG4gICAgZm9yICh2YXIgaiA9IDA7IGogPCBtb3Zlcy5pbnNlcnRzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIGluc2VydCA9IG1vdmVzLmluc2VydHNbal1cbiAgICAgICAgbm9kZSA9IGtleU1hcFtpbnNlcnQua2V5XVxuICAgICAgICAvLyB0aGlzIGlzIHRoZSB3ZWlyZGVzdCBidWcgaSd2ZSBldmVyIHNlZW4gaW4gd2Via2l0XG4gICAgICAgIGRvbU5vZGUuaW5zZXJ0QmVmb3JlKG5vZGUsIGluc2VydC50byA+PSBsZW5ndGgrKyA/IG51bGwgOiBjaGlsZE5vZGVzW2luc2VydC50b10pXG4gICAgfVxufVxuXG5mdW5jdGlvbiByZXBsYWNlUm9vdChvbGRSb290LCBuZXdSb290KSB7XG4gICAgaWYgKG9sZFJvb3QgJiYgbmV3Um9vdCAmJiBvbGRSb290ICE9PSBuZXdSb290ICYmIG9sZFJvb3QucGFyZW50Tm9kZSkge1xuICAgICAgICBvbGRSb290LnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKG5ld1Jvb3QsIG9sZFJvb3QpXG4gICAgfVxuXG4gICAgcmV0dXJuIG5ld1Jvb3Q7XG59XG4iLCJ2YXIgZG9jdW1lbnQgPSByZXF1aXJlKFwiZ2xvYmFsL2RvY3VtZW50XCIpXG52YXIgaXNBcnJheSA9IHJlcXVpcmUoXCJ4LWlzLWFycmF5XCIpXG5cbnZhciByZW5kZXIgPSByZXF1aXJlKFwiLi9jcmVhdGUtZWxlbWVudFwiKVxudmFyIGRvbUluZGV4ID0gcmVxdWlyZShcIi4vZG9tLWluZGV4XCIpXG52YXIgcGF0Y2hPcCA9IHJlcXVpcmUoXCIuL3BhdGNoLW9wXCIpXG5tb2R1bGUuZXhwb3J0cyA9IHBhdGNoXG5cbmZ1bmN0aW9uIHBhdGNoKHJvb3ROb2RlLCBwYXRjaGVzLCByZW5kZXJPcHRpb25zKSB7XG4gICAgcmVuZGVyT3B0aW9ucyA9IHJlbmRlck9wdGlvbnMgfHwge31cbiAgICByZW5kZXJPcHRpb25zLnBhdGNoID0gcmVuZGVyT3B0aW9ucy5wYXRjaCAmJiByZW5kZXJPcHRpb25zLnBhdGNoICE9PSBwYXRjaFxuICAgICAgICA/IHJlbmRlck9wdGlvbnMucGF0Y2hcbiAgICAgICAgOiBwYXRjaFJlY3Vyc2l2ZVxuICAgIHJlbmRlck9wdGlvbnMucmVuZGVyID0gcmVuZGVyT3B0aW9ucy5yZW5kZXIgfHwgcmVuZGVyXG5cbiAgICByZXR1cm4gcmVuZGVyT3B0aW9ucy5wYXRjaChyb290Tm9kZSwgcGF0Y2hlcywgcmVuZGVyT3B0aW9ucylcbn1cblxuZnVuY3Rpb24gcGF0Y2hSZWN1cnNpdmUocm9vdE5vZGUsIHBhdGNoZXMsIHJlbmRlck9wdGlvbnMpIHtcbiAgICB2YXIgaW5kaWNlcyA9IHBhdGNoSW5kaWNlcyhwYXRjaGVzKVxuXG4gICAgaWYgKGluZGljZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiByb290Tm9kZVxuICAgIH1cblxuICAgIHZhciBpbmRleCA9IGRvbUluZGV4KHJvb3ROb2RlLCBwYXRjaGVzLmEsIGluZGljZXMpXG4gICAgdmFyIG93bmVyRG9jdW1lbnQgPSByb290Tm9kZS5vd25lckRvY3VtZW50XG5cbiAgICBpZiAoIXJlbmRlck9wdGlvbnMuZG9jdW1lbnQgJiYgb3duZXJEb2N1bWVudCAhPT0gZG9jdW1lbnQpIHtcbiAgICAgICAgcmVuZGVyT3B0aW9ucy5kb2N1bWVudCA9IG93bmVyRG9jdW1lbnRcbiAgICB9XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGluZGljZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIG5vZGVJbmRleCA9IGluZGljZXNbaV1cbiAgICAgICAgcm9vdE5vZGUgPSBhcHBseVBhdGNoKHJvb3ROb2RlLFxuICAgICAgICAgICAgaW5kZXhbbm9kZUluZGV4XSxcbiAgICAgICAgICAgIHBhdGNoZXNbbm9kZUluZGV4XSxcbiAgICAgICAgICAgIHJlbmRlck9wdGlvbnMpXG4gICAgfVxuXG4gICAgcmV0dXJuIHJvb3ROb2RlXG59XG5cbmZ1bmN0aW9uIGFwcGx5UGF0Y2gocm9vdE5vZGUsIGRvbU5vZGUsIHBhdGNoTGlzdCwgcmVuZGVyT3B0aW9ucykge1xuICAgIGlmICghZG9tTm9kZSkge1xuICAgICAgICByZXR1cm4gcm9vdE5vZGVcbiAgICB9XG5cbiAgICB2YXIgbmV3Tm9kZVxuXG4gICAgaWYgKGlzQXJyYXkocGF0Y2hMaXN0KSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHBhdGNoTGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbmV3Tm9kZSA9IHBhdGNoT3AocGF0Y2hMaXN0W2ldLCBkb21Ob2RlLCByZW5kZXJPcHRpb25zKVxuXG4gICAgICAgICAgICBpZiAoZG9tTm9kZSA9PT0gcm9vdE5vZGUpIHtcbiAgICAgICAgICAgICAgICByb290Tm9kZSA9IG5ld05vZGVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIG5ld05vZGUgPSBwYXRjaE9wKHBhdGNoTGlzdCwgZG9tTm9kZSwgcmVuZGVyT3B0aW9ucylcblxuICAgICAgICBpZiAoZG9tTm9kZSA9PT0gcm9vdE5vZGUpIHtcbiAgICAgICAgICAgIHJvb3ROb2RlID0gbmV3Tm9kZVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJvb3ROb2RlXG59XG5cbmZ1bmN0aW9uIHBhdGNoSW5kaWNlcyhwYXRjaGVzKSB7XG4gICAgdmFyIGluZGljZXMgPSBbXVxuXG4gICAgZm9yICh2YXIga2V5IGluIHBhdGNoZXMpIHtcbiAgICAgICAgaWYgKGtleSAhPT0gXCJhXCIpIHtcbiAgICAgICAgICAgIGluZGljZXMucHVzaChOdW1iZXIoa2V5KSlcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBpbmRpY2VzXG59XG4iLCJ2YXIgaXNXaWRnZXQgPSByZXF1aXJlKFwiLi4vdm5vZGUvaXMtd2lkZ2V0LmpzXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gdXBkYXRlV2lkZ2V0XG5cbmZ1bmN0aW9uIHVwZGF0ZVdpZGdldChhLCBiKSB7XG4gICAgaWYgKGlzV2lkZ2V0KGEpICYmIGlzV2lkZ2V0KGIpKSB7XG4gICAgICAgIGlmIChcIm5hbWVcIiBpbiBhICYmIFwibmFtZVwiIGluIGIpIHtcbiAgICAgICAgICAgIHJldHVybiBhLmlkID09PSBiLmlkXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gYS5pbml0ID09PSBiLmluaXRcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmYWxzZVxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgRXZTdG9yZSA9IHJlcXVpcmUoJ2V2LXN0b3JlJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gRXZIb29rO1xuXG5mdW5jdGlvbiBFdkhvb2sodmFsdWUpIHtcbiAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgRXZIb29rKSkge1xuICAgICAgICByZXR1cm4gbmV3IEV2SG9vayh2YWx1ZSk7XG4gICAgfVxuXG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xufVxuXG5Fdkhvb2sucHJvdG90eXBlLmhvb2sgPSBmdW5jdGlvbiAobm9kZSwgcHJvcGVydHlOYW1lKSB7XG4gICAgdmFyIGVzID0gRXZTdG9yZShub2RlKTtcbiAgICB2YXIgcHJvcE5hbWUgPSBwcm9wZXJ0eU5hbWUuc3Vic3RyKDMpO1xuXG4gICAgZXNbcHJvcE5hbWVdID0gdGhpcy52YWx1ZTtcbn07XG5cbkV2SG9vay5wcm90b3R5cGUudW5ob29rID0gZnVuY3Rpb24obm9kZSwgcHJvcGVydHlOYW1lKSB7XG4gICAgdmFyIGVzID0gRXZTdG9yZShub2RlKTtcbiAgICB2YXIgcHJvcE5hbWUgPSBwcm9wZXJ0eU5hbWUuc3Vic3RyKDMpO1xuXG4gICAgZXNbcHJvcE5hbWVdID0gdW5kZWZpbmVkO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBTb2Z0U2V0SG9vaztcblxuZnVuY3Rpb24gU29mdFNldEhvb2sodmFsdWUpIHtcbiAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgU29mdFNldEhvb2spKSB7XG4gICAgICAgIHJldHVybiBuZXcgU29mdFNldEhvb2sodmFsdWUpO1xuICAgIH1cblxuICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbn1cblxuU29mdFNldEhvb2sucHJvdG90eXBlLmhvb2sgPSBmdW5jdGlvbiAobm9kZSwgcHJvcGVydHlOYW1lKSB7XG4gICAgaWYgKG5vZGVbcHJvcGVydHlOYW1lXSAhPT0gdGhpcy52YWx1ZSkge1xuICAgICAgICBub2RlW3Byb3BlcnR5TmFtZV0gPSB0aGlzLnZhbHVlO1xuICAgIH1cbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBpc0FycmF5ID0gcmVxdWlyZSgneC1pcy1hcnJheScpO1xuXG52YXIgVk5vZGUgPSByZXF1aXJlKCcuLi92bm9kZS92bm9kZS5qcycpO1xudmFyIFZUZXh0ID0gcmVxdWlyZSgnLi4vdm5vZGUvdnRleHQuanMnKTtcbnZhciBpc1ZOb2RlID0gcmVxdWlyZSgnLi4vdm5vZGUvaXMtdm5vZGUnKTtcbnZhciBpc1ZUZXh0ID0gcmVxdWlyZSgnLi4vdm5vZGUvaXMtdnRleHQnKTtcbnZhciBpc1dpZGdldCA9IHJlcXVpcmUoJy4uL3Zub2RlL2lzLXdpZGdldCcpO1xudmFyIGlzSG9vayA9IHJlcXVpcmUoJy4uL3Zub2RlL2lzLXZob29rJyk7XG52YXIgaXNWVGh1bmsgPSByZXF1aXJlKCcuLi92bm9kZS9pcy10aHVuaycpO1xuXG52YXIgcGFyc2VUYWcgPSByZXF1aXJlKCcuL3BhcnNlLXRhZy5qcycpO1xudmFyIHNvZnRTZXRIb29rID0gcmVxdWlyZSgnLi9ob29rcy9zb2Z0LXNldC1ob29rLmpzJyk7XG52YXIgZXZIb29rID0gcmVxdWlyZSgnLi9ob29rcy9ldi1ob29rLmpzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gaDtcblxuZnVuY3Rpb24gaCh0YWdOYW1lLCBwcm9wZXJ0aWVzLCBjaGlsZHJlbikge1xuICAgIHZhciBjaGlsZE5vZGVzID0gW107XG4gICAgdmFyIHRhZywgcHJvcHMsIGtleSwgbmFtZXNwYWNlO1xuXG4gICAgaWYgKCFjaGlsZHJlbiAmJiBpc0NoaWxkcmVuKHByb3BlcnRpZXMpKSB7XG4gICAgICAgIGNoaWxkcmVuID0gcHJvcGVydGllcztcbiAgICAgICAgcHJvcHMgPSB7fTtcbiAgICB9XG5cbiAgICBwcm9wcyA9IHByb3BzIHx8IHByb3BlcnRpZXMgfHwge307XG4gICAgdGFnID0gcGFyc2VUYWcodGFnTmFtZSwgcHJvcHMpO1xuXG4gICAgLy8gc3VwcG9ydCBrZXlzXG4gICAgaWYgKHByb3BzLmhhc093blByb3BlcnR5KCdrZXknKSkge1xuICAgICAgICBrZXkgPSBwcm9wcy5rZXk7XG4gICAgICAgIHByb3BzLmtleSA9IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICAvLyBzdXBwb3J0IG5hbWVzcGFjZVxuICAgIGlmIChwcm9wcy5oYXNPd25Qcm9wZXJ0eSgnbmFtZXNwYWNlJykpIHtcbiAgICAgICAgbmFtZXNwYWNlID0gcHJvcHMubmFtZXNwYWNlO1xuICAgICAgICBwcm9wcy5uYW1lc3BhY2UgPSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgLy8gZml4IGN1cnNvciBidWdcbiAgICBpZiAodGFnID09PSAnSU5QVVQnICYmXG4gICAgICAgICFuYW1lc3BhY2UgJiZcbiAgICAgICAgcHJvcHMuaGFzT3duUHJvcGVydHkoJ3ZhbHVlJykgJiZcbiAgICAgICAgcHJvcHMudmFsdWUgIT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAhaXNIb29rKHByb3BzLnZhbHVlKVxuICAgICkge1xuICAgICAgICBwcm9wcy52YWx1ZSA9IHNvZnRTZXRIb29rKHByb3BzLnZhbHVlKTtcbiAgICB9XG5cbiAgICB0cmFuc2Zvcm1Qcm9wZXJ0aWVzKHByb3BzKTtcblxuICAgIGlmIChjaGlsZHJlbiAhPT0gdW5kZWZpbmVkICYmIGNoaWxkcmVuICE9PSBudWxsKSB7XG4gICAgICAgIGFkZENoaWxkKGNoaWxkcmVuLCBjaGlsZE5vZGVzLCB0YWcsIHByb3BzKTtcbiAgICB9XG5cblxuICAgIHJldHVybiBuZXcgVk5vZGUodGFnLCBwcm9wcywgY2hpbGROb2Rlcywga2V5LCBuYW1lc3BhY2UpO1xufVxuXG5mdW5jdGlvbiBhZGRDaGlsZChjLCBjaGlsZE5vZGVzLCB0YWcsIHByb3BzKSB7XG4gICAgaWYgKHR5cGVvZiBjID09PSAnc3RyaW5nJykge1xuICAgICAgICBjaGlsZE5vZGVzLnB1c2gobmV3IFZUZXh0KGMpKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBjID09PSAnbnVtYmVyJykge1xuICAgICAgICBjaGlsZE5vZGVzLnB1c2gobmV3IFZUZXh0KFN0cmluZyhjKSkpO1xuICAgIH0gZWxzZSBpZiAoaXNDaGlsZChjKSkge1xuICAgICAgICBjaGlsZE5vZGVzLnB1c2goYyk7XG4gICAgfSBlbHNlIGlmIChpc0FycmF5KGMpKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYWRkQ2hpbGQoY1tpXSwgY2hpbGROb2RlcywgdGFnLCBwcm9wcyk7XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGMgPT09IG51bGwgfHwgYyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBVbmV4cGVjdGVkVmlydHVhbEVsZW1lbnQoe1xuICAgICAgICAgICAgZm9yZWlnbk9iamVjdDogYyxcbiAgICAgICAgICAgIHBhcmVudFZub2RlOiB7XG4gICAgICAgICAgICAgICAgdGFnTmFtZTogdGFnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHByb3BzXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gdHJhbnNmb3JtUHJvcGVydGllcyhwcm9wcykge1xuICAgIGZvciAodmFyIHByb3BOYW1lIGluIHByb3BzKSB7XG4gICAgICAgIGlmIChwcm9wcy5oYXNPd25Qcm9wZXJ0eShwcm9wTmFtZSkpIHtcbiAgICAgICAgICAgIHZhciB2YWx1ZSA9IHByb3BzW3Byb3BOYW1lXTtcblxuICAgICAgICAgICAgaWYgKGlzSG9vayh2YWx1ZSkpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHByb3BOYW1lLnN1YnN0cigwLCAzKSA9PT0gJ2V2LScpIHtcbiAgICAgICAgICAgICAgICAvLyBhZGQgZXYtZm9vIHN1cHBvcnRcbiAgICAgICAgICAgICAgICBwcm9wc1twcm9wTmFtZV0gPSBldkhvb2sodmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiBpc0NoaWxkKHgpIHtcbiAgICByZXR1cm4gaXNWTm9kZSh4KSB8fCBpc1ZUZXh0KHgpIHx8IGlzV2lkZ2V0KHgpIHx8IGlzVlRodW5rKHgpO1xufVxuXG5mdW5jdGlvbiBpc0NoaWxkcmVuKHgpIHtcbiAgICByZXR1cm4gdHlwZW9mIHggPT09ICdzdHJpbmcnIHx8IGlzQXJyYXkoeCkgfHwgaXNDaGlsZCh4KTtcbn1cblxuZnVuY3Rpb24gVW5leHBlY3RlZFZpcnR1YWxFbGVtZW50KGRhdGEpIHtcbiAgICB2YXIgZXJyID0gbmV3IEVycm9yKCk7XG5cbiAgICBlcnIudHlwZSA9ICd2aXJ0dWFsLWh5cGVyc2NyaXB0LnVuZXhwZWN0ZWQudmlydHVhbC1lbGVtZW50JztcbiAgICBlcnIubWVzc2FnZSA9ICdVbmV4cGVjdGVkIHZpcnR1YWwgY2hpbGQgcGFzc2VkIHRvIGgoKS5cXG4nICtcbiAgICAgICAgJ0V4cGVjdGVkIGEgVk5vZGUgLyBWdGh1bmsgLyBWV2lkZ2V0IC8gc3RyaW5nIGJ1dDpcXG4nICtcbiAgICAgICAgJ2dvdDpcXG4nICtcbiAgICAgICAgZXJyb3JTdHJpbmcoZGF0YS5mb3JlaWduT2JqZWN0KSArXG4gICAgICAgICcuXFxuJyArXG4gICAgICAgICdUaGUgcGFyZW50IHZub2RlIGlzOlxcbicgK1xuICAgICAgICBlcnJvclN0cmluZyhkYXRhLnBhcmVudFZub2RlKVxuICAgICAgICAnXFxuJyArXG4gICAgICAgICdTdWdnZXN0ZWQgZml4OiBjaGFuZ2UgeW91ciBgaCguLi4sIFsgLi4uIF0pYCBjYWxsc2l0ZS4nO1xuICAgIGVyci5mb3JlaWduT2JqZWN0ID0gZGF0YS5mb3JlaWduT2JqZWN0O1xuICAgIGVyci5wYXJlbnRWbm9kZSA9IGRhdGEucGFyZW50Vm5vZGU7XG5cbiAgICByZXR1cm4gZXJyO1xufVxuXG5mdW5jdGlvbiBlcnJvclN0cmluZyhvYmopIHtcbiAgICB0cnkge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkob2JqLCBudWxsLCAnICAgICcpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmV0dXJuIFN0cmluZyhvYmopO1xuICAgIH1cbn1cbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHNwbGl0ID0gcmVxdWlyZSgnYnJvd3Nlci1zcGxpdCcpO1xuXG52YXIgY2xhc3NJZFNwbGl0ID0gLyhbXFwuI10/W2EtekEtWjAtOVxcdTAwN0YtXFx1RkZGRl86LV0rKS87XG52YXIgbm90Q2xhc3NJZCA9IC9eXFwufCMvO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHBhcnNlVGFnO1xuXG5mdW5jdGlvbiBwYXJzZVRhZyh0YWcsIHByb3BzKSB7XG4gICAgaWYgKCF0YWcpIHtcbiAgICAgICAgcmV0dXJuICdESVYnO1xuICAgIH1cblxuICAgIHZhciBub0lkID0gIShwcm9wcy5oYXNPd25Qcm9wZXJ0eSgnaWQnKSk7XG5cbiAgICB2YXIgdGFnUGFydHMgPSBzcGxpdCh0YWcsIGNsYXNzSWRTcGxpdCk7XG4gICAgdmFyIHRhZ05hbWUgPSBudWxsO1xuXG4gICAgaWYgKG5vdENsYXNzSWQudGVzdCh0YWdQYXJ0c1sxXSkpIHtcbiAgICAgICAgdGFnTmFtZSA9ICdESVYnO1xuICAgIH1cblxuICAgIHZhciBjbGFzc2VzLCBwYXJ0LCB0eXBlLCBpO1xuXG4gICAgZm9yIChpID0gMDsgaSA8IHRhZ1BhcnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHBhcnQgPSB0YWdQYXJ0c1tpXTtcblxuICAgICAgICBpZiAoIXBhcnQpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgdHlwZSA9IHBhcnQuY2hhckF0KDApO1xuXG4gICAgICAgIGlmICghdGFnTmFtZSkge1xuICAgICAgICAgICAgdGFnTmFtZSA9IHBhcnQ7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJy4nKSB7XG4gICAgICAgICAgICBjbGFzc2VzID0gY2xhc3NlcyB8fCBbXTtcbiAgICAgICAgICAgIGNsYXNzZXMucHVzaChwYXJ0LnN1YnN0cmluZygxLCBwYXJ0Lmxlbmd0aCkpO1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICcjJyAmJiBub0lkKSB7XG4gICAgICAgICAgICBwcm9wcy5pZCA9IHBhcnQuc3Vic3RyaW5nKDEsIHBhcnQubGVuZ3RoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChjbGFzc2VzKSB7XG4gICAgICAgIGlmIChwcm9wcy5jbGFzc05hbWUpIHtcbiAgICAgICAgICAgIGNsYXNzZXMucHVzaChwcm9wcy5jbGFzc05hbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJvcHMuY2xhc3NOYW1lID0gY2xhc3Nlcy5qb2luKCcgJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHByb3BzLm5hbWVzcGFjZSA/IHRhZ05hbWUgOiB0YWdOYW1lLnRvVXBwZXJDYXNlKCk7XG59XG4iLCJ2YXIgaXNWTm9kZSA9IHJlcXVpcmUoXCIuL2lzLXZub2RlXCIpXG52YXIgaXNWVGV4dCA9IHJlcXVpcmUoXCIuL2lzLXZ0ZXh0XCIpXG52YXIgaXNXaWRnZXQgPSByZXF1aXJlKFwiLi9pcy13aWRnZXRcIilcbnZhciBpc1RodW5rID0gcmVxdWlyZShcIi4vaXMtdGh1bmtcIilcblxubW9kdWxlLmV4cG9ydHMgPSBoYW5kbGVUaHVua1xuXG5mdW5jdGlvbiBoYW5kbGVUaHVuayhhLCBiKSB7XG4gICAgdmFyIHJlbmRlcmVkQSA9IGFcbiAgICB2YXIgcmVuZGVyZWRCID0gYlxuXG4gICAgaWYgKGlzVGh1bmsoYikpIHtcbiAgICAgICAgcmVuZGVyZWRCID0gcmVuZGVyVGh1bmsoYiwgYSlcbiAgICB9XG5cbiAgICBpZiAoaXNUaHVuayhhKSkge1xuICAgICAgICByZW5kZXJlZEEgPSByZW5kZXJUaHVuayhhLCBudWxsKVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIGE6IHJlbmRlcmVkQSxcbiAgICAgICAgYjogcmVuZGVyZWRCXG4gICAgfVxufVxuXG5mdW5jdGlvbiByZW5kZXJUaHVuayh0aHVuaywgcHJldmlvdXMpIHtcbiAgICB2YXIgcmVuZGVyZWRUaHVuayA9IHRodW5rLnZub2RlXG5cbiAgICBpZiAoIXJlbmRlcmVkVGh1bmspIHtcbiAgICAgICAgcmVuZGVyZWRUaHVuayA9IHRodW5rLnZub2RlID0gdGh1bmsucmVuZGVyKHByZXZpb3VzKVxuICAgIH1cblxuICAgIGlmICghKGlzVk5vZGUocmVuZGVyZWRUaHVuaykgfHxcbiAgICAgICAgICAgIGlzVlRleHQocmVuZGVyZWRUaHVuaykgfHxcbiAgICAgICAgICAgIGlzV2lkZ2V0KHJlbmRlcmVkVGh1bmspKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJ0aHVuayBkaWQgbm90IHJldHVybiBhIHZhbGlkIG5vZGVcIik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlbmRlcmVkVGh1bmtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gaXNUaHVua1xyXG5cclxuZnVuY3Rpb24gaXNUaHVuayh0KSB7XHJcbiAgICByZXR1cm4gdCAmJiB0LnR5cGUgPT09IFwiVGh1bmtcIlxyXG59XHJcbiIsIm1vZHVsZS5leHBvcnRzID0gaXNIb29rXG5cbmZ1bmN0aW9uIGlzSG9vayhob29rKSB7XG4gICAgcmV0dXJuIGhvb2sgJiZcbiAgICAgICh0eXBlb2YgaG9vay5ob29rID09PSBcImZ1bmN0aW9uXCIgJiYgIWhvb2suaGFzT3duUHJvcGVydHkoXCJob29rXCIpIHx8XG4gICAgICAgdHlwZW9mIGhvb2sudW5ob29rID09PSBcImZ1bmN0aW9uXCIgJiYgIWhvb2suaGFzT3duUHJvcGVydHkoXCJ1bmhvb2tcIikpXG59XG4iLCJ2YXIgdmVyc2lvbiA9IHJlcXVpcmUoXCIuL3ZlcnNpb25cIilcblxubW9kdWxlLmV4cG9ydHMgPSBpc1ZpcnR1YWxOb2RlXG5cbmZ1bmN0aW9uIGlzVmlydHVhbE5vZGUoeCkge1xuICAgIHJldHVybiB4ICYmIHgudHlwZSA9PT0gXCJWaXJ0dWFsTm9kZVwiICYmIHgudmVyc2lvbiA9PT0gdmVyc2lvblxufVxuIiwidmFyIHZlcnNpb24gPSByZXF1aXJlKFwiLi92ZXJzaW9uXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gaXNWaXJ0dWFsVGV4dFxuXG5mdW5jdGlvbiBpc1ZpcnR1YWxUZXh0KHgpIHtcbiAgICByZXR1cm4geCAmJiB4LnR5cGUgPT09IFwiVmlydHVhbFRleHRcIiAmJiB4LnZlcnNpb24gPT09IHZlcnNpb25cbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gaXNXaWRnZXRcblxuZnVuY3Rpb24gaXNXaWRnZXQodykge1xuICAgIHJldHVybiB3ICYmIHcudHlwZSA9PT0gXCJXaWRnZXRcIlxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBcIjJcIlxuIiwidmFyIHZlcnNpb24gPSByZXF1aXJlKFwiLi92ZXJzaW9uXCIpXG52YXIgaXNWTm9kZSA9IHJlcXVpcmUoXCIuL2lzLXZub2RlXCIpXG52YXIgaXNXaWRnZXQgPSByZXF1aXJlKFwiLi9pcy13aWRnZXRcIilcbnZhciBpc1RodW5rID0gcmVxdWlyZShcIi4vaXMtdGh1bmtcIilcbnZhciBpc1ZIb29rID0gcmVxdWlyZShcIi4vaXMtdmhvb2tcIilcblxubW9kdWxlLmV4cG9ydHMgPSBWaXJ0dWFsTm9kZVxuXG52YXIgbm9Qcm9wZXJ0aWVzID0ge31cbnZhciBub0NoaWxkcmVuID0gW11cblxuZnVuY3Rpb24gVmlydHVhbE5vZGUodGFnTmFtZSwgcHJvcGVydGllcywgY2hpbGRyZW4sIGtleSwgbmFtZXNwYWNlKSB7XG4gICAgdGhpcy50YWdOYW1lID0gdGFnTmFtZVxuICAgIHRoaXMucHJvcGVydGllcyA9IHByb3BlcnRpZXMgfHwgbm9Qcm9wZXJ0aWVzXG4gICAgdGhpcy5jaGlsZHJlbiA9IGNoaWxkcmVuIHx8IG5vQ2hpbGRyZW5cbiAgICB0aGlzLmtleSA9IGtleSAhPSBudWxsID8gU3RyaW5nKGtleSkgOiB1bmRlZmluZWRcbiAgICB0aGlzLm5hbWVzcGFjZSA9ICh0eXBlb2YgbmFtZXNwYWNlID09PSBcInN0cmluZ1wiKSA/IG5hbWVzcGFjZSA6IG51bGxcblxuICAgIHZhciBjb3VudCA9IChjaGlsZHJlbiAmJiBjaGlsZHJlbi5sZW5ndGgpIHx8IDBcbiAgICB2YXIgZGVzY2VuZGFudHMgPSAwXG4gICAgdmFyIGhhc1dpZGdldHMgPSBmYWxzZVxuICAgIHZhciBoYXNUaHVua3MgPSBmYWxzZVxuICAgIHZhciBkZXNjZW5kYW50SG9va3MgPSBmYWxzZVxuICAgIHZhciBob29rc1xuXG4gICAgZm9yICh2YXIgcHJvcE5hbWUgaW4gcHJvcGVydGllcykge1xuICAgICAgICBpZiAocHJvcGVydGllcy5oYXNPd25Qcm9wZXJ0eShwcm9wTmFtZSkpIHtcbiAgICAgICAgICAgIHZhciBwcm9wZXJ0eSA9IHByb3BlcnRpZXNbcHJvcE5hbWVdXG4gICAgICAgICAgICBpZiAoaXNWSG9vayhwcm9wZXJ0eSkgJiYgcHJvcGVydHkudW5ob29rKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFob29rcykge1xuICAgICAgICAgICAgICAgICAgICBob29rcyA9IHt9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaG9va3NbcHJvcE5hbWVdID0gcHJvcGVydHlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuICAgICAgICB2YXIgY2hpbGQgPSBjaGlsZHJlbltpXVxuICAgICAgICBpZiAoaXNWTm9kZShjaGlsZCkpIHtcbiAgICAgICAgICAgIGRlc2NlbmRhbnRzICs9IGNoaWxkLmNvdW50IHx8IDBcblxuICAgICAgICAgICAgaWYgKCFoYXNXaWRnZXRzICYmIGNoaWxkLmhhc1dpZGdldHMpIHtcbiAgICAgICAgICAgICAgICBoYXNXaWRnZXRzID0gdHJ1ZVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIWhhc1RodW5rcyAmJiBjaGlsZC5oYXNUaHVua3MpIHtcbiAgICAgICAgICAgICAgICBoYXNUaHVua3MgPSB0cnVlXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghZGVzY2VuZGFudEhvb2tzICYmIChjaGlsZC5ob29rcyB8fCBjaGlsZC5kZXNjZW5kYW50SG9va3MpKSB7XG4gICAgICAgICAgICAgICAgZGVzY2VuZGFudEhvb2tzID0gdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKCFoYXNXaWRnZXRzICYmIGlzV2lkZ2V0KGNoaWxkKSkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBjaGlsZC5kZXN0cm95ID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICBoYXNXaWRnZXRzID0gdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKCFoYXNUaHVua3MgJiYgaXNUaHVuayhjaGlsZCkpIHtcbiAgICAgICAgICAgIGhhc1RodW5rcyA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmNvdW50ID0gY291bnQgKyBkZXNjZW5kYW50c1xuICAgIHRoaXMuaGFzV2lkZ2V0cyA9IGhhc1dpZGdldHNcbiAgICB0aGlzLmhhc1RodW5rcyA9IGhhc1RodW5rc1xuICAgIHRoaXMuaG9va3MgPSBob29rc1xuICAgIHRoaXMuZGVzY2VuZGFudEhvb2tzID0gZGVzY2VuZGFudEhvb2tzXG59XG5cblZpcnR1YWxOb2RlLnByb3RvdHlwZS52ZXJzaW9uID0gdmVyc2lvblxuVmlydHVhbE5vZGUucHJvdG90eXBlLnR5cGUgPSBcIlZpcnR1YWxOb2RlXCJcbiIsInZhciB2ZXJzaW9uID0gcmVxdWlyZShcIi4vdmVyc2lvblwiKVxuXG5WaXJ0dWFsUGF0Y2guTk9ORSA9IDBcblZpcnR1YWxQYXRjaC5WVEVYVCA9IDFcblZpcnR1YWxQYXRjaC5WTk9ERSA9IDJcblZpcnR1YWxQYXRjaC5XSURHRVQgPSAzXG5WaXJ0dWFsUGF0Y2guUFJPUFMgPSA0XG5WaXJ0dWFsUGF0Y2guT1JERVIgPSA1XG5WaXJ0dWFsUGF0Y2guSU5TRVJUID0gNlxuVmlydHVhbFBhdGNoLlJFTU9WRSA9IDdcblZpcnR1YWxQYXRjaC5USFVOSyA9IDhcblxubW9kdWxlLmV4cG9ydHMgPSBWaXJ0dWFsUGF0Y2hcblxuZnVuY3Rpb24gVmlydHVhbFBhdGNoKHR5cGUsIHZOb2RlLCBwYXRjaCkge1xuICAgIHRoaXMudHlwZSA9IE51bWJlcih0eXBlKVxuICAgIHRoaXMudk5vZGUgPSB2Tm9kZVxuICAgIHRoaXMucGF0Y2ggPSBwYXRjaFxufVxuXG5WaXJ0dWFsUGF0Y2gucHJvdG90eXBlLnZlcnNpb24gPSB2ZXJzaW9uXG5WaXJ0dWFsUGF0Y2gucHJvdG90eXBlLnR5cGUgPSBcIlZpcnR1YWxQYXRjaFwiXG4iLCJ2YXIgdmVyc2lvbiA9IHJlcXVpcmUoXCIuL3ZlcnNpb25cIilcblxubW9kdWxlLmV4cG9ydHMgPSBWaXJ0dWFsVGV4dFxuXG5mdW5jdGlvbiBWaXJ0dWFsVGV4dCh0ZXh0KSB7XG4gICAgdGhpcy50ZXh0ID0gU3RyaW5nKHRleHQpXG59XG5cblZpcnR1YWxUZXh0LnByb3RvdHlwZS52ZXJzaW9uID0gdmVyc2lvblxuVmlydHVhbFRleHQucHJvdG90eXBlLnR5cGUgPSBcIlZpcnR1YWxUZXh0XCJcbiIsInZhciBpc09iamVjdCA9IHJlcXVpcmUoXCJpcy1vYmplY3RcIilcbnZhciBpc0hvb2sgPSByZXF1aXJlKFwiLi4vdm5vZGUvaXMtdmhvb2tcIilcblxubW9kdWxlLmV4cG9ydHMgPSBkaWZmUHJvcHNcblxuZnVuY3Rpb24gZGlmZlByb3BzKGEsIGIpIHtcbiAgICB2YXIgZGlmZlxuXG4gICAgZm9yICh2YXIgYUtleSBpbiBhKSB7XG4gICAgICAgIGlmICghKGFLZXkgaW4gYikpIHtcbiAgICAgICAgICAgIGRpZmYgPSBkaWZmIHx8IHt9XG4gICAgICAgICAgICBkaWZmW2FLZXldID0gdW5kZWZpbmVkXG4gICAgICAgIH1cblxuICAgICAgICB2YXIgYVZhbHVlID0gYVthS2V5XVxuICAgICAgICB2YXIgYlZhbHVlID0gYlthS2V5XVxuXG4gICAgICAgIGlmIChhVmFsdWUgPT09IGJWYWx1ZSkge1xuICAgICAgICAgICAgY29udGludWVcbiAgICAgICAgfSBlbHNlIGlmIChpc09iamVjdChhVmFsdWUpICYmIGlzT2JqZWN0KGJWYWx1ZSkpIHtcbiAgICAgICAgICAgIGlmIChnZXRQcm90b3R5cGUoYlZhbHVlKSAhPT0gZ2V0UHJvdG90eXBlKGFWYWx1ZSkpIHtcbiAgICAgICAgICAgICAgICBkaWZmID0gZGlmZiB8fCB7fVxuICAgICAgICAgICAgICAgIGRpZmZbYUtleV0gPSBiVmFsdWVcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNIb29rKGJWYWx1ZSkpIHtcbiAgICAgICAgICAgICAgICAgZGlmZiA9IGRpZmYgfHwge31cbiAgICAgICAgICAgICAgICAgZGlmZlthS2V5XSA9IGJWYWx1ZVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YXIgb2JqZWN0RGlmZiA9IGRpZmZQcm9wcyhhVmFsdWUsIGJWYWx1ZSlcbiAgICAgICAgICAgICAgICBpZiAob2JqZWN0RGlmZikge1xuICAgICAgICAgICAgICAgICAgICBkaWZmID0gZGlmZiB8fCB7fVxuICAgICAgICAgICAgICAgICAgICBkaWZmW2FLZXldID0gb2JqZWN0RGlmZlxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRpZmYgPSBkaWZmIHx8IHt9XG4gICAgICAgICAgICBkaWZmW2FLZXldID0gYlZhbHVlXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKHZhciBiS2V5IGluIGIpIHtcbiAgICAgICAgaWYgKCEoYktleSBpbiBhKSkge1xuICAgICAgICAgICAgZGlmZiA9IGRpZmYgfHwge31cbiAgICAgICAgICAgIGRpZmZbYktleV0gPSBiW2JLZXldXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZGlmZlxufVxuXG5mdW5jdGlvbiBnZXRQcm90b3R5cGUodmFsdWUpIHtcbiAgaWYgKE9iamVjdC5nZXRQcm90b3R5cGVPZikge1xuICAgIHJldHVybiBPYmplY3QuZ2V0UHJvdG90eXBlT2YodmFsdWUpXG4gIH0gZWxzZSBpZiAodmFsdWUuX19wcm90b19fKSB7XG4gICAgcmV0dXJuIHZhbHVlLl9fcHJvdG9fX1xuICB9IGVsc2UgaWYgKHZhbHVlLmNvbnN0cnVjdG9yKSB7XG4gICAgcmV0dXJuIHZhbHVlLmNvbnN0cnVjdG9yLnByb3RvdHlwZVxuICB9XG59XG4iLCJ2YXIgaXNBcnJheSA9IHJlcXVpcmUoXCJ4LWlzLWFycmF5XCIpXG5cbnZhciBWUGF0Y2ggPSByZXF1aXJlKFwiLi4vdm5vZGUvdnBhdGNoXCIpXG52YXIgaXNWTm9kZSA9IHJlcXVpcmUoXCIuLi92bm9kZS9pcy12bm9kZVwiKVxudmFyIGlzVlRleHQgPSByZXF1aXJlKFwiLi4vdm5vZGUvaXMtdnRleHRcIilcbnZhciBpc1dpZGdldCA9IHJlcXVpcmUoXCIuLi92bm9kZS9pcy13aWRnZXRcIilcbnZhciBpc1RodW5rID0gcmVxdWlyZShcIi4uL3Zub2RlL2lzLXRodW5rXCIpXG52YXIgaGFuZGxlVGh1bmsgPSByZXF1aXJlKFwiLi4vdm5vZGUvaGFuZGxlLXRodW5rXCIpXG5cbnZhciBkaWZmUHJvcHMgPSByZXF1aXJlKFwiLi9kaWZmLXByb3BzXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gZGlmZlxuXG5mdW5jdGlvbiBkaWZmKGEsIGIpIHtcbiAgICB2YXIgcGF0Y2ggPSB7IGE6IGEgfVxuICAgIHdhbGsoYSwgYiwgcGF0Y2gsIDApXG4gICAgcmV0dXJuIHBhdGNoXG59XG5cbmZ1bmN0aW9uIHdhbGsoYSwgYiwgcGF0Y2gsIGluZGV4KSB7XG4gICAgaWYgKGEgPT09IGIpIHtcbiAgICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgdmFyIGFwcGx5ID0gcGF0Y2hbaW5kZXhdXG4gICAgdmFyIGFwcGx5Q2xlYXIgPSBmYWxzZVxuXG4gICAgaWYgKGlzVGh1bmsoYSkgfHwgaXNUaHVuayhiKSkge1xuICAgICAgICB0aHVua3MoYSwgYiwgcGF0Y2gsIGluZGV4KVxuICAgIH0gZWxzZSBpZiAoYiA9PSBudWxsKSB7XG5cbiAgICAgICAgLy8gSWYgYSBpcyBhIHdpZGdldCB3ZSB3aWxsIGFkZCBhIHJlbW92ZSBwYXRjaCBmb3IgaXRcbiAgICAgICAgLy8gT3RoZXJ3aXNlIGFueSBjaGlsZCB3aWRnZXRzL2hvb2tzIG11c3QgYmUgZGVzdHJveWVkLlxuICAgICAgICAvLyBUaGlzIHByZXZlbnRzIGFkZGluZyB0d28gcmVtb3ZlIHBhdGNoZXMgZm9yIGEgd2lkZ2V0LlxuICAgICAgICBpZiAoIWlzV2lkZ2V0KGEpKSB7XG4gICAgICAgICAgICBjbGVhclN0YXRlKGEsIHBhdGNoLCBpbmRleClcbiAgICAgICAgICAgIGFwcGx5ID0gcGF0Y2hbaW5kZXhdXG4gICAgICAgIH1cblxuICAgICAgICBhcHBseSA9IGFwcGVuZFBhdGNoKGFwcGx5LCBuZXcgVlBhdGNoKFZQYXRjaC5SRU1PVkUsIGEsIGIpKVxuICAgIH0gZWxzZSBpZiAoaXNWTm9kZShiKSkge1xuICAgICAgICBpZiAoaXNWTm9kZShhKSkge1xuICAgICAgICAgICAgaWYgKGEudGFnTmFtZSA9PT0gYi50YWdOYW1lICYmXG4gICAgICAgICAgICAgICAgYS5uYW1lc3BhY2UgPT09IGIubmFtZXNwYWNlICYmXG4gICAgICAgICAgICAgICAgYS5rZXkgPT09IGIua2V5KSB7XG4gICAgICAgICAgICAgICAgdmFyIHByb3BzUGF0Y2ggPSBkaWZmUHJvcHMoYS5wcm9wZXJ0aWVzLCBiLnByb3BlcnRpZXMpXG4gICAgICAgICAgICAgICAgaWYgKHByb3BzUGF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgYXBwbHkgPSBhcHBlbmRQYXRjaChhcHBseSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBWUGF0Y2goVlBhdGNoLlBST1BTLCBhLCBwcm9wc1BhdGNoKSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYXBwbHkgPSBkaWZmQ2hpbGRyZW4oYSwgYiwgcGF0Y2gsIGFwcGx5LCBpbmRleClcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYXBwbHkgPSBhcHBlbmRQYXRjaChhcHBseSwgbmV3IFZQYXRjaChWUGF0Y2guVk5PREUsIGEsIGIpKVxuICAgICAgICAgICAgICAgIGFwcGx5Q2xlYXIgPSB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhcHBseSA9IGFwcGVuZFBhdGNoKGFwcGx5LCBuZXcgVlBhdGNoKFZQYXRjaC5WTk9ERSwgYSwgYikpXG4gICAgICAgICAgICBhcHBseUNsZWFyID0gdHJ1ZVxuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChpc1ZUZXh0KGIpKSB7XG4gICAgICAgIGlmICghaXNWVGV4dChhKSkge1xuICAgICAgICAgICAgYXBwbHkgPSBhcHBlbmRQYXRjaChhcHBseSwgbmV3IFZQYXRjaChWUGF0Y2guVlRFWFQsIGEsIGIpKVxuICAgICAgICAgICAgYXBwbHlDbGVhciA9IHRydWVcbiAgICAgICAgfSBlbHNlIGlmIChhLnRleHQgIT09IGIudGV4dCkge1xuICAgICAgICAgICAgYXBwbHkgPSBhcHBlbmRQYXRjaChhcHBseSwgbmV3IFZQYXRjaChWUGF0Y2guVlRFWFQsIGEsIGIpKVxuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChpc1dpZGdldChiKSkge1xuICAgICAgICBpZiAoIWlzV2lkZ2V0KGEpKSB7XG4gICAgICAgICAgICBhcHBseUNsZWFyID0gdHJ1ZVxuICAgICAgICB9XG5cbiAgICAgICAgYXBwbHkgPSBhcHBlbmRQYXRjaChhcHBseSwgbmV3IFZQYXRjaChWUGF0Y2guV0lER0VULCBhLCBiKSlcbiAgICB9XG5cbiAgICBpZiAoYXBwbHkpIHtcbiAgICAgICAgcGF0Y2hbaW5kZXhdID0gYXBwbHlcbiAgICB9XG5cbiAgICBpZiAoYXBwbHlDbGVhcikge1xuICAgICAgICBjbGVhclN0YXRlKGEsIHBhdGNoLCBpbmRleClcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRpZmZDaGlsZHJlbihhLCBiLCBwYXRjaCwgYXBwbHksIGluZGV4KSB7XG4gICAgdmFyIGFDaGlsZHJlbiA9IGEuY2hpbGRyZW5cbiAgICB2YXIgb3JkZXJlZFNldCA9IHJlb3JkZXIoYUNoaWxkcmVuLCBiLmNoaWxkcmVuKVxuICAgIHZhciBiQ2hpbGRyZW4gPSBvcmRlcmVkU2V0LmNoaWxkcmVuXG5cbiAgICB2YXIgYUxlbiA9IGFDaGlsZHJlbi5sZW5ndGhcbiAgICB2YXIgYkxlbiA9IGJDaGlsZHJlbi5sZW5ndGhcbiAgICB2YXIgbGVuID0gYUxlbiA+IGJMZW4gPyBhTGVuIDogYkxlblxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICB2YXIgbGVmdE5vZGUgPSBhQ2hpbGRyZW5baV1cbiAgICAgICAgdmFyIHJpZ2h0Tm9kZSA9IGJDaGlsZHJlbltpXVxuICAgICAgICBpbmRleCArPSAxXG5cbiAgICAgICAgaWYgKCFsZWZ0Tm9kZSkge1xuICAgICAgICAgICAgaWYgKHJpZ2h0Tm9kZSkge1xuICAgICAgICAgICAgICAgIC8vIEV4Y2VzcyBub2RlcyBpbiBiIG5lZWQgdG8gYmUgYWRkZWRcbiAgICAgICAgICAgICAgICBhcHBseSA9IGFwcGVuZFBhdGNoKGFwcGx5LFxuICAgICAgICAgICAgICAgICAgICBuZXcgVlBhdGNoKFZQYXRjaC5JTlNFUlQsIG51bGwsIHJpZ2h0Tm9kZSkpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB3YWxrKGxlZnROb2RlLCByaWdodE5vZGUsIHBhdGNoLCBpbmRleClcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpc1ZOb2RlKGxlZnROb2RlKSAmJiBsZWZ0Tm9kZS5jb3VudCkge1xuICAgICAgICAgICAgaW5kZXggKz0gbGVmdE5vZGUuY291bnRcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChvcmRlcmVkU2V0Lm1vdmVzKSB7XG4gICAgICAgIC8vIFJlb3JkZXIgbm9kZXMgbGFzdFxuICAgICAgICBhcHBseSA9IGFwcGVuZFBhdGNoKGFwcGx5LCBuZXcgVlBhdGNoKFxuICAgICAgICAgICAgVlBhdGNoLk9SREVSLFxuICAgICAgICAgICAgYSxcbiAgICAgICAgICAgIG9yZGVyZWRTZXQubW92ZXNcbiAgICAgICAgKSlcbiAgICB9XG5cbiAgICByZXR1cm4gYXBwbHlcbn1cblxuZnVuY3Rpb24gY2xlYXJTdGF0ZSh2Tm9kZSwgcGF0Y2gsIGluZGV4KSB7XG4gICAgLy8gVE9ETzogTWFrZSB0aGlzIGEgc2luZ2xlIHdhbGssIG5vdCB0d29cbiAgICB1bmhvb2sodk5vZGUsIHBhdGNoLCBpbmRleClcbiAgICBkZXN0cm95V2lkZ2V0cyh2Tm9kZSwgcGF0Y2gsIGluZGV4KVxufVxuXG4vLyBQYXRjaCByZWNvcmRzIGZvciBhbGwgZGVzdHJveWVkIHdpZGdldHMgbXVzdCBiZSBhZGRlZCBiZWNhdXNlIHdlIG5lZWRcbi8vIGEgRE9NIG5vZGUgcmVmZXJlbmNlIGZvciB0aGUgZGVzdHJveSBmdW5jdGlvblxuZnVuY3Rpb24gZGVzdHJveVdpZGdldHModk5vZGUsIHBhdGNoLCBpbmRleCkge1xuICAgIGlmIChpc1dpZGdldCh2Tm9kZSkpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB2Tm9kZS5kZXN0cm95ID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgIHBhdGNoW2luZGV4XSA9IGFwcGVuZFBhdGNoKFxuICAgICAgICAgICAgICAgIHBhdGNoW2luZGV4XSxcbiAgICAgICAgICAgICAgICBuZXcgVlBhdGNoKFZQYXRjaC5SRU1PVkUsIHZOb2RlLCBudWxsKVxuICAgICAgICAgICAgKVxuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChpc1ZOb2RlKHZOb2RlKSAmJiAodk5vZGUuaGFzV2lkZ2V0cyB8fCB2Tm9kZS5oYXNUaHVua3MpKSB7XG4gICAgICAgIHZhciBjaGlsZHJlbiA9IHZOb2RlLmNoaWxkcmVuXG4gICAgICAgIHZhciBsZW4gPSBjaGlsZHJlbi5sZW5ndGhcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgdmFyIGNoaWxkID0gY2hpbGRyZW5baV1cbiAgICAgICAgICAgIGluZGV4ICs9IDFcblxuICAgICAgICAgICAgZGVzdHJveVdpZGdldHMoY2hpbGQsIHBhdGNoLCBpbmRleClcblxuICAgICAgICAgICAgaWYgKGlzVk5vZGUoY2hpbGQpICYmIGNoaWxkLmNvdW50KSB7XG4gICAgICAgICAgICAgICAgaW5kZXggKz0gY2hpbGQuY291bnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaXNUaHVuayh2Tm9kZSkpIHtcbiAgICAgICAgdGh1bmtzKHZOb2RlLCBudWxsLCBwYXRjaCwgaW5kZXgpXG4gICAgfVxufVxuXG4vLyBDcmVhdGUgYSBzdWItcGF0Y2ggZm9yIHRodW5rc1xuZnVuY3Rpb24gdGh1bmtzKGEsIGIsIHBhdGNoLCBpbmRleCkge1xuICAgIHZhciBub2RlcyA9IGhhbmRsZVRodW5rKGEsIGIpXG4gICAgdmFyIHRodW5rUGF0Y2ggPSBkaWZmKG5vZGVzLmEsIG5vZGVzLmIpXG4gICAgaWYgKGhhc1BhdGNoZXModGh1bmtQYXRjaCkpIHtcbiAgICAgICAgcGF0Y2hbaW5kZXhdID0gbmV3IFZQYXRjaChWUGF0Y2guVEhVTkssIG51bGwsIHRodW5rUGF0Y2gpXG4gICAgfVxufVxuXG5mdW5jdGlvbiBoYXNQYXRjaGVzKHBhdGNoKSB7XG4gICAgZm9yICh2YXIgaW5kZXggaW4gcGF0Y2gpIHtcbiAgICAgICAgaWYgKGluZGV4ICE9PSBcImFcIikge1xuICAgICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmYWxzZVxufVxuXG4vLyBFeGVjdXRlIGhvb2tzIHdoZW4gdHdvIG5vZGVzIGFyZSBpZGVudGljYWxcbmZ1bmN0aW9uIHVuaG9vayh2Tm9kZSwgcGF0Y2gsIGluZGV4KSB7XG4gICAgaWYgKGlzVk5vZGUodk5vZGUpKSB7XG4gICAgICAgIGlmICh2Tm9kZS5ob29rcykge1xuICAgICAgICAgICAgcGF0Y2hbaW5kZXhdID0gYXBwZW5kUGF0Y2goXG4gICAgICAgICAgICAgICAgcGF0Y2hbaW5kZXhdLFxuICAgICAgICAgICAgICAgIG5ldyBWUGF0Y2goXG4gICAgICAgICAgICAgICAgICAgIFZQYXRjaC5QUk9QUyxcbiAgICAgICAgICAgICAgICAgICAgdk5vZGUsXG4gICAgICAgICAgICAgICAgICAgIHVuZGVmaW5lZEtleXModk5vZGUuaG9va3MpXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgKVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHZOb2RlLmRlc2NlbmRhbnRIb29rcyB8fCB2Tm9kZS5oYXNUaHVua3MpIHtcbiAgICAgICAgICAgIHZhciBjaGlsZHJlbiA9IHZOb2RlLmNoaWxkcmVuXG4gICAgICAgICAgICB2YXIgbGVuID0gY2hpbGRyZW4ubGVuZ3RoXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIGNoaWxkID0gY2hpbGRyZW5baV1cbiAgICAgICAgICAgICAgICBpbmRleCArPSAxXG5cbiAgICAgICAgICAgICAgICB1bmhvb2soY2hpbGQsIHBhdGNoLCBpbmRleClcblxuICAgICAgICAgICAgICAgIGlmIChpc1ZOb2RlKGNoaWxkKSAmJiBjaGlsZC5jb3VudCkge1xuICAgICAgICAgICAgICAgICAgICBpbmRleCArPSBjaGlsZC5jb3VudFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaXNUaHVuayh2Tm9kZSkpIHtcbiAgICAgICAgdGh1bmtzKHZOb2RlLCBudWxsLCBwYXRjaCwgaW5kZXgpXG4gICAgfVxufVxuXG5mdW5jdGlvbiB1bmRlZmluZWRLZXlzKG9iaikge1xuICAgIHZhciByZXN1bHQgPSB7fVxuXG4gICAgZm9yICh2YXIga2V5IGluIG9iaikge1xuICAgICAgICByZXN1bHRba2V5XSA9IHVuZGVmaW5lZFxuICAgIH1cblxuICAgIHJldHVybiByZXN1bHRcbn1cblxuLy8gTGlzdCBkaWZmLCBuYWl2ZSBsZWZ0IHRvIHJpZ2h0IHJlb3JkZXJpbmdcbmZ1bmN0aW9uIHJlb3JkZXIoYUNoaWxkcmVuLCBiQ2hpbGRyZW4pIHtcbiAgICAvLyBPKE0pIHRpbWUsIE8oTSkgbWVtb3J5XG4gICAgdmFyIGJDaGlsZEluZGV4ID0ga2V5SW5kZXgoYkNoaWxkcmVuKVxuICAgIHZhciBiS2V5cyA9IGJDaGlsZEluZGV4LmtleXNcbiAgICB2YXIgYkZyZWUgPSBiQ2hpbGRJbmRleC5mcmVlXG5cbiAgICBpZiAoYkZyZWUubGVuZ3RoID09PSBiQ2hpbGRyZW4ubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBjaGlsZHJlbjogYkNoaWxkcmVuLFxuICAgICAgICAgICAgbW92ZXM6IG51bGxcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIE8oTikgdGltZSwgTyhOKSBtZW1vcnlcbiAgICB2YXIgYUNoaWxkSW5kZXggPSBrZXlJbmRleChhQ2hpbGRyZW4pXG4gICAgdmFyIGFLZXlzID0gYUNoaWxkSW5kZXgua2V5c1xuICAgIHZhciBhRnJlZSA9IGFDaGlsZEluZGV4LmZyZWVcblxuICAgIGlmIChhRnJlZS5sZW5ndGggPT09IGFDaGlsZHJlbi5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGNoaWxkcmVuOiBiQ2hpbGRyZW4sXG4gICAgICAgICAgICBtb3ZlczogbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gTyhNQVgoTiwgTSkpIG1lbW9yeVxuICAgIHZhciBuZXdDaGlsZHJlbiA9IFtdXG5cbiAgICB2YXIgZnJlZUluZGV4ID0gMFxuICAgIHZhciBmcmVlQ291bnQgPSBiRnJlZS5sZW5ndGhcbiAgICB2YXIgZGVsZXRlZEl0ZW1zID0gMFxuXG4gICAgLy8gSXRlcmF0ZSB0aHJvdWdoIGEgYW5kIG1hdGNoIGEgbm9kZSBpbiBiXG4gICAgLy8gTyhOKSB0aW1lLFxuICAgIGZvciAodmFyIGkgPSAwIDsgaSA8IGFDaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgYUl0ZW0gPSBhQ2hpbGRyZW5baV1cbiAgICAgICAgdmFyIGl0ZW1JbmRleFxuXG4gICAgICAgIGlmIChhSXRlbS5rZXkpIHtcbiAgICAgICAgICAgIGlmIChiS2V5cy5oYXNPd25Qcm9wZXJ0eShhSXRlbS5rZXkpKSB7XG4gICAgICAgICAgICAgICAgLy8gTWF0Y2ggdXAgdGhlIG9sZCBrZXlzXG4gICAgICAgICAgICAgICAgaXRlbUluZGV4ID0gYktleXNbYUl0ZW0ua2V5XVxuICAgICAgICAgICAgICAgIG5ld0NoaWxkcmVuLnB1c2goYkNoaWxkcmVuW2l0ZW1JbmRleF0pXG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gUmVtb3ZlIG9sZCBrZXllZCBpdGVtc1xuICAgICAgICAgICAgICAgIGl0ZW1JbmRleCA9IGkgLSBkZWxldGVkSXRlbXMrK1xuICAgICAgICAgICAgICAgIG5ld0NoaWxkcmVuLnB1c2gobnVsbClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIE1hdGNoIHRoZSBpdGVtIGluIGEgd2l0aCB0aGUgbmV4dCBmcmVlIGl0ZW0gaW4gYlxuICAgICAgICAgICAgaWYgKGZyZWVJbmRleCA8IGZyZWVDb3VudCkge1xuICAgICAgICAgICAgICAgIGl0ZW1JbmRleCA9IGJGcmVlW2ZyZWVJbmRleCsrXVxuICAgICAgICAgICAgICAgIG5ld0NoaWxkcmVuLnB1c2goYkNoaWxkcmVuW2l0ZW1JbmRleF0pXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIFRoZXJlIGFyZSBubyBmcmVlIGl0ZW1zIGluIGIgdG8gbWF0Y2ggd2l0aFxuICAgICAgICAgICAgICAgIC8vIHRoZSBmcmVlIGl0ZW1zIGluIGEsIHNvIHRoZSBleHRyYSBmcmVlIG5vZGVzXG4gICAgICAgICAgICAgICAgLy8gYXJlIGRlbGV0ZWQuXG4gICAgICAgICAgICAgICAgaXRlbUluZGV4ID0gaSAtIGRlbGV0ZWRJdGVtcysrXG4gICAgICAgICAgICAgICAgbmV3Q2hpbGRyZW4ucHVzaChudWxsKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGxhc3RGcmVlSW5kZXggPSBmcmVlSW5kZXggPj0gYkZyZWUubGVuZ3RoID9cbiAgICAgICAgYkNoaWxkcmVuLmxlbmd0aCA6XG4gICAgICAgIGJGcmVlW2ZyZWVJbmRleF1cblxuICAgIC8vIEl0ZXJhdGUgdGhyb3VnaCBiIGFuZCBhcHBlbmQgYW55IG5ldyBrZXlzXG4gICAgLy8gTyhNKSB0aW1lXG4gICAgZm9yICh2YXIgaiA9IDA7IGogPCBiQ2hpbGRyZW4ubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgdmFyIG5ld0l0ZW0gPSBiQ2hpbGRyZW5bal1cblxuICAgICAgICBpZiAobmV3SXRlbS5rZXkpIHtcbiAgICAgICAgICAgIGlmICghYUtleXMuaGFzT3duUHJvcGVydHkobmV3SXRlbS5rZXkpKSB7XG4gICAgICAgICAgICAgICAgLy8gQWRkIGFueSBuZXcga2V5ZWQgaXRlbXNcbiAgICAgICAgICAgICAgICAvLyBXZSBhcmUgYWRkaW5nIG5ldyBpdGVtcyB0byB0aGUgZW5kIGFuZCB0aGVuIHNvcnRpbmcgdGhlbVxuICAgICAgICAgICAgICAgIC8vIGluIHBsYWNlLiBJbiBmdXR1cmUgd2Ugc2hvdWxkIGluc2VydCBuZXcgaXRlbXMgaW4gcGxhY2UuXG4gICAgICAgICAgICAgICAgbmV3Q2hpbGRyZW4ucHVzaChuZXdJdGVtKVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGogPj0gbGFzdEZyZWVJbmRleCkge1xuICAgICAgICAgICAgLy8gQWRkIGFueSBsZWZ0b3ZlciBub24ta2V5ZWQgaXRlbXNcbiAgICAgICAgICAgIG5ld0NoaWxkcmVuLnB1c2gobmV3SXRlbSlcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHZhciBzaW11bGF0ZSA9IG5ld0NoaWxkcmVuLnNsaWNlKClcbiAgICB2YXIgc2ltdWxhdGVJbmRleCA9IDBcbiAgICB2YXIgcmVtb3ZlcyA9IFtdXG4gICAgdmFyIGluc2VydHMgPSBbXVxuICAgIHZhciBzaW11bGF0ZUl0ZW1cblxuICAgIGZvciAodmFyIGsgPSAwOyBrIDwgYkNoaWxkcmVuLmxlbmd0aDspIHtcbiAgICAgICAgdmFyIHdhbnRlZEl0ZW0gPSBiQ2hpbGRyZW5ba11cbiAgICAgICAgc2ltdWxhdGVJdGVtID0gc2ltdWxhdGVbc2ltdWxhdGVJbmRleF1cblxuICAgICAgICAvLyByZW1vdmUgaXRlbXNcbiAgICAgICAgd2hpbGUgKHNpbXVsYXRlSXRlbSA9PT0gbnVsbCAmJiBzaW11bGF0ZS5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJlbW92ZXMucHVzaChyZW1vdmUoc2ltdWxhdGUsIHNpbXVsYXRlSW5kZXgsIG51bGwpKVxuICAgICAgICAgICAgc2ltdWxhdGVJdGVtID0gc2ltdWxhdGVbc2ltdWxhdGVJbmRleF1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghc2ltdWxhdGVJdGVtIHx8IHNpbXVsYXRlSXRlbS5rZXkgIT09IHdhbnRlZEl0ZW0ua2V5KSB7XG4gICAgICAgICAgICAvLyBpZiB3ZSBuZWVkIGEga2V5IGluIHRoaXMgcG9zaXRpb24uLi5cbiAgICAgICAgICAgIGlmICh3YW50ZWRJdGVtLmtleSkge1xuICAgICAgICAgICAgICAgIGlmIChzaW11bGF0ZUl0ZW0gJiYgc2ltdWxhdGVJdGVtLmtleSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBpZiBhbiBpbnNlcnQgZG9lc24ndCBwdXQgdGhpcyBrZXkgaW4gcGxhY2UsIGl0IG5lZWRzIHRvIG1vdmVcbiAgICAgICAgICAgICAgICAgICAgaWYgKGJLZXlzW3NpbXVsYXRlSXRlbS5rZXldICE9PSBrICsgMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3Zlcy5wdXNoKHJlbW92ZShzaW11bGF0ZSwgc2ltdWxhdGVJbmRleCwgc2ltdWxhdGVJdGVtLmtleSkpXG4gICAgICAgICAgICAgICAgICAgICAgICBzaW11bGF0ZUl0ZW0gPSBzaW11bGF0ZVtzaW11bGF0ZUluZGV4XVxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gaWYgdGhlIHJlbW92ZSBkaWRuJ3QgcHV0IHRoZSB3YW50ZWQgaXRlbSBpbiBwbGFjZSwgd2UgbmVlZCB0byBpbnNlcnQgaXRcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghc2ltdWxhdGVJdGVtIHx8IHNpbXVsYXRlSXRlbS5rZXkgIT09IHdhbnRlZEl0ZW0ua2V5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5zZXJ0cy5wdXNoKHtrZXk6IHdhbnRlZEl0ZW0ua2V5LCB0bzoga30pXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBpdGVtcyBhcmUgbWF0Y2hpbmcsIHNvIHNraXAgYWhlYWRcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNpbXVsYXRlSW5kZXgrK1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgaW5zZXJ0cy5wdXNoKHtrZXk6IHdhbnRlZEl0ZW0ua2V5LCB0bzoga30pXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGluc2VydHMucHVzaCh7a2V5OiB3YW50ZWRJdGVtLmtleSwgdG86IGt9KVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBrKytcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIGEga2V5IGluIHNpbXVsYXRlIGhhcyBubyBtYXRjaGluZyB3YW50ZWQga2V5LCByZW1vdmUgaXRcbiAgICAgICAgICAgIGVsc2UgaWYgKHNpbXVsYXRlSXRlbSAmJiBzaW11bGF0ZUl0ZW0ua2V5KSB7XG4gICAgICAgICAgICAgICAgcmVtb3Zlcy5wdXNoKHJlbW92ZShzaW11bGF0ZSwgc2ltdWxhdGVJbmRleCwgc2ltdWxhdGVJdGVtLmtleSkpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBzaW11bGF0ZUluZGV4KytcbiAgICAgICAgICAgIGsrK1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gcmVtb3ZlIGFsbCB0aGUgcmVtYWluaW5nIG5vZGVzIGZyb20gc2ltdWxhdGVcbiAgICB3aGlsZShzaW11bGF0ZUluZGV4IDwgc2ltdWxhdGUubGVuZ3RoKSB7XG4gICAgICAgIHNpbXVsYXRlSXRlbSA9IHNpbXVsYXRlW3NpbXVsYXRlSW5kZXhdXG4gICAgICAgIHJlbW92ZXMucHVzaChyZW1vdmUoc2ltdWxhdGUsIHNpbXVsYXRlSW5kZXgsIHNpbXVsYXRlSXRlbSAmJiBzaW11bGF0ZUl0ZW0ua2V5KSlcbiAgICB9XG5cbiAgICAvLyBJZiB0aGUgb25seSBtb3ZlcyB3ZSBoYXZlIGFyZSBkZWxldGVzIHRoZW4gd2UgY2FuIGp1c3RcbiAgICAvLyBsZXQgdGhlIGRlbGV0ZSBwYXRjaCByZW1vdmUgdGhlc2UgaXRlbXMuXG4gICAgaWYgKHJlbW92ZXMubGVuZ3RoID09PSBkZWxldGVkSXRlbXMgJiYgIWluc2VydHMubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBjaGlsZHJlbjogbmV3Q2hpbGRyZW4sXG4gICAgICAgICAgICBtb3ZlczogbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgY2hpbGRyZW46IG5ld0NoaWxkcmVuLFxuICAgICAgICBtb3Zlczoge1xuICAgICAgICAgICAgcmVtb3ZlczogcmVtb3ZlcyxcbiAgICAgICAgICAgIGluc2VydHM6IGluc2VydHNcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gcmVtb3ZlKGFyciwgaW5kZXgsIGtleSkge1xuICAgIGFyci5zcGxpY2UoaW5kZXgsIDEpXG5cbiAgICByZXR1cm4ge1xuICAgICAgICBmcm9tOiBpbmRleCxcbiAgICAgICAga2V5OiBrZXlcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGtleUluZGV4KGNoaWxkcmVuKSB7XG4gICAgdmFyIGtleXMgPSB7fVxuICAgIHZhciBmcmVlID0gW11cbiAgICB2YXIgbGVuZ3RoID0gY2hpbGRyZW4ubGVuZ3RoXG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBjaGlsZCA9IGNoaWxkcmVuW2ldXG5cbiAgICAgICAgaWYgKGNoaWxkLmtleSkge1xuICAgICAgICAgICAga2V5c1tjaGlsZC5rZXldID0gaVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZnJlZS5wdXNoKGkpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBrZXlzOiBrZXlzLCAgICAgLy8gQSBoYXNoIG9mIGtleSBuYW1lIHRvIGluZGV4XG4gICAgICAgIGZyZWU6IGZyZWUgICAgICAvLyBBbiBhcnJheSBvZiB1bmtleWVkIGl0ZW0gaW5kaWNlc1xuICAgIH1cbn1cblxuZnVuY3Rpb24gYXBwZW5kUGF0Y2goYXBwbHksIHBhdGNoKSB7XG4gICAgaWYgKGFwcGx5KSB7XG4gICAgICAgIGlmIChpc0FycmF5KGFwcGx5KSkge1xuICAgICAgICAgICAgYXBwbHkucHVzaChwYXRjaClcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFwcGx5ID0gW2FwcGx5LCBwYXRjaF1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBhcHBseVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBwYXRjaFxuICAgIH1cbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIHRoZSBib3VuZCB3cmFwcGVyIGZ1bmN0aW9uXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIDxwcmU+PGNvZGU+XG4gICAgICogdmFyIGFkZCA9IGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICogICAgIHJldHVybiBhICsgYjtcbiAgICAgKiB9O1xuICAgICAqXG4gICAgICogdmFyIHN1YiA9IGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICogICAgIHJldHVybiBhIC0gYjtcbiAgICAgKiB9O1xuICAgICAqXG4gICAgICogdmFyIGFkZE9uZSA9IGRlbGlnYXJlKGFkZCwgWzFdKTtcbiAgICAgKiB2YXIgc3ViVHdvID0gZGVsaWdhcmUoc3ViLCBbdW5kZWZpbmVkLCAyXSk7XG4gICAgICpcbiAgICAgKiBhZGRPbmUoNSk7IC8vIC0+IDYgKGVxdWl2YWxlbnQgdG8gXCJhZGQoMSwgNSlcIilcbiAgICAgKiBzdWJUd28oNSk7IC8vIC0+IDMgKGVxdWl2YWxlbnQgdG8gXCJzdWIoNSwgMilcIilcbiAgICAgKiA8L2NvZGU+PC9wcmU+XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmbiBSZXF1aXJlZC4gVGhlIG9yaWdpbmFsIGZ1bmN0aW9uXG4gICAgICogQHBhcmFtIHtBcnJheX0gZGVsZWdhdGVWYWx1ZXMgUmVxdWlyZWQuIFRoZSBsaXN0IG9mIHBhcmFtZXRlciB2YWx1ZXMgd2hpY2hcbiAgICAgKiAgICAgIHNob3VsZCBiZSBib3VuZCB0byB0aGUgbmV3IGZ1bmN0aW9uLiBJdCBpcyBwb3NzaWJsZSB0byBza2lwIHBhcmFtZXRlclxuICAgICAqICAgICAgd2hlbiBwYXNzaW5nIFwidW5kZWZpbmVkXCIgKGUuZy4gZGVsaWdhcmUoZm4sIFt1bmRlZmluZWQsICdmb28nXSlcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW3Njb3BlXSBPcHRpb25hbC4gVGhlIGV4ZWN1dGlvbiBjb250ZXh0IGZvciB0aGUgYm91bmQgd3JhcHBlclxuICAgICAqXG4gICAgICogQHJldHVybiB7RnVuY3Rpb259IFRoZSBib3VuZCB3cmFwcGVyIGZ1bmN0aW9uXG4gICAgICovXG4gICAgcmV0dXJuIGZ1bmN0aW9uIGRlbGlnYXJlIChmbiwgZGVsZWdhdGVWYWx1ZXMsIHNjb3BlKSB7XG4gICAgICAgIGlmICh0eXBlb2YgZm4gIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHRocm93ICdJbnZhbGlkIDFzdCBhcmd1bWVudDogXCInICsgdHlwZW9mIGZuICsgJ1wiLCBmdW5jdGlvbiBleHBlY3RlZCEnO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KGRlbGVnYXRlVmFsdWVzKSkge1xuICAgICAgICAgICAgdGhyb3cgJ0ludmFsaWQgMm5kIGFyZ3VtZW50OiBcIicgKyB0eXBlb2YgZGVsZWdhdGVWYWx1ZXMgKyAnXCIsIGFycmF5IGV4cGVjdGVkISc7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgYXJpdHkgPSBmbi5hcml0eSA+PSAwID8gZm4uYXJpdHkgOiBmbi5sZW5ndGg7XG4gICAgICAgIHZhciBtYXAgPSBbXTtcbiAgICAgICAgdmFyIGlkeCA9IDA7XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBhcml0eTsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgdmFyIHZhbCA9IGRlbGVnYXRlVmFsdWVzW2ldO1xuXG4gICAgICAgICAgICBpZiAodmFsID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBtYXBbaV0gPSBpZHgrKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHZhciB3cmFwcGVyID0gZnVuY3Rpb24gZGVsZWdhcmVXcmFwcGVyKCkge1xuICAgICAgICAgICAgdmFyIGFyZ3MgPSBbXTtcblxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBhcml0eTsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciB2YWwgPSBkZWxlZ2F0ZVZhbHVlc1tpXTtcblxuICAgICAgICAgICAgICAgIGlmICh2YWwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBhcmdzW2ldID0gYXJndW1lbnRzW21hcFtpXV07XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgYXJnc1tpXSA9IHZhbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBmbi5hcHBseShzY29wZSB8fCB0aGlzLCBhcmdzKTtcbiAgICAgICAgfTtcblxuICAgICAgICB3cmFwcGVyLmFyaXR5ID0gYXJpdHk7XG5cbiAgICAgICAgcmV0dXJuIHdyYXBwZXI7XG4gICAgfTtcbn0oKSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIGVhY2ggPSByZXF1aXJlKCdwcm8tc2luZ3VsaXMnKTtcbiAgICB2YXIgZGVsZWdhdGUgPSByZXF1aXJlKCdkZWxpZ2FyZScpO1xuXG4gICAgLyoqXG4gICAgICogQGNsYXNzIEZvcm11bGFcbiAgICAgKi9cbiAgICB2YXIgRm9ybXVsYSA9IGZ1bmN0aW9uIChjZmcpIHtcbiAgICAgICAgdmFyIG9yZ0N0b3IgPSBjZmcuYmFzZS5jb25zdHJ1Y3RvcjtcbiAgICAgICAgdmFyIGluaXQgPSBkZWxlZ2F0ZShlYWNoLCBbY2ZnLm9uQnJld1NjcmlwdHMsIGNhbGxGbl0pO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBIGxpc3Qgb2YgY2FsbGJhY2sgZnVuY3Rpb25zIHdoaWNoIHNob3VsZCBiZSBjYWxsZWRcbiAgICAgICAgICogd2hlbiBicmV3aW5nIGEgbmV3IHBvdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBAbmFtZSBvbkJyZXdTY3JpcHRzXG4gICAgICAgICAqIEBtZW1iZXJPZiBGb3JtdWxhXG4gICAgICAgICAqIEB0eXBlIEFycmF5XG4gICAgICAgICAqIEBwcm9wZXJ0eVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5vbkJyZXdTY3JpcHRzID0gY2ZnLm9uQnJld1NjcmlwdHM7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEEgbGlzdCBvZiBjYWxsYmFjayBmdW5jdGlvbnMgd2hpY2ggc2hvdWxkIGJlIGNhbGxlZFxuICAgICAgICAgKiB3aGVuIGRpc3Bvc2luZyB0aGUgcG90aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEBuYW1lIG9uRGlzcG9zZVNjcmlwdHNcbiAgICAgICAgICogQG1lbWJlck9mIEZvcm11bGFcbiAgICAgICAgICogQHR5cGUgQXJyYXlcbiAgICAgICAgICogQHByb3BlcnR5XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm9uRGlzcG9zZVNjcmlwdHMgPSBjZmcub25EaXNwb3NlU2NyaXB0cztcblxuICAgICAgICB0aGlzLkN0b3IgPSBmdW5jdGlvbiAoYXJncykge1xuICAgICAgICAgICAgb3JnQ3Rvci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgICAgIGluaXQodGhpcyk7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuQ3Rvci5wcm90b3R5cGUgPSBjZmcuYmFzZTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIG5ldyBpbnN0YW5jZSBvZiB0aGUgZm9ybXVsYSdzIHByb3RvdHlwZVxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IFtvdmVycmlkZXNdIE9wdGlvbmFsLiBBIHNldCBvZiBwcm9wZXJ0aWVzL292ZXJyaWRlc1xuICAgICAqICAgICAgZm9yIHRoZSBuZXcgaW5zdGFuY2VcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBbYXJnc10gT3B0aW9uYWwuIEFuIGFycmF5IHdpdGggY29uc3RydWN0b3IgYXJndW1lbnRzXG4gICAgICogQHJldHVybiB7T2JqZWN0fSBUaGUgcG90aW9uIChpLmUuIHRoZSBuZXcgaW5zdGFuY2Ugb2YgdGhlIGZvcm11bGEncyBwcm90b3R5cGUpXG4gICAgICovXG4gICAgRm9ybXVsYS5wcm90b3R5cGUuYnJldyA9IGZ1bmN0aW9uIGJyZXcob3ZlcnJpZGVzLCBhcmdzKSB7XG4gICAgICAgIHZhciBwb3Rpb24gPSBuZXcgdGhpcy5DdG9yKGFyZ3MpO1xuICAgICAgICB2YXIgZm9yZWlnblByb3BzID0gT2JqZWN0LmtleXMob3ZlcnJpZGVzIHx8IHt9KTtcbiAgICAgICAgdmFyIG9uRGlzcG9zZSA9IGRlbGVnYXRlKGVhY2gsIFt0aGlzLm9uRGlzcG9zZVNjcmlwdHMsIGNhbGxGbl0pO1xuXG4gICAgICAgIGlmICh0eXBlb2Ygb3ZlcnJpZGVzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBvdmVycmlkZXMgPSBvdmVycmlkZXModGhpcy5DdG9yLnByb3RvdHlwZSk7XG4gICAgICAgIH1cblxuICAgICAgICBwb3Rpb24uZGlzcG9zZSA9IGNyZWF0ZURpc3Bvc2VGbihmb3JlaWduUHJvcHMsIG9uRGlzcG9zZSk7XG4gICAgICAgIHBvdGlvbiA9IG92ZXJyaWRlKHBvdGlvbiwgb3ZlcnJpZGVzKTtcblxuICAgICAgICByZXR1cm4gcG90aW9uO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgY2FsbGJhY2sgZnVuY3Rpb25zIHdoaWNoIHNob3VsZCBiZSBjYWxsZWRcbiAgICAgKiB3aGVuIGJyZXdpbmcgYSBuZXcgcG90aW9uLiBUaGUgZnVuY3Rpb24gaXMgZXhlY3V0ZWRcbiAgICAgKiBpbiB0aGUgY29udGV4dCBvZiB0aGUgbmV3IG9iamVjdFxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGZuIFRoZSBjYWxsYmFjayBmdW5jdGlvblxuICAgICAqIEByZXR1cm4ge0Zvcm11bGF9IFRoZSBuZXcgZm9ybXVsYVxuICAgICAqL1xuICAgIEZvcm11bGEucHJvdG90eXBlLndoZW5CcmV3ZWQgPSBmdW5jdGlvbiB3aGVuQnJld2VkKGZuKSB7XG4gICAgICAgIHJldHVybiBuZXcgRm9ybXVsYSh7XG4gICAgICAgICAgICBiYXNlOiB0aGlzLkN0b3IucHJvdG90eXBlLFxuICAgICAgICAgICAgb25CcmV3U2NyaXB0czogdGhpcy5vbkJyZXdTY3JpcHRzLmNvbmNhdChmbiksXG4gICAgICAgICAgICBvbkRpc3Bvc2VTY3JpcHRzOiB0aGlzLm9uRGlzcG9zZVNjcmlwdHMsXG4gICAgICAgIH0pO1xuICAgIH07XG5cblxuICAgIC8qKlxuICAgICAqIEFkZHMgYSBjYWxsYmFjayBmdW5jdGlvbnMgd2hpY2ggc2hvdWxkIGJlIGNhbGxlZFxuICAgICAqIHdoZW4gd2hlbiBkaXNwb3NpbmcgdGhlIHBvdGlvbi4gVGhlIGZ1bmN0aW9uIGlzXG4gICAgICogZXhlY3V0ZWQgaW4gdGhlIGNvbnRleHQgb2YgdGhlIGRpc3Bvc2VkIG9iamVjdFxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGZuIFRoZSBjYWxsYmFjayBmdW5jdGlvblxuICAgICAqIEByZXR1cm4ge0Zvcm11bGF9IFRoZSBuZXcgZm9ybXVsYVxuICAgICAqL1xuICAgIEZvcm11bGEucHJvdG90eXBlLndoZW5EaXNwb3NlZCA9IGZ1bmN0aW9uIHdoZW5EaXNwb3NlZChmbikge1xuICAgICAgICByZXR1cm4gbmV3IEZvcm11bGEoe1xuICAgICAgICAgICAgYmFzZTogdGhpcy5DdG9yLnByb3RvdHlwZSxcbiAgICAgICAgICAgIG9uQnJld1NjcmlwdHM6IHRoaXMub25CcmV3U2NyaXB0cyxcbiAgICAgICAgICAgIG9uRGlzcG9zZVNjcmlwdHM6IHRoaXMub25EaXNwb3NlU2NyaXB0cy5jb25jYXQoZm4pLFxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQWxsb3dzIG92ZXJyaWRpbmcgbWV0aG9kcyBhbmQgcHJvcGVydGllcyBvZiBhbiBjdXJyZW50IGJhc2Ugb2JqZWN0LlxuICAgICAqIEZvciBleGFtcGxlOlxuICAgICAqIDxwcmU+PGNvZGU+XG4gICAgICogdmFyIG5ld0Zvcm11bGEgPSBmb3JtdWxhLmV4dGVuZCh7XG4gICAgICogICBmb286IGZ1bmN0aW9uICgpIHsgLi4uIH0sXG4gICAgICogICAuLi5cbiAgICAgKiB9KTtcbiAgICAgKiA8L2NvZGU+PC9wcmU+XG4gICAgICogQGZ1bmN0aW9uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb3ZlcnJpZGVzIFRoZSBzZXQgb2YgbmV3IG1ldGhvZHMgYW5kIGF0dHJpYnV0ZXNcbiAgICAgKiBAcmV0dXJuIHtGb3JtdWxhfSBUaGUgbmV3IGFuZCBleHRlbmRlZCBwb3Rpb24gZm9ybXVsYVxuICAgICAqL1xuICAgIEZvcm11bGEucHJvdG90eXBlLmV4dGVuZCA9IGZ1bmN0aW9uIChvdmVycmlkZXMpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBvdmVycmlkZXMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIG92ZXJyaWRlcyA9IG92ZXJyaWRlcyh0aGlzLkN0b3IucHJvdG90eXBlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBuZXcgRm9ybXVsYSh7XG4gICAgICAgICAgICBiYXNlOiBvdmVycmlkZShPYmplY3QuY3JlYXRlKHRoaXMuQ3Rvci5wcm90b3R5cGUpLCBvdmVycmlkZXMpLFxuICAgICAgICAgICAgb25CcmV3U2NyaXB0czogdGhpcy5vbkJyZXdTY3JpcHRzLFxuICAgICAgICAgICAgb25EaXNwb3NlU2NyaXB0czogdGhpcy5vbkRpc3Bvc2VTY3JpcHRzLFxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gICAgLy8gUFJJVkFURSBIRUxQRVJcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIGZ1bmN0aW9uIG92ZXJyaWRlKGJhc2UsIG92ZXJyaWRlcykge1xuICAgICAgICBlYWNoKG92ZXJyaWRlcywgZnVuY3Rpb24gKHByb3AsIGtleSkge1xuICAgICAgICAgICAgYmFzZVtrZXldID0gcHJvcDtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIGJhc2U7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgZnVuY3Rpb24gY2FsbEZuKGZuKSB7XG4gICAgICAgIC8qIGpzaGludCB2YWxpZHRoaXM6IHRydWUgKi9cbiAgICAgICAgZm4uY2FsbCh0aGlzKTtcbiAgICAgICAgLyoganNoaW50IHZhbGlkdGhpczogZmFsc2UgKi9cbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBmdW5jdGlvbiBjcmVhdGVEaXNwb3NlRm4oZm9yZWlnblByb3BzLCBvbkRpc3Bvc2UpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIGRpc3Bvc2UoKSB7XG4gICAgICAgICAgICBvbkRpc3Bvc2UodGhpcyk7XG5cbiAgICAgICAgICAgIGVhY2goZm9yZWlnblByb3BzLCBmdW5jdGlvbiAocHJvcCkge1xuICAgICAgICAgICAgICAgIHRoaXNbcHJvcF0gPSBudWxsO1xuICAgICAgICAgICAgfSwgdGhpcyk7XG5cbiAgICAgICAgICAgIGZvciAodmFyIGtleSBpbiB0aGlzKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXNba2V5XSAmJiB0eXBlb2YgdGhpc1trZXldID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHRoaXNba2V5XS5kaXNwb3NlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzW2tleV0uZGlzcG9zZSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpc1trZXldID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogV3JhcHMgdGhlIGdpdmUgdmFsdWUgaW4gYSBwb3Rpb24gZm9ybXVsYSB0byBhbGxvdyBmdXJ0aGVyIG1hZ2ljXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gYmFzZSBUaGUgb3JpZ2luYWwgYmFzaWMgcHJvdG90eXBlXG4gICAgICogQHJldHVybiB7Rm9ybXVsYX0gdGhlIHdyYXBwZXIgZm9ybXVsYVxuICAgICAqL1xuICAgIHJldHVybiBmdW5jdGlvbiBjb3F1b1ZlbmVudW0oYmFzZSkge1xuICAgICAgICBpZiAoYmFzZSA9PT0gbnVsbCB8fCB0eXBlb2YgYmFzZSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIHRocm93ICdCYXNlIGhhc3QgYmUgYW4gb2JqZWN0LCBcIicgKyBiYXNlICsgJ1wiIGdpdmVuJztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBuZXcgRm9ybXVsYSh7XG4gICAgICAgICAgICBiYXNlOiBPYmplY3QuY3JlYXRlKGJhc2UpLFxuICAgICAgICAgICAgb25CcmV3U2NyaXB0czogW10sXG4gICAgICAgICAgICBvbkRpc3Bvc2VTY3JpcHRzOiBbXSxcbiAgICAgICAgfSk7XG4gICAgfTtcbn0oKSk7XG4iLG51bGwsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgdXVpZCA9ICc1MmJlNTM5NS1hMTgyLTQ2ZGQtYjUxOC0wOTFhMWM0NzZhNjMnO1xuICAgIHZhciBlYWNoID0gcmVxdWlyZSgncHJvLXNpbmd1bGlzJyk7XG5cbiAgICAvKipcbiAgICAgKiBIZWxwZXIgdG8gZGV0ZXJtaW5lIGlmIGEgZ2l2ZW4gb2JqZWN0IGlzIGFuIGltbXV0YWJsZVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgZnVuY3Rpb24gaXNJbW11dGFibGUob2JqKSB7XG4gICAgICAgIHJldHVybiBvYmogJiYgKG9iai50eXBlSWQgPT09IHV1aWQpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGlzT2JqZWN0KG8pIHtcbiAgICAgICAgcmV0dXJuIG8gJiYgKHR5cGVvZiBvID09PSAnb2JqZWN0Jyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNBcnJheShhKSB7XG4gICAgICAgIHJldHVybiBBcnJheS5pc0FycmF5KGEpO1xuICAgIH1cblxuXG4gICAgZnVuY3Rpb24gY29weVRvIChiYXNlLCBuZXh0KSB7XG4gICAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMobmV4dCk7XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBrZXlzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgdmFyIGtleSA9IGtleXNbaV07XG4gICAgICAgICAgICBiYXNlW2tleV0gPSBuZXh0W2tleV07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYmFzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBIZWxwZXIgdG8gY3JlYXRlIGFuIGltbXV0YWJsZSBkYXRhIG9iamVjdCBkZXBlbmRpbmcgb24gdGhlIHR5cGUgb2YgdGhlIGlucHV0XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBjcmVhdGVTdWIodmFsdWUsIGNvbXB1dGVkKSB7XG4gICAgICAgIGlmIChpc0FycmF5KHZhbHVlKSkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBMaXN0KHZhbHVlLCBjb21wdXRlZCk7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNPYmplY3QodmFsdWUpKSB7XG4gICAgICAgICAgICBpZiAoaXNJbW11dGFibGUodmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZS5jb25zdHJ1Y3RvciA9PT0gT2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBTdHJ1Y3QodmFsdWUsIGNvbXB1dGVkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBuZXcgVmFsdWUodmFsdWUsIGNvbXB1dGVkKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3IFZhbHVlKHZhbHVlLCBjb21wdXRlZCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGFic3RyYWN0IGJhc2UgY2xhc3MgZm9yIGltbXV0YWJsZSB2YWx1ZXNcbiAgICAgKlxuICAgICAqIEBjbGFzcyBBYnN0cmFjdFxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgZnVuY3Rpb24gQWJzdHJhY3QodmFsdWUsIGRhdGEsIGNvbXB1dGVkKSB7XG4gICAgICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5kYXRhID0gZGF0YSAmJiBlYWNoKGRhdGEsIGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgICAgICByZXR1cm4gY3JlYXRlU3ViKGl0ZW0pO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5jb21wdXRlZFByb3BzID0gY29tcHV0ZWQ7XG4gICAgfVxuXG4gICAgQWJzdHJhY3QucHJvdG90eXBlLnR5cGVJZCA9IHV1aWQ7XG5cbiAgICBBYnN0cmFjdC5wcm90b3R5cGUudmFsID0gZnVuY3Rpb24gKGtleSkge1xuICAgICAgICBpZiAodHlwZW9mIGtleSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHZhciBzdWIgPSB0aGlzLnN1YihrZXkpO1xuICAgICAgICAgICAgaWYgKHN1Yikge1xuICAgICAgICAgICAgICAgIHJldHVybiBzdWIudmFsKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBmbiA9IHRoaXMuY29tcHV0ZWRQcm9wcyAmJiB0aGlzLmNvbXB1dGVkUHJvcHNba2V5XTtcbiAgICAgICAgICAgIGlmIChmbikge1xuICAgICAgICAgICAgICAgIHJldHVybiBmbi5jYWxsKHRoaXMsIHRoaXMudmFsKCkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnZhbHVlID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLnZhbHVlID0gZWFjaCh0aGlzLmRhdGEsIGZ1bmN0aW9uIChzdWIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3ViLnZhbCgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMudmFsdWU7XG4gICAgfTtcblxuICAgIEFic3RyYWN0LnByb3RvdHlwZS5zZXQgPSB1bmRlZmluZWQ7IC8vIGFic3RhY3RcblxuICAgIEFic3RyYWN0LnByb3RvdHlwZS5zdWIgPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgIHJldHVybiAodGhpcy5kYXRhICYmIHRoaXMuZGF0YVtrZXldKSB8fCBudWxsO1xuICAgIH07XG5cbiAgICBBYnN0cmFjdC5wcm90b3R5cGUuZWFjaCA9IGZ1bmN0aW9uIChmbiwgc2NvcGUsIG1vcmUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc2V0KGVhY2godGhpcy5kYXRhLCBmbiwgc2NvcGUsIG1vcmUpKTtcbiAgICB9O1xuXG4gICAgLyoqIEBwcm90ZWN0ZWQgKi9cbiAgICBBYnN0cmFjdC5wcm90b3R5cGUuc2V0U3ViVmFsdWUgPSBmdW5jdGlvbiAodmFsLCBrZXkpIHtcbiAgICAgICAgdmFyIGN1cnJWYWwgPSB0aGlzLnN1YihrZXkpO1xuICAgICAgICBpZiAoY3VyclZhbCkge1xuICAgICAgICAgICAgLy8gdXBkYXRlIGV4aXN0aW5nIGtleVxuICAgICAgICAgICAgdmFyIG5ld1ZhbCA9IGN1cnJWYWwuc2V0KHZhbCk7XG4gICAgICAgICAgICBpZiAobmV3VmFsICE9PSBjdXJyVmFsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ld1ZhbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGFkZCBuZXcga2V5L3ZhbHVlXG4gICAgICAgICAgICByZXR1cm4gY3JlYXRlU3ViKHZhbCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQSBzaW1wbGUgaW1tdXRhYmxlIHZhbHVlXG4gICAgICpcbiAgICAgKiBAY2xhc3MgVmFsdWVcbiAgICAgKiBAZXh0ZW5kcyBBYnN0cmFjdFxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgZnVuY3Rpb24gVmFsdWUodmFsLCBjb21wdXRlZCkge1xuICAgICAgICBBYnN0cmFjdC5jYWxsKHRoaXMsIHZhbCwgbnVsbCwgY29tcHV0ZWQpO1xuICAgIH1cbiAgICBWYWx1ZS5wcm90b3R5cGUgPSBuZXcgQWJzdHJhY3QoKTtcblxuICAgIFZhbHVlLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiBfc2V0U2ltcGxlVmFsdWUodmFsKSB7XG4gICAgICAgIGlmIChpc0ltbXV0YWJsZSh2YWwpKSB7XG4gICAgICAgICAgICByZXR1cm4gdmFsO1xuICAgICAgICB9XG4gICAgICAgIGlmICh2YWwgPT09IHRoaXMudmFsdWUpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXcgVmFsdWUodmFsLCB0aGlzLmNvbXB1dGVkUHJvcHMpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBBbiBpbW11dGFibGUga2V5LXZhbHVlIHN0b3JlXG4gICAgICpcbiAgICAgKiBAY2xhc3MgU3RydWN0XG4gICAgICogQGV4dGVuZHMgQWJzdHJhY3RcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIFN0cnVjdChkYXRhLCBjb21wdXRlZCkge1xuICAgICAgICBBYnN0cmFjdC5jYWxsKHRoaXMsIG51bGwsIGRhdGEsIGNvbXB1dGVkKTtcbiAgICB9XG4gICAgU3RydWN0LnByb3RvdHlwZSA9IG5ldyBBYnN0cmFjdCgpO1xuXG4gICAgU3RydWN0LnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiBfc2V0Q29tcGxleFZhbHVlKGtleSwgdmFsKSB7XG4gICAgICAgIGlmICh0eXBlb2Yga2V5ID09PSAnc3RyaW5nJyAmJiB0eXBlb2YgdmFsICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgLy8gY2FsbGVkIHdpdGgga2V5IGFuZCB2YWx1ZSwgZS5nLiAuc2V0KCdmb28nLCAnYmFyJyk7XG4gICAgICAgICAgICB2YXIgbmV3U3ViID0gdGhpcy5zZXRTdWJWYWx1ZSh2YWwsIGtleSk7XG4gICAgICAgICAgICBpZiAobmV3U3ViKSB7XG4gICAgICAgICAgICAgICAgdmFyIG5ld0RhdGEgPSBjb3B5VG8oe30sIHRoaXMuZGF0YSk7XG4gICAgICAgICAgICAgICAgbmV3RGF0YVtrZXldID0gbmV3U3ViO1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgU3RydWN0KG5ld0RhdGEsIHRoaXMuY29tcHV0ZWRQcm9wcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpc0ltbXV0YWJsZShrZXkpKSB7XG4gICAgICAgICAgICByZXR1cm4ga2V5O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzQXJyYXkoa2V5KSkge1xuICAgICAgICAgICAgLy8gY2FsbGVkIHdpdGggYXJyYXksIGUuZy4gLnNldChbMSwgMiwgLi4uXSk7XG4gICAgICAgICAgICByZXR1cm4gbmV3IExpc3Qoa2V5LCB0aGlzLmNvbXB1dGVkUHJvcHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzT2JqZWN0KGtleSkgJiYga2V5LmNvbnN0cnVjdG9yID09PSBPYmplY3QpIHtcbiAgICAgICAgICAgIC8vIGNhbGxlZCB3aXRoIHJhdyBqcyBvYmplY3QsIGUuZy4gLnNldCh7Zm9vOiAnYmFyJ30pO1xuICAgICAgICAgICAgdmFyIGNoYW5nZWRTdWJzID0gZWFjaChrZXksIHRoaXMuc2V0U3ViVmFsdWUsIHRoaXMpO1xuICAgICAgICAgICAgaWYgKGNoYW5nZWRTdWJzICYmIE9iamVjdC5rZXlzKGNoYW5nZWRTdWJzKS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBTdHJ1Y3QoY29weVRvKGNvcHlUbyh7fSwgdGhpcy5kYXRhKSwgY2hhbmdlZFN1YnMpLCB0aGlzLmNvbXB1dGVkUHJvcHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mIGtleSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgVmFsdWUoa2V5LCB0aGlzLmNvbXB1dGVkUHJvcHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEFuIGltbXV0YWJsZSBsaXN0L2FycmF5XG4gICAgICpcbiAgICAgKiBAY2xhc3MgTGlzdFxuICAgICAqIEBleHRlbmRzIEFic3RyYWN0XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBMaXN0KGRhdGEsIGNvbXB1dGVkKSB7XG4gICAgICAgIEFic3RyYWN0LmNhbGwodGhpcywgbnVsbCwgZGF0YSwgY29tcHV0ZWQpO1xuICAgIH1cbiAgICBMaXN0LnByb3RvdHlwZSA9IG5ldyBBYnN0cmFjdCgpO1xuXG4gICAgTGlzdC5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24gKGluZGV4LCB2YWx1ZSkge1xuICAgICAgICBpZiAodHlwZW9mIGluZGV4ID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgLy8gY2FsbGVkIHdpdGgga2V5IGFuZCB2YWx1ZSwgZS5nLiAuc2V0KCdmb28nLCAnYmFyJyk7XG4gICAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgICAgIHZhciBuZXdTdWIgPSB0aGlzLnNldFN1YlZhbHVlKHZhbHVlLCBpbmRleCk7XG4gICAgICAgICAgICAgICAgaWYgKG5ld1N1Yikge1xuICAgICAgICAgICAgICAgICAgICB2YXIgbmV3RGF0YSA9IFtdLmNvbmNhdCh0aGlzLmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICBuZXdEYXRhW2luZGV4XSA9IG5ld1N1YjtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBMaXN0KG5ld0RhdGEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7IC8vIG5vbi1udW1lcmljIGluZGV4XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjYWxsZWQgd2l0aCBzaW5nbGUgYXJndW1lbnRcbiAgICAgICAgdmFsdWUgPSBpbmRleDtcblxuICAgICAgICBpZiAoaXNJbW11dGFibGUodmFsdWUpKSB7XG4gICAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnVwZGF0ZUxpc3QodmFsdWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzT2JqZWN0KHZhbHVlKSAmJiB2YWx1ZS5jb25zdHJ1Y3RvciA9PT0gT2JqZWN0KSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFN0cnVjdCh2YWx1ZSwgdGhpcy5jb21wdXRlZFByb3BzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBuZXcgVmFsdWUodmFsdWUsIHRoaXMuY29tcHV0ZWRQcm9wcyk7XG4gICAgfTtcblxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgTGlzdC5wcm90b3R5cGUudXBkYXRlTGlzdCA9IGZ1bmN0aW9uIChuZXdEYXRhKSB7XG4gICAgICAgIHZhciBuZXdMaXN0ID0gW107XG4gICAgICAgIHZhciBjaGFuZ2VkID0gbmV3RGF0YS5sZW5ndGggIT09IHRoaXMuZGF0YS5sZW5ndGg7XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBuZXdEYXRhLmxlbmd0aDsgIGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBuZXdTdWJEYXRhID0gbmV3RGF0YVtpXTtcbiAgICAgICAgICAgIHZhciBuZXdTdWIgPSB0aGlzLnNldFN1YlZhbHVlKG5ld1N1YkRhdGEsIGkpO1xuXG4gICAgICAgICAgICBpZiAobmV3U3ViKSB7XG4gICAgICAgICAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgbmV3TGlzdC5wdXNoKG5ld1N1Yik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5ld0xpc3QucHVzaCh0aGlzLmRhdGFbaV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFuZ2VkKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IExpc3QobmV3TGlzdCwgdGhpcy5jb21wdXRlZFByb3BzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogVGhpcyBpcyBhbiBpbW11dGFibGUgZGF0YSBvYmplY3RcbiAgICAgKi9cbiAgICByZXR1cm4ge1xuICAgICAgICBmcm9tSlM6IGZ1bmN0aW9uIChkYXRhLCBjb21wdXRlZCkge1xuICAgICAgICAgICAgcmV0dXJuIGNyZWF0ZVN1YihkYXRhLCBjb21wdXRlZCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgZmluZDogZnVuY3Rpb24gKGltbXV0YWJsZSwgc2VsZWN0b3IpIHtcbiAgICAgICAgICAgIGlmICghaW1tdXRhYmxlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2Ygc2VsZWN0b3IgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgdmFyIGtleXMgPSBzZWxlY3Rvci5zcGxpdCgnLicpO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0ga2V5cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaW1tdXRhYmxlID0gaW1tdXRhYmxlLnN1YihrZXlzW2ldKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBpbW11dGFibGU7XG4gICAgICAgIH1cbiAgICB9O1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIC8qKlxuICAgICAqIEl0ZXJhdGVzIG9mIGFuIGl0ZXJhYmxlIG9iamVjdCBhbmQgY2FsbCB0aGUgZ2l2ZW4gbWV0aG9kIGZvciBlYWNoIGl0ZW1cbiAgICAgKiBGb3IgZXhhbXBsZTpcbiAgICAgKiA8cHJlPjxjb2RlPlxuICAgICAqICAgICAgLy8gKGEpIGRlZmF1bHQgdXNlIGNhc2UgaXRlcmF0ZSB0aHJvdWdoIGFuIGFycmF5IG9yIGFuIG9iamVjdFxuICAgICAqICAgICAgZWFjaChbMSwgMiwgLi4uLCBuXSwgZnVuY3Rpb24gZG9TdHVmZih2YWwpIHsgLi4uIH0pO1xuICAgICAqXG4gICAgICogICAgICAvLyAoYikgbWFwIGRhdGFcbiAgICAgKiAgICAgIGVhY2goWzEsIDIsIDNdLCBmdW5jdGlvbiBkb3VibGUodmFsKSB7XG4gICAgICogICAgICAgICAgcmV0dXJuIDIgKiB2YWw7XG4gICAgICogICAgICB9KTsgLy8gLT4gWzIsIDQsIDZdXG4gICAgICogICAgICBlYWNoKHtmb286IDEsIGJhcjogMn0sIGZ1bmN0aW9uIGRvdWJsZSh2YWwpIHtcbiAgICAgKiAgICAgICAgICByZXR1cm4gMiAqIHZhbDtcbiAgICAgKiAgICAgIH0pOyAvLyAtPiB7Zm9vOiAyLCBiYXI6IDR9XG4gICAgICpcbiAgICAgKiAgICAgIC8vIChjKSBmaWx0ZXIgZGF0YVxuICAgICAqICAgICAgZWFjaChbMSwgMiwgMywgNF0sIGZ1bmN0aW9uICh2YWwpIHtcbiAgICAgKiAgICAgICAgICByZXR1cm4gKHZhbCAlIDIgPT09IDApID8gdmFsIDogdW5kZWZpbmVkO1xuICAgICAqICAgICAgfSk7IC8vIC0+IFsyLCA0XVxuICAgICAqICAgICAgZWFjaCh7IGZvbzogMSwgYmFyOiAyLCBiYXo6IDMsIH0sIGZ1bmN0aW9uIHVuZXZlbih2YWwpIHtcbiAgICAgKiAgICAgICAgICByZXR1cm4gKHZhbCAlIDIgIT09IDApID8gdmFsIDogdW5kZWZpbmVkO1xuICAgICAqICAgICAgfSk7IC8vIC0+IHsgZm9vOiAxLCBiYXo6IDMgfVxuICAgICAqIDwvY29kZT48L3ByZT5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0L0FycmF5fSBpdGVyYWJsZSBUaGUgb2JqZWN0IHRvIGl0ZXJhdGUgdGhyb3VnaFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGZuIFRoZSBjYWxsYmFjayBmdW5jdGlvbiB0byBiZSBjYWxsZWQgZm9yIGVhY2ggaXRlbVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBzY29wZSBUaGUgZXhlY3V0aW9uIHNjb3BlIGZvciB0aGUgY2FsbGJhY2sgZnVuY3Rpb25cbiAgICAgKiBAcGFyYW0ge0FycmF5fSBtb3JlIE9wdGlvbmFsOyBhbiBhZGRpb25hbCBzZXQgb2YgYXJndW1lbnRzIHdoaWNoIHdpbGxcbiAgICAgKiAgICAgIGJlIHBhc3NlZCB0byB0aGUgY2FsbGJhY2sgZnVuY3Rpb25cbiAgICAgKiBAcmV0dXJuIHtPYmplY3QvQXJyYXl9IFRoZSBhZ2dyZWdhdGVkIHJlc3VsdHMgb2YgZWFjaCBjYWxsYmFjayAoc2VlIGV4YW1wbGVzKVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGVhY2goaXRlcmFibGUsIGZuLCBzY29wZSwgbW9yZSkge1xuICAgICAgICB2YXIgYXJncyA9IFtudWxsLCBudWxsXTtcbiAgICAgICAgdmFyIHJlc3VsdCwgcmVzdWx0U2V0O1xuICAgICAgICB2YXIgaSwgbDtcblxuICAgICAgICBpZiAobW9yZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBhcmdzID0gYXJncy5jb25jYXQobW9yZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShpdGVyYWJsZSkpIHtcbiAgICAgICAgICAgIHJlc3VsdFNldCA9IFtdO1xuXG4gICAgICAgICAgICBmb3IgKGkgPSAwLCBsID0gaXRlcmFibGUubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgICAgICAgICAgICAgYXJnc1swXSA9IGl0ZXJhYmxlW2ldO1xuICAgICAgICAgICAgICAgIGFyZ3NbMV0gPSBpO1xuICAgICAgICAgICAgICAgIHJlc3VsdCA9IGZuLmFwcGx5KHNjb3BlLCBhcmdzKTtcblxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgcmVzdWx0ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRTZXQucHVzaChyZXN1bHQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9IGVsc2UgaWYgKGl0ZXJhYmxlICYmIHR5cGVvZiBpdGVyYWJsZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMoaXRlcmFibGUpO1xuICAgICAgICAgICAgLy8gdXNlIE9iamVjdC5rZXlzICsgZm9yLWxvb3AgdG8gYWxsb3cgb3B0aW1pemluZyBlYWNoIGZvclxuICAgICAgICAgICAgLy8gaXRlcmF0aW5nIG92ZXIgb2JqZWN0cyBpbiBoYXNoLXRhYmxlLW1vZGVcblxuICAgICAgICAgICAgcmVzdWx0U2V0ID0ge307XG5cbiAgICAgICAgICAgIGZvciAoaSA9IDAsIGwgPSBrZXlzLmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgICAgICAgICAgICAgIHZhciBrZXkgPSBrZXlzW2ldO1xuXG4gICAgICAgICAgICAgICAgYXJnc1swXSA9IGl0ZXJhYmxlW2tleV07XG4gICAgICAgICAgICAgICAgYXJnc1sxXSA9IGtleTtcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBmbi5hcHBseShzY29wZSwgYXJncyk7XG5cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHJlc3VsdCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0U2V0W2tleV0gPSByZXN1bHQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdFNldDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgZnVuY3Rpb24gd2hpY2ggaXMgYm91bmQgdG8gYSBnaXZlbiBjYWxsYmFjayBhbmQgc2NvcGVcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGZuIFRoZSBjYWxsYmFjayAoc2FtZSBhcyBmb3IgZWFjaCBpdHNlbGYpXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHNjb3BlIFRoZSBleGVjdXRpb24gY29udGV4dCBmb3IgdGhlIGNhbGxiYWNrXG4gICAgICogQHJldHVybiBGdW5jdGlvbiBUaGUgbmV3IGl0ZXJhdG9yIGZ1bmN0aW9uIHdoaWNoIGV4cGVjdHMgdGhlXG4gICAgICogICAgICBpdGVyYWJsZSBhbmQgYW4gYXJyYXkgb2YgYWRkaXRpb25hbCBwYXJhbWV0ZXIgd2hpY2ggYXJlXG4gICAgICogICAgICBwYXNzZWQgdG8gdGhlIGNhbGxiYWNrXG4gICAgICovXG4gICAgZWFjaC5wcmVwYXJlID0gZnVuY3Rpb24gKGZuLCBzY29wZSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGl0ZXJhYmxlLCBtb3JlKSB7XG4gICAgICAgICAgICByZXR1cm4gZWFjaChpdGVyYWJsZSwgZm4sIHNjb3BlIHx8IHRoaXMsIG1vcmUpO1xuICAgICAgICB9O1xuICAgIH07XG5cbiAgICByZXR1cm4gZWFjaDtcbn0oKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgaW1tdXRhYmxlID0gcmVxdWlyZSgnaW1tdXRhYmlsaXMnKTtcbiAgICB2YXIgQXBwbGljYXR1cyA9IHJlcXVpcmUoJ2FsY2hlbXkuanMvbGliL0FwcGxpY2F0dXMnKTtcbiAgICB2YXIgTmF2aWdhdGlvbkNvbnRyb2xsZXIgPSByZXF1aXJlKCcuL2NvbnRyb2xsZXIvTmF2aWdhdGlvbicpO1xuXG4gICAgLyoqXG4gICAgICogQGNsYXNzXG4gICAgICogQG5hbWUgY29yZS5BcHBcbiAgICAgKiBAZXh0ZW5kcyBhbGNoZW15LndlYi5BcHBsaWNhdHVzXG4gICAgICovXG4gICAgcmV0dXJuIEFwcGxpY2F0dXMuZXh0ZW5kKHtcbiAgICAgICAgLyoqIEBsZW5kcyBjb3JlLkFwcC5wcm90b3R5cGUgKi9cblxuICAgICAgICAvKiogQG92ZXJyaWRlICovXG4gICAgICAgIG9uTGF1bmNoOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLndpcmVVcChOYXZpZ2F0aW9uQ29udHJvbGxlci5icmV3KCkpO1xuICAgICAgICAgICAgdGhpcy51aS5pbml0KHRoaXMuc3RhdGUpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKiBAb3ZlcnJpZGUgKi9cbiAgICAgICAgdXBkYXRlOiBmdW5jdGlvbiAocCkge1xuICAgICAgICAgICAgdmFyIHN0YXRlID0gcC5zdGF0ZVxuICAgICAgICAgICAgICAgIC5zZXQoJ3dpbmRvd1dpZHRoJywgd2luZG93LmlubmVyV2lkdGgpXG4gICAgICAgICAgICAgICAgLnNldCgnd2luZG93SGVpZ2h0Jywgd2luZG93LmlubmVySGVpZ2h0KTtcblxuICAgICAgICAgICAgdGhpcy51aS51cGRhdGUoc3RhdGUpO1xuXG4gICAgICAgICAgICByZXR1cm4gc3RhdGU7XG5cbiAgICAgICAgfSxcblxuICAgIH0pLndoZW5CcmV3ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnN0YXRlID0gaW1tdXRhYmxlLmZyb21KUyh7XG4gICAgICAgICAgICBtb2RlOiAncHJlc2VudGF0aW9uJyxcbiAgICAgICAgICAgIGN1cnJlbnRJbmRleDogMCxcbiAgICAgICAgICAgIG51bU9mU2xpZGVzOiAwLFxuICAgICAgICAgICAgZW1haWw6ICdtaWNoYWVsLmJ1ZXR0bmVyQGZseWVyYWxhcm0uY29tJ1xuICAgICAgICB9KTtcbiAgICB9KTtcbn0oKSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIGNvcXVvVmVuZW51bSA9IHJlcXVpcmUoJ2NvcXVvLXZlbmVudW0nKTtcbiAgICB2YXIgZWFjaCA9IHJlcXVpcmUoJ3Byby1zaW5ndWxpcycpO1xuICAgIHZhciBVdGlscyA9IHJlcXVpcmUoJ2FsY2hlbXkuanMvbGliL1V0aWxzJyk7XG4gICAgdmFyIEFkbWluaXN0cmF0b3IgPSByZXF1aXJlKCdhbGNoZW15LmpzL2xpYi9BZG1pbmlzdHJhdG9yJyk7XG4gICAgdmFyIEFwb3RoZWNhcml1cyA9IHJlcXVpcmUoJ2FsY2hlbXkuanMvbGliL0Fwb3RoZWNhcml1cycpO1xuICAgIHZhciBEZWxlZ2F0dXMgPSByZXF1aXJlKCdhbGNoZW15LmpzL2xpYi9EZWxlZ2F0dXMnKTtcbiAgICB2YXIgU3R5bHVzID0gcmVxdWlyZSgnYWxjaGVteS5qcy9saWIvU3R5bHVzJyk7XG4gICAgdmFyIFN0YXRlU3lzdGVtID0gcmVxdWlyZSgnYWxjaGVteS5qcy9saWIvU3RhdGVTeXN0ZW0nKTtcbiAgICB2YXIgRXZlbnRTeXN0ZW0gPSByZXF1aXJlKCdhbGNoZW15LmpzL2xpYi9FdmVudFN5c3RlbScpO1xuICAgIHZhciBDc3NSZW5kZXJTeXN0ZW0gPSByZXF1aXJlKCdhbGNoZW15LmpzL2xpYi9Dc3NSZW5kZXJTeXN0ZW0nKTtcbiAgICB2YXIgVkRvbVJlbmRlclN5c3RlbSA9IHJlcXVpcmUoJ2FsY2hlbXkuanMvbGliL1ZEb21SZW5kZXJTeXN0ZW0nKTtcbiAgICB2YXIgVmlld3BvcnQgPSByZXF1aXJlKCcuL3VpL1ZpZXdwb3J0Jyk7XG5cbiAgICByZXR1cm4gY29xdW9WZW5lbnVtKHtcblxuICAgICAgICAvKiogQHByb3RlY3RlZCAqL1xuICAgICAgICBtZXNzYWdlczogdW5kZWZpbmVkLFxuXG4gICAgICAgIC8qKiBAcHJvdGVjdGVkICovXG4gICAgICAgIGFkbWluOiB1bmRlZmluZWQsXG5cbiAgICAgICAgLyoqIEBwcm90ZWN0ZWQgKi9cbiAgICAgICAgZGVsZWdhdG9yOiB1bmRlZmluZWQsXG5cbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKHN0YXRlKSB7XG4gICAgICAgICAgICB0aGlzLmluaXRTeXN0ZW1zKCk7XG4gICAgICAgICAgICB0aGlzLmluaXRFbnRpdGllcyhzdGF0ZSk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgdXBkYXRlOiBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmFkbWluLnVwZGF0ZShzdGF0ZSk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLy9cbiAgICAgICAgLy8gcHJpdmF0ZVxuICAgICAgICAvL1xuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICBpbml0U3lzdGVtczogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgZWFjaChbXG4gICAgICAgICAgICAgICAgU3RhdGVTeXN0ZW0sXG4gICAgICAgICAgICAgICAgRXZlbnRTeXN0ZW0sXG4gICAgICAgICAgICAgICAgQ3NzUmVuZGVyU3lzdGVtLFxuICAgICAgICAgICAgICAgIFZEb21SZW5kZXJTeXN0ZW0sXG5cbiAgICAgICAgICAgIF0sIGZ1bmN0aW9uIChTeXN0ZW0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFkbWluLmFkZFN5c3RlbShTeXN0ZW0uYnJldyh7XG4gICAgICAgICAgICAgICAgICAgIGRlbGVnYXRvcjogdGhpcy5kZWxlZ2F0b3IsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2VzOiB0aGlzLm1lc3NhZ2VzLFxuICAgICAgICAgICAgICAgICAgICBzdHlsdXM6IHRoaXMuc3R5bHVzLFxuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIH0sIHRoaXMpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICBpbml0RW50aXRpZXM6IGZ1bmN0aW9uIChzdGF0ZSkge1xuICAgICAgICAgICAgdGhpcy5hZG1pbi5pbml0RW50aXRpZXMoW1V0aWxzLm1lbHQoVmlld3BvcnQsIHtcbiAgICAgICAgICAgICAgICBpZDogJ3ZpZXdwb3J0JyxcbiAgICAgICAgICAgICAgICBjaGlsZHJlbjogdGhpcy5zbGlkZXMsXG4gICAgICAgICAgICB9KV0sIHN0YXRlKTtcbiAgICAgICAgfSxcblxuICAgIH0pLndoZW5CcmV3ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLmRlbGVnYXRvciA9IERlbGVnYXR1cy5icmV3KCk7XG4gICAgICAgIHRoaXMuc3R5bHVzID0gU3R5bHVzLmJyZXcoKTtcbiAgICAgICAgdGhpcy5hZG1pbiA9IEFkbWluaXN0cmF0b3IuYnJldyh7XG4gICAgICAgICAgICByZXBvOiBBcG90aGVjYXJpdXMuYnJldygpXG4gICAgICAgIH0pO1xuICAgIH0pO1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgY29xdW9WZW5lbnVtID0gcmVxdWlyZSgnY29xdW8tdmVuZW51bScpO1xuXG4gICAgLyoqXG4gICAgICogRGVzY3JpcHRpb25cbiAgICAgKlxuICAgICAqIEBjbGFzc1xuICAgICAqIEBuYW1lIGNvcmUuY29udHJvbGxlci5OYXZpZ2F0aW9uXG4gICAgICovXG4gICAgcmV0dXJuIGNvcXVvVmVuZW51bSh7XG4gICAgICAgIC8qKiBAbGVuZHMgY29yZS5jb250cm9sbGVyLk5hdmlnYXRpb24ucHJvdG90eXBlICovXG5cbiAgICAgICAgbWVzc2FnZXM6IHtcbiAgICAgICAgICAgICduYXZpZ2F0aW9uOm5leHQnOiAnb25OZXh0U2xpZGUnLFxuICAgICAgICAgICAgJ25hdmlnYXRpb246cHJldic6ICdvblByZXZTbGlkZScsXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIG9uTmV4dFNsaWRlOiBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgICAgICAgICAgIHZhciBjdXJyZW50ID0gc3RhdGUudmFsKCdjdXJyZW50SW5kZXgnKTtcbiAgICAgICAgICAgIGlmIChjdXJyZW50IDwgc3RhdGUudmFsKCdudW1PZlNsaWRlcycpIC0gMSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzdGF0ZS5zZXQoJ2N1cnJlbnRJbmRleCcsIGN1cnJlbnQgKyAxKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHN0YXRlO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICBvblByZXZTbGlkZTogZnVuY3Rpb24gKHN0YXRlKSB7XG4gICAgICAgICAgICB2YXIgY3VycmVudCA9IHN0YXRlLnZhbCgnY3VycmVudEluZGV4Jyk7XG4gICAgICAgICAgICBpZiAoY3VycmVudCA+IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3RhdGUuc2V0KCdjdXJyZW50SW5kZXgnLCBjdXJyZW50IC0gMSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBzdGF0ZTtcbiAgICAgICAgfSxcbiAgICB9KTtcbn0oKSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIFV0aWxzID0gcmVxdWlyZSgnYWxjaGVteS5qcy9saWIvVXRpbHMnKTtcblxuICAgIHJldHVybiBmdW5jdGlvbiB0ZXh0KHR4dCwgZW50aXR5Q3NzLCBtb3JlKSB7XG4gICAgICAgIHJldHVybiBVdGlscy5tZWx0KHtcbiAgICAgICAgICAgIHN0YXRlOiB7XG4gICAgICAgICAgICAgICAgdGV4dDogdHh0XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICB2ZG9tOiB7XG4gICAgICAgICAgICAgICAgcmVuZGVyZXI6IGZ1bmN0aW9uIChjdHgpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHMgPSBjdHguc3RhdGU7XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGN0eC5oKCdkaXYnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU6ICd0ZXh0IGJpZyAnICsgKHMudmFsKCdjbGFzc05hbWUnKSB8fCAnJyksXG4gICAgICAgICAgICAgICAgICAgICAgICBpZDogY3R4LmVudGl0eUlkLFxuICAgICAgICAgICAgICAgICAgICB9LCBzLnZhbCgndGV4dCcpKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgY3NzOiB7XG4gICAgICAgICAgICAgICAgZW50aXR5UnVsZXM6IGVudGl0eUNzcyxcblxuICAgICAgICAgICAgICAgIHR5cGVSdWxlczoge1xuICAgICAgICAgICAgICAgICAgICAnLnRleHQnOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwYWRkaW5nOiAnMCA0MHB4JyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hcmdpbjogJzIwcHggMCcsXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0sIG1vcmUpO1xuICAgIH07XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHJldHVybiBmdW5jdGlvbiBodG1sKHJlbmRlciwgZW50aXR5Q3NzKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB2ZG9tOiB7XG4gICAgICAgICAgICAgICAgcmVuZGVyZXI6IGZ1bmN0aW9uIChjdHgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlbmRlcihjdHguaCwgY3R4LnN0YXRlKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgY3NzOiB7XG4gICAgICAgICAgICAgICAgZW50aXR5UnVsZXM6IGVudGl0eUNzcyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH07XG4gICAgfTtcbn0oKSk7XG5cbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgVXRpbHMgPSByZXF1aXJlKCdhbGNoZW15LmpzL2xpYi9VdGlscycpO1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uIHNsaWRlKHRpdGxlLCBjaGlsZHJlbiwgbW9yZSkge1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh0aXRsZSkpIHtcbiAgICAgICAgICAgIG1vcmUgPSBjaGlsZHJlbjtcbiAgICAgICAgICAgIGNoaWxkcmVuID0gdGl0bGU7XG4gICAgICAgICAgICB0aXRsZSA9ICcnO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIFV0aWxzLm1lbHQoe1xuICAgICAgICAgICAgZ2xvYmFsVG9Mb2NhbDoge1xuICAgICAgICAgICAgICAgIG1vZGU6ICdtb2RlJyxcbiAgICAgICAgICAgICAgICBlbWFpbDogJ2VtYWlsJyxcbiAgICAgICAgICAgICAgICB3aW5kb3dXaWR0aDogJ3dpbmRvd1dpZHRoJyxcbiAgICAgICAgICAgICAgICB3aW5kb3dIZWlnaHQ6ICd3aW5kb3dIZWlnaHQnLFxuICAgICAgICAgICAgICAgIGN1cnJlbnRJbmRleDogJ2N1cnJlbnRJbmRleCdcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHN0YXRlOiB7XG4gICAgICAgICAgICAgICAgdGl0bGU6IHRpdGxlLFxuICAgICAgICAgICAgICAgIGluZGV4OiAwLFxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgdmRvbToge1xuICAgICAgICAgICAgICAgIHJlbmRlcmVyOiBmdW5jdGlvbiAoY3R4KSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBoID0gY3R4Lmg7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzID0gY3R4LnN0YXRlLnZhbCgpO1xuICAgICAgICAgICAgICAgICAgICB2YXIgaXNBY3RpdmUgPSBzLm1vZGUgPT09ICdwcmludCcgfHwgcy5jdXJyZW50SW5kZXggPT09IHMuaW5kZXg7XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGgoJ2Rpdi5zbGlkZScsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkOiBjdHguZW50aXR5SWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBrZXk6IGN0eC5lbnRpdHlJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZTogaXNBY3RpdmUgPyAnYWN0aXZlJyA6ICdoaWRkZW4nLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YXNldDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4OiBzLmluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgfSwgW1xuICAgICAgICAgICAgICAgICAgICAgICAgaCgnZGl2LnNsaWRlLXRpdGxlJywgY3R4LnN0YXRlLnZhbCgndGl0bGUnKSksXG4gICAgICAgICAgICAgICAgICAgICAgICBoKCdkaXYuc2xpZGUtaW5uZXInLCBjdHgucmVuZGVyQWxsQ2hpbGRyZW4oKSksXG4gICAgICAgICAgICAgICAgICAgICAgICBoKCdzcGFuLmVtYWlsJywgY3R4LnN0YXRlLnZhbCgnZW1haWwnKSksXG4gICAgICAgICAgICAgICAgICAgIF0pO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBjc3M6IHtcbiAgICAgICAgICAgICAgICBlbnRpdHlSdWxlczogZnVuY3Rpb24gKHN0YXRlKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzdGF0ZS52YWwoJ21vZGUnKSA9PT0gJ3ByaW50Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZWZ0OiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHZhciBpbmRleCA9IHN0YXRlLnZhbCgnaW5kZXgnKTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNJbmRleCA9IHN0YXRlLnZhbCgnY3VycmVudEluZGV4Jyk7XG4gICAgICAgICAgICAgICAgICAgIHZhciB3aWR0aCA9IHN0YXRlLnZhbCgnd2luZG93V2lkdGgnKTtcblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGVmdDogKGluZGV4IC0gY0luZGV4KSAqIHdpZHRoICsgJ3B4JyxcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgICAgdHlwZVJ1bGVzOiB7XG4gICAgICAgICAgICAgICAgICAgICcuc2xpZGUnOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbjogJ2Fic29sdXRlJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRvcDogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGxlZnQ6IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICB3aWR0aDogJzEwMCUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgaGVpZ2h0OiAnMTAwJScsXG4gICAgICAgICAgICAgICAgICAgICAgICBkaXNwbGF5OiAndGFibGUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ3RleHQtYWxpZ24nOiAnY2VudGVyJyxcblxuICAgICAgICAgICAgICAgICAgICAgICAgJy5zbGlkZS10aXRsZSc6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbjogJ2Fic29sdXRlJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b3A6ICcyMHB4JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZWZ0OiAnMjBweCcsXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgICAgICAgICAgICAnLnNsaWRlLWlubmVyJzoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdpZHRoOiAnMTAwJScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGlzcGxheTogJ3RhYmxlLWNlbGwnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICd2ZXJ0aWNhbC1hbGlnbic6ICdtaWRkbGUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyYW5zaXRpb246ICdvcGFjaXR5IDAuMnMgZWFzZS1pbi1vdXQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgICAgICAnLnNsaWRlLmFjdGl2ZSc6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyYW5zaXRpb246ICdsZWZ0IDAuMnMgc3RlcC1zdGFydCcsXG4gICAgICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgICAgJy5zbGlkZS5oaWRkZW4nOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cmFuc2l0aW9uOiAnbGVmdCAwLjJzIGxpbmVhcicsXG4gICAgICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgICAgJy5zbGlkZS5oaWRkZW4gLnNsaWRlLXRpdGxlJzoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmlzaWJpbGl0eTogJ2hpZGRlbicsXG4gICAgICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgICAgJy5zbGlkZS5oaWRkZW4gLnNsaWRlLWlubmVyJzoge1xuICAgICAgICAgICAgICAgICAgICAgICAgb3BhY2l0eTogMCxcbiAgICAgICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgICAgICAnLnByaW50IC5zbGlkZSc6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uOiAncmVsYXRpdmUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgd2lkdGg6ICc0MjBtbScsIC8vIERJTiBBMyAoSVNPIDIxNikgbGFuZHNjYXBlXG4gICAgICAgICAgICAgICAgICAgICAgICBoZWlnaHQ6ICcyOTdtbScsXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGNoaWxkcmVuOiBjaGlsZHJlbixcbiAgICAgICAgfSwgbW9yZSk7XG4gICAgfTtcbn0oKSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIFV0aWxzID0gcmVxdWlyZSgnYWxjaGVteS5qcy9saWIvVXRpbHMnKTtcblxuICAgIHJldHVybiBmdW5jdGlvbiB0ZXh0KHR4dCwgZW50aXR5Q3NzLCBtb3JlKSB7XG4gICAgICAgIHJldHVybiBVdGlscy5tZWx0KHtcbiAgICAgICAgICAgIHN0YXRlOiB7XG4gICAgICAgICAgICAgICAgdGV4dDogdHh0XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICB2ZG9tOiB7XG4gICAgICAgICAgICAgICAgcmVuZGVyZXI6IGZ1bmN0aW9uIChjdHgpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHMgPSBjdHguc3RhdGU7XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGN0eC5oKCdkaXYnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU6ICd0ZXh0ICcgKyAocy52YWwoJ2NsYXNzTmFtZScpIHx8ICcnKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkOiBjdHguZW50aXR5SWQsXG4gICAgICAgICAgICAgICAgICAgIH0sIHMudmFsKCd0ZXh0JykpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBjc3M6IHtcbiAgICAgICAgICAgICAgICBlbnRpdHlSdWxlczogZW50aXR5Q3NzLFxuXG4gICAgICAgICAgICAgICAgdHlwZVJ1bGVzOiB7XG4gICAgICAgICAgICAgICAgICAgICcudGV4dCc6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhZGRpbmc6ICcwIDQwcHgnLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWFyZ2luOiAnMjBweCAwJyxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSwgbW9yZSk7XG4gICAgfTtcbn0oKSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgLy8gdmFyIFV0aWxzID0gcmVxdWlyZSgnYWxjaGVteS5qcy9saWIvVXRpbHMnKTtcbiAgICAvLyB2YXIgQ2VudGVyQ29udGFpbmVyID0gcmVxdWlyZSgnLi4vLi4vY29yZS91aS9DZW50ZXJDb250YWluZXInKTtcblxuICAgIHJldHVybiB7XG4gICAgICAgIC8qKiBAbGVuZHMgY29yZS5lbnRpdGllcy5WaWV3cG9ydC5wcm90b3R5cGUgKi9cbiAgICAgICAgZ2xvYmFsVG9Mb2NhbDoge1xuICAgICAgICAgICAgd2luZG93V2lkdGg6ICd3aW5kb3dXaWR0aCcsXG4gICAgICAgICAgICB3aW5kb3dIZWlnaHQ6ICd3aW5kb3dIZWlnaHQnLFxuICAgICAgICAgICAgbW9kZTogJ21vZGUnLFxuICAgICAgICAgICAgZW1haWw6ICdlbWFpbCcsXG4gICAgICAgIH0sXG5cbiAgICAgICAgdmRvbToge1xuICAgICAgICAgICAgcm9vdDogZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3ZpZXdwb3J0JyksXG5cbiAgICAgICAgICAgIHJlbmRlcmVyOiBmdW5jdGlvbiByZW5kZXJWZG9tKGN0eCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBjdHguaCgnYnV0dG9uJywge1xuICAgICAgICAgICAgICAgICAgICBpZDogY3R4LmVudGl0eUlkLFxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU6ICd2aWV3cG9ydCAnICsgY3R4LnN0YXRlLnZhbCgnbW9kZScpLFxuICAgICAgICAgICAgICAgICAgICB0YWJJbmRleDogJzEnLFxuICAgICAgICAgICAgICAgICAgICBhdXRvZm9jdXM6ICcxJyxcbiAgICAgICAgICAgICAgICB9LCBjdHgucmVuZGVyQWxsQ2hpbGRyZW4oKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgY3NzOiB7XG4gICAgICAgICAgICBlbnRpdHlSdWxlczogZnVuY3Rpb24gKHN0YXRlKSB7XG4gICAgICAgICAgICAgICAgaWYgKHN0YXRlLnZhbCgnbW9kZScpID09PSAncHJpbnQnKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBoZWlnaHQ6ICdpbml0aWFsJyxcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICB3aWR0aDogc3RhdGUudmFsKCd3aW5kb3dXaWR0aCcpICsgJ3B4JyxcbiAgICAgICAgICAgICAgICAgICAgaGVpZ2h0OiBzdGF0ZS52YWwoJ3dpbmRvd0hlaWdodCcpICsgJ3B4JyxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgdHlwZVJ1bGVzOiB7XG4gICAgICAgICAgICAgICAgJy52aWV3cG9ydCc6IHtcbiAgICAgICAgICAgICAgICAgICAgcGFkZGluZzogMCxcbiAgICAgICAgICAgICAgICAgICAgYm9yZGVyOiAnbm9uZScsXG4gICAgICAgICAgICAgICAgICAgIGJhY2tncm91bmQ6ICd0cmFuc3BhcmVudCcsXG4gICAgICAgICAgICAgICAgICAgIGNvbG9yOiAnaW5oZXJpdCcsXG4gICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgICcudmlld3BvcnQ6Zm9jdXMnOiB7XG4gICAgICAgICAgICAgICAgICAgICdib3gtc2hhZG93JzogJ2luc2V0IDAgMCAxMHB4IHdoaXRlJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIGV2ZW50czoge1xuICAgICAgICAgICAgY29udGV4dG1lbnU6IGZ1bmN0aW9uIG9uQ29udGV4dE1lbnUoZXZlbnQsIHN0YXRlLCBzZW5kTXNnKSB7XG4gICAgICAgICAgICAgICAgc2VuZE1zZygnbmF2aWdhdGlvbjpwcmV2Jyk7XG4gICAgICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGNsaWNrOiBmdW5jdGlvbiBvbkNsaWNrKGV2ZW50LCBzdGF0ZSwgc2VuZE1zZykge1xuICAgICAgICAgICAgICAgIHNlbmRNc2coJ25hdmlnYXRpb246bmV4dCcpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAga2V5ZG93bjogZnVuY3Rpb24gb25LZXlwcmVzc2VkKGV2ZW50LCBzdGF0ZSwgc2VuZE1zZykge1xuICAgICAgICAgICAgICAgIHZhciBrZXkgPSBldmVudC53aGljaCB8fCBldmVudC5rZXlDb2RlO1xuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKCdvbktleXByZXNzZWQnLCBldmVudCwga2V5KTtcblxuICAgICAgICAgICAgICAgIGlmIChrZXkgPT09IDM3IHx8IGtleSA9PT0gMjcgfHwga2V5ID09PSAzMykgeyAvLyBbPF0sIFtFU0NdLCBbUGdVcF1cbiAgICAgICAgICAgICAgICAgICAgc2VuZE1zZygnbmF2aWdhdGlvbjpwcmV2Jyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoa2V5ID09PSAzOSB8fCBrZXkgPT09IDEzIHx8IGtleSA9PT0gMzQpIHsgLy8gWz5dLCBbUkVUVVJOXSwgW1BnRG93bl1cbiAgICAgICAgICAgICAgICAgICAgc2VuZE1zZygnbmF2aWdhdGlvbjpuZXh0Jyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgIH07XG59KCkpO1xuIiwiKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgZWFjaCA9IHJlcXVpcmUoJ3Byby1zaW5ndWxpcycpO1xuICAgIHZhciBBcHAgPSByZXF1aXJlKCcuL2NvcmUvQXBwJyk7XG4gICAgdmFyIFVJID0gcmVxdWlyZSgnLi9jb3JlL1VJJyk7XG4gICAgdmFyIE9ic2VydmFyaSA9IHJlcXVpcmUoJ2FsY2hlbXkuanMvbGliL09ic2VydmFyaScpO1xuICAgIHZhciBtZXNzYWdlcywgdWksIGFwcDtcbiAgICB2YXIgc2xpZGVzID0gZWFjaChbXG4gICAgICAgIHJlcXVpcmUoJy4vc2xpZGVzL1RpdGxlJyksXG4gICAgICAgIHJlcXVpcmUoJy4vc2xpZGVzL3JhbmstMTAtMScpLFxuICAgICAgICByZXF1aXJlKCcuL3NsaWRlcy9yYW5rLTEwLTInKSxcbiAgICAgICAgcmVxdWlyZSgnLi9zbGlkZXMvcmFuay0wOS0xJyksXG4gICAgICAgIHJlcXVpcmUoJy4vc2xpZGVzL3JhbmstMDktMicpLFxuICAgICAgICByZXF1aXJlKCcuL3NsaWRlcy9yYW5rLTA4LTEnKSxcbiAgICAgICAgcmVxdWlyZSgnLi9zbGlkZXMvcmFuay0wOC0yJyksXG4gICAgICAgIHJlcXVpcmUoJy4vc2xpZGVzL3JhbmstMDctMScpLFxuICAgICAgICByZXF1aXJlKCcuL3NsaWRlcy9yYW5rLTA3LTInKSxcbiAgICAgICAgcmVxdWlyZSgnLi9zbGlkZXMvcmFuay0wNi0xJyksXG4gICAgICAgIHJlcXVpcmUoJy4vc2xpZGVzL3JhbmstMDUtMScpLFxuICAgICAgICByZXF1aXJlKCcuL3NsaWRlcy9yYW5rLTA1LTInKSxcbiAgICAgICAgcmVxdWlyZSgnLi9zbGlkZXMvcmFuay0wNC0xJyksXG4gICAgICAgIHJlcXVpcmUoJy4vc2xpZGVzL3JhbmstMDQtMicpLFxuICAgICAgICByZXF1aXJlKCcuL3NsaWRlcy9yYW5rLTAzLTEnKSxcbiAgICAgICAgcmVxdWlyZSgnLi9zbGlkZXMvcmFuay0wMi0xJyksXG4gICAgICAgIHJlcXVpcmUoJy4vc2xpZGVzL3JhbmstMDEtMScpLFxuICAgICAgICByZXF1aXJlKCcuL3NsaWRlcy9Tb3VyY2VzJyksXG4gICAgICAgIHJlcXVpcmUoJy4vc2xpZGVzL1F1ZXN0aW9ucycpLFxuICAgIF0sIGZ1bmN0aW9uIChzbGlkZSwgaW5kZXgpIHtcbiAgICAgICAgc2xpZGUuc3RhdGUgPSBzbGlkZS5zdGF0ZSB8fCB7fTtcbiAgICAgICAgc2xpZGUuc3RhdGUuaW5kZXggPSBpbmRleDtcblxuICAgICAgICByZXR1cm4gc2xpZGU7XG4gICAgfSk7XG5cbiAgICB3aW5kb3cub25sb2FkID0gZnVuY3Rpb24gb25Mb2FkKCkge1xuICAgICAgICBtZXNzYWdlcyA9IE9ic2VydmFyaS5icmV3KCk7XG5cbiAgICAgICAgdWkgPSBVSS5icmV3KHtcbiAgICAgICAgICAgIG1lc3NhZ2VzOiBtZXNzYWdlcyxcbiAgICAgICAgICAgIHNsaWRlczogc2xpZGVzXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGFwcCA9IEFwcC5icmV3KHtcbiAgICAgICAgICAgIHVpOiB1aSxcbiAgICAgICAgICAgIG1lc3NhZ2VzOiBtZXNzYWdlcyxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgYXBwLnN0YXRlID0gYXBwLnN0YXRlLnNldCh7XG4gICAgICAgICAgICBudW1PZlNsaWRlczogc2xpZGVzLmxlbmd0aCxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgYXBwLmxhdW5jaCgpO1xuXG4gICAgICAgIHdpbmRvdy5hcHAgPSBhcHA7IC8vIGdsb2JhbCByZWZlcmVuY2UgZm9yIGRlYnVnZ2luZ1xuICAgIH07XG5cbiAgICB3aW5kb3cub251bmxvYWQgPSBmdW5jdGlvbiBvblVubG9hZCgpIHtcbiAgICAgICAgW2FwcCwgdWksIG1lc3NhZ2VzXS5mb3JFYWNoKGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgICAgIG9iai5kaXNwb3NlKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHdpbmRvdy5hcHAgPSBudWxsO1xuICAgIH07XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBzbGlkZSA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvU2xpZGUnKTtcbiAgICB2YXIgdGV4dCA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvVGV4dCcpO1xuXG4gICAgcmV0dXJuIHNsaWRlKFtcbiAgICAgICAgdGV4dCgnRnJhZ2VuPycpXG4gICAgXSk7XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBzbGlkZSA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvU2xpZGUnKTtcbiAgICB2YXIgdGV4dCA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvQmlnVGV4dCcpO1xuXG4gICAgcmV0dXJuIHNsaWRlKCdRdWVsbGVuIHVuZCBMaW5rcycsIFtcbiAgICAgICAgdGV4dCgnLSBFLiBEZXJieSBhbmQgRC4gTGFyc2VuLiBBZ2lsZSBSZXRyb3NwZWN0aXZlcywgUHJhZ21hdGljIEJvb2tzaGVsZiwgVVNBLCAyMDA2JyksXG4gICAgICAgIHRleHQoJy0gQy4gQmFsZGF1Zi4gUmV0ci1PLU1hdCwgaHR0cDovL3d3dy5wbGFucy1mb3ItcmV0cm9zcGVjdGl2ZXMuY29tLycpLFxuICAgICAgICB0ZXh0KCctIGh0dHA6Ly9taWNoYnVldHQuZ2l0aHViLmlvL3JldHJvLWxlYWRlci10aXBzLycpLFxuICAgIF0pO1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgc2xpZGUgPSByZXF1aXJlKCcuLi9jb3JlL3VpL1NsaWRlJyk7XG4gICAgdmFyIGh0bWwgPSByZXF1aXJlKCcuLi9jb3JlL3VpL0h0bWwnKTtcblxuICAgIHJldHVybiBzbGlkZSgnJywgW1xuICAgICAgICBodG1sKGZ1bmN0aW9uIChoKSB7XG4gICAgICAgICAgICByZXR1cm4gaCgnZGl2LnRpdGxlLWJsb2NrJywgW1xuICAgICAgICAgICAgICAgIGgoJ2Rpdi5zcGVha2VyJywgJ01pY2hhZWwgQsO8dHRuZXIgfCBGbHllcmFsYXJtJyksXG4gICAgICAgICAgICAgICAgaCgnZGl2LnRpdGxlJywgJ0RpZSAxMCB3aWNodGlnc3RlbiBEaW5nZSwgZGllIG1hbiBiZWltIE1vZGVyaWVyZW4gZWluZXIgUmV0cm9zcGVrdGl2ZSBiZWFjaHRlbiBzb2xsdGUnKSxcbiAgICAgICAgICAgIF0pO1xuICAgICAgICB9KVxuICAgIF0pO1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgc2xpZGUgPSByZXF1aXJlKCcuLi9jb3JlL3VpL1NsaWRlJyk7XG4gICAgdmFyIHRleHQgPSByZXF1aXJlKCcuLi9jb3JlL3VpL0JpZ1RleHQnKTtcblxuICAgIHJldHVybiBzbGlkZSgnJywgW1xuICAgICAgICB0ZXh0KCcjMScpLFxuICAgICAgICB0ZXh0KCdIYWJlIFNwYcOfIScpLFxuICAgIF0pO1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgc2xpZGUgPSByZXF1aXJlKCcuLi9jb3JlL3VpL1NsaWRlJyk7XG4gICAgdmFyIHRleHQgPSByZXF1aXJlKCcuLi9jb3JlL3VpL0JpZ1RleHQnKTtcblxuICAgIHJldHVybiBzbGlkZSgnJywgW1xuICAgICAgICB0ZXh0KCcjMicpLFxuICAgICAgICB0ZXh0KCdLZWluZSBQYW5payEnKVxuICAgIF0pO1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgc2xpZGUgPSByZXF1aXJlKCcuLi9jb3JlL3VpL1NsaWRlJyk7XG4gICAgdmFyIHRleHQgPSByZXF1aXJlKCcuLi9jb3JlL3VpL0JpZ1RleHQnKTtcblxuICAgIHJldHVybiBzbGlkZSgnJywgW1xuICAgICAgICB0ZXh0KCcjMycpLFxuICAgICAgICB0ZXh0KCdHZWhlIG9mZmVuIGluIGRpZSBSZXRyb3NwZWt0aXZlIScpLFxuICAgIF0pO1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgc2xpZGUgPSByZXF1aXJlKCcuLi9jb3JlL3VpL1NsaWRlJyk7XG4gICAgdmFyIHRleHQgPSByZXF1aXJlKCcuLi9jb3JlL3VpL0JpZ1RleHQnKTtcblxuICAgIHJldHVybiBzbGlkZSgnJywgW1xuICAgICAgICB0ZXh0KCcjNCcpLFxuICAgICAgICB0ZXh0KCdBcmJlaXRlIGFuIERlaW5lbiBGw6RoaWdrZWl0ZW4hJyksXG4gICAgXSk7XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBzbGlkZSA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvU2xpZGUnKTtcbiAgICB2YXIgdGV4dCA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvQmlnVGV4dCcpO1xuXG4gICAgcmV0dXJuIHNsaWRlKCcjNDogQXJiZWl0ZSBhbiBEZWluZW4gRsOkaGlna2VpdGVuIScsIFtcbiAgICAgICAgdGV4dCgnLSBBcmJlaXRlbiBhbSBGbGlwLUNoYXJ0JyksXG4gICAgICAgIHRleHQoJy0gVW1nYW5nIG1pdCBBa3Rpdml0w6R0ZW4nKSxcbiAgICAgICAgdGV4dCgnLSBIaWxmZSBiZWkgZGVyIEVudHNjaGVpZHVuZ3NmaW5kdW5nJyksXG4gICAgICAgIHRleHQoJy0gVmVyc3RlaGVuIHVuZCBCZWVpbmZsdXNzZW4gZGVyIEdydXBwZW5keW5hbWlrJyksXG4gICAgICAgIHRleHQoJy0gVmVyYmVzc2VydW5nIGRlciBTZWxic3R3YWhybmVobXVuZycpLFxuICAgIF0pO1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgc2xpZGUgPSByZXF1aXJlKCcuLi9jb3JlL3VpL1NsaWRlJyk7XG4gICAgdmFyIHRleHQgPSByZXF1aXJlKCcuLi9jb3JlL3VpL0JpZ1RleHQnKTtcblxuICAgIHJldHVybiBzbGlkZSgnJywgW1xuICAgICAgICB0ZXh0KCcjNScpLFxuICAgICAgICB0ZXh0KCdHZWhlIGJlaHV0c2FtIG1pdCBMb2IgdW0hJyksXG4gICAgXSk7XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBzbGlkZSA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvU2xpZGUnKTtcbiAgICB2YXIgdGV4dCA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvQmlnVGV4dCcpO1xuXG4gICAgcmV0dXJuIHNsaWRlKCcjNTogR2VoZSBiZWh1dHNhbSBtaXQgTG9iIHVtIScsIFtcbiAgICAgICAgdGV4dCgnLSBEYXMgcmVjaHRlIExvYiB6dXIgcmVjaHRlbiBaZWl0IGlzdCBHb2xkIHdlcnQnKSxcbiAgICAgICAgdGV4dCgnLSBNZWluZSBlcyBlaHJsaWNoIG9kZXIgbGFzc2UgZXMnKSxcbiAgICAgICAgdGV4dCgnLSBMb2JlIEFuc3RyZW5ndW5nLCBuaWNodCBJbnRlbGxpZ2VueicpLFxuICAgIF0pO1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgc2xpZGUgPSByZXF1aXJlKCcuLi9jb3JlL3VpL1NsaWRlJyk7XG4gICAgdmFyIHRleHQgPSByZXF1aXJlKCcuLi9jb3JlL3VpL0JpZ1RleHQnKTtcblxuICAgIHJldHVybiBzbGlkZSgnJywgW1xuICAgICAgICB0ZXh0KCcjNicpLFxuICAgICAgICB0ZXh0KCdEZXIgTW9kZXJhdG9yIGlzdCBrZWluIFRlaWxuZWhtZXIhJyksXG4gICAgXSk7XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBzbGlkZSA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvU2xpZGUnKTtcbiAgICB2YXIgdGV4dCA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvQmlnVGV4dCcpO1xuXG4gICAgcmV0dXJuIHNsaWRlKCcnLCBbXG4gICAgICAgIHRleHQoJyM3JyksXG4gICAgICAgIHRleHQoJ1ZvcmJlcmVpdHVuZy4gVm9yYmVyZWl0dW5nLiBWb3JiZXJlaXR1bmchJyksXG4gICAgXSk7XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBzbGlkZSA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvU2xpZGUnKTtcbiAgICB2YXIgdGV4dCA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvQmlnVGV4dCcpO1xuXG4gICAgcmV0dXJuIHNsaWRlKCcjNzogVm9yYmVyZWl0dW5nLiBWb3JiZXJlaXR1bmcuIFZvcmJlcmVpdHVuZyEnLCBbXG4gICAgICAgIHRleHQoJy0gV2lldmllbCBaZWl0IG11c3MgZWluZ2VwbGFudCB3ZXJkZW4/JyksXG4gICAgICAgIHRleHQoJy0gV2VsY2hlIEFrdGl2aXTDpHRlbiBzaW5kIHNpbm52b2xsPycpLFxuICAgICAgICB0ZXh0KCctIFdpZSB0aWNrdCBkYXMgVGVhbT8nKSwgLy8gTWFuYWdlciB6dXIgU2VpdGUgbmVobWVuXG4gICAgICAgIHRleHQoJy0gR2lidCBlcyBlaW5lbiBQbGFuIEI/JyksXG4gICAgICAgIHRleHQoJy0gR2lidCBlcyBlaW5lbiBQbGFuIEM/JyksXG4gICAgXSk7XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBzbGlkZSA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvU2xpZGUnKTtcbiAgICB2YXIgdGV4dCA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvQmlnVGV4dCcpO1xuXG4gICAgcmV0dXJuIHNsaWRlKCcnLCBbXG4gICAgICAgIHRleHQoJyM4JyksXG4gICAgICAgIHRleHQoJ05pbW0gRGlyIGF1c3JlaWNoZW5kIFplaXQhJyksXG4gICAgXSk7XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBzbGlkZSA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvU2xpZGUnKTtcbiAgICB2YXIgaHRtbCA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvSHRtbCcpO1xuXG4gICAgcmV0dXJuIHNsaWRlKCcjODogTmltbSBEaXIgYXVzcmVpY2hlbmQgWmVpdCEnLCBbXG4gICAgICAgIGh0bWwoZnVuY3Rpb24gKGgpIHtcbiAgICAgICAgICAgIHJldHVybiBoKCdkaXYuYmxvY2snLCBbJ0ZhdXN0cmVnZWw6IDNoIHBybyBNb25hdCwgYWJlciBiZWFjaHRlOicsIGgoJ2JyJyksIGgoJ3VsJywgW1xuICAgICAgICAgICAgICAgIGgoJ2xpJywgJ0dyw7bDn2UgdW5kIFp1c2FtbWVuc2V0enVuZyBkZXIgR3J1cHBlJyksXG4gICAgICAgICAgICAgICAgaCgnbGknLCAnS29uZmxpa3Rwb3RlbnppYWwnKSxcbiAgICAgICAgICAgICAgICBoKCdsaScsICdLb21wbGV4aXTDpHQnKSxcbiAgICAgICAgICAgICAgICBoKCdsaScsICdQYXVzZW4nKSxcbiAgICAgICAgICAgICAgICBoKCdsaScsICdJbSBad2VpZmVsIG1laHIgWmVpdCBlaW5wbGFuZW4nKSxcbiAgICAgICAgICAgIF0pXSk7XG4gICAgICAgIH0pXG4gICAgXSk7XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBzbGlkZSA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvU2xpZGUnKTtcbiAgICB2YXIgdGV4dCA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvQmlnVGV4dCcpO1xuXG4gICAgcmV0dXJuIHNsaWRlKCcnLCBbXG4gICAgICAgIHRleHQoJyM5JyksXG4gICAgICAgIHRleHQoJ1NvcmdlIGbDvHIgQWJ3ZWNoc2x1bmchJyksXG4gICAgXSk7XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBzbGlkZSA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvU2xpZGUnKTtcbiAgICB2YXIgdGV4dCA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvQmlnVGV4dCcpO1xuXG4gICAgcmV0dXJuIHNsaWRlKCcjOTogU29yZ2UgZsO8ciBBYndlY2hzbHVuZyEnLCBbXG4gICAgICAgIHRleHQoJ1NwZWVkYm9hdCAtIE1hZCBTYWQgR2xhZCAtIFN0YXJmaXNoJyksXG4gICAgICAgIHRleHQoJ1N0b3J5IE9zY2FycyAtIExlYW4gQ29mZmVlJyksXG4gICAgICAgIHRleHQoJ0ZpdmUgV2h5cyAtIFVubGlrZWx5IFN1cGVyaGVyb2VzJyksXG4gICAgICAgIHRleHQoJ1RpbWVsaW5lIC0gUGFyayBCZW5jaCcpLFxuICAgICAgICB0ZXh0KCcuLi4nKSxcbiAgICBdKTtcbn0oKSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIHNsaWRlID0gcmVxdWlyZSgnLi4vY29yZS91aS9TbGlkZScpO1xuICAgIHZhciB0ZXh0ID0gcmVxdWlyZSgnLi4vY29yZS91aS9CaWdUZXh0Jyk7XG5cbiAgICByZXR1cm4gc2xpZGUoJycsIFtcbiAgICAgICAgdGV4dCgnIzEwJyksXG4gICAgICAgIHRleHQoJ0xhc3NlIGRpZSBTdHJ1a3R1ciBkZXIgUmV0cm9zcGVrdGl2ZSB1bnZlcsOkbmRlcnQhJyksXG4gICAgXSk7XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBzbGlkZSA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvU2xpZGUnKTtcbiAgICAvLyB2YXIgaHRtbCA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvSHRtbCcpO1xuICAgIHZhciB0ZXh0ID0gcmVxdWlyZSgnLi4vY29yZS91aS9CaWdUZXh0Jyk7XG5cbiAgICByZXR1cm4gc2xpZGUoJyMxMDogTGFzc2UgZGllIFN0cnVrdHVyIGRlciBSZXRyb3NwZWt0aXZlIHVudmVyw6RuZGVydCEnLCBbXG4gICAgICAgIC8vIGh0bWwoZnVuY3Rpb24gKGgpIHtcbiAgICAgICAgLy8gICAgIHJldHVybiBoKCdvbC5ibG9jaycsIFtcbiAgICAgICAgLy8gICAgICAgICBoKCdsaScsICdTZXQgdGhlIFN0YWdlJyksXG4gICAgICAgIC8vICAgICAgICAgaCgnbGknLCAnR2F0aGVyIERhdGEnKSxcbiAgICAgICAgLy8gICAgICAgICBoKCdsaScsICdHZW5lcmF0ZSBJbnNpZ2h0cycpLFxuICAgICAgICAvLyAgICAgICAgIGgoJ2xpJywgJ0RlY2lkZSBXaGF0IFRvIERvJyksXG4gICAgICAgIC8vICAgICAgICAgaCgnbGknLCAnQ2xvc2UgVGhlIFJldHJvJyksXG4gICAgICAgIC8vICAgICBdKTtcbiAgICAgICAgLy8gfSlcblxuICAgICAgICB0ZXh0KCcxLiBTZXQgdGhlIFN0YWdlJyksXG4gICAgICAgIHRleHQoJzIuIEdhdGhlciBEYXRhJyksXG4gICAgICAgIHRleHQoJzMuIEdlbmVyYXRlIEluc2lnaHRzJyksXG4gICAgICAgIHRleHQoJzQuIERlY2lkZSBXaGF0IHRvIERvJyksXG4gICAgICAgIHRleHQoJzUuIENsb3NlIHRoZSBSZXRybycpLFxuICAgIF0pO1xufSgpKTtcbiJdfQ==
