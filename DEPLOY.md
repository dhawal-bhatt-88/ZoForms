# Deploying Frame to a single EC2 host

A lean, dev-grade deployment: **one EC2 instance** runs the whole stack with
Docker Compose — Postgres, the API, the tenant app, and the admin console.
GitHub Actions builds one image per app, pushes them to **GHCR**, then SSHes in
and restarts the stack. No managed RDS, no load balancer, no IaC.

```
                       ┌────────────────── GitHub Actions ──────────────────┐
   git push main  ─▶   │  ci.yml   → lint · typecheck · build                │
                       │  deploy.yml → build 3 images → push GHCR → ssh EC2  │
                       └───────────────────────────┬────────────────────────┘
                                                    │ ssh: docker compose up -d
                                                    ▼
   ┌──────────────────────────── EC2 (Docker Compose) ────────────────────────────┐
   │  db (postgres:16, volume pgdata)                                              │
   │  api   :4000   ← DATABASE_URL=db:5432 · prisma migrate deploy                 │
   │  web   :3000   (Next standalone)                                              │
   │  admin :3002   (Next standalone)                                              │
   └──────────────────────────────────────────────────────────────────────────────┘
```

> **⚠️ Build-time gotcha:** `NEXT_PUBLIC_API_URL` is **baked into the web/admin
> images at build time**, not read at runtime. The images must be built knowing
> the API's public origin. That's why it's a GitHub **repo variable** (below).
> If your EC2 IP changes, you must re-run Deploy so the images are rebuilt.
> **Allocate an Elastic IP** so the address is stable.

---

## 1. One-time AWS setup

1. **Launch an EC2 instance**
   - AMI: **Ubuntu 22.04 LTS** (or Amazon Linux 2023).
   - Type: `t3.small` (2 GB) works for dev; `t3.medium` is comfier.
   - Storage: 20 GB gp3.
   - Key pair: create/download one — you'll paste its **private** key into a repo secret.

2. **Allocate an Elastic IP** and associate it with the instance (keeps the
   public address stable across restarts).

3. **Security group inbound rules**
   | Port | Source | Why |
   | --- | --- | --- |
   | 22  | your IP | SSH / GitHub Actions deploy |
   | 3000 | 0.0.0.0/0 | tenant app |
   | 3002 | 0.0.0.0/0 | admin console |
   | 4000 | 0.0.0.0/0 | API |

4. **Install Docker + Compose plugin** (SSH in once):
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER      # then log out / back in
   docker compose version             # verify the plugin is present
   ```

---

## 2. One-time server setup

SSH into the box and prepare the deploy directory:

```bash
mkdir -p ~/frame
```

Create `~/frame/.env.prod` from
[`deploy/.env.prod.example`](deploy/.env.prod.example) and fill in real values
(strong `POSTGRES_PASSWORD` + `JWT_SECRET`, and `PUBLIC_API_URL=http://<ELASTIC_IP>:4000`).

**GHCR image access.** The Deploy workflow pushes images to GHCR. For a dev box,
the simplest path is to make the three packages **public** (GitHub → your repo →
Packages → each `*-web/-admin/-api` package → Package settings → Change visibility
→ Public). Then the box pulls with no login.

<details><summary>Prefer to keep packages private?</summary>

Create a classic PAT with `read:packages`, then on the box:
```bash
echo "<PAT>" | docker login ghcr.io -u <github-username> --password-stdin
```
</details>

The `docker-compose.prod.yml` is copied to `~/frame/` automatically by every
deploy — you don't place it by hand.

---

## 3. GitHub repo configuration

**Settings → Secrets and variables → Actions.**

**Variables** (baked into the web/admin builds):
| Name | Example |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://<ELASTIC_IP>:4000` |
| `NEXT_PUBLIC_TENANT_URL` | `http://<ELASTIC_IP>:3000` |

**Secrets** (used by the deploy SSH step):
| Name | Value |
| --- | --- |
| `EC2_HOST` | the Elastic IP (or DNS name) |
| `EC2_USER` | `ubuntu` (Amazon Linux: `ec2-user`) |
| `EC2_SSH_KEY` | the **private** key PEM contents for the instance |

---

## 4. Deploy

Push to `main`, or run **Actions → Deploy → Run workflow**. The workflow:

1. builds `web`, `admin`, `api` images and pushes them to GHCR (tagged `latest`
   and the commit SHA);
2. copies `docker-compose.prod.yml` to `~/frame`;
3. SSHes in and runs `docker compose pull && up -d` pinned to the new SHA.

The API container runs `prisma migrate deploy` on boot, so schema changes apply
automatically. Then open:

| App | URL |
| --- | --- |
| Tenant app | `http://<ELASTIC_IP>:3000` |
| Admin console | `http://<ELASTIC_IP>:3002` |
| API health | `http://<ELASTIC_IP>:4000/health` |

---

## 5. Operations

```bash
cd ~/frame
docker compose -f docker-compose.prod.yml --env-file .env.prod ps       # status
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f api
docker compose -f docker-compose.prod.yml --env-file .env.prod down      # stop

# Backup / restore the database
docker compose -f docker-compose.prod.yml --env-file .env.prod exec db \
  pg_dump -U frame formbuilder > backup-$(date +%F).sql
```

- **Postgres data** persists in the `pgdata` volume — it survives redeploys, but
  **not** instance termination. Snapshot the EBS volume (or `pg_dump`) for real backups.

---

## 6. Optional: a domain + HTTPS

Point a domain's A record at the Elastic IP and put **Caddy** in front (it
auto-provisions Let's Encrypt certs) reverse-proxying `:3000/:3002/:4000` by
subdomain. When you do, rebuild with `NEXT_PUBLIC_API_URL=https://api.yourdomain`
so the browser calls the HTTPS origin. Left out of the default compose to keep
the dev setup dependency-free.
