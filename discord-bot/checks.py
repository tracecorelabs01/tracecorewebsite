"""Who can do what: admins (ADMIN_IDS or server administrators) and the support team (roles from /ticketsetup)."""
import discord
from discord import app_commands

import database
from config import ADMIN_IDS

# Who sees a command in Discord's command list, so customers only see the ones meant for them. Staff commands need
# Manage Messages, admin ones Administrator; a server can give other roles access under Server Settings →
# Integrations. Every command still checks the person using it (below).
staff_only = app_commands.default_permissions(manage_messages=True)
admin_only = app_commands.default_permissions(administrator=True)


def _admin(user: discord.abc.User) -> bool:
    if user.id in ADMIN_IDS:
        return True
    perms = getattr(user, "guild_permissions", None)
    return bool(perms and perms.administrator)


def is_admin(interaction: discord.Interaction) -> bool:
    return _admin(interaction.user)


async def is_support_member(user: discord.abc.User) -> bool:
    """An admin, or someone with a support role. Works for message authors as well as button presses."""
    if _admin(user):
        return True
    if not isinstance(user, discord.Member):
        return False
    config = await database.get_config(user.guild.id)
    return any(role.id in config["support_role_ids"] for role in user.roles)


async def is_support(interaction: discord.Interaction) -> bool:
    return await is_support_member(interaction.user)
