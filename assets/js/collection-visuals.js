/* Small format illustrations, not previews of the teacher's content. */
(() => {
    const illustrations = {
        worksheet: '<rect x="126" y="8" width="108" height="138" rx="7" fill="#fffef8" stroke="#6f8b7d" stroke-width="3"/><path d="M142 26h76M142 36h55M180 49v76M142 94h26m24-40h26m-26 13h26m-26 13h26m-76 37h26m24-23h26m-26 13h26" stroke="#8b9e91" stroke-width="3" stroke-linecap="round"/><rect x="142" y="51" width="27" height="27" fill="#dce8d2" stroke="#6f8b7d"/><path d="M151 51v27m9-27v27m-18-18h27m-27 9h27" stroke="#6f8b7d"/>',
        wordtrail: '<rect x="104" y="15" width="152" height="122" rx="16" fill="#b8c7b9"/><path d="M128 39h48v48h48" fill="none" stroke="#226963" stroke-width="29" stroke-linecap="round" stroke-linejoin="round"/><g fill="#fffefa" font-size="20" font-weight="700" text-anchor="middle"><text x="128" y="46">A</text><text x="176" y="46">U</text><text x="176" y="94">L</text><text x="224" y="94">A</text></g>',
        connections: '<rect x="91" y="22" width="122" height="30" rx="9" fill="#c2b5df"/><rect x="91" y="60" width="122" height="30" rx="9" fill="#b4cce5"/><rect x="91" y="98" width="122" height="30" rx="9" fill="#a9d6c7"/><path d="M110 37h65m-65 38h45m-45 38h58" stroke="#463563" stroke-width="4" stroke-linecap="round"/><circle cx="255" cy="75" r="28" fill="#fffefa"/><text x="255" y="87" font-size="36" fill="#695086" text-anchor="middle">?</text>',
        slides: '<rect x="84" y="20" width="192" height="112" rx="12" fill="#153c41"/><rect x="103" y="44" width="62" height="7" rx="3" fill="#d7e6b9"/><path d="M103 68h70m-70 14h56m-56 14h43" stroke="#edf2e6" stroke-width="5" stroke-linecap="round"/><circle cx="222" cy="75" r="34" stroke="#769b90" fill="none"/><circle cx="222" cy="75" r="16" fill="#edbb56"/><circle cx="250" cy="56" r="8" fill="#c0add8"/>',
        quiz: '<rect x="98" y="16" width="164" height="120" rx="14" fill="#fffcf2"/><path d="M118 40h95m-95 12h60" stroke="#796039" stroke-width="5" stroke-linecap="round"/><rect x="115" y="61" width="130" height="26" rx="8" fill="#d7e6b9"/><path d="m126 74 5 5 10-12" stroke="#226963" stroke-width="3" fill="none"/><rect x="115" y="96" width="130" height="22" rx="7" fill="#eee8d7"/>',
        flashcards: '<rect x="119" y="23" width="134" height="99" rx="12" fill="#b9a4d1" transform="rotate(9 186 73)"/><rect x="102" y="29" width="134" height="99" rx="12" fill="#fffdf7" transform="rotate(-7 169 78)"/><text x="171" y="92" fill="#695086" font-size="48" font-weight="600" text-anchor="middle">Aa</text>',
        memory: [0,1,2,3,4,5].map((i) => `<g transform="translate(${109 + i % 3 * 50} ${27 + Math.floor(i / 3) * 52})"><rect width="42" height="44" rx="9" fill="${i === 1 || i === 4 ? '#fffefa' : '#345a8c'}"/><text x="21" y="29" text-anchor="middle" font-size="20" fill="${i === 1 || i === 4 ? '#345a8c' : '#eaf0fc'}">${i + 1}</text></g>`).join(''),
        wheel: '<circle cx="180" cy="76" r="58" fill="#eccda6"/><path d="M180 76V18a58 58 0 0 1 58 58Z" fill="#d7e6b9"/><path d="M180 76h58a58 58 0 0 1-58 58Z" fill="#c3addb"/><path d="M180 76v58a58 58 0 0 1-58-58Z" fill="#eab5a0"/><circle cx="180" cy="76" r="13" fill="#fffefa"/><path d="m168 10 12 22 12-22Z" fill="#583c32"/>',
        mindmap: '<path d="M180 76 112 37m68 39 73-36m-73 36-72 40m72-40 74 39" stroke="#719786" stroke-width="3"/><rect x="144" y="59" width="74" height="34" rx="12" fill="#226963"/><g fill="#fffefa" stroke="#a9c9b8"><rect x="77" y="23" width="70" height="27" rx="9"/><rect x="220" y="23" width="70" height="27" rx="9"/><rect x="77" y="103" width="70" height="27" rx="9"/><rect x="220" y="103" width="70" height="27" rx="9"/></g>',
        match: '<path d="m139 43 84 66m-84-1 84-65m-84 32h84" stroke="#71939e" stroke-width="3"/><g fill="#fffefa" stroke="#9cbfc9"><rect x="88" y="27" width="63" height="30" rx="9"/><rect x="88" y="62" width="63" height="30" rx="9"/><rect x="88" y="97" width="63" height="30" rx="9"/><rect x="211" y="27" width="63" height="30" rx="9"/><rect x="211" y="62" width="63" height="30" rx="9"/><rect x="211" y="97" width="63" height="30" rx="9"/></g>',
        debate: '<path d="M90 31h98q10 0 10 10v48q0 10-10 10h-61l-24 18V99H90q-10 0-10-10V41q0-10 10-10Z" fill="#d7e6b9"/><path d="M184 51h89q10 0 10 10v43q0 10-10 10h-10v17l-24-17h-55q-10 0-10-10V61q0-10 10-10Z" fill="#eab5a0"/><path d="M103 56h58m-58 16h39M199 77h58m-58 16h38" stroke="#6e654f" stroke-width="4" stroke-linecap="round"/>',
        hangman: '<path d="M126 130V24h89v19m-109 87h58" stroke="#79668f" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="215" cy="58" r="15" stroke="#79668f" stroke-width="4" fill="none"/><path d="M215 74v30m-21-16 21-10 21 10m-21 16-17 22m17-22 17 22" stroke="#79668f" stroke-width="4" fill="none" stroke-linecap="round"/>',
        lesson: '<rect x="74" y="36" width="110" height="78" rx="10" fill="#d7e6b9" transform="rotate(-7 129 75)"/><rect x="178" y="36" width="110" height="78" rx="10" fill="#d2c2e4" transform="rotate(7 233 75)"/><rect x="125" y="28" width="110" height="91" rx="12" fill="#153c41"/><path d="m169 56 26 17-26 17Z" fill="#f8f9ec"/>'
    };
    for (const type of ['wordsearch', 'crossword']) {
        illustrations[type] = Array.from({ length: 24 }, (_, i) => {
            const blocked = type === 'crossword' && [0,1,5,6,11,17,18,22,23].includes(i);
            return `<g transform="translate(${108 + i % 6 * 24} ${28 + Math.floor(i / 6) * 24})"><rect width="21" height="21" rx="3" fill="${blocked ? '#79668f' : '#fffefa'}"/>${blocked ? '' : `<text x="10.5" y="15" text-anchor="middle" font-size="13" fill="#365954">${'APRENDER'.charAt(i % 8)}</text>`}</g>`;
        }).join('');
    }
    function cover(type) {
        const safeType = Object.hasOwn(illustrations, type) ? type : 'slides';
        return `<div class="collection-cover" aria-hidden="true"><svg viewBox="0 0 360 152" focusable="false" xmlns="http://www.w3.org/2000/svg">${illustrations[safeType]}</svg></div>`;
    }
    function classIdentity(name) {
        const text = String(name || 'Turma');
        const hash = Array.from(text).reduce((value, char) => (value + char.codePointAt(0)) % 4, 0);
        const grade = text.match(/^(\d{1,2})[ºª°]?\s*(?:ano|s[ée]rie)\s*([a-z])?\b/i);
        const initials = grade ? `${grade[1]}${grade[2] || 'º'}`.toUpperCase()
            : text.match(/\p{L}|\p{N}/gu)?.slice(0, 2).join('').toUpperCase() || 'T';
        return { tone: ['mint', 'lilac', 'sand', 'blue'][hash], initials };
    }
    window.EducariaCollections = Object.freeze({ cover, classIdentity });
})();
