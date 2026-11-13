// The player's physical deck (docs/02 §7.3): the app never draws for the player, it tells them what to do with
// their cards. From the public log: how many to draw and when the discard pile is shuffled into a new deck, the bid
// card to the discard pile, a hunkered card to the supply, the Fog of War from scouting or from the computer's
// Conceal, Bolster, Inspire, Recon and the end of the turn (casualties are in guide.js, with the board). The panel
// "Your cards" shows the piles as the app counts them; hand and deck only together.

import { h } from '../src/ui/dom.js';
import { t } from '../src/i18n/index.js';
import { cardName, sideName } from '../src/ui/text.js';

/** Card ids or a { type: n } count, grouped: [["RA", 2], ["SB", 1]]. */
function typeCounts(cards) {
    const n = {};
    if (Array.isArray(cards)) for (const c of cards) n[c.split(':')[1]] = (n[c.split(':')[1]] ?? 0) + 1;
    else Object.assign(n, cards ?? {});
    return Object.entries(n).filter(([, k]) => k > 0);
}

/** "Rifleman A ×2, Scout B" from card ids or a { type: n } count: one line, for a sentence. */
export function cardList(cards) {
    return typeCounts(cards).map(([type, k]) => `${cardName(type)}${k > 1 ? ` ×${k}` : ''}`).join(', ');
}

/**
 * Steps for the player's cards caused by log entry `e` (entries[i]). `op` says what the step does to the piles (the
 * tests follow it on a deck of their own): { move: [from, to] }, { draw: n, first } or { endTurn: true }.
 */
export function cardSteps(e, me, entries, i) {
    const step = (text, op) => [{ text, kind: 'cards', mine: true, op }];
    const move = (from, to) => ({ move: [from, to] });
    if (e.k === 'conceal' && e.seat !== me) return [{ text: t('cmp.c.conceal'), kind: 'cards', mine: false, op: move('supply', 'discard') }];
    if (e.k === 'bids' && e.cards[me]) return step(t('cmp.c.bid', { card: cardName(e.cards[me]) }), move('hand', 'discard'));
    if (e.seat !== me) return [];
    switch (e.k) {
        case 'draw': {
            if (!e.n) return step(t('cmp.c.drawNone'));
            const out = [];
            const round = entries.slice(0, i).findLast((x) => x.k !== 'reshuffle' && x.k !== 'draw');
            if (e.first == null) out.push(round?.k === 'round' ? t('cmp.c.drawRound', { round: round.round, n: e.n }) : t('cmp.c.draw', { n: e.n }));
            else if (e.first === 0) out.push(t('cmp.c.drawShuffleFirst', { n: e.n }));
            else out.push(t('cmp.c.drawShuffle', { first: e.first, rest: e.n - e.first }));
            if (e.n < e.want) out.push(t('cmp.c.drawShort', { n: e.n, want: e.want }));
            return step(out.join(' '), { draw: e.n, first: e.first });
        }
        case 'hunker':
            return step(t('cmp.c.hunker', { card: cardName(e.card) }), move('hand', 'supply'));
        case 'scouted':
            return e.fog ? step(t('cmp.c.fogScout', { tile: e.tile }), move('supply', 'discard')) : [];
        case 'bolster':
            return step(t('cmp.c.bolster', { card: cardName(e.card) }), move('supply', 'discard'));
        case 'inspire':
            return step(t('cmp.c.inspire', { card: cardName(e.card) }), move('play', 'hand'));
        case 'recon':
            return step(t('cmp.c.recon'), move('hand', 'removed'));
        case 'endTurn': {
            const left = entries.slice(0, i).findLast((x) => x.k === 'leftover' && x.seat === me && !entries.slice(entries.indexOf(x), i).some((y) => y.k === 'turn'));
            return step(left ? t('cmp.c.endTurnLeft', { cards: cardList(Object.fromEntries(countTypes(left.cards))) }) : t('cmp.c.endTurn'), { endTurn: true });
        }
        default:
            return [];
    }
}

const countTypes = (types) => {
    const m = new Map();
    for (const x of types) m.set(x, (m.get(x) ?? 0) + 1);
    return m;
};

/** One pile's cards as a stacked list, one line per distinct type (card ids or a { type: n } count). */
function pileCol(cards, right) {
    const types = typeCounts(cards);
    return h('div', { class: `cards-col${right ? ' right' : ''}` }, types.length ? types.map(([type, k]) => h('div', {}, `${cardName(type)}${k > 1 ? ` ×${k}` : ''}`)) : '—');
}

/** A section: its title centered on its own row, then one column of cards per side below it. */
const section = (title, meCards, botCards) => [h('div', { class: 'cards-title' }, title), pileCol(meCards), pileCol(botCards, true)];

/** Both players' cards side by side, so the same pile is easy to compare between them. */
export function cardsPanel(view, me, botSeat, { open = false } = {}) {
    const pMe = view.players[me];
    const pBot = view.players[botSeat];
    return h('details', { class: 'info cards-panel', open: open || null },
        h('summary', {}, t('cmp.cards.title')),
        h('div', { class: 'cards-grid' },
            h('div', { class: 'cards-head' }, sideName(me), h('div', {}, `(${t('cmp.you')})`)),
            h('div', { class: 'cards-head right' }, sideName(botSeat), h('div', {}, `(${t('cmp.bot')})`)),
            h('div', { class: 'cards-title' }, h('div', {}, t('cmp.deck.handDeck')), h('div', {}, t('cmp.deck.play'))),
            h('div', { class: 'cards-col' }, `${pMe.deckCount} / ${pMe.handCount}`),
            h('div', { class: 'cards-col right' }, `${pBot.deckCount} / ${pBot.handCount}`),
            pileCol(pMe.play), pileCol(pBot.play, true),
            section(t('cmp.deck.discard'), pMe.discard, pBot.discard),
            section(t('cmp.deck.supply'), pMe.supply, pBot.supply),
            section(t('cmp.deck.removed'), pMe.removed ?? [], pBot.removed ?? [])));
}

