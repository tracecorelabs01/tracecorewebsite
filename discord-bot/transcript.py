"""HTML transcripts of ticket channels, styled like Discord's dark theme in TraceCore Lab colours."""
import html
import re
from datetime import datetime, timezone

from config import BOT_NAME, BRAND
from embeds import ticket_name


def _format_timestamp(dt: datetime) -> str:
    return dt.strftime("%m/%d/%Y %I:%M %p")


def generate_html(messages: list, ticket_info: dict, guild_name: str) -> str:
    """Generate a beautiful HTML transcript from a list of discord messages.

    Args:
        messages: List of discord.Message objects (already fetched)
        ticket_info: Ticket dict from ticket_storage
        guild_name: Server name for header
    """
    name = html.escape(ticket_name(ticket_info))
    created = html.escape(ticket_info.get("created_at") or "Unknown")
    order_number = html.escape(ticket_info.get("order_number") or "")

    # Build message HTML blocks
    msg_blocks = []
    for msg in messages:
        if not msg.content and not msg.attachments and not msg.embeds:
            continue

        author_name = html.escape(msg.author.display_name)
        author_avatar = html.escape(msg.author.display_avatar.url)
        timestamp = _format_timestamp(msg.created_at)
        is_bot = msg.author.bot

        # Message content with basic formatting
        content = html.escape(msg.content) if msg.content else ""
        # Convert basic markdown: bold, italic, code
        content = _convert_markdown(content)
        # Newlines to <br>
        content = content.replace("\n", "<br>")

        # Attachments (images and files)
        attachment_html = ""
        for att in msg.attachments:
            if att.content_type and att.content_type.startswith("image/"):
                attachment_html += f'<div class="attachment"><img src="{html.escape(att.url)}" alt="{html.escape(att.filename)}" /></div>'
            else:
                attachment_html += f'<div class="attachment file"><a href="{html.escape(att.url)}">{html.escape(att.filename)}</a></div>'

        # Embeds (simplified rendering)
        embed_html = ""
        for emb in msg.embeds:
            embed_html += _render_embed(emb)

        bot_badge = '<span class="bot-badge">BOT</span>' if is_bot else ""

        msg_blocks.append(f"""
        <div class="message">
            <div class="avatar">
                <img src="{author_avatar}" alt="" />
            </div>
            <div class="content">
                <div class="header">
                    <span class="author">{author_name}</span>
                    {bot_badge}
                    <span class="timestamp">{timestamp}</span>
                </div>
                <div class="body">{content}</div>
                {attachment_html}
                {embed_html}
            </div>
        </div>""")

    messages_html = "\n".join(msg_blocks)
    total_messages = len(messages)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Transcript · {name}</title>
<style>
* {{ margin: 0; padding: 0; box-sizing: border-box; }}

body {{
    background: #313338;
    color: #dbdee1;
    font-family: 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 15px;
    line-height: 1.375;
}}

