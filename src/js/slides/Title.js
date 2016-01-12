module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/Text');

    return slide([
        text('Die 10 wichtigsten Dinge die ein Moderator über Retrospektiven wissen sollte', {
            'font-size': '65px',
        }),

        text('Michael Büttner | 13.01.2016', {
            'font-size': '25px',
        }),
    ]);
}());
