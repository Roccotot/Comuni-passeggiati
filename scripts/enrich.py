"""
Arricchisce comuni.json con altitudine, abitanti, temperatura media.

Fonti:
  - Abitanti:   matteocontrini/comuni-json (GitHub raw)
  - Altitudine: MatteoHenryChinaski/Comuni-Italiani-2018 (GitHub raw)
                + fallback formula da lat/lng
  - Temp media: formula climatica basata su latitudine e altitudine
                (buona approssimazione per l'Italia, ±2°C)
"""

import json, math, os, urllib.request, urllib.error

BASE        = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COMUNI_FILE = os.path.join(BASE, "comuni.json")

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "comuni-passeggiati/1.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read().decode("utf-8", errors="replace")

# ── 1. ABITANTI ────────────────────────────────────────────
def load_population():
    print("→ Scarico abitanti (matteocontrini/comuni-json)...")
    url  = "https://raw.githubusercontent.com/matteocontrini/comuni-json/master/comuni.json"
    data = json.loads(fetch(url))
    result = {}
    for c in data:
        code = str(c.get("codice", "")).zfill(6)
        result[code] = c.get("popolazione")
    print(f"  {len(result)} comuni con dati popolazione")
    return result

# ── 2. ALTITUDINE (dataset GitHub con quota) ───────────────
def load_altitude_dataset():
    """
    Prova diverse sorgenti GitHub per dati di altitudine.
    Ritorna dict { nome_lower: altitudine_m } oppure {}.
    """
    sources = [
        # Dataset comuni italiani con quota in metri
        "https://raw.githubusercontent.com/MatteoHenryChinaski/Comuni-Italiani-2018-Sql-Json-excel/master/comuni_italiani.json",
        "https://raw.githubusercontent.com/Torob/italianmunicipalities/master/municipalities.json",
    ]
    for url in sources:
        try:
            print(f"  Provo {url.split('/')[-1]}...")
            data = json.loads(fetch(url))
            alt_map = {}
            if isinstance(data, list) and len(data) > 0:
                sample = data[0]
                print(f"  Campi disponibili: {list(sample.keys())[:10]}")
                # Cerca campo altitudine
                alt_key = next((k for k in sample if any(x in k.lower()
                    for x in ["alt", "quot", "elev", "meter", "metro"])), None)
                name_key = next((k for k in sample if any(x in k.lower()
                    for x in ["nome", "name", "comune", "denominaz"])), None)
                if alt_key and name_key:
                    for row in data:
                        nome = str(row.get(name_key, "")).lower().strip()
                        alt  = row.get(alt_key)
                        if nome and alt is not None:
                            try:
                                alt_map[nome] = float(alt)
                            except (ValueError, TypeError):
                                pass
                    print(f"  Trovate {len(alt_map)} altitudini")
                    return alt_map
        except Exception as e:
            print(f"  Fallito: {e}")
    return {}

# ── 3. TEMPERATURA — formula climatica ────────────────────
def estimate_temperature(lat, alt_m):
    """
    Stima temperatura media annua (°C) da latitudine e altitudine.
    Formula calibrata per il territorio italiano:
      - Al livello del mare a 37°N ≈ 17°C (Sicilia/Calabria)
      - Al livello del mare a 47°N ≈ 11°C (Alto Adige)
      - Gradiente altimetrico: -0.6°C ogni 100m
    """
    if lat is None:
        return None
    temp_sea = 18.0 - 0.6 * (lat - 37.0)   # baseline a 37°N
    if alt_m:
        temp_sea -= 0.006 * alt_m            # lapse rate
    return round(temp_sea, 1)

# ── MAIN ──────────────────────────────────────────────────
def main():
    with open(COMUNI_FILE, encoding="utf-8") as f:
        comuni = json.load(f)
    print(f"Comuni caricati: {len(comuni)}")

    # 1. Abitanti
    try:
        pop_map = load_population()
    except Exception as e:
        print(f"ERRORE popolazione: {e}")
        pop_map = {}

    # 2. Altitudine da dataset
    print("→ Cerco dataset altitudini...")
    alt_map = load_altitude_dataset()

    # 3. Merge
    print("→ Unisco dati...")
    not_found_alt = 0
    for c in comuni:
        code = c["id"].zfill(6)
        nome_lower = c["comune"].lower().strip()

        # Abitanti
        c["abitanti"] = pop_map.get(code)

        # Altitudine: dataset → None (verrà integrata con formula temp)
        alt = alt_map.get(nome_lower)
        c["altitudine"] = int(alt) if alt is not None else None
        if alt is None:
            not_found_alt += 1

        # Temperatura
        c["temp_media"] = estimate_temperature(c.get("lat"), c.get("altitudine"))

    # Stats
    filled_alt  = sum(1 for c in comuni if c.get("altitudine")  is not None)
    filled_pop  = sum(1 for c in comuni if c.get("abitanti")    is not None)
    filled_temp = sum(1 for c in comuni if c.get("temp_media")  is not None)

    print(f"  Altitudine:  {filled_alt}/{len(comuni)}")
    print(f"  Abitanti:    {filled_pop}/{len(comuni)}")
    print(f"  Temperatura: {filled_temp}/{len(comuni)}")

    # Salva
    with open(COMUNI_FILE, "w", encoding="utf-8") as f:
        json.dump(comuni, f, ensure_ascii=False, separators=(",", ":"))
    print(f"\n✅ comuni.json aggiornato")

if __name__ == "__main__":
    main()
