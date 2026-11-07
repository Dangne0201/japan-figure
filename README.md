# Japan Figure

A learning project simulating a Vietnamese anime-figure e-commerce shop. The intended brand is premium yet friendly to young anime fans, with a bright pastel visual direction. The catalog includes Prize Figure, Scale Figure, Action Figure, and Chibi Figure products, including Nendoroid.

> **Educational demo only.** This project is not affiliated with any brand, anime, or studio. It does not process real transactions. Payment, shipping, and email integrations are simulated.

## Project status

The repository is implementing Phase 1 (foundation). See [docs/PROGRESS.md](docs/PROGRESS.md), [docs/DECISIONS.md](docs/DECISIONS.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DATA_MODEL.md](docs/DATA_MODEL.md), and [docs/ROADMAP.md](docs/ROADMAP.md).

## Planned stack

- Web: Next.js App Router, TypeScript, Tailwind CSS.
- API: NestJS, TypeScript, Prisma, REST, Swagger/OpenAPI.
- Data/services: PostgreSQL with pgvector, unaccent and pg_trgm; Redis and BullMQ; Nginx; Mailpit.
- Local AI: Ollama on the Windows host, configurable through environment variables. The chatbot is planned after the storefront and core commerce features and will use local project data only.

## Windows development notes

For faster file watching and dependency installation, place the repository in the WSL2 Linux filesystem (for example `~/projects`) rather than under `/mnt/c` or a Windows drive. Docker Desktop should use its WSL2 backend. An initial `.wslconfig` memory limit around 6 GB is suggested for this 16 GB laptop; tune it after checking actual Docker and host Ollama usage.

1. Copy `.env.example` to `.env` and set a local PostgreSQL password and unique placeholder JWT secrets. `DATABASE_URL` and `REDIS_URL` refer to internal Compose service names and are intended for containers.
2. From PowerShell in the repository directory, run `docker compose up --build`. The development override enables hot reload. The first run downloads/builds images and may take several minutes. When running project npm commands directly in Windows PowerShell, use `npm.cmd` if the system blocks the `npm.ps1` script.
3. Open `http://localhost:8080`. The landing page reports web, API, PostgreSQL, and Redis status. Swagger is at `http://localhost:8080/api/docs`; Mailpit is at `http://localhost:8025`.
4. To stop the stack, use `Ctrl+C`, then run `docker compose down`. To preserve the database, do not add `-v`.

The web app is exposed on all host interfaces at port 8080 by default. For phone testing, use the laptop's LAN IP on the same private Wi-Fi and allow only the chosen web port through Windows Firewall on the Private profile. API, database, and Redis ports are not published to the host/LAN. Mailpit UI is bound to localhost.

### Troubleshooting

- **Docker Engine is unavailable / HTTP 500:** start Docker Desktop and wait for its engine to become ready. In Docker Desktop settings, confirm the WSL2 engine is enabled. Check `docker info`, then `docker run --rm hello-world`; if these fail, restart Docker Desktop before running Compose.
- **Worker reports Redis eviction policy warnings:** the Compose configuration sets `noeviction` for BullMQ. Recreate containers with `docker compose up --build -d` after changing Compose settings; do not override the Redis policy with an eviction mode.
- **Port 8080 is already in use:** set `APP_PORT=8081` in `.env`, then run Compose again and open port 8081. For phone access, update the matching private-network firewall rule.
- **Database/Redis health check fails:** inspect `docker compose logs postgres redis migrate api`. Keep the `.env` password consistent with a fresh database volume. After changing the database password for an already-initialized local volume, either use the original password or deliberately reset the demo database volume (this deletes local database data).
- **Ollama is unavailable:** this is a non-fatal warning in Phase 1; the API health check and web page show it as optional. Ollama is only needed in later chatbot phases. If containers cannot reach the Windows host, set host Ollama to listen on `0.0.0.0` and allow port 11434 through Windows Firewall on the Private network.
- **File watching is slow on a Windows drive:** the current `F:\WebFigure` path is supported. Moving/cloning into a WSL2 Linux filesystem is an optional performance improvement, not a Docker prerequisite.

## Local images

Only self-made/generated placeholder images will be committed. Once catalog support is implemented, locally supplied images can override placeholders from the gitignored `local-images/` directory using the matching product slug and `.webp` extension. Do not commit copyrighted figure/anime images.

## Environment checklist

- Install Docker Desktop and enable the WSL2 backend. Start Docker Desktop and wait for its engine to become ready before using Compose.
- Install Node.js LTS and Git. GitHub CLI (`winget install --id GitHub.cli -e`) is optional; SourceTree or GitHub's website can be used to manage and publish the repository.
- Optional performance tuning: create or edit `%UserProfile%\.wslconfig` with:

  ```ini
  [wsl2]
  memory=6GB
  ```

  Apply changes by running `wsl --shutdown`, then restart Docker Desktop. This is optional tuning for the 16 GB laptop, not a requirement; installing a separate Ubuntu distribution is not required for Docker Desktop.

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
