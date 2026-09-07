# Wiki and v0.22.0 release cleanup

The inspector fix is merged and the documentation sources are in this repository. The GitHub connector used for preparation cannot push wiki repositories, replace release assets or delete tags/releases. The prepared Python script completes those operations using the maintainer's authenticated GitHub CLI.

## Run the prepared bundle

1. Install Git, Python 3.9+ and GitHub CLI (`gh`), and authenticate with `gh auth login` if needed.
2. If the wiki has never been used, open [Wiki](https://github.com/djbauer69/WeaverDeckPlg/wiki), create a **Home** page (any short text is sufficient), and click **Save Page**. If Wiki is disabled, enable it in the repository Settings first. GitHub requires an initial page before its wiki Git repository can be cloned. See [GitHub's wiki instructions](https://docs.github.com/en/communities/documenting-your-project-with-wikis/adding-or-editing-wiki-pages).
3. Extract the provided `weaverdeck-github-cleanup.zip`, then run:

```bash
python3 ~/Downloads/weaverdeck-github-cleanup/tools/publish-wiki-and-cleanup.py --apply
```

Adjust the path if you extracted elsewhere. Omit `--apply` to print the local plan without making network requests or changes. The bundle already includes the exact tested plugin ZIP. From a complete repository checkout, the script can build it if absent; it stops if that build does not match the pinned checksum.

## Exact effects

- Publish Home, Actions, Version History, Communication and a wiki sidebar. Other wiki pages are preserved. The push uses the existing wiki default branch, without force.
- Verify the plugin ZIP against the merged runtime tree and expected SHA-256.
- Upload and download-verify a staging asset before replacing the canonical `pipeweaver-opendeck-plugin-v0.22.0.zip`. The previous canonical asset is saved locally in `cleanup-backup/` when it differs.
- Move the existing lightweight v0.22.0 tag from the previous tested commit to merged inspector-fix commit `ebbfa1f6b9896bf433128664c499dabf20cf33af`, then set the release title, notes and stable/latest status. The script stops if the existing tag or canonical asset has changed unexpectedly.
- Verify the final canonical download before deleting the **20 older release entries and 22 older tags** recorded in `tools/github-cleanup-plan.json`. This removes their downloadable assets too. No branch or repository history rewrite is performed.
- Confirm v0.22.0 is the sole release and tag. Unknown new releases/tags or moved old tags cause the script to stop for review, not delete them.

The process is sequential and can stop partway on network/API errors; it is not a transaction. Already removed inventoried entries are skipped on rerun. A verified staging upload remains available if replacement is interrupted. GitHub's release immutability or repository permissions may block changes; the script respects those errors.

Historical release notes, asset metadata and tag commit IDs were preserved in [the pre-cleanup snapshot](history/releases-before-cleanup.json) and summarized in [Version History](wiki/Version-History.md). This is a documentation archive, not a backup of every old binary download.

For subsequent wiki edits, change `docs/wiki/*.md` and publish them to the separate `.wiki.git` repository. The cleanup script is intentionally pinned to this v0.22.0 maintenance operation; do not reuse it for future releases without preparing a new plan.

API behavior follows [GitHub release documentation](https://docs.github.com/en/rest/releases/releases), [Git reference documentation](https://docs.github.com/en/rest/git/refs), and the [GitHub CLI upload command](https://cli.github.com/manual/gh_release_upload). The script stages the replacement before deletion rather than relying on `--clobber`.
