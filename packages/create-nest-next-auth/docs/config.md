# Config file

`--config` reads a JSON object with these keys, all optional:

```json
{
  "targets": ["web"],
  "database": "mongodb",
  "features": ["email-password", "google"],
  "locales": ["en", "ar"],
  "docker": true,
  "production": true,
  "preset": "standard",
  "rules": "strict"
}
```

`rules` takes `strict` or `standard`, spelled exactly as the flag takes them.
Any other value stops the run with exit code 2.

A flag overrides the config file, the config file overrides the preset, and the
preset overrides the manifest defaults. A UTF-8 byte order mark is accepted and
stripped.
