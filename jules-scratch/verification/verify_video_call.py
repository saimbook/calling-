import asyncio
from playwright.async_api import async_playwright, expect
import pathlib
import time

async def main():
    async with async_playwright() as p:
        # Launch browser with flags to fake media stream. This is crucial for CI environments.
        browser = await p.chromium.launch(headless=True, args=[
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            "--allow-file-access-from-files"
        ])

        # Grant camera/mic permissions to the browser context
        context1 = await browser.new_context(permissions=["camera", "microphone"])
        context2 = await browser.new_context(permissions=["camera", "microphone"])
        page1 = await context1.new_page()
        page2 = await context2.new_page()

        file_path = pathlib.Path(__file__).parent.parent.parent.resolve() / "index.html"
        file_url = f"file://{file_path}"

        timestamp = int(time.time())
        user1_email = f"caller_{timestamp}@example.com"
        user1_name = f"caller_{timestamp}"
        user2_email = f"callee_{timestamp}@example.com"
        user2_name = f"callee_{timestamp}"
        password = "password123"

        # --- Helper for Signup ---
        async def signup(page, email, user_name):
            await page.goto(file_url)
            await page.get_by_text("Don't have an account? Sign Up").click()
            await page.get_by_placeholder("Email").nth(1).fill(email)
            await page.get_by_placeholder("Password").nth(1).fill(password)
            await page.get_by_role("button", name="SIGN UP").click()
            await expect(page.locator("#chat-container")).to_be_visible(timeout=10000)
            print(f"Signed up {user_name} successfully.")

        # --- Sign up both users ---
        await signup(page1, user1_email, user1_name)
        await signup(page2, user2_email, user2_name)

        # --- Caller (User 1) initiates call with Callee (User 2) ---
        print("\n--- Caller starting video call ---")
        await page1.get_by_role("button", name="Users").click()
        callee_locator = page1.get_by_text(user2_name)
        await expect(callee_locator).to_be_visible(timeout=10000)
        await callee_locator.click()

        await page1.get_by_title("Start Video Call").click()

        # --- Verify Caller's UI ---
        await expect(page1.locator("#video-call-modal")).not_to_be_hidden()
        await expect(page1.locator("#local-video")).to_have_attribute("autoplay", "")
        print("Caller's video modal is visible.")

        # --- Callee (User 2) receives and accepts the call ---
        print("\n--- Callee receiving and accepting call ---")
        await expect(page2.locator("#incoming-call-modal")).not_to_be_hidden(timeout=15000)
        print("Callee's incoming call notification is visible.")
        await expect(page2.locator("#caller-name")).to_contain_text(user1_name)

        await page2.get_by_role("button", name="Accept").click()

        # --- Verify Callee's UI ---
        await expect(page2.locator("#video-call-modal")).not_to_be_hidden()
        await expect(page2.locator("#local-video")).to_have_attribute("autoplay", "")
        print("Callee accepted call, video modal is visible.")

        # --- Verify Peer-to-Peer Connection ---
        # Check if remote video streams are playing for both users
        print("\n--- Verifying remote video streams ---")
        await asyncio.sleep(5) # Give WebRTC time to establish connection and streams to start

        # Check if the remote video element has a valid srcObject
        remote_video_1_playing = await page1.evaluate('document.getElementById("remote-video").srcObject !== null && document.getElementById("remote-video").played.length > 0')
        remote_video_2_playing = await page2.evaluate('document.getElementById("remote-video").srcObject !== null && document.getElementById("remote-video").played.length > 0')

        assert remote_video_1_playing, "Caller's remote video is not playing"
        assert remote_video_2_playing, "Callee's remote video is not playing"
        print("Remote video streams are active for both users.")

        # --- Test Call Controls (from Caller's side) ---
        print("\n--- Testing call controls ---")
        await page1.get_by_title("Mute/Unmute Mic").click()
        await expect(page1.locator("#mic-btn i")).to_have_class("fas fa-microphone-slash")
        print("Mic muted successfully.")

        await page1.get_by_title("Turn Camera On/Off").click()
        await expect(page1.locator("#cam-btn i")).to_have_class("fas fa-video-slash")
        print("Camera turned off successfully.")

        # --- Take Screenshot ---
        await page1.screenshot(path="jules-scratch/verification/video_call_verification.png")
        print("\nScreenshot of active call saved.")

        # --- Hang up ---
        print("\n--- Testing hangup ---")
        await page1.get_by_title("Hang Up").click()
        await expect(page1.locator("#video-call-modal")).to_be_hidden()
        await expect(page2.locator("#video-call-modal")).to_be_hidden(timeout=5000)
        print("Call hung up successfully on both ends.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())