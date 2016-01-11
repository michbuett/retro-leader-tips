/* global setFixtures */
(function () {
    'use strict';

    window.uiHelper = function (Observari, UI) {
        return {
            setUp: function (testRun, state) {
                testRun = testRun || this;

                setFixtures([
                    '<div id="viewport"></div>',
                ].join(''));

                testRun.messages = Observari.brew();

                testRun.state = state;

                testRun.ui = UI.brew({
                    messages: testRun.messages,
                });

                testRun.ui.init(testRun.state);
            },

            tearDown: function (testRun) {
                testRun = testRun || this;

                testRun.ui.dispose();
                testRun.messages.dispose();
                testRun.ui = null;
                testRun.state = null;
                testRun.messages = null;
            },
        };
    };
}());
