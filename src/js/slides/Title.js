module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var html = require('../core/ui/Html');

    return slide('', [
        html(function (h) {
            return h('div.title-block', [
                h('div.speaker', 'Michael Büttner | Flyeralarm'),
                h('div.title', 'Die 10 wichtigsten Dinge, die man beim Moderieren einer Retrospektive beachten sollte'),
            ]);
        })
    ]);
}());
