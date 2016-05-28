module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('', [
        text('#10'),
        text('Lasse die Struktur der Retrospektive unverändert!'),
    ]);
}());
