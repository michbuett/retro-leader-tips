module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('', [
        text('#3'),
        text('Gehe offen in die Retrospektive!'),
    ]);
}());
