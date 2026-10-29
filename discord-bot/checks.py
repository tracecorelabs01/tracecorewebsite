"""Who can do what: admins (ADMIN_IDS or server administrators) and the support team (roles from /ticketsetup)."""
import discord

import database
from config import ADMIN_IDS


def is_admin(interaction: discord.Interaction) -> bool:
    if interaction.user.id in ADMIN_IDS:
        return True
    perms = getattr(interaction.user, "guild_permissions", None)
    return bool(perms and perms.administrator)


async def is_support(interaction: discord.Interaction) -> bool:
    if is_admin(interaction):
        return True
    if not interaction.guild or not isinstance(interaction.user, discord.Member):
        return False
    config = await database.get_config(interaction.guild.id)
    return any(role.id in config["support_role_ids"] for role in interaction.user.roles)
