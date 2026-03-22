#!/usr/bin/env python3
"""Download and merge Italian comuni data with coordinates."""
import requests
import json

PROVINCE_NAMES = {
    "AG": "Agrigento", "AL": "Alessandria", "AN": "Ancona", "AO": "Aosta",
    "AP": "Ascoli Piceno", "AQ": "L'Aquila", "AR": "Arezzo", "AT": "Asti",
    "AV": "Avellino", "BA": "Bari", "BG": "Bergamo", "BI": "Biella",
    "BL": "Belluno", "BN": "Benevento", "BO": "Bologna", "BR": "Brindisi",
    "BS": "Brescia", "BT": "Barletta-Andria-Trani", "BZ": "Bolzano/Bozen",
    "CA": "Cagliari", "CB": "Campobasso", "CE": "Caserta", "CH": "Chieti",
    "CI": "Carbonia-Iglesias", "CL": "Caltanissetta", "CN": "Cuneo",
    "CO": "Como", "CR": "Cremona", "CS": "Cosenza", "CT": "Catania",
    "CZ": "Catanzaro", "EN": "Enna", "FC": "Forlì-Cesena", "FE": "Ferrara",
    "FG": "Foggia", "FI": "Firenze", "FM": "Fermo", "FR": "Frosinone",
    "GE": "Genova", "GO": "Gorizia", "GR": "Grosseto", "IM": "Imperia",
    "IS": "Isernia", "KR": "Crotone", "LC": "Lecco", "LE": "Lecce",
    "LI": "Livorno", "LO": "Lodi", "LT": "Latina", "LU": "Lucca",
    "MB": "Monza e della Brianza", "MC": "Macerata", "ME": "Messina",
    "MI": "Milano", "MN": "Mantova", "MO": "Modena", "MS": "Massa-Carrara",
    "MT": "Matera", "NA": "Napoli", "NO": "Novara", "NU": "Nuoro",
    "OG": "Ogliastra", "OR": "Oristano", "OT": "Olbia-Tempio", "PA": "Palermo",
    "PC": "Piacenza", "PD": "Padova", "PE": "Pescara", "PG": "Perugia",
    "PI": "Pisa", "PN": "Pordenone", "PO": "Prato", "PR": "Parma",
    "PT": "Pistoia", "PU": "Pesaro e Urbino", "PV": "Pavia", "PZ": "Potenza",
    "RA": "Ravenna", "RC": "Reggio Calabria", "RE": "Reggio Emilia",
    "RG": "Ragusa", "RI": "Rieti", "RM": "Roma", "RN": "Rimini",
    "RO": "Rovigo", "SA": "Salerno", "SI": "Siena", "SO": "Sondrio",
    "SP": "La Spezia", "SR": "Siracusa", "SS": "Sassari", "SU": "Sud Sardegna",
    "SV": "Savona", "TA": "Taranto", "TE": "Teramo", "TN": "Trento",
    "TO": "Torino", "TP": "Trapani", "TR": "Terni", "TS": "Trieste",
    "TV": "Treviso", "UD": "Udine", "VA": "Varese", "VB": "Verbano-Cusio-Ossola",
    "VC": "Vercelli", "VE": "Venezia", "VI": "Vicenza", "VR": "Verona",
    "VS": "Medio Campidano", "VT": "Viterbo", "VV": "Vibo Valentia",
}

print("Downloading comuni data...")
r1 = requests.get(
    "https://raw.githubusercontent.com/MatteoHenryChinaski/Comuni-Italiani-2018-Sql-Json-excel/master/italy_cities.json",
    timeout=30
)
cities = r1.json()

print("Downloading geo data...")
r2 = requests.get(
    "https://raw.githubusercontent.com/MatteoHenryChinaski/Comuni-Italiani-2018-Sql-Json-excel/master/italy_geo.json",
    timeout=30
)
geo = r2.json()

# Build geo lookup by istat code
geo_map = {g["istat"]: g for g in geo}

comuni = []
for city in cities:
    if "comune" not in city or not city.get("comune"):
        continue
    istat = city["istat"]
    geo_data = geo_map.get(istat, {})
    lat = geo_data.get("lat")
    lng = geo_data.get("lng")

    prov_code = city.get("provincia", "")
    prov_name = PROVINCE_NAMES.get(prov_code, prov_code)

    # Fix known typos in region names
    regione = city["regione"]
    regione = regione.replace("Emilia-ROmagna", "Emilia-Romagna")

    comuni.append({
        "id": istat,
        "comune": city["comune"],
        "provincia": prov_name,
        "sigla": prov_code,
        "regione": regione,
        "lat": float(lat) if lat else None,
        "lng": float(lng) if lng else None,
    })

# Sort by regione, provincia, comune
comuni.sort(key=lambda x: (x["regione"], x["provincia"], x["comune"]))

with open("comuni.json", "w", encoding="utf-8") as f:
    json.dump(comuni, f, ensure_ascii=False, separators=(",", ":"))

print(f"Saved {len(comuni)} comuni to comuni.json")
with_coords = sum(1 for c in comuni if c["lat"] and c["lng"])
print(f"With coordinates: {with_coords}")
