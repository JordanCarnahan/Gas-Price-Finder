import argparse
import os
import re
import json
import csv
from datetime import datetime, timezone

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


def load_env_file(path: str):
    if not os.path.exists(path):
        return

    with open(path, "r", encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip("'\"")
            if key and key not in os.environ:
                os.environ[key] = value


# ---------- Browser helpers ----------
ENABLE_REGULAR = True
ENABLE_MIDGRADE = True
ENABLE_PREMIUM = True
ENABLE_DIESEL = True
ENABLE_UPDATE_TIMES = False
ENABLE_JSON_OUTPUT = False
ENABLE_CSV_OUTPUT = False

# ---------- City toggles ----------
ENABLE_CITY_LA_MIRADA = True
ENABLE_CITY_LA_HABRA = True
ENABLE_CITY_WHITTIER = True
ENABLE_CITY_SANTA_FE_SPRINGS = True
ENABLE_CITY_BUENA_PARK = True
ENABLE_CITY_NORWALK = True
ENABLE_CITY_CERRITOS = True
ENABLE_CITY_FULLERTON = True
ENABLE_CITY_BREA = True
ENABLE_CITY_ANAHEIM = True

CITY_URLS = {
    "La Mirada": "https://www.gasbuddy.com/gasprices/california/la-mirada",
    "La Habra": "https://www.gasbuddy.com/gasprices/california/la-habra",
    "Whittier": "https://www.gasbuddy.com/gasprices/california/whittier",
    "Santa Fe Springs": "https://www.gasbuddy.com/gasprices/california/santa-fe-springs",
    "Buena Park": "https://www.gasbuddy.com/gasprices/california/buena-park",
    "Norwalk": "https://www.gasbuddy.com/gasprices/california/norwalk",
    "Cerritos": "https://www.gasbuddy.com/gasprices/california/cerritos",
    "Fullerton": "https://www.gasbuddy.com/gasprices/california/fullerton",
    "Brea": "https://www.gasbuddy.com/gasprices/california/brea",
    "Anaheim": "https://www.gasbuddy.com/gasprices/california/anaheim",
}

CITY_TOGGLES = {
    "La Mirada": ENABLE_CITY_LA_MIRADA,
    "La Habra": ENABLE_CITY_LA_HABRA,
    "Whittier": ENABLE_CITY_WHITTIER,
    "Santa Fe Springs": ENABLE_CITY_SANTA_FE_SPRINGS,
    "Buena Park": ENABLE_CITY_BUENA_PARK,
    "Norwalk": ENABLE_CITY_NORWALK,
    "Cerritos": ENABLE_CITY_CERRITOS,
    "Fullerton": ENABLE_CITY_FULLERTON,
    "Brea": ENABLE_CITY_BREA,
    "Anaheim": ENABLE_CITY_ANAHEIM,
}

STREET_SUFFIXES = (
    "st", "street", "ave", "avenue", "blvd", "boulevard", "rd", "road",
    "dr", "drive", "ln", "lane", "ct", "court", "pl", "place", "way",
    "pkwy", "parkway", "hwy", "highway", "cir", "circle", "trl", "trail"
)

bad_address_phrases = (
    "top ", "best gas", "gas prices", "cheap fuel", "stations in", "in "
)

def looks_like_address(line: str) -> bool:
    s = (line or "").strip()
    if not s:
        return False

    low = s.lower()

    # reject obvious page-title style lines
    if any(p in low for p in bad_address_phrases) and " ca" in low:
        return False

    # must start with a number (street number)
    if not re.match(r"^\d{1,6}\s", s):
        return False

    # should contain a common street suffix
    tokens = re.findall(r"[a-zA-Z]+", low)
    return any(tok in STREET_SUFFIXES for tok in tokens)


def city_has_stations(driver, timeout: int = 6) -> bool:
    try:
        WebDriverWait(driver, timeout).until(
            lambda d: len(d.find_elements(By.CSS_SELECTOR, 'a[href^="/station/"]')) > 0
        )
        return True
    except Exception:
        return False

def make_driver(headless: bool = False) -> webdriver.Chrome:
    opts = Options()
    if headless:
        opts.add_argument("--headless=new")
    opts.add_argument("--window-size=1400,900")
    return webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=opts)


