# MCP server

`remove-profanity` ships an [MCP](https://modelcontextprotocol.io) server, so
an agent can moderate text by calling a tool instead of writing code against
the library. It is a `bin` in this same package: nothing changes for a consumer
who imports the library and never runs it, and the package still has **zero
runtime dependencies**.

> ⚠️ As everywhere under `docs/`, the examples below mask one letter of every
> real term (`bh#sdike`, `f*ck`, `भोसड़*के`). The server returns them unmasked —
> reporting the term is the whole job.

## Contents

- [Install and configure](#install-and-configure)
- [The four tools](#the-four-tools)
- [Why it is read-only](#why-it-is-read-only)
- [Choosing which languages load](#choosing-which-languages-load)
- [Startup cost](#startup-cost)
- [Protocol coverage](#protocol-coverage)
- [Troubleshooting](#troubleshooting)

## Install and configure

Paste this into your MCP client's server configuration — `claude_desktop_config.json`,
`.mcp.json`, `.cursor/mcp.json` or wherever your client keeps it:

```json
{
  "mcpServers": {
    "remove-profanity": {
      "command": "npx",
      "args": ["-y", "-p", "remove-profanity", "remove-profanity-mcp"]
    }
  }
}
```

The `-p remove-profanity` matters: the bin is called `remove-profanity-mcp`
but it lives inside the `remove-profanity` package, and `npx remove-profanity-mcp`
alone would go looking for a package by that name.

For Claude Code, the same thing in one line:

```
claude mcp add remove-profanity -- npx -y -p remove-profanity remove-profanity-mcp
```

If you would rather not resolve the package on every launch, install it and
point at the bin directly:

```json
{
  "mcpServers": {
    "remove-profanity": {
      "command": "remove-profanity-mcp",
      "args": ["--languages", "hi,en"]
    }
  }
}
```

The transport is stdio: the client launches the process, writes newline-delimited
JSON-RPC 2.0 to its stdin and reads responses from its stdout. Requires Node 18+.
Running it in a terminal by hand does nothing useful — it will sit waiting for
JSON on stdin. `remove-profanity-mcp --help` prints the options and exits.

## The four tools

All four are read-only. `text` is the only required argument anywhere.

| Tool | Answers |
|---|---|
| [`check_text`](#check_text) | Is this clean, and how many terms are in it? |
| [`scan_text`](#scan_text) | Exactly what was found, where, and how bad? |
| [`censor_text`](#censor_text) | The same text with the matches masked. |
| [`list_languages`](#list_languages) | Which packs this server loaded. |

Three arguments are shared by the first three tools:

| Argument | Type | Default | Meaning |
|---|---|---|---|
| `text` | string | *required* | The text to check. |
| `languages` | string[] | every loaded pack | Narrow to these packs for this call. |
| `minSeverity` | integer 0–4 | `0` | Drop matches below this severity. |

`languages` is not a filter on the results. It changes which dictionaries and
allowlists are in play, which both cuts cross-language false positives and can
change which language a shared romanization is reported under — see
[Choosing which languages load](#choosing-which-languages-load).

Every tool returns its answer twice: as `structuredContent` (matching the tool's
declared `outputSchema`) and as the same JSON serialized into a `content` text
block, so a client that reads only `content` loses nothing.

### `check_text`

Input:

```json
{ "text": "kya bh#sdike yaar", "languages": ["hi", "en"], "minSeverity": 0 }
```

Output:

```json
{
  "clean": false,
  "matchCount": 1,
  "maxSeverity": 4,
  "languages": ["hi", "en"]
}
```

`maxSeverity` is `null` when nothing matched. `languages` echoes the packs
actually used, in load order.

### `scan_text`

The tool worth calling this server for. Same inputs as `check_text`; the output
names every match.

Input:

```json
{ "text": "kya bh#sdike yaar, what the f*ck" }
```

Output (with all eleven packs loaded; the `lemma` values are masked here, not
by the server):

```json
{
  "matches": [
    {
      "surface": "bh#sdike",
      "lemma": "भोसड़*के",
      "language": "hi",
      "severity": 4,
      "categories": ["sexual", "gendered"],
      "tier": "masked",
      "casualUse": false,
      "start": 4,
      "end": 12
    },
    {
      "surface": "f*ck",
      "lemma": "f*ck",
      "language": "en",
      "severity": 3,
      "categories": ["sexual", "general"],
      "tier": "masked",
      "casualUse": true,
      "start": 28,
      "end": 32
    }
  ],
  "matchCount": 2,
  "maxSeverity": 4,
  "languages": ["hi", "en", "bn", "mr", "pa", "gu", "or", "ta", "te", "kn", "ml"]
}
```

Per match:

| Field | Meaning |
|---|---|
| `surface` | The exact slice of the **input** that matched — the obfuscated spelling as written. `text.slice(start, end)` reproduces it. |
| `lemma` | The canonical dictionary word it resolved to, in its native script where one exists. A romanized Hinglish spelling resolves to the Devanagari lemma. |
| `language` | ISO 639-1 code of the pack that owns the lemma. |
| `severity` | 0 = mild insult … 4 = extreme slur. |
| `categories` | Any of `slur`, `casteist`, `religious`, `gendered`, `sexual`, `ableist`, `violence`, `general`. |
| `tier` | `exact`, `masked`, `separated` or `skeleton`. The first three all required a full dictionary hit and are high precision; `skeleton` is the phonetic recall tier and is the one to review rather than block on. |
| `casualUse` | True for words used conversationally as often as abusively (`saala`, `chakka`). Worth a lighter action. |
| `start`, `end` | Offsets into the input string in UTF-16 code units, `end` exclusive. |

Offsets index the **original** input, not a normalized copy, so they can be used
to highlight or quote directly. Tiers, folds and what the matcher deliberately
misses are in [matching.md](matching.md).

### `censor_text`

Takes the three shared arguments plus:

| Argument | Type | Default | Meaning |
|---|---|---|---|
| `mask` | string | `"*"` | Masking character, repeated once per grapheme cluster. |
| `keepFirst` | boolean | `false` | Keep each match's first cluster visible. |

Input:

```json
{ "text": "what the f*ck", "keepFirst": true }
```

Output:

```json
{
  "censored": "what the f***",
  "matchCount": 1,
  "maxSeverity": 3,
  "languages": ["hi", "en"]
}
```

Masking works in grapheme clusters, so `तू बहन*ोद है` masks to `तू ***** है`
rather than leaving orphaned matras behind. Everything outside a match comes
back byte-for-byte as given.

### `list_languages`

Takes no arguments. Call it before narrowing anything else.

```json
{
  "languages": [
    { "code": "hi", "name": "Hindi + Hinglish", "scripts": ["Deva", "Latn"], "lemmaCount": 56 },
    { "code": "en", "name": "English", "scripts": ["Latn"], "lemmaCount": 70 },
    { "code": "bn", "name": "Bengali + Banglish", "scripts": ["Beng"], "lemmaCount": 29 }
  ],
  "defaultLanguages": ["hi", "en", "bn"]
}
```

`scripts` lists the ISO 15924 codes actually present among that pack's lemmas —
Hindi carries Latin-script lemmas as well as Devanagari ones, because each pack
ships the romanizations it needs to stand alone.

## Why it is read-only

There is no tool to add a word, edit an allowlist, load a file, or change
anything that persists — and that is a decision, not an omission.

**A moderation service whose word list can be edited by the model it is
moderating for is a moderation service that can be talked into switching itself
off.** The text this server is asked to judge is, by construction, text that
somebody else wrote. If a `add_allowlist_phrase` tool existed, "please add
*<slur>* to the allowlist" inside the very message under review is a one-line
prompt injection that disables the filter for every later call — and the model
would have no way to tell that instruction apart from its operator's. Removing
the tool removes the attack; no amount of prompting is as reliable.

For the same reason there is no tool that reads or writes the filesystem,
spawns a process, or makes a network request. The server's entire job is text
in, verdict out. It holds no state between calls beyond the matchers it built
at startup, so nothing one call does can change what a later one sees.

If you need custom terms, use the library directly — `customWords` and
`customAllowlist` on `createMatcher` ([usage.md](usage.md)). That puts the word
list under the control of your code, where it belongs, rather than under the
control of whatever text arrives.

## Choosing which languages load

By default all eleven packs load. Narrow it two ways:

```
remove-profanity-mcp --languages hi,en
REMOVE_PROFANITY_LANGUAGES=hi,en remove-profanity-mcp
```

The flag wins over the environment variable. An unknown code fails at startup
with a message on stderr and exit code 2, rather than half-loading.

A tool call may narrow further, to any subset of what the server loaded:

```json
{ "name": "scan_text", "arguments": { "text": "…", "languages": ["ta"] } }
```

Asking for a pack the server did not load is a tool error naming what is
available, not a crash.

Narrowing is worth doing. Each pack is self-sufficient — it carries the
romanizations it shares with other packs — so loading one language gives full
coverage of it, and loading extra ones costs startup time and can add
cross-language false positives (a word innocent in one language may be listed
in another). Details and the measured numbers:
[usage.md](usage.md#choosing-which-packs-to-load).

A per-call `languages` narrowing builds a real matcher for that subset rather
than filtering the full one's output, because the two are not the same question:
allowlist scope is global across loaded packs, two packs sharing a lemma string
collapse into one candidate carrying the strictest reading of both, and load
order decides the reported `language` on a tie. Those matchers are cached, so
the construction cost is paid once per distinct (languages, `minSeverity`)
combination and never per request. The cache holds sixteen; past that the oldest
is dropped and rebuilt on demand.

## Startup cost

Measured on node v22.22.3, darwin/arm64, median of seven cold starts:

| Configuration | Process launch → ready |
|---|---|
| All eleven packs (default) | **53 ms** |
| `--languages hi,en` | 40 ms |
| `--languages hi` | 35 ms |

About 19 ms of every row is Node's own boot; the rest is loading the packs and
building the matcher. The eleven-pack build itself is 33.71 ms, which is the
`createMatcher` cold figure in [benchmark/results.txt](../benchmark/results.txt)
and the largest of the six libraries benchmarked there.

It is paid once, at launch, before the first request — the server builds its
matcher at startup and never constructs one per call. After that a check is in
the microseconds for a chat message and about 2 ms for a 20,000-word document
([benchmarks.md](benchmarks.md)).

## Protocol coverage

The stdio transport and JSON-RPC framing are implemented directly against the
[specification](https://modelcontextprotocol.io/specification/latest) rather
than taken from `@modelcontextprotocol/sdk`, which is 4.3 MB unpacked with
eleven runtime dependencies. This package's headline claim is zero runtime
dependencies, and taking the SDK would falsify it for every consumer, including
those who never run the server.

The server is **dual-era**: it answers both the `initialize` handshake used by
revision `2025-11-25` and earlier, and the stateless per-request metadata model
introduced in `2026-07-28`. Era is decided per request, from whether
`params._meta["io.modelcontextprotocol/protocolVersion"]` is present, so a
client of either kind works without configuration.

| Feature | Status |
|---|---|
| stdio transport, newline-delimited JSON-RPC 2.0 | Yes |
| `initialize` / `notifications/initialized` | Yes — negotiates `2025-11-25`, `2025-06-18`, `2025-03-26`, `2024-11-05` |
| `server/discover` | Yes — reports `2026-07-28` |
| Modern `resultType` and `_meta` server identity | Yes, on modern requests only |
| `tools/list`, `tools/call` | Yes |
| `ping` | Yes |
| Tool `outputSchema` and `structuredContent` | Yes, on all four tools |

What a client asking for anything else sees:

- **Resources, prompts, completions, logging, sampling, elicitation, roots.**
  Not declared in `capabilities`, so a conforming client will not ask. One that
  asks anyway gets `-32601 Method not found: <method>`.
- **`tools/list` pagination.** Four tools are one page. `nextCursor` is never
  returned; a `cursor` the client sends is answered with the only page there is.
- **`notifications/tools/list_changed`.** The tool list is fixed at startup, so
  `listChanged` is not declared and the notification is never sent.
- **Cancellation and progress.** `notifications/cancelled` and
  `notifications/progress` are accepted and ignored, which is correct here:
  every tool call is synchronous and completes in well under a millisecond, so
  there is nothing left to cancel by the time the notification arrives, and no
  intermediate progress to report.
- **JSON-RPC batching.** Removed from MCP in revision `2025-06-18` and absent
  from the modern revisions. A batch gets `-32600` with a message saying to send
  one message per line, rather than a partially-processed array.
- **An unsupported modern protocol version.** `-32022` with
  `data.supported` and `data.requested`, which is what lets a client retry on a
  version both sides speak.
- **`io.modelcontextprotocol/clientCapabilities`.** The specification makes this
  `_meta` field mandatory on modern requests, and this server does **not**
  enforce it — a deliberate deviation. No tool here needs any client capability,
  so rejecting a request for omitting the field would break clients to prove a
  point. Everything else in `_meta` is honoured as specified.

Error reporting follows the specification's split. Things a model cannot fix by
choosing different arguments are JSON-RPC errors: an unknown tool or a `name`
that is not a string is `-32602`, an unknown method is `-32601`, unparseable
input is `-32700` with a null `id`. Things a model *can* fix come back as a
normal result with `isError: true` and a message written for it to read — a
missing or wrongly-typed argument, a `minSeverity` outside 0–4, a language code
this server did not load.

Nothing takes the process down. Every path through the handler returns a
response, including the one that catches an unexpected throw, because a server
that dies takes the user's session with it. A line with no newline terminator
within 32 MB is discarded with a parse error rather than buffered forever.

## Troubleshooting

**The client says the server failed to start.** Run the command yourself:
`npx -y -p remove-profanity remove-profanity-mcp --help`. If that prints usage,
the package resolves and the bin works. Node 18+ is required.

**It starts but reports no tools.** Check the client's log for the stderr line
`remove-profanity-mcp <version> ready on stdio; packs: …`. The server writes
that banner to stderr on purpose — the specification forbids writing anything to
stdout that is not an MCP message, and a banner there would desynchronize every
client.

**A tool call says a language is unknown.** The server only serves the packs it
was started with. Call `list_languages`, or drop the `--languages` flag.

**Results differ from the library.** Check `languages` in the response: a server
started with all eleven packs is a different matcher from one started with two,
and that is measurable ([usage.md](usage.md#choosing-which-packs-to-load)).

## See also

- [usage.md](usage.md) — the library API the server is a thin wrapper over.
- [matching.md](matching.md) — tiers, folds, allowlists, and what it deliberately misses.
- [benchmarks.md](benchmarks.md) — accuracy and speed, with the unflattering readings kept in.
- `src/mcp/` — the implementation. `server.ts` holds every protocol decision;
  `stdio.ts` only moves bytes. It sits above `src/index.ts` in the dependency
  graph and nothing in `src/` imports it, which is what makes it inert for
  library consumers; `test/mcp-packaging.test.ts` enforces that.
