module.exports = (function () {
    'use strict';

    var Utils = require('alchemy.js/lib/Utils');

    return function slide(title, children, more) {
        if (Array.isArray(title)) {
            more = children;
            children = title;
            title = '';
        }

        return Utils.melt({
            globalToLocal: {
                mode: 'mode',
                windowWidth: 'windowWidth',
                windowHeight: 'windowHeight',
                currentIndex: 'currentIndex'
            },

            state: {
                title: title,
                index: 0,
            },

            vdom: {
                renderer: function (ctx) {
                    var h = ctx.h;
                    var s = ctx.state.val();
                    var isActive = s.mode === 'print' || s.currentIndex === s.index;

                    return h('div.slide', {
                        id: ctx.entityId,
                        key: ctx.entityId,
                        className: isActive ? 'active' : 'hidden',
                    }, [
                        h('div.slide-title', ctx.state.val('title')),
                        h('div.slide-inner', ctx.renderAllChildren()),
                    ]);
                },
            },

            css: {
                entityRules: function (state) {
                    if (state.val('mode') === 'print') {
                        return {
                            left: 0,
                        };
                    }

                    var index = state.val('index');
                    var cIndex = state.val('currentIndex');
                    var width = state.val('windowWidth');

                    return {
                        left: (index - cIndex) * width + 'px',
                    };
                },

                typeRules: {
                    '.slide': {
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        display: 'table',
                        'text-align': 'center',

                        '.slide-title': {
                            position: 'absolute',
                            top: '20px',
                            left: '20px',
                        },

                        '.slide-inner': {
                            width: '100%',
                            display: 'table-cell',
                            'vertical-align': 'middle',
                            transition: 'opacity 0.2s ease-in-out',
                        },
                    },

                    '.slide.active': {
                        transition: 'left 0.2s step-start',
                    },

                    '.slide.hidden': {
                        transition: 'left 0.2s linear',
                    },

                    '.slide.hidden .slide-title': {
                        visibility: 'hidden',
                    },

                    '.slide.hidden .slide-inner': {
                        opacity: 0,
                    },

                    '.print .slide': {
                        position: 'relative',
                        width: '420mm', // DIN A3 (ISO 216) landscape
                        height: '297mm',
                    },
                },
            },

            children: children,
        }, more);
    };
}());