def first_price_text(driver) -> str:
    # Find any visible element starting with "$"
    prices = driver.find_elements(By.XPATH, "//*[starts-with(normalize-space(.), '$')]")
    for p in prices:
        t = p.text.strip()
        if t.startswith("$"):
            return t
    return ""

def select_fueltype_and_wait(driver, value: str, timeout: int = 15):
    wait = WebDriverWait(driver, timeout)

    # Ensure the select exists
    wait.until(EC.presence_of_element_located((By.ID, "fuelType")))

    before = first_price_text(driver)

    # Set value via JS + fire change
    driver.execute_script(
        """
        const sel = document.getElementById('fuelType');
        sel.value = arguments[0];
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        """,
        value
    )

    # Wait until the select reflects the new value
    wait.until(lambda d: d.execute_script("return document.getElementById('fuelType').value") == value)

    # Now wait for data to be present.
    # If we were already on this fuel type, prices may NOT change, so we accept "prices exist".
    def ready(d):
        # station links present OR a price exists
        has_station = len(d.find_elements(By.CSS_SELECTOR, 'a[href^="/station/"]')) > 0
        fp = first_price_text(d)
        has_price = fp != ""
        changed = (before != "" and fp != "" and fp != before)
        return has_station and (has_price or changed)

    wait.until(ready)


# ---------- Scraping logic ----------
price_re = re.compile(r"\$\s*(\d+\.\d{2})")


def find_station_card(station_link_el):
    """
    Given the <a href="/station/..."> element, find the smallest ancestor div
    that represents exactly one station entry (one station link).
    """
    ancestors = station_link_el.find_elements(By.XPATH, "./ancestor::div[position()<=12]")

    for cand in ancestors:
        links = cand.find_elements(By.CSS_SELECTOR, 'a[href^="/station/"]')
        if len(links) == 1:
            txt = (cand.get_attribute("innerText") or "").strip()
            if "$" in txt and len(txt) < 1200:
                return cand

    return ancestors[0] if ancestors else None


def scrape_city_page_current_dom(driver, limit: int = 30):
    """
    Scrapes whatever fuel type is currently selected on the page.
    Returns a list of station dicts with name, station_url, price, address, updated.
    """

    try:
        WebDriverWait(driver, 10).until(
            lambda d: len(d.find_elements(By.CSS_SELECTOR, 'a[href^="/station/"]')) > 0
        )
    except Exception:
        # No stations on this page
        return []

    links = driver.find_elements(By.CSS_SELECTOR, 'a[href^="/station/"]')
    results = []
    seen = set()

    for a in links:
        name = a.text.strip()
        href = a.get_attribute("href")

        if not name or not href:
            continue
        if href in seen:
            continue
        seen.add(href)

        card = find_station_card(a)
        if card is None:
            continue

        text = (card.get_attribute("innerText") or "").strip()

        m = price_re.search(text)
        price = float(m.group(1)) if m else None

        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]

        # Address
        address = ""
        for ln in lines:
            if looks_like_address(ln):
                address = ln
                break


        # Updated time
        updated = ""
        for ln in lines:
            if re.search(r"\bago\b", ln, re.IGNORECASE):
                updated = ln
                break

        if price is not None:
            results.append({
                "name": name,
                "station_url": href,
                "price": price,
                "address": address,
                "updated": updated
            })

        if len(results) >= limit:
            break

    return results

def station_id_from_url(u: str) -> str:
    return u.rstrip("/").split("/")[-1]


def combine_by_station(regular, midgrade, premium, diesel, include_updates=True):
    combined = {}

    for grade, rows in [
        ("regular", regular),
        ("midgrade", midgrade),
        ("premium", premium),
        ("diesel", diesel),
    ]:
        for r in rows:
            sid = station_id_from_url(r["station_url"])
            combined.setdefault(sid, {
                "name": r["name"],
                "station_url": r["station_url"],
                "address": r.get("address", ""),
            })
            combined[sid][grade] = r.get("price")

            if include_updates:
                combined[sid][f"{grade}_updated"] = r.get("updated", "")
            else:
                combined[sid][f"{grade}_updated"] = ""

    return list(combined.values())


