import argparse
import csv
import json
import math
import os
import re
import time
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import quote_plus
from urllib.request import Request, urlopen

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager


# ---------- Output paths ----------
JSON_DIR = "JSON Files"
CSV_DIR = "CSV Files"


# ---------- Runtime toggles ----------
ENABLE_REGULAR = True
ENABLE_MIDGRADE = True
ENABLE_PREMIUM = True
ENABLE_DIESEL = True
ENABLE_UPDATE_TIMES = False
ENABLE_JSON_OUTPUT = False
ENABLE_CSV_OUTPUT = False
ENABLE_GEOCODING = True


# ---------- Geocoding configuration ----------
GEOCODE_DELAY_SECONDS = 1.1
GEOCODE_TIMEOUT_SECONDS = 12
BIOLA_LATITUDE = 33.9053
BIOLA_LONGITUDE = -117.9874


# ---------- Scrape configuration ----------
PRICE_RE = re.compile(r"\$\s*(\d+\.\d{2})")
BLOCKED_RESOURCE_PATTERNS = [
    "*.png", "*.jpg", "*.jpeg", "*.gif", "*.svg", "*.css", "*.woff*", "*.ttf",
]
FUEL_TYPE_VALUES = {
    "midgrade": "2",
    "premium": "3",
    "diesel": "4",
}
CSV_HEADERS = [
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
]


def load_env_file(path: str):
    """Load simple KEY=VALUE pairs into the process environment once."""
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

# ---------- Address parsing heuristics ----------
STREET_SUFFIXES = (
    "st", "street", "ave", "avenue", "blvd", "boulevard", "rd", "road",
    "dr", "drive", "ln", "lane", "ct", "court", "pl", "place", "way",
    "pkwy", "parkway", "hwy", "highway", "cir", "circle", "trl", "trail"
)

bad_address_phrases = (
    "top ", "best gas", "gas prices", "cheap fuel", "stations in", "in "
)


def looks_like_address(line: str) -> bool:
    """Heuristically identify address lines inside a GasBuddy station card."""
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


# ---------- Browser helpers ----------
def city_has_stations(driver, timeout: int = 6) -> bool:
    """Return True once at least one station link is present on the page."""
    try:
        WebDriverWait(driver, timeout).until(
            lambda d: len(d.find_elements(By.CSS_SELECTOR, 'a[href^="/station/"]')) > 0
        )
        return True
    except Exception:
        return False


def make_driver(headless: bool = False) -> webdriver.Chrome:
    """Create a Chrome driver with the viewport used by the scraper."""
    opts = Options()
    if headless:
        opts.add_argument("--headless=new")
    opts.add_argument("--window-size=1400,900")
    return webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=opts)


def first_price_text(driver) -> str:
    """Read the first visible price-like string from the current page."""
    prices = driver.find_elements(By.XPATH, "//*[starts-with(normalize-space(.), '$')]")
    for p in prices:
        t = p.text.strip()
        if t.startswith("$"):
            return t
    return ""


def select_fueltype_and_wait(driver, value: str, timeout: int = 15):
    """Switch the GasBuddy fuel selector and wait for station data to be ready."""
    wait = WebDriverWait(driver, timeout)

    wait.until(EC.presence_of_element_located((By.ID, "fuelType")))
    before = first_price_text(driver)

    driver.execute_script(
        """
        const sel = document.getElementById('fuelType');
        sel.value = arguments[0];
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        """,
        value
    )

    wait.until(lambda d: d.execute_script("return document.getElementById('fuelType').value") == value)

    def ready(d):
        has_station = len(d.find_elements(By.CSS_SELECTOR, 'a[href^="/station/"]')) > 0
        fp = first_price_text(d)
        has_price = fp != ""
        changed = (before != "" and fp != "" and fp != before)
        return has_station and (has_price or changed)

    wait.until(ready)


