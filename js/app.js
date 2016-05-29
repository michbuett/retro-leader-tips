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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYWxjaGVteS5qcy9saWIvQWRtaW5pc3RyYXRvci5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL2xpYi9BcG90aGVjYXJpdXMuanMiLCJub2RlX21vZHVsZXMvYWxjaGVteS5qcy9saWIvQXBwbGljYXR1cy5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL2xpYi9Dc3NSZW5kZXJTeXN0ZW0uanMiLCJub2RlX21vZHVsZXMvYWxjaGVteS5qcy9saWIvRGVsZWdhdHVzLmpzIiwibm9kZV9tb2R1bGVzL2FsY2hlbXkuanMvbGliL0V2ZW50U3lzdGVtLmpzIiwibm9kZV9tb2R1bGVzL2FsY2hlbXkuanMvbGliL09ic2VydmFyaS5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL2xpYi9TdGF0ZVN5c3RlbS5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL2xpYi9TdHlsdXMuanMiLCJub2RlX21vZHVsZXMvYWxjaGVteS5qcy9saWIvVXRpbHMuanMiLCJub2RlX21vZHVsZXMvYWxjaGVteS5qcy9saWIvVkRvbVJlbmRlclN5c3RlbS5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL25vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS9kaWZmLmpzIiwibm9kZV9tb2R1bGVzL2FsY2hlbXkuanMvbm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL2guanMiLCJub2RlX21vZHVsZXMvYWxjaGVteS5qcy9ub2RlX21vZHVsZXMvdmlydHVhbC1kb20vbm9kZV9tb2R1bGVzL2Jyb3dzZXItc3BsaXQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvYWxjaGVteS5qcy9ub2RlX21vZHVsZXMvdmlydHVhbC1kb20vbm9kZV9tb2R1bGVzL2V2LXN0b3JlL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2FsY2hlbXkuanMvbm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL25vZGVfbW9kdWxlcy9ldi1zdG9yZS9ub2RlX21vZHVsZXMvaW5kaXZpZHVhbC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL25vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS9ub2RlX21vZHVsZXMvZXYtc3RvcmUvbm9kZV9tb2R1bGVzL2luZGl2aWR1YWwvb25lLXZlcnNpb24uanMiLCJub2RlX21vZHVsZXMvYWxjaGVteS5qcy9ub2RlX21vZHVsZXMvdmlydHVhbC1kb20vbm9kZV9tb2R1bGVzL2dsb2JhbC9kb2N1bWVudC5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL25vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS9ub2RlX21vZHVsZXMvaXMtb2JqZWN0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2FsY2hlbXkuanMvbm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL25vZGVfbW9kdWxlcy94LWlzLWFycmF5L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2FsY2hlbXkuanMvbm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3BhdGNoLmpzIiwibm9kZV9tb2R1bGVzL2FsY2hlbXkuanMvbm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zkb20vYXBwbHktcHJvcGVydGllcy5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL25vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92ZG9tL2NyZWF0ZS1lbGVtZW50LmpzIiwibm9kZV9tb2R1bGVzL2FsY2hlbXkuanMvbm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zkb20vZG9tLWluZGV4LmpzIiwibm9kZV9tb2R1bGVzL2FsY2hlbXkuanMvbm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zkb20vcGF0Y2gtb3AuanMiLCJub2RlX21vZHVsZXMvYWxjaGVteS5qcy9ub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdmRvbS9wYXRjaC5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL25vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92ZG9tL3VwZGF0ZS13aWRnZXQuanMiLCJub2RlX21vZHVsZXMvYWxjaGVteS5qcy9ub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdmlydHVhbC1oeXBlcnNjcmlwdC9ob29rcy9ldi1ob29rLmpzIiwibm9kZV9tb2R1bGVzL2FsY2hlbXkuanMvbm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3ZpcnR1YWwtaHlwZXJzY3JpcHQvaG9va3Mvc29mdC1zZXQtaG9vay5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL25vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92aXJ0dWFsLWh5cGVyc2NyaXB0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2FsY2hlbXkuanMvbm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3ZpcnR1YWwtaHlwZXJzY3JpcHQvcGFyc2UtdGFnLmpzIiwibm9kZV9tb2R1bGVzL2FsY2hlbXkuanMvbm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zub2RlL2hhbmRsZS10aHVuay5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL25vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92bm9kZS9pcy10aHVuay5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL25vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92bm9kZS9pcy12aG9vay5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL25vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92bm9kZS9pcy12bm9kZS5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL25vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92bm9kZS9pcy12dGV4dC5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL25vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92bm9kZS9pcy13aWRnZXQuanMiLCJub2RlX21vZHVsZXMvYWxjaGVteS5qcy9ub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdm5vZGUvdmVyc2lvbi5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL25vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92bm9kZS92bm9kZS5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL25vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92bm9kZS92cGF0Y2guanMiLCJub2RlX21vZHVsZXMvYWxjaGVteS5qcy9ub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdm5vZGUvdnRleHQuanMiLCJub2RlX21vZHVsZXMvYWxjaGVteS5qcy9ub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdnRyZWUvZGlmZi1wcm9wcy5qcyIsIm5vZGVfbW9kdWxlcy9hbGNoZW15LmpzL25vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92dHJlZS9kaWZmLmpzIiwibm9kZV9tb2R1bGVzL2NvcXVvLXZlbmVudW0vbm9kZV9tb2R1bGVzL2RlbGlnYXJlL3NyYy9kZWxpZ2FyZS5qcyIsIm5vZGVfbW9kdWxlcy9jb3F1by12ZW5lbnVtL3NyYy9jb3F1by12ZW5lbnVtLmpzIiwibm9kZV9tb2R1bGVzL2dydW50LWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcmVzb2x2ZS9lbXB0eS5qcyIsIm5vZGVfbW9kdWxlcy9pbW11dGFiaWxpcy9zcmMvaW1tdXRhYmlsaXMuanMiLCJub2RlX21vZHVsZXMvcHJvLXNpbmd1bGlzL3NyYy9lYWNoLmpzIiwic3JjL2pzL2NvcmUvQXBwLmpzIiwic3JjL2pzL2NvcmUvVUkuanMiLCJzcmMvanMvY29yZS9jb250cm9sbGVyL05hdmlnYXRpb24uanMiLCJzcmMvanMvY29yZS91aS9CaWdUZXh0LmpzIiwic3JjL2pzL2NvcmUvdWkvSHRtbC5qcyIsInNyYy9qcy9jb3JlL3VpL1NsaWRlLmpzIiwic3JjL2pzL2NvcmUvdWkvVGV4dC5qcyIsInNyYy9qcy9jb3JlL3VpL1ZpZXdwb3J0LmpzIiwic3JjL2pzL2luaXQuanMiLCJzcmMvanMvc2xpZGVzL1F1ZXN0aW9ucy5qcyIsInNyYy9qcy9zbGlkZXMvU291cmNlcy5qcyIsInNyYy9qcy9zbGlkZXMvVGl0bGUuanMiLCJzcmMvanMvc2xpZGVzL3JhbmstMDEtMS5qcyIsInNyYy9qcy9zbGlkZXMvcmFuay0wMi0xLmpzIiwic3JjL2pzL3NsaWRlcy9yYW5rLTAzLTEuanMiLCJzcmMvanMvc2xpZGVzL3JhbmstMDQtMS5qcyIsInNyYy9qcy9zbGlkZXMvcmFuay0wNC0yLmpzIiwic3JjL2pzL3NsaWRlcy9yYW5rLTA1LTEuanMiLCJzcmMvanMvc2xpZGVzL3JhbmstMDUtMi5qcyIsInNyYy9qcy9zbGlkZXMvcmFuay0wNi0xLmpzIiwic3JjL2pzL3NsaWRlcy9yYW5rLTA3LTEuanMiLCJzcmMvanMvc2xpZGVzL3JhbmstMDctMi5qcyIsInNyYy9qcy9zbGlkZXMvcmFuay0wOC0xLmpzIiwic3JjL2pzL3NsaWRlcy9yYW5rLTA4LTIuanMiLCJzcmMvanMvc2xpZGVzL3JhbmstMDktMS5qcyIsInNyYy9qcy9zbGlkZXMvcmFuay0wOS0yLmpzIiwic3JjL2pzL3NsaWRlcy9yYW5rLTEwLTEuanMiLCJzcmMvanMvc2xpZGVzL3JhbmstMTAtMi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMU1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcFBBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwUUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyT0E7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUN0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1JBO0FBQ0E7QUFDQTtBQUNBOztBQ0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM2FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeExBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIGltbXV0YWJsZSA9IHJlcXVpcmUoJ2ltbXV0YWJpbGlzJyk7XG4gICAgdmFyIGNvcXVvVmVuZW51bSA9IHJlcXVpcmUoJ2NvcXVvLXZlbmVudW0nKTtcbiAgICB2YXIgZWFjaCA9IHJlcXVpcmUoJ3Byby1zaW5ndWxpcycpO1xuICAgIHZhciB1dGlscyA9IHJlcXVpcmUoJy4vVXRpbHMnKTtcblxuICAgIC8qKlxuICAgICAqIERlc2NyaXB0aW9uXG4gICAgICpcbiAgICAgKiBAY2xhc3NcbiAgICAgKiBAbmFtZSBhbGNoZW15LmVjcy5BZG1pbmlzdHJhdG9yXG4gICAgICovXG4gICAgcmV0dXJuIGNvcXVvVmVuZW51bSh7XG4gICAgICAgIC8qKiBAbGVuZHMgYWxjaGVteS5lY3MuQWRtaW5pc3RyYXRvci5wcm90b3R5cGUgKi9cblxuICAgICAgICAvKipcbiAgICAgICAgICogQWRkcyBhIG5ldyBjb21wb25lbnQgc3lzdGVtLiBBbnkgY29tcG9uZW50IHN5c3RlbSBzaG91bGQgaW1wbGVtZW50XG4gICAgICAgICAqIHRoZSBtZXRob2QgXCJ1cGRhdGVcIlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gbmV3U3lzdGVtIFRoZSBuZXcgY29tcG9uZW50IHN5c3RlbVxuICAgICAgICAgKi9cbiAgICAgICAgYWRkU3lzdGVtOiBmdW5jdGlvbiAobmV3U3lzdGVtKSB7XG4gICAgICAgICAgICBuZXdTeXN0ZW0uZW50aXRpZXMgPSB0aGlzLnJlcG87XG4gICAgICAgICAgICB0aGlzLnN5c3RlbXMucHVzaChuZXdTeXN0ZW0pO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTZXRzIGFuZCBvdmVycmlkZXMgdGhlIGRlZmF1bHRzIGNvbXBvbmVudHMgZm9yIGEgZ2l2ZW4gZW50aXR5XG4gICAgICAgICAqIHR5bGVcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IGtleSBUaGUgZW50aXR5IHR5cGUgaWRlbnRpZmllclxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gY29tcG9uZW50cyBUaGUgZGVmYXVsdCBjb21wb25lbnRzIGZvciB0aGVcbiAgICAgICAgICogICAgICBlbnRpdHkgdHlwZVxuICAgICAgICAgKi9cbiAgICAgICAgc2V0RW50aXR5RGVmYXVsdHM6IGZ1bmN0aW9uIChrZXksIGNvbXBvbmVudHMpIHtcbiAgICAgICAgICAgIHRoaXMuZGVmYXVsdHNba2V5XSA9IGltbXV0YWJsZS5mcm9tSlMoY29tcG9uZW50cyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEluaXRpYWxpemVzIHRoZSBhcHBsaWN0aW9uIGVudGl0aWVzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7QXJyYXl9IGxpc3QgQSBsaXN0IG9mIGVudGl0eSBjb25maWd1cmF0aW9ucyBvciBmdW5jdGlvbnNcbiAgICAgICAgICogICAgICB3aGljaCB3aWxsIGNyZWF0ZSBlbnRpdHkgY29uZmlndXJhdGlvbnMgYmFzZWQgb24gdGhlIGN1cnJlbnRcbiAgICAgICAgICogICAgICBhcHBsaWN0aW9uIHN0YXRlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7SW1tdXRhdGFibGV9IHN0YXRlIFRoZSBpbml0aWFsIGFwcGxpY2F0aW9uIHN0YXRlXG4gICAgICAgICAqL1xuICAgICAgICBpbml0RW50aXRpZXM6IGZ1bmN0aW9uIChsaXN0LCBzdGF0ZSkge1xuICAgICAgICAgICAgZWFjaChsaXN0LCBmdW5jdGlvbiAoY2ZnKSB7XG4gICAgICAgICAgICAgICAgaWYgKHV0aWxzLmlzRnVuY3Rpb24oY2ZnKSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmVudGl0aWVzRnJvbVN0YXRlLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgZm46IGNmZyxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLmNyZWF0ZUVudGl0eShjZmcpO1xuICAgICAgICAgICAgfSwgdGhpcyk7XG5cbiAgICAgICAgICAgIGVhY2godGhpcy5lbnRpdGllc0Zyb21TdGF0ZSwgdGhpcy51cGRhdGVEeW5hbWljRW50aXRpZXMsIHRoaXMsIFtzdGF0ZV0pO1xuXG4gICAgICAgICAgICB0aGlzLmxhc3RTdGF0ZSA9IHN0YXRlO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBVcGRhdGVzIGFsbCByZWdpc3RlcmVkIHN5c3RlbXMgYW5kIGV4aXN0aW5nIGVudGl0aWVzIHdpdGggdGhlIGN1cnJlbnRcbiAgICAgICAgICogYXBwbGljYXRpb24gc3RhdGVcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtJbW11dGF0YWJsZX0gc3RhdGUgVGhlIGN1cnJlbnQgYXBwbGljYXRpb24gc3RhdGVcbiAgICAgICAgICovXG4gICAgICAgIHVwZGF0ZTogZnVuY3Rpb24gKHN0YXRlKSB7XG4gICAgICAgICAgICB2YXIgYXJncyA9IFtzdGF0ZV07XG5cbiAgICAgICAgICAgIGlmIChzdGF0ZSAhPT0gdGhpcy5sYXN0U3RhdGUpIHtcbiAgICAgICAgICAgICAgICBlYWNoKHRoaXMuZW50aXRpZXNGcm9tU3RhdGUsIHRoaXMudXBkYXRlRHluYW1pY0VudGl0aWVzLCB0aGlzLCBhcmdzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZWFjaCh0aGlzLnN5c3RlbXMsIHRoaXMudXBkYXRlU3lzdGVtLCB0aGlzLCBhcmdzKTtcblxuICAgICAgICAgICAgdGhpcy5sYXN0U3RhdGUgPSBzdGF0ZTtcbiAgICAgICAgfSxcblxuICAgICAgICAvL1xuICAgICAgICAvL1xuICAgICAgICAvLyBwcml2YXRlIGhlbHBlclxuICAgICAgICAvL1xuICAgICAgICAvL1xuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB1cGRhdGVTeXN0ZW06IGZ1bmN0aW9uIChzeXN0ZW0sIGluZGV4LCBzdGF0ZSkge1xuICAgICAgICAgICAgc3lzdGVtLnVwZGF0ZShzdGF0ZSk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHVwZGF0ZUR5bmFtaWNFbnRpdGllczogZnVuY3Rpb24gKGNmZywgaW5kZXgsIHN0YXRlKSB7XG4gICAgICAgICAgICB2YXIgY3VycmVudExpc3QgPSBjZmcuY3VycmVudCB8fCBbXTtcbiAgICAgICAgICAgIHZhciBuZXdMaXN0ID0gdGhpcy5jcmVhdGVFbnRpdHlNYXAoY2ZnLmZuKHN0YXRlKSk7XG4gICAgICAgICAgICB2YXIgdG9CZVJlbW92ZWQgPSB0aGlzLmZpbmRJdGVtc05vdEluTGlzdChjdXJyZW50TGlzdCwgbmV3TGlzdCk7XG4gICAgICAgICAgICB2YXIgdG9CZUNyZWF0ZWQgPSB0aGlzLmZpbmRJdGVtc05vdEluTGlzdChuZXdMaXN0LCBjdXJyZW50TGlzdCk7XG5cbiAgICAgICAgICAgIGVhY2goT2JqZWN0LmtleXModG9CZVJlbW92ZWQpLCB0aGlzLnJlbW92ZUVudGl0eSwgdGhpcyk7XG4gICAgICAgICAgICBlYWNoKHRvQmVDcmVhdGVkLCB0aGlzLmNyZWF0ZUVudGl0eSwgdGhpcyk7XG5cbiAgICAgICAgICAgIGNmZy5jdXJyZW50ID0gbmV3TGlzdDtcbiAgICAgICAgfSxcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgY3JlYXRlRW50aXR5TWFwOiBmdW5jdGlvbiAobGlzdCkge1xuICAgICAgICAgICAgdmFyIHJlc3VsdCA9IHt9O1xuXG4gICAgICAgICAgICBlYWNoKGxpc3QsIGZ1bmN0aW9uIChjZmcpIHtcbiAgICAgICAgICAgICAgICByZXN1bHRbY2ZnLmlkXSA9IGNmZztcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICBmaW5kSXRlbXNOb3RJbkxpc3Q6IGZ1bmN0aW9uIChsaXN0MSwgbGlzdDIpIHtcbiAgICAgICAgICAgIHJldHVybiBlYWNoKGxpc3QxLCBmdW5jdGlvbiAoaXRlbSwga2V5KSB7XG4gICAgICAgICAgICAgICAgaWYgKCFsaXN0MltrZXldKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBpdGVtO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICBjcmVhdGVFbnRpdHk6IGZ1bmN0aW9uIChjZmcpIHtcbiAgICAgICAgICAgIHZhciBkZWZhdWx0cyA9IHRoaXMuZGVmYXVsdHNbY2ZnLnR5cGVdO1xuICAgICAgICAgICAgaWYgKGRlZmF1bHRzKSB7XG4gICAgICAgICAgICAgICAgY2ZnID0gZGVmYXVsdHMuc2V0KGNmZykudmFsKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChjZmcuY2hpbGRyZW4pIHtcbiAgICAgICAgICAgICAgICBjZmcuY2hpbGRyZW4gPSBlYWNoKGNmZy5jaGlsZHJlbiwgdGhpcy5jcmVhdGVFbnRpdHksIHRoaXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5yZXBvLmNyZWF0ZUVudGl0eShjZmcpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICByZW1vdmVFbnRpdHk6IGZ1bmN0aW9uIChlbnRpdHkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnJlcG8ucmVtb3ZlRW50aXR5KGVudGl0eSk7XG4gICAgICAgIH1cblxuICAgIH0pLndoZW5CcmV3ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGVudGl0eSByZXBvc2l0b3J5XG4gICAgICAgICAqXG4gICAgICAgICAqIEBwcm9wZXJ0eSByZXBvXG4gICAgICAgICAqIEB0eXBlIGFsY2hlbXkuZWNzLkFwb3RoZWNhcml1c1xuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5yZXBvID0gbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGxpc3Qgb2YgY29tcG9uZW50IHN5c3RlbXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHByb3BlcnR5IHN5c3RlbXNcbiAgICAgICAgICogQHR5cGUgQXJyYXlcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuc3lzdGVtcyA9IFtdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBIGxpc3Qgb2YgZnVuY3Rpb25zIHdoaWNoIGRlZmluZXMgYSBzZXQgb2YgZW50aXRpZXMgZGVwZW5kaW5nXG4gICAgICAgICAqIG9uIHRoZSBjdXJyZW50IGFwcGxpY2F0aW9uIHN0YXRlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwcm9wZXJ0eSBlbnRpdGllc0Zyb21TdGF0ZVxuICAgICAgICAgKiBAdHlwZSBBcnJheVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5lbnRpdGllc0Zyb21TdGF0ZSA9IFtdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgbGFzdCBhcHBsaWNhdGlvbiBzdGF0ZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcHJvcGVydHkgbGFzdFN0YXRlXG4gICAgICAgICAqIEB0eXBlIEltbXV0YXRhYmxlXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxhc3RTdGF0ZSA9IG51bGw7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBzZXQgb2YgY29tcG9uZW50IGRlZmF1bHRzIChtYXAgZW50aXR5VHlwZSAtPiBkZWZhdWx0IHZhbHVlcylcbiAgICAgICAgICpcbiAgICAgICAgICogQHByb3BlcnR5IGRlZmF1bHRzXG4gICAgICAgICAqIEB0eXBlIE9iamVjdFxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5kZWZhdWx0cyA9IHt9O1xuXG4gICAgfSkud2hlbkRpc3Bvc2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZWFjaCh0aGlzLnN5c3RlbXMsIGZ1bmN0aW9uIChzeXN0ZW0sIGluZGV4KSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbXNbaW5kZXhdLmVudGl0aWVzID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtc1tpbmRleF0uZGlzcG9zZSgpO1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW1zW2luZGV4XSA9IG51bGw7XG4gICAgICAgIH0sIHRoaXMpO1xuICAgIH0pO1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgaW1tdXRhYmxlID0gcmVxdWlyZSgnaW1tdXRhYmlsaXMnKTtcbiAgICB2YXIgY29xdW9WZW5lbnVtID0gcmVxdWlyZSgnY29xdW8tdmVuZW51bScpO1xuICAgIHZhciBlYWNoID0gcmVxdWlyZSgncHJvLXNpbmd1bGlzJyk7XG4gICAgdmFyIHV0aWxzID0gcmVxdWlyZSgnLi9VdGlscycpO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHByaW1hcnkgZW50aXR5IG1hbmFnZXIgKGFuIGFwb3RoZWNhcml1cyBpcyBhIHN0b3JhZ2UgbWFuYWdlcilcbiAgICAgKiBcIk9uZSBwb3Rpb24gdG8gcnVsZSB0aGVtIGFsbCwgb25lIHBvdGlvbiB0byBmaW5kIHRoZW0sXG4gICAgICogb25lIHBvdGlvbiB0byBicmluZyB0aGVtIGFsbCBhbmQgaW4gdGhlIGRhcmtuZXNzIGJpbmQgdGhlbVwiXG4gICAgICpcbiAgICAgKiBAY2xhc3NcbiAgICAgKiBAbmFtZSBhbGNoZW15LmVjcy5BcG90aGVjYXJpdXNcbiAgICAgKiBAZXh0ZW5kcyBhbGNoZW15LmNvcmUuTWF0ZXJpYVByaW1hXG4gICAgICovXG4gICAgcmV0dXJuIGNvcXVvVmVuZW51bSh7XG4gICAgICAgIC8qKiBAbGVuZHMgYWxjaGVteS5lY3MuQXBvdGhlY2FyaXVzLnByb3RvdHlwZSAqL1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDcmVhdGVzIGEgbmV3IGVudGl0eSAoYSBzZXQgb2YgY29tcG9uZW50cylcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IGNmZyBUaGUgZW50aXR5IHR5cGUgb3IgYSBjdXN0b20gY29tcG9uZW50XG4gICAgICAgICAqICAgICAgY29uZmlndXJhdGlvbnNcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IFtjZmcuaWRdIE9wdGlvbmFsLiBBbiBlbnRpdHkgSUQuIElmIG9tbWl0dGVkIGEgbmV3XG4gICAgICAgICAqICAgICAgb25lIHdpbGwgYmUgY3JlYXRlZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJuIHtTdHJpbmd9IFRoZSBpZCBvZiB0aGUgbmV3IGVudGl0eVxuICAgICAgICAgKi9cbiAgICAgICAgY3JlYXRlRW50aXR5OiBmdW5jdGlvbiAoY2ZnKSB7XG4gICAgICAgICAgICB2YXIgZW50aXR5SWQgPSBjZmcuaWQgfHwgdXRpbHMuaWQoKTtcbiAgICAgICAgICAgIGlmICh0aGlzLmNvbnRhaW5zKGVudGl0eUlkKSkge1xuICAgICAgICAgICAgICAgIHRocm93ICdUaGUgaWQ6IFwiJyArIGVudGl0eUlkICsgJ1wiIGlzIGFscmVhZHkgdXNlZCc7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuZW50aXRpZXNbZW50aXR5SWRdID0ge1xuICAgICAgICAgICAgICAgIGlkOiBlbnRpdHlJZCxcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzOiBbXSxcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vIGNyZWF0ZSB0aGUgY29tcG9uZW50cyBvZiB0aGUgbmV3IGVudGl0eVxuICAgICAgICAgICAgZWFjaChjZmcsIGZ1bmN0aW9uIChjb21wb25lbnQsIGtleSkge1xuICAgICAgICAgICAgICAgIGlmIChrZXkgPT09ICdpZCcgfHwga2V5ID09PSAndHlwZScpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuc2V0Q29tcG9uZW50KGVudGl0eUlkLCBrZXksIGNvbXBvbmVudCk7XG4gICAgICAgICAgICB9LCB0aGlzKTtcblxuICAgICAgICAgICAgcmV0dXJuIGVudGl0eUlkO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDaGVja3MgaWYgYW4gZW50aXR5IHdpdGggdGhlIGdpdmVuIGlkIGV4aXN0c1xuICAgICAgICAgKiBAcmV0dXJuIEJvb2xlYW5cbiAgICAgICAgICovXG4gICAgICAgIGNvbnRhaW5zOiBmdW5jdGlvbiAoZW50aXR5SWQpIHtcbiAgICAgICAgICAgIHJldHVybiB1dGlscy5pc09iamVjdCh0aGlzLmVudGl0aWVzW2VudGl0eUlkXSk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENvbXBsZXRlbHkgcmVtb3ZlcyBhbGwgZXhpc3RpbmcgZW50aXRpZXMgYW5kIHRoZWlyXG4gICAgICAgICAqIGNvbXBvbmVudHMgLSBUaGUgdG90YWwgY2xlYW4tdXAgLSBUaGUgZW5kIG9mIGRheXMuLi5cbiAgICAgICAgICovXG4gICAgICAgIHJlbW92ZUFsbEVudGl0aWVzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBlYWNoKE9iamVjdC5rZXlzKHRoaXMuZW50aXRpZXMpLCB0aGlzLnJlbW92ZUVudGl0eSwgdGhpcyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlbW92ZXMgYW4gZW50aXR5IGFuZCBhbGwgaXRzIGNvbXBvbmVudHNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IGVudGl0eUlkIFRoZSBpZCBvZiBlbnRpdHkgdG8gcmVtb3ZlXG4gICAgICAgICAqL1xuICAgICAgICByZW1vdmVFbnRpdHk6IGZ1bmN0aW9uIChlbnRpdHlJZCkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmNvbnRhaW5zKGVudGl0eUlkKSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGVudGl0eSA9IHRoaXMuZW50aXRpZXNbZW50aXR5SWRdO1xuICAgICAgICAgICAgdmFyIGNtcHMgPSBlbnRpdHkuY29tcG9uZW50cztcblxuICAgICAgICAgICAgd2hpbGUgKGNtcHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVtb3ZlQ29tcG9uZW50KGVudGl0eSwgY21wc1swXSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuZW50aXRpZXNbZW50aXR5SWRdID0gbnVsbDtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVtb3ZlcyBhIHNpbmdsZSBjb21wb25lbnQgb2YgYW4gZW50aXR5OyBUaGUgcmVtb3ZlZCBjb21wb25lbnQgaXMgZGlzcG9zZWRcbiAgICAgICAgICogaWYgaXQgaXMgYSBwb3Rpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd8T2JqZWN0fSBlbnRpdHkgVGhlIGVudGl0eSBvYmplY3Qgb3IgaXRzIGlkIChJdCBpcyByZWNvbW1lbmRlZCB0byB1c2VcbiAgICAgICAgICogICAgICB0aGUgaWRzIGZvciBwdWJsaWMgYWNjZXNzISEhKVxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ3xOdW1iZXJ9IHR5cGUgVGhlIGNvbXBvbmVudCB0eXBlIHRvIHJlbW92ZSBvciBpdHMgaW5kZXggKHRoZSBpbmRleFxuICAgICAgICAgKiAgICAgIGlzIGZvciBwcml2YXRlIHVzYWdlISEhKVxuICAgICAgICAgKi9cbiAgICAgICAgcmVtb3ZlQ29tcG9uZW50OiBmdW5jdGlvbiAoZW50aXR5SWQsIHR5cGUpIHtcbiAgICAgICAgICAgIHZhciBlbnRpdHkgPSB1dGlscy5pc09iamVjdChlbnRpdHlJZCkgPyBlbnRpdHlJZCA6IHRoaXMuZW50aXRpZXNbZW50aXR5SWRdO1xuICAgICAgICAgICAgaWYgKCF1dGlscy5pc09iamVjdChlbnRpdHkpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgJ1Vua25vd24gZW50aXR5OiBcIicgKyBlbnRpdHlJZCArICdcIic7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBpbmRleCA9IGVudGl0eS5jb21wb25lbnRzLmluZGV4T2YodHlwZSk7XG4gICAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgICAgIGVudGl0eS5jb21wb25lbnRzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uID0gdGhpcy5jb21wb25lbnRzW3R5cGVdO1xuICAgICAgICAgICAgaWYgKGNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICBjb2xsZWN0aW9uW2VudGl0eS5pZF0gPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXR1cm5zIGFuIGFycmF5IGNvbnRhaW5pbmcgYWxsIGNvbXBvbmVudHMgb2YgYSBnaXZlIHR5cGVcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IHR5cGUgVGhlIGNvbXBvbmVudCBpZGVudGlmaWVyXG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH0gQW4gZW50aXR5SWQtdG8tY29tcG9uZW50IGhhc2ggbWFwXG4gICAgICAgICAqL1xuICAgICAgICBnZXRBbGxDb21wb25lbnRzT2ZUeXBlOiBmdW5jdGlvbiAodHlwZSkge1xuICAgICAgICAgICAgcmV0dXJuIGVhY2godGhpcy5jb21wb25lbnRzW3R5cGVdLCBmaWx0ZXJFeGlzdGluZyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJldHVybnMgYWxsIGNvbXBvbmVudCB2YWx1ZXMgZm9yIGEgZ2l2ZW4gZW50aXR5XG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBlbnRpdHlJZCBUaGUgZW50aXR5IGlkZW50aWZpZXIgKHJldHVybmVkIGJ5IFwiY3JlYXRlRW50aXR5XCIpXG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH0gQSBtYXAgKGNvbXBvbmVudCBpZGVudGlmaWVyIC0+IGNvbXBvbmVudCB2YWx1ZSkgY29udGFpbmluZ1xuICAgICAgICAgKiAgICAgIGFsbCBjb21wb25lbnRzIG9mIHRoZSByZXF1ZXN0ZWQgZW50aXR5IChUaGUgbWFwIHdpbGwgYmUgZW1wdHkgaWYgdGhlXG4gICAgICAgICAqICAgICAgZW50aXR5IGRvZXMgbm90IGV4aXN0KVxuICAgICAgICAgKlxuICAgICAgICAgKi9cbiAgICAgICAgZ2V0QWxsQ29tcG9uZW50c09mRW50aXR5OiBmdW5jdGlvbiAoZW50aXR5SWQpIHtcbiAgICAgICAgICAgIHZhciByZXN1bHQgPSB7fTtcbiAgICAgICAgICAgIHZhciBlbnRpdHkgPSB0aGlzLmVudGl0aWVzW2VudGl0eUlkXTtcbiAgICAgICAgICAgIHZhciBjb21wb25lbnRUeXBlcyA9IGVudGl0eSAmJiBlbnRpdHkuY29tcG9uZW50cztcblxuICAgICAgICAgICAgZWFjaChjb21wb25lbnRUeXBlcywgZnVuY3Rpb24gKHR5cGUpIHtcbiAgICAgICAgICAgICAgICByZXN1bHRbdHlwZV0gPSB0aGlzLmdldENvbXBvbmVudERhdGEoZW50aXR5SWQsIHR5cGUpO1xuICAgICAgICAgICAgfSwgdGhpcyk7XG5cbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJldHVybnMgdGhlIGltbXV0YWJsZSBjb21wb25lbnQgb2YgYSBnaXZlbiB0eXBlIGZvciB0aGUgc3BlY2lmaWVkXG4gICAgICAgICAqIGVudGl0eSBzcGVjaWZpYyBlbnRpdHkgb2YgYWxsIG9mIHRoYXQgdHlwZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gZW50aXR5SWQgQW4gZW50aXR5IGlkXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBjb21wb25lbnRLZXkgVGhlIGNvbXBvbmVudCB0eXBlXG4gICAgICAgICAqIEByZXR1cm4ge0ltbXV0YXRhYmxlfSBUaGUgaW1tdXRhYmxlIGRhdGEgb2YgYSBzaW5nbGUgY29tcG9uZW50XG4gICAgICAgICAqL1xuICAgICAgICBnZXRDb21wb25lbnQ6IGZ1bmN0aW9uIChlbnRpdHlJZCwgY29tcG9uZW50S2V5KSB7XG4gICAgICAgICAgICB2YXIgY29sbGVjdGlvbiA9IHRoaXMuY29tcG9uZW50c1tjb21wb25lbnRLZXldO1xuICAgICAgICAgICAgcmV0dXJuIGNvbGxlY3Rpb24gJiYgY29sbGVjdGlvbltlbnRpdHlJZF07XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJldHVybnMgdGhlIHJhdyBjb21wb25lbnQgZGF0YSBvZiBhIGdpdmVuIHR5cGUgZm9yIHRoZSBzcGVjaWZpZWRcbiAgICAgICAgICogZW50aXR5IHNwZWNpZmljIGVudGl0eSBvZiBhbGwgb2YgdGhhdCB0eXBlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBlbnRpdHlJZCBBbiBlbnRpdHkgaWRcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IGNvbXBvbmVudEtleSBUaGUgY29tcG9uZW50IHR5cGVcbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fSBUaGUgcmF3IGRhdGEgZm9yIHNpbmdsZSBjb21wb25lbnRcbiAgICAgICAgICovXG4gICAgICAgIGdldENvbXBvbmVudERhdGE6IGZ1bmN0aW9uIChlbnRpdHlJZCwgY29tcG9uZW50S2V5KSB7XG4gICAgICAgICAgICB2YXIgY29tcG9uZW50ID0gdGhpcy5nZXRDb21wb25lbnQoZW50aXR5SWQsIGNvbXBvbmVudEtleSk7XG4gICAgICAgICAgICByZXR1cm4gY29tcG9uZW50ICYmIGNvbXBvbmVudC52YWwoKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQWRkIGEgY29tcG9uZW50IHRvIGFuIGVudGl0eVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gZW50aXR5SWQgVGhlIGVudGl0eSBpZGVudGlmaWVyXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBrZXkgVGhlIGNvbXBvbmVudCBpZGVudGlmaWVyXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBjZmcgVGhlIGNvbXBvbmVudCBjb25maWd1cmF0aW9uXG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH0gVGhlIGFkZGVkIGNvbXBvbmVudCBvYmplY3RcbiAgICAgICAgICovXG4gICAgICAgIHNldENvbXBvbmVudDogZnVuY3Rpb24gKGVudGl0eUlkLCBrZXksIGNmZykge1xuICAgICAgICAgICAgdmFyIGVudGl0eSA9IHRoaXMuZW50aXRpZXNbZW50aXR5SWRdO1xuICAgICAgICAgICAgaWYgKCFlbnRpdHkpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyAnVW5rbm93biBlbnRpdHk6IFwiJyArIGVudGl0eUlkICsgJ1wiJztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb24gPSB0aGlzLmNvbXBvbmVudHNba2V5XTtcbiAgICAgICAgICAgIGlmICghY29sbGVjdGlvbikge1xuICAgICAgICAgICAgICAgIC8vIGl0J3MgdGhlIGZpcnN0IGNvbXBvbmVudCBvZiB0aGlzIHR5cGVcbiAgICAgICAgICAgICAgICAvLyAtPiBjcmVhdGUgYSBuZXcgY29sbGVjdGlvblxuICAgICAgICAgICAgICAgIGNvbGxlY3Rpb24gPSB7fTtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbXBvbmVudHNba2V5XSA9IGNvbGxlY3Rpb247XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBjbXAgPSBjb2xsZWN0aW9uW2VudGl0eUlkXTtcbiAgICAgICAgICAgIGlmIChjbXApIHtcbiAgICAgICAgICAgICAgICAvLyB1cGRhdGUgZXhpc3RpbmcgY29tcG9uZW50XG4gICAgICAgICAgICAgICAgY21wID0gY21wLnNldChjZmcpO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIGFkZCBuZXcgY29tcG9uZW50XG4gICAgICAgICAgICAgICAgY21wID0gaW1tdXRhYmxlLmZyb21KUyhjZmcpO1xuICAgICAgICAgICAgICAgIGVudGl0eS5jb21wb25lbnRzLnB1c2goa2V5KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29sbGVjdGlvbltlbnRpdHlJZF0gPSBjbXA7XG5cbiAgICAgICAgICAgIHJldHVybiBjbXAudmFsKCk7XG4gICAgICAgIH0sXG5cbiAgICB9KS53aGVuQnJld2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBzZXRzIG9mIGRpZmZlcmVudCBjb21wb25lbnRzIChtYXAgY29tcG9uZW50XG4gICAgICAgICAqIHR5cGUgbmFtZSAtPiBjb2xsZWN0aW9uIG9mIGNvbXBvbmVudCBpbnN0YW5jZSlcbiAgICAgICAgICpcbiAgICAgICAgICogQHByb3BlcnR5IGNvbXBvbmVudHNcbiAgICAgICAgICogQHR5cGUge09iamVjdH1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuY29tcG9uZW50cyA9IHt9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgY29sbGVjdGlvbiBvZiByZWdpc3RlcmVkIGVudGl0aWVzOyBlYWNoIGVudGl0eSBpcyBhbiBvYmplY3Qgd2l0aFxuICAgICAgICAgKiBhbiA8Y29kZT5pZDwvY29kZT4gYW5kIGFuIGFycmF5IG9mIHN0cmluZ3MgKDxjb2RlPmNvbXBvbmVudHM8L2NvZGU+KVxuICAgICAgICAgKiB3aGljaCByZWZlciB0aGUgZW50aXR5J3MgY29tcG9uZW50c1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcHJvcGVydHkgZW50aXRpZXNcbiAgICAgICAgICogQHR5cGUge09iamVjdH1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuZW50aXRpZXMgPSB7fTtcblxuICAgIH0pLndoZW5EaXNwb3NlZChmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMucmVtb3ZlQWxsRW50aXRpZXMoKTtcbiAgICB9KTtcblxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgZnVuY3Rpb24gZmlsdGVyRXhpc3Rpbmcob2JqKSB7XG4gICAgICAgIGlmIChvYmopIHtcbiAgICAgICAgICAgIHJldHVybiBvYmoudmFsKCk7XG4gICAgICAgIH1cbiAgICB9XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBpbW11dGFibGUgPSByZXF1aXJlKCdpbW11dGFiaWxpcycpO1xuICAgIHZhciBjb3F1b1ZlbmVudW0gPSByZXF1aXJlKCdjb3F1by12ZW5lbnVtJyk7XG4gICAgdmFyIGVhY2ggPSByZXF1aXJlKCdwcm8tc2luZ3VsaXMnKTtcbiAgICB2YXIgdXRpbHMgPSByZXF1aXJlKCcuL1V0aWxzJyk7XG4gICAgdmFyIE9ic2VydmFyaSA9IHJlcXVpcmUoJy4vT2JzZXJ2YXJpJyk7XG5cbiAgICAvKipcbiAgICAgKiBEZXNjcmlwdGlvblxuICAgICAqXG4gICAgICogQGNsYXNzXG4gICAgICogQG5hbWUgYWxjaGVteS53ZWIuQXBwbGljYXR1c1xuICAgICAqIEBleHRlbmRzIGFsY2hlbXkuY29yZS5NYXRlcmlhUHJpbWFcbiAgICAgKi9cbiAgICByZXR1cm4gY29xdW9WZW5lbnVtKHtcbiAgICAgICAgLyoqIEBsZW5kcyBhbGNoZW15LndlYi5BcHBsaWNhdHVzLnByb3RvdHlwZSAqL1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiA8Y29kZT50cnVlPC9jb2RlPiBpZiB0aGUgYXBwIGlzIHJ1bm5pbmdcbiAgICAgICAgICpcbiAgICAgICAgICogQHByb3BlcnR5IHJ1bnNcbiAgICAgICAgICogQHR5cGUgQm9vbGVhblxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgcnVuczogZmFsc2UsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBnbG9iYWwgbWVzc2FnZSBidXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHByb3BlcnR5IG1lc3NhZ2VzXG4gICAgICAgICAqIEB0eXBlIGFsY2hlbXkuY29yZS5PYnNlcnZhcmlcbiAgICAgICAgICogQHByb3RlY3RlZFxuICAgICAgICAgKi9cbiAgICAgICAgbWVzc2FnZXM6IHVuZGVmaW5lZCxcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGFwcGxpY2F0aW9uIHN0YXRlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwcm9wZXJ0eSBzdGF0ZVxuICAgICAgICAgKiBAdHlwZSBJbW11dGFibGVcbiAgICAgICAgICogQHByb3RlY3RlZFxuICAgICAgICAgKi9cbiAgICAgICAgc3RhdGU6IHVuZGVmaW5lZCxcblxuICAgICAgICAvKipcbiAgICAgICAgICogSG9vay1tZXRob2Q7IGNhbGxlZCB3aGVuIGxhdW5jaGluZyB0aGUgYXBwXG4gICAgICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgICAgICovXG4gICAgICAgIG9uTGF1bmNoOiB1dGlscy5lbXB0eUZuLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBIb29rLW1ldGhvZDsgY2FsbGVkIGJlZm9yZSBjbG9zaW5nIHRoZSBhcHBcbiAgICAgICAgICogQHByb3RlY3RlZFxuICAgICAgICAgKi9cbiAgICAgICAgb25TaHV0ZG93bjogdXRpbHMuZW1wdHlGbixcblxuICAgICAgICAvKipcbiAgICAgICAgICogSG9vay1tZXRob2Q7IGNhbGxlZCBpbiBlYWNoIGxvb3AgcnVuIHRvIHVwZGF0ZSB0aGUgYXBwbGljYXRpb24gc3RhdGVcbiAgICAgICAgICogQHByb3RlY3RlZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gbG9vcFBhcmFtcyBUaGUgcGFyYW1ldGVyIG9mIHRoZSBjdXJyZW50IGxvb3AgaXRlcmF0aW9uXG4gICAgICAgICAqIEBwYXJhbSB7TnVtYmVyfSBsb29wUGFyYW1zLm5vdyBUaGUgY3VycmVudCB0aW1lc3RhbXBcbiAgICAgICAgICogQHBhcmFtIHtOdW1iZXJ9IGxvb3BQYXJhbXMuZnJhbWUgVGhlIG51bWJlciBvZiB0aGUgY3VycmVudCBpdGVyYXRpb25cbiAgICAgICAgICogQHBhcmFtIHtOdW1iZXJ9IGxvb3BQYXJhbXMuZnBzIFRoZSBmcmFtZXMgcGVyIHNlY29uZFxuICAgICAgICAgKiBAcGFyYW0ge1N0YXRlfSBsb29wUGFyYW1zLnN0YXRlIFRoZSBjdXJyZW50IGFwcGxpY2F0aW9uIHN0YXRlXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm4gT2JqZWN0IFRoZSBuZXcgYXBwbGljYXRpb24gc3RhdGVcbiAgICAgICAgICovXG4gICAgICAgIHVwZGF0ZTogdXRpbHMuZW1wdHlGbixcblxuICAgICAgICAvKipcbiAgICAgICAgICogSG9vay1tZXRob2Q7IGNhbGxlZCBpbiBlYWNoIGxvb3AgcnVuIHRvIHVwZGF0ZSB0aGUgYXBwbGljYXRpb24gdmlld1xuICAgICAgICAgKiBAcHJvdGVjdGVkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBsb29wUGFyYW1zIFRoZSBwYXJhbWV0ZXIgb2YgdGhlIGN1cnJlbnQgbG9vcCBpdGVyYXRpb25cbiAgICAgICAgICogQHBhcmFtIHtOdW1iZXJ9IGxvb3BQYXJhbXMubm93IFRoZSBjdXJyZW50IHRpbWVzdGFtcFxuICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gbG9vcFBhcmFtcy5mcmFtZSBUaGUgbnVtYmVyIG9mIHRoZSBjdXJyZW50IGl0ZXJhdGlvblxuICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gbG9vcFBhcmFtcy5mcHMgVGhlIGZyYW1lcyBwZXIgc2Vjb25kXG4gICAgICAgICAqIEBwYXJhbSB7U3RhdGV9IGxvb3BQYXJhbXMuc3RhdGUgVGhlIGN1cnJlbnQgYXBwbGljYXRpb24gc3RhdGVcbiAgICAgICAgICovXG4gICAgICAgIGRyYXc6IHV0aWxzLmVtcHR5Rm4sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFN0YXJ0cyB0aGUgYXBwbGljYXRpb24gbG9vcDtcbiAgICAgICAgICogVGhpcyB3aWxsIGNhbGwgdGhlIHtAbGluayAjb25MYXVuY2h9IGhvb2sgbWV0aG9kXG4gICAgICAgICAqL1xuICAgICAgICBsYXVuY2g6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnJ1bnMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMucnVucyA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmZyYW1lID0gMDtcbiAgICAgICAgICAgIHRoaXMubGFzdFRpY2sgPSB1dGlscy5ub3coKTtcbiAgICAgICAgICAgIHRoaXMub25MYXVuY2goKTtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBGaXJlZCBhZnRlciBhcHBsaWNhdGlvbiBpcyByZWFkeVxuICAgICAgICAgICAgICogQGV2ZW50XG4gICAgICAgICAgICAgKiBAbmFtZSBhcHA6c3RhcnRcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5tZXNzYWdlcy50cmlnZ2VyKCdhcHA6c3RhcnQnKTtcblxuICAgICAgICAgICAgLy8gc3RhcnQgdGhlIHVwZGF0ZS9kcmF3LWxvb3BcbiAgICAgICAgICAgIHRoaXMuYm91bmRMb29wRm4gPSB0aGlzLmNyZWF0ZUxvb3BGdW5jdGlvbih0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuYm91bmRMb29wRm4oKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogc3RvcHMgdGhlIGFwcGxpY2F0aW9uIGxvb3A7XG4gICAgICAgICAqIHRoaXMgd2lsbCBjYWxsIHRoZSB7QGxpbmsgI2ZpbmlzaH0gbWV0aG9kXG4gICAgICAgICAqL1xuICAgICAgICBzaHV0ZG93bjogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLnJ1bnMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmxvb3BJZCkge1xuICAgICAgICAgICAgICAgIHZhciBjYW5jZWxBbmltYXRpb25GcmFtZSA9IHRoaXMuY2FuY2VsQW5pbWF0aW9uRnJhbWU7XG5cbiAgICAgICAgICAgICAgICBjYW5jZWxBbmltYXRpb25GcmFtZSh0aGlzLmxvb3BJZCk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLmJvdW5kTG9vcEZuID0gbnVsbDtcbiAgICAgICAgICAgICAgICB0aGlzLmxvb3BJZCA9IG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMub25TaHV0ZG93bigpO1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIEZpcmVkIGFmdGVyIGFwcGxpY2F0aW9uIGlzIHNodXQgZG93blxuICAgICAgICAgICAgICogQGV2ZW50XG4gICAgICAgICAgICAgKiBAbmFtZSBhcHA6c3RvcFxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLm1lc3NhZ2VzLnRyaWdnZXIoJ2FwcDpzdG9wJyk7XG4gICAgICAgICAgICB0aGlzLnJ1bnMgPSBmYWxzZTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmV0dXJucyA8Y29kZT50cnVlPC9jb2RlPiBpZiBhbmQgb25seSBpZiB0aGUgY3VycmVudCBhcHBsaWNhdGlvblxuICAgICAgICAgKiBpcyBydW5uaW5nIChpdCBtYXkgb3IgbWF5IG5vdCBiZSBwYXVzZWQgdGhvdWdoKVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJuIHtCb29sZWFufVxuICAgICAgICAgKi9cbiAgICAgICAgaXNSdW5uaW5nOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5ydW5zO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDb25uZWN0cyB0aGUgbWVzc2FnZSBidXMgZXZlbnRzIHdpdGggaGFuZGxlci9jb250cm9sbGVyXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSBPYmplY3QgY29udHJvbGxlciBUaGUgY29udHJvbGxlciBvYmplY3QgdG8gaGFuZGxlIHRoZSBtZXNzYWdlXG4gICAgICAgICAqICAgICAgYnVzIGV2ZW50cy4gQSBjb250cm9sbGVyIG9iamVjdCBoYXMgdG8gcHJvdmlkZSBhIG1lc3NhZ2VzXG4gICAgICAgICAqICAgICAgcHJvcGVydHkgd2hpY2ggbWFwcyBhbiBldmVudCB0byBhbiBldmVudCBoYW5kbGVyIG1ldGhvZC4gVGhlXG4gICAgICAgICAqICAgICAgaGFuZGxlciBtZXRob2QgaXMgY2FsbGVkIHdpdGggdGhlIGV2ZW50IGRhdGEgYW5kIHRoZSBjdXJyZW50XG4gICAgICAgICAqICAgICAgYXBwbGljYXRpb24gc3RhdGUuIFRoZSByZXR1cm4gdmFsdWUgb2YgdGhlIGhhbmRsZXIgbWV0aG9kIHdpbGxcbiAgICAgICAgICogICAgICBiZSB0aGUgbmV3IGFwcGxpY2F0aW9uIHN0YXRlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIHZhciBjb250cm9sbGVyID0ge1xuICAgICAgICAgKiAgIG1lc3NhZ2VzOiB7XG4gICAgICAgICAqICAgICAnYXBwOnN0YXJ0JzogJ29uQXBwU3RhcnQnLFxuICAgICAgICAgKiAgICAgLi4uXG4gICAgICAgICAqICAgfSxcbiAgICAgICAgICpcbiAgICAgICAgICogICBvbkFwcFN0YXJ0OiBmdW5jdGlvbiAoZGF0YSwgc3RhdGUpIHtcbiAgICAgICAgICogICAgIC4uLiAvLyBoYW5kbGUgZXZlbnRcbiAgICAgICAgICogICAgIHJldHVybiBuZXdTdGF0ZTtcbiAgICAgICAgICogICB9LFxuICAgICAgICAgKlxuICAgICAgICAgKiAgIC4uLlxuICAgICAgICAgKiB9O1xuICAgICAgICAgKi9cbiAgICAgICAgd2lyZVVwOiBmdW5jdGlvbiAoY29udHJvbGxlcikge1xuICAgICAgICAgICAgaWYgKCFjb250cm9sbGVyKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgJ0ludmFsaWQgaW5wdXQ6IEVtcHR5IHZhbHVlJztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFjb250cm9sbGVyLm1lc3NhZ2VzKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgJ0ludmFsaWQgaW5wdXQ6IE1lc3NhZ2UgbWFwIG1pc3NpbmcnO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBlYWNoKGNvbnRyb2xsZXIubWVzc2FnZXMsIGZ1bmN0aW9uIChmbk5hbWUsIG1lc3NhZ2UpIHtcbiAgICAgICAgICAgICAgICB0aGlzLm1lc3NhZ2VzLm9uKG1lc3NhZ2UsIGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBmbiA9IGNvbnRyb2xsZXJbZm5OYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IGZuLmNhbGwoY29udHJvbGxlciwgdGhpcy5zdGF0ZSwgZGF0YSk7XG4gICAgICAgICAgICAgICAgfSwgdGhpcyk7XG4gICAgICAgICAgICB9LCB0aGlzKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvL1xuICAgICAgICAvL1xuICAgICAgICAvLyBwcml2YXRlIGhlbHBlclxuICAgICAgICAvL1xuICAgICAgICAvL1xuXG4gICAgICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZTogd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSxcbiAgICAgICAgY2FuY2VsQW5pbWF0aW9uRnJhbWU6IHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ3JlYXRzIHRoZSBhcHBsaWNhdGlvbiBsb29wIG1ldGhvZCB3aGljaCBjYWxsZWQgZXZlcnkgaXRlcmF0aW9uO1xuICAgICAgICAgKiB3aWxsIGNhbGwgdGhlIHtAbGluayAjdXBkYXRlfSBhbmQgdGhlIHtAbGluayAjZHJhd30gbWV0aG9kXG4gICAgICAgICAqIEBmdW5jdGlvblxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgY3JlYXRlTG9vcEZ1bmN0aW9uOiBmdW5jdGlvbiAoYXBwKSB7XG4gICAgICAgICAgICAvLyBVc2UgYW4gaW5zdGFuY2Ugb2YgXCJMb29wUGFyYW1ldGVyXCIgaW5zdGVhZCBvZiBhIGdlbmVyaWMgb2JqZWN0XG4gICAgICAgICAgICAvLyBiZWNhdXNlIG1vc3QgamF2YXNjcmlwdCBpbnRlcnByZXRlciBoYXZlIG9wdGltaXplZCBwcm9wZXJ0eVxuICAgICAgICAgICAgLy8gYWNjZXNzIGZvciBvYmplY3RzIHdpdGggYSBcImhpZGRlbiBjbGFzc1wiXG4gICAgICAgICAgICBmdW5jdGlvbiBMb29wUGFyYW1ldGVyKCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZnJhbWUgPSAwO1xuICAgICAgICAgICAgICAgIHRoaXMubm93ID0gMDtcbiAgICAgICAgICAgICAgICB0aGlzLmRlbGF5ID0gMDtcbiAgICAgICAgICAgICAgICB0aGlzLmZwcyA9IDA7XG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciB0aGVuID0gdXRpbHMubm93KCk7XG4gICAgICAgICAgICB2YXIgZnJhbWUgPSAwO1xuICAgICAgICAgICAgdmFyIGxvb3BQYXJhbXMgPSBuZXcgTG9vcFBhcmFtZXRlcigpO1xuICAgICAgICAgICAgdmFyIGZwcyA9IDYwO1xuICAgICAgICAgICAgdmFyIGRlbGF5ID0gMTAwMCAvIGZwcztcbiAgICAgICAgICAgIHZhciByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSB0aGlzLnJlcXVlc3RBbmltYXRpb25GcmFtZTtcblxuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIGxvb3Aobm93KSB7XG4gICAgICAgICAgICAgICAgbm93ICA9IG5vdyB8fCB1dGlscy5ub3coKTtcbiAgICAgICAgICAgICAgICBkZWxheSA9IDAuOTUgKiBkZWxheSArIDAuMDUgKiAobm93IC0gdGhlbik7XG4gICAgICAgICAgICAgICAgZnBzID0gMTAwMCAvIGRlbGF5O1xuICAgICAgICAgICAgICAgIHRoZW4gPSBub3c7XG4gICAgICAgICAgICAgICAgZnJhbWUrKztcblxuICAgICAgICAgICAgICAgIC8vIHVwZGF0ZSB0aGUgcGFyYW1ldGVyIHNldCBmb3IgdGhlIGN1cnJlbnQgaXRlcmF0aW9uXG4gICAgICAgICAgICAgICAgbG9vcFBhcmFtcy5mcmFtZSA9IGZyYW1lO1xuICAgICAgICAgICAgICAgIGxvb3BQYXJhbXMubm93ID0gbm93O1xuICAgICAgICAgICAgICAgIGxvb3BQYXJhbXMuZGVsYXkgPSBNYXRoLnJvdW5kKGRlbGF5KTtcbiAgICAgICAgICAgICAgICBsb29wUGFyYW1zLmZwcyA9IE1hdGgucm91bmQoZnBzKTtcbiAgICAgICAgICAgICAgICBsb29wUGFyYW1zLnN0YXRlID0gYXBwLnN0YXRlO1xuXG4gICAgICAgICAgICAgICAgdmFyIG5ld1N0YXRlID0gYXBwLnVwZGF0ZShsb29wUGFyYW1zKTtcbiAgICAgICAgICAgICAgICBpZiAobmV3U3RhdGUgJiYgbmV3U3RhdGUgIT09IGFwcC5zdGF0ZSkge1xuICAgICAgICAgICAgICAgICAgICBhcHAuc3RhdGUgPSBuZXdTdGF0ZTtcbiAgICAgICAgICAgICAgICAgICAgbG9vcFBhcmFtcy5zdGF0ZSA9IGFwcC5zdGF0ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBhcHAuZHJhdyhsb29wUGFyYW1zKTtcblxuICAgICAgICAgICAgICAgIGFwcC5sb29wSWQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoYXBwLmJvdW5kTG9vcEZuKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0sXG5cbiAgICB9KS53aGVuQnJld2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5tZXNzYWdlcyA9IE9ic2VydmFyaS5icmV3KCk7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBpbW11dGFibGUuZnJvbUpTKCk7XG5cbiAgICB9KS53aGVuRGlzcG9zZWQoZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnNodXRkb3duKCk7XG4gICAgfSk7XG5cbn0oKSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIGNvcXVvVmVuZW51bSA9IHJlcXVpcmUoJ2NvcXVvLXZlbmVudW0nKTtcbiAgICB2YXIgZWFjaCA9IHJlcXVpcmUoJ3Byby1zaW5ndWxpcycpO1xuICAgIHZhciB1dGlscyA9IHJlcXVpcmUoJy4vVXRpbHMnKTtcblxuICAgIC8qKlxuICAgICAqIEEgY29tcG9uZW50IHN5c3RlbSB0byByZW5kZXIgc3RhdGljIGFuZCBkeW5hbWljIENTU1xuICAgICAqXG4gICAgICogQGNsYXNzXG4gICAgICogQG5hbWUgYWxjaGVteS5lY3MuQ3NzUmVuZGVyU3lzdGVtXG4gICAgICogQGV4dGVuZHMgYWxjaGVteS5jb3JlLk1hdGVyaWFQcmltYVxuICAgICAqL1xuICAgIHJldHVybiBjb3F1b1ZlbmVudW0oe1xuICAgICAgICAvKiogQGxlbmRzIGFsY2hlbXkuZWNzLkNzc1JlbmRlclN5c3RlbS5wcm90b3R5cGUgKi9cblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGVudGl0eSBzdG9yYWdlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwcm9wZXJ0eSBlbnRpdGllc1xuICAgICAgICAgKiBAdHlwZSBhbGNoZW15LmVjcy5BcG90aGVjYXJpdXNcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIGVudGl0aWVzOiB1bmRlZmluZWQsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBjc3Mgc3R5bGUgaGVscGVyIHdoaWNoIGRvZXMgdGhlIGhlYXZ5IGxpZnRpbmdcbiAgICAgICAgICpcbiAgICAgICAgICogQHByb3BlcnR5IHN0eWx1c1xuICAgICAgICAgKiBAdHlwZSBhbGNoZW15LndlYi5TdHlsdXNcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHN0eWx1czogdW5kZWZpbmVkLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgdGhlIHByZXZpb3VzIHN0YXRlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwcm9wZXJ0eSBsYXN0U3RhdGVzXG4gICAgICAgICAqIEB0eXBlIE9iamVjdFxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgbGFzdFN0YXRlczogdW5kZWZpbmVkLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBVcGRhdGVzIHRoZSBjb21wb25lbnQgc3lzdGVtIHdpdGggdGhlIGN1cnJlbnQgYXBwbGljYXRpb24gc3RhdGVcbiAgICAgICAgICovXG4gICAgICAgIHVwZGF0ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGR5bmFtaWNDc3MgPSB0aGlzLmVudGl0aWVzLmdldEFsbENvbXBvbmVudHNPZlR5cGUoJ2NzcycpO1xuICAgICAgICAgICAgZWFjaChkeW5hbWljQ3NzLCB0aGlzLnVwZGF0ZUR5bmFtaWNDc3MsIHRoaXMpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB1cGRhdGVEeW5hbWljQ3NzOiBmdW5jdGlvbiAoY2ZnLCBlbnRpdHlJZCkge1xuICAgICAgICAgICAgdGhpcy5wcm9jZXNzVHlwZVJ1bGVzKGNmZywgZW50aXR5SWQpO1xuICAgICAgICAgICAgdGhpcy5wcm9jZXNzRW50aXR5UnVsZXMoY2ZnLCBlbnRpdHlJZCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHByb2Nlc3NUeXBlUnVsZXM6IGZ1bmN0aW9uIChjZmcsIGVudGl0eUlkKSB7XG4gICAgICAgICAgICBpZiAoIWNmZy50eXBlUnVsZXMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuc2V0UnVsZXMoY2ZnLnR5cGVSdWxlcyk7XG4gICAgICAgICAgICB0aGlzLmVudGl0aWVzLnNldENvbXBvbmVudChlbnRpdHlJZCwgJ2NzcycsIHtcbiAgICAgICAgICAgICAgICB0eXBlUnVsZXM6IG51bGwsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgcHJvY2Vzc0VudGl0eVJ1bGVzOiBmdW5jdGlvbiAoY2ZnLCBlbnRpdHlJZCkge1xuICAgICAgICAgICAgaWYgKCF1dGlscy5pc09iamVjdChjZmcuZW50aXR5UnVsZXMpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5lbnRpdGllcy5yZW1vdmVDb21wb25lbnQoZW50aXR5SWQsICdjc3MnKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBydWxlcyA9IHt9O1xuXG4gICAgICAgICAgICBpZiAodXRpbHMuaXNGdW5jdGlvbihjZmcuZW50aXR5UnVsZXMpKSB7XG4gICAgICAgICAgICAgICAgdmFyIGxhc3RTdGF0ZSA9IHRoaXMubGFzdFN0YXRlc1tlbnRpdHlJZF07XG4gICAgICAgICAgICAgICAgdmFyIGN1cnJlbnRTdGF0ZSA9IHRoaXMuZW50aXRpZXMuZ2V0Q29tcG9uZW50KGVudGl0eUlkLCAnc3RhdGUnKTtcblxuICAgICAgICAgICAgICAgIGlmIChjdXJyZW50U3RhdGUgPT09IGxhc3RTdGF0ZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcnVsZXNbJyMnICsgZW50aXR5SWRdID0gY2ZnLmVudGl0eVJ1bGVzLmNhbGwobnVsbCwgY3VycmVudFN0YXRlKTtcblxuICAgICAgICAgICAgICAgIHRoaXMubGFzdFN0YXRlc1tlbnRpdHlJZF0gPSBjdXJyZW50U3RhdGU7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRSdWxlcyhydWxlcyk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJ1bGVzWycjJyArIGVudGl0eUlkXSA9IGNmZy5lbnRpdHlSdWxlcztcblxuICAgICAgICAgICAgdGhpcy5zZXRSdWxlcyhydWxlcyk7XG4gICAgICAgICAgICB0aGlzLmVudGl0aWVzLnJlbW92ZUNvbXBvbmVudChlbnRpdHlJZCwgJ2NzcycpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICBzZXRSdWxlczogZnVuY3Rpb24gKHJ1bGVzKSB7XG4gICAgICAgICAgICB0aGlzLnN0eWx1cy5zZXRSdWxlcyhydWxlcyk7XG4gICAgICAgIH0sXG5cbiAgICB9KS53aGVuQnJld2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5sYXN0U3RhdGVzID0ge307XG4gICAgfSk7XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBjb3F1b1ZlbmVudW0gPSByZXF1aXJlKCdjb3F1by12ZW5lbnVtJyk7XG4gICAgdmFyIGVhY2ggPSByZXF1aXJlKCdwcm8tc2luZ3VsaXMnKTtcblxuICAgIHZhciBEZWxlZ2F0ZSA9IGZ1bmN0aW9uIChrZXksIGV2ZW50LCBoYW5kbGVyLCBzY29wZSkge1xuICAgICAgICB0aGlzLmtleSA9IGtleTtcbiAgICAgICAgdGhpcy5ldmVudCA9IGV2ZW50O1xuICAgICAgICB0aGlzLmhhbmRsZXIgPSBoYW5kbGVyO1xuICAgICAgICB0aGlzLnNjb3BlID0gc2NvcGU7XG4gICAgfTtcblxuICAgIERlbGVnYXRlLnByb3RvdHlwZS5iaW5kID0gZnVuY3Rpb24gYmluZChlbGVtZW50KSB7XG4gICAgICAgIGVsZW1lbnRbZ2V0S2V5KHRoaXMuZXZlbnQpXSA9IHRoaXMua2V5O1xuICAgIH07XG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgZnVuY3Rpb24gZ2V0S2V5KGV2ZW50bmFtZSkge1xuICAgICAgICByZXR1cm4gJ19fZV9fJyArIGV2ZW50bmFtZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAY2xhc3NcbiAgICAgKiBAbmFtZSBhbGNoZW15LndlYi5EZWxlZ2F0dXNcbiAgICAgKi9cbiAgICByZXR1cm4gY29xdW9WZW5lbnVtKHtcbiAgICAgICAgLyoqIEBsZW5kcyBhbGNoZW15LndlYi5EZWxlZ2F0dXMucHJvdG90eXBlICovXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSByb290IERPTSBub2RlIHRoYXQgY29sbGVjdHMgdGhlIGJyb3dzZXIgZXZlbnRzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwcm9wZXJ0eSByb290XG4gICAgICAgICAqIEB0eXBlIERvbU5vZGVcbiAgICAgICAgICogQHJlYWRvbmx5XG4gICAgICAgICAqL1xuICAgICAgICByb290OiB1bmRlZmluZWQsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBzZXQgb2YgcmVnaXN0ZXJlZCBldmVudCBoYW5kbGVyc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcHJvcGVydHkgZXZlbnRzXG4gICAgICAgICAqIEB0eXBlIE9iamVjdFxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgZXZlbnRzOiB1bmRlZmluZWQsXG5cbiAgICAgICAgY3JlYXRlRGVsZWdhdGU6IGZ1bmN0aW9uIChldmVudCwgZm4sIHNjb3BlKSB7XG4gICAgICAgICAgICB2YXIgZGVsZWdhdGVzID0gdGhpcy5ldmVudHNbZXZlbnRdO1xuXG4gICAgICAgICAgICBpZiAoIWRlbGVnYXRlcykge1xuICAgICAgICAgICAgICAgIC8vIGZpcnN0IGhhbmRsZXIgZm9yIHRoaXMgZXZlbnRcbiAgICAgICAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgICAgICAgICBkZWxlZ2F0ZXMgPSBbXTtcblxuICAgICAgICAgICAgICAgIHRoaXMuZXZlbnRzW2V2ZW50XSA9IGRlbGVnYXRlcztcbiAgICAgICAgICAgICAgICB0aGlzLnJvb3RbJ29uJyArIGV2ZW50XSA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuaGFuZGxlRXZlbnQoZXZlbnQsIGUpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gZGVsZWdhdGVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBkID0gZGVsZWdhdGVzW2ldO1xuICAgICAgICAgICAgICAgIGlmIChkLmhhbmRsZXIgPT09IGZuICYmIGQuc2NvcGUgPT09IHNjb3BlKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGV2ZW50IGhhbmRsZXIgd2FzIGFscmVhZHkgZGVmaW5lZFxuICAgICAgICAgICAgICAgICAgICAvLyAtPiB1c2UgaXRcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgbmV3RGVsID0gbmV3IERlbGVnYXRlKGRlbGVnYXRlcy5sZW5ndGgsIGV2ZW50LCBmbiwgc2NvcGUpO1xuXG4gICAgICAgICAgICBkZWxlZ2F0ZXMucHVzaChuZXdEZWwpO1xuXG4gICAgICAgICAgICByZXR1cm4gbmV3RGVsO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8vXG4gICAgICAgIC8vXG4gICAgICAgIC8vIHByaXZhdGUgaGVscGVyXG4gICAgICAgIC8vXG4gICAgICAgIC8vXG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIGhhbmRsZUV2ZW50OiBmdW5jdGlvbiAoZXZlbnROYW1lLCBldikge1xuICAgICAgICAgICAgdmFyIHRhcmdldCA9IGV2ICYmIGV2LnRhcmdldDtcblxuICAgICAgICAgICAgd2hpbGUgKHRhcmdldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudCh0YXJnZXRbZ2V0S2V5KGV2ZW50TmFtZSldLCBldmVudE5hbWUsIGV2KTtcbiAgICAgICAgICAgICAgICB0YXJnZXQgPSB0YXJnZXQucGFyZW50Tm9kZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgZGlzcGF0Y2hFdmVudDogZnVuY3Rpb24gKGV2ZW50S2V5LCBldmVudE5hbWUsIGV2ZW50KSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGV2ZW50S2V5ID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGhhbmRsZXIgPSB0aGlzLmV2ZW50c1tldmVudE5hbWVdO1xuICAgICAgICAgICAgdmFyIGNmZyA9IGhhbmRsZXIgJiYgaGFuZGxlcltldmVudEtleV07XG5cbiAgICAgICAgICAgIGNmZy5oYW5kbGVyLmNhbGwoY2ZnLnNjb3BlLCBldmVudCk7XG4gICAgICAgIH0sXG5cbiAgICB9KS53aGVuQnJld2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5yb290ID0gdGhpcy5yb290IHx8IGRvY3VtZW50LmJvZHk7XG4gICAgICAgIHRoaXMuZXZlbnRzID0ge307XG5cbiAgICB9KS53aGVuRGlzcG9zZWQoZnVuY3Rpb24gKCkge1xuICAgICAgICBlYWNoKHRoaXMuZXZlbnRzLCBmdW5jdGlvbiAoaGFuZGxlciwgZXZlbnQpIHtcbiAgICAgICAgICAgIHdoaWxlIChoYW5kbGVyLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBoYW5kbGVyLnBvcCgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnJvb3RbJ29uJyArIGV2ZW50XSA9IG51bGw7XG4gICAgICAgIH0sIHRoaXMpO1xuICAgIH0pO1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgY29xdW9WZW5lbnVtID0gcmVxdWlyZSgnY29xdW8tdmVuZW51bScpO1xuICAgIHZhciBlYWNoID0gcmVxdWlyZSgncHJvLXNpbmd1bGlzJyk7XG4gICAgdmFyIHV0aWxzID0gcmVxdWlyZSgnLi9VdGlscycpO1xuXG4gICAgLyoqXG4gICAgICogQSBjb21wb25lbnQgc3lzdGVtIHRvIGNyZWF0ZSBkZWxlZ2F0ZWQgZXZlbnQgaGFuZGxlciBmb3IgZG9tIGV2ZW50c1xuICAgICAqXG4gICAgICogQGNsYXNzXG4gICAgICogQG5hbWUgYWxjaGVteS5lY3MuRXZlbnRTeXN0ZW1cbiAgICAgKiBAZXh0ZW5kcyBhbGNoZW15LmNvcmUuTWF0ZXJpYVByaW1hXG4gICAgICovXG4gICAgcmV0dXJuIGNvcXVvVmVuZW51bSh7XG4gICAgICAgIC8qKiBAbGVuZHMgYWxjaGVteS5lY3MuRXZlbnRTeXN0ZW0ucHJvdG90eXBlICovXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBtZXNzYWdlIGJ1cyBmb3IgdGhlIGFwcGljYXRpb24gbWVzc2FnZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHByb3BlcnR5IG1lc3NhZ2VzXG4gICAgICAgICAqIEB0eXBlIGFsY2hlbXkuY29yZS5PYnNlcnZhcmlcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIG1lc3NhZ2VzOiB1bmRlZmluZWQsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBicm93c2VyIGV2ZW50IGRlbGVnYXRvclxuICAgICAgICAgKlxuICAgICAgICAgKiBAcHJvcGVydHkgZGVsZWdhdG9yXG4gICAgICAgICAqIEB0eXBlIGFsY2hlbXkud2ViLkRlbGVnYXR1c1xuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgZGVsZWdhdG9yOiB1bmRlZmluZWQsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBlbnRpdHkgc3RvcmFnZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcHJvcGVydHkgZW50aXRpZXNcbiAgICAgICAgICogQHR5cGUgYWxjaGVteS5lY3MuQXBvdGhlY2FyaXVzXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBlbnRpdGllczogdW5kZWZpbmVkLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBZGRzIGEgbmV3IGV2ZW50IGhhbmRsZXJcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IGtleSBUaGUgaWRlbnRpZmllciBmb3IgdGhlIGV2ZW50IGhhbmRsZXJcbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gaGFuZGxlciBUaGUgZXZlbnQgaGFuZGxlciBmdW5jdGlvbiB0byBiZSBhZGRlZFxuICAgICAgICAgKi9cbiAgICAgICAgYWRkSGFuZGxlcjogZnVuY3Rpb24gKGtleSwgaGFuZGxlcikge1xuICAgICAgICAgICAgdGhpcy5oYW5kbGVyID0gdGhpcy5oYW5kbGVyIHx8IHt9O1xuICAgICAgICAgICAgdGhpcy5oYW5kbGVyW2tleV0gPSBoYW5kbGVyO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBVcGRhdGVzIHRoZSBjb21wb25lbnQgc3lzdGVtIHdpdGggdGhlIGN1cnJlbnQgYXBwbGljYXRpb24gc3RhdGVcbiAgICAgICAgICovXG4gICAgICAgIHVwZGF0ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGV2ZW50cyA9IHRoaXMuZW50aXRpZXMuZ2V0QWxsQ29tcG9uZW50c09mVHlwZSgnZXZlbnRzJyk7XG4gICAgICAgICAgICBlYWNoKGV2ZW50cywgdGhpcy5kZWxlZ2F0ZUV2ZW50cywgdGhpcyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIGRlbGVnYXRlRXZlbnRzOiBmdW5jdGlvbiAoY2ZnLCBlbnRpdHlJZCkge1xuICAgICAgICAgICAgZWFjaChjZmcsIHRoaXMuZGVsZWdhdGVFdmVudCwgdGhpcywgW2VudGl0eUlkXSk7XG4gICAgICAgICAgICB0aGlzLmVudGl0aWVzLnJlbW92ZUNvbXBvbmVudChlbnRpdHlJZCwgJ2V2ZW50cycpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICBkZWxlZ2F0ZUV2ZW50OiBmdW5jdGlvbiAoY2ZnLCByYXdFdmVudE5hbWUsIGVudGl0eUlkKSB7XG4gICAgICAgICAgICBpZiAodXRpbHMuaXNTdHJpbmcoY2ZnKSB8fCB1dGlscy5pc0Z1bmN0aW9uKGNmZykpIHtcbiAgICAgICAgICAgICAgICBjZmcgPSB7XG4gICAgICAgICAgICAgICAgICAgIGhhbmRsZXI6IGNmZ1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBoYW5kbGVyID0gdGhpcy5nZXRFdmVudEhhbmRsZXIoZW50aXR5SWQsIGNmZyk7XG4gICAgICAgICAgICB2YXIgc3BsaXQgPSByYXdFdmVudE5hbWUuc3BsaXQoL1xccy8pO1xuICAgICAgICAgICAgdmFyIGV2ZW50TmFtZSA9IHNwbGl0LnNoaWZ0KCk7XG4gICAgICAgICAgICB2YXIgc2VsZWN0b3IgPSBjZmcuc2VsZWN0b3IgfHwgc3BsaXQuam9pbignICcpO1xuICAgICAgICAgICAgdmFyIGRlbGVnYXRlID0gdGhpcy5kZWxlZ2F0b3IuY3JlYXRlRGVsZWdhdGUoZXZlbnROYW1lLCBoYW5kbGVyKTtcbiAgICAgICAgICAgIHZhciBkZWxlZ2F0ZWRFdmVudHMgPSB0aGlzLmVudGl0aWVzLmdldENvbXBvbmVudERhdGEoZW50aXR5SWQsICdkZWxlZ2F0ZWRFdmVudHMnKSB8fCBbXTtcblxuICAgICAgICAgICAgdGhpcy5lbnRpdGllcy5zZXRDb21wb25lbnQoZW50aXR5SWQsICdkZWxlZ2F0ZWRFdmVudHMnLCBkZWxlZ2F0ZWRFdmVudHMuY29uY2F0KHtcbiAgICAgICAgICAgICAgICBldmVudDogZXZlbnROYW1lLFxuICAgICAgICAgICAgICAgIGRlbGVnYXRlOiBkZWxlZ2F0ZSxcbiAgICAgICAgICAgICAgICBzZWxlY3Rvcjogc2VsZWN0b3IsXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIGdldEV2ZW50SGFuZGxlcjogZnVuY3Rpb24gKGVudGl0eUlkLCBjZmcpIHtcbiAgICAgICAgICAgIHZhciBoYW5kbGVyID0gY2ZnLmhhbmRsZXI7XG4gICAgICAgICAgICB2YXIgcmVwbyA9IHRoaXMuZW50aXRpZXM7XG4gICAgICAgICAgICB2YXIgbWVzc2FnZXMgPSB0aGlzLm1lc3NhZ2VzO1xuICAgICAgICAgICAgdmFyIHNlbmRNZXNzYWdlID0gZnVuY3Rpb24gKG1zZywgZGF0YSkge1xuICAgICAgICAgICAgICAgIG1lc3NhZ2VzLnRyaWdnZXIobXNnLCBkYXRhKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGlmICh1dGlscy5pc1N0cmluZyhoYW5kbGVyKSkge1xuICAgICAgICAgICAgICAgIGhhbmRsZXIgPSB0aGlzLmhhbmRsZXIgJiYgdGhpcy5oYW5kbGVyW2NmZy5oYW5kbGVyXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgICAgICAgICAgIHZhciBzdGF0ZSwgbmV3U3RhdGU7XG5cbiAgICAgICAgICAgICAgICBpZiAodXRpbHMuaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgICAgICAgICAgICAgICAgICBzdGF0ZSA9IHJlcG8uZ2V0Q29tcG9uZW50KGVudGl0eUlkLCAnc3RhdGUnKTtcbiAgICAgICAgICAgICAgICAgICAgbmV3U3RhdGUgPSBoYW5kbGVyKGV2ZW50LCBzdGF0ZSwgc2VuZE1lc3NhZ2UpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgbmV3U3RhdGUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXBvLnNldENvbXBvbmVudChlbnRpdHlJZCwgJ3N0YXRlJywgbmV3U3RhdGUpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGNmZy5tZXNzYWdlKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXRlID0gcmVwby5nZXRDb21wb25lbnREYXRhKGVudGl0eUlkLCAnc3RhdGUnKTtcbiAgICAgICAgICAgICAgICAgICAgc2VuZE1lc3NhZ2UoY2ZnLm1lc3NhZ2UsIHN0YXRlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9LFxuICAgIH0pO1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgY29xdW9WZW5lbnVtID0gcmVxdWlyZSgnY29xdW8tdmVuZW51bScpO1xuICAgIHZhciBlYWNoID0gcmVxdWlyZSgncHJvLXNpbmd1bGlzJyk7XG4gICAgdmFyIHV0aWxzID0gcmVxdWlyZSgnLi9VdGlscycpO1xuXG4gICAgdmFyIE9ic2VydmFyaSA9IHtcbiAgICAgICAgLyoqIEBsZW5kcyBhbGNoZW15LmNvcmUuT2JzZXJ2YXJpLnByb3RvdHlwZSAqL1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgaW5pdGlhbCBzZXQgb2YgZXZlbnRzO1xuICAgICAgICAgKiBUaGUgY29uZmlndXJhdGlvbiBvYmplY3QgaGFzIHRoZSBmb2xsb3dpbmcgZm9ybTpcbiAgICAgICAgICogPHByZT48Y29kZT5cbiAgICAgICAgICoge1xuICAgICAgICAgKiAgICAgIGV2ZW50MToge1xuICAgICAgICAgKiAgICAgICAgICBmbjoge0Z1bmN0aW9ufSAvLyB0aGUgaGFuZGxlciBmdW5jdGlvblxuICAgICAgICAgKiAgICAgICAgICBzY29wZToge09iamVjdH0gLy8gdGhlIGV4ZWN1dGlvbiBzY29wZSBvZiB0aGUgaGFuZGxlclxuICAgICAgICAgKiAgICAgIH0sXG4gICAgICAgICAqICAgICAgZXZlbnQyOiB7XG4gICAgICAgICAqICAgICAgICAgIC4uLlxuICAgICAgICAgKiAgICAgIH0sXG4gICAgICAgICAqICAgICAgLi4uXG4gICAgICAgICAqIH1cbiAgICAgICAgICogPC9jb2RlPjwvcHJlPlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcHJvcGVydHkgZXZlbnRzXG4gICAgICAgICAqIEB0eXBlIE9iamVjdFxuICAgICAgICAgKi9cbiAgICAgICAgZXZlbnRzOiB1bmRlZmluZWQsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRyaWdnZXJzIGFuIGV2ZW50XG4gICAgICAgICAqIEBmdW5jdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnROYW1lIFRoZSBldmVudCBuYW1lL3R5cGVcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IGRhdGEgVGhlIGV2ZW50IGRhdGEgKGNhbiBiZSBhbnl0aGluZylcbiAgICAgICAgICovXG4gICAgICAgIHRyaWdnZXI6IChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgcHJvY2Vzc0xpc3RlbmVyID0gZnVuY3Rpb24gKGxpc3RlbmVyLCBpbmRleCwgZGF0YSwgZXZlbnRPYmopIHtcbiAgICAgICAgICAgICAgICBsaXN0ZW5lci5mbi5jYWxsKGxpc3RlbmVyLnNjb3BlLCBkYXRhLCBldmVudE9iaik7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGV2ZW50TmFtZSwgZGF0YSkge1xuICAgICAgICAgICAgICAgIHZhciBsaXN0ZW5lcnMgPSB0aGlzLmV2ZW50cyAmJiB1dGlscy5taXgoW10sIHRoaXMuZXZlbnRzW2V2ZW50TmFtZV0pO1xuICAgICAgICAgICAgICAgIHZhciBldmVudE9iaiA9IGdldEV2ZW50T2JqZWN0KHRoaXMsIGV2ZW50TmFtZSk7XG4gICAgICAgICAgICAgICAgdmFyIGFyZ3MgPSBbZGF0YSwgZXZlbnRPYmpdO1xuXG4gICAgICAgICAgICAgICAgLy8gbm90aWZ5IGxpc3RlbmVyIHdoaWNoIGFyZSByZWdpc3RlcmVkIGZvciB0aGUgZ2l2ZW4gZXZlbnQgdHlwZVxuICAgICAgICAgICAgICAgIGVhY2gobGlzdGVuZXJzLCBwcm9jZXNzTGlzdGVuZXIsIHRoaXMsIGFyZ3MpO1xuXG4gICAgICAgICAgICAgICAgLy8gbm90aWZ5IGxpc3RlbmVyIHdoaWNoIGFyZSByZWdpc3RlcmVkIGZvciBhbGwgZXZlbnRzXG4gICAgICAgICAgICAgICAgbGlzdGVuZXJzID0gdGhpcy5ldmVudHMgJiYgdGhpcy5ldmVudHNbJyonXTtcbiAgICAgICAgICAgICAgICBlYWNoKGxpc3RlbmVycywgcHJvY2Vzc0xpc3RlbmVyLCB0aGlzLCBhcmdzKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0oKSksXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogYWRkcyBhIGxpc3RlbmVyIGZvciB0byBhbiBldmVudFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcbiAgICAgICAgICogICAgICB0aGUgZXZlbnQgbmFtZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBoYW5kbGVyXG4gICAgICAgICAqICAgICAgdGhlIGV2ZW50IGhhbmRsZXIgbWV0aG9kXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBzY29wZVxuICAgICAgICAgKiAgICAgIHRoZSBleGVjdXRpb24gc2NvcGUgZm9yIHRoZSBldmVudCBoYW5kbGVyXG4gICAgICAgICAqL1xuICAgICAgICBvbjogZnVuY3Rpb24gKGV2ZW50LCBoYW5kbGVyLCBzY29wZSkge1xuICAgICAgICAgICAgdGhpcy5ldmVudHMgPSB0aGlzLmV2ZW50cyB8fCB7fTtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRzW2V2ZW50XSA9IHRoaXMuZXZlbnRzW2V2ZW50XSB8fCBbXTtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRzW2V2ZW50XS5wdXNoKHtcbiAgICAgICAgICAgICAgICBmbjogaGFuZGxlcixcbiAgICAgICAgICAgICAgICBzY29wZTogc2NvcGVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBZGRzIGEgb25lLXRpbWUgbGlzdGVuZXIgZm9yIHRvIGFuIGV2ZW50OyBUaGlzIGxpc3RlbmVyIHdpbGxcbiAgICAgICAgICogYmUgcmVtb3ZlZCBhZnRlciB0aGUgdGhlIGZpcnN0IGV4ZWN1dGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnROYW1lXG4gICAgICAgICAqICAgICAgdGhlIGV2ZW50IG5hbWVcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gaGFuZGxlclxuICAgICAgICAgKiAgICAgIHRoZSBldmVudCBoYW5kbGVyIG1ldGhvZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gc2NvcGVcbiAgICAgICAgICogICAgICB0aGUgZXhlY3V0aW9uIHNjb3BlIGZvciB0aGUgZXZlbnQgaGFuZGxlclxuICAgICAgICAgKi9cbiAgICAgICAgb25jZTogZnVuY3Rpb24gKGV2ZW50TmFtZSwgaGFuZGxlciwgc2NvcGUpIHtcbiAgICAgICAgICAgIHZhciB3cmFwcGVyID0gZnVuY3Rpb24gKGRhdGEsIGV2ZW50KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5vZmYoZXZlbnROYW1lLCB3cmFwcGVyLCB0aGlzKTtcbiAgICAgICAgICAgICAgICBoYW5kbGVyLmNhbGwoc2NvcGUsIGRhdGEsIGV2ZW50KTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0aGlzLm9uKGV2ZW50TmFtZSwgd3JhcHBlciwgdGhpcyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHJlbW92ZXMgYSBsaXN0ZW5lciBmb3IgZnJvbSBhbiBldmVudFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcbiAgICAgICAgICogICAgICB0aGUgZXZlbnQgbmFtZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBoYW5kbGVyXG4gICAgICAgICAqICAgICAgdGhlIGV2ZW50IGhhbmRsZXIgbWV0aG9kXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBzY29wZVxuICAgICAgICAgKiAgICAgIHRoZSBleGVjdXRpb24gc2NvcGUgZm9yIHRoZSBldmVudCBoYW5kbGVyXG4gICAgICAgICAqL1xuICAgICAgICBvZmY6IGZ1bmN0aW9uIChldmVudCwgaGFuZGxlciwgc2NvcGUpIHtcbiAgICAgICAgICAgIGlmIChldmVudCkge1xuICAgICAgICAgICAgICAgIGNsZWFubGlzdGVuZXJMaXN0KHRoaXMsIGV2ZW50LCBoYW5kbGVyLCBzY29wZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGVhY2godGhpcy5ldmVudHMsIGZ1bmN0aW9uIChldmVudExpc3RuZXIsIGV2ZW50TmFtZSkge1xuICAgICAgICAgICAgICAgICAgICBjbGVhbmxpc3RlbmVyTGlzdCh0aGlzLCBldmVudE5hbWUsIGhhbmRsZXIsIHNjb3BlKTtcbiAgICAgICAgICAgICAgICB9LCB0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICB9O1xuXG4gICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gICAgLy8gcHJpdmF0ZSBoZWxwZXJcbiAgICAvL1xuICAgIC8vXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGFuIG9iamVjdCB3aXRoIG1ldGEgZGF0YSBmb3IgdGhlIGdpdmVuIGV2ZW50IHR5cGVcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGdldEV2ZW50T2JqZWN0KG9ic2VydmFibGUsIGV2ZW50TmFtZSkge1xuICAgICAgICBvYnNlcnZhYmxlLmV2ZW50T2JqID0gb2JzZXJ2YWJsZS5ldmVudE9iaiB8fCB7fTtcbiAgICAgICAgaWYgKCFvYnNlcnZhYmxlLmV2ZW50T2JqW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgICAgIG9ic2VydmFibGUuZXZlbnRPYmpbZXZlbnROYW1lXSA9IHtcbiAgICAgICAgICAgICAgICBuYW1lOiBldmVudE5hbWUsXG4gICAgICAgICAgICAgICAgICBzb3VyY2U6IG9ic2VydmFibGVcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG9ic2VydmFibGUuZXZlbnRPYmpbZXZlbnROYW1lXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQdXJnZXMgdGhlIGxpc3Qgb2YgZXZlbnQgaGFuZGxlcnMgZnJvbSB0aGUgZ2l2ZW4gbGlzdGVuZXJzXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBjbGVhbmxpc3RlbmVyTGlzdChvYnNlcnZhYmxlLCBldmVudCwgZm4sIHNjb3BlKSB7XG4gICAgICAgIHZhciBvbGRMaXN0ID0gKG9ic2VydmFibGUuZXZlbnRzICYmIG9ic2VydmFibGUuZXZlbnRzW2V2ZW50XSkgfHwgW107XG4gICAgICAgIHZhciBuZXdMaXN0ID0gW107XG4gICAgICAgIHZhciBtYXRjaDsgLy8gdHJ1ZSBpZiB0aGUgbGlzdGVuZXIgKGZuLCBzY29wZSkgaXMgcmVnaXN0ZXJlZCBmb3IgdGhlIGV2ZW50XG4gICAgICAgIHZhciBsaXN0ZW5lciA9IG9sZExpc3QucG9wKCk7XG5cbiAgICAgICAgd2hpbGUgKGxpc3RlbmVyKSB7XG4gICAgICAgICAgICBtYXRjaCA9ICghZm4gfHwgZm4gPT09IGxpc3RlbmVyLmZuKSAmJiAoIXNjb3BlIHx8IHNjb3BlID09PSBsaXN0ZW5lci5zY29wZSk7XG5cbiAgICAgICAgICAgIGlmICghbWF0Y2gpIHtcbiAgICAgICAgICAgICAgICBuZXdMaXN0LnB1c2gobGlzdGVuZXIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsaXN0ZW5lci5mbiA9IG51bGw7XG4gICAgICAgICAgICAgICAgbGlzdGVuZXIuc2NvcGUgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGlzdGVuZXIgPSBvbGRMaXN0LnBvcCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5ld0xpc3QubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgb2JzZXJ2YWJsZS5ldmVudHNbZXZlbnRdID0gbmV3TGlzdDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRlbGV0ZSBvYnNlcnZhYmxlLmV2ZW50c1tldmVudF07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gY29xdW9WZW5lbnVtKE9ic2VydmFyaSkud2hlbkRpc3Bvc2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy8gcmVtb3ZlIGFsbCBsaXN0ZW5lcnNcbiAgICAgICAgdGhpcy5vZmYoKTtcblxuICAgICAgICAvLyBjdXQgY2lyY2xlIHJlZmVyZW5jZXMgZm9ybSB0aGUgZXZlbnRPYmpcbiAgICAgICAgZWFjaCh0aGlzLmV2ZW50T2JqLCBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgICAgICAgaXRlbS5uYW1lID0gbnVsbDtcbiAgICAgICAgICAgIGl0ZW0uc291cmNlID0gbnVsbDtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuZXZlbnRPYmogPSBudWxsO1xuICAgIH0pO1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgaW1tdXRhYmxlID0gcmVxdWlyZSgnaW1tdXRhYmlsaXMnKTtcbiAgICB2YXIgY29xdW9WZW5lbnVtID0gcmVxdWlyZSgnY29xdW8tdmVuZW51bScpO1xuICAgIHZhciBlYWNoID0gcmVxdWlyZSgncHJvLXNpbmd1bGlzJyk7XG4gICAgdmFyIHV0aWxzID0gcmVxdWlyZSgnLi9VdGlscycpO1xuXG4gICAgLyoqXG4gICAgICogVE9ETzogZG9jdW1lbnQgbWVcbiAgICAgKlxuICAgICAqIEBjbGFzc1xuICAgICAqIEBuYW1lIGFsY2hlbXkuZWNzLlN0YXRlU3lzdGVtXG4gICAgICogQGV4dGVuZHMgYWxjaGVteS5jb3JlLk1hdGVyaWFQcmltYVxuICAgICAqL1xuICAgIHJldHVybiBjb3F1b1ZlbmVudW0oe1xuICAgICAgICAvKiogQGxlbmRzIGFsY2hlbXkuZWNzLlN0YXRlU3lzdGVtLnByb3RvdHlwZSAqL1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgZW50aXR5IHN0b3JhZ2VcbiAgICAgICAgICpcbiAgICAgICAgICogQHByb3BlcnR5IGVudGl0aWVzXG4gICAgICAgICAqIEB0eXBlIGFsY2hlbXkuZWNzLkFwb3RoZWNhcml1c1xuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgZW50aXRpZXM6IHVuZGVmaW5lZCxcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHByZXZpb3VzIGFwcGxpY2F0aW9uIHN0YXRlICh0aGVyZSBpcyBubyBuZWVkIHRvIHVwZGF0ZSBhbGxcbiAgICAgICAgICogZW50aXRpZXMgaWYgdGhlIGdsb2JhbCBhcHBsaWNhdGlvbiBzdGF0ZSByZW1haW5lZCB1bmNoYW5nZWQpXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwcm9wZXJ0eSBsYXN0U3RhdGVcbiAgICAgICAgICogQHR5cGUgT2JqZWN0XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBsYXN0U3RhdGVzOiB1bmRlZmluZWQsXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogVXBkYXRlcyB0aGUgY29tcG9uZW50IHN5c3RlbSB3aXRoIHRoZSBjdXJyZW50IGFwcGxpY2F0aW9uIHN0YXRlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSBJbW11dGFibGUgY3VycmVudEFwcFN0YXRlIFRoZSBjdXJyZW50IGFwcGxpY2F0aW9uIHN0YXRlXG4gICAgICAgICAqL1xuICAgICAgICB1cGRhdGU6IGZ1bmN0aW9uIChjdXJyZW50QXBwU3RhdGUpIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50QXBwU3RhdGUgPT09IHRoaXMubGFzdFN0YXRlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgc3RhdGVDb21wb25lbnRzID0gdGhpcy5lbnRpdGllcy5nZXRBbGxDb21wb25lbnRzT2ZUeXBlKCdnbG9iYWxUb0xvY2FsJyk7XG5cbiAgICAgICAgICAgIGVhY2goc3RhdGVDb21wb25lbnRzLCB0aGlzLnVwZGF0ZUVudGl0eSwgdGhpcywgW2N1cnJlbnRBcHBTdGF0ZV0pO1xuXG4gICAgICAgICAgICB0aGlzLmxhc3RTdGF0ZSA9IGN1cnJlbnRBcHBTdGF0ZTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgdXBkYXRlRW50aXR5OiBmdW5jdGlvbiAoZ2xvYmFsVG9Mb2NhbCwgZW50aXR5SWQsIGFwcFN0YXRlKSB7XG4gICAgICAgICAgICB2YXIgbmV3U3RhdGUgPSB0aGlzLmVudGl0aWVzLmdldENvbXBvbmVudERhdGEoZW50aXR5SWQsICdzdGF0ZScpIHx8IHt9O1xuXG4gICAgICAgICAgICBpZiAodXRpbHMuaXNGdW5jdGlvbihnbG9iYWxUb0xvY2FsKSkge1xuICAgICAgICAgICAgICAgIG5ld1N0YXRlID0gZ2xvYmFsVG9Mb2NhbChhcHBTdGF0ZSwgbmV3U3RhdGUpO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGVhY2goZ2xvYmFsVG9Mb2NhbCwgZnVuY3Rpb24gKGxvY2FsS2V5LCBnbG9iYWxQYXRoKSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld1N0YXRlW2xvY2FsS2V5XSA9IGltbXV0YWJsZS5maW5kKGFwcFN0YXRlLCBnbG9iYWxQYXRoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5lbnRpdGllcy5zZXRDb21wb25lbnQoZW50aXR5SWQsICdzdGF0ZScsIG5ld1N0YXRlKTtcbiAgICAgICAgfVxuICAgIH0pO1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgY29xdW9WZW5lbnVtID0gcmVxdWlyZSgnY29xdW8tdmVuZW51bScpO1xuICAgIHZhciBlYWNoID0gcmVxdWlyZSgncHJvLXNpbmd1bGlzJyk7XG5cbiAgICByZXR1cm4gY29xdW9WZW5lbnVtKHtcbiAgICAgICAgLyoqIEBsZW5kcyBhbGNoZW15LndlYi5TdHlsdXMucHJvdG90eXBlICovXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFuIGludGVybmFsIHN0b3JlIGZvciBydWxlIG1ldGEgaW5mb3JtYXRpb25zXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwcm9wZXJ0eSBydWxlc1xuICAgICAgICAgKiBAdHlwZSBPYmplY3RcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHJ1bGVzOiB1bmRlZmluZWQsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBDc3NTdHlsZVNoZWV0IHRoYXQgc3RvcmVzIGFsbCBjc3MgcnVsZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHByb3BlcnR5IHNoZWV0XG4gICAgICAgICAqIEB0eXBlIENzc1N0eWxlU2hlZXRcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHNoZWV0OiB1bmRlZmluZWQsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNldHMgQ1NTIHJ1bGVzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSBPYmplY3QgcnVsZXMgQSBzZXQgb2YgcnVsZXMgd2hlcmUgdGhlIGtleXMgYXJlIHRoZSBzZWxlY3RvcnNcbiAgICAgICAgICogICAgICBhbmQgdGhlIHZhbHVlcyB0aGUgY3NzIHJ1bGUgYm9keVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiBzdHlsdXMuc2V0UnVsZXMoe1xuICAgICAgICAgKiAgICdkaXYjc29tZS1pZCAuc29tZS1jbGFzcyB7XG4gICAgICAgICAqICAgICAnYmFja2dyb3VuZCc6ICd1cmwoXCIuLi5cIikgLi4uJyxcbiAgICAgICAgICogICAgIC4uLlxuICAgICAgICAgKiAgIH0sXG4gICAgICAgICAqXG4gICAgICAgICAqICAgJyNzb21lLW90aGVyLWlkIHtcbiAgICAgICAgICogICAgIC4uLlxuICAgICAgICAgKiAgIH0sXG4gICAgICAgICAqXG4gICAgICAgICAqICAgLi4uXG4gICAgICAgICAqIH0pO1xuICAgICAgICAgKi9cbiAgICAgICAgc2V0UnVsZXM6IGZ1bmN0aW9uIChydWxlcykge1xuICAgICAgICAgICAgZWFjaCh0aGlzLnByZXBhcmUocnVsZXMsIHt9LCAnJyksIHRoaXMuc2V0UnVsZSwgdGhpcyk7XG4gICAgICAgIH0sXG5cblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgcHJlcGFyZTogZnVuY3Rpb24gKHJhdywgcmVzdWx0LCBzZWxlY3Rvcikge1xuICAgICAgICAgICAgZWFjaChyYXcsIGZ1bmN0aW9uICh2YWx1ZSwga2V5KSB7XG4gICAgICAgICAgICAgICAgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wcmVwYXJlKHZhbHVlLCByZXN1bHQsIHRoaXMuY29tYmluZVNlbGVjdG9yKHNlbGVjdG9yLCBrZXkpKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJlc3VsdFtzZWxlY3Rvcl0gPSByZXN1bHRbc2VsZWN0b3JdIHx8IHt9O1xuICAgICAgICAgICAgICAgIHJlc3VsdFtzZWxlY3Rvcl1ba2V5XSA9IHZhbHVlO1xuICAgICAgICAgICAgfSwgdGhpcyk7XG5cbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIGNvbWJpbmVTZWxlY3RvcjogZnVuY3Rpb24gKHBhcmVudCwgY2hpbGQpIHtcbiAgICAgICAgICAgIHZhciByZXN1bHQgPSAocGFyZW50ICsgJyAnICsgY2hpbGQpLnJlcGxhY2UoL1xccyomL2csICcnKTtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHNldFJ1bGU6IGZ1bmN0aW9uIChydWxlLCBzZWxlY3Rvcikge1xuICAgICAgICAgICAgdmFyIHJ1bGVTdHIgPSB0aGlzLmNyZWF0ZVJ1bGVTdHIoc2VsZWN0b3IsIHJ1bGUpO1xuICAgICAgICAgICAgdmFyIHNoZWV0ID0gdGhpcy5nZXRTdHlsZVNoZWV0KCk7XG4gICAgICAgICAgICB2YXIgcnVsZURhdGEgPSB0aGlzLnJ1bGVzW3NlbGVjdG9yXTtcblxuICAgICAgICAgICAgaWYgKHJ1bGVEYXRhKSB7XG4gICAgICAgICAgICAgICAgLy8gdXBkYXRlIGV4aXN0aW5nIHJ1bGVcbiAgICAgICAgICAgICAgICBzaGVldC5kZWxldGVSdWxlKHJ1bGVEYXRhLmluZGV4KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gYWRkIG5ldyBydWxlXG4gICAgICAgICAgICAgICAgcnVsZURhdGEgPSB7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4OiBzaGVldC5jc3NSdWxlcy5sZW5ndGhcbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgdGhpcy5ydWxlc1tzZWxlY3Rvcl0gPSBydWxlRGF0YTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc2hlZXQuaW5zZXJ0UnVsZShydWxlU3RyLCBydWxlRGF0YS5pbmRleCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIGNyZWF0ZVJ1bGVTdHI6IGZ1bmN0aW9uIChzZWxlY3RvciwgcnVsZSkge1xuICAgICAgICAgICAgdmFyIHByb3BzID0gJyc7XG4gICAgICAgICAgICBlYWNoKHJ1bGUsIGZ1bmN0aW9uICh2YWx1ZSwga2V5KSB7XG4gICAgICAgICAgICAgICAgcHJvcHMgKz0ga2V5ICsgJzonICsgdmFsdWUgKyAnOyc7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIHNlbGVjdG9yICsgJ3snICsgcHJvcHMgKyAnfSc7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIGdldFN0eWxlU2hlZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5zaGVldCkge1xuICAgICAgICAgICAgICAgIHZhciBzdHlsZUVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKHN0eWxlRWwpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2hlZXQgPSBzdHlsZUVsLnNoZWV0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5zaGVldDtcbiAgICAgICAgfSxcblxuICAgIH0pLndoZW5CcmV3ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnJ1bGVzID0ge307XG5cbiAgICB9KS53aGVuRGlzcG9zZWQoZnVuY3Rpb24gKCkge1xuICAgICAgICB3aGlsZSAodGhpcy5zaGVldCAmJiB0aGlzLnNoZWV0LmNzc1J1bGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHRoaXMuc2hlZXQuZGVsZXRlUnVsZSgwKTtcbiAgICAgICAgfVxuICAgIH0pO1xufSgpKTtcbiIsIi8qXG4gKiAgIOKAnE1lZGljaW5lLCBhbmQgTGF3LCBhbmQgUGhpbG9zb3BoeSAtXG4gKiAgICBZb3UndmUgd29ya2VkIHlvdXIgd2F5IHRocm91Z2ggZXZlcnkgc2Nob29sLFxuICogICAgRXZlbiwgR29kIGhlbHAgeW91LCBUaGVvbG9neSxcbiAqICAgIEFuZCBzd2VhdGVkIGF0IGl0IGxpa2UgYSBmb29sLlxuICogICAgV2h5IGxhYm91ciBhdCBpdCBhbnkgbW9yZT9cbiAqICAgIFlvdSdyZSBubyB3aXNlciBub3cgdGhhbiB5b3Ugd2VyZSBiZWZvcmUuXG4gKiAgICBZb3UncmUgTWFzdGVyIG9mIEFydHMsIGFuZCBEb2N0b3IgdG9vLFxuICogICAgQW5kIGZvciB0ZW4geWVhcnMgYWxsIHlvdSd2ZSBiZWVuIGFibGUgdG8gZG9cbiAqICAgIElzIGxlYWQgeW91ciBzdHVkZW50cyBhIGZlYXJmdWwgZGFuY2VcbiAqICAgIFRocm91Z2ggYSBtYXplIG9mIGVycm9yIGFuZCBpZ25vcmFuY2UuXG4gKiAgICBBbmQgYWxsIHRoaXMgbWlzZXJ5IGdvZXMgdG8gc2hvd1xuICogICAgVGhlcmUncyBub3RoaW5nIHdlIGNhbiBldmVyIGtub3cuXG4gKiAgICBPaCB5ZXMgeW91J3JlIGJyaWdodGVyIHRoYW4gYWxsIHRob3NlIHJlbGljcyxcbiAqICAgIFByb2Zlc3NvcnMgYW5kIERvY3RvcnMsIHNjcmliYmxlcnMgYW5kIGNsZXJpY3MsXG4gKiAgICBObyBkb3VidHMgb3Igc2NydXBsZXMgdG8gdHJvdWJsZSB5b3UsXG4gKiAgICBEZWZ5aW5nIGhlbGwsIGFuZCB0aGUgRGV2aWwgdG9vLlxuICogICAgQnV0IHRoZXJlJ3Mgbm8gam95IGluIHNlbGYtZGVsdXNpb247XG4gKiAgICBZb3VyIHNlYXJjaCBmb3IgdHJ1dGggZW5kcyBpbiBjb25mdXNpb24uXG4gKiAgICBEb24ndCBpbWFnaW5lIHlvdXIgdGVhY2hpbmcgd2lsbCBldmVyIHJhaXNlXG4gKiAgICBUaGUgbWluZHMgb2YgbWVuIG9yIGNoYW5nZSB0aGVpciB3YXlzLlxuICogICAgQW5kIGFzIGZvciB3b3JsZGx5IHdlYWx0aCwgeW91IGhhdmUgbm9uZSAtXG4gKiAgICBXaGF0IGhvbm91ciBvciBnbG9yeSBoYXZlIHlvdSB3b24/XG4gKiAgICBBIGRvZyBjb3VsZCBzdGFuZCB0aGlzIGxpZmUgbm8gbW9yZS5cbiAqICAgIEFuZCBzbyBJJ3ZlIHR1cm5lZCB0byBtYWdpYyBsb3JlO1xuICogICAgVGhlIHNwaXJpdCBtZXNzYWdlIG9mIHRoaXMgYXJ0XG4gKiAgICBTb21lIHNlY3JldCBrbm93bGVkZ2UgbWlnaHQgaW1wYXJ0LlxuICogICAgTm8gbG9uZ2VyIHNoYWxsIEkgc3dlYXQgdG8gdGVhY2hcbiAqICAgIFdoYXQgYWx3YXlzIGxheSBiZXlvbmQgbXkgcmVhY2g7XG4gKiAgICBJJ2xsIGtub3cgd2hhdCBtYWtlcyB0aGUgd29ybGQgcmV2b2x2ZSxcbiAqICAgIEl0cyBteXN0ZXJpZXMgcmVzb2x2ZSxcbiAqICAgIE5vIG1vcmUgaW4gZW1wdHkgd29yZHMgSSdsbCBkZWFsIC1cbiAqICAgIENyZWF0aW9uJ3Mgd2VsbHNwcmluZ3MgSSdsbCByZXZlYWwh4oCdXG4gKiAgICAgICAgICAgIOKAlSBKb2hhbm4gV29sZmdhbmcgdm9uIEdvZXRoZSwgRmF1c3RcbiAqL1xuKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgaXNCcm93c2VyID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCc7XG4gICAgdmFyIGVhY2ggPSByZXF1aXJlKCdwcm8tc2luZ3VsaXMnKTtcbiAgICB2YXIgVXRpbHMgPSB7fTtcblxuICAgIC8qKlxuICAgICAqIGhlbHBlciB0byB0dXJuIHRoZSBmaXJzdCBsZXR0ZXIgb2YgYSBzdHJpbmcgdG8gdXBwZXIgY2FzZVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgZnVuY3Rpb24gdWNGaXJzdChzKSB7XG4gICAgICAgIHJldHVybiBVdGlscy5pc1N0cmluZyhzKSA/IHMuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBzLnN1YnN0cigxLCBzLmxlbmd0aCkgOiAnJztcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBVdGlscztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiB0aGUgcHJlZml4IGZvciBpbnRlcm5hbCB0eXBlIGFuZCBtZXRob2QgbWV0YSBwcm9wZXJ0aWVzXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgbWV0YVByZWZpeFxuICAgICAqIEB0eXBlIFN0cmluZ1xuICAgICAqL1xuICAgIFV0aWxzLm1ldGFQcmVmaXggPSAnX0FKU18nO1xuXG4gICAgLyoqXG4gICAgICogQ2hlY2tzIGlmIGEgZ2l2ZW4gaXRlbSBpcyBhbiBvYmplY3QuXG4gICAgICogTm90aWNlIHRoYXQgZXZlcnkgYXJyYXkgaXMgYW4gb2JqZWN0IGJ1dCBub3QgZXZlcnkgb2JqZWN0XG4gICAgICogaXMgYW4gYXJyYXkgKHdoaWNoIGlzIGFsc28gdHJ1ZSBmb3IgZnVuY3Rpb25zKS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmFyaW91c30gbyBUaGUgaXRlbSB0byBiZSBjaGVja2VkXG4gICAgICogQHJldHVybiB7Qm9vbGVhbn0gPGNvZGU+dHJ1ZTwvY29kZT4gaWYgdGhlIGdpdmVuIGl0ZW0gaXMgYW4gb2JqZWN0XG4gICAgICovXG4gICAgVXRpbHMuaXNPYmplY3QgPSBmdW5jdGlvbiBpc09iamVjdChvKSB7XG4gICAgICAgIHJldHVybiBvICYmICh0eXBlb2YgbyA9PT0gJ29iamVjdCcgfHwgdHlwZW9mIG8gPT09ICdmdW5jdGlvbicpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBDaGVja3MgaWYgYSBnaXZlbiBpdGVtIGlzIGFuIGFycmF5XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZhcmlvdXN9IGEgVGhlIGl0ZW0gdG8gYmUgY2hlY2tlZFxuICAgICAqIEByZXR1cm4ge0Jvb2xlYW59IDxjb2RlPnRydWU8L2NvZGU+IGlmIHRoZSBnaXZlbiBpdGVtIGlzIGFuIGFycmF5XG4gICAgICovXG4gICAgVXRpbHMuaXNBcnJheSA9IGZ1bmN0aW9uIGlzQXJyYXkoYSkge1xuICAgICAgICByZXR1cm4gYSBpbnN0YW5jZW9mIEFycmF5O1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBDaGVja3MgaWYgYSBnaXZlbiBpdGVtIGlzIGEgZnVuY3Rpb25cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmFyaW91c30gZiBUaGUgaXRlbSB0byBiZSBjaGVja2VkXG4gICAgICogQHJldHVybiB7Qm9vbGVhbn0gPGNvZGU+dHJ1ZTwvY29kZT4gaWYgdGhlIGdpdmVuIGl0ZW0gaXMgYSBmdW5jdGlvblxuICAgICAqL1xuICAgIFV0aWxzLmlzRnVuY3Rpb24gPSBmdW5jdGlvbiBpc0Z1bmN0aW9uKGYpIHtcbiAgICAgICAgcmV0dXJuIHR5cGVvZiBmID09PSAnZnVuY3Rpb24nO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBDaGVja3MgaWYgYSBnaXZlbiBpdGVtIGlzIGEgbnVtYmVyXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZhcmlvdXN9IG4gVGhlIGl0ZW0gdG8gYmUgY2hlY2tlZFxuICAgICAqIEByZXR1cm4ge0Jvb2xlYW59IDxjb2RlPnRydWU8L2NvZGU+IGlmIHRoZSBnaXZlbiBpdGVtIGlzIGEgbnVtYmVyXG4gICAgICovXG4gICAgVXRpbHMuaXNOdW1iZXIgPSBmdW5jdGlvbiBpc051bWJlcihuKSB7XG4gICAgICAgIHJldHVybiB0eXBlb2YgbiA9PT0gJ251bWJlcicgJiYgIWlzTmFOKG4pO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBDaGVja3MgaWYgYSBnaXZlbiBpdGVtIGlzIGEgc3RyaW5nXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZhcmlvdXN9IHMgVGhlIGl0ZW0gdG8gYmUgY2hlY2tlZFxuICAgICAqIEByZXR1cm4ge0Jvb2xlYW59IDxjb2RlPnRydWU8L2NvZGU+IGlmIHRoZSBnaXZlbiBpdGVtIGlzIGEgc3RyaW5nXG4gICAgICovXG4gICAgVXRpbHMuaXNTdHJpbmcgPSBmdW5jdGlvbiBpc1N0cmluZyhzKSB7XG4gICAgICAgIHJldHVybiB0eXBlb2YgcyA9PT0gJ3N0cmluZyc7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIENoZWNrcyBpZiB0aGUgZ2l2ZW4gaXRlbSBpcyBhIGJvb2xlYW5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmFyaW91c30gYiB0aGUgdmFsdWUgdG8gY2hlY2tcbiAgICAgKiBAcmV0dXJuIHtCb29sZWFufSA8Y29kZT50cnVlPC9jb2RlPiBpZiBhbmQgb25seSBpZiB0aGUgY2hlY2sgaXMgcGFzc2VkXG4gICAgICovXG4gICAgVXRpbHMuaXNCb29sZWFuID0gZnVuY3Rpb24gaXNCb29sZWFuKGIpIHtcbiAgICAgICAgcmV0dXJuIHR5cGVvZiBiID09PSAnYm9vbGVhbic7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIENoZWNrcyBpZiB0aGUgZ2l2ZW4gdmFsdWUgaXMgZGVmaW5lZFxuICAgICAqXG4gICAgICogQHBhcmFtIHtWYXJpb3VzfSB4IHRoZSB2YWx1ZSB0byBjaGVja1xuICAgICAqIEByZXR1cm4ge0Jvb2xlYW59IDxjb2RlPnRydWU8L2NvZGU+IGlmIGFuZCBvbmx5IGlmIHRoZSBjaGVjayBpcyBwYXNzZWRcbiAgICAgKi9cbiAgICBVdGlscy5pc0RlZmluZWQgPSBmdW5jdGlvbiBpc0RlZmluZWQoeCkge1xuICAgICAgICByZXR1cm4gVXRpbHMuaXNOdW1iZXIoeCkgfHwgVXRpbHMuaXNTdHJpbmcoeCkgfHwgVXRpbHMuaXNPYmplY3QoeCkgfHwgVXRpbHMuaXNBcnJheSh4KSB8fCBVdGlscy5pc0Z1bmN0aW9uKHgpIHx8IFV0aWxzLmlzQm9vbGVhbih4KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogSXRlcmF0ZXMgb2YgYW4gaXRlcmFibGUgb2JqZWN0IGFuZCBjYWxsIHRoZSBnaXZlbiBtZXRob2QgZm9yIGVhY2ggaXRlbVxuICAgICAqIEZvciBleGFtcGxlOlxuICAgICAqIDxwcmU+PGNvZGU+XG4gICAgICogICAgICAvLyAoYSkgZGVmYXVsdCB1c2UgY2FzZSBpdGVyYXRlIHRocm91Z2ggYW4gYXJyYXkgb3IgYW4gb2JqZWN0XG4gICAgICogICAgICBVdGlscy5lYWNoKFsxLCAyLCAuLi4sIG5dLCBmdW5jdGlvbiBkb1N0dWZmKHZhbCkgeyAuLi4gfSk7XG4gICAgICpcbiAgICAgKiAgICAgIC8vIChiKSBtYXAgZGF0YVxuICAgICAqICAgICAgVXRpbHMuZWFjaChbMSwgMiwgM10sIGZ1bmN0aW9uIGRvdWJsZSh2YWwpIHtcbiAgICAgKiAgICAgICAgICByZXR1cm4gMiAqIHZhbDtcbiAgICAgKiAgICAgIH0pOyAvLyAtPiBbMiwgNCwgNl1cbiAgICAgKiAgICAgIFV0aWxzLmVhY2goe2ZvbzogMSwgYmFyOiAyfSwgZnVuY3Rpb24gZG91YmxlKHZhbCkge1xuICAgICAqICAgICAgICAgIHJldHVybiAyICogdmFsO1xuICAgICAqICAgICAgfSk7IC8vIC0+IHtmb286IDIsIGJhcjogNH1cbiAgICAgKlxuICAgICAqICAgICAgLy8gKGMpIGZpbHRlciBkYXRhXG4gICAgICogICAgICBVdGlscy5lYWNoKFsxLCAyLCAzLCA0XSwgZnVuY3Rpb24gKHZhbCkge1xuICAgICAqICAgICAgICAgIHJldHVybiAodmFsICUgMiA9PT0gMCkgPyB2YWwgOiB1bmRlZmluZWQ7XG4gICAgICogICAgICB9KTsgLy8gLT4gWzIsIDRdXG4gICAgICogICAgICBVdGlscy5lYWNoKHsgZm9vOiAxLCBiYXI6IDIsIGJhejogMywgfSwgZnVuY3Rpb24gdW5ldmVuKHZhbCkge1xuICAgICAqICAgICAgICAgIHJldHVybiAodmFsICUgMiAhPT0gMCkgPyB2YWwgOiB1bmRlZmluZWQ7XG4gICAgICogICAgICB9KTsgLy8gLT4geyBmb286IDEsIGJhejogMyB9XG4gICAgICogPC9jb2RlPjwvcHJlPlxuICAgICAqXG4gICAgICogQGRlcHJlY2F0ZWRcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0L0FycmF5fSBpdGVyYWJsZSBUaGUgb2JqZWN0IHRvIGl0ZXJhdGUgdGhyb3VnaFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGZuIFRoZSBjYWxsYmFjayBmdW5jdGlvbiB0byBiZSBjYWxsZWQgZm9yIGVhY2ggaXRlbVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBzY29wZSBUaGUgZXhlY3V0aW9uIHNjb3BlIGZvciB0aGUgY2FsbGJhY2sgZnVuY3Rpb25cbiAgICAgKiBAcGFyYW0ge0FycmF5fSBtb3JlIE9wdGlvbmFsOyBhbiBhZGRpb25hbCBzZXQgb2YgYXJndW1lbnRzIHdoaWNoIHdpbGxcbiAgICAgKiAgICAgIGJlIHBhc3NlZCB0byB0aGUgY2FsbGJhY2sgZnVuY3Rpb25cbiAgICAgKiBAcmV0dXJuIHtPYmplY3QvQXJyYXl9IFRoZSBhZ2dyZWdhdGVkIHJlc3VsdHMgb2YgZWFjaCBjYWxsYmFjayAoc2VlIGV4YW1wbGVzKVxuICAgICAqL1xuICAgIFV0aWxzLmVhY2ggPSBlYWNoO1xuXG4gICAgLyoqXG4gICAgICogTWl4ZXMgdGhlIGdpdmVuIGFkZGl0aXZlcyB0byB0aGUgc291cmNlIG9iamVjdFxuICAgICAqIEV4YW1wbGUgdXNhZ2U6XG4gICAgICogPHByZT48Y29kZT5cbiAgICAgKiAvLyBmaXJzdCBhZGQgZGVmYXVsdHMgdmFsdWVzIHRvIGEgbmV3IG9iamVjdCBhbmQgdGhlbiBvdmVycmlkZXMgdGhlIGRlZmF1bHRzXG4gICAgICogLy8gd2l0aCB0aGUgYWN0dWFsIHZhbHVlc1xuICAgICAqIFV0aWxzLm1peCh7fSwgZGVmYXVsdHMsIHZhbHVlcyk7XG4gICAgICogPC9jb2RlPjwvcHJlPlxuICAgICAqIEBmdW5jdGlvblxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGJhc2VcbiAgICAgKiAgICAgIHRoZSBzb3VyY2Ugb2JqZWN0ICh3aWxsIGJlIG1vZGlmaWVkISlcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSAuLi5vdmVycmlkZXNcbiAgICAgKiAgICAgIHRoZSBzZXQgb2YgYWRkaXRpdmVzXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIE9iamVjdFxuICAgICAqICAgICAgdGhlIG1vZGlmaWVkIHNvdXJjZSBvYmplY3RcbiAgICAgKi9cbiAgICBVdGlscy5taXggPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICBmdW5jdGlvbiBtaXhPbmVJdGVtKHZhbHVlLCBrZXksIG9iaikge1xuICAgICAgICAgICAgb2JqW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICB2YXIgYmFzZSA9IGFyZ3Muc2hpZnQoKTtcbiAgICAgICAgICAgIHZhciBuZXh0O1xuXG4gICAgICAgICAgICB3aGlsZSAoYXJncy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBuZXh0ID0gYXJncy5zaGlmdCgpO1xuICAgICAgICAgICAgICAgIGVhY2gobmV4dCwgbWl4T25lSXRlbSwgbnVsbCwgW2Jhc2VdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBiYXNlO1xuICAgICAgICB9O1xuICAgIH0oKSk7XG5cbiAgICAvKipcbiAgICAgKiBNZWx0cyB0d28gb2JqZWN0IGRlZXBseSB0b2dldGhlciBpbiBhIG5ldyBvYmplY3RcbiAgICAgKiBFeGFtcGxlIHVzYWdlOlxuICAgICAqXG4gICAgICogPHByZT48Y29kZT5cbiAgICAgKiAgIFV0aWxzLm1lbHQoeyBmb286IDEgfSwgeyBiYXI6IDEgfSk7IC8vIC0+IHsgZm9vOiAxLCBiYXI6IDEgfTtcbiAgICAgKiAgIFV0aWxzLm1lbHQoe30sIHNvbWVPYmopOyAvLyAtPiBkZWVwIGNsb25lIG9mIHNvbWVPYmpcbiAgICAgKiA8L2NvZGU+PC9wcmU+XG4gICAgICpcbiAgICAgKiBOT1RJQ0U6IEFycmF5IGFuZCBub25lLWRhdGEtb2JqZWN0cyAob2JqZWN0cyB3aXRoIGEgY29uc3RydWN0b3Igb3RoZXJcbiAgICAgKiB0aGFuIE9iamVjdCkgYXJlIHRyZWF0ZWQgYXMgYXRvbWljIHZhbHVlIGFuZCBhcmUgbm90IG1lcmdlZFxuICAgICAqIEBmdW5jdGlvblxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9iajEgRmlyc3Qgc291cmNlIG9iamVjdFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmoyIFRoZSBzZWNvbmQgc291cmNlIG9iamVjdFxuICAgICAqIEByZXR1cm4gT2JqZWN0IFRoZSBkZWVwbHkgbWVsdGVkIHJlc3VsdFxuICAgICAqL1xuICAgIFV0aWxzLm1lbHQgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgbWVsdFZhbHVlID0gZWFjaC5wcmVwYXJlKGZ1bmN0aW9uICh2YWx1ZSwga2V5LCByZXN1bHQpIHtcbiAgICAgICAgICAgIGlmICh2YWx1ZSAmJiAodmFsdWUuY29uc3RydWN0b3IgPT09IE9iamVjdCkpIHtcbiAgICAgICAgICAgICAgICByZXN1bHRba2V5XSA9IFV0aWxzLm1lbHQocmVzdWx0W2tleV0sIHZhbHVlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0W2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgbnVsbCk7XG5cbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChvYmoxLCBvYmoyKSB7XG4gICAgICAgICAgICB2YXIgcmVzdWx0ID0ge307XG5cbiAgICAgICAgICAgIG1lbHRWYWx1ZShvYmoxLCBbcmVzdWx0XSk7XG4gICAgICAgICAgICBtZWx0VmFsdWUob2JqMiwgW3Jlc3VsdF0pO1xuXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9O1xuICAgIH0oKSk7XG5cbiAgICAvKipcbiAgICAgKiBBbGxvd3Mgb3ZlcnJpZGluZyBtZXRob2RzIG9mIGFuIGdpdmVuIG9iamVjdC4gSWYgdGhlIGJhc2Ugb2JqZWN0IGhhc1xuICAgICAqIGFscmVhZHkgYSBtZXRob2Qgd2l0aCB0aGUgc2FtZSBrZXkgdGhpcyBvbmUgd2lsbCBiZSBoaWRkZW4gYnV0IGRvZXMgbm90XG4gICAgICogZ2V0IGxvc3QuIFlvdSBjYW4gYWNjZXNzIHRoZSBvdmVycmlkZGVuIG1ldGhvZCB1c2luZ1xuICAgICAqIDxjb2RlPl9zdXBlci5jYWxsKHRoaXMsIC4uLik8L2NvZGU+XG4gICAgICpcbiAgICAgKiBGb3IgZXhhbXBsZTogPHByZT48Y29kZT5cbiAgICAgKiB2YXIgb2JqID0ge1xuICAgICAqICAgICAgZm9vOiBmdW5jdGlvbiAoKSB7XG4gICAgICogICAgICAgICAgcmV0dXJuICdmb28nO1xuICAgICAqICAgICAgfVxuICAgICAqIH07XG4gICAgICpcbiAgICAgKiBVdGlscy5vdmVycmlkZShvYmosIHtcbiAgICAgKiAgICAgIGZvbzogVXRpbHMub3ZlcnJpZGUoZnVuY3Rpb24gKF9zdXBlcikge1xuICAgICAqICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICogICAgICAgICAgICAgIHJldHVybiBfc3VwZXIuY2FsbCh0aGlzKSArICcgLSBiYXInO1xuICAgICAqICAgICAgICAgIH07XG4gICAgICogICAgICB9KVxuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogb2JqLmZvbygpOyAvLyB3aWxsIHJldHVybiAnZm9vIC0gYmFyJ1xuICAgICAqIDwvY29kZT48L3ByZT5cbiAgICAgKiBAZnVuY3Rpb25cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBiYXNlXG4gICAgICogICAgICBUaGUgYmFzZSBvYmplY3QgdG8gYmUgb3ZlcnJpZGRlbiAod2lsbCBiZSBtb2RpZmllZCEpXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb3ZlcnJpZGVzXG4gICAgICogICAgICBUaGUgc2V0IG9mIG5ldyBtZXRob2RzXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICogICAgICBUaGUgbW9kaWZpZWQgb2JqZWN0XG4gICAgICovXG4gICAgVXRpbHMub3ZlcnJpZGUgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyBoZWxwZXIgdG8gZGVjaWRlIHdoZXRoZXIgaXQgaXMgYSBtYWdpYyBtZXRhIGZ1bmN0aW9uIHRoYXQgY3JlYXRlcyB0aGUgYWN0dWFsIG9iamVjdCBtZXRob2RcbiAgICAgICAgZnVuY3Rpb24gaXNNYWdpY01ldGhvZChmbikge1xuICAgICAgICAgICAgcmV0dXJuIGZuICYmIChmbi5ob2N1c3BvY3VzID09PSB0cnVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGhlbHBlciB0byBpZGVudGlmeSBwcm9wZXJ0eSBkZXNjcmlwdG9yc1xuICAgICAgICBmdW5jdGlvbiBpc1Byb3BlcnR5RGVmKG9iaikge1xuICAgICAgICAgICAgcmV0dXJuIFV0aWxzLmlzT2JqZWN0KG9iaikgJiYgVXRpbHMubWV0YShvYmosICdpc1Byb3BlcnR5Jyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBoZWxwZXIgbWV0aG9kIHRvIGFkZCBhIHNpbmdsZSBwcm9wZXJ0eVxuICAgICAgICBmdW5jdGlvbiBhZGRQcm9wZXJ0eShwcm9wLCBrZXksIG9iaikge1xuICAgICAgICAgICAgaWYgKFV0aWxzLmlzRnVuY3Rpb24ocHJvcCkpIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNNYWdpY01ldGhvZChwcm9wKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyB5b3Ugc2FpZCB0aGUgbWFnaWMgd29yZHMgc28geW91IHdpbGwgZ2V0IHlvdXIgcmVmZXJlbmNlIHRvIHRoZSBvdmVycmlkZGVuIG1ldGhvZFxuICAgICAgICAgICAgICAgICAgICBwcm9wID0gcHJvcChvYmpba2V5XSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGlzUHJvcGVydHlEZWYocHJvcCkpIHtcbiAgICAgICAgICAgICAgICBVdGlscy5kZWZpbmVQcm9wZXJ0eShvYmosIGtleSwgcHJvcCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG9ialtrZXldID0gcHJvcDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoYmFzZSwgb3ZlcnJpZGVzKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGJhc2UgPT09ICdmdW5jdGlvbicgJiYgdHlwZW9mIG92ZXJyaWRlcyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICBiYXNlLmhvY3VzcG9jdXMgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHJldHVybiBiYXNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob3ZlcnJpZGVzICYmIG92ZXJyaWRlcy5jb25zdHJ1Y3RvciAhPT0gT2JqZWN0LnByb3RvdHlwZS5jb25zdHJ1Y3Rvcikge1xuICAgICAgICAgICAgICAgIGFkZFByb3BlcnR5KG92ZXJyaWRlcy5jb25zdHJ1Y3RvciwgJ2NvbnN0cnVjdG9yJywgYmFzZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGVhY2gob3ZlcnJpZGVzLCBhZGRQcm9wZXJ0eSwgbnVsbCwgW2Jhc2VdKTtcblxuICAgICAgICAgICAgcmV0dXJuIGJhc2U7XG4gICAgICAgIH07XG4gICAgfSgpKTtcblxuICAgIC8qKlxuICAgICAqIEBmdW5jdGlvblxuICAgICAqL1xuICAgIFV0aWxzLmV4dGVuZCA9IGZ1bmN0aW9uIGV4dGVuZChiYXNlLCBvdmVycmlkZXMpIHtcbiAgICAgICAgdmFyIGV4dGVuZGVkID0gT2JqZWN0LmNyZWF0ZShiYXNlKTtcblxuICAgICAgICBpZiAoVXRpbHMuaXNGdW5jdGlvbihvdmVycmlkZXMpKSB7XG4gICAgICAgICAgICBvdmVycmlkZXMgPSBvdmVycmlkZXMoYmFzZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3ZlcnJpZGVzKSB7XG4gICAgICAgICAgICBVdGlscy5vdmVycmlkZShleHRlbmRlZCwgb3ZlcnJpZGVzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBleHRlbmRlZDtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogRXh0cmFjdCB2YWx1ZXMgb2YgYSBzcGVjaWZpYyBwcm9wZXJ0eSBmcm9tIGEgZ2l2ZW4gc2V0IG9mIGl0ZW1zXG4gICAgICogRm9yIGV4YW1wbGU6XG4gICAgICogPHByZT48Y29kZT5cbiAgICAgKiBVdGlscy5leHRyYWN0KFt7a2V5OiAnZm9vJ30sIHtrZXk6ICdiYXInfSwgLi4uIF0sICdrZXknKTsgLy8gLT4gWydmb28nLCAnYmFyJywgLi4uXVxuICAgICAqIFV0aWxzLmV4dHJhY3Qoe28xOiB7a2V5OiAnZm9vJ30sIG8yOiB7a2V5OiAnYmFyJ30sIC4uLn0sICdrZXknKTsgLy8gLT4gWydmb28nLCAnYmFyJywgLi4uXVxuICAgICAqIDwvY29kZT48L3ByZT5cbiAgICAgKiBAZnVuY3Rpb25cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXJyYXkvT2JqZWN0fSBsaXN0XG4gICAgICogICAgICBUaGUgaW5pdGlhbCBzZXQgb2YgaXRlbXNcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBwcm9wZXJ0eVxuICAgICAqICAgICAgVGhlIG5hbWUgb2YgdGhlIHByb3BlcnR5IHRvIGV4dHJhY3RcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXJyYXl9XG4gICAgICogICAgICBUaGUgYXJyYXkgb2YgZXh0cmFjdGVkIHZhbHVlc1xuICAgICAqL1xuICAgIFV0aWxzLmV4dHJhY3QgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICBmdW5jdGlvbiBleHRyYWN0T25lKGl0ZW0sIGluZGV4LCBrZXksIHJlc3VsdCkge1xuICAgICAgICAgICAgaWYgKFV0aWxzLmlzT2JqZWN0KGl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnB1c2goaXRlbVtrZXldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGxpc3QsIHByb3BlcnR5KSB7XG4gICAgICAgICAgICB2YXIgcmVzdWx0ID0gW107XG4gICAgICAgICAgICBlYWNoKGxpc3QsIGV4dHJhY3RPbmUsIG51bGwsIFtwcm9wZXJ0eSwgcmVzdWx0XSk7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9O1xuICAgIH0oKSk7XG5cbiAgICAvKipcbiAgICAgKiBGaWx0ZXMgYSBzZXQgKGFycmF5IG9yIGhhc2ggb2JqZWN0KSB0byBjb250YWluIG9ubHkgdW5pcXVlIHZhbHVlc1xuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheXxPYmplY3R9IGxpc3QgVGhlIGxpc3QgdG8gYmUgZmlsdGVyZWRcbiAgICAgKiBAcmV0dXJuIHtBcnJheXxPYmplY3R9IFRoZSBmaWx0ZXJlZCBsaXN0XG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIFV0aWxzLnVuaXF1ZShbMSwgMywgNCwgMSwgMywgNV0pOyAvLyAtPiBbMSwgMywgNCwgNV1cbiAgICAgKiBVdGlscy51bmlxdWUoe2ZvbzogJ2ZvbycsIGJhcjogJ2ZvbycsIGJhejogJ2JheicpOyAvLyAtPiB7Zm9vOiAnZm9vJywgYmF6OiAnYmF6J31cbiAgICAgKi9cbiAgICBVdGlscy51bmlxdWUgPSBmdW5jdGlvbiB1bmlxdWUobGlzdCkge1xuICAgICAgICB2YXIgdXNlZCA9IHt9O1xuICAgICAgICByZXR1cm4gZWFjaChsaXN0LCBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgICAgICAgaWYgKHVzZWRbaXRlbV0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHVzZWRbaXRlbV0gPSB0cnVlO1xuICAgICAgICAgICAgcmV0dXJuIGl0ZW07XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgc2V0IG9mIHVuaXF1ZSB2YWx1ZXMgZnJvbSB0aGUgZ2l2ZW4gaW5wdXRcbiAgICAgKiBAZnVuY3Rpb25cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fSAuLi5hcmdzIFRoZSBpbml0aWFsIGRhdGEgc2V0c1xuICAgICAqXG4gICAgICogQHJldHVybiB7QXJyYXl9IEFuIGFycmF5IGNvbnRhaW5pbmcgdGhlIHVuaXF1ZSB2YWx1ZXNcbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogVXRpbHMudW5pb24oWzEsIDIsIDQsIDEwXSwgWzMsIDRdLCBbMSwgMiwgNSwgMTAxXSk7IC8vIC0+IFsxLCAyLCA0LCAxMCwgMywgNSwgMTAxXVxuICAgICAqIFV0aWxzLnVuaW9uKHtmb286ICdmb28nfSwge2JhcjogJ2Jhcid9LCB7YmFyOiAnYmF6J30pOyAvLyAtPiBbJ2ZvbycsICdiYXInLCAnYmF6J11cbiAgICAgKiBVdGlscy51bmlvbih7Zm9vOiAnZm9vJ30sIFsnZm9vJywgJ2JhciddLCB7YmFyOiAnYmF6J30pIC8vIC0+IFsnZm9vJywgJ2JhcicsICdiYXonXVxuICAgICAqL1xuICAgIFV0aWxzLnVuaW9uID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZnVuY3Rpb24gcHJvY2Vzc09uZUFyZ3VtZW50KGFycmF5LCBpbmRleCwgcmVzdWx0LCBzZWVuKSB7XG4gICAgICAgICAgICBlYWNoKGFycmF5LCBwcm9jZXNzT25lVmFsdWUsIG51bGwsIFtyZXN1bHQsIHNlZW5dKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHByb2Nlc3NPbmVWYWx1ZSh2YWx1ZSwgaW5kZXgsIHJlc3VsdCwgc2Vlbikge1xuICAgICAgICAgICAgaWYgKCFzZWVuW3ZhbHVlXSkge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKHZhbHVlKTtcbiAgICAgICAgICAgICAgICBzZWVuW3ZhbHVlXSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIHJlc3VsdCA9IFtdO1xuICAgICAgICAgICAgdmFyIHNlZW4gPSB7fTtcbiAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkuYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcblxuICAgICAgICAgICAgZWFjaChhcmdzLCBwcm9jZXNzT25lQXJndW1lbnQsIG51bGwsIFtyZXN1bHQsIHNlZW5dKTtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH07XG4gICAgfSgpKTtcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIHZhbHVlcyBvZiBhIGhhc2ggb2JqZWN0IGFzIGFuIGFycmF5XG4gICAgICogQGZ1bmN0aW9uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gaGFzaCBUaGUga2V5LXZhbHVlLWhhc2gtbWFwXG4gICAgICogQHJldHVybiB7QXJyYXl9IEFuIGFycmF5IGNvbnRhaW5pbmcgdGhlIHZhbHVlc1xuICAgICAqL1xuICAgIFV0aWxzLnZhbHVlcyA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZ1bmN0aW9uIGFkZFZhbHVlVG9SZXN1bHRTZXQodmFsdWUsIGtleSwgcmVzdWx0U2V0KSB7XG4gICAgICAgICAgICByZXN1bHRTZXQucHVzaCh2YWx1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gdmFsdWVzKGhhc2gpIHtcbiAgICAgICAgICAgIGlmICghaGFzaCB8fCB0eXBlb2YgaGFzaCAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICAgICAgICAgIGVhY2goaGFzaCwgYWRkVmFsdWVUb1Jlc3VsdFNldCwgbnVsbCwgW3Jlc3VsdF0pO1xuXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9O1xuICAgIH0oKSk7XG5cbiAgICAvKipcbiAgICAgKiBSZWFkcyBhbmQgd3JpdGVzIHRoZSB2YWx1ZSBvZiBhIG1ldGEgYXR0cmlidXRlIGZyb20vdG9cbiAgICAgKiBhIGdpdmVuIG9iamVjdFxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9iaiBUaGUgb2JqZWN0IHdpdGggdGhlIG1ldGEgcHJvcGVydHlcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30ga2V5IFRoZSBpZGVudGlmaWVyIG9mIHRoZSBhdHRyaWJ1dGVcbiAgICAgKiBAcGFyYW0ge01peGVkfSBbdmFsdWVdIChPcHRpb25hbCkgVGhlIG5ldyB2YWx1ZTtcbiAgICAgKiAgICAgIElmIG9tbWl0dGVkIHRoZSB2YWx1ZSB3aWxsIG5vdCBiZSBjaGFuZ2VkXG4gICAgICogQHJldHVybiB7TWl4ZWR9IFRoZSBjdXJyZW50IHZhbHVlIG9mIHRoZSBtZXRhIGF0dHJpYnV0ZXNcbiAgICAgKi9cbiAgICBVdGlscy5tZXRhID0gZnVuY3Rpb24gKG9iaiwga2V5LCB2YWx1ZSkge1xuICAgICAgICBrZXkgPSBVdGlscy5tZXRhUHJlZml4ICsga2V5O1xuICAgICAgICBpZiAodmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgb2JqW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb2JqW2tleV07XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFRoaXMgbWV0aG9kIHdvcmtzIGluIHR3byBkaWZmZXJlbnQgbW9kZTo8dWw+XG4gICAgICpcbiAgICAgKiA8bGk+TW9kZSAoQSkgd2lsbCB3b3JrIHNpbWlsYXIgdG8gT2JqZWN0LmRlZmluZVByb3BlcnR5IChzZWVcbiAgICAgKiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9PYmplY3QvZGVmaW5lUHJvcGVydHkpXG4gICAgICogYnV0IHdpdGggYSBmZXcgZGVmYXVsdHMgc3dpdGNoZWQuIE5ldyBwcm9wZXJ0aWVzIGFyZSBieSBkZWZhdWx0IHdyaXRhYmxlLFxuICAgICAqIGVudW1lcmFibGUgYW5kIGNvbmZpZ3VyYWJsZSB3aGljaGggaXMgSU1PIG1vcmUgbmF0dXJhbC5cbiAgICAgKlxuICAgICAqIDxsaT5Nb2RlIChCKSBsZXQgeW91IG1hcmsgYSBnaXZlbiBvYmplY3QgYXMgYSBwcm9wZXJ0eSBkZWZpbml0aW9uIHdoaWNoXG4gICAgICogd2lsbCBiZSBldmFsdWF0ZWQgd2hlbiBicmV3aW5nIGEgcHJvdG90eXBlIG9yIGFkZGluZyB0aGUgcHJvcGVydHkgdG9cbiAgICAgKiBvbmUgd2l0aCB7QGxpbmsgVXRpbHMub3ZlcnJpZGV9PC9saT5cbiAgICAgKlxuICAgICAqIDwvdWw+XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqIFRoZSBvYmplY3Qgd2hpY2ggc2hvdWxkIGdldCB0aGUgcHJvcGVydHkgKG1vZGUgQSlcbiAgICAgKiAgICAgIG9yIHRoZSBwcm9wZXJ0eSBkZWZpbml0aW9uIChtb2RlIEIpXG4gICAgICogICAgICAoTk9USUNFIHRoYXQgZWl0aGVyIHdheSB0aGUgZ2l2ZW4gb2JqZWN0IHdpbGwgYmUgbW9kaWZpZWQpXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IFtwcm9wXSBUaGUgbmFtZSBvZiB0aGUgcHJvcGVydHkgKG1vZGUgQSk7IGVtcHR5IChtb2RlIEIpXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRzXSBUaGUgcHJvcGVydHkgZGVmaW5pdGlvbiAobW9kZSBBKTsgZW1wdHkgKG1vZGUgQilcbiAgICAgKlxuICAgICAqIEByZXR1cm4gb2JqIFRoZSBtb2RpZmllZCBvYmplY3RcbiAgICAgKi9cbiAgICBVdGlscy5kZWZpbmVQcm9wZXJ0eSA9IGZ1bmN0aW9uIChvYmosIHByb3AsIG9wdHMpIHtcbiAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgIC8vIE1vZGUgQjogbWFyayBpdCBhcyBhIHByb3BlcnRpZXMgc28gVXRpbHMub3ZlcnJpZGUgd2lsbFxuICAgICAgICAgICAgLy8ga25vdyB3aGF0IHRvIGRvXG4gICAgICAgICAgICBVdGlscy5tZXRhKG9iaiwgJ2lzUHJvcGVydHknLCB0cnVlKTtcbiAgICAgICAgICAgIHJldHVybiBvYmo7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBNb2RlIEE6IGRlZmluZSB0aGUgbmV3IHByb3BlcnR5IFwicHJvcFwiIGZvciBvYmplY3QgXCJvYmpcIlxuXG4gICAgICAgIC8vIHN3aXRjaCB0aGUgZGVmYXVsdHMgdG8gYmUgdHJ1dGh5IHVubGVzcyBzYWlkIG90aGVyd2lzZVxuICAgICAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICAgICAgb3B0cy53cml0YWJsZSA9IChvcHRzLndyaXRhYmxlICE9PSBmYWxzZSk7XG4gICAgICAgIG9wdHMuZW51bWVyYWJsZSA9IChvcHRzLmVudW1lcmFibGUgIT09IGZhbHNlKTtcbiAgICAgICAgb3B0cy5jb25maWd1cmFibGUgPSAob3B0cy5jb25maWd1cmFibGUgIT09IGZhbHNlKTtcblxuICAgICAgICBpZiAob3B0cy5nZXQpIHtcbiAgICAgICAgICAgIGRlbGV0ZSBvcHRzLndyaXRhYmxlOyAvLyB3cml0YWJsZS92YWx1ZSBpcyBub3QgYWxsb3dlZCB3aGVuIGRlZmluaW5nIGdldHRlci9zZXR0ZXJcbiAgICAgICAgICAgIGRlbGV0ZSBvcHRzLnZhbHVlO1xuXG4gICAgICAgICAgICBpZiAoVXRpbHMuaXNCb29sZWFuKG9wdHMuZ2V0KSkge1xuICAgICAgICAgICAgICAgIC8vIFwiZ2V0XCIgd2FzIHNpbXBseSBzZXQgdG8gdHJ1ZSAtPiBnZXQgdGhlIG5hbWUgZnJvbSB0aGUgcHJvcGVydHkgKFwiZm9vXCIgLT4gXCJnZXRGb29cIilcbiAgICAgICAgICAgICAgICBvcHRzLmdldCA9ICdnZXQnICsgdWNGaXJzdChwcm9wKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChVdGlscy5pc1N0cmluZyhvcHRzLmdldCkpIHtcbiAgICAgICAgICAgICAgICAvLyBcImdldFwiIHdhcyBzZXQgdG8gdGhlIGdldHRlcidzIG5hbWVcbiAgICAgICAgICAgICAgICAvLyAtPiBjcmVhdGUgYSBmdW5jdGlvbiB0aGF0IGNhbGxzIHRoZSBnZXR0ZXIgKHRoaXMgd2F5IHdlIGNhblxuICAgICAgICAgICAgICAgIC8vIGxhdGVyIG92ZXJyaWRlIHRoZSBtZXRob2QpXG4gICAgICAgICAgICAgICAgdmFyIGdldHRlck5hbWUgPSBvcHRzLmdldDtcbiAgICAgICAgICAgICAgICBvcHRzLmdldCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXNbZ2V0dGVyTmFtZV0oKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdHMuc2V0KSB7XG4gICAgICAgICAgICBkZWxldGUgb3B0cy53cml0YWJsZTsgLy8gd3JpdGFibGUvdmFsdWUgaXMgbm90IGFsbG93ZWQgd2hlbiBkZWZpbmluZyBnZXR0ZXIvc2V0dGVyXG4gICAgICAgICAgICBkZWxldGUgb3B0cy52YWx1ZTtcblxuICAgICAgICAgICAgaWYgKFV0aWxzLmlzQm9vbGVhbihvcHRzLnNldCkpIHtcbiAgICAgICAgICAgICAgICAvLyBcInNldFwiIHdhcyBzaW1wbHkgc2V0IHRvIHRydWUgLT4gZ2V0IHRoZSBuYW1lIGZyb20gdGhlIHByb3BlcnR5IChcImZvb1wiIC0+IFwic2V0Rm9vXCIpXG4gICAgICAgICAgICAgICAgb3B0cy5zZXQgPSAnc2V0JyArIHVjRmlyc3QocHJvcCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoVXRpbHMuaXNTdHJpbmcob3B0cy5zZXQpKSB7XG4gICAgICAgICAgICAgICAgdmFyIHNldHRlck5hbWUgPSBvcHRzLnNldDtcbiAgICAgICAgICAgICAgICBvcHRzLnNldCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpc1tzZXR0ZXJOYW1lXSh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCBwcm9wLCBvcHRzKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogY3JlYXRlcyBhIHVuaXF1ZSBpZGVudGlmaWVyXG4gICAgICogQGZ1bmN0aW9uXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd9XG4gICAgICogICAgICB0aGUgZ2VuZXJhdGVkIGlkZW50aWZpZXJcbiAgICAgKlxuICAgICAqL1xuICAgIFV0aWxzLmlkID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGNvdW50ZXIgPSAwO1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICdBSlMtJyArIChjb3VudGVyKyspO1xuICAgICAgICB9O1xuICAgIH0oKSk7XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgVVVJRFxuICAgICAqIChzb3VyY2UgaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvODgwOTQ3MilcbiAgICAgKiBAZnVuY3Rpb25cbiAgICAgKlxuICAgICAqIEByZXR1cm4ge1N0cmluZ30gdGhlIFVVSURcbiAgICAgKi9cbiAgICBVdGlscy51dWlkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgZCA9IFV0aWxzLm5vdygpO1xuICAgICAgICB2YXIgdXVpZCA9ICd4eHh4eHh4eC14eHh4LTR4eHgteXh4eC14eHh4eHh4eHh4eHgnLnJlcGxhY2UoL1t4eV0vZywgZnVuY3Rpb24gKGMpIHtcbiAgICAgICAgICAgIC8qIGpzaGludCBiaXR3aXNlOiBmYWxzZSAqL1xuICAgICAgICAgICAgdmFyIHIgPSAoZCArIE1hdGgucmFuZG9tKCkgKiAxNikgJSAxNiB8IDA7XG4gICAgICAgICAgICBkID0gTWF0aC5mbG9vcihkIC8gMTYpO1xuICAgICAgICAgICAgcmV0dXJuIChjID09PSAneCcgPyByIDogKHIgJiAweDMgfCAweDgpKS50b1N0cmluZygxNik7XG4gICAgICAgICAgICAvKiBqc2hpbnQgYml0d2lzZTogdHJ1ZSAqL1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHV1aWQ7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIGFuIHJldXNlYWJsZSBlbXB0eSBmdW5jdGlvbiBvYmplY3RcbiAgICAgKi9cbiAgICBVdGlscy5lbXB0eUZuID0gZnVuY3Rpb24gKCkge307XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBudW1iZXIgb2YgbWlsbGlzZWNvbmRzLCBhY2N1cmF0ZSB0byBhIHRob3VzYW5kdGggb2YgYVxuICAgICAqIG1pbGxpc2Vjb25kLCBmcm9tIHRoZSBzdGFydCBvZiBkb2N1bWVudCBuYXZpZ2F0aW9uIHRvIHRoZSB0aW1lIHRoZVxuICAgICAqIG5vdyBtZXRob2Qgd2FzIGNhbGxlZC5cbiAgICAgKiBTaGltIGZvciB3aW5kb3cucGVyZm9ybWFuY2Uubm93KCk7IHNlZSBodHRwOi8vd3d3LnczLm9yZy9UUi9hbmltYXRpb24tdGltaW5nL1xuICAgICAqIEBmdW5jdGlvblxuICAgICAqXG4gICAgICogQHJldHVybiB7TnVtYmVyfSBUaGUgdGltZSBpbiBtcyByZWxhdGl2ZSB0byB0aGUgc3RhcnQgb2YgdGhlXG4gICAgICogICAgICBkb2N1bWVudCBuYXZpZ2F0aW9uXG4gICAgICovXG4gICAgVXRpbHMubm93ID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKGlzQnJvd3NlciAmJiB3aW5kb3cucGVyZm9ybWFuY2UgJiYgd2luZG93LnBlcmZvcm1hbmNlLm5vdykge1xuICAgICAgICAgICAgLy8gdXNlIHdpbmRvdy5wZXJmb21hbmNlLm5vdyAod2hpY2ggaXMgdGhlIHJlZmVyZW5jZSkgaWYgcG9zc2libGVcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHdpbmRvdy5wZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGZhbGxiYWNrIHRvIERhdGUubm93KClcbiAgICAgICAgdmFyIGxvYWRUaW1lID0gRGF0ZS5ub3coKTtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBEYXRlLm5vdygpIC0gbG9hZFRpbWU7XG4gICAgICAgIH07XG4gICAgfSgpKTtcbn0pKCk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIGggPSByZXF1aXJlKCd2aXJ0dWFsLWRvbS9oJyk7XG4gICAgdmFyIGRpZmYgPSByZXF1aXJlKCd2aXJ0dWFsLWRvbS9kaWZmJyk7XG4gICAgdmFyIHBhdGNoID0gcmVxdWlyZSgndmlydHVhbC1kb20vcGF0Y2gnKTtcblxuICAgIHZhciBjb3F1b1ZlbmVudW0gPSByZXF1aXJlKCdjb3F1by12ZW5lbnVtJyk7XG4gICAgdmFyIGVhY2ggPSByZXF1aXJlKCdwcm8tc2luZ3VsaXMnKTtcblxuICAgIHZhciB1dGlscyA9IHJlcXVpcmUoJy4vVXRpbHMnKTtcblxuICAgIC8qKlxuICAgICAqIEBjbGFzc1xuICAgICAqIEBuYW1lIFJlbmRlckNvbnRleHRcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBSZW5kZXJDb250ZXh0KGlkLCBzdGF0ZSwgcHJvcHMsIGNoaWxkcmVuKSB7XG4gICAgICAgIHRoaXMuX2VudGl0eVBsYWNlaG9sZGVyID0gbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHByb3BlcnR5XG4gICAgICAgICAqIEBuYW1lIGVudGl0eUlkXG4gICAgICAgICAqIEB0eXBlIFN0cmluZ1xuICAgICAgICAgKiBAbWVtYmVyT2YgUmVuZGVyQ29udGV4dFxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5lbnRpdHlJZCA9IGlkO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcHJvcGVydHlcbiAgICAgICAgICogQG5hbWUgc3RhdGVcbiAgICAgICAgICogQHR5cGUgSW1tdXRhYmxlXG4gICAgICAgICAqIEBtZW1iZXJPZiBSZW5kZXJDb250ZXh0XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnN0YXRlID0gc3RhdGU7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBwcm9wZXJ0eVxuICAgICAgICAgKiBAbmFtZSBwcm9wc1xuICAgICAgICAgKiBAdHlwZSBPYmplY3RcbiAgICAgICAgICogQG1lbWJlck9mIFJlbmRlckNvbnRleHRcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucHJvcHMgPSBwcm9wcztcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHByb3BlcnR5XG4gICAgICAgICAqIEBuYW1lIGNoaWxkcmVuXG4gICAgICAgICAqIEB0eXBlIEFycmF5L09iamVjdFxuICAgICAgICAgKiBAbWVtYmVyT2YgUmVuZGVyQ29udGV4dFxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5jaGlsZHJlbiA9IGNoaWxkcmVuO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBoeXBlcnNjcmlwdCBmdW5jdGlvbiB0byBjcmVhdGUgdmlydHVhbCBkb20gbm9kZXNcbiAgICAgKiBAZnVuY3Rpb25cbiAgICAgKi9cbiAgICBSZW5kZXJDb250ZXh0LnByb3RvdHlwZS5oID0gaDtcblxuICAgIC8qKlxuICAgICAqIFJlbmRlcnMgYSBjaGlsZCBlbnRpdHkgYXQgdGhlIGN1cnJlbnQgbG9jYXRpb24gKGl0IGFjdHVhbGx5IGNyZWF0ZXMgYVxuICAgICAqIHBsYWNlaG9sZGVyIGZvciB0aGF0IHZlcnkgZW50aXR5KVxuICAgICAqXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGVudGl0eUlkIFRoZSBpZCBvZiB0aGUgY2hpbGQgZW50aXR5IHRvIGJlIHJlbmRlcmVkXG4gICAgICogQHJldHVybiBWRG9tIGEgdmlydHVhbCBkb20gbm9kZSByZXByZXNlbnRpbmcgdGhlIGNoaWxkIGVudGl0eVxuICAgICAqL1xuICAgIFJlbmRlckNvbnRleHQucHJvdG90eXBlLnBsYWNlaG9sZGVyID0gZnVuY3Rpb24gcGxhY2Vob2xkZXIoZW50aXR5SWQpIHtcbiAgICAgICAgdGhpcy5fZW50aXR5UGxhY2Vob2xkZXIgPSB0aGlzLl9lbnRpdHlQbGFjZWhvbGRlciB8fCBbXTtcbiAgICAgICAgdGhpcy5fZW50aXR5UGxhY2Vob2xkZXIucHVzaChlbnRpdHlJZCk7XG5cbiAgICAgICAgcmV0dXJuIGgoJ2RpdicsIHtpZDogZW50aXR5SWQsIGtleTogZW50aXR5SWR9KTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBSZW5kZXJzIGEgcGxhY2Vob2xkZXIgZm9yIGEgY2hpbGQgZW50aXR5IGRlZmluZWQgYnkgdGhlIGdpdmVuIGtleVxuICAgICAqXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGtleSBUaGUga2V5IG9mIHRoZSBjaGlsZCBlbnRpdHkgdG8gYmUgcmVuZGVyZWRcbiAgICAgKiBAcmV0dXJuIFZEb20gYSB2aXJ0dWFsIGRvbSBub2RlIHJlcHJlc2VudGluZyB0aGUgY2hpbGQgZW50aXR5XG4gICAgICovXG4gICAgUmVuZGVyQ29udGV4dC5wcm90b3R5cGUucmVuZGVyQ2hpbGQgPSBmdW5jdGlvbiByZW5kZXJDaGlsZChrZXkpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGxhY2Vob2xkZXIodGhpcy5jaGlsZHJlbltrZXldKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogUmVuZGVyZXMgYWxsIGF2YWlsYWJsZSBjaGlsZCBlbnRpdGVzXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIGFycmF5IEFuIGFycmF5IG9mIHZpcnR1YWwgZG9tIG5vZGVzXG4gICAgICovXG4gICAgUmVuZGVyQ29udGV4dC5wcm90b3R5cGUucmVuZGVyQWxsQ2hpbGRyZW4gPSBmdW5jdGlvbiByZW5kZXJBbGxDaGlsZHJlbigpIHtcbiAgICAgICAgcmV0dXJuIGVhY2godXRpbHMudmFsdWVzKHRoaXMuY2hpbGRyZW4pLCB0aGlzLnBsYWNlaG9sZGVyLCB0aGlzKSB8fCBbXTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQW4gYXBwbGljYXRpb24gbW9kdWxlIHRvIHJlbmRlciBhbGwgdmlldyBjb21wb25lbnRzXG4gICAgICogdG8gdGhlIHNjcmVlblxuICAgICAqXG4gICAgICogQGNsYXNzXG4gICAgICogQG5hbWUgYWxjaGVteS5lY3MuVkRvbVJlbmRlclN5c3RlbVxuICAgICAqL1xuICAgIHJldHVybiBjb3F1b1ZlbmVudW0oe1xuICAgICAgICAvKiogQGxlbmRzIGFsY2hlbXkuZWNzLlZEb21SZW5kZXJTeXN0ZW0ucHJvdG90eXBlICovXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBlbnRpdHkgc3RvcmFnZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcHJvcGVydHkgZW50aXRpZXNcbiAgICAgICAgICogQHR5cGUgYWxjaGVteS5lY3MuQXBvdGhlY2FyaXVzXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBlbnRpdGllczogdW5kZWZpbmVkLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBVcGRhdGVzIHRoZSBjb21wb25lbnQgc3lzdGVtICh1cGRhdGVzIGRvbSBkZXBlbmRpbmcgb24gdGhlIGN1cnJlbnRcbiAgICAgICAgICogc3RhdGUgb2YgdGhlIGVudGl0aWVzKVxuICAgICAgICAgKi9cbiAgICAgICAgdXBkYXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgcmVuZGVyQ29uZmlncyA9IHRoaXMuZW50aXRpZXMuZ2V0QWxsQ29tcG9uZW50c09mVHlwZSgndmRvbScpO1xuICAgICAgICAgICAgdmFyIHVwZGF0ZXMgPSBlYWNoKHJlbmRlckNvbmZpZ3MsIHRoaXMudXBkYXRlRW50aXR5LCB0aGlzKTtcblxuICAgICAgICAgICAgZWFjaCh1cGRhdGVzLCB0aGlzLmRyYXcsIHRoaXMpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB1cGRhdGVFbnRpdHk6IGZ1bmN0aW9uIChjZmcsIGVudGl0eUlkLCBwbGFjZWhvbGRlcikge1xuICAgICAgICAgICAgaWYgKCF0aGlzLnJlcXVpcmVzUmVuZGVyKGNmZywgZW50aXR5SWQpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgcmVuZGVyZXIgPSB0aGlzLmZpbmRSZW5kZXJlcihjZmcsIGVudGl0eUlkKTtcbiAgICAgICAgICAgIHZhciBzdGF0ZSA9IHRoaXMuZW50aXRpZXMuZ2V0Q29tcG9uZW50KGVudGl0eUlkLCAnc3RhdGUnKTtcbiAgICAgICAgICAgIHZhciBjaGlsZHJlbiA9IHRoaXMuZW50aXRpZXMuZ2V0Q29tcG9uZW50RGF0YShlbnRpdHlJZCwgJ2NoaWxkcmVuJyk7XG4gICAgICAgICAgICB2YXIgY29udGV4dCA9IG5ldyBSZW5kZXJDb250ZXh0KGVudGl0eUlkLCBzdGF0ZSwgY2ZnLnByb3BzLCBjaGlsZHJlbiwge30pO1xuXG4gICAgICAgICAgICBjZmcgPSB0aGlzLmVudGl0aWVzLnNldENvbXBvbmVudChlbnRpdHlJZCwgJ3Zkb20nLCB7XG4gICAgICAgICAgICAgICAgY3VycmVudFRyZWU6IHJlbmRlcmVyKGNvbnRleHQpLFxuICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyOiBjb250ZXh0Ll9lbnRpdHlQbGFjZWhvbGRlcixcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0aGlzLmxhc3RTdGF0ZXNbZW50aXR5SWRdID0gc3RhdGU7XG5cbiAgICAgICAgICAgIHJldHVybiBjZmc7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHJlcXVpcmVzUmVuZGVyOiBmdW5jdGlvbiAocmVuZGVyQ2ZnLCBlbnRpdHlJZCkge1xuICAgICAgICAgICAgaWYgKCFyZW5kZXJDZmcuY3VycmVudFRyZWUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGN1cnJlbnRTdGF0ZSA9IHRoaXMuZW50aXRpZXMuZ2V0Q29tcG9uZW50KGVudGl0eUlkLCAnc3RhdGUnKTtcbiAgICAgICAgICAgIHZhciBsYXN0U3RhdGUgPSB0aGlzLmxhc3RTdGF0ZXNbZW50aXR5SWRdO1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRTdGF0ZSAhPT0gbGFzdFN0YXRlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBjdXJyZW50RGVsRXYgPSB0aGlzLmVudGl0aWVzLmdldENvbXBvbmVudChlbnRpdHlJZCwgJ2RlbGVnYXRlZEV2ZW50cycpO1xuICAgICAgICAgICAgdmFyIGxhc3REZWxFdiA9IHRoaXMubGFzdERlbGVnYXRlc1tlbnRpdHlJZF07XG4gICAgICAgICAgICBpZiAoY3VycmVudERlbEV2ICE9PSBsYXN0RGVsRXYpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICBmaW5kUmVuZGVyZXI6IGZ1bmN0aW9uIChjZmcsIGVudGl0eUlkKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGNmZy5yZW5kZXJlciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBjZmcucmVuZGVyZXI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRocm93ICdDYW5ub3QgZGV0ZXJtaW5lIHJlbmRlcmVyIGZvciBlbnRpdHkgXCInICsgZW50aXR5SWQgKyAnXCIhJztcbiAgICAgICAgfSxcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgZHJhdzogZnVuY3Rpb24gKHJlbmRlckNmZywgZW50aXR5SWQpIHtcbiAgICAgICAgICAgIHZhciByb290ID0gcmVuZGVyQ2ZnLnJvb3QgfHwgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoZW50aXR5SWQpO1xuICAgICAgICAgICAgaWYgKCFyb290KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgcGF0Y2hlcyA9IGRpZmYocmVuZGVyQ2ZnLmxhc3RUcmVlIHx8IGgoKSwgcmVuZGVyQ2ZnLmN1cnJlbnRUcmVlKTtcblxuICAgICAgICAgICAgcm9vdCA9IHBhdGNoKHJvb3QsIHBhdGNoZXMpO1xuXG4gICAgICAgICAgICByZW5kZXJDZmcgPSB0aGlzLmVudGl0aWVzLnNldENvbXBvbmVudChlbnRpdHlJZCwgJ3Zkb20nLCB7XG4gICAgICAgICAgICAgICAgcm9vdDogcm9vdCxcbiAgICAgICAgICAgICAgICBsYXN0VHJlZTogcmVuZGVyQ2ZnLmN1cnJlbnRUcmVlLFxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGVhY2gocmVuZGVyQ2ZnLnBsYWNlaG9sZGVyLCB0aGlzLmRyYXdEZXBlbmRlbnRFbnRpdGllcywgdGhpcyk7XG5cbiAgICAgICAgICAgIHZhciBkZWxlZ2F0ZWRFdmVudHMgPSB0aGlzLmVudGl0aWVzLmdldENvbXBvbmVudChlbnRpdHlJZCwgJ2RlbGVnYXRlZEV2ZW50cycpO1xuICAgICAgICAgICAgaWYgKGRlbGVnYXRlZEV2ZW50cykge1xuICAgICAgICAgICAgICAgIGVhY2goZGVsZWdhdGVkRXZlbnRzLnZhbCgpLCB0aGlzLmJpbmREZWxlZ2F0ZXMsIHRoaXMsIFtyb290XSk7XG4gICAgICAgICAgICAgICAgdGhpcy5sYXN0RGVsZWdhdGVzW2VudGl0eUlkXSA9IGRlbGVnYXRlZEV2ZW50cztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgZHJhd0RlcGVuZGVudEVudGl0aWVzOiBmdW5jdGlvbiAoZW50aXR5SWQpIHtcbiAgICAgICAgICAgIHZhciByZW5kZXJDZmcgPSB0aGlzLmVudGl0aWVzLmdldENvbXBvbmVudERhdGEoZW50aXR5SWQsICd2ZG9tJyk7XG4gICAgICAgICAgICBpZiAoIXJlbmRlckNmZykge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGNoaWxkUm9vdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGVudGl0eUlkKTtcbiAgICAgICAgICAgIGlmIChjaGlsZFJvb3QgJiYgY2hpbGRSb290ICE9PSByZW5kZXJDZmcucm9vdCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZW50aXRpZXMuc2V0Q29tcG9uZW50KGVudGl0eUlkLCAndmRvbScsIHtcbiAgICAgICAgICAgICAgICAgICAgcm9vdDogY2hpbGRSb290LFxuICAgICAgICAgICAgICAgICAgICBsYXN0VHJlZTogaCgpLCAvLyBjbGVhciBjYWNoZSB0byBmb3JjZSByZS1kcmF3XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgdGhpcy5kcmF3KHJlbmRlckNmZywgZW50aXR5SWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICBiaW5kRGVsZWdhdGVzOiBmdW5jdGlvbiAoY2ZnLCBrZXksIG5vZGUpIHtcbiAgICAgICAgICAgIGlmIChjZmcuc2VsZWN0b3IpIHtcbiAgICAgICAgICAgICAgICBub2RlID0gbm9kZS5xdWVyeVNlbGVjdG9yKGNmZy5zZWxlY3Rvcik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNmZy5kZWxlZ2F0ZS5iaW5kKG5vZGUpO1xuICAgICAgICB9LFxuXG4gICAgfSkud2hlbkJyZXdlZChmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMubGFzdFN0YXRlcyA9IHt9O1xuICAgICAgICB0aGlzLmxhc3REZWxlZ2F0ZXMgPSB7fTtcbiAgICB9KTtcbn0oKSk7XG4iLCJ2YXIgZGlmZiA9IHJlcXVpcmUoXCIuL3Z0cmVlL2RpZmYuanNcIilcblxubW9kdWxlLmV4cG9ydHMgPSBkaWZmXG4iLCJ2YXIgaCA9IHJlcXVpcmUoXCIuL3ZpcnR1YWwtaHlwZXJzY3JpcHQvaW5kZXguanNcIilcblxubW9kdWxlLmV4cG9ydHMgPSBoXG4iLCIvKiFcbiAqIENyb3NzLUJyb3dzZXIgU3BsaXQgMS4xLjFcbiAqIENvcHlyaWdodCAyMDA3LTIwMTIgU3RldmVuIExldml0aGFuIDxzdGV2ZW5sZXZpdGhhbi5jb20+XG4gKiBBdmFpbGFibGUgdW5kZXIgdGhlIE1JVCBMaWNlbnNlXG4gKiBFQ01BU2NyaXB0IGNvbXBsaWFudCwgdW5pZm9ybSBjcm9zcy1icm93c2VyIHNwbGl0IG1ldGhvZFxuICovXG5cbi8qKlxuICogU3BsaXRzIGEgc3RyaW5nIGludG8gYW4gYXJyYXkgb2Ygc3RyaW5ncyB1c2luZyBhIHJlZ2V4IG9yIHN0cmluZyBzZXBhcmF0b3IuIE1hdGNoZXMgb2YgdGhlXG4gKiBzZXBhcmF0b3IgYXJlIG5vdCBpbmNsdWRlZCBpbiB0aGUgcmVzdWx0IGFycmF5LiBIb3dldmVyLCBpZiBgc2VwYXJhdG9yYCBpcyBhIHJlZ2V4IHRoYXQgY29udGFpbnNcbiAqIGNhcHR1cmluZyBncm91cHMsIGJhY2tyZWZlcmVuY2VzIGFyZSBzcGxpY2VkIGludG8gdGhlIHJlc3VsdCBlYWNoIHRpbWUgYHNlcGFyYXRvcmAgaXMgbWF0Y2hlZC5cbiAqIEZpeGVzIGJyb3dzZXIgYnVncyBjb21wYXJlZCB0byB0aGUgbmF0aXZlIGBTdHJpbmcucHJvdG90eXBlLnNwbGl0YCBhbmQgY2FuIGJlIHVzZWQgcmVsaWFibHlcbiAqIGNyb3NzLWJyb3dzZXIuXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIFN0cmluZyB0byBzcGxpdC5cbiAqIEBwYXJhbSB7UmVnRXhwfFN0cmluZ30gc2VwYXJhdG9yIFJlZ2V4IG9yIHN0cmluZyB0byB1c2UgZm9yIHNlcGFyYXRpbmcgdGhlIHN0cmluZy5cbiAqIEBwYXJhbSB7TnVtYmVyfSBbbGltaXRdIE1heGltdW0gbnVtYmVyIG9mIGl0ZW1zIHRvIGluY2x1ZGUgaW4gdGhlIHJlc3VsdCBhcnJheS5cbiAqIEByZXR1cm5zIHtBcnJheX0gQXJyYXkgb2Ygc3Vic3RyaW5ncy5cbiAqIEBleGFtcGxlXG4gKlxuICogLy8gQmFzaWMgdXNlXG4gKiBzcGxpdCgnYSBiIGMgZCcsICcgJyk7XG4gKiAvLyAtPiBbJ2EnLCAnYicsICdjJywgJ2QnXVxuICpcbiAqIC8vIFdpdGggbGltaXRcbiAqIHNwbGl0KCdhIGIgYyBkJywgJyAnLCAyKTtcbiAqIC8vIC0+IFsnYScsICdiJ11cbiAqXG4gKiAvLyBCYWNrcmVmZXJlbmNlcyBpbiByZXN1bHQgYXJyYXlcbiAqIHNwbGl0KCcuLndvcmQxIHdvcmQyLi4nLCAvKFthLXpdKykoXFxkKykvaSk7XG4gKiAvLyAtPiBbJy4uJywgJ3dvcmQnLCAnMScsICcgJywgJ3dvcmQnLCAnMicsICcuLiddXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uIHNwbGl0KHVuZGVmKSB7XG5cbiAgdmFyIG5hdGl2ZVNwbGl0ID0gU3RyaW5nLnByb3RvdHlwZS5zcGxpdCxcbiAgICBjb21wbGlhbnRFeGVjTnBjZyA9IC8oKT8/Ly5leGVjKFwiXCIpWzFdID09PSB1bmRlZixcbiAgICAvLyBOUENHOiBub25wYXJ0aWNpcGF0aW5nIGNhcHR1cmluZyBncm91cFxuICAgIHNlbGY7XG5cbiAgc2VsZiA9IGZ1bmN0aW9uKHN0ciwgc2VwYXJhdG9yLCBsaW1pdCkge1xuICAgIC8vIElmIGBzZXBhcmF0b3JgIGlzIG5vdCBhIHJlZ2V4LCB1c2UgYG5hdGl2ZVNwbGl0YFxuICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoc2VwYXJhdG9yKSAhPT0gXCJbb2JqZWN0IFJlZ0V4cF1cIikge1xuICAgICAgcmV0dXJuIG5hdGl2ZVNwbGl0LmNhbGwoc3RyLCBzZXBhcmF0b3IsIGxpbWl0KTtcbiAgICB9XG4gICAgdmFyIG91dHB1dCA9IFtdLFxuICAgICAgZmxhZ3MgPSAoc2VwYXJhdG9yLmlnbm9yZUNhc2UgPyBcImlcIiA6IFwiXCIpICsgKHNlcGFyYXRvci5tdWx0aWxpbmUgPyBcIm1cIiA6IFwiXCIpICsgKHNlcGFyYXRvci5leHRlbmRlZCA/IFwieFwiIDogXCJcIikgKyAvLyBQcm9wb3NlZCBmb3IgRVM2XG4gICAgICAoc2VwYXJhdG9yLnN0aWNreSA/IFwieVwiIDogXCJcIiksXG4gICAgICAvLyBGaXJlZm94IDMrXG4gICAgICBsYXN0TGFzdEluZGV4ID0gMCxcbiAgICAgIC8vIE1ha2UgYGdsb2JhbGAgYW5kIGF2b2lkIGBsYXN0SW5kZXhgIGlzc3VlcyBieSB3b3JraW5nIHdpdGggYSBjb3B5XG4gICAgICBzZXBhcmF0b3IgPSBuZXcgUmVnRXhwKHNlcGFyYXRvci5zb3VyY2UsIGZsYWdzICsgXCJnXCIpLFxuICAgICAgc2VwYXJhdG9yMiwgbWF0Y2gsIGxhc3RJbmRleCwgbGFzdExlbmd0aDtcbiAgICBzdHIgKz0gXCJcIjsgLy8gVHlwZS1jb252ZXJ0XG4gICAgaWYgKCFjb21wbGlhbnRFeGVjTnBjZykge1xuICAgICAgLy8gRG9lc24ndCBuZWVkIGZsYWdzIGd5LCBidXQgdGhleSBkb24ndCBodXJ0XG4gICAgICBzZXBhcmF0b3IyID0gbmV3IFJlZ0V4cChcIl5cIiArIHNlcGFyYXRvci5zb3VyY2UgKyBcIiQoPyFcXFxccylcIiwgZmxhZ3MpO1xuICAgIH1cbiAgICAvKiBWYWx1ZXMgZm9yIGBsaW1pdGAsIHBlciB0aGUgc3BlYzpcbiAgICAgKiBJZiB1bmRlZmluZWQ6IDQyOTQ5NjcyOTUgLy8gTWF0aC5wb3coMiwgMzIpIC0gMVxuICAgICAqIElmIDAsIEluZmluaXR5LCBvciBOYU46IDBcbiAgICAgKiBJZiBwb3NpdGl2ZSBudW1iZXI6IGxpbWl0ID0gTWF0aC5mbG9vcihsaW1pdCk7IGlmIChsaW1pdCA+IDQyOTQ5NjcyOTUpIGxpbWl0IC09IDQyOTQ5NjcyOTY7XG4gICAgICogSWYgbmVnYXRpdmUgbnVtYmVyOiA0Mjk0OTY3Mjk2IC0gTWF0aC5mbG9vcihNYXRoLmFicyhsaW1pdCkpXG4gICAgICogSWYgb3RoZXI6IFR5cGUtY29udmVydCwgdGhlbiB1c2UgdGhlIGFib3ZlIHJ1bGVzXG4gICAgICovXG4gICAgbGltaXQgPSBsaW1pdCA9PT0gdW5kZWYgPyAtMSA+Pj4gMCA6IC8vIE1hdGgucG93KDIsIDMyKSAtIDFcbiAgICBsaW1pdCA+Pj4gMDsgLy8gVG9VaW50MzIobGltaXQpXG4gICAgd2hpbGUgKG1hdGNoID0gc2VwYXJhdG9yLmV4ZWMoc3RyKSkge1xuICAgICAgLy8gYHNlcGFyYXRvci5sYXN0SW5kZXhgIGlzIG5vdCByZWxpYWJsZSBjcm9zcy1icm93c2VyXG4gICAgICBsYXN0SW5kZXggPSBtYXRjaC5pbmRleCArIG1hdGNoWzBdLmxlbmd0aDtcbiAgICAgIGlmIChsYXN0SW5kZXggPiBsYXN0TGFzdEluZGV4KSB7XG4gICAgICAgIG91dHB1dC5wdXNoKHN0ci5zbGljZShsYXN0TGFzdEluZGV4LCBtYXRjaC5pbmRleCkpO1xuICAgICAgICAvLyBGaXggYnJvd3NlcnMgd2hvc2UgYGV4ZWNgIG1ldGhvZHMgZG9uJ3QgY29uc2lzdGVudGx5IHJldHVybiBgdW5kZWZpbmVkYCBmb3JcbiAgICAgICAgLy8gbm9ucGFydGljaXBhdGluZyBjYXB0dXJpbmcgZ3JvdXBzXG4gICAgICAgIGlmICghY29tcGxpYW50RXhlY05wY2cgJiYgbWF0Y2gubGVuZ3RoID4gMSkge1xuICAgICAgICAgIG1hdGNoWzBdLnJlcGxhY2Uoc2VwYXJhdG9yMiwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGggLSAyOyBpKyspIHtcbiAgICAgICAgICAgICAgaWYgKGFyZ3VtZW50c1tpXSA9PT0gdW5kZWYpIHtcbiAgICAgICAgICAgICAgICBtYXRjaFtpXSA9IHVuZGVmO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1hdGNoLmxlbmd0aCA+IDEgJiYgbWF0Y2guaW5kZXggPCBzdHIubGVuZ3RoKSB7XG4gICAgICAgICAgQXJyYXkucHJvdG90eXBlLnB1c2guYXBwbHkob3V0cHV0LCBtYXRjaC5zbGljZSgxKSk7XG4gICAgICAgIH1cbiAgICAgICAgbGFzdExlbmd0aCA9IG1hdGNoWzBdLmxlbmd0aDtcbiAgICAgICAgbGFzdExhc3RJbmRleCA9IGxhc3RJbmRleDtcbiAgICAgICAgaWYgKG91dHB1dC5sZW5ndGggPj0gbGltaXQpIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHNlcGFyYXRvci5sYXN0SW5kZXggPT09IG1hdGNoLmluZGV4KSB7XG4gICAgICAgIHNlcGFyYXRvci5sYXN0SW5kZXgrKzsgLy8gQXZvaWQgYW4gaW5maW5pdGUgbG9vcFxuICAgICAgfVxuICAgIH1cbiAgICBpZiAobGFzdExhc3RJbmRleCA9PT0gc3RyLmxlbmd0aCkge1xuICAgICAgaWYgKGxhc3RMZW5ndGggfHwgIXNlcGFyYXRvci50ZXN0KFwiXCIpKSB7XG4gICAgICAgIG91dHB1dC5wdXNoKFwiXCIpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBvdXRwdXQucHVzaChzdHIuc2xpY2UobGFzdExhc3RJbmRleCkpO1xuICAgIH1cbiAgICByZXR1cm4gb3V0cHV0Lmxlbmd0aCA+IGxpbWl0ID8gb3V0cHV0LnNsaWNlKDAsIGxpbWl0KSA6IG91dHB1dDtcbiAgfTtcblxuICByZXR1cm4gc2VsZjtcbn0pKCk7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBPbmVWZXJzaW9uQ29uc3RyYWludCA9IHJlcXVpcmUoJ2luZGl2aWR1YWwvb25lLXZlcnNpb24nKTtcblxudmFyIE1ZX1ZFUlNJT04gPSAnNyc7XG5PbmVWZXJzaW9uQ29uc3RyYWludCgnZXYtc3RvcmUnLCBNWV9WRVJTSU9OKTtcblxudmFyIGhhc2hLZXkgPSAnX19FVl9TVE9SRV9LRVlAJyArIE1ZX1ZFUlNJT047XG5cbm1vZHVsZS5leHBvcnRzID0gRXZTdG9yZTtcblxuZnVuY3Rpb24gRXZTdG9yZShlbGVtKSB7XG4gICAgdmFyIGhhc2ggPSBlbGVtW2hhc2hLZXldO1xuXG4gICAgaWYgKCFoYXNoKSB7XG4gICAgICAgIGhhc2ggPSBlbGVtW2hhc2hLZXldID0ge307XG4gICAgfVxuXG4gICAgcmV0dXJuIGhhc2g7XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qZ2xvYmFsIHdpbmRvdywgZ2xvYmFsKi9cblxudmFyIHJvb3QgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyA/XG4gICAgd2luZG93IDogdHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcgP1xuICAgIGdsb2JhbCA6IHt9O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEluZGl2aWR1YWw7XG5cbmZ1bmN0aW9uIEluZGl2aWR1YWwoa2V5LCB2YWx1ZSkge1xuICAgIGlmIChrZXkgaW4gcm9vdCkge1xuICAgICAgICByZXR1cm4gcm9vdFtrZXldO1xuICAgIH1cblxuICAgIHJvb3Rba2V5XSA9IHZhbHVlO1xuXG4gICAgcmV0dXJuIHZhbHVlO1xufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgSW5kaXZpZHVhbCA9IHJlcXVpcmUoJy4vaW5kZXguanMnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBPbmVWZXJzaW9uO1xuXG5mdW5jdGlvbiBPbmVWZXJzaW9uKG1vZHVsZU5hbWUsIHZlcnNpb24sIGRlZmF1bHRWYWx1ZSkge1xuICAgIHZhciBrZXkgPSAnX19JTkRJVklEVUFMX09ORV9WRVJTSU9OXycgKyBtb2R1bGVOYW1lO1xuICAgIHZhciBlbmZvcmNlS2V5ID0ga2V5ICsgJ19FTkZPUkNFX1NJTkdMRVRPTic7XG5cbiAgICB2YXIgdmVyc2lvblZhbHVlID0gSW5kaXZpZHVhbChlbmZvcmNlS2V5LCB2ZXJzaW9uKTtcblxuICAgIGlmICh2ZXJzaW9uVmFsdWUgIT09IHZlcnNpb24pIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW4gb25seSBoYXZlIG9uZSBjb3B5IG9mICcgK1xuICAgICAgICAgICAgbW9kdWxlTmFtZSArICcuXFxuJyArXG4gICAgICAgICAgICAnWW91IGFscmVhZHkgaGF2ZSB2ZXJzaW9uICcgKyB2ZXJzaW9uVmFsdWUgK1xuICAgICAgICAgICAgJyBpbnN0YWxsZWQuXFxuJyArXG4gICAgICAgICAgICAnVGhpcyBtZWFucyB5b3UgY2Fubm90IGluc3RhbGwgdmVyc2lvbiAnICsgdmVyc2lvbik7XG4gICAgfVxuXG4gICAgcmV0dXJuIEluZGl2aWR1YWwoa2V5LCBkZWZhdWx0VmFsdWUpO1xufVxuIiwidmFyIHRvcExldmVsID0gdHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcgPyBnbG9iYWwgOlxuICAgIHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID8gd2luZG93IDoge31cbnZhciBtaW5Eb2MgPSByZXF1aXJlKCdtaW4tZG9jdW1lbnQnKTtcblxuaWYgKHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGRvY3VtZW50O1xufSBlbHNlIHtcbiAgICB2YXIgZG9jY3kgPSB0b3BMZXZlbFsnX19HTE9CQUxfRE9DVU1FTlRfQ0FDSEVANCddO1xuXG4gICAgaWYgKCFkb2NjeSkge1xuICAgICAgICBkb2NjeSA9IHRvcExldmVsWydfX0dMT0JBTF9ET0NVTUVOVF9DQUNIRUA0J10gPSBtaW5Eb2M7XG4gICAgfVxuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBkb2NjeTtcbn1cbiIsIlwidXNlIHN0cmljdFwiO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGlzT2JqZWN0KHgpIHtcblx0cmV0dXJuIHR5cGVvZiB4ID09PSBcIm9iamVjdFwiICYmIHggIT09IG51bGw7XG59O1xuIiwidmFyIG5hdGl2ZUlzQXJyYXkgPSBBcnJheS5pc0FycmF5XG52YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nXG5cbm1vZHVsZS5leHBvcnRzID0gbmF0aXZlSXNBcnJheSB8fCBpc0FycmF5XG5cbmZ1bmN0aW9uIGlzQXJyYXkob2JqKSB7XG4gICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwob2JqKSA9PT0gXCJbb2JqZWN0IEFycmF5XVwiXG59XG4iLCJ2YXIgcGF0Y2ggPSByZXF1aXJlKFwiLi92ZG9tL3BhdGNoLmpzXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gcGF0Y2hcbiIsInZhciBpc09iamVjdCA9IHJlcXVpcmUoXCJpcy1vYmplY3RcIilcbnZhciBpc0hvb2sgPSByZXF1aXJlKFwiLi4vdm5vZGUvaXMtdmhvb2suanNcIilcblxubW9kdWxlLmV4cG9ydHMgPSBhcHBseVByb3BlcnRpZXNcblxuZnVuY3Rpb24gYXBwbHlQcm9wZXJ0aWVzKG5vZGUsIHByb3BzLCBwcmV2aW91cykge1xuICAgIGZvciAodmFyIHByb3BOYW1lIGluIHByb3BzKSB7XG4gICAgICAgIHZhciBwcm9wVmFsdWUgPSBwcm9wc1twcm9wTmFtZV1cblxuICAgICAgICBpZiAocHJvcFZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJlbW92ZVByb3BlcnR5KG5vZGUsIHByb3BOYW1lLCBwcm9wVmFsdWUsIHByZXZpb3VzKTtcbiAgICAgICAgfSBlbHNlIGlmIChpc0hvb2socHJvcFZhbHVlKSkge1xuICAgICAgICAgICAgcmVtb3ZlUHJvcGVydHkobm9kZSwgcHJvcE5hbWUsIHByb3BWYWx1ZSwgcHJldmlvdXMpXG4gICAgICAgICAgICBpZiAocHJvcFZhbHVlLmhvb2spIHtcbiAgICAgICAgICAgICAgICBwcm9wVmFsdWUuaG9vayhub2RlLFxuICAgICAgICAgICAgICAgICAgICBwcm9wTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgcHJldmlvdXMgPyBwcmV2aW91c1twcm9wTmFtZV0gOiB1bmRlZmluZWQpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoaXNPYmplY3QocHJvcFZhbHVlKSkge1xuICAgICAgICAgICAgICAgIHBhdGNoT2JqZWN0KG5vZGUsIHByb3BzLCBwcmV2aW91cywgcHJvcE5hbWUsIHByb3BWYWx1ZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5vZGVbcHJvcE5hbWVdID0gcHJvcFZhbHVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlbW92ZVByb3BlcnR5KG5vZGUsIHByb3BOYW1lLCBwcm9wVmFsdWUsIHByZXZpb3VzKSB7XG4gICAgaWYgKHByZXZpb3VzKSB7XG4gICAgICAgIHZhciBwcmV2aW91c1ZhbHVlID0gcHJldmlvdXNbcHJvcE5hbWVdXG5cbiAgICAgICAgaWYgKCFpc0hvb2socHJldmlvdXNWYWx1ZSkpIHtcbiAgICAgICAgICAgIGlmIChwcm9wTmFtZSA9PT0gXCJhdHRyaWJ1dGVzXCIpIHtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBhdHRyTmFtZSBpbiBwcmV2aW91c1ZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGUucmVtb3ZlQXR0cmlidXRlKGF0dHJOYW1lKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAocHJvcE5hbWUgPT09IFwic3R5bGVcIikge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgaW4gcHJldmlvdXNWYWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICBub2RlLnN0eWxlW2ldID0gXCJcIlxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHByZXZpb3VzVmFsdWUgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICAgICAgICBub2RlW3Byb3BOYW1lXSA9IFwiXCJcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbm9kZVtwcm9wTmFtZV0gPSBudWxsXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAocHJldmlvdXNWYWx1ZS51bmhvb2spIHtcbiAgICAgICAgICAgIHByZXZpb3VzVmFsdWUudW5ob29rKG5vZGUsIHByb3BOYW1lLCBwcm9wVmFsdWUpXG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIHBhdGNoT2JqZWN0KG5vZGUsIHByb3BzLCBwcmV2aW91cywgcHJvcE5hbWUsIHByb3BWYWx1ZSkge1xuICAgIHZhciBwcmV2aW91c1ZhbHVlID0gcHJldmlvdXMgPyBwcmV2aW91c1twcm9wTmFtZV0gOiB1bmRlZmluZWRcblxuICAgIC8vIFNldCBhdHRyaWJ1dGVzXG4gICAgaWYgKHByb3BOYW1lID09PSBcImF0dHJpYnV0ZXNcIikge1xuICAgICAgICBmb3IgKHZhciBhdHRyTmFtZSBpbiBwcm9wVmFsdWUpIHtcbiAgICAgICAgICAgIHZhciBhdHRyVmFsdWUgPSBwcm9wVmFsdWVbYXR0ck5hbWVdXG5cbiAgICAgICAgICAgIGlmIChhdHRyVmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIG5vZGUucmVtb3ZlQXR0cmlidXRlKGF0dHJOYW1lKVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBub2RlLnNldEF0dHJpYnV0ZShhdHRyTmFtZSwgYXR0clZhbHVlKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgaWYocHJldmlvdXNWYWx1ZSAmJiBpc09iamVjdChwcmV2aW91c1ZhbHVlKSAmJlxuICAgICAgICBnZXRQcm90b3R5cGUocHJldmlvdXNWYWx1ZSkgIT09IGdldFByb3RvdHlwZShwcm9wVmFsdWUpKSB7XG4gICAgICAgIG5vZGVbcHJvcE5hbWVdID0gcHJvcFZhbHVlXG4gICAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGlmICghaXNPYmplY3Qobm9kZVtwcm9wTmFtZV0pKSB7XG4gICAgICAgIG5vZGVbcHJvcE5hbWVdID0ge31cbiAgICB9XG5cbiAgICB2YXIgcmVwbGFjZXIgPSBwcm9wTmFtZSA9PT0gXCJzdHlsZVwiID8gXCJcIiA6IHVuZGVmaW5lZFxuXG4gICAgZm9yICh2YXIgayBpbiBwcm9wVmFsdWUpIHtcbiAgICAgICAgdmFyIHZhbHVlID0gcHJvcFZhbHVlW2tdXG4gICAgICAgIG5vZGVbcHJvcE5hbWVdW2tdID0gKHZhbHVlID09PSB1bmRlZmluZWQpID8gcmVwbGFjZXIgOiB2YWx1ZVxuICAgIH1cbn1cblxuZnVuY3Rpb24gZ2V0UHJvdG90eXBlKHZhbHVlKSB7XG4gICAgaWYgKE9iamVjdC5nZXRQcm90b3R5cGVPZikge1xuICAgICAgICByZXR1cm4gT2JqZWN0LmdldFByb3RvdHlwZU9mKHZhbHVlKVxuICAgIH0gZWxzZSBpZiAodmFsdWUuX19wcm90b19fKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZS5fX3Byb3RvX19cbiAgICB9IGVsc2UgaWYgKHZhbHVlLmNvbnN0cnVjdG9yKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZS5jb25zdHJ1Y3Rvci5wcm90b3R5cGVcbiAgICB9XG59XG4iLCJ2YXIgZG9jdW1lbnQgPSByZXF1aXJlKFwiZ2xvYmFsL2RvY3VtZW50XCIpXG5cbnZhciBhcHBseVByb3BlcnRpZXMgPSByZXF1aXJlKFwiLi9hcHBseS1wcm9wZXJ0aWVzXCIpXG5cbnZhciBpc1ZOb2RlID0gcmVxdWlyZShcIi4uL3Zub2RlL2lzLXZub2RlLmpzXCIpXG52YXIgaXNWVGV4dCA9IHJlcXVpcmUoXCIuLi92bm9kZS9pcy12dGV4dC5qc1wiKVxudmFyIGlzV2lkZ2V0ID0gcmVxdWlyZShcIi4uL3Zub2RlL2lzLXdpZGdldC5qc1wiKVxudmFyIGhhbmRsZVRodW5rID0gcmVxdWlyZShcIi4uL3Zub2RlL2hhbmRsZS10aHVuay5qc1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZUVsZW1lbnRcblxuZnVuY3Rpb24gY3JlYXRlRWxlbWVudCh2bm9kZSwgb3B0cykge1xuICAgIHZhciBkb2MgPSBvcHRzID8gb3B0cy5kb2N1bWVudCB8fCBkb2N1bWVudCA6IGRvY3VtZW50XG4gICAgdmFyIHdhcm4gPSBvcHRzID8gb3B0cy53YXJuIDogbnVsbFxuXG4gICAgdm5vZGUgPSBoYW5kbGVUaHVuayh2bm9kZSkuYVxuXG4gICAgaWYgKGlzV2lkZ2V0KHZub2RlKSkge1xuICAgICAgICByZXR1cm4gdm5vZGUuaW5pdCgpXG4gICAgfSBlbHNlIGlmIChpc1ZUZXh0KHZub2RlKSkge1xuICAgICAgICByZXR1cm4gZG9jLmNyZWF0ZVRleHROb2RlKHZub2RlLnRleHQpXG4gICAgfSBlbHNlIGlmICghaXNWTm9kZSh2bm9kZSkpIHtcbiAgICAgICAgaWYgKHdhcm4pIHtcbiAgICAgICAgICAgIHdhcm4oXCJJdGVtIGlzIG5vdCBhIHZhbGlkIHZpcnR1YWwgZG9tIG5vZGVcIiwgdm5vZGUpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGxcbiAgICB9XG5cbiAgICB2YXIgbm9kZSA9ICh2bm9kZS5uYW1lc3BhY2UgPT09IG51bGwpID9cbiAgICAgICAgZG9jLmNyZWF0ZUVsZW1lbnQodm5vZGUudGFnTmFtZSkgOlxuICAgICAgICBkb2MuY3JlYXRlRWxlbWVudE5TKHZub2RlLm5hbWVzcGFjZSwgdm5vZGUudGFnTmFtZSlcblxuICAgIHZhciBwcm9wcyA9IHZub2RlLnByb3BlcnRpZXNcbiAgICBhcHBseVByb3BlcnRpZXMobm9kZSwgcHJvcHMpXG5cbiAgICB2YXIgY2hpbGRyZW4gPSB2bm9kZS5jaGlsZHJlblxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgY2hpbGROb2RlID0gY3JlYXRlRWxlbWVudChjaGlsZHJlbltpXSwgb3B0cylcbiAgICAgICAgaWYgKGNoaWxkTm9kZSkge1xuICAgICAgICAgICAgbm9kZS5hcHBlbmRDaGlsZChjaGlsZE5vZGUpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbm9kZVxufVxuIiwiLy8gTWFwcyBhIHZpcnR1YWwgRE9NIHRyZWUgb250byBhIHJlYWwgRE9NIHRyZWUgaW4gYW4gZWZmaWNpZW50IG1hbm5lci5cbi8vIFdlIGRvbid0IHdhbnQgdG8gcmVhZCBhbGwgb2YgdGhlIERPTSBub2RlcyBpbiB0aGUgdHJlZSBzbyB3ZSB1c2Vcbi8vIHRoZSBpbi1vcmRlciB0cmVlIGluZGV4aW5nIHRvIGVsaW1pbmF0ZSByZWN1cnNpb24gZG93biBjZXJ0YWluIGJyYW5jaGVzLlxuLy8gV2Ugb25seSByZWN1cnNlIGludG8gYSBET00gbm9kZSBpZiB3ZSBrbm93IHRoYXQgaXQgY29udGFpbnMgYSBjaGlsZCBvZlxuLy8gaW50ZXJlc3QuXG5cbnZhciBub0NoaWxkID0ge31cblxubW9kdWxlLmV4cG9ydHMgPSBkb21JbmRleFxuXG5mdW5jdGlvbiBkb21JbmRleChyb290Tm9kZSwgdHJlZSwgaW5kaWNlcywgbm9kZXMpIHtcbiAgICBpZiAoIWluZGljZXMgfHwgaW5kaWNlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIHt9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaW5kaWNlcy5zb3J0KGFzY2VuZGluZylcbiAgICAgICAgcmV0dXJuIHJlY3Vyc2Uocm9vdE5vZGUsIHRyZWUsIGluZGljZXMsIG5vZGVzLCAwKVxuICAgIH1cbn1cblxuZnVuY3Rpb24gcmVjdXJzZShyb290Tm9kZSwgdHJlZSwgaW5kaWNlcywgbm9kZXMsIHJvb3RJbmRleCkge1xuICAgIG5vZGVzID0gbm9kZXMgfHwge31cblxuXG4gICAgaWYgKHJvb3ROb2RlKSB7XG4gICAgICAgIGlmIChpbmRleEluUmFuZ2UoaW5kaWNlcywgcm9vdEluZGV4LCByb290SW5kZXgpKSB7XG4gICAgICAgICAgICBub2Rlc1tyb290SW5kZXhdID0gcm9vdE5vZGVcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciB2Q2hpbGRyZW4gPSB0cmVlLmNoaWxkcmVuXG5cbiAgICAgICAgaWYgKHZDaGlsZHJlbikge1xuXG4gICAgICAgICAgICB2YXIgY2hpbGROb2RlcyA9IHJvb3ROb2RlLmNoaWxkTm9kZXNcblxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0cmVlLmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgcm9vdEluZGV4ICs9IDFcblxuICAgICAgICAgICAgICAgIHZhciB2Q2hpbGQgPSB2Q2hpbGRyZW5baV0gfHwgbm9DaGlsZFxuICAgICAgICAgICAgICAgIHZhciBuZXh0SW5kZXggPSByb290SW5kZXggKyAodkNoaWxkLmNvdW50IHx8IDApXG5cbiAgICAgICAgICAgICAgICAvLyBza2lwIHJlY3Vyc2lvbiBkb3duIHRoZSB0cmVlIGlmIHRoZXJlIGFyZSBubyBub2RlcyBkb3duIGhlcmVcbiAgICAgICAgICAgICAgICBpZiAoaW5kZXhJblJhbmdlKGluZGljZXMsIHJvb3RJbmRleCwgbmV4dEluZGV4KSkge1xuICAgICAgICAgICAgICAgICAgICByZWN1cnNlKGNoaWxkTm9kZXNbaV0sIHZDaGlsZCwgaW5kaWNlcywgbm9kZXMsIHJvb3RJbmRleClcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByb290SW5kZXggPSBuZXh0SW5kZXhcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBub2Rlc1xufVxuXG4vLyBCaW5hcnkgc2VhcmNoIGZvciBhbiBpbmRleCBpbiB0aGUgaW50ZXJ2YWwgW2xlZnQsIHJpZ2h0XVxuZnVuY3Rpb24gaW5kZXhJblJhbmdlKGluZGljZXMsIGxlZnQsIHJpZ2h0KSB7XG4gICAgaWYgKGluZGljZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cblxuICAgIHZhciBtaW5JbmRleCA9IDBcbiAgICB2YXIgbWF4SW5kZXggPSBpbmRpY2VzLmxlbmd0aCAtIDFcbiAgICB2YXIgY3VycmVudEluZGV4XG4gICAgdmFyIGN1cnJlbnRJdGVtXG5cbiAgICB3aGlsZSAobWluSW5kZXggPD0gbWF4SW5kZXgpIHtcbiAgICAgICAgY3VycmVudEluZGV4ID0gKChtYXhJbmRleCArIG1pbkluZGV4KSAvIDIpID4+IDBcbiAgICAgICAgY3VycmVudEl0ZW0gPSBpbmRpY2VzW2N1cnJlbnRJbmRleF1cblxuICAgICAgICBpZiAobWluSW5kZXggPT09IG1heEluZGV4KSB7XG4gICAgICAgICAgICByZXR1cm4gY3VycmVudEl0ZW0gPj0gbGVmdCAmJiBjdXJyZW50SXRlbSA8PSByaWdodFxuICAgICAgICB9IGVsc2UgaWYgKGN1cnJlbnRJdGVtIDwgbGVmdCkge1xuICAgICAgICAgICAgbWluSW5kZXggPSBjdXJyZW50SW5kZXggKyAxXG4gICAgICAgIH0gZWxzZSAgaWYgKGN1cnJlbnRJdGVtID4gcmlnaHQpIHtcbiAgICAgICAgICAgIG1heEluZGV4ID0gY3VycmVudEluZGV4IC0gMVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gYXNjZW5kaW5nKGEsIGIpIHtcbiAgICByZXR1cm4gYSA+IGIgPyAxIDogLTFcbn1cbiIsInZhciBhcHBseVByb3BlcnRpZXMgPSByZXF1aXJlKFwiLi9hcHBseS1wcm9wZXJ0aWVzXCIpXG5cbnZhciBpc1dpZGdldCA9IHJlcXVpcmUoXCIuLi92bm9kZS9pcy13aWRnZXQuanNcIilcbnZhciBWUGF0Y2ggPSByZXF1aXJlKFwiLi4vdm5vZGUvdnBhdGNoLmpzXCIpXG5cbnZhciB1cGRhdGVXaWRnZXQgPSByZXF1aXJlKFwiLi91cGRhdGUtd2lkZ2V0XCIpXG5cbm1vZHVsZS5leHBvcnRzID0gYXBwbHlQYXRjaFxuXG5mdW5jdGlvbiBhcHBseVBhdGNoKHZwYXRjaCwgZG9tTm9kZSwgcmVuZGVyT3B0aW9ucykge1xuICAgIHZhciB0eXBlID0gdnBhdGNoLnR5cGVcbiAgICB2YXIgdk5vZGUgPSB2cGF0Y2gudk5vZGVcbiAgICB2YXIgcGF0Y2ggPSB2cGF0Y2gucGF0Y2hcblxuICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICBjYXNlIFZQYXRjaC5SRU1PVkU6XG4gICAgICAgICAgICByZXR1cm4gcmVtb3ZlTm9kZShkb21Ob2RlLCB2Tm9kZSlcbiAgICAgICAgY2FzZSBWUGF0Y2guSU5TRVJUOlxuICAgICAgICAgICAgcmV0dXJuIGluc2VydE5vZGUoZG9tTm9kZSwgcGF0Y2gsIHJlbmRlck9wdGlvbnMpXG4gICAgICAgIGNhc2UgVlBhdGNoLlZURVhUOlxuICAgICAgICAgICAgcmV0dXJuIHN0cmluZ1BhdGNoKGRvbU5vZGUsIHZOb2RlLCBwYXRjaCwgcmVuZGVyT3B0aW9ucylcbiAgICAgICAgY2FzZSBWUGF0Y2guV0lER0VUOlxuICAgICAgICAgICAgcmV0dXJuIHdpZGdldFBhdGNoKGRvbU5vZGUsIHZOb2RlLCBwYXRjaCwgcmVuZGVyT3B0aW9ucylcbiAgICAgICAgY2FzZSBWUGF0Y2guVk5PREU6XG4gICAgICAgICAgICByZXR1cm4gdk5vZGVQYXRjaChkb21Ob2RlLCB2Tm9kZSwgcGF0Y2gsIHJlbmRlck9wdGlvbnMpXG4gICAgICAgIGNhc2UgVlBhdGNoLk9SREVSOlxuICAgICAgICAgICAgcmVvcmRlckNoaWxkcmVuKGRvbU5vZGUsIHBhdGNoKVxuICAgICAgICAgICAgcmV0dXJuIGRvbU5vZGVcbiAgICAgICAgY2FzZSBWUGF0Y2guUFJPUFM6XG4gICAgICAgICAgICBhcHBseVByb3BlcnRpZXMoZG9tTm9kZSwgcGF0Y2gsIHZOb2RlLnByb3BlcnRpZXMpXG4gICAgICAgICAgICByZXR1cm4gZG9tTm9kZVxuICAgICAgICBjYXNlIFZQYXRjaC5USFVOSzpcbiAgICAgICAgICAgIHJldHVybiByZXBsYWNlUm9vdChkb21Ob2RlLFxuICAgICAgICAgICAgICAgIHJlbmRlck9wdGlvbnMucGF0Y2goZG9tTm9kZSwgcGF0Y2gsIHJlbmRlck9wdGlvbnMpKVxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgcmV0dXJuIGRvbU5vZGVcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlbW92ZU5vZGUoZG9tTm9kZSwgdk5vZGUpIHtcbiAgICB2YXIgcGFyZW50Tm9kZSA9IGRvbU5vZGUucGFyZW50Tm9kZVxuXG4gICAgaWYgKHBhcmVudE5vZGUpIHtcbiAgICAgICAgcGFyZW50Tm9kZS5yZW1vdmVDaGlsZChkb21Ob2RlKVxuICAgIH1cblxuICAgIGRlc3Ryb3lXaWRnZXQoZG9tTm9kZSwgdk5vZGUpO1xuXG4gICAgcmV0dXJuIG51bGxcbn1cblxuZnVuY3Rpb24gaW5zZXJ0Tm9kZShwYXJlbnROb2RlLCB2Tm9kZSwgcmVuZGVyT3B0aW9ucykge1xuICAgIHZhciBuZXdOb2RlID0gcmVuZGVyT3B0aW9ucy5yZW5kZXIodk5vZGUsIHJlbmRlck9wdGlvbnMpXG5cbiAgICBpZiAocGFyZW50Tm9kZSkge1xuICAgICAgICBwYXJlbnROb2RlLmFwcGVuZENoaWxkKG5ld05vZGUpXG4gICAgfVxuXG4gICAgcmV0dXJuIHBhcmVudE5vZGVcbn1cblxuZnVuY3Rpb24gc3RyaW5nUGF0Y2goZG9tTm9kZSwgbGVmdFZOb2RlLCB2VGV4dCwgcmVuZGVyT3B0aW9ucykge1xuICAgIHZhciBuZXdOb2RlXG5cbiAgICBpZiAoZG9tTm9kZS5ub2RlVHlwZSA9PT0gMykge1xuICAgICAgICBkb21Ob2RlLnJlcGxhY2VEYXRhKDAsIGRvbU5vZGUubGVuZ3RoLCB2VGV4dC50ZXh0KVxuICAgICAgICBuZXdOb2RlID0gZG9tTm9kZVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBwYXJlbnROb2RlID0gZG9tTm9kZS5wYXJlbnROb2RlXG4gICAgICAgIG5ld05vZGUgPSByZW5kZXJPcHRpb25zLnJlbmRlcih2VGV4dCwgcmVuZGVyT3B0aW9ucylcblxuICAgICAgICBpZiAocGFyZW50Tm9kZSAmJiBuZXdOb2RlICE9PSBkb21Ob2RlKSB7XG4gICAgICAgICAgICBwYXJlbnROb2RlLnJlcGxhY2VDaGlsZChuZXdOb2RlLCBkb21Ob2RlKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ld05vZGVcbn1cblxuZnVuY3Rpb24gd2lkZ2V0UGF0Y2goZG9tTm9kZSwgbGVmdFZOb2RlLCB3aWRnZXQsIHJlbmRlck9wdGlvbnMpIHtcbiAgICB2YXIgdXBkYXRpbmcgPSB1cGRhdGVXaWRnZXQobGVmdFZOb2RlLCB3aWRnZXQpXG4gICAgdmFyIG5ld05vZGVcblxuICAgIGlmICh1cGRhdGluZykge1xuICAgICAgICBuZXdOb2RlID0gd2lkZ2V0LnVwZGF0ZShsZWZ0Vk5vZGUsIGRvbU5vZGUpIHx8IGRvbU5vZGVcbiAgICB9IGVsc2Uge1xuICAgICAgICBuZXdOb2RlID0gcmVuZGVyT3B0aW9ucy5yZW5kZXIod2lkZ2V0LCByZW5kZXJPcHRpb25zKVxuICAgIH1cblxuICAgIHZhciBwYXJlbnROb2RlID0gZG9tTm9kZS5wYXJlbnROb2RlXG5cbiAgICBpZiAocGFyZW50Tm9kZSAmJiBuZXdOb2RlICE9PSBkb21Ob2RlKSB7XG4gICAgICAgIHBhcmVudE5vZGUucmVwbGFjZUNoaWxkKG5ld05vZGUsIGRvbU5vZGUpXG4gICAgfVxuXG4gICAgaWYgKCF1cGRhdGluZykge1xuICAgICAgICBkZXN0cm95V2lkZ2V0KGRvbU5vZGUsIGxlZnRWTm9kZSlcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3Tm9kZVxufVxuXG5mdW5jdGlvbiB2Tm9kZVBhdGNoKGRvbU5vZGUsIGxlZnRWTm9kZSwgdk5vZGUsIHJlbmRlck9wdGlvbnMpIHtcbiAgICB2YXIgcGFyZW50Tm9kZSA9IGRvbU5vZGUucGFyZW50Tm9kZVxuICAgIHZhciBuZXdOb2RlID0gcmVuZGVyT3B0aW9ucy5yZW5kZXIodk5vZGUsIHJlbmRlck9wdGlvbnMpXG5cbiAgICBpZiAocGFyZW50Tm9kZSAmJiBuZXdOb2RlICE9PSBkb21Ob2RlKSB7XG4gICAgICAgIHBhcmVudE5vZGUucmVwbGFjZUNoaWxkKG5ld05vZGUsIGRvbU5vZGUpXG4gICAgfVxuXG4gICAgcmV0dXJuIG5ld05vZGVcbn1cblxuZnVuY3Rpb24gZGVzdHJveVdpZGdldChkb21Ob2RlLCB3KSB7XG4gICAgaWYgKHR5cGVvZiB3LmRlc3Ryb3kgPT09IFwiZnVuY3Rpb25cIiAmJiBpc1dpZGdldCh3KSkge1xuICAgICAgICB3LmRlc3Ryb3koZG9tTm9kZSlcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlb3JkZXJDaGlsZHJlbihkb21Ob2RlLCBtb3Zlcykge1xuICAgIHZhciBjaGlsZE5vZGVzID0gZG9tTm9kZS5jaGlsZE5vZGVzXG4gICAgdmFyIGtleU1hcCA9IHt9XG4gICAgdmFyIG5vZGVcbiAgICB2YXIgcmVtb3ZlXG4gICAgdmFyIGluc2VydFxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBtb3Zlcy5yZW1vdmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHJlbW92ZSA9IG1vdmVzLnJlbW92ZXNbaV1cbiAgICAgICAgbm9kZSA9IGNoaWxkTm9kZXNbcmVtb3ZlLmZyb21dXG4gICAgICAgIGlmIChyZW1vdmUua2V5KSB7XG4gICAgICAgICAgICBrZXlNYXBbcmVtb3ZlLmtleV0gPSBub2RlXG4gICAgICAgIH1cbiAgICAgICAgZG9tTm9kZS5yZW1vdmVDaGlsZChub2RlKVxuICAgIH1cblxuICAgIHZhciBsZW5ndGggPSBjaGlsZE5vZGVzLmxlbmd0aFxuICAgIGZvciAodmFyIGogPSAwOyBqIDwgbW92ZXMuaW5zZXJ0cy5sZW5ndGg7IGorKykge1xuICAgICAgICBpbnNlcnQgPSBtb3Zlcy5pbnNlcnRzW2pdXG4gICAgICAgIG5vZGUgPSBrZXlNYXBbaW5zZXJ0LmtleV1cbiAgICAgICAgLy8gdGhpcyBpcyB0aGUgd2VpcmRlc3QgYnVnIGkndmUgZXZlciBzZWVuIGluIHdlYmtpdFxuICAgICAgICBkb21Ob2RlLmluc2VydEJlZm9yZShub2RlLCBpbnNlcnQudG8gPj0gbGVuZ3RoKysgPyBudWxsIDogY2hpbGROb2Rlc1tpbnNlcnQudG9dKVxuICAgIH1cbn1cblxuZnVuY3Rpb24gcmVwbGFjZVJvb3Qob2xkUm9vdCwgbmV3Um9vdCkge1xuICAgIGlmIChvbGRSb290ICYmIG5ld1Jvb3QgJiYgb2xkUm9vdCAhPT0gbmV3Um9vdCAmJiBvbGRSb290LnBhcmVudE5vZGUpIHtcbiAgICAgICAgb2xkUm9vdC5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChuZXdSb290LCBvbGRSb290KVxuICAgIH1cblxuICAgIHJldHVybiBuZXdSb290O1xufVxuIiwidmFyIGRvY3VtZW50ID0gcmVxdWlyZShcImdsb2JhbC9kb2N1bWVudFwiKVxudmFyIGlzQXJyYXkgPSByZXF1aXJlKFwieC1pcy1hcnJheVwiKVxuXG52YXIgcmVuZGVyID0gcmVxdWlyZShcIi4vY3JlYXRlLWVsZW1lbnRcIilcbnZhciBkb21JbmRleCA9IHJlcXVpcmUoXCIuL2RvbS1pbmRleFwiKVxudmFyIHBhdGNoT3AgPSByZXF1aXJlKFwiLi9wYXRjaC1vcFwiKVxubW9kdWxlLmV4cG9ydHMgPSBwYXRjaFxuXG5mdW5jdGlvbiBwYXRjaChyb290Tm9kZSwgcGF0Y2hlcywgcmVuZGVyT3B0aW9ucykge1xuICAgIHJlbmRlck9wdGlvbnMgPSByZW5kZXJPcHRpb25zIHx8IHt9XG4gICAgcmVuZGVyT3B0aW9ucy5wYXRjaCA9IHJlbmRlck9wdGlvbnMucGF0Y2ggJiYgcmVuZGVyT3B0aW9ucy5wYXRjaCAhPT0gcGF0Y2hcbiAgICAgICAgPyByZW5kZXJPcHRpb25zLnBhdGNoXG4gICAgICAgIDogcGF0Y2hSZWN1cnNpdmVcbiAgICByZW5kZXJPcHRpb25zLnJlbmRlciA9IHJlbmRlck9wdGlvbnMucmVuZGVyIHx8IHJlbmRlclxuXG4gICAgcmV0dXJuIHJlbmRlck9wdGlvbnMucGF0Y2gocm9vdE5vZGUsIHBhdGNoZXMsIHJlbmRlck9wdGlvbnMpXG59XG5cbmZ1bmN0aW9uIHBhdGNoUmVjdXJzaXZlKHJvb3ROb2RlLCBwYXRjaGVzLCByZW5kZXJPcHRpb25zKSB7XG4gICAgdmFyIGluZGljZXMgPSBwYXRjaEluZGljZXMocGF0Y2hlcylcblxuICAgIGlmIChpbmRpY2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gcm9vdE5vZGVcbiAgICB9XG5cbiAgICB2YXIgaW5kZXggPSBkb21JbmRleChyb290Tm9kZSwgcGF0Y2hlcy5hLCBpbmRpY2VzKVxuICAgIHZhciBvd25lckRvY3VtZW50ID0gcm9vdE5vZGUub3duZXJEb2N1bWVudFxuXG4gICAgaWYgKCFyZW5kZXJPcHRpb25zLmRvY3VtZW50ICYmIG93bmVyRG9jdW1lbnQgIT09IGRvY3VtZW50KSB7XG4gICAgICAgIHJlbmRlck9wdGlvbnMuZG9jdW1lbnQgPSBvd25lckRvY3VtZW50XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBpbmRpY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBub2RlSW5kZXggPSBpbmRpY2VzW2ldXG4gICAgICAgIHJvb3ROb2RlID0gYXBwbHlQYXRjaChyb290Tm9kZSxcbiAgICAgICAgICAgIGluZGV4W25vZGVJbmRleF0sXG4gICAgICAgICAgICBwYXRjaGVzW25vZGVJbmRleF0sXG4gICAgICAgICAgICByZW5kZXJPcHRpb25zKVxuICAgIH1cblxuICAgIHJldHVybiByb290Tm9kZVxufVxuXG5mdW5jdGlvbiBhcHBseVBhdGNoKHJvb3ROb2RlLCBkb21Ob2RlLCBwYXRjaExpc3QsIHJlbmRlck9wdGlvbnMpIHtcbiAgICBpZiAoIWRvbU5vZGUpIHtcbiAgICAgICAgcmV0dXJuIHJvb3ROb2RlXG4gICAgfVxuXG4gICAgdmFyIG5ld05vZGVcblxuICAgIGlmIChpc0FycmF5KHBhdGNoTGlzdCkpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwYXRjaExpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIG5ld05vZGUgPSBwYXRjaE9wKHBhdGNoTGlzdFtpXSwgZG9tTm9kZSwgcmVuZGVyT3B0aW9ucylcblxuICAgICAgICAgICAgaWYgKGRvbU5vZGUgPT09IHJvb3ROb2RlKSB7XG4gICAgICAgICAgICAgICAgcm9vdE5vZGUgPSBuZXdOb2RlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBuZXdOb2RlID0gcGF0Y2hPcChwYXRjaExpc3QsIGRvbU5vZGUsIHJlbmRlck9wdGlvbnMpXG5cbiAgICAgICAgaWYgKGRvbU5vZGUgPT09IHJvb3ROb2RlKSB7XG4gICAgICAgICAgICByb290Tm9kZSA9IG5ld05vZGVcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByb290Tm9kZVxufVxuXG5mdW5jdGlvbiBwYXRjaEluZGljZXMocGF0Y2hlcykge1xuICAgIHZhciBpbmRpY2VzID0gW11cblxuICAgIGZvciAodmFyIGtleSBpbiBwYXRjaGVzKSB7XG4gICAgICAgIGlmIChrZXkgIT09IFwiYVwiKSB7XG4gICAgICAgICAgICBpbmRpY2VzLnB1c2goTnVtYmVyKGtleSkpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gaW5kaWNlc1xufVxuIiwidmFyIGlzV2lkZ2V0ID0gcmVxdWlyZShcIi4uL3Zub2RlL2lzLXdpZGdldC5qc1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IHVwZGF0ZVdpZGdldFxuXG5mdW5jdGlvbiB1cGRhdGVXaWRnZXQoYSwgYikge1xuICAgIGlmIChpc1dpZGdldChhKSAmJiBpc1dpZGdldChiKSkge1xuICAgICAgICBpZiAoXCJuYW1lXCIgaW4gYSAmJiBcIm5hbWVcIiBpbiBiKSB7XG4gICAgICAgICAgICByZXR1cm4gYS5pZCA9PT0gYi5pZFxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGEuaW5pdCA9PT0gYi5pbml0XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2Vcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIEV2U3RvcmUgPSByZXF1aXJlKCdldi1zdG9yZScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEV2SG9vaztcblxuZnVuY3Rpb24gRXZIb29rKHZhbHVlKSB7XG4gICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIEV2SG9vaykpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBFdkhvb2sodmFsdWUpO1xuICAgIH1cblxuICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbn1cblxuRXZIb29rLnByb3RvdHlwZS5ob29rID0gZnVuY3Rpb24gKG5vZGUsIHByb3BlcnR5TmFtZSkge1xuICAgIHZhciBlcyA9IEV2U3RvcmUobm9kZSk7XG4gICAgdmFyIHByb3BOYW1lID0gcHJvcGVydHlOYW1lLnN1YnN0cigzKTtcblxuICAgIGVzW3Byb3BOYW1lXSA9IHRoaXMudmFsdWU7XG59O1xuXG5Fdkhvb2sucHJvdG90eXBlLnVuaG9vayA9IGZ1bmN0aW9uKG5vZGUsIHByb3BlcnR5TmFtZSkge1xuICAgIHZhciBlcyA9IEV2U3RvcmUobm9kZSk7XG4gICAgdmFyIHByb3BOYW1lID0gcHJvcGVydHlOYW1lLnN1YnN0cigzKTtcblxuICAgIGVzW3Byb3BOYW1lXSA9IHVuZGVmaW5lZDtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gU29mdFNldEhvb2s7XG5cbmZ1bmN0aW9uIFNvZnRTZXRIb29rKHZhbHVlKSB7XG4gICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFNvZnRTZXRIb29rKSkge1xuICAgICAgICByZXR1cm4gbmV3IFNvZnRTZXRIb29rKHZhbHVlKTtcbiAgICB9XG5cbiAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG59XG5cblNvZnRTZXRIb29rLnByb3RvdHlwZS5ob29rID0gZnVuY3Rpb24gKG5vZGUsIHByb3BlcnR5TmFtZSkge1xuICAgIGlmIChub2RlW3Byb3BlcnR5TmFtZV0gIT09IHRoaXMudmFsdWUpIHtcbiAgICAgICAgbm9kZVtwcm9wZXJ0eU5hbWVdID0gdGhpcy52YWx1ZTtcbiAgICB9XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgaXNBcnJheSA9IHJlcXVpcmUoJ3gtaXMtYXJyYXknKTtcblxudmFyIFZOb2RlID0gcmVxdWlyZSgnLi4vdm5vZGUvdm5vZGUuanMnKTtcbnZhciBWVGV4dCA9IHJlcXVpcmUoJy4uL3Zub2RlL3Z0ZXh0LmpzJyk7XG52YXIgaXNWTm9kZSA9IHJlcXVpcmUoJy4uL3Zub2RlL2lzLXZub2RlJyk7XG52YXIgaXNWVGV4dCA9IHJlcXVpcmUoJy4uL3Zub2RlL2lzLXZ0ZXh0Jyk7XG52YXIgaXNXaWRnZXQgPSByZXF1aXJlKCcuLi92bm9kZS9pcy13aWRnZXQnKTtcbnZhciBpc0hvb2sgPSByZXF1aXJlKCcuLi92bm9kZS9pcy12aG9vaycpO1xudmFyIGlzVlRodW5rID0gcmVxdWlyZSgnLi4vdm5vZGUvaXMtdGh1bmsnKTtcblxudmFyIHBhcnNlVGFnID0gcmVxdWlyZSgnLi9wYXJzZS10YWcuanMnKTtcbnZhciBzb2Z0U2V0SG9vayA9IHJlcXVpcmUoJy4vaG9va3Mvc29mdC1zZXQtaG9vay5qcycpO1xudmFyIGV2SG9vayA9IHJlcXVpcmUoJy4vaG9va3MvZXYtaG9vay5qcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGg7XG5cbmZ1bmN0aW9uIGgodGFnTmFtZSwgcHJvcGVydGllcywgY2hpbGRyZW4pIHtcbiAgICB2YXIgY2hpbGROb2RlcyA9IFtdO1xuICAgIHZhciB0YWcsIHByb3BzLCBrZXksIG5hbWVzcGFjZTtcblxuICAgIGlmICghY2hpbGRyZW4gJiYgaXNDaGlsZHJlbihwcm9wZXJ0aWVzKSkge1xuICAgICAgICBjaGlsZHJlbiA9IHByb3BlcnRpZXM7XG4gICAgICAgIHByb3BzID0ge307XG4gICAgfVxuXG4gICAgcHJvcHMgPSBwcm9wcyB8fCBwcm9wZXJ0aWVzIHx8IHt9O1xuICAgIHRhZyA9IHBhcnNlVGFnKHRhZ05hbWUsIHByb3BzKTtcblxuICAgIC8vIHN1cHBvcnQga2V5c1xuICAgIGlmIChwcm9wcy5oYXNPd25Qcm9wZXJ0eSgna2V5JykpIHtcbiAgICAgICAga2V5ID0gcHJvcHMua2V5O1xuICAgICAgICBwcm9wcy5rZXkgPSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgLy8gc3VwcG9ydCBuYW1lc3BhY2VcbiAgICBpZiAocHJvcHMuaGFzT3duUHJvcGVydHkoJ25hbWVzcGFjZScpKSB7XG4gICAgICAgIG5hbWVzcGFjZSA9IHByb3BzLm5hbWVzcGFjZTtcbiAgICAgICAgcHJvcHMubmFtZXNwYWNlID0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIC8vIGZpeCBjdXJzb3IgYnVnXG4gICAgaWYgKHRhZyA9PT0gJ0lOUFVUJyAmJlxuICAgICAgICAhbmFtZXNwYWNlICYmXG4gICAgICAgIHByb3BzLmhhc093blByb3BlcnR5KCd2YWx1ZScpICYmXG4gICAgICAgIHByb3BzLnZhbHVlICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgIWlzSG9vayhwcm9wcy52YWx1ZSlcbiAgICApIHtcbiAgICAgICAgcHJvcHMudmFsdWUgPSBzb2Z0U2V0SG9vayhwcm9wcy52YWx1ZSk7XG4gICAgfVxuXG4gICAgdHJhbnNmb3JtUHJvcGVydGllcyhwcm9wcyk7XG5cbiAgICBpZiAoY2hpbGRyZW4gIT09IHVuZGVmaW5lZCAmJiBjaGlsZHJlbiAhPT0gbnVsbCkge1xuICAgICAgICBhZGRDaGlsZChjaGlsZHJlbiwgY2hpbGROb2RlcywgdGFnLCBwcm9wcyk7XG4gICAgfVxuXG5cbiAgICByZXR1cm4gbmV3IFZOb2RlKHRhZywgcHJvcHMsIGNoaWxkTm9kZXMsIGtleSwgbmFtZXNwYWNlKTtcbn1cblxuZnVuY3Rpb24gYWRkQ2hpbGQoYywgY2hpbGROb2RlcywgdGFnLCBwcm9wcykge1xuICAgIGlmICh0eXBlb2YgYyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgY2hpbGROb2Rlcy5wdXNoKG5ldyBWVGV4dChjKSk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgYyA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgY2hpbGROb2Rlcy5wdXNoKG5ldyBWVGV4dChTdHJpbmcoYykpKTtcbiAgICB9IGVsc2UgaWYgKGlzQ2hpbGQoYykpIHtcbiAgICAgICAgY2hpbGROb2Rlcy5wdXNoKGMpO1xuICAgIH0gZWxzZSBpZiAoaXNBcnJheShjKSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFkZENoaWxkKGNbaV0sIGNoaWxkTm9kZXMsIHRhZywgcHJvcHMpO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChjID09PSBudWxsIHx8IGMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm47XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgVW5leHBlY3RlZFZpcnR1YWxFbGVtZW50KHtcbiAgICAgICAgICAgIGZvcmVpZ25PYmplY3Q6IGMsXG4gICAgICAgICAgICBwYXJlbnRWbm9kZToge1xuICAgICAgICAgICAgICAgIHRhZ05hbWU6IHRhZyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiBwcm9wc1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHRyYW5zZm9ybVByb3BlcnRpZXMocHJvcHMpIHtcbiAgICBmb3IgKHZhciBwcm9wTmFtZSBpbiBwcm9wcykge1xuICAgICAgICBpZiAocHJvcHMuaGFzT3duUHJvcGVydHkocHJvcE5hbWUpKSB7XG4gICAgICAgICAgICB2YXIgdmFsdWUgPSBwcm9wc1twcm9wTmFtZV07XG5cbiAgICAgICAgICAgIGlmIChpc0hvb2sodmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChwcm9wTmFtZS5zdWJzdHIoMCwgMykgPT09ICdldi0nKSB7XG4gICAgICAgICAgICAgICAgLy8gYWRkIGV2LWZvbyBzdXBwb3J0XG4gICAgICAgICAgICAgICAgcHJvcHNbcHJvcE5hbWVdID0gZXZIb29rKHZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gaXNDaGlsZCh4KSB7XG4gICAgcmV0dXJuIGlzVk5vZGUoeCkgfHwgaXNWVGV4dCh4KSB8fCBpc1dpZGdldCh4KSB8fCBpc1ZUaHVuayh4KTtcbn1cblxuZnVuY3Rpb24gaXNDaGlsZHJlbih4KSB7XG4gICAgcmV0dXJuIHR5cGVvZiB4ID09PSAnc3RyaW5nJyB8fCBpc0FycmF5KHgpIHx8IGlzQ2hpbGQoeCk7XG59XG5cbmZ1bmN0aW9uIFVuZXhwZWN0ZWRWaXJ0dWFsRWxlbWVudChkYXRhKSB7XG4gICAgdmFyIGVyciA9IG5ldyBFcnJvcigpO1xuXG4gICAgZXJyLnR5cGUgPSAndmlydHVhbC1oeXBlcnNjcmlwdC51bmV4cGVjdGVkLnZpcnR1YWwtZWxlbWVudCc7XG4gICAgZXJyLm1lc3NhZ2UgPSAnVW5leHBlY3RlZCB2aXJ0dWFsIGNoaWxkIHBhc3NlZCB0byBoKCkuXFxuJyArXG4gICAgICAgICdFeHBlY3RlZCBhIFZOb2RlIC8gVnRodW5rIC8gVldpZGdldCAvIHN0cmluZyBidXQ6XFxuJyArXG4gICAgICAgICdnb3Q6XFxuJyArXG4gICAgICAgIGVycm9yU3RyaW5nKGRhdGEuZm9yZWlnbk9iamVjdCkgK1xuICAgICAgICAnLlxcbicgK1xuICAgICAgICAnVGhlIHBhcmVudCB2bm9kZSBpczpcXG4nICtcbiAgICAgICAgZXJyb3JTdHJpbmcoZGF0YS5wYXJlbnRWbm9kZSlcbiAgICAgICAgJ1xcbicgK1xuICAgICAgICAnU3VnZ2VzdGVkIGZpeDogY2hhbmdlIHlvdXIgYGgoLi4uLCBbIC4uLiBdKWAgY2FsbHNpdGUuJztcbiAgICBlcnIuZm9yZWlnbk9iamVjdCA9IGRhdGEuZm9yZWlnbk9iamVjdDtcbiAgICBlcnIucGFyZW50Vm5vZGUgPSBkYXRhLnBhcmVudFZub2RlO1xuXG4gICAgcmV0dXJuIGVycjtcbn1cblxuZnVuY3Rpb24gZXJyb3JTdHJpbmcob2JqKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KG9iaiwgbnVsbCwgJyAgICAnKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJldHVybiBTdHJpbmcob2JqKTtcbiAgICB9XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBzcGxpdCA9IHJlcXVpcmUoJ2Jyb3dzZXItc3BsaXQnKTtcblxudmFyIGNsYXNzSWRTcGxpdCA9IC8oW1xcLiNdP1thLXpBLVowLTlcXHUwMDdGLVxcdUZGRkZfOi1dKykvO1xudmFyIG5vdENsYXNzSWQgPSAvXlxcLnwjLztcblxubW9kdWxlLmV4cG9ydHMgPSBwYXJzZVRhZztcblxuZnVuY3Rpb24gcGFyc2VUYWcodGFnLCBwcm9wcykge1xuICAgIGlmICghdGFnKSB7XG4gICAgICAgIHJldHVybiAnRElWJztcbiAgICB9XG5cbiAgICB2YXIgbm9JZCA9ICEocHJvcHMuaGFzT3duUHJvcGVydHkoJ2lkJykpO1xuXG4gICAgdmFyIHRhZ1BhcnRzID0gc3BsaXQodGFnLCBjbGFzc0lkU3BsaXQpO1xuICAgIHZhciB0YWdOYW1lID0gbnVsbDtcblxuICAgIGlmIChub3RDbGFzc0lkLnRlc3QodGFnUGFydHNbMV0pKSB7XG4gICAgICAgIHRhZ05hbWUgPSAnRElWJztcbiAgICB9XG5cbiAgICB2YXIgY2xhc3NlcywgcGFydCwgdHlwZSwgaTtcblxuICAgIGZvciAoaSA9IDA7IGkgPCB0YWdQYXJ0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBwYXJ0ID0gdGFnUGFydHNbaV07XG5cbiAgICAgICAgaWYgKCFwYXJ0KSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHR5cGUgPSBwYXJ0LmNoYXJBdCgwKTtcblxuICAgICAgICBpZiAoIXRhZ05hbWUpIHtcbiAgICAgICAgICAgIHRhZ05hbWUgPSBwYXJ0O1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICcuJykge1xuICAgICAgICAgICAgY2xhc3NlcyA9IGNsYXNzZXMgfHwgW107XG4gICAgICAgICAgICBjbGFzc2VzLnB1c2gocGFydC5zdWJzdHJpbmcoMSwgcGFydC5sZW5ndGgpKTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAnIycgJiYgbm9JZCkge1xuICAgICAgICAgICAgcHJvcHMuaWQgPSBwYXJ0LnN1YnN0cmluZygxLCBwYXJ0Lmxlbmd0aCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoY2xhc3Nlcykge1xuICAgICAgICBpZiAocHJvcHMuY2xhc3NOYW1lKSB7XG4gICAgICAgICAgICBjbGFzc2VzLnB1c2gocHJvcHMuY2xhc3NOYW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHByb3BzLmNsYXNzTmFtZSA9IGNsYXNzZXMuam9pbignICcpO1xuICAgIH1cblxuICAgIHJldHVybiBwcm9wcy5uYW1lc3BhY2UgPyB0YWdOYW1lIDogdGFnTmFtZS50b1VwcGVyQ2FzZSgpO1xufVxuIiwidmFyIGlzVk5vZGUgPSByZXF1aXJlKFwiLi9pcy12bm9kZVwiKVxudmFyIGlzVlRleHQgPSByZXF1aXJlKFwiLi9pcy12dGV4dFwiKVxudmFyIGlzV2lkZ2V0ID0gcmVxdWlyZShcIi4vaXMtd2lkZ2V0XCIpXG52YXIgaXNUaHVuayA9IHJlcXVpcmUoXCIuL2lzLXRodW5rXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gaGFuZGxlVGh1bmtcblxuZnVuY3Rpb24gaGFuZGxlVGh1bmsoYSwgYikge1xuICAgIHZhciByZW5kZXJlZEEgPSBhXG4gICAgdmFyIHJlbmRlcmVkQiA9IGJcblxuICAgIGlmIChpc1RodW5rKGIpKSB7XG4gICAgICAgIHJlbmRlcmVkQiA9IHJlbmRlclRodW5rKGIsIGEpXG4gICAgfVxuXG4gICAgaWYgKGlzVGh1bmsoYSkpIHtcbiAgICAgICAgcmVuZGVyZWRBID0gcmVuZGVyVGh1bmsoYSwgbnVsbClcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBhOiByZW5kZXJlZEEsXG4gICAgICAgIGI6IHJlbmRlcmVkQlxuICAgIH1cbn1cblxuZnVuY3Rpb24gcmVuZGVyVGh1bmsodGh1bmssIHByZXZpb3VzKSB7XG4gICAgdmFyIHJlbmRlcmVkVGh1bmsgPSB0aHVuay52bm9kZVxuXG4gICAgaWYgKCFyZW5kZXJlZFRodW5rKSB7XG4gICAgICAgIHJlbmRlcmVkVGh1bmsgPSB0aHVuay52bm9kZSA9IHRodW5rLnJlbmRlcihwcmV2aW91cylcbiAgICB9XG5cbiAgICBpZiAoIShpc1ZOb2RlKHJlbmRlcmVkVGh1bmspIHx8XG4gICAgICAgICAgICBpc1ZUZXh0KHJlbmRlcmVkVGh1bmspIHx8XG4gICAgICAgICAgICBpc1dpZGdldChyZW5kZXJlZFRodW5rKSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwidGh1bmsgZGlkIG5vdCByZXR1cm4gYSB2YWxpZCBub2RlXCIpO1xuICAgIH1cblxuICAgIHJldHVybiByZW5kZXJlZFRodW5rXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGlzVGh1bmtcclxuXHJcbmZ1bmN0aW9uIGlzVGh1bmsodCkge1xyXG4gICAgcmV0dXJuIHQgJiYgdC50eXBlID09PSBcIlRodW5rXCJcclxufVxyXG4iLCJtb2R1bGUuZXhwb3J0cyA9IGlzSG9va1xuXG5mdW5jdGlvbiBpc0hvb2soaG9vaykge1xuICAgIHJldHVybiBob29rICYmXG4gICAgICAodHlwZW9mIGhvb2suaG9vayA9PT0gXCJmdW5jdGlvblwiICYmICFob29rLmhhc093blByb3BlcnR5KFwiaG9va1wiKSB8fFxuICAgICAgIHR5cGVvZiBob29rLnVuaG9vayA9PT0gXCJmdW5jdGlvblwiICYmICFob29rLmhhc093blByb3BlcnR5KFwidW5ob29rXCIpKVxufVxuIiwidmFyIHZlcnNpb24gPSByZXF1aXJlKFwiLi92ZXJzaW9uXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gaXNWaXJ0dWFsTm9kZVxuXG5mdW5jdGlvbiBpc1ZpcnR1YWxOb2RlKHgpIHtcbiAgICByZXR1cm4geCAmJiB4LnR5cGUgPT09IFwiVmlydHVhbE5vZGVcIiAmJiB4LnZlcnNpb24gPT09IHZlcnNpb25cbn1cbiIsInZhciB2ZXJzaW9uID0gcmVxdWlyZShcIi4vdmVyc2lvblwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzVmlydHVhbFRleHRcblxuZnVuY3Rpb24gaXNWaXJ0dWFsVGV4dCh4KSB7XG4gICAgcmV0dXJuIHggJiYgeC50eXBlID09PSBcIlZpcnR1YWxUZXh0XCIgJiYgeC52ZXJzaW9uID09PSB2ZXJzaW9uXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGlzV2lkZ2V0XG5cbmZ1bmN0aW9uIGlzV2lkZ2V0KHcpIHtcbiAgICByZXR1cm4gdyAmJiB3LnR5cGUgPT09IFwiV2lkZ2V0XCJcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gXCIyXCJcbiIsInZhciB2ZXJzaW9uID0gcmVxdWlyZShcIi4vdmVyc2lvblwiKVxudmFyIGlzVk5vZGUgPSByZXF1aXJlKFwiLi9pcy12bm9kZVwiKVxudmFyIGlzV2lkZ2V0ID0gcmVxdWlyZShcIi4vaXMtd2lkZ2V0XCIpXG52YXIgaXNUaHVuayA9IHJlcXVpcmUoXCIuL2lzLXRodW5rXCIpXG52YXIgaXNWSG9vayA9IHJlcXVpcmUoXCIuL2lzLXZob29rXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gVmlydHVhbE5vZGVcblxudmFyIG5vUHJvcGVydGllcyA9IHt9XG52YXIgbm9DaGlsZHJlbiA9IFtdXG5cbmZ1bmN0aW9uIFZpcnR1YWxOb2RlKHRhZ05hbWUsIHByb3BlcnRpZXMsIGNoaWxkcmVuLCBrZXksIG5hbWVzcGFjZSkge1xuICAgIHRoaXMudGFnTmFtZSA9IHRhZ05hbWVcbiAgICB0aGlzLnByb3BlcnRpZXMgPSBwcm9wZXJ0aWVzIHx8IG5vUHJvcGVydGllc1xuICAgIHRoaXMuY2hpbGRyZW4gPSBjaGlsZHJlbiB8fCBub0NoaWxkcmVuXG4gICAgdGhpcy5rZXkgPSBrZXkgIT0gbnVsbCA/IFN0cmluZyhrZXkpIDogdW5kZWZpbmVkXG4gICAgdGhpcy5uYW1lc3BhY2UgPSAodHlwZW9mIG5hbWVzcGFjZSA9PT0gXCJzdHJpbmdcIikgPyBuYW1lc3BhY2UgOiBudWxsXG5cbiAgICB2YXIgY291bnQgPSAoY2hpbGRyZW4gJiYgY2hpbGRyZW4ubGVuZ3RoKSB8fCAwXG4gICAgdmFyIGRlc2NlbmRhbnRzID0gMFxuICAgIHZhciBoYXNXaWRnZXRzID0gZmFsc2VcbiAgICB2YXIgaGFzVGh1bmtzID0gZmFsc2VcbiAgICB2YXIgZGVzY2VuZGFudEhvb2tzID0gZmFsc2VcbiAgICB2YXIgaG9va3NcblxuICAgIGZvciAodmFyIHByb3BOYW1lIGluIHByb3BlcnRpZXMpIHtcbiAgICAgICAgaWYgKHByb3BlcnRpZXMuaGFzT3duUHJvcGVydHkocHJvcE5hbWUpKSB7XG4gICAgICAgICAgICB2YXIgcHJvcGVydHkgPSBwcm9wZXJ0aWVzW3Byb3BOYW1lXVxuICAgICAgICAgICAgaWYgKGlzVkhvb2socHJvcGVydHkpICYmIHByb3BlcnR5LnVuaG9vaykge1xuICAgICAgICAgICAgICAgIGlmICghaG9va3MpIHtcbiAgICAgICAgICAgICAgICAgICAgaG9va3MgPSB7fVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGhvb2tzW3Byb3BOYW1lXSA9IHByb3BlcnR5XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICAgICAgdmFyIGNoaWxkID0gY2hpbGRyZW5baV1cbiAgICAgICAgaWYgKGlzVk5vZGUoY2hpbGQpKSB7XG4gICAgICAgICAgICBkZXNjZW5kYW50cyArPSBjaGlsZC5jb3VudCB8fCAwXG5cbiAgICAgICAgICAgIGlmICghaGFzV2lkZ2V0cyAmJiBjaGlsZC5oYXNXaWRnZXRzKSB7XG4gICAgICAgICAgICAgICAgaGFzV2lkZ2V0cyA9IHRydWVcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFoYXNUaHVua3MgJiYgY2hpbGQuaGFzVGh1bmtzKSB7XG4gICAgICAgICAgICAgICAgaGFzVGh1bmtzID0gdHJ1ZVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIWRlc2NlbmRhbnRIb29rcyAmJiAoY2hpbGQuaG9va3MgfHwgY2hpbGQuZGVzY2VuZGFudEhvb2tzKSkge1xuICAgICAgICAgICAgICAgIGRlc2NlbmRhbnRIb29rcyA9IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICghaGFzV2lkZ2V0cyAmJiBpc1dpZGdldChjaGlsZCkpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgY2hpbGQuZGVzdHJveSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgaGFzV2lkZ2V0cyA9IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICghaGFzVGh1bmtzICYmIGlzVGh1bmsoY2hpbGQpKSB7XG4gICAgICAgICAgICBoYXNUaHVua3MgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5jb3VudCA9IGNvdW50ICsgZGVzY2VuZGFudHNcbiAgICB0aGlzLmhhc1dpZGdldHMgPSBoYXNXaWRnZXRzXG4gICAgdGhpcy5oYXNUaHVua3MgPSBoYXNUaHVua3NcbiAgICB0aGlzLmhvb2tzID0gaG9va3NcbiAgICB0aGlzLmRlc2NlbmRhbnRIb29rcyA9IGRlc2NlbmRhbnRIb29rc1xufVxuXG5WaXJ0dWFsTm9kZS5wcm90b3R5cGUudmVyc2lvbiA9IHZlcnNpb25cblZpcnR1YWxOb2RlLnByb3RvdHlwZS50eXBlID0gXCJWaXJ0dWFsTm9kZVwiXG4iLCJ2YXIgdmVyc2lvbiA9IHJlcXVpcmUoXCIuL3ZlcnNpb25cIilcblxuVmlydHVhbFBhdGNoLk5PTkUgPSAwXG5WaXJ0dWFsUGF0Y2guVlRFWFQgPSAxXG5WaXJ0dWFsUGF0Y2guVk5PREUgPSAyXG5WaXJ0dWFsUGF0Y2guV0lER0VUID0gM1xuVmlydHVhbFBhdGNoLlBST1BTID0gNFxuVmlydHVhbFBhdGNoLk9SREVSID0gNVxuVmlydHVhbFBhdGNoLklOU0VSVCA9IDZcblZpcnR1YWxQYXRjaC5SRU1PVkUgPSA3XG5WaXJ0dWFsUGF0Y2guVEhVTksgPSA4XG5cbm1vZHVsZS5leHBvcnRzID0gVmlydHVhbFBhdGNoXG5cbmZ1bmN0aW9uIFZpcnR1YWxQYXRjaCh0eXBlLCB2Tm9kZSwgcGF0Y2gpIHtcbiAgICB0aGlzLnR5cGUgPSBOdW1iZXIodHlwZSlcbiAgICB0aGlzLnZOb2RlID0gdk5vZGVcbiAgICB0aGlzLnBhdGNoID0gcGF0Y2hcbn1cblxuVmlydHVhbFBhdGNoLnByb3RvdHlwZS52ZXJzaW9uID0gdmVyc2lvblxuVmlydHVhbFBhdGNoLnByb3RvdHlwZS50eXBlID0gXCJWaXJ0dWFsUGF0Y2hcIlxuIiwidmFyIHZlcnNpb24gPSByZXF1aXJlKFwiLi92ZXJzaW9uXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gVmlydHVhbFRleHRcblxuZnVuY3Rpb24gVmlydHVhbFRleHQodGV4dCkge1xuICAgIHRoaXMudGV4dCA9IFN0cmluZyh0ZXh0KVxufVxuXG5WaXJ0dWFsVGV4dC5wcm90b3R5cGUudmVyc2lvbiA9IHZlcnNpb25cblZpcnR1YWxUZXh0LnByb3RvdHlwZS50eXBlID0gXCJWaXJ0dWFsVGV4dFwiXG4iLCJ2YXIgaXNPYmplY3QgPSByZXF1aXJlKFwiaXMtb2JqZWN0XCIpXG52YXIgaXNIb29rID0gcmVxdWlyZShcIi4uL3Zub2RlL2lzLXZob29rXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gZGlmZlByb3BzXG5cbmZ1bmN0aW9uIGRpZmZQcm9wcyhhLCBiKSB7XG4gICAgdmFyIGRpZmZcblxuICAgIGZvciAodmFyIGFLZXkgaW4gYSkge1xuICAgICAgICBpZiAoIShhS2V5IGluIGIpKSB7XG4gICAgICAgICAgICBkaWZmID0gZGlmZiB8fCB7fVxuICAgICAgICAgICAgZGlmZlthS2V5XSA9IHVuZGVmaW5lZFxuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGFWYWx1ZSA9IGFbYUtleV1cbiAgICAgICAgdmFyIGJWYWx1ZSA9IGJbYUtleV1cblxuICAgICAgICBpZiAoYVZhbHVlID09PSBiVmFsdWUpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH0gZWxzZSBpZiAoaXNPYmplY3QoYVZhbHVlKSAmJiBpc09iamVjdChiVmFsdWUpKSB7XG4gICAgICAgICAgICBpZiAoZ2V0UHJvdG90eXBlKGJWYWx1ZSkgIT09IGdldFByb3RvdHlwZShhVmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgZGlmZiA9IGRpZmYgfHwge31cbiAgICAgICAgICAgICAgICBkaWZmW2FLZXldID0gYlZhbHVlXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGlzSG9vayhiVmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgIGRpZmYgPSBkaWZmIHx8IHt9XG4gICAgICAgICAgICAgICAgIGRpZmZbYUtleV0gPSBiVmFsdWVcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIG9iamVjdERpZmYgPSBkaWZmUHJvcHMoYVZhbHVlLCBiVmFsdWUpXG4gICAgICAgICAgICAgICAgaWYgKG9iamVjdERpZmYpIHtcbiAgICAgICAgICAgICAgICAgICAgZGlmZiA9IGRpZmYgfHwge31cbiAgICAgICAgICAgICAgICAgICAgZGlmZlthS2V5XSA9IG9iamVjdERpZmZcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkaWZmID0gZGlmZiB8fCB7fVxuICAgICAgICAgICAgZGlmZlthS2V5XSA9IGJWYWx1ZVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZm9yICh2YXIgYktleSBpbiBiKSB7XG4gICAgICAgIGlmICghKGJLZXkgaW4gYSkpIHtcbiAgICAgICAgICAgIGRpZmYgPSBkaWZmIHx8IHt9XG4gICAgICAgICAgICBkaWZmW2JLZXldID0gYltiS2V5XVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGRpZmZcbn1cblxuZnVuY3Rpb24gZ2V0UHJvdG90eXBlKHZhbHVlKSB7XG4gIGlmIChPYmplY3QuZ2V0UHJvdG90eXBlT2YpIHtcbiAgICByZXR1cm4gT2JqZWN0LmdldFByb3RvdHlwZU9mKHZhbHVlKVxuICB9IGVsc2UgaWYgKHZhbHVlLl9fcHJvdG9fXykge1xuICAgIHJldHVybiB2YWx1ZS5fX3Byb3RvX19cbiAgfSBlbHNlIGlmICh2YWx1ZS5jb25zdHJ1Y3Rvcikge1xuICAgIHJldHVybiB2YWx1ZS5jb25zdHJ1Y3Rvci5wcm90b3R5cGVcbiAgfVxufVxuIiwidmFyIGlzQXJyYXkgPSByZXF1aXJlKFwieC1pcy1hcnJheVwiKVxuXG52YXIgVlBhdGNoID0gcmVxdWlyZShcIi4uL3Zub2RlL3ZwYXRjaFwiKVxudmFyIGlzVk5vZGUgPSByZXF1aXJlKFwiLi4vdm5vZGUvaXMtdm5vZGVcIilcbnZhciBpc1ZUZXh0ID0gcmVxdWlyZShcIi4uL3Zub2RlL2lzLXZ0ZXh0XCIpXG52YXIgaXNXaWRnZXQgPSByZXF1aXJlKFwiLi4vdm5vZGUvaXMtd2lkZ2V0XCIpXG52YXIgaXNUaHVuayA9IHJlcXVpcmUoXCIuLi92bm9kZS9pcy10aHVua1wiKVxudmFyIGhhbmRsZVRodW5rID0gcmVxdWlyZShcIi4uL3Zub2RlL2hhbmRsZS10aHVua1wiKVxuXG52YXIgZGlmZlByb3BzID0gcmVxdWlyZShcIi4vZGlmZi1wcm9wc1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGRpZmZcblxuZnVuY3Rpb24gZGlmZihhLCBiKSB7XG4gICAgdmFyIHBhdGNoID0geyBhOiBhIH1cbiAgICB3YWxrKGEsIGIsIHBhdGNoLCAwKVxuICAgIHJldHVybiBwYXRjaFxufVxuXG5mdW5jdGlvbiB3YWxrKGEsIGIsIHBhdGNoLCBpbmRleCkge1xuICAgIGlmIChhID09PSBiKSB7XG4gICAgICAgIHJldHVyblxuICAgIH1cblxuICAgIHZhciBhcHBseSA9IHBhdGNoW2luZGV4XVxuICAgIHZhciBhcHBseUNsZWFyID0gZmFsc2VcblxuICAgIGlmIChpc1RodW5rKGEpIHx8IGlzVGh1bmsoYikpIHtcbiAgICAgICAgdGh1bmtzKGEsIGIsIHBhdGNoLCBpbmRleClcbiAgICB9IGVsc2UgaWYgKGIgPT0gbnVsbCkge1xuXG4gICAgICAgIC8vIElmIGEgaXMgYSB3aWRnZXQgd2Ugd2lsbCBhZGQgYSByZW1vdmUgcGF0Y2ggZm9yIGl0XG4gICAgICAgIC8vIE90aGVyd2lzZSBhbnkgY2hpbGQgd2lkZ2V0cy9ob29rcyBtdXN0IGJlIGRlc3Ryb3llZC5cbiAgICAgICAgLy8gVGhpcyBwcmV2ZW50cyBhZGRpbmcgdHdvIHJlbW92ZSBwYXRjaGVzIGZvciBhIHdpZGdldC5cbiAgICAgICAgaWYgKCFpc1dpZGdldChhKSkge1xuICAgICAgICAgICAgY2xlYXJTdGF0ZShhLCBwYXRjaCwgaW5kZXgpXG4gICAgICAgICAgICBhcHBseSA9IHBhdGNoW2luZGV4XVxuICAgICAgICB9XG5cbiAgICAgICAgYXBwbHkgPSBhcHBlbmRQYXRjaChhcHBseSwgbmV3IFZQYXRjaChWUGF0Y2guUkVNT1ZFLCBhLCBiKSlcbiAgICB9IGVsc2UgaWYgKGlzVk5vZGUoYikpIHtcbiAgICAgICAgaWYgKGlzVk5vZGUoYSkpIHtcbiAgICAgICAgICAgIGlmIChhLnRhZ05hbWUgPT09IGIudGFnTmFtZSAmJlxuICAgICAgICAgICAgICAgIGEubmFtZXNwYWNlID09PSBiLm5hbWVzcGFjZSAmJlxuICAgICAgICAgICAgICAgIGEua2V5ID09PSBiLmtleSkge1xuICAgICAgICAgICAgICAgIHZhciBwcm9wc1BhdGNoID0gZGlmZlByb3BzKGEucHJvcGVydGllcywgYi5wcm9wZXJ0aWVzKVxuICAgICAgICAgICAgICAgIGlmIChwcm9wc1BhdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgIGFwcGx5ID0gYXBwZW5kUGF0Y2goYXBwbHksXG4gICAgICAgICAgICAgICAgICAgICAgICBuZXcgVlBhdGNoKFZQYXRjaC5QUk9QUywgYSwgcHJvcHNQYXRjaCkpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGFwcGx5ID0gZGlmZkNoaWxkcmVuKGEsIGIsIHBhdGNoLCBhcHBseSwgaW5kZXgpXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGFwcGx5ID0gYXBwZW5kUGF0Y2goYXBwbHksIG5ldyBWUGF0Y2goVlBhdGNoLlZOT0RFLCBhLCBiKSlcbiAgICAgICAgICAgICAgICBhcHBseUNsZWFyID0gdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXBwbHkgPSBhcHBlbmRQYXRjaChhcHBseSwgbmV3IFZQYXRjaChWUGF0Y2guVk5PREUsIGEsIGIpKVxuICAgICAgICAgICAgYXBwbHlDbGVhciA9IHRydWVcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaXNWVGV4dChiKSkge1xuICAgICAgICBpZiAoIWlzVlRleHQoYSkpIHtcbiAgICAgICAgICAgIGFwcGx5ID0gYXBwZW5kUGF0Y2goYXBwbHksIG5ldyBWUGF0Y2goVlBhdGNoLlZURVhULCBhLCBiKSlcbiAgICAgICAgICAgIGFwcGx5Q2xlYXIgPSB0cnVlXG4gICAgICAgIH0gZWxzZSBpZiAoYS50ZXh0ICE9PSBiLnRleHQpIHtcbiAgICAgICAgICAgIGFwcGx5ID0gYXBwZW5kUGF0Y2goYXBwbHksIG5ldyBWUGF0Y2goVlBhdGNoLlZURVhULCBhLCBiKSlcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaXNXaWRnZXQoYikpIHtcbiAgICAgICAgaWYgKCFpc1dpZGdldChhKSkge1xuICAgICAgICAgICAgYXBwbHlDbGVhciA9IHRydWVcbiAgICAgICAgfVxuXG4gICAgICAgIGFwcGx5ID0gYXBwZW5kUGF0Y2goYXBwbHksIG5ldyBWUGF0Y2goVlBhdGNoLldJREdFVCwgYSwgYikpXG4gICAgfVxuXG4gICAgaWYgKGFwcGx5KSB7XG4gICAgICAgIHBhdGNoW2luZGV4XSA9IGFwcGx5XG4gICAgfVxuXG4gICAgaWYgKGFwcGx5Q2xlYXIpIHtcbiAgICAgICAgY2xlYXJTdGF0ZShhLCBwYXRjaCwgaW5kZXgpXG4gICAgfVxufVxuXG5mdW5jdGlvbiBkaWZmQ2hpbGRyZW4oYSwgYiwgcGF0Y2gsIGFwcGx5LCBpbmRleCkge1xuICAgIHZhciBhQ2hpbGRyZW4gPSBhLmNoaWxkcmVuXG4gICAgdmFyIG9yZGVyZWRTZXQgPSByZW9yZGVyKGFDaGlsZHJlbiwgYi5jaGlsZHJlbilcbiAgICB2YXIgYkNoaWxkcmVuID0gb3JkZXJlZFNldC5jaGlsZHJlblxuXG4gICAgdmFyIGFMZW4gPSBhQ2hpbGRyZW4ubGVuZ3RoXG4gICAgdmFyIGJMZW4gPSBiQ2hpbGRyZW4ubGVuZ3RoXG4gICAgdmFyIGxlbiA9IGFMZW4gPiBiTGVuID8gYUxlbiA6IGJMZW5cblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgdmFyIGxlZnROb2RlID0gYUNoaWxkcmVuW2ldXG4gICAgICAgIHZhciByaWdodE5vZGUgPSBiQ2hpbGRyZW5baV1cbiAgICAgICAgaW5kZXggKz0gMVxuXG4gICAgICAgIGlmICghbGVmdE5vZGUpIHtcbiAgICAgICAgICAgIGlmIChyaWdodE5vZGUpIHtcbiAgICAgICAgICAgICAgICAvLyBFeGNlc3Mgbm9kZXMgaW4gYiBuZWVkIHRvIGJlIGFkZGVkXG4gICAgICAgICAgICAgICAgYXBwbHkgPSBhcHBlbmRQYXRjaChhcHBseSxcbiAgICAgICAgICAgICAgICAgICAgbmV3IFZQYXRjaChWUGF0Y2guSU5TRVJULCBudWxsLCByaWdodE5vZGUpKVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgd2FsayhsZWZ0Tm9kZSwgcmlnaHROb2RlLCBwYXRjaCwgaW5kZXgpXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNWTm9kZShsZWZ0Tm9kZSkgJiYgbGVmdE5vZGUuY291bnQpIHtcbiAgICAgICAgICAgIGluZGV4ICs9IGxlZnROb2RlLmNvdW50XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAob3JkZXJlZFNldC5tb3Zlcykge1xuICAgICAgICAvLyBSZW9yZGVyIG5vZGVzIGxhc3RcbiAgICAgICAgYXBwbHkgPSBhcHBlbmRQYXRjaChhcHBseSwgbmV3IFZQYXRjaChcbiAgICAgICAgICAgIFZQYXRjaC5PUkRFUixcbiAgICAgICAgICAgIGEsXG4gICAgICAgICAgICBvcmRlcmVkU2V0Lm1vdmVzXG4gICAgICAgICkpXG4gICAgfVxuXG4gICAgcmV0dXJuIGFwcGx5XG59XG5cbmZ1bmN0aW9uIGNsZWFyU3RhdGUodk5vZGUsIHBhdGNoLCBpbmRleCkge1xuICAgIC8vIFRPRE86IE1ha2UgdGhpcyBhIHNpbmdsZSB3YWxrLCBub3QgdHdvXG4gICAgdW5ob29rKHZOb2RlLCBwYXRjaCwgaW5kZXgpXG4gICAgZGVzdHJveVdpZGdldHModk5vZGUsIHBhdGNoLCBpbmRleClcbn1cblxuLy8gUGF0Y2ggcmVjb3JkcyBmb3IgYWxsIGRlc3Ryb3llZCB3aWRnZXRzIG11c3QgYmUgYWRkZWQgYmVjYXVzZSB3ZSBuZWVkXG4vLyBhIERPTSBub2RlIHJlZmVyZW5jZSBmb3IgdGhlIGRlc3Ryb3kgZnVuY3Rpb25cbmZ1bmN0aW9uIGRlc3Ryb3lXaWRnZXRzKHZOb2RlLCBwYXRjaCwgaW5kZXgpIHtcbiAgICBpZiAoaXNXaWRnZXQodk5vZGUpKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygdk5vZGUuZGVzdHJveSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICBwYXRjaFtpbmRleF0gPSBhcHBlbmRQYXRjaChcbiAgICAgICAgICAgICAgICBwYXRjaFtpbmRleF0sXG4gICAgICAgICAgICAgICAgbmV3IFZQYXRjaChWUGF0Y2guUkVNT1ZFLCB2Tm9kZSwgbnVsbClcbiAgICAgICAgICAgIClcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaXNWTm9kZSh2Tm9kZSkgJiYgKHZOb2RlLmhhc1dpZGdldHMgfHwgdk5vZGUuaGFzVGh1bmtzKSkge1xuICAgICAgICB2YXIgY2hpbGRyZW4gPSB2Tm9kZS5jaGlsZHJlblxuICAgICAgICB2YXIgbGVuID0gY2hpbGRyZW4ubGVuZ3RoXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBjaGlsZCA9IGNoaWxkcmVuW2ldXG4gICAgICAgICAgICBpbmRleCArPSAxXG5cbiAgICAgICAgICAgIGRlc3Ryb3lXaWRnZXRzKGNoaWxkLCBwYXRjaCwgaW5kZXgpXG5cbiAgICAgICAgICAgIGlmIChpc1ZOb2RlKGNoaWxkKSAmJiBjaGlsZC5jb3VudCkge1xuICAgICAgICAgICAgICAgIGluZGV4ICs9IGNoaWxkLmNvdW50XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGlzVGh1bmsodk5vZGUpKSB7XG4gICAgICAgIHRodW5rcyh2Tm9kZSwgbnVsbCwgcGF0Y2gsIGluZGV4KVxuICAgIH1cbn1cblxuLy8gQ3JlYXRlIGEgc3ViLXBhdGNoIGZvciB0aHVua3NcbmZ1bmN0aW9uIHRodW5rcyhhLCBiLCBwYXRjaCwgaW5kZXgpIHtcbiAgICB2YXIgbm9kZXMgPSBoYW5kbGVUaHVuayhhLCBiKVxuICAgIHZhciB0aHVua1BhdGNoID0gZGlmZihub2Rlcy5hLCBub2Rlcy5iKVxuICAgIGlmIChoYXNQYXRjaGVzKHRodW5rUGF0Y2gpKSB7XG4gICAgICAgIHBhdGNoW2luZGV4XSA9IG5ldyBWUGF0Y2goVlBhdGNoLlRIVU5LLCBudWxsLCB0aHVua1BhdGNoKVxuICAgIH1cbn1cblxuZnVuY3Rpb24gaGFzUGF0Y2hlcyhwYXRjaCkge1xuICAgIGZvciAodmFyIGluZGV4IGluIHBhdGNoKSB7XG4gICAgICAgIGlmIChpbmRleCAhPT0gXCJhXCIpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2Vcbn1cblxuLy8gRXhlY3V0ZSBob29rcyB3aGVuIHR3byBub2RlcyBhcmUgaWRlbnRpY2FsXG5mdW5jdGlvbiB1bmhvb2sodk5vZGUsIHBhdGNoLCBpbmRleCkge1xuICAgIGlmIChpc1ZOb2RlKHZOb2RlKSkge1xuICAgICAgICBpZiAodk5vZGUuaG9va3MpIHtcbiAgICAgICAgICAgIHBhdGNoW2luZGV4XSA9IGFwcGVuZFBhdGNoKFxuICAgICAgICAgICAgICAgIHBhdGNoW2luZGV4XSxcbiAgICAgICAgICAgICAgICBuZXcgVlBhdGNoKFxuICAgICAgICAgICAgICAgICAgICBWUGF0Y2guUFJPUFMsXG4gICAgICAgICAgICAgICAgICAgIHZOb2RlLFxuICAgICAgICAgICAgICAgICAgICB1bmRlZmluZWRLZXlzKHZOb2RlLmhvb2tzKVxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgIClcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh2Tm9kZS5kZXNjZW5kYW50SG9va3MgfHwgdk5vZGUuaGFzVGh1bmtzKSB7XG4gICAgICAgICAgICB2YXIgY2hpbGRyZW4gPSB2Tm9kZS5jaGlsZHJlblxuICAgICAgICAgICAgdmFyIGxlbiA9IGNoaWxkcmVuLmxlbmd0aFxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBjaGlsZCA9IGNoaWxkcmVuW2ldXG4gICAgICAgICAgICAgICAgaW5kZXggKz0gMVxuXG4gICAgICAgICAgICAgICAgdW5ob29rKGNoaWxkLCBwYXRjaCwgaW5kZXgpXG5cbiAgICAgICAgICAgICAgICBpZiAoaXNWTm9kZShjaGlsZCkgJiYgY2hpbGQuY291bnQpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXggKz0gY2hpbGQuY291bnRcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGlzVGh1bmsodk5vZGUpKSB7XG4gICAgICAgIHRodW5rcyh2Tm9kZSwgbnVsbCwgcGF0Y2gsIGluZGV4KVxuICAgIH1cbn1cblxuZnVuY3Rpb24gdW5kZWZpbmVkS2V5cyhvYmopIHtcbiAgICB2YXIgcmVzdWx0ID0ge31cblxuICAgIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICAgICAgcmVzdWx0W2tleV0gPSB1bmRlZmluZWRcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0XG59XG5cbi8vIExpc3QgZGlmZiwgbmFpdmUgbGVmdCB0byByaWdodCByZW9yZGVyaW5nXG5mdW5jdGlvbiByZW9yZGVyKGFDaGlsZHJlbiwgYkNoaWxkcmVuKSB7XG4gICAgLy8gTyhNKSB0aW1lLCBPKE0pIG1lbW9yeVxuICAgIHZhciBiQ2hpbGRJbmRleCA9IGtleUluZGV4KGJDaGlsZHJlbilcbiAgICB2YXIgYktleXMgPSBiQ2hpbGRJbmRleC5rZXlzXG4gICAgdmFyIGJGcmVlID0gYkNoaWxkSW5kZXguZnJlZVxuXG4gICAgaWYgKGJGcmVlLmxlbmd0aCA9PT0gYkNoaWxkcmVuLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY2hpbGRyZW46IGJDaGlsZHJlbixcbiAgICAgICAgICAgIG1vdmVzOiBudWxsXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBPKE4pIHRpbWUsIE8oTikgbWVtb3J5XG4gICAgdmFyIGFDaGlsZEluZGV4ID0ga2V5SW5kZXgoYUNoaWxkcmVuKVxuICAgIHZhciBhS2V5cyA9IGFDaGlsZEluZGV4LmtleXNcbiAgICB2YXIgYUZyZWUgPSBhQ2hpbGRJbmRleC5mcmVlXG5cbiAgICBpZiAoYUZyZWUubGVuZ3RoID09PSBhQ2hpbGRyZW4ubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBjaGlsZHJlbjogYkNoaWxkcmVuLFxuICAgICAgICAgICAgbW92ZXM6IG51bGxcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIE8oTUFYKE4sIE0pKSBtZW1vcnlcbiAgICB2YXIgbmV3Q2hpbGRyZW4gPSBbXVxuXG4gICAgdmFyIGZyZWVJbmRleCA9IDBcbiAgICB2YXIgZnJlZUNvdW50ID0gYkZyZWUubGVuZ3RoXG4gICAgdmFyIGRlbGV0ZWRJdGVtcyA9IDBcblxuICAgIC8vIEl0ZXJhdGUgdGhyb3VnaCBhIGFuZCBtYXRjaCBhIG5vZGUgaW4gYlxuICAgIC8vIE8oTikgdGltZSxcbiAgICBmb3IgKHZhciBpID0gMCA7IGkgPCBhQ2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGFJdGVtID0gYUNoaWxkcmVuW2ldXG4gICAgICAgIHZhciBpdGVtSW5kZXhcblxuICAgICAgICBpZiAoYUl0ZW0ua2V5KSB7XG4gICAgICAgICAgICBpZiAoYktleXMuaGFzT3duUHJvcGVydHkoYUl0ZW0ua2V5KSkge1xuICAgICAgICAgICAgICAgIC8vIE1hdGNoIHVwIHRoZSBvbGQga2V5c1xuICAgICAgICAgICAgICAgIGl0ZW1JbmRleCA9IGJLZXlzW2FJdGVtLmtleV1cbiAgICAgICAgICAgICAgICBuZXdDaGlsZHJlbi5wdXNoKGJDaGlsZHJlbltpdGVtSW5kZXhdKVxuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIFJlbW92ZSBvbGQga2V5ZWQgaXRlbXNcbiAgICAgICAgICAgICAgICBpdGVtSW5kZXggPSBpIC0gZGVsZXRlZEl0ZW1zKytcbiAgICAgICAgICAgICAgICBuZXdDaGlsZHJlbi5wdXNoKG51bGwpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBNYXRjaCB0aGUgaXRlbSBpbiBhIHdpdGggdGhlIG5leHQgZnJlZSBpdGVtIGluIGJcbiAgICAgICAgICAgIGlmIChmcmVlSW5kZXggPCBmcmVlQ291bnQpIHtcbiAgICAgICAgICAgICAgICBpdGVtSW5kZXggPSBiRnJlZVtmcmVlSW5kZXgrK11cbiAgICAgICAgICAgICAgICBuZXdDaGlsZHJlbi5wdXNoKGJDaGlsZHJlbltpdGVtSW5kZXhdKVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBUaGVyZSBhcmUgbm8gZnJlZSBpdGVtcyBpbiBiIHRvIG1hdGNoIHdpdGhcbiAgICAgICAgICAgICAgICAvLyB0aGUgZnJlZSBpdGVtcyBpbiBhLCBzbyB0aGUgZXh0cmEgZnJlZSBub2Rlc1xuICAgICAgICAgICAgICAgIC8vIGFyZSBkZWxldGVkLlxuICAgICAgICAgICAgICAgIGl0ZW1JbmRleCA9IGkgLSBkZWxldGVkSXRlbXMrK1xuICAgICAgICAgICAgICAgIG5ld0NoaWxkcmVuLnB1c2gobnVsbClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHZhciBsYXN0RnJlZUluZGV4ID0gZnJlZUluZGV4ID49IGJGcmVlLmxlbmd0aCA/XG4gICAgICAgIGJDaGlsZHJlbi5sZW5ndGggOlxuICAgICAgICBiRnJlZVtmcmVlSW5kZXhdXG5cbiAgICAvLyBJdGVyYXRlIHRocm91Z2ggYiBhbmQgYXBwZW5kIGFueSBuZXcga2V5c1xuICAgIC8vIE8oTSkgdGltZVxuICAgIGZvciAodmFyIGogPSAwOyBqIDwgYkNoaWxkcmVuLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIHZhciBuZXdJdGVtID0gYkNoaWxkcmVuW2pdXG5cbiAgICAgICAgaWYgKG5ld0l0ZW0ua2V5KSB7XG4gICAgICAgICAgICBpZiAoIWFLZXlzLmhhc093blByb3BlcnR5KG5ld0l0ZW0ua2V5KSkge1xuICAgICAgICAgICAgICAgIC8vIEFkZCBhbnkgbmV3IGtleWVkIGl0ZW1zXG4gICAgICAgICAgICAgICAgLy8gV2UgYXJlIGFkZGluZyBuZXcgaXRlbXMgdG8gdGhlIGVuZCBhbmQgdGhlbiBzb3J0aW5nIHRoZW1cbiAgICAgICAgICAgICAgICAvLyBpbiBwbGFjZS4gSW4gZnV0dXJlIHdlIHNob3VsZCBpbnNlcnQgbmV3IGl0ZW1zIGluIHBsYWNlLlxuICAgICAgICAgICAgICAgIG5ld0NoaWxkcmVuLnB1c2gobmV3SXRlbSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChqID49IGxhc3RGcmVlSW5kZXgpIHtcbiAgICAgICAgICAgIC8vIEFkZCBhbnkgbGVmdG92ZXIgbm9uLWtleWVkIGl0ZW1zXG4gICAgICAgICAgICBuZXdDaGlsZHJlbi5wdXNoKG5ld0l0ZW0pXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgc2ltdWxhdGUgPSBuZXdDaGlsZHJlbi5zbGljZSgpXG4gICAgdmFyIHNpbXVsYXRlSW5kZXggPSAwXG4gICAgdmFyIHJlbW92ZXMgPSBbXVxuICAgIHZhciBpbnNlcnRzID0gW11cbiAgICB2YXIgc2ltdWxhdGVJdGVtXG5cbiAgICBmb3IgKHZhciBrID0gMDsgayA8IGJDaGlsZHJlbi5sZW5ndGg7KSB7XG4gICAgICAgIHZhciB3YW50ZWRJdGVtID0gYkNoaWxkcmVuW2tdXG4gICAgICAgIHNpbXVsYXRlSXRlbSA9IHNpbXVsYXRlW3NpbXVsYXRlSW5kZXhdXG5cbiAgICAgICAgLy8gcmVtb3ZlIGl0ZW1zXG4gICAgICAgIHdoaWxlIChzaW11bGF0ZUl0ZW0gPT09IG51bGwgJiYgc2ltdWxhdGUubGVuZ3RoKSB7XG4gICAgICAgICAgICByZW1vdmVzLnB1c2gocmVtb3ZlKHNpbXVsYXRlLCBzaW11bGF0ZUluZGV4LCBudWxsKSlcbiAgICAgICAgICAgIHNpbXVsYXRlSXRlbSA9IHNpbXVsYXRlW3NpbXVsYXRlSW5kZXhdXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXNpbXVsYXRlSXRlbSB8fCBzaW11bGF0ZUl0ZW0ua2V5ICE9PSB3YW50ZWRJdGVtLmtleSkge1xuICAgICAgICAgICAgLy8gaWYgd2UgbmVlZCBhIGtleSBpbiB0aGlzIHBvc2l0aW9uLi4uXG4gICAgICAgICAgICBpZiAod2FudGVkSXRlbS5rZXkpIHtcbiAgICAgICAgICAgICAgICBpZiAoc2ltdWxhdGVJdGVtICYmIHNpbXVsYXRlSXRlbS5rZXkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gaWYgYW4gaW5zZXJ0IGRvZXNuJ3QgcHV0IHRoaXMga2V5IGluIHBsYWNlLCBpdCBuZWVkcyB0byBtb3ZlXG4gICAgICAgICAgICAgICAgICAgIGlmIChiS2V5c1tzaW11bGF0ZUl0ZW0ua2V5XSAhPT0gayArIDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZXMucHVzaChyZW1vdmUoc2ltdWxhdGUsIHNpbXVsYXRlSW5kZXgsIHNpbXVsYXRlSXRlbS5rZXkpKVxuICAgICAgICAgICAgICAgICAgICAgICAgc2ltdWxhdGVJdGVtID0gc2ltdWxhdGVbc2ltdWxhdGVJbmRleF1cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlmIHRoZSByZW1vdmUgZGlkbid0IHB1dCB0aGUgd2FudGVkIGl0ZW0gaW4gcGxhY2UsIHdlIG5lZWQgdG8gaW5zZXJ0IGl0XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXNpbXVsYXRlSXRlbSB8fCBzaW11bGF0ZUl0ZW0ua2V5ICE9PSB3YW50ZWRJdGVtLmtleSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluc2VydHMucHVzaCh7a2V5OiB3YW50ZWRJdGVtLmtleSwgdG86IGt9KVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gaXRlbXMgYXJlIG1hdGNoaW5nLCBzbyBza2lwIGFoZWFkXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaW11bGF0ZUluZGV4KytcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluc2VydHMucHVzaCh7a2V5OiB3YW50ZWRJdGVtLmtleSwgdG86IGt9KVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpbnNlcnRzLnB1c2goe2tleTogd2FudGVkSXRlbS5rZXksIHRvOiBrfSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaysrXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBhIGtleSBpbiBzaW11bGF0ZSBoYXMgbm8gbWF0Y2hpbmcgd2FudGVkIGtleSwgcmVtb3ZlIGl0XG4gICAgICAgICAgICBlbHNlIGlmIChzaW11bGF0ZUl0ZW0gJiYgc2ltdWxhdGVJdGVtLmtleSkge1xuICAgICAgICAgICAgICAgIHJlbW92ZXMucHVzaChyZW1vdmUoc2ltdWxhdGUsIHNpbXVsYXRlSW5kZXgsIHNpbXVsYXRlSXRlbS5rZXkpKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgc2ltdWxhdGVJbmRleCsrXG4gICAgICAgICAgICBrKytcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHJlbW92ZSBhbGwgdGhlIHJlbWFpbmluZyBub2RlcyBmcm9tIHNpbXVsYXRlXG4gICAgd2hpbGUoc2ltdWxhdGVJbmRleCA8IHNpbXVsYXRlLmxlbmd0aCkge1xuICAgICAgICBzaW11bGF0ZUl0ZW0gPSBzaW11bGF0ZVtzaW11bGF0ZUluZGV4XVxuICAgICAgICByZW1vdmVzLnB1c2gocmVtb3ZlKHNpbXVsYXRlLCBzaW11bGF0ZUluZGV4LCBzaW11bGF0ZUl0ZW0gJiYgc2ltdWxhdGVJdGVtLmtleSkpXG4gICAgfVxuXG4gICAgLy8gSWYgdGhlIG9ubHkgbW92ZXMgd2UgaGF2ZSBhcmUgZGVsZXRlcyB0aGVuIHdlIGNhbiBqdXN0XG4gICAgLy8gbGV0IHRoZSBkZWxldGUgcGF0Y2ggcmVtb3ZlIHRoZXNlIGl0ZW1zLlxuICAgIGlmIChyZW1vdmVzLmxlbmd0aCA9PT0gZGVsZXRlZEl0ZW1zICYmICFpbnNlcnRzLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY2hpbGRyZW46IG5ld0NoaWxkcmVuLFxuICAgICAgICAgICAgbW92ZXM6IG51bGxcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIGNoaWxkcmVuOiBuZXdDaGlsZHJlbixcbiAgICAgICAgbW92ZXM6IHtcbiAgICAgICAgICAgIHJlbW92ZXM6IHJlbW92ZXMsXG4gICAgICAgICAgICBpbnNlcnRzOiBpbnNlcnRzXG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlbW92ZShhcnIsIGluZGV4LCBrZXkpIHtcbiAgICBhcnIuc3BsaWNlKGluZGV4LCAxKVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgZnJvbTogaW5kZXgsXG4gICAgICAgIGtleToga2V5XG4gICAgfVxufVxuXG5mdW5jdGlvbiBrZXlJbmRleChjaGlsZHJlbikge1xuICAgIHZhciBrZXlzID0ge31cbiAgICB2YXIgZnJlZSA9IFtdXG4gICAgdmFyIGxlbmd0aCA9IGNoaWxkcmVuLmxlbmd0aFxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgY2hpbGQgPSBjaGlsZHJlbltpXVxuXG4gICAgICAgIGlmIChjaGlsZC5rZXkpIHtcbiAgICAgICAgICAgIGtleXNbY2hpbGQua2V5XSA9IGlcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZyZWUucHVzaChpKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAga2V5czoga2V5cywgICAgIC8vIEEgaGFzaCBvZiBrZXkgbmFtZSB0byBpbmRleFxuICAgICAgICBmcmVlOiBmcmVlICAgICAgLy8gQW4gYXJyYXkgb2YgdW5rZXllZCBpdGVtIGluZGljZXNcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGFwcGVuZFBhdGNoKGFwcGx5LCBwYXRjaCkge1xuICAgIGlmIChhcHBseSkge1xuICAgICAgICBpZiAoaXNBcnJheShhcHBseSkpIHtcbiAgICAgICAgICAgIGFwcGx5LnB1c2gocGF0Y2gpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhcHBseSA9IFthcHBseSwgcGF0Y2hdXG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYXBwbHlcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gcGF0Y2hcbiAgICB9XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyB0aGUgYm91bmQgd3JhcHBlciBmdW5jdGlvblxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiA8cHJlPjxjb2RlPlxuICAgICAqIHZhciBhZGQgPSBmdW5jdGlvbiAoYSwgYikge1xuICAgICAqICAgICByZXR1cm4gYSArIGI7XG4gICAgICogfTtcbiAgICAgKlxuICAgICAqIHZhciBzdWIgPSBmdW5jdGlvbiAoYSwgYikge1xuICAgICAqICAgICByZXR1cm4gYSAtIGI7XG4gICAgICogfTtcbiAgICAgKlxuICAgICAqIHZhciBhZGRPbmUgPSBkZWxpZ2FyZShhZGQsIFsxXSk7XG4gICAgICogdmFyIHN1YlR3byA9IGRlbGlnYXJlKHN1YiwgW3VuZGVmaW5lZCwgMl0pO1xuICAgICAqXG4gICAgICogYWRkT25lKDUpOyAvLyAtPiA2IChlcXVpdmFsZW50IHRvIFwiYWRkKDEsIDUpXCIpXG4gICAgICogc3ViVHdvKDUpOyAvLyAtPiAzIChlcXVpdmFsZW50IHRvIFwic3ViKDUsIDIpXCIpXG4gICAgICogPC9jb2RlPjwvcHJlPlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gZm4gUmVxdWlyZWQuIFRoZSBvcmlnaW5hbCBmdW5jdGlvblxuICAgICAqIEBwYXJhbSB7QXJyYXl9IGRlbGVnYXRlVmFsdWVzIFJlcXVpcmVkLiBUaGUgbGlzdCBvZiBwYXJhbWV0ZXIgdmFsdWVzIHdoaWNoXG4gICAgICogICAgICBzaG91bGQgYmUgYm91bmQgdG8gdGhlIG5ldyBmdW5jdGlvbi4gSXQgaXMgcG9zc2libGUgdG8gc2tpcCBwYXJhbWV0ZXJcbiAgICAgKiAgICAgIHdoZW4gcGFzc2luZyBcInVuZGVmaW5lZFwiIChlLmcuIGRlbGlnYXJlKGZuLCBbdW5kZWZpbmVkLCAnZm9vJ10pXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtzY29wZV0gT3B0aW9uYWwuIFRoZSBleGVjdXRpb24gY29udGV4dCBmb3IgdGhlIGJvdW5kIHdyYXBwZXJcbiAgICAgKlxuICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufSBUaGUgYm91bmQgd3JhcHBlciBmdW5jdGlvblxuICAgICAqL1xuICAgIHJldHVybiBmdW5jdGlvbiBkZWxpZ2FyZSAoZm4sIGRlbGVnYXRlVmFsdWVzLCBzY29wZSkge1xuICAgICAgICBpZiAodHlwZW9mIGZuICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICB0aHJvdyAnSW52YWxpZCAxc3QgYXJndW1lbnQ6IFwiJyArIHR5cGVvZiBmbiArICdcIiwgZnVuY3Rpb24gZXhwZWN0ZWQhJztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShkZWxlZ2F0ZVZhbHVlcykpIHtcbiAgICAgICAgICAgIHRocm93ICdJbnZhbGlkIDJuZCBhcmd1bWVudDogXCInICsgdHlwZW9mIGRlbGVnYXRlVmFsdWVzICsgJ1wiLCBhcnJheSBleHBlY3RlZCEnO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGFyaXR5ID0gZm4uYXJpdHkgPj0gMCA/IGZuLmFyaXR5IDogZm4ubGVuZ3RoO1xuICAgICAgICB2YXIgbWFwID0gW107XG4gICAgICAgIHZhciBpZHggPSAwO1xuXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gYXJpdHk7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgIHZhciB2YWwgPSBkZWxlZ2F0ZVZhbHVlc1tpXTtcblxuICAgICAgICAgICAgaWYgKHZhbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgbWFwW2ldID0gaWR4Kys7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgd3JhcHBlciA9IGZ1bmN0aW9uIGRlbGVnYXJlV3JhcHBlcigpIHtcbiAgICAgICAgICAgIHZhciBhcmdzID0gW107XG5cbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gYXJpdHk7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgdmFsID0gZGVsZWdhdGVWYWx1ZXNbaV07XG5cbiAgICAgICAgICAgICAgICBpZiAodmFsID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgYXJnc1tpXSA9IGFyZ3VtZW50c1ttYXBbaV1dO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGFyZ3NbaV0gPSB2YWw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZm4uYXBwbHkoc2NvcGUgfHwgdGhpcywgYXJncyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgd3JhcHBlci5hcml0eSA9IGFyaXR5O1xuXG4gICAgICAgIHJldHVybiB3cmFwcGVyO1xuICAgIH07XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBlYWNoID0gcmVxdWlyZSgncHJvLXNpbmd1bGlzJyk7XG4gICAgdmFyIGRlbGVnYXRlID0gcmVxdWlyZSgnZGVsaWdhcmUnKTtcblxuICAgIC8qKlxuICAgICAqIEBjbGFzcyBGb3JtdWxhXG4gICAgICovXG4gICAgdmFyIEZvcm11bGEgPSBmdW5jdGlvbiAoY2ZnKSB7XG4gICAgICAgIHZhciBvcmdDdG9yID0gY2ZnLmJhc2UuY29uc3RydWN0b3I7XG4gICAgICAgIHZhciBpbml0ID0gZGVsZWdhdGUoZWFjaCwgW2NmZy5vbkJyZXdTY3JpcHRzLCBjYWxsRm5dKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQSBsaXN0IG9mIGNhbGxiYWNrIGZ1bmN0aW9ucyB3aGljaCBzaG91bGQgYmUgY2FsbGVkXG4gICAgICAgICAqIHdoZW4gYnJld2luZyBhIG5ldyBwb3Rpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQG5hbWUgb25CcmV3U2NyaXB0c1xuICAgICAgICAgKiBAbWVtYmVyT2YgRm9ybXVsYVxuICAgICAgICAgKiBAdHlwZSBBcnJheVxuICAgICAgICAgKiBAcHJvcGVydHlcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMub25CcmV3U2NyaXB0cyA9IGNmZy5vbkJyZXdTY3JpcHRzO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBIGxpc3Qgb2YgY2FsbGJhY2sgZnVuY3Rpb25zIHdoaWNoIHNob3VsZCBiZSBjYWxsZWRcbiAgICAgICAgICogd2hlbiBkaXNwb3NpbmcgdGhlIHBvdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBAbmFtZSBvbkRpc3Bvc2VTY3JpcHRzXG4gICAgICAgICAqIEBtZW1iZXJPZiBGb3JtdWxhXG4gICAgICAgICAqIEB0eXBlIEFycmF5XG4gICAgICAgICAqIEBwcm9wZXJ0eVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5vbkRpc3Bvc2VTY3JpcHRzID0gY2ZnLm9uRGlzcG9zZVNjcmlwdHM7XG5cbiAgICAgICAgdGhpcy5DdG9yID0gZnVuY3Rpb24gKGFyZ3MpIHtcbiAgICAgICAgICAgIG9yZ0N0b3IuYXBwbHkodGhpcywgYXJncyk7XG4gICAgICAgICAgICBpbml0KHRoaXMpO1xuICAgICAgICB9O1xuICAgICAgICB0aGlzLkN0b3IucHJvdG90eXBlID0gY2ZnLmJhc2U7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBuZXcgaW5zdGFuY2Ugb2YgdGhlIGZvcm11bGEncyBwcm90b3R5cGVcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBbb3ZlcnJpZGVzXSBPcHRpb25hbC4gQSBzZXQgb2YgcHJvcGVydGllcy9vdmVycmlkZXNcbiAgICAgKiAgICAgIGZvciB0aGUgbmV3IGluc3RhbmNlXG4gICAgICogQHBhcmFtIHtBcnJheX0gW2FyZ3NdIE9wdGlvbmFsLiBBbiBhcnJheSB3aXRoIGNvbnN0cnVjdG9yIGFyZ3VtZW50c1xuICAgICAqIEByZXR1cm4ge09iamVjdH0gVGhlIHBvdGlvbiAoaS5lLiB0aGUgbmV3IGluc3RhbmNlIG9mIHRoZSBmb3JtdWxhJ3MgcHJvdG90eXBlKVxuICAgICAqL1xuICAgIEZvcm11bGEucHJvdG90eXBlLmJyZXcgPSBmdW5jdGlvbiBicmV3KG92ZXJyaWRlcywgYXJncykge1xuICAgICAgICB2YXIgcG90aW9uID0gbmV3IHRoaXMuQ3RvcihhcmdzKTtcbiAgICAgICAgdmFyIGZvcmVpZ25Qcm9wcyA9IE9iamVjdC5rZXlzKG92ZXJyaWRlcyB8fCB7fSk7XG4gICAgICAgIHZhciBvbkRpc3Bvc2UgPSBkZWxlZ2F0ZShlYWNoLCBbdGhpcy5vbkRpc3Bvc2VTY3JpcHRzLCBjYWxsRm5dKTtcblxuICAgICAgICBpZiAodHlwZW9mIG92ZXJyaWRlcyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgb3ZlcnJpZGVzID0gb3ZlcnJpZGVzKHRoaXMuQ3Rvci5wcm90b3R5cGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcG90aW9uLmRpc3Bvc2UgPSBjcmVhdGVEaXNwb3NlRm4oZm9yZWlnblByb3BzLCBvbkRpc3Bvc2UpO1xuICAgICAgICBwb3Rpb24gPSBvdmVycmlkZShwb3Rpb24sIG92ZXJyaWRlcyk7XG5cbiAgICAgICAgcmV0dXJuIHBvdGlvbjtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQWRkcyBhIGNhbGxiYWNrIGZ1bmN0aW9ucyB3aGljaCBzaG91bGQgYmUgY2FsbGVkXG4gICAgICogd2hlbiBicmV3aW5nIGEgbmV3IHBvdGlvbi4gVGhlIGZ1bmN0aW9uIGlzIGV4ZWN1dGVkXG4gICAgICogaW4gdGhlIGNvbnRleHQgb2YgdGhlIG5ldyBvYmplY3RcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBmbiBUaGUgY2FsbGJhY2sgZnVuY3Rpb25cbiAgICAgKiBAcmV0dXJuIHtGb3JtdWxhfSBUaGUgbmV3IGZvcm11bGFcbiAgICAgKi9cbiAgICBGb3JtdWxhLnByb3RvdHlwZS53aGVuQnJld2VkID0gZnVuY3Rpb24gd2hlbkJyZXdlZChmbikge1xuICAgICAgICByZXR1cm4gbmV3IEZvcm11bGEoe1xuICAgICAgICAgICAgYmFzZTogdGhpcy5DdG9yLnByb3RvdHlwZSxcbiAgICAgICAgICAgIG9uQnJld1NjcmlwdHM6IHRoaXMub25CcmV3U2NyaXB0cy5jb25jYXQoZm4pLFxuICAgICAgICAgICAgb25EaXNwb3NlU2NyaXB0czogdGhpcy5vbkRpc3Bvc2VTY3JpcHRzLFxuICAgICAgICB9KTtcbiAgICB9O1xuXG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgY2FsbGJhY2sgZnVuY3Rpb25zIHdoaWNoIHNob3VsZCBiZSBjYWxsZWRcbiAgICAgKiB3aGVuIHdoZW4gZGlzcG9zaW5nIHRoZSBwb3Rpb24uIFRoZSBmdW5jdGlvbiBpc1xuICAgICAqIGV4ZWN1dGVkIGluIHRoZSBjb250ZXh0IG9mIHRoZSBkaXNwb3NlZCBvYmplY3RcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBmbiBUaGUgY2FsbGJhY2sgZnVuY3Rpb25cbiAgICAgKiBAcmV0dXJuIHtGb3JtdWxhfSBUaGUgbmV3IGZvcm11bGFcbiAgICAgKi9cbiAgICBGb3JtdWxhLnByb3RvdHlwZS53aGVuRGlzcG9zZWQgPSBmdW5jdGlvbiB3aGVuRGlzcG9zZWQoZm4pIHtcbiAgICAgICAgcmV0dXJuIG5ldyBGb3JtdWxhKHtcbiAgICAgICAgICAgIGJhc2U6IHRoaXMuQ3Rvci5wcm90b3R5cGUsXG4gICAgICAgICAgICBvbkJyZXdTY3JpcHRzOiB0aGlzLm9uQnJld1NjcmlwdHMsXG4gICAgICAgICAgICBvbkRpc3Bvc2VTY3JpcHRzOiB0aGlzLm9uRGlzcG9zZVNjcmlwdHMuY29uY2F0KGZuKSxcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEFsbG93cyBvdmVycmlkaW5nIG1ldGhvZHMgYW5kIHByb3BlcnRpZXMgb2YgYW4gY3VycmVudCBiYXNlIG9iamVjdC5cbiAgICAgKiBGb3IgZXhhbXBsZTpcbiAgICAgKiA8cHJlPjxjb2RlPlxuICAgICAqIHZhciBuZXdGb3JtdWxhID0gZm9ybXVsYS5leHRlbmQoe1xuICAgICAqICAgZm9vOiBmdW5jdGlvbiAoKSB7IC4uLiB9LFxuICAgICAqICAgLi4uXG4gICAgICogfSk7XG4gICAgICogPC9jb2RlPjwvcHJlPlxuICAgICAqIEBmdW5jdGlvblxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG92ZXJyaWRlcyBUaGUgc2V0IG9mIG5ldyBtZXRob2RzIGFuZCBhdHRyaWJ1dGVzXG4gICAgICogQHJldHVybiB7Rm9ybXVsYX0gVGhlIG5ldyBhbmQgZXh0ZW5kZWQgcG90aW9uIGZvcm11bGFcbiAgICAgKi9cbiAgICBGb3JtdWxhLnByb3RvdHlwZS5leHRlbmQgPSBmdW5jdGlvbiAob3ZlcnJpZGVzKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygb3ZlcnJpZGVzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBvdmVycmlkZXMgPSBvdmVycmlkZXModGhpcy5DdG9yLnByb3RvdHlwZSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbmV3IEZvcm11bGEoe1xuICAgICAgICAgICAgYmFzZTogb3ZlcnJpZGUoT2JqZWN0LmNyZWF0ZSh0aGlzLkN0b3IucHJvdG90eXBlKSwgb3ZlcnJpZGVzKSxcbiAgICAgICAgICAgIG9uQnJld1NjcmlwdHM6IHRoaXMub25CcmV3U2NyaXB0cyxcbiAgICAgICAgICAgIG9uRGlzcG9zZVNjcmlwdHM6IHRoaXMub25EaXNwb3NlU2NyaXB0cyxcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuICAgIC8vIFBSSVZBVEUgSEVMUEVSXG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBmdW5jdGlvbiBvdmVycmlkZShiYXNlLCBvdmVycmlkZXMpIHtcbiAgICAgICAgZWFjaChvdmVycmlkZXMsIGZ1bmN0aW9uIChwcm9wLCBrZXkpIHtcbiAgICAgICAgICAgIGJhc2Vba2V5XSA9IHByb3A7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBiYXNlO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIGZ1bmN0aW9uIGNhbGxGbihmbikge1xuICAgICAgICAvKiBqc2hpbnQgdmFsaWR0aGlzOiB0cnVlICovXG4gICAgICAgIGZuLmNhbGwodGhpcyk7XG4gICAgICAgIC8qIGpzaGludCB2YWxpZHRoaXM6IGZhbHNlICovXG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgZnVuY3Rpb24gY3JlYXRlRGlzcG9zZUZuKGZvcmVpZ25Qcm9wcywgb25EaXNwb3NlKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiBkaXNwb3NlKCkge1xuICAgICAgICAgICAgb25EaXNwb3NlKHRoaXMpO1xuXG4gICAgICAgICAgICBlYWNoKGZvcmVpZ25Qcm9wcywgZnVuY3Rpb24gKHByb3ApIHtcbiAgICAgICAgICAgICAgICB0aGlzW3Byb3BdID0gbnVsbDtcbiAgICAgICAgICAgIH0sIHRoaXMpO1xuXG4gICAgICAgICAgICBmb3IgKHZhciBrZXkgaW4gdGhpcykge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzW2tleV0gJiYgdHlwZW9mIHRoaXNba2V5XSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzW2tleV0uZGlzcG9zZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpc1trZXldLmRpc3Bvc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHRoaXNba2V5XSA9IG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFdyYXBzIHRoZSBnaXZlIHZhbHVlIGluIGEgcG90aW9uIGZvcm11bGEgdG8gYWxsb3cgZnVydGhlciBtYWdpY1xuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGJhc2UgVGhlIG9yaWdpbmFsIGJhc2ljIHByb3RvdHlwZVxuICAgICAqIEByZXR1cm4ge0Zvcm11bGF9IHRoZSB3cmFwcGVyIGZvcm11bGFcbiAgICAgKi9cbiAgICByZXR1cm4gZnVuY3Rpb24gY29xdW9WZW5lbnVtKGJhc2UpIHtcbiAgICAgICAgaWYgKGJhc2UgPT09IG51bGwgfHwgdHlwZW9mIGJhc2UgIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICB0aHJvdyAnQmFzZSBoYXN0IGJlIGFuIG9iamVjdCwgXCInICsgYmFzZSArICdcIiBnaXZlbic7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbmV3IEZvcm11bGEoe1xuICAgICAgICAgICAgYmFzZTogT2JqZWN0LmNyZWF0ZShiYXNlKSxcbiAgICAgICAgICAgIG9uQnJld1NjcmlwdHM6IFtdLFxuICAgICAgICAgICAgb25EaXNwb3NlU2NyaXB0czogW10sXG4gICAgICAgIH0pO1xuICAgIH07XG59KCkpO1xuIixudWxsLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIHV1aWQgPSAnNTJiZTUzOTUtYTE4Mi00NmRkLWI1MTgtMDkxYTFjNDc2YTYzJztcbiAgICB2YXIgZWFjaCA9IHJlcXVpcmUoJ3Byby1zaW5ndWxpcycpO1xuXG4gICAgLyoqXG4gICAgICogSGVscGVyIHRvIGRldGVybWluZSBpZiBhIGdpdmVuIG9iamVjdCBpcyBhbiBpbW11dGFibGVcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGlzSW1tdXRhYmxlKG9iaikge1xuICAgICAgICByZXR1cm4gb2JqICYmIChvYmoudHlwZUlkID09PSB1dWlkKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpc09iamVjdChvKSB7XG4gICAgICAgIHJldHVybiBvICYmICh0eXBlb2YgbyA9PT0gJ29iamVjdCcpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGlzQXJyYXkoYSkge1xuICAgICAgICByZXR1cm4gQXJyYXkuaXNBcnJheShhKTtcbiAgICB9XG5cblxuICAgIGZ1bmN0aW9uIGNvcHlUbyAoYmFzZSwgbmV4dCkge1xuICAgICAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKG5leHQpO1xuXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0ga2V5cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBrZXkgPSBrZXlzW2ldO1xuICAgICAgICAgICAgYmFzZVtrZXldID0gbmV4dFtrZXldO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGJhc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSGVscGVyIHRvIGNyZWF0ZSBhbiBpbW11dGFibGUgZGF0YSBvYmplY3QgZGVwZW5kaW5nIG9uIHRoZSB0eXBlIG9mIHRoZSBpbnB1dFxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgZnVuY3Rpb24gY3JlYXRlU3ViKHZhbHVlLCBjb21wdXRlZCkge1xuICAgICAgICBpZiAoaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgTGlzdCh2YWx1ZSwgY29tcHV0ZWQpO1xuICAgICAgICB9IGVsc2UgaWYgKGlzT2JqZWN0KHZhbHVlKSkge1xuICAgICAgICAgICAgaWYgKGlzSW1tdXRhYmxlKHZhbHVlKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodmFsdWUuY29uc3RydWN0b3IgPT09IE9iamVjdCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgU3RydWN0KHZhbHVlLCBjb21wdXRlZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbmV3IFZhbHVlKHZhbHVlLCBjb21wdXRlZCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ldyBWYWx1ZSh2YWx1ZSwgY29tcHV0ZWQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBhYnN0cmFjdCBiYXNlIGNsYXNzIGZvciBpbW11dGFibGUgdmFsdWVzXG4gICAgICpcbiAgICAgKiBAY2xhc3MgQWJzdHJhY3RcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIEFic3RyYWN0KHZhbHVlLCBkYXRhLCBjb21wdXRlZCkge1xuICAgICAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gICAgICAgIHRoaXMuZGF0YSA9IGRhdGEgJiYgZWFjaChkYXRhLCBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgICAgICAgcmV0dXJuIGNyZWF0ZVN1YihpdGVtKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuY29tcHV0ZWRQcm9wcyA9IGNvbXB1dGVkO1xuICAgIH1cblxuICAgIEFic3RyYWN0LnByb3RvdHlwZS50eXBlSWQgPSB1dWlkO1xuXG4gICAgQWJzdHJhY3QucHJvdG90eXBlLnZhbCA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBrZXkgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICB2YXIgc3ViID0gdGhpcy5zdWIoa2V5KTtcbiAgICAgICAgICAgIGlmIChzdWIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3ViLnZhbCgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgZm4gPSB0aGlzLmNvbXB1dGVkUHJvcHMgJiYgdGhpcy5jb21wdXRlZFByb3BzW2tleV07XG4gICAgICAgICAgICBpZiAoZm4pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZm4uY2FsbCh0aGlzLCB0aGlzLnZhbCgpKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy52YWx1ZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy52YWx1ZSA9IGVhY2godGhpcy5kYXRhLCBmdW5jdGlvbiAoc3ViKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1Yi52YWwoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLnZhbHVlO1xuICAgIH07XG5cbiAgICBBYnN0cmFjdC5wcm90b3R5cGUuc2V0ID0gdW5kZWZpbmVkOyAvLyBhYnN0YWN0XG5cbiAgICBBYnN0cmFjdC5wcm90b3R5cGUuc3ViID0gZnVuY3Rpb24gKGtleSkge1xuICAgICAgICByZXR1cm4gKHRoaXMuZGF0YSAmJiB0aGlzLmRhdGFba2V5XSkgfHwgbnVsbDtcbiAgICB9O1xuXG4gICAgQWJzdHJhY3QucHJvdG90eXBlLmVhY2ggPSBmdW5jdGlvbiAoZm4sIHNjb3BlLCBtb3JlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNldChlYWNoKHRoaXMuZGF0YSwgZm4sIHNjb3BlLCBtb3JlKSk7XG4gICAgfTtcblxuICAgIC8qKiBAcHJvdGVjdGVkICovXG4gICAgQWJzdHJhY3QucHJvdG90eXBlLnNldFN1YlZhbHVlID0gZnVuY3Rpb24gKHZhbCwga2V5KSB7XG4gICAgICAgIHZhciBjdXJyVmFsID0gdGhpcy5zdWIoa2V5KTtcbiAgICAgICAgaWYgKGN1cnJWYWwpIHtcbiAgICAgICAgICAgIC8vIHVwZGF0ZSBleGlzdGluZyBrZXlcbiAgICAgICAgICAgIHZhciBuZXdWYWwgPSBjdXJyVmFsLnNldCh2YWwpO1xuICAgICAgICAgICAgaWYgKG5ld1ZhbCAhPT0gY3VyclZhbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXdWYWw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBhZGQgbmV3IGtleS92YWx1ZVxuICAgICAgICAgICAgcmV0dXJuIGNyZWF0ZVN1Yih2YWwpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEEgc2ltcGxlIGltbXV0YWJsZSB2YWx1ZVxuICAgICAqXG4gICAgICogQGNsYXNzIFZhbHVlXG4gICAgICogQGV4dGVuZHMgQWJzdHJhY3RcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIFZhbHVlKHZhbCwgY29tcHV0ZWQpIHtcbiAgICAgICAgQWJzdHJhY3QuY2FsbCh0aGlzLCB2YWwsIG51bGwsIGNvbXB1dGVkKTtcbiAgICB9XG4gICAgVmFsdWUucHJvdG90eXBlID0gbmV3IEFic3RyYWN0KCk7XG5cbiAgICBWYWx1ZS5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24gX3NldFNpbXBsZVZhbHVlKHZhbCkge1xuICAgICAgICBpZiAoaXNJbW11dGFibGUodmFsKSkge1xuICAgICAgICAgICAgcmV0dXJuIHZhbDtcbiAgICAgICAgfVxuICAgICAgICBpZiAodmFsID09PSB0aGlzLnZhbHVlKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3IFZhbHVlKHZhbCwgdGhpcy5jb21wdXRlZFByb3BzKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQW4gaW1tdXRhYmxlIGtleS12YWx1ZSBzdG9yZVxuICAgICAqXG4gICAgICogQGNsYXNzIFN0cnVjdFxuICAgICAqIEBleHRlbmRzIEFic3RyYWN0XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBTdHJ1Y3QoZGF0YSwgY29tcHV0ZWQpIHtcbiAgICAgICAgQWJzdHJhY3QuY2FsbCh0aGlzLCBudWxsLCBkYXRhLCBjb21wdXRlZCk7XG4gICAgfVxuICAgIFN0cnVjdC5wcm90b3R5cGUgPSBuZXcgQWJzdHJhY3QoKTtcblxuICAgIFN0cnVjdC5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24gX3NldENvbXBsZXhWYWx1ZShrZXksIHZhbCkge1xuICAgICAgICBpZiAodHlwZW9mIGtleSA9PT0gJ3N0cmluZycgJiYgdHlwZW9mIHZhbCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIC8vIGNhbGxlZCB3aXRoIGtleSBhbmQgdmFsdWUsIGUuZy4gLnNldCgnZm9vJywgJ2JhcicpO1xuICAgICAgICAgICAgdmFyIG5ld1N1YiA9IHRoaXMuc2V0U3ViVmFsdWUodmFsLCBrZXkpO1xuICAgICAgICAgICAgaWYgKG5ld1N1Yikge1xuICAgICAgICAgICAgICAgIHZhciBuZXdEYXRhID0gY29weVRvKHt9LCB0aGlzLmRhdGEpO1xuICAgICAgICAgICAgICAgIG5ld0RhdGFba2V5XSA9IG5ld1N1YjtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFN0cnVjdChuZXdEYXRhLCB0aGlzLmNvbXB1dGVkUHJvcHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNJbW11dGFibGUoa2V5KSkge1xuICAgICAgICAgICAgcmV0dXJuIGtleTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpc0FycmF5KGtleSkpIHtcbiAgICAgICAgICAgIC8vIGNhbGxlZCB3aXRoIGFycmF5LCBlLmcuIC5zZXQoWzEsIDIsIC4uLl0pO1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBMaXN0KGtleSwgdGhpcy5jb21wdXRlZFByb3BzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpc09iamVjdChrZXkpICYmIGtleS5jb25zdHJ1Y3RvciA9PT0gT2JqZWN0KSB7XG4gICAgICAgICAgICAvLyBjYWxsZWQgd2l0aCByYXcganMgb2JqZWN0LCBlLmcuIC5zZXQoe2ZvbzogJ2Jhcid9KTtcbiAgICAgICAgICAgIHZhciBjaGFuZ2VkU3VicyA9IGVhY2goa2V5LCB0aGlzLnNldFN1YlZhbHVlLCB0aGlzKTtcbiAgICAgICAgICAgIGlmIChjaGFuZ2VkU3VicyAmJiBPYmplY3Qua2V5cyhjaGFuZ2VkU3VicykubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgU3RydWN0KGNvcHlUbyhjb3B5VG8oe30sIHRoaXMuZGF0YSksIGNoYW5nZWRTdWJzKSwgdGhpcy5jb21wdXRlZFByb3BzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiBrZXkgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFZhbHVlKGtleSwgdGhpcy5jb21wdXRlZFByb3BzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBBbiBpbW11dGFibGUgbGlzdC9hcnJheVxuICAgICAqXG4gICAgICogQGNsYXNzIExpc3RcbiAgICAgKiBAZXh0ZW5kcyBBYnN0cmFjdFxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgZnVuY3Rpb24gTGlzdChkYXRhLCBjb21wdXRlZCkge1xuICAgICAgICBBYnN0cmFjdC5jYWxsKHRoaXMsIG51bGwsIGRhdGEsIGNvbXB1dGVkKTtcbiAgICB9XG4gICAgTGlzdC5wcm90b3R5cGUgPSBuZXcgQWJzdHJhY3QoKTtcblxuICAgIExpc3QucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uIChpbmRleCwgdmFsdWUpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBpbmRleCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIC8vIGNhbGxlZCB3aXRoIGtleSBhbmQgdmFsdWUsIGUuZy4gLnNldCgnZm9vJywgJ2JhcicpO1xuICAgICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgICAgICB2YXIgbmV3U3ViID0gdGhpcy5zZXRTdWJWYWx1ZSh2YWx1ZSwgaW5kZXgpO1xuICAgICAgICAgICAgICAgIGlmIChuZXdTdWIpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG5ld0RhdGEgPSBbXS5jb25jYXQodGhpcy5kYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgbmV3RGF0YVtpbmRleF0gPSBuZXdTdWI7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXcgTGlzdChuZXdEYXRhKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB0aGlzOyAvLyBub24tbnVtZXJpYyBpbmRleFxuICAgICAgICB9XG5cbiAgICAgICAgLy8gY2FsbGVkIHdpdGggc2luZ2xlIGFyZ3VtZW50XG4gICAgICAgIHZhbHVlID0gaW5kZXg7XG5cbiAgICAgICAgaWYgKGlzSW1tdXRhYmxlKHZhbHVlKSkge1xuICAgICAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy51cGRhdGVMaXN0KHZhbHVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpc09iamVjdCh2YWx1ZSkgJiYgdmFsdWUuY29uc3RydWN0b3IgPT09IE9iamVjdCkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBTdHJ1Y3QodmFsdWUsIHRoaXMuY29tcHV0ZWRQcm9wcyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbmV3IFZhbHVlKHZhbHVlLCB0aGlzLmNvbXB1dGVkUHJvcHMpO1xuICAgIH07XG5cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIExpc3QucHJvdG90eXBlLnVwZGF0ZUxpc3QgPSBmdW5jdGlvbiAobmV3RGF0YSkge1xuICAgICAgICB2YXIgbmV3TGlzdCA9IFtdO1xuICAgICAgICB2YXIgY2hhbmdlZCA9IG5ld0RhdGEubGVuZ3RoICE9PSB0aGlzLmRhdGEubGVuZ3RoO1xuXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gbmV3RGF0YS5sZW5ndGg7ICBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgbmV3U3ViRGF0YSA9IG5ld0RhdGFbaV07XG4gICAgICAgICAgICB2YXIgbmV3U3ViID0gdGhpcy5zZXRTdWJWYWx1ZShuZXdTdWJEYXRhLCBpKTtcblxuICAgICAgICAgICAgaWYgKG5ld1N1Yikge1xuICAgICAgICAgICAgICAgIGNoYW5nZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIG5ld0xpc3QucHVzaChuZXdTdWIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBuZXdMaXN0LnB1c2godGhpcy5kYXRhW2ldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoY2hhbmdlZCkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBMaXN0KG5ld0xpc3QsIHRoaXMuY29tcHV0ZWRQcm9wcyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFRoaXMgaXMgYW4gaW1tdXRhYmxlIGRhdGEgb2JqZWN0XG4gICAgICovXG4gICAgcmV0dXJuIHtcbiAgICAgICAgZnJvbUpTOiBmdW5jdGlvbiAoZGF0YSwgY29tcHV0ZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBjcmVhdGVTdWIoZGF0YSwgY29tcHV0ZWQpO1xuICAgICAgICB9LFxuXG4gICAgICAgIGZpbmQ6IGZ1bmN0aW9uIChpbW11dGFibGUsIHNlbGVjdG9yKSB7XG4gICAgICAgICAgICBpZiAoIWltbXV0YWJsZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodHlwZW9mIHNlbGVjdG9yID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIHZhciBrZXlzID0gc2VsZWN0b3Iuc3BsaXQoJy4nKTtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGtleXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGltbXV0YWJsZSA9IGltbXV0YWJsZS5zdWIoa2V5c1tpXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gaW1tdXRhYmxlO1xuICAgICAgICB9XG4gICAgfTtcbn0oKSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICAvKipcbiAgICAgKiBJdGVyYXRlcyBvZiBhbiBpdGVyYWJsZSBvYmplY3QgYW5kIGNhbGwgdGhlIGdpdmVuIG1ldGhvZCBmb3IgZWFjaCBpdGVtXG4gICAgICogRm9yIGV4YW1wbGU6XG4gICAgICogPHByZT48Y29kZT5cbiAgICAgKiAgICAgIC8vIChhKSBkZWZhdWx0IHVzZSBjYXNlIGl0ZXJhdGUgdGhyb3VnaCBhbiBhcnJheSBvciBhbiBvYmplY3RcbiAgICAgKiAgICAgIGVhY2goWzEsIDIsIC4uLiwgbl0sIGZ1bmN0aW9uIGRvU3R1ZmYodmFsKSB7IC4uLiB9KTtcbiAgICAgKlxuICAgICAqICAgICAgLy8gKGIpIG1hcCBkYXRhXG4gICAgICogICAgICBlYWNoKFsxLCAyLCAzXSwgZnVuY3Rpb24gZG91YmxlKHZhbCkge1xuICAgICAqICAgICAgICAgIHJldHVybiAyICogdmFsO1xuICAgICAqICAgICAgfSk7IC8vIC0+IFsyLCA0LCA2XVxuICAgICAqICAgICAgZWFjaCh7Zm9vOiAxLCBiYXI6IDJ9LCBmdW5jdGlvbiBkb3VibGUodmFsKSB7XG4gICAgICogICAgICAgICAgcmV0dXJuIDIgKiB2YWw7XG4gICAgICogICAgICB9KTsgLy8gLT4ge2ZvbzogMiwgYmFyOiA0fVxuICAgICAqXG4gICAgICogICAgICAvLyAoYykgZmlsdGVyIGRhdGFcbiAgICAgKiAgICAgIGVhY2goWzEsIDIsIDMsIDRdLCBmdW5jdGlvbiAodmFsKSB7XG4gICAgICogICAgICAgICAgcmV0dXJuICh2YWwgJSAyID09PSAwKSA/IHZhbCA6IHVuZGVmaW5lZDtcbiAgICAgKiAgICAgIH0pOyAvLyAtPiBbMiwgNF1cbiAgICAgKiAgICAgIGVhY2goeyBmb286IDEsIGJhcjogMiwgYmF6OiAzLCB9LCBmdW5jdGlvbiB1bmV2ZW4odmFsKSB7XG4gICAgICogICAgICAgICAgcmV0dXJuICh2YWwgJSAyICE9PSAwKSA/IHZhbCA6IHVuZGVmaW5lZDtcbiAgICAgKiAgICAgIH0pOyAvLyAtPiB7IGZvbzogMSwgYmF6OiAzIH1cbiAgICAgKiA8L2NvZGU+PC9wcmU+XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdC9BcnJheX0gaXRlcmFibGUgVGhlIG9iamVjdCB0byBpdGVyYXRlIHRocm91Z2hcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmbiBUaGUgY2FsbGJhY2sgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIGZvciBlYWNoIGl0ZW1cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gc2NvcGUgVGhlIGV4ZWN1dGlvbiBzY29wZSBmb3IgdGhlIGNhbGxiYWNrIGZ1bmN0aW9uXG4gICAgICogQHBhcmFtIHtBcnJheX0gbW9yZSBPcHRpb25hbDsgYW4gYWRkaW9uYWwgc2V0IG9mIGFyZ3VtZW50cyB3aGljaCB3aWxsXG4gICAgICogICAgICBiZSBwYXNzZWQgdG8gdGhlIGNhbGxiYWNrIGZ1bmN0aW9uXG4gICAgICogQHJldHVybiB7T2JqZWN0L0FycmF5fSBUaGUgYWdncmVnYXRlZCByZXN1bHRzIG9mIGVhY2ggY2FsbGJhY2sgKHNlZSBleGFtcGxlcylcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBlYWNoKGl0ZXJhYmxlLCBmbiwgc2NvcGUsIG1vcmUpIHtcbiAgICAgICAgdmFyIGFyZ3MgPSBbbnVsbCwgbnVsbF07XG4gICAgICAgIHZhciByZXN1bHQsIHJlc3VsdFNldDtcbiAgICAgICAgdmFyIGksIGw7XG5cbiAgICAgICAgaWYgKG1vcmUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgYXJncyA9IGFyZ3MuY29uY2F0KG1vcmUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoaXRlcmFibGUpKSB7XG4gICAgICAgICAgICByZXN1bHRTZXQgPSBbXTtcblxuICAgICAgICAgICAgZm9yIChpID0gMCwgbCA9IGl0ZXJhYmxlLmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgICAgICAgICAgICAgIGFyZ3NbMF0gPSBpdGVyYWJsZVtpXTtcbiAgICAgICAgICAgICAgICBhcmdzWzFdID0gaTtcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBmbi5hcHBseShzY29wZSwgYXJncyk7XG5cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHJlc3VsdCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0U2V0LnB1c2gocmVzdWx0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSBlbHNlIGlmIChpdGVyYWJsZSAmJiB0eXBlb2YgaXRlcmFibGUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKGl0ZXJhYmxlKTtcbiAgICAgICAgICAgIC8vIHVzZSBPYmplY3Qua2V5cyArIGZvci1sb29wIHRvIGFsbG93IG9wdGltaXppbmcgZWFjaCBmb3JcbiAgICAgICAgICAgIC8vIGl0ZXJhdGluZyBvdmVyIG9iamVjdHMgaW4gaGFzaC10YWJsZS1tb2RlXG5cbiAgICAgICAgICAgIHJlc3VsdFNldCA9IHt9O1xuXG4gICAgICAgICAgICBmb3IgKGkgPSAwLCBsID0ga2V5cy5sZW5ndGg7IGkgPCBsOyArK2kpIHtcbiAgICAgICAgICAgICAgICB2YXIga2V5ID0ga2V5c1tpXTtcblxuICAgICAgICAgICAgICAgIGFyZ3NbMF0gPSBpdGVyYWJsZVtrZXldO1xuICAgICAgICAgICAgICAgIGFyZ3NbMV0gPSBrZXk7XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gZm4uYXBwbHkoc2NvcGUsIGFyZ3MpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiByZXN1bHQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdFNldFtrZXldID0gcmVzdWx0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXN1bHRTZXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHdoaWNoIGlzIGJvdW5kIHRvIGEgZ2l2ZW4gY2FsbGJhY2sgYW5kIHNjb3BlXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmbiBUaGUgY2FsbGJhY2sgKHNhbWUgYXMgZm9yIGVhY2ggaXRzZWxmKVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBzY29wZSBUaGUgZXhlY3V0aW9uIGNvbnRleHQgZm9yIHRoZSBjYWxsYmFja1xuICAgICAqIEByZXR1cm4gRnVuY3Rpb24gVGhlIG5ldyBpdGVyYXRvciBmdW5jdGlvbiB3aGljaCBleHBlY3RzIHRoZVxuICAgICAqICAgICAgaXRlcmFibGUgYW5kIGFuIGFycmF5IG9mIGFkZGl0aW9uYWwgcGFyYW1ldGVyIHdoaWNoIGFyZVxuICAgICAqICAgICAgcGFzc2VkIHRvIHRoZSBjYWxsYmFja1xuICAgICAqL1xuICAgIGVhY2gucHJlcGFyZSA9IGZ1bmN0aW9uIChmbiwgc2NvcGUpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChpdGVyYWJsZSwgbW9yZSkge1xuICAgICAgICAgICAgcmV0dXJuIGVhY2goaXRlcmFibGUsIGZuLCBzY29wZSB8fCB0aGlzLCBtb3JlKTtcbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIGVhY2g7XG59KCk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIGltbXV0YWJsZSA9IHJlcXVpcmUoJ2ltbXV0YWJpbGlzJyk7XG4gICAgdmFyIEFwcGxpY2F0dXMgPSByZXF1aXJlKCdhbGNoZW15LmpzL2xpYi9BcHBsaWNhdHVzJyk7XG4gICAgdmFyIE5hdmlnYXRpb25Db250cm9sbGVyID0gcmVxdWlyZSgnLi9jb250cm9sbGVyL05hdmlnYXRpb24nKTtcblxuICAgIC8qKlxuICAgICAqIEBjbGFzc1xuICAgICAqIEBuYW1lIGNvcmUuQXBwXG4gICAgICogQGV4dGVuZHMgYWxjaGVteS53ZWIuQXBwbGljYXR1c1xuICAgICAqL1xuICAgIHJldHVybiBBcHBsaWNhdHVzLmV4dGVuZCh7XG4gICAgICAgIC8qKiBAbGVuZHMgY29yZS5BcHAucHJvdG90eXBlICovXG5cbiAgICAgICAgLyoqIEBvdmVycmlkZSAqL1xuICAgICAgICBvbkxhdW5jaDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy53aXJlVXAoTmF2aWdhdGlvbkNvbnRyb2xsZXIuYnJldygpKTtcbiAgICAgICAgICAgIHRoaXMudWkuaW5pdCh0aGlzLnN0YXRlKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKiogQG92ZXJyaWRlICovXG4gICAgICAgIHVwZGF0ZTogZnVuY3Rpb24gKHApIHtcbiAgICAgICAgICAgIHZhciBzdGF0ZSA9IHAuc3RhdGVcbiAgICAgICAgICAgICAgICAuc2V0KCd3aW5kb3dXaWR0aCcsIHdpbmRvdy5pbm5lcldpZHRoKVxuICAgICAgICAgICAgICAgIC5zZXQoJ3dpbmRvd0hlaWdodCcsIHdpbmRvdy5pbm5lckhlaWdodCk7XG5cbiAgICAgICAgICAgIHRoaXMudWkudXBkYXRlKHN0YXRlKTtcblxuICAgICAgICAgICAgcmV0dXJuIHN0YXRlO1xuXG4gICAgICAgIH0sXG5cbiAgICB9KS53aGVuQnJld2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IGltbXV0YWJsZS5mcm9tSlMoe1xuICAgICAgICAgICAgbW9kZTogJ3ByZXNlbnRhdGlvbicsXG4gICAgICAgICAgICBjdXJyZW50SW5kZXg6IDAsXG4gICAgICAgICAgICBudW1PZlNsaWRlczogMCxcbiAgICAgICAgICAgIGVtYWlsOiAnbWljaGFlbC5idWV0dG5lckBmbHllcmFsYXJtLmNvbSdcbiAgICAgICAgfSk7XG4gICAgfSk7XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBjb3F1b1ZlbmVudW0gPSByZXF1aXJlKCdjb3F1by12ZW5lbnVtJyk7XG4gICAgdmFyIGVhY2ggPSByZXF1aXJlKCdwcm8tc2luZ3VsaXMnKTtcbiAgICB2YXIgVXRpbHMgPSByZXF1aXJlKCdhbGNoZW15LmpzL2xpYi9VdGlscycpO1xuICAgIHZhciBBZG1pbmlzdHJhdG9yID0gcmVxdWlyZSgnYWxjaGVteS5qcy9saWIvQWRtaW5pc3RyYXRvcicpO1xuICAgIHZhciBBcG90aGVjYXJpdXMgPSByZXF1aXJlKCdhbGNoZW15LmpzL2xpYi9BcG90aGVjYXJpdXMnKTtcbiAgICB2YXIgRGVsZWdhdHVzID0gcmVxdWlyZSgnYWxjaGVteS5qcy9saWIvRGVsZWdhdHVzJyk7XG4gICAgdmFyIFN0eWx1cyA9IHJlcXVpcmUoJ2FsY2hlbXkuanMvbGliL1N0eWx1cycpO1xuICAgIHZhciBTdGF0ZVN5c3RlbSA9IHJlcXVpcmUoJ2FsY2hlbXkuanMvbGliL1N0YXRlU3lzdGVtJyk7XG4gICAgdmFyIEV2ZW50U3lzdGVtID0gcmVxdWlyZSgnYWxjaGVteS5qcy9saWIvRXZlbnRTeXN0ZW0nKTtcbiAgICB2YXIgQ3NzUmVuZGVyU3lzdGVtID0gcmVxdWlyZSgnYWxjaGVteS5qcy9saWIvQ3NzUmVuZGVyU3lzdGVtJyk7XG4gICAgdmFyIFZEb21SZW5kZXJTeXN0ZW0gPSByZXF1aXJlKCdhbGNoZW15LmpzL2xpYi9WRG9tUmVuZGVyU3lzdGVtJyk7XG4gICAgdmFyIFZpZXdwb3J0ID0gcmVxdWlyZSgnLi91aS9WaWV3cG9ydCcpO1xuXG4gICAgcmV0dXJuIGNvcXVvVmVuZW51bSh7XG5cbiAgICAgICAgLyoqIEBwcm90ZWN0ZWQgKi9cbiAgICAgICAgbWVzc2FnZXM6IHVuZGVmaW5lZCxcblxuICAgICAgICAvKiogQHByb3RlY3RlZCAqL1xuICAgICAgICBhZG1pbjogdW5kZWZpbmVkLFxuXG4gICAgICAgIC8qKiBAcHJvdGVjdGVkICovXG4gICAgICAgIGRlbGVnYXRvcjogdW5kZWZpbmVkLFxuXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uIChzdGF0ZSkge1xuICAgICAgICAgICAgdGhpcy5pbml0U3lzdGVtcygpO1xuICAgICAgICAgICAgdGhpcy5pbml0RW50aXRpZXMoc3RhdGUpO1xuICAgICAgICB9LFxuXG4gICAgICAgIHVwZGF0ZTogZnVuY3Rpb24gKHN0YXRlKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5hZG1pbi51cGRhdGUoc3RhdGUpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8vXG4gICAgICAgIC8vIHByaXZhdGVcbiAgICAgICAgLy9cblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgaW5pdFN5c3RlbXM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGVhY2goW1xuICAgICAgICAgICAgICAgIFN0YXRlU3lzdGVtLFxuICAgICAgICAgICAgICAgIEV2ZW50U3lzdGVtLFxuICAgICAgICAgICAgICAgIENzc1JlbmRlclN5c3RlbSxcbiAgICAgICAgICAgICAgICBWRG9tUmVuZGVyU3lzdGVtLFxuXG4gICAgICAgICAgICBdLCBmdW5jdGlvbiAoU3lzdGVtKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hZG1pbi5hZGRTeXN0ZW0oU3lzdGVtLmJyZXcoe1xuICAgICAgICAgICAgICAgICAgICBkZWxlZ2F0b3I6IHRoaXMuZGVsZWdhdG9yLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlczogdGhpcy5tZXNzYWdlcyxcbiAgICAgICAgICAgICAgICAgICAgc3R5bHVzOiB0aGlzLnN0eWx1cyxcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9LCB0aGlzKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgaW5pdEVudGl0aWVzOiBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgICAgICAgICAgIHRoaXMuYWRtaW4uaW5pdEVudGl0aWVzKFtVdGlscy5tZWx0KFZpZXdwb3J0LCB7XG4gICAgICAgICAgICAgICAgaWQ6ICd2aWV3cG9ydCcsXG4gICAgICAgICAgICAgICAgY2hpbGRyZW46IHRoaXMuc2xpZGVzLFxuICAgICAgICAgICAgfSldLCBzdGF0ZSk7XG4gICAgICAgIH0sXG5cbiAgICB9KS53aGVuQnJld2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5kZWxlZ2F0b3IgPSBEZWxlZ2F0dXMuYnJldygpO1xuICAgICAgICB0aGlzLnN0eWx1cyA9IFN0eWx1cy5icmV3KCk7XG4gICAgICAgIHRoaXMuYWRtaW4gPSBBZG1pbmlzdHJhdG9yLmJyZXcoe1xuICAgICAgICAgICAgcmVwbzogQXBvdGhlY2FyaXVzLmJyZXcoKVxuICAgICAgICB9KTtcbiAgICB9KTtcbn0oKSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIGNvcXVvVmVuZW51bSA9IHJlcXVpcmUoJ2NvcXVvLXZlbmVudW0nKTtcblxuICAgIC8qKlxuICAgICAqIERlc2NyaXB0aW9uXG4gICAgICpcbiAgICAgKiBAY2xhc3NcbiAgICAgKiBAbmFtZSBjb3JlLmNvbnRyb2xsZXIuTmF2aWdhdGlvblxuICAgICAqL1xuICAgIHJldHVybiBjb3F1b1ZlbmVudW0oe1xuICAgICAgICAvKiogQGxlbmRzIGNvcmUuY29udHJvbGxlci5OYXZpZ2F0aW9uLnByb3RvdHlwZSAqL1xuXG4gICAgICAgIG1lc3NhZ2VzOiB7XG4gICAgICAgICAgICAnbmF2aWdhdGlvbjpuZXh0JzogJ29uTmV4dFNsaWRlJyxcbiAgICAgICAgICAgICduYXZpZ2F0aW9uOnByZXYnOiAnb25QcmV2U2xpZGUnLFxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICBvbk5leHRTbGlkZTogZnVuY3Rpb24gKHN0YXRlKSB7XG4gICAgICAgICAgICB2YXIgY3VycmVudCA9IHN0YXRlLnZhbCgnY3VycmVudEluZGV4Jyk7XG4gICAgICAgICAgICBpZiAoY3VycmVudCA8IHN0YXRlLnZhbCgnbnVtT2ZTbGlkZXMnKSAtIDEpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3RhdGUuc2V0KCdjdXJyZW50SW5kZXgnLCBjdXJyZW50ICsgMSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBzdGF0ZTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgb25QcmV2U2xpZGU6IGZ1bmN0aW9uIChzdGF0ZSkge1xuICAgICAgICAgICAgdmFyIGN1cnJlbnQgPSBzdGF0ZS52YWwoJ2N1cnJlbnRJbmRleCcpO1xuICAgICAgICAgICAgaWYgKGN1cnJlbnQgPiAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN0YXRlLnNldCgnY3VycmVudEluZGV4JywgY3VycmVudCAtIDEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gc3RhdGU7XG4gICAgICAgIH0sXG4gICAgfSk7XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBVdGlscyA9IHJlcXVpcmUoJ2FsY2hlbXkuanMvbGliL1V0aWxzJyk7XG5cbiAgICByZXR1cm4gZnVuY3Rpb24gdGV4dCh0eHQsIGVudGl0eUNzcywgbW9yZSkge1xuICAgICAgICByZXR1cm4gVXRpbHMubWVsdCh7XG4gICAgICAgICAgICBzdGF0ZToge1xuICAgICAgICAgICAgICAgIHRleHQ6IHR4dFxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgdmRvbToge1xuICAgICAgICAgICAgICAgIHJlbmRlcmVyOiBmdW5jdGlvbiAoY3R4KSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzID0gY3R4LnN0YXRlO1xuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjdHguaCgnZGl2Jywge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lOiAndGV4dCBiaWcgJyArIChzLnZhbCgnY2xhc3NOYW1lJykgfHwgJycpLFxuICAgICAgICAgICAgICAgICAgICAgICAgaWQ6IGN0eC5lbnRpdHlJZCxcbiAgICAgICAgICAgICAgICAgICAgfSwgcy52YWwoJ3RleHQnKSk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGNzczoge1xuICAgICAgICAgICAgICAgIGVudGl0eVJ1bGVzOiBlbnRpdHlDc3MsXG5cbiAgICAgICAgICAgICAgICB0eXBlUnVsZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgJy50ZXh0Jzoge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGFkZGluZzogJzAgNDBweCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXJnaW46ICcyMHB4IDAnLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICB9LCBtb3JlKTtcbiAgICB9O1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICByZXR1cm4gZnVuY3Rpb24gaHRtbChyZW5kZXIsIGVudGl0eUNzcykge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdmRvbToge1xuICAgICAgICAgICAgICAgIHJlbmRlcmVyOiBmdW5jdGlvbiAoY3R4KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZW5kZXIoY3R4LmgsIGN0eC5zdGF0ZSk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGNzczoge1xuICAgICAgICAgICAgICAgIGVudGl0eVJ1bGVzOiBlbnRpdHlDc3MsXG4gICAgICAgICAgICB9LFxuICAgICAgICB9O1xuICAgIH07XG59KCkpO1xuXG4iLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIFV0aWxzID0gcmVxdWlyZSgnYWxjaGVteS5qcy9saWIvVXRpbHMnKTtcblxuICAgIHJldHVybiBmdW5jdGlvbiBzbGlkZSh0aXRsZSwgY2hpbGRyZW4sIG1vcmUpIHtcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodGl0bGUpKSB7XG4gICAgICAgICAgICBtb3JlID0gY2hpbGRyZW47XG4gICAgICAgICAgICBjaGlsZHJlbiA9IHRpdGxlO1xuICAgICAgICAgICAgdGl0bGUgPSAnJztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBVdGlscy5tZWx0KHtcbiAgICAgICAgICAgIGdsb2JhbFRvTG9jYWw6IHtcbiAgICAgICAgICAgICAgICBtb2RlOiAnbW9kZScsXG4gICAgICAgICAgICAgICAgZW1haWw6ICdlbWFpbCcsXG4gICAgICAgICAgICAgICAgd2luZG93V2lkdGg6ICd3aW5kb3dXaWR0aCcsXG4gICAgICAgICAgICAgICAgd2luZG93SGVpZ2h0OiAnd2luZG93SGVpZ2h0JyxcbiAgICAgICAgICAgICAgICBjdXJyZW50SW5kZXg6ICdjdXJyZW50SW5kZXgnXG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBzdGF0ZToge1xuICAgICAgICAgICAgICAgIHRpdGxlOiB0aXRsZSxcbiAgICAgICAgICAgICAgICBpbmRleDogMCxcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHZkb206IHtcbiAgICAgICAgICAgICAgICByZW5kZXJlcjogZnVuY3Rpb24gKGN0eCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgaCA9IGN0eC5oO1xuICAgICAgICAgICAgICAgICAgICB2YXIgcyA9IGN0eC5zdGF0ZS52YWwoKTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGlzQWN0aXZlID0gcy5tb2RlID09PSAncHJpbnQnIHx8IHMuY3VycmVudEluZGV4ID09PSBzLmluZGV4O1xuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBoKCdkaXYuc2xpZGUnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZDogY3R4LmVudGl0eUlkLFxuICAgICAgICAgICAgICAgICAgICAgICAga2V5OiBjdHguZW50aXR5SWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU6IGlzQWN0aXZlID8gJ2FjdGl2ZScgOiAnaGlkZGVuJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFzZXQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRleDogcy5pbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIH0sIFtcbiAgICAgICAgICAgICAgICAgICAgICAgIGgoJ2Rpdi5zbGlkZS10aXRsZScsIGN0eC5zdGF0ZS52YWwoJ3RpdGxlJykpLFxuICAgICAgICAgICAgICAgICAgICAgICAgaCgnZGl2LnNsaWRlLWlubmVyJywgY3R4LnJlbmRlckFsbENoaWxkcmVuKCkpLFxuICAgICAgICAgICAgICAgICAgICAgICAgaCgnc3Bhbi5lbWFpbCcsIGN0eC5zdGF0ZS52YWwoJ2VtYWlsJykpLFxuICAgICAgICAgICAgICAgICAgICBdKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgY3NzOiB7XG4gICAgICAgICAgICAgICAgZW50aXR5UnVsZXM6IGZ1bmN0aW9uIChzdGF0ZSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoc3RhdGUudmFsKCdtb2RlJykgPT09ICdwcmludCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGVmdDogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB2YXIgaW5kZXggPSBzdGF0ZS52YWwoJ2luZGV4Jyk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBjSW5kZXggPSBzdGF0ZS52YWwoJ2N1cnJlbnRJbmRleCcpO1xuICAgICAgICAgICAgICAgICAgICB2YXIgd2lkdGggPSBzdGF0ZS52YWwoJ3dpbmRvd1dpZHRoJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxlZnQ6IChpbmRleCAtIGNJbmRleCkgKiB3aWR0aCArICdweCcsXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgIHR5cGVSdWxlczoge1xuICAgICAgICAgICAgICAgICAgICAnLnNsaWRlJzoge1xuICAgICAgICAgICAgICAgICAgICAgICAgcG9zaXRpb246ICdhYnNvbHV0ZScsXG4gICAgICAgICAgICAgICAgICAgICAgICB0b3A6IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICBsZWZ0OiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgd2lkdGg6ICcxMDAlJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGhlaWdodDogJzEwMCUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGlzcGxheTogJ3RhYmxlJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICd0ZXh0LWFsaWduJzogJ2NlbnRlcicsXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICcuc2xpZGUtdGl0bGUnOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcG9zaXRpb246ICdhYnNvbHV0ZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdG9wOiAnMjBweCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGVmdDogJzIwcHgnLFxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgICAgICAgICAgJy5zbGlkZS1pbm5lcic6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aWR0aDogJzEwMCUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpc3BsYXk6ICd0YWJsZS1jZWxsJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAndmVydGljYWwtYWxpZ24nOiAnbWlkZGxlJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cmFuc2l0aW9uOiAnb3BhY2l0eSAwLjJzIGVhc2UtaW4tb3V0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgICAgJy5zbGlkZS5hY3RpdmUnOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cmFuc2l0aW9uOiAnbGVmdCAwLjJzIHN0ZXAtc3RhcnQnLFxuICAgICAgICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgICAgICAgICcuc2xpZGUuaGlkZGVuJzoge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNpdGlvbjogJ2xlZnQgMC4ycyBsaW5lYXInLFxuICAgICAgICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgICAgICAgICcuc2xpZGUuaGlkZGVuIC5zbGlkZS10aXRsZSc6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZpc2liaWxpdHk6ICdoaWRkZW4nLFxuICAgICAgICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgICAgICAgICcuc2xpZGUuaGlkZGVuIC5zbGlkZS1pbm5lcic6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wYWNpdHk6IDAsXG4gICAgICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgICAgJy5wcmludCAuc2xpZGUnOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbjogJ3JlbGF0aXZlJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHdpZHRoOiAnNDIwbW0nLCAvLyBESU4gQTMgKElTTyAyMTYpIGxhbmRzY2FwZVxuICAgICAgICAgICAgICAgICAgICAgICAgaGVpZ2h0OiAnMjk3bW0nLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBjaGlsZHJlbjogY2hpbGRyZW4sXG4gICAgICAgIH0sIG1vcmUpO1xuICAgIH07XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBVdGlscyA9IHJlcXVpcmUoJ2FsY2hlbXkuanMvbGliL1V0aWxzJyk7XG5cbiAgICByZXR1cm4gZnVuY3Rpb24gdGV4dCh0eHQsIGVudGl0eUNzcywgbW9yZSkge1xuICAgICAgICByZXR1cm4gVXRpbHMubWVsdCh7XG4gICAgICAgICAgICBzdGF0ZToge1xuICAgICAgICAgICAgICAgIHRleHQ6IHR4dFxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgdmRvbToge1xuICAgICAgICAgICAgICAgIHJlbmRlcmVyOiBmdW5jdGlvbiAoY3R4KSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzID0gY3R4LnN0YXRlO1xuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjdHguaCgnZGl2Jywge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lOiAndGV4dCAnICsgKHMudmFsKCdjbGFzc05hbWUnKSB8fCAnJyksXG4gICAgICAgICAgICAgICAgICAgICAgICBpZDogY3R4LmVudGl0eUlkLFxuICAgICAgICAgICAgICAgICAgICB9LCBzLnZhbCgndGV4dCcpKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgY3NzOiB7XG4gICAgICAgICAgICAgICAgZW50aXR5UnVsZXM6IGVudGl0eUNzcyxcblxuICAgICAgICAgICAgICAgIHR5cGVSdWxlczoge1xuICAgICAgICAgICAgICAgICAgICAnLnRleHQnOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwYWRkaW5nOiAnMCA0MHB4JyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hcmdpbjogJzIwcHggMCcsXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0sIG1vcmUpO1xuICAgIH07XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIC8vIHZhciBVdGlscyA9IHJlcXVpcmUoJ2FsY2hlbXkuanMvbGliL1V0aWxzJyk7XG4gICAgLy8gdmFyIENlbnRlckNvbnRhaW5lciA9IHJlcXVpcmUoJy4uLy4uL2NvcmUvdWkvQ2VudGVyQ29udGFpbmVyJyk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgICAvKiogQGxlbmRzIGNvcmUuZW50aXRpZXMuVmlld3BvcnQucHJvdG90eXBlICovXG4gICAgICAgIGdsb2JhbFRvTG9jYWw6IHtcbiAgICAgICAgICAgIHdpbmRvd1dpZHRoOiAnd2luZG93V2lkdGgnLFxuICAgICAgICAgICAgd2luZG93SGVpZ2h0OiAnd2luZG93SGVpZ2h0JyxcbiAgICAgICAgICAgIG1vZGU6ICdtb2RlJyxcbiAgICAgICAgICAgIGVtYWlsOiAnZW1haWwnLFxuICAgICAgICB9LFxuXG4gICAgICAgIHZkb206IHtcbiAgICAgICAgICAgIHJvb3Q6IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd2aWV3cG9ydCcpLFxuXG4gICAgICAgICAgICByZW5kZXJlcjogZnVuY3Rpb24gcmVuZGVyVmRvbShjdHgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY3R4LmgoJ2J1dHRvbicsIHtcbiAgICAgICAgICAgICAgICAgICAgaWQ6IGN0eC5lbnRpdHlJZCxcbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lOiAndmlld3BvcnQgJyArIGN0eC5zdGF0ZS52YWwoJ21vZGUnKSxcbiAgICAgICAgICAgICAgICAgICAgdGFiSW5kZXg6ICcxJyxcbiAgICAgICAgICAgICAgICAgICAgYXV0b2ZvY3VzOiAnMScsXG4gICAgICAgICAgICAgICAgfSwgY3R4LnJlbmRlckFsbENoaWxkcmVuKCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIGNzczoge1xuICAgICAgICAgICAgZW50aXR5UnVsZXM6IGZ1bmN0aW9uIChzdGF0ZSkge1xuICAgICAgICAgICAgICAgIGlmIChzdGF0ZS52YWwoJ21vZGUnKSA9PT0gJ3ByaW50Jykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaGVpZ2h0OiAnaW5pdGlhbCcsXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgd2lkdGg6IHN0YXRlLnZhbCgnd2luZG93V2lkdGgnKSArICdweCcsXG4gICAgICAgICAgICAgICAgICAgIGhlaWdodDogc3RhdGUudmFsKCd3aW5kb3dIZWlnaHQnKSArICdweCcsXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHR5cGVSdWxlczoge1xuICAgICAgICAgICAgICAgICcudmlld3BvcnQnOiB7XG4gICAgICAgICAgICAgICAgICAgIHBhZGRpbmc6IDAsXG4gICAgICAgICAgICAgICAgICAgIGJvcmRlcjogJ25vbmUnLFxuICAgICAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kOiAndHJhbnNwYXJlbnQnLFxuICAgICAgICAgICAgICAgICAgICBjb2xvcjogJ2luaGVyaXQnLFxuICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAnLnZpZXdwb3J0OmZvY3VzJzoge1xuICAgICAgICAgICAgICAgICAgICAnYm94LXNoYWRvdyc6ICdpbnNldCAwIDAgMTBweCB3aGl0ZScsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICBldmVudHM6IHtcbiAgICAgICAgICAgIGNvbnRleHRtZW51OiBmdW5jdGlvbiBvbkNvbnRleHRNZW51KGV2ZW50LCBzdGF0ZSwgc2VuZE1zZykge1xuICAgICAgICAgICAgICAgIHNlbmRNc2coJ25hdmlnYXRpb246cHJldicpO1xuICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBjbGljazogZnVuY3Rpb24gb25DbGljayhldmVudCwgc3RhdGUsIHNlbmRNc2cpIHtcbiAgICAgICAgICAgICAgICBzZW5kTXNnKCduYXZpZ2F0aW9uOm5leHQnKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGtleWRvd246IGZ1bmN0aW9uIG9uS2V5cHJlc3NlZChldmVudCwgc3RhdGUsIHNlbmRNc2cpIHtcbiAgICAgICAgICAgICAgICB2YXIga2V5ID0gZXZlbnQud2hpY2ggfHwgZXZlbnQua2V5Q29kZTtcbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZygnb25LZXlwcmVzc2VkJywgZXZlbnQsIGtleSk7XG5cbiAgICAgICAgICAgICAgICBpZiAoa2V5ID09PSAzNyB8fCBrZXkgPT09IDI3IHx8IGtleSA9PT0gMzMpIHsgLy8gWzxdLCBbRVNDXSwgW1BnVXBdXG4gICAgICAgICAgICAgICAgICAgIHNlbmRNc2coJ25hdmlnYXRpb246cHJldicpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGtleSA9PT0gMzkgfHwga2V5ID09PSAxMyB8fCBrZXkgPT09IDM0KSB7IC8vIFs+XSwgW1JFVFVSTl0sIFtQZ0Rvd25dXG4gICAgICAgICAgICAgICAgICAgIHNlbmRNc2coJ25hdmlnYXRpb246bmV4dCcpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICB9O1xufSgpKTtcbiIsIihmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIGVhY2ggPSByZXF1aXJlKCdwcm8tc2luZ3VsaXMnKTtcbiAgICB2YXIgQXBwID0gcmVxdWlyZSgnLi9jb3JlL0FwcCcpO1xuICAgIHZhciBVSSA9IHJlcXVpcmUoJy4vY29yZS9VSScpO1xuICAgIHZhciBPYnNlcnZhcmkgPSByZXF1aXJlKCdhbGNoZW15LmpzL2xpYi9PYnNlcnZhcmknKTtcbiAgICB2YXIgbWVzc2FnZXMsIHVpLCBhcHA7XG4gICAgdmFyIHNsaWRlcyA9IGVhY2goW1xuICAgICAgICByZXF1aXJlKCcuL3NsaWRlcy9UaXRsZScpLFxuICAgICAgICByZXF1aXJlKCcuL3NsaWRlcy9yYW5rLTEwLTEnKSxcbiAgICAgICAgcmVxdWlyZSgnLi9zbGlkZXMvcmFuay0xMC0yJyksXG4gICAgICAgIHJlcXVpcmUoJy4vc2xpZGVzL3JhbmstMDktMScpLFxuICAgICAgICByZXF1aXJlKCcuL3NsaWRlcy9yYW5rLTA5LTInKSxcbiAgICAgICAgcmVxdWlyZSgnLi9zbGlkZXMvcmFuay0wOC0xJyksXG4gICAgICAgIHJlcXVpcmUoJy4vc2xpZGVzL3JhbmstMDgtMicpLFxuICAgICAgICByZXF1aXJlKCcuL3NsaWRlcy9yYW5rLTA3LTEnKSxcbiAgICAgICAgcmVxdWlyZSgnLi9zbGlkZXMvcmFuay0wNy0yJyksXG4gICAgICAgIHJlcXVpcmUoJy4vc2xpZGVzL3JhbmstMDYtMScpLFxuICAgICAgICByZXF1aXJlKCcuL3NsaWRlcy9yYW5rLTA1LTEnKSxcbiAgICAgICAgcmVxdWlyZSgnLi9zbGlkZXMvcmFuay0wNS0yJyksXG4gICAgICAgIHJlcXVpcmUoJy4vc2xpZGVzL3JhbmstMDQtMScpLFxuICAgICAgICByZXF1aXJlKCcuL3NsaWRlcy9yYW5rLTA0LTInKSxcbiAgICAgICAgcmVxdWlyZSgnLi9zbGlkZXMvcmFuay0wMy0xJyksXG4gICAgICAgIHJlcXVpcmUoJy4vc2xpZGVzL3JhbmstMDItMScpLFxuICAgICAgICByZXF1aXJlKCcuL3NsaWRlcy9yYW5rLTAxLTEnKSxcbiAgICAgICAgcmVxdWlyZSgnLi9zbGlkZXMvU291cmNlcycpLFxuICAgICAgICByZXF1aXJlKCcuL3NsaWRlcy9RdWVzdGlvbnMnKSxcbiAgICBdLCBmdW5jdGlvbiAoc2xpZGUsIGluZGV4KSB7XG4gICAgICAgIHNsaWRlLnN0YXRlID0gc2xpZGUuc3RhdGUgfHwge307XG4gICAgICAgIHNsaWRlLnN0YXRlLmluZGV4ID0gaW5kZXg7XG5cbiAgICAgICAgcmV0dXJuIHNsaWRlO1xuICAgIH0pO1xuXG4gICAgd2luZG93Lm9ubG9hZCA9IGZ1bmN0aW9uIG9uTG9hZCgpIHtcbiAgICAgICAgbWVzc2FnZXMgPSBPYnNlcnZhcmkuYnJldygpO1xuXG4gICAgICAgIHVpID0gVUkuYnJldyh7XG4gICAgICAgICAgICBtZXNzYWdlczogbWVzc2FnZXMsXG4gICAgICAgICAgICBzbGlkZXM6IHNsaWRlc1xuICAgICAgICB9KTtcblxuICAgICAgICBhcHAgPSBBcHAuYnJldyh7XG4gICAgICAgICAgICB1aTogdWksXG4gICAgICAgICAgICBtZXNzYWdlczogbWVzc2FnZXMsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGFwcC5zdGF0ZSA9IGFwcC5zdGF0ZS5zZXQoe1xuICAgICAgICAgICAgbnVtT2ZTbGlkZXM6IHNsaWRlcy5sZW5ndGgsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGFwcC5sYXVuY2goKTtcblxuICAgICAgICB3aW5kb3cuYXBwID0gYXBwOyAvLyBnbG9iYWwgcmVmZXJlbmNlIGZvciBkZWJ1Z2dpbmdcbiAgICB9O1xuXG4gICAgd2luZG93Lm9udW5sb2FkID0gZnVuY3Rpb24gb25VbmxvYWQoKSB7XG4gICAgICAgIFthcHAsIHVpLCBtZXNzYWdlc10uZm9yRWFjaChmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgICAgICBvYmouZGlzcG9zZSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICB3aW5kb3cuYXBwID0gbnVsbDtcbiAgICB9O1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgc2xpZGUgPSByZXF1aXJlKCcuLi9jb3JlL3VpL1NsaWRlJyk7XG4gICAgdmFyIHRleHQgPSByZXF1aXJlKCcuLi9jb3JlL3VpL1RleHQnKTtcblxuICAgIHJldHVybiBzbGlkZShbXG4gICAgICAgIHRleHQoJ0ZyYWdlbj8nKVxuICAgIF0pO1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgc2xpZGUgPSByZXF1aXJlKCcuLi9jb3JlL3VpL1NsaWRlJyk7XG4gICAgdmFyIHRleHQgPSByZXF1aXJlKCcuLi9jb3JlL3VpL0JpZ1RleHQnKTtcblxuICAgIHJldHVybiBzbGlkZSgnUXVlbGxlbiB1bmQgTGlua3MnLCBbXG4gICAgICAgIHRleHQoJy0gRS4gRGVyYnkgYW5kIEQuIExhcnNlbi4gQWdpbGUgUmV0cm9zcGVjdGl2ZXMsIFByYWdtYXRpYyBCb29rc2hlbGYsIFVTQSwgMjAwNicpLFxuICAgICAgICB0ZXh0KCctIEMuIEJhbGRhdWYuIFJldHItTy1NYXQsIGh0dHA6Ly93d3cucGxhbnMtZm9yLXJldHJvc3BlY3RpdmVzLmNvbS8nKSxcbiAgICBdKTtcbn0oKSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIHNsaWRlID0gcmVxdWlyZSgnLi4vY29yZS91aS9TbGlkZScpO1xuICAgIHZhciBodG1sID0gcmVxdWlyZSgnLi4vY29yZS91aS9IdG1sJyk7XG5cbiAgICByZXR1cm4gc2xpZGUoJycsIFtcbiAgICAgICAgaHRtbChmdW5jdGlvbiAoaCkge1xuICAgICAgICAgICAgcmV0dXJuIGgoJ2Rpdi50aXRsZS1ibG9jaycsIFtcbiAgICAgICAgICAgICAgICBoKCdkaXYuc3BlYWtlcicsICdNaWNoYWVsIELDvHR0bmVyIHwgRmx5ZXJhbGFybScpLFxuICAgICAgICAgICAgICAgIGgoJ2Rpdi50aXRsZScsICdEaWUgMTAgd2ljaHRpZ3N0ZW4gRGluZ2UsIGRpZSBtYW4gYmVpbSBNb2RlcmllcmVuIGVpbmVyIFJldHJvc3Bla3RpdmUgYmVhY2h0ZW4gc29sbHRlJyksXG4gICAgICAgICAgICBdKTtcbiAgICAgICAgfSlcbiAgICBdKTtcbn0oKSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIHNsaWRlID0gcmVxdWlyZSgnLi4vY29yZS91aS9TbGlkZScpO1xuICAgIHZhciB0ZXh0ID0gcmVxdWlyZSgnLi4vY29yZS91aS9CaWdUZXh0Jyk7XG5cbiAgICByZXR1cm4gc2xpZGUoJycsIFtcbiAgICAgICAgdGV4dCgnIzEnKSxcbiAgICAgICAgdGV4dCgnSGFiZSBTcGHDnyEnKSxcbiAgICBdKTtcbn0oKSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIHNsaWRlID0gcmVxdWlyZSgnLi4vY29yZS91aS9TbGlkZScpO1xuICAgIHZhciB0ZXh0ID0gcmVxdWlyZSgnLi4vY29yZS91aS9CaWdUZXh0Jyk7XG5cbiAgICByZXR1cm4gc2xpZGUoJycsIFtcbiAgICAgICAgdGV4dCgnIzInKSxcbiAgICAgICAgdGV4dCgnS2VpbmUgUGFuaWshJylcbiAgICBdKTtcbn0oKSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIHNsaWRlID0gcmVxdWlyZSgnLi4vY29yZS91aS9TbGlkZScpO1xuICAgIHZhciB0ZXh0ID0gcmVxdWlyZSgnLi4vY29yZS91aS9CaWdUZXh0Jyk7XG5cbiAgICByZXR1cm4gc2xpZGUoJycsIFtcbiAgICAgICAgdGV4dCgnIzMnKSxcbiAgICAgICAgdGV4dCgnR2VoZSBvZmZlbiBpbiBkaWUgUmV0cm9zcGVrdGl2ZSEnKSxcbiAgICBdKTtcbn0oKSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIHNsaWRlID0gcmVxdWlyZSgnLi4vY29yZS91aS9TbGlkZScpO1xuICAgIHZhciB0ZXh0ID0gcmVxdWlyZSgnLi4vY29yZS91aS9CaWdUZXh0Jyk7XG5cbiAgICByZXR1cm4gc2xpZGUoJycsIFtcbiAgICAgICAgdGV4dCgnIzQnKSxcbiAgICAgICAgdGV4dCgnQXJiZWl0ZSBhbiBEZWluZW4gRsOkaGlna2VpdGVuIScpLFxuICAgIF0pO1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgc2xpZGUgPSByZXF1aXJlKCcuLi9jb3JlL3VpL1NsaWRlJyk7XG4gICAgdmFyIHRleHQgPSByZXF1aXJlKCcuLi9jb3JlL3VpL0JpZ1RleHQnKTtcblxuICAgIHJldHVybiBzbGlkZSgnIzQ6IEFyYmVpdGUgYW4gRGVpbmVuIEbDpGhpZ2tlaXRlbiEnLCBbXG4gICAgICAgIHRleHQoJy0gQXJiZWl0ZW4gYW0gRmxpcC1DaGFydCcpLFxuICAgICAgICB0ZXh0KCctIFVtZ2FuZyBtaXQgQWt0aXZpdMOkdGVuJyksXG4gICAgICAgIHRleHQoJy0gSGlsZmUgYmVpIGRlciBFbnRzY2hlaWR1bmdzZmluZHVuZycpLFxuICAgICAgICB0ZXh0KCctIFZlcnN0ZWhlbiB1bmQgQmVlaW5mbHVzc2VuIGRlciBHcnVwcGVuZHluYW1paycpLFxuICAgICAgICB0ZXh0KCctIFZlcmJlc3NlcnVuZyBkZXIgU2VsYnN0d2Focm5laG11bmcnKSxcbiAgICBdKTtcbn0oKSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIHNsaWRlID0gcmVxdWlyZSgnLi4vY29yZS91aS9TbGlkZScpO1xuICAgIHZhciB0ZXh0ID0gcmVxdWlyZSgnLi4vY29yZS91aS9CaWdUZXh0Jyk7XG5cbiAgICByZXR1cm4gc2xpZGUoJycsIFtcbiAgICAgICAgdGV4dCgnIzUnKSxcbiAgICAgICAgdGV4dCgnR2VoZSBiZWh1dHNhbSBtaXQgTG9iIHVtIScpLFxuICAgIF0pO1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgc2xpZGUgPSByZXF1aXJlKCcuLi9jb3JlL3VpL1NsaWRlJyk7XG4gICAgdmFyIHRleHQgPSByZXF1aXJlKCcuLi9jb3JlL3VpL0JpZ1RleHQnKTtcblxuICAgIHJldHVybiBzbGlkZSgnIzU6IEdlaGUgYmVodXRzYW0gbWl0IExvYiB1bSEnLCBbXG4gICAgICAgIHRleHQoJy0gRGFzIHJlY2h0ZSBMb2IgenVyIHJlY2h0ZW4gWmVpdCBpc3QgR29sZCB3ZXJ0JyksXG4gICAgICAgIHRleHQoJy0gTWVpbmUgZXMgZWhybGljaCBvZGVyIGxhc3NlIGVzJyksXG4gICAgICAgIHRleHQoJy0gTG9iZSBBbnN0cmVuZ3VuZywgbmljaHQgSW50ZWxsaWdlbnonKSxcbiAgICBdKTtcbn0oKSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIHNsaWRlID0gcmVxdWlyZSgnLi4vY29yZS91aS9TbGlkZScpO1xuICAgIHZhciB0ZXh0ID0gcmVxdWlyZSgnLi4vY29yZS91aS9CaWdUZXh0Jyk7XG5cbiAgICByZXR1cm4gc2xpZGUoJycsIFtcbiAgICAgICAgdGV4dCgnIzYnKSxcbiAgICAgICAgdGV4dCgnRGVyIE1vZGVyYXRvciBpc3Qga2VpbiBUZWlsbmVobWVyIScpLFxuICAgIF0pO1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgc2xpZGUgPSByZXF1aXJlKCcuLi9jb3JlL3VpL1NsaWRlJyk7XG4gICAgdmFyIHRleHQgPSByZXF1aXJlKCcuLi9jb3JlL3VpL0JpZ1RleHQnKTtcblxuICAgIHJldHVybiBzbGlkZSgnJywgW1xuICAgICAgICB0ZXh0KCcjNycpLFxuICAgICAgICB0ZXh0KCdWb3JiZXJlaXR1bmcuIFZvcmJlcmVpdHVuZy4gVm9yYmVyZWl0dW5nIScpLFxuICAgIF0pO1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgc2xpZGUgPSByZXF1aXJlKCcuLi9jb3JlL3VpL1NsaWRlJyk7XG4gICAgdmFyIHRleHQgPSByZXF1aXJlKCcuLi9jb3JlL3VpL0JpZ1RleHQnKTtcblxuICAgIHJldHVybiBzbGlkZSgnIzc6IFZvcmJlcmVpdHVuZy4gVm9yYmVyZWl0dW5nLiBWb3JiZXJlaXR1bmchJywgW1xuICAgICAgICB0ZXh0KCctIFdpZXZpZWwgWmVpdCBtdXNzIGVpbmdlcGxhbnQgd2VyZGVuPycpLFxuICAgICAgICB0ZXh0KCctIFdlbGNoZSBBa3Rpdml0w6R0ZW4gc2luZCBzaW5udm9sbD8nKSxcbiAgICAgICAgdGV4dCgnLSBXaWUgdGlja3QgZGFzIFRlYW0/JyksIC8vIE1hbmFnZXIgenVyIFNlaXRlIG5laG1lblxuICAgICAgICB0ZXh0KCctIEdpYnQgZXMgZWluZW4gUGxhbiBCPycpLFxuICAgICAgICB0ZXh0KCctIEdpYnQgZXMgZWluZW4gUGxhbiBDPycpLFxuICAgIF0pO1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgc2xpZGUgPSByZXF1aXJlKCcuLi9jb3JlL3VpL1NsaWRlJyk7XG4gICAgdmFyIHRleHQgPSByZXF1aXJlKCcuLi9jb3JlL3VpL0JpZ1RleHQnKTtcblxuICAgIHJldHVybiBzbGlkZSgnJywgW1xuICAgICAgICB0ZXh0KCcjOCcpLFxuICAgICAgICB0ZXh0KCdOaW1tIERpciBhdXNyZWljaGVuZCBaZWl0IScpLFxuICAgIF0pO1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgc2xpZGUgPSByZXF1aXJlKCcuLi9jb3JlL3VpL1NsaWRlJyk7XG4gICAgdmFyIGh0bWwgPSByZXF1aXJlKCcuLi9jb3JlL3VpL0h0bWwnKTtcblxuICAgIHJldHVybiBzbGlkZSgnIzg6IE5pbW0gRGlyIGF1c3JlaWNoZW5kIFplaXQhJywgW1xuICAgICAgICBodG1sKGZ1bmN0aW9uIChoKSB7XG4gICAgICAgICAgICByZXR1cm4gaCgnZGl2LmJsb2NrJywgWydGYXVzdHJlZ2VsOiAzaCBwcm8gTW9uYXQsIGFiZXIgYmVhY2h0ZTonLCBoKCdicicpLCBoKCd1bCcsIFtcbiAgICAgICAgICAgICAgICBoKCdsaScsICdHcsO2w59lIHVuZCBadXNhbW1lbnNldHp1bmcgZGVyIEdydXBwZScpLFxuICAgICAgICAgICAgICAgIGgoJ2xpJywgJ0tvbmZsaWt0cG90ZW56aWFsJyksXG4gICAgICAgICAgICAgICAgaCgnbGknLCAnS29tcGxleGl0w6R0JyksXG4gICAgICAgICAgICAgICAgaCgnbGknLCAnUGF1c2VuJyksXG4gICAgICAgICAgICAgICAgaCgnbGknLCAnSW0gWndlaWZlbCBtZWhyIFplaXQgZWlucGxhbmVuJyksXG4gICAgICAgICAgICBdKV0pO1xuICAgICAgICB9KVxuICAgIF0pO1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgc2xpZGUgPSByZXF1aXJlKCcuLi9jb3JlL3VpL1NsaWRlJyk7XG4gICAgdmFyIHRleHQgPSByZXF1aXJlKCcuLi9jb3JlL3VpL0JpZ1RleHQnKTtcblxuICAgIHJldHVybiBzbGlkZSgnJywgW1xuICAgICAgICB0ZXh0KCcjOScpLFxuICAgICAgICB0ZXh0KCdTb3JnZSBmw7xyIEFid2VjaHNsdW5nIScpLFxuICAgIF0pO1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgc2xpZGUgPSByZXF1aXJlKCcuLi9jb3JlL3VpL1NsaWRlJyk7XG4gICAgdmFyIHRleHQgPSByZXF1aXJlKCcuLi9jb3JlL3VpL0JpZ1RleHQnKTtcblxuICAgIHJldHVybiBzbGlkZSgnIzk6IFNvcmdlIGbDvHIgQWJ3ZWNoc2x1bmchJywgW1xuICAgICAgICB0ZXh0KCdTcGVlZGJvYXQgLSBNYWQgU2FkIEdsYWQgLSBTdGFyZmlzaCcpLFxuICAgICAgICB0ZXh0KCdTdG9yeSBPc2NhcnMgLSBMZWFuIENvZmZlZScpLFxuICAgICAgICB0ZXh0KCdGaXZlIFdoeXMgLSBVbmxpa2VseSBTdXBlcmhlcm9lcycpLFxuICAgICAgICB0ZXh0KCdUaW1lbGluZSAtIFBhcmsgQmVuY2gnKSxcbiAgICAgICAgdGV4dCgnLi4uJyksXG4gICAgXSk7XG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBzbGlkZSA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvU2xpZGUnKTtcbiAgICB2YXIgdGV4dCA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvQmlnVGV4dCcpO1xuXG4gICAgcmV0dXJuIHNsaWRlKCcnLCBbXG4gICAgICAgIHRleHQoJyMxMCcpLFxuICAgICAgICB0ZXh0KCdMYXNzZSBkaWUgU3RydWt0dXIgZGVyIFJldHJvc3Bla3RpdmUgdW52ZXLDpG5kZXJ0IScpLFxuICAgIF0pO1xufSgpKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgc2xpZGUgPSByZXF1aXJlKCcuLi9jb3JlL3VpL1NsaWRlJyk7XG4gICAgLy8gdmFyIGh0bWwgPSByZXF1aXJlKCcuLi9jb3JlL3VpL0h0bWwnKTtcbiAgICB2YXIgdGV4dCA9IHJlcXVpcmUoJy4uL2NvcmUvdWkvQmlnVGV4dCcpO1xuXG4gICAgcmV0dXJuIHNsaWRlKCcjMTA6IExhc3NlIGRpZSBTdHJ1a3R1ciBkZXIgUmV0cm9zcGVrdGl2ZSB1bnZlcsOkbmRlcnQhJywgW1xuICAgICAgICAvLyBodG1sKGZ1bmN0aW9uIChoKSB7XG4gICAgICAgIC8vICAgICByZXR1cm4gaCgnb2wuYmxvY2snLCBbXG4gICAgICAgIC8vICAgICAgICAgaCgnbGknLCAnU2V0IHRoZSBTdGFnZScpLFxuICAgICAgICAvLyAgICAgICAgIGgoJ2xpJywgJ0dhdGhlciBEYXRhJyksXG4gICAgICAgIC8vICAgICAgICAgaCgnbGknLCAnR2VuZXJhdGUgSW5zaWdodHMnKSxcbiAgICAgICAgLy8gICAgICAgICBoKCdsaScsICdEZWNpZGUgV2hhdCBUbyBEbycpLFxuICAgICAgICAvLyAgICAgICAgIGgoJ2xpJywgJ0Nsb3NlIFRoZSBSZXRybycpLFxuICAgICAgICAvLyAgICAgXSk7XG4gICAgICAgIC8vIH0pXG5cbiAgICAgICAgdGV4dCgnMS4gU2V0IHRoZSBTdGFnZScpLFxuICAgICAgICB0ZXh0KCcyLiBHYXRoZXIgRGF0YScpLFxuICAgICAgICB0ZXh0KCczLiBHZW5lcmF0ZSBJbnNpZ2h0cycpLFxuICAgICAgICB0ZXh0KCc0LiBEZWNpZGUgV2hhdCB0byBEbycpLFxuICAgICAgICB0ZXh0KCc1LiBDbG9zZSB0aGUgUmV0cm8nKSxcbiAgICBdKTtcbn0oKSk7XG4iXX0=
