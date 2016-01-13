module.exports = (function () {
    'use strict';

    // var Utils = require('alchemy.js/lib/Utils');
    // var CenterContainer = require('../../core/ui/CenterContainer');

    return {
        /** @lends core.entities.Viewport.prototype */
        globalToLocal: {
            windowWidth: 'windowWidth',
            windowHeight: 'windowHeight',
            mode: 'mode',
            email: 'email',
        },

        vdom: {
            root: document.getElementById('viewport'),

            renderer: function renderVdom(ctx) {
                return ctx.h('button', {
                    id: ctx.entityId,
                    className: 'viewport ' + ctx.state.val('mode'),
                    tabIndex: '1',
                    autofocus: '1',
                }, [
                    ctx.h('span#email', ctx.state.val('email')),
                ].concat(ctx.renderAllChildren()));
            }
        },

        css: {
            entityRules: function (state) {
                if (state.val('mode') === 'print') {
                    return {
                        // width: '100%',
                        height: 'initial',
                    };
                }

                return {
                    width: state.val('windowWidth') + 'px',
                    height: state.val('windowHeight') + 'px',
                };
            },

            typeRules: {
                '.viewport': {
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    color: 'inherit',
                },

                '.viewport:focus': {
                    'box-shadow': 'inset 0 0 10px white',
                },

                '#email': {
                    position: 'absolute',
                    bottom: '20px',
                    right: '20px',
                }
            }
        },

        events: {
            contextmenu: function onContextMenu(event, state, sendMsg) {
                sendMsg('navigation:prev');
                event.preventDefault();
                event.stopPropagation();
            },

            click: function onClick(event, state, sendMsg) {
                sendMsg('navigation:next');
            },

            keydown: function onKeypressed(event, state, sendMsg) {
                var key = event.which || event.keyCode;
                // console.log('onKeypressed', event, key);

                if (key === 37 || key === 27 || key === 33) { // [<], [ESC], [PgUp]
                    sendMsg('navigation:prev');
                    return;
                }

                if (key === 39 || key === 13 || key === 34) { // [>], [RETURN], [PgDown]
                    sendMsg('navigation:next');
                    return;
                }
            },
        },
    };
}());
