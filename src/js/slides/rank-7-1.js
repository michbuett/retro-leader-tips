module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/Text');

    return slide('Platz 7', [
        text('Vorbereitung, Vorbereitung, Vorbereitung.', {
            'font-size': '65px',
        })
    ]);
}());
