# TODO

- [ ] make a chrome version
- [ ] Make the time-block quota work across machines by moving shared settings to `browser.storage.sync`.
- [ ] Keep per-device usage shards instead of one shared `usage.x.com` counter so sync writes do not clobber each other.
- [ ] Use `storage.local` for the local `deviceId` and keep sync as eventual consistency, not real-time accounting.
