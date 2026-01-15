# Workbench screenshots for e2e tests

Use the workbench app to capture UI screenshots.
This is the fastest way to validate new UI work.

## Steps

1) Start the client CSS build.
2) Start the workbench dev server.
3) Open the workbench route that shows your feature.
4) Use Playwright to save a screenshot.

```bash
# Terminal A
npm -w packages/client run dev

# Terminal B
cd packages/workbench
npx vite dev --host 0.0.0.0 --port 4173
```

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    page.goto("http://127.0.0.1:4173/app/pumpkin-latte", wait_until="networkidle")
    page.screenshot(path="artifacts/feature.png", full_page=True)
    browser.close()
```

## Notes

- Save the image under `artifacts/` so it is collected.
- Attach the screenshot in the final response.
- If the browser tool fails, report the failure and move on.