# ---------- Scraping ----------
def find_station_card(station_link_el):
    """Return the closest ancestor div that appears to contain a single station row."""
    ancestors = station_link_el.find_elements(By.XPATH, "./ancestor::div[position()<=12]")

    for cand in ancestors:
        links = cand.find_elements(By.CSS_SELECTOR, 'a[href^="/station/"]')
        if len(links) == 1:
            txt = (cand.get_attribute("innerText") or "").strip()
            if "$" in txt and len(txt) < 1200:
                return cand

    return ancestors[0] if ancestors else None


def scrape_city_page_current_dom(driver, limit: int = 30):
    """Scrape the currently selected fuel type from the loaded city page."""
    try:
        WebDriverWait(driver, 10).until(
            lambda d: len(d.find_elements(By.CSS_SELECTOR, 'a[href^="/station/"]')) > 0
        )
    except Exception:
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

        m = PRICE_RE.search(text)
        price = float(m.group(1)) if m else None

        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]

        address = ""
        for ln in lines:
            if looks_like_address(ln):
                address = ln
                break

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
    """Extract the GasBuddy station id from the canonical station URL."""
    return u.rstrip("/").split("/")[-1]


def combine_by_station(regular, midgrade, premium, diesel, include_updates=True):
    """Merge per-fuel scrape results into one row per station."""
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


def scrape_enabled_fuel_types(driver, limit: int):
    """Scrape each enabled fuel type from the current city page."""
    regular_data = []
    midgrade_data = []
    premium_data = []
    diesel_data = []

    if ENABLE_REGULAR:
        regular_data = scrape_city_page_current_dom(driver, limit=limit)
    if ENABLE_MIDGRADE:
        select_fueltype_and_wait(driver, FUEL_TYPE_VALUES["midgrade"])
        midgrade_data = scrape_city_page_current_dom(driver, limit=limit)
    if ENABLE_PREMIUM:
        select_fueltype_and_wait(driver, FUEL_TYPE_VALUES["premium"])
        premium_data = scrape_city_page_current_dom(driver, limit=limit)
    if ENABLE_DIESEL:
        select_fueltype_and_wait(driver, FUEL_TYPE_VALUES["diesel"])
        diesel_data = scrape_city_page_current_dom(driver, limit=limit)

    return regular_data, midgrade_data, premium_data, diesel_data


def scrape_all_fueltypes(url: str, limit: int = 30, headless: bool = False):
    """Scrape all enabled fuel types for a single city URL."""
    driver = make_driver(headless=headless)

    driver.execute_cdp_cmd("Network.setBlockedURLs", {"urls": BLOCKED_RESOURCE_PATTERNS})
    driver.execute_cdp_cmd("Network.enable", {})

    try:
        driver.get(url)

        if not city_has_stations(driver):
            return []

        regular_data, midgrade_data, premium_data, diesel_data = scrape_enabled_fuel_types(driver, limit)

        return combine_by_station(
            regular_data,
            midgrade_data,
            premium_data,
            diesel_data,
            include_updates=ENABLE_UPDATE_TIMES
        )

    finally:
        driver.quit()


# ---------- Row shaping ----------
def build_error_row(city: str, run_timestamp: str, run_label: str, error: str):
    """Represent a city-level scrape failure in the storage schema."""
    return {
        "run_timestamp": run_timestamp,
        "run_label": run_label,
        "city": city,
        "station_id": None,
        "station_name": "ERROR",
        "station_url": None,
        "address": None,
        "latitude": None,
        "longitude": None,
        "distance_from_biola_miles": None,
        "regular": None,
        "regular_updated": None,
        "midgrade": None,
        "midgrade_updated": None,
        "premium": None,
        "premium_updated": None,
        "diesel": None,
        "diesel_updated": None,
        "scrape_error": error,
    }


