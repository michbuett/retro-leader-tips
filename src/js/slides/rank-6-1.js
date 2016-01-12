module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/Text');

    return slide('Platz 6', [
        text('Man muss immer mal was neues machen', {
            'font-size': '65px',
        })
    ]);
}());
