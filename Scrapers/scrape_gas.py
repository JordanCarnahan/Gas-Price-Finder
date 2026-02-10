import re
import json
import csv

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


# ---------- Browser helpers ----------
ENABLE_REGULAR = True
ENABLE_MIDGRADE = False
ENABLE_PREMIUM = False
ENABLE_DIESEL = False
ENABLE_UPDATE_TIMES = False

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
            if re.search(r"\d{2,6}\s+\w+", ln):
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

#main execution
if __name__ == "__main__":

    cities = {
        "La Mirada": "https://www.gasbuddy.com/gasprices/california/la-mirada",
        "La Habra": "https://www.gasbuddy.com/gasprices/california/la-habra",
        #"Whittier": "https://www.gasbuddy.com/gasprices/california/whittier",
        #"Santa Fe Springs": "https://www.gasbuddy.com/gasprices/california/santa-fe-springs",
        #"Buena Park": "https://www.gasbuddy.com/gasprices/california/buena-park",
        #"Norwalk": "https://www.gasbuddy.com/gasprices/california/norwalk",
        #"Cerritos": "https://www.gasbuddy.com/gasprices/california/cerritos",
        #"Fullerton": "https://www.gasbuddy.com/gasprices/california/fullerton",
        #"Brea": "https://www.gasbuddy.com/gasprices/california/brea",
        #"Anaheim": "https://www.gasbuddy.com/gasprices/california/anaheim",
    }

    all_results = {}

    for city_name, url in cities.items():
        print(f"Scraping {city_name}...")  # runtime message only

        try:
            city_data = scrape_all_fueltypes(url, limit=30, headless=False)

            # Save data regardless (empty list if no stations)
            all_results[city_name] = city_data if city_data else []

            if not city_data:
                print(f"Skipped {city_name} (no data)")

        except Exception as e:
            print(f"Error on {city_name}")  # runtime message only
            all_results[city_name] = {"error": str(e)}

    # Save ALL data to JSON (no terminal dump)
    with open("gas_prices_near_la_mirada.json", "w", encoding="utf-8") as f:
        json.dump(all_results, f, indent=2)

    print("Saved gas_prices_near_la_mirada.json")

    INPUT_FILE = "gas_prices_near_la_mirada.json"   # use your current JSON filename
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
            "Regular Updated",
            "Midgrade",
            "Midgrade Updated",
            "Premium",
            "Premium Updated",
            "Diesel",
            "Diesel Updated",
        ])

        for city, stations in data.items():
            # stations could be [] or {"error": "..."}
            if isinstance(stations, dict) and "error" in stations:
                writer.writerow([city, "ERROR", stations.get("error"), "", "", "", "", "", "", "", ""])
                continue

            for s in stations:
                writer.writerow([
                    city,
                    s.get("name", ""),
                    s.get("address", ""),
                    s.get("regular", ""),
                    s.get("regular_updated", ""),
                    s.get("midgrade", ""),
                    s.get("midgrade_updated", ""),
                    s.get("premium", ""),
                    s.get("premium_updated", ""),
                    s.get("diesel", ""),
                    s.get("diesel_updated", ""),
                ])

    print(f"Saved {OUTPUT_FILE}")



