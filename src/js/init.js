(function () {
    'use strict';

    var each = require('pro-singulis');
    var App = require('./core/App');
    var UI = require('./core/UI');
    var Observari = require('alchemy.js/lib/Observari');
    var messages, ui, app;
    var slides = each([
        require('./slides/Title'),
        require('./slides/rank-10-1'),
        require('./slides/rank-9-1'),
        require('./slides/rank-8-1'),
        require('./slides/rank-7-1'),
        require('./slides/rank-6-1'),
        require('./slides/rank-5-1'),
        require('./slides/rank-4-1'),
        require('./slides/rank-3-1'),
        require('./slides/rank-2-1'),
        require('./slides/rank-1-1'),
        require('./slides/Sources'),
        require('./slides/Questions'),
    ], function (slide, index) {
        slide.state = slide.state || {};
        slide.state.index = index;

        return slide;
    });

    window.onload = function onLoad() {
        messages = Observari.brew();

        ui = UI.brew({
            messages: messages,
            slides: slides
        });

        app = App.brew({
            ui: ui,
            messages: messages,
        });

        app.state = app.state.set({
            numOfSlides: slides.length,
        });

        app.launch();

        window.app = app; // global reference for debugging
    };

    window.onunload = function onUnload() {
        [app, ui, messages].forEach(function (obj) {
            obj.dispose();
        });

        window.app = null;
    };
}());