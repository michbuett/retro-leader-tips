module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('Platz #5', [
        text('Der Moderator ist kein Teilnehmer')
    ]);
}());
