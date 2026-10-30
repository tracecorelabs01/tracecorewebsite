"""The website's bot API, authenticated with STORE_API_KEY: order lookups (STORE_URL/api/bot/orders/<number>) and the
live store data the AI assistant answers from (STORE_URL/api/bot/knowledge)."""
import re

import aiohttp

from config import STORE_API_KEY, STORE_URL

ORDER_NUMBER = re.compile(r"^TCL-[A-Z0-9]{6}$")


class StoreError(Exception):
    """The lookup couldn't run (not set up, or the website is unreachable). The message is safe to show."""


def clean_number(value: str) -> str | None:
    number = value.strip().upper()
    return number if ORDER_NUMBER.match(number) else None


async def _get(path: str, params: dict | None = None) -> tuple[int, dict | None]:
    """The status code, and the JSON body when it's 200."""
    if not STORE_API_KEY:
        raise StoreError("The store connection isn't set up yet. Please ask the team in your ticket.")
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as session:
            async with session.get(f"{STORE_URL}{path}", params=params or {}, headers={"Authorization": f"Bearer {STORE_API_KEY}"}) as res:
                return res.status, (await res.json() if res.status == 200 else None)
    except (aiohttp.ClientError, TimeoutError) as err:
        raise StoreError("The store couldn't be reached right now. Please try again in a minute.") from err


async def get_order(number: str, email: str | None = None) -> dict | None:
    """The order, or None if there's no such order (or it doesn't belong to `email`)."""
    status, order = await _get(f"/api/bot/orders/{number}", {"email": email.strip().lower()} if email else None)
    if status == 404:
        return None
    if status != 200:
        raise StoreError("The store couldn't answer right now. Please try again in a minute.")
    return order


async def get_knowledge() -> dict:
    """Products with live prices and stock, shipping, payment methods, the setup discount and the FAQ."""
    status, data = await _get("/api/bot/knowledge")
    if status != 200:
        raise StoreError("The store couldn't answer right now. Please try again in a minute.")
    return data
