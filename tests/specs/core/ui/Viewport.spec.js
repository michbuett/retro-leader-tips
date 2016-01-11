/* global $ */
describe('web.UI (Viewport)', function () {
    'use strict';

    var Observari = require('alchemy.js/lib/Observari');
    var UI = require('../../../../src/js/core/UI');
    var immutable = require('immutabilis');
    var uiHelper = window.uiHelper(Observari, UI);

    beforeEach(function () {
        uiHelper.setUp(this, immutable.fromJS({}));
    });

    afterEach(function () {
        uiHelper.tearDown(this);
    });

    it('is there', function () {
        // prepare
        // execute
        this.ui.update(this.state);

        // verify
        expect($('#viewport')).toExist();
    });
});
