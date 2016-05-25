module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var html = require('../core/ui/Html');

    return slide('', [
        html(function (h) { return h('div.speaker', 'Michael Büttner | Flyeralarm'); }),
        html(function (h) { return h('div.title', 'The 10 Most Important Tips for the Retrospective Facilitator'); }),
    ]);
}());
