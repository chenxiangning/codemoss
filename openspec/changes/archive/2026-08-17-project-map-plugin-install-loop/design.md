# Design

```text
allowlist = notes | claude | project-map
reject later = com.mossx.browser

install:
  activate fixture (project-map-main + worker/ui/memory-ui)
  register views + 24 commands
  lockfile Installed

uninstall:
  lockfile Uninstalled
  Host Uninstalled
  revoke contributions
  keep store.sqlite

gate:
  flag off → Ok（回 *_core）
  uninstalled + flag on → plugin-uninstalled: com.mossx.project-map
```
