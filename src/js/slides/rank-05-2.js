module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var text = require('../core/ui/BigText');

    return slide('#5: Gehe behutsam mit Lob um!', [
        text('- Das rechte Lob zur rechten Zeit ist Gold wert'),
        text('- Meine es ehrlich oder lasse es'),
        text('- Lobe Anstrengung, nicht Intelligenz'),
    ]);
}());