def build_storage_row(city: str, station: dict, run_timestamp: str, run_label: str):
    """Convert a scraped station result into the Supabase/history row shape."""
    station_url = station.get("station_url", "")
    return {
        "run_timestamp": run_timestamp,
        "run_label": run_label,
        "city": city,
        "station_id": station_id_from_url(station_url) if station_url else None,
        "station_name": station.get("name", ""),
        "station_url": station_url or None,
        "address": station.get("address", "") or None,
        "latitude": None,
        "longitude": None,
        "distance_from_biola_miles": None,
        "regular": station.get("regular"),
        "regular_updated": station.get("regular_updated", "") or None,
        "midgrade": station.get("midgrade"),
        "midgrade_updated": station.get("midgrade_updated", "") or None,
        "premium": station.get("premium"),
        "premium_updated": station.get("premium_updated", "") or None,
        "diesel": station.get("diesel"),
        "diesel_updated": station.get("diesel_updated", "") or None,
        "scrape_error": None,
    }


def flatten_results_for_storage(all_results: dict, run_timestamp: str, run_label: str):
    """Flatten city-grouped scrape results into a list of storage rows."""
    rows = []
    for city, stations in all_results.items():
        if isinstance(stations, dict) and "error" in stations:
            rows.append(build_error_row(city, run_timestamp, run_label, stations.get("error", "")))
            continue

        for station in stations:
            rows.append(build_storage_row(city, station, run_timestamp, run_label))
    return rows


