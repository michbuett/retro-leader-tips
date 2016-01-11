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
            this.ui.update(p.state);
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
