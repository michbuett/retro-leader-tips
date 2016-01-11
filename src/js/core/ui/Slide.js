module.exports = (function () {
    'use strict';

    return {
        globalToLocal: {
            mode: 'mode',
            currentIndex: 'currentIndex'
        },

        state: {
            title: '',
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
                        'font-style': 'italic',
                        'font-size': '30px',
                    },

                    '.slide-inner': {
                        width: '100%',
                        display: 'table-cell',
                        transition: 'opacity 0.2s ease-in-out',
                        'vertical-align': 'middle',
                    },

                },

                '.slide.hidden .slide-title': {
                    visibility: 'hidden',
                },

                '.slide.hidden .slide-inner': {
                    opacity: 0,
                },

                '.print .slide': {
                    position: 'relative',
                    width: '420mm',
                    height: '1052px',
                },
            },
        },
    };
}());
