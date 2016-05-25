module.exports = (function () {
    'use strict';

    return function html(render, entityCss) {
        return {
            vdom: {
                renderer: function (ctx) {
                    return render(ctx.h, ctx.state);
                },
            },

            css: {
                entityRules: entityCss,
            },
        };
    };
}());

