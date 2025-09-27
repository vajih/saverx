from playwright.sync_api import sync_playwright
from chat_caller import extract_program_info_basic
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)  # Set False to see the browser
    page = browser.new_page()
    page.goto("https://www.novocare.com/diabetes/help-with-costs/pap.html")
    page.wait_for_load_state('networkidle')
    
    # no hidden elements
    body_text = page.inner_text('body')
    
    result = extract_program_info_basic(body_text)
    print(result)
    
    # Write result to sample.json
    with open('program_data/sample.json', 'w') as f:
        json.dump(result, f, indent=2)
    
    print("Result written to program_data/sample.json")
    
    browser.close()

