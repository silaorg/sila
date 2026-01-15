# Screenshots for feature validation

Take a screenshot when a visual change is made.
Do this for UI changes and for new UI features.

## When to take a screenshot

- You changed layout, spacing, or styling.
- You added or removed a visible UI element.
- You want to document a new behavior in the UI.

## How to take a screenshot (local dev)

1) Start the workbench dev server.
2) Open the page that shows the feature.
3) Trigger the state you want to capture.
4) Save the screenshot.

Example:

```bash
# Terminal A
npm -w packages/client run dev

# Terminal B
cd packages/workbench
npx vite dev --host 0.0.0.0 --port 4173
```

Then use Playwright to capture the view:

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    page.goto("http://127.0.0.1:4173/app/pumpkin-latte", wait_until="networkidle")
    page.screenshot(path="artifacts/feature.png", full_page=True)
    browser.close()
```

## Notes for AI agents

- Save the image under `artifacts/` so it is collected.
- Attach the screenshot in the final response.
- If the browser tool fails, report the failure and move on.
