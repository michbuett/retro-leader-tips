module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('Platz #1', [
        text('Don\'t Panik', {
            'font-size': '90px'
        })
    ]);
}());
