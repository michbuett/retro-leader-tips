module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('Platz #8', [
        text('Ein Moderator braucht im Ärmel einen Plan B'),
        text('... und im Schuh einen Plan C')
    ]);
}());
