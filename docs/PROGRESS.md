# Progress
Current phase: 0 (discovery/setup; repository published, environment follow-up remains)
Completed: owner interview preferences captured; architecture, data model, roadmap, Windows environment checklist, and initial repository skeleton created. Local repository initialized on `main`, committed, and pushed to public GitHub repository `https://github.com/Dangne0201/japan-figure`.
Decisions: see `docs/DECISIONS.md`.
Known issues: GitHub CLI (`gh`) is not installed but is optional; repository publishing succeeded using the authenticated Git credential. Ollama is not responding at `localhost:11434`. Workspace is on Windows drive `F:` instead of the WSL2 Linux filesystem. Docker CLI and Compose are installed, but the Docker daemon returned HTTP 500 for the Docker Desktop Linux engine.
Next step: start/fix Docker Desktop and verify its engine before Phase 1. Consider moving the repo into a WSL2 Linux filesystem for faster dependency installs and file watching.
