# Reference — feature map

Where each capability is shown, once.

## Block types

| type | shown in | notes |
|---|---|---|
| `p` | §1.1 | prose |
| `def` | §1.1, §1.2, §1.4, §5.2 | `term` feeds the "Before you start" panel |
| `key` | §1.1, §1.4, §3.1 | a rule to remember |
| `trap` | §1.2, §1.3, §4.3, §5.2 | the mistake people actually make |
| `note` | §1.1, §1.5, §2.1 | usually `depth` |
| `ex` | §1.2, §2.2, §3.2 | fully stepped |
| `attempt` | §1.2, §2.2 | first block only; feeds calibration |
| `list` | §1.1, §1.5, §2.2 | ordered and unordered |
| `table` | §1.3, §1.4, §5.1 | plain, `mono` (+ `split`), `map` |
| `code` | §5.1 | highlighted by course `syntax` |
| `math` | §3.1 | `label` + `note`; rendered at build time |
| `figure` | §4.1–§4.3 | nine kinds |
| `image` | §5.2 | with and without caption |
| `metric` | §3.1 | custom, from `blocks.js` |

## Figure kinds

`graph` (§4.1, circle + layered) · `flow` (§4.1, row + col) · `timing` (§4.1) ·
`plot` (§4.2, `fn` + `points` + `dash` + ranges) · `bar` (§4.2, `baseline` +
`accent`) · `scatter` (§4.2, `trend`) · `grid` (§4.3, `index: binary` +
`groups`) · `matrix` (§4.3) · `svg` (§4.3, escape hatch).

## References

`<a href="#s2-2">` subsection · `<c k="tier">` concept · `<f k="loop-machine"/>`
figure · `<a href="#/ma26600/">` cross-course.

## Tiers

`spine` — the whole course, once. `depth` — why / what-if, never examinable.
`apply` — another instance. Lane selector: Spine · Spine+Apply · All. Collapsed
runs show a stub with a text count. Read for the reader in §1.4, for the author
in §3.2.

## Source badges

Real origin → plain badge. `unverified` → "not grounded in a named source"
(§5.2). `generated` → model-drafted, counts as unverified (§5.2). Blank →
not-yet-audited, counted separately.

## Course-level

`valueStyles`, `styles`, `syntax` (comment / keywords / patterns / strings),
`theme.hue`, `state.enabled`, `blocks.js`. The optional `legend` chips are not
used here: §1.4 teaches the tier vocabulary in the material itself, where it can
say what the words are for.
