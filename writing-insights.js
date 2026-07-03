/**
 * Jamie's Distraction-Free Writer — Writing Insights
 *
 * Pure client-side text analysis (no AI, no network) plus a panel renderer.
 * Imported by view.js. No build step.
 */

/* -------------------------------------------------------------------------- */
/* Word lists                                                                 */
/* -------------------------------------------------------------------------- */

const STOP_WORDS = new Set(
	( 'the a an and or but in on at to for of with by as is was are were be been being have has had do does did will would could should may might shall can it its this that these those he she they we you i my your our their his her who which what when where how if then so not no from up out about into there here also just than too very all any both' ).split(
		/\s+/
	)
);

const FILLER_WORDS = [ 'very', 'really', 'just', 'quite', 'basically', 'actually', 'literally', 'somewhat', 'probably', 'perhaps' ];

const TRANSITION_WORDS = [ 'however', 'therefore', 'moreover', 'furthermore', 'consequently', 'meanwhile', 'nevertheless', 'nonetheless', 'thus', 'hence', 'additionally', 'subsequently' ];

const PASSIVE_RE = /\b(am|is|are|was|were|be|been|being)\s+(?:being\s+)?[a-z]+(?:ed|en)\b/i;

/* -------------------------------------------------------------------------- */
/* Small helpers                                                              */
/* -------------------------------------------------------------------------- */

function countWords( text ) {
	return text.trim().split( /\s+/ ).filter( ( w ) => w.length > 0 ).length;
}

function escapeReg( s ) {
	return s.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
}

