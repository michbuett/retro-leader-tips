module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('Platz #10', [
        text('Set the Stage - Gather Data - Generate Insights - Decide What To Do - Close The Retro'),
        text('Es sollte kein Teil weggelassen werden')
    ]);
}());