def write_csv(data: dict, ts_label: str, csv_file: str):
    """Write the most recent scrape results to a flat CSV export."""
    seen_station_address = set()

    with open(csv_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(CSV_HEADERS)

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
    """Drop duplicate station/address pairs before storage or export."""
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


# ---------- Geocoding and coordinate reuse ----------
def geocode_address(address: str, city: str):
    """Resolve a station address to coordinates via Nominatim."""
    query = f"{address}, {city}, CA"
    url = f"https://nominatim.openstreetmap.org/search?format=json&limit=1&q={quote_plus(query)}"
    req = Request(url, headers={"User-Agent": "GasPriceFinder/1.0"})

    try:
        with urlopen(req, timeout=GEOCODE_TIMEOUT_SECONDS) as resp:
            payload = json.load(resp)
    except (HTTPError, URLError, TimeoutError):
        return None, None

    if not payload:
        return None, None

    try:
        lat = float(payload[0]["lat"])
        lon = float(payload[0]["lon"])
        return lat, lon
    except (KeyError, TypeError, ValueError, IndexError):
        return None, None


def haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Compute straight-line distance between two coordinates in miles."""
    radius_miles = 3958.8
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return radius_miles * c


def chunked(values, size: int):
    """Yield fixed-size slices from a sequence for batched API calls."""
    for i in range(0, len(values), size):
        yield values[i:i + size]


def load_existing_coordinates(rows):
    """Load known coordinates from Supabase so repeat scrapes skip geocoding."""
    try:
        from supabase import create_client
    except ImportError:
        return {}, {}

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")
    table_name = os.getenv("SUPABASE_TABLE", "gas_price_history")

    if not supabase_url or not supabase_key:
        return {}, {}

    client = create_client(supabase_url, supabase_key)
    station_coords = {}
    address_coords = {}

    station_ids = sorted({
        (row.get("station_id") or "").strip()
        for row in rows
        if not row.get("scrape_error") and (row.get("station_id") or "").strip()
    })

    addresses = sorted({
        (row.get("address") or "").strip()
        for row in rows
        if not row.get("scrape_error") and (row.get("address") or "").strip()
    })

    select_cols = "station_id,address,city,latitude,longitude,distance_from_biola_miles,run_timestamp"

    for batch in chunked(station_ids, 100):
        response = (
            client.table(table_name)
            .select(select_cols)
            .in_("station_id", batch)
            .order("run_timestamp", desc=True)
            .execute()
        )
        for record in response.data or []:
            station_id = (record.get("station_id") or "").strip()
            lat = record.get("latitude")
            lon = record.get("longitude")
            if not station_id or lat is None or lon is None or station_id in station_coords:
                continue
            station_coords[station_id] = (
                float(lat),
                float(lon),
                record.get("distance_from_biola_miles"),
            )

    for batch in chunked(addresses, 100):
        response = (
            client.table(table_name)
            .select(select_cols)
            .in_("address", batch)
            .order("run_timestamp", desc=True)
            .execute()
        )
        for record in response.data or []:
            address = (record.get("address") or "").strip().lower()
            city = (record.get("city") or "").strip().lower()
            lat = record.get("latitude")
            lon = record.get("longitude")
            key = (address, city)
            if not address or not city or lat is None or lon is None or key in address_coords:
                continue
            address_coords[key] = (
                float(lat),
                float(lon),
                record.get("distance_from_biola_miles"),
            )

    return station_coords, address_coords


def enrich_rows_with_coordinates(rows):
    """Attach coordinates to rows, reusing Supabase history when available."""
    if not ENABLE_GEOCODING:
        return rows

    cache = {}
    station_coords, address_coords = load_existing_coordinates(rows)
    reused = 0
    looked_up = 0

    for row in rows:
        if row.get("scrape_error"):
            continue

        station_id = (row.get("station_id") or "").strip()
        address = (row.get("address") or "").strip()
        city = (row.get("city") or "").strip()
        if not address or not city:
            continue

        cache_key = (address.lower(), city.lower())
        if cache_key in cache:
            lat, lon = cache[cache_key]
            distance = haversine_miles(BIOLA_LATITUDE, BIOLA_LONGITUDE, lat, lon) if lat is not None and lon is not None else None
        elif station_id and station_id in station_coords:
            lat, lon, distance = station_coords[station_id]
            cache[cache_key] = (lat, lon)
            reused += 1
        elif cache_key in address_coords:
            lat, lon, distance = address_coords[cache_key]
            cache[cache_key] = (lat, lon)
            reused += 1
        else:
            lat, lon = geocode_address(address, city)
            cache[cache_key] = (lat, lon)
            distance = haversine_miles(BIOLA_LATITUDE, BIOLA_LONGITUDE, lat, lon) if lat is not None and lon is not None else None
            looked_up += 1
            time.sleep(GEOCODE_DELAY_SECONDS)

        if lat is not None and lon is not None:
            row["latitude"] = lat
            row["longitude"] = lon
            row["distance_from_biola_miles"] = distance

    print(f"Reused coordinates for {reused} addresses.")
    print(f"Geocoded {looked_up} unique addresses.")
    return rows


# ---------- Supabase persistence ----------
def upload_to_supabase(rows):
    """Insert append-only history rows into Supabase in batches."""
    try:
        from supabase import create_client
    except ImportError as e:
        raise RuntimeError("Missing dependency: install with `pip install supabase`") from e

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")
    table_name = os.getenv("SUPABASE_TABLE", "gas_price_history")

    if not supabase_url or not supabase_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set in your environment")

    client = create_client(supabase_url, supabase_key)
    batch_size = 500

    for i in range(0, len(rows), batch_size):
        batch = []
        for row in rows[i:i + batch_size]:
            payload_row = dict(row)
            if payload_row.get("latitude") is None:
                payload_row.pop("latitude", None)
            if payload_row.get("longitude") is None:
                payload_row.pop("longitude", None)
            if payload_row.get("distance_from_biola_miles") is None:
                payload_row.pop("distance_from_biola_miles", None)
            batch.append(payload_row)
        client.table(table_name).insert(batch).execute()


# ---------- Script orchestration ----------
def parse_args():
    """Parse CLI flags for local exports, uploads, and browser behavior."""
    parser = argparse.ArgumentParser(description="Scrape gas prices and upload to Supabase.")
    parser.add_argument("--no-json", action="store_true", help="Skip JSON export.")
    parser.add_argument("--no-csv", action="store_true", help="Skip CSV export.")
    parser.add_argument("--no-supabase", action="store_true", help="Skip Supabase upload.")
    parser.add_argument("--headless", action="store_true", help="Run browser in headless mode.")
    parser.add_argument("--limit", type=int, default=30, help="Max stations per city/fuel type.")
    return parser.parse_args()


def get_enabled_cities():
    """Return only the cities that are currently enabled by the toggles above."""
    return {name: CITY_URLS[name] for name, enabled in CITY_TOGGLES.items() if enabled}


def scrape_enabled_cities(limit: int, headless: bool):
    """Scrape all enabled city pages and keep city-level failures in the result set."""
    all_results = {}
    for city_name, url in get_enabled_cities().items():
        print(f"Scraping {city_name}...")
        try:
            city_data = scrape_all_fueltypes(url, limit=limit, headless=headless)
            all_results[city_name] = city_data if city_data else []
            if not city_data:
                print(f"Skipped {city_name} (no data)")
        except Exception as e:
            print(f"Error on {city_name}")
            all_results[city_name] = {"error": str(e)}
    return all_results


def build_run_metadata():
    """Create the timestamp values and filenames for one scraper run."""
    run_dt = datetime.now(timezone.utc)
    ts = run_dt.strftime("%Y-%m-%d_%H-%M-%S")
    return {
        "run_label": ts,
        "run_timestamp": run_dt.isoformat(),
        "json_file": os.path.join(JSON_DIR, f"gas_prices_{ts}.json"),
        "csv_file": os.path.join(CSV_DIR, f"gas_prices_{ts}.csv"),
    }


def maybe_write_json(all_results: dict, json_file: str, should_write: bool):
    """Write raw grouped scrape output when JSON export is enabled."""
    if not should_write:
        print("Skipped JSON export (toggle/flag).")
        return

    os.makedirs(JSON_DIR, exist_ok=True)
    with open(json_file, "w", encoding="utf-8") as f:
        json.dump(all_results, f, indent=2)
    print(f"Saved {json_file}")


def maybe_write_csv(all_results: dict, run_label: str, csv_file: str, should_write: bool):
    """Write the flat CSV export when CSV output is enabled."""
    if not should_write:
        print("Skipped CSV export (toggle/flag).")
        return

    os.makedirs(CSV_DIR, exist_ok=True)
    write_csv(all_results, ts_label=run_label, csv_file=csv_file)
    print(f"Saved {csv_file}")


def process_rows_for_storage(all_results: dict, run_timestamp: str, run_label: str):
    """Flatten, dedupe, and enrich rows before inserting them into Supabase."""
    rows = flatten_results_for_storage(all_results, run_timestamp=run_timestamp, run_label=run_label)
    rows = dedupe_rows_by_station_and_address(rows)
    return enrich_rows_with_coordinates(rows)


def main():
    """Run one full scrape, optional exports, optional Supabase upload, and timing."""
    started_at = time.perf_counter()
    script_dir = os.path.dirname(os.path.abspath(__file__))
    load_env_file(os.path.join(script_dir, ".env"))
    load_env_file(os.path.join(os.getcwd(), ".env"))

    args = parse_args()
    all_results = scrape_enabled_cities(limit=args.limit, headless=args.headless)
    run_meta = build_run_metadata()

    maybe_write_json(
        all_results,
        run_meta["json_file"],
        ENABLE_JSON_OUTPUT and not args.no_json,
    )

    rows = process_rows_for_storage(
        all_results,
        run_timestamp=run_meta["run_timestamp"],
        run_label=run_meta["run_label"],
    )

    if args.no_supabase:
        print("Skipped Supabase upload (--no-supabase).")
    else:
        try:
            upload_to_supabase(rows)
            print(f"Uploaded {len(rows)} rows to Supabase.")
        except Exception as e:
            print(f"Supabase upload failed: {e}")

    maybe_write_csv(
        all_results,
        run_meta["run_label"],
        run_meta["csv_file"],
        ENABLE_CSV_OUTPUT and not args.no_csv,
    )

    elapsed_seconds = time.perf_counter() - started_at
    print(f"Scraper completed in {elapsed_seconds:.2f} seconds.")


if __name__ == "__main__":
    main()
