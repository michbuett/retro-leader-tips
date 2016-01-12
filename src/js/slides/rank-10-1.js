module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/Text');

    return slide('Platz 10', [
        text('Es sollte kein Teil weggelassen werden', {
            'font-size': '65px',
        })
    ]);
}());
