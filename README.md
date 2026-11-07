# Japan Figure

A learning project simulating a Vietnamese anime-figure e-commerce shop. The intended brand is premium yet friendly to young anime fans, with a bright pastel visual direction. The catalog includes Prize Figure, Scale Figure, Action Figure, and Chibi Figure products, including Nendoroid.

> **Educational demo only.** This project is not affiliated with any brand, anime, or studio. It does not process real transactions. Payment, shipping, and email integrations are simulated.

## Project status

The repository is in Phase 0 (discovery and project setup). See [docs/PROGRESS.md](docs/PROGRESS.md), [docs/DECISIONS.md](docs/DECISIONS.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DATA_MODEL.md](docs/DATA_MODEL.md), and [docs/ROADMAP.md](docs/ROADMAP.md).

## Planned stack

- Web: Next.js App Router, TypeScript, Tailwind CSS.
- API: NestJS, TypeScript, Prisma, REST, Swagger/OpenAPI.
- Data/services: PostgreSQL with pgvector, unaccent and pg_trgm; Redis and BullMQ; Nginx; Mailpit.
- Local AI: Ollama on the Windows host, configurable through environment variables. The chatbot is planned after the storefront and core commerce features and will use local project data only.

## Windows development notes

For faster file watching and dependency installation, place the repository in the WSL2 Linux filesystem (for example `~/projects`) rather than under `/mnt/c` or a Windows drive. Docker Desktop should use its WSL2 backend. An initial `.wslconfig` memory limit around 6 GB is suggested for this 16 GB laptop; tune it after checking actual Docker and host Ollama usage.

After Phase 1 provides Compose files, the intended startup command will be `docker compose up --build`. The web app is planned to use port 8080 by default to avoid common Windows port 80 conflicts. For phone testing, use the laptop's LAN IP on the same private Wi-Fi and allow only the chosen web port through Windows Firewall on the Private profile.

## Local images

Only self-made/generated placeholder images will be committed. Once catalog support is implemented, locally supplied images can override placeholders from the gitignored `local-images/` directory using the matching product slug and `.webp` extension. Do not commit copyrighted figure/anime images.

## Environment checklist

- Install Docker Desktop and enable the WSL2 backend. Start Docker Desktop and wait for its engine to become ready before using Compose.
- Install Node.js LTS, Git, and GitHub CLI (`winget install --id GitHub.cli -e`). Then run `gh auth login` and `gh auth status` before repository publishing.
- Create or edit `%UserProfile%\.wslconfig` with:

  ```ini
  [wsl2]
  memory=6GB
  ```

  Apply changes by running `wsl --shutdown`, then restart Docker Desktop. This is a starting point for the 16 GB laptop, not a required universal value.
- Install Ollama for Windows from its official installer. In PowerShell, download the planned models (this can require substantial disk space and time):

  ```powershell
  ollama pull qwen2.5:3b-instruct
  ollama pull qwen2.5:1.5b-instruct
  ollama pull bge-m3
  ```

- If containers cannot reach Ollama at `host.docker.internal:11434`, configure host Ollama to listen on `0.0.0.0` and allow it through Windows Firewall only as appropriate for the private network.
- Find the laptop LAN IPv4 address with `ipconfig`, under the Wi-Fi adapter's IPv4 Address. For phone testing, create a Windows Defender Firewall inbound rule for TCP port 8080, allow the connection on the Private profile only, and use `http://<LAN-IP>:8080` on the same Wi-Fi. Do not expose database, Redis, or API ports to the LAN.

## License

MIT. See [LICENSE](LICENSE).
