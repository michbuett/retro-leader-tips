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
