module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/Text');

    return slide('Platz 3', [
        text('Auch der Moderator muss sich verbessern', {
            'font-size': '65px',
        })
    ]);
}());
