module.exports = (function () {
    'use strict';

    var Utils = require('alchemy.js/lib/Utils');

    return function text(txt, entityCss, more) {
        return Utils.melt({
            state: {
                text: txt
            },

            vdom: {
                renderer: function (ctx) {
                    var s = ctx.state;

                    return ctx.h('div', {
                        className: 'text ' + (s.val('className') || ''),
                        id: ctx.entityId,
                    }, s.val('text'));
                },
            },

            css: {
                entityRules: entityCss,

                typeRules: {
                    '.text': {
                        padding: '0 40px',
                        margin: '20px 0',
                    },
                },
            },
        }, more);
    };
}());
