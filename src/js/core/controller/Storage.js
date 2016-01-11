module.exports = (function () {
    'use strict';

    var STORAGE_KEY = 'alchemy-presenter';
    var coquoVenenum = require('coquo-venenum');

    /**
     * @class
     * @name todo.controller.Storage
     */
    return coquoVenenum({

        messages: {
            'app:start': 'onAppStart',
            'app:update': 'onAppUpdate',
        },

        /** @private */
        onAppStart: function (state) {
            var initialState = localStorage.getItem(STORAGE_KEY);
            if (initialState) {
                state = state.set(JSON.parse(initialState));
            }

            this.state = state;

            return state;
        },

        /** @private */
        onAppUpdate: function (state) {
            if (state !== this.state) {
                this.state = state;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state.val()));
            }

            return state;
        },
    });
}());
