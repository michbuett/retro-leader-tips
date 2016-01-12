module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/Text');

    return slide('Platz 2', [
        text('Lösungen kommen von den Teilnehmern, nicht dem Moderartor', {
            'font-size': '65px',
        })
    ]);
}());
