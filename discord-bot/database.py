"""SQLite storage: ticket settings per server, tickets, and the staff wallet."""
import os
from datetime import datetime, timezone

import aiosqlite

from config import TEST_MODE

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
DB_FILE = os.path.join(DATA_DIR, "bot_test.db" if TEST_MODE else "bot.db")

# Ticket types. "purchase" is the Orders ticket (the key is kept so existing setups carry over).
TICKET_TYPES = ("purchase", "support", "warranty", "reseller")
CONFIG_COLUMNS = ["transcript_channel_id", *(f"{t}_category_id" for t in TICKET_TYPES), "ticket_counter"]
TICKET_FIELDS = ("status", "claimed_by", "closed_at", "closed_by")


def str_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def cents(amount: float) -> int:
    return round(amount * 100)


async def _add_missing_columns(db: aiosqlite.Connection, table: str, columns: dict[str, str]):
    """Older databases (from the previous bot) get the newer columns added in place."""
    async with db.execute(f"PRAGMA table_info({table})") as cursor:
        existing = {row[1] for row in await cursor.fetchall()}
    for name, kind in columns.items():
        if name not in existing:
            await db.execute(f"ALTER TABLE {table} ADD COLUMN {name} {kind}")


async def setup():
    os.makedirs(DATA_DIR, exist_ok=True)
    async with aiosqlite.connect(DB_FILE) as db:
        await db.execute(
            "CREATE TABLE IF NOT EXISTS guild_configs (guild_id INTEGER PRIMARY KEY, transcript_channel_id INTEGER, "
            "purchase_category_id INTEGER, support_category_id INTEGER, reseller_category_id INTEGER, ticket_counter INTEGER)"
        )
        await db.execute("CREATE TABLE IF NOT EXISTS support_roles (guild_id INTEGER, role_id INTEGER, PRIMARY KEY (guild_id, role_id))")
        await db.execute(
            "CREATE TABLE IF NOT EXISTS tickets (channel_id INTEGER PRIMARY KEY, guild_id INTEGER, user_id INTEGER, category TEXT, number INTEGER, "
            "description TEXT, status TEXT, claimed_by INTEGER, created_at TEXT, closed_at TEXT, closed_by INTEGER)"
        )
        await db.execute("CREATE TABLE IF NOT EXISTS wallet_state (id INTEGER PRIMARY KEY, balance REAL)")
        await db.execute("CREATE TABLE IF NOT EXISTS wallet_history (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, amount REAL, note TEXT, added_by INTEGER, date TEXT)")
        await _add_missing_columns(db, "guild_configs", {"warranty_category_id": "INTEGER"})
        await _add_missing_columns(db, "tickets", {"order_number": "TEXT"})
        await db.execute("INSERT OR IGNORE INTO wallet_state (id, balance) VALUES (1, 0)")
        await db.commit()


# --- Ticket settings ---

async def get_config(guild_id: int) -> dict:
    async with aiosqlite.connect(DB_FILE) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM guild_configs WHERE guild_id = ?", (guild_id,)) as cursor:
            row = await cursor.fetchone()
        config = {col: None for col in CONFIG_COLUMNS} | (dict(row) if row else {})
        async with db.execute("SELECT role_id FROM support_roles WHERE guild_id = ?", (guild_id,)) as cursor:
            config["support_role_ids"] = [r["role_id"] for r in await cursor.fetchall()]
    return config


async def set_config(guild_id: int, **values):
    async with aiosqlite.connect(DB_FILE) as db:
        await db.execute("INSERT OR IGNORE INTO guild_configs (guild_id) VALUES (?)", (guild_id,))
        for column, value in values.items():
            if column in CONFIG_COLUMNS:  # column names come from this list only
                await db.execute(f"UPDATE guild_configs SET {column} = ? WHERE guild_id = ?", (value, guild_id))
        await db.commit()


async def set_category_id(guild_id: int, ticket_type: str, category_id: int):
    await set_config(guild_id, **{f"{ticket_type}_category_id": category_id})


async def next_ticket_number(guild_id: int) -> int:
    async with aiosqlite.connect(DB_FILE) as db:
        await db.execute("INSERT OR IGNORE INTO guild_configs (guild_id, ticket_counter) VALUES (?, 0)", (guild_id,))
        await db.execute("UPDATE guild_configs SET ticket_counter = COALESCE(ticket_counter, 0) + 1 WHERE guild_id = ?", (guild_id,))
        async with db.execute("SELECT ticket_counter FROM guild_configs WHERE guild_id = ?", (guild_id,)) as cursor:
            (number,) = await cursor.fetchone()
        await db.commit()
    return number


