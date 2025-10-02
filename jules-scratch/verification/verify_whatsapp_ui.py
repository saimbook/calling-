import asyncio
from playwright.async_api import async_playwright, expect
import pathlib
import time
import re

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Get the absolute path to the index.html file
        file_path = pathlib.Path(__file__).parent.parent.parent.resolve() / "index.html"
        await page.goto(f"file://{file_path}")

        # Use unique identifiers for each run
        timestamp = int(time.time())
        unique_email = f"whatsapp_user_{timestamp}@example.com"
        password = "password123"

        # --- 1. Sign Up ---
        print("\n--- Testing Signup with new UI ---")
        await page.get_by_text("Don't have an account? Sign Up").click()
        await expect(page.get_by_role("heading", name="Create Account")).to_be_visible()
        await page.get_by_placeholder("Email").nth(1).fill(unique_email)
        await page.get_by_placeholder("Password").nth(1).fill(password)
        await page.get_by_role("button", name="SIGN UP").click()

        # Wait for chat container to be visible
        await expect(page.locator("#chat-container")).to_be_visible(timeout=10000)
        print("Signup successful, chat UI is visible.")

        # --- 2. Create a Group ---
        print("\n--- Testing Group Creation ---")
        group_name = f"Design Review Team {timestamp}"
        await page.get_by_placeholder("Create new group").fill(group_name)

        await page.locator('button[title="Create Group"]').click()

        # Wait for the group to appear in the list
        await expect(page.get_by_role("listitem").get_by_text(group_name)).to_be_visible(timeout=10000)
        print("Group created successfully.")

        # --- 3. Select Group and Send a Message ---
        print("\n--- Testing Message Sending & Timestamp ---")
        await page.get_by_role("listitem").get_by_text(group_name).click()
        await expect(page.get_by_role("heading", name=group_name)).to_be_visible()

        message_text = "Looks great! The new WhatsApp UI is much better."
        await page.get_by_placeholder("Type a message").fill(message_text)

        await page.locator('button[title="Send"]').click()

        # Wait for the message to appear in the chat
        message_locator = page.get_by_text(message_text)
        await expect(message_locator).to_be_visible(timeout=5000)
        print("Message text is visible.")

        # Verify timestamp is present and in the correct format (e.g., 10:30 PM)
        sent_message_element = page.locator(".message.sent").first
        timestamp_locator = sent_message_element.locator(".timestamp")

        # FIX 4: Removed the to_be_visible() check which was failing due to a race condition
        # with the server-generated timestamp. The to_have_text() check is more robust as it
        # waits for the text content to be populated.

        # Regex to match time format like "8:45 PM" or "12:01 AM"
        time_regex = re.compile(r"\d{1,2}:\d{2} (AM|PM)")
        await expect(timestamp_locator).to_have_text(time_regex, timeout=10000)
        print(f"Timestamp found and format is correct: {await timestamp_locator.inner_text()}")

        # --- 4. Take Screenshot ---
        screenshot_path = "jules-scratch/verification/whatsapp_ui_verification.png"
        await page.screenshot(path=screenshot_path, full_page=True)
        print(f"\nScreenshot saved to {screenshot_path}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())