"""Installer emails (SES). Plain, polite, evidence-first, never accusing."""

from .store import SENDER_EMAIL, ses


def _send(to: str, subject: str, text: str, html: str) -> tuple[bool, str]:
    if not (SENDER_EMAIL and to):
        return False, "sender or installer email not configured"
    try:
        ses.send_email(
            FromEmailAddress=SENDER_EMAIL,
            Destination={"ToAddresses": [to]},
            Content={"Simple": {"Subject": {"Data": subject},
                                "Body": {"Text": {"Data": text}, "Html": {"Data": html}}}},
        )
        return True, ""
    except Exception as e:  # sandbox: unverified recipient, etc.
        return False, str(e)[:300]


def _html(lines: list[str], link: str, button: str) -> str:
    body = "".join(f"<p style='margin:0 0 12px'>{line}</p>" for line in lines)
    return (f"<div style='font-family:system-ui,sans-serif;font-size:15px;color:#0b0b0b;max-width:560px'>{body}"
            f"<p><a href='{link}' style='display:inline-block;background:#1c5cab;color:#fff;padding:12px 20px;"
            f"border-radius:10px;text-decoration:none;font-weight:600'>{button}</a></p>"
            f"<p style='color:#7a7974;font-size:12px'>Sent by SunProof on behalf of the household, with their approval. "
            f"No account needed to respond.</p></div>")


def issue_email(to: str, installer: str, home_name: str, summary: str, link: str, deadline: str,
                reopened: bool = False) -> tuple[bool, str]:
    subject = f"{'Reopened: ' if reopened else ''}Solar system worth checking: {home_name}"
    lines = [
        f"Hello {installer},",
        ("The fix did not bring output back into the expected range, so this issue has been reopened."
         if reopened else "SunProof's independent check found something worth checking on a system you maintain."),
        summary,
        "The link below shows the expected-vs-actual chart and the likely cause. One click to respond: "
        "Book visit, Fixed remotely, or Not a system issue.",
        f"Please respond by {deadline}.",
    ]
    return _send(to, subject, "\n\n".join(lines + [link]), _html(lines, link, "See evidence and respond"))


def reminder_email(to: str, installer: str, home_name: str, link: str, deadline: str) -> tuple[bool, str]:
    subject = f"Reminder: solar issue for {home_name} awaiting your response"
    lines = [f"Hello {installer},",
             f"A reminder that the issue for {home_name} is still waiting for a response.",
             f"Response window ends {deadline}. After that the household gets a ready-to-file escalation draft."]
    return _send(to, subject, "\n\n".join(lines + [link]), _html(lines, link, "Respond now"))
