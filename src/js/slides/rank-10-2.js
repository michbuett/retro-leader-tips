module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('#10: Don\'t change the basic structure', [
        text('Set the Stage'),
        text('Gather Data'),
        text('Generate Insights'),
        text('Decide What To Do'),
        text('Close The Retro'),
    ]);
}());
