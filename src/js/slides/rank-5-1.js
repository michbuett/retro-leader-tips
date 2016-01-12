module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/Text');

    return slide('Platz 5', [
        text('Der Moderator ist kein Teilnehmer', {
            'font-size': '65px',
        })
    ]);
}());
