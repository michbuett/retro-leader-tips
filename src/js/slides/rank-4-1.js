module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('Platz #4', [
        text('Die Teilnehmer müssen auch mal gelobt werden'),
        text('... aber richtig'),
    ]);
}());
