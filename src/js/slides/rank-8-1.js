module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/Text');

    return slide('Platz 8', [
        text('Ein Moderator braucht im Ärmel einen Plan-B im Schuh einen Plan C', {
            'font-size': '65px',
        })
    ]);
}());