def scrape_all_fueltypes(url: str, limit: int = 30, headless: bool = False):
    driver = make_driver(headless=headless)

    driver.execute_cdp_cmd(
        "Network.setBlockedURLs",
        {"urls": ["*.png", "*.jpg", "*.jpeg", "*.gif", "*.svg", "*.css", "*.woff*", "*.ttf"]}
    )
    driver.execute_cdp_cmd("Network.enable", {})

    try:
        driver.get(url)

        if not city_has_stations(driver):
            return []

        regular_data = []
        midgrade_data = []
        premium_data = []
        diesel_data = []

        # Regular (default)
        if ENABLE_REGULAR:
            regular_data = scrape_city_page_current_dom(driver, limit=limit)

        # Midgrade
        if ENABLE_MIDGRADE:
            select_fueltype_and_wait(driver, "2")
            midgrade_data = scrape_city_page_current_dom(driver, limit=limit)

        # Premium
        if ENABLE_PREMIUM:
            select_fueltype_and_wait(driver, "3")
            premium_data = scrape_city_page_current_dom(driver, limit=limit)

        # Diesel
        if ENABLE_DIESEL:
            select_fueltype_and_wait(driver, "4")
            diesel_data = scrape_city_page_current_dom(driver, limit=limit)

        return combine_by_station(
            regular_data,
            midgrade_data,
            premium_data,
            diesel_data,
            include_updates=ENABLE_UPDATE_TIMES
        )

    finally:
        driver.quit()


def flatten_results_for_storage(all_results: dict, run_timestamp: str, run_label: str):
    rows = []
    for city, stations in all_results.items():
        if isinstance(stations, dict) and "error" in stations:
            rows.append({
                "run_timestamp": run_timestamp,
                "run_label": run_label,
                "city": city,
                "station_id": None,
                "station_name": "ERROR",
                "station_url": None,
                "address": None,
                "regular": None,
                "regular_updated": None,
                "midgrade": None,
                "midgrade_updated": None,
                "premium": None,
                "premium_updated": None,
                "diesel": None,
                "diesel_updated": None,
                "scrape_error": stations.get("error", ""),
            })
            continue

        for s in stations:
            station_url = s.get("station_url", "")
            rows.append({
                "run_timestamp": run_timestamp,
                "run_label": run_label,
                "city": city,
                "station_id": station_id_from_url(station_url) if station_url else None,
                "station_name": s.get("name", ""),
                "station_url": station_url or None,
                "address": s.get("address", "") or None,
                "regular": s.get("regular"),
                "regular_updated": s.get("regular_updated", "") or None,
                "midgrade": s.get("midgrade"),
                "midgrade_updated": s.get("midgrade_updated", "") or None,
                "premium": s.get("premium"),
                "premium_updated": s.get("premium_updated", "") or None,
                "diesel": s.get("diesel"),
                "diesel_updated": s.get("diesel_updated", "") or None,
                "scrape_error": None,
            })
    return rows


def write_csv(data: dict, ts_label: str, csv_file: str):
    seen_station_address = set()

    with open(csv_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)

        writer.writerow([
            "Run Timestamp",
            "City",
            "Station",
            "Address",
            "Regular",
            "Regular Updated",
            "Midgrade",
            "Midgrade Updated",
            "Premium",
            "Premium Updated",
            "Diesel",
            "Diesel Updated",
        ])

        for city, stations in data.items():
            if isinstance(stations, dict) and "error" in stations:
                writer.writerow([ts_label, city, "ERROR", stations.get("error", ""), "", "", "", "", "", "", "", ""])
                continue

            for s in stations:
                station_name = (s.get("name", "") or "").strip()
                address = (s.get("address", "") or "").strip()
                if station_name and address:
                    dedupe_key = (station_name.lower(), address.lower())
                    if dedupe_key in seen_station_address:
                        continue
                    seen_station_address.add(dedupe_key)

                writer.writerow([
                    ts_label,
                    city,
                    station_name,
                    address,
                    s.get("regular", ""),
                    s.get("regular_updated", ""),
                    s.get("midgrade", ""),
                    s.get("midgrade_updated", ""),
                    s.get("premium", ""),
                    s.get("premium_updated", ""),
                    s.get("diesel", ""),
                    s.get("diesel_updated", ""),
                ])


