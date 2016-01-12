module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('Platz #10', [
        text('Es sollte kein Teil weggelassen werden')
    ]);
}());
