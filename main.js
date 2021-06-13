$(function() {
    const PLACEHOLDER = '*';

    class CompositionKind {
        /**
         * @param {string} id
         */
        constructor(id) {
            this.id = id;
        }
    }
    const COMPOSITION_KIND = Object.freeze({
        'Primitive': new CompositionKind('一'),
        'Horizontal': new CompositionKind('吅'),
        'Vertical': new CompositionKind('吕'),
        'Inclusion': new CompositionKind('回'),
        'VerticalTopRepetition': new CompositionKind('咒'),
        'HorizontalLeftRightRepetition': new CompositionKind('弼'),
        'ThreeRepetition': new CompositionKind('品'),
        'FourRepetition': new CompositionKind('叕'),
        'VerticalSeparated': new CompositionKind('冖'),
        'Superposition': new CompositionKind('+'),
        'Unknown': new CompositionKind('*')
    });
    const COMPOSITION_KIND_BY_ID = {};
    for (let name in COMPOSITION_KIND) {
        if (!(COMPOSITION_KIND.hasOwnProperty(name))) continue;
        COMPOSITION_KIND_BY_ID[COMPOSITION_KIND[name].id] = COMPOSITION_KIND[name];
    }

    class Char {
        /**
         * @param {string} hanzi
         * @param {int} numStrokes
         * @param {string} cangjie
         * @param {string} verification
         * @param {CompositionKind} compKind
         * @param {Array.<Char|string>} components
         * @param {Char|string|null} radical
         */
        constructor(hanzi, numStrokes, cangjie, verification, compKind,
                    components, radical) {
            this.hanzi = hanzi;
            this.numStrokes = numStrokes;
            this.cangjie = cangjie;
            this.verification = verification;
            this.compKind = compKind;
            this.components = components;
            this.radical = radical;
        }

        /**
         * Replaces hanzi strings with actual chars.
         * @param {Object.<Char>} knownChars
         */
        setupComponents(knownChars) {
            let self = this;
            this.components = this.components.map(function(hanzi) {
                if (knownChars.hasOwnProperty(hanzi)) {
                    return knownChars[hanzi];
                } else {
                    console.log("Cannot find component", hanzi, "for char", self);
                    return hanzi;
                }
            });
            if (this.radical !== null) {
                if (knownChars.hasOwnProperty(this.radical)) {
                    this.radical = knownChars[this.radical];
                } else {
                    console.log("Cannot find radical", this.radical, "for char", this);
                }
            }
            for (let comp of this.components) {
                console.assert(comp !== undefined);
            }
            console.assert(this.radical !== undefined);
        }

        /**
         * @param {Object.<Char>} knownChars
         * @return {Array.<Char>}
         */
        getCompounds(knownChars) {
            /** @type Array.<Char> */
            let componentOf = [];
            for (let hanzi in knownChars) {
                if (!(knownChars.hasOwnProperty(hanzi))) continue;
                let char = knownChars[hanzi];
                if (char.components.includes(this) || char.radical === this) {
                    componentOf.push(char);
                }
            }
            return componentOf
        }

        /**
         * @param {Object.<Set.<Word>>} words
         * @return {Array.<Word>}
         */
        getContainingWords(words) {
            /** @type Array.<Word> */
            let usedIn = [];
            for (let hanzi in words) {
                if (!(words.hasOwnProperty(hanzi))) continue;
                for (let word of words[hanzi]) {
                    if (word.chars.map(char => char.hanzi).includes(this.hanzi)) {
                        usedIn.push(word);
                    }
                }
            }
            return usedIn
        }
    }

    /** @type Object.<Char> */
    let chars = {};

    let loadCompositionData = function(tsvFile) {
        let lines = tsvFile.split('\n');
        /** @type Object.<Char> */
        chars = {};
        for (let line of lines) {
            line = line.trim();
            if (line.length === 0) continue;
            let lineSplit = line.split('\t');
            console.assert(lineSplit.length === 10);
            let [hanzi, numStrokes, compKind, firstPartChar, firstPartNumStrokes, secondPartChar, secondPartNumStrokes,
                cangjie, verification, radical] = lineSplit;
            numStrokes = parseInt(numStrokes);
            firstPartNumStrokes = parseInt(firstPartNumStrokes);
            secondPartNumStrokes = parseInt(secondPartNumStrokes);
            compKind = COMPOSITION_KIND_BY_ID[compKind];
            console.assert(compKind !== undefined);
            /** @type Array.<string> */
            let components = []
            if (firstPartChar !== hanzi && firstPartChar !== PLACEHOLDER) {
                components.push(firstPartChar);
            }
            if (secondPartChar !== hanzi && secondPartChar !== PLACEHOLDER) {
                components.push(secondPartChar);
            }
            if (radical === hanzi || radical === PLACEHOLDER) {
                radical = null;
            }
            chars[hanzi] = new Char(hanzi, numStrokes, cangjie, verification, compKind, components, radical);
        }
        for (let hanzi in chars) {
            if (!(chars.hasOwnProperty(hanzi))) continue;
            chars[hanzi].setupComponents(chars);
        }
    };

    class Word {
        /**
         * @param {Array.<Char>} chars
         * @param {string} pinyin
         * @param {string} translation
         */
        constructor(chars, pinyin, translation) {
            console.assert(chars.length >= 1);
            this.chars = chars;
            this.pinyin = pinyin;
            this.translation = translation;
        }

        /**
         * @return {string}
         */
        get hanzi() {
            return this.chars.map(char => char.hanzi).join('');
        }
    }

    /** @type Object.<Set.<Word>> */
    let words = {};

    /**
     * @param {string} tsvFile
     * @param {Object.<Char>} knownChars
     */
    let loadWordList = function(tsvFile, knownChars) {
        let lines = tsvFile.split('\n');
        for (let line of lines) {
            line = line.trim();
            if (line.length === 0) continue;
            let lineSplit = line.split('\t');
            console.assert(lineSplit.length === 5);
            let [hanzi, hanziTraditional, pinyin, pinyinUnicode, translation] = lineSplit;
            let charHanzi = hanzi.split('');
            /** @type Array.<Char> */
            let wordChars = charHanzi.map(hanzi => knownChars[hanzi]);
            let word = new Word(wordChars, pinyin, translation);
            console.assert(word.hanzi === hanzi);
            if (!words.hasOwnProperty(hanzi)) {
                words[hanzi] = new Set();
            }
            words[hanzi].add(word);
        }
    };

    $.get('/ccd.tsv', function(tsvFile) {
        loadCompositionData(tsvFile);
    }).then(function() {
        for (let num = 1; num <= 6; num++) {
            $.get(`/hsk${num}.tsv`, function (tsvFile) {
                loadWordList(tsvFile, chars);
            });
        }
    }).then(function() {
        updatePage(decodeURIComponent(location.href.split('#')[1]) || '');
    });

    let updatePage = function(term) {
        $('#search-char').val(term);
        $('head title').html(term);
        let foundResults = false;

        /**
         * @param {Char|string|null} char
         */
        let makeCharHtml = function(char) {
            if (char === null) {
                return '-';
            }
            if (!(char instanceof Char)) {
                return `<a class="char">${char}</a>`;
            }
            return `<a class="char" href="#${char.hanzi}">${char.hanzi}</a>`;
        }
        /**
         * @param {Word} word
         */
        let makeWordHtml = function(word) {
            return `<a class="word" href="#${word.hanzi}">${word.hanzi}</a>`;
        }

        let charInfo = $('#char-info');
        if (chars.hasOwnProperty(term)) {
            let char = chars[term];
            console.log(char);
            charInfo.children('.num-strokes').html(char.numStrokes.toString());
            charInfo.children('.comp-kind').html(char.compKind.id);
            charInfo.children('.components').html(char.components.map(makeCharHtml).join(', '));
            charInfo.children('.radical').html(makeCharHtml(char.radical));
            charInfo.children('.compounds').html(char.getCompounds(chars).map(makeCharHtml).join(', '));
            charInfo.children('.containing-words').html(char.getContainingWords(words).map(makeWordHtml).join(', '));
            charInfo.show();
            foundResults = true;
        } else {
            charInfo.hide();
        }
        let wordList = $('#word-list');
        wordList.html('');
        if (words.hasOwnProperty(term)) {
            for (let word of words[term]) {
                console.log(word);
                wordList.append('<div class="word-info">' +
                    `Characters: ${word.chars.map(makeCharHtml).join(', ')}<br>` +
                    `Pinyin: ${pinyinify(word.pinyin)}<br>` +
                    `Translation: ${word.translation}` + '</div>')
                foundResults = true;
            }
        }

        if (foundResults) {
            $('#nothing-found').hide();
            $('#results').show();
        } else {
            $('#nothing-found').show();
            $('#results').hide();
        }
    };

    $('#search-char').on('change', function() {
        updatePage($(this).val());
    });
    $(window).on('hashchange', function() {
        // see https://stackoverflow.com/a/1704842/2766231
        updatePage(decodeURIComponent(location.href.split('#')[1]) || '');
    });
});
