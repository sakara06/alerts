# Alerts Node.js + Supabase App

Tämä projekti sisältää Node.js (Express) -palvelimen joka tarjoaa:
- Rekisteröityminen / login (bcrypt-hashatut salasanat tallennettu Supabaseen)
- REST API hälytyksille (CRUD) joka käyttää Supabase-taulua `alerts`
- Staattinen front-end (muokattu index.html) joka käyttää palvelimen APIa

## Asetukset
1. Kopioi `.env.example` -> `.env` ja täytä arvot.
2. Luo Supabase-projektissa kaksi taulua (SQL-taulut alla) tai tee ne SQL Editorilla:

```sql
-- Käyttäjät
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  created_at timestamptz default now()
);

-- Hälytykset
create table alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  address text not null,
  alert text not null,
  time text not null,
  pinned boolean default false,
  deleted boolean default false,
  modified timestamptz default now()
);
```

3. Asenna riippuvuudet:
```bash
npm install
```
4. Käynnistä:
```bash
npm start
```

## Huomioita turvallisuudesta
- Tämä esimerkki käyttää Supabase service_role-avainta (tai anon avainta riippuen oikeuksista) palvelinpuolella. Säilytä service_role-avain vain palvelimella (.env) — ÄLÄ paljasta sitä front-endille.
- Salasanat hashataan `bcrypt`-kirjastolla ennen tallennusta.
- Production-ympäristössä lisää HTTPS, rate-limiting, input validation ja CSRF/secure cookie -käytäntö.

## API
- POST /api/register { email, password } -> { ok: true }
- POST /api/login { email, password } -> { token, user }
- GET  /api/alerts (Authorization: Bearer <token>) -> user's alerts
- POST /api/alerts (Authorization) { address, alert, time } -> new alert
- PUT  /api/alerts/:id (Authorization) { ... } -> update
- DELETE /api/alerts/:id (Authorization) -> mark deleted
- POST /api/alerts/:id/restore (Authorization) -> restore deleted