def dedupe_rows_by_station_and_address(rows):
    deduped = []
    seen_station_address = set()

    for row in rows:
        station_name = (row.get("station_name") or "").strip()
        address = (row.get("address") or "").strip()
        if not station_name or not address:
            deduped.append(row)
            continue

        dedupe_key = (station_name.lower(), address.lower())
        if dedupe_key in seen_station_address:
            continue

        row["station_name"] = station_name
        row["address"] = address
        seen_station_address.add(dedupe_key)
        deduped.append(row)

    return deduped


def upload_to_supabase(rows):
    try:
        from supabase import create_client
    except ImportError as e:
        raise RuntimeError("Missing dependency: install with `pip install supabase`") from e

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")
    table_name = os.getenv("SUPABASE_TABLE", "gas_prices")

    if not supabase_url or not supabase_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set in your environment")

    client = create_client(supabase_url, supabase_key)
    batch_size = 500

    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        client.table(table_name).upsert(batch, on_conflict="station_name,address").execute()

#main execution
if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    load_env_file(os.path.join(script_dir, ".env"))
    load_env_file(os.path.join(os.getcwd(), ".env"))

    parser = argparse.ArgumentParser(description="Scrape gas prices and upload to Supabase.")
    parser.add_argument("--no-json", action="store_true", help="Skip JSON export.")
    parser.add_argument("--no-csv", action="store_true", help="Skip CSV export.")
    parser.add_argument("--no-supabase", action="store_true", help="Skip Supabase upload.")
    parser.add_argument("--headless", action="store_true", help="Run browser in headless mode.")
    parser.add_argument("--limit", type=int, default=30, help="Max stations per city/fuel type.")
    args = parser.parse_args()

    cities = {name: CITY_URLS[name] for name, enabled in CITY_TOGGLES.items() if enabled}

    all_results = {}

    for city_name, url in cities.items():
        print(f"Scraping {city_name}...")

        try:
            city_data = scrape_all_fueltypes(url, limit=args.limit, headless=args.headless)
            all_results[city_name] = city_data if city_data else []

            if not city_data:
                print(f"Skipped {city_name} (no data)")

        except Exception as e:
            print(f"Error on {city_name}")
            all_results[city_name] = {"error": str(e)}

    JSON_DIR = "JSON Files"
    CSV_DIR = "CSV Files"


    # Create timestamped filenames
    run_dt = datetime.now(timezone.utc)
    ts = run_dt.strftime("%Y-%m-%d_%H-%M-%S")
    run_timestamp = run_dt.isoformat()
    json_file = os.path.join(JSON_DIR, f"gas_prices_{ts}.json")
    csv_file = os.path.join(CSV_DIR, f"gas_prices_{ts}.csv")

    write_json_output = ENABLE_JSON_OUTPUT and not args.no_json
    write_csv_output = ENABLE_CSV_OUTPUT and not args.no_csv

    if write_json_output:
        os.makedirs(JSON_DIR, exist_ok=True)
        with open(json_file, "w", encoding="utf-8") as f:
            json.dump(all_results, f, indent=2)
        print(f"Saved {json_file}")
    else:
        print("Skipped JSON export (toggle/flag).")

    rows = flatten_results_for_storage(all_results, run_timestamp=run_timestamp, run_label=ts)
    rows = dedupe_rows_by_station_and_address(rows)

    if args.no_supabase:
        print("Skipped Supabase upload (--no-supabase).")
    else:
        try:
            upload_to_supabase(rows)
            print(f"Uploaded {len(rows)} rows to Supabase.")
        except Exception as e:
            print(f"Supabase upload failed: {e}")

    if write_csv_output:
        os.makedirs(CSV_DIR, exist_ok=True)
        write_csv(all_results, ts_label=ts, csv_file=csv_file)
        print(f"Saved {csv_file}")
    else:
        print("Skipped CSV export (toggle/flag).")
