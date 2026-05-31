# Contributing a component

The statusline marketplace is **federated**: components live in contributors'
own GitHub repos, and [`registry.json`](./registry.json) indexes them. One repo
can hold many components. To list yours on
[claude-statusline.vercel.app](https://claude-statusline.vercel.app), open a PR
adding your repo as a source.

## 1. Lay out your repo

Put one or more components under a directory (any name; `components/` is the
convention). Each component is a directory named by its `id`:

```
your-repo/
└── components/
    ├── weather/
    │   ├── component.json   # manifest — see plugin/spec/component.schema.json
    │   ├── README.md        # written for Claude to read, vet, and tune
    │   ├── render.sh        # segment (in-process bash) — or render.py for a line widget
    │   ├── fetch.py         # optional: background data fetch (the ONLY place that may hit the network)
    │   └── preview.txt      # a real-ANSI sample of the output, so the web can show it
    └── ...
```

See [`plugin/spec/CONTRACT.md`](./plugin/spec/CONTRACT.md) for the render/fetch
contract and [`plugin/components/`](./plugin/components) for working examples.
Generate `preview.txt` by capturing your component's real output with ANSI colour
(see [`plugin/spec/capture-previews.sh`](./plugin/spec/capture-previews.sh)).

## 2. Add your source to the registry

Edit `registry.json` and append:

```json
{
  "repo": "you/your-repo",
  "ref": "main",
  "path": "components",
  "author": "you",
  "description": "What your components do."
}
```

## 3. Open a PR

CI ([`.github/workflows/validate.yml`](./.github/workflows/validate.yml)) clones
your source and validates every component against the spec:

- `component.json` matches the schema; `id` equals the directory name
- the `render` entry exists and **does not touch the network** (only `fetch` may;
  a single-file `render.py` that doubles as fetch via `--fetch` is fine)
- `README.md` and `preview.txt` are present
- no hardcoded secrets; every host your `fetch` contacts is declared in
  `requires.network`

Once it's green and merged, the site picks your components up automatically
(the registry is read live, revalidated every ~10 minutes — no redeploy needed),
and users can add them with `/statusline:install <id>`.
