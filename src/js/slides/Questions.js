module.exports = (function () {
    'use strict';

    var Utils = require('alchemy.js/lib/Utils');
    var Slide = require('../core/ui/Slide');
    var Text = require('../core/ui/Text');

    return Utils.melt(Slide, {
        children: [Utils.melt(Text, {
            type: 'core.entities.Text',

            state: {
                text: 'Fragen?'
            },

            css: {
                entityRules: function () {
                    return {
                        'font-size': '65px',
                    };
                },
            }
        })]
    });
}());
