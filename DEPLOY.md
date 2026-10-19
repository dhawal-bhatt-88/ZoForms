# Deploying Zowork Forms to a single EC2 host

> **⚠️ Not deployed, and not to be deployed yet.** The builder has never been deployed. Before it is, decide a default rate limit for the API's signed-in routes: today only the credential routes (sign-up, login, Google, password reset, verification, invite accept) are throttled. The [clean-up plan](docs/BUILDER-CLEANUP-PLAN.md#before-any-deployment) tracks this. Until then, the Deploy workflow runs only when started by hand, and nobody should start it.

This describes the intended setup once that's done: a lean, dev-grade deployment where **one EC2 instance** runs the whole stack with Docker Compose. GitHub Actions builds one image per app, pushes them to **GHCR**, then SSHes in and restarts the stack. No managed database, no load balancer, no IaC.

## What runs

| Service | Port | What it is |
| --- | --- | --- |
| `db` | (internal) | PostgreSQL 16, data in the `pgdata` volume |
| `api` | 4000 | The REST API. Runs `prisma migrate deploy` on every start, then loads the system templates. |
| `web` | 3000 | The builder (Next.js standalone) |
| `admin` | 3002 | The admin console (Next.js standalone) |

That's all. The builder hosts no form pages and stores no uploads, so there's no public form route, no file volume and no cache or queue. Respondents never reach this host: the client's app renders the downloaded artifact with `@zoworkhq/forms` and receives the submissions itself.

```
                       ┌────────────────── GitHub Actions ──────────────────┐
   push / PR      ─▶   │  ci.yml     → typecheck · test · build             │
   Run workflow   ─▶   │  deploy.yml → build 3 images → push GHCR → ssh EC2 │
   (by hand)           └───────────────────────────┬────────────────────────┘
                                                    │ ssh: docker compose up -d
                                                    ▼
   ┌──────────────────────────── EC2 (Docker Compose) ────────────────────────────┐
   │  db    (postgres:16, volume pgdata)                                           │
   │  api   :4000   ← DATABASE_URL=db:5432 · prisma migrate deploy                 │
   │  web   :3000   (Next standalone)                                              │
   │  admin :3002   (Next standalone)                                              │
   └──────────────────────────────────────────────────────────────────────────────┘
```

> **Build-time values:** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_TENANT_URL` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` are **built into the web and admin images**, not read at runtime. That's why they're GitHub repo variables (below). If the host's address changes, run Deploy again so the images are rebuilt. Allocate an Elastic IP so the address stays the same.

## 1. One-time AWS setup

1. **Launch an EC2 instance:**
   - AMI: Ubuntu 22.04 LTS (or Amazon Linux 2023);
   - type: `t3.small` (2 GB) works; `t3.medium` gives more headroom;
   - storage: 20 GB gp3;
   - key pair: create one. Its **private** key goes into a repo secret.
2. **Allocate an Elastic IP** and associate it with the instance.
3. **Security group inbound rules:**

   | Port | Source | Why |
   | --- | --- | --- |
   | 22 | your IP | SSH, and the deploy step |
   | 3000 | 0.0.0.0/0 | the builder |
   | 3002 | 0.0.0.0/0 | the admin console |
   | 4000 | 0.0.0.0/0 | the API |

4. **Install Docker and the Compose plugin** (SSH in once):
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER      # then log out and back in
   docker compose version             # check the plugin is there
   ```

## 2. One-time server setup

On the box:

```bash
mkdir -p ~/zowork-forms
```

Create `~/zowork-forms/.env.prod` from [`deploy/.env.prod.example`](deploy/.env.prod.example) and fill in real values:
- a strong `POSTGRES_PASSWORD` and `JWT_SECRET`. The API refuses to start in production with the dev secret.
- `PUBLIC_API_URL=http://<ELASTIC_IP>:4000` and `PUBLIC_TENANT_URL=http://<ELASTIC_IP>:3000`. The second is used in invite, verification and password-reset links.
- Optionally, `RESEND_API_KEY` and `MAIL_FROM` to send email, and `GOOGLE_CLIENT_ID` for Google sign-in. Without a Resend key, emails are logged, not sent.

The Postgres user is `zowork_forms`, the database `formbuilder`.

**Pulling images from GHCR.** The deploy step logs the box in to GHCR with the workflow run's own token, so the packages can stay private.

Every deploy copies `docker-compose.prod.yml` to `~/zowork-forms/`; you don't place it by hand.

## 3. GitHub repo configuration

**Settings → Secrets and variables → Actions.**

**Variables** (built into the web and admin images):

| Name | Example |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://<ELASTIC_IP>:4000` |
| `NEXT_PUBLIC_TENANT_URL` | `http://<ELASTIC_IP>:3000` (the admin console's impersonation link) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | optional; the same value as `GOOGLE_CLIENT_ID` |

**Secrets** (used by the deploy step):

| Name | Value |
| --- | --- |
| `EC2_HOST` | the Elastic IP, or its DNS name |
| `EC2_USER` | `ubuntu` (Amazon Linux: `ec2-user`) |
| `EC2_SSH_KEY` | the instance's **private** key, PEM contents |

## 4. Deploy

[`deploy.yml`](.github/workflows/deploy.yml) is **manual only**: **Actions → Deploy → Run workflow**. Pushing to `main` runs CI, never a deploy. Don't add a push trigger before the rate-limit decision above. The workflow:

1. builds the `web`, `admin` and `api` images and pushes them to GHCR, tagged `latest` and with the commit SHA;
2. copies `docker-compose.prod.yml` to `~/zowork-forms`;
3. SSHes in and runs `docker compose pull` and `up -d`, pinned to that SHA.

The API applies migrations and loads the system templates each time it starts. Then:

| App | URL |
| --- | --- |
| Builder | `http://<ELASTIC_IP>:3000` |
| Admin console | `http://<ELASTIC_IP>:3002` |
| API health | `http://<ELASTIC_IP>:4000/health` |

To let someone into the admin console, set `isAdmin` on their user, as in [Admin access](README.md#local-setup) in the README. On the box, run the SQL with:

```bash
cd ~/zowork-forms
docker compose -f docker-compose.prod.yml --env-file .env.prod exec db psql -U zowork_forms formbuilder
```

## 5. Operations

```bash
cd ~/zowork-forms
docker compose -f docker-compose.prod.yml --env-file .env.prod ps       # status
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f api
docker compose -f docker-compose.prod.yml --env-file .env.prod down      # stop

# Back up the database
docker compose -f docker-compose.prod.yml --env-file .env.prod exec db \
  pg_dump -U zowork_forms formbuilder > backup-$(date +%F).sql
```

Postgres data lives in the `pgdata` volume. It survives redeploys, but **not** the instance being terminated. Snapshot the EBS volume or keep `pg_dump` backups.

## 6. Optional: a domain and HTTPS

Point a domain's A record at the Elastic IP and put **Caddy** in front, reverse-proxying `:3000`, `:3002` and `:4000` by subdomain. It gets Let's Encrypt certificates automatically. Then:
- set `PUBLIC_API_URL`, `PUBLIC_TENANT_URL` and the `NEXT_PUBLIC_*` variables to the HTTPS origins, and run Deploy again so the images are rebuilt;
- close ports 3000, 3002 and 4000 to the outside.

It's left out of the default compose file to keep the setup free of extra dependencies.
