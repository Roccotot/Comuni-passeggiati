"""
Aggiunge l'altitudine reale a comuni.json usando Open-Elevation API.
Esegui questo script UNA VOLTA dal tuo PC (richiede internet libero).

Uso:
  python scripts/aggiungi-altitudine.py

Dopo averlo eseguito, rigenera comuni-data.js:
  node scripts/build-data.js
"""

import json, math, time, os, urllib.request

BASE        = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COMUNI_FILE = os.path.join(BASE, "comuni.json")
BATCH_SZ    = 400
ELEV_URL    = "https://api.open-elevation.com/api/v1/lookup"

def fetch_json(url, data):
    req = urllib.request.Request(
        url, data=json.dumps(data).encode(),
        headers={"Content-Type": "application/json", "User-Agent": "comuni-passeggiati/1.0"}
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

def main():
    with open(COMUNI_FILE, encoding="utf-8") as f:
        comuni = json.load(f)

    # Solo quelli senza altitudine
    missing = [c for c in comuni if c.get("altitudine") is None and c.get("lat") and c.get("lng")]
    print(f"Comuni senza altitudine: {len(missing)}")

    altitudes = {}
    total_batches = math.ceil(len(missing) / BATCH_SZ)

    for i in range(0, len(missing), BATCH_SZ):
        batch = missing[i:i+BATCH_SZ]
        n     = i // BATCH_SZ + 1
        locs  = [{"latitude": c["lat"], "longitude": c["lng"]} for c in batch]
        try:
            result = fetch_json(ELEV_URL, {"locations": locs})
            for c, r in zip(batch, result["results"]):
                altitudes[c["id"]] = int(r.get("elevation", 0))
            print(f"  batch {n}/{total_batches} OK")
        except Exception as e:
            print(f"  batch {n} ERRORE: {e}")
        time.sleep(0.5)

    # Merge e aggiorna temperatura con altitudine reale
    for c in comuni:
        if c["id"] in altitudes:
            c["altitudine"] = altitudes[c["id"]]
            # Ricalcola temperatura con altitudine reale
            if c.get("lat"):
                t = 18.0 - 0.6 * (c["lat"] - 37.0) - 0.006 * c["altitudine"]
                c["temp_media"] = round(t, 1)

    with open(COMUNI_FILE, "w", encoding="utf-8") as f:
        json.dump(comuni, f, ensure_ascii=False, separators=(",", ":"))

    filled = sum(1 for c in comuni if c.get("altitudine") is not None)
    print(f"\n✅ Altitudine aggiunta: {filled}/{len(comuni)}")
    print("Ora esegui: node scripts/build-data.js")

if __name__ == "__main__":
    main()
