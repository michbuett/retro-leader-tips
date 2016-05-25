module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('#9: Try new methods', [
        text('Mad Sad Glad, Starfish,'),
        text('Story Oscars, Lean Coffey'),
        text('Unlikely Superheros, Speedboat'),
        text('Park Bench'),
        text('... and many more')
    ]);
}());
