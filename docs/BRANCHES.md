# Branch policy

`master` is the default, painted baseline. `feature/3d-battles` descends from that
baseline and adds the working real-time elephant capture. Keep the tags
`2d-baseline` and `3d-elephant-preview` as fixed checkpoints.

The first commit imports the complete painted source/media with the agreed
English names. The second imports the real-time delta. This is not fabricated
historical commit activity. Earlier prototypes remain in their conversation
attachments; the repository stores the latest two selected implementation lines.

Generated distributions, caches and newly produced test logs are ignored. No
CI/deployment workflow is included. A push does not intentionally publish a site.
