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
