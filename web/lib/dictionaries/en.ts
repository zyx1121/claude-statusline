// English — the source dictionary. zh-Hant / zh-Hans conform to this shape (Dict).
// Only UI chrome lives here; component READMEs/names/descriptions are localized
// from the registry (per-component i18n + README.<locale>.md).

export const en = {
  nav: {
    components: "Components",
    templates: "Templates",
    spec: "Spec",
    github: "GitHub",
    language: "Language",
  },
  home: {
    tagline:
      "A Claude-native, modular status line for Claude Code. Compose tickers, widgets, and segments from a federated marketplace — Claude reads each component's README to vet, install, and tune it for you.",
    statsComponents: (n: number) => `${n} component${n === 1 ? "" : "s"}`,
    statsFrom: "from",
    statsAuthors: (n: number) => `${n} author${n === 1 ? "" : "s"}`,
    builtinNote: "showing the built-in set",
    component: "component",
    components: "components",
    noPreview: "no preview",
  },
  badges: {
    official: "official",
    offline: "offline",
    network: "network",
    secrets: "secrets",
    fetch: "fetch",
    segment: "segment",
    line: "line",
  },
  detail: {
    back: "All components",
    unknownAuthor: "unknown author",
    enableTitle: "Enable this component",
    enableDescPre: "Run this in Claude Code after installing the plugin to add",
    enableDescPost: "to your active profile.",
    manifest: "Manifest",
    manifestDesc: "Everything Claude reads before installing — sourced straight from",
    config: "Configuration",
    configDescPre: "Tunable knobs, set per-profile with",
    readme: "README",
    readmeBadge: "written for Claude",
    facts: {
      runtime: "Runtime",
      type: "Type",
      placement: "Placement",
      reqBin: "Required binaries",
      network: "Network",
      macos: "macOS only",
      fetch: "Background fetch",
      secrets: "Secrets / env",
    },
    typeHint: {
      segment: "in-process, zero fork",
      line: "forked standalone process",
    },
    muted: {
      unspecified: "unspecified",
      none: "none",
      noNetwork: "no network",
      no: "no",
      required: "required",
      yes: "yes",
      order: "order",
    },
    configTable: { key: "Key", type: "Type", default: "Default", desc: "Description" },
    safety: {
      noneTitle: "No network, no secrets.",
      noneBody: "Runs entirely on local session data.",
      networkTitle: "Makes network requests",
      networkTo: "to",
      networkBody: "Review the hosts in the manifest below before enabling.",
      secretsTitle: "Reads secrets from the environment.",
      secretsBodyPre: "Provide them via",
    },
  },
  templates: {
    title: "Templates",
    intro:
      "Ready-made profiles — a profile is a named composition of components placed into slots. Pick one, run its one-line installer, and your whole status line is set up.",
    layout: "Layout",
    install: "Install",
    tabShell: "Shell",
    tabClaude: "Claude Code",
    shellHint:
      "Paste into a terminal. Clones the plugin, wires the loader into settings.json, then writes and activates the profile.",
    claudeHint:
      "Paste into Claude Code. It installs the plugin and sets up this profile autonomously.",
    components: "components",
    slots: {
      top: "top",
      middle: "middle",
      bottom: "bottom",
      row1: "row 1",
      row2: "row 2",
    },
    rule: "rule",
  },
  spec: {
    title: "Writing a component",
    badge: "authoring spec",
    intro:
      "A component is a self-contained directory that renders one piece of the status line. It ships everything the runtime needs: a manifest, a README written for Claude to read and vet, and one or more executable render entries.",
    dirShape: "The directory shape",
    segmentVsLine: "Segment vs line",
    contract: "The render / fetch contract",
    contributing: "Contributing",
    viewSource: "view source ↗",
  },
  footer: {
    license: "MIT License",
    builtBy: "built by",
  },
};

export type Dict = typeof en;
