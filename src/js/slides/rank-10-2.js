module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    // var html = require('../core/ui/Html');
    var text = require('../core/ui/BigText');

    return slide('#10: Lasse die Struktur der Retrospektive unverändert!', [
        // html(function (h) {
        //     return h('ol.block', [
        //         h('li', 'Set the Stage'),
        //         h('li', 'Gather Data'),
        //         h('li', 'Generate Insights'),
        //         h('li', 'Decide What To Do'),
        //         h('li', 'Close The Retro'),
        //     ]);
        // })

        text('1. Set the Stage'),
        text('2. Gather Data'),
        text('3. Generate Insights'),
        text('4. Decide What to Do'),
        text('5. Close the Retro'),
    ]);
}());
