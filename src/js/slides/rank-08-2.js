module.exports = (function () {
    'use strict';

    var slide = require('../core/ui/Slide');
    var html = require('../core/ui/Html');

    return slide('#8: Nimm Dir ausreichend Zeit!', [
        html(function (h) {
            return h('div.block', ['Faustregel: 3h pro Monat, aber beachte:', h('br'), h('ul', [
                h('li', 'Größe und Zusammensetzung der Gruppe'),
                h('li', 'Konfliktpotenzial'),
                h('li', 'Komplexität'),
                h('li', 'Pausen'),
                h('li', 'Im Zweifel mehr Zeit einplanen'),
            ])]);
        })
    ]);
}());
