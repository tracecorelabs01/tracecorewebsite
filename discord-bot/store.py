"""Order lookups from the website (STORE_URL/api/bot/orders/<number>), authenticated with STORE_API_KEY."""
import re

import aiohttp

from config import STORE_API_KEY, STORE_URL

ORDER_NUMBER = re.compile(r"^TCL-[A-Z0-9]{6}$")


class StoreError(Exception):
    """The lookup couldn't run (not set up, or the website is unreachable). The message is safe to show."""


def clean_number(value: str) -> str | None:
    number = value.strip().upper()
    return number if ORDER_NUMBER.match(number) else None


async def get_order(number: str, email: str | None = None) -> dict | None:
    """The order, or None if there's no such order (or it doesn't belong to `email`)."""
    if not STORE_API_KEY:
        raise StoreError("Order lookups aren't set up yet. Please ask the team in your ticket.")
    params = {"email": email.strip().lower()} if email else {}
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as session:
            async with session.get(
                f"{STORE_URL}/api/bot/orders/{number}",
                params=params,
                headers={"Authorization": f"Bearer {STORE_API_KEY}"},
            ) as res:
                if res.status == 404:
                    return None
                if res.status != 200:
                    raise StoreError("The store couldn't answer right now. Please try again in a minute.")
                return await res.json()
    except (aiohttp.ClientError, TimeoutError) as err:
        raise StoreError("The store couldn't be reached right now. Please try again in a minute.") from err