.transcript-header {{
    background: linear-gradient(135deg, #0a0607 0%, #1d1415 100%);
    border-bottom: 2px solid #ff3d00;
    padding: 24px 32px;
}}

.transcript-header h1 {{
    background: linear-gradient(90deg, #ff1408, #ff6a00);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    font-size: 22px;
    font-weight: 700;
    margin-bottom: 8px;
}}

.transcript-header .meta {{
    color: #949ba4;
    font-size: 13px;
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
}}

.transcript-header .meta span {{
    display: flex;
    align-items: center;
    gap: 4px;
}}

.transcript-header .meta .label {{
    color: #b5bac1;
    font-weight: 600;
}}

.messages {{
    padding: 16px 0;
}}

.message {{
    display: flex;
    padding: 4px 48px 4px 72px;
    position: relative;
    min-height: 44px;
}}

.message:hover {{
    background: #2e3035;
}}

.message .avatar {{
    position: absolute;
    left: 16px;
    top: 4px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
}}

.message .avatar img {{
    width: 100%;
    height: 100%;
    object-fit: cover;
}}

.message .content {{
    flex: 1;
    min-width: 0;
}}

.message .header {{
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 2px;
}}

.message .author {{
    font-weight: 600;
    color: #f2f3f5;
    font-size: 15px;
}}

.message .timestamp {{
    color: #949ba4;
    font-size: 12px;
}}

.bot-badge {{
    background: #ff3d00;
    color: white;
    font-size: 10px;
    font-weight: 600;
    padding: 1px 5px;
    border-radius: 3px;
    text-transform: uppercase;
}}

.message .body {{
    color: #dbdee1;
    word-wrap: break-word;
}}

.message .body code {{
    background: #2b2d31;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Consolas', monospace;
    font-size: 14px;
}}

.message .body .code-block {{
    background: #2b2d31;
    padding: 12px;
    border-radius: 8px;
    margin: 6px 0;
    font-family: 'Consolas', monospace;
    font-size: 14px;
    overflow-x: auto;
}}

.attachment {{
    margin-top: 8px;
}}

.attachment img {{
    max-width: 400px;
    max-height: 300px;
    border-radius: 8px;
}}

.attachment.file a {{
    color: #00a8fc;
    text-decoration: none;
    background: #2b2d31;
    padding: 8px 12px;
    border-radius: 8px;
    display: inline-block;
}}

.embed {{
    border-left: 4px solid #ff3d00;
    background: #2b2d31;
    padding: 12px;
    border-radius: 0 8px 8px 0;
    margin-top: 8px;
    max-width: 520px;
}}

.embed .embed-title {{
    color: #f2f3f5;
    font-weight: 700;
    margin-bottom: 4px;
}}

.embed .embed-desc, .embed .embed-field {{
    color: #dbdee1;
    font-size: 14px;
}}

.embed .embed-author {{
    color: #f2f3f5;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 4px;
}}

.embed .embed-field {{
    margin-top: 6px;
}}

.embed .embed-field b {{
    display: block;
    color: #b5bac1;
    font-size: 12px;
}}

.transcript-footer {{
    background: #1a1b1e;
    border-top: 2px solid #ff3d00;
    padding: 16px 32px;
    text-align: center;
    color: #949ba4;
    font-size: 13px;
}}

.transcript-footer span {{
    color: #ff3d00;
    font-weight: 600;
}}

@media (max-width: 600px) {{
    .message {{ padding: 4px 12px 4px 56px; }}
    .message .avatar {{ left: 8px; width: 32px; height: 32px; }}
    .transcript-header {{ padding: 16px; }}
    .transcript-header .meta {{ flex-direction: column; gap: 4px; }}
}}
</style>
</head>
<body>

<div class="transcript-header">
    <h1>{BRAND} · ticket transcript</h1>
    <div class="meta">
        <span><span class="label">Ticket:</span> {name}</span>
        {f'<span><span class="label">Order:</span> {order_number}</span>' if order_number else ""}
        <span><span class="label">Opened:</span> {created}</span>
        <span><span class="label">Messages:</span> {total_messages}</span>
        <span><span class="label">Server:</span> {html.escape(guild_name)}</span>
    </div>
</div>

<div class="messages">
{messages_html}
</div>

<div class="transcript-footer">
    Exported by <span>{BOT_NAME}</span> · {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}
</div>

</body>
</html>"""


def _convert_markdown(text: str) -> str:
    """Convert basic Discord markdown to HTML (bold, italic, inline code)."""
    # Code blocks (triple backtick)
    text = re.sub(r'```(.*?)```', r'<div class="code-block">\1</div>', text, flags=re.DOTALL)
    # Inline code
    text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
    # Bold
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    # Italic
    text = re.sub(r'\*(.+?)\*', r'<em>\1</em>', text)
    # Underline
    text = re.sub(r'__(.+?)__', r'<u>\1</u>', text)
    # Strikethrough
    text = re.sub(r'~~(.+?)~~', r'<del>\1</del>', text)
    return text


def _render_embed(embed) -> str:
    """Render a Discord embed as HTML."""
    color_hex = f"#{embed.color.value:06x}" if embed.color else "#ff3d00"
    text = lambda value: _convert_markdown(html.escape(value)).replace("\n", "<br>")

    parts = [f'<div class="embed" style="border-left-color: {color_hex};">']
    if embed.author and embed.author.name:
        parts.append(f'<div class="embed-author">{html.escape(embed.author.name)}</div>')
    if embed.title:
        parts.append(f'<div class="embed-title">{html.escape(embed.title)}</div>')
    if embed.description:
        parts.append(f'<div class="embed-desc">{text(embed.description)}</div>')
    for field in embed.fields:
        parts.append(f'<div class="embed-field"><b>{html.escape(field.name)}</b>{text(field.value)}</div>')
    parts.append("</div>")
    return "\n".join(parts)
