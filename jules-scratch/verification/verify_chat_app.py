import asyncio
from playwright.async_api import async_playwright, expect
import pathlib
import time

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Listen for console messages and print them
        # FIX 2: The error persists. Correcting both msg.type and msg.text to be properties.
        page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.type} >> {msg.text}"))

        # Get the absolute path to the index.html file
        file_path = pathlib.Path(__file__).parent.parent.parent.resolve() / "index.html"
        await page.goto(f"file://{file_path}")

        # Use a unique email for each run to avoid conflicts
        unique_email = f"testuser_{int(time.time())}@example.com"
        password = "password123"

        # --- 1. Sign Up ---
        print("\n--- Testing Signup ---")
        await page.get_by_text("Don't have an account? Sign Up").click()
        await expect(page.get_by_role("heading", name="Sign Up")).to_be_visible()
        await page.get_by_placeholder("Email").nth(1).fill(unique_email)
        await page.get_by_placeholder("Password").nth(1).fill(password)
        await page.get_by_role("button", name="Sign Up").click()

        # Wait for chat container to be visible after signup/login
        await expect(page.locator("#chat-container")).to_be_visible(timeout=10000)
        print("Signup successful.")

        # --- 2. Create a Group ---
        print("\n--- Testing Group Creation ---")
        group_name = "Test Group"
        await page.get_by_placeholder("New group name").fill(group_name)
        await page.get_by_role("button", name="+").click()

        # Wait for the group to appear in the list
        await expect(page.get_by_role("listitem").get_by_text(group_name)).to_be_visible(timeout=15000)
        print("Group created successfully.")

        # --- 3. Select Group and Send a Message ---
        print("\n--- Testing Message Sending ---")
        await page.get_by_role("listitem").get_by_text(group_name).click()
        await expect(page.get_by_role("heading", name=group_name)).to_be_visible()

        message_text = "Hello, this is a test message!"
        await page.get_by_placeholder("Type a message...").fill(message_text)
        await page.get_by_role("button", name="Send").click()

        # Wait for the message to appear in the chat
        await expect(page.get_by_text(message_text)).to_be_visible(timeout=10000)
        print("Message sent successfully.")

        # --- 4. Take Screenshot ---
        screenshot_path = "jules-scratch/verification/verification.png"
        await page.screenshot(path=screenshot_path)
        print(f"\nScreenshot saved to {screenshot_path}")

        # --- 5. Logout ---
        print("\n--- Testing Logout ---")
        await page.get_by_role("button", name="Logout").click()
        await expect(page.locator("#auth-container")).to_be_visible(timeout=5000)
        print("Logout successful.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())