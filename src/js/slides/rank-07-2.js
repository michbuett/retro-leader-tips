module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('#7: Vorbereitung. Vorbereitung. Vorbereitung!', [
        text('- Wieviel Zeit muss eingeplant werden?'),
        text('- Welche Aktivitäten sind sinnvoll?'),
        text('- Wie tickt das Team?'), // Manager zur Seite nehmen
        text('- Gibt es einen Plan B?'),
        text('- Gibt es einen Plan C?'),
    ]);
}());
