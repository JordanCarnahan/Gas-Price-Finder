import json
import csv

INPUT_FILE = "gas_prices_near_la_mirada.json"
OUTPUT_FILE = "gas_prices.csv"

with open(INPUT_FILE, "r", encoding="utf-8") as f:
    data = json.load(f)

with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow([
        "City",
        "Station",
        "Address",
        "Regular",
        "Midgrade",
        "Premium",
        "Diesel"
    ])

    for city, stations in data.items():
        for s in stations:
            writer.writerow([
                city,
                s.get("name"),
                s.get("address"),
                s.get("regular"),
                s.get("midgrade"),
                s.get("premium"),
                s.get("diesel"),
            ])

print(f"Saved {OUTPUT_FILE}")
