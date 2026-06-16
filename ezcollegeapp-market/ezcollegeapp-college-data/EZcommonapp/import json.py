import json
import os
import random
import re
import time
from urllib.parse import quote_plus

import pandas as pd
import requests
from selenium import webdriver
from selenium.common.exceptions import WebDriverException
from selenium.webdriver.common.by import By


JSON_FILE = "/Users/yiweili/Documents/EZcommonapp/india_student_queries.json"
SAVE_ROOT = "/Users/yiweili/Documents/EZcommonapp/bing_images_india_student_dataset"
RESULT_CSV = "/Users/yiweili/Documents/EZcommonapp/bing_india_student_results.csv"

TRY_LIMIT = 180
TARGET_IMAGES = 60
MAX_SCROLLS = 6


def create_driver():
    options = webdriver.ChromeOptions()
    options.add_argument("--headless")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1600,1200")
    uas = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15",
    ]
    options.add_argument(f"user-agent={random.choice(uas)}")
    return webdriver.Chrome(options=options)


def slugify(value):
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "_", value)
    return value.strip("_") or "item"


def load_queries(json_file):
    with open(json_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    required = {"country", "language", "document_type", "query"}
    rows = []
    for item in data:
        missing = required - item.keys()
        if missing:
            raise ValueError(f"Missing fields {missing} in item: {item}")
        rows.append(item)
    return rows


def fetch_bing_image_urls(driver, limit):
    urls = []
    seen = set()

    for _ in range(MAX_SCROLLS):
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(random.uniform(1.5, 2.5))

    cards = driver.find_elements(By.CSS_SELECTOR, "a.iusc")
    for card in cards:
        if len(urls) >= limit:
            break
        m_attr = card.get_attribute("m")
        if not m_attr:
            continue
        try:
            meta = json.loads(m_attr)
        except json.JSONDecodeError:
            continue
        img_url = meta.get("murl", "")
        if img_url.startswith("http") and img_url not in seen:
            seen.add(img_url)
            urls.append(img_url)
    return urls


def create_session():
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 Chrome/122.0 Safari/537.36"
            )
        }
    )
    return session


def ensure_results_frame(result_csv):
    if os.path.exists(result_csv):
        return pd.read_csv(result_csv)
    return pd.DataFrame(
        columns=[
            "Country",
            "Language",
            "Document_Type",
            "Category",
            "Query",
            "Image_URL",
            "Local_Path",
            "Status",
        ]
    )


def build_folder(root, row):
    country = slugify(row["country"])
    doc_type = slugify(row["document_type"])
    query = slugify(row["query"])
    folder = os.path.join(root, country, doc_type, query)
    os.makedirs(folder, exist_ok=True)
    return folder


def bing_search_url(query):
    return f"https://www.bing.com/images/search?q={quote_plus(query)}&form=HDRSC3"


def save_image(session, img_url, folder, index):
    resp = session.get(img_url, timeout=12)
    if resp.status_code != 200:
        return "", f"HTTP_{resp.status_code}"

    ext = img_url.split(".")[-1].split("?")[0].lower()
    if ext not in {"jpg", "jpeg", "png", "webp"}:
        ext = "jpg"
    local_path = os.path.join(folder, f"{index}.{ext}")
    with open(local_path, "wb") as f:
        f.write(resp.content)
    return local_path, "OK"


def main():
    query_rows = load_queries(JSON_FILE)
    results = ensure_results_frame(RESULT_CSV)
    session = create_session()

    print(f"Loaded {len(query_rows)} India student queries")

    for row in query_rows:
        query = row["query"]
        existing = results[results["Query"] == query]
        if len(existing[existing["Status"] == "OK"]) >= TARGET_IMAGES:
            print(f"Skip {query}: already has {len(existing[existing['Status'] == 'OK'])} OK images")
            continue

        print(f"\nSearch: {query}")
        driver = None
        try:
            driver = create_driver()
            driver.get(bing_search_url(query))
            time.sleep(random.uniform(3.0, 5.0))
            candidates = fetch_bing_image_urls(driver, TRY_LIMIT)
            print(f"Candidate URLs: {len(candidates)}")
        except WebDriverException as exc:
            print(f"Browser error for {query}: {exc}")
            continue
        finally:
            if driver is not None:
                driver.quit()

        folder = build_folder(SAVE_ROOT, row)
        new_rows = []
        success_count = len(existing[existing["Status"] == "OK"])

        for img_url in candidates:
            if success_count >= TARGET_IMAGES:
                break
            if ((results["Query"] == query) & (results["Image_URL"] == img_url)).any():
                continue

            try:
                local_path, status = save_image(session, img_url, folder, success_count)
            except Exception as exc:
                local_path, status = "", f"ERR_{str(exc)[:40]}"

            if status == "OK":
                success_count += 1

            new_rows.append(
                {
                    "Country": row["country"],
                    "Language": row["language"],
                    "Document_Type": row["document_type"],
                    "Category": row.get("category", ""),
                    "Query": query,
                    "Image_URL": img_url,
                    "Local_Path": local_path,
                    "Status": status,
                }
            )

        if new_rows:
            results = pd.concat([results, pd.DataFrame(new_rows)], ignore_index=True)
            results.to_csv(RESULT_CSV, index=False)
            print(f"Saved {len(new_rows)} rows to {RESULT_CSV}")
        else:
            print("No new rows saved")

        time.sleep(random.uniform(3.0, 6.0))

    print("Finished collecting Africa French test image data")


if __name__ == "__main__":
    main()