async def add_support_role(guild_id: int, role_id: int):
    async with aiosqlite.connect(DB_FILE) as db:
        await db.execute("INSERT OR IGNORE INTO support_roles (guild_id, role_id) VALUES (?, ?)", (guild_id, role_id))
        await db.commit()


async def remove_support_role(guild_id: int, role_id: int):
    async with aiosqlite.connect(DB_FILE) as db:
        await db.execute("DELETE FROM support_roles WHERE guild_id = ? AND role_id = ?", (guild_id, role_id))
        await db.commit()


# --- Tickets ---

async def create_ticket(channel_id: int, guild_id: int, user_id: int, category: str, number: int, description: str, order_number: str | None):
    async with aiosqlite.connect(DB_FILE) as db:
        await db.execute(
            "INSERT INTO tickets (channel_id, guild_id, user_id, category, number, description, order_number, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)",
            (channel_id, guild_id, user_id, category, number, description, order_number, str_now()),
        )
        await db.commit()


async def get_ticket(channel_id: int) -> dict | None:
    async with aiosqlite.connect(DB_FILE) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM tickets WHERE channel_id = ? AND status != 'deleted'", (channel_id,)) as cursor:
            row = await cursor.fetchone()
    return dict(row) if row else None


async def update_ticket(channel_id: int, **values):
    async with aiosqlite.connect(DB_FILE) as db:
        for field, value in values.items():
            if field in TICKET_FIELDS:
                await db.execute(f"UPDATE tickets SET {field} = ? WHERE channel_id = ?", (value, channel_id))
        await db.commit()


async def close_ticket(channel_id: int, closed_by: int):
    await update_ticket(channel_id, status="closed", closed_by=closed_by, closed_at=str_now())


async def reopen_ticket(channel_id: int):
    await update_ticket(channel_id, status="open", closed_by=None, closed_at=None)


async def mark_deleted(channel_id: int, deleted_by: int):
    """The channel goes, the record stays so /ticketstats keeps its history."""
    async with aiosqlite.connect(DB_FILE) as db:
        await db.execute(
            "UPDATE tickets SET status = 'deleted', closed_by = COALESCE(closed_by, ?), closed_at = COALESCE(closed_at, ?) WHERE channel_id = ?",
            (deleted_by, str_now(), channel_id),
        )
        await db.commit()


async def get_all_tickets(guild_id: int) -> list[dict]:
    async with aiosqlite.connect(DB_FILE) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM tickets WHERE guild_id = ?", (guild_id,)) as cursor:
            return [dict(r) for r in await cursor.fetchall()]


async def get_user_open_tickets(guild_id: int, user_id: int) -> list[dict]:
    async with aiosqlite.connect(DB_FILE) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM tickets WHERE guild_id = ? AND user_id = ? AND status = 'open'", (guild_id, user_id)) as cursor:
            return [dict(r) for r in await cursor.fetchall()]


# --- Staff wallet (amounts rounded to cents so totals don't drift) ---

async def get_wallet() -> float:
    async with aiosqlite.connect(DB_FILE) as db:
        async with db.execute("SELECT balance FROM wallet_state WHERE id = 1") as cursor:
            row = await cursor.fetchone()
    return cents(row[0] if row else 0) / 100


async def add_fund(amount: float, note: str, by: int):
    async with aiosqlite.connect(DB_FILE) as db:
        await db.execute("UPDATE wallet_state SET balance = ROUND(balance + ?, 2) WHERE id = 1", (cents(amount) / 100,))
        await db.execute("INSERT INTO wallet_history (type, amount, note, added_by, date) VALUES ('add', ?, ?, ?, ?)", (cents(amount) / 100, note, by, str_now()))
        await db.commit()


async def remove_fund(amount: float, note: str, by: int) -> bool:
    amount = cents(amount) / 100
    async with aiosqlite.connect(DB_FILE) as db:
        cursor = await db.execute("UPDATE wallet_state SET balance = ROUND(balance - ?, 2) WHERE id = 1 AND balance >= ?", (amount, amount))
        if cursor.rowcount == 0:
            return False
        await db.execute("INSERT INTO wallet_history (type, amount, note, added_by, date) VALUES ('remove', ?, ?, ?, ?)", (amount, note, by, str_now()))
        await db.commit()
    return True


async def get_fund_history(limit: int = 10) -> tuple[list[dict], int]:
    async with aiosqlite.connect(DB_FILE) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT COUNT(*) AS n FROM wallet_history") as cursor:
            total = (await cursor.fetchone())["n"]
        async with db.execute("SELECT type, amount, note, added_by AS by, date FROM wallet_history ORDER BY id DESC LIMIT ?", (limit,)) as cursor:
            rows = [dict(r) for r in await cursor.fetchall()]
    return rows[::-1], total
