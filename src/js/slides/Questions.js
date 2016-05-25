module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/Text');

    return slide([
        text('Questions', {
            'font-size': '65px',
        })
    ]);
}());