function escapeHtml( s ) {
	return String( s )
		.replace( /&/g, '&amp;' )
		.replace( /</g, '&lt;' )
		.replace( />/g, '&gt;' )
		.replace( /"/g, '&quot;' );
}

/**
 * Split text into sentences, keeping each sentence's [start, end) offset in
 * the original string (needed for inline highlights).
 */
function getSentences( text ) {
	const parts = text
		.replace( /([.!?]+)\s+(?=[A-Z])/g, '$1\n' )
		.replace( /([.!?]+)$/g, '$1\n' )
		.split( '\n' )
		.map( ( s ) => s.trim() )
		.filter( Boolean );

	const sentences = [];
	let cursor = 0;
	for ( const p of parts ) {
		const idx = text.indexOf( p, cursor );
		const start = idx === -1 ? cursor : idx;
		const end = start + p.length;
		sentences.push( { text: p, words: countWords( p ), start, end } );
		cursor = end;
	}
	return sentences;
}

/* -------------------------------------------------------------------------- */
/* Analysis engine                                                            */
/* -------------------------------------------------------------------------- */

export function analyzeDocument( plainText ) {
	const text = plainText || '';
	const wordCount = countWords( text );
	const sentences = getSentences( text );
	const sentenceCount = sentences.length;

	const paragraphs = text
		.split( /\n{2,}/ )
		.map( ( p ) => p.trim() )
		.filter( Boolean );
	const paragraphCount = paragraphs.length;

	const avgWordsPerSentence = sentenceCount
		? Math.round( ( wordCount / sentenceCount ) * 10 ) / 10
		: 0;
	const longestSentenceWords = sentences.reduce( ( m, s ) => Math.max( m, s.words ), 0 );

	let readingLevel;
	const a = avgWordsPerSentence;
	if ( a < 8 ) readingLevel = 'Grade 5 (Easy)';
	else if ( a < 14 ) readingLevel = 'Grade 8 (Standard)';
	else if ( a < 18 ) readingLevel = 'Grade 10 (Moderate)';
	else if ( a < 23 ) readingLevel = 'Grade 12 (Challenging)';
	else readingLevel = 'College (Advanced)';

	const estimatedReadTime = Math.max( 1, Math.round( wordCount / 238 ) );

	// Sentence variety distribution (chart buckets).
	const sentenceDistribution = { short: 0, medium: 0, long: 0, veryLong: 0 };
	for ( const s of sentences ) {
		const w = s.words;
		if ( w < 10 ) sentenceDistribution.short++;
		else if ( w < 20 ) sentenceDistribution.medium++;
		else if ( w < 30 ) sentenceDistribution.long++;
		else sentenceDistribution.veryLong++;
	}
	let lowVariety = false;
	if ( sentenceCount >= 4 ) {
		const maxBucket = Math.max(
			sentenceDistribution.short,
			sentenceDistribution.medium,
			sentenceDistribution.long,
			sentenceDistribution.veryLong
		);
		if ( maxBucket / sentenceCount > 0.7 ) lowVariety = true;
	}

	// Penalty / highlight thresholds (deliberately different from the chart).
	let longSentenceCount = 0;
	let veryLongSentenceCount = 0;
	for ( const s of sentences ) {
		if ( s.words > 35 ) veryLongSentenceCount++;
		else if ( s.words >= 25 ) longSentenceCount++;
	}

	// Passive voice — first match per sentence.
	let passiveCount = 0;
	const passiveHits = [];
	for ( const s of sentences ) {
		const m = PASSIVE_RE.exec( s.text );
		if ( m ) {
			passiveCount++;
			passiveHits.push( { start: s.start + m.index, len: m[ 0 ].length } );
		}
	}

	// Filler words.
	let fillerCount = 0;
	const fillerHits = [];
	for ( const f of FILLER_WORDS ) {
		const re = new RegExp( '\\b' + f + '\\b', 'gi' );
		let m;
		while ( ( m = re.exec( text ) ) !== null ) {
			fillerCount++;
			fillerHits.push( { start: m.index, len: m[ 0 ].length, word: m[ 0 ] } );
		}
	}

	// Overused words.
	const wordMatches = ( text.toLowerCase().match( /\b[a-z']+\b/g ) || [] );
	const freq = {};
	for ( const w of wordMatches ) {
		if ( ! STOP_WORDS.has( w ) && w.length > 1 ) {
			freq[ w ] = ( freq[ w ] || 0 ) + 1;
		}
	}
	const threshold = Math.max( 6, Math.floor( wordCount * 0.015 ) );
	const overusedWords = Object.entries( freq )
		.filter( ( [ , c ] ) => c > threshold )
		.sort( ( x, y ) => y[ 1 ] - x[ 1 ] )
		.slice( 0, 8 )
		.map( ( [ word, count ] ) => ( { word, count } ) );

	// Transition words.
	const transitionCounts = {};
	for ( const t of TRANSITION_WORDS ) {
		const re = new RegExp( '\\b' + t + '\\b', 'gi' );
		let m;
		let c = 0;
		while ( ( m = re.exec( text ) ) !== null ) c++;
		if ( c > 0 ) transitionCounts[ t ] = c;
	}

	// Dense paragraphs.
	let denseParagraphs = 0;
	let veryDenseParagraphs = 0;
	for ( const p of paragraphs ) {
		const w = countWords( p );
		if ( w > 180 ) veryDenseParagraphs++;
		else if ( w >= 120 ) denseParagraphs++;
	}

	// ALL CAPS words.
	let capsWordCount = 0;
	const capsHits = [];
	{
		const re = /\b[A-Z]{3,}\b/g;
		let m;
		while ( ( m = re.exec( text ) ) !== null ) {
			capsWordCount++;
			capsHits.push( { start: m.index, len: m[ 0 ].length } );
		}
	}

	// Excess punctuation + ellipsis.
	let excessPunctCount = 0;
	const excessHits = [];
	{
		const re = /[!?]{2,}|\.{4,}/g;
		let m;
		while ( ( m = re.exec( text ) ) !== null ) {
			excessPunctCount++;
			excessHits.push( { start: m.index, len: m[ 0 ].length } );
		}
	}
	let ellipsisCount = 0;
	{
		const re = /\.{3}/g;
		while ( re.exec( text ) !== null ) ellipsisCount++;
	}

	// Score.
	let penalty = Math.min( veryLongSentenceCount * 4, 20 );
	penalty += Math.min( longSentenceCount * 2, 10 );
	penalty += sentenceCount ? Math.min( ( passiveCount / sentenceCount ) * 30, 20 ) : 0;
	penalty += Math.min( fillerCount * 1.5, 15 );
	penalty += Math.min( denseParagraphs * 4 + veryDenseParagraphs * 8, 15 );
	penalty += Math.min( overusedWords.length * 3, 12 );
	const score = Math.max( 0, Math.round( 100 - penalty ) );

	let scoreLabel;
	if ( score >= 80 ) scoreLabel = 'Clean';
	else if ( score >= 60 ) scoreLabel = 'Good';
	else if ( score >= 40 ) scoreLabel = 'Needs Improvement';
	else scoreLabel = 'Hard to Read';

	// Highlights.
	const highlights = [];
	for ( const s of sentences ) {
		if ( s.words > 35 ) {
			highlights.push( { from: s.start, to: s.end, type: 'very-long', tooltip: `Very long sentence (${ s.words } words). Consider splitting.` } );
		} else if ( s.words >= 25 ) {
			highlights.push( { from: s.start, to: s.end, type: 'long', tooltip: `Long sentence (${ s.words } words). Consider splitting.` } );
		}
	}
	for ( const h of passiveHits ) {
		highlights.push( { from: h.start, to: h.start + h.len, type: 'passive', tooltip: 'Possible passive voice. Consider using active voice.' } );
	}
	for ( const h of fillerHits ) {
		highlights.push( { from: h.start, to: h.start + h.len, type: 'weak', tooltip: `Weak word: "${ h.word }". Consider removing or replacing.` } );
	}
	for ( const t of TRANSITION_WORDS ) {
		if ( ( transitionCounts[ t ] || 0 ) >= 5 ) {
			const re = new RegExp( '\\b' + escapeReg( t ) + '\\b', 'gi' );
			let m;
			while ( ( m = re.exec( text ) ) !== null ) {
				highlights.push( { from: m.index, to: m.index + m[ 0 ].length, type: 'transition-overused', tooltip: `Overused transition: "${ m[ 0 ] }". Vary your connectives.` } );
			}
		}
	}
	for ( const h of capsHits ) {
		highlights.push( { from: h.start, to: h.start + h.len, type: 'caps', tooltip: 'ALL CAPS detected. Use sparingly for emphasis.' } );
	}
	for ( const h of excessHits ) {
		highlights.push( { from: h.start, to: h.start + h.len, type: 'excess-punct', tooltip: 'Excessive punctuation. Use sparingly.' } );
	}

	return {
		wordCount, sentenceCount, paragraphCount, avgWordsPerSentence,
		longestSentenceWords, readingLevel, estimatedReadTime,
		sentenceDistribution, lowVariety, longSentenceCount, veryLongSentenceCount,
		passiveCount, fillerCount, overusedWords, transitionCounts,
		denseParagraphs, veryDenseParagraphs, capsWordCount, excessPunctCount,
		ellipsisCount, score, scoreLabel, highlights,
	};
}

/* -------------------------------------------------------------------------- */
/* Plain text extraction (shared by analysis + inline highlights)             */
/* -------------------------------------------------------------------------- */

/**
 * Build the plain text of the editor together with a map of each block-level
 * element's [start, end) offset, so highlight char offsets map back to the DOM.
 */
export function getPlainText( contentEl ) {
	const blocks = [];
	let text = '';
	const children = Array.from( contentEl.children ).filter( ( el ) => el.nodeType === 1 );
	for ( const el of children ) {
		const tag = el.tagName.toLowerCase();
		if ( [ 'figure', 'hr', 'img' ].includes( tag ) ) continue; // skip media
		const t = el.textContent;
		const start = text.length;
		text += t;
		blocks.push( { el, start, end: text.length } );
		text += '\n\n';
	}
	text = text.replace( /\n\n$/, '' );
	return { text, blocks };
}

/* -------------------------------------------------------------------------- */
/* Panel rendering                                                            */
/* -------------------------------------------------------------------------- */

const HL_LEGEND = [
	{ type: 'very-long', color: 'rgb(239,68,68)', label: 'Very long sentence (35+ words)' },
	{ type: 'long', color: 'rgb(251,146,60)', label: 'Long sentence (25–35 words)' },
	{ type: 'passive', color: 'rgb(59,130,246)', label: 'Passive voice' },
	{ type: 'weak', color: 'rgb(168,85,247)', label: 'Weak / filler word' },
	{ type: 'transition-overused', color: 'rgb(245,158,11)', label: 'Overused transition' },
	{ type: 'caps', color: 'rgb(234,179,8)', label: 'ALL CAPS word' },
	{ type: 'excess-punct', color: 'rgb(239,68,68)', label: 'Excessive punctuation' },
];

const SCORE_COLORS = { 'Clean': '#10b981', 'Good': '#3b82f6', 'Needs Improvement': '#f59e0b', 'Hard to Read': '#ef4444' };
const SCORE_DESC = {
	'Clean': 'Well structured, clear writing.',
	'Good': 'A few things to tighten up.',
	'Needs Improvement': 'Several issues worth addressing.',
	'Hard to Read': 'Complex sentences and structure.',
};

const VARIETY_ROWS = [
	{ key: 'short', label: 'Short &lt;10', color: '#10b981' },
	{ key: 'medium', label: 'Medium 10–20', color: '#3b82f6' },
	{ key: 'long', label: 'Long 20–30', color: '#f59e0b' },
	{ key: 'veryLong', label: 'Very long 30+', color: '#ef4444' },
];

function statRow( label, value ) {
	return `<div class="wi-stat"><span class="wi-stat-label">${ label }</span><span class="wi-stat-value">${ value }</span></div>`;
}

export function renderPanel( r ) {
	const circ = 2 * Math.PI * 22;
	const dash = ( r.score / 100 ) * circ;
	const color = SCORE_COLORS[ r.scoreLabel ];

	// Highlight counts per type.
	const counts = {};
	for ( const h of r.highlights ) counts[ h.type ] = ( counts[ h.type ] || 0 ) + 1;

	let html = '';

	// 1. Writing score.
	html += `<section class="wi-section">
		<div class="wi-section-label">Writing Score</div>
		<div class="wi-score">
			<svg class="wi-gauge" viewBox="0 0 56 56" width="56" height="56" aria-hidden="true">
				<circle cx="28" cy="28" r="22" fill="none" stroke="currentColor" class="wi-gauge-track" stroke-width="5"></circle>
				<circle cx="28" cy="28" r="22" fill="none" stroke="${ color }" stroke-width="5" stroke-linecap="round"
					stroke-dasharray="${ dash.toFixed( 2 ) } ${ circ.toFixed( 2 ) }" transform="rotate(-90 28 28)"></circle>
				<text x="28" y="28" text-anchor="middle" dominant-baseline="central" class="wi-gauge-num">${ r.score }</text>
			</svg>
			<div class="wi-score-text">
				<div class="wi-score-label" style="color:${ color }">${ r.scoreLabel }</div>
				<div class="wi-score-desc">${ SCORE_DESC[ r.scoreLabel ] }</div>
			</div>
		</div>
	</section>`;

	// 2. Readability.
	html += `<section class="wi-section">
		<div class="wi-section-label">Readability</div>
		${ statRow( 'Words', r.wordCount ) }
		${ statRow( 'Sentences', r.sentenceCount ) }
		${ statRow( 'Paragraphs', r.paragraphCount ) }
		${ statRow( 'Avg words / sentence', r.avgWordsPerSentence ) }
		${ statRow( 'Longest sentence', r.longestSentenceWords + ' words' ) }
		${ statRow( 'Reading level', r.readingLevel ) }
		${ statRow( 'Est. read time', r.estimatedReadTime + ' min' ) }
	</section>`;

	// 3. Sentence variety.
	const total = r.sentenceCount || 1;
	let bars = '';
	for ( const row of VARIETY_ROWS ) {
		const count = r.sentenceDistribution[ row.key ];
		const pct = Math.round( ( count / total ) * 100 );
		bars += `<div class="wi-bar-row">
			<span class="wi-bar-label">${ row.label }</span>
			<span class="wi-bar-track"><span class="wi-bar-fill" style="width:${ pct }%;background:${ row.color }"></span></span>
			<span class="wi-bar-count">${ count }</span>
		</div>`;
	}
	html += `<section class="wi-section">
		<div class="wi-section-label">Sentence Variety</div>
		${ bars }
		${ r.lowVariety ? '<div class="wi-warn">Low sentence variety — try mixing lengths.</div>' : '' }
	</section>`;

	// 4. Active highlights.
	let legend = '';
	for ( const item of HL_LEGEND ) {
		const c = counts[ item.type ] || 0;
		legend += `<div class="wi-legend-row${ c === 0 ? ' wi-dim' : '' }">
			<span class="wi-swatch" style="background:${ item.color }"></span>
			<span class="wi-legend-label">${ item.label }</span>
			<span class="wi-legend-count">${ c }</span>
		</div>`;
	}
	html += `<section class="wi-section">
		<div class="wi-section-label">Active Highlights</div>
		${ legend }
	</section>`;

	// 5. Overused words.
	if ( r.overusedWords.length > 0 ) {
		let pills = '';
		for ( const o of r.overusedWords ) {
			pills += `<span class="wi-pill">${ escapeHtml( o.word ) } <b>${ o.count }×</b></span>`;
		}
		html += `<section class="wi-section">
			<div class="wi-section-label">Overused Words</div>
			<div class="wi-pills">${ pills }</div>
		</section>`;
	}

	// 6. Transition words.
	const transEntries = Object.entries( r.transitionCounts ).sort( ( x, y ) => y[ 1 ] - x[ 1 ] );
	if ( transEntries.length > 0 ) {
		let rows = '';
		for ( const [ word, count ] of transEntries ) {
			const over = count >= 5;
			rows += `<div class="wi-trans-row${ over ? ' wi-trans-over' : '' }">
				<span>${ over ? '⚠️ ' : '' }${ escapeHtml( word ) }</span>
				<span class="wi-trans-count">${ count }×</span>
			</div>`;
		}
		html += `<section class="wi-section">
			<div class="wi-section-label">Transition Words</div>
			${ rows }
		</section>`;
	}

	// 7. Alerts.
	const alerts = [];
	if ( r.veryDenseParagraphs > 0 ) alerts.push( `${ r.veryDenseParagraphs } very dense paragraph${ r.veryDenseParagraphs > 1 ? 's' : '' } (180+ words) — consider breaking up.` );
	if ( r.denseParagraphs > 0 ) alerts.push( `${ r.denseParagraphs } dense paragraph${ r.denseParagraphs > 1 ? 's' : '' } (120–180 words).` );
	if ( r.capsWordCount > 0 ) alerts.push( `${ r.capsWordCount } ALL CAPS word${ r.capsWordCount > 1 ? 's' : '' } — use sparingly.` );
	if ( r.excessPunctCount > 0 ) alerts.push( `Excessive punctuation detected (${ r.excessPunctCount }).` );
	if ( r.ellipsisCount > 2 ) alerts.push( `${ r.ellipsisCount } ellipses — consider trimming.` );
	if ( alerts.length > 0 ) {
		let boxes = '';
		for ( const a2 of alerts ) boxes += `<div class="wi-alert">${ escapeHtml( a2 ) }</div>`;
		html += `<section class="wi-section">
			<div class="wi-section-label">Alerts</div>
			${ boxes }
		</section>`;
	}

	return html;
}

/* -------------------------------------------------------------------------- */
/* Inline highlights (Stage 2)                                                */
/*                                                                            */
/* Highlight offsets from analyzeDocument() are in the getPlainText() model   */
/* (blocks joined by "\n\n"). We map each highlight to its block, then wrap   */
/* the character range in <span class="wi-hl-TYPE" title="…"> nodes. Wrapping  */
/* never changes textContent, so caret offsets stay valid across re-renders.  */
/* -------------------------------------------------------------------------- */

// Remove every highlight span, restoring the original text nodes.
export function stripHighlights( contentEl ) {
	const spans = contentEl.querySelectorAll( 'span[class*="wi-hl-"]' );
	spans.forEach( ( span ) => {
		const parent = span.parentNode;
		while ( span.firstChild ) {
			parent.insertBefore( span.firstChild, span );
		}
		parent.removeChild( span );
	} );
	contentEl.normalize();
}

// Wrap [s, e) of a single text node in a highlight span.
function wrapTextPortion( textNode, s, e, cls, title ) {
	let node = textNode;
	if ( s > 0 ) {
		node = node.splitText( s );
	}
	if ( node.length > e - s ) {
		node.splitText( e - s );
	}
	const span = document.createElement( 'span' );
	span.className = cls;
	if ( title ) {
		span.setAttribute( 'title', title );
	}
	node.parentNode.insertBefore( span, node );
	span.appendChild( node );
}

// Apply one highlight within a block element, over local [start, end).
function applyOneHighlight( blockEl, start, end, cls, title ) {
	const walker = document.createTreeWalker( blockEl, NodeFilter.SHOW_TEXT );
	let pos = 0;
	const segments = [];
	let n;
	while ( ( n = walker.nextNode() ) ) {
		const nodeStart = pos;
		const nodeEnd = pos + n.length;
		pos = nodeEnd;
		const from = Math.max( start, nodeStart );
		const to = Math.min( end, nodeEnd );
		if ( from < to ) {
			segments.push( { node: n, s: from - nodeStart, e: to - nodeStart } );
		}
	}
	// Each segment is in a distinct text node, so wrapping one doesn't disturb
	// the offsets of the others.
	for ( const seg of segments ) {
		wrapTextPortion( seg.node, seg.s, seg.e, cls, title );
	}
}

// Apply all highlights. `blocks` is the map returned by getPlainText().
export function applyHighlights( contentEl, highlights, blocks ) {
	for ( const h of highlights ) {
		const block = blocks.find( ( b ) => h.from >= b.start && h.to <= b.end );
		if ( ! block ) {
			continue; // crosses a block boundary or targets media — skip.
		}
		applyOneHighlight(
			block.el,
			h.from - block.start,
			h.to - block.start,
			'wi-hl-' + h.type,
			h.tooltip
		);
	}
}

/* -------------------------------------------------------------------------- */
/* Caret preservation across re-render                                        */
/* -------------------------------------------------------------------------- */

// Absolute character offset of the caret within contentEl (raw text, no
// separators). Returns null if the caret isn't inside the editor.
export function getCaretOffset( contentEl ) {
	const sel = window.getSelection();
	if ( ! sel || sel.rangeCount === 0 ) {
		return null;
	}
	const range = sel.getRangeAt( 0 );
	if ( ! contentEl.contains( range.startContainer ) ) {
		return null;
	}
	const pre = document.createRange();
	pre.selectNodeContents( contentEl );
	try {
		pre.setEnd( range.startContainer, range.startOffset );
	} catch ( e ) {
		return null;
	}
	return pre.cloneContents().textContent.length;
}

// Restore the caret to a raw-text character offset.
export function setCaretOffset( contentEl, offset ) {
	if ( offset == null ) {
		return;
	}
	const walker = document.createTreeWalker( contentEl, NodeFilter.SHOW_TEXT );
	let pos = 0;
	let n;
	while ( ( n = walker.nextNode() ) ) {
		const next = pos + n.length;
		if ( offset <= next ) {
			const range = document.createRange();
			range.setStart( n, Math.max( 0, offset - pos ) );
			range.collapse( true );
			const sel = window.getSelection();
			sel.removeAllRanges();
			sel.addRange( range );
			return;
		}
		pos = next;
	}
}
