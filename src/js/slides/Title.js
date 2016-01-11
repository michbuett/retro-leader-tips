module.exports = (function () {
    'use strict';

    var Utils = require('alchemy.js/lib/Utils');
    var Slide = require('../core/ui/Slide');
    var Text = require('../core/ui/Text');

    return Utils.melt(Slide, {
        children: [Utils.melt(Text, {
            state: {
                text: 'Die 10 Wichtigsten Dinge die man über Retrospektiven wissen sollte'
            },

            css: {
                entityRules: function () {
                    return {
                        'font-size': '65px',
                    };
                },
            }
        }), Utils.melt(Text, {
            state: {
                text: 'Michael Büttner | 13.01.2016'
            },

            css: {
                entityRules: function () {
                    return {
                        'font-size': '25px',
                    };
                },
            }
        })]
    });
}());
