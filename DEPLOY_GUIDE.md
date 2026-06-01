# FleetOps – Deployment Guide
## Your system is ready. Follow these steps in order.

---

## STEP 1 — Set Up Your Google Sheet

1. Go to **Google Sheets** and create a new spreadsheet
2. Create **3 tabs** (sheets) named exactly:
   - `Riders`
   - `Shifts`
   - `Bookings`

### Riders sheet — Row 1 headers (copy exactly):
| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| NB Number | Name | Phone | Email | Active | Weekly Hours | Cancellations |

**Add your riders in rows 2 onwards. You assign the NB numbers yourself.**
Example row:
```
NB1001 | James Walker | +44 7700 900111 | james@email.com | TRUE | 0 | 0
```

### Shifts sheet — Row 1 headers:
| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| ShiftID | Date | Day | Start | End | Hours | Capacity | Booked | Status | Notes |

*(The app fills this in automatically when you create shifts)*

### Bookings sheet — Row 1 headers:
| A | B | C | D | E | F |
|---|---|---|---|---|---|
| BookingID | RiderNB | ShiftID | Status | CancelReason | CreatedAt |

*(The app fills this in automatically)*

---

## STEP 2 — Get Google Sheets API Access

1. Go to **https://console.cloud.google.com**
2. Create a new project (name it "FleetOps" or anything)
3. Click **"Enable APIs and Services"** → search **"Google Sheets API"** → Enable it
4. Go to **"Credentials"** → **"Create Credentials"** → **"Service Account"**
5. Name it anything, click **Create and Continue**, skip optional steps, click **Done**
6. Click on your new service account → **"Keys"** tab → **"Add Key"** → **"Create new key"** → **JSON**
7. A JSON file downloads — open it, you'll need:
   - `client_email` → this is your `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → this is your `GOOGLE_PRIVATE_KEY`

8. **Share your Google Sheet** with the service account email:
   - Open your Google Sheet
   - Click **Share** (top right)
   - Paste the `client_email` value
   - Set permission to **Editor**
   - Click Send

---

## STEP 3 — Deploy to Vercel

1. **Download the fleetops folder** from this session
2. Go to **https://github.com** and create a new repository called `fleetops`
3. Upload / push the fleetops folder to that repo
4. Go to **https://vercel.com** → Sign in with GitHub → **"Add New Project"**
5. Import your `fleetops` repo → Click **Deploy**

---

## STEP 4 — Add Environment Variables in Vercel

In Vercel → Your Project → **Settings → Environment Variables**, add these:

| Variable Name | Value |
|---|---|
| `GOOGLE_SHEET_ID` | The ID from your sheet URL: `docs.google.com/spreadsheets/d/THIS_PART/edit` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | The `client_email` from your JSON key file |
| `GOOGLE_PRIVATE_KEY` | The full `private_key` from your JSON key file (including `-----BEGIN...END-----`) |
| `ADMIN_EMAIL` | Your chosen admin email (e.g. `admin@yourfleet.com`) |
| `ADMIN_PASSWORD` | Your chosen admin password (make it strong!) |
| `JWT_SECRET` | Any random 32+ character string (e.g. `myfleet-super-secret-key-2024-xyz`) |

After adding all variables → click **Redeploy**.

---

## STEP 5 — Your Live URLs

Once deployed, Vercel gives you a URL like `https://fleetops-xyz.vercel.app`

| Who | URL | Access |
|---|---|---|
| **Riders** | `https://your-app.vercel.app/rider` | NB Number + Email or Phone |
| **Admin (you)** | `https://your-app.vercel.app/admin` | Your email + password only |

**Share the `/rider` link with your fleet riders.**  
**Keep the `/admin` link private — only you know it.**

---

## How It Works

- **Riders log in** with their NB Number + Email or Phone (must match what's in the sheet)
- **Bookings, shifts, cancellations** all write back to your Google Sheet in real time
- **You manage riders** in the Admin portal — add them, assign NB numbers, enable/disable
- **You create shifts** in the Admin portal — they appear instantly for riders to book
- **Export to CSV** anytime from the Bookings page

---

## Adding Riders

You have full control over NB numbers. In Admin → Riders → Add Rider:
- You type the NB Number (e.g. NB1001, NB1002...)
- Fill in their name, phone, email
- They use that NB + their email or phone to log in as a rider

---

## Resetting Weekly Cancellations

Each Monday, manually set the "Cancellations" column in your Riders sheet back to 0.
(Automatic weekly reset can be added as a future Vercel Cron job — ask if you want this.)

---

## Support

If you get stuck on any step, come back and ask — just say which step you're on!
