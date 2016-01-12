module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/Text');

    return slide('Platz 9', [
        text('Ein Retro dauert so lange wie sie dauert', {
            'font-size': '65px',
        })
    ]);
}());
