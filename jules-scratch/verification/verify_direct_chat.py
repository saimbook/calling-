import asyncio
from playwright.async_api import async_playwright, expect
import pathlib
import time

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        # --- Setup: Create two contexts for two users ---
        context1 = await browser.new_context()
        context2 = await browser.new_context()
        page1 = await context1.new_page()
        page2 = await context2.new_page()

        file_path = pathlib.Path(__file__).parent.parent.parent.resolve() / "index.html"
        file_url = f"file://{file_path}"

        # --- User 1 (Alice) Signup ---
        timestamp = int(time.time())
        alice_email = f"alice_{timestamp}@example.com"
        alice_name = f"alice_{timestamp}"
        password = "password123"

        print("\n--- Signing up User 1 (Alice) ---")
        await page1.goto(file_url)
        await page1.get_by_text("Don't have an account? Sign Up").click()
        await page1.get_by_placeholder("Email").nth(1).fill(alice_email)
        await page1.get_by_placeholder("Password").nth(1).fill(password)
        await page1.get_by_role("button", name="SIGN UP").click()
        await expect(page1.locator("#chat-container")).to_be_visible(timeout=10000)
        print("Alice signed up successfully.")

        # --- User 2 (Bob) Signup ---
        bob_email = f"bob_{timestamp}@example.com"
        bob_name = f"bob_{timestamp}"

        print("\n--- Signing up User 2 (Bob) ---")
        await page2.goto(file_url)
        await page2.get_by_text("Don't have an account? Sign Up").click()
        await page2.get_by_placeholder("Email").nth(1).fill(bob_email)
        await page2.get_by_placeholder("Password").nth(1).fill(password)
        await page2.get_by_role("button", name="SIGN UP").click()
        await expect(page2.locator("#chat-container")).to_be_visible(timeout=10000)
        print("Bob signed up successfully.")

        # --- Alice starts a chat with Bob ---
        print("\n--- Alice initiates chat with Bob ---")
        await page1.get_by_role("button", name="Users").click()
        # Firestore can take a moment to populate, so wait for Bob to appear
        bob_locator_in_alice_chat = page1.get_by_text(bob_name)
        await expect(bob_locator_in_alice_chat).to_be_visible(timeout=10000)
        await bob_locator_in_alice_chat.click()
        print("Alice found Bob in the user list and clicked.")

        # Verify chat header updates for Alice
        await expect(page1.get_by_role("heading", name=bob_name)).to_be_visible()
        print("Alice's chat header updated to Bob's name.")

        # --- Alice sends a message ---
        message_from_alice = "Hey Bob, how are you?"
        print(f"\n--- Alice sends message: '{message_from_alice}' ---")
        await page1.get_by_placeholder("Type a message").fill(message_from_alice)
        await page1.locator('button[title="Send"]').click()

        # --- Bob receives the message ---
        print("\n--- Verifying Bob receives the message ---")
        # Bob needs to find and click on Alice in his user list to see the chat
        await page2.get_by_role("button", name="Users").click()
        alice_locator_in_bob_chat = page2.get_by_text(alice_name)
        await expect(alice_locator_in_bob_chat).to_be_visible(timeout=10000)
        await alice_locator_in_bob_chat.click()
        print("Bob found Alice and opened the chat.")

        # Check if Alice's message is visible in Bob's window
        await expect(page2.get_by_text(message_from_alice)).to_be_visible(timeout=10000)
        print("Bob successfully received Alice's message.")

        # --- Bob replies ---
        message_from_bob = "I'm great, Alice! Thanks for asking."
        print(f"\n--- Bob replies: '{message_from_bob}' ---")
        await page2.get_by_placeholder("Type a message").fill(message_from_bob)
        await page2.locator('button[title="Send"]').click()

        # --- Alice receives the reply ---
        print("\n--- Verifying Alice receives the reply ---")
        await expect(page1.get_by_text(message_from_bob)).to_be_visible(timeout=10000)
        print("Alice successfully received Bob's reply.")

        # --- Take Screenshots ---
        await page1.screenshot(path="jules-scratch/verification/direct_chat_alice_view.png")
        await page2.screenshot(path="jules-scratch/verification/direct_chat_bob_view.png")
        print("\nScreenshots saved for both users' views.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())